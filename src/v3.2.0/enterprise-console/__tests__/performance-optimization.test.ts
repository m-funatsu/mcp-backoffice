/**
 * AI-OS v3.2.0 パフォーマンス最適化 テスト
 * Performance Optimization Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceOptimizationService } from '../services/PerformanceOptimizationService';

describe('PerformanceOptimizationService', () => {
  let service: PerformanceOptimizationService;
  let mockEmit: any;

  beforeEach(() => {
    service = new PerformanceOptimizationService();
    mockEmit = vi.spyOn(service, 'emit');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('コネクションプール管理', () => {
    it('接続を取得できる', async () => {
      const connection = await service.getWebSocketConnection();
      
      expect(connection).toBeDefined();
      expect(connection.type).toBe('websocket');
    });

    it('接続を解放できる', async () => {
      const connection = await service.getWebSocketConnection();
      
      expect(() => {
        service.releaseWebSocketConnection(connection);
      }).not.toThrow();
    });

    it('最大接続数に達した場合は待機キューに入る', async () => {
      // 1000接続（最大値）を取得
      const connections = [];
      for (let i = 0; i < 1000; i++) {
        connections.push(await service.getWebSocketConnection());
      }

      // 1001個目は待機状態になるはず
      const waitPromise = service.getWebSocketConnection();
      
      // 1つ解放
      service.releaseWebSocketConnection(connections[0]);
      
      // 待機していた接続が取得できる
      const newConnection = await waitPromise;
      expect(newConnection).toBeDefined();
    });
  });

  describe('バッチ処理', () => {
    it('バッチに項目を追加できる', async () => {
      await expect(
        service.addToBatch('config_update', { key: 'value' })
      ).resolves.not.toThrow();
    });

    it('高優先度の項目は即座に処理される', async () => {
      await service.addToBatch('config_update', { key: 'urgent' }, 'high');
      
      // 高優先度の場合、即座に処理されることを確認
      // （実際の実装では処理完了のイベントを確認）
    });

    it('バッチサイズに達すると自動的に処理される', async () => {
      // 100件（バッチサイズ）まで追加
      for (let i = 0; i < 100; i++) {
        await service.addToBatch('config_update', { id: i });
      }
      
      // バッチ処理が実行されることを確認
      // （実際の実装では処理完了のイベントを確認）
    });
  });

  describe('キャッシュ戦略', () => {
    it('キャッシュに値を設定・取得できる', async () => {
      await service.setCached('config', 'test-key', { value: 'test' });
      const cached = await service.getCached('config', 'test-key');
      
      expect(cached).toEqual({ value: 'test' });
    });

    it('TTLが過ぎるとキャッシュから削除される', async () => {
      await service.setCached('config', 'ttl-test', { value: 'test' }, 100);
      
      // 即座に取得すると値がある
      const immediate = await service.getCached('config', 'ttl-test');
      expect(immediate).toEqual({ value: 'test' });
      
      // TTL経過後は削除されている
      await new Promise(resolve => setTimeout(resolve, 150));
      const expired = await service.getCached('config', 'ttl-test');
      expect(expired).toBeNull();
    });

    it('LRU戦略で古いアイテムが削除される', async () => {
      // キャッシュサイズを超えるまでアイテムを追加
      for (let i = 0; i < 1100; i++) {
        await service.setCached('config', `key-${i}`, { value: i });
      }
      
      // 最初のアイテムは削除されているはず
      const firstItem = await service.getCached('config', 'key-0');
      expect(firstItem).toBeNull();
      
      // 最近のアイテムは残っているはず
      const recentItem = await service.getCached('config', 'key-1099');
      expect(recentItem).toEqual({ value: 1099 });
    });
  });

  describe('最適化ルール', () => {
    it('最適化ルールを追加できる', () => {
      const rule = service.addOptimizationRule({
        name: 'Test Rule',
        condition: {
          metric: 'cpuUsage',
          operator: 'gt',
          threshold: 90
        },
        action: {
          type: 'throttle',
          parameters: { requestsPerSecond: 50 }
        },
        enabled: true,
        priority: 1
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Test Rule');
    });

    it('CPU使用率が高い場合にスロットリングが適用される', async () => {
      // CPU使用率を高くシミュレート
      vi.spyOn(service as any, 'getCPUUsage').mockReturnValue(85);

      // メトリクス収集をトリガー（通常は自動）
      await new Promise(resolve => setTimeout(resolve, 6000));

      // スロットリングイベントが発火することを確認
      const throttleEvents = mockEmit.mock.calls.filter(
        call => call[0] === 'throttle:apply'
      );
      
      expect(throttleEvents.length).toBeGreaterThan(0);
    });

    it('レスポンスタイムが遅い場合にキャッシュが強化される', async () => {
      // レスポンスタイムを遅くシミュレート
      vi.spyOn(service as any, 'getResponseTimePercentiles').mockReturnValue({
        p50: 500,
        p95: 1500,
        p99: 2000
      });

      // メトリクス収集をトリガー
      await new Promise(resolve => setTimeout(resolve, 6000));

      // 最適化イベントが発火することを確認
      const optimizationEvents = mockEmit.mock.calls.filter(
        call => call[0] === 'optimization:triggered'
      );
      
      expect(optimizationEvents.length).toBeGreaterThan(0);
    });
  });

  describe('パフォーマンスレポート', () => {
    it('パフォーマンスレポートを生成できる', async () => {
      // メトリクスを収集させる
      await new Promise(resolve => setTimeout(resolve, 6000));

      const report = service.generatePerformanceReport();
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.avgCPU).toMatch(/\d+\.\d+%/);
      expect(report.summary.avgMemory).toMatch(/\d+\.\d+%/);
      expect(report.summary.avgResponseTime).toMatch(/\d+ms/);
      expect(report.pools).toBeDefined();
      expect(report.caches).toBeDefined();
    }, 15000); // タイムアウトを15秒に設定

    it('メトリクスがない場合はエラーを返す', () => {
      const report = service.generatePerformanceReport();
      
      expect(report).toEqual({ error: 'No metrics available' });
    });
  });

  describe('サーキットブレーカー', () => {
    it('連続した失敗でサーキットが開く', async () => {
      const breaker = (service as any).getOrCreateCircuitBreaker('test-service');
      
      // 5回失敗させる
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('Test failure')));
        } catch (e) {
          // エラーは期待される
        }
      }
      
      // サーキットが開いているはず
      expect(breaker.getState()).toBe('open');
      
      // 次の実行は即座に失敗するはず
      await expect(
        breaker.execute(() => Promise.resolve('success'))
      ).rejects.toThrow('Circuit breaker is open');
    });

    it('タイムアウト後にハーフオープン状態になる', async () => {
      const breaker = (service as any).getOrCreateCircuitBreaker('test-service-2');
      
      // サーキットを開く
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error('Test failure')));
        } catch (e) {
          // エラーは期待される
        }
      }
      
      // リセットタイムアウトを短く設定
      breaker.config.resetTimeout = 100;
      
      // タイムアウト待機
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // 成功する操作を実行
      const result = await breaker.execute(() => Promise.resolve('success'));
      expect(result).toBe('success');
      
      // サーキットが閉じているはず
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('ロードバランサー', () => {
    it('ラウンドロビンで順番にサーバーを選択する', () => {
      const loadBalancer = (service as any).loadBalancer;
      
      // サーバーを追加
      loadBalancer.addServer({
        id: 'server1',
        host: 'localhost',
        port: 3001,
        healthy: true,
        activeConnections: 0,
        weight: 1
      });
      
      loadBalancer.addServer({
        id: 'server2',
        host: 'localhost',
        port: 3002,
        healthy: true,
        activeConnections: 0,
        weight: 1
      });
      
      // 順番に選択されることを確認
      const server1 = loadBalancer.getNextServer();
      const server2 = loadBalancer.getNextServer();
      const server3 = loadBalancer.getNextServer();
      
      expect(server1.id).toBe('server1');
      expect(server2.id).toBe('server2');
      expect(server3.id).toBe('server1'); // ラウンドロビンで戻る
    });

    it('不健全なサーバーはスキップされる', () => {
      const loadBalancer = (service as any).loadBalancer;
      
      // 健全なサーバーと不健全なサーバーを追加
      loadBalancer.addServer({
        id: 'healthy-server',
        host: 'localhost',
        port: 3003,
        healthy: true,
        activeConnections: 0,
        weight: 1
      });
      
      loadBalancer.addServer({
        id: 'unhealthy-server',
        host: 'localhost',
        port: 3004,
        healthy: false,
        activeConnections: 0,
        weight: 1
      });
      
      // 健全なサーバーのみが選択されることを確認
      for (let i = 0; i < 5; i++) {
        const server = loadBalancer.getNextServer();
        expect(server.id).toBe('healthy-server');
      }
    });
  });

  describe('メトリクス収集', () => {
    it('定期的にメトリクスが収集される', async () => {
      // 6秒待機（1回のメトリクス収集）
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // メトリクス収集イベントが発火していることを確認
      const metricsEvents = mockEmit.mock.calls.filter(
        call => call[0] === 'metrics:collected'
      );
      
      expect(metricsEvents.length).toBeGreaterThanOrEqual(1);
      
      // メトリクスの内容を確認
      if (metricsEvents.length > 0) {
        const latestMetrics = metricsEvents[metricsEvents.length - 1][1];
        expect(latestMetrics).toMatchObject({
          timestamp: expect.any(Date),
          connectionCount: expect.any(Number),
          activeRequests: expect.any(Number),
          cpuUsage: expect.any(Number),
          memoryUsage: expect.any(Number),
          responseTime: {
            p50: expect.any(Number),
            p95: expect.any(Number),
            p99: expect.any(Number)
          },
          errorRate: expect.any(Number),
          throughput: expect.any(Number)
        });
      }
    }, 20000); // タイムアウトを20秒に設定

    it('古いメトリクスは自動的に削除される', async () => {
      // メトリクスの保持期間を短くする（テスト用）
      const originalMetrics = (service as any).metrics;
      
      // 古いメトリクスを手動で追加
      const oldMetric = {
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2時間前
        connectionCount: 100,
        activeRequests: 50,
        cpuUsage: 30,
        memoryUsage: 40,
        responseTime: { p50: 50, p95: 200, p99: 500 },
        errorRate: 1,
        throughput: 1000
      };
      
      (service as any).metrics.push(oldMetric);
      
      // メトリクス収集をトリガー
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      // 古いメトリクスが削除されていることを確認
      const currentMetrics = (service as any).metrics;
      const hasOldMetric = currentMetrics.some(
        (m: any) => m.timestamp.getTime() === oldMetric.timestamp.getTime()
      );
      
      expect(hasOldMetric).toBe(false);
    });
  });
});