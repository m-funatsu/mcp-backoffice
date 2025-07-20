import type { TimeRecord, WorkingHours, PayrollRules } from './types.js';
import { JAPANESE_LABOR_RULES } from './payroll-engine.js';

/**
 * 労働時間計算エンジン
 * Working Hours Calculator with Japanese Labor Standards Act Compliance
 * 
 * Features:
 * - Complex overtime calculations (月60時間超=1.50倍)
 * - Late night work detection (22:00-05:00)
 * - Holiday work identification
 * - Break time compliance checking
 * - Consecutive work day monitoring
 */

export interface WorkingHoursBreakdown {
  date: Date;
  clockIn: Date;
  clockOut: Date;
  totalMinutes: number;
  breakMinutes: number;
  workingMinutes: number;
  regularHours: number;
  overtimeHours: number;
  lateNightHours: number;
  holidayHours: number;
  isHoliday: boolean;
  isWeekend: boolean;
  violations: TimeViolation[];
}

export interface TimeViolation {
  type: 'insufficient_break' | 'excessive_hours' | 'late_night_violation' | 'consecutive_work';
  severity: 'warning' | 'violation' | 'critical';
  description: string;
  value?: number;
  requirement?: number;
}

export interface MonthlyHoursSummary {
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalLateNightHours: number;
  totalHolidayHours: number;
  workingDays: number;
  violations: TimeViolation[];
  compliance: {
    monthlyOvertimeCompliant: boolean;
    breakTimeCompliant: boolean;
    consecutiveWorkCompliant: boolean;
  };
}

/**
 * 日本の祝日定義
 * Japanese National Holidays
 */
const JAPANESE_HOLIDAYS_2024: Date[] = [
  new Date('2024-01-01'), // 元日
  new Date('2024-01-08'), // 成人の日
  new Date('2024-02-11'), // 建国記念の日
  new Date('2024-02-12'), // 建国記念の日 振替休日
  new Date('2024-02-23'), // 天皇誕生日
  new Date('2024-03-20'), // 春分の日
  new Date('2024-04-29'), // 昭和の日
  new Date('2024-05-03'), // 憲法記念日
  new Date('2024-05-04'), // みどりの日
  new Date('2024-05-05'), // こどもの日
  new Date('2024-05-06'), // 振替休日
  new Date('2024-07-15'), // 海の日（2024年は7月15日）
  new Date('2024-08-11'), // 山の日
  new Date('2024-08-12'), // 振替休日
  new Date('2024-09-16'), // 敬老の日
  new Date('2024-09-22'), // 秋分の日
  new Date('2024-09-23'), // 振替休日
  new Date('2024-10-14'), // スポーツの日
  new Date('2024-11-03'), // 文化の日
  new Date('2024-11-04'), // 振替休日
  new Date('2024-11-23'), // 勤労感謝の日
  new Date('2024-12-29'), // 年末休暇
  new Date('2024-12-30'), // 年末休暇
  new Date('2024-12-31'), // 年末休暇
];

export class WorkingHoursCalculator {
  private rules: PayrollRules;
  private holidays: Date[];

  constructor(customRules?: Partial<PayrollRules>, customHolidays?: Date[]) {
    this.rules = { ...JAPANESE_LABOR_RULES, ...customRules };
    this.holidays = customHolidays || JAPANESE_HOLIDAYS_2024;
  }

  /**
   * 月次労働時間計算
   * Calculate monthly working hours with detailed breakdown
   */
  calculateMonthlyHours(timeRecords: TimeRecord[]): MonthlyHoursSummary {
    const dailyBreakdowns: WorkingHoursBreakdown[] = [];
    const violations: TimeViolation[] = [];

    // Process each day
    for (const record of timeRecords) {
      const breakdown = this.calculateDailyHours(record);
      dailyBreakdowns.push(breakdown);
      violations.push(...breakdown.violations);
    }

    // Calculate totals
    const totalRegularHours = dailyBreakdowns.reduce((sum, day) => sum + day.regularHours, 0);
    const totalOvertimeHours = dailyBreakdowns.reduce((sum, day) => sum + day.overtimeHours, 0);
    const totalLateNightHours = dailyBreakdowns.reduce((sum, day) => sum + day.lateNightHours, 0);
    const totalHolidayHours = dailyBreakdowns.reduce((sum, day) => sum + day.holidayHours, 0);
    const workingDays = dailyBreakdowns.length;

    // Check monthly compliance
    const monthlyOvertimeCompliant = totalOvertimeHours <= this.rules.monthlyOvertimeLimit;
    const breakTimeCompliant = !violations.some(v => v.type === 'insufficient_break');
    const consecutiveWorkCompliant = this.checkConsecutiveWorkCompliance(dailyBreakdowns);

    // Add monthly violations
    if (!monthlyOvertimeCompliant) {
      violations.push({
        type: 'excessive_hours',
        severity: totalOvertimeHours > 60 ? 'critical' : 'violation',
        description: `月間残業時間上限超過: ${totalOvertimeHours}時間 (上限: ${this.rules.monthlyOvertimeLimit}時間)`,
        value: totalOvertimeHours,
        requirement: this.rules.monthlyOvertimeLimit
      });
    }

    return {
      totalRegularHours,
      totalOvertimeHours,
      totalLateNightHours,
      totalHolidayHours,
      workingDays,
      violations,
      compliance: {
        monthlyOvertimeCompliant,
        breakTimeCompliant,
        consecutiveWorkCompliant
      }
    };
  }

