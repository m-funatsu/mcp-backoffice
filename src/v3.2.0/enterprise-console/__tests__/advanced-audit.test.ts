/**
 * AI-OS v3.2.0 高度な監査サービス テスト
 * Advanced Audit Service Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdvancedAuditService } from '../services/AdvancedAuditService';

describe('AdvancedAuditService', () => {
  let service: AdvancedAuditService;
  let mockEmit: any;

  beforeEach(() => {
    service = new AdvancedAuditService();
    mockEmit = vi.spyOn(service, 'emit');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('監査イベントの記録', () => {
    it('基本的な監査イベントを記録できる', async () => {
      const event = await service.logEvent({
        entityType: 'user',
        entityId: 'user123',
        action: 'login',
        userId: 'user123',
        metadata: { success: true }
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.risk).toBeDefined();
      expect(event.hash).toBeDefined();
    });

    it('リスク評価が正しく計算される', async () => {
      const highRiskEvent = await service.logEvent({
        entityType: 'payroll',
        entityId: 'payroll_all',
        action: 'export_sensitive',
        userId: 'user123',
        userRole: 'admin',
        metadata: {}
      });

      expect(highRiskEvent.risk).toBeDefined();
      expect(highRiskEvent.risk!.score).toBeGreaterThan(50);
      expect(highRiskEvent.risk!.factors).toHaveLength(4);
    });

    it('異常検知が機能する', async () => {
      // 通常のイベントを複数記録
      for (let i = 0; i < 20; i++) {
        await service.logEvent({
          entityType: 'document',
          entityId: `doc${i}`,
          action: 'view',
          userId: 'user123',
          metadata: {}
        });
      }

      // 異常なアクセス時間のイベント
      const anomalousEvent = await service.logEvent({
        entityType: 'payroll',
        entityId: 'sensitive_data',
        action: 'export',
        userId: 'user123',
        metadata: {},
        timestamp: new Date('2024-01-01T03:00:00') // 深夜3時
      });

      expect(anomalousEvent.risk?.anomalyDetected).toBe(true);
    });
  });

  describe('監査ルール', () => {
    it('監査ルールを作成できる', () => {
      const rule = service.createAuditRule({
        name: 'Test Rule',
        description: 'Test description',
        enabled: true,
        conditions: [{
          type: 'pattern',
          parameters: {
            actions: ['delete', 'export'],
            matchType: 'any'
          }
        }],
        actions: [{
          type: 'alert',
          parameters: {
            severity: 'high',
            recipients: ['admin@company.com']
          }
        }],
        severity: 'high',
        createdBy: 'admin'
      });

      expect(rule.id).toBeDefined();
      expect(rule.createdAt).toBeInstanceOf(Date);
    });

    it('パターン条件でルールがトリガーされる', async () => {
      // 削除アクションでアラートを送るルールを作成
      service.createAuditRule({
        name: 'Delete Alert',
        enabled: true,
        conditions: [{
          type: 'pattern',
          parameters: {
            actions: ['delete'],
            matchType: 'any'
          }
        }],
        actions: [{
          type: 'alert',
          parameters: { severity: 'high' }
        }],
        severity: 'high',
        createdBy: 'admin'
      });

      // 削除イベントを記録
      await service.logEvent({
        entityType: 'document',
        entityId: 'doc123',
        action: 'delete',
        userId: 'user123'
      });

      // アラートイベントが発火することを確認
      const alertEvents = mockEmit.mock.calls.filter(
        call => call[0] === 'alert:sent'
      );
      expect(alertEvents.length).toBe(1);
    });

    it('閾値条件でルールがトリガーされる', async () => {
      // 失敗ログイン試行のルールを作成
      service.createAuditRule({
        name: 'Failed Login Threshold',
        enabled: true,
        conditions: [{
          type: 'threshold',
          parameters: {
            metric: 'failed_login_count',
            threshold: 3,
            timeWindow: 300000 // 5分
          }
        }],
        actions: [{
          type: 'block',
          parameters: { duration: 900000 } // 15分
        }],
        severity: 'medium',
        createdBy: 'system'
      });

      // 失敗ログインイベントを記録
      for (let i = 0; i < 3; i++) {
        await service.logEvent({
          entityType: 'auth',
          entityId: 'login',
          action: 'login',
          userId: 'user123',
          metadata: { success: false }
        });
      }

      // ブロックイベントが発火することを確認
      const blockEvents = mockEmit.mock.calls.filter(
        call => call[0] === 'access:blocked'
      );
      expect(blockEvents.length).toBe(1);
    });

    it('シーケンス条件でルールがトリガーされる', async () => {
      // 不審なシーケンスを検出するルール
      service.createAuditRule({
        name: 'Suspicious Sequence',
        enabled: true,
        conditions: [{
          type: 'sequence',
          parameters: {
            sequence: ['login', 'permission_change', 'export'],
            timeWindow: 600000 // 10分
          }
        }],
        actions: [{
          type: 'alert',
          parameters: { severity: 'critical' }
        }],
        severity: 'critical',
        createdBy: 'system'
      });

      // シーケンスイベントを記録
      await service.logEvent({
        entityType: 'auth',
        entityId: 'session',
        action: 'login',
        userId: 'user123'
      });

      await service.logEvent({
        entityType: 'permission',
        entityId: 'role',
        action: 'permission_change',
        userId: 'user123'
      });

      await service.logEvent({
        entityType: 'data',
        entityId: 'sensitive',
        action: 'export',
        userId: 'user123'
      });

      // アラートが発火することを確認
      const alertEvents = mockEmit.mock.calls.filter(
        call => call[0] === 'alert:sent'
      );
      expect(alertEvents.length).toBeGreaterThan(0);
    });
  });

  describe('スケジュールレポート', () => {
    it('スケジュールレポートを作成できる', () => {
      const schedule = service.createScheduledReport({
        name: 'Daily Compliance Report',
        reportType: 'compliance',
        schedule: {
          frequency: 'daily',
          time: '09:00'
        },
        recipients: ['compliance@company.com'],
        enabled: true
      });

      expect(schedule.id).toBeDefined();
      expect(mockEmit).toHaveBeenCalledWith('schedule:created', schedule);
    });

    it('レポートを生成できる', async () => {
      // テストデータを作成
      for (let i = 0; i < 10; i++) {
        await service.logEvent({
          entityType: 'document',
          entityId: `doc${i}`,
          action: i % 2 === 0 ? 'create' : 'update',
          userId: `user${i % 3}`,
          metadata: { violation: i % 4 === 0 }
        });
      }

      const report = await service.generateReport('compliance', {
        period: {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000),
          end: new Date()
        }
      });

      expect(report.id).toBeDefined();
      expect(report.type).toBe('compliance');
      expect(report.summary).toBeDefined();
      expect(report.summary.totalEvents).toBeGreaterThan(0);
      expect(report.details).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('フィルタ付きレポートを生成できる', async () => {
      // テストデータ
      await service.logEvent({
        entityType: 'payroll',
        entityId: 'emp1',
        action: 'update',
        userId: 'hr_user'
      });

      await service.logEvent({
        entityType: 'document',
        entityId: 'doc1',
        action: 'view',
        userId: 'regular_user'
      });

      const report = await service.generateReport('access', {
        period: {
          start: new Date(Date.now() - 60 * 60 * 1000),
          end: new Date()
        },
        filters: [{
          field: 'entityType',
          operator: 'eq',
          value: 'payroll'
        }]
      });

      expect(report.summary.totalEvents).toBe(1);
    });
  });

  describe('ブロックチェーン監査証跡', () => {
    it('監査証跡の整合性を検証できる', async () => {
      // 複数のイベントを記録
      for (let i = 0; i < 10; i++) {
        await service.logEvent({
          entityType: 'test',
          entityId: `test${i}`,
          action: 'create',
          userId: 'user123'
        });
      }

      // ブロックチェーンの検証
      const isValid = service.verifyAuditTrail();
      expect(isValid).toBe(true);
    });

    it('各イベントがハッシュチェーンで連結される', async () => {
      const event1 = await service.logEvent({
        entityType: 'test',
        entityId: 'test1',
        action: 'create',
        userId: 'user123'
      });

      const event2 = await service.logEvent({
        entityType: 'test',
        entityId: 'test2',
        action: 'update',
        userId: 'user123'
      });

      expect(event1.hash).toBeDefined();
      expect(event2.hash).toBeDefined();
      expect(event2.previousHash).toBeDefined();
    });
  });

  describe('エクスポート機能', () => {
    it('監査証跡をJSON形式でエクスポートできる', async () => {
      // テストデータ
      await service.logEvent({
        entityType: 'test',
        entityId: 'test1',
        action: 'create',
        userId: 'user123'
      });

      const exported = service.exportAuditTrail(
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date(),
        'json'
      );

      expect(Array.isArray(exported)).toBe(true);
      expect(exported.length).toBeGreaterThan(0);
    });

    it('監査証跡をCSV形式でエクスポートできる', async () => {
      // テストデータ
      await service.logEvent({
        entityType: 'test',
        entityId: 'test1',
        action: 'create',
        userId: 'user123'
      });

      const exported = service.exportAuditTrail(
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date(),
        'csv'
      );

      expect(typeof exported).toBe('string');
      expect(exported).toContain('ID,Timestamp,User ID');
    });
  });

  describe('リスク評価', () => {
    it('アクションリスクが正しく計算される', async () => {
      const deleteEvent = await service.logEvent({
        entityType: 'critical_data',
        entityId: 'data1',
        action: 'delete_all',
        userId: 'admin'
      });

      const viewEvent = await service.logEvent({
        entityType: 'document',
        entityId: 'doc1',
        action: 'view',
        userId: 'user'
      });

      expect(deleteEvent.risk!.score).toBeGreaterThan(viewEvent.risk!.score);
    });

    it('時間帯リスクが正しく計算される', async () => {
      // 深夜のイベント
      const nightEvent = await service.logEvent({
        entityType: 'data',
        entityId: 'data1',
        action: 'export',
        userId: 'user123',
        timestamp: new Date('2024-01-01T02:00:00')
      });

      // 営業時間内のイベント
      const businessHourEvent = await service.logEvent({
        entityType: 'data',
        entityId: 'data2',
        action: 'export',
        userId: 'user123',
        timestamp: new Date('2024-01-01T14:00:00')
      });

      const nightTimeRisk = nightEvent.risk!.factors.find(f => f.name === 'Time Risk');
      const businessTimeRisk = businessHourEvent.risk!.factors.find(f => f.name === 'Time Risk');

      expect(nightTimeRisk!.value).toBeGreaterThan(businessTimeRisk!.value);
    });

    it('データ感度リスクが正しく計算される', async () => {
      const sensitiveEvent = await service.logEvent({
        entityType: 'payroll',
        entityId: 'salary_data',
        action: 'export',
        userId: 'user123'
      });

      const normalEvent = await service.logEvent({
        entityType: 'public_doc',
        entityId: 'doc1',
        action: 'view',
        userId: 'user123'
      });

      const sensitiveDataRisk = sensitiveEvent.risk!.factors.find(f => f.name === 'Data Sensitivity');
      const normalDataRisk = normalEvent.risk!.factors.find(f => f.name === 'Data Sensitivity');

      expect(sensitiveDataRisk!.value).toBeGreaterThan(normalDataRisk!.value);
    });
  });

  describe('推奨事項の生成', () => {
    it('高リスクイベントが多い場合に推奨事項が生成される', async () => {
      // 高リスクイベントを大量に生成
      for (let i = 0; i < 20; i++) {
        await service.logEvent({
          entityType: 'sensitive_data',
          entityId: `data${i}`,
          action: 'delete',
          userId: 'admin',
          risk: { score: 85, factors: [], anomalyDetected: false, requiresReview: true }
        });
      }

      const report = await service.generateReport('security', {
        period: {
          start: new Date(Date.now() - 60 * 60 * 1000),
          end: new Date()
        }
      });

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations!.length).toBeGreaterThan(0);
      expect(report.recommendations![0]).toContain('高リスクイベント');
    });
  });
});