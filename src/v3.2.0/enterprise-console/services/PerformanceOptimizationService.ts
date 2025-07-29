/**
 * AI-OS v3.2.0 パフォーマンス最適化サービス
 * Performance Optimization Service
 * 
 * 1,000+同時接続での安定動作を実現する最適化機能
 */

import { EventEmitter } from 'events';
import * as WebSocket from 'ws';

// ===== 型定義 =====

export interface PerformanceMetrics {
  timestamp: Date;
  connectionCount: number;
  activeRequests: number;
  cpuUsage: number;
  memoryUsage: number;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number;
}

export interface ConnectionPool {
  id: string;
  type: 'websocket' | 'database' | 'cache' | 'api';
  maxConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingQueue: number;
  stats: PoolStatistics;
}

export interface PoolStatistics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageWaitTime: number;
  averageResponseTime: number;
  utilizationRate: number;
}

export interface BatchOperation {
  id: string;
  type: string;
  items: any[];
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  scheduledAt?: Date;
  processedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface CacheStrategy {
  key: string;
  ttl: number;
  strategy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  maxSize: number;
  warmupEnabled: boolean;
  compressionEnabled: boolean;
}

export interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'least-connections' | 'weighted' | 'ip-hash';
  healthCheckInterval: number;
  failoverThreshold: number;
  stickySession: boolean;
}

export interface OptimizationRule {
  id: string;
  name: string;
  condition: OptimizationCondition;
  action: OptimizationAction;
  enabled: boolean;
  priority: number;
}

export interface OptimizationCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  duration?: number; // 条件が継続する時間（ミリ秒）
}

export interface OptimizationAction {
  type: 'scale' | 'cache' | 'throttle' | 'circuit-break' | 'batch';
  parameters: Record<string, any>;
}

// ===== コネクションプール管理 =====

class ConnectionPoolManager {
  private pools: Map<string, ConnectionPool>;
  private waitQueues: Map<string, Array<{
    resolve: (connection: any) => void;
    reject: (error: any) => void;
    timestamp: number;
  }>>;

  constructor() {
    this.pools = new Map();
    this.waitQueues = new Map();
    this.initializePools();
  }

  private initializePools(): void {
    // WebSocketプール
    this.createPool('websocket_main', {
      type: 'websocket',
      maxConnections: 1000,
      idleTimeout: 300000 // 5分
    });

    // データベースプール
    this.createPool('database_primary', {
      type: 'database',
      maxConnections: 100,
      idleTimeout: 60000 // 1分
    });

    // キャッシュプール
    this.createPool('cache_redis', {
      type: 'cache',
      maxConnections: 50,
      idleTimeout: 120000 // 2分
    });
  }

  createPool(poolId: string, config: any): void {
    const pool: ConnectionPool = {
      id: poolId,
      type: config.type,
      maxConnections: config.maxConnections,
      activeConnections: 0,
      idleConnections: 0,
      waitingQueue: 0,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageWaitTime: 0,
        averageResponseTime: 0,
        utilizationRate: 0
      }
    };