  /**
   * 日次労働時間計算
   * Calculate daily working hours with compliance checking
   */
  calculateDailyHours(timeRecord: TimeRecord): WorkingHoursBreakdown {
    const violations: TimeViolation[] = [];
    
    if (!timeRecord.clockOut) {
      return {
        date: timeRecord.date,
        clockIn: timeRecord.clockIn,
        clockOut: timeRecord.clockIn, // fallback
        totalMinutes: 0,
        breakMinutes: timeRecord.breakMinutes || timeRecord.breakDuration || 0,
        workingMinutes: 0,
        regularHours: 0,
        overtimeHours: 0,
        lateNightHours: 0,
        holidayHours: 0,
        isHoliday: timeRecord.isHoliday || this.isHoliday(timeRecord.date),
        isWeekend: this.isWeekend(timeRecord.date),
        violations: [{
          type: 'excessive_hours',
          severity: 'critical',
          description: '退勤打刻なし - 労働時間計算不可'
        }]
      };
    }

    const clockIn = timeRecord.clockIn;
    const clockOut = timeRecord.clockOut;
    const totalMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / (1000 * 60));
    const breakMinutes = timeRecord.breakMinutes || timeRecord.breakDuration || 0;
    const workingMinutes = totalMinutes - breakMinutes;
    const workingHours = workingMinutes / 60;

    const isHoliday = timeRecord.isHoliday || this.isHoliday(timeRecord.date);
    const isWeekend = this.isWeekend(timeRecord.date);

    // Calculate regular vs overtime hours
    let regularHours: number;
    let overtimeHours: number;

    if (isHoliday || isWeekend) {
      // For holidays and weekends, all hours are considered overtime/premium
      regularHours = 0;
      overtimeHours = workingHours;
    } else {
      // Check if this is primarily a night shift (starts after 21:00 or ends before 6:00)
      // But exclude normal day shifts that end late (e.g., 9:00-20:00)
      const isNightShift = (clockIn.getHours() >= 22 || clockOut.getHours() <= 6) && 
                           !(clockIn.getHours() >= 6 && clockIn.getHours() <= 12 && clockOut.getHours() >= 18 && clockOut.getHours() <= 23);
      
      if (isNightShift) {
        // For night shifts, all hours are considered overtime
        regularHours = 0;
        overtimeHours = workingHours;
      } else {
        // Normal working day
        regularHours = Math.min(workingHours, this.rules.regularHoursPerDay);
        overtimeHours = Math.max(0, workingHours - this.rules.regularHoursPerDay);
      }
    }

    // Calculate late night hours
    const lateNightHours = this.calculateLateNightHours(clockIn, clockOut, breakMinutes);

    // Holiday hours (if working on holiday)
    const holidayHours = (isHoliday || isWeekend) ? workingHours : 0;

    // Check break time compliance
    const requiredBreakMinutes = this.getRequiredBreakMinutes(workingHours);
    if (breakMinutes < requiredBreakMinutes) {
      violations.push({
        type: 'insufficient_break',
        severity: 'violation',
        description: `休憩時間不足: ${breakMinutes}分 (必要: ${requiredBreakMinutes}分)`,
        value: breakMinutes,
        requirement: requiredBreakMinutes
      });
    }

    // Check excessive daily hours
    if (workingHours > 12) {
      violations.push({
        type: 'excessive_hours',
        severity: 'critical',
        description: `1日の労働時間が過度: ${workingHours.toFixed(1)}時間`,
        value: workingHours
      });
    } else if (workingHours > 10) {
      violations.push({
        type: 'excessive_hours',
        severity: 'warning',
        description: `1日の労働時間が長時間: ${workingHours.toFixed(1)}時間`,
        value: workingHours
      });
    }

