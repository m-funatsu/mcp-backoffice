/**
 * 給与計算エンジン単体テスト
 * リファクタリング済みバージョン
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RefactoredPayrollEngine } from '../payroll-engine-refactored';
import { Result } from '@core/result';
import { Money } from '@core/money';
import { DateTime } from '@core/date-time';
import type { 
  Employee,
  PayrollCalculationParams,
  PaySlip,
  WorkSummary 
} from '@domain/index';

describe('RefactoredPayrollEngine', () => {
  let engine: RefactoredPayrollEngine;
  let mockEmployeeRepository: any;
  let mockAttendanceRepository: any;
  let mockComplianceRepository: any;
  let mockTaxService: any;
  let mockInsuranceService: any;

  beforeEach(() => {
    // モックの初期化
    mockEmployeeRepository = {
      findById: vi.fn(),
    };

    mockAttendanceRepository = {
      getMonthlyS ummary: vi.fn(),
    };

    mockComplianceRepository = {
      getAgreement36: vi.fn(),
    };

    mockTaxService = {
      calculate: vi.fn(),
    };

    mockInsuranceService = {
      calculate: vi.fn(),
    };

    engine = new RefactoredPayrollEngine(
      mockEmployeeRepository,
      mockAttendanceRepository,
      mockComplianceRepository,
      mockTaxService,
      mockInsuranceService
    );
  });

  describe('calculatePayroll', () => {
    it('正常な給与計算を実行できる', async () => {
      // Arrange
      const employee: Employee = {
        id: 'EMP001',
        companyId: 'COMP001',
        employeeCode: 'E001',
        firstName: '太郎',
        lastName: '山田',
        firstNameKana: 'タロウ',
        lastNameKana: 'ヤマダ',
        email: 'taro.yamada@example.com',
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        phoneNumber: '090-1234-5678',
        address: {
          postalCode: '100-0001',
          prefecture: '東京都',
          city: '千代田区',
          street: '千代田1-1-1',
        },
        joinedDate: new Date('2020-04-01'),
        employmentType: 'full_time',
        status: 'active',
        department: {
          id: 'DEPT001',
          name: '開発部',
          code: 'DEV',
        },
        position: {
          id: 'POS001',
          name: 'エンジニア',
          level: 'senior',
        },
        hourlyRate: Money.create(3000, 'JPY'),
        bankDetails: {
          bankName: 'みずほ銀行',
          branchName: '東京支店',
          accountType: 'ordinary',
          accountNumber: '1234567',
          accountHolder: '山田太郎',
        },
      };

      const params: PayrollCalculationParams = {
        employeeId: 'EMP001',
        periodId: 'PERIOD001',
        basicSalary: Money.create(300000, 'JPY'),
        allowances: [
          {
            type: 'transport',
            name: '通勤手当',
            amount: Money.create(20000, 'JPY'),
            isTaxable: false,
            isInsurable: false,
          },
        ],
        workSummary: {
          workDays: 20,
          workHours: 160,
          overtimeHours: 20,
          lateNightHours: 5,
          holidayWorkDays: 1,
          paidLeaveDays: 0,
          absenceDays: 0,
        },
      };

      const attendanceSummary = {
        employeeId: 'EMP001',
        year: 2025,
        month: 1,
        workDays: 20,
        actualWorkDays: 20,
        totalWorkMinutes: 9600, // 160時間
        totalOvertimeMinutes: 1200, // 20時間
        totalLateMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        absenceDays: 0,
        paidLeaveDays: 0,
        sickLeaveDays: 0,
        specialLeaveDays: 0,
        holidayWorkDays: 1,
        compensatoryDays: 0,
      };

      const agreement36 = {
        id: 'AGR001',
        companyId: 'COMP001',
        effectiveDate: new Date('2025-01-01'),
        expiryDate: new Date('2025-12-31'),
        standardLimits: {
          dailyOvertime: 5,
          monthlyOvertime: 45,
          yearlyOvertime: 360,
        },
      };

      mockEmployeeRepository.findById.mockResolvedValue(Result.success(employee));
      mockAttendanceRepository.getMonthlyS ummary.mockResolvedValue(attendanceSummary);
      mockComplianceRepository.getAgreement36.mockResolvedValue(agreement36);
      mockTaxService.calculate.mockResolvedValue({
        incomeTax: Money.create(15000, 'JPY'),
        residentTax: Money.create(10000, 'JPY'),
        taxableIncome: Money.create(300000, 'JPY'),
        deductions: [],
      });
      mockInsuranceService.calculate.mockResolvedValue({
        healthInsurance: {
          rate: 0.05,
          employeeAmount: Money.create(15000, 'JPY'),
          employerAmount: Money.create(15000, 'JPY'),
          basis: Money.create(300000, 'JPY'),
        },
        pension: {
          rate: 0.0915,
          employeeAmount: Money.create(27450, 'JPY'),
          employerAmount: Money.create(27450, 'JPY'),
          basis: Money.create(300000, 'JPY'),
        },
        employmentInsurance: {
          rate: 0.003,
          employeeAmount: Money.create(900, 'JPY'),
          employerAmount: Money.create(1800, 'JPY'),
          basis: Money.create(300000, 'JPY'),
        },
        total: Money.create(43350, 'JPY'),
      });

      // Act
      const result = await engine.calculatePayroll(params);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const paySlip = result.value;
        expect(paySlip.employeeId).toBe('EMP001');
        expect(paySlip.basicSalary).toEqual(Money.create(300000, 'JPY'));
        expect(paySlip.grossPay.amount).toBeGreaterThan(300000); // 基本給 + 残業代
        expect(paySlip.netPay.amount).toBeLessThan(paySlip.grossPay.amount); // 控除後
      }
    });

    it('従業員が見つからない場合はエラーを返す', async () => {
      // Arrange
      const params: PayrollCalculationParams = {
        employeeId: 'INVALID',
        periodId: 'PERIOD001',
        basicSalary: Money.create(300000, 'JPY'),
        allowances: [],
        workSummary: {} as WorkSummary,
      };

      mockEmployeeRepository.findById.mockResolvedValue(
        Result.failure({
          field: 'employeeId',
          message: '従業員が見つかりません',
          code: 'EMPLOYEE_NOT_FOUND',
        })
      );

      // Act
      const result = await engine.calculatePayroll(params);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe('EMPLOYEE_NOT_FOUND');
      }
    });

    it('基本給が最低賃金を下回る場合はエラーを返す', async () => {
      // Arrange
      const params: PayrollCalculationParams = {
        employeeId: 'EMP001',
        periodId: 'PERIOD001',
        basicSalary: Money.create(50000, 'JPY'), // 最低賃金以下
        allowances: [],
        workSummary: {} as WorkSummary,
      };

      // Act
      const result = await engine.calculatePayroll(params);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe('BELOW_MINIMUM_WAGE');
      }
    });

    it('残業時間が36協定の上限を超える場合はエラーを返す', async () => {
      // Arrange
      const employee: Employee = createTestEmployee();
      const params: PayrollCalculationParams = {
        employeeId: 'EMP001',
        periodId: 'PERIOD001',
        basicSalary: Money.create(300000, 'JPY'),
        allowances: [],
        workSummary: {
          workDays: 20,
          workHours: 160,
          overtimeHours: 50, // 月45時間超
          lateNightHours: 0,
          holidayWorkDays: 0,
          paidLeaveDays: 0,
          absenceDays: 0,
        },
      };

      const attendanceSummary = {
        employeeId: 'EMP001',
        year: 2025,
        month: 1,
        workDays: 20,
        actualWorkDays: 20,
        totalWorkMinutes: 9600,
        totalOvertimeMinutes: 3000, // 50時間
        totalLateMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        absenceDays: 0,
        paidLeaveDays: 0,
        sickLeaveDays: 0,
        specialLeaveDays: 0,
        holidayWorkDays: 0,
        compensatoryDays: 0,
      };

      const agreement36 = {
        id: 'AGR001',
        companyId: 'COMP001',
        effectiveDate: new Date('2025-01-01'),
        expiryDate: new Date('2025-12-31'),
        standardLimits: {
          dailyOvertime: 5,
          monthlyOvertime: 45,
          yearlyOvertime: 360,
        },
      };

      mockEmployeeRepository.findById.mockResolvedValue(Result.success(employee));
      mockAttendanceRepository.getMonthlyS ummary.mockResolvedValue(attendanceSummary);
      mockComplianceRepository.getAgreement36.mockResolvedValue(agreement36);

      // Act
      const result = await engine.calculatePayroll(params);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.code).toBe('OVERTIME_VIOLATION');
      }
    });
  });

  describe('残業代計算', () => {
    it('月60時間以下の残業は1.25倍で計算される', async () => {
      // テスト実装
    });

    it('月60時間超の残業は1.50倍で計算される', async () => {
      // テスト実装
    });

    it('深夜労働は1.25倍で計算される', async () => {
      // テスト実装
    });

    it('休日労働は1.35倍で計算される', async () => {
      // テスト実装
    });

    it('休日深夜労働は1.60倍で計算される', async () => {
      // テスト実装
    });
  });
});

// テスト用ヘルパー関数
function createTestEmployee(): Employee {
  return {
    id: 'EMP001',
    companyId: 'COMP001',
    employeeCode: 'E001',
    firstName: '太郎',
    lastName: '山田',
    firstNameKana: 'タロウ',
    lastNameKana: 'ヤマダ',
    email: 'taro.yamada@example.com',
    birthDate: new Date('1990-01-01'),
    gender: 'male',
    phoneNumber: '090-1234-5678',
    address: {
      postalCode: '100-0001',
      prefecture: '東京都',
      city: '千代田区',
      street: '千代田1-1-1',
    },
    joinedDate: new Date('2020-04-01'),
    employmentType: 'full_time',
    status: 'active',
    department: {
      id: 'DEPT001',
      name: '開発部',
      code: 'DEV',
    },
    position: {
      id: 'POS001',
      name: 'エンジニア',
      level: 'senior',
    },
    hourlyRate: Money.create(3000, 'JPY'),
    bankDetails: {
      bankName: 'みずほ銀行',
      branchName: '東京支店',
      accountType: 'ordinary',
      accountNumber: '1234567',
      accountHolder: '山田太郎',
    },
  };
}