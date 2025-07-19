import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceEngine } from '../../src/compliance-engine-v1.3.0.js';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import type { Employee, TimeRecord, ObjectiveTimeRecord, ComplianceStatus } from '../../src/types.js';

describe('v1.3.0 コンプライアンスエンジン - 網羅的テスト', () => {
  let engine: ComplianceEngine;
  let mockDb: DatabasePostgreSQL;
  let testEmployee: Employee;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getEmployee: vi.fn(),
      getAllEmployees: vi.fn(),
      getTimeRecords: vi.fn(),
      getObjectiveTimeRecords: vi.fn(),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn()
    } as any;

    engine = new ComplianceEngine(mockDb);

    testEmployee = {
      id: 'emp001',
      name: '山田太郎',
      email: 'yamada@example.com',
      department: '開発部',
      position: 'エンジニア',
      hourlyWage: 3000,
      startDate: '2020-04-01',
      isActive: true,
      agreementType: 'special_clause' // 特別条項付き36協定
    };
  });

  describe('36協定監視', () => {
    describe('月間残業時間チェック', () => {
      it('通常の36協定（月45時間）内の残業を正常と判定する', async () => {
        const records = generateTimeRecordsWithOvertime('emp001', '2024-01', 40);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(records);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.query = vi.fn().mockResolvedValue({ 
          rows: [{ 
            regular_limit: 45, 
            special_limit: 100, 
            yearly_limit: 360,
            special_yearly_limit: 720 
          }] 
        });

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.monthlyOvertime).toBe(40);
        expect(status.isCompliant).toBe(true);
        expect(status.riskLevel).toBe('low');
        expect(status.alerts).toHaveLength(0);
      });

      it('月45時間超過で警告を生成する', async () => {
        const records = generateTimeRecordsWithOvertime('emp001', '2024-01', 50);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(records);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.query = vi.fn().mockResolvedValue({ 
          rows: [{ regular_limit: 45, special_limit: 100, yearly_limit: 360 }] 
        });

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.monthlyOvertime).toBe(50);
        expect(status.isCompliant).toBe(false);
        expect(status.riskLevel).toBe('medium');
        expect(status.alerts).toContainEqual(
          expect.objectContaining({
            type: '36_AGREEMENT_WARNING',
            message: expect.stringContaining('45時間')
          })
        );
      });

      it('特別条項適用時の月100時間超過で重大違反を検出する', async () => {
        const records = generateTimeRecordsWithOvertime('emp001', '2024-01', 105);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(records);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.query = vi.fn().mockResolvedValue({ 
          rows: [{ regular_limit: 45, special_limit: 100, yearly_limit: 360 }] 
        });

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.monthlyOvertime).toBe(105);
        expect(status.isCompliant).toBe(false);
        expect(status.riskLevel).toBe('critical');
        expect(status.alerts).toContainEqual(
          expect.objectContaining({
            type: '36_AGREEMENT_VIOLATION',
            severity: 'critical',
            message: expect.stringContaining('100時間')
          })
        );
      });
    });

    describe('年間残業時間チェック', () => {
      it('年間360時間以内を正常と判定する', async () => {
        // 過去11ヶ月の残業データ
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ 
            rows: [{ regular_limit: 45, yearly_limit: 360, special_yearly_limit: 720 }] 
          })
          .mockResolvedValueOnce({
            rows: Array(11).fill(null).map((_, i) => ({
              month: `2023-${String(i + 2).padStart(2, '0')}`,
              overtime_hours: 25
            }))
          });

        const currentMonthRecords = generateTimeRecordsWithOvertime('emp001', '2024-01', 30);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(currentMonthRecords);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.yearlyOvertime).toBe(305); // 25×11 + 30
        expect(status.remainingYearlyAllowance).toBe(55);
        expect(status.isCompliant).toBe(true);
      });

      it('年間360時間超過で警告を生成する', async () => {
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ 
            rows: [{ regular_limit: 45, yearly_limit: 360, special_yearly_limit: 720 }] 
          })
          .mockResolvedValueOnce({
            rows: Array(11).fill(null).map(() => ({
              overtime_hours: 35
            }))
          });

        const currentMonthRecords = generateTimeRecordsWithOvertime('emp001', '2024-01', 40);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(currentMonthRecords);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.yearlyOvertime).toBe(425); // 35×11 + 40
        expect(status.isCompliant).toBe(false);
        expect(status.alerts).toContainEqual(
          expect.objectContaining({
            type: '36_AGREEMENT_YEARLY_WARNING',
            message: expect.stringContaining('360時間')
          })
        );
      });

      it('特別条項年間720時間超過で重大違反を検出する', async () => {
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ 
            rows: [{ regular_limit: 45, yearly_limit: 360, special_yearly_limit: 720 }] 
          })
          .mockResolvedValueOnce({
            rows: Array(11).fill(null).map(() => ({
              overtime_hours: 70
            }))
          });

        const currentMonthRecords = generateTimeRecordsWithOvertime('emp001', '2024-01', 80);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(currentMonthRecords);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.yearlyOvertime).toBe(850); // 70×11 + 80
        expect(status.isCompliant).toBe(false);
        expect(status.riskLevel).toBe('critical');
        expect(status.alerts).toContainEqual(
          expect.objectContaining({
            type: '36_AGREEMENT_YEARLY_VIOLATION',
            severity: 'critical'
          })
        );
      });
    });

    describe('複数月平均チェック', () => {
      it('2-6ヶ月平均80時間以内を正常と判定する', async () => {
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ rows: [{ regular_limit: 45 }] })
          .mockResolvedValueOnce({
            rows: [
              { month: '2023-12', overtime_hours: 75 },
              { month: '2023-11', overtime_hours: 70 },
              { month: '2023-10', overtime_hours: 65 },
              { month: '2023-09', overtime_hours: 60 },
              { month: '2023-08', overtime_hours: 55 }
            ]
          });

        const currentMonthRecords = generateTimeRecordsWithOvertime('emp001', '2024-01', 75);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(currentMonthRecords);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.multiMonthAverages).toBeDefined();
        expect(status.multiMonthAverages?.twoMonth).toBe(75); // (75+75)/2
        expect(status.multiMonthAverages?.sixMonth).toBeLessThan(80);
        expect(status.healthRiskAssessment).toBe('medium');
      });

      it('複数月平均80時間超過で健康リスク警告を生成する', async () => {
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ rows: [{ regular_limit: 45 }] })
          .mockResolvedValueOnce({
            rows: Array(5).fill(null).map(() => ({
              overtime_hours: 85
            }))
          });

        const currentMonthRecords = generateTimeRecordsWithOvertime('emp001', '2024-01', 90);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(currentMonthRecords);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.multiMonthAverages?.twoMonth).toBeGreaterThan(80);
        expect(status.healthRiskAssessment).toBe('high');
        expect(status.alerts).toContainEqual(
          expect.objectContaining({
            type: 'HEALTH_RISK_WARNING',
            message: expect.stringContaining('健康確保措置')
          })
        );
      });
    });

    describe('特別条項使用回数チェック', () => {
      it('年6回以内の特別条項使用を正常と判定する', async () => {
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ rows: [{ regular_limit: 45, special_limit: 100 }] })
          .mockResolvedValueOnce({
            rows: Array(5).fill(null).map((_, i) => ({
              month: `2023-${String(i + 7).padStart(2, '0')}`,
              overtime_hours: 50 // 45時間超過
            }))
          })
          .mockResolvedValueOnce({ rows: [] });

        const currentMonthRecords = generateTimeRecordsWithOvertime('emp001', '2024-01', 50);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(currentMonthRecords);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.specialClauseUsage).toBe(6);
        expect(status.specialClauseRemaining).toBe(0);
        expect(status.alerts).not.toContainEqual(
          expect.objectContaining({
            type: 'SPECIAL_CLAUSE_LIMIT_EXCEEDED'
          })
        );
      });

      it('年6回超過で特別条項使用制限違反を検出する', async () => {
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ rows: [{ regular_limit: 45, special_limit: 100 }] })
          .mockResolvedValueOnce({
            rows: Array(6).fill(null).map((_, i) => ({
              month: `2023-${String(i + 6).padStart(2, '0')}`,
              overtime_hours: 50
            }))
          })
          .mockResolvedValueOnce({ rows: [] });

        const currentMonthRecords = generateTimeRecordsWithOvertime('emp001', '2024-01', 50);
        mockDb.getTimeRecords = vi.fn().mockResolvedValue(currentMonthRecords);
        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

        const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

        expect(status.specialClauseUsage).toBe(7);
        expect(status.isCompliant).toBe(false);
        expect(status.alerts).toContainEqual(
          expect.objectContaining({
            type: 'SPECIAL_CLAUSE_LIMIT_EXCEEDED',
            message: expect.stringContaining('6回')
          })
        );
      });
    });
  });

  describe('客観的記録保持', () => {
    it('ICカード記録を正確に保存する', async () => {
      const icCardData = {
        employeeId: 'emp001',
        timestamp: new Date('2024-01-15T09:00:00'),
        type: 'clock_in' as const,
        deviceId: 'IC001',
        location: 'main_office'
      };

      mockDb.query = vi.fn().mockResolvedValue({ rows: [{ id: 'obj001' }] });

      const result = await engine.recordObjectiveTime(icCardData);

      expect(result.id).toBe('obj001');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO objective_time_records'),
        expect.arrayContaining([
          'emp001',
          'ic_card',
          expect.any(Date),
          'clock_in'
        ])
      );
    });

    it('PCログ記録を保存する', async () => {
      const pcLogData = {
        employeeId: 'emp001',
        timestamp: new Date('2024-01-15T09:05:00'),
        type: 'login' as const,
        deviceId: 'PC001',
        ipAddress: '192.168.1.100'
      };

      mockDb.query = vi.fn().mockResolvedValue({ rows: [{ id: 'obj002' }] });

      const result = await engine.recordObjectiveTime(pcLogData);

      expect(result.recordType).toBe('pc_log');
      expect(result.metadata).toContain('192.168.1.100');
    });

    it('入退室記録を保存する', async () => {
      const accessLogData = {
        employeeId: 'emp001',
        timestamp: new Date('2024-01-15T08:55:00'),
        type: 'entry' as const,
        deviceId: 'GATE001',
        location: 'main_entrance'
      };

      mockDb.query = vi.fn().mockResolvedValue({ rows: [{ id: 'obj003' }] });

      const result = await engine.recordObjectiveTime(accessLogData);

      expect(result.recordType).toBe('access_log');
      expect(result.metadata).toContain('main_entrance');
    });
  });

  describe('記録間乖離チェック', () => {
    it('15分以内の差異を正常と判定する', async () => {
      const selfReported = {
        clockIn: new Date('2024-01-15T09:00:00'),
        clockOut: new Date('2024-01-15T18:00:00')
      };

      const objectiveRecords = [
        {
          recordType: 'ic_card',
          recordedAt: new Date('2024-01-15T08:55:00'),
          action: 'clock_in'
        },
        {
          recordType: 'ic_card',
          recordedAt: new Date('2024-01-15T18:05:00'),
          action: 'clock_out'
        }
      ];

      mockDb.getObjectiveTimeRecords = vi.fn().mockResolvedValue(objectiveRecords);

      const discrepancy = await engine.checkDiscrepancy(
        'emp001',
        new Date('2024-01-15'),
        selfReported
      );

      expect(discrepancy.hasDiscrepancy).toBe(false);
      expect(discrepancy.clockInDiff).toBe(5); // 5分の差
      expect(discrepancy.clockOutDiff).toBe(5);
    });

    it('15分超の差異で乖離を検出する', async () => {
      const selfReported = {
        clockIn: new Date('2024-01-15T09:00:00'),
        clockOut: new Date('2024-01-15T18:00:00')
      };

      const objectiveRecords = [
        {
          recordType: 'ic_card',
          recordedAt: new Date('2024-01-15T08:30:00'),
          action: 'clock_in'
        },
        {
          recordType: 'ic_card',
          recordedAt: new Date('2024-01-15T18:30:00'),
          action: 'clock_out'
        }
      ];

      mockDb.getObjectiveTimeRecords = vi.fn().mockResolvedValue(objectiveRecords);

      const discrepancy = await engine.checkDiscrepancy(
        'emp001',
        new Date('2024-01-15'),
        selfReported
      );

      expect(discrepancy.hasDiscrepancy).toBe(true);
      expect(discrepancy.clockInDiff).toBe(30);
      expect(discrepancy.clockOutDiff).toBe(30);
      expect(discrepancy.requiresExplanation).toBe(true);
    });

    it('複数の客観的記録から最も信頼性の高いものを選択する', async () => {
      const selfReported = {
        clockIn: new Date('2024-01-15T09:00:00'),
        clockOut: new Date('2024-01-15T18:00:00')
      };

      const objectiveRecords = [
        {
          recordType: 'pc_log',
          recordedAt: new Date('2024-01-15T08:45:00'),
          action: 'login'
        },
        {
          recordType: 'ic_card',
          recordedAt: new Date('2024-01-15T08:55:00'),
          action: 'clock_in'
        },
        {
          recordType: 'access_log',
          recordedAt: new Date('2024-01-15T08:50:00'),
          action: 'entry'
        }
      ];

      mockDb.getObjectiveTimeRecords = vi.fn().mockResolvedValue(objectiveRecords);

      const discrepancy = await engine.checkDiscrepancy(
        'emp001',
        new Date('2024-01-15'),
        selfReported
      );

      // ICカードが最も信頼性が高い
      expect(discrepancy.objectiveClockIn).toEqual(new Date('2024-01-15T08:55:00'));
      expect(discrepancy.reliabilityScore).toBeGreaterThan(0.8);
    });
  });

  describe('リアルタイムアラート生成', () => {
    it('月末5日前に残業時間予測アラートを生成する', async () => {
      const currentDate = new Date('2024-01-26'); // 月末5日前
      const records = generateTimeRecordsWithOvertime('emp001', '2024-01', 38, 25); // 25日時点で38時間

      mockDb.getTimeRecords = vi.fn().mockResolvedValue(records);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.query = vi.fn().mockResolvedValue({ 
        rows: [{ regular_limit: 45 }] 
      });

      const alert = await engine.generateRealTimeAlert('emp001', currentDate);

      expect(alert).toBeDefined();
      expect(alert?.type).toBe('OVERTIME_PREDICTION_WARNING');
      expect(alert?.predictedMonthlyOvertime).toBeGreaterThan(45);
      expect(alert?.message).toContain('予測');
    });

    it('月間残業40時間到達で注意アラートを生成する', async () => {
      const records = generateTimeRecordsWithOvertime('emp001', '2024-01', 40);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(records);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.query = vi.fn().mockResolvedValue({ 
        rows: [{ regular_limit: 45 }] 
      });

      const alert = await engine.generateRealTimeAlert('emp001', new Date('2024-01-20'));

      expect(alert?.type).toBe('OVERTIME_THRESHOLD_ALERT');
      expect(alert?.currentOvertime).toBe(40);
      expect(alert?.urgency).toBe('high');
    });

    it('健康リスク基準到達で即座にアラートを生成する', async () => {
      // 当月80時間の残業
      const records = generateTimeRecordsWithOvertime('emp001', '2024-01', 80);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(records);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.query = vi.fn()
        .mockResolvedValueOnce({ rows: [{ regular_limit: 45 }] })
        .mockResolvedValueOnce({
          rows: [{ overtime_hours: 85 }] // 前月も85時間
        });

      const alert = await engine.generateRealTimeAlert('emp001', new Date('2024-01-25'));

      expect(alert?.type).toBe('HEALTH_RISK_ALERT');
      expect(alert?.urgency).toBe('critical');
      expect(alert?.requiredActions).toContain('産業医面談');
    });
  });

  describe('詳細労働時間計算', () => {
    it('休憩時間を正確に除外して計算する', async () => {
      const records: TimeRecord[] = [
        {
          id: 'tr001',
          employeeId: 'emp001',
          date: new Date('2024-01-15'),
          clockIn: new Date('2024-01-15T09:00:00'),
          clockOut: new Date('2024-01-15T19:00:00'), // 10時間
          breakMinutes: 75, // 法定60分 + 追加15分
          recordType: 'ic_card'
        }
      ];

      const result = await engine.calculateDetailedWorkHours(records);

      expect(result.totalWorkHours).toBe(8.75); // 10 - 1.25
      expect(result.regularHours).toBe(8);
      expect(result.overtimeHours).toBe(0.75);
    });

    it('深夜・早朝時間帯を区別して計算する', async () => {
      const records: TimeRecord[] = [
        {
          id: 'tr001',
          employeeId: 'emp001',
          date: new Date('2024-01-15'),
          clockIn: new Date('2024-01-15T05:00:00'), // 早朝
          clockOut: new Date('2024-01-15T14:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        },
        {
          id: 'tr002',
          employeeId: 'emp001',
          date: new Date('2024-01-16'),
          clockIn: new Date('2024-01-16T21:00:00'),
          clockOut: new Date('2024-01-17T06:00:00'), // 深夜
          breakMinutes: 60,
          recordType: 'ic_card'
        }
      ];

      const result = await engine.calculateDetailedWorkHours(records);

      expect(result.earlyMorningHours).toBe(0); // 5:00-9:00は早朝扱いしない
      expect(result.lateNightHours).toBe(7); // 22:00-5:00
    });

    it('休日労働時間を区別して計算する', async () => {
      const records: TimeRecord[] = [
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

      const result = await engine.calculateDetailedWorkHours(records);

      expect(result.holidayWorkHours).toBe(8);
      expect(result.regularHours).toBe(0);
      expect(result.workPatternAnalysis.weekendWorkDays).toBe(1);
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しない従業員でエラーを投げる', async () => {
      mockDb.getEmployee = vi.fn().mockResolvedValue(null);

      await expect(engine.monitor36Agreement('invalid', new Date()))
        .rejects.toThrow('Employee not found');
    });

    it('36協定データがない場合デフォルト値を使用する', async () => {
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue([]);
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] }); // 協定データなし

      const status = await engine.monitor36Agreement('emp001', new Date());

      expect(status.monthlyLimit).toBe(45); // デフォルト値
      expect(status.yearlyLimit).toBe(360);
    });

    it('データベースエラーを適切に処理する', async () => {
      mockDb.getEmployee = vi.fn().mockRejectedValue(new Error('DB connection failed'));

      await expect(engine.monitor36Agreement('emp001', new Date()))
        .rejects.toThrow('DB connection failed');
    });
  });

  describe('パフォーマンステスト', () => {
    it('100人分の36協定チェックを10秒以内に完了する', async () => {
      const employees = Array(100).fill(null).map((_, i) => ({
        ...testEmployee,
        id: `emp${String(i + 1).padStart(3, '0')}`
      }));

      mockDb.getAllEmployees = vi.fn().mockResolvedValue(employees);
      mockDb.getEmployee = vi.fn().mockImplementation((id) =>
        Promise.resolve(employees.find(e => e.id === id))
      );
      mockDb.getTimeRecords = vi.fn().mockImplementation(() =>
        Promise.resolve(generateTimeRecordsWithOvertime('emp001', '2024-01', 40))
      );
      mockDb.query = vi.fn().mockResolvedValue({ 
        rows: [{ regular_limit: 45, yearly_limit: 360 }] 
      });

      const startTime = Date.now();
      const results = await Promise.all(
        employees.map(emp => engine.monitor36Agreement(emp.id, new Date()))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(10000);
    });

    it('1年分の勤怠データ分析を5秒以内に完了する', async () => {
      const yearRecords: TimeRecord[] = [];
      for (let month = 1; month <= 12; month++) {
        yearRecords.push(...generateMonthlyTimeRecords(
          'emp001',
          `2023-${String(month).padStart(2, '0')}`,
          20
        ));
      }

      mockDb.getTimeRecords = vi.fn().mockResolvedValue(yearRecords);

      const startTime = Date.now();
      const result = await engine.calculateDetailedWorkHours(yearRecords);
      const endTime = Date.now();

      expect(result.totalWorkHours).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('特殊ケース', () => {
    it('フレックスタイム制の労働時間を正確に計算する', async () => {
      const flexEmployee = { ...testEmployee, workSystem: 'flex' };
      const records: TimeRecord[] = [
        {
          id: 'tr001',
          employeeId: 'emp001',
          date: new Date('2024-01-15'),
          clockIn: new Date('2024-01-15T10:00:00'), // 10時出社
          clockOut: new Date('2024-01-15T19:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        }
      ];

      mockDb.getEmployee = vi.fn().mockResolvedValue(flexEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(records);

      const result = await engine.calculateDetailedWorkHours(records);

      expect(result.totalWorkHours).toBe(8); // コアタイム外も含めて8時間
      expect(result.flexTimeUtilization).toBeDefined();
    });

    it('変形労働時間制の36協定チェックを行う', async () => {
      const irregularEmployee = { 
        ...testEmployee, 
        workSystem: 'irregular',
        agreementType: 'irregular_hours'
      };

      mockDb.getEmployee = vi.fn().mockResolvedValue(irregularEmployee);
      mockDb.query = vi.fn().mockResolvedValue({
        rows: [{
          regular_limit: 45,
          weekly_average_limit: 40,
          daily_limit: 10
        }]
      });

      const records = generateTimeRecordsWithOvertime('emp001', '2024-01', 45);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(records);

      const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

      expect(status.workSystem).toBe('irregular');
      expect(status.weeklyAverageHours).toBeDefined();
    });

    it('管理監督者の労働時間管理を行う', async () => {
      const managerEmployee = { 
        ...testEmployee, 
        position: '部長',
        isManager: true
      };

      const records = generateTimeRecordsWithOvertime('emp001', '2024-01', 100);
      mockDb.getEmployee = vi.fn().mockResolvedValue(managerEmployee);
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(records);

      const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

      // 管理監督者でも健康管理は必要
      expect(status.isExemptFromOvertime).toBe(true);
      expect(status.healthRiskAssessment).toBeDefined();
      expect(status.alerts).toContainEqual(
        expect.objectContaining({
          type: 'MANAGER_HEALTH_WARNING'
        })
      );
    });
  });
});

// ヘルパー関数
function generateTimeRecordsWithOvertime(
  employeeId: string,
  month: string,
  totalOvertimeHours: number,
  upToDay?: number
): TimeRecord[] {
  const records: TimeRecord[] = [];
  const [year, monthNum] = month.split('-').map(Number);
  const days = upToDay || 20;
  const overtimePerDay = totalOvertimeHours / days;

  for (let day = 1; day <= days; day++) {
    const date = new Date(year, monthNum - 1, day);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const overtimeHours = Math.min(overtimePerDay, totalOvertimeHours - records.length * overtimePerDay);
    
    records.push({
      id: `tr_${employeeId}_${day}`,
      employeeId,
      date,
      clockIn: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0),
      clockOut: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18 + Math.floor(overtimeHours), (overtimeHours % 1) * 60, 0),
      breakMinutes: overtimeHours > 2 ? 75 : 60,
      recordType: 'ic_card'
    });
  }

  return records;
}

function generateMonthlyTimeRecords(employeeId: string, month: string, days: number): TimeRecord[] {
  const records: TimeRecord[] = [];
  const [year, monthNum] = month.split('-').map(Number);

  for (let day = 1; day <= days; day++) {
    const date = new Date(year, monthNum - 1, day);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    records.push({
      id: `tr_${employeeId}_${day}`,
      employeeId,
      date,
      clockIn: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0),
      clockOut: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0, 0),
      breakMinutes: 60,
      recordType: 'ic_card'
    });
  }

  return records;
}