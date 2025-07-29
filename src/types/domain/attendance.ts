/**
 * 勤怠管理ドメイン型定義
 * AI-OS v3.0
 */

import { Result } from '../core/result';
import { ValidationError } from '../core/validation';
import { DateTime } from '../core/date-time';

/**
 * 勤怠記録種別
 */
export type AttendanceType = 
  | 'clock_in'      // 出勤
  | 'clock_out'     // 退勤
  | 'break_start'   // 休憩開始
  | 'break_end'     // 休憩終了
  | 'overtime_start' // 残業開始
  | 'overtime_end';  // 残業終了

/**
 * 勤怠記録ソース
 */
export type AttendanceSource = 
  | 'ic_card'       // ICカード
  | 'pc_log'        // PCログ
  | 'mobile_app'    // モバイルアプリ
  | 'web'           // Web
  | 'manual'        // 手動入力
  | 'import';       // インポート

/**
 * 勤怠ステータス
 */
export type AttendanceStatus = 
  | 'normal'        // 通常
  | 'late'          // 遅刻
  | 'early_leave'   // 早退
  | 'absent'        // 欠勤
  | 'holiday'       // 休日
  | 'paid_leave'    // 有給休暇
  | 'sick_leave'    // 病欠
  | 'special_leave'; // 特別休暇

/**
 * 勤怠記録
 */
export interface AttendanceRecord {
  readonly id: string;
  readonly employeeId: string;
  readonly date: DateTime;
  readonly type: AttendanceType;
  readonly timestamp: DateTime;
  readonly source: AttendanceSource;
  readonly location?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracy: number;
  };
  readonly deviceId?: string;
  readonly ipAddress?: string;
  readonly note?: string;
  readonly isVerified: boolean;
  readonly verifiedBy?: string;
  readonly verifiedAt?: DateTime;
}

/**
 * 日次勤怠データ
 */
export interface DailyAttendance {
  readonly id: string;
  readonly employeeId: string;
  readonly date: DateTime;
  readonly status: AttendanceStatus;
  readonly clockIn?: DateTime;
  readonly clockOut?: DateTime;
  readonly breakTime: number; // 分単位
  readonly workTime: number; // 分単位
  readonly overtimeMinutes: number;
  readonly lateMinutes: number;
  readonly earlyLeaveMinutes: number;
  readonly isHoliday: boolean;
  readonly isCompensatoryDay: boolean;
  readonly records: ReadonlyArray<AttendanceRecord>;
  readonly anomalies: ReadonlyArray<AttendanceAnomaly>;
  readonly approvalStatus: ApprovalStatus;
  readonly approvedBy?: string;
  readonly approvedAt?: DateTime;
}

/**
 * 勤怠異常
 */
export interface AttendanceAnomaly {
  readonly type: AnomalyType;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly description: string;
  readonly detectedAt: DateTime;
  readonly resolvedAt?: DateTime;
  readonly resolvedBy?: string;
  readonly resolution?: string;
}

/**
 * 異常種別
 */
export type AnomalyType = 
  | 'missing_clock_in'      // 出勤打刻漏れ
  | 'missing_clock_out'     // 退勤打刻漏れ
  | 'duplicate_record'      // 重複打刻
  | 'time_gap'             // 時間差異
  | 'location_mismatch'    // 位置情報不一致
  | 'unusual_pattern'      // 異常パターン
  | 'device_mismatch'      // デバイス不一致
  | 'overtime_violation';  // 残業違反

/**
 * 承認ステータス
 */
export type ApprovalStatus = 
  | 'pending'    // 承認待ち
  | 'approved'   // 承認済み
  | 'rejected'   // 却下
  | 'cancelled'; // キャンセル

/**
 * 月次勤怠サマリー
 */
export interface MonthlyAttendanceSummary {
  readonly employeeId: string;
  readonly year: number;
  readonly month: number;
  readonly workDays: number;
  readonly actualWorkDays: number;
  readonly totalWorkMinutes: number;
  readonly totalOvertimeMinutes: number;
  readonly totalLateMinutes: number;
  readonly totalEarlyLeaveMinutes: number;
  readonly absenceDays: number;
  readonly paidLeaveDays: number;
  readonly sickLeaveDays: number;
  readonly specialLeaveDays: number;
  readonly holidayWorkDays: number;
  readonly compensatoryDays: number;
}

