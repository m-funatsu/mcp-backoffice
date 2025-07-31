/**
 * 経費管理ドメイン型定義
 * @module domain/expense
 * @description 経費管理に関する全てのドメイン型定義
 */

import type { Result } from '../core/result.js';
import type { Money } from '../core/money.js';
import type { DateTime } from '../core/datetime.js';
import type { ValidationError } from '../core/validation.js';
import type { 
  EntityBase, 
  AuditableEntity,
  WorkflowStatus,
  ApprovalLevel
} from '../core/entity.js';

// ================================
// 基本型定義
// ================================

/**
 * 経費申請エンティティ
 * @description 経費申請の基本情報を表現
 */
export interface ExpenseRequest extends AuditableEntity {
  readonly employeeId: string;
  readonly departmentId: string;
  readonly categoryId: string;
  readonly amount: Money;
  readonly description: string;
  readonly expenseDate: DateTime;
  readonly status: WorkflowStatus;
  readonly approvalLevel: ApprovalLevel;
  readonly receiptId?: string;
  readonly projectId?: string;
  readonly clientId?: string;
  readonly tags: ReadonlyArray<string>;
  readonly attachments: ReadonlyArray<ExpenseAttachment>;
  readonly metadata: ExpenseMetadata;
}

/**
 * 経費添付ファイル
 * @description 経費申請に添付されるファイル情報
 */
export interface ExpenseAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly uploadedAt: DateTime;
  readonly url: string;
  readonly type: AttachmentType;
}

/** 添付ファイルタイプ */
export type AttachmentType = 'receipt' | 'invoice' | 'document' | 'other';

/**
 * 経費メタデータ
 * @description 経費申請の追加情報
 */
export interface ExpenseMetadata {
  readonly paymentMethod?: PaymentMethod;
  readonly isReimbursable: boolean;
  readonly requiresReceipt: boolean;
  readonly isRecurring: boolean;
  readonly recurringFrequency?: RecurringFrequency;
  readonly customFields?: Record<string, unknown>;
}

/** 支払方法 */
export type PaymentMethod = 
  | 'cash' 
  | 'credit_card' 
  | 'debit_card' 
  | 'bank_transfer' 
  | 'electronic_money' 
  | 'company_card'
  | 'personal_card'
  | 'other';

/** 繰り返し頻度 */
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * 経費カテゴリ
 * @description 経費の分類情報
 */
export interface ExpenseCategory extends EntityBase {
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly parentId?: string;
  readonly accountCode?: string;
  readonly isActive: boolean;
  readonly requiresReceipt: boolean;
  readonly requiresApproval: boolean;
  readonly approvalThreshold?: Money;
  readonly taxRate?: number;
  readonly budgetLimit?: Money;
}

/**
 * 経費承認ワークフロー
 * @description 経費承認のワークフロー定義
 */
export interface ApprovalWorkflow extends EntityBase {
  readonly name: string;
  readonly description?: string;
  readonly steps: ReadonlyArray<ApprovalStep>;
  readonly conditions: ReadonlyArray<WorkflowCondition>;
  readonly isActive: boolean;
  readonly priority: number;
}

/**
 * 承認ステップ
 * @description ワークフロー内の承認ステップ
 */
export interface ApprovalStep {
  readonly stepNumber: number;
  readonly approverType: ApproverType;
  readonly approverId?: string;
  readonly approverRole?: string;
  readonly isRequired: boolean;
  readonly canEscalate: boolean;
  readonly escalationTime?: number; // hours
  readonly alternateApprovers?: ReadonlyArray<string>;
}

/** 承認者タイプ */
export type ApproverType = 
  | 'direct_manager' 
  | 'department_head' 
  | 'specific_user' 
  | 'role_based' 
  | 'amount_based';

/**
 * ワークフロー条件
 * @description ワークフロー適用の条件
 */
export interface WorkflowCondition {
  readonly field: string;
  readonly operator: ConditionOperator;
  readonly value: unknown;
  readonly logicalOperator?: 'and' | 'or';
}

/** 条件演算子 */
export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'greater_than' 
  | 'less_than' 
  | 'in' 
  | 'not_in' 
  | 'contains';

// ================================
// OCR関連型定義
// ================================

/**
 * OCR結果
 * @description 基本的なOCR処理結果
 */
export interface OCRResult {
  readonly text: string;
  readonly confidence: number;
  readonly processingTime?: number;
  readonly language?: string;
}