    this.pools.set(poolId, pool);
    this.waitQueues.set(poolId, []);
  }

  async acquireConnection(poolId: string): Promise<any> {
    const pool = this.pools.get(poolId);
    if (!pool) {
      throw new Error(`Pool ${poolId} not found`);
    }

    // 利用可能な接続がある場合
    if (pool.idleConnections > 0) {
      pool.idleConnections--;
      pool.activeConnections++;
      pool.stats.totalRequests++;
      return this.createConnection(pool.type);
    }

    // 最大接続数に達していない場合
    if (pool.activeConnections < pool.maxConnections) {
      pool.activeConnections++;
      pool.stats.totalRequests++;
      return this.createConnection(pool.type);
    }

    // 待機キューに追加
    return new Promise((resolve, reject) => {
      const queue = this.waitQueues.get(poolId)!;
      queue.push({ resolve, reject, timestamp: Date.now() });
      pool.waitingQueue = queue.length;

      // タイムアウト設定（30秒）
      setTimeout(() => {
        const index = queue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          queue.splice(index, 1);
          pool.waitingQueue = queue.length;
          reject(new Error('Connection acquisition timeout'));
        }
      }, 30000);
    });
  }

  releaseConnection(poolId: string, connection: any): void {
    const pool = this.pools.get(poolId);
    if (!pool) return;

    pool.activeConnections--;
    
    // 待機中のリクエストがある場合
    const queue = this.waitQueues.get(poolId)!;
    if (queue.length > 0) {
      const waiting = queue.shift()!;
      pool.waitingQueue = queue.length;
      pool.activeConnections++;
      
      const waitTime = Date.now() - waiting.timestamp;
      this.updateWaitTimeStats(pool, waitTime);
      
      waiting.resolve(connection);
    } else {
      // アイドル接続として保持
      pool.idleConnections++;
      
      // アイドルタイムアウトの設定
      setTimeout(() => {
        if (pool.idleConnections > 0) {
          pool.idleConnections--;
          this.destroyConnection(connection);
        }
      }, 60000); // 1分後に破棄
    }
  }

  private createConnection(type: string): any {
    // 実際の接続作成ロジック（簡略化）
    switch (type) {
      case 'websocket':
        return { type, id: Math.random().toString(36) };
      case 'database':
        return { type, id: Math.random().toString(36) };
      case 'cache':
        return { type, id: Math.random().toString(36) };
      default:
        return { type, id: Math.random().toString(36) };
    }
  }

  private destroyConnection(connection: any): void {
    // 接続のクリーンアップ
    if (connection.close) {
      connection.close();
    }
  }

  private updateWaitTimeStats(pool: ConnectionPool, waitTime: number): void {
    const stats = pool.stats;
    const totalWaitTime = stats.averageWaitTime * stats.totalRequests;
    stats.averageWaitTime = (totalWaitTime + waitTime) / (stats.totalRequests + 1);
  }

  getPoolStats(poolId: string): ConnectionPool | undefined {
    return this.pools.get(poolId);
  }

  getAllPoolStats(): ConnectionPool[] {
    return Array.from(this.pools.values());
  }
}

// ===== バッチ処理マネージャー =====

class BatchProcessor {
  private batches: Map<string, BatchOperation[]>;
  private processors: Map<string, (items: any[]) => Promise<any>>;
  private timers: Map<string, NodeJS.Timeout>;
  private config: Map<string, { maxSize: number; maxWait: number }>;

  constructor() {
    this.batches = new Map();
    this.processors = new Map();
    this.timers = new Map();
    this.config = new Map();
    
    this.initializeProcessors();
  }

  private initializeProcessors(): void {
    // 設定変更バッチ処理
    this.registerProcessor('config_update', async (items) => {
      // 複数の設定変更を一括処理
      const updates = items.map(item => item.data);
      return this.bulkUpdateConfig(updates);
    }, { maxSize: 100, maxWait: 1000 });

    // 監査ログバッチ処理
    this.registerProcessor('audit_log', async (items) => {
      const logs = items.map(item => item.data);
      return this.bulkWriteAuditLogs(logs);
    }, { maxSize: 500, maxWait: 5000 });

    // 通知バッチ処理
    this.registerProcessor('notification', async (items) => {
      const notifications = items.map(item => item.data);
      return this.bulkSendNotifications(notifications);
    }, { maxSize: 200, maxWait: 2000 });
  }

  registerProcessor(
    type: string,
    processor: (items: any[]) => Promise<any>,
    config: { maxSize: number; maxWait: number }
  ): void {
    this.processors.set(type, processor);
    this.config.set(type, config);
    this.batches.set(type, []);
  }

  async add(type: string, data: any, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const batch: BatchOperation = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      items: [data],
      priority,
      createdAt: new Date(),
      status: 'pending'
    };

    let batches = this.batches.get(type) || [];
    batches.push(batch);
    this.batches.set(type, batches);

    const config = this.config.get(type);
    if (!config) return;

