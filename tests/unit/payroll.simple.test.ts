import { describe, it, expect } from 'vitest';

describe('Simple Payroll Tests', () => {
  describe('Working Hours Calculation', () => {
    function calculateWorkHours(clockIn: Date, clockOut: Date, breakMinutes: number): number {
      const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
      return Math.max(0, (totalMinutes - breakMinutes) / 60);
    }

    it('should calculate regular 8-hour work day correctly', () => {
      const clockIn = new Date('2024-01-15T09:00:00');
      const clockOut = new Date('2024-01-15T18:00:00');
      const breakMinutes = 60;

      const workHours = calculateWorkHours(clockIn, clockOut, breakMinutes);
      
      expect(workHours).toBe(8);
    });

    it('should calculate overtime correctly', () => {
      const clockIn = new Date('2024-01-15T09:00:00');
      const clockOut = new Date('2024-01-15T20:00:00'); // 11 hours total
      const breakMinutes = 60;

      const workHours = calculateWorkHours(clockIn, clockOut, breakMinutes);
      const overtimeHours = Math.max(0, workHours - 8);
      
      expect(workHours).toBe(10);
      expect(overtimeHours).toBe(2);
    });

    it('should handle overnight shifts', () => {
      const clockIn = new Date('2024-01-15T22:00:00');
      const clockOut = new Date('2024-01-16T06:00:00'); // 8 hours total
      const breakMinutes = 0;

      const workHours = calculateWorkHours(clockIn, clockOut, breakMinutes);
      
      expect(workHours).toBe(8);
    });
  });

  describe('Late Night Hours Calculation', () => {
    function isLateNightHour(hour: number): boolean {
      return hour >= 22 || hour < 5;
    }

    function calculateLateNightHours(clockIn: Date, clockOut: Date): number {
      let lateNightHours = 0;
      let current = new Date(clockIn);
      
      while (current < clockOut) {
        const nextHour = new Date(current);
        nextHour.setHours(current.getHours() + 1, 0, 0, 0);
        
        if (isLateNightHour(current.getHours())) {
          const endTime = nextHour > clockOut ? clockOut : nextHour;
          const duration = (endTime.getTime() - current.getTime()) / (1000 * 60 * 60);
          lateNightHours += duration;
        }
        
        current = nextHour;
      }
      
      return lateNightHours;
    }

    it('should identify late night hours correctly', () => {
      expect(isLateNightHour(22)).toBe(true);
      expect(isLateNightHour(23)).toBe(true);
      expect(isLateNightHour(0)).toBe(true);
      expect(isLateNightHour(4)).toBe(true);
      expect(isLateNightHour(5)).toBe(false);
      expect(isLateNightHour(21)).toBe(false);
    });

    it('should calculate late night hours for evening shift', () => {
      const clockIn = new Date('2024-01-15T21:00:00');
      const clockOut = new Date('2024-01-16T02:00:00');

      const lateNightHours = calculateLateNightHours(clockIn, clockOut);
      
      // 22:00-24:00 (2 hours) + 00:00-02:00 (2 hours) = 4 hours
      expect(lateNightHours).toBe(4);
    });
  });

  describe('Japanese Labor Law Compliance', () => {
    it('should enforce minimum break requirements', () => {
      function getRequiredBreakMinutes(workHours: number): number {
        if (workHours > 8) return 60;  // 8時間超で60分
        if (workHours > 6) return 45;  // 6時間超で45分
        return 0;
      }

      expect(getRequiredBreakMinutes(5)).toBe(0);
      expect(getRequiredBreakMinutes(7)).toBe(45);
      expect(getRequiredBreakMinutes(9)).toBe(60);
    });

    it('should check overtime limits', () => {
      function checkOvertimeCompliance(monthlyOvertimeHours: number): string[] {
        const violations: string[] = [];
        
        if (monthlyOvertimeHours > 45) {
          violations.push('月間時間外労働時間が上限(45時間)を超過: ' + monthlyOvertimeHours.toFixed(1) + '時間');
        }
        
        if (monthlyOvertimeHours > 60) {
          violations.push('月60時間超の時間外労働により50%割増賃金が適用されます');
        }
        
        return violations;
      }

      expect(checkOvertimeCompliance(40)).toEqual([]);
      expect(checkOvertimeCompliance(50)).toEqual(['月間時間外労働時間が上限(45時間)を超過: 50.0時間']);
      expect(checkOvertimeCompliance(70)).toEqual([
        '月間時間外労働時間が上限(45時間)を超過: 70.0時間',
        '月60時間超の時間外労働により50%割増賃金が適用されます'
      ]);
    });

    it('should calculate overtime pay rates correctly', () => {
      function calculateOvertimePay(baseHourlyRate: number, overtimeHours: number): {
        regularOvertimePay: number;
        highOvertimePay: number;
        total: number;
      } {
        const regularOvertimeRate = 1.25; // 25% premium
        const highOvertimeRate = 1.50;    // 50% premium for >60h/month
        
        const regularOvertime = Math.min(overtimeHours, 60);
        const highOvertime = Math.max(0, overtimeHours - 60);
        
        const regularOvertimePay = regularOvertime * baseHourlyRate * regularOvertimeRate;
        const highOvertimePay = highOvertime * baseHourlyRate * highOvertimeRate;
        
        return {
          regularOvertimePay,
          highOvertimePay,
          total: regularOvertimePay + highOvertimePay
        };
      }

      const hourlyRate = 2000;
      
      // 40 hours overtime (all at 25% premium)
      const result40 = calculateOvertimePay(hourlyRate, 40);
      expect(result40.regularOvertimePay).toBe(100000); // 40 * 2000 * 1.25
      expect(result40.highOvertimePay).toBe(0);
      expect(result40.total).toBe(100000);
      
      // 70 hours overtime (60 at 25%, 10 at 50%)
      const result70 = calculateOvertimePay(hourlyRate, 70);
      expect(result70.regularOvertimePay).toBe(150000); // 60 * 2000 * 1.25
      expect(result70.highOvertimePay).toBe(30000);     // 10 * 2000 * 1.50
      expect(result70.total).toBe(180000);
    });
  });
});