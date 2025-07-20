/**
 * ComplianceEngine用拡張メソッド
 * テスト実行のための不足メソッドを実装
 */

import { ComplianceEngine, LaborAgreement } from './compliance-engine.js';
import type { ObjectiveTimeRecord, DetailedWorkHours } from './compliance-engine.js';

// ComplianceEngineクラスに不足しているメソッドを追加
declare module './compliance-engine.js' {
  interface ComplianceEngine {
    getMonthlyOvertimeHours(employeeId: string, month: string): Promise<number>;
    getYearlyOvertimeHours(employeeId: string, year: number): Promise<number>;
    getCurrentAgreement(): Promise<LaborAgreement>;
    formatMonth(date: Date): string;
    getObjectiveRecord(employeeId: string, date: Date): Promise<ObjectiveTimeRecord | null>;
    generateComplianceAlerts(status: any, agreement: LaborAgreement, targetDate?: Date): Promise<void>;
    getSpecialLimitUsedCount(employeeId: string, year: number): Promise<number>;
    createAlert(
      employeeId: string,
      alertType: any,
      alertLevel: any,
      targetPeriod: string,
      currentHours: number,
      limitHours: number,
      thresholdPercentage: number
    ): Promise<any>;
    saveAlert(alert: any): Promise<void>;
    calculateRequiredBreak(hours: number): number;
    calculateWeeklyOvertime(employeeId: string, date: Date, actualWorkHours: number): Promise<number>;
    mapObjectiveTimeRecord(row: any): ObjectiveTimeRecord;
    calculateDiscrepancy(record: ObjectiveTimeRecord): any;
  }
}

// 拡張メソッドの実装
// getMonthlyOvertimeHoursメソッドは元のcompliance-engine.tsに実装があるためここでは定義しない

// getYearlyOvertimeHoursメソッドは元のcompliance-engine.tsに実装があるためここでは定義しない

