/**
 * 会計管理ドメイン型定義
 * @module domain/accounting
 * @description 会計システム統合に関する全てのドメイン型定義
 */

import type { Result } from '../core/result.js';
import type { Money } from '../core/money.js';
import type { DateTime } from '../core/datetime.js';
import type { ValidationError } from '../core/validation.js';
import type { EntityBase, AuditableEntity } from '../core/entity.js';
import type { ExpenseRequest } from './expense.js';
import type { Employee } from './employee.js';

// ================================
// 基本型定義
// ================================

/** 会計システムプロバイダ */
export type AccountingProvider = 'freee' | 'moneyforward' | 'yayoi' | 'custom';

/** 環境 */
export type Environment = 'sandbox' | 'production';

/**
 * 会計システム設定
 * @description 外部会計システムとの接続設定
 */
export interface AccountingSystemConfig {
  readonly provider: AccountingProvider;
  readonly apiEndpoint: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly companyId: string;
  readonly environment: Environment;
  readonly features: ReadonlyArray<AccountingFeature>;
  readonly webhooks?: ReadonlyArray<WebhookConfig>;
  readonly rateLimits?: RateLimitConfig;
}

/**
 * 会計機能
 * @description 有効化された会計機能の設定
 */
export interface AccountingFeature {
  readonly name: AccountingFeatureName;
  readonly enabled: boolean;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly version?: string;
}

/** 会計機能名 */
export type AccountingFeatureName = 
  | 'expense_sync'
  | 'journal_entry'
  | 'tax_calculation'
  | 'invoice_management'
  | 'bank_reconciliation'
  | 'budget_tracking';

/**
 * Webhook設定
 * @description 会計システムからのイベント通知設定
 */
export interface WebhookConfig {
  readonly eventType: string;
  readonly url: string;
  readonly secret?: string;
  readonly enabled: boolean;
}

/**
 * レート制限設定
 * @description API利用制限の設定
 */
export interface RateLimitConfig {
  readonly requestsPerMinute: number;
  readonly requestsPerHour: number;
  readonly requestsPerDay: number;
  readonly burstLimit: number;
}

// ================================
// 仕訳関連型定義
// ================================

/**
 * 会計仕訳エントリ
 * @description 会計システムへの仕訳情報
 */
export interface AccountingEntry extends AuditableEntity {
  readonly expenseRequestId: string;
  readonly journalDate: DateTime;
  readonly description: string;
  readonly debits: ReadonlyArray<AccountingLine>;
  readonly credits: ReadonlyArray<AccountingLine>;
  readonly status: AccountingStatus;
  readonly externalId?: string;
  readonly syncedAt?: DateTime;
  readonly attachments?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
  readonly metadata: AccountingMetadata;
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
  readonly subsidiaryCode?: string;
  readonly costCenter?: string;
}

/** 会計ステータス */
export type AccountingStatus = 
  | 'draft' 
  | 'pending' 
  | 'posted' 
  | 'synced' 
  | 'error' 
  | 'cancelled'
  | 'reversed';

/**
 * 会計メタデータ
 * @description 仕訳の追加情報
 */
export interface AccountingMetadata {
  readonly accountingPeriod: string;
  readonly fiscalYear: number;
  readonly documentNumber?: string;
  readonly approvedBy?: string;
  readonly approvedAt?: DateTime;
  readonly reversalOf?: string;
  readonly customFields?: Record<string, unknown>;
}

/** 仕訳ステータス */
export type JournalStatus = 'draft' | 'posted' | 'cancelled' | 'reversed';

/**
 * 仕訳エントリ
 * @description 会計仕訳情報（レガシー互換用）
 */
export interface JournalEntry {
  readonly id: string;
  readonly expenseId: string;
  readonly date: DateTime;
  readonly description: string;
  readonly debits: ReadonlyArray<JournalLine>;
  readonly credits: ReadonlyArray<JournalLine>;
  readonly totalAmount: Money;
  readonly currency: string;
  readonly status: JournalStatus;
  readonly referenceNumber?: string;
  readonly externalId?: string;
}

