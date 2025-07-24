/**
 * AI-OS 使用量管理API
 * APIの使用状況の確認と管理を行うエンドポイント
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { createUsageAnalytics } from '../middleware/rate-limiter';
import { redisClient } from '../../config/redis';
import { logger } from '../../utils/logger';

const router = Router();
const usageAnalytics = createUsageAnalytics(redisClient);

/**
 * 現在の使用量を取得
 * GET /api/v1/usage/current
 */
router.get('/current', authenticate, async (req: Request & { user?: any }, res: Response) => {
  try {
    const userId = req.user.id;
    const plan = req.user.plan || 'free';

    // 日次使用量
    const dailyKey = `usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const dailyUsage = await redisClient.hgetall(dailyKey);

    // 月次使用量
    const monthlyKey = `usage:monthly:${userId}:${new Date().toISOString().slice(0, 7)}`;
    const monthlyUsage = await redisClient.hgetall(monthlyKey);

    // プラン制限
    const planLimits = {
      free: { daily: 100, monthly: 3000 },
      starter: { daily: 1000, monthly: 30000 },
      professional: { daily: 5000, monthly: 150000 },
      enterprise: { daily: 50000, monthly: 1500000 }
    };

    const limits = planLimits[plan as keyof typeof planLimits] || planLimits.free;

    res.json({
      current: {
        daily: {
          requests: parseInt(dailyUsage.requests || '0'),
          points: parseInt(dailyUsage.points || '0'),
          limit: limits.daily,
          remaining: Math.max(0, limits.daily - parseInt(dailyUsage.points || '0')),
          resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        },
        monthly: {
          requests: parseInt(monthlyUsage.requests || '0'),
          points: parseInt(monthlyUsage.points || '0'),
          limit: limits.monthly,
          remaining: Math.max(0, limits.monthly - parseInt(monthlyUsage.points || '0')),
          resetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
        }
      },
      plan,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Failed to get current usage:', error);
    res.status(500).json({ error: 'Failed to retrieve usage data' });
  }
});

/**
 * 使用量履歴を取得
 * GET /api/v1/usage/history
 */
router.get('/history', authenticate, async (req: Request & { user?: any }, res: Response) => {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days as string) || 30;
    
    const history = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().slice(0, 10);
      const key = `usage:${userId}:${dateStr}`;
      
      const usage = await redisClient.hgetall(key);
      
      if (usage.requests || usage.points) {
        history.push({
          date: dateStr,
          requests: parseInt(usage.requests || '0'),
          points: parseInt(usage.points || '0')
        });
      }
    }
    
    res.json({
      history: history.reverse(),
      period: `${days} days`,
      totalRequests: history.reduce((sum, day) => sum + day.requests, 0),
      totalPoints: history.reduce((sum, day) => sum + day.points, 0)
    });
  } catch (error) {
    logger.error('Failed to get usage history:', error);
    res.status(500).json({ error: 'Failed to retrieve usage history' });
  }
});

/**
 * エンドポイント別使用量統計
 * GET /api/v1/usage/endpoints
 */
router.get('/endpoints', authenticate, async (req: Request & { user?: any }, res: Response) => {
  try {
    const userId = req.user.id;
    const period = req.query.period as string || 'daily';
    
    // エンドポイント別の使用量を取得（実装簡略化のためモックデータ）
    const endpointStats = {
      'GET /api/v1/employees': { requests: 234, points: 234 },
      'POST /api/v1/time-records/clock': { requests: 156, points: 156 },
      'GET /api/v1/payroll/payslips': { requests: 89, points: 89 },
      'POST /api/v1/payroll/calculate': { requests: 12, points: 120 },
      'POST /api/v1/reports/generate': { requests: 45, points: 225 }
    };
    
    const sortedEndpoints = Object.entries(endpointStats)
      .sort((a, b) => b[1].points - a[1].points)
      .map(([endpoint, stats]) => ({
        endpoint,
        ...stats,
        averageWeight: stats.points / stats.requests
      }));
    
    res.json({
      endpoints: sortedEndpoints,
      period,
      topEndpoint: sortedEndpoints[0]?.endpoint || null,
      totalEndpoints: sortedEndpoints.length
    });
  } catch (error) {
    logger.error('Failed to get endpoint statistics:', error);
    res.status(500).json({ error: 'Failed to retrieve endpoint statistics' });
  }
});

/**
 * 使用量アラート設定
 * POST /api/v1/usage/alerts
 */
router.post('/alerts', authenticate, async (req: Request & { user?: any }, res: Response) => {
  try {
    const userId = req.user.id;
    const { threshold, type, enabled } = req.body;
    
    // アラート設定を保存
    const alertConfig = {
      userId,
      threshold: threshold || 80, // デフォルト80%
      type: type || 'percentage', // percentage or absolute
      enabled: enabled !== false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await redisClient.hset(
      'usage_alerts',
      userId,
      JSON.stringify(alertConfig)
    );
    
    res.json({
      message: 'Alert configuration saved',
      config: alertConfig
    });
  } catch (error) {
    logger.error('Failed to set usage alerts:', error);
    res.status(500).json({ error: 'Failed to configure alerts' });
  }
});

/**
 * 使用量超過通知取得
 * GET /api/v1/usage/notifications
 */
router.get('/notifications', authenticate, async (req: Request & { user?: any }, res: Response) => {
  try {
    const userId = req.user.id;
    
    // 最近のレート制限超過ログを取得
    const logs = await redisClient.lrange('rate_limit_exceeded_logs', 0, 99);
    
    const userNotifications = logs
      .map(log => JSON.parse(log))
      .filter(log => log.userId === userId)
      .slice(0, 20)
      .map(log => ({
        timestamp: log.timestamp,
        endpoint: log.endpoint,
        plan: log.plan,
        type: 'rate_limit_exceeded'
      }));
    
    res.json({
      notifications: userNotifications,
      unreadCount: userNotifications.length,
      hasMore: userNotifications.length === 20
    });
  } catch (error) {
    logger.error('Failed to get notifications:', error);
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
});

/**
 * 管理者用: 全体の使用量統計
 * GET /api/v1/usage/admin/statistics
 */
router.get('/admin/statistics', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const startDate = new Date(req.query.startDate as string || new Date().setDate(new Date().getDate() - 30));
    const endDate = new Date(req.query.endDate as string || new Date());
    
    const report = await usageAnalytics.generateUsageReport(startDate, endDate);
    
    // プラン別の統計（モックデータ）
    const planStatistics = {
      free: { users: 1234, requests: 45678, revenue: 0 },
      starter: { users: 456, requests: 234567, revenue: 45600 },
      professional: { users: 123, requests: 567890, revenue: 61500 },
      enterprise: { users: 12, requests: 1234567, revenue: 120000 }
    };
    
    res.json({
      period: {
        start: startDate,
        end: endDate
      },
      overall: {
        totalRequests: report.totalRequests,
        totalPoints: report.totalPoints,
        rateLimitExceeded: report.rateLimitExceeded,
        averageRequestsPerUser: Math.round(report.totalRequests / 1825) // 仮の値
      },
      byPlan: planStatistics,
      trends: {
        requestsGrowth: '+12.5%',
        revenueGrowth: '+8.3%',
        userGrowth: '+5.2%'
      }
    });
  } catch (error) {
    logger.error('Failed to get admin statistics:', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

/**
 * 管理者用: 特定ユーザーの使用量リセット
 * POST /api/v1/usage/admin/reset/:userId
 */
router.post('/admin/reset/:userId', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // 日次と月次の使用量をリセット
    const dailyKey = `usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
    const monthlyKey = `usage:monthly:${userId}:${new Date().toISOString().slice(0, 7)}`;
    
    await redisClient.del(dailyKey, monthlyKey);
    
    // リセットログを記録
    await redisClient.lpush(
      'usage_reset_logs',
      JSON.stringify({
        userId,
        resetBy: (req as any).user.id,
        timestamp: new Date(),
        reason: req.body.reason || 'Manual reset'
      })
    );
    
    logger.info(`Usage reset for user ${userId} by admin ${(req as any).user.id}`);
    
    res.json({
      message: 'Usage reset successfully',
      userId,
      resetAt: new Date()
    });
  } catch (error) {
    logger.error('Failed to reset usage:', error);
    res.status(500).json({ error: 'Failed to reset usage' });
  }
});

