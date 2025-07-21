/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * 監査ログシステムテストスイート
 */

import { Pool } from 'pg';
import { AuditLogService } from '../services/AuditLogService';
import {
  AuditLog,
  AuditEntityType,
  AuditAction,
  AuditChanges,
} from '../types';

// モックデータベース接続
const mockDb = {
  query: jest.fn(),
} as unknown as Pool;

describe('AuditLogService', () => {
  let auditService: AuditLogService;

  beforeEach(() => {
    auditService = new AuditLogService(mockDb);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create audit log entry', async () => {
      const logParams = {
        entityType: 'role' as AuditEntityType,
        entityId: 'role123',
        action: 'update' as AuditAction,
        changes: {
          before: { displayName: '旧名称' },
          after: { displayName: '新名称' },
        },
        userId: 'user1',
        userIp: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        sessionId: 'session123',
        reason: '役割名の更新',
      };

      const expectedLog: AuditLog = {
        id: 'log1',
        ...logParams,
        createdAt: new Date(),
      };

      mockDb.query = jest.fn().mockResolvedValue({
        rows: [expectedLog],
      });

      const result = await auditService.log(logParams);

      expect(result).toEqual(expectedLog);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          logParams.entityType,
          logParams.entityId,
          logParams.action,
          JSON.stringify(logParams.changes),
          logParams.userId,
          logParams.userIp,
          logParams.userAgent,
          logParams.sessionId,
          logParams.reason,
        ])
      );
    });
  });

  describe('search', () => {
    it('should search logs with filters', async () => {
      const filters = {
        entityType: 'agent_config' as AuditEntityType,
        action: 'update' as AuditAction,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        limit: 50,
        offset: 0,
      };

      const mockLogs = [
        {
          id: 'log1',
          entity_type: 'agent_config',
          entity_id: 'agent1',
          action: 'update',
          changes: { before: {}, after: {} },
          user_id: 'user1',
          user_name: 'テストユーザー',
          user_email: 'test@example.com',
          created_at: new Date('2024-06-01'),
        },
      ];

      // カウントクエリのモック
      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockLogs });

      const result = await auditService.search(filters);

      expect(result.total).toBe(1);
      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].entity_type).toBe('agent_config');
    });

    it('should handle pagination correctly', async () => {
      const filters = {
        limit: 10,
        offset: 20,
      };

      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await auditService.search(filters);

      expect(result.total).toBe(100);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([10, 20])
      );
    });
  });

  describe('getEntityHistory', () => {
    it('should retrieve complete history for an entity', async () => {
      const entityType = 'role' as AuditEntityType;
      const entityId = 'role123';

      const mockHistory = [
        {
          id: 'log1',
          entity_type: entityType,
          entity_id: entityId,
          action: 'create',
          changes: { after: { name: 'test_role' } },
          user_id: 'user1',
          user_name: '作成者',
          created_at: new Date('2024-01-01'),
        },
        {
          id: 'log2',
          entity_type: entityType,
          entity_id: entityId,
          action: 'update',
          changes: {
            before: { displayName: '旧名' },
            after: { displayName: '新名' },
          },
          user_id: 'user2',
          user_name: '更新者',
          created_at: new Date('2024-01-02'),
        },
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockHistory });

      const history = await auditService.getEntityHistory(entityType, entityId);

      expect(history).toHaveLength(2);
      expect(history[0].action).toBe('create');
      expect(history[1].action).toBe('update');
    });
  });

  describe('detectCriticalChanges', () => {
    it('should detect high-risk activities', async () => {
      const mockCriticalLogs = [
        {
          id: 'log1',
          entity_type: 'role',
          action: 'delete',
          user_id: 'user1',
          user_name: '危険なユーザー',
          created_at: new Date(),
        },
        {
          id: 'log2',
          entity_type: 'permission',
          action: 'delete',
          user_id: 'user1',
          user_name: '危険なユーザー',
          created_at: new Date(),
        },
        {
          id: 'log3',
          entity_type: 'agent_config',
          action: 'disable',
          user_id: 'user1',
          user_name: '危険なユーザー',
          created_at: new Date(),
        },
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockCriticalLogs });

      const criticalChanges = await auditService.detectCriticalChanges(3600000);

      expect(criticalChanges).toHaveLength(1);
      expect(criticalChanges[0].userId).toBe('user1');
      expect(criticalChanges[0].riskScore).toBeGreaterThan(30);
      expect(criticalChanges[0].criticalActions).toHaveLength(3);
    });
  });

  describe('getStatistics', () => {
    it('should group statistics by entity type', async () => {
      const mockStats = [
        { key: 'role', count: '25' },
        { key: 'permission', count: '15' },
        { key: 'agent_config', count: '10' },
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockStats });

      const stats = await auditService.getStatistics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        groupBy: 'entity_type',
      });

      expect(stats).toHaveLength(3);
      expect(stats[0].key).toBe('role');
      expect(stats[0].count).toBe(25);
    });

    it('should group statistics by day', async () => {
      const mockStats = [
        { key: '2024-06-01', count: '10' },
        { key: '2024-06-02', count: '15' },
        { key: '2024-06-03', count: '8' },
      ];

      mockDb.query = jest.fn().mockResolvedValue({ rows: mockStats });

      const stats = await auditService.getStatistics({
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-03'),
        groupBy: 'day',
      });

      expect(stats).toHaveLength(3);
      expect(stats[0].key).toBe('2024-06-01');
    });
  });

  describe('checkForAnomalies', () => {
    it('should detect unusual nighttime activity', async () => {
      mockDb.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            user_id: 'user1',
            action_count: '50',
            hour: 3, // 午前3時
          }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const anomalies = await auditService.checkForAnomalies();

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('unusual_activity');
      expect(anomalies[0].severity).toBe('high');
      expect(anomalies[0].description).toContain('深夜の異常なアクティビティ');
    });

    it('should detect permission escalation', async () => {
      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'log1',
            entity_type: 'user_role',
            entity_id: 'role1',
            action: 'create',
            role_name: 'super_admin',
            user_id: 'user1',
            created_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] });

      const anomalies = await auditService.checkForAnomalies();

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('permission_escalation');
      expect(anomalies[0].severity).toBe('high');
      expect(anomalies[0].description).toContain('権限エスカレーション');
    });

    it('should detect mass deletion', async () => {
      mockDb.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            user_id: 'user1',
            entity_type: 'employee',
            deletion_count: '20',
          }],
        });

      const anomalies = await auditService.checkForAnomalies();

      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].type).toBe('mass_deletion');
      expect(anomalies[0].severity).toBe('high');
      expect(anomalies[0].description).toContain('大量削除を検出');
    });
  });

  describe('exportLogs', () => {
    const mockExportData = [
      {
        id: 'log1',
        entity_type: 'role',
        entity_id: 'role1',
        action: 'create',
        user_id: 'user1',
        user_name: 'テストユーザー',
        user_email: 'test@example.com',
        user_ip: '192.168.1.1',
        session_id: 'session1',
        reason: '新規作成',
        created_at: new Date('2024-06-01T10:00:00Z'),
      },
    ];

    it('should export logs as JSON', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: mockExportData });

      const exported = await auditService.exportLogs({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        format: 'json',
      });

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].entity_type).toBe('role');
    });

    it('should export logs as CSV', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: mockExportData });

      const exported = await auditService.exportLogs({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        format: 'csv',
      });

      expect(exported).toContain('ID,Entity Type,Entity ID');
      expect(exported).toContain('"log1","role","role1"');
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete old logs based on retention policy', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rowCount: 150 });

      const deletedCount = await auditService.cleanupOldLogs(365);

      expect(deletedCount).toBe(150);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM audit_logs')
      );
    });
  });
});

