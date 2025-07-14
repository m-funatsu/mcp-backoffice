/**
 * v1.3.0 Compliance Engine Comprehensive Test Suite
 * 労働基準法第36条協定監視システム テスト
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from '../../src/database.js';
import { ComplianceEngine, LaborAgreement, ComplianceStatus, ObjectiveTimeRecord, ComplianceAlert } from '../../src/compliance-engine.js';

describe('ComplianceEngine v1.3.0', () => {
  let db: Database;
  let complianceEngine: ComplianceEngine;
  let testEmployeeId: string;

  beforeEach(async () => {
    // テスト用インメモリデータベース
    db = new Database(':memory:');
    await db.initializeDatabase();
    
    complianceEngine = new ComplianceEngine(db);
    
    // テスト従業員作成
    testEmployeeId = await db.addEmployee({
      name: 'テスト従業員',
      department: 'テスト部門',
      position: 'テストエンジニア',
      hourlyRate: 2500,
      joinDate: new Date('2023-04-01'),
      isActive: true
    });
  });

  afterEach(async () => {
    await db.close();
  });

  describe('36協定監視機能', () => {
    it('月間時間外労働上限監視', async () => {
      // 月間40時間の時間外労働データを作成
      const targetDate = new Date('2024-07-15');
      await createOvertimeData(testEmployeeId, 40, targetDate);

      const status = await complianceEngine.monitor36Agreement(testEmployeeId, targetDate);

      expect(status.employeeId).toBe(testEmployeeId);
      expect(status.monthlyOvertimeHours).toBe(40);
      expect(status.monthlyLimit).toBe(45); // デフォルト上限
      expect(status.monthlyComplianceRate).toBeCloseTo(0.89, 2); // 40/45
      expect(status.riskLevel).toBe('high'); // 80%超で高リスク
    });

    it('月間時間外労働上限超過検知', async () => {
      const targetDate = new Date('2024-07-15');
      await createOvertimeData(testEmployeeId, 50, targetDate); // 上限45時間を超過

      const status = await complianceEngine.monitor36Agreement(testEmployeeId, targetDate);

      expect(status.monthlyOvertimeHours).toBe(50);
      expect(status.monthlyComplianceRate).toBeGreaterThan(1);
      expect(status.riskLevel).toBe('critical');
    });

    it('年間時間外労働上限監視', async () => {
      // 年間300時間の時間外労働データを作成
      await createYearlyOvertimeData(testEmployeeId, 300, 2024);

      const status = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-12-15'));

      expect(status.yearlyOvertimeHours).toBe(300);
      expect(status.yearlyLimit).toBe(360); // デフォルト年間上限
      expect(status.yearlyComplianceRate).toBeCloseTo(0.83, 2);
      expect(status.riskLevel).toBe('high');
    });

    it('特別条項使用回数監視', async () => {
      // 月45時間超の時間外労働を6ヶ月実施（特別条項の上限）
      for (let month = 1; month <= 6; month++) {
        await createMonthlyOvertimeData(testEmployeeId, 50, 2024, month);
      }

      const status = await complianceEngine.monitor36Agreement(testEmployeeId, new Date('2024-07-15'));

      expect(status.specialLimitUsedCount).toBe(6);
      expect(status.specialLimitAvailable).toBe(0); // 残り0回
    });

    it('健康確保措置必要性判定（月80時間超）', async () => {
      const targetDate = new Date('2024-07-15');
      await createOvertimeData(testEmployeeId, 85, targetDate); // 80時間超

      const status = await complianceEngine.monitor36Agreement(testEmployeeId, targetDate);

      expect(status.healthCheckRequired).toBe(true);
      expect(status.riskLevel).toBe('critical');
    });
  });

  describe('客観的記録システム', () => {
    it('ICカードと自己申告の乖離検知', async () => {
      const recordDate = new Date('2024-07-15');
      const record: Partial<ObjectiveTimeRecord> = {
        employeeId: testEmployeeId,
        recordDate,
        icCardIn: new Date('2024-07-15T09:00:00'),
        icCardOut: new Date('2024-07-15T18:30:00'),
        selfReportedIn: new Date('2024-07-15T09:20:00'), // 20分の乖離
        selfReportedOut: new Date('2024-07-15T18:00:00'), // 30分の乖離
        selfReportReason: '電車遅延のため'
      };

      const recordId = await complianceEngine.recordObjectiveTime(record);
      expect(recordId).toBeDefined();

      const discrepancy = await complianceEngine.checkDiscrepancy(testEmployeeId, recordDate);
      expect(discrepancy?.discrepancyDetected).toBe(true);
      expect(discrepancy?.discrepancyMinutes).toBeGreaterThan(15); // 15分以上の乖離
    });

    it('PCログと自己申告の整合性チェック', async () => {
      const recordDate = new Date('2024-07-15');
      const record: Partial<ObjectiveTimeRecord> = {
        employeeId: testEmployeeId,
        recordDate,
        pcLogin: new Date('2024-07-15T08:55:00'),
        pcLogout: new Date('2024-07-15T18:45:00'),
        selfReportedIn: new Date('2024-07-15T09:00:00'),
        selfReportedOut: new Date('2024-07-15T18:30:00')
      };

      await complianceEngine.recordObjectiveTime(record);
      const discrepancy = await complianceEngine.checkDiscrepancy(testEmployeeId, recordDate);

      expect(discrepancy?.discrepancyDetected).toBe(false); // 許容範囲内
    });

    it('客観的記録による労働時間計算', async () => {
      const workDate = new Date('2024-07-15');
      
      // 客観的記録の確定
      const record: Partial<ObjectiveTimeRecord> = {
        employeeId: testEmployeeId,
        recordDate: workDate,
        verifiedIn: new Date('2024-07-15T09:00:00'),
        verifiedOut: new Date('2024-07-15T19:00:00'), // 10時間労働
        verificationMethod: 'ic_card'
      };

      await complianceEngine.recordObjectiveTime(record);
      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);

      expect(workHours.actualWorkHours).toBe(9); // 1時間休憩除く
      expect(workHours.dailyOvertime).toBe(1); // 8時間超1時間
      expect(workHours.breakMinutes).toBe(60); // 8時間超なので60分休憩
      expect(workHours.agreementCompliant).toBe(true); // 1日4時間以内
    });
  });

  describe('リアルタイムアラートシステム', () => {
    it('月間上限接近アラート生成', async () => {
      // 既に40時間の時間外労働済み
      await createOvertimeData(testEmployeeId, 40, new Date('2024-07-15'));

      // 追加3時間の時間外労働（合計43時間、上限45時間の95%）
      const alerts = await complianceEngine.generateRealTimeAlert(testEmployeeId, 3);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('monthly_overtime_approaching');
      expect(alerts[0].alertLevel).toBe('warning');
      expect(alerts[0].currentHours).toBe(43);
    });

    it('月間上限超過アラート生成', async () => {
      await createOvertimeData(testEmployeeId, 43, new Date('2024-07-15'));

      // 追加5時間で上限超過
      const alerts = await complianceEngine.generateRealTimeAlert(testEmployeeId, 5);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].alertType).toBe('monthly_overtime_exceeded');
      expect(alerts[0].alertLevel).toBe('critical');
      expect(alerts[0].currentHours).toBe(48);
    });

    it('健康確保措置アラート生成', async () => {
      await createOvertimeData(testEmployeeId, 78, new Date('2024-07-15'));

      // 追加5時間で80時間超過
      const alerts = await complianceEngine.generateRealTimeAlert(testEmployeeId, 5);

      const healthAlert = alerts.find(a => a.alertType === 'health_check_required');
      expect(healthAlert).toBeDefined();
      expect(healthAlert!.alertLevel).toBe('critical');
      expect(healthAlert!.message).toContain('医師の面接指導');
    });
  });

  describe('詳細労働時間計算', () => {
    it('複雑な時間外労働パターンの計算', async () => {
      const workDate = new Date('2024-07-15'); // 月曜日
      
      // 深夜労働を含む長時間労働
      const record: Partial<ObjectiveTimeRecord> = {
        employeeId: testEmployeeId,
        recordDate: workDate,
        verifiedIn: new Date('2024-07-15T08:00:00'),
        verifiedOut: new Date('2024-07-16T02:00:00'), // 翌日2時まで（18時間）
        verificationMethod: 'ic_card'
      };

      await complianceEngine.recordObjectiveTime(record);
      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);

      expect(workHours.actualWorkHours).toBe(17); // 1時間休憩除く
      expect(workHours.dailyOvertime).toBe(9); // 8時間超9時間
      expect(workHours.lateNightHours).toBeGreaterThan(0); // 22時-5時の深夜労働
      expect(workHours.agreementCompliant).toBe(false); // 4時間超で非準拠
    });

    it('休日労働の計算', async () => {
      const holidayDate = new Date('2024-07-14'); // 日曜日（休日）
      
      const record: Partial<ObjectiveTimeRecord> = {
        employeeId: testEmployeeId,
        recordDate: holidayDate,
        verifiedIn: new Date('2024-07-14T10:00:00'),
        verifiedOut: new Date('2024-07-14T16:00:00'), // 6時間労働
        verificationMethod: 'ic_card'
      };

      await complianceEngine.recordObjectiveTime(record);
      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, holidayDate);

      expect(workHours.holidayWorkHours).toBe(5.25); // 休憩45分除く
      expect(workHours.dailyOvertime).toBe(0); // 休日労働は日次時間外に含まれない
    });

    it('法定休憩時間の遵守チェック', async () => {
      const workDate = new Date('2024-07-15');
      
      // 8時間超労働だが休憩30分のみ（法定60分未満）
      const record: Partial<ObjectiveTimeRecord> = {
        employeeId: testEmployeeId,
        recordDate: workDate,
        verifiedIn: new Date('2024-07-15T09:00:00'),
        verifiedOut: new Date('2024-07-15T18:30:00'), // 9.5時間
        verificationMethod: 'ic_card'
      };

      await complianceEngine.recordObjectiveTime(record);
      const workHours = await complianceEngine.calculateDetailedWorkHours(testEmployeeId, workDate);

      expect(workHours.breakMinutes).toBe(60); // 法定休憩時間
      expect(workHours.breakLawCompliant).toBe(true); // システムが自動調整
    });
  });

  describe('エッジケースとエラーハンドリング', () => {
    it('存在しない従業員での36協定監視', async () => {
      await expect(
        complianceEngine.monitor36Agreement('INVALID_ID')
      ).rejects.toThrow();
    });

    it('無効な日付での客観的記録', async () => {
      const invalidRecord: Partial<ObjectiveTimeRecord> = {
        employeeId: testEmployeeId,
        recordDate: new Date('invalid-date')
      };

      await expect(
        complianceEngine.recordObjectiveTime(invalidRecord)
      ).rejects.toThrow();
    });

    it('労働基準法違反レベルの超過時間', async () => {
      // 月200時間の時間外労働（明らかな法違反）
      await createOvertimeData(testEmployeeId, 200, new Date('2024-07-15'));

      const status = await complianceEngine.monitor36Agreement(testEmployeeId);

      expect(status.riskLevel).toBe('critical');
      expect(status.monthlyComplianceRate).toBeGreaterThan(4); // 400%超過
    });

    it('データ整合性チェック', async () => {
      // 矛盾するデータ（退勤時刻が出勤時刻より早い）
      const record: Partial<ObjectiveTimeRecord> = {
        employeeId: testEmployeeId,
        recordDate: new Date('2024-07-15'),
        verifiedIn: new Date('2024-07-15T18:00:00'),
        verifiedOut: new Date('2024-07-15T09:00:00') // 矛盾
      };

      await expect(
        complianceEngine.recordObjectiveTime(record)
      ).rejects.toThrow();
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量従業員の36協定監視処理性能', async () => {
      // 100名の従業員データを作成
      const employeeIds: string[] = [];
      for (let i = 0; i < 100; i++) {
        const empId = await db.addEmployee({
          name: `従業員${i}`,
          department: 'テスト部門',
          position: 'エンジニア',
          hourlyRate: 2500,
          joinDate: new Date('2023-04-01'),
          isActive: true
        });
        employeeIds.push(empId);
        
        // 各従業員に時間外労働データを設定
        await createOvertimeData(empId, 30 + (i % 20), new Date('2024-07-15'));
      }

      const startTime = Date.now();
      
      // 全従業員の36協定監視
      const promises = employeeIds.map(empId => 
        complianceEngine.monitor36Agreement(empId)
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(processingTime).toBeLessThan(10000); // 10秒以内
      expect(processingTime / 100).toBeLessThan(100); // 従業員1人あたり100ms以内
    });
  });

  // ヘルパー関数
  async function createOvertimeData(employeeId: string, overtimeHours: number, targetDate: Date): Promise<void> {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    
    // 月初から指定日までの時間外労働データを分散作成
    const daysInMonth = new Date(year, month, 0).getDate();
    const targetDay = targetDate.getDate();
    const workDays = Math.min(targetDay, 20); // 営業日想定
    
    const dailyOvertime = overtimeHours / workDays;
    
    for (let day = 1; day <= targetDay; day++) {
      const workDate = new Date(year, month - 1, day);
      
      // 週末をスキップ
      if (workDate.getDay() === 0 || workDate.getDay() === 6) continue;
      
      await db['db'].run(`
        INSERT OR REPLACE INTO detailed_work_hours (
          id, employee_id, calculation_date, statutory_overtime
        ) VALUES (?, ?, ?, ?)
      `, [
        `DWH_${Date.now()}_${day}`,
        employeeId,
        workDate.toISOString().split('T')[0],
        dailyOvertime
      ]);
    }
  }

  async function createYearlyOvertimeData(employeeId: string, totalHours: number, year: number): Promise<void> {
    const monthlyHours = totalHours / 12;
    
    for (let month = 1; month <= 12; month++) {
      await createMonthlyOvertimeData(employeeId, monthlyHours, year, month);
    }
  }

  async function createMonthlyOvertimeData(employeeId: string, monthlyHours: number, year: number, month: number): Promise<void> {
    const daysInMonth = new Date(year, month, 0).getDate();
    const workDays = Math.floor(daysInMonth * 0.7); // 営業日想定
    const dailyHours = monthlyHours / workDays;
    
    for (let day = 1; day <= workDays; day++) {
      const workDate = new Date(year, month - 1, day);
      
      await db['db'].run(`
        INSERT OR REPLACE INTO detailed_work_hours (
          id, employee_id, calculation_date, statutory_overtime
        ) VALUES (?, ?, ?, ?)
      `, [
        `DWH_${year}_${month}_${day}_${employeeId}`,
        employeeId,
        workDate.toISOString().split('T')[0],
        dailyHours
      ]);
    }
  }
});