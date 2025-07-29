/**
 * リファクタリング済み会計統合API
 * AI-OS v3.0 - 型安全性強化版
 */

import type { Result } from '@core/result';
import type { Money } from '@core/money';
import type { DateTime } from '@core/date-time';
import type { ValidationError } from '@core/validation';
import type { 
  ExpenseRequest,
  ExpenseItem,
  ExpenseCategory 
} from '@domain/expense';
import type { 
  PaySlip,
  TaxDetails,
  SocialInsuranceDetails 
} from '@domain/payroll';

/**
 * 会計システムプロバイダー
 */
export type AccountingProvider = 
  | 'freee'         // freee会計
  | 'moneyforward'  // マネーフォワード
  | 'yayoi'         // 弥生会計
  | 'custom';       // カスタム

/**
 * 会計システム設定
 */
export interface AccountingSystemConfig {
  readonly provider: AccountingProvider;
  readonly apiEndpoint: string;
  readonly authentication: AuthenticationConfig;
  readonly companyId: string;
  readonly environment: 'sandbox' | 'production';
  readonly features: ReadonlyArray<AccountingFeature>;
  readonly syncOptions: SyncOptions;
  readonly mappings: AccountMappings;
}

/**
 * 認証設定
 */
export interface AuthenticationConfig {
  readonly type: 'oauth2' | 'api_key' | 'basic';
  readonly clientId?: string;
  readonly clientSecret?: string;
  readonly apiKey?: string;
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly tokenExpiry?: DateTime;
}

/**
 * 会計機能
 */
export interface AccountingFeature {
  readonly name: FeatureName;
  readonly enabled: boolean;
  readonly configuration: Readonly<Record<string, unknown>>;
}

export type FeatureName = 
  | 'expense_sync'        // 経費同期
  | 'payroll_sync'        // 給与同期
  | 'invoice_creation'    // 請求書作成
  | 'receipt_ocr'         // レシートOCR
  | 'bank_reconciliation' // 銀行照合
  | 'tax_calculation'     // 税金計算
  | 'budget_management'   // 予算管理
  | 'analytics';          // 分析機能

/**
 * 同期オプション
 */
export interface SyncOptions {
  readonly autoSync: boolean;
  readonly syncInterval: number; // 分
  readonly batchSize: number;
  readonly retryPolicy: RetryPolicy;
  readonly conflictResolution: ConflictResolution;
}

/**
 * リトライポリシー
 */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffStrategy: 'fixed' | 'exponential';
  readonly initialDelay: number; // ミリ秒
  readonly maxDelay: number; // ミリ秒
}

/**
 * 競合解決方法
 */
export type ConflictResolution = 
  | 'local_wins'    // ローカル優先
  | 'remote_wins'   // リモート優先
  | 'merge'         // マージ
  | 'manual';       // 手動解決

/**
 * 勘定科目マッピング
 */
export interface AccountMappings {
  readonly expenseCategories: ReadonlyMap<ExpenseCategory, AccountCode>;
  readonly taxCodes: ReadonlyMap<string, TaxCode>;
  readonly departments: ReadonlyMap<string, CostCenter>;
  readonly defaultAccounts: DefaultAccounts;
}

/**
 * 勘定科目コード
 */
export interface AccountCode {
  readonly code: string;
  readonly name: string;
  readonly type: AccountType;
  readonly taxCode?: string;
}

export type AccountType = 
  | 'asset'         // 資産
  | 'liability'     // 負債
  | 'equity'        // 資本
  | 'revenue'       // 収益
  | 'expense';      // 費用

/**
 * 税コード
 */
export interface TaxCode {
  readonly code: string;
  readonly name: string;
  readonly rate: number;
  readonly type: TaxType;
}

export type TaxType = 
  | 'consumption_tax'     // 消費税
  | 'reduced_rate'        // 軽減税率
  | 'non_taxable'         // 非課税
  | 'tax_exempt'          // 免税
  | 'tax_inclusive';      // 内税

/**
 * コストセンター
 */
export interface CostCenter {
  readonly code: string;
  readonly name: string;
  readonly parentCode?: string;
}

/**
 * デフォルト勘定科目
 */
export interface DefaultAccounts {
  readonly payable: string;          // 未払金
  readonly receivable: string;       // 売掛金
  readonly cash: string;             // 現金
  readonly bank: string;             // 普通預金
  readonly expenseSuspense: string;  // 経費仮払金
  readonly salaryPayable: string;    // 未払給与
}

