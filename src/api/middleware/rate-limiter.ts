/**
 * AI-OS APIレート制限ミドルウェア
 * プラン別のレート制限と使用量追跡を実装
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { logger } from '../../utils/logger';

// プラン別の制限設定
interface RateLimitConfig {
  points: number;        // 許可されるリクエスト数
  duration: number;      // 期間（秒）
  blockDuration: number; // ブロック期間（秒）
  execEvenly: boolean;   // 均等に分散して実行
}

// プラン定義
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    points: 100,           // 100リクエスト
    duration: 3600,        // 1時間あたり
    blockDuration: 3600,   // 1時間ブロック
    execEvenly: false
  },
  starter: {
    points: 1000,          // 1,000リクエスト
    duration: 3600,        // 1時間あたり
    blockDuration: 300,    // 5分ブロック
    execEvenly: false
  },
  professional: {
    points: 5000,          // 5,000リクエスト
    duration: 3600,        // 1時間あたり
    blockDuration: 60,     // 1分ブロック
    execEvenly: true
  },
  enterprise: {
    points: 50000,         // 50,000リクエスト
    duration: 3600,        // 1時間あたり
    blockDuration: 0,      // ブロックなし（ソフトリミット）
    execEvenly: true
  }
};

// エンドポイント別の重み設定
const ENDPOINT_WEIGHTS: Record<string, number> = {
  'GET:/api/v1/employees': 1,
  'POST:/api/v1/employees': 2,
  'GET:/api/v1/time-records': 1,
  'POST:/api/v1/time-records/clock': 1,
  'POST:/api/v1/payroll/calculate': 10,
  'POST:/api/v1/reports/generate': 5,
  'POST:/api/v1/ai/analyze': 20
};

// 使用量追跡
interface UsageData {
  requests: number;
  lastReset: Date;
  quotaUsed: number;
  quotaLimit: number;
}

export class RateLimiterMiddleware {
  private redisClient: Redis;
  private limiters: Map<string, RateLimiterRedis>;
  private usageTracker: Map<string, UsageData>;

  constructor(redisClient: Redis) {
    this.redisClient = redisClient;
    this.limiters = new Map();
    this.usageTracker = new Map();
    
    // 各プランのレート制限を初期化
    this.initializeRateLimiters();
  }

  private initializeRateLimiters() {
    for (const [plan, config] of Object.entries(RATE_LIMITS)) {
      const limiter = new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: `rate_limit:${plan}`,
        points: config.points,
        duration: config.duration,
        blockDuration: config.blockDuration,
        execEvenly: config.execEvenly,
        insuranceLimiter: new RateLimiterRedis({
          storeClient: this.redisClient,
          keyPrefix: `rate_limit:insurance:${plan}`,
          points: config.points * 2, // 保険として2倍の制限
          duration: config.duration,
          blockDuration: config.blockDuration
        })
      });
      
      this.limiters.set(plan, limiter);
    }
  }

  /**
   * レート制限チェックミドルウェア
   */
  public checkRateLimit = async (
    req: Request & { user?: any },
    res: Response,
    next: NextFunction
  ) => {
    try {
      // ユーザー認証チェック
      if (!req.user || !req.user.apiKey) {
        return res.status(401).json({
          error: 'API key required',
          code: 'UNAUTHORIZED'
        });
      }

      const apiKey = req.user.apiKey;
      const plan = req.user.plan || 'free';
      const userId = req.user.id;
      const endpoint = `${req.method}:${req.baseUrl}${req.path}`;

      // エンドポイントの重み取得
      const weight = this.getEndpointWeight(endpoint);

      // レート制限チェック
      const limiter = this.limiters.get(plan);
      if (!limiter) {
        logger.error(`Unknown plan: ${plan}`);
        return res.status(500).json({
          error: 'Internal server error',
          code: 'INVALID_PLAN'
        });
      }

      try {
        // レート制限消費
        const rateLimiterRes = await limiter.consume(apiKey, weight);
        
        // 使用量を記録
        await this.trackUsage(userId, plan, weight);
        
        // レスポンスヘッダーに制限情報を追加
        this.setRateLimitHeaders(res, rateLimiterRes, plan);
        
        next();
      } catch (rejRes) {
        if (rejRes instanceof RateLimiterRes) {
          // レート制限超過
          this.setRateLimitHeaders(res, rejRes, plan);
          
          // 使用量超過を記録
          await this.logRateLimitExceeded(userId, plan, endpoint);
          
          return res.status(429).json({
            error: 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.round(rejRes.msBeforeNext / 1000),
            limit: RATE_LIMITS[plan].points,
            remaining: rejRes.remainingPoints,
            reset: new Date(Date.now() + rejRes.msBeforeNext).toISOString()
          });
        }
        throw rejRes;
      }
    } catch (error) {
      logger.error('Rate limiter error:', error);
      // エラー時は通過させる（fail open）
      next();
    }
  };

  /**
   * エンドポイントの重み取得
   */
  private getEndpointWeight(endpoint: string): number {
    // 完全一致
    if (ENDPOINT_WEIGHTS[endpoint]) {
      return ENDPOINT_WEIGHTS[endpoint];
    }

    // パターンマッチング
    for (const [pattern, weight] of Object.entries(ENDPOINT_WEIGHTS)) {
      if (this.matchEndpoint(endpoint, pattern)) {
        return weight;
      }
    }

    // デフォルト重み
    return 1;
  }

  /**
   * エンドポイントパターンマッチング
   */
  private matchEndpoint(endpoint: string, pattern: string): boolean {
    // 簡単なワイルドカードマッチング
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\//g, '\\/')
      .replace(/:/g, '\\:');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(endpoint);
  }

  /**
   * レート制限ヘッダー設定
   */
  private setRateLimitHeaders(
    res: Response,
    rateLimiterRes: RateLimiterRes,
    plan: string
  ) {
    const limit = RATE_LIMITS[plan].points;
    const remaining = Math.max(0, rateLimiterRes.remainingPoints || 0);
    const reset = new Date(Date.now() + (rateLimiterRes.msBeforeNext || 0));

    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', reset.toISOString());
    res.setHeader('X-RateLimit-Policy', plan);
  }

  /**
   * 使用量追跡
   */
  private async trackUsage(userId: string, plan: string, points: number) {
    const key = `usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
    
    try {
      // 使用量をインクリメント
      await this.redisClient.hincrby(key, 'requests', 1);
      await this.redisClient.hincrby(key, 'points', points);
      
      // 有効期限を設定（30日）
      await this.redisClient.expire(key, 30 * 24 * 60 * 60);
      
      // 月次使用量も追跡
      const monthKey = `usage:monthly:${userId}:${new Date().toISOString().slice(0, 7)}`;
      await this.redisClient.hincrby(monthKey, 'requests', 1);
      await this.redisClient.hincrby(monthKey, 'points', points);
      await this.redisClient.expire(monthKey, 45 * 24 * 60 * 60);
    } catch (error) {
      logger.error('Failed to track usage:', error);
    }
  }

  /**
   * レート制限超過ログ
   */
  private async logRateLimitExceeded(
    userId: string,
    plan: string,
    endpoint: string
  ) {
    const log = {
      userId,
      plan,
      endpoint,
      timestamp: new Date(),
      type: 'rate_limit_exceeded'
    };

    try {
      await this.redisClient.lpush(
        'rate_limit_exceeded_logs',
        JSON.stringify(log)
      );
      
      // 最新1000件のみ保持
      await this.redisClient.ltrim('rate_limit_exceeded_logs', 0, 999);
    } catch (error) {
      logger.error('Failed to log rate limit exceeded:', error);
    }
  }

  /**
   * 使用量統計取得
   */
  public async getUsageStats(userId: string, period: 'daily' | 'monthly' = 'daily') {
    try {
      let key: string;
      if (period === 'daily') {
        key = `usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
      } else {
        key = `usage:monthly:${userId}:${new Date().toISOString().slice(0, 7)}`;
      }

      const usage = await this.redisClient.hgetall(key);
      
      return {
        requests: parseInt(usage.requests || '0'),
        points: parseInt(usage.points || '0'),
        period,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get usage stats:', error);
      return null;
    }
  }

  /**
   * 使用量リセット（管理者用）
   */
  public async resetUsage(userId: string) {
    try {
      const dailyKey = `usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
      const monthlyKey = `usage:monthly:${userId}:${new Date().toISOString().slice(0, 7)}`;
      
      await this.redisClient.del(dailyKey, monthlyKey);
      
      logger.info(`Reset usage for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to reset usage:', error);
      return false;
    }
  }

  /**
   * カスタムレート制限設定（エンタープライズ向け）
   */
  public async setCustomRateLimit(
    userId: string,
    customLimit: RateLimitConfig
  ) {
    try {
      const customLimiter = new RateLimiterRedis({
        storeClient: this.redisClient,
        keyPrefix: `rate_limit:custom:${userId}`,
        points: customLimit.points,
        duration: customLimit.duration,
        blockDuration: customLimit.blockDuration,
        execEvenly: customLimit.execEvenly
      });

      // カスタム設定を保存
      await this.redisClient.hset(
        'custom_rate_limits',
        userId,
        JSON.stringify(customLimit)
      );

      logger.info(`Set custom rate limit for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Failed to set custom rate limit:', error);
      return false;
    }
  }
}

/**
 * 使用量分析サービス
 */
export class UsageAnalyticsService {
  private redisClient: Redis;

  constructor(redisClient: Redis) {
    this.redisClient = redisClient;
  }

  /**
   * 使用量レポート生成
   */
  public async generateUsageReport(startDate: Date, endDate: Date) {
    const report = {
      period: {
        start: startDate,
        end: endDate
      },
      totalRequests: 0,
      totalPoints: 0,
      byPlan: {} as Record<string, any>,
      byEndpoint: {} as Record<string, number>,
      topUsers: [] as Array<{ userId: string; requests: number }>,
      rateLimitExceeded: 0
    };

    try {
      // 期間内の全ユーザーの使用量を集計
      const keys = await this.redisClient.keys('usage:*');
      
      for (const key of keys) {
        const usage = await this.redisClient.hgetall(key);
        report.totalRequests += parseInt(usage.requests || '0');
        report.totalPoints += parseInt(usage.points || '0');
      }

      // レート制限超過ログを分析
      const exceededLogs = await this.redisClient.lrange('rate_limit_exceeded_logs', 0, -1);
      report.rateLimitExceeded = exceededLogs.length;

      return report;
    } catch (error) {
      logger.error('Failed to generate usage report:', error);
      throw error;
    }
  }

  /**
   * 異常な使用パターン検出
   */
  public async detectAnomalousUsage(userId: string) {
    try {
      // 過去7日間の使用量を取得
      const usage = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = `usage:${userId}:${date.toISOString().slice(0, 10)}`;
        const dayUsage = await this.redisClient.hgetall(key);
        usage.push(parseInt(dayUsage.requests || '0'));
      }

      // 標準偏差を計算
      const mean = usage.reduce((a, b) => a + b, 0) / usage.length;
      const stdDev = Math.sqrt(
        usage.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / usage.length
      );

      // 今日の使用量が平均+3σを超えているか
      const today = usage[0];
      const isAnomalous = today > mean + 3 * stdDev;

      return {
        isAnomalous,
        todayUsage: today,
        averageUsage: mean,
        standardDeviation: stdDev
      };
    } catch (error) {
      logger.error('Failed to detect anomalous usage:', error);
      return null;
    }
  }
}

// エクスポート
export function createRateLimiter(redisClient: Redis) {
  return new RateLimiterMiddleware(redisClient);
}

export function createUsageAnalytics(redisClient: Redis) {
  return new UsageAnalyticsService(redisClient);
}