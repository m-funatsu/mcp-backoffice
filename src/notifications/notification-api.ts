/**
 * AI-OS 通知API
 * リアルタイム通知システムの管理・設定API
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../api/middleware/auth';
import { authorize } from '../api/middleware/authorize';
import { validateRequest } from '../api/middleware/validation';
import { body, query, param } from 'express-validator';
import {
  RealtimeNotificationSystem,
  NotificationType,
  DeliveryChannel,
  NotificationPriority,
  Notification,
  UserNotificationPreferences
} from './realtime-notification-system';
import { logger } from '../utils/logger';

const router = Router();
const notificationSystem = new RealtimeNotificationSystem(8080);

// 通知システムのイベントリスナー
notificationSystem.on('notification:queued', (notification) => {
  logger.info(`Notification queued for processing`, {
    id: notification.id,
    type: notification.type,
    targetCount: notification.targetUsers.length
  });
});

notificationSystem.on('notification:processed', ({ notification, results }) => {
  const successCount = results.filter(r => r.status === 'sent' || r.status === 'delivered').length;
  logger.info(`Notification processed`, {
    id: notification.id,
    successCount,
    totalCount: results.length
  });
});

/**
 * 通知送信
 * POST /api/v1/notifications/send
 */
router.post('/send',
  authenticate,
  authorize(['admin', 'hr_manager', 'system']),
  [
    body('type').isIn(Object.values(NotificationType)),
    body('priority').optional().isIn(Object.values(NotificationPriority)),
    body('title').notEmpty().isLength({ max: 200 }),
    body('message').notEmpty().isLength({ max: 2000 }),
    body('targetUsers').isArray().withMessage('targetUsers must be an array'),
    body('targetUsers.*').isString(),
    body('channels').isArray().withMessage('channels must be an array'),
    body('channels.*').isIn(Object.values(DeliveryChannel)),
    body('scheduling.scheduleType').optional().isIn(['immediate', 'delayed', 'recurring']),
    body('scheduling.delay').optional().isInt({ min: 0 }),
    body('actions').optional().isArray()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const notification: Notification = {
        id: require('uuid').v4(),
        type: req.body.type,
        priority: req.body.priority || NotificationPriority.NORMAL,
        title: req.body.title,
        message: req.body.message,
        data: req.body.data,
        targetUsers: req.body.targetUsers,
        targetRoles: req.body.targetRoles,
        targetOrganizations: req.body.targetOrganizations,
        channels: req.body.channels,
        scheduling: req.body.scheduling,
        personalization: req.body.personalization,
        actions: req.body.actions,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
        createdAt: new Date(),
        createdBy: req.user.id
      };

      await notificationSystem.sendNotification(notification);

      res.status(201).json({
        message: '通知を送信しました',
        notificationId: notification.id,
        estimatedDelivery: notification.scheduling?.scheduleType === 'delayed' 
          ? new Date(Date.now() + (notification.scheduling.delay || 0))
          : 'immediate'
      });
    } catch (error) {
      logger.error('Failed to send notification:', error);
      res.status(500).json({ error: '通知の送信に失敗しました' });
    }
  }
);

/**
 * テンプレート通知送信
 * POST /api/v1/notifications/send-template
 */
router.post('/send-template',
  authenticate,
  authorize(['admin', 'hr_manager', 'system']),
  [
    body('templateId').notEmpty(),
    body('variables').isObject(),
    body('targetUsers').isArray(),
    body('targetUsers.*').isString(),
    body('channels').optional().isArray(),
    body('priority').optional().isIn(Object.values(NotificationPriority))
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { templateId, variables, targetUsers, channels, priority, scheduling } = req.body;

      await notificationSystem.sendTemplateNotification(
        templateId,
        variables,
        targetUsers,
        { channels, priority, scheduling }
      );

      res.json({
        message: 'テンプレート通知を送信しました',
        templateId,
        targetCount: targetUsers.length
      });
    } catch (error) {
      logger.error('Failed to send template notification:', error);
      if (error instanceof Error && error.message.includes('Template not found')) {
        res.status(404).json({ error: 'テンプレートが見つかりません' });
      } else {
        res.status(500).json({ error: 'テンプレート通知の送信に失敗しました' });
      }
    }
  }
);

