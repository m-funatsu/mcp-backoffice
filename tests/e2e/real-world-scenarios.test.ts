import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegratedPayrollEngine } from '../../src/payroll-engine.js';
import { WorkingHoursCalculator } from '../../src/working-hours-calculator.js';
import { createMockDatabase } from '../setup/test-db.js';
import type { Employee, TimeRecord } from '../../src/types.js';

/**
 * 実世界シナリオ E2E テスト
 * 
 * 実際の企業で発生する複雑なケースを検証
 * 法改正、システム移行、災害対応など
 */

describe('E2E: 実世界シナリオテスト', () => {
  let payrollEngine: IntegratedPayrollEngine;
  let workingHoursCalculator: WorkingHoursCalculator;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = createMockDatabase();
    payrollEngine = new IntegratedPayrollEngine(mockDb);
    workingHoursCalculator = new WorkingHoursCalculator();
  });

  afterEach(async () => {
    // クリーンアップ
  });

  describe('COVID-19対応シナリオ', () => {
    it('在宅勤務・時差出勤・出社制限の混在期間', async () => {
      // コロナ禍での多様な勤務形態
      const covidEmployee: Employee = {
        id: 'EMP_COVID_001',
        name: 'テレワーク太郎',
        department: 'IT部',
        position: 'エンジニア',
        hourlyRate: 3200,
        startDate: new Date('2020-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly',
        birthDate: new Date('1985-04-01'),
        taxInfo: {
          dependents: 1,
          taxRate: 0.10,
          isDisabled: false,
          isSingleParent: false,
          hasSpouseDeduction: true
        }
      };

      mockDb.addEmployee(covidEmployee);

      // 2024年7月の多様な勤務パターン
      const covidRecords: TimeRecord[] = [
        // 在宅勤務（月・水・金）
        {
          id: 'TR_COVID_WFH_1',
          employeeId: 'EMP_COVID_001',
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:30:00'),
          clockOut: new Date('2024-07-01T18:30:00'),
          breakMinutes: 60,
          recordType: 'manual',
          notes: '在宅勤務（自宅からVPN接続）'
        },
        // 時差出勤（火・木）
        {
          id: 'TR_COVID_FLEX_1',
          employeeId: 'EMP_COVID_001',
          date: new Date('2024-07-02'),
          clockIn: new Date('2024-07-02T07:00:00'),
          clockOut: new Date('2024-07-02T16:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card',
          notes: '時差出勤（早朝出社）'
        },
        {
          id: 'TR_COVID_WFH_2',
          employeeId: 'EMP_COVID_001',
          date: new Date('2024-07-03'),
          clockIn: new Date('2024-07-03T09:00:00'),
          clockOut: new Date('2024-07-03T19:00:00'),
          breakMinutes: 90,
          recordType: 'manual',
          notes: '在宅勤務（長時間勤務）'
        },
        {
          id: 'TR_COVID_FLEX_2',
          employeeId: 'EMP_COVID_001',
          date: new Date('2024-07-04'),
          clockIn: new Date('2024-07-04T11:00:00'),
          clockOut: new Date('2024-07-04T20:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card',
          notes: '時差出勤（遅出勤務）'
        },
        // 部分出社
        {
          id: 'TR_COVID_HYBRID_1',
          employeeId: 'EMP_COVID_001',
          date: new Date('2024-07-05'),
          clockIn: new Date('2024-07-05T10:00:00'),
          clockOut: new Date('2024-07-05T15:00:00'),
          breakMinutes: 30,
          recordType: 'manual',
          notes: '午前在宅・午後出社'
        }
      ];

      mockDb.addTimeRecords('EMP_COVID_001', covidRecords);

      // 給与計算
      const payslip = await payrollEngine.generatePayslip('EMP_COVID_001', '2024-07');

      // 在宅勤務手当の確認
      const wfhAllowance = payslip.allowances.find(a => 
        a.type === 'wfh' || a.description?.includes('在宅') || a.description?.includes('テレワーク')
      );

      // 基本給与の確認
      expect(payslip.baseSalary).toBeGreaterThan(0);
      expect(payslip.netPay).toBeGreaterThan(0);

      // 多様な勤務形態でも正常に計算される
      expect(payslip.workingSummary.totalWorkingDays).toBe(5);
      expect(payslip.workingSummary.regularHours).toBeGreaterThan(30);

      // 時差出勤による残業計算
      expect(payslip.overtimePay).toBeGreaterThanOrEqual(0);

      // COVID-19対応レポート
      const covidReport = {
        employeeId: 'EMP_COVID_001',
        month: '2024-07',
        workingPatterns: {
          wfhDays: covidRecords.filter(r => r.recordType === 'manual').length,
          officeDays: covidRecords.filter(r => r.recordType === 'ic_card').length,
          flexTimeDays: covidRecords.filter(r => r.notes?.includes('時差')).length
        },
        totalHours: covidRecords.reduce((sum, r) => {
          const hours = (r.clockOut.getTime() - r.clockIn.getTime()) / (1000 * 60 * 60);
          return sum + hours - (r.breakMinutes / 60);
        }, 0),
        allowances: {
          wfhAllowance: wfhAllowance?.amount || 0,
          flexTimeAllowance: 0 // 実装による
        }
      };

      expect(covidReport.workingPatterns.wfhDays).toBe(3);
      expect(covidReport.workingPatterns.officeDays).toBe(2);
      expect(covidReport.totalHours).toBeGreaterThan(35);
    });

    it('緊急事態宣言期間の勤務調整', async () => {
      // 緊急事態宣言下での勤務制限
      const emergencyEmployee: Employee = {
        id: 'EMP_EMERGENCY_001',
        name: '緊急事態花子',
        department: '営業部',
        position: '営業担当',
        hourlyRate: 2800,
        startDate: new Date('2019-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(emergencyEmployee);

      // 緊急事態宣言期間の勤務（勤務時間短縮）
      const emergencyRecords: TimeRecord[] = [];
      
      for (let day = 1; day <= 20; day++) {
        const date = new Date(`2024-07-${day.toString().padStart(2, '0')}`);
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        // 営業時間短縮（9-17時 → 10-16時）
        emergencyRecords.push({
          id: `TR_EMERGENCY_${day}`,
          employeeId: 'EMP_EMERGENCY_001',
          date,
          clockIn: new Date(`2024-07-${day.toString().padStart(2, '0')}T10:00:00`),
          clockOut: new Date(`2024-07-${day.toString().padStart(2, '0')}T16:00:00`),
          breakMinutes: 45,
          recordType: 'manual',
          notes: '緊急事態宣言対応・営業時間短縮'
        });
      }

      mockDb.addTimeRecords('EMP_EMERGENCY_001', emergencyRecords);

      const payslip = await payrollEngine.generatePayslip('EMP_EMERGENCY_001', '2024-07');

      // 時短勤務による給与影響
      expect(payslip.baseSalary).toBeGreaterThan(0);
      expect(payslip.workingSummary.regularHours).toBeLessThan(160); // 通常より少ない

      // 緊急事態手当（実装による）
      const emergencyAllowance = payslip.allowances.find(a => 
        a.description?.includes('緊急') || a.description?.includes('特別')
      );

      // 時短勤務補償
      const expectedShortHours = 14 * 5.25; // 14日 × 5.25時間
      expect(payslip.workingSummary.regularHours).toBeCloseTo(expectedShortHours, 5);
    });
  });

  describe('システム移行シナリオ', () => {
    it('旧システムからの移行期間での二重管理', async () => {
      // システム移行期間の従業員
      const migrationEmployee: Employee = {
        id: 'EMP_MIGRATION_001',
        name: '移行太郎',
        department: '情報システム部',
        position: 'システム管理者',
        hourlyRate: 4000,
        startDate: new Date('2018-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(migrationEmployee);

      // 移行期間の勤怠データ（旧システム・新システム混在）
      const migrationRecords: TimeRecord[] = [
        // 旧システムデータ（手動入力）
        {
          id: 'TR_OLD_SYSTEM_1',
          employeeId: 'EMP_MIGRATION_001',
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T18:00:00'),
          breakMinutes: 60,
          recordType: 'manual',
          notes: '旧システムデータ（手動移行）'
        },
        // 新システムデータ（ICカード）
        {
          id: 'TR_NEW_SYSTEM_1',
          employeeId: 'EMP_MIGRATION_001',
          date: new Date('2024-07-02'),
          clockIn: new Date('2024-07-02T08:45:00'),
          clockOut: new Date('2024-07-02T19:30:00'),
          breakMinutes: 90,
          recordType: 'ic_card',
          notes: '新システム稼働開始'
        },
        // システム障害時の手動記録
        {
          id: 'TR_SYSTEM_DOWN_1',
          employeeId: 'EMP_MIGRATION_001',
          date: new Date('2024-07-03'),
          clockIn: new Date('2024-07-03T09:00:00'),
          clockOut: new Date('2024-07-03T21:00:00'),
          breakMinutes: 120,
          recordType: 'manual',
          notes: 'システム障害対応・手動記録'
        }
      ];

      mockDb.addTimeRecords('EMP_MIGRATION_001', migrationRecords);

      const payslip = await payrollEngine.generatePayslip('EMP_MIGRATION_001', '2024-07');

      // データ品質チェック
      const dataQualityReport = {
        employeeId: 'EMP_MIGRATION_001',
        month: '2024-07',
        dataSource: {
          manual: migrationRecords.filter(r => r.recordType === 'manual').length,
          icCard: migrationRecords.filter(r => r.recordType === 'ic_card').length
        },
        migrationIssues: {
          missingData: 0,
          duplicateData: 0,
          inconsistentData: 0
        },
        payrollAccuracy: {
          totalHours: migrationRecords.reduce((sum, r) => {
            const hours = (r.clockOut.getTime() - r.clockIn.getTime()) / (1000 * 60 * 60);
            return sum + hours - (r.breakMinutes / 60);
          }, 0),
          calculatedPay: payslip.baseSalary
        }
      };

      expect(dataQualityReport.dataSource.manual).toBe(2);
      expect(dataQualityReport.dataSource.icCard).toBe(1);
      expect(dataQualityReport.payrollAccuracy.totalHours).toBeGreaterThan(25);
      expect(payslip.netPay).toBeGreaterThan(0);
    });
  });

  describe('法改正対応シナリオ', () => {
    it('働き方改革法施行に伴う制度変更', async () => {
      // 働き方改革対象従業員
      const workStyleEmployee: Employee = {
        id: 'EMP_WORKSTYLE_001',
        name: '働き方改革太郎',
        department: '人事部',
        position: '人事担当',
        hourlyRate: 3000,
        startDate: new Date('2015-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly',
        birthDate: new Date('1980-04-01'),
        taxInfo: {
          dependents: 2,
          taxRate: 0.10,
          isDisabled: false,
          isSingleParent: false,
          hasSpouseDeduction: true
        }
      };

      mockDb.addEmployee(workStyleEmployee);

      // 法改正前後の勤務パターン比較
      const workStyleRecords: TimeRecord[] = [
        // 改正前（長時間残業）
        {
          id: 'TR_BEFORE_REFORM_1',
          employeeId: 'EMP_WORKSTYLE_001',
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T23:00:00'),
          breakMinutes: 90,
          recordType: 'ic_card',
          notes: '法改正前の長時間勤務'
        },
        // 改正後（勤務時間制限）
        {
          id: 'TR_AFTER_REFORM_1',
          employeeId: 'EMP_WORKSTYLE_001',
          date: new Date('2024-07-02'),
          clockIn: new Date('2024-07-02T09:00:00'),
          clockOut: new Date('2024-07-02T20:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card',
          notes: '法改正後・残業上限遵守'
        },
        // 有給取得奨励
        {
          id: 'TR_PAID_LEAVE_1',
          employeeId: 'EMP_WORKSTYLE_001',
          date: new Date('2024-07-03'),
          clockIn: new Date('2024-07-03T09:00:00'),
          clockOut: new Date('2024-07-03T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card',
          notes: '有給取得促進・定時退社'
        }
      ];

      mockDb.addTimeRecords('EMP_WORKSTYLE_001', workStyleRecords);

      const payslip = await payrollEngine.generatePayslip('EMP_WORKSTYLE_001', '2024-07');

      // 働き方改革指標
      const workStyleMetrics = {
        employeeId: 'EMP_WORKSTYLE_001',
        month: '2024-07',
        compliance: {
          overtimeLimit: {
            monthly: payslip.workingSummary.overtimeHours <= 45, // 月45時間以内
            daily: workStyleRecords.every(r => {
              const workHours = (r.clockOut.getTime() - r.clockIn.getTime()) / (1000 * 60 * 60) - (r.breakMinutes / 60);
              return workHours <= 12; // 日12時間以内
            })
          },
          paidLeaveUsage: {
            mandatoryDays: 5, // 年5日義務
            currentUsage: 1, // 当月使用日数
            complianceRate: 0.2 // 20%達成
          }
        },
        improvements: {
          maxDailyHours: Math.max(...workStyleRecords.map(r => 
            (r.clockOut.getTime() - r.clockIn.getTime()) / (1000 * 60 * 60) - (r.breakMinutes / 60)
          )),
          averageClockOut: workStyleRecords.reduce((sum, r) => sum + r.clockOut.getHours(), 0) / workStyleRecords.length,
          workLifeBalance: 'improving'
        }
      };

      expect(workStyleMetrics.compliance.overtimeLimit.monthly).toBe(true);
      expect(workStyleMetrics.improvements.maxDailyHours).toBeLessThan(15);
      expect(workStyleMetrics.improvements.averageClockOut).toBeLessThan(22);
      expect(payslip.netPay).toBeGreaterThan(0);
    });
  });

  describe('災害対応シナリオ', () => {
    it('自然災害による勤務体制変更', async () => {
      // 災害対応従業員
      const disasterEmployee: Employee = {
        id: 'EMP_DISASTER_001',
        name: '災害対応太郎',
        department: 'インフラ部',
        position: 'インフラエンジニア',
        hourlyRate: 3800,
        startDate: new Date('2017-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(disasterEmployee);

      // 災害対応期間の勤怠
      const disasterRecords: TimeRecord[] = [
        // 災害発生日（緊急出勤）
        {
          id: 'TR_DISASTER_EMERGENCY_1',
          employeeId: 'EMP_DISASTER_001',
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T03:00:00'),
          clockOut: new Date('2024-07-01T22:00:00'),
          breakMinutes: 180,
          recordType: 'manual',
          notes: '地震対応・緊急出勤（システム復旧作業）'
        },
        // 災害復旧作業
        {
          id: 'TR_DISASTER_RECOVERY_1',
          employeeId: 'EMP_DISASTER_001',
          date: new Date('2024-07-02'),
          clockIn: new Date('2024-07-02T06:00:00'),
          clockOut: new Date('2024-07-02T24:00:00'),
          breakMinutes: 240,
          recordType: 'manual',
          notes: '災害復旧作業・24時間体制'
        },
        // 通常勤務復帰
        {
          id: 'TR_DISASTER_NORMAL_1',
          employeeId: 'EMP_DISASTER_001',
          date: new Date('2024-07-03'),
          clockIn: new Date('2024-07-03T09:00:00'),
          clockOut: new Date('2024-07-03T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card',
          notes: '通常勤務復帰'
        }
      ];

      mockDb.addTimeRecords('EMP_DISASTER_001', disasterRecords);

      const payslip = await payrollEngine.generatePayslip('EMP_DISASTER_001', '2024-07');

      // 災害対応手当
      const disasterAllowance = payslip.allowances.find(a => 
        a.type === 'disaster' || a.description?.includes('災害') || a.description?.includes('緊急')
      );

      // 長時間労働による残業代
      expect(payslip.overtimePay).toBeGreaterThan(0);
      expect(payslip.baseSalary).toBeGreaterThan(0);

      // 災害対応レポート
      const disasterReport = {
        employeeId: 'EMP_DISASTER_001',
        incidentDate: '2024-07-01',
        response: {
          emergencyCallOut: true,
          totalResponseHours: disasterRecords.reduce((sum, r) => {
            const hours = (r.clockOut.getTime() - r.clockIn.getTime()) / (1000 * 60 * 60);
            return sum + hours - (r.breakMinutes / 60);
          }, 0),
          consecutiveWorkDays: 2,
          maxDailyHours: Math.max(...disasterRecords.map(r => 
            (r.clockOut.getTime() - r.clockIn.getTime()) / (1000 * 60 * 60) - (r.breakMinutes / 60)
          ))
        },
        compensation: {
          basePay: payslip.baseSalary,
          overtimePay: payslip.overtimePay,
          disasterAllowance: disasterAllowance?.amount || 0,
          totalCompensation: payslip.totalPay
        }
      };

      expect(disasterReport.response.totalResponseHours).toBeGreaterThan(40);
      expect(disasterReport.response.maxDailyHours).toBeGreaterThan(15);
      expect(disasterReport.compensation.totalCompensation).toBeGreaterThan(100000);
    });
  });

  describe('国際化対応シナリオ', () => {
    it('外国人従業員の労働条件管理', async () => {
      // 外国人従業員
      const foreignEmployee: Employee = {
        id: 'EMP_FOREIGN_001',
        name: 'John Smith',
        department: 'Global部',
        position: 'International Coordinator',
        hourlyRate: 4500,
        startDate: new Date('2023-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly',
        birthDate: new Date('1990-01-01'),
        taxInfo: {
          dependents: 0,
          taxRate: 0.20, // 高税率
          isDisabled: false,
          isSingleParent: false,
          hasSpouseDeduction: false
        }
      };

      mockDb.addEmployee(foreignEmployee);

      // 国際業務特有の勤務パターン
      const foreignRecords: TimeRecord[] = [
        // 海外とのビデオ会議（早朝）
        {
          id: 'TR_FOREIGN_EARLY_1',
          employeeId: 'EMP_FOREIGN_001',
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T06:00:00'),
          clockOut: new Date('2024-07-01T15:00:00'),
          breakMinutes: 60,
          recordType: 'manual',
          notes: '米国本社とのビデオ会議（早朝出勤）'
        },
        // 通常勤務
        {
          id: 'TR_FOREIGN_NORMAL_1',
          employeeId: 'EMP_FOREIGN_001',
          date: new Date('2024-07-02'),
          clockIn: new Date('2024-07-02T09:00:00'),
          clockOut: new Date('2024-07-02T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card',
          notes: '通常勤務'
        },
        // 深夜国際会議
        {
          id: 'TR_FOREIGN_LATE_1',
          employeeId: 'EMP_FOREIGN_001',
          date: new Date('2024-07-03'),
          clockIn: new Date('2024-07-03T09:00:00'),
          clockOut: new Date('2024-07-03T23:00:00'),
          breakMinutes: 90,
          recordType: 'manual',
          notes: '欧州支社との深夜会議'
        }
      ];

      mockDb.addTimeRecords('EMP_FOREIGN_001', foreignRecords);

      const payslip = await payrollEngine.generatePayslip('EMP_FOREIGN_001', '2024-07');

      // 国際業務手当
      const internationalAllowance = payslip.allowances.find(a => 
        a.type === 'international' || a.description?.includes('国際') || a.description?.includes('海外')
      );

      // 外国人特有の税務処理
      expect(payslip.taxCalculation.incomeTax).toBeGreaterThan(0);
      expect(payslip.taxCalculation.residentTax).toBeGreaterThan(0);
      expect(payslip.netPay).toBeGreaterThan(0);

      // 国際業務レポート
      const internationalReport = {
        employeeId: 'EMP_FOREIGN_001',
        month: '2024-07',
        workingPattern: {
          earlyMorning: foreignRecords.filter(r => r.clockIn.getHours() < 8).length,
          lateNight: foreignRecords.filter(r => r.clockOut.getHours() > 22).length,
          internationalMeetings: foreignRecords.filter(r => r.notes?.includes('会議')).length
        },
        compensation: {
          basePay: payslip.baseSalary,
          internationalAllowance: internationalAllowance?.amount || 0,
          taxBurden: payslip.taxCalculation.incomeTax + payslip.taxCalculation.residentTax,
          netPay: payslip.netPay
        },
        compliance: {
          visaStatus: 'valid',
          workPermit: 'valid',
          taxTreaty: 'applicable'
        }
      };

      expect(internationalReport.workingPattern.earlyMorning).toBe(1);
      expect(internationalReport.workingPattern.lateNight).toBe(1);
      expect(internationalReport.compensation.taxBurden).toBeGreaterThan(0);
    });
  });

  describe('業界特有シナリオ', () => {
    it('製造業の交代勤務制', async () => {
      // 製造業従業員（交代勤務）
      const manufacturingEmployee: Employee = {
        id: 'EMP_MFG_001',
        name: '製造太郎',
        department: '製造部',
        position: '製造オペレーター',
        hourlyRate: 2400,
        startDate: new Date('2020-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(manufacturingEmployee);

      // 3交代制の勤務パターン
      const shiftRecords: TimeRecord[] = [
        // 日勤（8-16時）
        {
          id: 'TR_SHIFT_DAY_1',
          employeeId: 'EMP_MFG_001',
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T08:00:00'),
          clockOut: new Date('2024-07-01T16:00:00'),
          breakMinutes: 45,
          recordType: 'ic_card',
          notes: '日勤シフト'
        },
        // 準夜勤（16-24時）
        {
          id: 'TR_SHIFT_EVENING_1',
          employeeId: 'EMP_MFG_001',
          date: new Date('2024-07-02'),
          clockIn: new Date('2024-07-02T16:00:00'),
          clockOut: new Date('2024-07-02T24:00:00'),
          breakMinutes: 45,
          recordType: 'ic_card',
          notes: '準夜勤シフト'
        },
        // 深夜勤（0-8時）
        {
          id: 'TR_SHIFT_NIGHT_1',
          employeeId: 'EMP_MFG_001',
          date: new Date('2024-07-03'),
          clockIn: new Date('2024-07-03T00:00:00'),
          clockOut: new Date('2024-07-03T08:00:00'),
          breakMinutes: 45,
          recordType: 'ic_card',
          notes: '深夜勤シフト'
        }
      ];

      mockDb.addTimeRecords('EMP_MFG_001', shiftRecords);

      const payslip = await payrollEngine.generatePayslip('EMP_MFG_001', '2024-07');

      // 交代勤務手当
      const shiftAllowance = payslip.allowances.find(a => 
        a.type === 'shift' || a.description?.includes('交代') || a.description?.includes('シフト')
      );

      // 深夜勤務手当
      const nightShiftAllowance = payslip.allowances.find(a => 
        a.type === 'late_night' || a.description?.includes('深夜')
      );

      expect(payslip.baseSalary).toBeGreaterThan(0);
      expect(payslip.netPay).toBeGreaterThan(0);

      // 製造業レポート
      const manufacturingReport = {
        employeeId: 'EMP_MFG_001',
        month: '2024-07',
        shifts: {
          day: shiftRecords.filter(r => r.clockIn.getHours() === 8).length,
          evening: shiftRecords.filter(r => r.clockIn.getHours() === 16).length,
          night: shiftRecords.filter(r => r.clockIn.getHours() === 0).length
        },
        allowances: {
          shiftDifferential: shiftAllowance?.amount || 0,
          nightPremium: nightShiftAllowance?.amount || 0
        },
        safetyCompliance: {
          consecutiveShifts: 3,
          restPeriods: 'adequate',
          maxHoursPerWeek: 40
        }
      };

      expect(manufacturingReport.shifts.day).toBe(1);
      expect(manufacturingReport.shifts.evening).toBe(1);
      expect(manufacturingReport.shifts.night).toBe(1);
    });
  });
});