/**
 * 同期結果
 */
export interface SyncResult {
  readonly success: boolean;
  readonly summary: SyncSummary;
  readonly errors: ReadonlyArray<SyncError>;
  readonly journalEntries: ReadonlyArray<JournalEntry>;
  readonly reconciliationStatus: ReconciliationStatus;
  readonly processingTime: number; // ミリ秒
  readonly syncId: string;
  readonly timestamp: DateTime;
}

/**
 * 同期サマリー
 */
export interface SyncSummary {
  readonly totalRecords: number;
  readonly syncedRecords: number;
  readonly failedRecords: number;
  readonly skippedRecords: number;
  readonly totalAmount: Money;
  readonly syncType: 'full' | 'incremental';
}

/**
 * 同期エラー
 */
export interface SyncError {
  readonly recordId: string;
  readonly recordType: 'expense' | 'payroll' | 'invoice';
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;
  readonly retryCount: number;
  readonly lastRetryAt?: DateTime;
  readonly resolution?: string;
}

/**
 * 照合ステータス
 */
export interface ReconciliationStatus {
  readonly matched: number;
  readonly unmatched: number;
  readonly discrepancies: ReadonlyArray<Discrepancy>;
  readonly confidence: number; // 0-1
  readonly lastReconciled: DateTime;
}

/**
 * 不一致
 */
export interface Discrepancy {
  readonly type: DiscrepancyType;
  readonly description: string;
  readonly expectedValue: unknown;
  readonly actualValue: unknown;
  readonly severity: 'low' | 'medium' | 'high';
  readonly suggestion?: string;
  readonly affectedRecords: ReadonlyArray<string>;
}

export type DiscrepancyType = 
  | 'amount_mismatch'    // 金額不一致
  | 'date_mismatch'      // 日付不一致
  | 'account_mismatch'   // 勘定科目不一致
  | 'missing_entry'      // エントリー欠落
  | 'duplicate_entry'    // 重複エントリー
  | 'tax_mismatch';      // 税額不一致

/**
 * 仕訳エントリー
 */
export interface JournalEntry {
  readonly id: string;
  readonly sourceId: string; // 元データID（経費・給与等）
  readonly sourceType: 'expense' | 'payroll' | 'manual';
  readonly date: DateTime;
  readonly description: string;
  readonly lines: ReadonlyArray<JournalLine>;
  readonly totalAmount: Money;
  readonly status: JournalStatus;
  readonly referenceNumber?: string;
  readonly externalId?: string; // 会計システム側のID
  readonly attachments?: ReadonlyArray<string>;
  readonly approvedBy?: string;
  readonly approvedAt?: DateTime;
  readonly metadata?: Record<string, unknown>;
}

export type JournalStatus = 
  | 'draft'      // 下書き
  | 'pending'    // 承認待ち
  | 'approved'   // 承認済み
  | 'posted'     // 転記済み
  | 'cancelled'  // キャンセル
  | 'error';     // エラー

/**
 * 仕訳明細
 */
export interface JournalLine {
  readonly accountCode: string;
  readonly accountName: string;
  readonly debit?: Money;
  readonly credit?: Money;
  readonly description?: string;
  readonly taxCode?: string;
  readonly taxAmount?: Money;
  readonly costCenter?: string;
  readonly project?: string;
  readonly tags?: ReadonlyArray<string>;
}

/**
 * 税金計算結果
 */
export interface TaxCalculationResult {
  readonly sourceId: string;
  readonly baseAmount: Money;
  readonly taxDetails: ReadonlyArray<TaxDetail>;
  readonly totalTaxAmount: Money;
  readonly accountingPeriod: string;
  readonly calculatedAt: DateTime;
}

/**
 * 税金詳細
 */
export interface TaxDetail {
  readonly taxCode: string;
  readonly taxName: string;
  readonly taxRate: number;
  readonly taxableAmount: Money;
  readonly taxAmount: Money;
  readonly deductible: boolean;
  readonly taxType: TaxType;
}

/**
 * リファクタリング済み会計統合サービス
 */
