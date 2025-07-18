import { vi } from 'vitest';
import type { Employee, TimeRecord } from '../../src/types.js';

// Mock database implementation for testing
export const createMockDatabase = () => {
  const mockDb = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    initializeDatabase: vi.fn(),
    addEmployee: vi.fn(),
    createEmployee: vi.fn(),
    getEmployee: vi.fn(),
    getAllEmployees: vi.fn(),
    clockIn: vi.fn(),
    clockOut: vi.fn(),
    addTimeRecords: vi.fn(),
    getTimeRecords: vi.fn(),
    updateEmployee: vi.fn(),
    savePayrollCalculation: vi.fn(),
    getPayrollCalculation: vi.fn(),
    getPayrollRules: vi.fn(),
    isHoliday: vi.fn(),
    close: vi.fn(),
    // PostgreSQL database layer
    run: vi.fn(),
    get: vi.fn(),
    all: vi.fn(),
    exec: vi.fn(),
    // Leave management methods
    getLeaveBalance: vi.fn(),
    createLeaveRequest: vi.fn(),
    updateLeaveRequest: vi.fn(),
    getLeaveRequests: vi.fn(),
    updateLeaveBalance: vi.fn(),
    initializeLeaveBalance: vi.fn(),
    getTeamSchedule: vi.fn(),
  };

  // Set up default mock implementations
  mockDb.getEmployee.mockResolvedValue(sampleEmployee);
  mockDb.getAllEmployees.mockResolvedValue([sampleEmployee]);
  mockDb.getTimeRecords.mockResolvedValue([sampleTimeRecord]);
  mockDb.addTimeRecords.mockResolvedValue(undefined);
  mockDb.updateEmployee.mockResolvedValue(undefined);
  mockDb.isHoliday.mockResolvedValue(false);
  mockDb.savePayrollCalculation.mockResolvedValue(undefined);

  return mockDb;
};

export const defaultPayrollRules = {
  regularHoursPerDay: 8,
  regularHoursPerWeek: 40,
  breakMinutesFor6Hours: 45,
  breakMinutesFor8Hours: 60,
  overtimeRate: 1.25,
  lateNightRate: 1.25,
  holidayRate: 1.35,
  highOvertimeRate: 1.50,
  lateNightStart: 22,
  lateNightEnd: 5,
  monthlyOvertimeLimit: 45,
  yearlyOvertimeLimit: 360,
  highOvertimeThreshold: 60
};

export const sampleEmployee = {
  id: 'EMP001',
  name: '田中太郎',
  department: '開発部',
  position: 'エンジニア',
  hourlyRate: 2500,
  startDate: new Date('2024-01-01'),
  birthDate: new Date('1990-01-01'),
  managerId: null,
  isActive: true,
  contractType: 'full_time',
  salaryType: 'hourly'
};

export const sampleTimeRecord = {
  id: 'TR001',
  employeeId: 'EMP001',
  date: new Date('2024-01-15'),
  clockIn: new Date('2024-01-15T09:00:00'),
  clockOut: new Date('2024-01-15T18:00:00'),
  breakDuration: 60,
  breakMinutes: 60,
  recordType: 'manual' as const
};