describe('Audit Log Integration Tests', () => {
  it('should handle complete audit trail for role changes', async () => {
    const auditService = new AuditLogService(mockDb);
    
    // 役割の作成から削除までの完全な監査証跡
    const auditTrail = [
      {
        action: 'create' as AuditAction,
        changes: {
          after: {
            name: 'custom_role',
            displayName: 'カスタム役割',
            priority: 100,
          },
        },
      },
      {
        action: 'update' as AuditAction,
        changes: {
          before: { displayName: 'カスタム役割' },
          after: { displayName: '更新されたカスタム役割' },
        },
      },
      {
        action: 'update' as AuditAction,
        changes: {
          before: { priority: 100 },
          after: { priority: 50 },
        },
      },
      {
        action: 'delete' as AuditAction,
        changes: {
          deleted: {
            name: 'custom_role',
            displayName: '更新されたカスタム役割',
            priority: 50,
          },
        },
      },
    ];

    // 各アクションをログに記録
    for (const trail of auditTrail) {
      mockDb.query = jest.fn().mockResolvedValue({
        rows: [{
          id: `log_${trail.action}`,
          entity_type: 'role',
          entity_id: 'role123',
          action: trail.action,
          changes: trail.changes,
          user_id: 'admin1',
          created_at: new Date(),
        }],
      });

      await auditService.log({
        entityType: 'role',
        entityId: 'role123',
        action: trail.action,
        changes: trail.changes,
        userId: 'admin1',
      });
    }

    // 履歴の取得と検証
    mockDb.query = jest.fn().mockResolvedValue({
      rows: auditTrail.map((trail, index) => ({
        id: `log_${index}`,
        entity_type: 'role',
        entity_id: 'role123',
        action: trail.action,
        changes: trail.changes,
        user_id: 'admin1',
        created_at: new Date(),
      })),
    });

    const history = await auditService.getEntityHistory('role', 'role123');
    
    expect(history).toHaveLength(4);
    expect(history.map(h => h.action)).toEqual(['create', 'update', 'update', 'delete']);
  });
});