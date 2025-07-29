/**
 * リファクタリング済み給与計算エンジン
 * AI-OS v3.0 - 型安全性強化版
 */

import type { Result } from '@core/result';
import type { Money } from '@core/money';
import type { DateTime } from '@core/date-time';
import type { ValidationError } from '@core/validation';
import type {
  Employee,
  PayrollPeriod,
  PayrollStatus,
  PaySlip,
  Allowance,
  Deduction,
  OvertimeCalculation,
  TaxDetails,
  SocialInsuranceDetails,
  WorkSummary,
  PayrollCalculationParams,
  PayrollCalculationError,
  validateBasicSalary,
  validateOvertimeHours,
  calculateIncomeTax,
  calculateSocialInsurance,
} from '@domain/index';
import type {
  DailyAttendance,
  MonthlyAttendanceSummary,
  calculateWorkTime,
  calculateOvertime,
  calculateNightShift,
} from '@domain/attendance';
import type {
  ComplianceViolation,
  Agreement36,
  check36AgreementViolation,
  checkBreakTimeViolation,
} from '@domain/compliance';

// 日本の労働基準法に準拠した設定
const LABOR_STANDARDS_CONFIG = {
  regularHours: {
    daily: 8,
    weekly: 40,
  },
  breakTime: {
    sixHours: 45, // 6時間超で45分
    eightHours: 60, // 8時間超で60分
  },
  overtime: {
    regularRate: 1.25, // 通常残業 25%増
    lateNightRate: 1.25, // 深夜労働 25%増
    holidayRate: 1.35, // 休日労働 35%増
    highOvertimeRate: 1.50, // 月60時間超 50%増
    lateNightHolidayRate: 1.60, // 深夜休日 60%増
  },
  lateNight: {
    startHour: 22, // 22:00
    endHour: 5, // 5:00
  },
  limits: {
    monthlyOvertime: 45, // 月45時間
    yearlyOvertime: 360, // 年360時間
    highOvertimeThreshold: 60, // 月60時間
  },
} as const;

/**
 * リファクタリング済み給与計算エンジン
 */
