/**
 * AI-OS リアルタイム通知・アラートシステム
 * WebSocket、メール、Slack、Teamsでの統合通知配信
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// 通知タイプ
export enum NotificationType {
  INFO = 'info',                    // 一般的な情報
  WARNING = 'warning',              // 警告
  ERROR = 'error',                  // エラー
  SUCCESS = 'success',              // 成功
  URGENT = 'urgent',                // 緊急
  COMPLIANCE_ALERT = 'compliance_alert', // コンプライアンス違反
  SYSTEM_MAINTENANCE = 'system_maintenance', // システムメンテナンス
  FEATURE_ANNOUNCEMENT = 'feature_announcement' // 機能リリース通知
}

// 配信チャネル
export enum DeliveryChannel {
  IN_APP = 'in_app',               // アプリ内通知
  EMAIL = 'email',                 // メール
  SMS = 'sms',                     // SMS
  SLACK = 'slack',                 // Slack
  TEAMS = 'teams',                 // Microsoft Teams
  WEBHOOK = 'webhook',             // Webhook
  PUSH = 'push'                    // プッシュ通知
}

// 優先度
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// 通知インターフェース
export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data?: Record<string, any>;
  targetUsers: string[];
  targetRoles?: string[];
  targetOrganizations?: string[];
  channels: DeliveryChannel[];
  scheduling?: NotificationScheduling;
  personalization?: NotificationPersonalization;
  actions?: NotificationAction[];
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string;
}

// スケジュール設定
export interface NotificationScheduling {
  scheduleType: 'immediate' | 'delayed' | 'recurring';
  delay?: number; // milliseconds
  recurringPattern?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // HH:mm format
    daysOfWeek?: number[]; // 0-6 (Sun-Sat)
    endDate?: Date;
  };
  timezone?: string;
}

// パーソナライゼーション
export interface NotificationPersonalization {
  useUserPreferences: boolean;
  respectQuietHours: boolean;
  languageLocalization: boolean;
  customization?: {
    template?: string;
    variables?: Record<string, any>;
  };
}

// アクションボタン
export interface NotificationAction {
  id: string;
  label: string;
  type: 'button' | 'link' | 'api_call';
  payload: any;
  style?: 'primary' | 'secondary' | 'danger';
}

// 配信結果
export interface DeliveryResult {
  notificationId: string;
  channel: DeliveryChannel;
  targetId: string;
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  sentAt: Date;
  deliveredAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

// ユーザー通知設定
export interface UserNotificationPreferences {
  userId: string;
  channels: Partial<Record<DeliveryChannel, boolean>>;
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm
    end: string;   // HH:mm
    timezone: string;
  };
  typePreferences: Partial<Record<NotificationType, {
    enabled: boolean;
    channels: DeliveryChannel[];
    priority: NotificationPriority;
  }>>;
  frequency: 'realtime' | 'batched' | 'daily_digest';
  language: string;
}

// テンプレート
export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channels: DeliveryChannel[];
  templates: Partial<Record<DeliveryChannel, {
    subject?: string;
    body: string;
    htmlBody?: string;
    attachments?: string[];
  }>>;
  variables: string[];
  defaultPersonalization?: NotificationPersonalization;
}

/**
 * リアルタイム通知システム
 */
export class RealtimeNotificationSystem extends EventEmitter {
  private wsServer: WebSocketServer;
  private connectedClients: Map<string, ClientConnection> = new Map();
  private notificationQueue: Map<string, Notification> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private userPreferences: Map<string, UserNotificationPreferences> = new Map();
  private deliveryProviders: Map<DeliveryChannel, NotificationProvider> = new Map();
  private analytics: NotificationAnalytics;

  constructor(port: number = 8080) {
    super();
    this.wsServer = new WebSocketServer({ port });
    this.analytics = new NotificationAnalytics();
    this.initializeWebSocketServer();
    this.initializeProviders();
    this.initializeTemplates();
  }

  /**
   * WebSocketサーバーの初期化
   */
  private initializeWebSocketServer(): void {
    this.wsServer.on('connection', (ws: WebSocket, request) => {
      const clientId = uuidv4();
      const client: ClientConnection = {
        id: clientId,
        socket: ws,
        userId: null,
        organizationId: null,
        subscribedChannels: [],
        connectedAt: new Date(),
        lastActivity: new Date()
      };

      this.connectedClients.set(clientId, client);
      logger.info(`WebSocket client connected: ${clientId}`);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleWebSocketMessage(client, data);
        } catch (error) {
          logger.error('Error handling WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        this.connectedClients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.connectedClients.delete(clientId);
      });

      // 接続確認メッセージ送信
      ws.send(JSON.stringify({
        type: 'connection_established',
        clientId,
        timestamp: new Date()
      }));
    });