export class RefactoredAccountingIntegrationService {
  private readonly providers: Map<AccountingProvider, AccountingAdapter>;

  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly journalRepository: JournalRepository,
    private readonly reconciliationService: ReconciliationService,
    private readonly taxCalculationService: TaxCalculationService
  ) {
    this.providers = new Map();
    this.initializeProviders();
  }

  /**
   * 経費同期
   */
  async syncExpenses(
    expenses: ReadonlyArray<ExpenseRequest>,
    config: AccountingSystemConfig
  ): Promise<Result<SyncResult, ValidationError>> {
    // 1. 設定検証
    const validationResult = this.validateConfig(config);
    if (validationResult.isFailure) {
      return validationResult;
    }

    // 2. プロバイダー取得
    const adapter = this.providers.get(config.provider);
    if (!adapter) {
      return Result.failure({
        field: 'provider',
        message: `サポートされていないプロバイダーです: ${config.provider}`,
        code: 'UNSUPPORTED_PROVIDER',
      });
    }

    // 3. 認証
    const authResult = await this.authenticate(config);
    if (authResult.isFailure) {
      return authResult;
    }

    // 4. 仕訳変換
    const journalEntries = await this.convertToJournalEntries(expenses, config);

    // 5. 同期実行
    const syncStartTime = DateTime.now();
    const syncResults = await this.performSync(journalEntries, adapter, config);

    // 6. 照合実行
    const reconciliationStatus = await this.reconciliationService.reconcile(
      journalEntries,
      syncResults.postedEntries
    );

    // 7. 結果作成
    const result: SyncResult = {
      success: syncResults.errors.length === 0,
      summary: {
        totalRecords: expenses.length,
        syncedRecords: syncResults.successCount,
        failedRecords: syncResults.errors.length,
        skippedRecords: syncResults.skippedCount,
        totalAmount: this.calculateTotalAmount(expenses),
        syncType: 'incremental',
      },
      errors: syncResults.errors,
      journalEntries: syncResults.postedEntries,
      reconciliationStatus,
      processingTime: DateTime.diffInMilliseconds(DateTime.now(), syncStartTime),
      syncId: this.generateSyncId(),
      timestamp: DateTime.now(),
    };

    // 8. 結果保存
    await this.saveSyncResult(result);

    return Result.success(result);
  }

  /**
   * 給与同期
   */
  async syncPayroll(
    payslips: ReadonlyArray<PaySlip>,
    config: AccountingSystemConfig
  ): Promise<Result<SyncResult, ValidationError>> {
    // 1. 給与仕訳生成
    const journalEntries = await this.createPayrollJournalEntries(payslips, config);

    // 2. 税金計算
    const taxCalculations = await Promise.all(
      payslips.map(payslip => this.calculatePayrollTaxes(payslip))
    );

    // 3. 社会保険仕訳
    const insuranceEntries = await this.createInsuranceJournalEntries(
      payslips,
      config
    );

    // 4. 全仕訳を統合
    const allEntries = [...journalEntries, ...insuranceEntries];

    // 5. 同期実行
    return this.syncJournalEntries(allEntries, config);
  }

  /**
   * 仕訳取得
   */
  async getJournalEntry(
    entryId: string
  ): Promise<Result<JournalEntry, ValidationError>> {
    const entry = await this.journalRepository.findById(entryId);
    
    if (!entry) {
      return Result.failure({
        field: 'entryId',
        message: '仕訳が見つかりません',
        code: 'ENTRY_NOT_FOUND',
      });
    }

    return Result.success(entry);
  }

  /**
   * 照合実行
   */
  async performReconciliation(
    period: { start: DateTime; end: DateTime },
    config: AccountingSystemConfig
  ): Promise<Result<ReconciliationStatus, ValidationError>> {
    // 1. 期間内の仕訳取得
    const localEntries = await this.journalRepository.findByPeriod(
      period.start,
      period.end
    );

    // 2. 会計システムから取得
    const adapter = this.providers.get(config.provider);
    if (!adapter) {
      return Result.failure({
        field: 'provider',
        message: 'プロバイダーが見つかりません',
        code: 'PROVIDER_NOT_FOUND',
      });
    }

    const remoteEntries = await adapter.fetchJournalEntries(period, config);

    // 3. 照合実行
    const status = await this.reconciliationService.reconcile(
      localEntries,
      remoteEntries
    );

    return Result.success(status);
  }

  /**
   * 税金計算
   */
  async calculateTaxes(
    expense: ExpenseRequest
  ): Promise<Result<TaxCalculationResult, ValidationError>> {
    try {
      const taxDetails = await this.taxCalculationService.calculate(expense);
      
      const result: TaxCalculationResult = {
        sourceId: expense.id,
        baseAmount: expense.totalAmount,
        taxDetails,
        totalTaxAmount: this.sumTaxAmounts(taxDetails),
        accountingPeriod: this.getCurrentAccountingPeriod(),
        calculatedAt: DateTime.now(),
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure({
        field: 'tax',
        message: '税金計算中にエラーが発生しました',
        code: 'TAX_CALCULATION_ERROR',
      });
    }
  }

  // Private methods
  private initializeProviders(): void {
    this.providers.set('freee', new FreeeAdapter());
    this.providers.set('moneyforward', new MoneyForwardAdapter());
    this.providers.set('yayoi', new YayoiAdapter());
  }

  private validateConfig(
    config: AccountingSystemConfig
  ): Result<void, ValidationError> {
    if (!config.apiEndpoint) {
      return Result.failure({
        field: 'apiEndpoint',
        message: 'APIエンドポイントは必須です',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!config.companyId) {
      return Result.failure({
        field: 'companyId',
        message: '企業IDは必須です',
        code: 'REQUIRED_FIELD',
      });
    }

    return Result.success(undefined);
  }

  private async authenticate(
    config: AccountingSystemConfig
  ): Promise<Result<AuthenticationResult, ValidationError>> {
    const adapter = this.providers.get(config.provider);
    if (!adapter) {
      return Result.failure({
        field: 'provider',
        message: 'プロバイダーが見つかりません',
        code: 'PROVIDER_NOT_FOUND',
      });
    }

    try {
      const authResult = await adapter.authenticate(config.authentication);
      return Result.success(authResult);
    } catch (error) {
      return Result.failure({
        field: 'authentication',
        message: '認証に失敗しました',
        code: 'AUTH_FAILED',
      });
    }
  }

  private async convertToJournalEntries(
    expenses: ReadonlyArray<ExpenseRequest>,
    config: AccountingSystemConfig
  ): Promise<JournalEntry[]> {
    return Promise.all(
      expenses.map(expense => this.createJournalEntry(expense, config))
    );
  }

  private async createJournalEntry(
    expense: ExpenseRequest,
    config: AccountingSystemConfig
  ): Promise<JournalEntry> {
    const lines: JournalLine[] = [];

    // 借方（経費）
    for (const item of expense.items) {
      const accountCode = this.getAccountCode(item.category, config.mappings);
      lines.push({
        accountCode: accountCode.code,
        accountName: accountCode.name,
        debit: item.amount,
        description: item.description,
        taxCode: item.taxRate > 0 ? this.getTaxCode(item.taxRate, config.mappings) : undefined,
        taxAmount: item.taxAmount,
        costCenter: expense.departmentCode,
        project: expense.projectCode,
      });
    }

    // 貸方（未払金）
    lines.push({
      accountCode: config.mappings.defaultAccounts.payable,
      accountName: '未払金',
      credit: expense.totalAmount,
      description: `${expense.title} - ${expense.employeeId}`,
    });

    return {
      id: this.generateJournalId(),
      sourceId: expense.id,
      sourceType: 'expense',
      date: expense.requestDate,
      description: expense.title,
      lines,
      totalAmount: expense.totalAmount,
      status: 'draft',
      referenceNumber: expense.id,
    };
  }

  private async createPayrollJournalEntries(
    payslips: ReadonlyArray<PaySlip>,
    config: AccountingSystemConfig
  ): Promise<JournalEntry[]> {
    return Promise.all(
      payslips.map(payslip => this.createPayrollJournalEntry(payslip, config))
    );
  }

  private async createPayrollJournalEntry(
    payslip: PaySlip,
    config: AccountingSystemConfig
  ): Promise<JournalEntry> {
    const lines: JournalLine[] = [];

    // 借方（給与費用）
    lines.push({
      accountCode: '5110',
      accountName: '給与手当',
      debit: payslip.basicSalary,
      description: `基本給 - ${payslip.employeeId}`,
    });

    // 借方（各種手当）
    for (const allowance of payslip.allowances) {
      lines.push({
        accountCode: '5120',
        accountName: allowance.name,
        debit: allowance.amount,
        description: `${allowance.name} - ${payslip.employeeId}`,
      });
    }

    // 貸方（各種控除）
    for (const deduction of payslip.deductions) {
      lines.push({
        accountCode: this.getDeductionAccountCode(deduction.type),
        accountName: deduction.name,
        credit: deduction.amount,
        description: `${deduction.name} - ${payslip.employeeId}`,
      });
    }

    // 貸方（未払給与）
    lines.push({
      accountCode: config.mappings.defaultAccounts.salaryPayable,
      accountName: '未払給与',
      credit: payslip.netPay,
      description: `手取額 - ${payslip.employeeId}`,
    });

    return {
      id: this.generateJournalId(),
      sourceId: payslip.id,
      sourceType: 'payroll',
      date: payslip.createdAt,
      description: `給与 - ${payslip.employeeId}`,
      lines,
      totalAmount: payslip.grossPay,
      status: 'draft',
      referenceNumber: payslip.id,
    };
  }

  private generateSyncId(): string {
    return `SYNC_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateJournalId(): string {
    return `JE_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private calculateTotalAmount(expenses: ReadonlyArray<ExpenseRequest>): Money {
    return expenses.reduce(
      (total, expense) => Money.add(total, expense.totalAmount),
      Money.create(0, 'JPY')
    );
  }

  private getAccountCode(
    category: ExpenseCategory,
    mappings: AccountMappings
  ): AccountCode {
    return mappings.expenseCategories.get(category) || {
      code: '5999',
      name: 'その他経費',
      type: 'expense',
    };
  }

  private getTaxCode(rate: number, mappings: AccountMappings): string {
    // 税率から税コードを取得（簡略化）
    if (rate === 0.1) return 'TAX10';
    if (rate === 0.08) return 'TAX08';
    return 'TAX00';
  }

  private getDeductionAccountCode(type: string): string {
    const codeMap: Record<string, string> = {
      income_tax: '2141',
      resident_tax: '2142',
      health_insurance: '2151',
      pension: '2152',
      employment_insurance: '2153',
      long_term_care: '2154',
    };
    return codeMap[type] || '2199';
  }

  private sumTaxAmounts(taxDetails: ReadonlyArray<TaxDetail>): Money {
    return taxDetails.reduce(
      (total, detail) => Money.add(total, detail.taxAmount),
      Money.create(0, 'JPY')
    );
  }

  private getCurrentAccountingPeriod(): string {
    const now = DateTime.now();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private async performSync(
    entries: JournalEntry[],
    adapter: AccountingAdapter,
    config: AccountingSystemConfig
  ): Promise<{
    successCount: number;
    skippedCount: number;
    errors: SyncError[];
    postedEntries: JournalEntry[];
  }> {
    let successCount = 0;
    let skippedCount = 0;
    const errors: SyncError[] = [];
    const postedEntries: JournalEntry[] = [];

    for (const entry of entries) {
      try {
        const result = await adapter.postJournalEntry(entry, config);
        if (result.success) {
          successCount++;
          postedEntries.push(result.entry);
        } else {
          errors.push(result.error);
        }
      } catch (error) {
        errors.push({
          recordId: entry.id,
          recordType: 'expense',
          errorCode: 'SYNC_ERROR',
          errorMessage: error instanceof Error ? error.message : '不明なエラー',
          retryable: true,
          retryCount: 0,
        });
      }
    }

    return { successCount, skippedCount, errors, postedEntries };
  }

  private async saveSyncResult(result: SyncResult): Promise<void> {
    // 同期結果の保存
    await this.journalRepository.saveSyncResult(result);
  }

  private async syncJournalEntries(
    entries: JournalEntry[],
    config: AccountingSystemConfig
  ): Promise<Result<SyncResult, ValidationError>> {
    const adapter = this.providers.get(config.provider);
    if (!adapter) {
      return Result.failure({
        field: 'provider',
        message: 'プロバイダーが見つかりません',
        code: 'PROVIDER_NOT_FOUND',
      });
    }

    const syncStartTime = DateTime.now();
    const syncResults = await this.performSync(entries, adapter, config);

    const result: SyncResult = {
      success: syncResults.errors.length === 0,
      summary: {
        totalRecords: entries.length,
        syncedRecords: syncResults.successCount,
        failedRecords: syncResults.errors.length,
        skippedRecords: syncResults.skippedCount,
        totalAmount: this.calculateJournalTotal(entries),
        syncType: 'incremental',
      },
      errors: syncResults.errors,
      journalEntries: syncResults.postedEntries,
      reconciliationStatus: {
        matched: syncResults.successCount,
        unmatched: 0,
        discrepancies: [],
        confidence: 1,
        lastReconciled: DateTime.now(),
      },
      processingTime: DateTime.diffInMilliseconds(DateTime.now(), syncStartTime),
      syncId: this.generateSyncId(),
      timestamp: DateTime.now(),
    };

    return Result.success(result);
  }

  private calculateJournalTotal(entries: JournalEntry[]): Money {
    return entries.reduce(
      (total, entry) => Money.add(total, entry.totalAmount),
      Money.create(0, 'JPY')
    );
  }

  private async createInsuranceJournalEntries(
    payslips: ReadonlyArray<PaySlip>,
    config: AccountingSystemConfig
  ): Promise<JournalEntry[]> {
    // 社会保険料の仕訳作成
    return [];
  }

  private async calculatePayrollTaxes(payslip: PaySlip): Promise<TaxDetail[]> {
    // 給与の税金計算
    return [];
  }
}

// インターフェース
interface ConfigRepository {
  getConfig(companyId: string): Promise<AccountingSystemConfig>;
}

interface JournalRepository {
  findById(id: string): Promise<JournalEntry | null>;
  findByPeriod(start: DateTime, end: DateTime): Promise<JournalEntry[]>;
  saveSyncResult(result: SyncResult): Promise<void>;
}

interface ReconciliationService {
  reconcile(
    localEntries: JournalEntry[],
    remoteEntries: JournalEntry[]
  ): Promise<ReconciliationStatus>;
}

interface TaxCalculationService {
  calculate(expense: ExpenseRequest): Promise<TaxDetail[]>;
}

// アダプター
interface AccountingAdapter {
  authenticate(config: AuthenticationConfig): Promise<AuthenticationResult>;
  postJournalEntry(
    entry: JournalEntry,
    config: AccountingSystemConfig
  ): Promise<{ success: boolean; entry: JournalEntry; error: SyncError }>;
  fetchJournalEntries(
    period: { start: DateTime; end: DateTime },
    config: AccountingSystemConfig
  ): Promise<JournalEntry[]>;
}

interface AuthenticationResult {
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
}

// 具体的なアダプター実装（スタブ）
class FreeeAdapter implements AccountingAdapter {
  async authenticate(config: AuthenticationConfig): Promise<AuthenticationResult> {
    // freee API認証実装
    return { success: true, accessToken: 'dummy_token' };
  }

  async postJournalEntry(
    entry: JournalEntry,
    config: AccountingSystemConfig
  ): Promise<{ success: boolean; entry: JournalEntry; error: SyncError }> {
    // freee API仕訳登録実装
    return { success: true, entry, error: null as any };
  }

  async fetchJournalEntries(
    period: { start: DateTime; end: DateTime },
    config: AccountingSystemConfig
  ): Promise<JournalEntry[]> {
    // freee API仕訳取得実装
    return [];
  }
}

class MoneyForwardAdapter implements AccountingAdapter {
  async authenticate(config: AuthenticationConfig): Promise<AuthenticationResult> {
    return { success: true, accessToken: 'dummy_token' };
  }

  async postJournalEntry(
    entry: JournalEntry,
    config: AccountingSystemConfig
  ): Promise<{ success: boolean; entry: JournalEntry; error: SyncError }> {
    return { success: true, entry, error: null as any };
  }

  async fetchJournalEntries(
    period: { start: DateTime; end: DateTime },
    config: AccountingSystemConfig
  ): Promise<JournalEntry[]> {
    return [];
  }
}

class YayoiAdapter implements AccountingAdapter {
  async authenticate(config: AuthenticationConfig): Promise<AuthenticationResult> {
    return { success: true, accessToken: 'dummy_token' };
  }

  async postJournalEntry(
    entry: JournalEntry,
    config: AccountingSystemConfig
  ): Promise<{ success: boolean; entry: JournalEntry; error: SyncError }> {
    return { success: true, entry, error: null as any };
  }

  async fetchJournalEntries(
    period: { start: DateTime; end: DateTime },
    config: AccountingSystemConfig
  ): Promise<JournalEntry[]> {
    return [];
  }
}