/**
 * 緊急通知送信（36協定違反など）
 * POST /api/v1/notifications/send-urgent
 */
router.post('/send-urgent',
  authenticate,
  authorize(['admin', 'hr_manager', 'compliance_officer']),
  [
    body('alertType').isIn(['overtime_violation', 'compliance_breach', 'system_critical']),
    body('employeeId').optional().isString(),
    body('details').isObject(),
    body('targetManagers').isArray()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { alertType, employeeId, details, targetManagers } = req.body;

      let templateId: string;
      let title: string;
      let variables: any;

      switch (alertType) {
        case 'overtime_violation':
          templateId = 'overtime-violation';
          title = '36協定違反アラート';
          variables = {
            employeeName: details.employeeName,
            currentOvertime: details.currentOvertime,
            overtimeLimit: details.overtimeLimit,
            remainingHours: details.remainingHours
          };
          break;

        case 'compliance_breach':
          title = 'コンプライアンス違反検出';
          variables = details;
          break;

        case 'system_critical':
          title = 'システム重大エラー';
          variables = details;
          break;

        default:
          return res.status(400).json({ error: '不正なアラートタイプです' });
      }

      if (templateId) {
        await notificationSystem.sendTemplateNotification(
          templateId,
          variables,
          targetManagers,
          {
            priority: NotificationPriority.CRITICAL,
            channels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL, DeliveryChannel.SLACK, DeliveryChannel.SMS]
          }
        );
      } else {
        await notificationSystem.sendNotification({
          id: require('uuid').v4(),
          type: NotificationType.URGENT,
          priority: NotificationPriority.CRITICAL,
          title,
          message: JSON.stringify(details, null, 2),
          targetUsers: targetManagers,
          channels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL, DeliveryChannel.SLACK],
          createdAt: new Date(),
          createdBy: req.user.id
        });
      }

      // 緊急通知ログ
      logger.error(`Urgent notification sent`, {
        alertType,
        employeeId,
        targetManagers,
        sentBy: req.user.id
      });

      res.json({
        message: '緊急通知を送信しました',
        alertType,
        targetCount: targetManagers.length,
        priority: 'CRITICAL'
      });
    } catch (error) {
      logger.error('Failed to send urgent notification:', error);
      res.status(500).json({ error: '緊急通知の送信に失敗しました' });
    }
  }
);

/**
 * ユーザー通知設定取得
 * GET /api/v1/notifications/preferences
 */
router.get('/preferences',
  authenticate,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const userId = req.user.id;
      // 実際の実装では、データベースから取得
      const preferences: UserNotificationPreferences = {
        userId,
        channels: {
          [DeliveryChannel.IN_APP]: true,
          [DeliveryChannel.EMAIL]: true,
          [DeliveryChannel.SLACK]: false,
          [DeliveryChannel.TEAMS]: false,
          [DeliveryChannel.SMS]: false,
          [DeliveryChannel.PUSH]: true
        },
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
          timezone: 'Asia/Tokyo'
        },
        typePreferences: {
          [NotificationType.INFO]: {
            enabled: true,
            channels: [DeliveryChannel.IN_APP],
            priority: NotificationPriority.LOW
          },
          [NotificationType.WARNING]: {
            enabled: true,
            channels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
            priority: NotificationPriority.NORMAL
          },
          [NotificationType.URGENT]: {
            enabled: true,
            channels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL, DeliveryChannel.SMS],
            priority: NotificationPriority.CRITICAL
          },
          [NotificationType.COMPLIANCE_ALERT]: {
            enabled: true,
            channels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
            priority: NotificationPriority.HIGH
          }
        },
        frequency: 'realtime',
        language: 'ja'
      };

      res.json({ preferences });
    } catch (error) {
      logger.error('Failed to get notification preferences:', error);
      res.status(500).json({ error: '通知設定の取得に失敗しました' });
    }
  }
);

