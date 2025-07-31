/**
 * 拡張経費管理型定義
 * Extended Expense Management Type Definitions
 */

import type { ExpenseRequest, ExtractedReceiptData } from '../../types';
import type { Result } from '../core/result';

/**
 * 機械学習モデルの基本インターフェース
 */
export interface MLModel {
  name: string;
  version: string;
  predict(input: unknown): Promise<unknown>;
  train?(data: unknown[]): Promise<void>;
}

/**
 * レシート分類モデル
 */
export interface ReceiptClassifier extends MLModel {
  classify(text: string): Promise<{ category: string; confidence: number }>;
}

/**
 * 不正検知モデル
 */
export interface FraudDetector extends MLModel {
  detectFraud(expense: ExpenseRequest): Promise<{ isFraud: boolean; confidence: number; reasons: string[] }>;
}

/**
 * 経費予測モデル
 */
export interface ExpensePredictor extends MLModel {
  predictExpense(employeeId: string, month: string): Promise<{ amount: number; confidence: number }>;
}

/**
 * 異常検知モデル
 */
export interface AnomalyDetector extends MLModel {
  detectAnomaly(expenses: ExpenseRequest[]): Promise<{ anomalies: string[]; score: number }>;
}

/**
 * OCR結果
 */
export interface OCRResult {
  text: string;
  confidence: number;
  language?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 経費アラート
 */
export interface ExpenseAlert {
  id: string;
  type: 'budget_exceeded' | 'unusual_expense' | 'policy_violation' | 'duplicate_expense';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 不正検知エンジンの分析結果
 */
export interface FraudAnalysis {
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  indicators: string[];
  confidence: number;
}

/**
 * 履歴パターン分析結果
 */
export interface HistoricalAnalysis {
  averageExpense: number;
  typicalCategories: string[];
  anomalyScore: number;
  patterns: Pattern[];
}

/**
 * パターン情報
 */
export interface Pattern {
  type: string;
  frequency: number;
  description: string;
}

/**
 * MLレコメンデーション入力
 */
export interface MLRecommendationInput {
  policyCompliance: PolicyCompliance;
  fraudAnalysis: FraudAnalysis;
  historicalAnalysis: HistoricalAnalysis;
  receiptQuality: number;
  riskFactors: RiskFactor[];
}

/**
 * ポリシー準拠情報
 */
export interface PolicyCompliance {
  isCompliant: boolean;
  violations: string[];
  complianceScore: number;
}

/**
 * リスクファクター
 */
export interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: number;
}

/**
 * 拡張経費エンジンクラス定義
 */
export interface FraudDetectionEngine {
  analyzeExpense(
    expenseRequest: ExpenseRequest,
    receiptData?: unknown
  ): Promise<FraudAnalysis>;
}

export interface ApprovalEngine {
  evaluateRequest(expenseRequest: ExpenseRequest): Promise<Result<boolean, string>>;
}

export interface AnalyticsEngine {
  generateInsights(expenses: ExpenseRequest[]): Promise<Record<string, unknown>>;
}