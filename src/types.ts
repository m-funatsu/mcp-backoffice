export interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  hourlyRate: number;
  joinDate: Date;
  managerId?: string;
  isActive: boolean;
}

export interface TimeRecord {
  id: string;
  employeeId: string;
  date: Date;
  clockIn: Date;
  clockOut?: Date;
  breakMinutes: number;
  recordType: 'ic_card' | 'pc_log' | 'manual';
  notes?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface PayrollCalculation {
  employeeId: string;
  month: string; // YYYY-MM format
  regularHours: number;
  overtimeHours: number;
  lateNightHours: number;
  holidayHours: number;
  regularPay: number;
  overtimePay: number;
  lateNightPay: number;
  holidayPay: number;
  totalPay: number;
  calculatedAt: Date;
}

export interface WorkingHours {
  date: Date;
  regularHours: number;
  overtimeHours: number;
  lateNightHours: number;
  holidayHours: number;
  breakMinutes: number;
}

export interface PayrollRules {
  // Labor Standards Act compliance
  regularHoursPerDay: number; // 8 hours
  regularHoursPerWeek: number; // 40 hours
  breakMinutesFor6Hours: number; // 45 minutes
  breakMinutesFor8Hours: number; // 60 minutes
  overtimeRate: number; // 1.25 (25% premium)
  lateNightRate: number; // 1.25 (25% premium)
  holidayRate: number; // 1.35 (35% premium)
  highOvertimeRate: number; // 1.50 (50% premium for >60h/month)
  lateNightStart: number; // 22:00 (10 PM)
  lateNightEnd: number; // 5:00 (5 AM)
  monthlyOvertimeLimit: number; // 45 hours
  yearlyOvertimeLimit: number; // 360 hours
  highOvertimeThreshold: number; // 60 hours/month
}

export interface AttendanceReport {
  employeeId: string;
  employeeName: string;
  month: string;
  totalWorkingDays: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalLateNightHours: number;
  totalHolidayHours: number;
  violations: string[];
  calculatedPay: PayrollCalculation;
}

export interface PayrollSummary {
  month: string;
  totalEmployees: number;
  totalRegularPay: number;
  totalOvertimePay: number;
  totalLateNightPay: number;
  totalHolidayPay: number;
  totalPay: number;
  violations: { employeeId: string; violation: string }[];
}

// Leave Management Types
export type LeaveType = 'annual' | 'sick' | 'special' | 'maternity' | 'paternity' | 'bereavement';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  leaveDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  isHalfDay: boolean;
  submittedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  managerId?: string;
  comments?: string;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  annualLeaveDays: number;
  annualLeaveUsed: number;
  sickLeaveDays: number;
  sickLeaveUsed: number;
  specialLeaveUsed: number;
  carryOverDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export type MCPToolName = 
  | 'clock_in'
  | 'clock_out'
  | 'get_time_records'
  | 'calculate_payroll'
  | 'get_payroll_summary'
  | 'approve_timecard'
  | 'get_attendance_report'
  | 'add_employee'
  | 'get_employee'
  | 'get_all_employees'
  | 'update_employee'
  | 'export_data'
  | 'import_data'
  | 'request_leave'
  | 'approve_leave'
  | 'reject_leave'
  | 'get_leave_balance'
  | 'get_team_calendar'
  | 'get_leave_analytics';