/**
 * 仕訳明細
 * @description 仕訳の借方・貸方明細
 */
export interface JournalLine {
  readonly accountCode: string;
  readonly accountName: string;
  readonly amount: Money;
  readonly description?: string;
  readonly taxCode?: string;
  readonly department?: string;
  readonly project?: string;
}

// ================================
// 勘定科目関連型定義
// ================================

/**
 * 勘定科目
 * @description 会計で使用する勘定科目
 */
export interface AccountCode extends EntityBase {
  readonly code: string;
  readonly name: string;
  readonly nameEn?: string;
  readonly category: AccountCategory;
  readonly subcategory?: string;
  readonly parentCode?: string;
  readonly isActive: boolean;
  readonly isTaxable: boolean;
  readonly defaultTaxCode?: string;
  readonly description?: string;
}

/** 勘定科目カテゴリ */
export type AccountCategory = 
  | 'asset'         // 資産
  | 'liability'     // 負債
  | 'equity'        // 純資産
  | 'revenue'       // 収益
  | 'expense';      // 費用

/**
 * 勘定科目マッピング
 * @description 経費カテゴリと勘定科目のマッピング
 */
export interface AccountMapping {
  readonly expenseCategoryId: string;
  readonly expenseCategoryName: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly taxCode: string;
  readonly isDefault: boolean;
  readonly rules: ReadonlyArray<MappingRule>;
  readonly effectiveDate: DateTime;
  readonly expiryDate?: DateTime;
}

/**
 * マッピングルール
 * @description 勘定科目マッピングの条件ルール
 */
export interface MappingRule {
  readonly field: string;
  readonly condition: MappingCondition;
  readonly value: unknown;
  readonly targetAccount: string;
  readonly priority: number;
  readonly description?: string;
}

/** マッピング条件 */
export type MappingCondition = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'starts_with' 
  | 'ends_with' 
  | 'greater_than' 
  | 'less_than';

// ================================
// 税務関連型定義
// ================================

/** 税種別 */
export type TaxType = '消費税' | '軽減税率' | '非課税' | '免税' | '不課税';

/**
 * 税計算
 * @description 経費に対する税計算情報
 */
export interface TaxCalculation {
  readonly expenseId: string;
  readonly baseAmount: Money;
  readonly taxRate: number;
  readonly taxAmount: Money;
  readonly taxType: TaxType;
  readonly deductible: boolean;
  readonly accountingPeriod: string;
  readonly taxCode: string;
  readonly invoiceNumber?: string;
  readonly qualifiedInvoice?: boolean;
}

/**
 * 税コード
 * @description 税計算用のコード定義
 */
export interface TaxCode extends EntityBase {
  readonly code: string;
  readonly name: string;
  readonly rate: number;
  readonly type: TaxType;
  readonly isActive: boolean;
  readonly effectiveDate: DateTime;
  readonly expiryDate?: DateTime;
  readonly description?: string;
}

/**
 * 税サマリ
 * @description 税金関連の集計情報
 */
export interface TaxSummary {
  readonly totalTaxableAmount: Money;
  readonly totalTaxAmount: Money;
  readonly taxByRate: Readonly<Record<string, Money>>;
  readonly deductibleAmount: Money;
  readonly nonDeductibleAmount: Money;
  readonly qualifiedInvoiceAmount?: Money;
  readonly nonQualifiedInvoiceAmount?: Money;
}

// ================================
// 同期・連携関連型定義
// ================================

/**
 * 同期結果
 * @description 会計システムとの同期結果
 */
export interface SyncResult {
  readonly success: boolean;
  readonly syncedExpenses: number;
  readonly failedExpenses: number;
  readonly totalAmount: Money;
  readonly errors: ReadonlyArray<SyncError>;
  readonly journalEntries: ReadonlyArray<AccountingEntry>;
  readonly reconciliationStatus: ReconciliationStatus;
  readonly processingTime: number;
  readonly syncId: string;
  readonly timestamp: DateTime;
}

/**
 * 同期エラー
 * @description 同期処理中のエラー情報
 */
