/**
 * リファクタリング済み経費管理エンジン
 * AI-OS v3.0 - 型安全性強化版
 */

import type { Result } from '../../types/core/result.js';
import type { Money } from '../../types/core/money.js';
import type { DateTime } from '../../types/core/datetime.js';
import type { ValidationError } from '../../types/core/validation.js';
import type { Employee } from '../../types/domain/employee.js';
import type {
  ExpenseRequest,
  ExpenseItem,
  ExpenseCategory,
  PaymentMethod,
  ExpenseStatus,
  Receipt,
  OCRData,
  Attachment,
  ApprovalFlow,
  ApprovalStep,
  ExpenseAIAnalysis,
  ComplianceFlag,
  ComplianceFlagType,
  ExpensePolicy,
  ExpensePolicyRule,
  ExpenseReport,
  ExpenseAnomaly,
  CreateExpenseRequestParams
} from '../../types/domain/expense.js';
import { success, failure, isSuccess } from '../../types/core/result.js';
import { createMoney, addMoney, multiplyMoney } from '../../types/core/money.js';
import { createDateTime, formatDateTime } from '../../types/core/datetime.js';

/**
 * OCR処理結果（詳細版）
 */
export interface AdvancedOCRResult {
  readonly text: string;
  readonly confidence: number;
  readonly language: string;
  readonly structure: {
    readonly vendor: ReceiptVendor;
    readonly items: ReadonlyArray<ReceiptItem>;
    readonly totals: ReceiptTotals;
    readonly metadata: ReceiptMetadata;
  };
  readonly qualityScore: number; // 0-1, 画像品質評価
  readonly validationFlags: ReadonlyArray<ValidationFlag>;
  readonly processingDuration: number; // ミリ秒
}

/**
 * レシート店舗情報
 */
export interface ReceiptVendor {
  readonly name: string;
  readonly address?: string;
  readonly phone?: string;
  readonly taxId?: string;
  readonly confidence: number;
  readonly normalized?: {
    readonly vendorId?: string;
    readonly category?: string;
  };
}

/**
 * レシート項目
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
 * レシート合計
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
 */
export interface ReceiptMetadata {
  readonly receiptDate: DateTime;
  readonly receiptNumber?: string;
  readonly paymentMethod?: PaymentMethod;
  readonly currency: string;
  readonly extractedAt: DateTime;
}

/**
 * 検証フラグ
 */
export interface ValidationFlag {
  readonly type: ValidationFlagType;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly confidence: number;
  readonly field?: string;
}

export type ValidationFlagType = 
  | 'format_error'       // フォーマットエラー
  | 'amount_mismatch'    // 金額不一致
  | 'date_invalid'       // 日付無効
  | 'duplicate_suspect'  // 重複疑い
  | 'quality_low'        // 品質低下
  | 'vendor_unknown'     // 不明な店舗
  | 'category_uncertain'; // カテゴリ不明確

/**
 * インテリジェント承認推奨
 */
export interface IntelligentApprovalRecommendation {
  readonly action: ApprovalAction;
  readonly confidence: number;
  readonly reasons: ReadonlyArray<ApprovalReason>;
  readonly riskFactors: ReadonlyArray<RiskFactor>;
  readonly alternativeActions?: ReadonlyArray<AlternativeAction>;
  readonly estimatedProcessingTime: number; // 分
  readonly requiredApprovers?: ReadonlyArray<string>;
}

export type ApprovalAction = 
  | 'auto_approve'          // 自動承認
  | 'manual_review'         // 手動レビュー
  | 'reject'                // 却下
  | 'request_clarification' // 説明要求
  | 'escalate';             // エスカレーション

/**
 * 承認理由
 */
export interface ApprovalReason {
  readonly category: ReasonCategory;
  readonly description: string;
  readonly weight: number; // 0-1
  readonly evidence?: ReadonlyArray<string>;
}

export type ReasonCategory = 
  | 'policy_compliance'  // ポリシー準拠
  | 'amount_validation'  // 金額妥当性
  | 'receipt_quality'    // レシート品質
  | 'historical_pattern' // 過去パターン
  | 'risk_assessment'    // リスク評価
  | 'vendor_reputation'; // 店舗評価