    // 高優先度の場合は即座に処理
    if (priority === 'high') {
      await this.processBatch(type);
      return;
    }

    // バッチサイズに達した場合
    const totalItems = batches.reduce((sum, b) => sum + b.items.length, 0);
    if (totalItems >= config.maxSize) {
      await this.processBatch(type);
      return;
    }

    // タイマーの設定
    if (!this.timers.has(type)) {
      const timer = setTimeout(() => {
        this.processBatch(type);
      }, config.maxWait);
      
      this.timers.set(type, timer);
    }
  }

  private async processBatch(type: string): Promise<void> {
    const processor = this.processors.get(type);
    const batches = this.batches.get(type);
    
    if (!processor || !batches || batches.length === 0) return;

    // タイマーのクリア
    const timer = this.timers.get(type);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(type);
    }

    // バッチの取得とクリア
    const currentBatches = [...batches];
    this.batches.set(type, []);

    // 優先度順にソート
    currentBatches.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // 全アイテムの収集
    const allItems = currentBatches.flatMap(b => b.items);

    try {
      // バッチ処理の実行
      await processor(allItems);
      
      // ステータス更新
      currentBatches.forEach(batch => {
        batch.status = 'completed';
        batch.processedAt = new Date();
      });
    } catch (error) {
      // エラー処理
      currentBatches.forEach(batch => {
        batch.status = 'failed';
      });
      
      throw error;
    }
  }

  private async bulkUpdateConfig(updates: any[]): Promise<void> {
    // 実際の一括更新処理
    console.log(`Bulk updating ${updates.length} config items`);
  }

  private async bulkWriteAuditLogs(logs: any[]): Promise<void> {
    // 実際の一括書き込み処理
    console.log(`Bulk writing ${logs.length} audit logs`);
  }

  private async bulkSendNotifications(notifications: any[]): Promise<void> {
    // 実際の一括送信処理
    console.log(`Bulk sending ${notifications.length} notifications`);
  }
}

// ===== キャッシュ戦略マネージャー =====

class CacheManager {
  private caches: Map<string, Cache>;
  private strategies: Map<string, CacheStrategy>;
  
  constructor() {
    this.caches = new Map();
    this.strategies = new Map();
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // 設定キャッシュ
    this.createCache('config', {
      strategy: 'lru',
      maxSize: 1000,
      ttl: 300000, // 5分
      warmupEnabled: true,
      compressionEnabled: false
    });

    // ユーザーセッションキャッシュ
    this.createCache('session', {
      strategy: 'lru',
      maxSize: 10000,
      ttl: 3600000, // 1時間
      warmupEnabled: false,
      compressionEnabled: true
    });

    // 権限キャッシュ
    this.createCache('permission', {
      strategy: 'lfu',
      maxSize: 5000,
      ttl: 600000, // 10分
      warmupEnabled: true,
      compressionEnabled: false
    });
  }

  createCache(key: string, strategy: Omit<CacheStrategy, 'key'>): void {
    const fullStrategy: CacheStrategy = { key, ...strategy };
    this.strategies.set(key, fullStrategy);
    
    const cache = new Cache(fullStrategy);
    this.caches.set(key, cache);
    
    if (strategy.warmupEnabled) {
      this.warmupCache(key);
    }
  }

  async get(cacheKey: string, key: string): Promise<any> {
    const cache = this.caches.get(cacheKey);
    if (!cache) return null;
    
    return cache.get(key);
  }

  async set(cacheKey: string, key: string, value: any, ttl?: number): Promise<void> {
    const cache = this.caches.get(cacheKey);
    if (!cache) return;
    
    cache.set(key, value, ttl);
  }

  async invalidate(cacheKey: string, key?: string): Promise<void> {
    const cache = this.caches.get(cacheKey);
    if (!cache) return;
    
    if (key) {
      cache.delete(key);
    } else {
      cache.clear();
    }
  }

  private async warmupCache(cacheKey: string): Promise<void> {
    // キャッシュのウォームアップ処理
    console.log(`Warming up cache: ${cacheKey}`);
    
    // 実際の実装では、頻繁にアクセスされるデータを事前にロード
  }

