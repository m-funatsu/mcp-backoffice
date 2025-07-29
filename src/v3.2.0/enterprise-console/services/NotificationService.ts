/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * 通知サービス - リアルタイム通知とアラート管理
 */

import { Notification, NotificationType, NotificationPriority } from '../types';

export interface NotificationOptions {
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  data?: any;
  actions?: NotificationAction[];
  persistent?: boolean;
  autoClose?: number; // milliseconds
}

export interface NotificationAction {
  label: string;
  action: string;
  primary?: boolean;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'teams' | 'webhook' | 'system';
  enabled: boolean;
  config: any;
}

export interface NotificationRule {
  id: string;
  name: string;
  description: string;
  condition: {
    type: string;
    parameters: any;
  };
  channels: string[];
  recipients: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type NotificationListener = (notification: Notification) => void;

export class NotificationService {
  private notifications: Notification[] = [];
  private channels: Map<string, NotificationChannel> = new Map();
  private rules: Map<string, NotificationRule> = new Map();
  private listeners: Set<NotificationListener> = new Set();
  private websocket: WebSocket | null = null;
  private notificationIdCounter = 0;

  constructor() {
    this.initializeChannels();
    this.initializeRules();
    this.setupWebSocket();
    this.setupSystemNotifications();
  }

  /**
   * 通知を作成して送信
   */
  async sendNotification(options: NotificationOptions): Promise<Notification> {
    const notification: Notification = {
      id: `notif_${++this.notificationIdCounter}_${Date.now()}`,
      type: options.type,
      title: options.title,
      message: options.message,
      priority: options.priority || 'medium',
      timestamp: new Date(),
      read: false,
      data: options.data,
      actions: options.actions,
      persistent: options.persistent || false,
    };

    // 通知を保存
    this.notifications.unshift(notification);
    if (this.notifications.length > 1000) {
      this.notifications = this.notifications.slice(0, 1000);
    }

    // リスナーに通知
    this.notifyListeners(notification);

    // チャンネルに送信
    await this.sendToChannels(notification);

    // 自動クローズの設定
    if (options.autoClose && !options.persistent) {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, options.autoClose);
    }

    return notification;
  }

  /**
   * 最近の通知を取得
   */
  async getRecent(limit: number = 20): Promise<Notification[]> {
    return this.notifications.slice(0, limit);
  }

  /**
   * 未読通知を取得
   */
  async getUnread(): Promise<Notification[]> {
    return this.notifications.filter(n => !n.read);
  }

  /**
   * 通知を既読にする
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      notification.readAt = new Date();
    }
  }

  /**
   * すべての通知を既読にする
   */
  async markAllAsRead(): Promise<void> {
    const now = new Date();
    this.notifications.forEach(notification => {
      if (!notification.read) {
        notification.read = true;
        notification.readAt = now;
      }
    });
  }

  /**
   * 通知を削除
   */
  async dismissNotification(notificationId: string): Promise<void> {
    const index = this.notifications.findIndex(n => n.id === notificationId);
    if (index !== -1) {
      this.notifications.splice(index, 1);
    }
  }

  /**
   * 通知リスナーを登録
   */
  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    
    // アンサブスクライブ関数を返す
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知チャンネルを取得
   */
  async getChannels(): Promise<NotificationChannel[]> {
    return Array.from(this.channels.values());
  }

  /**
   * チャンネルを更新
   */
  async updateChannel(channelId: string, updates: Partial<NotificationChannel>): Promise<void> {
    const channel = this.channels.get(channelId);
    if (channel) {
      Object.assign(channel, updates);
      this.channels.set(channelId, channel);
    }
  }

  /**
   * 通知ルールを取得
   */
  async getRules(): Promise<NotificationRule[]> {
    return Array.from(this.rules.values());
  }

