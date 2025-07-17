import { Employee, TimeRecord, PayrollCalculation, LeaveRequest } from './types.js';
import { format, subDays, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { ja } from 'date-fns/locale';

export interface MonitoringDatabase {
  getEmployee(id: string): Promise<Employee | null>;
  getAllEmployees(): Promise<Employee[]>;
  getTimeRecords(employeeId: string, startDate: Date, endDate: Date): Promise<TimeRecord[]>;
  getPayrollCalculation(employeeId: string, month: string): Promise<PayrollCalculation | null>;
  getLeaveRequests(employeeId?: string, status?: string, startDate?: Date, endDate?: Date): Promise<LeaveRequest[]>;
}

export interface Alert {
  id: string;
  type: 'overtime' | 'absence' | 'compliance' | 'trend' | 'leave_compliance';
  severity: 'info' | 'warning' | 'critical';
  employeeId: string;
  employeeName: string;
  department: string;
  title: string;
  description: string;
  recommendation: string;
  detectedAt: Date;
  data: Record<string, any>;
}

export interface TrendAnalysis {
  metric: string;
  period: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  significance: 'low' | 'medium' | 'high';
  recommendation: string;
}

/**
 * Proactive Monitoring System
 * Automatically detects anomalies, compliance issues, and trends
 */
export class ProactiveMonitoringSystem {
  private alerts: Alert[] = [];

  constructor(private db: MonitoringDatabase) {}

  /**
   * Run daily monitoring checks
   */
  async runDailyChecks(): Promise<Alert[]> {
    const newAlerts: Alert[] = [];
    const today = new Date();
    const yesterday = subDays(today, 1);

    try {
      // Check for excessive overtime
      const overtimeAlerts = await this.checkExcessiveOvertime(yesterday);
      newAlerts.push(...overtimeAlerts);

      // Check for missing clock-outs
      const missingClockOutAlerts = await this.checkMissingClockOuts(yesterday);
      newAlerts.push(...missingClockOutAlerts);

      // Check for unusual work patterns
      const patternAlerts = await this.checkUnusualWorkPatterns(yesterday);
      newAlerts.push(...patternAlerts);

      // Check for leave compliance
      const leaveAlerts = await this.checkLeaveCompliance();
      newAlerts.push(...leaveAlerts);

      this.alerts.push(...newAlerts);
      return newAlerts;
    } catch (error) {
      console.error('Error running daily checks:', error);
      return [];
    }
  }

  /**
   * Run weekly trend analysis
   */
  async runWeeklyTrendAnalysis(): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];

    try {
      // Analyze overtime trends by department
      const overtimeTrends = await this.analyzeOvertimeTrends();
      trends.push(...overtimeTrends);

      // Analyze attendance patterns
      const attendanceTrends = await this.analyzeAttendanceTrends();
      trends.push(...attendanceTrends);

      // Analyze leave usage trends
      const leaveTrends = await this.analyzeLeaveUsageTrends();
      trends.push(...leaveTrends);

      return trends;
    } catch (error) {
      console.error('Error running trend analysis:', error);
      return [];
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(severity?: Alert['severity']): Alert[] {
    return this.alerts.filter(alert => 
      !severity || alert.severity === severity
    );
  }

  /**
   * Check for excessive overtime (previous day)
   */
  private async checkExcessiveOvertime(date: Date): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const employees = await this.db.getAllEmployees();

    for (const employee of employees) {
      if (!employee.isActive) continue;

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const records = await this.db.getTimeRecords(employee.id, date, nextDay);
      
      for (const record of records) {
        if (!record.clockOut) continue;

        const breakMinutes = record.breakMinutes || record.breakDuration || 0;
        const workHours = this.calculateWorkHours(record.clockIn, record.clockOut, breakMinutes);
        const overtimeHours = Math.max(0, workHours - 8);

        if (overtimeHours > 6) { // More than 6 hours overtime
          alerts.push({
            id: `overtime_${employee.id}_${format(date, 'yyyy-MM-dd')}`,
            type: 'overtime',
            severity: 'critical',
            employeeId: employee.id,
            employeeName: employee.name,
            department: employee.department,
            title: '過度な時間外労働を検出',
            description: `${format(date, 'yyyy年MM月dd日', { locale: ja })}に${overtimeHours.toFixed(1)}時間の時間外労働が記録されました。`,
            recommendation: '36協定の特別条項確認、産業医面談の検討、業務負荷の見直しが必要です。',
            detectedAt: new Date(),
            data: {
              date: date.toISOString(),
              overtimeHours,
              workHours,
              clockIn: record.clockIn.toISOString(),
              clockOut: record.clockOut.toISOString()
            }
          });
        } else if (overtimeHours > 3) { // More than 3 hours overtime
          alerts.push({
            id: `overtime_${employee.id}_${format(date, 'yyyy-MM-dd')}`,
            type: 'overtime',
            severity: 'warning',
            employeeId: employee.id,
            employeeName: employee.name,
            department: employee.department,
            title: '長時間の時間外労働',
            description: `${format(date, 'yyyy年MM月dd日', { locale: ja })}に${overtimeHours.toFixed(1)}時間の時間外労働が記録されました。`,
            recommendation: '連続的な長時間労働にならないよう注意が必要です。',
            detectedAt: new Date(),
            data: {
              date: date.toISOString(),
              overtimeHours,
              workHours
            }
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Check for missing clock-outs (previous day)
   */
  private async checkMissingClockOuts(date: Date): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const employees = await this.db.getAllEmployees();

    for (const employee of employees) {
      if (!employee.isActive) continue;

      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const records = await this.db.getTimeRecords(employee.id, date, nextDay);
      
      const missingClockOuts = records.filter(record => 
        record.clockIn && !record.clockOut
      );

      if (missingClockOuts.length > 0) {
        alerts.push({
          id: `missing_clockout_${employee.id}_${format(date, 'yyyy-MM-dd')}`,
          type: 'absence',
          severity: 'warning',
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department,
          title: '退勤打刻が未記録',
          description: `${format(date, 'yyyy年MM月dd日', { locale: ja })}の退勤打刻がありません。`,
          recommendation: '従業員に確認し、手動で退勤時刻を修正してください。',
          detectedAt: new Date(),
          data: {
            date: date.toISOString(),
            clockInTime: missingClockOuts[0].clockIn.toISOString(),
            missingRecordsCount: missingClockOuts.length
          }
        });
      }
    }

    return alerts;
  }

  /**
   * Check for unusual work patterns
   */
  private async checkUnusualWorkPatterns(date: Date): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const employees = await this.db.getAllEmployees();

    for (const employee of employees) {
      if (!employee.isActive) continue;

      // Check work pattern for the last 7 days
      const weekStart = subDays(date, 6);
      const records = await this.db.getTimeRecords(employee.id, weekStart, date);

      // Unusual pattern: Working every day including weekends
      const workingDays = records.filter(r => r.clockOut).length;
      if (workingDays === 7) {
        alerts.push({
          id: `continuous_work_${employee.id}_${format(date, 'yyyy-MM-dd')}`,
          type: 'compliance',
          severity: 'warning',
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department,
          title: '連続7日間勤務を検出',
          description: '過去7日間連続で勤務しています。労働基準法上、週1日の休日が必要です。',
          recommendation: '直近で休日を設定し、継続的な働き方を見直してください。',
          detectedAt: new Date(),
          data: {
            continuousWorkDays: workingDays,
            weekStart: weekStart.toISOString(),
            weekEnd: date.toISOString()
          }
        });
      }

      // Check for very early or very late work times
      const earlyStarts = records.filter(r => r.clockIn.getHours() < 6);
      const lateEnds = records.filter(r => r.clockOut && r.clockOut.getHours() > 22);

      if (earlyStarts.length >= 3) {
        alerts.push({
          id: `early_starts_${employee.id}_${format(date, 'yyyy-MM-dd')}`,
          type: 'trend',
          severity: 'info',
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department,
          title: '頻繁な早朝勤務',
          description: '週3回以上、6時前の出勤が記録されています。',
          recommendation: '健康管理の観点から勤務時間の調整を検討してください。',
          detectedAt: new Date(),
          data: {
            earlyStartCount: earlyStarts.length
          }
        });
      }

      if (lateEnds.length >= 3) {
        alerts.push({
          id: `late_ends_${employee.id}_${format(date, 'yyyy-MM-dd')}`,
          type: 'trend',
          severity: 'warning',
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department,
          title: '頻繁な深夜勤務',
          description: '週3回以上、22時以降の勤務が記録されています。',
          recommendation: '深夜労働時間の管理と健康リスクの評価が必要です。',
          detectedAt: new Date(),
          data: {
            lateEndCount: lateEnds.length
          }
        });
      }
    }

    return alerts;
  }

  /**
   * Check for leave compliance issues
   */
  private async checkLeaveCompliance(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const employees = await this.db.getAllEmployees();
    const currentYear = new Date().getFullYear();
    const currentDate = new Date();

    // Only check if we're past June (halfway through the year)
    if (currentDate.getMonth() < 5) {
      return alerts;
    }

    for (const employee of employees) {
      if (!employee.isActive) continue;

      // Check if employee has taken the legally required 5 days of annual leave
      const startOfYear = new Date(currentYear, 0, 1);
      const leaveRequests = await this.db.getLeaveRequests(
        employee.id,
        'approved',
        startOfYear,
        currentDate
      );

      const annualLeaveDaysUsed = leaveRequests
        .filter(req => req.leaveType === 'annual')
        .reduce((total, req) => total + req.daysRequested, 0);

      if (annualLeaveDaysUsed < 5) {
        const severity = currentDate.getMonth() >= 9 ? 'critical' : 'warning'; // Critical if past October
        
        alerts.push({
          id: `leave_compliance_${employee.id}_${currentYear}`,
          type: 'leave_compliance',
          severity,
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department,
          title: '年次有給休暇取得義務未達成',
          description: `${currentYear}年の年次有給休暇取得日数が${annualLeaveDaysUsed}日で、法定最低取得日数5日を下回っています。`,
          recommendation: '労働基準法により年5日の年次有給休暇取得が義務付けられています。早急に取得計画を立ててください。',
          detectedAt: new Date(),
          data: {
            year: currentYear,
            daysUsed: annualLeaveDaysUsed,
            requiredDays: 5,
            remainingDays: 5 - annualLeaveDaysUsed
          }
        });
      }
    }

    return alerts;
  }

  /**
   * Analyze overtime trends by department
   */
  private async analyzeOvertimeTrends(): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    
    // This would implement actual trend analysis
    // For now, returning empty array as placeholder
    
    return trends;
  }

  /**
   * Analyze attendance patterns
   */
  private async analyzeAttendanceTrends(): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    
    // This would implement actual attendance trend analysis
    // For now, returning empty array as placeholder
    
    return trends;
  }

  /**
   * Analyze leave usage trends
   */
  private async analyzeLeaveUsageTrends(): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    
    // This would implement actual leave usage trend analysis
    // For now, returning empty array as placeholder
    
    return trends;
  }

  /**
   * Calculate work hours from clock in/out times
   */
  private calculateWorkHours(clockIn: Date, clockOut: Date, breakMinutes: number): number {
    const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
    return Math.max(0, (totalMinutes - breakMinutes) / 60);
  }

  /**
   * Generate monitoring dashboard data
   */
  async generateDashboardData(): Promise<{
    alerts: {
      critical: number;
      warning: number;
      info: number;
    };
    trends: TrendAnalysis[];
    recentAlerts: Alert[];
    complianceStatus: {
      overtimeCompliance: number;
      leaveCompliance: number;
      overallScore: number;
    };
  }> {
    const alerts = this.getActiveAlerts();
    
    return {
      alerts: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length,
      },
      trends: await this.runWeeklyTrendAnalysis(),
      recentAlerts: alerts.slice(-10), // Last 10 alerts
      complianceStatus: {
        overtimeCompliance: 85, // Placeholder - would calculate actual compliance
        leaveCompliance: 78,    // Placeholder
        overallScore: 82        // Placeholder
      }
    };
  }
}