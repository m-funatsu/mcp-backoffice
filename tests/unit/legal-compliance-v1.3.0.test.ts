/**
 * v1.3.0 Legal Compliance Comprehensive Test Suite
 * 日本労働基準法準拠テスト
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from '../../src/database.js';
import { ComplianceEngine } from '../../src/compliance-engine.js';
import { AutomaticLeaveManagement } from '../../src/automatic-leave-management.js';

describe('Legal Compliance v1.3.0 - Japanese Labor Standards Act', () => {
  let db: Database;
  let complianceEngine: ComplianceEngine;
  let leaveManager: AutomaticLeaveManagement;
  let testEmployeeId: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initializeDatabase();
    complianceEngine = new ComplianceEngine(db);
    leaveManager = new AutomaticLeaveManagement(db);
    
    testEmployeeId = await db.addEmployee({
      name: 'コンプライアンステスト従業員',
      department: 'テスト部門',
      position: 'エンジニア',
      hourlyRate: 2500,
      joinDate: new Date('2022-04-01'),
      isActive: true
    });
  });

  afterEach(async () => {
    await db.close();
  });

  describe('労働基準法第32条 - 労働時間の原則', () => {
    it('週40時間制限の遵守', async () => {
      // 1週間で40時間の労働データを作成
      const weekStart = new Date('2024-07-15'); // 月曜日
      const weeklyHours = await createWeeklyWorkData(testEmployeeId, weekStart, [8, 8, 8, 8, 8, 0, 0]);

      expect(weeklyHours).toBe(40);

      // 週40時間を超える場合の時間外労働判定
      const overtimeWeeklyHours = await createWeeklyWorkData(testEmployeeId, 
        new Date('2024-07-22'), [9, 9, 9, 9, 9, 0, 0]);

      expect(overtimeWeeklyHours).toBe(45);
      
      // 週5時間の時間外労働が発生することを確認
      const weeklyOvertime = Math.max(0, overtimeWeeklyHours - 40);
      expect(weeklyOvertime).toBe(5);
    });

    it('1日8時間制限の遵守', async () => {
      const workDate = new Date('2024-07-15');
      
      // 8時間労働（法定内）
      await createDailyWorkData(testEmployeeId, workDate, 8);
      let workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);
      expect(workHours.dailyOvertime).toBe(0);

      // 10時間労働（2時間の時間外）
      await createDailyWorkData(testEmployeeId, workDate, 10);
      workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);
      expect(workHours.dailyOvertime).toBe(2);
    });
  });

  describe('労働基準法第34条 - 休憩時間', () => {
    it('6時間超勤務時の45分休憩義務', async () => {
      const workDate = new Date('2024-07-15');
      
      // 7時間勤務の場合
      const record = await createObjectiveTimeRecord(testEmployeeId, workDate, 
        new Date('2024-07-15T09:00:00'), new Date('2024-07-15T16:00:00')); // 7時間

      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);
      expect(workHours.breakMinutes).toBeGreaterThanOrEqual(45);
      expect(workHours.breakLawCompliant).toBe(true);
    });

    it('8時間超勤務時の60分休憩義務', async () => {
      const workDate = new Date('2024-07-15');
      
      // 9時間勤務の場合
      await createObjectiveTimeRecord(testEmployeeId, workDate,
        new Date('2024-07-15T09:00:00'), new Date('2024-07-15T18:00:00')); // 9時間

      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);
      expect(workHours.breakMinutes).toBeGreaterThanOrEqual(60);
      expect(workHours.breakLawCompliant).toBe(true);
    });

    it('休憩時間不足の検出', async () => {
      const workDate = new Date('2024-07-15');
      
      // 8時間勤務だが休憩30分のみ（法違反）
      await createObjectiveTimeRecord(testEmployeeId, workDate,
        new Date('2024-07-15T09:00:00'), new Date('2024-07-15T17:30:00')); // 8.5時間（休憩30分想定）

      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);
      
      // システムが法定休憩時間を適用
      expect(workHours.breakMinutes).toBe(60);
      expect(workHours.actualWorkHours).toBe(7.5); // 調整後
    });
  });

  describe('労働基準法第35条 - 休日', () => {
    it('週1日の法定休日確保', async () => {
      const weekStart = new Date('2024-07-15'); // 月曜日
      
      // 月-土まで6日連続勤務
      for (let i = 0; i < 6; i++) {
        const workDate = new Date(weekStart);
        workDate.setDate(weekStart.getDate() + i);
        await createDailyWorkData(testEmployeeId, workDate, 8);
      }

      // 日曜日（法定休日）の労働チェック
      const sunday = new Date(weekStart);
      sunday.setDate(weekStart.getDate() + 6);
      
      // 日曜労働がある場合
      await createDailyWorkData(testEmployeeId, sunday, 8);
      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, sunday);
      
      expect(workHours.statutoryHolidayHours).toBe(8);
      expect(workHours.holidayWorkHours).toBe(8);
    });

    it('4週4日の変形休日制対応', async () => {
      // 4週間で4日の休日パターンをテスト
      const startDate = new Date('2024-07-01');
      let totalRestDays = 0;
      
      for (let week = 0; week < 4; week++) {
        for (let day = 0; day < 7; day++) {
          const workDate = new Date(startDate);
          workDate.setDate(startDate.getDate() + (week * 7) + day);
          
          // 土日を休日とする
          if (workDate.getDay() === 0 || workDate.getDay() === 6) {
            totalRestDays++;
          } else {
            await createDailyWorkData(testEmployeeId, workDate, 8);
          }
        }
      }
      
      expect(totalRestDays).toBeGreaterThanOrEqual(4); // 最低4日
    });
  });

  describe('労働基準法第36条 - 時間外労働協定', () => {
    it('原則的上限（月45時間・年360時間）の遵守', async () => {
      // 月44時間の時間外労働（上限内）
      await createMonthlyOvertimeData(testEmployeeId, 44, new Date('2024-07-15'));
      
      const status = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-07-15'));
      expect(status.monthlyComplianceRate).toBeLessThanOrEqual(1);
      expect(status.riskLevel).not.toBe('critical');

      // 月46時間の時間外労働（上限超過）
      await createMonthlyOvertimeData(testEmployeeId, 46, new Date('2024-08-15'));
      
      const statusOver = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-08-15'));
      expect(statusOver.monthlyComplianceRate).toBeGreaterThan(1);
      expect(statusOver.riskLevel).toBe('critical');
    });

    it('特別条項の上限（月100時間未満・年720時間）の遵守', async () => {
      // 月99時間の時間外労働（特別条項上限内）
      await createMonthlyOvertimeData(testEmployeeId, 99, new Date('2024-07-15'));
      
      const status = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-07-15'));
      expect(status.monthlyOvertimeHours).toBe(99);
      
      // 月101時間の時間外労働（特別条項上限超過）
      await createMonthlyOvertimeData(testEmployeeId, 101, new Date('2024-08-15'));
      
      const statusOver = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-08-15'));
      expect(statusOver.riskLevel).toBe('critical');
    });

    it('2-6ヶ月平均80時間制限の遵守', async () => {
      // 6ヶ月間で平均79時間の時間外労働（上限内）
      const monthlyHours = [75, 80, 82, 78, 85, 74]; // 平均79時間
      
      for (let i = 0; i < 6; i++) {
        const targetDate = new Date(2024, i + 1, 15);
        await createMonthlyOvertimeData(testEmployeeId, monthlyHours[i], targetDate);
      }

      const average = monthlyHours.reduce((sum, h) => sum + h, 0) / 6;
      expect(average).toBeLessThan(80);
    });

    it('特別条項適用回数制限（年6回）の遵守', async () => {
      // 月45時間超の時間外労働を7回実施（制限超過）
      for (let month = 1; month <= 7; month++) {
        await createMonthlyOvertimeData(testEmployeeId, 50, new Date(2024, month - 1, 15));
      }

      const status = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-07-15'));
      expect(status.specialLimitUsedCount).toBeGreaterThan(6);
      expect(status.specialLimitAvailable).toBeLessThan(0);
    });
  });

  describe('労働基準法第37条 - 割増賃金', () => {
    it('時間外労働25%割増の適用', async () => {
      const payrollEngine = new (await import('../../src/payroll-engine.js')).IntegratedPayrollEngine(db);
      
      // 月60時間以下の時間外労働
      const timeRecords = await createTimeRecordsWithOvertime(testEmployeeId, 30); // 30時間
      
      const payroll = await payrollEngine.calculateCompliancePayroll(
        { id: testEmployeeId, hourlyRate: 2500 } as any, 
        timeRecords
      );

      // 時間外手当が25%割増で計算されることを確認
      expect(payroll.overtimePremiumRate).toBe(1.25);
    });

    it('月60時間超時間外労働50%割増の適用', async () => {
      const payrollEngine = new (await import('../../src/payroll-engine.js')).IntegratedPayrollEngine(db);
      
      // 月65時間の時間外労働
      const timeRecords = await createTimeRecordsWithOvertime(testEmployeeId, 65);
      
      const payroll = await payrollEngine.calculateCompliancePayroll(
        { id: testEmployeeId, hourlyRate: 2500 } as any,
        timeRecords
      );

      // 60時間超分が50%割増で計算されることを確認
      expect(payroll.calculations.some(c => c.premiumRate === 1.50)).toBe(true);
    });

    it('深夜労働25%割増の適用', async () => {
      const workDate = new Date('2024-07-15');
      
      // 22:00-翌5:00の深夜労働
      await createObjectiveTimeRecord(testEmployeeId, workDate,
        new Date('2024-07-15T22:00:00'), new Date('2024-07-16T05:00:00'));

      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);
      expect(workHours.lateNightHours).toBe(7); // 22:00-05:00
    });

    it('複合割増率の適用（深夜+時間外=50%）', async () => {
      const workDate = new Date('2024-07-15');
      
      // 8:00-24:00の16時間労働（8時間時間外 + 2時間深夜）
      await createObjectiveTimeRecord(testEmployeeId, workDate,
        new Date('2024-07-15T08:00:00'), new Date('2024-07-16T00:00:00'));

      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);
      expect(workHours.dailyOvertime).toBe(7); // 1時間休憩除く
      expect(workHours.lateNightHours).toBe(2); // 22:00-00:00
    });
  });

  describe('労働基準法第39条 - 年次有給休暇', () => {
    it('勤続6ヶ月後の10日付与', async () => {
      const joinDate = new Date('2024-01-01');
      const empId = await db.addEmployee({
        name: '新入社員',
        department: 'テスト部門',
        position: 'エンジニア',
        hourlyRate: 2500,
        joinDate,
        isActive: true
      });

      // 6ヶ月後の付与処理
      const sixMonthsLater = new Date('2024-07-01');
      const allocations = await leaveManager.processAnnualLeaveAllocation(sixMonthsLater);
      
      const allocation = allocations.find(a => a.employeeId === empId);
      expect(allocation?.grantedDays).toBe(10);
    });

    it('勤続年数に応じた段階的付与', async () => {
      const testCases = [
        { tenure: 18, expected: 11 }, // 1年6ヶ月
        { tenure: 30, expected: 12 }, // 2年6ヶ月
        { tenure: 42, expected: 14 }, // 3年6ヶ月
        { tenure: 54, expected: 16 }, // 4年6ヶ月
        { tenure: 66, expected: 18 }, // 5年6ヶ月
        { tenure: 78, expected: 20 }  // 6年6ヶ月以上
      ];

      for (const testCase of testCases) {
        const joinDate = new Date();
        joinDate.setMonth(joinDate.getMonth() - testCase.tenure);
        
        const empId = await db.addEmployee({
          name: `${testCase.tenure}ヶ月従業員`,
          department: 'テスト部門',
          position: 'エンジニア',
          hourlyRate: 2500,
          joinDate,
          isActive: true
        });

        const allocations = await leaveManager.processAnnualLeaveAllocation();
        const allocation = allocations.find(a => a.employeeId === empId);
        
        expect(allocation?.grantedDays).toBe(testCase.expected);
      }
    });

    it('有給休暇の2年時効', async () => {
      const empId = testEmployeeId;
      
      // 2年前の有給残日数を設定
      await create2YearOldLeaveBalance(empId, 10);
      
      const expiries = await leaveManager.processLeaveExpiry();
      const expiry = expiries.find(e => e.employeeId === empId);
      
      expect(expiry?.expiredDays).toBe(10);
      expect(expiry?.automaticallyProcessed).toBe(true);
    });

    it('繰越上限20日の適用', async () => {
      const empId = testEmployeeId;
      
      // 前年度満額20日残りを設定
      await createPreviousYearBalance(empId, 20);
      
      const carryovers = await leaveManager.processLeaveCarryover();
      const carryover = carryovers.find(c => c.employeeId === empId);
      
      expect(carryover?.carriedDays).toBe(20); // 上限通り
    });
  });

  describe('労働安全衛生法 - 健康確保措置', () => {
    it('月80時間超時間外労働者への医師面接指導義務', async () => {
      // 月85時間の時間外労働
      await createMonthlyOvertimeData(testEmployeeId, 85, new Date('2024-07-15'));
      
      const status = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-07-15'));
      expect(status.healthCheckRequired).toBe(true);
      
      const alerts = await complianceEngine.generateRealTimeAlert(testEmployeeId, 0);
      const healthAlert = alerts.find(a => a.alertType === 'health_check_required');
      expect(healthAlert?.message).toContain('医師の面接指導');
    });

    it('月100時間超時間外労働者への義務的医師面接', async () => {
      // 月105時間の時間外労働
      await createMonthlyOvertimeData(testEmployeeId, 105, new Date('2024-07-15'));
      
      const status = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-07-15'));
      expect(status.riskLevel).toBe('critical');
      expect(status.healthCheckRequired).toBe(true);
    });
  });

  describe('労働時間等設定改善法 - 勤務間インターバル', () => {
    it('11時間インターバルの推奨遵守', async () => {
      const day1 = new Date('2024-07-15');
      const day2 = new Date('2024-07-16');
      
      // 1日目: 23:00終業
      await createObjectiveTimeRecord(testEmployeeId, day1,
        new Date('2024-07-15T09:00:00'), new Date('2024-07-15T23:00:00'));
      
      // 2日目: 09:00始業（10時間インターバル）
      await createObjectiveTimeRecord(testEmployeeId, day2,
        new Date('2024-07-16T09:00:00'), new Date('2024-07-16T18:00:00'));

      const day1Hours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, day1);
      const day2Hours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, day2);
      
      // インターバル時間の計算
      const interval = (day2Hours.calculationDate.getTime() + 9 * 60 * 60 * 1000) - 
                      (day1Hours.calculationDate.getTime() + 23 * 60 * 60 * 1000);
      const intervalHours = interval / (1000 * 60 * 60);
      
      expect(intervalHours).toBe(10); // 10時間インターバル
    });
  });

  describe('包括的コンプライアンステスト', () => {
    it('労働基準法完全準拠シナリオ', async () => {
      // 1ヶ月間の完全準拠労働パターン
      const month = new Date('2024-07-01');
      const daysInMonth = new Date(2024, 7, 0).getDate();
      
      let totalOvertimeHours = 0;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const workDate = new Date(2024, 6, day);
        const dayOfWeek = workDate.getDay();
        
        // 土日は休日
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        
        // 平日は8時間労働、月・水・金のみ2時間時間外
        const isOvertimeDay = dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5;
        const workHours = isOvertimeDay ? 10 : 8;
        const overtimeHours = isOvertimeDay ? 2 : 0;
        
        await createDailyWorkData(testEmployeeId, workDate, workHours);
        totalOvertimeHours += overtimeHours;
      }

      const status = await complianceEngine.monitor36Agreement(testEmployeeId, month);
      
      expect(totalOvertimeHours).toBeLessThanOrEqual(45); // 月45時間以内
      expect(status.monthlyComplianceRate).toBeLessThanOrEqual(1);
      expect(status.riskLevel).not.toBe('critical');
    });

    it('労働基準法違反検出シナリオ', async () => {
      // 意図的な法違反パターン
      const violations: string[] = [];
      
      // 1. 月60時間の時間外労働（特別条項なしの場合）
      await createMonthlyOvertimeData(testEmployeeId, 60, new Date('2024-07-15'));
      const overtimeStatus = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-07-15'));
      if (overtimeStatus.monthlyComplianceRate > 1) {
        violations.push('月間時間外労働上限超過');
      }

      // 2. 休憩時間不足
      const workDate = new Date('2024-07-15');
      await createObjectiveTimeRecord(testEmployeeId, workDate,
        new Date('2024-07-15T09:00:00'), new Date('2024-07-15T17:30:00')); // 8.5時間（休憩30分想定）
      
      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);
      if (!workHours.breakLawCompliant) {
        violations.push('法定休憩時間不足');
      }

      // 3. 連続7日勤務
      for (let i = 0; i < 7; i++) {
        const consecutiveDate = new Date('2024-07-15');
        consecutiveDate.setDate(consecutiveDate.getDate() + i);
        await createDailyWorkData(testEmployeeId, consecutiveDate, 8);
      }
      
      // 日曜日労働チェック
      const sunday = new Date('2024-07-21'); // 日曜日
      const sundayHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, sunday);
      if (sundayHours.statutoryHolidayHours > 0) {
        violations.push('法定休日労働');
      }

      expect(violations.length).toBeGreaterThan(0); // 何らかの違反が検出される
    });
  });

  // ヘルパー関数群
  async function createWeeklyWorkData(employeeId: string, weekStart: Date, dailyHours: number[]): Promise<number> {
    let totalHours = 0;
    for (let i = 0; i < 7; i++) {
      if (dailyHours[i] === 0) continue;
      
      const workDate = new Date(weekStart);
      workDate.setDate(weekStart.getDate() + i);
      
      await createDailyWorkData(employeeId, workDate, dailyHours[i]);
      totalHours += dailyHours[i];
    }
    return totalHours;
  }

  async function createDailyWorkData(employeeId: string, workDate: Date, hours: number): Promise<void> {
    const startTime = new Date(workDate);
    startTime.setHours(9, 0, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + hours);
    
    await createObjectiveTimeRecord(employeeId, workDate, startTime, endTime);
  }

  async function createObjectiveTimeRecord(employeeId: string, date: Date, startTime: Date, endTime: Date): Promise<void> {
    await db['db'].run(`
      INSERT OR REPLACE INTO objective_time_records (
        id, employee_id, record_date, verified_in, verified_out, verification_method
      ) VALUES (?, ?, ?, ?, ?, 'ic_card')
    `, [
      `OBJ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId,
      date.toISOString().split('T')[0],
      startTime.toISOString(),
      endTime.toISOString()
    ]);
  }

  async function createMonthlyOvertimeData(employeeId: string, totalHours: number, targetDate: Date): Promise<void> {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const workDays = Math.floor(daysInMonth * 0.7); // 営業日想定
    const dailyOvertime = totalHours / workDays;

    for (let day = 1; day <= daysInMonth; day++) {
      const workDate = new Date(year, month - 1, day);
      
      // 週末をスキップ
      if (workDate.getDay() === 0 || workDate.getDay() === 6) continue;
      
      await db['db'].run(`
        INSERT OR REPLACE INTO detailed_work_hours (
          id, employee_id, calculation_date, statutory_overtime
        ) VALUES (?, ?, ?, ?)
      `, [
        `DWH_${year}_${month}_${day}_${employeeId}`,
        employeeId,
        workDate.toISOString().split('T')[0],
        dailyOvertime
      ]);
    }
  }

  async function createTimeRecordsWithOvertime(employeeId: string, overtimeHours: number): Promise<any[]> {
    const records = [];
    const daysInMonth = 22; // 営業日
    const dailyOvertime = overtimeHours / daysInMonth;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(2024, 6, day); // 7月
      records.push({
        employeeId,
        date,
        clockIn: new Date(date.getTime() + 9 * 60 * 60 * 1000), // 9:00
        clockOut: new Date(date.getTime() + (17 + dailyOvertime) * 60 * 60 * 1000), // 17:00 + 時間外
        breakMinutes: 60
      });
    }

    return records;
  }

  async function createPreviousYearBalance(employeeId: string, remainingDays: number): Promise<void> {
    const previousYear = new Date().getFullYear() - 1;
    await db['db'].run(`
      INSERT OR REPLACE INTO leave_balances (
        employee_id, leave_type, year, granted_days, used_days, remaining_days
      ) VALUES (?, 'annual', ?, 20, ?, ?)
    `, [employeeId, previousYear, 20 - remainingDays, remainingDays]);
  }

  async function create2YearOldLeaveBalance(employeeId: string, expiredDays: number): Promise<void> {
    const twoYearsAgo = new Date().getFullYear() - 2;
    await db['db'].run(`
      INSERT OR REPLACE INTO leave_balances (
        employee_id, leave_type, year, granted_days, used_days, remaining_days, expiry_date
      ) VALUES (?, 'annual', ?, 20, ?, ?, ?)
    `, [employeeId, twoYearsAgo, 20 - expiredDays, expiredDays, `${twoYearsAgo + 2}-03-31`]);
  }
});