/**
 * レシートデータ（OCRから抽出）
 * @description OCRで抽出されたレシート情報
 */
export interface ExtractedReceiptData {
  readonly vendor: ReceiptVendor;
  readonly items: ReadonlyArray<ReceiptItem>;
  readonly totals: ReceiptTotals;
  readonly metadata: ReceiptMetadata;
  readonly rawText: string;
  readonly confidence: number;
}

/**
 * レシート販売者情報
 * @description レシートから抽出された販売者情報
 */
export interface ReceiptVendor {
  readonly name: string;
  readonly address?: string;
  readonly phone?: string;
  readonly taxId?: string;
  readonly confidence: number;
}

/**
 * レシート明細項目
 * @description 購入商品の詳細情報
 */
export interface ReceiptItem {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly totalPrice: Money;
  readonly taxRate?: number;
  readonly category?: string;
  readonly confidence: number;
}

/**
 * レシート合計情報
 * @description レシートの金額合計
 */
export interface ReceiptTotals {
  readonly subtotal: Money;
  readonly taxAmount: Money;
  readonly totalAmount: Money;
  readonly discountAmount?: Money;
  readonly confidence: number;
}

/**
 * レシートメタデータ
 * @description レシートの付加情報
 */
export interface ReceiptMetadata {
  readonly receiptDate: DateTime;
  readonly receiptNumber?: string;
  readonly paymentMethod?: PaymentMethod;
  readonly currency: string;
  readonly processingTime: number;
}

// ================================
// 会計連携型定義
// ================================

/**
 * 会計仕訳エントリ
 * @description 会計システムへの仕訳情報
 */
export interface AccountingEntry extends EntityBase {
  readonly expenseRequestId: string;
  readonly journalDate: DateTime;
  readonly description: string;
  readonly debits: ReadonlyArray<AccountingLine>;
  readonly credits: ReadonlyArray<AccountingLine>;
  readonly status: AccountingStatus;
  readonly externalId?: string;
  readonly syncedAt?: DateTime;
}

/**
 * 会計仕訳行
 * @description 借方・貸方の詳細
 */
export interface AccountingLine {
  readonly accountCode: string;
  readonly accountName: string;
  readonly amount: Money;
  readonly taxCode?: string;
  readonly taxAmount?: Money;
  readonly departmentCode?: string;
  readonly projectCode?: string;
  readonly description?: string;
}

/** 会計ステータス */
export type AccountingStatus = 
  | 'draft' 
  | 'pending' 
  | 'posted' 
  | 'synced' 
  | 'error' 
  | 'cancelled';

// ================================
// 分析・レポート型定義
// ================================

/**
 * 経費分析結果
 * @description 経費の統計・分析情報
 */
export interface ExpenseAnalytics {
  readonly employeeId?: string;
  readonly department?: string;
  readonly period: {
    readonly startDate: Date;
    readonly endDate: Date;
  };
  readonly totalAmount: number;
  readonly totalRequests: number;
  readonly averageAmount: Money;
  readonly categoryBreakdown: ReadonlyArray<CategoryExpense>;
  readonly monthlyTrend: ReadonlyArray<MonthlyExpense>;
  readonly topVendors: ReadonlyArray<VendorExpense>;
  readonly approvalStats: ApprovalStatistics;
  readonly complianceMetrics: ComplianceMetrics;
}

/**
 * カテゴリ別経費
 * @description カテゴリごとの経費集計
 */
export interface CategoryExpense {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amount: Money;
  readonly count: number;
  readonly percentage: number;
}

/**
 * 月別経費
 * @description 月ごとの経費推移
 */
export interface MonthlyExpense {
  readonly month: string;
  readonly amount: Money;
  readonly count: number;
  readonly growthRate: number;
}

/**
 * ベンダー別経費
 * @description 取引先ごとの経費集計
 */
export interface VendorExpense {
  readonly vendorName: string;
  readonly amount: Money;
  readonly count: number;
  readonly percentage: number;
}

/**
 * 承認統計
 * @description 承認プロセスの統計情報
 */
export interface ApprovalStatistics {
  readonly approved: number;
  readonly rejected: number;
  readonly pending: number;
  readonly averageApprovalTime: number; // hours
}

/**
 * コンプライアンス指標
 * @description 経費管理のコンプライアンス状況
 */
export interface ComplianceMetrics {
  readonly receiptComplianceRate: number;
  readonly policyViolations: number;
  readonly riskScore: number;
}

