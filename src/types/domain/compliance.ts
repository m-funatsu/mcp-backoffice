/**
 * コンプライアンス管理ドメイン型定義
 * AI-OS v3.0
 */

import { DateTime } from '../core/date-time';
import { Result } from '../core/result';
import { ValidationError } from '../core/validation';

/**
 * 36協定（時間外労働・休日労働に関する協定）
 */
export interface Agreement36 {
  readonly id: string;
  readonly companyId: string;
  readonly effectiveDate: DateTime;
  readonly expiryDate: DateTime;
  readonly standardLimits: {
    readonly dailyOvertime: number;      // 1日の上限（時間）
    readonly monthlyOvertime: number;    // 月間上限（時間）
    readonly yearlyOvertime: number;     // 年間上限（時間）
  };
  readonly specialClauseLimits?: {      // 特別条項
    readonly monthlyOvertime: number;    // 月間上限（時間）
    readonly yearlyOvertime: number;     // 年間上限（時間）
    readonly monthlyFrequency: number;   // 月の使用回数上限
    readonly yearlyFrequency: number;    // 年の使用回数上限
  };
  readonly holidayWorkLimits: {
    readonly monthlyDays: number;        // 月間休日労働日数
    readonly yearlyDays: number;         // 年間休日労働日数
  };
  readonly healthMeasures: string[];    // 健康確保措置
  readonly registeredAt: DateTime;
  readonly registeredBy: string;
}

/**
 * コンプライアンス違反
 */
export interface ComplianceViolation {
  readonly id: string;
  readonly type: ViolationType;
  readonly severity: ViolationSeverity;
  readonly employeeId: string;
  readonly detectedAt: DateTime;
  readonly period: {
    readonly start: DateTime;
    readonly end: DateTime;
  };
  readonly details: ViolationDetails;
  readonly status: ViolationStatus;
  readonly actions: ReadonlyArray<ComplianceAction>;
  readonly resolvedAt?: DateTime;
  readonly resolvedBy?: string;
  readonly notes?: string;
}

/**
 * 違反タイプ
 */
export type ViolationType = 
  | 'overtime_daily'           // 日次残業時間超過
  | 'overtime_monthly'         // 月間残業時間超過
  | 'overtime_yearly'          // 年間残業時間超過
  | 'consecutive_work'         // 連続勤務
  | 'break_time'              // 休憩時間不足
  | 'interval_time'           // 勤務間インターバル不足
  | 'holiday_work'            // 休日労働超過
  | 'multi_month_average'     // 複数月平均超過
  | 'special_clause_overuse'  // 特別条項過剰使用
  | 'health_check_required'   // 健康診断必要
  | 'leave_not_taken';        // 有給未消化

/**
 * 違反重要度
 */
export type ViolationSeverity = 
  | 'info'      // 情報
  | 'warning'   // 警告
  | 'critical'  // 重大
  | 'emergency'; // 緊急

/**
 * 違反ステータス
 */
export type ViolationStatus = 
  | 'detected'    // 検出済み
  | 'notified'    // 通知済み
  | 'in_progress' // 対応中
  | 'resolved'    // 解決済み
  | 'escalated';  // エスカレーション済み

/**
 * 違反詳細
 */
export interface ViolationDetails {
  readonly actual: number;      // 実績値
  readonly limit: number;       // 上限値
  readonly excess: number;      // 超過値
  readonly percentage: number;  // 超過率
  readonly description: string; // 詳細説明
  readonly affectedDates?: DateTime[]; // 影響日
  readonly relatedRecords?: string[];  // 関連レコードID
}

/**
 * コンプライアンスアクション
 */
export interface ComplianceAction {
  readonly type: ActionType;
  readonly status: ActionStatus;
  readonly assignedTo?: string;
  readonly dueDate?: DateTime;
  readonly completedAt?: DateTime;
  readonly result?: string;
  readonly notes?: string;
}

/**
 * アクションタイプ
 */
