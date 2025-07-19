import { describe, it, expect, beforeEach, vi } from 'vitest';
import PayrollEngine from '../../src/payroll-engine-v1.2.0.js';
import Database from '../../src/database.js';
import type { Employee, TimeRecord, PayrollResult } from '../../src/types.js';

describe('v1.2.0 給与計算エンジン - 網羅的テスト', () => {
  let engine: PayrollEngine;
  let mockDb: Database;
  let testEmployee: Employee;

  beforeEach(() => {
    mockDb = {
      getEmployee: vi.fn(),
      getTimeRecords: vi.fn(),
      getPayrollCalculations: vi.fn(),
      query: vi.fn()
    } as any;

    engine = new PayrollEngine(mockDb);

    testEmployee = {
      id: 'emp001',
      name: '山田太郎',
      email: 'yamada@example.com',
      department: '開発部',
      position: 'エンジニア',
      hourlyWage: 3000,
      startDate: '2020-04-01',
      isActive: true
    };
  });

  describe('基本給与計算', () => {
    it('通常勤務のみの給与を正確に計算する', async () => {
      const timeRecords: TimeRecord[] = [
        {
          id: 'tr001',
          employeeId: 'emp001',
          date: new Date('2024-01-15'),
          clockIn: new Date('2024-01-15T09:00:00'),
          clockOut: new Date('2024-01-15T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        }
      ];

      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(0);
      expect(result.regularPay).toBe(24000); // 8時間 × 3000円
      expect(result.overtimePay).toBe(0);
    });

    it('月間の総労働時間を正確に集計する', async () => {
      const timeRecords = generateMonthlyTimeRecords('emp001', '2024-01', 20); // 20営業日
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.regularHours).toBe(160); // 8時間 × 20日
      expect(result.totalPay).toBeGreaterThan(0);
    });
  });

  describe('残業割増計算', () => {
    describe('時間外労働（1.25倍）', () => {
      it('通常残業の割増を正確に計算する', async () => {
        const timeRecords: TimeRecord[] = [
          {
            id: 'tr001',
            employeeId: 'emp001',
            date: new Date('2024-01-15'),
            clockIn: new Date('2024-01-15T09:00:00'),
            clockOut: new Date('2024-01-15T20:00:00'), // 2時間残業
            breakMinutes: 60,
            recordType: 'ic_card'
          }
        ];

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

        const result = await engine.calculatePayroll('emp001', '2024-01');

        expect(result.overtimeHours).toBe(2);
        expect(result.overtimePay).toBe(7500); // 2時間 × 3000円 × 1.25
      });

      it('月60時間を超える残業の割増（1.50倍）を計算する', async () => {
        const timeRecords = generateHeavyOvertimeRecords('emp001', '2024-01', 80);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

        const result = await engine.calculatePayroll('emp001', '2024-01');

        expect(result.overtimeHours).toBe(80);
        // 60時間まで: 60 × 3000 × 1.25 = 225,000
        // 60時間超: 20 × 3000 × 1.50 = 90,000
        expect(result.overtimePay).toBe(315000);
      });
    });

    describe('深夜労働（0.25倍加算）', () => {
      it('深夜時間帯（22:00-05:00）の割増を計算する', async () => {
        const timeRecords: TimeRecord[] = [
          {
            id: 'tr001',
            employeeId: 'emp001',
            date: new Date('2024-01-15'),
            clockIn: new Date('2024-01-15T21:00:00'),
            clockOut: new Date('2024-01-16T06:00:00'), // 9時間勤務（深夜7時間含む）
            breakMinutes: 60,
            recordType: 'ic_card'
          }
        ];

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

        const result = await engine.calculatePayroll('emp001', '2024-01');

        expect(result.lateNightHours).toBe(7);
        expect(result.lateNightPay).toBe(5250); // 7時間 × 3000円 × 0.25
      });

      it('深夜残業（1.25 + 0.25 = 1.50倍）を計算する', async () => {
        const timeRecords: TimeRecord[] = [
          {
            id: 'tr001',
            employeeId: 'emp001',
            date: new Date('2024-01-15'),
            clockIn: new Date('2024-01-15T09:00:00'),
            clockOut: new Date('2024-01-16T02:00:00'), // 17時間勤務（深夜4時間）
            breakMinutes: 60,
            recordType: 'ic_card'
          }
        ];

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

        const result = await engine.calculatePayroll('emp001', '2024-01');

        // 通常: 8時間
        // 残業（非深夜）: 4時間（18:00-22:00）
        // 深夜残業: 4時間（22:00-02:00）
        expect(result.overtimeHours).toBe(8);
        expect(result.lateNightHours).toBe(4);
        const expectedOvertimePay = 4 * 3000 * 1.25 + 4 * 3000 * 1.50;
        expect(result.overtimePay + result.lateNightPay).toBeCloseTo(expectedOvertimePay, 0);
      });
    });

    describe('休日労働（1.35倍）', () => {
      it('法定休日の割増を計算する', async () => {
        const timeRecords: TimeRecord[] = [
          {
            id: 'tr001',
            employeeId: 'emp001',
            date: new Date('2024-01-14'), // 日曜日
            clockIn: new Date('2024-01-14T09:00:00'),
            clockOut: new Date('2024-01-14T18:00:00'),
            breakMinutes: 60,
            recordType: 'manual',
            isHoliday: true
          }
        ];

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

        const result = await engine.calculatePayroll('emp001', '2024-01');

        expect(result.holidayHours).toBe(8);
        expect(result.holidayPay).toBe(32400); // 8時間 × 3000円 × 1.35
      });

      it('休日深夜労働（1.35 + 0.25 = 1.60倍）を計算する', async () => {
        const timeRecords: TimeRecord[] = [
          {
            id: 'tr001',
            employeeId: 'emp001',
            date: new Date('2024-01-14'), // 日曜日
            clockIn: new Date('2024-01-14T20:00:00'),
            clockOut: new Date('2024-01-15T04:00:00'), // 8時間（深夜6時間）
            breakMinutes: 60,
            recordType: 'manual',
            isHoliday: true
          }
        ];

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

        const result = await engine.calculatePayroll('emp001', '2024-01');

        expect(result.holidayHours).toBe(7);
        expect(result.lateNightHours).toBe(5); // 22:00-03:00
        // 休日（非深夜）: 2時間 × 3000 × 1.35 = 8,100
        // 休日深夜: 5時間 × 3000 × 1.60 = 24,000
        const expectedPay = 2 * 3000 * 1.35 + 5 * 3000 * 1.60;
        expect(result.holidayPay + result.lateNightPay).toBeCloseTo(expectedPay, 0);
      });
    });
  });

  describe('労働基準法準拠チェック', () => {
    it('月間残業時間上限（45時間）超過を検出する', async () => {
      const timeRecords = generateHeavyOvertimeRecords('emp001', '2024-01', 50);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'OVERTIME_LIMIT_WARNING',
          message: expect.stringContaining('45時間')
        })
      );
    });

    it('年間残業時間上限（360時間）を考慮する', async () => {
      // 過去の残業記録をモック
      mockDb.getPayrollCalculations = vi.fn().mockResolvedValue(
        Array(11).fill(null).map((_, i) => ({
          month: `2023-${String(i + 1).padStart(2, '0')}`,
          overtimeHours: 35
        }))
      );

      const timeRecords = generateHeavyOvertimeRecords('emp001', '2024-01', 40);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.complianceReport?.yearlyOvertimeTotal).toBeGreaterThan(360);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'YEARLY_OVERTIME_LIMIT_WARNING'
        })
      );
    });

    it('特別条項適用時の上限（月100時間）をチェックする', async () => {
      const timeRecords = generateHeavyOvertimeRecords('emp001', '2024-01', 105);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'SPECIAL_CLAUSE_LIMIT_EXCEEDED',
          severity: 'critical'
        })
      );
    });

    it('連続する月の平均残業時間（80時間）をチェックする', async () => {
      // 前月も80時間超の残業
      mockDb.getPayrollCalculations = vi.fn().mockResolvedValue([
        { month: '2023-12', overtimeHours: 85 }
      ]);

      const timeRecords = generateHeavyOvertimeRecords('emp001', '2024-01', 85);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'CONSECUTIVE_OVERTIME_WARNING',
          message: expect.stringContaining('連続')
        })
      );
    });
  });

  describe('給与明細生成', () => {
    it('完全な給与明細を生成する', async () => {
      const timeRecords = [
        ...generateMonthlyTimeRecords('emp001', '2024-01', 20),
        ...generateOvertimeRecords('emp001', '2024-01', 5, 2), // 5日×2時間の残業
        ...generateHolidayRecords('emp001', '2024-01', 2) // 2日の休日出勤
      ];

      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.payslip).toBeDefined();
      expect(result.payslip).toMatchObject({
        employeeId: 'emp001',
        employeeName: '山田太郎',
        month: '2024-01',
        earnings: expect.objectContaining({
          basicPay: expect.any(Number),
          overtimePay: expect.any(Number),
          lateNightPay: expect.any(Number),
          holidayPay: expect.any(Number),
          totalEarnings: expect.any(Number)
        }),
        deductions: expect.objectContaining({
          healthInsurance: expect.any(Number),
          pensionInsurance: expect.any(Number),
          employmentInsurance: expect.any(Number),
          incomeTax: expect.any(Number),
          residentTax: expect.any(Number),
          totalDeductions: expect.any(Number)
        }),
        netPay: expect.any(Number),
        workingDays: expect.any(Number),
        totalHours: expect.any(Number)
      });

      // 手取り額の妥当性チェック
      expect(result.payslip.netPay).toBeLessThan(result.payslip.earnings.totalEarnings);
      expect(result.payslip.netPay).toBeGreaterThan(result.payslip.earnings.totalEarnings * 0.7);
    });

    it('所得税を正確に計算する', async () => {
      const highWageEmployee = { ...testEmployee, hourlyWage: 5000 };
      const timeRecords = generateMonthlyTimeRecords('emp001', '2024-01', 20);

      mockDb.getEmployee = vi.fn().mockResolvedValue(highWageEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      const monthlyIncome = result.totalPay;
      const expectedTaxRate = monthlyIncome > 330000 ? 0.2 : 0.1;
      const expectedTax = Math.floor(monthlyIncome * expectedTaxRate);

      expect(result.payslip?.deductions.incomeTax).toBeCloseTo(expectedTax, -3);
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しない従業員の給与計算でエラーを投げる', async () => {
      mockDb.getEmployee = vi.fn().mockResolvedValue(null);

      await expect(engine.calculatePayroll('invalid', '2024-01'))
        .rejects.toThrow('Employee not found');
    });

    it('無効な月形式でエラーを投げる', async () => {
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

      await expect(engine.calculatePayroll('emp001', 'invalid-month'))
        .rejects.toThrow('Invalid month format');
    });

    it('勤怠データがない場合でも給与計算を実行する', async () => {
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue([]);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.totalPay).toBe(0);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'NO_TIME_RECORDS'
        })
      );
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量の勤怠データでも5秒以内に計算完了する', async () => {
      const timeRecords = generateMonthlyTimeRecords('emp001', '2024-01', 31);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const startTime = Date.now();
      await engine.calculatePayroll('emp001', '2024-01');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('50名の従業員の給与を並列計算する', async () => {
      const employees = Array(50).fill(null).map((_, i) => ({
        ...testEmployee,
        id: `emp${String(i + 1).padStart(3, '0')}`
      }));

      mockDb.getEmployee = vi.fn().mockImplementation((id) =>
        Promise.resolve(employees.find(e => e.id === id))
      );
      mockDb.getTimeRecords = vi.fn().mockImplementation((empId) =>
        Promise.resolve(generateMonthlyTimeRecords(empId, '2024-01', 20))
      );

      const startTime = Date.now();
      const results = await Promise.all(
        employees.map(emp => engine.calculatePayroll(emp.id, '2024-01'))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(10000); // 10秒以内
    });
  });

  describe('特殊ケース', () => {
    it('月をまたぐ勤務の労働時間を正確に計算する', async () => {
      const timeRecords: TimeRecord[] = [
        {
          id: 'tr001',
          employeeId: 'emp001',
          date: new Date('2024-01-31'),
          clockIn: new Date('2024-01-31T22:00:00'),
          clockOut: new Date('2024-02-01T06:00:00'), // 翌月にまたがる
          breakMinutes: 60,
          recordType: 'ic_card'
        }
      ];

      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      // 1月分のみ計算（22:00-24:00 = 2時間）
      expect(result.lateNightHours).toBe(2);
    });

    it('時給0円の従業員（インターン等）の計算を処理する', async () => {
      const internEmployee = { ...testEmployee, hourlyWage: 0 };
      const timeRecords = generateMonthlyTimeRecords('emp001', '2024-01', 20);

      mockDb.getEmployee = vi.fn().mockResolvedValue(internEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.totalPay).toBe(0);
      expect(result.regularHours).toBe(160);
    });

    it('1ヶ月の全日休日出勤の計算を処理する', async () => {
      const timeRecords = Array(10).fill(null).map((_, i) => ({
        id: `tr${i}`,
        employeeId: 'emp001',
        date: new Date(`2024-01-${i + 1}`),
        clockIn: new Date(`2024-01-${i + 1}T09:00:00`),
        clockOut: new Date(`2024-01-${i + 1}T18:00:00`),
        breakMinutes: 60,
        recordType: 'manual' as const,
        isHoliday: true
      }));

      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(timeRecords);

      const result = await engine.calculatePayroll('emp001', '2024-01');

      expect(result.holidayHours).toBe(80); // 8時間 × 10日
      expect(result.regularHours).toBe(0);
    });
  });
});

