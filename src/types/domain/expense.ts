/**
 * 経費管理ドメイン型定義
 * AI-OS v3.0
 */

import { Money } from '../core/money';
import { DateTime } from '../core/date-time';
import { Result } from '../core/result';
import { ValidationError } from '../core/validation';

/**
 * 経費申請
 */
export interface ExpenseRequest {
  readonly id: string;
  readonly employeeId: string;
  readonly requestDate: DateTime;
  readonly title: string;
  readonly purpose: string;
  readonly projectCode?: string;
  readonly departmentCode?: string;
  readonly items: ReadonlyArray<ExpenseItem>;
  readonly totalAmount: Money;
  readonly status: ExpenseStatus;
  readonly approvalFlow: ApprovalFlow;
  readonly attachments: ReadonlyArray<Attachment>;
  readonly submittedAt?: DateTime;
  readonly approvedAt?: DateTime;
  readonly paidAt?: DateTime;
  readonly rejectedAt?: DateTime;
  readonly rejectionReason?: string;
  readonly accountingPeriod?: string;
  readonly notes?: string;
}

/**
 * 経費項目
 */
export interface ExpenseItem {
  readonly id: string;
  readonly date: DateTime;
  readonly category: ExpenseCategory;
  readonly subcategory?: string;
  readonly description: string;
  readonly amount: Money;
  readonly taxRate: number;
  readonly taxAmount: Money;
  readonly vendor?: string;
  readonly paymentMethod: PaymentMethod;
  readonly receipt?: Receipt;
  readonly isReimbursable: boolean;
  readonly accountCode?: string;
  readonly costCenter?: string;
  readonly tags: ReadonlyArray<string>;
  readonly aiAnalysis?: ExpenseAIAnalysis;
}

/**
 * 経費カテゴリー
 */
export type ExpenseCategory = 
  | 'transportation'      // 交通費
  | 'accommodation'       // 宿泊費
  | 'meal'               // 飲食費
  | 'entertainment'      // 接待交際費
  | 'office_supplies'    // 事務用品
  | 'communication'      // 通信費
  | 'books'              // 書籍・資料
  | 'training'           // 研修費
  | 'membership'         // 会費
  | 'utilities'          // 水道光熱費
  | 'rent'               // 賃借料
  | 'equipment'          // 備品
  | 'software'           // ソフトウェア
  | 'professional_fee'   // 専門家報酬
  | 'other';             // その他

/**
 * 支払方法
 */
export type PaymentMethod = 
  | 'cash'              // 現金
  | 'credit_card'       // クレジットカード
  | 'debit_card'        // デビットカード
  | 'bank_transfer'     // 銀行振込
  | 'ic_card'           // ICカード
  | 'company_card'      // 法人カード
  | 'prepaid'           // 前払い
  | 'invoice';          // 請求書払い

/**
 * 経費ステータス
 */
export type ExpenseStatus = 
  | 'draft'             // 下書き
  | 'submitted'         // 申請済み
  | 'in_review'         // レビュー中
  | 'approved'          // 承認済み
  | 'rejected'          // 却下
  | 'paid'              // 支払済み
  | 'cancelled';        // キャンセル

/**
 * レシート
 */
export interface Receipt {
  readonly id: string;
  readonly imageUrl: string;
  readonly ocrData?: OCRData;
  readonly uploadedAt: DateTime;
  readonly isVerified: boolean;
  readonly verificationScore?: number;
}

/**
 * OCRデータ
 */
export interface OCRData {
  readonly vendor: string;
  readonly date: DateTime;
  readonly amount: Money;
  readonly taxAmount?: Money;
  readonly items: ReadonlyArray<{
    readonly name: string;
    readonly quantity: number;
    readonly unitPrice: Money;
    readonly amount: Money;
  }>;
  readonly confidence: number;
  readonly rawText: string;
}

/**
 * 添付ファイル
 */
export interface Attachment {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
  readonly url: string;
  readonly uploadedAt: DateTime;
  readonly description?: string;
}

/**
 * 承認フロー
 */
export interface ApprovalFlow {
  readonly steps: ReadonlyArray<ApprovalStep>;
  readonly currentStep: number;
  readonly isComplete: boolean;
  readonly isRejected: boolean;
}

/**
 * 承認ステップ
 */
export interface ApprovalStep {
  readonly level: number;
  readonly approverRole: string;
  readonly approverId?: string;
  readonly status: 'pending' | 'approved' | 'rejected' | 'skipped';
  readonly decidedAt?: DateTime;
  readonly comments?: string;
  readonly conditions?: ApprovalCondition[];
}

/**
 * 承認条件
 */
export interface ApprovalCondition {
  readonly type: 'amount' | 'category' | 'custom';
  readonly operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in';
  readonly value: Money | string | string[];
}

/**
 * AI分析結果
 */
export interface ExpenseAIAnalysis {
  readonly category: ExpenseCategory;
  readonly subcategory?: string;
  readonly vendor?: string;
  readonly isDuplicate: boolean;
  readonly similarExpenses?: string[]; // 類似経費ID
  readonly anomalyScore: number;
  readonly complianceFlags: ComplianceFlag[];
  readonly suggestions: string[];
  readonly confidence: number;
}

/**
 * コンプライアンスフラグ
 */
export interface ComplianceFlag {
  readonly type: ComplianceFlagType;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly rule?: string;
}

/**
 * コンプライアンスフラグ種別
 */