export interface SyncError {
  readonly expenseId: string;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly retryable: boolean;
  readonly retryCount: number;
  readonly lastRetryAt?: DateTime;
  readonly details?: Record<string, unknown>;
  readonly suggestedAction?: string;
}

/**
 * 同期ジョブ
 * @description 同期処理のジョブ情報
 */
export interface SyncJob extends AuditableEntity {
  readonly jobType: SyncJobType;
  readonly status: SyncJobStatus;
  readonly parameters: SyncJobParameters;
  readonly result?: SyncResult;
  readonly scheduledAt?: DateTime;
  readonly startedAt?: DateTime;
  readonly completedAt?: DateTime;
  readonly nextRetryAt?: DateTime;
}

/** 同期ジョブタイプ */
export type SyncJobType = 
  | 'expense_sync' 
  | 'journal_sync' 
  | 'master_sync' 
  | 'reconciliation';

/** 同期ジョブステータス */
export type SyncJobStatus = 
  | 'pending' 
  | 'running' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

/**
 * 同期ジョブパラメータ
 * @description 同期ジョブの実行パラメータ
 */
export interface SyncJobParameters {
  readonly targetIds?: ReadonlyArray<string>;
  readonly dateRange?: {
    readonly startDate: DateTime;
    readonly endDate: DateTime;
  };
  readonly batchSize?: number;
  readonly retryFailedOnly?: boolean;
  readonly dryRun?: boolean;
}

// ================================
// 照合関連型定義
// ================================

/**
 * 照合ステータス
 * @description データ照合の結果
 */
export interface ReconciliationStatus {
  readonly matched: number;
  readonly unmatched: number;
  readonly discrepancies: ReadonlyArray<Discrepancy>;
  readonly confidence: number;
  readonly lastReconciledAt?: DateTime;
  readonly reconciledBy?: string;
}

/** 不一致タイプ */
export type DiscrepancyType = 
  | 'amount_mismatch' 
  | 'date_mismatch' 
  | 'account_mismatch' 
  | 'missing_entry'
  | 'duplicate_entry'
  | 'tax_mismatch';

/** 重大度 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 不一致情報
 * @description 照合時に発見された不一致
 */
export interface Discrepancy {
  readonly type: DiscrepancyType;
  readonly description: string;
  readonly expectedValue: unknown;
  readonly actualValue: unknown;
  readonly severity: Severity;
  readonly suggestion?: string;
  readonly autoFixable?: boolean;
  readonly relatedIds?: ReadonlyArray<string>;
}

/**
 * 照合ルール
 * @description 自動照合のルール定義
 */
export interface ReconciliationRule extends EntityBase {
  readonly name: string;
  readonly description: string;
  readonly matchingCriteria: ReadonlyArray<MatchingCriterion>;
  readonly tolerance?: Tolerance;
  readonly isActive: boolean;
  readonly priority: number;
}

/**
 * マッチング条件
 * @description 照合時のマッチング条件
 */
export interface MatchingCriterion {
  readonly field: string;
  readonly matchType: 'exact' | 'fuzzy' | 'range' | 'pattern';
  readonly weight: number;
  readonly required: boolean;
}

/**
 * 許容範囲
 * @description 照合時の許容範囲設定
 */
export interface Tolerance {
  readonly amountDifference?: Money;
  readonly amountPercentage?: number;
  readonly dateDifference?: number; // days
}

// ================================
// レポート関連型定義
// ================================

/**
 * レポーティングデータ
 * @description 会計レポート用データ
 */
export interface ReportingData {
  readonly period: ReportingPeriod;
  readonly totalExpenses: Money;
  readonly expensesByCategory: ReadonlyArray<CategorySummary>;
  readonly expensesByDepartment: ReadonlyArray<DepartmentSummary>;
  readonly expensesByProject?: ReadonlyArray<ProjectSummary>;
  readonly taxSummary: TaxSummary;
  readonly complianceMetrics: ComplianceMetrics;
  readonly trends?: TrendAnalysis;
}

/**
 * レポート期間
 * @description レポートの対象期間
 */