/**
 * リスクファクター
 */
export interface RiskFactor {
  readonly type: RiskType;
  readonly level: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly mitigationActions?: ReadonlyArray<string>;
}

export type RiskType = 
  | 'fraud_pattern'      // 不正パターン
  | 'unusual_amount'     // 異常金額
  | 'policy_violation'   // ポリシー違反
  | 'duplicate_expense'  // 重複経費
  | 'vendor_blacklist'   // ブラックリスト店舗
  | 'timing_anomaly';    // タイミング異常

/**
 * 代替アクション
 */
export interface AlternativeAction {
  readonly action: ApprovalAction;
  readonly condition: string;
  readonly estimatedImpact: string;
}

/**
 * 不正検知結果
 */
export interface FraudDetectionResult {
  readonly score: number; // 0-100
  readonly indicators: ReadonlyArray<FraudIndicator>;
  readonly recommendation: FraudRecommendation;
  readonly confidence: number;
  readonly similarCases?: ReadonlyArray<SimilarFraudCase>;
}

/**
 * 不正指標
 */
export interface FraudIndicator {
  readonly type: string;
  readonly description: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly evidence: ReadonlyArray<string>;
}

/**
 * 不正対応推奨
 */
export interface FraudRecommendation {
  readonly action: 'approve' | 'investigate' | 'reject' | 'report';
  readonly urgency: 'low' | 'medium' | 'high' | 'immediate';
  readonly steps: ReadonlyArray<string>;
}

/**
 * 類似不正ケース
 */
export interface SimilarFraudCase {
  readonly caseId: string;
  readonly similarity: number; // 0-1
  readonly outcome: string;
  readonly date: DateTime;
}

/**
 * リファクタリング済み経費管理エンジン
 */
export class RefactoredExpenseEngine {
  constructor(
    private readonly ocrService: OCRService,
    private readonly nlpService: NLPService,
    private readonly fraudDetectionService: FraudDetectionService,
    private readonly approvalService: ApprovalService,
    private readonly analyticsService: AnalyticsService,
    private readonly policyRepository: PolicyRepository,
    private readonly expenseRepository: ExpenseRepository,
    private readonly employeeRepository: EmployeeRepository
  ) {}

  /**
   * 経費申請作成
   */
  async createExpenseRequest(
    params: CreateExpenseRequestParams
  ): Promise<Result<ExpenseRequest, ValidationError>> {
    // 1. パラメータ検証
    const validationResult = validateExpenseRequest(params);
    if (validationResult.isFailure) {
      return validationResult;
    }

    // 2. 従業員検証
    const employeeResult = await this.employeeRepository.findById(params.employeeId);
    if (employeeResult.isFailure) {
      return Result.failure({
        field: 'employeeId',
        message: '従業員が見つかりません',
        code: 'EMPLOYEE_NOT_FOUND',
      });
    }

    // 3. ポリシー取得
    const policy = await this.policyRepository.getCurrentPolicy(
      employeeResult.value.companyId
    );

    // 4. 各項目の処理
    const processedItems = await Promise.all(
      params.items.map(item => this.processExpenseItem(item, policy))
    );

    // 5. 合計金額計算
    const totalAmount = calculateExpenseTotal(processedItems);

    // 6. 承認フロー決定
    const approvalFlow = await this.determineApprovalFlow(
      totalAmount,
      processedItems,
      employeeResult.value,
      policy
    );

    // 7. 経費申請作成
    const request: ExpenseRequest = {
      id: this.generateRequestId(),
      employeeId: params.employeeId,
      requestDate: DateTime.now(),
      title: params.title,
      purpose: params.purpose,
      projectCode: params.projectCode,
      departmentCode: params.departmentCode,
      items: processedItems,
      totalAmount,
      status: 'draft',
      approvalFlow,
      attachments: [],
      notes: params.notes,
    };

    // 8. 保存
    await this.expenseRepository.save(request);

    return Result.success(request);
  }

