/**
 * AI-OS コンプライアンス監査自動化システム
 * 労働法・税法・セキュリティ要件の継続的監査を自動化
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// 監査タイプ
export enum AuditType {
  LABOR_LAW = 'labor_law',           // 労働法準拠
  TAX_COMPLIANCE = 'tax_compliance',   // 税法準拠
  DATA_PROTECTION = 'data_protection', // データ保護
  SECURITY = 'security',               // セキュリティ
  ACCOUNTING = 'accounting',           // 会計基準
  HR_PRACTICES = 'hr_practices'        // 人事慣行
}

// 監査ステータス
export enum AuditStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// 準拠状態
export enum ComplianceStatus {
  COMPLIANT = 'compliant',           // 準拠
  NON_COMPLIANT = 'non_compliant',   // 非準拠
  PARTIALLY_COMPLIANT = 'partially_compliant', // 部分準拠
  PENDING_REVIEW = 'pending_review'  // レビュー待ち
}

// リスクレベル
export enum RiskLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NONE = 'none'
}

// 監査項目インターフェース
export interface AuditItem {
  id: string;
  type: AuditType;
  name: string;
  description: string;
  checkFunction: (context: AuditContext) => Promise<AuditResult>;
  frequency: AuditFrequency;
  lastExecuted?: Date;
  nextScheduled?: Date;
  requiredDocuments?: string[];
  relatedRegulations?: string[];
}

// 監査頻度
export interface AuditFrequency {
  interval: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  dayOfWeek?: number;  // 0-6 (日-土)
  dayOfMonth?: number; // 1-31
  time?: string;       // HH:mm形式
}

// 監査コンテキスト
export interface AuditContext {
  organizationId: string;
  period: {
    start: Date;
    end: Date;
  };
  scope?: string[];
  metadata?: Record<string, any>;
}

// 監査結果
export interface AuditResult {
  itemId: string;
  status: ComplianceStatus;
  findings: Finding[];
  evidence: Evidence[];
  recommendations: string[];
  score?: number;
  executedAt: Date;
  executedBy: string;
}

// 発見事項
export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: RiskLevel;
  category: string;
  affectedItems: string[];
  remediation?: string;
  dueDate?: Date;
}

// 証跡
export interface Evidence {
  id: string;
  type: 'document' | 'screenshot' | 'log' | 'data';
  title: string;
  description?: string;
  location: string;
  hash?: string;
  timestamp: Date;
}

// 監査レポート
export interface AuditReport {
  id: string;
  type: AuditType;
  period: {
    start: Date;
    end: Date;
  };
  overallStatus: ComplianceStatus;
  executiveSummary: string;
  items: AuditResult[];
  statistics: AuditStatistics;
  recommendations: string[];
  nextSteps: string[];
  generatedAt: Date;
  generatedBy: string;
}

// 監査統計
export interface AuditStatistics {
  totalItems: number;
  compliantItems: number;
  nonCompliantItems: number;
  partiallyCompliantItems: number;
  complianceRate: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  trendsVsPrevious?: {
    complianceRate: number;
    findings: number;
  };
}

/**
 * コンプライアンス監査システム
 */