    logger.info(`WebSocket server started on port ${this.wsServer.options.port}`);
  }

  /**
   * 配信プロバイダーの初期化
   */
  private initializeProviders(): void {
    this.deliveryProviders.set(DeliveryChannel.EMAIL, new EmailProvider());
    this.deliveryProviders.set(DeliveryChannel.SLACK, new SlackProvider());
    this.deliveryProviders.set(DeliveryChannel.TEAMS, new TeamsProvider());
    this.deliveryProviders.set(DeliveryChannel.SMS, new SMSProvider());
    this.deliveryProviders.set(DeliveryChannel.WEBHOOK, new WebhookProvider());
    this.deliveryProviders.set(DeliveryChannel.PUSH, new PushProvider());
  }

  /**
   * テンプレートの初期化
   */
  private initializeTemplates(): void {
    // 36協定違反アラート
    this.registerTemplate({
      id: 'overtime-violation',
      name: '36協定違反アラート',
      type: NotificationType.COMPLIANCE_ALERT,
      channels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL, DeliveryChannel.SLACK],
      templates: {
        [DeliveryChannel.EMAIL]: {
          subject: '【重要】36協定違反の可能性 - {{employeeName}}',
          body: `{{employeeName}}さんの時間外労働が上限に近づいています。

詳細:
- 現在の月間時間外労働: {{currentOvertime}}時間
- 上限: {{overtimeLimit}}時間
- 残り可能時間: {{remainingHours}}時間

至急確認と対応をお願いします。`,
          htmlBody: `
<h2>36協定違反アラート</h2>
<p><strong>{{employeeName}}</strong>さんの時間外労働が上限に近づいています。</p>
<ul>
  <li>現在の月間時間外労働: <strong>{{currentOvertime}}時間</strong></li>
  <li>上限: {{overtimeLimit}}時間</li>
  <li>残り可能時間: {{remainingHours}}時間</li>
</ul>
<p style="color: #dc3545;">至急確認と対応をお願いします。</p>
          `
        },
        [DeliveryChannel.SLACK]: {
          body: `🚨 *36協定違反アラート*

*従業員*: {{employeeName}}
*現在の時間外労働*: {{currentOvertime}}時間
*上限*: {{overtimeLimit}}時間
*残り*: {{remainingHours}}時間

至急対応が必要です。詳細は管理画面をご確認ください。`
        }
      },
      variables: ['employeeName', 'currentOvertime', 'overtimeLimit', 'remainingHours'],
      defaultPersonalization: {
        useUserPreferences: true,
        respectQuietHours: false, // 緊急通知のため
        languageLocalization: true
      }
    });

    // 有給取得促進通知
    this.registerTemplate({
      id: 'vacation-reminder',
      name: '有給取得促進通知',
      type: NotificationType.WARNING,
      channels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL],
      templates: {
        [DeliveryChannel.EMAIL]: {
          subject: '有給休暇の取得についてのご案内 - {{employeeName}}',
          body: `{{employeeName}}さん

今年度の有給休暇の取得状況についてご案内いたします。

取得状況:
- 付与日数: {{grantedDays}}日
- 取得日数: {{usedDays}}日
- 残り日数: {{remainingDays}}日

年5日の取得義務があります。計画的な休暇取得をお願いいたします。`,
          htmlBody: `
<h2>有給休暇取得のご案内</h2>
<p>{{employeeName}}さん</p>
<p>今年度の有給休暇の取得状況についてご案内いたします。</p>
<table border="1">
  <tr><td>付与日数</td><td>{{grantedDays}}日</td></tr>
  <tr><td>取得日数</td><td>{{usedDays}}日</td></tr>
  <tr><td>残り日数</td><td>{{remainingDays}}日</td></tr>
</table>
<p><strong>年5日の取得義務があります。</strong>計画的な休暇取得をお願いいたします。</p>
          `
        }
      },
      variables: ['employeeName', 'grantedDays', 'usedDays', 'remainingDays']
    });

    // システムメンテナンス通知
    this.registerTemplate({
      id: 'system-maintenance',
      name: 'システムメンテナンス通知',
      type: NotificationType.SYSTEM_MAINTENANCE,
      channels: [DeliveryChannel.IN_APP, DeliveryChannel.EMAIL, DeliveryChannel.SLACK],
      templates: {
        [DeliveryChannel.EMAIL]: {
          subject: 'AI-OS システムメンテナンスのお知らせ',
          body: `AI-OSをご利用いただき、ありがとうございます。

システムメンテナンスを実施いたします。

日時: {{maintenanceDate}} {{maintenanceTime}}
予定時間: {{duration}}
影響: {{impact}}

ご不便をおかけしますが、ご理解のほどよろしくお願いいたします。`
        },
        [DeliveryChannel.SLACK]: {
          body: `🔧 *システムメンテナンスのお知らせ*

*日時*: {{maintenanceDate}} {{maintenanceTime}}
*予定時間*: {{duration}}
*影響*: {{impact}}

メンテナンス中はシステムがご利用いただけません。ご注意ください。`
        }
      },
      variables: ['maintenanceDate', 'maintenanceTime', 'duration', 'impact']
    });
  }

  /**
   * 通知テンプレートの登録
   */
  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
    logger.info(`Notification template registered: ${template.name}`);
  }

  /**
   * 通知の送信
   */
  async sendNotification(notification: Notification): Promise<void> {
    try {
      notification.id = notification.id || uuidv4();
      notification.createdAt = notification.createdAt || new Date();

      // キューに追加
      this.notificationQueue.set(notification.id, notification);

      // スケジュール処理
      if (notification.scheduling?.scheduleType === 'delayed') {
        setTimeout(async () => {
          await this.processNotification(notification);
        }, notification.scheduling.delay || 0);
      } else {
        await this.processNotification(notification);
      }

      this.emit('notification:queued', notification);
      logger.info(`Notification queued: ${notification.id}`);
    } catch (error) {
      logger.error('Failed to send notification:', error);
      this.emit('notification:failed', { notification, error });
    }
  }

  /**
   * テンプレートベースの通知送信
   */
  async sendTemplateNotification(
    templateId: string,
    variables: Record<string, any>,
    targetUsers: string[],
    options?: {
      channels?: DeliveryChannel[];
      priority?: NotificationPriority;
      scheduling?: NotificationScheduling;
    }
  ): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const notification: Notification = {
      id: uuidv4(),
      type: template.type,
      priority: options?.priority || NotificationPriority.NORMAL,
      title: this.processTemplate(template.name, variables),
      message: '', // Will be set per channel
      data: variables,
      targetUsers,
      channels: options?.channels || template.channels,
      scheduling: options?.scheduling,
      personalization: template.defaultPersonalization,
      createdAt: new Date(),
      createdBy: 'system'
    };

    await this.sendNotification(notification);
  }

  /**
   * ユーザー通知設定の更新
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserNotificationPreferences>
  ): Promise<void> {
    const existing = this.userPreferences.get(userId) || this.getDefaultPreferences(userId);
    const updated = { ...existing, ...preferences };
    
    this.userPreferences.set(userId, updated);
    
    this.emit('user_preferences:updated', { userId, preferences: updated });
    logger.info(`User notification preferences updated: ${userId}`);
  }

  /**
   * リアルタイム接続の認証
   */
  async authenticateClient(
    clientId: string,
    userId: string,
    organizationId: string,
    channels: string[] = []
  ): Promise<void> {
    const client = this.connectedClients.get(clientId);
    if (!client) {
      throw new Error('Client not found');
    }

    client.userId = userId;
    client.organizationId = organizationId;
    client.subscribedChannels = channels;
    client.lastActivity = new Date();

    // 認証確認メッセージ送信
    client.socket.send(JSON.stringify({
      type: 'authenticated',
      userId,
      organizationId,
      subscribedChannels: channels,
      timestamp: new Date()
    }));

    logger.info(`Client authenticated: ${clientId} for user ${userId}`);
  }

  /**
   * 通知の処理
   */
  private async processNotification(notification: Notification): Promise<void> {
    const results: DeliveryResult[] = [];

    // 対象ユーザーの取得
    const targetUsers = await this.resolveTargetUsers(notification);

    for (const userId of targetUsers) {
      const userPreferences = this.getUserPreferences(userId);
      const applicableChannels = this.filterChannelsByPreferences(
        notification.channels,
        userPreferences,
        notification.type,
        notification.priority
      );

      for (const channel of applicableChannels) {
        try {
          const result = await this.deliverToChannel(
            notification,
            userId,
            channel,
            userPreferences
          );
          results.push(result);
        } catch (error) {
          logger.error(`Delivery failed for ${userId}/${channel}:`, error);
          results.push({
            notificationId: notification.id,
            channel,
            targetId: userId,
            status: 'failed',
            sentAt: new Date(),
            error: error.message
          });
        }
      }
    }

    // アナリティクス記録
    await this.analytics.recordDelivery(notification, results);

    // イベント発火
    this.emit('notification:processed', { notification, results });

    // キューから削除
    this.notificationQueue.delete(notification.id);
  }

  /**
   * チャネルごとの配信
   */
  private async deliverToChannel(
    notification: Notification,
    userId: string,
    channel: DeliveryChannel,
    userPreferences: UserNotificationPreferences
  ): Promise<DeliveryResult> {
    const provider = this.deliveryProviders.get(channel);
    if (!provider) {
      throw new Error(`No provider for channel: ${channel}`);
    }

    const personalizedContent = await this.personalizeContent(
      notification,
      userId,
      channel,
      userPreferences
    );

    const result = await provider.deliver({
      notification,
      userId,
      content: personalizedContent
    });

    // リアルタイム配信
    if (channel === DeliveryChannel.IN_APP) {
      await this.deliverToWebSocket(userId, {
        ...notification,
        ...personalizedContent
      });
    }

    return result;
  }

  /**
   * WebSocket経由の配信
   */
  private async deliverToWebSocket(userId: string, content: any): Promise<void> {
    const userClients = Array.from(this.connectedClients.values())
      .filter(client => client.userId === userId);

    for (const client of userClients) {
      try {
        client.socket.send(JSON.stringify({
          type: 'notification',
          ...content,
          timestamp: new Date()
        }));
        client.lastActivity = new Date();
      } catch (error) {
        logger.error(`Failed to send to WebSocket client:`, error);
      }
    }
  }

  /**
   * WebSocketメッセージの処理
   */
  private async handleWebSocketMessage(
    client: ClientConnection,
    message: any
  ): Promise<void> {
    client.lastActivity = new Date();

    switch (message.type) {
      case 'authenticate':
        await this.authenticateClient(
          client.id,
          message.userId,
          message.organizationId,
          message.channels || []
        );
        break;

      case 'subscribe':
        if (client.userId) {
          client.subscribedChannels = message.channels || [];
          client.socket.send(JSON.stringify({
            type: 'subscription_updated',
            channels: client.subscribedChannels,
            timestamp: new Date()
          }));
        }
        break;

      case 'mark_read':
        if (message.notificationId) {
          await this.markNotificationAsRead(message.notificationId, client.userId!);
        }
        break;

      case 'ping':
        client.socket.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date()
        }));
        break;

      default:
        logger.warn(`Unknown WebSocket message type: ${message.type}`);
    }
  }

  // ヘルパーメソッド

  private async resolveTargetUsers(notification: Notification): Promise<string[]> {
    let users = [...notification.targetUsers];

    // ロールベースの対象ユーザー追加
    if (notification.targetRoles) {
      // 実装省略：ロールから対象ユーザーを取得
    }

    // 組織ベースの対象ユーザー追加
    if (notification.targetOrganizations) {
      // 実装省略：組織から対象ユーザーを取得
    }

    return [...new Set(users)]; // 重複除去
  }

  private getUserPreferences(userId: string): UserNotificationPreferences {
    return this.userPreferences.get(userId) || this.getDefaultPreferences(userId);
  }

  private getDefaultPreferences(userId: string): UserNotificationPreferences {
    return {
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
  }

  private filterChannelsByPreferences(
    channels: DeliveryChannel[],
    preferences: UserNotificationPreferences,
    type: NotificationType,
    priority: NotificationPriority
  ): DeliveryChannel[] {
    return channels.filter(channel => {
      // ユーザー設定でチャネルが無効
      if (!preferences.channels[channel]) {
        return false;
      }

      // 静寂時間のチェック（緊急通知は除外）
      if (priority !== NotificationPriority.CRITICAL && 
          this.isQuietHours(preferences.quietHours)) {
        return channel === DeliveryChannel.IN_APP; // アプリ内通知のみ
      }

      return true;
    });
  }

  private isQuietHours(quietHours: any): boolean {
    if (!quietHours.enabled) return false;
    
    const now = new Date();
    // 簡略化：実際はタイムゾーンを考慮
    const currentHour = now.getHours();
    const startHour = parseInt(quietHours.start.split(':')[0]);
    const endHour = parseInt(quietHours.end.split(':')[0]);
    
    if (startHour > endHour) {
      // 夜をまたぐ場合
      return currentHour >= startHour || currentHour < endHour;
    } else {
      return currentHour >= startHour && currentHour < endHour;
    }
  }

  private async personalizeContent(
    notification: Notification,
    userId: string,
    channel: DeliveryChannel,
    preferences: UserNotificationPreferences
  ): Promise<any> {
    const content = {
      title: notification.title,
      message: notification.message
    };

    // テンプレート変数の置換
    if (notification.data) {
      content.title = this.processTemplate(content.title, notification.data);
      content.message = this.processTemplate(content.message, notification.data);
    }

    return content;
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  private async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    // 実装省略：通知を既読としてマーク
    logger.info(`Notification marked as read: ${notificationId} by ${userId}`);
  }
}