  /**
   * レシートスキャン処理
   */
  async processReceipt(
    imageData: Buffer,
    metadata: { employeeId: string; uploadedAt: DateTime }
  ): Promise<Result<ProcessedReceipt, ValidationError>> {
    // 1. OCR処理
    const ocrResult = await this.performAdvancedOCR(imageData);
    if (ocrResult.isFailure) {
      return Result.failure({
        field: 'receipt',
        message: 'レシートの読み取りに失敗しました',
        code: 'OCR_FAILED',
      });
    }

    // 2. データ抽出・検証
    const extractedData = this.extractReceiptData(ocrResult.value);
    
    // 3. AI分析
    const aiAnalysis = await this.analyzeReceipt(extractedData, metadata.employeeId);

    // 4. 不正検知
    const fraudResult = await this.fraudDetectionService.analyze({
      receipt: extractedData,
      employee: metadata.employeeId,
      history: await this.getEmployeeExpenseHistory(metadata.employeeId),
    });

    // 5. 経費項目作成
    const expenseItem = this.createExpenseItemFromReceipt(
      extractedData,
      aiAnalysis,
      fraudResult
    );

    return Result.success({
      item: expenseItem,
      ocrResult: ocrResult.value,
      aiAnalysis,
      fraudDetection: fraudResult,
      validationFlags: this.validateReceiptData(extractedData),
    });
  }

  /**
   * インテリジェント承認ワークフロー
   */
  async processApproval(
    requestId: string,
    approverId: string
  ): Promise<Result<ApprovalDecision, ValidationError>> {
    // 1. 経費申請取得
    const request = await this.expenseRepository.findById(requestId);
    if (!request) {
      return Result.failure({
        field: 'requestId',
        message: '経費申請が見つかりません',
        code: 'REQUEST_NOT_FOUND',
      });
    }

    // 2. 承認権限確認
    const hasAuthority = await this.checkApprovalAuthority(
      approverId,
      request,
      request.approvalFlow
    );
    if (!hasAuthority) {
      return Result.failure({
        field: 'approverId',
        message: '承認権限がありません',
        code: 'UNAUTHORIZED',
      });
    }

    // 3. AI承認推奨取得
    const recommendation = await this.getApprovalRecommendation(request);

    // 4. リスク評価
    const riskAssessment = await this.assessRisk(request);

    // 5. 承認判定
    const decision: ApprovalDecision = {
      requestId,
      approverId,
      recommendation,
      riskAssessment,
      suggestedAction: this.determineSuggestedAction(recommendation, riskAssessment),
      requiredActions: this.getRequiredActions(request, riskAssessment),
      timestamp: DateTime.now(),
    };

    return Result.success(decision);
  }

  /**
   * 経費分析レポート生成
   */
  async generateExpenseReport(
    params: GenerateReportParams
  ): Promise<Result<ExpenseReport, ValidationError>> {
    // 1. データ集計
    const expenses = await this.expenseRepository.findByPeriod(
      params.period.start,
      params.period.end,
      params.filters
    );

    // 2. カテゴリ別集計
    const byCategory = this.aggregateByCategory(expenses);

    // 3. 支払方法別集計
    const byPaymentMethod = this.aggregateByPaymentMethod(expenses);

    // 4. 上位ベンダー分析
    const topVendors = this.analyzeTopVendors(expenses);

    // 5. トレンド分析
    const trends = await this.analyticsService.analyzeTrends(expenses);

    // 6. 異常検知
    const anomalies = await this.detectAnomalies(expenses);

    // 7. レポート作成
    const report: ExpenseReport = {
      id: this.generateReportId(),
      period: params.period,
      employeeId: params.employeeId,
      departmentCode: params.departmentCode,
      totalAmount: this.calculateTotal(expenses),
      byCategory,
      byPaymentMethod,
      topVendors,
      trends,
      anomalies,
    };

    return Result.success(report);
  }