    return {
      date: timeRecord.date,
      clockIn,
      clockOut,
      totalMinutes,
      breakMinutes,
      workingMinutes,
      regularHours,
      overtimeHours,
      lateNightHours,
      holidayHours,
      isHoliday,
      isWeekend,
      violations
    };
  }

  /**
   * 深夜労働時間計算 (22:00-05:00)
   * Calculate late night working hours
   */
  private calculateLateNightHours(clockIn: Date, clockOut: Date, breakMinutes: number): number {
    const lateNightStart = this.rules.lateNightStart; // 22 (10 PM)
    const lateNightEnd = this.rules.lateNightEnd; // 5 (5 AM)
    
    let lateNightMinutes = 0;
    
    // Create date boundaries for calculations
    const workStart = clockIn.getTime();
    const workEnd = clockOut.getTime();
    
    // Handle work that might span multiple days
    const currentDate = new Date(clockIn);
    const nextDate = new Date(clockIn);
    nextDate.setDate(nextDate.getDate() + 1);
    
    // Calculate late night periods that could overlap with work
    const periods = [
      {
        // Late night period from current day 22:00 to next day 05:00
        start: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), lateNightStart, 0, 0),
        end: new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate(), lateNightEnd, 0, 0)
      }
    ];
    
    // If work starts before 05:00, also check previous day's late night period
    if (clockIn.getHours() < lateNightEnd) {
      const prevDate = new Date(clockIn);
      prevDate.setDate(prevDate.getDate() - 1);
      periods.unshift({
        start: new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate(), lateNightStart, 0, 0),
        end: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), lateNightEnd, 0, 0)
      });
    }
    
    // Calculate overlap with each late night period
    for (const period of periods) {
      const periodStart = period.start.getTime();
      const periodEnd = period.end.getTime();
      
      const overlapStart = Math.max(workStart, periodStart);
      const overlapEnd = Math.min(workEnd, periodEnd);
      
      if (overlapStart < overlapEnd) {
        lateNightMinutes += (overlapEnd - overlapStart) / (1000 * 60);
      }
    }
    
    // Subtract proportional break time
    const totalWorkMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / (1000 * 60));
    const lateNightBreakMinutes = totalWorkMinutes > 0 ? 
      Math.floor((lateNightMinutes / totalWorkMinutes) * breakMinutes) : 0;
    
    return Math.max(0, (lateNightMinutes - lateNightBreakMinutes)) / 60;
  }

  /**
   * 必要休憩時間計算
   * Calculate required break time based on working hours
   */
  private getRequiredBreakMinutes(workingHours: number): number {
    if (workingHours > 8) {
      return this.rules.breakMinutesFor8Hours; // 60分
    } else if (workingHours > 6) {
      return this.rules.breakMinutesFor6Hours; // 45分
    }
    return 0;
  }

  /**
   * 祝日判定
   * Check if date is a Japanese national holiday
   */
  private isHoliday(date: Date): boolean {
    return this.holidays.some(holiday => 
      holiday.getFullYear() === date.getFullYear() &&
      holiday.getMonth() === date.getMonth() &&
      holiday.getDate() === date.getDate()
    );
  }

  /**
   * 週末判定
   * Check if date is weekend (Saturday or Sunday)
   */
  private isWeekend(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  }

  /**
   * 連続勤務コンプライアンスチェック
   * Check consecutive working days compliance
   */
  private checkConsecutiveWorkCompliance(dailyBreakdowns: WorkingHoursBreakdown[]): boolean {
    let consecutiveDays = 0;
    let maxConsecutiveDays = 0;
    
    // Sort by date
    const sortedDays = [...dailyBreakdowns].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    for (let i = 0; i < sortedDays.length; i++) {
      const currentDay = sortedDays[i];
      
      if (currentDay.workingMinutes > 0) {
        consecutiveDays++;
        maxConsecutiveDays = Math.max(maxConsecutiveDays, consecutiveDays);
      } else {
        consecutiveDays = 0;
      }
      
      // Check if next day exists and is consecutive
      if (i < sortedDays.length - 1) {
        const nextDay = sortedDays[i + 1];
        const dayDiff = Math.floor((nextDay.date.getTime() - currentDay.date.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDiff > 1) {
          consecutiveDays = 0;
        }
      }
    }
    
    // Japanese Labor Standards Act: Maximum 6 consecutive working days
    return maxConsecutiveDays <= 6;
  }

  /**
   * Convert working hours breakdown to WorkingHours array
   */
  convertToWorkingHours(breakdowns: WorkingHoursBreakdown[]): WorkingHours[] {
    return breakdowns.map(breakdown => ({
      date: breakdown.date,
      regularHours: breakdown.regularHours,
      overtimeHours: breakdown.overtimeHours,
      lateNightHours: breakdown.lateNightHours,
      holidayHours: breakdown.holidayHours,
      breakMinutes: breakdown.breakMinutes
    }));
  }
}