  getCacheStats(cacheKey: string): any {
    const cache = this.caches.get(cacheKey);
    if (!cache) return null;
    
    return cache.getStats();
  }
}

// キャッシュ実装
class Cache {
  private strategy: CacheStrategy;
  private store: Map<string, CacheEntry>;
  private accessCount: Map<string, number>;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(strategy: CacheStrategy) {
    this.strategy = strategy;
    this.store = new Map();
    this.accessCount = new Map();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  get(key: string): any {
    const entry = this.store.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // TTLチェック
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    // アクセスカウント更新
    this.updateAccessCount(key);
    
    this.stats.hits++;
    return entry.value;
  }

  set(key: string, value: any, ttl?: number): void {
    // サイズ制限チェック
    if (this.store.size >= this.strategy.maxSize) {
      this.evict();
    }

    const entry: CacheEntry = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : Date.now() + this.strategy.ttl
    };

    // 圧縮が有効な場合
    if (this.strategy.compressionEnabled) {
      entry.value = this.compress(value);
    }

    this.store.set(key, entry);
    this.updateAccessCount(key);
  }

  delete(key: string): boolean {
    this.accessCount.delete(key);
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.accessCount.clear();
  }

  private evict(): void {
    let keyToEvict: string | null = null;

    switch (this.strategy.strategy) {
      case 'lru':
        // 最も最近使われていないものを削除
        let oldestTime = Date.now();
        this.store.forEach((entry, key) => {
          const lastAccess = this.accessCount.get(key) || 0;
          if (lastAccess < oldestTime) {
            oldestTime = lastAccess;
            keyToEvict = key;
          }
        });
        break;

      case 'lfu':
        // 最も使用頻度が低いものを削除
        let minCount = Infinity;
        this.accessCount.forEach((count, key) => {
          if (count < minCount) {
            minCount = count;
            keyToEvict = key;
          }
        });
        break;

      case 'fifo':
        // 最も古いものを削除
        keyToEvict = this.store.keys().next().value;
        break;

      case 'ttl':
        // 期限切れのものを優先的に削除
        this.store.forEach((entry, key) => {
          if (entry.expiresAt && entry.expiresAt < Date.now()) {
            keyToEvict = key;
          }
        });
        break;
    }

    if (keyToEvict) {
      this.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  private updateAccessCount(key: string): void {
    const count = this.accessCount.get(key) || 0;
    this.accessCount.set(key, count + 1);
  }

  private compress(value: any): any {
    // 実際の圧縮処理（簡略化）
    return JSON.stringify(value);
  }

  getStats(): any {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    
    return {
      ...this.stats,
      hitRate,
      size: this.store.size,
      maxSize: this.strategy.maxSize
    };
  }
}

interface CacheEntry {
  key: string;
  value: any;
  createdAt: number;
  expiresAt?: number;
}

// ===== メインサービスクラス =====

export class PerformanceOptimizationService extends EventEmitter {
  private connectionPoolManager: ConnectionPoolManager;
  private batchProcessor: BatchProcessor;
  private cacheManager: CacheManager;
  private metrics: PerformanceMetrics[];
  private optimizationRules: Map<string, OptimizationRule>;
  private loadBalancer: LoadBalancer;
  private circuitBreakers: Map<string, CircuitBreaker>;

  constructor() {
    super();
    this.connectionPoolManager = new ConnectionPoolManager();
    this.batchProcessor = new BatchProcessor();
    this.cacheManager = new CacheManager();
    this.metrics = [];
    this.optimizationRules = new Map();
    this.circuitBreakers = new Map();
    this.loadBalancer = new LoadBalancer();
    
    this.initializeOptimizationRules();
    this.startMetricsCollection();
  }

  /**
   * 最適化ルールの初期化
   */
  private initializeOptimizationRules(): void {
    // CPU使用率が高い場合のルール
    this.addOptimizationRule({
      name: 'High CPU Usage',
      condition: {
        metric: 'cpuUsage',
        operator: 'gt',
        threshold: 80,
        duration: 60000 // 1分間継続
      },
      action: {
        type: 'throttle',
        parameters: {
          requestsPerSecond: 100,
          burstSize: 200
        }
      },
      enabled: true,
      priority: 1
    });

    // レスポンスタイムが遅い場合のルール
    this.addOptimizationRule({
      name: 'Slow Response Time',
      condition: {
        metric: 'responseTime.p95',
        operator: 'gt',
        threshold: 1000, // 1秒
        duration: 30000 // 30秒継続
      },
      action: {
        type: 'cache',
        parameters: {
          aggressiveMode: true,
          ttlMultiplier: 2
        }
      },
      enabled: true,
      priority: 2
    });

    // 接続数が多い場合のルール
    this.addOptimizationRule({
      name: 'High Connection Count',
      condition: {
        metric: 'connectionCount',
        operator: 'gt',
        threshold: 800,
        duration: 0 // 即座に
      },
      action: {
        type: 'scale',
        parameters: {
          scaleUp: true,
          instances: 2
        }
      },
      enabled: true,
      priority: 3
    });
  }

  /**
   * メトリクス収集の開始
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      const metrics = this.collectMetrics();
      this.metrics.push(metrics);
      
      // 古いメトリクスの削除（1時間分保持）
      const oneHourAgo = Date.now() - 3600000;
      this.metrics = this.metrics.filter(m => 
        m.timestamp.getTime() > oneHourAgo
      );

      // 最適化ルールの評価
      this.evaluateOptimizationRules(metrics);
      
      this.emit('metrics:collected', metrics);
    }, 5000); // 5秒ごと
  }

  /**
   * メトリクスの収集
   */
  private collectMetrics(): PerformanceMetrics {
    const pools = this.connectionPoolManager.getAllPoolStats();
    const connectionCount = pools.reduce((sum, pool) => 
      sum + pool.activeConnections, 0
    );

    return {
      timestamp: new Date(),
      connectionCount,
      activeRequests: Math.floor(Math.random() * 100), // 実際の実装では実際の値
      cpuUsage: this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      responseTime: this.getResponseTimePercentiles(),
      errorRate: this.getErrorRate(),
      throughput: this.getThroughput()
    };
  }

  /**
   * CPU使用率の取得（シミュレーション）
   */
  private getCPUUsage(): number {
    // 実際の実装ではOSのAPIを使用
    return 30 + Math.random() * 40;
  }

  /**
   * メモリ使用率の取得
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    const total = require('os').totalmem();
    return (used.heapUsed / total) * 100;
  }

  /**
   * レスポンスタイムのパーセンタイル取得
   */
  private getResponseTimePercentiles(): { p50: number; p95: number; p99: number } {
    // 実際の実装では実測値から計算
    return {
      p50: 50 + Math.random() * 100,
      p95: 200 + Math.random() * 300,
      p99: 500 + Math.random() * 500
    };
  }

  /**
   * エラー率の取得
   */
  private getErrorRate(): number {
    // 実際の実装では実際のエラー数から計算
    return Math.random() * 5;
  }

  /**
   * スループットの取得
   */
  private getThroughput(): number {
    // 実際の実装では処理されたリクエスト数から計算
    return 1000 + Math.random() * 500;
  }

  /**
   * 最適化ルールの評価
   */
  private evaluateOptimizationRules(metrics: PerformanceMetrics): void {
    for (const rule of this.optimizationRules.values()) {
      if (!rule.enabled) continue;

      const shouldTrigger = this.evaluateCondition(rule.condition, metrics);
      
      if (shouldTrigger) {
        this.executeOptimizationAction(rule.action, metrics);
        this.emit('optimization:triggered', { rule, metrics });
      }
    }
  }

  /**
   * 条件の評価
   */
  private evaluateCondition(
    condition: OptimizationCondition,
    metrics: PerformanceMetrics
  ): boolean {
    const value = this.getMetricValue(condition.metric, metrics);
    
    let result = false;
    switch (condition.operator) {
      case 'gt':
        result = value > condition.threshold;
        break;
      case 'lt':
        result = value < condition.threshold;
        break;
      case 'gte':
        result = value >= condition.threshold;
        break;
      case 'lte':
        result = value <= condition.threshold;
        break;
      case 'eq':
        result = value === condition.threshold;
        break;
    }

    // 継続時間のチェック
    if (result && condition.duration && condition.duration > 0) {
      // 簡略化: 実際は過去のメトリクスをチェック
      return true;
    }

    return result;
  }

  /**
   * メトリクス値の取得
   */
  private getMetricValue(metric: string, metrics: PerformanceMetrics): number {
    const parts = metric.split('.');
    let value: any = metrics;
    
    for (const part of parts) {
      value = value[part];
      if (value === undefined) return 0;
    }
    
    return Number(value);
  }

  /**
   * 最適化アクションの実行
   */
  private executeOptimizationAction(
    action: OptimizationAction,
    metrics: PerformanceMetrics
  ): void {
    switch (action.type) {
      case 'scale':
        this.executeScaleAction(action.parameters);
        break;
      case 'cache':
        this.executeCacheAction(action.parameters);
        break;
      case 'throttle':
        this.executeThrottleAction(action.parameters);
        break;
      case 'circuit-break':
        this.executeCircuitBreakAction(action.parameters);
        break;
      case 'batch':
        this.executeBatchAction(action.parameters);
        break;
    }
  }

  /**
   * スケーリングアクションの実行
   */
  private executeScaleAction(parameters: any): void {
    const { scaleUp, instances } = parameters;
    
    if (scaleUp) {
      // スケールアップの実行
      this.emit('scale:up', { instances });
    } else {
      // スケールダウンの実行
      this.emit('scale:down', { instances });
    }
  }

  /**
   * キャッシュアクションの実行
   */
  private executeCacheAction(parameters: any): void {
    const { aggressiveMode, ttlMultiplier } = parameters;
    
    // キャッシュ戦略の調整
    if (aggressiveMode) {
      // より積極的なキャッシュ
      console.log('Enabling aggressive caching mode');
    }
  }

  /**
   * スロットリングアクションの実行
   */
  private executeThrottleAction(parameters: any): void {
    const { requestsPerSecond, burstSize } = parameters;
    
    // レート制限の適用
    this.emit('throttle:apply', { requestsPerSecond, burstSize });
  }

  /**
   * サーキットブレーカーアクションの実行
   */
  private executeCircuitBreakAction(parameters: any): void {
    const { service, threshold } = parameters;
    
    const breaker = this.getOrCreateCircuitBreaker(service);
    breaker.updateThreshold(threshold);
  }

  /**
   * バッチ処理アクションの実行
   */
  private executeBatchAction(parameters: any): void {
    const { batchSize, delay } = parameters;
    
    // バッチ処理の設定更新
    console.log(`Updating batch processing: size=${batchSize}, delay=${delay}`);
  }

  /**
   * 最適化ルールの追加
   */
  addOptimizationRule(rule: Omit<OptimizationRule, 'id'>): OptimizationRule {
    const fullRule: OptimizationRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.optimizationRules.set(fullRule.id, fullRule);
    return fullRule;
  }

  /**
   * WebSocket接続の取得（プール経由）
   */
  async getWebSocketConnection(): Promise<any> {
    return this.connectionPoolManager.acquireConnection('websocket_main');
  }

  /**
   * WebSocket接続の解放
   */
  releaseWebSocketConnection(connection: any): void {
    this.connectionPoolManager.releaseConnection('websocket_main', connection);
  }

  /**
   * バッチ処理への追加
   */
  async addToBatch(type: string, data: any, priority?: 'high' | 'medium' | 'low'): Promise<void> {
    return this.batchProcessor.add(type, data, priority);
  }

  /**
   * キャッシュの取得
   */
  async getCached(cacheKey: string, key: string): Promise<any> {
    return this.cacheManager.get(cacheKey, key);
  }

  /**
   * キャッシュの設定
   */
  async setCached(cacheKey: string, key: string, value: any, ttl?: number): Promise<void> {
    return this.cacheManager.set(cacheKey, key, value, ttl);
  }

  /**
   * サーキットブレーカーの取得または作成
   */
  private getOrCreateCircuitBreaker(service: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(service);
    
    if (!breaker) {
      breaker = new CircuitBreaker(service, {
        failureThreshold: 5,
        resetTimeout: 60000,
        requestTimeout: 5000
      });
      
      this.circuitBreakers.set(service, breaker);
    }
    
    return breaker;
  }

  /**
   * パフォーマンスレポートの生成
   */
  generatePerformanceReport(): any {
    const recentMetrics = this.metrics.slice(-12); // 直近1分間
    
    if (recentMetrics.length === 0) {
      return { error: 'No metrics available' };
    }

    const avgCPU = recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime.p95, 0) / recentMetrics.length;
    
    const poolStats = this.connectionPoolManager.getAllPoolStats();
    const cacheStats = {
      config: this.cacheManager.getCacheStats('config'),
      session: this.cacheManager.getCacheStats('session'),
      permission: this.cacheManager.getCacheStats('permission')
    };

    return {
      summary: {
        avgCPU: avgCPU.toFixed(2) + '%',
        avgMemory: avgMemory.toFixed(2) + '%',
        avgResponseTime: avgResponseTime.toFixed(0) + 'ms',
        currentConnections: poolStats.reduce((sum, p) => sum + p.activeConnections, 0)
      },
      pools: poolStats,
      caches: cacheStats,
      optimizationRules: Array.from(this.optimizationRules.values()).map(r => ({
        name: r.name,
        enabled: r.enabled,
        lastTriggered: null // 実装では実際の実行履歴を記録
      }))
    };
  }
}

// ===== サーキットブレーカー実装 =====

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open';
  private failureCount: number;
  private lastFailureTime?: Date;
  private config: {
    failureThreshold: number;
    resetTimeout: number;
    requestTimeout: number;
  };

