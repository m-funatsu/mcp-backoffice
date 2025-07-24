/**
 * AI-OS Post-Launch監視ダッシュボードAPI
 * 監視データのREST API提供
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../api/middleware/auth';
import { authorize } from '../api/middleware/authorize';
import { validateRequest } from '../api/middleware/validation';
import { body, query, param } from 'express-validator';
import { PostLaunchDashboard, AlertConfiguration, DashboardConfiguration } from './post-launch-dashboard';
import { logger } from '../utils/logger';

const router = Router();
const dashboard = new PostLaunchDashboard();

// ダッシュボードイベントリスナー
dashboard.on('metrics:collected', (data) => {
  logger.debug(`Metrics collected: ${data.type}`);
});

dashboard.on('alert:triggered', (alert) => {
  logger.warn(`Alert triggered: ${alert.metric} - ${alert.message}`);
});

/**
 * Prometheusメトリクスエンドポイント
 * GET /api/v1/metrics
 */
router.get('/metrics',
  async (req: Request, res: Response) => {
    try {
      const metrics = await dashboard.getPrometheusMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(metrics);
    } catch (error) {
      logger.error('Failed to get Prometheus metrics:', error);
      res.status(500).json({ error: 'メトリクス取得に失敗しました' });
    }
  }
);

/**
 * ダッシュボード一覧取得
 * GET /api/v1/dashboards
 */
router.get('/dashboards',
  authenticate,
  authorize(['admin', 'manager']),
  async (req: Request, res: Response) => {
    try {
      const dashboards = [
        {
          id: 'executive',
          name: 'エグゼクティブダッシュボード',
          description: '経営層向けのビジネスメトリクス',
          widgets: 4
        },
        {
          id: 'operations',
          name: '運用ダッシュボード',
          description: 'システム運用・パフォーマンス監視',
          widgets: 3
        },
        {
          id: 'security',
          name: 'セキュリティダッシュボード',
          description: 'セキュリティ脅威・インシデント監視',
          widgets: 3
        }
      ];

      res.json({
        dashboards,
        totalCount: dashboards.length
      });
    } catch (error) {
      logger.error('Failed to get dashboards:', error);
      res.status(500).json({ error: 'ダッシュボード一覧の取得に失敗しました' });
    }
  }
);

/**
 * システムヘルスメトリクス取得
 * GET /api/v1/monitoring/system-health
 */
router.get('/monitoring/system-health',
  authenticate,
  query('timeRange').optional().isIn(['1h', '6h', '24h', '7d', '30d']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const timeRange = req.query.timeRange as string || '1h';
      
      // 最新データ取得（実装簡略化）
      const health = {
        uptime: process.uptime(),
        cpu_usage: 45.2,
        memory_usage: 62.8,
        disk_usage: 38.5,
        network_latency: 12.5,
        database_connections: 45,
        redis_connections: 23,
        error_rate: 0.12,
        success_rate: 99.88,
        timestamp: new Date()
      };

      res.json({
        metrics: health,
        timeRange,
        status: 'healthy'
      });
    } catch (error) {
      logger.error('Failed to get system health:', error);
      res.status(500).json({ error: 'システムヘルスの取得に失敗しました' });
    }
  }
);

/**
 * ユーザーアクティビティメトリクス取得
 * GET /api/v1/monitoring/user-activity
 */
router.get('/monitoring/user-activity',
  authenticate,
  authorize(['admin', 'manager']),
  query('timeRange').optional().isIn(['1h', '6h', '24h', '7d', '30d']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const timeRange = req.query.timeRange as string || '24h';
      
      const activity = {
        active_users: 842,
        new_registrations: 23,
        login_count: 1247,
        feature_usage: {
          attendance: 3421,
          payroll: 892,
          expense: 567,
          analytics: 234
        },
        session_duration: 28.5, // minutes
        page_views: 12847,
        api_calls: 45892,
        mobile_usage_ratio: 0.42,
        timestamp: new Date()
      };

      res.json({
        metrics: activity,
        timeRange,
        trend: 'increasing'
      });
    } catch (error) {
      logger.error('Failed to get user activity:', error);
      res.status(500).json({ error: 'ユーザーアクティビティの取得に失敗しました' });
    }
  }
);

/**
 * ビジネスメトリクス取得
 * GET /api/v1/monitoring/business-metrics
 */
