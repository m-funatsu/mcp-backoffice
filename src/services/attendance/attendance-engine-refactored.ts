/**
 * リファクタリング済み勤怠管理エンジン
 * AI-OS v3.0 - 型安全性強化版
 */

import type { Result } from '@core/result';
import type { DateTime } from '@core/date-time';
import type { ValidationError } from '@core/validation';
import type {
  Employee,
  AttendanceRecord,
  AttendanceType,
  AttendanceSource,
  AttendanceStatus,
  DailyAttendance,
  AttendanceAnomaly,
  AnomalyType,
  ApprovalStatus,
  MonthlyAttendanceSummary,
  AttendanceSettings,
  CreateAttendanceRecordParams,
  validateAttendanceRecord,
  calculateWorkTime,
  calculateOvertime,
  calculateNightShift,
  isHolidayWork,
} from '@domain/attendance';
import type {
  ComplianceViolation,
  ViolationType,
  ViolationSeverity,
  Agreement36,
  WorkTimeMonitoringConfig,
  AlertConfig,
  check36AgreementViolation,
  checkBreakTimeViolation,
  checkConsecutiveWorkDays,
} from '@domain/compliance';

/**
 * 勤怠異常検知設定
 */
const ANOMALY_DETECTION_CONFIG = {
  timeGap: {
    threshold: 30, // 30分以上の差異で異常
  },
  location: {
    officeRadius: 500, // オフィスから500m以内
  },
  pattern: {
    unusualEarlyThreshold: 6, // 朝6時前の出勤
    unusualLateThreshold: 23, // 夜11時以降の退勤
  },
} as const;

/**
 * リファクタリング済み勤怠管理エンジン
 */
