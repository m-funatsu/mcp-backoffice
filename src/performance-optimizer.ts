import { Pool } from 'pg';
import Redis from 'ioredis';
import pLimit from 'p-limit';

/**
 * パフォーマンス最適化ユーティリティ
 * システム全体のパフォーマンスを向上させるための各種最適化機能を提供
 */

// データベース接続プール設定
export interface DatabasePoolConfig {
  max: number;              // 最大接続数
  min: number;              // 最小接続数
  idleTimeoutMillis: number; // アイドルタイムアウト
  connectionTimeoutMillis: number; // 接続タイムアウト
  statementTimeout: number; // ステートメントタイムアウト
}

// キャッシュ戦略
export interface CacheStrategy {
  ttl: number;              // Time To Live (秒)
  maxSize: number;          // 最大キャッシュサイズ
  invalidationRules: string[]; // 無効化ルール
  warmupQueries?: string[]; // ウォームアップクエリ
}

export class PerformanceOptimizer {
  private dbPool: Pool;
  private redis: Redis;
  private queryCache: Map<string, { data: any; timestamp: number }>;
  private concurrencyLimit: ReturnType<typeof pLimit>;

  constructor(
    dbConfig: DatabasePoolConfig,
    redisUrl: string,
    maxConcurrency: number = 10
  ) {
    // データベース接続プール初期化
    this.dbPool = new Pool({
      max: dbConfig.max,
      min: dbConfig.min,
      idleTimeoutMillis: dbConfig.idleTimeoutMillis,
      connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
      statement_timeout: dbConfig.statementTimeout,
      query_timeout: dbConfig.statementTimeout,
    });

    // Redis接続初期化
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
    });

    // インメモリキャッシュ初期化
    this.queryCache = new Map();

    // 同時実行制限
    this.concurrencyLimit = pLimit(maxConcurrency);

    // 定期的なキャッシュクリーンアップ
    setInterval(() => this.cleanupCache(), 60000); // 1分ごと
  }

  /**
   * データベースクエリの最適化実行
   */
  async optimizedQuery<T>(
    query: string,
    params: any[] = [],
    cacheStrategy?: CacheStrategy
  ): Promise<T> {
    // キャッシュキー生成
    const cacheKey = this.generateCacheKey(query, params);

    // キャッシュチェック
    if (cacheStrategy) {
      const cachedResult = await this.getFromCache(cacheKey, cacheStrategy);
      if (cachedResult !== null) {
        return cachedResult;
      }
    }

    // クエリ実行
    const client = await this.dbPool.connect();
    try {
      const startTime = performance.now();
      const result = await client.query(query, params);
      const duration = performance.now() - startTime;

      // スロークエリログ
      if (duration > 1000) {
        console.warn(`Slow query detected (${duration.toFixed(2)}ms):`, query.substring(0, 100));
      }

      // キャッシュ保存
      if (cacheStrategy && result.rows) {
        await this.saveToCache(cacheKey, result.rows, cacheStrategy);
      }

      return result.rows as T;
    } finally {
      client.release();
    }
  }

  /**
   * バッチ処理の最適化
   */
  async optimizedBatchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    
    // バッチに分割
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // 並列処理（同時実行数制限付き）
      const batchResults = await Promise.all(
        batch.map(item => 
          this.concurrencyLimit(() => processor(item))
        )
      );
      
      results.push(...batchResults);
      
      // CPUに休憩を与える
      await new Promise(resolve => setImmediate(resolve));
    }
    
    return results;
  }

  /**
   * 複雑な集計クエリの最適化
   */
  async optimizedAggregation(
    baseTable: string,
    groupBy: string[],
    aggregations: { [key: string]: string },
    filters?: { [key: string]: any },
    usePartitioning: boolean = true
  ): Promise<any[]> {
    // パーティショニングを使用した効率的な集計
    let query = `
      WITH partitioned_data AS (
        SELECT 
          ${groupBy.join(', ')},
          ${Object.entries(aggregations).map(([alias, expr]) => `${expr} as ${alias}`).join(', ')},
          ROW_NUMBER() OVER (PARTITION BY ${groupBy.join(', ')} ORDER BY ${groupBy[0]}) as rn
        FROM ${baseTable}
        ${filters ? 'WHERE ' + Object.entries(filters).map(([key, value], i) => `${key} = $${i + 1}`).join(' AND ') : ''}
      )
      SELECT 
        ${groupBy.join(', ')},
        ${Object.keys(aggregations).join(', ')}
      FROM partitioned_data
      WHERE rn = 1
      GROUP BY ${groupBy.join(', ')}
    `;

    const params = filters ? Object.values(filters) : [];
    
    return this.optimizedQuery(query, params, {
      ttl: 300, // 5分キャッシュ
      maxSize: 1000,
      invalidationRules: [baseTable]
    });
  }

  /**
   * インデックスヒント付きクエリ
   */
  async queryWithIndexHint(
    table: string,
    indexName: string,
    conditions: { [key: string]: any },
    selectColumns: string[] = ['*']
  ): Promise<any[]> {
    const query = `
      SELECT ${selectColumns.join(', ')}
      FROM ${table} /*@ INDEX(${indexName}) */
      WHERE ${Object.keys(conditions).map((key, i) => `${key} = $${i + 1}`).join(' AND ')}
    `;
    
    return this.optimizedQuery(query, Object.values(conditions));
  }

  /**
   * 接続プールの状態監視
   */
  getPoolStats() {
    return {
      totalCount: this.dbPool.totalCount,
      idleCount: this.dbPool.idleCount,
      waitingCount: this.dbPool.waitingCount,
    };
  }

  /**
   * キャッシュ統計
   */
  getCacheStats() {
    return {
      memoryCache: {
        size: this.queryCache.size,
        hitRate: this.calculateHitRate(),
      },
      redis: {
        connected: this.redis.status === 'ready',
      }
    };
  }

  /**
   * パフォーマンスプロファイリング
   */
  async profileFunction<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; metrics: any }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    try {
      const result = await fn();
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      return {
        result,
        metrics: {
          name,
          duration: endTime - startTime,
          memoryDelta: {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            external: endMemory.external - startMemory.external,
          },
          timestamp: new Date().toISOString(),
        }
      };
    } catch (error) {
      const endTime = performance.now();
      
      return {
        result: null as any,
        metrics: {
          name,
          duration: endTime - startTime,
          error: error.message,
          timestamp: new Date().toISOString(),
        }
      };
    }
  }

  /**
   * 自動インデックス提案
   */
  async suggestIndexes(slowQueries: string[]): Promise<string[]> {
    const suggestions: string[] = [];
    
    for (const query of slowQueries) {
      // EXPLAIN ANALYZEを実行
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS) ${query}`;
      
      try {
        const result = await this.dbPool.query(explainQuery);
        const plan = result.rows.map(r => r['QUERY PLAN']).join('\n');
        
        // Seq Scanを検出
        if (plan.includes('Seq Scan')) {
          const tableMatch = plan.match(/Seq Scan on (\w+)/);
          if (tableMatch) {
            suggestions.push(`Consider adding index on table: ${tableMatch[1]}`);
          }
        }
        
        // Sort操作を検出
        if (plan.includes('Sort Method: external merge')) {
          suggestions.push('Consider increasing work_mem for better sort performance');
        }
        
        // Hash Joinの最適化
        if (plan.includes('Hash Join') && plan.includes('Batches: ') && !plan.includes('Batches: 1')) {
          suggestions.push('Consider increasing hash_mem_multiplier for better hash join performance');
        }
      } catch (error) {
        console.error('Error analyzing query:', error);
      }
    }
    
    return [...new Set(suggestions)];
  }

  /**
   * クエリ結果のストリーミング
   */
  async *streamQuery<T>(
    query: string,
    params: any[] = [],
    batchSize: number = 1000
  ): AsyncGenerator<T[], void, unknown> {
    const client = await this.dbPool.connect();
    
    try {
      const cursor = client.query(new (require('pg-cursor'))(query, params));
      
      while (true) {
        const rows = await new Promise<T[]>((resolve, reject) => {
          cursor.read(batchSize, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        
        if (rows.length === 0) break;
        
        yield rows;
      }
    } finally {
      client.release();
    }
  }

  // プライベートメソッド

  private generateCacheKey(query: string, params: any[]): string {
    return `query:${Buffer.from(query + JSON.stringify(params)).toString('base64')}`;
  }

  private async getFromCache(key: string, strategy: CacheStrategy): Promise<any | null> {
    // インメモリキャッシュチェック
    const memCached = this.queryCache.get(key);
    if (memCached && Date.now() - memCached.timestamp < strategy.ttl * 1000) {
      return memCached.data;
    }

    // Redisキャッシュチェック
    try {
      const redisCached = await this.redis.get(key);
      if (redisCached) {
        const data = JSON.parse(redisCached);
        // インメモリにも保存
        this.queryCache.set(key, { data, timestamp: Date.now() });
        return data;
      }
    } catch (error) {
      console.error('Redis cache error:', error);
    }

    return null;
  }

  private async saveToCache(key: string, data: any, strategy: CacheStrategy): Promise<void> {
    // インメモリキャッシュ保存
    if (this.queryCache.size >= strategy.maxSize) {
      // LRU: 最も古いエントリを削除
      const oldestKey = Array.from(this.queryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.queryCache.delete(oldestKey);
    }
    this.queryCache.set(key, { data, timestamp: Date.now() });

    // Redisキャッシュ保存
    try {
      await this.redis.setex(key, strategy.ttl, JSON.stringify(data));
    } catch (error) {
      console.error('Redis cache save error:', error);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      // 1時間以上古いエントリを削除
      if (now - value.timestamp > 3600000) {
        this.queryCache.delete(key);
      }
    }
  }

  private calculateHitRate(): number {
    // 実際の実装では、ヒット/ミスをトラッキングして計算
    return 0.85; // プレースホルダー
  }

  /**
   * クリーンアップ
   */
  async close(): Promise<void> {
    await this.dbPool.end();
    await this.redis.quit();
    this.queryCache.clear();
  }
}