  /**
   * 高度なOCR処理
   */
  private async performAdvancedOCR(
    imageData: Buffer
  ): Promise<Result<AdvancedOCRResult, ValidationError>> {
    try {
      const startTime = DateTime.now();
      
      // 画像品質評価
      const qualityScore = await this.ocrService.assessImageQuality(imageData);
      if (qualityScore < 0.3) {
        return Result.failure({
          field: 'image',
          message: '画像品質が低すぎます',
          code: 'LOW_QUALITY_IMAGE',
        });
      }

      // OCR実行
      const ocrData = await this.ocrService.extract(imageData);
      
      // 構造化データ抽出
      const structure = await this.extractStructuredData(ocrData);

      // 検証フラグ生成
      const validationFlags = this.generateValidationFlags(structure);

      const result: AdvancedOCRResult = {
        text: ocrData.text,
        confidence: ocrData.confidence,
        language: ocrData.language,
        structure,
        qualityScore,
        validationFlags,
        processingDuration: DateTime.diffInMilliseconds(DateTime.now(), startTime),
      };

      return Result.success(result);
    } catch (error) {
      return Result.failure({
        field: 'ocr',
        message: 'OCR処理中にエラーが発生しました',
        code: 'OCR_ERROR',
      });
    }
  }

  /**
   * レシートデータ抽出
   */
  private extractReceiptData(ocrResult: AdvancedOCRResult): ExtractedReceiptData {
    const { structure } = ocrResult;
    
    return {
      vendor: structure.vendor,
      items: structure.items,
      totals: structure.totals,
      metadata: structure.metadata,
      confidence: ocrResult.confidence,
      validationFlags: ocrResult.validationFlags,
    };
  }

  /**
   * AI分析実行
   */
  private async analyzeReceipt(
    receiptData: ExtractedReceiptData,
    employeeId: string
  ): Promise<ExpenseAIAnalysis> {
    // カテゴリ推定
    const category = await this.nlpService.categorizeExpense({
      vendor: receiptData.vendor.name,
      items: receiptData.items.map(i => i.description),
      amount: receiptData.totals.totalAmount,
    });

    // 重複チェック
    const duplicateCheck = await this.checkForDuplicates(receiptData, employeeId);

    // 異常スコア計算
    const anomalyScore = await this.calculateAnomalyScore(receiptData, employeeId);

    // コンプライアンスチェック
    const complianceFlags = await this.performComplianceChecks(receiptData, category);

    // 改善提案生成
    const suggestions = await this.generateSuggestions(
      receiptData,
      category,
      complianceFlags
    );

    return {
      category: category.category,
      subcategory: category.subcategory,
      vendor: receiptData.vendor.name,
      isDuplicate: duplicateCheck.isDuplicate,
      similarExpenses: duplicateCheck.similarIds,
      anomalyScore,
      complianceFlags,
      suggestions,
      confidence: category.confidence,
    };
  }

  /**
   * 承認推奨生成
   */
  private async getApprovalRecommendation(
    request: ExpenseRequest
  ): Promise<IntelligentApprovalRecommendation> {
    // ポリシー準拠チェック
    const policyCompliance = await this.checkPolicyCompliance(request);

    // 過去パターン分析
    const historicalAnalysis = await this.analyzeHistoricalPatterns(request);

    // リスク評価
    const riskFactors = await this.identifyRiskFactors(request);

    // 推奨アクション決定
    const action = this.determineRecommendedAction(
      policyCompliance,
      historicalAnalysis,
      riskFactors
    );

    // 理由生成
    const reasons = this.generateApprovalReasons(
      policyCompliance,
      historicalAnalysis,
      riskFactors
    );

    return {
      action,
      confidence: this.calculateRecommendationConfidence(reasons),
      reasons,
      riskFactors,
      alternativeActions: this.generateAlternativeActions(action, riskFactors),
      estimatedProcessingTime: this.estimateProcessingTime(action),
      requiredApprovers: await this.identifyRequiredApprovers(request, action),
    };
  }