export interface ReportingPeriod {
  readonly startDate: DateTime;
  readonly endDate: DateTime;
  readonly periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  readonly fiscalYear?: number;
  readonly quarter?: number;
}

/**
 * カテゴリ別サマリ
 * @description 経費カテゴリ別の集計
 */
export interface CategorySummary {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amount: Money;
  readonly count: number;
  readonly taxAmount: Money;
  readonly percentage: number;
  readonly previousPeriodAmount?: Money;
  readonly growthRate?: number;
}

/**
 * 部門別サマリ
 * @description 部門別の経費集計
 */
export interface DepartmentSummary {
  readonly departmentId: string;
  readonly departmentName: string;
  readonly amount: Money;
  readonly count: number;
  readonly budgetUtilization: number;
  readonly headcount?: number;
  readonly perCapitaExpense?: Money;
}

/**
 * プロジェクト別サマリ
 * @description プロジェクト別の経費集計
 */
export interface ProjectSummary {
  readonly projectId: string;
  readonly projectName: string;
  readonly amount: Money;
  readonly count: number;
  readonly budgetUtilization: number;
  readonly profitability?: number;
}

/**
 * トレンド分析
 * @description 経費のトレンド分析結果
 */
export interface TrendAnalysis {
  readonly overallTrend: 'increasing' | 'stable' | 'decreasing';
  readonly monthOverMonth: number; // percentage
  readonly yearOverYear: number; // percentage
  readonly seasonalPatterns: ReadonlyArray<SeasonalPattern>;
  readonly outliers: ReadonlyArray<Outlier>;
}

/**
 * 季節パターン
 * @description 季節性のあるパターン
 */
export interface SeasonalPattern {
  readonly month: number;
  readonly averageAmount: Money;
  readonly variance: number;
  readonly significance: number;
}

/**
 * 外れ値
 * @description 統計的な外れ値
 */
export interface Outlier {
  readonly date: DateTime;
  readonly amount: Money;
  readonly zscore: number;
  readonly description: string;
}

/**
 * コンプライアンス指標
 * @description コンプライアンス関連の指標
 */
export interface ComplianceMetrics {
  readonly receiptComplianceRate: number;
  readonly approvalComplianceRate: number;
  readonly timingComplianceRate: number;
  readonly documentationComplianceRate: number;
  readonly overallScore: number;
  readonly violations: ReadonlyArray<ComplianceViolation>;
}

/**
 * コンプライアンス違反
 * @description 検出されたコンプライアンス違反
 */
export interface ComplianceViolation {
  readonly type: string;
  readonly description: string;
  readonly severity: Severity;
  readonly count: number;
  readonly affectedExpenses: ReadonlyArray<string>;
  readonly correctiveAction: string;
}

// ================================
// プロバイダインターフェース
// ================================

/**
 * 会計プロバイダインターフェース
 * @description 会計システムプロバイダが実装すべきインターフェース
 */
export interface IAccountingProvider {
  testConnection(config: AccountingSystemConfig): Promise<boolean>;
  
  postJournalEntry(
    config: AccountingSystemConfig, 
    entry: JournalEntry
  ): Promise<string>;
  
  syncExpenses(
    config: AccountingSystemConfig, 
    expenses: ReadonlyArray<ExpenseRequest>
  ): Promise<{
    readonly syncedCount: number;
    readonly failedCount: number;
    readonly errors: ReadonlyArray<SyncError>;
  }>;
  
  getAccountCodes(
    config: AccountingSystemConfig
  ): Promise<ReadonlyArray<AccountCode>>;
  
  getTaxCodes(
    config: AccountingSystemConfig
  ): Promise<ReadonlyArray<TaxCode>>;
  
  getJournalEntry(
    config: AccountingSystemConfig,
    externalId: string
  ): Promise<JournalEntry | null>;
  
  reverseJournalEntry(
    config: AccountingSystemConfig,
    externalId: string,
    reason: string
  ): Promise<string>;
}

// ================================
// エクスポート
// ================================

export type {
  // Re-export commonly used types
  Result,
  Money,
  DateTime,
  ValidationError,
  ExpenseRequest,
  Employee
};