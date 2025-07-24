/**
 * AI-OS ヘルスチェックエンドポイント
 * システムの健全性を監視し、各コンポーネントの状態を報告
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import os from 'os';
import { promises as fs } from 'fs';
import path from 'path';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    [key: string]: ServiceHealth;
  };
  system: SystemHealth;
  agents?: AgentHealth[];
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  message?: string;
  details?: any;
}

interface SystemHealth {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

interface AgentHealth {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error';
  lastActivity: string;
  tasksProcessed: number;
  errorRate: number;
}

class HealthChecker {
  private db: Pool;
  private redis: Redis;
  private startTime: Date;

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
    this.startTime = new Date();
  }

  /**
   * 包括的なヘルスチェックを実行
   */
  async checkHealth(detailed: boolean = false): Promise<HealthStatus> {
    const services: { [key: string]: ServiceHealth } = {};
    
    // データベースチェック
    services.database = await this.checkDatabase();
    
    // Redisチェック
    services.redis = await this.checkRedis();
    
    // AIエージェントチェック
    services.aiAgents = await this.checkAIAgents();
    
    // 外部API接続チェック
    services.externalAPIs = await this.checkExternalAPIs();
    
    // ファイルシステムチェック
    services.fileSystem = await this.checkFileSystem();
    
    // 全体のステータスを判定
    const overallStatus = this.determineOverallStatus(services);
    
    // システムリソース情報を取得
    const systemHealth = await this.getSystemHealth();
    
    // レスポンスを構築
    const response: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      services,
      system: systemHealth,
    };
    
    // 詳細モードの場合はエージェント情報も含める
    if (detailed) {
      response.agents = await this.getAgentHealth();
    }
    
    return response;
  }

  /**
   * データベースの健全性をチェック
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    
    try {
      // 接続テスト
      const result = await this.db.query('SELECT 1');
      
      // レプリケーション遅延をチェック（もしあれば）
      const replicationLag = await this.checkReplicationLag();
      
      // アクティブな接続数をチェック
      const connectionCount = await this.getActiveConnections();
      
      const responseTime = Date.now() - start;
      
      return {
        status: replicationLag > 5000 ? 'degraded' : 'up',
        responseTime,
        details: {
          activeConnections: connectionCount,
          replicationLag: replicationLag,
          poolSize: this.db.totalCount,
          idleConnections: this.db.idleCount,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * Redisの健全性をチェック
   */
  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    
    try {
      // Ping test
      await this.redis.ping();
      
      // メモリ使用状況を取得
      const info = await this.redis.info('memory');
      const memoryUsage = this.parseRedisInfo(info);
      
      // 接続クライアント数を取得
      const clientInfo = await this.redis.info('clients');
      const connectedClients = this.parseRedisInfo(clientInfo);
      
      const responseTime = Date.now() - start;
      
      return {
        status: 'up',
        responseTime,
        details: {
          memoryUsed: memoryUsage.used_memory_human,
          memoryPeak: memoryUsage.used_memory_peak_human,
          connectedClients: connectedClients.connected_clients,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
        responseTime: Date.now() - start,
      };
    }
  }

  /**
   * AIエージェントの健全性をチェック
   */
  private async checkAIAgents(): Promise<ServiceHealth> {
    try {
      // エージェントの状態を確認
      const agents = await this.getAgentStatuses();
      const activeAgents = agents.filter(a => a.status === 'active').length;
      const errorAgents = agents.filter(a => a.status === 'error').length;
      
      if (errorAgents > agents.length * 0.5) {
        return {
          status: 'down',
          message: `${errorAgents}/${agents.length} agents in error state`,
        };
      } else if (errorAgents > 0) {
        return {
          status: 'degraded',
          message: `${errorAgents} agents in error state`,
          details: {
            total: agents.length,
            active: activeAgents,
            errors: errorAgents,
          },
        };
      }
      
      return {
        status: 'up',
        details: {
          total: agents.length,
          active: activeAgents,
        },
      };
    } catch (error) {
      return {
        status: 'down',
        message: error.message,
      };
    }
  }

  /**
   * 外部APIの接続性をチェック
   */
  private async checkExternalAPIs(): Promise<ServiceHealth> {
    const apis = [
      { name: 'freee', url: process.env.FREEE_API_ENDPOINT },
      { name: 'moneyforward', url: process.env.MONEYFORWARD_API_ENDPOINT },
    ];
    
    const results = await Promise.allSettled(
      apis.map(async (api) => {
        if (!api.url) return { name: api.name, status: 'skipped' };
        
        const start = Date.now();
        try {
          const response = await fetch(`${api.url}/health`, {
            method: 'GET',
            timeout: 5000,
          });
          
          return {
            name: api.name,
            status: response.ok ? 'up' : 'down',
            responseTime: Date.now() - start,
          };
        } catch (error) {
          return {
            name: api.name,
            status: 'down',
            error: error.message,
          };
        }
      })
    );
    
    const failures = results.filter(
      r => r.status === 'fulfilled' && r.value.status === 'down'
    ).length;
    
    return {
      status: failures === 0 ? 'up' : failures < apis.length ? 'degraded' : 'down',
      details: results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean),
    };
  }

  /**
   * ファイルシステムの健全性をチェック
   */
  private async checkFileSystem(): Promise<ServiceHealth> {
    try {
      const testFile = path.join(os.tmpdir(), 'health-check-test.txt');
      
      // 書き込みテスト
      await fs.writeFile(testFile, 'health check test');
      
      // 読み込みテスト
      await fs.readFile(testFile);
      
      // 削除テスト
      await fs.unlink(testFile);
      
      return {
        status: 'up',
      };
    } catch (error) {
      return {
        status: 'down',
        message: `File system error: ${error.message}`,
      };
    }
  }

  /**
   * システムリソース情報を取得
   */
  private async getSystemHealth(): Promise<SystemHealth> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // CPU使用率を計算
    const cpuUsage = this.calculateCPUUsage(cpus);
    
    // ディスク使用状況（簡易版）
    const diskUsage = await this.getDiskUsage();
    
    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
      },
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
      },
      disk: diskUsage,
    };
  }

  /**
   * CPU使用率を計算
   */
  private calculateCPUUsage(cpus: os.CpuInfo[]): number {
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return usage;
  }

  /**
   * ディスク使用状況を取得（プラットフォーム依存）
   */
  private async getDiskUsage(): Promise<{ used: number; total: number; percentage: number }> {
    // 実装は環境によって異なるため、ここでは仮の値を返す
    // 実際の実装では、df コマンドや Windows API を使用
    return {
      used: 50 * 1024 * 1024 * 1024, // 50GB
      total: 100 * 1024 * 1024 * 1024, // 100GB
      percentage: 50,
    };
  }

  /**
   * レプリケーション遅延をチェック
   */
  private async checkReplicationLag(): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) * 1000 as lag_ms
      `);
      return result.rows[0]?.lag_ms || 0;
    } catch {
      return 0;
    }
  }

  /**
   * アクティブな接続数を取得
   */
  private async getActiveConnections(): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT count(*) FROM pg_stat_activity 
        WHERE state = 'active' AND datname = current_database()
      `);
      return parseInt(result.rows[0].count);
    } catch {
      return 0;
    }
  }

  /**
   * エージェントの状態を取得
   */
  private async getAgentStatuses(): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT id, name, status, last_activity 
        FROM ai_agents 
        WHERE enabled = true
      `);
      return result.rows;
    } catch {
      return [];
    }
  }

  /**
   * エージェントの詳細な健全性情報を取得
   */
  private async getAgentHealth(): Promise<AgentHealth[]> {
    try {
      const result = await this.db.query(`
        SELECT 
          a.id,
          a.name,
          a.status,
          a.last_activity,
          COUNT(t.id) as tasks_processed,
          AVG(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as error_rate
        FROM ai_agents a
        LEFT JOIN agent_tasks t ON a.id = t.agent_id 
          AND t.created_at > NOW() - INTERVAL '1 hour'
        WHERE a.enabled = true
        GROUP BY a.id, a.name, a.status, a.last_activity
      `);
      
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        status: row.status,
        lastActivity: row.last_activity,
        tasksProcessed: parseInt(row.tasks_processed),
        errorRate: parseFloat(row.error_rate) || 0,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Redis情報をパース
   */
  private parseRedisInfo(info: string): any {
    const result: any = {};
    info.split('\r\n').forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key] = value;
      }
    });
    return result;
  }

  /**
   * 全体のステータスを判定
   */
  private determineOverallStatus(services: { [key: string]: ServiceHealth }): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(services).map(s => s.status);
    
    if (statuses.includes('down')) {
      // 重要なサービスがダウンしている場合
      if (services.database?.status === 'down' || services.redis?.status === 'down') {
        return 'unhealthy';
      }
      return 'degraded';
    }
    
    if (statuses.includes('degraded')) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}

// ヘルスチェックエンドポイントの設定
export function setupHealthCheck(db: Pool, redis: Redis): Router {
  const healthChecker = new HealthChecker(db, redis);

  /**
   * 基本的なヘルスチェック（ロードバランサー用）
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await healthChecker.checkHealth(false);
      
      const statusCode = health.status === 'healthy' ? 200 :
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        message: 'Health check failed',
        error: error.message,
      });
    }
  });

  /**
   * 詳細なヘルスチェック（監視システム用）
   */
  router.get('/health/detailed', async (req: Request, res: Response) => {
    try {
      const health = await healthChecker.checkHealth(true);
      res.json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        message: 'Detailed health check failed',
        error: error.message,
      });
    }
  });

  /**
   * 生存確認エンドポイント（最小限のチェック）
   */
  router.get('/ping', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * レディネスチェック（Kubernetes用）
   */
  router.get('/ready', async (req: Request, res: Response) => {
    try {
      // データベースとRedisの接続確認のみ
      await db.query('SELECT 1');
      await redis.ping();
      
      res.status(200).json({ ready: true });
    } catch (error) {
      res.status(503).json({ 
        ready: false,
        error: error.message,
      });
    }
  });

  return router;
}

export default router;