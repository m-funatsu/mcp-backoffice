import { format, startOfMonth, endOfMonth, eachDayOfInterval, getHours, getMinutes, getDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { 
  Employee, 
  TimeRecord, 
  PayrollCalculation, 
  PayrollRules, 
  WorkingHours, 
  AttendanceReport, 
  PayrollSummary 
} from './types.js';
import DatabasePostgreSQL from './database_postgresql.js';

/**
 * Business Process as Code (BPaC) - Japanese Labor Standards Act Compliance
 * 
 * This module implements the payroll calculation rules as defined in the Japanese Labor Standards Act:
 * - Regular working hours: 8 hours/day, 40 hours/week
 * - Break requirements: 45 minutes for 6+ hours, 60 minutes for 8+ hours
 * - Overtime premium: 25% for regular overtime, 50% for >60 hours/month
 * - Late night premium: 25% for work between 22:00-05:00
 * - Holiday premium: 35% for work on legal holidays
 */

export class PayrollCalculator {
  private db: DatabasePostgreSQL;
  private rules: PayrollRules;

  constructor(db: DatabasePostgreSQL, rules: PayrollRules) {
    this.db = db;
    this.rules = rules;
  }

  /**
   * Calculate working hours for a specific day
   */
  private calculateDayWorkingHours(record: TimeRecord, isHoliday: boolean): WorkingHours {
    if (!record.clockOut) {
      return {
        date: record.date,
        regularHours: 0,
        overtimeHours: 0,
        lateNightHours: 0,
        holidayHours: 0,
        breakMinutes: 0
      };
    }

    const clockIn = record.clockIn;
    const clockOut = record.clockOut;
    const breakMinutes = record.breakDuration;
    
    // Total worked time in minutes
    const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60) - breakMinutes;
    const totalHours = totalMinutes / 60;

    // Calculate late night hours (22:00-05:00)
    const lateNightHours = this.calculateLateNightHours(clockIn, clockOut, breakMinutes);

    let regularHours = 0;
    let overtimeHours = 0;
    let holidayHours = 0;

    if (isHoliday) {
      // All hours on holidays are considered holiday hours
      holidayHours = totalHours;
    } else {
      // Regular working day
      if (totalHours <= this.rules.regularHoursPerDay) {
        regularHours = totalHours;
      } else {
        regularHours = this.rules.regularHoursPerDay;
        overtimeHours = totalHours - this.rules.regularHoursPerDay;
      }
    }

    return {
      date: record.date,
      regularHours: Math.max(0, regularHours),
      overtimeHours: Math.max(0, overtimeHours),
      lateNightHours: Math.max(0, lateNightHours),
      holidayHours: Math.max(0, holidayHours),
      breakMinutes: breakMinutes
    };
  }

  /**
   * Calculate late night working hours (22:00-05:00)
   */
  private calculateLateNightHours(clockIn: Date, clockOut: Date, breakMinutes: number): number {
    const lateNightStart = this.rules.lateNightStart; // 22:00
    const lateNightEnd = this.rules.lateNightEnd; // 5:00

    let lateNightMinutes = 0;
    const workStart = clockIn;
    const workEnd = clockOut;

    // Create date objects for late night period
    const workDate = new Date(workStart);
    const lateNightStartTime = new Date(workDate);
    lateNightStartTime.setHours(lateNightStart, 0, 0, 0);

    // Late night end time might be next day
    const lateNightEndTime = new Date(workDate);
    if (lateNightEnd < lateNightStart) {
      lateNightEndTime.setDate(lateNightEndTime.getDate() + 1);
    }
    lateNightEndTime.setHours(lateNightEnd, 0, 0, 0);

    // Check overlap with late night period
    const overlapStart = new Date(Math.max(workStart.getTime(), lateNightStartTime.getTime()));
    const overlapEnd = new Date(Math.min(workEnd.getTime(), lateNightEndTime.getTime()));

    if (overlapStart < overlapEnd) {
      lateNightMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60);
    }

    // Check if work spans midnight (22:00 to 05:00 next day)
    if (workEnd.getDate() > workStart.getDate()) {
      const midnightStart = new Date(workStart);
      midnightStart.setHours(22, 0, 0, 0);
      
      const nextDayEnd = new Date(workEnd);
      nextDayEnd.setHours(5, 0, 0, 0);

      if (workStart <= midnightStart && workEnd >= nextDayEnd) {
        // Work spans entire late night period
        lateNightMinutes = 7 * 60; // 7 hours (22:00-05:00)
      } else {
        // Partial overlap
        if (workStart <= midnightStart) {
          const endOfLateNight = new Date(workStart);
          endOfLateNight.setDate(endOfLateNight.getDate() + 1);
          endOfLateNight.setHours(5, 0, 0, 0);
          
          const effectiveEnd = new Date(Math.min(workEnd.getTime(), endOfLateNight.getTime()));
          lateNightMinutes = (effectiveEnd.getTime() - midnightStart.getTime()) / (1000 * 60);
        }
      }
    }

    // Subtract break time proportionally
    const workTotalMinutes = (workEnd.getTime() - workStart.getTime()) / (1000 * 60);
    const breakDeduction = workTotalMinutes > 0 ? (lateNightMinutes / workTotalMinutes) * breakMinutes : 0;
    
    return Math.max(0, (lateNightMinutes - breakDeduction) / 60);
  }

  /**
   * Validate break time according to Japanese Labor Standards Act
   */
  private validateBreakTime(workingHours: number, breakMinutes: number): string[] {
    const violations: string[] = [];

    if (workingHours > 6 && breakMinutes < this.rules.breakMinutesFor6Hours) {
      violations.push(`労働時間が6時間を超える場合、${this.rules.breakMinutesFor6Hours}分以上の休憩が必要です`);
    }

    if (workingHours > 8 && breakMinutes < this.rules.breakMinutesFor8Hours) {
      violations.push(`労働時間が8時間を超える場合、${this.rules.breakMinutesFor8Hours}分以上の休憩が必要です`);
    }

    return violations;
  }

  /**
   * Calculate monthly payroll for an employee
   */
  async calculateMonthlyPayroll(employeeId: string, month: string): Promise<PayrollCalculation> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }

    // Get month boundaries
    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, monthNum - 1));
    const monthEnd = endOfMonth(new Date(year, monthNum - 1));

    // Get time records for the month
    const timeRecords = await this.db.getTimeRecords(employeeId, monthStart, monthEnd);

    // Calculate daily working hours
    const dailyHours: WorkingHours[] = [];
    let totalRegularHours = 0;
    let totalOvertimeHours = 0;
    let totalLateNightHours = 0;
    let totalHolidayHours = 0;

    for (const record of timeRecords) {
      const isHoliday = await this.db.isHoliday(record.date) || getDay(record.date) === 0; // Sunday
      const dayHours = this.calculateDayWorkingHours(record, isHoliday);
      
      dailyHours.push(dayHours);
      totalRegularHours += dayHours.regularHours;
      totalOvertimeHours += dayHours.overtimeHours;
      totalLateNightHours += dayHours.lateNightHours;
      totalHolidayHours += dayHours.holidayHours;
    }

    // Apply monthly overtime rounding rules (30 minutes rounding)
    totalOvertimeHours = this.roundOvertimeHours(totalOvertimeHours);

    // Calculate pay
    const regularPay = totalRegularHours * employee.hourlyRate;
    const overtimePay = this.calculateOvertimePay(totalOvertimeHours, employee.hourlyRate);
    const lateNightPay = totalLateNightHours * employee.hourlyRate * (this.rules.lateNightRate - 1);
    const holidayPay = totalHolidayHours * employee.hourlyRate * (this.rules.holidayRate - 1);
    
    const totalPay = regularPay + overtimePay + lateNightPay + holidayPay;

    const calculation: PayrollCalculation = {
      id: `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId,
      month,
      regularHours: totalRegularHours,
      overtimeHours: totalOvertimeHours,
      lateNightHours: totalLateNightHours,
      holidayHours: totalHolidayHours,
      regularPay,
      overtimePay,
      lateNightPay,
      holidayPay,
      totalPay,
      calculatedAt: new Date()
    };

    // Save calculation to database
    await this.db.savePayrollCalculation(calculation);

    return calculation;
  }

  /**
   * Round overtime hours according to Japanese Labor Standards Act
   * (30 minutes or less rounded down, more than 30 minutes rounded up)
   */
  private roundOvertimeHours(overtimeHours: number): number {
    const wholeHours = Math.floor(overtimeHours);
    const minutes = (overtimeHours - wholeHours) * 60;
    
    if (minutes <= 30) {
      return wholeHours;
    } else {
      return wholeHours + 1;
    }
  }

  /**
   * Calculate overtime pay with progressive rates
   */
  private calculateOvertimePay(overtimeHours: number, hourlyRate: number): number {
    let overtimePay = 0;

    if (overtimeHours <= this.rules.highOvertimeThreshold) {
      // Regular overtime rate (25%)
      overtimePay = overtimeHours * hourlyRate * this.rules.overtimeRate;
    } else {
      // Split into regular overtime and high overtime
      const regularOvertimeHours = this.rules.highOvertimeThreshold;
      const highOvertimeHours = overtimeHours - this.rules.highOvertimeThreshold;
      
      overtimePay = (regularOvertimeHours * hourlyRate * this.rules.overtimeRate) +
                   (highOvertimeHours * hourlyRate * this.rules.highOvertimeRate);
    }

    return overtimePay;
  }

  /**
   * Generate attendance report for an employee
   */
  async generateAttendanceReport(employeeId: string, month: string): Promise<AttendanceReport> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }

    const calculation = await this.calculateMonthlyPayroll(employeeId, month);
    
    // Get month boundaries
    const [year, monthNum] = month.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, monthNum - 1));
    const monthEnd = endOfMonth(new Date(year, monthNum - 1));

    // Get time records for the month
    const timeRecords = await this.db.getTimeRecords(employeeId, monthStart, monthEnd);
    
    // Check for violations
    const violations: string[] = [];
    
    // Check monthly overtime limit
    if (calculation.overtimeHours > this.rules.monthlyOvertimeLimit) {
      violations.push(`月間時間外労働時間が上限(${this.rules.monthlyOvertimeLimit}時間)を超過: ${calculation.overtimeHours.toFixed(1)}時間`);
    }

    // Check break time violations
    for (const record of timeRecords) {
      if (record.clockOut) {
        const workingHours = (record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60 * 60) - (record.breakDuration / 60);
        const breakViolations = this.validateBreakTime(workingHours, record.breakDuration);
        violations.push(...breakViolations.map(v => `${format(record.date, 'yyyy-MM-dd')}: ${v}`));
      }
    }

    // Count working days
    const workingDays = timeRecords.filter(record => record.clockOut).length;

    // Calculate dates for the month
    const monthDate = new Date(month + '-01');
    const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    return {
      employeeId,
      employeeName: employee.name,
      startDate,
      endDate,
      month,
      totalWorkingDays: workingDays,
      totalRegularHours: calculation.regularHours,
      totalOvertimeHours: calculation.overtimeHours,
      totalLateNightHours: calculation.lateNightHours,
      totalHolidayHours: calculation.holidayHours,
      totalHours: calculation.regularHours + calculation.overtimeHours + calculation.lateNightHours + calculation.holidayHours,
      regularHours: calculation.regularHours,
      overtimeHours: calculation.overtimeHours,
      lateNightHours: calculation.lateNightHours,
      holidayHours: calculation.holidayHours,
      daysWorked: workingDays,
      daysAbsent: 0, // TODO: Calculate from leave records
      tardyCount: 0, // TODO: Calculate from time records
      earlyLeaveCount: 0, // TODO: Calculate from time records
      violations,
      calculatedPay: calculation
    };
  }

  /**
   * Generate payroll summary for all employees
   */
  async generatePayrollSummary(month: string): Promise<PayrollSummary> {
    const employees = await this.db.getAllEmployees();
    const calculations: PayrollCalculation[] = [];
    const allViolations: { employeeId: string; violation: string }[] = [];

    for (const employee of employees) {
      try {
        const calculation = await this.calculateMonthlyPayroll(employee.id, month);
        calculations.push(calculation);

        // Get violations for this employee
        const report = await this.generateAttendanceReport(employee.id, month);
        if (report.violations) {
          for (const violation of report.violations) {
            allViolations.push({ employeeId: employee.id, violation });
          }
        }
      } catch (error) {
        console.error(`Error calculating payroll for employee ${employee.id}:`, error);
      }
    }

    // Calculate totals
    const totalRegularPay = calculations.reduce((sum, calc) => sum + calc.regularPay, 0);
    const totalOvertimePay = calculations.reduce((sum, calc) => sum + calc.overtimePay, 0);
    const totalLateNightPay = calculations.reduce((sum, calc) => sum + calc.lateNightPay, 0);
    const totalHolidayPay = calculations.reduce((sum, calc) => sum + calc.holidayPay, 0);
    const totalPay = totalRegularPay + totalOvertimePay + totalLateNightPay + totalHolidayPay;

    return {
      month,
      totalEmployees: employees.length,
      totalRegularPay,
      totalOvertimePay,
      totalLateNightPay,
      totalHolidayPay,
      totalPay,
      violations: allViolations
    };
  }
}

export default PayrollCalculator;