// ヘルパー関数
function generateMonthlyTimeRecords(employeeId: string, month: string, days: number): TimeRecord[] {
  const records: TimeRecord[] = [];
  const [year, monthNum] = month.split('-').map(Number);

  for (let day = 1; day <= days; day++) {
    const date = new Date(year, monthNum - 1, day);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // 週末スキップ

    records.push({
      id: `tr_${employeeId}_${day}`,
      employeeId,
      date,
      clockIn: new Date(date.setHours(9, 0, 0, 0)),
      clockOut: new Date(date.setHours(18, 0, 0, 0)),
      breakMinutes: 60,
      recordType: 'ic_card'
    });
  }

  return records;
}

function generateOvertimeRecords(employeeId: string, month: string, days: number, hoursPerDay: number): TimeRecord[] {
  const records: TimeRecord[] = [];
  const [year, monthNum] = month.split('-').map(Number);

  for (let day = 1; day <= days; day++) {
    const date = new Date(year, monthNum - 1, day);
    records.push({
      id: `ot_${employeeId}_${day}`,
      employeeId,
      date,
      clockIn: new Date(date.setHours(9, 0, 0, 0)),
      clockOut: new Date(date.setHours(18 + hoursPerDay, 0, 0, 0)),
      breakMinutes: 60,
      recordType: 'ic_card'
    });
  }

  return records;
}

