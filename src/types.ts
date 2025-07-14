export interface Employee {
  id: string;
  name: string;
  department: string;
  position: string;
  hourlyRate: number;
  joinDate: Date;
  managerId?: string;
  isActive: boolean;
  // Extended payroll fields
  employeeNumber?: string;
  socialInsuranceNumber?: string;
  bankAccount?: BankAccount;
  taxInfo?: TaxInfo;
  contractType?: 'full_time' | 'part_time' | 'contract' | 'temporary';
  salaryType?: 'hourly' | 'monthly' | 'annual';
  baseSalary?: number; // For monthly/annual employees
  allowances?: EmployeeAllowance[];
  deductions?: EmployeeDeduction[];
}

export interface BankAccount {
  bankName: string;
  branchName: string;
  accountType: 'checking' | 'savings';
  accountNumber: string;
  accountHolderName: string;
}

export interface TaxInfo {
  dependents: number;
  taxRate: number;
  isDisabled: boolean;
  isSingleParent: boolean;
  hasSpouseDeduction: boolean;
}

export interface EmployeeAllowance {
  type: 'transport' | 'housing' | 'family' | 'position' | 'qualification' | 'other';
  description: string;
  amount: number;
  isFixed: boolean; // true for fixed allowances, false for calculated
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface EmployeeDeduction {
  type: 'union_fees' | 'company_housing' | 'loan_repayment' | 'insurance' | 'other';
  description: string;
  amount: number;
  isFixed: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface LeaveBalance {
  id: number;
  employeeId: string;
  leaveType: LeaveType;
  year: number;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  halfDay: boolean;
  reason?: string;
  status: RequestStatus;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  autoApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeavePolicy {
  id: number;
  leaveType: LeaveType;
  tenureMonths: number;
  grantedDays: number;
  maxConsecutiveDays?: number;
  advanceNoticeDays: number;
  requiresApproval: boolean;
  autoApprovalConditions?: string;
  carryoverAllowed: boolean;
  carryoverLimitDays?: number;
  expiryMonths?: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
}

export type LeaveType = 'annual' | 'sick' | 'special' | 'maternity' | 'paternity' | 'bereavement' | 'personal';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

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

// Leave Management Types are defined above

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
  | 'get_leave_analytics'
  | 'calculate_compliance_payroll'
  | 'generate_payslip'
  | 'validate_labor_compliance'
  | 'get_payroll_report'
  | 'create_expense_from_receipt'
  | 'create_expense_from_text'
  | 'approve_expense'
  | 'reject_expense'
  | 'get_expense_analytics'
  | 'export_accounting_data'
  | 'monitor_36_compliance'
  | 'record_objective_time'
  | 'generate_compliance_report'
  | 'record_health_check';

// Expense Management Types - v1.3.0
export interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentCategoryId?: string;
  taxDeductible: boolean;
  approvalRequired: boolean;
  dailyLimit?: number;
  monthlyLimit?: number;
  validationRules: ValidationRules;
  isActive: boolean;
  createdAt: Date;
}

export interface ValidationRules {
  receiptRequired?: boolean;
  descriptionRequired?: boolean;
  businessPurposeRequired?: boolean;
  attendeesRequired?: boolean;
  learningObjectiveRequired?: boolean;
  meetingPurposeRequired?: boolean;
  detailedDescriptionRequired?: boolean;
}

export interface ExpenseRequest {
  id: string;
  employeeId: string;
  categoryId: string;
  amount: number;
  currency: string;
  expenseDate: Date;
  description: string;
  purpose?: string;
  receiptImageUrl?: string;
  extractedData?: ExtractedReceiptData;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'reimbursed';
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  aiConfidenceScore?: number;
  taxDeductible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExtractedReceiptData {
  vendor?: string;
  date?: Date;
  amount?: number;
  items?: ReceiptItem[];
  taxAmount?: number;
  confidence: number;
  ocrText?: string;
}

export interface ReceiptItem {
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice: number;
}

export interface ApprovalWorkflow {
  id: string;
  name: string;
  department?: string;
  minAmount: number;
  maxAmount?: number;
  approvalSteps: ApprovalStep[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface ApprovalStep {
  step: number;
  role: string;
  required: boolean;
}

export interface ReceiptImage {
  id: string;
  expenseRequestId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  ocrResult?: OCRResult;
  aiExtractedData?: ExtractedReceiptData;
  confidenceScore?: number;
  createdAt: Date;
}

export interface OCRResult {
  text: string;
  confidence: number;
  words?: OCRWord[];
  blocks?: OCRBlock[];
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words: OCRWord[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AccountingEntry {
  id: string;
  expenseRequestId: string;
  entryDate: Date;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  taxAmount: number;
  reference?: string;
  exported: boolean;
  exportedAt?: Date;
  createdAt: Date;
}

export interface ApprovalRiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  anomalyFlags: AnomalyFlag[];
  approvalProbability: number;
  recommendations: string[];
}

export interface AnomalyFlag {
  type: 'amount_unusual' | 'frequency_high' | 'category_inconsistent' | 'vendor_new' | 'timing_suspicious';
  severity: 'low' | 'medium' | 'high';
  description: string;
  value?: any;
}

export interface ParsedExpenseData {
  amount?: number;
  description?: string;
  purpose?: string;
  date?: Date;
  category?: string;
  vendor?: string;
  confidence: number;
}

export interface StructuredReceiptData {
  vendor: string;
  date: Date;
  total: number;
  items: ReceiptItem[];
  taxAmount?: number;
  paymentMethod?: string;
}

export interface ExpenseAnalytics {
  employeeId?: string;
  department?: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalAmount: number;
  totalRequests: number;
  averageAmount: number;
  categoryBreakdown: CategoryExpense[];
  monthlyTrend: MonthlyExpense[];
  topVendors: VendorExpense[];
  approvalStats: {
    approved: number;
    rejected: number;
    pending: number;
    averageApprovalTime: number; // in hours
  };
  complianceMetrics: {
    receiptComplianceRate: number;
    policyViolations: number;
    riskScore: number;
  };
}

export interface CategoryExpense {
  categoryId: string;
  categoryName: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface MonthlyExpense {
  month: string; // YYYY-MM
  amount: number;
  count: number;
}

export interface VendorExpense {
  vendor: string;
  amount: number;
  count: number;
  averageAmount: number;
}