export class RefactoredAttendanceEngine {
  constructor(
    private readonly employeeRepository: EmployeeRepository,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly complianceRepository: ComplianceRepository,
    private readonly settingsRepository: SettingsRepository,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * 勤怠記録登録
   */
  async recordAttendance(
    params: CreateAttendanceRecordParams
  ): Promise<Result<AttendanceRecord, ValidationError>> {
    // 1. パラメータ検証
    const validationResult = validateAttendanceRecord(params);
    if (validationResult.isFailure) {
      return validationResult;
    }

    // 2. 従業員存在確認
    const employeeResult = await this.employeeRepository.findById(params.employeeId);
    if (employeeResult.isFailure) {
      return Result.failure({
        field: 'employeeId',
        message: '従業員が見つかりません',
        code: 'EMPLOYEE_NOT_FOUND',
      });
    }

    // 3. 重複チェック
    const duplicateCheck = await this.checkDuplicateRecord(params);
    if (duplicateCheck.isFailure) {
      return duplicateCheck;
    }

    // 4. 勤怠記録作成
    const record: AttendanceRecord = {
      id: this.generateRecordId(),
      employeeId: params.employeeId,
      date: DateTime.startOfDay(params.timestamp),
      type: params.type,
      timestamp: params.timestamp,
      source: params.source,
      location: params.location,
      deviceId: params.deviceId,
      ipAddress: params.ipAddress,
      note: params.note,
      isVerified: params.source === 'ic_card' || params.source === 'pc_log',
      verifiedBy: undefined,
      verifiedAt: undefined,
    };

    // 5. 異常検知
    const anomalies = await this.detectAnomalies(record, employeeResult.value);

    // 6. 保存
    await this.attendanceRepository.saveRecord(record);

    // 7. 日次勤怠更新
    await this.updateDailyAttendance(params.employeeId, DateTime.startOfDay(params.timestamp));

    // 8. 異常があれば通知
    if (anomalies.length > 0) {
      await this.notifyAnomalies(record, anomalies);
    }

    return Result.success(record);
  }

  /**
   * 日次勤怠計算
   */
  async calculateDailyAttendance(
    employeeId: string,
    date: DateTime
  ): Promise<Result<DailyAttendance, ValidationError>> {
    // 1. 当日の勤怠記録取得
    const records = await this.attendanceRepository.findByEmployeeAndDate(
      employeeId,
      date
    );

    if (records.length === 0) {
      return Result.failure({
        field: 'records',
        message: '勤怠記録が見つかりません',
        code: 'NO_RECORDS',
      });
    }

    // 2. 出勤・退勤時刻特定
    const clockIn = this.findClockIn(records);
    const clockOut = this.findClockOut(records);

    // 3. 休憩時間計算
    const breakMinutes = this.calculateBreakTime(records);

    // 4. 勤務時間計算
    const workMinutes = clockIn && clockOut
      ? calculateWorkTime(clockIn.timestamp, clockOut.timestamp, breakMinutes)
      : 0;

    // 5. 勤怠設定取得
    const settings = await this.settingsRepository.getAttendanceSettings(employeeId);

    // 6. 残業時間計算
    const standardWorkMinutes = this.getStandardWorkMinutes(settings);
    const overtimeMinutes = calculateOvertime(workMinutes, standardWorkMinutes);

    // 7. 深夜勤務時間計算
    const lateNightMinutes = clockIn && clockOut
      ? calculateNightShift(clockIn.timestamp, clockOut.timestamp)
      : 0;

    // 8. ステータス判定
    const status = this.determineAttendanceStatus(
      clockIn,
      clockOut,
      settings,
      date
    );

    // 9. 異常検知
    const anomalies = await this.detectDailyAnomalies(
      records,
      workMinutes,
      breakMinutes
    );

    // 10. コンプライアンスチェック
    const complianceResult = await this.checkDailyCompliance(
      employeeId,
      workMinutes,
      overtimeMinutes,
      breakMinutes
    );

    // 11. 日次勤怠データ作成
    const dailyAttendance: DailyAttendance = {
      id: this.generateDailyId(),
      employeeId,
      date,
      status,
      clockIn: clockIn?.timestamp,
      clockOut: clockOut?.timestamp,
      breakTime: breakMinutes,
      workTime: workMinutes,
      overtimeMinutes,
      lateMinutes: this.calculateLateMinutes(clockIn, settings),
      earlyLeaveMinutes: this.calculateEarlyLeaveMinutes(clockOut, settings),
      isHoliday: await this.isHoliday(date),
      isCompensatoryDay: false, // TODO: 代休判定
      records,
      anomalies,
      approvalStatus: anomalies.length > 0 ? 'pending' : 'approved',
      approvedBy: undefined,
      approvedAt: undefined,
    };

    // 12. 保存
    await this.attendanceRepository.saveDailyAttendance(dailyAttendance);

    // 13. コンプライアンス違反があれば通知
    if (complianceResult.violations.length > 0) {
      await this.notifyComplianceViolations(complianceResult.violations);
    }

    return Result.success(dailyAttendance);
  }

  /**
   * 月次勤怠サマリー生成
   */
  async generateMonthlyS ummary(
    employeeId: string,
    year: number,
    month: number
  ): Promise<Result<MonthlyAttendanceSummary, ValidationError>> {
    // 1. 月の日次勤怠データ取得
    const dailyAttendances = await this.attendanceRepository.findMonthlyAttendances(
      employeeId,
      year,
      month
    );

    // 2. 集計
    const summary = dailyAttendances.reduce(
      (acc, daily) => ({
        workDays: acc.workDays + (daily.status === 'normal' ? 1 : 0),
        actualWorkDays: acc.actualWorkDays + (daily.workTime > 0 ? 1 : 0),
        totalWorkMinutes: acc.totalWorkMinutes + daily.workTime,
        totalOvertimeMinutes: acc.totalOvertimeMinutes + daily.overtimeMinutes,
        totalLateMinutes: acc.totalLateMinutes + daily.lateMinutes,
        totalEarlyLeaveMinutes: acc.totalEarlyLeaveMinutes + daily.earlyLeaveMinutes,
        absenceDays: acc.absenceDays + (daily.status === 'absent' ? 1 : 0),
        paidLeaveDays: acc.paidLeaveDays + (daily.status === 'paid_leave' ? 1 : 0),
        sickLeaveDays: acc.sickLeaveDays + (daily.status === 'sick_leave' ? 1 : 0),
        specialLeaveDays: acc.specialLeaveDays + (daily.status === 'special_leave' ? 1 : 0),
        holidayWorkDays: acc.holidayWorkDays + (daily.isHoliday && daily.workTime > 0 ? 1 : 0),
        compensatoryDays: acc.compensatoryDays + (daily.isCompensatoryDay ? 1 : 0),
      }),
      {
        workDays: 0,
        actualWorkDays: 0,
        totalWorkMinutes: 0,
        totalOvertimeMinutes: 0,
        totalLateMinutes: 0,
        totalEarlyLeaveMinutes: 0,
        absenceDays: 0,
        paidLeaveDays: 0,
        sickLeaveDays: 0,
        specialLeaveDays: 0,
        holidayWorkDays: 0,
        compensatoryDays: 0,
      }
    );

    const monthlyS ummary: MonthlyAttendanceSummary = {
      employeeId,
      year,
      month,
      ...summary,
    };

    // 3. 保存
    await this.attendanceRepository.saveMonthlyS ummary(monthlyS ummary);

    return Result.success(monthlyS ummary);
  }

  /**
   * 重複記録チェック
   */
  private async checkDuplicateRecord(
    params: CreateAttendanceRecordParams
  ): Promise<Result<void, ValidationError>> {
    const existingRecords = await this.attendanceRepository.findByEmployeeAndDate(
      params.employeeId,
      DateTime.startOfDay(params.timestamp)
    );

    const duplicate = existingRecords.find(
      (record) =>
        record.type === params.type &&
        Math.abs(DateTime.diffInMinutes(record.timestamp, params.timestamp)) < 5
    );

    if (duplicate) {
      return Result.failure({
        field: 'timestamp',
        message: '同じ種類の勤怠記録が既に存在します',
        code: 'DUPLICATE_RECORD',
      });
    }

    return Result.success(undefined);
  }

  /**
   * 異常検知
   */
  private async detectAnomalies(
    record: AttendanceRecord,
    employee: Employee
  ): Promise<AttendanceAnomaly[]> {
    const anomalies: AttendanceAnomaly[] = [];

    // 1. 客観的記録との乖離チェック
    if (record.source === 'manual') {
      const objectiveRecords = await this.getObjectiveRecords(
        record.employeeId,
        record.date
      );
      
      const discrepancy = this.checkTimeDiscrepancy(record, objectiveRecords);
      if (discrepancy) {
        anomalies.push(discrepancy);
      }
    }

    // 2. 位置情報チェック
    if (record.location) {
      const locationAnomaly = await this.checkLocationAnomaly(record, employee);
      if (locationAnomaly) {
        anomalies.push(locationAnomaly);
      }
    }

    // 3. 異常パターンチェック
    const patternAnomaly = this.checkUnusualPattern(record);
    if (patternAnomaly) {
      anomalies.push(patternAnomaly);
    }

    return anomalies;
  }

  /**
   * 日次異常検知
   */
  private async detectDailyAnomalies(
    records: AttendanceRecord[],
    workMinutes: number,
    breakMinutes: number
  ): Promise<AttendanceAnomaly[]> {
    const anomalies: AttendanceAnomaly[] = [];

    // 1. 出勤打刻漏れチェック
    const hasClockIn = records.some((r) => r.type === 'clock_in');
    if (!hasClockIn && workMinutes > 0) {
      anomalies.push({
        type: 'missing_clock_in',
        severity: 'high',
        description: '出勤打刻がありません',
        detectedAt: DateTime.now(),
      });
    }

    // 2. 退勤打刻漏れチェック
    const hasClockOut = records.some((r) => r.type === 'clock_out');
    if (hasClockIn && !hasClockOut) {
      anomalies.push({
        type: 'missing_clock_out',
        severity: 'high',
        description: '退勤打刻がありません',
        detectedAt: DateTime.now(),
      });
    }

    // 3. 重複打刻チェック
    const duplicates = this.findDuplicateRecords(records);
    if (duplicates.length > 0) {
      anomalies.push({
        type: 'duplicate_record',
        severity: 'medium',
        description: `重複した打刻が${duplicates.length}件あります`,
        detectedAt: DateTime.now(),
      });
    }

    return anomalies;
  }

  /**
   * コンプライアンスチェック
   */
  private async checkDailyCompliance(
    employeeId: string,
    workMinutes: number,
    overtimeMinutes: number,
    breakMinutes: number
  ): Promise<{ violations: ComplianceViolation[] }> {
    const violations: ComplianceViolation[] = [];

    // 1. 休憩時間違反チェック
    const breakResult = checkBreakTimeViolation(workMinutes, breakMinutes);
    if (breakResult.isFailure) {
      violations.push({
        id: this.generateViolationId(),
        type: 'break_time',
        severity: 'warning',
        employeeId,
        detectedAt: DateTime.now(),
        period: {
          start: DateTime.now(),
          end: DateTime.now(),
        },
        details: {
          actual: breakMinutes,
          limit: workMinutes > 480 ? 60 : workMinutes > 360 ? 45 : 0,
          excess: 0,
          percentage: 0,
          description: breakResult.error.message,
        },
        status: 'detected',
        actions: [],
      });
    }

    // 2. 日次残業時間チェック
    const employee = await this.employeeRepository.findById(employeeId);
    if (employee.isSuccess) {
      const agreement = await this.complianceRepository.getAgreement36(
        employee.value.companyId
      );
      if (agreement) {
        const dailyOvertimeResult = check36AgreementViolation(
          overtimeMinutes / 60,
          agreement,
          'daily'
        );
        if (dailyOvertimeResult.isFailure) {
          violations.push(dailyOvertimeResult.error);
        }
      }
    }

    return { violations };
  }

  /**
   * 出勤時刻特定
   */
  private findClockIn(records: AttendanceRecord[]): AttendanceRecord | undefined {
    return records
      .filter((r) => r.type === 'clock_in')
      .sort((a, b) => DateTime.compare(a.timestamp, b.timestamp))[0];
  }

  /**
   * 退勤時刻特定
   */
  private findClockOut(records: AttendanceRecord[]): AttendanceRecord | undefined {
    return records
      .filter((r) => r.type === 'clock_out')
      .sort((a, b) => DateTime.compare(b.timestamp, a.timestamp))[0];
  }

  /**
   * 休憩時間計算
   */
  private calculateBreakTime(records: AttendanceRecord[]): number {
    const breakPairs: Array<{ start?: AttendanceRecord; end?: AttendanceRecord }> = [];
    let currentPair: { start?: AttendanceRecord; end?: AttendanceRecord } = {};

    records
      .sort((a, b) => DateTime.compare(a.timestamp, b.timestamp))
      .forEach((record) => {
        if (record.type === 'break_start') {
          currentPair = { start: record };
        } else if (record.type === 'break_end' && currentPair.start) {
          currentPair.end = record;
          breakPairs.push(currentPair);
          currentPair = {};
        }
      });

    return breakPairs.reduce((total, pair) => {
      if (pair.start && pair.end) {
        return total + DateTime.diffInMinutes(pair.end.timestamp, pair.start.timestamp);
      }
      return total;
    }, 0);
  }

  /**
   * ステータス判定
   */
  private determineAttendanceStatus(
    clockIn: AttendanceRecord | undefined,
    clockOut: AttendanceRecord | undefined,
    settings: AttendanceSettings,
    date: DateTime
  ): AttendanceStatus {
    if (!clockIn && !clockOut) {
      return 'absent';
    }

    // TODO: 休暇申請との連携
    // TODO: 遅刻・早退判定

    return 'normal';
  }

  /**
   * 各種ID生成
   */
  private generateRecordId(): string {
    return `AR_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateDailyId(): string {
    return `DA_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateViolationId(): string {
    return `CV_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * その他のヘルパーメソッド
   */
  private async updateDailyAttendance(
    employeeId: string,
    date: DateTime
  ): Promise<void> {
    await this.calculateDailyAttendance(employeeId, date);
  }

  private async notifyAnomalies(
    record: AttendanceRecord,
    anomalies: AttendanceAnomaly[]
  ): Promise<void> {
    // 通知サービスへの連携
    await this.notificationService.notify({
      type: 'attendance_anomaly',
      employeeId: record.employeeId,
      data: { record, anomalies },
    });
  }

  private async notifyComplianceViolations(
    violations: ComplianceViolation[]
  ): Promise<void> {
    // 通知サービスへの連携
    for (const violation of violations) {
      await this.notificationService.notify({
        type: 'compliance_violation',
        employeeId: violation.employeeId,
        data: violation,
      });
    }
  }

  private getStandardWorkMinutes(settings: AttendanceSettings): number {
    const start = this.parseTime(settings.standardWorkHours.start);
    const end = this.parseTime(settings.standardWorkHours.end);
    return (end - start) * 60 - settings.breakTime.duration;
  }

  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours + minutes / 60;
  }

  private calculateLateMinutes(
    clockIn: AttendanceRecord | undefined,
    settings: AttendanceSettings
  ): number {
    if (!clockIn) return 0;
    // TODO: 実装
    return 0;
  }

  private calculateEarlyLeaveMinutes(
    clockOut: AttendanceRecord | undefined,
    settings: AttendanceSettings
  ): number {
    if (!clockOut) return 0;
    // TODO: 実装
    return 0;
  }

  private async isHoliday(date: DateTime): Promise<boolean> {
    // TODO: 祝日マスタとの連携
    return false;
  }

  private async getObjectiveRecords(
    employeeId: string,
    date: DateTime
  ): Promise<AttendanceRecord[]> {
    // TODO: ICカード、PCログなどの客観的記録取得
    return [];
  }

  private checkTimeDiscrepancy(
    record: AttendanceRecord,
    objectiveRecords: AttendanceRecord[]
  ): AttendanceAnomaly | null {
    // TODO: 実装
    return null;
  }

  private async checkLocationAnomaly(
    record: AttendanceRecord,
    employee: Employee
  ): Promise<AttendanceAnomaly | null> {
    // TODO: 実装
    return null;
  }

  private checkUnusualPattern(record: AttendanceRecord): AttendanceAnomaly | null {
    const hour = record.timestamp.getHours();
    
    if (record.type === 'clock_in' && hour < ANOMALY_DETECTION_CONFIG.pattern.unusualEarlyThreshold) {
      return {
        type: 'unusual_pattern',
        severity: 'low',
        description: `異常に早い出勤時刻です（${hour}時台）`,
        detectedAt: DateTime.now(),
      };
    }

    if (record.type === 'clock_out' && hour >= ANOMALY_DETECTION_CONFIG.pattern.unusualLateThreshold) {
      return {
        type: 'unusual_pattern',
        severity: 'medium',
        description: `異常に遅い退勤時刻です（${hour}時台）`,
        detectedAt: DateTime.now(),
      };
    }

    return null;
  }

  private findDuplicateRecords(records: AttendanceRecord[]): AttendanceRecord[] {
    const duplicates: AttendanceRecord[] = [];
    const seen = new Map<string, AttendanceRecord>();

    records.forEach((record) => {
      const key = `${record.type}_${Math.floor(record.timestamp.getTime() / 300000)}`; // 5分単位
      if (seen.has(key)) {
        duplicates.push(record);
      } else {
        seen.set(key, record);
      }
    });

    return duplicates;
  }
}

// リポジトリインターフェース
interface EmployeeRepository {
  findById(id: string): Promise<Result<Employee, ValidationError>>;
}

interface AttendanceRepository {
  saveRecord(record: AttendanceRecord): Promise<void>;
  saveDailyAttendance(daily: DailyAttendance): Promise<void>;
  saveMonthlyS ummary(summary: MonthlyAttendanceSummary): Promise<void>;
  findByEmployeeAndDate(employeeId: string, date: DateTime): Promise<AttendanceRecord[]>;
  findMonthlyAttendances(employeeId: string, year: number, month: number): Promise<DailyAttendance[]>;
}

interface ComplianceRepository {
  getAgreement36(companyId: string): Promise<Agreement36 | null>;
}

interface SettingsRepository {
  getAttendanceSettings(employeeId: string): Promise<AttendanceSettings>;
}

interface NotificationService {
  notify(notification: {
    type: string;
    employeeId: string;
    data: unknown;
  }): Promise<void>;
}