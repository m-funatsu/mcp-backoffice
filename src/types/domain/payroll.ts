/**
 * 給与計算ドメイン型定義
 * AI-OS v3.0
 */

import { Money } from '../core/money';
import { DateTime } from '../core/date-time';
import { Result } from '../core/result';
import { ValidationError } from '../core/validation';

/**
 * 給与計算期間
 */
export interface PayrollPeriod {
  readonly id: string;
  readonly startDate: DateTime;
  readonly endDate: DateTime;
  readonly paymentDate: DateTime;
  readonly cutoffDate: DateTime;
  readonly status: PayrollStatus;
}

/**
 * 給与計算ステータス
 */
export type PayrollStatus = 
  | 'draft'        // 下書き
  | 'calculating'  // 計算中
  | 'review'       // レビュー中
  | 'approved'     // 承認済み
  | 'paid'         // 支払済み
  | 'cancelled';   // キャンセル

/**
 * 給与明細
 */
export interface PaySlip {
  readonly id: string;
  readonly employeeId: string;
  readonly periodId: string;
  readonly basicSalary: Money;
  readonly allowances: ReadonlyArray<Allowance>;
  readonly deductions: ReadonlyArray<Deduction>;
  readonly overtime: OvertimeCalculation;
  readonly grossPay: Money;
  readonly netPay: Money;
  readonly taxDetails: TaxDetails;
  readonly socialInsurance: SocialInsuranceDetails;
  readonly workSummary: WorkSummary;
  readonly bankDetails: BankDetails;
  readonly createdAt: DateTime;
  readonly approvedBy?: string;
  readonly approvedAt?: DateTime;
}

/**
 * 手当
 */
export interface Allowance {
  readonly type: AllowanceType;
  readonly name: string;
  readonly amount: Money;
  readonly isTaxable: boolean;
  readonly isInsurable: boolean;
  readonly note?: string;
}

/**
 * 手当種別
 */
export type AllowanceType = 
  | 'transport'        // 通勤手当
  | 'housing'          // 住宅手当
  | 'family'           // 家族手当
  | 'position'         // 役職手当
  | 'qualification'    // 資格手当
  | 'overtime_fixed'   // 固定残業手当
  | 'special'          // 特別手当
  | 'other';           // その他

/**
 * 控除
 */
export interface Deduction {
  readonly type: DeductionType;
  readonly name: string;
  readonly amount: Money;
  readonly note?: string;
}

/**
 * 控除種別
 */
export type DeductionType = 
  | 'income_tax'           // 所得税
  | 'resident_tax'         // 住民税
  | 'health_insurance'     // 健康保険
  | 'pension'              // 厚生年金
  | 'employment_insurance' // 雇用保険
  | 'long_term_care'       // 介護保険
  | 'union_fee'            // 組合費
  | 'advance'              // 前払い
  | 'loan'                 // 貸付金返済
  | 'other';               // その他

/**
 * 残業計算
 */
export interface OvertimeCalculation {
  readonly regular: OvertimeDetail;         // 通常残業
  readonly lateNight: OvertimeDetail;       // 深夜残業
  readonly holiday: OvertimeDetail;         // 休日出勤
  readonly holidayLateNight: OvertimeDetail; // 休日深夜
  readonly total: Money;
}

/**
 * 残業詳細
 */
export interface OvertimeDetail {
  readonly hours: number;
  readonly rate: number;  // 割増率（1.25, 1.35, 1.5, 1.6等）
  readonly amount: Money;
}

/**
 * 税金詳細
 */
export interface TaxDetails {
  readonly incomeTax: Money;
  readonly residentTax: Money;
  readonly taxableIncome: Money;
  readonly deductions: ReadonlyArray<TaxDeduction>;
}

/**
 * 税控除
 */
export interface TaxDeduction {
  readonly type: string;
  readonly name: string;
  readonly amount: Money;
}

/**
 * 社会保険詳細
 */
export interface SocialInsuranceDetails {
  readonly healthInsurance: InsuranceDetail;
  readonly pension: InsuranceDetail;
  readonly employmentInsurance: InsuranceDetail;
  readonly longTermCare?: InsuranceDetail;
  readonly total: Money;
}

/**
 * 保険詳細
 */
export interface InsuranceDetail {
  readonly rate: number;         // 料率
  readonly employeeAmount: Money; // 従業員負担額
  readonly employerAmount: Money; // 会社負担額
  readonly basis: Money;         // 標準報酬月額等
}

/**
 * 勤務サマリー
 */
export interface WorkSummary {
  readonly workDays: number;
  readonly workHours: number;
  readonly overtimeHours: number;
  readonly lateNightHours: number;
  readonly holidayWorkDays: number;
  readonly paidLeaveDays: number;
  readonly absenceDays: number;
}

/**
 * 銀行詳細
 */
export interface BankDetails {
  readonly bankName: string;
  readonly branchName: string;
  readonly accountType: 'ordinary' | 'current' | 'savings';
  readonly accountNumber: string;
  readonly accountHolder: string;
}

/**
 * 給与計算パラメータ
 */
export interface PayrollCalculationParams {
  readonly employeeId: string;
  readonly periodId: string;
  readonly basicSalary: Money;
  readonly allowances: ReadonlyArray<Allowance>;
  readonly workSummary: WorkSummary;
  readonly taxExemptions?: ReadonlyArray<TaxDeduction>;
  readonly previousMonthCarryover?: Money;
}