// ================================
// 経費ポリシー型定義
// ================================

/**
 * 経費ポリシー
 * @description 経費に関する会社方針
 */
export interface ExpensePolicy extends EntityBase {
  readonly name: string;
  readonly description: string;
  readonly effectiveDate: DateTime;
  readonly expiryDate?: DateTime;
  readonly rules: ReadonlyArray<PolicyRule>;
  readonly isActive: boolean;
  readonly scope: PolicyScope;
}

/**
 * ポリシールール
 * @description 個別のポリシー規則
 */
export interface PolicyRule {
  readonly id: string;
  readonly type: PolicyRuleType;
  readonly condition: WorkflowCondition;
  readonly action: PolicyAction;
  readonly message?: string;
  readonly severity: PolicySeverity;
}

/** ポリシールールタイプ */
export type PolicyRuleType = 
  | 'amount_limit' 
  | 'category_restriction' 
  | 'vendor_restriction' 
  | 'frequency_limit' 
  | 'receipt_required';

/** ポリシーアクション */
export type PolicyAction = 
  | 'block' 
  | 'warn' 
  | 'require_approval' 
  | 'flag_review';

/** ポリシー重要度 */
export type PolicySeverity = 'low' | 'medium' | 'high' | 'critical';

/** ポリシー適用範囲 */
export interface PolicyScope {
  readonly departments?: ReadonlyArray<string>;
  readonly employees?: ReadonlyArray<string>;
  readonly categories?: ReadonlyArray<string>;
  readonly minAmount?: Money;
  readonly maxAmount?: Money;
}

// ================================
// ML/AI関連型定義
// ================================

/**
 * 機械学習モデルの基本インターフェース
 * @description 全てのMLモデルが実装すべき基本契約
 */
export interface MLModel {
  readonly name: string;
  readonly version: string;
  predict(input: unknown): Promise<unknown>;
  train?(data: ReadonlyArray<unknown>): Promise<void>;
  evaluate?(testData: ReadonlyArray<unknown>): Promise<ModelMetrics>;
}

/**
 * モデル評価指標
 * @description MLモデルの性能指標
 */
export interface ModelMetrics {
  readonly accuracy: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1Score: number;
  readonly confusionMatrix?: ReadonlyArray<ReadonlyArray<number>>;
}

/**
 * レシート分類モデル
 * @description レシートの種類を分類するMLモデル
 */
export interface ReceiptClassifier extends MLModel {
  classify(text: string): Promise<{
    readonly category: string;
    readonly confidence: number;
    readonly alternatives: ReadonlyArray<{
      readonly category: string;
      readonly confidence: number;
    }>;
  }>;
}

/**
 * 不正検知モデル
 * @description 経費の不正を検知するMLモデル
 */
export interface FraudDetector extends MLModel {
  detectFraud(expense: ExpenseRequest): Promise<{
    readonly isFraud: boolean;
    readonly confidence: number;
    readonly reasons: ReadonlyArray<string>;
    readonly riskFactors: ReadonlyArray<RiskFactor>;
  }>;
}

/**
 * 経費予測モデル
 * @description 将来の経費を予測するMLモデル
 */
export interface ExpensePredictor extends MLModel {
  predictExpense(
    employeeId: string,
    period: PredictionPeriod
  ): Promise<{
    readonly amount: Money;
    readonly confidence: number;
    readonly confidenceInterval: {
      readonly lower: Money;
      readonly upper: Money;
    };
    readonly factors: ReadonlyArray<PredictionFactor>;
  }>;
}

/**
 * 予測期間
 * @description 予測対象の期間情報
 */
export interface PredictionPeriod {
  readonly startDate: DateTime;
  readonly endDate: DateTime;
  readonly granularity: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
}

/**
 * 予測ファクター
 * @description 予測に影響を与える要因
 */
export interface PredictionFactor {
  readonly name: string;
  readonly impact: number; // -1 to 1
  readonly description: string;
  readonly category: 'historical' | 'seasonal' | 'external' | 'behavioral';
}

/**
 * 異常検知モデル
 * @description 経費パターンの異常を検知するMLモデル
 */
export interface AnomalyDetector extends MLModel {
  detectAnomaly(expenses: ReadonlyArray<ExpenseRequest>): Promise<{
    readonly anomalies: ReadonlyArray<Anomaly>;
    readonly overallScore: number;
    readonly threshold: number;
  }>;
}

