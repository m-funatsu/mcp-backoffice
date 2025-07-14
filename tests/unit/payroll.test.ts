import { describe, it, expect, beforeEach, vi } from 'vitest';
import PayrollCalculator from '../../src/payroll.js';
import { PayrollRules, TimeRecord } from '../../src/types.js';
import { createMockDatabase, defaultPayrollRules } from '../setup/test-db.js';

// Mock database
const mockDb = createMockDatabase();

describe('PayrollCalculator', () => {
  let calculator: PayrollCalculator;

  beforeEach(() => {
    vi.clearAllMocks();
    calculator = new PayrollCalculator(mockDb as any, defaultPayrollRules);
  });

  describe('calculateMonthlyPayroll', () => {
    it('should calculate monthly payroll with various work patterns', async () => {
      const timeRecords: TimeRecord[] = [
        {
          id: 'TR001',
          employeeId: 'EMP001',
          date: new Date('2024-01-15'),
          clockIn: new Date('2024-01-15T09:00:00'),
          clockOut: new Date('2024-01-15T18:00:00'),
          breakMinutes: 60,
          recordType: 'manual'
        },
        {
          id: 'TR002',
          employeeId: 'EMP001',
          date: new Date('2024-01-16'),
          clockIn: new Date('2024-01-16T09:00:00'),
          clockOut: new Date('2024-01-16T20:00:00'), // Overtime day
          breakMinutes: 60,
          recordType: 'manual'
        }
      ];

      mockDb.getTimeRecords.mockResolvedValue(timeRecords);

      const result = await calculator.calculateMonthlyPayroll('EMP001', '2024-01');

      expect(result.employeeId).toBe('EMP001');
      expect(result.month).toBe('2024-01');
      expect(result.regularHours).toBe(16); // 8 + 8 regular hours
      expect(result.overtimeHours).toBe(2); // 2 hours overtime on second day
      expect(result.regularPay).toBe(40000); // 16 hours * 2500 yen (from sampleEmployee)
      expect(result.overtimePay).toBe(6250); // 2 hours * 2500 * 1.25
    });
  });

  describe('generateAttendanceReport', () => {
    it('should identify labor law violations', async () => {
      // Mock excessive overtime scenario
      const timeRecords: TimeRecord[] = Array.from({ length: 20 }, (_, i) => ({
        id: `TR${i}`,
        employeeId: 'EMP001',
        date: new Date(`2024-01-${String(i + 1).padStart(2, '0')}`),
        clockIn: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T09:00:00`),
        clockOut: new Date(`2024-01-${String(i + 1).padStart(2, '0')}T22:00:00`), // 12 hours each day
        breakMinutes: 60,
        recordType: 'manual'
      }));

      mockDb.getTimeRecords.mockResolvedValue(timeRecords);

      const report = await calculator.generateAttendanceReport('EMP001', '2024-01');

      expect(report.violations.some(v => v.includes('月間時間外労働時間が上限'))).toBe(true);
    });
  });
});