  // ヘルパーメソッド
  private generateRequestId(): string {
    return `EXP_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateReportId(): string {
    return `RPT_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private async processExpenseItem(
    item: ExpenseItem,
    policy: ExpensePolicy
  ): Promise<ExpenseItem> {
    // ポリシー違反チェック
    const violations = checkPolicyViolations(item, policy);
    
    // AI分析がない場合は実行
    if (!item.aiAnalysis) {
      const aiAnalysis = await this.analyzeExpenseItem(item);
      return { ...item, aiAnalysis };
    }

    return item;
  }

  private async determineApprovalFlow(
    totalAmount: Money,
    items: ReadonlyArray<ExpenseItem>,
    employee: Employee,
    policy: ExpensePolicy
  ): Promise<ApprovalFlow> {
    const needsApproval = requiresApproval(totalAmount, policy);
    
    if (!needsApproval) {
      return {
        steps: [],
        currentStep: 0,
        isComplete: true,
        isRejected: false,
      };
    }

    // 承認ステップ生成
    const steps = await this.approvalService.generateApprovalSteps(
      totalAmount,
      employee,
      policy
    );

    return {
      steps,
      currentStep: 0,
      isComplete: false,
      isRejected: false,
    };
  }

  private async getEmployeeExpenseHistory(
    employeeId: string
  ): Promise<ExpenseHistory> {
    const recentExpenses = await this.expenseRepository.findByEmployee(
      employeeId,
      { limit: 100 }
    );

    return {
      totalExpenses: recentExpenses.length,
      averageAmount: this.calculateAverage(recentExpenses),
      frequentCategories: this.getFrequentCategories(recentExpenses),
      frequentVendors: this.getFrequentVendors(recentExpenses),
    };
  }
}

// サポートインターフェース
interface OCRService {
  extract(imageData: Buffer): Promise<{ text: string; confidence: number; language: string }>;
  assessImageQuality(imageData: Buffer): Promise<number>;
}

interface NLPService {
  categorizeExpense(data: {
    vendor: string;
    items: string[];
    amount: Money;
  }): Promise<{ category: ExpenseCategory; subcategory?: string; confidence: number }>;
}

interface FraudDetectionService {
  analyze(data: {
    receipt: ExtractedReceiptData;
    employee: string;
    history: ExpenseHistory;
  }): Promise<FraudDetectionResult>;
}

interface ApprovalService {
  generateApprovalSteps(
    amount: Money,
    employee: Employee,
    policy: ExpensePolicy
  ): Promise<ApprovalStep[]>;
}

interface AnalyticsService {
  analyzeTrends(expenses: ExpenseRequest[]): Promise<Array<{ date: DateTime; amount: Money }>>;
}

interface PolicyRepository {
  getCurrentPolicy(companyId: string): Promise<ExpensePolicy>;
}

interface ExpenseRepository {
  save(request: ExpenseRequest): Promise<void>;
  findById(id: string): Promise<ExpenseRequest | null>;
  findByPeriod(
    start: DateTime,
    end: DateTime,
    filters?: Record<string, unknown>
  ): Promise<ExpenseRequest[]>;
  findByEmployee(employeeId: string, options?: { limit: number }): Promise<ExpenseRequest[]>;
}

interface EmployeeRepository {
  findById(id: string): Promise<Result<Employee, ValidationError>>;
}

// 補助型定義
interface ProcessedReceipt {
  readonly item: ExpenseItem;
  readonly ocrResult: AdvancedOCRResult;
  readonly aiAnalysis: ExpenseAIAnalysis;
  readonly fraudDetection: FraudDetectionResult;
  readonly validationFlags: ValidationFlag[];
}

interface ExtractedReceiptData {
  readonly vendor: ReceiptVendor;
  readonly items: ReadonlyArray<ReceiptItem>;
  readonly totals: ReceiptTotals;
  readonly metadata: ReceiptMetadata;
  readonly confidence: number;
  readonly validationFlags: ReadonlyArray<ValidationFlag>;
}

interface ApprovalDecision {
  readonly requestId: string;
  readonly approverId: string;
  readonly recommendation: IntelligentApprovalRecommendation;
  readonly riskAssessment: RiskAssessment;
  readonly suggestedAction: ApprovalAction;
  readonly requiredActions: string[];
  readonly timestamp: DateTime;
}

interface RiskAssessment {
  readonly overallRisk: 'low' | 'medium' | 'high' | 'critical';
  readonly factors: RiskFactor[];
  readonly mitigationRequired: boolean;
}

interface GenerateReportParams {
  readonly period: { start: DateTime; end: DateTime };
  readonly employeeId?: string;
  readonly departmentCode?: string;
  readonly filters?: Record<string, unknown>;
}

interface ExpenseHistory {
  readonly totalExpenses: number;
  readonly averageAmount: Money;
  readonly frequentCategories: Array<{ category: ExpenseCategory; count: number }>;
  readonly frequentVendors: Array<{ vendor: string; count: number }>;
}