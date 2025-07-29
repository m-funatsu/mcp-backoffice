/**
 * AI-OS v3.2.0 高度な監査サービス
 * Advanced Audit Service
 * 
 * エンタープライズ向けの包括的な監査機能
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ===== 型定義 =====

export interface AuditRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  conditions: AuditCondition[];
  actions: AuditAction[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface AuditCondition {
  type: 'pattern' | 'threshold' | 'anomaly' | 'sequence' | 'time_based';
  parameters: Record<string, any>;
  operator?: 'AND' | 'OR';
}

export interface AuditAction {
  type: 'alert' | 'block' | 'require_approval' | 'escalate' | 'custom';
  parameters: Record<string, any>;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  entityType: string;
  entityId: string;
  action: string;
  userId: string;
  userRole?: string;
  userDepartment?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  changes?: {
    before: any;
    after: any;
  };
  metadata?: Record<string, any>;
  risk?: RiskAssessment;
  hash?: string; // ブロックチェーン用ハッシュ
  previousHash?: string; // 前のイベントのハッシュ
}

export interface RiskAssessment {
  score: number; // 0-100
  factors: RiskFactor[];
  anomalyDetected: boolean;
  requiresReview: boolean;
}

export interface RiskFactor {
  name: string;
  weight: number;
  value: number;
  description?: string;
}

export interface AuditSchedule {
  id: string;
  name: string;
  reportType: 'compliance' | 'security' | 'access' | 'changes' | 'custom';
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    time?: string; // HH:MM format
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
  };
  recipients: string[];
  filters?: AuditFilter[];
  enabled: boolean;
}

export interface AuditFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'nin' | 'regex';
  value: any;
}

export interface AnomalyDetectionModel {
  id: string;
  name: string;
  type: 'statistical' | 'ml_based' | 'rule_based';
  parameters: Record<string, any>;
  trainingData?: any[];
  lastTrained?: Date;
  accuracy?: number;
}

export interface AuditReport {
  id: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  type: string;
  summary: {
    totalEvents: number;
    riskEvents: number;
    anomalies: number;
    violations: number;
  };
  details: any;
  recommendations?: string[];
}

// ===== 異常検知エンジン =====

class AnomalyDetector {
  private models: Map<string, AnomalyDetectionModel>;
  private baselineMetrics: Map<string, BaselineMetric>;

  constructor() {
    this.models = new Map();
    this.baselineMetrics = new Map();
    this.initializeModels();
  }

  private initializeModels(): void {
    // 統計的異常検知モデル
    this.models.set('access_pattern', {
      id: 'model_access_pattern',
      name: 'Access Pattern Anomaly Detection',
      type: 'statistical',
      parameters: {
        threshold: 3, // 標準偏差
        windowSize: 7 * 24 * 60 * 60 * 1000, // 7日間
        minSamples: 100
      }
    });

    // 時系列異常検知モデル
    this.models.set('time_series', {
      id: 'model_time_series',
      name: 'Time Series Anomaly Detection',
      type: 'ml_based',
      parameters: {
        algorithm: 'isolation_forest',
        contamination: 0.1,
        features: ['hour_of_day', 'day_of_week', 'action_count', 'unique_resources']
      }
    });
  }

  async detectAnomaly(event: AuditEvent, historicalData: AuditEvent[]): Promise<{
    isAnomaly: boolean;
    score: number;
    reasons: string[];
  }> {
    const anomalyChecks = [
      this.checkAccessTimeAnomaly(event, historicalData),
      this.checkVolumeAnomaly(event, historicalData),
      this.checkPatternAnomaly(event, historicalData),
      this.checkGeographicAnomaly(event, historicalData)
    ];

    const results = await Promise.all(anomalyChecks);
    
    const anomalies = results.filter(r => r.isAnomaly);
    const maxScore = Math.max(...results.map(r => r.score));
    const reasons = anomalies.flatMap(r => r.reasons);

    return {
      isAnomaly: anomalies.length > 0,
      score: maxScore,
      reasons
    };
  }

  private checkAccessTimeAnomaly(
    event: AuditEvent, 
    historicalData: AuditEvent[]
  ): { isAnomaly: boolean; score: number; reasons: string[] } {
    const hour = event.timestamp.getHours();
    const dayOfWeek = event.timestamp.getDay();

    // 深夜〜早朝のアクセスは即座に異常とみなす
    if (hour >= 0 && hour < 6) {
      return {
        isAnomaly: true,
        score: 80,
        reasons: [`Unusual access time: ${hour}:00 (late night/early morning)`]
      };
    }

    // ユーザーの通常のアクセスパターンを分析
    const userHistory = historicalData.filter(e => e.userId === event.userId);
    if (userHistory.length < 10) {
      return { isAnomaly: false, score: 0, reasons: [] };
    }

    const accessHours = userHistory.map(e => e.timestamp.getHours());
    const avgHour = accessHours.reduce((a, b) => a + b, 0) / accessHours.length;
    const stdDev = Math.sqrt(
      accessHours.reduce((sum, h) => sum + Math.pow(h - avgHour, 2), 0) / accessHours.length
    );

    // 標準偏差が0の場合（全てのアクセスが同じ時間）のケースを処理
    const zScore = stdDev === 0 ? 
      (hour !== avgHour ? 5 : 0) : // 異なる時間なら異常とみなす
      Math.abs((hour - avgHour) / stdDev);
    const isAnomaly = zScore > 3;
    
    return {
      isAnomaly,
      score: isAnomaly ? Math.min(zScore * 20, 100) : 0,
      reasons: isAnomaly ? [`Unusual access time: ${hour}:00 (Z-score: ${zScore.toFixed(2)})`] : []
    };
  }

  private checkVolumeAnomaly(
    event: AuditEvent,
    historicalData: AuditEvent[]
  ): { isAnomaly: boolean; score: number; reasons: string[] } {
    // 直近1時間のアクティビティ量をチェック
    const oneHourAgo = new Date(event.timestamp.getTime() - 60 * 60 * 1000);
    const recentEvents = historicalData.filter(e => 
      e.userId === event.userId && 
      e.timestamp > oneHourAgo
    );

    const threshold = 100; // 1時間あたりの通常の最大イベント数
    const isAnomaly = recentEvents.length > threshold;

    return {
      isAnomaly,
      score: isAnomaly ? Math.min((recentEvents.length / threshold) * 50, 100) : 0,
      reasons: isAnomaly ? [`High volume: ${recentEvents.length} events in last hour`] : []
    };
  }

  private checkPatternAnomaly(
    event: AuditEvent,
    historicalData: AuditEvent[]
  ): { isAnomaly: boolean; score: number; reasons: string[] } {
    // アクションシーケンスの異常を検出
    const userHistory = historicalData
      .filter(e => e.userId === event.userId)
      .slice(-10)
      .map(e => e.action);

    // 通常見られないアクションの組み合わせをチェック
    const suspiciousPatterns = [
      ['login', 'export_all_data'],
      ['permission_change', 'bulk_delete'],
      ['config_update', 'disable_audit']
    ];

    let isAnomaly = false;
    const reasons: string[] = [];

    for (const pattern of suspiciousPatterns) {
      if (pattern.every(action => userHistory.includes(action))) {
        isAnomaly = true;
        reasons.push(`Suspicious pattern detected: ${pattern.join(' -> ')}`);
      }
    }

    return {
      isAnomaly,
      score: isAnomaly ? 80 : 0,
      reasons
    };
  }

  private checkGeographicAnomaly(
    event: AuditEvent,
    historicalData: AuditEvent[]
  ): { isAnomaly: boolean; score: number; reasons: string[] } {
    if (!event.ipAddress) {
      return { isAnomaly: false, score: 0, reasons: [] };
    }

    // IPアドレスから地理的位置を推定（簡略化）
    const getCountryFromIP = (ip: string): string => {
      // 実際の実装ではGeoIP APIを使用
      return 'JP';
    };

    const currentCountry = getCountryFromIP(event.ipAddress);
    const userHistory = historicalData
      .filter(e => e.userId === event.userId && e.ipAddress)
      .slice(-20);

    const countries = userHistory.map(e => getCountryFromIP(e.ipAddress!));
    const uniqueCountries = new Set(countries);

    const isNewCountry = !countries.includes(currentCountry);
    const isAnomaly = isNewCountry && uniqueCountries.size <= 2;

    return {
      isAnomaly,
      score: isAnomaly ? 70 : 0,
      reasons: isAnomaly ? [`Access from new country: ${currentCountry}`] : []
    };
  }
}

interface BaselineMetric {
  metric: string;
  mean: number;
  stdDev: number;
  lastUpdated: Date;
  sampleCount: number;
}

// ===== ブロックチェーン監査証跡 =====

class AuditBlockchain {
  private chain: AuditBlock[];
  private currentBlock: AuditBlock | null;
  
  constructor() {
    this.chain = [];
    this.currentBlock = null;
    this.createGenesisBlock();
  }

  private createGenesisBlock(): void {
    const genesis: AuditBlock = {
      index: 0,
      timestamp: new Date(),
      events: [],
      previousHash: '0',
      hash: this.calculateHash('0', []),
      nonce: 0
    };
    
    this.chain.push(genesis);
  }

  addEvent(event: AuditEvent): string {
    if (!this.currentBlock || this.currentBlock.events.length >= 100) {
      this.createNewBlock();
    }

    const eventWithHash = {
      ...event,
      hash: this.calculateEventHash(event),
      previousHash: this.currentBlock!.events.length > 0 
        ? this.currentBlock!.events[this.currentBlock!.events.length - 1].hash 
        : this.currentBlock!.hash
    };

    this.currentBlock!.events.push(eventWithHash);
    return eventWithHash.hash!;
  }

  private createNewBlock(): void {
    if (this.currentBlock) {
      this.currentBlock.hash = this.mineBlock(this.currentBlock);
      this.chain.push(this.currentBlock);
    }

    const previousBlock = this.chain[this.chain.length - 1];
    this.currentBlock = {
      index: previousBlock.index + 1,
      timestamp: new Date(),
      events: [],
      previousHash: previousBlock.hash,
      hash: '',
      nonce: 0
    };
  }

  private calculateHash(previousHash: string, events: AuditEvent[]): string {
    const data = previousHash + JSON.stringify(events);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateEventHash(event: AuditEvent): string {
    const eventData = {
      timestamp: event.timestamp,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      userId: event.userId,
      changes: event.changes
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(eventData))
      .digest('hex');
  }

  private mineBlock(block: AuditBlock): string {
    // 簡易的なProof of Work（実用では不要かも）
    const difficulty = 2;
    const prefix = '0'.repeat(difficulty);
    
    while (true) {
      const hash = crypto.createHash('sha256')
        .update(block.previousHash + JSON.stringify(block.events) + block.nonce)
        .digest('hex');
      
      if (hash.startsWith(prefix)) {
        return hash;
      }
      
      block.nonce++;
    }
  }

  verifyChain(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];
      
      // ハッシュの検証
      const recalculatedHash = this.calculateHash(currentBlock.previousHash, currentBlock.events);
      if (currentBlock.hash !== recalculatedHash) {
        return false;
      }
      
      // 前のブロックとの連続性を検証
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    
    return true;
  }
}

interface AuditBlock {
  index: number;
  timestamp: Date;
  events: AuditEvent[];
  previousHash: string;
  hash: string;
  nonce: number;
}

// ===== メインサービスクラス =====

export class AdvancedAuditService extends EventEmitter {
  private auditRules: Map<string, AuditRule>;
  private schedules: Map<string, AuditSchedule>;
  private anomalyDetector: AnomalyDetector;
  private blockchain: AuditBlockchain;
  private eventStore: AuditEvent[];
  private scheduledJobs: Map<string, NodeJS.Timeout>;

  constructor() {
    super();
    this.auditRules = new Map();
    this.schedules = new Map();
    this.anomalyDetector = new AnomalyDetector();
    this.blockchain = new AuditBlockchain();
    this.eventStore = [];
    this.scheduledJobs = new Map();
    
    this.initializeDefaultRules();
  }

  /**
   * デフォルト監査ルールの初期化
   */
  private initializeDefaultRules(): void {
    // 高リスクアクション検出ルール
    this.createAuditRule({
      name: 'High Risk Actions',
      description: 'Detect high-risk administrative actions',
      enabled: true,
      conditions: [{
        type: 'pattern',
        parameters: {
          actions: ['delete_all', 'disable_security', 'export_sensitive_data'],
          matchType: 'any'
        }
      }],
      actions: [{
        type: 'alert',
        parameters: {
          severity: 'critical',
          recipients: ['security@company.com']
        }
      }, {
        type: 'require_approval',
        parameters: {
          approvers: ['ciso', 'cto']
        }
      }],
      severity: 'critical',
      createdBy: 'system'
    });

    // 異常アクセスパターン検出ルール
    this.createAuditRule({
      name: 'Anomalous Access Pattern',
      description: 'Detect unusual access patterns',
      enabled: true,
      conditions: [{
        type: 'anomaly',
        parameters: {
          threshold: 80,
          factors: ['time', 'volume', 'location']
        }
      }],
      actions: [{
        type: 'alert',
        parameters: {
          severity: 'high',
          recipients: ['security@company.com']
        }
      }],
      severity: 'high',
      createdBy: 'system'
    });

    // 連続失敗試行検出ルール
    this.createAuditRule({
      name: 'Failed Attempts Threshold',
      description: 'Detect multiple failed login attempts',
      enabled: true,
      conditions: [{
        type: 'threshold',
        parameters: {
          metric: 'failed_login_count',
          threshold: 5,
          timeWindow: 300000 // 5分
        }
      }],
      actions: [{
        type: 'block',
        parameters: {
          duration: 900000 // 15分
        }
      }, {
        type: 'alert',
        parameters: {
          severity: 'medium'
        }
      }],
      severity: 'medium',
      createdBy: 'system'
    });
  }

  /**
   * 監査イベントの記録
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp' | 'risk'>): Promise<AuditEvent> {
    const fullEvent: AuditEvent = {
      ...event,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    // リスク評価
    const riskAssessment = await this.assessRisk(fullEvent);
    fullEvent.risk = riskAssessment;

    // 異常検知
    const anomaly = await this.anomalyDetector.detectAnomaly(
      fullEvent,
      this.getRecentEvents(1000)
    );

    if (anomaly.isAnomaly) {
      fullEvent.risk = {
        ...fullEvent.risk!,
        anomalyDetected: true,
        score: Math.max(fullEvent.risk!.score, anomaly.score)
      };
    }

    // ブロックチェーンに記録
    const hash = this.blockchain.addEvent(fullEvent);
    fullEvent.hash = hash;

    // イベントストアに保存
    this.eventStore.push(fullEvent);

    // ルール評価
    await this.evaluateRules(fullEvent);

    this.emit('audit:logged', fullEvent);

    return fullEvent;
  }

  /**
   * リスク評価
   */
  private async assessRisk(event: AuditEvent): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let totalScore = 0;

    // アクションリスク
    const actionRisk = this.calculateActionRisk(event.action);
    factors.push({
      name: 'Action Risk',
      weight: 0.3,
      value: actionRisk,
      description: `Risk level for action: ${event.action}`
    });
    totalScore += actionRisk * 0.3;

    // 時間帯リスク
    const timeRisk = this.calculateTimeRisk(event.timestamp);
    factors.push({
      name: 'Time Risk',
      weight: 0.2,
      value: timeRisk,
      description: 'Access during unusual hours'
    });
    totalScore += timeRisk * 0.2;

    // データ感度リスク
    const dataRisk = this.calculateDataSensitivityRisk(event);
    factors.push({
      name: 'Data Sensitivity',
      weight: 0.3,
      value: dataRisk,
      description: 'Sensitivity of accessed data'
    });
    totalScore += dataRisk * 0.3;

    // ユーザー信頼度
    const trustScore = await this.calculateUserTrustScore(event.userId);
    const trustRisk = 100 - trustScore;
    factors.push({
      name: 'User Trust',
      weight: 0.2,
      value: trustRisk,
      description: 'User trust level'
    });
    totalScore += trustRisk * 0.2;

    return {
      score: Math.round(totalScore),
      factors,
      anomalyDetected: false,
      requiresReview: totalScore > 70
    };
  }

  /**
   * アクションリスクの計算
   */
  private calculateActionRisk(action: string): number {
    const riskMap: Record<string, number> = {
      'delete': 80,
      'delete_all': 100,
      'export': 60,
      'export_sensitive': 90,
      'permission_grant': 70,
      'config_update': 50,
      'login': 10,
      'view': 5,
      'create': 20,
      'update': 30
    };

    return riskMap[action] || 50;
  }

  /**
   * 時間帯リスクの計算
   */
  private calculateTimeRisk(timestamp: Date): number {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();

    // 深夜・早朝（0-6時）は高リスク
    if (hour >= 0 && hour < 6) {
      return 80;
    }

    // 週末は中リスク
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 50;
    }

    // 営業時間外（18-24時）は中リスク
    if (hour >= 18) {
      return 40;
    }

    // 営業時間内は低リスク
    return 10;
  }

  /**
   * データ感度リスクの計算
   */
  private calculateDataSensitivityRisk(event: AuditEvent): number {
    const sensitiveEntities = ['payroll', 'personal_info', 'financial', 'medical'];
    const sensitiveActions = ['export', 'delete', 'update'];

    let risk = 0;

    if (sensitiveEntities.some(e => event.entityType.includes(e))) {
      risk += 50;
    }

    if (sensitiveActions.includes(event.action)) {
      risk += 30;
    }

    return Math.min(risk, 100);
  }

  /**
   * ユーザー信頼スコアの計算
   */
  private async calculateUserTrustScore(userId: string): Promise<number> {
    const userEvents = this.eventStore.filter(e => e.userId === userId);
    
    if (userEvents.length < 10) {
      return 50; // 新規ユーザーは中立的なスコア
    }

    let score = 100;

    // 過去の違反
    const violations = userEvents.filter(e => e.risk && e.risk.score > 80);
    score -= violations.length * 5;

    // 異常検知の履歴
    const anomalies = userEvents.filter(e => e.risk?.anomalyDetected);
    score -= anomalies.length * 3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 監査ルールの評価
   */
  private async evaluateRules(event: AuditEvent): Promise<void> {
    for (const rule of this.auditRules.values()) {
      if (!rule.enabled) continue;

      const matched = await this.evaluateConditions(rule.conditions, event);
      
      if (matched) {
        await this.executeActions(rule.actions, event, rule);
        this.emit('rule:triggered', { rule, event });
      }
    }
  }

  /**
   * 条件の評価
   */
  private async evaluateConditions(
    conditions: AuditCondition[],
    event: AuditEvent
  ): Promise<boolean> {
    const results: boolean[] = [];

    for (const condition of conditions) {
      let result = false;

      switch (condition.type) {
        case 'pattern':
          result = this.evaluatePatternCondition(condition.parameters, event);
          break;
        case 'threshold':
          result = await this.evaluateThresholdCondition(condition.parameters, event);
          break;
        case 'anomaly':
          result = event.risk?.anomalyDetected || false;
          break;
        case 'sequence':
          result = await this.evaluateSequenceCondition(condition.parameters, event);
          break;
        case 'time_based':
          result = this.evaluateTimeBasedCondition(condition.parameters, event);
          break;
      }

      results.push(result);
    }

    // デフォルトはAND条件
    return results.every(r => r);
  }

  /**
   * パターン条件の評価
   */
  private evaluatePatternCondition(parameters: any, event: AuditEvent): boolean {
    const { actions, entities, matchType = 'all' } = parameters;

    const actionMatch = !actions || actions.includes(event.action);
    const entityMatch = !entities || entities.includes(event.entityType);

    if (matchType === 'any') {
      return actionMatch || entityMatch;
    } else {
      return actionMatch && entityMatch;
    }
  }

  /**
   * 閾値条件の評価
   */
  private async evaluateThresholdCondition(
    parameters: any, 
    event: AuditEvent
  ): Promise<boolean> {
    const { metric, threshold, timeWindow } = parameters;
    const windowStart = new Date(Date.now() - timeWindow);

    const relevantEvents = this.eventStore.filter(e => 
      e.userId === event.userId &&
      e.timestamp > windowStart
    );

    let value = 0;
    switch (metric) {
      case 'event_count':
        value = relevantEvents.length;
        break;
      case 'failed_login_count':
        value = relevantEvents.filter(e => 
          e.action === 'login' && e.metadata?.success === false
        ).length;
        break;
      case 'risk_score':
        value = Math.max(...relevantEvents.map(e => e.risk?.score || 0));
        break;
    }

    return value >= threshold;
  }

  /**
   * シーケンス条件の評価
   */
  private async evaluateSequenceCondition(
    parameters: any,
    event: AuditEvent
  ): Promise<boolean> {
    const { sequence, timeWindow } = parameters;
    const windowStart = new Date(Date.now() - timeWindow);

    const userEvents = this.eventStore
      .filter(e => 
        e.userId === event.userId &&
        e.timestamp > windowStart
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(e => e.action);

    // シーケンスパターンのマッチング
    let sequenceIndex = 0;
    for (const action of userEvents) {
      if (action === sequence[sequenceIndex]) {
        sequenceIndex++;
        if (sequenceIndex === sequence.length) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 時間ベース条件の評価
   */
  private evaluateTimeBasedCondition(parameters: any, event: AuditEvent): boolean {
    const { allowedHours, allowedDays, timezone = 'Asia/Tokyo' } = parameters;
    
    const hour = event.timestamp.getHours();
    const day = event.timestamp.getDay();

    if (allowedHours && !allowedHours.includes(hour)) {
      return false;
    }

    if (allowedDays && !allowedDays.includes(day)) {
      return false;
    }

    return true;
  }

  /**
   * アクションの実行
   */
  private async executeActions(
    actions: AuditAction[],
    event: AuditEvent,
    rule: AuditRule
  ): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'alert':
          await this.sendAlert(action.parameters, event, rule);
          break;
        case 'block':
          await this.blockAccess(action.parameters, event);
          break;
        case 'require_approval':
          await this.requireApproval(action.parameters, event);
          break;
        case 'escalate':
          await this.escalate(action.parameters, event, rule);
          break;
        case 'custom':
          await this.executeCustomAction(action.parameters, event);
          break;
      }
    }
  }

  /**
   * アラート送信
   */
  private async sendAlert(parameters: any, event: AuditEvent, rule: AuditRule): Promise<void> {
    const { severity, recipients, message } = parameters;
    
    const alert = {
      id: `alert_${Date.now()}`,
      timestamp: new Date(),
      severity,
      rule: rule.name,
      event,
      message: message || `Audit rule "${rule.name}" triggered`,
      recipients
    };

    this.emit('alert:sent', alert);
  }

  /**
   * アクセスブロック
   */
  private async blockAccess(parameters: any, event: AuditEvent): Promise<void> {
    const { duration, scope = 'user' } = parameters;
    
    const block = {
      id: `block_${Date.now()}`,
      userId: event.userId,
      scope,
      startTime: new Date(),
      endTime: new Date(Date.now() + duration),
      reason: `Audit rule violation: ${event.action}`
    };

    this.emit('access:blocked', block);
  }

  /**
   * 承認要求
   */
  private async requireApproval(parameters: any, event: AuditEvent): Promise<void> {
    const { approvers, timeout = 3600000 } = parameters; // デフォルト1時間
    
    const approval = {
      id: `approval_${Date.now()}`,
      event,
      approvers,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + timeout),
      status: 'pending'
    };

    this.emit('approval:required', approval);
  }

  /**
   * エスカレーション
   */
  private async escalate(parameters: any, event: AuditEvent, rule: AuditRule): Promise<void> {
    const { level, assignee } = parameters;
    
    const escalation = {
      id: `escalation_${Date.now()}`,
      level,
      assignee,
      event,
      rule: rule.name,
      createdAt: new Date(),
      status: 'open'
    };

    this.emit('escalation:created', escalation);
  }

  /**
   * カスタムアクション実行
   */
  private async executeCustomAction(parameters: any, event: AuditEvent): Promise<void> {
    const { script, webhook } = parameters;
    
    if (webhook) {
      // Webhook呼び出し
      this.emit('webhook:call', { url: webhook, payload: event });
    }

    if (script) {
      // カスタムスクリプト実行（セキュリティ注意）
      this.emit('script:execute', { script, context: event });
    }
  }

  /**
   * 監査ルールの作成
   */
  createAuditRule(ruleData: Omit<AuditRule, 'id' | 'createdAt' | 'updatedAt'>): AuditRule {
    const rule: AuditRule = {
      ...ruleData,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.auditRules.set(rule.id, rule);
    this.emit('rule:created', rule);

    return rule;
  }

  /**
   * スケジュールレポートの作成
   */
  createScheduledReport(schedule: Omit<AuditSchedule, 'id'>): AuditSchedule {
    const fullSchedule: AuditSchedule = {
      ...schedule,
      id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.schedules.set(fullSchedule.id, fullSchedule);
    
    if (fullSchedule.enabled) {
      this.scheduleReport(fullSchedule);
    }

    this.emit('schedule:created', fullSchedule);

    return fullSchedule;
  }

  /**
   * レポートのスケジューリング
   */
  private scheduleReport(schedule: AuditSchedule): void {
    const calculateNextRun = (): Date => {
      const now = new Date();
      const next = new Date(now);

      switch (schedule.schedule.frequency) {
        case 'daily':
          next.setDate(next.getDate() + 1);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + 1);
          break;
        case 'quarterly':
          next.setMonth(next.getMonth() + 3);
          break;
      }

      if (schedule.schedule.time) {
        const [hours, minutes] = schedule.schedule.time.split(':').map(Number);
        next.setHours(hours, minutes, 0, 0);
      }

      return next;
    };

    const runReport = async () => {
      const report = await this.generateReport(schedule.reportType, {
        filters: schedule.filters,
        period: this.getReportPeriod(schedule.schedule.frequency)
      });

      // レポート送信
      this.emit('report:generated', {
        report,
        recipients: schedule.recipients,
        schedule
      });

      // 次回実行をスケジュール
      const nextRun = calculateNextRun();
      const delay = nextRun.getTime() - Date.now();
      
      const timeoutId = setTimeout(() => runReport(), delay);
      this.scheduledJobs.set(schedule.id, timeoutId);
    };

    // 初回実行
    const nextRun = calculateNextRun();
    const delay = nextRun.getTime() - Date.now();
    
    const timeoutId = setTimeout(() => runReport(), delay);
    this.scheduledJobs.set(schedule.id, timeoutId);
  }

  /**
   * レポート生成
   */
  async generateReport(
    type: string,
    options: any
  ): Promise<AuditReport> {
    const { filters, period } = options;
    
    // フィルタリング
    let events = this.eventStore.filter(e => 
      e.timestamp >= period.start && e.timestamp <= period.end
    );

    if (filters) {
      events = this.applyFilters(events, filters);
    }

    // レポート内容の生成
    const summary = {
      totalEvents: events.length,
      riskEvents: events.filter(e => e.risk && e.risk.score > 70).length,
      anomalies: events.filter(e => e.risk?.anomalyDetected).length,
      violations: events.filter(e => e.metadata?.violation).length
    };

    const details = this.generateReportDetails(type, events);
    const recommendations = this.generateRecommendations(events);

    const report: AuditReport = {
      id: `report_${Date.now()}`,
      generatedAt: new Date(),
      period,
      type,
      summary,
      details,
      recommendations
    };

    return report;
  }

  /**
   * フィルタ適用
   */
  private applyFilters(events: AuditEvent[], filters: AuditFilter[]): AuditEvent[] {
    return events.filter(event => {
      return filters.every(filter => {
        const value = this.getNestedValue(event, filter.field);
        
        switch (filter.operator) {
          case 'eq':
            return value === filter.value;
          case 'ne':
            return value !== filter.value;
          case 'gt':
            return value > filter.value;
          case 'lt':
            return value < filter.value;
          case 'gte':
            return value >= filter.value;
          case 'lte':
            return value <= filter.value;
          case 'in':
            return filter.value.includes(value);
          case 'nin':
            return !filter.value.includes(value);
          case 'regex':
            return new RegExp(filter.value).test(String(value));
          default:
            return true;
        }
      });
    });
  }

  /**
   * ネストされた値の取得
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * レポート詳細の生成
   */
  private generateReportDetails(type: string, events: AuditEvent[]): any {
    switch (type) {
      case 'compliance':
        return this.generateComplianceDetails(events);
      case 'security':
        return this.generateSecurityDetails(events);
      case 'access':
        return this.generateAccessDetails(events);
      case 'changes':
        return this.generateChangeDetails(events);
      default:
        return { events: events.slice(0, 100) }; // 最新100件
    }
  }

  /**
   * コンプライアンスレポート詳細
   */
  private generateComplianceDetails(events: AuditEvent[]): any {
    const violations = events.filter(e => e.metadata?.violation);
    const byType = this.groupBy(violations, 'entityType');
    const byUser = this.groupBy(violations, 'userId');

    return {
      violationsByType: Object.entries(byType).map(([type, items]) => ({
        type,
        count: items.length,
        severity: this.calculateAverageSeverity(items)
      })),
      topViolators: Object.entries(byUser)
        .map(([userId, items]) => ({
          userId,
          violationCount: items.length
        }))
        .sort((a, b) => b.violationCount - a.violationCount)
        .slice(0, 10)
    };
  }

  /**
   * セキュリティレポート詳細
   */
  private generateSecurityDetails(events: AuditEvent[]): any {
    const securityEvents = events.filter(e => 
      e.risk && (e.risk.score > 50 || e.risk.anomalyDetected)
    );

    return {
      highRiskEvents: securityEvents.filter(e => e.risk!.score > 80),
      anomalies: securityEvents.filter(e => e.risk!.anomalyDetected),
      topRiskFactors: this.aggregateRiskFactors(securityEvents),
      failedLogins: events.filter(e => 
        e.action === 'login' && e.metadata?.success === false
      ).length
    };
  }

  /**
   * アクセスレポート詳細
   */
  private generateAccessDetails(events: AuditEvent[]): any {
    const accessEvents = events.filter(e => 
      ['login', 'logout', 'access'].includes(e.action)
    );

    return {
      uniqueUsers: new Set(accessEvents.map(e => e.userId)).size,
      accessByHour: this.groupByHour(accessEvents),
      accessByResource: this.groupBy(accessEvents, 'entityType'),
      unusualAccess: accessEvents.filter(e => 
        e.risk && e.risk.factors.some(f => f.name === 'Time Risk' && f.value > 50)
      )
    };
  }

  /**
   * 変更レポート詳細
   */
  private generateChangeDetails(events: AuditEvent[]): any {
    const changeEvents = events.filter(e => 
      ['create', 'update', 'delete'].includes(e.action)
    );

    return {
      totalChanges: changeEvents.length,
      changesByType: this.groupBy(changeEvents, 'action'),
      changesByEntity: this.groupBy(changeEvents, 'entityType'),
      criticalChanges: changeEvents.filter(e => 
        e.risk && e.risk.score > 70
      )
    };
  }

  /**
   * 推奨事項の生成
   */
  private generateRecommendations(events: AuditEvent[]): string[] {
    const recommendations: string[] = [];

    // 高リスクイベントが多い場合
    const highRiskCount = events.filter(e => e.risk && e.risk.score > 80).length;
    if (highRiskCount > events.length * 0.1) {
      recommendations.push('高リスクイベントが全体の10%を超えています。セキュリティポリシーの見直しを推奨します。');
    }

    // 異常検知が頻繁な場合
    const anomalyCount = events.filter(e => e.risk?.anomalyDetected).length;
    if (anomalyCount > events.length * 0.05) {
      recommendations.push('異常検知が頻繁に発生しています。ベースラインの再評価を検討してください。');
    }

    // 特定ユーザーの違反が多い場合
    const userViolations = this.groupBy(
      events.filter(e => e.metadata?.violation),
      'userId'
    );
    
    Object.entries(userViolations).forEach(([userId, violations]) => {
      if (violations.length > 10) {
        recommendations.push(`ユーザー ${userId} の違反が多発しています。追加のトレーニングが必要です。`);
      }
    });

    return recommendations;
  }

  /**
   * レポート期間の取得
   */
  private getReportPeriod(frequency: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();

    switch (frequency) {
      case 'daily':
        start.setDate(start.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(start.getDate() - 7);
        break;
      case 'monthly':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarterly':
        start.setMonth(start.getMonth() - 3);
        break;
    }

    return { start, end };
  }

  /**
   * グループ化ヘルパー
   */
  private groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
    return items.reduce((groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  /**
   * 時間別グループ化
   */
  private groupByHour(events: AuditEvent[]): Record<number, number> {
    const hourCounts: Record<number, number> = {};
    
    for (let i = 0; i < 24; i++) {
      hourCounts[i] = 0;
    }

    events.forEach(event => {
      const hour = event.timestamp.getHours();
      hourCounts[hour]++;
    });

    return hourCounts;
  }

  /**
   * 平均重要度の計算
   */
  private calculateAverageSeverity(events: AuditEvent[]): number {
    if (events.length === 0) return 0;
    
    const total = events.reduce((sum, event) => 
      sum + (event.risk?.score || 0), 0
    );
    
    return total / events.length;
  }

  /**
   * リスク要因の集計
   */
  private aggregateRiskFactors(events: AuditEvent[]): Array<{
    factor: string;
    totalScore: number;
    occurrences: number;
  }> {
    const factorMap = new Map<string, { totalScore: number; count: number }>();

    events.forEach(event => {
      if (event.risk?.factors) {
        event.risk.factors.forEach(factor => {
          const existing = factorMap.get(factor.name) || { totalScore: 0, count: 0 };
          factorMap.set(factor.name, {
            totalScore: existing.totalScore + factor.value,
            count: existing.count + 1
          });
        });
      }
    });

    return Array.from(factorMap.entries())
      .map(([factor, data]) => ({
        factor,
        totalScore: data.totalScore,
        occurrences: data.count
      }))
      .sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * 最近のイベント取得
   */
  private getRecentEvents(limit: number): AuditEvent[] {
    return this.eventStore
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * ブロックチェーンの検証
   */
  verifyAuditTrail(): boolean {
    return this.blockchain.verifyChain();
  }

  /**
   * 監査証跡のエクスポート
   */
  exportAuditTrail(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): any {
    const events = this.eventStore.filter(e => 
      e.timestamp >= startDate && e.timestamp <= endDate
    );

    switch (format) {
      case 'json':
        return events;
      case 'csv':
        return this.convertToCSV(events);
      case 'pdf':
        // PDF生成ロジック（実装省略）
        return { format: 'pdf', data: 'base64_encoded_pdf' };
    }
  }

  /**
   * CSV変換
   */
  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      'ID', 'Timestamp', 'User ID', 'Action', 'Entity Type', 
      'Entity ID', 'Risk Score', 'Anomaly Detected'
    ];

    const rows = events.map(e => [
      e.id,
      e.timestamp.toISOString(),
      e.userId,
      e.action,
      e.entityType,
      e.entityId,
      e.risk?.score || 0,
      e.risk?.anomalyDetected || false
    ]);

    return [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
  }
}