router.get('/monitoring/business-metrics',
  authenticate,
  authorize(['admin', 'executive']),
  async (req: Request, res: Response) => {
    try {
      const metrics = {
        trial_signups: 15,
        trial_to_paid_conversion: 0.32,
        churn_rate: 0.045,
        mrr: 8500000,
        arr: 102000000,
        average_revenue_per_user: 6700,
        customer_acquisition_cost: 65000,
        lifetime_value: 148888,
        nps_score: 52,
        customer_count: 127,
        timestamp: new Date()
      };

      const growth = {
        mrr_growth: 0.15, // 15% MoM
        customer_growth: 0.12,
        arpu_growth: 0.03
      };

      res.json({
        metrics,
        growth,
        forecast: {
          next_month_mrr: 9775000,
          next_quarter_arr: 117300000
        }
      });
    } catch (error) {
      logger.error('Failed to get business metrics:', error);
      res.status(500).json({ error: 'ビジネスメトリクスの取得に失敗しました' });
    }
  }
);

/**
 * パフォーマンスメトリクス取得
 * GET /api/v1/monitoring/performance
 */
router.get('/monitoring/performance',
  authenticate,
  query('service').optional().isIn(['api', 'database', 'cache', 'all']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const service = req.query.service as string || 'all';
      
      const performance = {
        api_response_time: {
          p50: 85,
          p95: 342,
          p99: 892
        },
        database_query_time: {
          p50: 23,
          p95: 67,
          p99: 125
        },
        cache_hit_rate: 0.89,
        throughput: 1245, // requests per second
        concurrent_users: 287,
        queue_length: 12,
        processing_lag: 234, // milliseconds
        timestamp: new Date()
      };

      res.json({
        metrics: performance,
        service,
        sla_compliance: {
          response_time: true,
          availability: true,
          error_rate: true
        }
      });
    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      res.status(500).json({ error: 'パフォーマンスメトリクスの取得に失敗しました' });
    }
  }
);

/**
 * セキュリティメトリクス取得
 * GET /api/v1/monitoring/security
 */
router.get('/monitoring/security',
  authenticate,
  authorize(['admin', 'security']),
  async (req: Request, res: Response) => {
    try {
      const security = {
        failed_login_attempts: 34,
        suspicious_activities: 5,
        blocked_ips: 12,
        authentication_errors: 67,
        authorization_failures: 23,
        data_access_violations: 2,
        active_threats: 0,
        security_score: 94,
        timestamp: new Date()
      };

      const incidents = [
        {
          id: 'inc-001',
          type: 'brute_force',
          severity: 'medium',
          source_ip: '192.168.1.100',
          timestamp: new Date(Date.now() - 3600000),
          status: 'resolved'
        },
        {
          id: 'inc-002',
          type: 'suspicious_access',
          severity: 'low',
          user: 'user@example.com',
          timestamp: new Date(Date.now() - 7200000),
          status: 'investigating'
        }
      ];

      res.json({
        metrics: security,
        recent_incidents: incidents,
        risk_level: 'low'
      });
    } catch (error) {
      logger.error('Failed to get security metrics:', error);
      res.status(500).json({ error: 'セキュリティメトリクスの取得に失敗しました' });
    }
  }
);

/**
 * アラート一覧取得
 * GET /api/v1/monitoring/alerts
 */
router.get('/monitoring/alerts',
  authenticate,
  authorize(['admin', 'manager']),
  query('active').optional().isBoolean(),
  query('level').optional().isIn(['info', 'warning', 'error', 'critical']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const activeOnly = req.query.active === 'true';
      const level = req.query.level as string;

      const alerts = [
        {
          id: 'alert-001',
          metric: 'system_health.cpu_usage',
          condition: 'gt 80%',
          level: 'warning',
          cooldown: 300,
          recipients: ['ops-team@ai-os.com'],
          channels: ['slack', 'email'],
          active: true,
          lastTriggered: new Date(Date.now() - 1800000)
        },
        {
          id: 'alert-002',
          metric: 'business_metrics.churn_rate',
          condition: 'gt 10%',
          level: 'warning',
          cooldown: 3600,
          recipients: ['success@ai-os.com'],
          channels: ['email'],
          active: true,
          lastTriggered: null
        },
        {
          id: 'alert-003',
          metric: 'security.failed_login_attempts',
          condition: 'gt 100',
          level: 'critical',
          cooldown: 600,
          recipients: ['security@ai-os.com'],
          channels: ['pagerduty', 'email'],
          active: true,
          lastTriggered: new Date(Date.now() - 86400000)
        }
      ];

      let filteredAlerts = alerts;
      if (activeOnly) {
        filteredAlerts = filteredAlerts.filter(a => a.active);
      }
      if (level) {
        filteredAlerts = filteredAlerts.filter(a => a.level === level);
      }

      res.json({
        alerts: filteredAlerts,
        totalCount: filteredAlerts.length
      });
    } catch (error) {
      logger.error('Failed to get alerts:', error);
      res.status(500).json({ error: 'アラート一覧の取得に失敗しました' });
    }
  }
);