/**
 * 管理者用: カスタムレート制限設定
 * PUT /api/v1/usage/admin/custom-limit/:userId
 */
router.put('/admin/custom-limit/:userId', authenticate, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { points, duration, blockDuration, execEvenly } = req.body;
    
    const customLimit = {
      points: points || 10000,
      duration: duration || 3600,
      blockDuration: blockDuration || 0,
      execEvenly: execEvenly || true,
      setBy: (req as any).user.id,
      setAt: new Date()
    };
    
    await redisClient.hset(
      'custom_rate_limits',
      userId,
      JSON.stringify(customLimit)
    );
    
    logger.info(`Custom rate limit set for user ${userId}`);
    
    res.json({
      message: 'Custom rate limit configured',
      userId,
      customLimit
    });
  } catch (error) {
    logger.error('Failed to set custom rate limit:', error);
    res.status(500).json({ error: 'Failed to configure custom rate limit' });
  }
});

/**
 * 異常使用パターン検出
 * GET /api/v1/usage/anomaly-detection
 */
router.get('/anomaly-detection', authenticate, async (req: Request & { user?: any }, res: Response) => {
  try {
    const userId = req.user.id;
    const anomalyData = await usageAnalytics.detectAnomalousUsage(userId);
    
    if (!anomalyData) {
      return res.status(500).json({ error: 'Failed to analyze usage patterns' });
    }
    
    res.json({
      analysis: {
        isAnomalous: anomalyData.isAnomalous,
        todayUsage: anomalyData.todayUsage,
        averageUsage: Math.round(anomalyData.averageUsage),
        standardDeviation: Math.round(anomalyData.standardDeviation),
        recommendation: anomalyData.isAnomalous 
          ? 'Your API usage today is significantly higher than usual. Please review your integration for any issues.'
          : 'Your API usage is within normal patterns.'
      },
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Failed to detect anomalous usage:', error);
    res.status(500).json({ error: 'Failed to analyze usage patterns' });
  }
});

export default router;