/**
 * 賞与
 */
export interface Bonus {
  readonly id: string;
  readonly employeeId: string;
  readonly paymentDate: DateTime;
  readonly baseAmount: Money;
  readonly performanceRate: number;
  readonly totalAmount: Money;
  readonly taxDetails: TaxDetails;
  readonly socialInsurance: SocialInsuranceDetails;
  readonly netAmount: Money;
  readonly note?: string;
}

/**
 * 年末調整
 */
export interface YearEndAdjustment {
  readonly id: string;
  readonly employeeId: string;
  readonly year: number;
  readonly totalIncome: Money;
  readonly totalTax: Money;
  readonly adjustmentAmount: Money; // 還付(+)または追徴(-)
  readonly deductions: ReadonlyArray<YearEndDeduction>;
  readonly dependents: ReadonlyArray<Dependent>;
  readonly insurancePremiums: ReadonlyArray<InsurancePremium>;
  readonly mortgageDeduction?: MortgageDeduction;
}

/**
 * 年末調整控除
 */
export interface YearEndDeduction {
  readonly type: string;
  readonly name: string;
  readonly amount: Money;
  readonly documents: ReadonlyArray<string>; // 添付書類ID
}

/**
 * 扶養家族
 */
export interface Dependent {
  readonly name: string;
  readonly relationship: string;
  readonly birthDate: DateTime;
  readonly income: Money;
  readonly isDisabled: boolean;
  readonly liveTogether: boolean;
}

/**
 * 保険料
 */
export interface InsurancePremium {
  readonly type: 'life' | 'pension' | 'medical' | 'longTermCare';
  readonly insurer: string;
  readonly annualPremium: Money;
  readonly deductionAmount: Money;
}

/**
 * 住宅ローン控除
 */
export interface MortgageDeduction {
  readonly loanBalance: Money;
  readonly deductionRate: number;
  readonly deductionAmount: Money;
  readonly remainingYears: number;
}

/**
 * 給与計算エラー
 */
export interface PayrollCalculationError extends ValidationError {
  readonly calculationStep?: string;
  readonly details?: Record<string, unknown>;
}

/**
 * 基本給検証
 */
export function validateBasicSalary(
  amount: Money
): Result<Money, ValidationError> {
  if (amount.amount < 0) {
    return Result.failure({
      field: 'basicSalary',
      message: '基本給は0以上である必要があります',
      code: 'INVALID_AMOUNT'
    });
  }

  // 最低賃金チェック（都道府県別の実装は省略）
  const minimumWage = Money.create(100000, 'JPY');
  if (Money.compare(amount, minimumWage) < 0) {
    return Result.failure({
      field: 'basicSalary',
      message: '基本給が最低賃金を下回っています',
      code: 'BELOW_MINIMUM_WAGE'
    });
  }

  return Result.success(amount);
}

/**
 * 残業時間検証（36協定準拠）
 */
export function validateOvertimeHours(
  hours: number,
  monthlyLimit: number = 45
): Result<number, ValidationError> {
  if (hours < 0) {
    return Result.failure({
      field: 'overtimeHours',
      message: '残業時間は0以上である必要があります',
      code: 'INVALID_HOURS'
    });
  }

  if (hours > monthlyLimit) {
    return Result.failure({
      field: 'overtimeHours',
      message: `残業時間が月間上限（${monthlyLimit}時間）を超えています`,
      code: 'OVERTIME_LIMIT_EXCEEDED'
    });
  }

  return Result.success(hours);
}

/**
 * 税額計算（簡易版）
 */
export function calculateIncomeTax(
  taxableIncome: Money,
  dependents: number = 0
): Money {
  // 実際の計算ロジックは複雑なため簡略化
  const taxRate = 0.1; // 10%
  const basicDeduction = Money.create(380000, 'JPY');
  const dependentDeduction = Money.create(380000 * dependents, 'JPY');
  
  const deductedIncome = Money.subtract(
    Money.subtract(taxableIncome, basicDeduction),
    dependentDeduction
  );
  
  return Money.multiply(deductedIncome, taxRate);
}

/**
 * 社会保険料計算（簡易版）
 */
export function calculateSocialInsurance(
  standardMonthlyRemuneration: Money
): SocialInsuranceDetails {
  // 実際の料率は複雑なため簡略化
  const healthInsuranceRate = 0.05; // 5%
  const pensionRate = 0.0915; // 9.15%
  const employmentInsuranceRate = 0.003; // 0.3%
  
  return {
    healthInsurance: {
      rate: healthInsuranceRate,
      employeeAmount: Money.multiply(standardMonthlyRemuneration, healthInsuranceRate),
      employerAmount: Money.multiply(standardMonthlyRemuneration, healthInsuranceRate),
      basis: standardMonthlyRemuneration
    },
    pension: {
      rate: pensionRate,
      employeeAmount: Money.multiply(standardMonthlyRemuneration, pensionRate),
      employerAmount: Money.multiply(standardMonthlyRemuneration, pensionRate),
      basis: standardMonthlyRemuneration
    },
    employmentInsurance: {
      rate: employmentInsuranceRate,
      employeeAmount: Money.multiply(standardMonthlyRemuneration, employmentInsuranceRate),
      employerAmount: Money.multiply(standardMonthlyRemuneration, employmentInsuranceRate * 2),
      basis: standardMonthlyRemuneration
    },
    total: Money.create(0, 'JPY') // 計算省略
  };
}