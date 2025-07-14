/**
 * v1.3.0 Automatic Leave Management Integration Test Suite
 * 有給休暇自動管理システム統合テスト
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from '../../src/database.js';
import { AutomaticLeaveManagement, AutomaticLeaveAllocation, LeaveCarryover, LeaveUsageAnalysis } from '../../src/automatic-leave-management.js';

describe('AutomaticLeaveManagement Integration Tests', () => {
  let db: Database;
  let leaveManager: AutomaticLeaveManagement;
  let testEmployees: string[] = [];

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initializeDatabase();
    leaveManager = new AutomaticLeaveManagement(db);
    
    // 複数のテスト従業員を作成（異なる勤続年数）
    const employees = [
      { name: '新入社員', joinDate: new Date('2024-01-01'), tenure: 3 }, // 3ヶ月
      { name: '1年目社員', joinDate: new Date('2023-01-01'), tenure: 18 }, // 1.5年
      { name: '3年目社員', joinDate: new Date('2021-01-01'), tenure: 42 }, // 3.5年
      { name: '7年目社員', joinDate: new Date('2017-01-01'), tenure: 90 }  // 7.5年
    ];

    for (const emp of employees) {
      const empId = await db.addEmployee({
        name: emp.name,
        department: 'テスト部門',
        position: 'エンジニア',
        hourlyRate: 2500,
        joinDate: emp.joinDate,
        isActive: true
      });
      testEmployees.push(empId);
    }
  });

  afterEach(async () => {
    await db.close();
  });

  describe('年次有給休暇自動付与', () => {
    it('勤続年数に応じた正確な有給付与', async () => {
      const allocationDate = new Date('2024-07-01');
      const allocations = await leaveManager.processAnnualLeaveAllocation(allocationDate);

      // 新入社員（3ヶ月）- 付与なし
      const newEmployee = allocations.find(a => a.employeeId === testEmployees[0]);
      expect(newEmployee).toBeUndefined();

      // 1年目社員（18ヶ月）- 11日付与
      const firstYearEmployee = allocations.find(a => a.employeeId === testEmployees[1]);
      expect(firstYearEmployee?.grantedDays).toBe(11);

      // 3年目社員（42ヶ月）- 14日付与
      const thirdYearEmployee = allocations.find(a => a.employeeId === testEmployees[2]);
      expect(thirdYearEmployee?.grantedDays).toBe(14);

      // 7年目社員（90ヶ月）- 20日付与
      const seventhYearEmployee = allocations.find(a => a.employeeId === testEmployees[3]);
      expect(seventhYearEmployee?.grantedDays).toBe(20);
    });

    it('繰越計算を含む総付与日数計算', async () => {
      const emp = testEmployees[1]; // 1年目社員
      
      // 前年度残高を設定（5日残り）
      await createPreviousYearBalance(emp, 5);
      
      const allocationDate = new Date('2024-04-01');
      const allocations = await leaveManager.processAnnualLeaveAllocation(allocationDate);
      
      const allocation = allocations.find(a => a.employeeId === emp);
      expect(allocation?.grantedDays).toBe(11); // 新規付与
      expect(allocation?.carryoverDays).toBe(5); // 繰越
      expect(allocation?.totalDays).toBe(16); // 合計
    });

    it('自動付与の監査証跡記録', async () => {
      const allocationDate = new Date('2024-04-01');
      const allocations = await leaveManager.processAnnualLeaveAllocation(allocationDate);

      allocations.forEach(allocation => {
        expect(allocation.automaticallyProcessed).toBe(true);
        expect(allocation.verified).toBe(false);
        expect(allocation.calculationReason).toContain('労働基準法第39条準拠');
        expect(allocation.allocationDate).toEqual(allocationDate);
      });
    });
  });

  describe('有給休暇繰越処理', () => {
    it('前年度残日数の適切な繰越', async () => {
      const emp = testEmployees[2]; // 3年目社員
      
      // 前年度残高15日を設定
      await createPreviousYearBalance(emp, 15);
      
      const carryovers = await leaveManager.processLeaveCarryover(new Date('2024-04-01'));
      
      const carryover = carryovers.find(c => c.employeeId === emp);
      expect(carryover?.carriedDays).toBe(15);
      expect(carryover?.expiredDays).toBe(0);
      expect(carryover?.automaticallyProcessed).toBe(true);
    });

    it('繰越上限20日の適用', async () => {
      const emp = testEmployees[3]; // 7年目社員（20日付与）
      
      // 前年度残高18日を設定（20日付与で2日使用）
      await createPreviousYearBalance(emp, 18);
      
      const carryovers = await leaveManager.processLeaveCarryover(new Date('2024-04-01'));
      
      const carryover = carryovers.find(c => c.employeeId === emp);
      expect(carryover?.carriedDays).toBe(18); // 20日未満なので全額繰越
      expect(carryover?.expiredDays).toBe(0);
    });

    it('繰越上限超過時の失効処理', async () => {
      const emp = testEmployees[3]; // 7年目社員
      
      // 前年度残高20日満額を設定
      await createPreviousYearBalance(emp, 20);
      
      const carryovers = await leaveManager.processLeaveCarryover(new Date('2024-04-01'));
      
      const carryover = carryovers.find(c => c.employeeId === emp);
      expect(carryover?.carriedDays).toBe(20); // 上限通り
      expect(carryover?.expiredDays).toBe(0); // 上限内なので失効なし
    });
  });

  describe('有給休暇失効処理', () => {
    it('2年経過による失効処理', async () => {
      const emp = testEmployees[2];
      
      // 2年前の残日数を設定
      await createExpiredLeaveBalance(emp, 8, 2022);
      
      const expiries = await leaveManager.processLeaveExpiry(new Date('2024-04-01'));
      
      const expiry = expiries.find(e => e.employeeId === emp);
      expect(expiry?.expiredDays).toBe(8);
      expect(expiry?.year).toBe(2022);
      expect(expiry?.automaticallyProcessed).toBe(true);
    });

    it('失効通知の自動送信', async () => {
      const emp = testEmployees[1];
      
      await createExpiredLeaveBalance(emp, 5, 2022);
      
      const expiries = await leaveManager.processLeaveExpiry(new Date('2024-04-01'));
      
      const expiry = expiries.find(e => e.employeeId === emp);
      expect(expiry?.notificationSent).toBe(true);
      expect(expiry?.notificationDate).toBeDefined();
    });
  });

  describe('AI駆動承認推奨', () => {
    it('残高十分な場合の承認推奨', async () => {
      const emp = testEmployees[2]; // 14日付与予定
      
      // 十分な残高を設定
      await createCurrentYearBalance(emp, 14, 2);
      
      // 3日間の休暇申請を作成
      const requestId = await createLeaveRequest(emp, 3, new Date('2024-08-01'));
      
      const recommendation = await leaveManager.generateApprovalRecommendation(requestId);
      
      expect(recommendation.recommendedAction).toBe('approve');
      expect(recommendation.confidence).toBeGreaterThan(0.7);
      expect(recommendation.reasons).toContain('十分な残高あり');
    });

    it('残高不足時の却下推奨', async () => {
      const emp = testEmployees[1]; // 11日付与予定
      
      // 残高不足を設定
      await createCurrentYearBalance(emp, 11, 10);
      
      // 5日間の休暇申請（残り1日しかない）
      const requestId = await createLeaveRequest(emp, 5, new Date('2024-08-01'));
      
      const recommendation = await leaveManager.generateApprovalRecommendation(requestId);
      
      expect(recommendation.recommendedAction).toBe('reject');
      expect(recommendation.riskFactors).toContain('残高不足');
    });

    it('チーム影響考慮の推奨', async () => {
      const emp1 = testEmployees[1];
      const emp2 = testEmployees[2];
      
      // 同期間に他のチームメンバーの休暇を設定
      await createApprovedLeaveRequest(emp2, 5, new Date('2024-08-01'));
      
      const requestId = await createLeaveRequest(emp1, 3, new Date('2024-08-01'));
      
      const recommendation = await leaveManager.generateApprovalRecommendation(requestId);
      
      expect(recommendation.riskFactors).toContain('チームへの影響大');
    });
  });

  describe('有給使用状況分析', () => {
    it('使用率と傾向の分析', async () => {
      const emp = testEmployees[2];
      
      // 年間の使用データを作成
      await createLeaveUsageData(emp);
      
      const analysis = await leaveManager.analyzeLeaveUsage(
        emp,
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );
      
      expect(analysis.employeeId).toBe(emp);
      expect(analysis.usageRate).toBeGreaterThan(0);
      expect(analysis.usageRate).toBeLessThanOrEqual(1);
      expect(analysis.peakUsageMonths).toBeDefined();
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });

    it('失効リスク分析', async () => {
      const emp = testEmployees[3];
      
      // 大量残日数、低使用率のデータ
      await createCurrentYearBalance(emp, 20, 2); // 18日残り
      
      const analysis = await leaveManager.analyzeLeaveUsage(
        emp,
        new Date('2024-01-01'),
        new Date('2024-11-01') // 年末近し
      );
      
      expect(analysis.riskLevel).toBe('high');
      expect(analysis.recommendations).toContain(
        expect.stringContaining('失効リスク')
      );
    });
  });

  describe('リアルタイム残高追跡', () => {
    it('承認待ち申請を考慮した実効残高計算', async () => {
      const emp = testEmployees[2];
      
      // 現在残高設定
      await createCurrentYearBalance(emp, 14, 3);
      
      // 承認待ちの申請を作成
      await createPendingLeaveRequest(emp, 2);
      
      const balances = await leaveManager.trackLeaveBalanceRealTime(emp);
      
      const annualBalance = balances.find(b => b.leaveType === 'annual');
      expect(annualBalance?.remainingDays).toBe(11); // 14-3
      expect((annualBalance as any)?.pendingDays).toBe(2);
      expect((annualBalance as any)?.effectiveRemaining).toBe(9); // 11-2
    });

    it('複数休暇種別の同時追跡', async () => {
      const emp = testEmployees[1];
      
      // 複数種別の残高を設定
      await createMultipleLeaveBalances(emp);
      
      const balances = await leaveManager.trackLeaveBalanceRealTime(emp);
      
      expect(balances.length).toBeGreaterThan(1);
      expect(balances.some(b => b.leaveType === 'annual')).toBe(true);
      expect(balances.some(b => b.leaveType === 'sick')).toBe(true);
    });
  });

  describe('パフォーマンスと信頼性', () => {
    it('大量従業員の一括処理性能', async () => {
      // 追加で50名の従業員を作成
      const additionalEmployees: string[] = [];
      for (let i = 0; i < 50; i++) {
        const empId = await db.addEmployee({
          name: `従業員${i}`,
          department: 'テスト部門',
          position: 'エンジニア',
          hourlyRate: 2500,
          joinDate: new Date(2023, 0, 1 + i), // 異なる入社日
          isActive: true
        });
        additionalEmployees.push(empId);
      }

      const startTime = Date.now();
      const allocations = await leaveManager.processAnnualLeaveAllocation(new Date('2024-04-01'));
      const processingTime = Date.now() - startTime;

      expect(allocations.length).toBeGreaterThan(40); // 勤続6ヶ月以上の従業員
      expect(processingTime).toBeLessThan(5000); // 5秒以内
    });

    it('データ整合性の保証', async () => {
      const emp = testEmployees[2];
      
      // 同時に複数の処理を実行
      const promises = [
        leaveManager.processAnnualLeaveAllocation(new Date('2024-04-01')),
        leaveManager.processLeaveCarryover(new Date('2024-04-01')),
        leaveManager.analyzeLeaveUsage(emp, new Date('2024-01-01'), new Date('2024-12-31'))
      ];

      const results = await Promise.all(promises);
      
      // すべての処理が正常完了することを確認
      expect(results[0]).toBeInstanceOf(Array); // allocations
      expect(results[1]).toBeInstanceOf(Array); // carryovers
      expect(results[2]).toHaveProperty('employeeId'); // analysis
    });
  });

  // ヘルパー関数群
  async function createPreviousYearBalance(employeeId: string, remainingDays: number): Promise<void> {
    const previousYear = new Date().getFullYear() - 1;
    await db['db'].run(`
      INSERT OR REPLACE INTO leave_balances (
        employee_id, leave_type, year, granted_days, used_days, remaining_days
      ) VALUES (?, 'annual', ?, 20, ?, ?)
    `, [employeeId, previousYear, 20 - remainingDays, remainingDays]);
  }

  async function createCurrentYearBalance(employeeId: string, grantedDays: number, usedDays: number): Promise<void> {
    const currentYear = new Date().getFullYear();
    await db['db'].run(`
      INSERT OR REPLACE INTO leave_balances (
        employee_id, leave_type, year, granted_days, used_days, remaining_days
      ) VALUES (?, 'annual', ?, ?, ?, ?)
    `, [employeeId, currentYear, grantedDays, usedDays, grantedDays - usedDays]);
  }

  async function createExpiredLeaveBalance(employeeId: string, expiredDays: number, year: number): Promise<void> {
    await db['db'].run(`
      INSERT OR REPLACE INTO leave_balances (
        employee_id, leave_type, year, granted_days, used_days, remaining_days,
        expiry_date
      ) VALUES (?, 'annual', ?, 20, ?, ?, ?)
    `, [employeeId, year, 20 - expiredDays, expiredDays, `${year + 2}-03-31`]);
  }

  async function createLeaveRequest(employeeId: string, days: number, startDate: Date): Promise<string> {
    const requestId = `LR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + days - 1);

    await db['db'].run(`
      INSERT INTO leave_requests (
        id, employee_id, leave_type, start_date, end_date, days_requested, status
      ) VALUES (?, ?, 'annual', ?, ?, ?, 'pending')
    `, [requestId, employeeId, startDate.toISOString().split('T')[0], 
        endDate.toISOString().split('T')[0], days]);

    return requestId;
  }

  async function createApprovedLeaveRequest(employeeId: string, days: number, startDate: Date): Promise<void> {
    const requestId = await createLeaveRequest(employeeId, days, startDate);
    await db['db'].run(`
      UPDATE leave_requests SET status = 'approved' WHERE id = ?
    `, [requestId]);
  }

  async function createPendingLeaveRequest(employeeId: string, days: number): Promise<void> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 7); // 来週
    await createLeaveRequest(employeeId, days, startDate);
  }

  async function createLeaveUsageData(employeeId: string): Promise<void> {
    // 年間5回、合計10日の使用データを作成
    const usageData = [
      { startDate: '2024-02-15', days: 2 },
      { startDate: '2024-04-22', days: 1 },
      { startDate: '2024-06-10', days: 3 },
      { startDate: '2024-08-15', days: 2 },
      { startDate: '2024-10-14', days: 2 }
    ];

    for (const usage of usageData) {
      await createApprovedLeaveRequest(employeeId, usage.days, new Date(usage.startDate));
    }
  }

  async function createMultipleLeaveBalances(employeeId: string): Promise<void> {
    const currentYear = new Date().getFullYear();
    const balances = [
      { type: 'annual', granted: 11, used: 2 },
      { type: 'sick', granted: 5, used: 1 },
      { type: 'personal', granted: 3, used: 0 }
    ];

    for (const balance of balances) {
      await db['db'].run(`
        INSERT OR REPLACE INTO leave_balances (
          employee_id, leave_type, year, granted_days, used_days, remaining_days
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [employeeId, balance.type, currentYear, balance.granted, 
          balance.used, balance.granted - balance.used]);
    }
  }
});