/**
 * 異常情報
 * @description 検知された異常の詳細
 */
export interface Anomaly {
  readonly expenseId: string;
  readonly type: AnomalyType;
  readonly score: number;
  readonly description: string;
  readonly suggestedAction: string;
}

/** 異常タイプ */
export type AnomalyType =
  | 'amount_outlier'
  | 'frequency_anomaly'
  | 'category_mismatch'
  | 'temporal_anomaly'
  | 'vendor_anomaly'
  | 'pattern_deviation';

// ================================
// 高度な分析型定義
// ================================

/**
 * 経費アラート
 * @description リアルタイム監視で生成されるアラート
 */
export interface ExpenseAlert {
  readonly id: string;
  readonly type: AlertType;
  readonly severity: AlertSeverity;
  readonly message: string;
  readonly timestamp: DateTime;
  readonly expenseId?: string;
  readonly employeeId?: string;
  readonly suggestedActions: ReadonlyArray<string>;
  readonly metadata?: Record<string, unknown>;
}

/** アラートタイプ */
export type AlertType =
  | 'budget_exceeded'
  | 'unusual_expense'
  | 'policy_violation'
  | 'duplicate_expense'
  | 'approval_delay'
  | 'compliance_risk';

/** アラート重要度 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * 不正分析結果
 * @description 不正検知エンジンの分析結果
 */
export interface FraudAnalysis {
  readonly riskScore: number; // 0-1
  readonly riskLevel: RiskLevel;
  readonly indicators: ReadonlyArray<FraudIndicator>;
  readonly confidence: number;
  readonly recommendation: ApprovalAction;
}

/** リスクレベル */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * 不正指標
 * @description 不正の可能性を示す指標
 */
export interface FraudIndicator {
  readonly type: string;
  readonly description: string;
  readonly weight: number;
  readonly evidence: string;
}

/**
 * 履歴分析結果
 * @description 過去の経費パターン分析
 */
export interface HistoricalAnalysis {
  readonly averageExpense: Money;
  readonly medianExpense: Money;
  readonly typicalCategories: ReadonlyArray<string>;
  readonly anomalyScore: number;
  readonly patterns: ReadonlyArray<ExpensePattern>;
  readonly seasonality: SeasonalityAnalysis;
}

/**
 * 経費パターン
 * @description 識別された経費の傾向
 */
export interface ExpensePattern {
  readonly type: PatternType;
  readonly frequency: number;
  readonly description: string;
  readonly confidence: number;
  readonly examples: ReadonlyArray<string>;
}

/** パターンタイプ */
export type PatternType =
  | 'recurring'
  | 'seasonal'
  | 'project_based'
  | 'event_driven'
  | 'irregular';

/**
 * 季節性分析
 * @description 季節による経費変動の分析
 */
export interface SeasonalityAnalysis {
  readonly hasSeasonality: boolean;
  readonly peakMonths: ReadonlyArray<number>;
  readonly lowMonths: ReadonlyArray<number>;
  readonly variationCoefficient: number;
}

/**
 * ポリシー準拠情報
 * @description 経費ポリシーへの準拠状況
 */
export interface PolicyCompliance {
  readonly isCompliant: boolean;
  readonly violations: ReadonlyArray<PolicyViolation>;
  readonly complianceScore: number;
  readonly warnings: ReadonlyArray<string>;
}

/**
 * ポリシー違反
 * @description 検出されたポリシー違反の詳細
 */
export interface PolicyViolation {
  readonly policyId: string;
  readonly policyName: string;
  readonly violationType: string;
  readonly description: string;
  readonly severity: PolicySeverity;
  readonly correctiveAction: string;
}

/**
 * リスクファクター
 * @description リスク評価の要因
 */
export interface RiskFactor {
  readonly type: RiskFactorType;
  readonly severity: RiskLevel;
  readonly description: string;
  readonly impact: number; // 0-1
  readonly mitigationStrategy?: string;
}

/** リスクファクタータイプ */
export type RiskFactorType =
  | 'amount_anomaly'
  | 'duplicate_expense'
  | 'vendor_risk'
  | 'policy_violation'
  | 'temporal_anomaly'
  | 'category_mismatch';

/**
 * 承認アクション
 * @description AIが推奨する承認アクション
 */
export type ApprovalAction =
  | 'auto_approve'
  | 'manual_review'
  | 'reject'
  | 'request_clarification'
  | 'escalate';

/**
 * ML推奨入力データ
 * @description ML推奨エンジンへの入力
 */