// 接続クライアント情報
interface ClientConnection {
  id: string;
  socket: WebSocket;
  userId: string | null;
  organizationId: string | null;
  subscribedChannels: string[];
  connectedAt: Date;
  lastActivity: Date;
}

// 配信プロバイダーインターフェース
abstract class NotificationProvider {
  abstract deliver(params: {
    notification: Notification;
    userId: string;
    content: any;
  }): Promise<DeliveryResult>;
}

// Email配信プロバイダー
class EmailProvider extends NotificationProvider {
  async deliver({ notification, userId, content }): Promise<DeliveryResult> {
    // メール送信の実装
    logger.info(`Sending email to ${userId}:`, content.title);
    
    return {
      notificationId: notification.id,
      channel: DeliveryChannel.EMAIL,
      targetId: userId,
      status: 'sent',
      sentAt: new Date(),
      deliveredAt: new Date()
    };
  }
}

// Slack配信プロバイダー
class SlackProvider extends NotificationProvider {
  async deliver({ notification, userId, content }): Promise<DeliveryResult> {
    // Slack送信の実装
    logger.info(`Sending Slack message to ${userId}:`, content.title);
    
    return {
      notificationId: notification.id,
      channel: DeliveryChannel.SLACK,
      targetId: userId,
      status: 'sent',
      sentAt: new Date()
    };
  }
}