ComplianceEngine.prototype.getCurrentAgreement = async function(): Promise<LaborAgreement> {
  const defaultAgreement: LaborAgreement = {
    id: 'default',
    companyId: 'company001',
    agreementType: '36_standard',
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: new Date('2024-12-31'),
    monthlyOvertimeLimit: 45,
    yearlyOvertimeLimit: 360,
    specialMonthlyLimit: 100,
    specialYearlyLimit: 720,
    special2MonthAvgLimit: 80,
    special6MonthAvgLimit: 80,
    specialMonthlyCountLimit: 6
  };
  
  const sql = `
    SELECT * FROM labor_agreements
    WHERE NOW() BETWEEN effective_from AND effective_to
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  try {
    const result = await this.db.query(sql, []);
    if (!result || !result.rows || result.rows.length === 0) {
      return defaultAgreement;
    }
    const row = result.rows[0];
    return {
      id: row.id,
      companyId: row.company_id,
      agreementType: row.agreement_type,
      effectiveFrom: new Date(row.effective_from),
      effectiveTo: new Date(row.effective_to),
      monthlyOvertimeLimit: row.monthly_overtime_limit || 45,
      yearlyOvertimeLimit: row.yearly_overtime_limit || 360,
      specialMonthlyLimit: row.special_monthly_limit || 100,
      specialYearlyLimit: row.special_yearly_limit || 720,
      special2MonthAvgLimit: row.special_2month_avg_limit || 80,
      special6MonthAvgLimit: row.special_6month_avg_limit || 80,
      specialMonthlyCountLimit: row.special_monthly_count_limit || 6,
      healthMeasures: row.health_measures,
      notificationAuthority: row.notification_authority
    };
  } catch (error) {
    console.error('Error getting current agreement:', error);
    return defaultAgreement;
  }
};

ComplianceEngine.prototype.formatMonth = function(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

ComplianceEngine.prototype.getObjectiveRecord = async function(employeeId: string, date: Date): Promise<ObjectiveTimeRecord | null> {
  if (!date || !date.toISOString) {
    console.error('Invalid date provided to getObjectiveRecord');
    return null;
  }
  
  const sql = `
    SELECT * FROM objective_time_records
    WHERE employee_id = $1 AND record_date = $2
  `;
  
  try {
    const result = await this.db.query(sql, [employeeId, date.toISOString().split('T')[0]]);
    if (!result || !result.rows || result.rows.length === 0) {
      return null;
    }
    const row = result.rows[0];
    return this.mapObjectiveTimeRecord(row);
  } catch (error) {
    console.error('Error getting objective record:', error);
    return null;
  }
};

// generateComplianceAlertsメソッドは元のcompliance-engine.tsに実装があるためここでは定義しない
// ComplianceEngine.prototype.generateComplianceAlerts は削除

ComplianceEngine.prototype.getSpecialLimitUsedCount = async function(employeeId: string, year: number): Promise<number> {
  const sql = `
    SELECT COUNT(DISTINCT TO_CHAR(work_date, 'YYYY-MM')) as used_count
    FROM time_records
    WHERE employee_id = $1
      AND TO_CHAR(work_date, 'YYYY') = $2
      AND overtime_hours > 45.0
  `;
  
  try {
    const result = await this.db.query(sql, [employeeId, year.toString()]);
    if (!result || !result.rows || result.rows.length === 0) {
      return 0;
    }
    let count = parseInt(result.rows[0].used_count || '0', 10);
    
    // 現在月の残業時間も確認
    const currentMonth = this.formatMonth(new Date());
    const monthlyOvertime = await this.getMonthlyOvertimeHours(employeeId, currentMonth);
    if (monthlyOvertime > 45.0) {
      // 現在月が含まれていない場合は追加
      const currentMonthInSql = `
        SELECT 1 FROM time_records 
        WHERE employee_id = $1 
          AND TO_CHAR(work_date, 'YYYY-MM') = $2
          AND overtime_hours > 45.0
        LIMIT 1
      `;
      const checkResult = await this.db.query(currentMonthInSql, [employeeId, currentMonth]);
      if (!checkResult || !checkResult.rows || checkResult.rows.length === 0) {
        count += 1;
      }
    }
    
    return count;
  } catch (error) {
    console.error('Error getting special limit used count:', error);
    return 0;
  }
};

ComplianceEngine.prototype.saveAlert = async function(alert: any): Promise<void> {
  // アラート保存（簡易実装）
  console.log('Alert saved:', alert.id);
};

ComplianceEngine.prototype.calculateRequiredBreak = function(hours: number): number {
  if (hours > 8) {
    return 60;
  } else if (hours > 6) {
    return 45;
  }
  return 0;
};

ComplianceEngine.prototype.calculateWeeklyOvertime = async function(employeeId: string, date: Date, actualWorkHours: number): Promise<number> {
  return Math.max(0, actualWorkHours - 8); // 簡易実装
};

ComplianceEngine.prototype.mapObjectiveTimeRecord = function(row: any): ObjectiveTimeRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    recordDate: new Date(row.record_date),
    icCardIn: row.ic_card_in ? new Date(row.ic_card_in) : undefined,
    icCardOut: row.ic_card_out ? new Date(row.ic_card_out) : undefined,
    icCardDeviceId: row.ic_card_device_id,
    icCardLocation: row.ic_card_location,
    pcLogin: row.pc_login ? new Date(row.pc_login) : undefined,
    pcLogout: row.pc_logout ? new Date(row.pc_logout) : undefined,
    pcDeviceId: row.pc_device_id,
    pcIpAddress: row.pc_ip_address,
    selfReportedIn: row.self_reported_in ? new Date(row.self_reported_in) : undefined,
    selfReportedOut: row.self_reported_out ? new Date(row.self_reported_out) : undefined,
    selfReportReason: row.self_report_reason,
    discrepancyDetected: row.discrepancy_detected || false,
    discrepancyMinutes: row.discrepancy_minutes || 0,
    discrepancyExplanation: row.discrepancy_explanation,
    verifiedIn: row.verified_in ? new Date(row.verified_in) : undefined,
    verifiedOut: row.verified_out ? new Date(row.verified_out) : undefined,
    verifiedBy: row.verified_by,
    verificationMethod: row.verification_method
  };
};

ComplianceEngine.prototype.calculateDiscrepancy = function(record: ObjectiveTimeRecord): any {
  // 乖離計算ロジック（簡易実装）
  const hasDiscrepancy = false;
  const minutes = 0;
  
  return {
    detected: hasDiscrepancy,
    minutes,
    explanation: hasDiscrepancy ? '乖離が検出されました' : null
  };
};