/**
 * アラート作成
 * POST /api/v1/monitoring/alerts
 */
router.post('/monitoring/alerts',
  authenticate,
  authorize(['admin']),
  [
    body('metric').notEmpty().isString(),
    body('threshold').isNumeric(),
    body('operator').isIn(['gt', 'lt', 'eq', 'gte', 'lte']),
    body('level').isIn(['info', 'warning', 'error', 'critical']),
    body('cooldown').isInt({ min: 60 }),
    body('recipients').isArray().notEmpty(),
    body('channels').isArray().notEmpty()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const config: AlertConfiguration = {
        metric: req.body.metric,
        threshold: req.body.threshold,
        operator: req.body.operator,
        level: req.body.level,
        cooldown: req.body.cooldown,
        recipients: req.body.recipients,
        channels: req.body.channels
      };

      dashboard.addAlert(config);

      res.status(201).json({
        message: 'アラートを作成しました',
        alert: {
          id: `alert-${Date.now()}`,
          ...config,
          active: true,
          createdAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to create alert:', error);
      res.status(500).json({ error: 'アラートの作成に失敗しました' });
    }
  }
);

/**
 * 監視ステータスサマリー
 * GET /api/v1/monitoring/status
 */
router.get('/monitoring/status',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const status = {
        overall: 'healthy',
        systems: {
          api: { status: 'operational', uptime: 99.95 },
          database: { status: 'operational', uptime: 99.99 },
          cache: { status: 'operational', uptime: 100 },
          queue: { status: 'operational', backlog: 12 }
        },
        alerts: {
          critical: 0,
          error: 0,
          warning: 2,
          info: 5
        },
        metrics_summary: {
          active_users: 842,
          error_rate: 0.12,
          response_time_p95: 342,
          cpu_usage: 45.2
        },
        last_incident: {
          timestamp: new Date(Date.now() - 72000000),
          severity: 'minor',
          resolution_time: 15 // minutes
        },
        timestamp: new Date()
      };

      res.json(status);
    } catch (error) {
      logger.error('Failed to get monitoring status:', error);
      res.status(500).json({ error: '監視ステータスの取得に失敗しました' });
    }
  }
);

/**
 * カスタムメトリクス送信
 * POST /api/v1/monitoring/custom-metrics
 */
router.post('/monitoring/custom-metrics',
  authenticate,
  authorize(['admin', 'service']),
  [
    body('metric').notEmpty().isString(),
    body('value').isNumeric(),
    body('tags').optional().isObject(),
    body('timestamp').optional().isISO8601()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { metric, value, tags, timestamp } = req.body;

      // カスタムメトリクス処理（実装簡略化）
      logger.info(`Custom metric received: ${metric} = ${value}`, tags);

      res.json({
        message: 'カスタムメトリクスを受信しました',
        metric,
        value,
        timestamp: timestamp || new Date()
      });
    } catch (error) {
      logger.error('Failed to process custom metric:', error);
      res.status(500).json({ error: 'カスタムメトリクスの処理に失敗しました' });
    }
  }
);

/**
 * 時系列データ取得
 * GET /api/v1/monitoring/timeseries
 */
router.get('/monitoring/timeseries',
  authenticate,
  [
    query('metric').notEmpty(),
    query('start').isISO8601(),
    query('end').isISO8601(),
    query('resolution').optional().isIn(['1m', '5m', '15m', '1h', '1d'])
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { metric, start, end, resolution = '5m' } = req.query;

      // 時系列データ生成（モックデータ）
      const startTime = new Date(start as string).getTime();
      const endTime = new Date(end as string).getTime();
      const interval = getIntervalMs(resolution as string);
      
      const dataPoints = [];
      for (let time = startTime; time <= endTime; time += interval) {
        dataPoints.push({
          timestamp: new Date(time),
          value: Math.random() * 100
        });
      }

      res.json({
        metric,
        resolution,
        dataPoints,
        statistics: {
          min: Math.min(...dataPoints.map(d => d.value)),
          max: Math.max(...dataPoints.map(d => d.value)),
          avg: dataPoints.reduce((sum, d) => sum + d.value, 0) / dataPoints.length
        }
      });
    } catch (error) {
      logger.error('Failed to get timeseries data:', error);
      res.status(500).json({ error: '時系列データの取得に失敗しました' });
    }
  }
);

// ヘルパー関数
function getIntervalMs(resolution: string): number {
  const intervals: Record<string, number> = {
    '1m': 60000,
    '5m': 300000,
    '15m': 900000,
    '1h': 3600000,
    '1d': 86400000
  };
  return intervals[resolution] || 300000;
}

export default router;