  /**
   * ルールを作成
   */
  async createRule(rule: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationRule> {
    const newRule: NotificationRule = {
      ...rule,
      id: `rule_${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  /**
   * ルールを更新
   */
  async updateRule(ruleId: string, updates: Partial<NotificationRule>): Promise<void> {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates, { updatedAt: new Date() });
      this.rules.set(ruleId, rule);
    }
  }

  /**
   * ルールを削除
   */
  async deleteRule(ruleId: string): Promise<void> {
    this.rules.delete(ruleId);
  }

  /**
   * テスト通知を送信
   */
  async sendTestNotification(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const testNotification = await this.sendNotification({
      title: 'テスト通知',
      message: `${channel.name}へのテスト通知です。正常に受信できることを確認してください。`,
      type: 'info',
      priority: 'low',
    });

    // 特定のチャンネルのみに送信
    await this.sendToSpecificChannel(testNotification, channel);
  }

  // ===== プライベートメソッド =====

  /**
   * チャンネルの初期化
   */
  private initializeChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'system',
        name: 'システム通知',
        type: 'system',
        enabled: true,
        config: {},
      },
      {
        id: 'email',
        name: 'メール通知',
        type: 'email',
        enabled: true,
        config: {
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          from: 'ai-os@example.com',
        },
      },
      {
        id: 'slack',
        name: 'Slack通知',
        type: 'slack',
        enabled: false,
        config: {
          webhookUrl: '',
          channel: '#ai-os-alerts',
        },
      },
      {
        id: 'teams',
        name: 'Microsoft Teams通知',
        type: 'teams',
        enabled: false,
        config: {
          webhookUrl: '',
        },
      },
    ];

    defaultChannels.forEach(channel => {
      this.channels.set(channel.id, channel);
    });
  }

  /**
   * ルールの初期化
   */
  private initializeRules(): void {
    const defaultRules: NotificationRule[] = [
      {
        id: 'rule_overtime_alert',
        name: '残業時間アラート',
        description: '従業員の残業時間が月45時間を超えた場合に通知',
        condition: {
          type: 'overtime_threshold',
          parameters: {
            threshold: 45,
            period: 'monthly',
          },
        },
        channels: ['system', 'email'],
        recipients: ['hr_team', 'managers'],
        enabled: true,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
      {
        id: 'rule_expense_anomaly',
        name: '経費異常検知',
        description: '異常な経費申請を検出した場合に通知',
        condition: {
          type: 'expense_anomaly',
          parameters: {
            sensitivity: 'high',
          },
        },
        channels: ['system'],
        recipients: ['finance_team'],
        enabled: true,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
      {
        id: 'rule_system_error',
        name: 'システムエラー通知',
        description: 'システムエラーが発生した場合に即座に通知',
        condition: {
          type: 'system_error',
          parameters: {
            severity: ['critical', 'high'],
          },
        },
        channels: ['system', 'email', 'slack'],
        recipients: ['it_team', 'on_call'],
        enabled: true,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  /**
   * WebSocketのセットアップ
   */
  private setupWebSocket(): void {
    // 実際の実装では、WebSocketサーバーに接続
    // this.websocket = new WebSocket('ws://localhost:8080/notifications');
    
    // シミュレーション: 定期的にサンプル通知を生成
    setInterval(() => {
      if (Math.random() < 0.1) { // 10%の確率で通知を生成
        this.generateSampleNotification();
      }
    }, 30000); // 30秒ごと
  }

  /**
   * システム通知のセットアップ
   */
  private setupSystemNotifications(): void {
    // ブラウザ通知の許可を要求
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  /**
   * リスナーに通知
   */
  private notifyListeners(notification: Notification): void {
    this.listeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  /**
   * チャンネルに通知を送信
   */
  private async sendToChannels(notification: Notification): Promise<void> {
    const enabledChannels = Array.from(this.channels.values()).filter(c => c.enabled);
    
    // 通知の優先度に基づいてチャンネルをフィルタ
    const targetChannels = enabledChannels.filter(channel => {
      if (notification.priority === 'critical') return true;
      if (notification.priority === 'high' && channel.type !== 'system') return true;
      if (notification.priority === 'medium' && ['email', 'system'].includes(channel.type)) return true;
      if (notification.priority === 'low' && channel.type === 'system') return true;
      return false;
    });

    // 各チャンネルに送信
    await Promise.all(targetChannels.map(channel => 
      this.sendToSpecificChannel(notification, channel)
    ));
  }

  /**
   * 特定のチャンネルに通知を送信
   */
  private async sendToSpecificChannel(notification: Notification, channel: NotificationChannel): Promise<void> {
    try {
      switch (channel.type) {
        case 'system':
          this.sendSystemNotification(notification);
          break;
        case 'email':
          // 実際の実装では、メールサーバーに送信
          console.log(`Sending email notification: ${notification.title}`);
          break;
        case 'slack':
          // 実際の実装では、Slack WebhookにPOST
          console.log(`Sending Slack notification: ${notification.title}`);
          break;
        case 'teams':
          // 実際の実装では、Teams WebhookにPOST
          console.log(`Sending Teams notification: ${notification.title}`);
          break;
        case 'webhook':
          // 実際の実装では、カスタムWebhookにPOST
          console.log(`Sending webhook notification: ${notification.title}`);
          break;
      }
    } catch (error) {
      console.error(`Failed to send notification to ${channel.name}:`, error);
    }
  }

  /**
   * システム通知（ブラウザ通知）を送信
   */
  private sendSystemNotification(notification: Notification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
        badge: '/badge.png',
        tag: notification.id,
        requireInteraction: notification.persistent,
      });

      browserNotification.onclick = () => {
        window.focus();
        this.markAsRead(notification.id);
      };
    }
  }

  /**
   * サンプル通知の生成（開発用）
   */
  private generateSampleNotification(): void {
    const samples = [
      {
        title: '残業時間警告',
        message: '山田太郎さんの今月の残業時間が40時間を超えました',
        type: 'warning' as NotificationType,
        priority: 'high' as NotificationPriority,
      },
      {
        title: '給与計算完了',
        message: '2024年7月分の給与計算が正常に完了しました',
        type: 'success' as NotificationType,
        priority: 'medium' as NotificationPriority,
      },
      {
        title: 'システムアップデート',
        message: 'AI-OS v3.2.1へのアップデートが利用可能です',
        type: 'info' as NotificationType,
        priority: 'low' as NotificationPriority,
      },
      {
        title: 'セキュリティアラート',
        message: '異常なログイン試行を検出しました',
        type: 'error' as NotificationType,
        priority: 'critical' as NotificationPriority,
      },
    ];

    const sample = samples[Math.floor(Math.random() * samples.length)];
    this.sendNotification(sample);
  }
}

// シングルトンインスタンス
export const notificationService = new NotificationService();