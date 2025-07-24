/**
 * AI-OS パフォーマンスモニタリングミドルウェア
 * リクエスト・レスポンスのパフォーマンス計測
 */

import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger';

// リクエスト拡張インターフェース
interface PerformanceRequest extends Request {
  performanceMetrics?: {
    startTime: number;
    startCPU?: NodeJS.CpuUsage;
    startMemory?: NodeJS.MemoryUsage;
    route?: string;
    method?: string;
  };
}

// レスポンス拡張インターフェース
interface PerformanceResponse extends Response {
  performanceMetrics?: {
    endTime?: number;
    duration?: number;
    statusCode?: number;
  };
}

// パフォーマンスモニター設定
export interface PerformanceMonitorConfig {
  enabled: boolean;
  sampleRate: number; // 0-1 (サンプリングレート)
  slowRequestThreshold: number; // ms
  detailedMetrics: boolean;
  excludePaths: string[];
}

/**
 * パフォーマンスモニタリングミドルウェア
 */
export class PerformanceMonitor {
  private redis: Redis;
  private config: PerformanceMonitorConfig;
  private requestCounter: number = 0;
  private errorCounter: number = 0;

  constructor(config?: Partial<PerformanceMonitorConfig>) {
    this.config = {
      enabled: true,
      sampleRate: 1.0,
      slowRequestThreshold: 1000,
      detailedMetrics: true,
      excludePaths: ['/health', '/metrics', '/api/v1/performance/metrics'],
      ...config
    };

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });
  }

  /**
   * リクエスト開始時の処理
   */
  public startMonitoring(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: PerformanceRequest, res: PerformanceResponse, next: NextFunction) => {
      // 除外パスチェック
      if (this.isExcludedPath(req.path)) {
        return next();
      }

      // サンプリングチェック
      if (!this.shouldSample()) {
        return next();
      }

      // メトリクス開始
      req.performanceMetrics = {
        startTime: performance.now(),
        route: req.route?.path || req.path,
        method: req.method
      };

      if (this.config.detailedMetrics) {
        req.performanceMetrics.startCPU = process.cpuUsage();
        req.performanceMetrics.startMemory = process.memoryUsage();
      }

      // レスポンス終了時の処理
      const originalEnd = res.end;
      res.end = (...args: any[]): any => {
        this.endMonitoring(req, res);
        return originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * リクエスト終了時の処理
   */
  private endMonitoring(req: PerformanceRequest, res: PerformanceResponse): void {
    if (!req.performanceMetrics) return;

    const endTime = performance.now();
    const duration = endTime - req.performanceMetrics.startTime;

    // メトリクス収集
    const metrics = {
      timestamp: new Date(),
      method: req.performanceMetrics.method,
      route: req.performanceMetrics.route,
      statusCode: res.statusCode,
      duration: Math.round(duration),
      slow: duration > this.config.slowRequestThreshold,
      error: res.statusCode >= 400
    };

    // 詳細メトリクス
    if (this.config.detailedMetrics && req.performanceMetrics.startCPU) {
      const endCPU = process.cpuUsage(req.performanceMetrics.startCPU);
      const endMemory = process.memoryUsage();
      
      Object.assign(metrics, {
        cpuUser: endCPU.user / 1000, // マイクロ秒からミリ秒に変換
        cpuSystem: endCPU.system / 1000,
        memoryDelta: endMemory.heapUsed - (req.performanceMetrics.startMemory?.heapUsed || 0)
      });
    }

    // メトリクス記録
    this.recordMetrics(metrics);

    // スロークエリログ
    if (metrics.slow) {
      logger.warn('Slow request detected', {
        ...metrics,
        url: req.url,
        userAgent: req.headers['user-agent']
      });
    }
  }

  /**
   * メトリクス記録
   */
  private async recordMetrics(metrics: any): Promise<void> {
    try {
      const key = `perf:${metrics.method}:${metrics.route}`;
      
      // レスポンスタイム記録
      await this.redis.zadd('response_times', metrics.duration, `${key}:${Date.now()}`);
      
      // スループット更新
      await this.redis.incr('request_count');
      
      // エラー率更新
      if (metrics.error) {
        await this.redis.incr('error_count');
        this.errorCounter++;
      }
      
      // 統計情報更新
      await this.updateStatistics(metrics);
      
      // リアルタイムメトリクス配信
      await this.publishMetrics(metrics);

    } catch (error) {
      logger.error('Failed to record performance metrics:', error);
    }
  }

  /**
   * 統計情報更新
   */
  private async updateStatistics(metrics: any): Promise<void> {
    const statsKey = `stats:${metrics.method}:${metrics.route}`;
    
    await this.redis.hincrby(statsKey, 'count', 1);
    await this.redis.hincrby(statsKey, 'totalTime', metrics.duration);
    
    if (metrics.slow) {
      await this.redis.hincrby(statsKey, 'slowCount', 1);
    }
    
    if (metrics.error) {
      await this.redis.hincrby(statsKey, 'errorCount', 1);
    }
    
    // 有効期限設定（24時間）
    await this.redis.expire(statsKey, 86400);
  }

  /**
   * リアルタイムメトリクス配信
   */
  private async publishMetrics(metrics: any): Promise<void> {
    await this.redis.publish('performance_metrics', JSON.stringify(metrics));
  }

  /**
   * スロークエリミドルウェア
   */
  public slowQueryLogger(): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // データベースクエリフック（実装簡略化）
      const originalQuery = (global as any).dbQuery;
      (global as any).dbQuery = async (sql: string, params: any[]) => {
        const queryStart = Date.now();
        const result = await originalQuery(sql, params);
        const queryTime = Date.now() - queryStart;
        
        if (queryTime > this.config.slowRequestThreshold) {
          await this.redis.incr('slow_queries');
          logger.warn('Slow database query', {
            sql: sql.substring(0, 100),
            duration: queryTime,
            route: req.route?.path
          });
        }
        
        return result;
      };
      
      next();
    };
  }

  /**
   * メモリ使用量モニター
   */
  public memoryMonitor(): void {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const metrics = {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };

      // 高メモリ使用率警告
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      if (heapUsagePercent > 85) {
        logger.warn('High memory usage detected', {
          ...metrics,
          heapUsagePercent: Math.round(heapUsagePercent)
        });
      }

      // メトリクス記録
      this.redis.hset('memory_metrics', {
        ...metrics,
        timestamp: Date.now()
      });

    }, 30000); // 30秒ごと
  }

  /**
   * CPU使用率モニター
   */
  public cpuMonitor(): void {
    let previousCPU = process.cpuUsage();
    
    setInterval(() => {
      const currentCPU = process.cpuUsage(previousCPU);
      const cpuPercent = ((currentCPU.user + currentCPU.system) / 1000000) * 100;

      if (cpuPercent > 80) {
        logger.warn('High CPU usage detected', {
          cpuPercent: Math.round(cpuPercent),
          user: currentCPU.user,
          system: currentCPU.system
        });
      }

      // メトリクス記録
      this.redis.hset('cpu_metrics', {
        percent: cpuPercent,
        user: currentCPU.user,
        system: currentCPU.system,
        timestamp: Date.now()
      });

      previousCPU = process.cpuUsage();
    }, 10000); // 10秒ごと
  }

  /**
   * エラーレートモニター
   */
  public errorRateMonitor(): (err: Error, req: Request, res: Response, next: NextFunction) => void {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      this.errorCounter++;
      
      // エラー詳細記録
      const errorMetrics = {
        timestamp: new Date(),
        error: err.message,
        stack: err.stack,
        route: req.route?.path || req.path,
        method: req.method,
        statusCode: res.statusCode || 500
      };

      // エラーログ
      logger.error('Request error', errorMetrics);

      // メトリクス更新
      this.redis.hincrby('error_metrics', err.constructor.name, 1);
      
      next(err);
    };
  }

  /**
   * パフォーマンス統計取得
   */
  public async getStatistics(): Promise<any> {
    const stats: any = {};
    
    // 全ルートの統計情報取得
    const keys = await this.redis.keys('stats:*');
    
    for (const key of keys) {
      const [, method, ...routeParts] = key.split(':');
      const route = routeParts.join(':');
      const data = await this.redis.hgetall(key);
      
      if (!stats[route]) {
        stats[route] = {};
      }
      
      stats[route][method] = {
        count: parseInt(data.count || '0'),
        averageTime: data.count ? parseInt(data.totalTime || '0') / parseInt(data.count) : 0,
        slowCount: parseInt(data.slowCount || '0'),
        errorCount: parseInt(data.errorCount || '0'),
        errorRate: data.count ? (parseInt(data.errorCount || '0') / parseInt(data.count)) * 100 : 0
      };
    }
    
    return stats;
  }

  /**
   * サンプリング判定
   */
  private shouldSample(): boolean {
    return Math.random() <= this.config.sampleRate;
  }

  /**
   * 除外パス判定
   */
  private isExcludedPath(path: string): boolean {
    return this.config.excludePaths.some(excluded => 
      path.startsWith(excluded)
    );
  }

  /**
   * クリーンアップ
   */
  public async cleanup(): Promise<void> {
    // 古いメトリクスデータの削除
    const cutoffTime = Date.now() - (86400000 * 7); // 7日前
    
    await this.redis.zremrangebyscore('response_times', 0, cutoffTime);
    
    // 接続クローズ
    await this.redis.quit();
  }
}

// シングルトンインスタンス
export const performanceMonitor = new PerformanceMonitor();

// Express ミドルウェアエクスポート
export const performanceMiddleware = performanceMonitor.startMonitoring();
export const slowQueryMiddleware = performanceMonitor.slowQueryLogger();
export const errorRateMiddleware = performanceMonitor.errorRateMonitor();