function generateHeavyOvertimeRecords(employeeId: string, month: string, totalOvertimeHours: number): TimeRecord[] {
  const records: TimeRecord[] = [];
  const [year, monthNum] = month.split('-').map(Number);
  const overtimePerDay = Math.ceil(totalOvertimeHours / 20); // 20営業日で分配

  for (let day = 1; day <= 20; day++) {
    const date = new Date(year, monthNum - 1, day);
    const remainingHours = Math.min(overtimePerDay, totalOvertimeHours - (day - 1) * overtimePerDay);
    
    records.push({
      id: `hot_${employeeId}_${day}`,
      employeeId,
      date,
      clockIn: new Date(date.setHours(9, 0, 0, 0)),
      clockOut: new Date(date.setHours(18 + remainingHours, 0, 0, 0)),
      breakMinutes: remainingHours > 2 ? 75 : 60,
      recordType: 'ic_card'
    });
  }

  return records;
}

function generateHolidayRecords(employeeId: string, month: string, days: number): TimeRecord[] {
  const records: TimeRecord[] = [];
  const [year, monthNum] = month.split('-').map(Number);

  for (let i = 0; i < days; i++) {
    const date = new Date(year, monthNum - 1, 7 + i * 7); // 日曜日
    records.push({
      id: `hol_${employeeId}_${i}`,
      employeeId,
      date,
      clockIn: new Date(date.setHours(9, 0, 0, 0)),
      clockOut: new Date(date.setHours(18, 0, 0, 0)),
      breakMinutes: 60,
      recordType: 'manual',
      isHoliday: true
    });
  }

  return records;
}