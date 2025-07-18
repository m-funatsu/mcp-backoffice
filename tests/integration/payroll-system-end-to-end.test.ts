import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegratedPayrollEngine } from '../../src/payroll-engine.js';
import { WorkingHoursCalculator } from '../../src/working-hours-calculator.js';
import { createMockDatabase } from '../setup/test-db.js';
import type { Employee, TimeRecord, PayrollCalculation } from '../../src/types.js';

/**
 * 給与計算システム統合テスト（スルーテスト）
 * 
 * 従業員登録から給与明細生成まで、実際のワークフローを通したテスト
 * 複数の機能が連携して正しく動作することを検証
 */

describe('給与計算システム統合テスト（スルーテスト）', () => {
  let mockDb: any;
  let payrollEngine: IntegratedPayrollEngine;
  let workingHoursCalculator: WorkingHoursCalculator;

  beforeEach(() => {
    mockDb = createMockDatabase();
    payrollEngine = new IntegratedPayrollEngine(mockDb);
    workingHoursCalculator = new WorkingHoursCalculator();
  });

  describe('基本的な給与計算フロー', () => {
    it('新規従業員の1ヶ月給与計算フロー', async () => {
      // 1. 従業員登録
      const employee: Employee = {
        id: 'EMP_FLOW_001',
        name: '山田太郎',
        department: '開発部',
        position: 'エンジニア',
        hourlyRate: 2500,
        startDate: new Date('2024-04-01'),
        birthDate: new Date('1990-04-01'), // 34歳
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly',
        taxInfo: {
          dependents: 1,
          taxRate: 0.10,
          isDisabled: false,
          isSingleParent: false,
          hasSpouseDeduction: true
        }
      };

      mockDb.addEmployee(employee);

      // 2. 1ヶ月分の勤怠データ入力（平日22日間）
      const timeRecords: TimeRecord[] = [];
      
      // 通常勤務パターン（8時間勤務）
      for (let day = 1; day <= 15; day++) {
        if ([6, 7, 13, 14].includes(day)) continue; // 土日をスキップ
        
        timeRecords.push({
          id: `TR_${day}`,
          employeeId: 'EMP_FLOW_001',
          date: new Date(`2024-07-${day.toString().padStart(2, '0')}`),
          clockIn: new Date(`2024-07-${day.toString().padStart(2, '0')}T09:00:00`),
          clockOut: new Date(`2024-07-${day.toString().padStart(2, '0')}T18:00:00`),
          breakMinutes: 60,
          recordType: 'ic_card'
        });
      }

      // 残業パターン（10時間勤務）
      for (let day = 16; day <= 22; day++) {
        if ([20, 21].includes(day)) continue; // 土日をスキップ
        
        timeRecords.push({
          id: `TR_${day}`,
          employeeId: 'EMP_FLOW_001',
          date: new Date(`2024-07-${day.toString().padStart(2, '0')}`),
          clockIn: new Date(`2024-07-${day.toString().padStart(2, '0')}T09:00:00`),
          clockOut: new Date(`2024-07-${day.toString().padStart(2, '0')}T20:00:00`),
          breakMinutes: 90,
          recordType: 'ic_card'
        });
      }

      mockDb.addTimeRecords('EMP_FLOW_001', timeRecords);

      // 3. 労働時間計算
      const monthlySummary = workingHoursCalculator.calculateMonthlyHours(timeRecords);
      
      expect(monthlySummary.workingDays).toBe(16); // 平日のみ（実際のデータに合わせて調整）
      expect(monthlySummary.totalRegularHours).toBeGreaterThan(120); // 通常時間
      expect(monthlySummary.totalOvertimeHours).toBeGreaterThan(0); // 残業時間
      expect(monthlySummary.compliance.monthlyOvertimeCompliant).toBe(true); // コンプライアンス

      // 4. 給与明細生成
      const payslip = await payrollEngine.generatePayslip('EMP_FLOW_001', '2024-07');

      // 5. 給与明細検証
      expect(payslip.employeeId).toBe('EMP_FLOW_001');
      expect(payslip.month).toBe('2024-07');
      expect(payslip.baseSalary).toBeGreaterThan(300000); // 基本給
      expect(payslip.totalDeductions).toBeGreaterThan(0); // 控除額
      expect(payslip.netPay).toBeGreaterThan(250000); // 手取り
      
      // 社会保険料検証
      expect(payslip.socialInsurance.healthInsurance).toBeGreaterThan(0);
      expect(payslip.socialInsurance.pensionInsurance).toBeGreaterThan(0);
      expect(payslip.socialInsurance.unemploymentInsurance).toBeGreaterThan(0);
      expect(payslip.socialInsurance.longTermCareInsurance).toBe(0); // 40歳未満

      // 税金検証
      expect(payslip.taxCalculation.incomeTax).toBeGreaterThan(0);
      expect(payslip.taxCalculation.residentTax).toBeGreaterThan(0);
    });
  });

  describe('複雑なケースの統合テスト', () => {
    it('深夜労働・休日労働を含む月の給与計算', async () => {
      // 夜勤・休日出勤ありの従業員
      const nightWorker: Employee = {
        id: 'EMP_NIGHT_001',
        name: '夜勤作業員',
        department: '運用部',
        position: 'オペレーター',
        hourlyRate: 3000,
        startDate: new Date('2020-04-01'),
        birthDate: new Date('1975-04-01'), // 49歳（介護保険料あり）
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(nightWorker);

      const timeRecords: TimeRecord[] = [
        // 深夜勤務
        {
          id: 'TR_NIGHT_1',
          employeeId: 'EMP_NIGHT_001',
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T22:00:00'),
          clockOut: new Date('2024-07-02T06:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        },
        // 休日出勤（土曜日）
        {
          id: 'TR_HOLIDAY_1',
          employeeId: 'EMP_NIGHT_001',
          date: new Date('2024-07-06'), // 土曜日
          clockIn: new Date('2024-07-06T09:00:00'),
          clockOut: new Date('2024-07-06T17:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        },
        // 通常勤務
        {
          id: 'TR_NORMAL_1',
          employeeId: 'EMP_NIGHT_001',
          date: new Date('2024-07-03'),
          clockIn: new Date('2024-07-03T09:00:00'),
          clockOut: new Date('2024-07-03T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        }
      ];

      mockDb.addTimeRecords('EMP_NIGHT_001', timeRecords);

      // 労働時間計算
      const nightRecord = timeRecords[0];
      const nightBreakdown = workingHoursCalculator.calculateDailyHours(nightRecord);
      
      expect(nightBreakdown.lateNightHours).toBeGreaterThan(0); // 深夜労働時間
      expect(nightBreakdown.overtimeHours).toBeGreaterThan(0); // 夜勤は全て残業

      const holidayRecord = timeRecords[1];
      const holidayBreakdown = workingHoursCalculator.calculateDailyHours(holidayRecord);
      
      expect(holidayBreakdown.isWeekend).toBe(true); // 土曜日
      expect(holidayBreakdown.holidayHours).toBeGreaterThan(0); // 休日労働時間

      // 給与明細生成
      const payslip = await payrollEngine.generatePayslip('EMP_NIGHT_001', '2024-07');

      // 深夜・休日手当の検証
      const overtimeAllowance = payslip.allowances.find(a => a.type === 'overtime');
      const lateNightAllowance = payslip.allowances.find(a => a.type === 'late_night');
      const holidayAllowance = payslip.allowances.find(a => a.type === 'holiday');
      
      expect(overtimeAllowance?.amount).toBeGreaterThan(0); // 残業代
      expect(lateNightAllowance?.amount).toBeGreaterThan(0); // 深夜手当
      expect(holidayAllowance?.amount).toBeGreaterThan(0); // 休日手当
      
      // 介護保険料（40歳以上）
      expect(payslip.socialInsurance.longTermCareInsurance).toBeGreaterThan(0);
    });

    it('月60時間超残業の割増率計算', async () => {
      // 残業の多い従業員
      const overtimeWorker: Employee = {
        id: 'EMP_OVERTIME_001',
        name: '残業太郎',
        department: 'プロジェクト部',
        position: 'プロジェクトマネージャー',
        hourlyRate: 4000,
        startDate: new Date('2015-04-01'),
        birthDate: new Date('1985-04-01'), // 39歳
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(overtimeWorker);

      // 大量の残業時間を作成（月70時間残業）
      const timeRecords: TimeRecord[] = [];
      
      for (let day = 1; day <= 22; day++) {
        // 土日をスキップ
        const date = new Date(`2024-07-${day.toString().padStart(2, '0')}`);
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        timeRecords.push({
          id: `TR_OT_${day}`,
          employeeId: 'EMP_OVERTIME_001',
          date,
          clockIn: new Date(`2024-07-${day.toString().padStart(2, '0')}T09:00:00`),
          clockOut: new Date(`2024-07-${day.toString().padStart(2, '0')}T22:00:00`), // 12時間勤務
          breakMinutes: 90,
          recordType: 'ic_card'
        });
      }

      mockDb.addTimeRecords('EMP_OVERTIME_001', timeRecords);

      // 労働時間計算
      const monthlySummary = workingHoursCalculator.calculateMonthlyHours(timeRecords);
      
      expect(monthlySummary.totalOvertimeHours).toBeGreaterThan(60); // 月60時間超
      expect(monthlySummary.compliance.monthlyOvertimeCompliant).toBe(false); // コンプライアンス違反

      // 給与明細生成
      const payslip = await payrollEngine.generatePayslip('EMP_OVERTIME_001', '2024-07');

      // 月60時間超の割増率検証（1.50倍）
      const overtimeAllowance = payslip.allowances.find(a => a.type === 'overtime');
      expect(overtimeAllowance?.amount).toBeGreaterThan(payslip.baseSalary * 0.5); // 大量の残業代
      const totalAllowances = payslip.allowances.reduce((sum, a) => sum + a.amount, 0);
      const grossPay = payslip.baseSalary + totalAllowances;
      expect(grossPay).toBeGreaterThan(600000); // 高額な総支給額
    });
  });

  describe('データ整合性テスト', () => {
    it('複数従業員の同時処理', async () => {
      // 3名の従業員を登録
      const employees: Employee[] = [
        {
          id: 'EMP_MULTI_001',
          name: '従業員A',
          department: '開発部',
          position: 'エンジニア',
          hourlyRate: 2500,
          startDate: new Date('2022-04-01'),
          birthDate: new Date('1990-04-01'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly'
        },
        {
          id: 'EMP_MULTI_002',
          name: '従業員B',
          department: '営業部',
          position: 'マネージャー',
          hourlyRate: 3500,
          startDate: new Date('2020-04-01'),
          birthDate: new Date('1980-04-01'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly'
        },
        {
          id: 'EMP_MULTI_003',
          name: '従業員C',
          department: '総務部',
          position: 'アシスタント',
          hourlyRate: 2000,
          startDate: new Date('2023-04-01'),
          birthDate: new Date('1995-04-01'),
          isActive: true,
          contractType: 'part_time',
          salaryType: 'hourly'
        }
      ];

      employees.forEach(emp => mockDb.addEmployee(emp));

      // 各従業員の勤怠データ
      employees.forEach(emp => {
        const timeRecords: TimeRecord[] = [
          {
            id: `TR_${emp.id}_1`,
            employeeId: emp.id,
            date: new Date('2024-07-01'),
            clockIn: new Date('2024-07-01T09:00:00'),
            clockOut: new Date('2024-07-01T18:00:00'),
            breakMinutes: 60,
            recordType: 'ic_card'
          }
        ];
        mockDb.addTimeRecords(emp.id, timeRecords);
      });

      // 各従業員の給与明細生成
      const payslips = await Promise.all(
        employees.map(emp => payrollEngine.generatePayslip(emp.id, '2024-07'))
      );

      // データ整合性検証
      expect(payslips).toHaveLength(3);
      
      payslips.forEach((payslip, index) => {
        expect(payslip.employeeId).toBe(employees[index].id);
        expect(payslip.month).toBe('2024-07');
        expect(payslip.netPay).toBeGreaterThan(0);
        
        // 時給に応じた給与差の検証
        if (index > 0) {
          if (employees[index].hourlyRate > employees[index - 1].hourlyRate) {
            expect(payslip.baseSalary).toBeGreaterThan(payslips[index - 1].baseSalary);
          }
        }
      });

      // 介護保険料の年齢による違い
      expect(payslips[0].socialInsurance.longTermCareInsurance).toBe(0); // 34歳
      expect(payslips[1].socialInsurance.longTermCareInsurance).toBeGreaterThan(0); // 44歳
      expect(payslips[2].socialInsurance.longTermCareInsurance).toBe(0); // 29歳
    });
  });

  describe('エラーハンドリングテスト', () => {
    it('不正なデータでの処理エラー', async () => {
      // 存在しない従業員ID
      await expect(
        payrollEngine.generatePayslip('NONEXISTENT', '2024-07')
      ).rejects.toThrow();

      // 無効な月
      const employee: Employee = {
        id: 'EMP_ERROR_001',
        name: 'エラーテスト',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 2500,
        startDate: new Date('2024-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(employee);

      await expect(
        payrollEngine.generatePayslip('EMP_ERROR_001', 'invalid-month')
      ).rejects.toThrow();
    });

    it('勤怠データなしでの給与計算', async () => {
      const employee: Employee = {
        id: 'EMP_NO_ATTENDANCE',
        name: '欠勤従業員',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 2500,
        startDate: new Date('2024-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(employee);
      // 勤怠データを追加しない

      const payslip = await payrollEngine.generatePayslip('EMP_NO_ATTENDANCE', '2024-07');
      
      // 勤怠データなしでも基本情報は生成される
      expect(payslip.employeeId).toBe('EMP_NO_ATTENDANCE');
      expect(payslip.workingSummary.totalWorkingDays).toBe(0);
      expect(payslip.baseSalary).toBe(0);
      expect(payslip.netPay).toBeLessThanOrEqual(0);
    });
  });
});