// Teams配信プロバイダー
class TeamsProvider extends NotificationProvider {
  async deliver({ notification, userId, content }): Promise<DeliveryResult> {
    // Teams送信の実装
    logger.info(`Sending Teams message to ${userId}:`, content.title);
    
    return {
      notificationId: notification.id,
      channel: DeliveryChannel.TEAMS,
      targetId: userId,
      status: 'sent',
      sentAt: new Date()
    };
  }
}

// SMS配信プロバイダー
class SMSProvider extends NotificationProvider {
  async deliver({ notification, userId, content }): Promise<DeliveryResult> {
    // SMS送信の実装
    logger.info(`Sending SMS to ${userId}:`, content.title);
    
    return {
      notificationId: notification.id,
      channel: DeliveryChannel.SMS,
      targetId: userId,
      status: 'sent',
      sentAt: new Date()
    };
  }
}

// Webhook配信プロバイダー
class WebhookProvider extends NotificationProvider {
  async deliver({ notification, userId, content }): Promise<DeliveryResult> {
    // Webhook送信の実装
    logger.info(`Sending webhook to ${userId}:`, content.title);
    
    return {
      notificationId: notification.id,
      channel: DeliveryChannel.WEBHOOK,
      targetId: userId,
      status: 'sent',
      sentAt: new Date()
    };
  }
}

// Push通知配信プロバイダー
class PushProvider extends NotificationProvider {
  async deliver({ notification, userId, content }): Promise<DeliveryResult> {
    // Push通知送信の実装
    logger.info(`Sending push notification to ${userId}:`, content.title);
    
    return {
      notificationId: notification.id,
      channel: DeliveryChannel.PUSH,
      targetId: userId,
      status: 'sent',
      sentAt: new Date()
    };
  }
}

// 通知アナリティクス
class NotificationAnalytics {
  async recordDelivery(notification: Notification, results: DeliveryResult[]): Promise<void> {
    const analytics = {
      notificationId: notification.id,
      type: notification.type,
      priority: notification.priority,
      totalTargets: notification.targetUsers.length,
      successfulDeliveries: results.filter(r => r.status === 'sent' || r.status === 'delivered').length,
      failedDeliveries: results.filter(r => r.status === 'failed').length,
      channelBreakdown: this.getChannelBreakdown(results),
      timestamp: new Date()
    };

    logger.info('Notification analytics recorded:', analytics);
  }

  private getChannelBreakdown(results: DeliveryResult[]): Record<string, number> {
    return results.reduce((acc, result) => {
      acc[result.channel] = (acc[result.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export { RealtimeNotificationSystem };