export type ActionType = 
  | 'notify_employee'      // 従業員への通知
  | 'notify_manager'       // 上司への通知
  | 'notify_hr'           // 人事への通知
  | 'schedule_interview'   // 面談予約
  | 'medical_checkup'      // 健康診断
  | 'work_adjustment'      // 勤務調整
  | 'report_authority'     // 労基署報告
  | 'create_improvement';  // 改善計画作成

/**
 * アクションステータス
 */
export type ActionStatus = 
  | 'pending'    // 保留中
  | 'scheduled'  // スケジュール済み
  | 'in_progress' // 実行中
  | 'completed'  // 完了
  | 'cancelled'; // キャンセル

/**
 * 労働時間監視設定
 */
export interface WorkTimeMonitoringConfig {
  readonly companyId: string;
  readonly alerts: ReadonlyArray<AlertConfig>;
  readonly autoActions: ReadonlyArray<AutoActionConfig>;
  readonly reportingSchedule: ReportingSchedule;
  readonly excludedEmployees?: string[];
  readonly customRules?: CustomComplianceRule[];
}

/**
 * アラート設定
 */
export interface AlertConfig {
  readonly id: string;
  readonly name: string;
  readonly condition: AlertCondition;
  readonly threshold: number;
  readonly recipients: AlertRecipient[];
  readonly frequency: 'realtime' | 'daily' | 'weekly' | 'monthly';
  readonly enabled: boolean;
}

/**
 * アラート条件
 */
export type AlertCondition = 
  | 'overtime_approaching'     // 残業時間接近
  | 'overtime_exceeded'        // 残業時間超過
  | 'consecutive_work_days'    // 連続勤務日数
  | 'break_time_violation'     // 休憩時間違反
  | 'interval_violation'       // インターバル違反
  | 'leave_expiry_approaching'; // 有給失効接近

/**
 * アラート受信者
 */
export interface AlertRecipient {
  readonly type: 'employee' | 'manager' | 'hr' | 'custom';
  readonly id?: string;
  readonly email?: string;
  readonly notificationMethods: ('email' | 'slack' | 'teams' | 'sms')[];
}

/**
 * 自動アクション設定
 */
export interface AutoActionConfig {
  readonly trigger: ViolationType;
  readonly actions: ActionType[];
  readonly conditions?: Record<string, unknown>;
  readonly enabled: boolean;
}

/**
 * レポーティングスケジュール
 */
export interface ReportingSchedule {
  readonly daily: boolean;
  readonly weekly: {
    readonly enabled: boolean;
    readonly dayOfWeek: number; // 0-6
  };
  readonly monthly: {
    readonly enabled: boolean;
    readonly dayOfMonth: number; // 1-31
  };
  readonly quarterly: boolean;
  readonly annual: boolean;
}

/**
 * カスタムコンプライアンスルール
 */
export interface CustomComplianceRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly condition: string; // 評価式
  readonly severity: ViolationSeverity;
  readonly actions: ActionType[];
  readonly enabled: boolean;
}

/**
 * コンプライアンスレポート
 */
export interface ComplianceReport {
  readonly id: string;
  readonly period: {
    readonly start: DateTime;
    readonly end: DateTime;
  };
  readonly summary: {
    readonly totalEmployees: number;
    readonly violationCount: number;
    readonly violationRate: number;
    readonly resolvedCount: number;
    readonly pendingCount: number;
  };
  readonly byType: Record<ViolationType, number>;
  readonly bySeverity: Record<ViolationSeverity, number>;
  readonly byDepartment: Record<string, ComplianceDepartmentStats>;
  readonly trends: ComplianceTrend[];
  readonly recommendations: string[];
  readonly generatedAt: DateTime;
}

/**
 * 部門別コンプライアンス統計
 */
export interface ComplianceDepartmentStats {
  readonly departmentName: string;
  readonly employeeCount: number;
  readonly violationCount: number;
  readonly averageOvertimeHours: number;
  readonly complianceScore: number;
}

/**
 * コンプライアンストレンド
 */
export interface ComplianceTrend {
  readonly date: DateTime;
  readonly violationCount: number;
  readonly overtimeAverage: number;
  readonly complianceScore: number;
}

