/**
 * AI-OS パフォーマンス最適化API
 * パフォーマンスメトリクス・最適化管理のREST API
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../api/middleware/auth';
import { authorize } from '../api/middleware/authorize';
import { validateRequest } from '../api/middleware/validation';
import { body, query, param } from 'express-validator';
import { PerformanceOptimizer, OptimizationType } from './performance-optimizer';
import { logger } from '../utils/logger';

const router = Router();
const optimizer = new PerformanceOptimizer();

// パフォーマンス最適化イベントリスナー
optimizer.on('bottlenecks:detected', (bottlenecks) => {
  logger.warn(`Performance bottlenecks detected: ${bottlenecks.length} issues`);
});

optimizer.on('optimization:completed', ({ optimizationId, optimization }) => {
  logger.info(`Optimization completed: ${optimization.title}`);
});

optimizer.on('autotuning:enabled', () => {
  logger.info('Auto-tuning has been enabled');
});

/**
 * 現在のパフォーマンスメトリクス取得
 * GET /api/v1/performance/metrics/current
 */
router.get('/metrics/current',
  authenticate,
  authorize(['admin', 'manager']),
  async (req: Request, res: Response) => {
    try {
      const metrics = await optimizer.getCurrentMetrics();
      
      res.json({
        metrics,
        timestamp: new Date(),
        health: optimizer.calculateHealthScore(metrics)
      });
    } catch (error) {
      logger.error('Failed to get current metrics:', error);
      res.status(500).json({ error: 'メトリクスの取得に失敗しました' });
    }
  }
);

/**
 * パフォーマンス履歴取得
 * GET /api/v1/performance/metrics/history
 */
router.get('/metrics/history',
  authenticate,
  authorize(['admin', 'manager']),
  [
    query('startTime').optional().isISO8601(),
    query('endTime').optional().isISO8601(),
    query('resolution').optional().isIn(['1m', '5m', '15m', '1h', '1d']),
    query('metricType').optional().isIn(['response_time', 'throughput', 'cpu', 'memory', 'cache'])
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const startTime = req.query.startTime 
        ? new Date(req.query.startTime as string) 
        : new Date(Date.now() - 86400000); // 24時間前
      const endTime = req.query.endTime 
        ? new Date(req.query.endTime as string) 
        : new Date();
      const resolution = req.query.resolution as string || '5m';
      const metricType = req.query.metricType as string;

      const history = await optimizer.getMetricsHistory({
        startTime,
        endTime,
        resolution,
        metricType
      });

      res.json({
        history,
        period: { start: startTime, end: endTime },
        resolution,
        dataPoints: history.length
      });
    } catch (error) {
      logger.error('Failed to get metrics history:', error);
      res.status(500).json({ error: 'メトリクス履歴の取得に失敗しました' });
    }
  }
);

/**
 * ボトルネック分析実行
 * POST /api/v1/performance/analyze/bottlenecks
 */
router.post('/analyze/bottlenecks',
  authenticate,
  authorize(['admin']),
  async (req: Request, res: Response) => {
    try {
      const bottlenecks = await optimizer.analyzeCurrentBottlenecks();
      
      res.json({
        bottlenecks,
        totalIssues: bottlenecks.length,
        criticalIssues: bottlenecks.filter(b => b.severity === 'critical').length,
        recommendations: bottlenecks.reduce((acc, b) => acc + b.recommendations.length, 0)
      });
    } catch (error) {
      logger.error('Failed to analyze bottlenecks:', error);
      res.status(500).json({ error: 'ボトルネック分析に失敗しました' });
    }
  }
);

/**
 * 最適化推奨一覧取得
 * GET /api/v1/performance/recommendations
 */
router.get('/recommendations',
  authenticate,
  authorize(['admin', 'manager']),
  [
    query('type').optional().isIn(Object.values(OptimizationType)),
    query('minImprovement').optional().isInt({ min: 0, max: 100 }),
    query('maxEffort').optional().isIn(['low', 'medium', 'high'])
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const filters = {
        type: req.query.type as OptimizationType,
        minImprovement: parseInt(req.query.minImprovement as string) || 0,
        maxEffort: req.query.maxEffort as string
      };

      const recommendations = await optimizer.getRecommendations(filters);

      res.json({
        recommendations: recommendations.sort((a, b) => b.priority - a.priority),
        totalCount: recommendations.length,
        estimatedImprovement: recommendations.reduce((sum, r) => sum + r.expectedImprovement, 0) / recommendations.length
      });
    } catch (error) {
      logger.error('Failed to get recommendations:', error);
      res.status(500).json({ error: '最適化推奨の取得に失敗しました' });
    }
  }
);