/**
 * 勤怠設定
 */
export interface AttendanceSettings {
  readonly companyId: string;
  readonly standardWorkHours: {
    readonly start: string; // HH:mm
    readonly end: string;   // HH:mm
  };
  readonly breakTime: {
    readonly duration: number; // 分
    readonly isFlexible: boolean;
  };
  readonly flexTime?: {
    readonly coreStart: string; // HH:mm
    readonly coreEnd: string;   // HH:mm
    readonly monthlyLimit: number; // 時間
  };
  readonly roundingRules: {
    readonly unit: 1 | 5 | 10 | 15 | 30; // 分
    readonly clockIn: 'up' | 'down' | 'nearest';
    readonly clockOut: 'up' | 'down' | 'nearest';
  };
  readonly overtimeSettings: {
    readonly requiresApproval: boolean;
    readonly monthlyLimit: number; // 時間
    readonly minUnit: 15 | 30 | 60; // 分
  };
  readonly locationSettings?: {
    readonly required: boolean;
    readonly offices: ReadonlyArray<{
      readonly name: string;
      readonly latitude: number;
      readonly longitude: number;
      readonly radius: number; // メートル
    }>;
  };
}

/**
 * 勤怠記録作成パラメータ
 */
export interface CreateAttendanceRecordParams {
  readonly employeeId: string;
  readonly type: AttendanceType;
  readonly timestamp: DateTime;
  readonly source: AttendanceSource;
  readonly location?: {
    readonly latitude: number;
    readonly longitude: number;
    readonly accuracy: number;
  };
  readonly deviceId?: string;
  readonly ipAddress?: string;
  readonly note?: string;
}

/**
 * 勤怠記録検証
 */
export function validateAttendanceRecord(
  params: CreateAttendanceRecordParams
): Result<CreateAttendanceRecordParams, ValidationError> {
  const errors: ValidationError[] = [];

  if (!params.employeeId) {
    errors.push({
      field: 'employeeId',
      message: '従業員IDは必須です',
      code: 'REQUIRED_FIELD'
    });
  }

  if (!params.timestamp || !DateTime.isValid(params.timestamp)) {
    errors.push({
      field: 'timestamp',
      message: '有効な日時を指定してください',
      code: 'INVALID_DATETIME'
    });
  }

  if (params.location) {
    const { latitude, longitude, accuracy } = params.location;
    if (latitude < -90 || latitude > 90) {
      errors.push({
        field: 'location.latitude',
        message: '緯度は-90から90の範囲で指定してください',
        code: 'INVALID_RANGE'
      });
    }
    if (longitude < -180 || longitude > 180) {
      errors.push({
        field: 'location.longitude',
        message: '経度は-180から180の範囲で指定してください',
        code: 'INVALID_RANGE'
      });
    }
    if (accuracy < 0) {
      errors.push({
        field: 'location.accuracy',
        message: '精度は0以上の値を指定してください',
        code: 'INVALID_VALUE'
      });
    }
  }

  return errors.length > 0 
    ? Result.failure(errors[0])
    : Result.success(params);
}

/**
 * 勤怠時間計算
 */
export function calculateWorkTime(
  clockIn: DateTime,
  clockOut: DateTime,
  breakMinutes: number = 0
): number {
  const totalMinutes = DateTime.diffInMinutes(clockOut, clockIn);
  return Math.max(0, totalMinutes - breakMinutes);
}

/**
 * 残業時間計算
 */
export function calculateOvertime(
  workMinutes: number,
  standardWorkMinutes: number = 480 // 8時間
): number {
  return Math.max(0, workMinutes - standardWorkMinutes);
}

/**
 * 深夜勤務時間計算（22:00-5:00）
 */
export function calculateNightShift(
  clockIn: DateTime,
  clockOut: DateTime
): number {
  // 実装は省略（詳細なロジックは別途実装）
  return 0;
}

/**
 * 休日勤務判定
 */
export function isHolidayWork(
  date: DateTime,
  holidays: ReadonlyArray<DateTime>
): boolean {
  return holidays.some(holiday => DateTime.isSameDay(date, holiday));
}