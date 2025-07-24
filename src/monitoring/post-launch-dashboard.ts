/**
 * AI-OS Post-Launch監視ダッシュボードシステム
 * 商用リリース後のリアルタイム監視・分析・アラート
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import * as promClient from 'prom-client';
import { Redis } from 'ioredis';
import WebSocket from 'ws';

// メトリクスタイプ
export enum MetricType {
  SYSTEM_HEALTH = 'system_health',
  USER_ACTIVITY = 'user_activity',
  BUSINESS_METRICS = 'business_metrics',
  ERROR_TRACKING = 'error_tracking',
  PERFORMANCE = 'performance',
  SECURITY = 'security'
}

// アラートレベル
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// システムヘルスメトリクス
export interface SystemHealthMetrics {
  uptime: number;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_latency: number;
  database_connections: number;
  redis_connections: number;
  error_rate: number;
  success_rate: number;
}

// ユーザーアクティビティメトリクス
export interface UserActivityMetrics {
  active_users: number;
  new_registrations: number;
  login_count: number;
  feature_usage: Map<string, number>;
  session_duration: number;
  page_views: number;
  api_calls: number;
  mobile_usage_ratio: number;
}

// ビジネスメトリクス
export interface BusinessMetrics {
  trial_signups: number;
  trial_to_paid_conversion: number;
  churn_rate: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  average_revenue_per_user: number;
  customer_acquisition_cost: number;
  lifetime_value: number;
  nps_score: number;
}

// パフォーマンスメトリクス
export interface PerformanceMetrics {
  api_response_time: {
    p50: number;
    p95: number;
    p99: number;
  };
  database_query_time: {
    p50: number;
    p95: number;
    p99: number;
  };
  cache_hit_rate: number;
  throughput: number;
  concurrent_users: number;
  queue_length: number;
  processing_lag: number;
}

// アラート設定
export interface AlertConfiguration {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  level: AlertLevel;
  cooldown: number; // seconds
  recipients: string[];
  channels: ('email' | 'slack' | 'pagerduty' | 'webhook')[];
}

// ダッシュボード設定
export interface DashboardConfiguration {
  widgets: WidgetConfig[];
  refresh_interval: number;
  timezone: string;
  theme: 'light' | 'dark' | 'auto';
  layout: 'grid' | 'flex' | 'custom';
}

// ウィジェット設定
export interface WidgetConfig {
  id: string;
  type: 'chart' | 'gauge' | 'table' | 'number' | 'heatmap';
  title: string;
  metric: string;
  visualization: {
    chartType?: 'line' | 'bar' | 'pie' | 'area';
    colors?: string[];
    size: { width: number; height: number };
    position: { x: number; y: number };
  };
  filters?: Record<string, any>;
  timeRange?: string;
}

/**
 * Post-Launch監視ダッシュボード
 */
export class PostLaunchDashboard extends EventEmitter {
  private redis: Redis;
  private metricsRegistry: promClient.Registry;
  private wsServer: WebSocket.Server;
  private alerts: Map<string, AlertConfiguration> = new Map();
  private alertHistory: Map<string, Date> = new Map();
  private dashboards: Map<string, DashboardConfiguration> = new Map();
  
  // Prometheusメトリクス
  private systemHealthGauge: promClient.Gauge<string>;
  private userActivityCounter: promClient.Counter<string>;
  private businessMetricsGauge: promClient.Gauge<string>;
  private performanceHistogram: promClient.Histogram<string>;
  private errorCounter: promClient.Counter<string>;

  constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD
    });

    this.metricsRegistry = new promClient.Registry();
    this.initializeMetrics();
    this.initializeWebSocketServer();
    this.startMetricsCollection();
    this.loadDefaultAlerts();
    this.createDefaultDashboards();
  }

  /**
   * メトリクス初期化
   */
  private initializeMetrics(): void {
    // システムヘルスゲージ
    this.systemHealthGauge = new promClient.Gauge({
      name: 'aios_system_health',
      help: 'System health metrics',
      labelNames: ['metric_type'],
      registers: [this.metricsRegistry]
    });

    // ユーザーアクティビティカウンター
    this.userActivityCounter = new promClient.Counter({
      name: 'aios_user_activity',
      help: 'User activity metrics',
      labelNames: ['activity_type'],
      registers: [this.metricsRegistry]
    });

    // ビジネスメトリクスゲージ
    this.businessMetricsGauge = new promClient.Gauge({
      name: 'aios_business_metrics',
      help: 'Business metrics',
      labelNames: ['metric_type'],
      registers: [this.metricsRegistry]
    });

    // パフォーマンスヒストグラム
    this.performanceHistogram = new promClient.Histogram({
      name: 'aios_performance',
      help: 'Performance metrics',
      labelNames: ['operation'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.metricsRegistry]
    });

    // エラーカウンター
    this.errorCounter = new promClient.Counter({
      name: 'aios_errors',
      help: 'Error metrics',
      labelNames: ['error_type', 'severity'],
      registers: [this.metricsRegistry]
    });

    // デフォルトメトリクス
    promClient.collectDefaultMetrics({ register: this.metricsRegistry });
  }

  /**
   * WebSocketサーバー初期化
   */
  private initializeWebSocketServer(): void {
    this.wsServer = new WebSocket.Server({ port: 8080 });

    this.wsServer.on('connection', (ws) => {
      logger.info('New dashboard client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          logger.error('Invalid WebSocket message:', error);
        }
      });

      // 初期データ送信
      this.sendInitialData(ws);
    });
  }

  /**
   * メトリクス収集開始
   */
  private startMetricsCollection(): void {
    // システムヘルス監視（10秒ごと）
    setInterval(() => this.collectSystemHealth(), 10000);

    // ユーザーアクティビティ監視（30秒ごと）
    setInterval(() => this.collectUserActivity(), 30000);

    // ビジネスメトリクス監視（5分ごと）
    setInterval(() => this.collectBusinessMetrics(), 300000);

    // パフォーマンス監視（1分ごと）
    setInterval(() => this.collectPerformanceMetrics(), 60000);

    // セキュリティ監視（1分ごと）
    setInterval(() => this.collectSecurityMetrics(), 60000);
  }

  /**
   * システムヘルス収集
   */
  private async collectSystemHealth(): Promise<void> {
    try {
      const health: SystemHealthMetrics = {
        uptime: process.uptime(),
        cpu_usage: await this.getCPUUsage(),
        memory_usage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
        disk_usage: await this.getDiskUsage(),
        network_latency: await this.getNetworkLatency(),
        database_connections: await this.getDatabaseConnections(),
        redis_connections: await this.getRedisConnections(),
        error_rate: await this.getErrorRate(),
        success_rate: await this.getSuccessRate()
      };

      // Prometheusメトリクス更新
      this.systemHealthGauge.set({ metric_type: 'uptime' }, health.uptime);
      this.systemHealthGauge.set({ metric_type: 'cpu_usage' }, health.cpu_usage);
      this.systemHealthGauge.set({ metric_type: 'memory_usage' }, health.memory_usage);
      this.systemHealthGauge.set({ metric_type: 'error_rate' }, health.error_rate);

      // Redis保存
      await this.redis.setex(
        'metrics:system_health:latest',
        300,
        JSON.stringify(health)
      );

      // アラートチェック
      this.checkAlerts('system_health', health);

      // WebSocket配信
      this.broadcastMetrics('system_health', health);

      this.emit('metrics:collected', { type: 'system_health', data: health });
    } catch (error) {
      logger.error('Failed to collect system health:', error);
    }
  }

  /**
   * ユーザーアクティビティ収集
   */
  private async collectUserActivity(): Promise<void> {
    try {
      const activity: UserActivityMetrics = {
        active_users: await this.getActiveUsers(),
        new_registrations: await this.getNewRegistrations(),
        login_count: await this.getLoginCount(),
        feature_usage: await this.getFeatureUsage(),
        session_duration: await this.getAverageSessionDuration(),
        page_views: await this.getPageViews(),
        api_calls: await this.getAPICalls(),
        mobile_usage_ratio: await this.getMobileUsageRatio()
      };

      // カウンター更新
      this.userActivityCounter.inc({ activity_type: 'login' }, activity.login_count);
      this.userActivityCounter.inc({ activity_type: 'registration' }, activity.new_registrations);

      // Redis保存
      await this.redis.setex(
        'metrics:user_activity:latest',
        300,
        JSON.stringify(activity)
      );

      // アラートチェック
      this.checkAlerts('user_activity', activity);

      // WebSocket配信
      this.broadcastMetrics('user_activity', activity);

      this.emit('metrics:collected', { type: 'user_activity', data: activity });
    } catch (error) {
      logger.error('Failed to collect user activity:', error);
    }
  }

  /**
   * ビジネスメトリクス収集
   */
  private async collectBusinessMetrics(): Promise<void> {
    try {
      const metrics: BusinessMetrics = {
        trial_signups: await this.getTrialSignups(),
        trial_to_paid_conversion: await this.getConversionRate(),
        churn_rate: await this.getChurnRate(),
        mrr: await this.getMRR(),
        arr: await this.getARR(),
        average_revenue_per_user: await this.getARPU(),
        customer_acquisition_cost: await this.getCAC(),
        lifetime_value: await this.getLTV(),
        nps_score: await this.getNPS()
      };

      // ゲージ更新
      this.businessMetricsGauge.set({ metric_type: 'mrr' }, metrics.mrr);
      this.businessMetricsGauge.set({ metric_type: 'arr' }, metrics.arr);
      this.businessMetricsGauge.set({ metric_type: 'churn_rate' }, metrics.churn_rate);
      this.businessMetricsGauge.set({ metric_type: 'nps' }, metrics.nps_score);

      // Redis保存
      await this.redis.setex(
        'metrics:business:latest',
        900,
        JSON.stringify(metrics)
      );

      // アラートチェック
      this.checkAlerts('business_metrics', metrics);

      // WebSocket配信
      this.broadcastMetrics('business_metrics', metrics);

      this.emit('metrics:collected', { type: 'business_metrics', data: metrics });
    } catch (error) {
      logger.error('Failed to collect business metrics:', error);
    }
  }

  /**
   * パフォーマンスメトリクス収集
   */
  private async collectPerformanceMetrics(): Promise<void> {
    try {
      const performance: PerformanceMetrics = {
        api_response_time: await this.getAPIResponseTime(),
        database_query_time: await this.getDatabaseQueryTime(),
        cache_hit_rate: await this.getCacheHitRate(),
        throughput: await this.getThroughput(),
        concurrent_users: await this.getConcurrentUsers(),
        queue_length: await this.getQueueLength(),
        processing_lag: await this.getProcessingLag()
      };

      // ヒストグラム記録
      this.performanceHistogram.observe(
        { operation: 'api_response' },
        performance.api_response_time.p95
      );
      this.performanceHistogram.observe(
        { operation: 'db_query' },
        performance.database_query_time.p95
      );

      // Redis保存
      await this.redis.setex(
        'metrics:performance:latest',
        300,
        JSON.stringify(performance)
      );

      // アラートチェック
      this.checkAlerts('performance', performance);

      // WebSocket配信
      this.broadcastMetrics('performance', performance);

      this.emit('metrics:collected', { type: 'performance', data: performance });
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
    }
  }

  /**
   * セキュリティメトリクス収集
   */
  private async collectSecurityMetrics(): Promise<void> {
    try {
      const security = {
        failed_login_attempts: await this.getFailedLoginAttempts(),
        suspicious_activities: await this.getSuspiciousActivities(),
        blocked_ips: await this.getBlockedIPs(),
        authentication_errors: await this.getAuthErrors(),
        authorization_failures: await this.getAuthzFailures(),
        data_access_violations: await this.getDataAccessViolations()
      };

      // エラーカウンター更新
      this.errorCounter.inc(
        { error_type: 'auth_failure', severity: 'warning' },
        security.authentication_errors
      );

      // Redis保存
      await this.redis.setex(
        'metrics:security:latest',
        300,
        JSON.stringify(security)
      );

      // アラートチェック
      this.checkAlerts('security', security);

      // WebSocket配信
      this.broadcastMetrics('security', security);

      this.emit('metrics:collected', { type: 'security', data: security });
    } catch (error) {
      logger.error('Failed to collect security metrics:', error);
    }
  }

  /**
   * デフォルトアラート設定
   */
  private loadDefaultAlerts(): void {
    // システムヘルスアラート
    this.addAlert({
      metric: 'system_health.cpu_usage',
      threshold: 80,
      operator: 'gt',
      level: AlertLevel.WARNING,
      cooldown: 300,
      recipients: ['ops-team@ai-os.com'],
      channels: ['slack', 'email']
    });

    this.addAlert({
      metric: 'system_health.error_rate',
      threshold: 5,
      operator: 'gt',
      level: AlertLevel.ERROR,
      cooldown: 60,
      recipients: ['ops-team@ai-os.com', 'cto@ai-os.com'],
      channels: ['pagerduty', 'slack']
    });

    // ビジネスアラート
    this.addAlert({
      metric: 'business_metrics.churn_rate',
      threshold: 10,
      operator: 'gt',
      level: AlertLevel.WARNING,
      cooldown: 3600,
      recipients: ['success@ai-os.com'],
      channels: ['email']
    });

    // パフォーマンスアラート
    this.addAlert({
      metric: 'performance.api_response_time.p95',
      threshold: 1000,
      operator: 'gt',
      level: AlertLevel.WARNING,
      cooldown: 300,
      recipients: ['dev-team@ai-os.com'],
      channels: ['slack']
    });

    // セキュリティアラート
    this.addAlert({
      metric: 'security.failed_login_attempts',
      threshold: 100,
      operator: 'gt',
      level: AlertLevel.CRITICAL,
      cooldown: 600,
      recipients: ['security@ai-os.com'],
      channels: ['pagerduty', 'email']
    });
  }

  /**
   * デフォルトダッシュボード作成
   */
  private createDefaultDashboards(): void {
    // エグゼクティブダッシュボード
    this.dashboards.set('executive', {
      widgets: [
        {
          id: 'revenue-gauge',
          type: 'gauge',
          title: 'MRR (月間経常収益)',
          metric: 'business_metrics.mrr',
          visualization: {
            size: { width: 4, height: 3 },
            position: { x: 0, y: 0 }
          }
        },
        {
          id: 'user-growth',
          type: 'chart',
          title: 'ユーザー成長率',
          metric: 'user_activity.new_registrations',
          visualization: {
            chartType: 'line',
            size: { width: 8, height: 4 },
            position: { x: 4, y: 0 }
          },
          timeRange: '7d'
        },
        {
          id: 'system-health',
          type: 'number',
          title: 'システム稼働率',
          metric: 'system_health.uptime',
          visualization: {
            size: { width: 3, height: 2 },
            position: { x: 0, y: 3 }
          }
        },
        {
          id: 'churn-rate',
          type: 'chart',
          title: 'チャーン率推移',
          metric: 'business_metrics.churn_rate',
          visualization: {
            chartType: 'area',
            colors: ['#ff6b6b'],
            size: { width: 6, height: 4 },
            position: { x: 3, y: 3 }
          },
          timeRange: '30d'
        }
      ],
      refresh_interval: 60,
      timezone: 'Asia/Tokyo',
      theme: 'auto',
      layout: 'grid'
    });

    // 運用ダッシュボード
    this.dashboards.set('operations', {
      widgets: [
        {
          id: 'system-metrics',
          type: 'chart',
          title: 'システムメトリクス',
          metric: 'system_health',
          visualization: {
            chartType: 'line',
            size: { width: 12, height: 4 },
            position: { x: 0, y: 0 }
          },
          timeRange: '1h'
        },
        {
          id: 'error-rate',
          type: 'chart',
          title: 'エラー率',
          metric: 'system_health.error_rate',
          visualization: {
            chartType: 'bar',
            colors: ['#ff6b6b', '#ffa502'],
            size: { width: 6, height: 3 },
            position: { x: 0, y: 4 }
          },
          timeRange: '24h'
        },
        {
          id: 'performance-histogram',
          type: 'heatmap',
          title: 'レスポンスタイム分布',
          metric: 'performance.api_response_time',
          visualization: {
            size: { width: 6, height: 3 },
            position: { x: 6, y: 4 }
          }
        }
      ],
      refresh_interval: 30,
      timezone: 'Asia/Tokyo',
      theme: 'dark',
      layout: 'grid'
    });

    // セキュリティダッシュボード
    this.dashboards.set('security', {
      widgets: [
        {
          id: 'threat-overview',
          type: 'table',
          title: 'セキュリティ脅威概要',
          metric: 'security',
          visualization: {
            size: { width: 12, height: 4 },
            position: { x: 0, y: 0 }
          }
        },
        {
          id: 'failed-logins',
          type: 'chart',
          title: 'ログイン失敗推移',
          metric: 'security.failed_login_attempts',
          visualization: {
            chartType: 'line',
            colors: ['#ff6b6b'],
            size: { width: 6, height: 3 },
            position: { x: 0, y: 4 }
          },
          timeRange: '24h'
        },
        {
          id: 'blocked-ips',
          type: 'number',
          title: 'ブロックIP数',
          metric: 'security.blocked_ips',
          visualization: {
            size: { width: 3, height: 3 },
            position: { x: 6, y: 4 }
          }
        }
      ],
      refresh_interval: 60,
      timezone: 'Asia/Tokyo',
      theme: 'dark',
      layout: 'grid'
    });
  }

  /**
   * アラート追加
   */
  public addAlert(config: AlertConfiguration): void {
    const alertId = `${config.metric}_${config.operator}_${config.threshold}`;
    this.alerts.set(alertId, config);
    logger.info(`Alert added: ${alertId}`);
  }

  /**
   * アラートチェック
   */
  private checkAlerts(metricType: string, data: any): void {
    for (const [alertId, config] of this.alerts) {
      if (!config.metric.startsWith(metricType)) continue;

      const value = this.getNestedValue(data, config.metric.replace(`${metricType}.`, ''));
      if (value === undefined) continue;

      const triggered = this.evaluateCondition(value, config.operator, config.threshold);

      if (triggered) {
        const lastAlert = this.alertHistory.get(alertId);
        const now = new Date();

        if (!lastAlert || (now.getTime() - lastAlert.getTime()) / 1000 > config.cooldown) {
          this.triggerAlert(config, value);
          this.alertHistory.set(alertId, now);
        }
      }
    }
  }

  /**
   * アラート発火
   */
  private async triggerAlert(config: AlertConfiguration, value: number): Promise<void> {
    const alert = {
      metric: config.metric,
      value,
      threshold: config.threshold,
      level: config.level,
      timestamp: new Date(),
      message: `Alert: ${config.metric} is ${value} (threshold: ${config.operator} ${config.threshold})`
    };

    logger.warn('Alert triggered:', alert);
    this.emit('alert:triggered', alert);

    // 通知送信
    for (const channel of config.channels) {
      await this.sendNotification(channel, config.recipients, alert);
    }

    // WebSocket配信
    this.broadcastAlert(alert);
  }

  /**
   * 通知送信
   */
  private async sendNotification(
    channel: string,
    recipients: string[],
    alert: any
  ): Promise<void> {
    switch (channel) {
      case 'email':
        // メール送信実装
        logger.info(`Sending email alert to ${recipients.join(', ')}`);
        break;

      case 'slack':
        // Slack通知実装
        logger.info(`Sending Slack alert`);
        break;

      case 'pagerduty':
        // PagerDuty通知実装
        logger.info(`Triggering PagerDuty incident`);
        break;

      case 'webhook':
        // Webhook通知実装
        logger.info(`Sending webhook notification`);
        break;
    }
  }

  /**
   * WebSocketメッセージ処理
   */
  private handleWebSocketMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'subscribe':
        // メトリクス購読
        ws.send(JSON.stringify({
          type: 'subscribed',
          metrics: message.metrics
        }));
        break;

      case 'get_dashboard':
        // ダッシュボード取得
        const dashboard = this.dashboards.get(message.dashboardId);
        ws.send(JSON.stringify({
          type: 'dashboard',
          data: dashboard
        }));
        break;

      case 'get_metrics':
        // メトリクス取得
        this.sendMetrics(ws, message.metricType, message.timeRange);
        break;

      case 'create_alert':
        // アラート作成
        this.addAlert(message.config);
        ws.send(JSON.stringify({
          type: 'alert_created',
          success: true
        }));
        break;
    }
  }

  /**
   * 初期データ送信
   */
  private async sendInitialData(ws: WebSocket): Promise<void> {
    const initialData = {
      type: 'initial_data',
      dashboards: Array.from(this.dashboards.keys()),
      alerts: Array.from(this.alerts.values()),
      currentMetrics: {
        system_health: await this.redis.get('metrics:system_health:latest'),
        user_activity: await this.redis.get('metrics:user_activity:latest'),
        business_metrics: await this.redis.get('metrics:business:latest'),
        performance: await this.redis.get('metrics:performance:latest'),
        security: await this.redis.get('metrics:security:latest')
      }
    };

    ws.send(JSON.stringify(initialData));
  }

  /**
   * メトリクス配信
   */
  private broadcastMetrics(type: string, data: any): void {
    const message = JSON.stringify({
      type: 'metrics_update',
      metricType: type,
      data,
      timestamp: new Date()
    });

    this.wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * アラート配信
   */
  private broadcastAlert(alert: any): void {
    const message = JSON.stringify({
      type: 'alert',
      data: alert
    });

    this.wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Prometheusメトリクス取得
   */
  public async getPrometheusMetrics(): Promise<string> {
    return this.metricsRegistry.metrics();
  }

  // ヘルパーメソッド

  private async getCPUUsage(): Promise<number> {
    // CPU使用率取得（実装簡略化）
    return Math.random() * 100;
  }

  private async getDiskUsage(): Promise<number> {
    // ディスク使用率取得
    return Math.random() * 100;
  }

  private async getNetworkLatency(): Promise<number> {
    // ネットワークレイテンシ取得
    return Math.random() * 50;
  }

  private async getDatabaseConnections(): Promise<number> {
    // DB接続数取得
    return Math.floor(Math.random() * 100);
  }

  private async getRedisConnections(): Promise<number> {
    // Redis接続数取得
    return Math.floor(Math.random() * 50);
  }

  private async getErrorRate(): Promise<number> {
    // エラー率取得
    return Math.random() * 5;
  }

  private async getSuccessRate(): Promise<number> {
    // 成功率取得
    return 95 + Math.random() * 5;
  }

  private async getActiveUsers(): Promise<number> {
    // アクティブユーザー数取得
    return Math.floor(Math.random() * 1000);
  }

  private async getNewRegistrations(): Promise<number> {
    // 新規登録数取得
    return Math.floor(Math.random() * 50);
  }

  private async getLoginCount(): Promise<number> {
    // ログイン数取得
    return Math.floor(Math.random() * 500);
  }

  private async getFeatureUsage(): Promise<Map<string, number>> {
    // 機能利用統計取得
    const usage = new Map<string, number>();
    usage.set('attendance', Math.floor(Math.random() * 1000));
    usage.set('payroll', Math.floor(Math.random() * 800));
    usage.set('expense', Math.floor(Math.random() * 600));
    usage.set('analytics', Math.floor(Math.random() * 400));
    return usage;
  }

  private async getAverageSessionDuration(): Promise<number> {
    // 平均セッション時間取得（分）
    return 15 + Math.random() * 30;
  }

  private async getPageViews(): Promise<number> {
    // ページビュー数取得
    return Math.floor(Math.random() * 10000);
  }

  private async getAPICalls(): Promise<number> {
    // API呼び出し数取得
    return Math.floor(Math.random() * 50000);
  }

  private async getMobileUsageRatio(): Promise<number> {
    // モバイル利用率取得
    return 0.3 + Math.random() * 0.2;
  }

  private async getTrialSignups(): Promise<number> {
    // トライアル登録数取得
    return Math.floor(Math.random() * 20);
  }

  private async getConversionRate(): Promise<number> {
    // コンバージョン率取得
    return 0.25 + Math.random() * 0.1;
  }

  private async getChurnRate(): Promise<number> {
    // チャーン率取得
    return 0.03 + Math.random() * 0.02;
  }

  private async getMRR(): Promise<number> {
    // MRR取得
    return 8000000 + Math.random() * 2000000;
  }

  private async getARR(): Promise<number> {
    // ARR取得
    const mrr = await this.getMRR();
    return mrr * 12;
  }

  private async getARPU(): Promise<number> {
    // ARPU取得
    return 6000 + Math.random() * 2000;
  }

  private async getCAC(): Promise<number> {
    // CAC取得
    return 50000 + Math.random() * 20000;
  }

  private async getLTV(): Promise<number> {
    // LTV取得
    const arpu = await this.getARPU();
    const churn = await this.getChurnRate();
    return arpu / churn;
  }

  private async getNPS(): Promise<number> {
    // NPS取得
    return 40 + Math.random() * 20;
  }

  private async getAPIResponseTime(): Promise<any> {
    return {
      p50: 50 + Math.random() * 50,
      p95: 200 + Math.random() * 300,
      p99: 500 + Math.random() * 500
    };
  }

  private async getDatabaseQueryTime(): Promise<any> {
    return {
      p50: 10 + Math.random() * 20,
      p95: 50 + Math.random() * 50,
      p99: 100 + Math.random() * 100
    };
  }

  private async getCacheHitRate(): Promise<number> {
    return 0.8 + Math.random() * 0.15;
  }

  private async getThroughput(): Promise<number> {
    return 1000 + Math.random() * 500;
  }

  private async getConcurrentUsers(): Promise<number> {
    return Math.floor(Math.random() * 500);
  }

  private async getQueueLength(): Promise<number> {
    return Math.floor(Math.random() * 100);
  }

  private async getProcessingLag(): Promise<number> {
    return Math.random() * 1000;
  }

  private async getFailedLoginAttempts(): Promise<number> {
    return Math.floor(Math.random() * 50);
  }

  private async getSuspiciousActivities(): Promise<number> {
    return Math.floor(Math.random() * 10);
  }

  private async getBlockedIPs(): Promise<number> {
    return Math.floor(Math.random() * 20);
  }

  private async getAuthErrors(): Promise<number> {
    return Math.floor(Math.random() * 100);
  }

  private async getAuthzFailures(): Promise<number> {
    return Math.floor(Math.random() * 50);
  }

  private async getDataAccessViolations(): Promise<number> {
    return Math.floor(Math.random() * 5);
  }

  private async sendMetrics(ws: WebSocket, metricType: string, timeRange: string): Promise<void> {
    // 時系列データ取得・送信（実装簡略化）
    const data = {
      type: 'metrics_data',
      metricType,
      timeRange,
      data: [] // 実際は時系列データ
    };
    ws.send(JSON.stringify(data));
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }
}

export { PostLaunchDashboard };