export type ComplianceFlagType = 
  | 'over_limit'           // 上限超過
  | 'missing_receipt'      // レシート不足
  | 'invalid_category'     // 不適切なカテゴリ
  | 'duplicate_expense'    // 重複経費
  | 'unusual_amount'       // 異常金額
  | 'policy_violation'     // ポリシー違反
  | 'tax_issue';           // 税務問題

/**
 * 経費ポリシー
 */
export interface ExpensePolicy {
  readonly id: string;
  readonly name: string;
  readonly effectiveDate: DateTime;
  readonly rules: ReadonlyArray<ExpensePolicyRule>;
  readonly approvalMatrix: ReadonlyArray<ApprovalMatrixEntry>;
}

/**
 * 経費ポリシールール
 */
export interface ExpensePolicyRule {
  readonly id: string;
  readonly category: ExpenseCategory;
  readonly limitType: 'daily' | 'monthly' | 'per_item' | 'annual';
  readonly limitAmount: Money;
  readonly requiresReceipt: boolean;
  readonly requiresPreApproval: boolean;
  readonly additionalRequirements?: string[];
}

/**
 * 承認マトリクスエントリ
 */
export interface ApprovalMatrixEntry {
  readonly minAmount: Money;
  readonly maxAmount: Money;
  readonly approverRoles: string[];
  readonly escalationDays?: number;
}

/**
 * 経費レポート
 */
export interface ExpenseReport {
  readonly id: string;
  readonly period: {
    readonly start: DateTime;
    readonly end: DateTime;
  };
  readonly employeeId?: string;
  readonly departmentCode?: string;
  readonly totalAmount: Money;
  readonly byCategory: Record<ExpenseCategory, Money>;
  readonly byPaymentMethod: Record<PaymentMethod, Money>;
  readonly topVendors: Array<{
    readonly vendor: string;
    readonly amount: Money;
    readonly count: number;
  }>;
  readonly trends: Array<{
    readonly date: DateTime;
    readonly amount: Money;
  }>;
  readonly anomalies: ExpenseAnomaly[];
}

/**
 * 経費異常
 */
export interface ExpenseAnomaly {
  readonly type: 'spike' | 'unusual_pattern' | 'policy_breach' | 'fraud_risk';
  readonly description: string;
  readonly amount: Money;
  readonly confidence: number;
  readonly affectedExpenses: string[];
}

/**
 * 経費申請作成パラメータ
 */
export interface CreateExpenseRequestParams {
  readonly employeeId: string;
  readonly title: string;
  readonly purpose: string;
  readonly items: ExpenseItem[];
  readonly projectCode?: string;
  readonly departmentCode?: string;
  readonly notes?: string;
}

/**
 * 経費検証
 */
export function validateExpenseRequest(
  params: CreateExpenseRequestParams
): Result<CreateExpenseRequestParams, ValidationError> {
  const errors: ValidationError[] = [];

  if (!params.title || params.title.trim().length === 0) {
    errors.push({
      field: 'title',
      message: 'タイトルは必須です',
      code: 'REQUIRED_FIELD'
    });
  }

  if (!params.purpose || params.purpose.trim().length === 0) {
    errors.push({
      field: 'purpose',
      message: '目的は必須です',
      code: 'REQUIRED_FIELD'
    });
  }

  if (!params.items || params.items.length === 0) {
    errors.push({
      field: 'items',
      message: '経費項目を1つ以上追加してください',
      code: 'REQUIRED_ITEMS'
    });
  }

  // 各項目の検証
  params.items.forEach((item, index) => {
    if (item.amount.amount <= 0) {
      errors.push({
        field: `items[${index}].amount`,
        message: '金額は0より大きい必要があります',
        code: 'INVALID_AMOUNT'
      });
    }

    if (!item.description || item.description.trim().length === 0) {
      errors.push({
        field: `items[${index}].description`,
        message: '説明は必須です',
        code: 'REQUIRED_FIELD'
      });
    }
  });

  return errors.length > 0 
    ? Result.failure(errors[0])
    : Result.success(params);
}

/**
 * 経費合計計算
 */
export function calculateExpenseTotal(
  items: ReadonlyArray<ExpenseItem>
): Money {
  return items.reduce(
    (total, item) => Money.add(total, item.amount),
    Money.create(0, 'JPY')
  );
}

/**
 * 承認要否判定
 */
export function requiresApproval(
  amount: Money,
  policy: ExpensePolicy
): boolean {
  const approvalEntry = policy.approvalMatrix.find(
    entry => Money.compare(amount, entry.minAmount) >= 0 &&
             Money.compare(amount, entry.maxAmount) <= 0
  );
  
  return approvalEntry !== undefined && approvalEntry.approverRoles.length > 0;
}

/**
 * ポリシー違反チェック
 */
export function checkPolicyViolations(
  expense: ExpenseItem,
  policy: ExpensePolicy
): ComplianceFlag[] {
  const flags: ComplianceFlag[] = [];
  
  const rule = policy.rules.find(r => r.category === expense.category);
  if (!rule) return flags;

  // 金額上限チェック
  if (Money.compare(expense.amount, rule.limitAmount) > 0) {
    flags.push({
      type: 'over_limit',
      severity: 'error',
      message: `${expense.category}の上限額を超えています`,
      rule: rule.id
    });
  }

  // レシート要件チェック
  if (rule.requiresReceipt && !expense.receipt) {
    flags.push({
      type: 'missing_receipt',
      severity: 'warning',
      message: 'レシートの添付が必要です',
      rule: rule.id
    });
  }

  return flags;
}