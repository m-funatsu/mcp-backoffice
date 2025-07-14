import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LeaveManagement } from '../../src/leave-management.js';
import Database from '../../src/database.js';
import { LeaveType, RequestStatus } from '../../src/leave-management.js';

describe('Leave Management System', () => {
  let db: Database;
  let leaveManagement: LeaveManagement;
  let testEmployeeId: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initializeDatabase();
    leaveManagement = new LeaveManagement(db);

    // Create test employee
    testEmployeeId = await db.addEmployee({
      name: 'テスト太郎',
      department: 'テスト部',
      position: 'テスター',
      hourlyRate: 3000,
      joinDate: new Date('2023-01-01'),
      isActive: true
    });
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Natural Language Processing', () => {
    it('should parse annual leave request correctly', async () => {
      const requestText = '来週の月曜日から金曜日まで有給休暇を取りたいです。家族旅行のため。';
      
      const request = await leaveManagement.processNaturalLanguageRequest(testEmployeeId, requestText);
      
      expect(request.employeeId).toBe(testEmployeeId);
      expect(request.leaveType).toBe('annual');
      expect(request.status).toBe('pending');
      expect(request.reason).toContain('家族旅行');
      expect(request.halfDay).toBe(false);
    });

    it('should parse sick leave request correctly', async () => {
      const requestText = '明日は体調不良のため病気休暇を取りたいです。';
      
      const request = await leaveManagement.processNaturalLanguageRequest(testEmployeeId, requestText);
      
      expect(request.leaveType).toBe('sick');
      expect(request.status).toBe('pending');
      expect(request.reason).toContain('体調不良');
    });

    it('should parse half-day leave request correctly', async () => {
      const requestText = '明日の午後は半日有給休暇を取りたいです。';
      
      const request = await leaveManagement.processNaturalLanguageRequest(testEmployeeId, requestText);
      
      expect(request.leaveType).toBe('annual');
      expect(request.halfDay).toBe(true);
      expect(request.daysRequested).toBe(0.5);
    });

    it('should parse bereavement leave request correctly', async () => {
      const requestText = '祖父の忌引きのため、来週火曜日から木曜日まで休暇を取りたいです。';
      
      const request = await leaveManagement.processNaturalLanguageRequest(testEmployeeId, requestText);
      
      expect(request.leaveType).toBe('bereavement');
      expect(request.status).toBe('approved'); // Should be auto-approved
      expect(request.autoApproved).toBe(true);
    });

    it('should parse maternity leave request correctly', async () => {
      const requestText = '産休を3か月間取得したいです。';
      
      const request = await leaveManagement.processNaturalLanguageRequest(testEmployeeId, requestText);
      
      expect(request.leaveType).toBe('maternity');
      expect(request.status).toBe('pending');
    });
  });

  describe('Leave Balance Management', () => {
    it('should initialize leave balance for new employee', async () => {
      const balance = await leaveManagement.getLeaveBalance(testEmployeeId, 'annual');
      
      expect(balance.employeeId).toBe(testEmployeeId);
      expect(balance.leaveType).toBe('annual');
      expect(balance.year).toBe(new Date().getFullYear());
      expect(balance.grantedDays).toBeGreaterThan(0);
      expect(balance.usedDays).toBe(0);
      expect(balance.remainingDays).toBe(balance.grantedDays);
    });

    it('should update balance after leave approval', async () => {
      // Create a leave request
      const request = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '明日から3日間有給休暇を取りたいです。'
      );
      
      // Get initial balance
      const initialBalance = await leaveManagement.getLeaveBalance(testEmployeeId, 'annual');
      
      // Approve the request
      await leaveManagement.approveLeaveRequest(request.id, 'MANAGER001', '承認します');
      
      // Check updated balance
      const updatedBalance = await leaveManagement.getLeaveBalance(testEmployeeId, 'annual');
      
      expect(updatedBalance.usedDays).toBe(initialBalance.usedDays + 3);
      expect(updatedBalance.remainingDays).toBe(initialBalance.remainingDays - 3);
    });

    it('should handle insufficient balance gracefully', async () => {
      // Request more days than available
      const requestText = '来月から30日間有給休暇を取りたいです。';
      
      await expect(
        leaveManagement.processNaturalLanguageRequest(testEmployeeId, requestText)
      ).rejects.toThrow('残り休暇日数が不足しています');
    });
  });

  describe('Leave Request Validation', () => {
    it('should reject overlapping leave requests', async () => {
      // Create first request
      const request1 = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '来週月曜日から金曜日まで有給休暇を取りたいです。'
      );
      
      // Approve first request
      await leaveManagement.approveLeaveRequest(request1.id, 'MANAGER001', '承認');
      
      // Try to create overlapping request
      await expect(
        leaveManagement.processNaturalLanguageRequest(
          testEmployeeId,
          '来週水曜日から来週金曜日まで有給休暇を取りたいです。'
        )
      ).rejects.toThrow('重複する休暇申請があります');
    });

    it('should validate advance notice requirements', async () => {
      // Create a request for today (insufficient advance notice)
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      await expect(
        leaveManagement.processNaturalLanguageRequest(
          testEmployeeId,
          `${todayStr}に有給休暇を取りたいです。`
        )
      ).rejects.toThrow('事前申請期間が不足しています');
    });

    it('should handle non-existent employee gracefully', async () => {
      await expect(
        leaveManagement.processNaturalLanguageRequest(
          'NON_EXISTENT_ID',
          '有給休暇を取りたいです。'
        )
      ).rejects.toThrow('従業員が見つかりません');
    });
  });

  describe('Auto-Approval System', () => {
    it('should auto-approve bereavement leave', async () => {
      const request = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '祖母の忌引きのため2日間休暇を取りたいです。'
      );
      
      expect(request.status).toBe('approved');
      expect(request.autoApproved).toBe(true);
      expect(request.approvedBy).toBe('SYSTEM_AUTO_APPROVAL');
    });

    it('should auto-approve short sick leave', async () => {
      const request = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '明日は体調不良のため病気休暇を取りたいです。'
      );
      
      expect(request.status).toBe('approved');
      expect(request.autoApproved).toBe(true);
    });

    it('should require manual approval for long annual leave', async () => {
      const request = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '来月から5日間有給休暇を取りたいです。'
      );
      
      expect(request.status).toBe('pending');
      expect(request.autoApproved).toBe(false);
    });
  });

  describe('Leave Request Workflow', () => {
    it('should approve leave request correctly', async () => {
      const request = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '来週月曜日から3日間有給休暇を取りたいです。'
      );
      
      await leaveManagement.approveLeaveRequest(request.id, 'MANAGER001', '承認します');
      
      const updatedRequest = await leaveManagement.getLeaveRequest(request.id);
      
      expect(updatedRequest?.status).toBe('approved');
      expect(updatedRequest?.approvedBy).toBe('MANAGER001');
      expect(updatedRequest?.approvalNotes).toBe('承認します');
      expect(updatedRequest?.approvedAt).toBeDefined();
    });

    it('should reject leave request correctly', async () => {
      const request = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '来週月曜日から5日間有給休暇を取りたいです。'
      );
      
      await leaveManagement.rejectLeaveRequest(request.id, 'MANAGER001', '繁忙期のため却下');
      
      const updatedRequest = await leaveManagement.getLeaveRequest(request.id);
      
      expect(updatedRequest?.status).toBe('rejected');
      expect(updatedRequest?.approvedBy).toBe('MANAGER001');
      expect(updatedRequest?.approvalNotes).toBe('繁忙期のため却下');
    });

    it('should handle request not found gracefully', async () => {
      await expect(
        leaveManagement.approveLeaveRequest('NON_EXISTENT_ID', 'MANAGER001', '承認')
      ).rejects.toThrow('休暇申請が見つかりません');
    });
  });

  describe('Team Calendar Integration', () => {
    it('should retrieve team calendar events', async () => {
      // Create a leave request
      const request = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '来週月曜日から3日間有給休暇を取りたいです。'
      );
      
      // Approve the request
      await leaveManagement.approveLeaveRequest(request.id, 'MANAGER001', '承認');
      
      // Get team calendar
      const events = await leaveManagement.getTeamCalendar(
        'テスト部',
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );
      
      expect(Array.isArray(events)).toBe(true);
      // Note: This test might need adjustment based on the actual calendar implementation
    });
  });

  describe('Leave Analytics', () => {
    it('should generate leave analytics correctly', async () => {
      // Create some test requests
      const request1 = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '来週月曜日から3日間有給休暇を取りたいです。'
      );
      
      const request2 = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '来月から2日間病気休暇を取りたいです。'
      );
      
      // Approve requests
      await leaveManagement.approveLeaveRequest(request1.id, 'MANAGER001', '承認');
      await leaveManagement.rejectLeaveRequest(request2.id, 'MANAGER001', '却下');
      
      // Generate analytics
      const analytics = await leaveManagement.generateLeaveAnalytics(
        new Date('2025-01-01'),
        new Date('2025-12-31')
      );
      
      expect(analytics.totalRequests).toBeGreaterThan(0);
      expect(analytics.approvedRequests).toBeGreaterThan(0);
      expect(analytics.rejectedRequests).toBeGreaterThan(0);
      expect(analytics.mostPopularLeaveType).toBeDefined();
    });
  });

  describe('Japanese Labor Law Compliance', () => {
    it('should enforce annual leave policies based on tenure', async () => {
      // Create employee with different tenure
      const newEmployeeId = await db.addEmployee({
        name: '新人太郎',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 2500,
        joinDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        isActive: true
      });
      
      const balance = await leaveManagement.getLeaveBalance(newEmployeeId, 'annual');
      
      // New employee should have 0 annual leave days (needs 6 months tenure)
      expect(balance.grantedDays).toBe(0);
    });

    it('should calculate business days correctly', async () => {
      // Create a request spanning weekends
      const request = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        '2025-01-06から2025-01-10まで有給休暇を取りたいです。' // Monday to Friday
      );
      
      // Should be 5 business days (excluding weekends)
      expect(request.daysRequested).toBe(5);
    });

    it('should handle different leave types according to Japanese law', async () => {
      const leaveTypes: LeaveType[] = ['annual', 'sick', 'maternity', 'paternity', 'bereavement'];
      
      for (const leaveType of leaveTypes) {
        const balance = await leaveManagement.getLeaveBalance(testEmployeeId, leaveType);
        expect(balance.leaveType).toBe(leaveType);
        expect(balance.grantedDays).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed date strings gracefully', async () => {
      await expect(
        leaveManagement.processNaturalLanguageRequest(
          testEmployeeId,
          '無効な日付で有給休暇を取りたいです。'
        )
      ).not.toThrow();
    });

    it('should handle very long request text', async () => {
      const longText = 'A'.repeat(1000) + '有給休暇を取りたいです。';
      
      const request = await leaveManagement.processNaturalLanguageRequest(
        testEmployeeId,
        longText
      );
      
      expect(request.reason?.length).toBeLessThanOrEqual(200);
    });

    it('should handle concurrent requests safely', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          leaveManagement.processNaturalLanguageRequest(
            testEmployeeId,
            `${2025 + i}-01-${10 + i}に有給休暇を取りたいです。`
          )
        );
      }
      
      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
      
      // All requests should have unique IDs
      const ids = results.map(r => r.id);
      expect(new Set(ids).size).toBe(5);
    });
  });
});