export class RefactoredPayrollEngine {
  private readonly config = LABOR_STANDARDS_CONFIG;

  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly complianceRepository: ComplianceRepository,
    private readonly taxService: TaxCalculationService,
    private readonly insuranceService: InsuranceCalculationService
  ) {}

  /**
   * 給与計算実行
   */
  async calculatePayroll(
    params: PayrollCalculationParams
  ): Promise<Result<PaySlip, PayrollCalculationError>> {
    // 1. 従業員情報取得
    const employeeResult = await this.employeeRepository.findById(params.employeeId);
    if (employeeResult.isFailure) {
      return Result.failure({
        field: 'employeeId',
        message: '従業員が見つかりません',
        code: 'EMPLOYEE_NOT_FOUND',
        calculationStep: 'employee_fetch',
      });
    }
    const employee = employeeResult.value;

    // 2. 基本給検証
    const basicSalaryResult = validateBasicSalary(params.basicSalary);
    if (basicSalaryResult.isFailure) {
      return Result.failure({
        ...basicSalaryResult.error,
        calculationStep: 'basic_salary_validation',
      });
    }

    // 3. 勤怠サマリー取得
    const attendanceSummary = await this.getAttendanceSummary(
      params.employeeId,
      params.periodId
    );
    if (attendanceSummary.isFailure) {
      return Result.failure({
        field: 'attendance',
        message: '勤怠データの取得に失敗しました',
        code: 'ATTENDANCE_FETCH_ERROR',
        calculationStep: 'attendance_summary',
      });
    }

    // 4. 残業時間検証
    const overtimeValidation = await this.validateOvertimeCompliance(
      attendanceSummary.value,
      employee
    );
    if (overtimeValidation.isFailure) {
      return Result.failure({
        field: 'overtime',
        message: overtimeValidation.error.message,
        code: 'OVERTIME_VIOLATION',
        calculationStep: 'overtime_validation',
        details: overtimeValidation.error,
      });
    }

    // 5. 残業代計算
    const overtimeCalculation = this.calculateOvertimePay(
      attendanceSummary.value,
      employee.hourlyRate
    );

    // 6. 総支給額計算
    const grossPay = this.calculateGrossPay(
      params.basicSalary,
      params.allowances,
      overtimeCalculation
    );

    // 7. 税金計算
    const taxDetails = await this.taxService.calculate({
      grossPay,
      employee,
      exemptions: params.taxExemptions,
    });

    // 8. 社会保険計算
    const socialInsurance = await this.insuranceService.calculate({
      grossPay,
      employee,
      age: this.calculateAge(employee.birthDate),
    });

    // 9. 控除計算
    const totalDeductions = this.calculateTotalDeductions(
      taxDetails,
      socialInsurance,
      params.allowances.filter((a) => !a.isTaxable)
    );

    // 10. 手取り計算
    const netPay = Money.subtract(grossPay, totalDeductions);

    // 11. 給与明細作成
    const paySlip: PaySlip = {
      id: this.generatePaySlipId(),
      employeeId: employee.id,
      periodId: params.periodId,
      basicSalary: params.basicSalary,
      allowances: params.allowances,
      deductions: this.createDeductions(taxDetails, socialInsurance),
      overtime: overtimeCalculation,
      grossPay,
      netPay,
      taxDetails,
      socialInsurance,
      workSummary: this.createWorkSummary(attendanceSummary.value),
      bankDetails: employee.bankDetails,
      createdAt: DateTime.now(),
    };

    return Result.success(paySlip);
  }

  /**
   * 勤怠サマリー取得
   */
  private async getAttendanceSummary(
    employeeId: string,
    periodId: string
  ): Promise<Result<MonthlyAttendanceSummary, ValidationError>> {
    try {
      const summary = await this.attendanceRepository.getMonthlyS ummary(
        employeeId,
        periodId
      );
      return Result.success(summary);
    } catch (error) {
      return Result.failure({
        field: 'attendance',
        message: ' 勤怠データの取得に失敗しました',
        code: 'FETCH_ERROR',
      });
    }
  }

  /**
   * 残業コンプライアンス検証
   */
  private async validateOvertimeCompliance(
    attendance: MonthlyAttendanceSummary,
    employee: Employee
  ): Promise<Result<void, ComplianceViolation>> {
    // 36協定取得
    const agreement = await this.complianceRepository.getAgreement36(
      employee.companyId
    );
    if (!agreement) {
      return Result.failure({
        id: 'no_agreement',
        type: 'overtime_monthly',
        severity: 'critical',
        employeeId: employee.id,
        detectedAt: DateTime.now(),
        period: {
          start: DateTime.now(),
          end: DateTime.now(),
        },
        details: {
          actual: 0,
          limit: 0,
          excess: 0,
          percentage: 0,
          description: '36協定が登録されていません',
        },
        status: 'detected',
        actions: [],
      });
    }

    // 月間残業時間チェック
    const monthlyOvertime = attendance.totalOvertimeMinutes / 60;
    return check36AgreementViolation(monthlyOvertime, agreement, 'monthly');
  }

  /**
   * 残業代計算
   */
  private calculateOvertimePay(
    attendance: MonthlyAttendanceSummary,
    hourlyRate: Money
  ): OvertimeCalculation {
    const regularOvertimeHours = Math.min(
      attendance.totalOvertimeMinutes / 60,
      this.config.limits.highOvertimeThreshold
    );
    const highOvertimeHours = Math.max(
      0,
      attendance.totalOvertimeMinutes / 60 - this.config.limits.highOvertimeThreshold
    );

    const regular: OvertimeDetail = {
      hours: regularOvertimeHours,
      rate: this.config.overtime.regularRate,
      amount: Money.multiply(
        hourlyRate,
        regularOvertimeHours * this.config.overtime.regularRate
      ),
    };

    const highOvertime: OvertimeDetail = {
      hours: highOvertimeHours,
      rate: this.config.overtime.highOvertimeRate,
      amount: Money.multiply(
        hourlyRate,
        highOvertimeHours * this.config.overtime.highOvertimeRate
      ),
    };

    // 深夜・休日労働の計算（簡略化）
    const lateNight: OvertimeDetail = {
      hours: 0, // 実際の実装では勤怠データから算出
      rate: this.config.overtime.lateNightRate,
      amount: Money.create(0, 'JPY'),
    };

    const holiday: OvertimeDetail = {
      hours: 0, // 実際の実装では勤怠データから算出
      rate: this.config.overtime.holidayRate,
      amount: Money.create(0, 'JPY'),
    };

    const holidayLateNight: OvertimeDetail = {
      hours: 0,
      rate: this.config.overtime.lateNightHolidayRate,
      amount: Money.create(0, 'JPY'),
    };

    const total = [regular, highOvertime, lateNight, holiday, holidayLateNight]
      .map((detail) => detail.amount)
      .reduce((sum, amount) => Money.add(sum, amount), Money.create(0, 'JPY'));

    return {
      regular,
      lateNight,
      holiday,
      holidayLateNight,
      total,
    };
  }

  /**
   * 総支給額計算
   */
  private calculateGrossPay(
    basicSalary: Money,
    allowances: ReadonlyArray<Allowance>,
    overtime: OvertimeCalculation
  ): Money {
    const allowanceTotal = allowances
      .filter((a) => a.isTaxable)
      .reduce((sum, a) => Money.add(sum, a.amount), Money.create(0, 'JPY'));

    return [basicSalary, allowanceTotal, overtime.total].reduce(
      (sum, amount) => Money.add(sum, amount),
      Money.create(0, 'JPY')
    );
  }

  /**
   * 控除総額計算
   */
  private calculateTotalDeductions(
    taxDetails: TaxDetails,
    socialInsurance: SocialInsuranceDetails,
    nonTaxableAllowances: ReadonlyArray<Allowance>
  ): Money {
    const taxTotal = Money.add(taxDetails.incomeTax, taxDetails.residentTax);
    const nonTaxableTotal = nonTaxableAllowances.reduce(
      (sum, a) => Money.add(sum, a.amount),
      Money.create(0, 'JPY')
    );

    return Money.add(
      Money.add(taxTotal, socialInsurance.total),
      nonTaxableTotal
    );
  }

  /**
   * 控除項目作成
   */
  private createDeductions(
    taxDetails: TaxDetails,
    socialInsurance: SocialInsuranceDetails
  ): ReadonlyArray<Deduction> {
    const deductions: Deduction[] = [
      {
        type: 'income_tax',
        name: '所得税',
        amount: taxDetails.incomeTax,
      },
      {
        type: 'resident_tax',
        name: '住民税',
        amount: taxDetails.residentTax,
      },
      {
        type: 'health_insurance',
        name: '健康保険',
        amount: socialInsurance.healthInsurance.employeeAmount,
      },
      {
        type: 'pension',
        name: '厚生年金',
        amount: socialInsurance.pension.employeeAmount,
      },
      {
        type: 'employment_insurance',
        name: '雇用保険',
        amount: socialInsurance.employmentInsurance.employeeAmount,
      },
    ];

    if (socialInsurance.longTermCare) {
      deductions.push({
        type: 'long_term_care',
        name: '介護保険',
        amount: socialInsurance.longTermCare.employeeAmount,
      });
    }

    return deductions;
  }

  /**
   * 勤務サマリー作成
   */
  private createWorkSummary(attendance: MonthlyAttendanceSummary): WorkSummary {
    return {
      workDays: attendance.actualWorkDays,
      workHours: attendance.totalWorkMinutes / 60,
      overtimeHours: attendance.totalOvertimeMinutes / 60,
      lateNightHours: 0, // 実際の実装では詳細データから算出
      holidayWorkDays: attendance.holidayWorkDays,
      paidLeaveDays: attendance.paidLeaveDays,
      absenceDays: attendance.absenceDays,
    };
  }

  /**
   * 年齢計算
   */
  private calculateAge(birthDate: DateTime): number {
    const today = DateTime.now();
    const years = DateTime.diffInYears(today, birthDate);
    return Math.floor(years);
  }

  /**
   * 給与明細ID生成
   */
  private generatePaySlipId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `PS_${timestamp}_${random}`;
  }
}

// リポジトリインターフェース
interface EmployeeRepository {
  findById(id: string): Promise<Result<Employee, ValidationError>>;
}

interface AttendanceRepository {
  getMonthlyS ummary(
    employeeId: string,
    periodId: string
  ): Promise<MonthlyAttendanceSummary>;
}

interface ComplianceRepository {
  getAgreement36(companyId: string): Promise<Agreement36 | null>;
}

// サービスインターフェース
interface TaxCalculationService {
  calculate(params: {
    grossPay: Money;
    employee: Employee;
    exemptions?: ReadonlyArray<TaxDeduction>;
  }): Promise<TaxDetails>;
}

interface InsuranceCalculationService {
  calculate(params: {
    grossPay: Money;
    employee: Employee;
    age: number;
  }): Promise<SocialInsuranceDetails>;
}

// 型定義の補完
interface OvertimeDetail {
  readonly hours: number;
  readonly rate: number;
  readonly amount: Money;
}

interface TaxDeduction {
  readonly type: string;
  readonly name: string;
  readonly amount: Money;
}