export interface MLRecommendationInput {
  readonly policyCompliance: PolicyCompliance;
  readonly fraudAnalysis: FraudAnalysis;
  readonly historicalAnalysis: HistoricalAnalysis;
  readonly receiptQuality: number;
  readonly riskFactors: ReadonlyArray<RiskFactor>;
}

// ================================
// エンジンインターフェース
// ================================

/**
 * 不正検知エンジン
 * @description 経費の不正を検知する高度なエンジン
 */
export interface FraudDetectionEngine {
  analyzeExpense(
    expenseRequest: ExpenseRequest,
    receiptData?: ExtractedReceiptData
  ): Promise<FraudAnalysis>;
  
  updateModel(feedback: ReadonlyArray<FraudFeedback>): Promise<void>;
  
  getStatistics(): Promise<FraudStatistics>;
}

/**
 * 不正検知フィードバック
 * @description モデル改善のためのフィードバック
 */
export interface FraudFeedback {
  readonly expenseId: string;
  readonly wasCorrect: boolean;
  readonly actualResult: boolean;
  readonly feedback?: string;
}

/**
 * 不正検知統計
 * @description 不正検知エンジンの性能統計
 */
export interface FraudStatistics {
  readonly totalAnalyzed: number;
  readonly fraudDetected: number;
  readonly falsePositives: number;
  readonly falseNegatives: number;
  readonly accuracy: number;
  readonly lastUpdated: DateTime;
}

/**
 * 承認エンジン
 * @description 経費承認の自動化エンジン
 */
export interface ApprovalEngine {
  evaluateRequest(
    expenseRequest: ExpenseRequest,
    context?: ApprovalContext
  ): Promise<Result<ApprovalDecision, ValidationError>>;
  
  getApprovalHistory(
    employeeId: string,
    period?: PredictionPeriod
  ): Promise<ReadonlyArray<ApprovalHistory>>;
}

/**
 * 承認コンテキスト
 * @description 承認判断に必要な追加情報
 */
export interface ApprovalContext {
  readonly previousApprovals?: ReadonlyArray<ApprovalHistory>;
  readonly budgetStatus?: BudgetStatus;
  readonly employeeProfile?: EmployeeExpenseProfile;
}

/**
 * 承認決定
 * @description 承認エンジンの決定結果
 */
export interface ApprovalDecision {
  readonly decision: ApprovalAction;
  readonly confidence: number;
  readonly reasons: ReadonlyArray<string>;
  readonly conditions?: ReadonlyArray<string>;
  readonly nextSteps?: ReadonlyArray<string>;
}

/**
 * 承認履歴
 * @description 過去の承認記録
 */
export interface ApprovalHistory {
  readonly expenseId: string;
  readonly decision: ApprovalAction;
  readonly decidedAt: DateTime;
  readonly decidedBy: string;
  readonly reasons?: ReadonlyArray<string>;
}

/**
 * 予算ステータス
 * @description 現在の予算消化状況
 */
export interface BudgetStatus {
  readonly totalBudget: Money;
  readonly usedBudget: Money;
  readonly remainingBudget: Money;
  readonly utilizationRate: number;
  readonly projectedOverrun?: Money;
}

/**
 * 従業員経費プロファイル
 * @description 従業員の経費利用傾向
 */
export interface EmployeeExpenseProfile {
  readonly employeeId: string;
  readonly averageMonthlyExpense: Money;
  readonly typicalCategories: ReadonlyArray<string>;
  readonly complianceRate: number;
  readonly riskProfile: RiskLevel;
}

/**
 * 分析エンジン
 * @description 経費データの高度な分析エンジン
 */
export interface AnalyticsEngine {
  generateInsights(
    expenses: ReadonlyArray<ExpenseRequest>,
    options?: AnalyticsOptions
  ): Promise<ExpenseInsights>;
  
  generateReport(
    type: ReportType,
    parameters: ReportParameters
  ): Promise<AnalyticsReport>;
}

/**
 * 分析オプション
 * @description 分析エンジンのオプション
 */
export interface AnalyticsOptions {
  readonly includeForecasting?: boolean;
  readonly includeBenchmarking?: boolean;
  readonly includeAnomalies?: boolean;
  readonly confidenceLevel?: number;
}

/**
 * 経費インサイト
 * @description 分析から得られた洞察
 */