/**
 * 最適化実行
 * POST /api/v1/performance/optimize/:optimizationId
 */
router.post('/optimize/:optimizationId',
  authenticate,
  authorize(['admin']),
  param('optimizationId').notEmpty(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { optimizationId } = req.params;
      
      // 最適化を非同期で実行
      optimizer.executeOptimization(optimizationId)
        .then(() => {
          logger.info(`Optimization ${optimizationId} completed successfully`);
        })
        .catch((error) => {
          logger.error(`Optimization ${optimizationId} failed:`, error);
        });

      res.status(202).json({
        message: '最適化処理を開始しました',
        optimizationId,
        status: 'started',
        estimatedDuration: '5-10分'
      });
    } catch (error) {
      logger.error('Failed to start optimization:', error);
      res.status(500).json({ error: '最適化の開始に失敗しました' });
    }
  }
);

/**
 * 最適化ステータス取得
 * GET /api/v1/performance/optimize/:optimizationId/status
 */
router.get('/optimize/:optimizationId/status',
  authenticate,
  authorize(['admin']),
  param('optimizationId').notEmpty(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { optimizationId } = req.params;
      const status = await optimizer.getOptimizationStatus(optimizationId);

      if (!status) {
        return res.status(404).json({ error: '最適化情報が見つかりません' });
      }

      res.json({
        optimizationId,
        status: status.status,
        startTime: status.startTime,
        endTime: status.endTime,
        duration: status.endTime ? status.endTime - status.startTime : null,
        error: status.error
      });
    } catch (error) {
      logger.error('Failed to get optimization status:', error);
      res.status(500).json({ error: 'ステータスの取得に失敗しました' });
    }
  }
);

/**
 * パフォーマンスプロファイル実行
 * POST /api/v1/performance/profile
 */
router.post('/profile',
  authenticate,
  authorize(['admin']),
  [
    body('duration').optional().isInt({ min: 5, max: 300 }),
    body('sampleRate').optional().isInt({ min: 10, max: 1000 })
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const duration = req.body.duration || 10; // seconds
      const sampleRate = req.body.sampleRate || 100; // ms

      // プロファイリングを非同期で実行
      const profilePromise = optimizer.runPerformanceProfile({ duration, sampleRate });

      res.status(202).json({
        message: 'プロファイリングを開始しました',
        duration: `${duration}秒`,
        sampleRate: `${sampleRate}ms`,
        estimatedCompletion: new Date(Date.now() + duration * 1000)
      });

      // プロファイル完了後の処理
      profilePromise.then(profile => {
        logger.info(`Performance profile completed: ${profile.id}`);
      }).catch(error => {
        logger.error('Performance profiling failed:', error);
      });

    } catch (error) {
      logger.error('Failed to start profiling:', error);
      res.status(500).json({ error: 'プロファイリングの開始に失敗しました' });
    }
  }
);

/**
 * プロファイル結果取得
 * GET /api/v1/performance/profile/:profileId
 */