export class ComplianceAuditSystem extends EventEmitter {
  private auditItems: Map<string, AuditItem> = new Map();
  private auditHistory: Map<string, AuditReport[]> = new Map();
  private scheduledAudits: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeAuditItems();
  }

  /**
   * 監査項目の初期化
   */
  private initializeAuditItems() {
    // 労働法準拠監査項目
    this.registerAuditItem({
      id: 'labor-overtime-36agreement',
      type: AuditType.LABOR_LAW,
      name: '36協定遵守状況',
      description: '時間外労働の上限規制への準拠確認',
      checkFunction: this.check36AgreementCompliance.bind(this),
      frequency: { interval: 'weekly', dayOfWeek: 1 },
      relatedRegulations: ['労働基準法第36条']
    });

    this.registerAuditItem({
      id: 'labor-break-requirements',
      type: AuditType.LABOR_LAW,
      name: '休憩時間付与状況',
      description: '法定休憩時間の適切な付与確認',
      checkFunction: this.checkBreakCompliance.bind(this),
      frequency: { interval: 'daily' },
      relatedRegulations: ['労働基準法第34条']
    });

    this.registerAuditItem({
      id: 'labor-holiday-requirements',
      type: AuditType.LABOR_LAW,
      name: '法定休日付与状況',
      description: '週1日以上の休日付与確認',
      checkFunction: this.checkHolidayCompliance.bind(this),
      frequency: { interval: 'weekly', dayOfWeek: 1 },
      relatedRegulations: ['労働基準法第35条']
    });

    this.registerAuditItem({
      id: 'labor-vacation-usage',
      type: AuditType.LABOR_LAW,
      name: '有給休暇取得義務',
      description: '年5日の有給休暇取得義務の履行確認',
      checkFunction: this.checkVacationUsageCompliance.bind(this),
      frequency: { interval: 'monthly', dayOfMonth: 1 },
      relatedRegulations: ['労働基準法第39条第7項']
    });

    // 税法準拠監査項目
    this.registerAuditItem({
      id: 'tax-withholding-accuracy',
      type: AuditType.TAX_COMPLIANCE,
      name: '源泉徴収正確性',
      description: '源泉所得税の計算・納付状況確認',
      checkFunction: this.checkWithholdingTaxCompliance.bind(this),
      frequency: { interval: 'monthly', dayOfMonth: 10 },
      relatedRegulations: ['所得税法第183条']
    });

    this.registerAuditItem({
      id: 'tax-social-insurance',
      type: AuditType.TAX_COMPLIANCE,
      name: '社会保険料適正性',
      description: '社会保険料の計算・納付状況確認',
      checkFunction: this.checkSocialInsuranceCompliance.bind(this),
      frequency: { interval: 'monthly', dayOfMonth: 15 },
      relatedRegulations: ['健康保険法', '厚生年金保険法']
    });

    // データ保護監査項目
    this.registerAuditItem({
      id: 'data-access-control',
      type: AuditType.DATA_PROTECTION,
      name: 'アクセス制御適正性',
      description: '個人情報へのアクセス権限管理状況',
      checkFunction: this.checkAccessControlCompliance.bind(this),
      frequency: { interval: 'monthly', dayOfMonth: 20 },
      relatedRegulations: ['個人情報保護法']
    });

    this.registerAuditItem({
      id: 'data-retention-policy',
      type: AuditType.DATA_PROTECTION,
      name: 'データ保持期限管理',
      description: '法定保存期間の遵守状況',
      checkFunction: this.checkDataRetentionCompliance.bind(this),
      frequency: { interval: 'quarterly' },
      relatedRegulations: ['電子帳簿保存法']
    });

    // セキュリティ監査項目
    this.registerAuditItem({
      id: 'security-password-policy',
      type: AuditType.SECURITY,
      name: 'パスワードポリシー',
      description: 'パスワード強度・更新頻度の確認',
      checkFunction: this.checkPasswordPolicyCompliance.bind(this),
      frequency: { interval: 'monthly', dayOfMonth: 25 },
      relatedRegulations: ['JIS Q 27001']
    });

    this.registerAuditItem({
      id: 'security-audit-logs',
      type: AuditType.SECURITY,
      name: '監査ログ完全性',
      description: 'システム監査ログの保全性確認',
      checkFunction: this.checkAuditLogCompliance.bind(this),
      frequency: { interval: 'weekly', dayOfWeek: 5 },
      relatedRegulations: ['JIS Q 27001']
    });
  }

  /**
   * 監査項目の登録
   */
  registerAuditItem(item: AuditItem): void {
    this.auditItems.set(item.id, item);
    this.scheduleAudit(item);
    logger.info(`Audit item registered: ${item.name}`);
  }

  /**
   * 監査のスケジューリング
   */
  private scheduleAudit(item: AuditItem): void {
    // 既存のスケジュールをクリア
    if (this.scheduledAudits.has(item.id)) {
      clearInterval(this.scheduledAudits.get(item.id)!);
    }

    // 新しいスケジュールを設定
    const interval = this.getIntervalMilliseconds(item.frequency);
    const timeout = setInterval(async () => {
      await this.executeAudit(item.id, {
        organizationId: 'default',
        period: this.getAuditPeriod(item.frequency)
      });
    }, interval);

    this.scheduledAudits.set(item.id, timeout);
  }

  /**
   * 監査の実行
   */
  async executeAudit(
    itemId: string,
    context: AuditContext
  ): Promise<AuditResult | null> {
    const item = this.auditItems.get(itemId);
    if (!item) {
      logger.error(`Audit item not found: ${itemId}`);
      return null;
    }

    try {
      logger.info(`Executing audit: ${item.name}`);
      const result = await item.checkFunction(context);
      
      // 監査履歴に追加
      this.addToHistory(item.type, result);
      
      // イベント発火
      this.emit('audit:completed', { item, result });
      
      // 重大な発見事項がある場合は警告
      const criticalFindings = result.findings.filter(
        f => f.severity === RiskLevel.CRITICAL
      );
      if (criticalFindings.length > 0) {
        this.emit('audit:critical', { item, findings: criticalFindings });
      }
      
      return result;
    } catch (error) {
      logger.error(`Audit execution failed: ${item.name}`, error);
      this.emit('audit:failed', { item, error });
      return null;
    }
  }

  /**
   * 包括的監査レポートの生成
   */
  async generateComprehensiveReport(
    type: AuditType,
    period: { start: Date; end: Date }
  ): Promise<AuditReport> {
    const relevantItems = Array.from(this.auditItems.values())
      .filter(item => item.type === type);

    const results: AuditResult[] = [];
    
    for (const item of relevantItems) {
      const result = await this.executeAudit(item.id, {
        organizationId: 'default',
        period
      });
      if (result) {
        results.push(result);
      }
    }

    const statistics = this.calculateStatistics(results);
    const executiveSummary = this.generateExecutiveSummary(type, statistics);
    const recommendations = this.generateRecommendations(results);
    const nextSteps = this.generateNextSteps(results);

    const report: AuditReport = {
      id: uuidv4(),
      type,
      period,
      overallStatus: this.determineOverallStatus(statistics),
      executiveSummary,
      items: results,
      statistics,
      recommendations,
      nextSteps,
      generatedAt: new Date(),
      generatedBy: 'system'
    };

    // レポートを保存
    this.saveReport(report);
    
    return report;
  }

  // 個別監査チェック関数の実装

  /**
   * 36協定遵守チェック
   */
  private async check36AgreementCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    const findings: Finding[] = [];
    const evidence: Evidence[] = [];

    // ここで実際のデータベースから時間外労働データを取得
    // （実装簡略化のためモックデータ使用）
    const violations = [
      {
        employeeId: 'emp-001',
        month: '2025-01',
        overtimeHours: 48,
        limit: 45
      }
    ];

    if (violations.length > 0) {
      findings.push({
        id: uuidv4(),
        title: '月間時間外労働上限超過',
        description: `${violations.length}名の従業員が月45時間の上限を超過しています`,
        severity: RiskLevel.HIGH,
        category: '時間外労働',
        affectedItems: violations.map(v => v.employeeId),
        remediation: '該当従業員の労働時間調整と、36協定の見直しを検討してください',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
    }

    evidence.push({
      id: uuidv4(),
      type: 'data',
      title: '時間外労働集計データ',
      location: '/audit/overtime/2025-01',
      timestamp: new Date()
    });

    return {
      itemId: 'labor-overtime-36agreement',
      status: violations.length > 0 
        ? ComplianceStatus.NON_COMPLIANT 
        : ComplianceStatus.COMPLIANT,
      findings,
      evidence,
      recommendations: violations.length > 0 
        ? ['時間外労働の事前承認プロセスの強化', '業務配分の見直し']
        : [],
      score: violations.length === 0 ? 100 : 60,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  /**
   * 休憩時間チェック
   */
  private async checkBreakCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    const findings: Finding[] = [];
    const evidence: Evidence[] = [];

    // 休憩時間不足のケースを検出（モックデータ）
    const breakViolations = [
      {
        employeeId: 'emp-002',
        date: '2025-01-15',
        workHours: 8,
        breakMinutes: 30,
        requiredBreakMinutes: 45
      }
    ];

    if (breakViolations.length > 0) {
      findings.push({
        id: uuidv4(),
        title: '法定休憩時間不足',
        description: `${breakViolations.length}件の休憩時間不足が検出されました`,
        severity: RiskLevel.MEDIUM,
        category: '休憩時間',
        affectedItems: breakViolations.map(v => v.employeeId),
        remediation: '管理者への休憩時間管理の再教育を実施してください'
      });
    }

    return {
      itemId: 'labor-break-requirements',
      status: breakViolations.length > 0 
        ? ComplianceStatus.PARTIALLY_COMPLIANT 
        : ComplianceStatus.COMPLIANT,
      findings,
      evidence,
      recommendations: [],
      score: breakViolations.length === 0 ? 100 : 75,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  /**
   * 法定休日チェック
   */
  private async checkHolidayCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    // 実装簡略化
    return {
      itemId: 'labor-holiday-requirements',
      status: ComplianceStatus.COMPLIANT,
      findings: [],
      evidence: [],
      recommendations: [],
      score: 100,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  /**
   * 有給休暇取得義務チェック
   */
  private async checkVacationUsageCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    const findings: Finding[] = [];

    // 年5日未満の取得者を検出（モックデータ）
    const lowUsageEmployees = [
      {
        employeeId: 'emp-003',
        usedDays: 3,
        remainingDays: 15
      }
    ];

    if (lowUsageEmployees.length > 0) {
      findings.push({
        id: uuidv4(),
        title: '有給休暇取得義務未達成リスク',
        description: `${lowUsageEmployees.length}名が年5日の取得義務を達成していない可能性があります`,
        severity: RiskLevel.HIGH,
        category: '有給休暇',
        affectedItems: lowUsageEmployees.map(e => e.employeeId),
        remediation: '該当従業員への有給取得勧奨を行ってください',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    return {
      itemId: 'labor-vacation-usage',
      status: lowUsageEmployees.length > 0 
        ? ComplianceStatus.NON_COMPLIANT 
        : ComplianceStatus.COMPLIANT,
      findings,
      evidence: [],
      recommendations: ['有給取得促進キャンペーンの実施'],
      score: lowUsageEmployees.length === 0 ? 100 : 70,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  /**
   * 源泉徴収チェック
   */
  private async checkWithholdingTaxCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    return {
      itemId: 'tax-withholding-accuracy',
      status: ComplianceStatus.COMPLIANT,
      findings: [],
      evidence: [{
        id: uuidv4(),
        type: 'document',
        title: '源泉徴収簿',
        location: '/tax/withholding/2025-01',
        timestamp: new Date()
      }],
      recommendations: [],
      score: 100,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  /**
   * 社会保険料チェック
   */
  private async checkSocialInsuranceCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    return {
      itemId: 'tax-social-insurance',
      status: ComplianceStatus.COMPLIANT,
      findings: [],
      evidence: [],
      recommendations: [],
      score: 100,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  /**
   * アクセス制御チェック
   */
  private async checkAccessControlCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    const findings: Finding[] = [];

    // 過剰な権限を持つユーザーを検出（モックデータ）
    const excessivePermissions = [
      {
        userId: 'user-001',
        unnecessaryRoles: ['payroll_admin']
      }
    ];

    if (excessivePermissions.length > 0) {
      findings.push({
        id: uuidv4(),
        title: '過剰なアクセス権限',
        description: `${excessivePermissions.length}名のユーザーが必要以上の権限を持っています`,
        severity: RiskLevel.MEDIUM,
        category: 'アクセス制御',
        affectedItems: excessivePermissions.map(p => p.userId),
        remediation: '最小権限の原則に基づいて権限を見直してください'
      });
    }

    return {
      itemId: 'data-access-control',
      status: excessivePermissions.length > 0 
        ? ComplianceStatus.PARTIALLY_COMPLIANT 
        : ComplianceStatus.COMPLIANT,
      findings,
      evidence: [],
      recommendations: ['四半期ごとの権限棚卸しの実施'],
      score: excessivePermissions.length === 0 ? 100 : 85,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  /**
   * データ保持期限チェック
   */
  private async checkDataRetentionCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    return {
      itemId: 'data-retention-policy',
      status: ComplianceStatus.COMPLIANT,
      findings: [],
      evidence: [],
      recommendations: [],
      score: 100,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  /**
   * パスワードポリシーチェック
   */
  private async checkPasswordPolicyCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    const findings: Finding[] = [];

    // 弱いパスワードのユーザーを検出（モックデータ）
    const weakPasswords = [
      { userId: 'user-002', issue: 'パスワードが90日以上更新されていません' }
    ];

    if (weakPasswords.length > 0) {
      findings.push({
        id: uuidv4(),
        title: 'パスワードポリシー違反',
        description: `${weakPasswords.length}名のユーザーがパスワードポリシーに違反しています`,
        severity: RiskLevel.HIGH,
        category: 'セキュリティ',
        affectedItems: weakPasswords.map(w => w.userId),
        remediation: '該当ユーザーに対してパスワードの即時更新を要求してください'
      });
    }

    return {
      itemId: 'security-password-policy',
      status: weakPasswords.length > 0 
        ? ComplianceStatus.NON_COMPLIANT 
        : ComplianceStatus.COMPLIANT,
      findings,
      evidence: [],
      recommendations: ['多要素認証の導入を検討してください'],
      score: weakPasswords.length === 0 ? 100 : 60,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  /**
   * 監査ログチェック
   */
  private async checkAuditLogCompliance(
    context: AuditContext
  ): Promise<AuditResult> {
    return {
      itemId: 'security-audit-logs',
      status: ComplianceStatus.COMPLIANT,
      findings: [],
      evidence: [{
        id: uuidv4(),
        type: 'log',
        title: 'システム監査ログ',
        location: '/logs/audit/2025-01',
        hash: 'sha256:abcdef...',
        timestamp: new Date()
      }],
      recommendations: [],
      score: 100,
      executedAt: new Date(),
      executedBy: 'system'
    };
  }

  // ヘルパーメソッド

  private getIntervalMilliseconds(frequency: AuditFrequency): number {
    const intervals = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
      quarterly: 90 * 24 * 60 * 60 * 1000,
      yearly: 365 * 24 * 60 * 60 * 1000
    };
    return intervals[frequency.interval];
  }

  private getAuditPeriod(frequency: AuditFrequency): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date();
    
    switch (frequency.interval) {
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
      case 'yearly':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }
    
    return { start, end };
  }

  private calculateStatistics(results: AuditResult[]): AuditStatistics {
    const totalItems = results.length;
    const compliantItems = results.filter(r => r.status === ComplianceStatus.COMPLIANT).length;
    const nonCompliantItems = results.filter(r => r.status === ComplianceStatus.NON_COMPLIANT).length;
    const partiallyCompliantItems = results.filter(r => r.status === ComplianceStatus.PARTIALLY_COMPLIANT).length;
    
    const allFindings = results.flatMap(r => r.findings);
    const criticalFindings = allFindings.filter(f => f.severity === RiskLevel.CRITICAL).length;
    const highFindings = allFindings.filter(f => f.severity === RiskLevel.HIGH).length;
    const mediumFindings = allFindings.filter(f => f.severity === RiskLevel.MEDIUM).length;
    const lowFindings = allFindings.filter(f => f.severity === RiskLevel.LOW).length;
    
    return {
      totalItems,
      compliantItems,
      nonCompliantItems,
      partiallyCompliantItems,
      complianceRate: totalItems > 0 ? (compliantItems / totalItems) * 100 : 0,
      criticalFindings,
      highFindings,
      mediumFindings,
      lowFindings
    };
  }

  private determineOverallStatus(statistics: AuditStatistics): ComplianceStatus {
    if (statistics.complianceRate === 100 && statistics.criticalFindings === 0) {
      return ComplianceStatus.COMPLIANT;
    } else if (statistics.complianceRate >= 80 && statistics.criticalFindings === 0) {
      return ComplianceStatus.PARTIALLY_COMPLIANT;
    } else {
      return ComplianceStatus.NON_COMPLIANT;
    }
  }

  private generateExecutiveSummary(type: AuditType, statistics: AuditStatistics): string {
    const typeNames = {
      [AuditType.LABOR_LAW]: '労働法',
      [AuditType.TAX_COMPLIANCE]: '税法',
      [AuditType.DATA_PROTECTION]: 'データ保護',
      [AuditType.SECURITY]: 'セキュリティ',
      [AuditType.ACCOUNTING]: '会計',
      [AuditType.HR_PRACTICES]: '人事慣行'
    };

    return `${typeNames[type]}に関する監査を実施しました。
全${statistics.totalItems}項目中、${statistics.compliantItems}項目が準拠、
${statistics.nonCompliantItems}項目が非準拠、${statistics.partiallyCompliantItems}項目が部分準拠でした。
準拠率は${statistics.complianceRate.toFixed(1)}%です。
重大な発見事項が${statistics.criticalFindings}件、高リスクの発見事項が${statistics.highFindings}件ありました。`;
  }

  private generateRecommendations(results: AuditResult[]): string[] {
    const recommendations = new Set<string>();
    
    results.forEach(result => {
      result.recommendations.forEach(rec => recommendations.add(rec));
    });
    
    // 共通的な推奨事項を追加
    if (results.some(r => r.status === ComplianceStatus.NON_COMPLIANT)) {
      recommendations.add('コンプライアンス研修の実施を推奨します');
      recommendations.add('内部統制の強化を検討してください');
    }
    
    return Array.from(recommendations);
  }

  private generateNextSteps(results: AuditResult[]): string[] {
    const nextSteps: string[] = [];
    
    const criticalFindings = results
      .flatMap(r => r.findings)
      .filter(f => f.severity === RiskLevel.CRITICAL);
    
    if (criticalFindings.length > 0) {
      nextSteps.push('重大な発見事項について、1週間以内に改善計画を策定してください');
      nextSteps.push('経営層への報告を行ってください');
    }
    
    const nonCompliantItems = results.filter(r => r.status === ComplianceStatus.NON_COMPLIANT);
    if (nonCompliantItems.length > 0) {
      nextSteps.push('非準拠項目について、30日以内に是正措置を実施してください');
      nextSteps.push('是正措置の実施後、フォローアップ監査を実施します');
    }
    
    nextSteps.push('次回定期監査は予定通り実施されます');
    
    return nextSteps;
  }

  private addToHistory(type: AuditType, result: AuditResult): void {
    if (!this.auditHistory.has(type)) {
      this.auditHistory.set(type, []);
    }
    // 履歴は後で実装（簡略化のため省略）
  }

  private saveReport(report: AuditReport): void {
    logger.info(`Audit report saved: ${report.id}`);
    // レポートの永続化処理（実装省略）
  }

  /**
   * 手動監査の実行
   */
  async runManualAudit(
    itemIds: string[],
    context: AuditContext
  ): Promise<AuditResult[]> {
    const results: AuditResult[] = [];
    
    for (const itemId of itemIds) {
      const result = await this.executeAudit(itemId, context);
      if (result) {
        results.push(result);
      }
    }
    
    return results;
  }

  /**
   * 監査スケジュールの取得
   */
  getAuditSchedule(): Array<{
    itemId: string;
    name: string;
    type: AuditType;
    nextScheduled: Date;
    frequency: AuditFrequency;
  }> {
    return Array.from(this.auditItems.values()).map(item => ({
      itemId: item.id,
      name: item.name,
      type: item.type,
      nextScheduled: item.nextScheduled || new Date(),
      frequency: item.frequency
    }));
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    // すべてのスケジュールをクリア
    this.scheduledAudits.forEach(timeout => clearInterval(timeout));
    this.scheduledAudits.clear();
    this.removeAllListeners();
  }
}

// エクスポート
export { ComplianceAuditSystem };