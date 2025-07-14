import { describe, test, expect, beforeEach } from 'vitest';
import { WorkingHoursCalculator } from '../../src/working-hours-calculator.js';
import type { TimeRecord } from '../../src/types.js';

describe('WorkingHoursCalculator - Japanese Labor Standards Act Compliance', () => {
  let calculator: WorkingHoursCalculator;

  beforeEach(() => {
    calculator = new WorkingHoursCalculator();
  });

  describe('Regular Working Hours Calculation', () => {
    test('should calculate standard 8-hour workday correctly', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_001',
        employeeId: 'EMP_001',
        date: new Date('2024-07-15'), // Monday
        clockIn: new Date('2024-07-15T09:00:00'),
        clockOut: new Date('2024-07-15T18:00:00'),
        breakMinutes: 60,
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.totalMinutes).toBe(540); // 9 hours
      expect(breakdown.workingMinutes).toBe(480); // 8 hours working
      expect(breakdown.regularHours).toBe(8);
      expect(breakdown.overtimeHours).toBe(0);
      expect(breakdown.lateNightHours).toBe(0);
      expect(breakdown.holidayHours).toBe(0);
      expect(breakdown.violations).toHaveLength(0);
    });

    test('should calculate overtime hours correctly', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_002',
        employeeId: 'EMP_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T09:00:00'),
        clockOut: new Date('2024-07-15T21:00:00'), // 12 hours total
        breakMinutes: 90, // Extended break for long day
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.totalMinutes).toBe(720); // 12 hours
      expect(breakdown.workingMinutes).toBe(630); // 10.5 hours working
      expect(breakdown.regularHours).toBe(8);
      expect(breakdown.overtimeHours).toBe(2.5);
      expect(breakdown.violations).toHaveLength(1);
      expect(breakdown.violations[0].type).toBe('excessive_hours');
    });

    test('should detect missing clock-out', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_003',
        employeeId: 'EMP_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T09:00:00'),
        clockOut: undefined,
        breakMinutes: 60,
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.regularHours).toBe(0);
      expect(breakdown.overtimeHours).toBe(0);
      expect(breakdown.violations).toHaveLength(1);
      expect(breakdown.violations[0].severity).toBe('critical');
      expect(breakdown.violations[0].description).toContain('退勤打刻なし');
    });
  });

  describe('Late Night Hours Calculation (22:00-05:00)', () => {
    test('should calculate late night hours correctly', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_004',
        employeeId: 'EMP_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T20:00:00'),
        clockOut: new Date('2024-07-16T02:00:00'), // 6 hours, 4 hours late night
        breakMinutes: 30,
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.workingMinutes).toBe(330); // 5.5 hours working
      expect(breakdown.lateNightHours).toBeCloseTo(3.5, 1); // 22:00-02:00 minus break
      expect(breakdown.regularHours).toBe(0); // No regular hours for night shift
      expect(breakdown.overtimeHours).toBe(5.5);
    });

    test('should handle work spanning multiple late night periods', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_005',
        employeeId: 'EMP_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T23:00:00'),
        clockOut: new Date('2024-07-16T08:00:00'), // 9 hours
        breakMinutes: 60,
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.workingMinutes).toBe(480); // 8 hours working
      expect(breakdown.lateNightHours).toBeCloseTo(5.3, 1); // 23:00-05:00 minus break proportion
    });
  });

  describe('Holiday and Weekend Work', () => {
    test('should identify holiday work', () => {
      // New Year's Day 2024
      const timeRecord: TimeRecord = {
        id: 'TR_006',
        employeeId: 'EMP_001',
        date: new Date('2024-01-01'),
        clockIn: new Date('2024-01-01T10:00:00'),
        clockOut: new Date('2024-01-01T18:00:00'),
        breakMinutes: 60,
        recordType: 'manual'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.isHoliday).toBe(true);
      expect(breakdown.holidayHours).toBe(7); // All hours are holiday hours
      expect(breakdown.regularHours).toBe(0);
      expect(breakdown.overtimeHours).toBe(7);
    });

    test('should identify weekend work', () => {
      // Saturday
      const timeRecord: TimeRecord = {
        id: 'TR_007',
        employeeId: 'EMP_001',
        date: new Date('2024-07-13'), // Saturday
        clockIn: new Date('2024-07-13T09:00:00'),
        clockOut: new Date('2024-07-13T17:00:00'),
        breakMinutes: 60,
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.isWeekend).toBe(true);
      expect(breakdown.holidayHours).toBe(7); // Weekend treated as holiday
      expect(breakdown.regularHours).toBe(0);
      expect(breakdown.overtimeHours).toBe(7);
    });
  });

  describe('Break Time Compliance', () => {
    test('should require 45 minutes break for 6+ hours', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_008',
        employeeId: 'EMP_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T09:00:00'),
        clockOut: new Date('2024-07-15T16:00:00'), // 7 hours
        breakMinutes: 30, // Insufficient
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.violations).toHaveLength(1);
      expect(breakdown.violations[0].type).toBe('insufficient_break');
      expect(breakdown.violations[0].value).toBe(30);
      expect(breakdown.violations[0].requirement).toBe(45);
    });

    test('should require 60 minutes break for 8+ hours', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_009',
        employeeId: 'EMP_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T09:00:00'),
        clockOut: new Date('2024-07-15T19:00:00'), // 10 hours
        breakMinutes: 45, // Insufficient for 8+ hours
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.violations).toHaveLength(2); // Insufficient break + excessive hours
      expect(breakdown.violations.find(v => v.type === 'insufficient_break')?.requirement).toBe(60);
    });

    test('should pass with adequate break time', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_010',
        employeeId: 'EMP_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T09:00:00'),
        clockOut: new Date('2024-07-15T18:00:00'),
        breakMinutes: 60, // Adequate
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.violations.filter(v => v.type === 'insufficient_break')).toHaveLength(0);
    });
  });

  describe('Monthly Hours Summary', () => {
    test('should calculate monthly summary correctly', () => {
      const timeRecords: TimeRecord[] = [];
      
      // Create 20 working days with varying patterns
      for (let i = 1; i <= 20; i++) {
        const date = new Date(`2024-07-${i.toString().padStart(2, '0')}`);
        
        // Skip weekends for this test
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        timeRecords.push({
          id: `TR_${i}`,
          employeeId: 'EMP_001',
          date,
          clockIn: new Date(date.getTime() + 9 * 60 * 60 * 1000), // 9:00 AM
          clockOut: new Date(date.getTime() + (18 + (i % 3)) * 60 * 60 * 1000), // Varying end times
          breakMinutes: 60,
          recordType: 'ic_card'
        });
      }

      const summary = calculator.calculateMonthlyHours(timeRecords);
      
      expect(summary.workingDays).toBe(timeRecords.length);
      expect(summary.totalRegularHours).toBeGreaterThan(0);
      expect(summary.totalOvertimeHours).toBeGreaterThan(0);
      expect(summary.compliance.breakTimeCompliant).toBe(true);
    });

    test('should detect monthly overtime violations', () => {
      const timeRecords: TimeRecord[] = [];
      
      // Create 22 working days with 3+ hours overtime each (66+ hours total)
      for (let i = 1; i <= 22; i++) {
        const date = new Date(`2024-07-${i.toString().padStart(2, '0')}`);
        
        timeRecords.push({
          id: `TR_${i}`,
          employeeId: 'EMP_001',
          date,
          clockIn: new Date(date.getTime() + 9 * 60 * 60 * 1000), // 9:00 AM
          clockOut: new Date(date.getTime() + 20 * 60 * 60 * 1000), // 8:00 PM (11 hours)
          breakMinutes: 90,
          recordType: 'ic_card'
        });
      }

      const summary = calculator.calculateMonthlyHours(timeRecords);
      
      expect(summary.compliance.monthlyOvertimeCompliant).toBe(false);
      expect(summary.totalOvertimeHours).toBeGreaterThan(45);
      expect(summary.violations).toHaveLength(1);
      expect(summary.violations[0].type).toBe('excessive_hours');
      expect(summary.violations[0].severity).toBe('critical');
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle system administrator night shift pattern', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_NIGHT',
        employeeId: 'SYS_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T22:00:00'), // 10 PM
        clockOut: new Date('2024-07-16T06:00:00'), // 6 AM next day
        breakMinutes: 60,
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.workingMinutes).toBe(420); // 7 hours working
      expect(breakdown.lateNightHours).toBeCloseTo(6, 1); // Most of the shift is late night
      expect(breakdown.overtimeHours).toBe(7); // All hours are overtime for night shift
    });

    test('should handle project manager excessive overtime pattern', () => {
      const timeRecords: TimeRecord[] = [];
      
      // Extreme case: 15-hour days for a month
      for (let i = 1; i <= 25; i++) {
        const date = new Date(`2024-07-${i.toString().padStart(2, '0')}`);
        
        timeRecords.push({
          id: `TR_EXTREME_${i}`,
          employeeId: 'PM_001',
          date,
          clockIn: new Date(date.getTime() + 7 * 60 * 60 * 1000), // 7:00 AM
          clockOut: new Date(date.getTime() + 23 * 60 * 60 * 1000), // 11:00 PM
          breakMinutes: 120, // 2 hours break
          recordType: 'ic_card'
        });
      }

      const summary = calculator.calculateMonthlyHours(timeRecords);
      
      expect(summary.totalOvertimeHours).toBeGreaterThan(150); // Extreme overtime
      expect(summary.compliance.monthlyOvertimeCompliant).toBe(false);
      expect(summary.violations.some(v => v.severity === 'critical')).toBe(true);
    });

    test('should handle part-time worker pattern', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_PART_TIME',
        employeeId: 'PT_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T10:00:00'),
        clockOut: new Date('2024-07-15T15:00:00'), // 5 hours
        breakMinutes: 0, // No break for short shift
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      
      expect(breakdown.workingMinutes).toBe(300); // 5 hours
      expect(breakdown.regularHours).toBe(5);
      expect(breakdown.overtimeHours).toBe(0);
      expect(breakdown.violations.filter(v => v.type === 'insufficient_break')).toHaveLength(0);
    });
  });

  describe('Data Conversion', () => {
    test('should convert breakdowns to WorkingHours format', () => {
      const timeRecord: TimeRecord = {
        id: 'TR_CONVERT',
        employeeId: 'EMP_001',
        date: new Date('2024-07-15'),
        clockIn: new Date('2024-07-15T09:00:00'),
        clockOut: new Date('2024-07-15T19:00:00'),
        breakMinutes: 90,
        recordType: 'ic_card'
      };

      const breakdown = calculator.calculateDailyHours(timeRecord);
      const workingHours = calculator.convertToWorkingHours([breakdown]);
      
      expect(workingHours).toHaveLength(1);
      expect(workingHours[0].date).toEqual(breakdown.date);
      expect(workingHours[0].regularHours).toBe(breakdown.regularHours);
      expect(workingHours[0].overtimeHours).toBe(breakdown.overtimeHours);
      expect(workingHours[0].lateNightHours).toBe(breakdown.lateNightHours);
      expect(workingHours[0].holidayHours).toBe(breakdown.holidayHours);
      expect(workingHours[0].breakMinutes).toBe(breakdown.breakMinutes);
    });
  });
});