router.get('/profile/:profileId',
  authenticate,
  authorize(['admin']),
  param('profileId').notEmpty(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { profileId } = req.params;
      const profile = await optimizer.getProfile(profileId);

      if (!profile) {
        return res.status(404).json({ error: 'プロファイル情報が見つかりません' });
      }

      res.json({
        profile: {
          id: profile.id,
          name: profile.name,
          timestamp: profile.timestamp,
          duration: profile.duration,
          sampleCount: profile.samples.length,
          hotspots: profile.hotspots.slice(0, 10), // Top 10
          memoryLeaks: profile.memoryLeaks,
          summary: {
            avgCPU: profile.samples.reduce((sum, s) => sum + s.cpu, 0) / profile.samples.length,
            peakMemory: Math.max(...profile.samples.map(s => s.memory))
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get profile:', error);
      res.status(500).json({ error: 'プロファイル結果の取得に失敗しました' });
    }
  }
);

/**
 * 自動チューニング設定
 * POST /api/v1/performance/auto-tuning
 */
router.post('/auto-tuning',
  authenticate,
  authorize(['admin']),
  [
    body('enabled').isBoolean(),
    body('aggressiveness').optional().isIn(['conservative', 'moderate', 'aggressive']),
    body('excludeTypes').optional().isArray()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { enabled, aggressiveness = 'moderate', excludeTypes = [] } = req.body;

      if (enabled) {
        optimizer.enableAutoTuning({
          aggressiveness,
          excludeTypes
        });
      } else {
        optimizer.disableAutoTuning();
      }

      res.json({
        message: `自動チューニングを${enabled ? '有効' : '無効'}にしました`,
        settings: {
          enabled,
          aggressiveness,
          excludeTypes
        }
      });
    } catch (error) {
      logger.error('Failed to configure auto-tuning:', error);
      res.status(500).json({ error: '自動チューニングの設定に失敗しました' });
    }
  }
);

/**
 * キャパシティプランニング分析
 * GET /api/v1/performance/capacity-planning
 */
router.get('/capacity-planning',
  authenticate,
  authorize(['admin', 'executive']),
  [
    query('horizon').optional().isIn(['1m', '3m', '6m', '1y']),
    query('growthRate').optional().isFloat({ min: 0, max: 100 })
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const horizon = req.query.horizon as string || '3m';
      const growthRate = parseFloat(req.query.growthRate as string) || 10;

      const planning = await optimizer.performCapacityPlanning({
        horizon,
        growthRate
      });

      res.json({
        planning: {
          currentCapacity: planning.currentCapacity,
          projectedDemand: planning.projectedDemand,
          utilizationRate: planning.utilizationRate,
          recommendations: {
            cpu: planning.recommendedResources.cpu,
            memory: planning.recommendedResources.memory,
            storage: planning.recommendedResources.storage,
            scaling: planning.scalingStrategy
          },
          costProjection: planning.costProjection,
          riskAssessment: planning.risks
        },
        assumptions: {
          horizon,
          growthRate: `${growthRate}%`
        }
      });
    } catch (error) {
      logger.error('Failed to perform capacity planning:', error);
      res.status(500).json({ error: 'キャパシティプランニング分析に失敗しました' });
    }
  }
);

/**
 * パフォーマンスレポート生成
 * POST /api/v1/performance/reports
 */
router.post('/reports',
  authenticate,
  authorize(['admin', 'manager']),
  [
    body('period').isIn(['daily', 'weekly', 'monthly']),
    body('includeDetails').optional().isBoolean(),
    body('recipients').optional().isArray()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { period, includeDetails = true, recipients = [] } = req.body;

      const report = await optimizer.generateReport({
        period,
        includeDetails,
        recipients
      });

      res.json({
        message: 'レポートを生成しました',
        report: {
          id: report.id,
          period,
          generatedAt: report.timestamp,
          summary: report.summary,
          downloadUrl: `/api/v1/performance/reports/${report.id}/download`
        }
      });
    } catch (error) {
      logger.error('Failed to generate report:', error);
      res.status(500).json({ error: 'レポート生成に失敗しました' });
    }
  }
);

/**
 * システムヘルススコア取得
 * GET /api/v1/performance/health-score
 */
router.get('/health-score',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const healthScore = await optimizer.calculateSystemHealth();
      
      res.json({
        score: healthScore.overall,
        components: {
          responseTime: healthScore.responseTime,
          availability: healthScore.availability,
          errorRate: healthScore.errorRate,
          resourceUtilization: healthScore.resourceUtilization
        },
        status: healthScore.overall >= 80 ? 'healthy' : healthScore.overall >= 60 ? 'warning' : 'critical',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to calculate health score:', error);
      res.status(500).json({ error: 'ヘルススコアの計算に失敗しました' });
    }
  }
);

/**
 * メトリクスアラート設定
 * POST /api/v1/performance/alerts
 */
router.post('/alerts',
  authenticate,
  authorize(['admin']),
  [
    body('metric').notEmpty(),
    body('threshold').isNumeric(),
    body('operator').isIn(['gt', 'lt', 'eq', 'gte', 'lte']),
    body('severity').isIn(['info', 'warning', 'error', 'critical']),
    body('recipients').isArray().notEmpty()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const alert = await optimizer.createAlert(req.body);

      res.status(201).json({
        message: 'アラートを作成しました',
        alert: {
          id: alert.id,
          metric: alert.metric,
          condition: `${alert.operator} ${alert.threshold}`,
          severity: alert.severity,
          active: true
        }
      });
    } catch (error) {
      logger.error('Failed to create alert:', error);
      res.status(500).json({ error: 'アラートの作成に失敗しました' });
    }
  }
);

export default router;