  constructor(
    private service: string,
    config: {
      failureThreshold: number;
      resetTimeout: number;
      requestTimeout: number;
    }
  ) {
    this.state = 'closed';
    this.failureCount = 0;
    this.config = config;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker is open for service: ${this.service}`);
      }
    }

    try {
      const result = await this.executeWithTimeout(operation);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Operation timeout'));
      }, this.config.requestTimeout);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.resetTimeout;
  }

  updateThreshold(threshold: number): void {
    this.config.failureThreshold = threshold;
  }

  getState(): string {
    return this.state;
  }
}

// ===== ロードバランサー実装 =====

class LoadBalancer {
  private servers: Server[] = [];
  private currentIndex: number = 0;
  private algorithm: string = 'round-robin';

  addServer(server: Server): void {
    this.servers.push(server);
  }

  removeServer(serverId: string): void {
    this.servers = this.servers.filter(s => s.id !== serverId);
  }

  getNextServer(): Server | null {
    const healthyServers = this.servers.filter(s => s.healthy);
    
    if (healthyServers.length === 0) return null;

    switch (this.algorithm) {
      case 'round-robin':
        return this.roundRobin(healthyServers);
      case 'least-connections':
        return this.leastConnections(healthyServers);
      case 'weighted':
        return this.weighted(healthyServers);
      default:
        return healthyServers[0];
    }
  }

  private roundRobin(servers: Server[]): Server {
    const server = servers[this.currentIndex % servers.length];
    this.currentIndex++;
    return server;
  }

  private leastConnections(servers: Server[]): Server {
    return servers.reduce((min, server) => 
      server.activeConnections < min.activeConnections ? server : min
    );
  }

  private weighted(servers: Server[]): Server {
    const totalWeight = servers.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      random -= server.weight;
      if (random <= 0) return server;
    }
    
    return servers[0];
  }
}

interface Server {
  id: string;
  host: string;
  port: number;
  healthy: boolean;
  activeConnections: number;
  weight: number;
}