/**
 * ユーザー通知設定更新
 * PUT /api/v1/notifications/preferences
 */
router.put('/preferences',
  authenticate,
  [
    body('channels').optional().isObject(),
    body('quietHours.enabled').optional().isBoolean(),
    body('quietHours.start').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('quietHours.end').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('quietHours.timezone').optional().isString(),
    body('frequency').optional().isIn(['realtime', 'batched', 'daily_digest']),
    body('language').optional().isIn(['ja', 'en'])
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const userId = req.user.id;
      const updates = req.body;

      await notificationSystem.updateUserPreferences(userId, updates);

      res.json({
        message: '通知設定を更新しました',
        userId,
        updatedFields: Object.keys(updates)
      });
    } catch (error) {
      logger.error('Failed to update notification preferences:', error);
      res.status(500).json({ error: '通知設定の更新に失敗しました' });
    }
  }
);

/**
 * 通知履歴取得
 * GET /api/v1/notifications/history
 */
router.get('/history',
  authenticate,
  [
    query('page').optional().isInt({ min: 0 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(Object.values(NotificationType)),
    query('channel').optional().isIn(Object.values(DeliveryChannel)),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;
      
      // 通知履歴の取得（モックデータ）
      const history = [
        {
          id: 'notif-001',
          type: NotificationType.WARNING,
          title: '有給休暇取得のご案内',
          message: '今年度の有給休暇の取得状況について...',
          channels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
          status: 'delivered',
          sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          readAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        {
          id: 'notif-002',
          type: NotificationType.INFO,
          title: 'システムメンテナンスのお知らせ',
          message: 'AI-OSのシステムメンテナンスを実施いたします...',
          channels: [DeliveryChannel.IN_APP],
          status: 'read',
          sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          readAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
        }
      ];

      res.json({
        notifications: history,
        pagination: {
          page,
          limit,
          total: history.length,
          hasMore: false
        }
      });
    } catch (error) {
      logger.error('Failed to get notification history:', error);
      res.status(500).json({ error: '通知履歴の取得に失敗しました' });
    }
  }
);

/**
 * 通知既読マーク
 * POST /api/v1/notifications/:id/read
 */
router.post('/:id/read',
  authenticate,
  param('id').notEmpty(),
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // 通知を既読としてマーク
      // 実際の実装では、データベースを更新
      logger.info(`Notification marked as read`, { notificationId: id, userId });

      res.json({
        message: '通知を既読にマークしました',
        notificationId: id,
        readAt: new Date()
      });
    } catch (error) {
      logger.error('Failed to mark notification as read:', error);
      res.status(500).json({ error: '既読マークに失敗しました' });
    }
  }
);

/**
 * 通知統計（管理者用）
 * GET /api/v1/notifications/admin/statistics
 */
router.get('/admin/statistics',
  authenticate,
  authorize(['admin', 'hr_manager']),
  query('period').optional().isIn(['day', 'week', 'month', 'quarter']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const period = req.query.period as string || 'month';

      // 通知統計の取得（モックデータ）
      const statistics = {
        period,
        summary: {
          totalNotifications: 1234,
          deliveredNotifications: 1198,
          failedNotifications: 36,
          deliveryRate: 97.1,
          openRate: 68.5,
          clickRate: 23.4
        },
        byType: {
          [NotificationType.INFO]: { count: 456, deliveryRate: 98.2, openRate: 45.3 },
          [NotificationType.WARNING]: { count: 234, deliveryRate: 97.8, openRate: 78.9 },
          [NotificationType.ERROR]: { count: 89, deliveryRate: 96.6, openRate: 89.2 },
          [NotificationType.URGENT]: { count: 12, deliveryRate: 100.0, openRate: 100.0 },
          [NotificationType.COMPLIANCE_ALERT]: { count: 23, deliveryRate: 100.0, openRate: 95.7 }
        },
        byChannel: {
          [DeliveryChannel.IN_APP]: { count: 1234, deliveryRate: 100.0, openRate: 85.4 },
          [DeliveryChannel.EMAIL]: { count: 567, deliveryRate: 94.5, openRate: 45.2 },
          [DeliveryChannel.SLACK]: { count: 123, deliveryRate: 98.4, openRate: 67.8 },
          [DeliveryChannel.SMS]: { count: 45, deliveryRate: 97.8, openRate: 91.1 }
        },
        trends: {
          dailyVolume: [
            { date: '2025-01-15', count: 45 },
            { date: '2025-01-16', count: 52 },
            { date: '2025-01-17', count: 38 },
            { date: '2025-01-18', count: 61 },
            { date: '2025-01-19', count: 47 },
            { date: '2025-01-20', count: 55 },
            { date: '2025-01-21', count: 42 }
          ]
        },
        topFailureReasons: [
          { reason: 'Invalid email address', count: 15 },
          { reason: 'Slack webhook timeout', count: 8 },
          { reason: 'SMS delivery failed', count: 7 },
          { reason: 'User preferences blocked', count: 6 }
        ]
      };

      res.json({ statistics });
    } catch (error) {
      logger.error('Failed to get notification statistics:', error);
      res.status(500).json({ error: '通知統計の取得に失敗しました' });
    }
  }
);