export interface ExpenseInsights {
  readonly summary: InsightSummary;
  readonly trends: ReadonlyArray<TrendInsight>;
  readonly opportunities: ReadonlyArray<CostSavingOpportunity>;
  readonly risks: ReadonlyArray<RiskInsight>;
  readonly recommendations: ReadonlyArray<string>;
}

/**
 * インサイトサマリー
 * @description インサイトの要約情報
 */
export interface InsightSummary {
  readonly totalAnalyzed: number;
  readonly keyFindings: ReadonlyArray<string>;
  readonly overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  readonly priorityActions: ReadonlyArray<string>;
}

/**
 * トレンドインサイト
 * @description 識別されたトレンド情報
 */
export interface TrendInsight {
  readonly type: string;
  readonly description: string;
  readonly impact: 'positive' | 'neutral' | 'negative';
  readonly confidence: number;
  readonly visualization?: ChartData;
}

/**
 * コスト削減機会
 * @description 識別されたコスト削減の機会
 */
export interface CostSavingOpportunity {
  readonly category: string;
  readonly potentialSaving: Money;
  readonly description: string;
  readonly implementation: string;
  readonly effort: 'low' | 'medium' | 'high';
  readonly impact: Money;
}

/**
 * リスクインサイト
 * @description 識別されたリスク情報
 */
export interface RiskInsight {
  readonly type: string;
  readonly severity: RiskLevel;
  readonly description: string;
  readonly affectedAreas: ReadonlyArray<string>;
  readonly mitigation: string;
}

/**
 * チャートデータ
 * @description 可視化用のチャートデータ
 */
export interface ChartData {
  readonly type: 'line' | 'bar' | 'pie' | 'scatter';
  readonly data: ReadonlyArray<DataPoint>;
  readonly labels?: ReadonlyArray<string>;
  readonly options?: Record<string, unknown>;
}

/**
 * データポイント
 * @description チャートのデータポイント
 */
export interface DataPoint {
  readonly x: number | string | Date;
  readonly y: number;
  readonly label?: string;
  readonly metadata?: Record<string, unknown>;
}

/** レポートタイプ */
export type ReportType =
  | 'executive_summary'
  | 'detailed_analysis'
  | 'compliance_report'
  | 'budget_report'
  | 'vendor_analysis'
  | 'employee_analysis';

/**
 * レポートパラメータ
 * @description レポート生成のパラメータ
 */
export interface ReportParameters {
  readonly period: PredictionPeriod;
  readonly filters?: ReportFilters;
  readonly format?: 'pdf' | 'excel' | 'json';
  readonly language?: string;
}

/**
 * レポートフィルタ
 * @description レポート生成時のフィルタ条件
 */
export interface ReportFilters {
  readonly departments?: ReadonlyArray<string>;
  readonly categories?: ReadonlyArray<string>;
  readonly employees?: ReadonlyArray<string>;
  readonly minAmount?: Money;
  readonly maxAmount?: Money;
}

/**
 * 分析レポート
 * @description 生成された分析レポート
 */
export interface AnalyticsReport {
  readonly id: string;
  readonly type: ReportType;
  readonly generatedAt: DateTime;
  readonly period: PredictionPeriod;
  readonly content: ReportContent;
  readonly metadata: ReportMetadata;
}

/**
 * レポートコンテンツ
 * @description レポートの内容
 */
export interface ReportContent {
  readonly summary: string;
  readonly sections: ReadonlyArray<ReportSection>;
  readonly charts: ReadonlyArray<ChartData>;
  readonly tables: ReadonlyArray<TableData>;
}

/**
 * レポートセクション
 * @description レポートの個別セクション
 */
export interface ReportSection {
  readonly title: string;
  readonly content: string;
  readonly findings: ReadonlyArray<string>;
  readonly recommendations?: ReadonlyArray<string>;
}

/**
 * テーブルデータ
 * @description レポート内のテーブルデータ
 */
export interface TableData {
  readonly title: string;
  readonly headers: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<ReadonlyArray<string | number>>;
  readonly footer?: ReadonlyArray<string | number>;
}

/**
 * レポートメタデータ
 * @description レポートの付加情報
 */
export interface ReportMetadata {
  readonly generatedBy: string;
  readonly department?: string;
  readonly confidentiality: 'public' | 'internal' | 'confidential';
  readonly version: string;
  readonly checksum?: string;
}

// ================================
// エクスポート
// ================================

export type {
  // Re-export commonly used types
  Result,
  Money,
  DateTime,
  ValidationError
};