/**
 * 健康確保措置
 */
export interface HealthMeasure {
  readonly id: string;
  readonly employeeId: string;
  readonly type: HealthMeasureType;
  readonly requiredBy: DateTime;
  readonly scheduledDate?: DateTime;
  readonly completedDate?: DateTime;
  readonly result?: string;
  readonly nextCheckDate?: DateTime;
  readonly notes?: string;
}

/**
 * 健康確保措置タイプ
 */
export type HealthMeasureType = 
  | 'medical_interview'     // 医師面接指導
  | 'health_checkup'        // 健康診断
  | 'stress_check'          // ストレスチェック
  | 'work_improvement'      // 勤務改善
  | 'leave_recommendation'; // 休暇取得推奨

/**
 * 36協定違反チェック
 */
export function check36AgreementViolation(
  workHours: number,
  agreement: Agreement36,
  period: 'daily' | 'monthly' | 'yearly'
): Result<void, ComplianceViolation> {
  const limits = agreement.standardLimits;
  let limit: number;
  let violationType: ViolationType;

  switch (period) {
    case 'daily':
      limit = limits.dailyOvertime;
      violationType = 'overtime_daily';
      break;
    case 'monthly':
      limit = limits.monthlyOvertime;
      violationType = 'overtime_monthly';
      break;
    case 'yearly':
      limit = limits.yearlyOvertime;
      violationType = 'overtime_yearly';
      break;
  }

  if (workHours > limit) {
    const violation: ComplianceViolation = {
      id: `violation_${Date.now()}`,
      type: violationType,
      severity: workHours > limit * 1.2 ? 'critical' : 'warning',
      employeeId: '', // 実際の実装では適切に設定
      detectedAt: DateTime.now(),
      period: {
        start: DateTime.now(),
        end: DateTime.now()
      },
      details: {
        actual: workHours,
        limit: limit,
        excess: workHours - limit,
        percentage: ((workHours - limit) / limit) * 100,
        description: `${period}の残業時間が上限を超過しています`
      },
      status: 'detected',
      actions: []
    };

    return Result.failure(violation);
  }

  return Result.success(undefined);
}

/**
 * 休憩時間違反チェック
 */
export function checkBreakTimeViolation(
  workMinutes: number,
  breakMinutes: number
): Result<void, ValidationError> {
  let requiredBreak = 0;

  if (workMinutes > 360) { // 6時間超
    requiredBreak = 45;
  }
  if (workMinutes > 480) { // 8時間超
    requiredBreak = 60;
  }

  if (breakMinutes < requiredBreak) {
    return Result.failure({
      field: 'breakTime',
      message: `${requiredBreak}分以上の休憩時間が必要です（実際: ${breakMinutes}分）`,
      code: 'BREAK_TIME_VIOLATION'
    });
  }

  return Result.success(undefined);
}

/**
 * 連続勤務日数チェック
 */
export function checkConsecutiveWorkDays(
  consecutiveDays: number,
  maxDays: number = 13
): Result<void, ValidationError> {
  if (consecutiveDays > maxDays) {
    return Result.failure({
      field: 'consecutiveWorkDays',
      message: `連続勤務日数が上限（${maxDays}日）を超えています`,
      code: 'CONSECUTIVE_WORK_VIOLATION'
    });
  }

  return Result.success(undefined);
}

/**
 * コンプライアンススコア計算
 */
export function calculateComplianceScore(
  violations: ReadonlyArray<ComplianceViolation>,
  employeeCount: number
): number {
  if (employeeCount === 0) return 100;

  const severityWeights: Record<ViolationSeverity, number> = {
    info: 0.25,
    warning: 0.5,
    critical: 1,
    emergency: 2
  };

  const totalPenalty = violations.reduce(
    (sum, violation) => sum + severityWeights[violation.severity],
    0
  );

  const score = Math.max(0, 100 - (totalPenalty / employeeCount) * 10);
  return Math.round(score * 100) / 100;
}