/**
 * 一斉通知送信（管理者用）
 * POST /api/v1/notifications/admin/broadcast
 */
router.post('/admin/broadcast',
  authenticate,
  authorize(['admin']),
  [
    body('type').isIn(Object.values(NotificationType)),
    body('title').notEmpty().isLength({ max: 200 }),
    body('message').notEmpty().isLength({ max: 2000 }),
    body('targetScope').isIn(['all_users', 'by_organization', 'by_role']),
    body('organizationIds').optional().isArray(),
    body('roles').optional().isArray(),
    body('channels').isArray(),
    body('scheduling').optional().isObject()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { type, title, message, targetScope, organizationIds, roles, channels, scheduling } = req.body;

      // 対象ユーザーの解決
      let targetUsers: string[] = [];
      switch (targetScope) {
        case 'all_users':
          targetUsers = ['user1', 'user2']; // 実際の実装では全ユーザーを取得
          break;
        case 'by_organization':
          // organizationIds から対象ユーザーを取得
          targetUsers = ['user3', 'user4'];
          break;
        case 'by_role':
          // roles から対象ユーザーを取得
          targetUsers = ['user5', 'user6'];
          break;
      }

      const notification: Notification = {
        id: require('uuid').v4(),
        type,
        priority: NotificationPriority.NORMAL,
        title,
        message,
        targetUsers,
        channels,
        scheduling,
        createdAt: new Date(),
        createdBy: req.user.id
      };

      await notificationSystem.sendNotification(notification);

      logger.info(`Broadcast notification sent`, {
        id: notification.id,
        targetScope,
        targetCount: targetUsers.length,
        sentBy: req.user.id
      });

      res.json({
        message: '一斉通知を送信しました',
        notificationId: notification.id,
        targetScope,
        targetCount: targetUsers.length,
        estimatedDelivery: scheduling?.scheduleType === 'delayed' 
          ? new Date(Date.now() + (scheduling.delay || 0))
          : 'immediate'
      });
    } catch (error) {
      logger.error('Failed to send broadcast notification:', error);
      res.status(500).json({ error: '一斉通知の送信に失敗しました' });
    }
  }
);

/**
 * WebSocket認証トークン生成
 * POST /api/v1/notifications/websocket-token
 */
router.post('/websocket-token',
  authenticate,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const userId = req.user.id;
      const organizationId = req.user.organizationId;
      
      // WebSocket認証トークンの生成
      const token = require('jsonwebtoken').sign(
        { userId, organizationId, scope: 'websocket' },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '24h' }
      );

      res.json({
        token,
        wsUrl: `ws://localhost:8080?token=${token}`,
        expiresIn: 86400 // 24 hours
      });
    } catch (error) {
      logger.error('Failed to generate WebSocket token:', error);
      res.status(500).json({ error: 'WebSocketトークンの生成に失敗しました' });
    }
  }
);

export default router;