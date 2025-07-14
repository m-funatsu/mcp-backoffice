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

// v2.0.0 Human Capital Disclosure System Types

export interface EmployeeLifecycleStage {
  id: string;
  employeeId: string;
  stage: 'pre_hire' | 'onboarding' | 'active' | 'performance_review' | 'transition' | 'offboarding';
  startDate: Date;
  endDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  responsibleManager?: string;
  checklistData?: ChecklistItem[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completedAt?: Date;
  assignedTo?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface OnboardingPlan {
  id: string;
  employeeId: string;
  planType: 'standard' | 'manager' | 'executive' | 'intern';
  departmentSpecificItems?: DepartmentOnboardingItem[];
  durationWeeks: number;
  mentorId?: string;
  hrContactId?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepartmentOnboardingItem {
  category: string;
  items: string[];
  estimatedHours: number;
  priority: 'low' | 'medium' | 'high';
}

export interface OnboardingTask {
  id: string;
  onboardingPlanId: string;
  taskName: string;
  taskDescription?: string;
  taskCategory: 'documentation' | 'training' | 'introduction' | 'setup' | 'assessment';
  assignedTo?: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completionDate?: Date;
  notes?: string;
  createdAt: Date;
}

export interface PerformanceEvaluation {
  id: string;
  employeeId: string;
  evaluatorId: string;
  evaluationPeriod: string; // YYYY-MM format
  evaluationType: 'annual' | 'semi_annual' | 'quarterly' | 'probation' | 'special';
  overallRating?: number; // 1.0 to 5.0
  performanceMetrics?: PerformanceMetric[];
  strengths?: string;
  areasForImprovement?: string;
  developmentGoals?: string;
  careerAdvancementRecommendation?: string;
  status: 'draft' | 'submitted' | 'approved' | 'finalized';
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceMetric {
  category: string;
  metricName: string;
  targetValue: number;
  actualValue: number;
  rating: number; // 1.0 to 5.0
  comments?: string;
}

export interface TalentProfile {
  id: string;
  employeeId: string;
  careerLevel: 'entry' | 'junior' | 'mid' | 'senior' | 'expert' | 'leadership';
  coreCompetencies?: Competency[];
  technicalSkills?: Skill[];
  softSkills?: Skill[];
  careerAspirations?: string;
  mobilityPreferences?: MobilityPreference[];
  performanceTrend: 'improving' | 'stable' | 'declining';
  potentialRating: 'high' | 'medium' | 'low';
  retentionRisk: 'low' | 'medium' | 'high';
  successionReadiness: 'ready_now' | 'ready_1_year' | 'ready_2_years' | 'not_ready';
  createdAt: Date;
  updatedAt: Date;
}

export interface Competency {
  name: string;
  level: number; // 1 to 5
  description?: string;
  lastAssessed?: Date;
}

export interface Skill {
  name: string;
  level: number; // 1 to 5
  category: string;
  certifications?: string[];
  lastUsed?: Date;
}

export interface MobilityPreference {
  type: 'domestic' | 'international' | 'remote';
  willingness: 'high' | 'medium' | 'low';
  constraints?: string;
}

export interface DevelopmentPlan {
  id: string;
  employeeId: string;
  planName: string;
  developmentGoals: DevelopmentGoal[];
  targetCompetencies: string[];
  learningMethods: LearningMethod[];
  timelineMonths: number;
  budgetAllocated: number;
  progressPercentage: number;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DevelopmentGoal {
  title: string;
  description: string;
  targetDate: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  successCriteria: string[];
}

export interface LearningMethod {
  type: 'course' | 'mentoring' | 'project' | 'conference' | 'certification';
  description: string;
  estimatedHours: number;
  cost: number;
}

export interface TrainingCourse {
  id: string;
  courseName: string;
  courseCode: string;
  description?: string;
  courseType: 'technical' | 'soft_skills' | 'leadership' | 'compliance' | 'safety' | 'orientation';
  deliveryMethod: 'online' | 'in_person' | 'hybrid' | 'self_paced';
  durationHours: number;
  maxParticipants?: number;
  prerequisites?: string;
  learningObjectives: string[];
  certificationProvided: boolean;
  costPerParticipant: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningPath {
  id: string;
  pathName: string;
  description?: string;
  targetRole?: string;
  recommendedSequence: string[]; // Course IDs
  estimatedDurationMonths: number;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseEnrollment {
  id: string;
  employeeId: string;
  courseId: string;
  enrollmentDate: Date;
  startDate?: Date;
  targetCompletionDate?: Date;
  actualCompletionDate?: Date;
  status: 'enrolled' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  completionPercentage: number;
  finalScore?: number;
  certificationEarned: boolean;
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillsAssessment {
  id: string;
  employeeId: string;
  assessmentType: 'self_assessment' | 'manager_assessment' | 'peer_assessment' | 'external_assessment';
  skillCategory: 'technical' | 'leadership' | 'communication' | 'problem_solving' | 'teamwork';
  skillItems: AssessmentItem[];
  overallScore: number; // 1.0 to 5.0
  assessmentDate: Date;
  assessorId?: string;
  notes?: string;
  createdAt: Date;
}

export interface AssessmentItem {
  skill: string;
  currentLevel: number; // 1 to 5
  targetLevel?: number;
  importance: 'low' | 'medium' | 'high';
  developmentPriority: 'low' | 'medium' | 'high';
  comments?: string;
}

export interface EngagementSurvey {
  id: string;
  surveyName: string;
  surveyPeriod: string; // YYYY-MM format
  surveyQuestions: SurveyQuestion[];
  targetAudience: 'all' | 'department' | 'role' | 'tenure';
  responseRate?: number;
  status: 'draft' | 'active' | 'closed' | 'analyzed';
  createdAt: Date;
  updatedAt: Date;
}

export interface SurveyQuestion {
  id: string;
  question: string;
  type: 'rating' | 'multiple_choice' | 'text' | 'yes_no';
  scale?: number; // For rating questions
  options?: string[]; // For multiple choice
  required: boolean;
  category: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  employeeId: string;
  responses: QuestionResponse[];
  responseDate: Date;
  overallSatisfaction: number; // 1.0 to 5.0
  createdAt: Date;
}

export interface QuestionResponse {
  questionId: string;
  answer: string | number;
  comments?: string;
}

export interface HumanCapitalMetric {
  id: string;
  metricName: string;
  metricCategory: 'workforce' | 'costs' | 'productivity' | 'engagement' | 'diversity' | 'skills' | 'recruitment' | 'retention';
  metricValue: number;
  metricUnit: string;
  calculationMethod: string;
  reportingPeriod: string; // YYYY-MM format
  benchmarkValue?: number;
  isIso30414Compliant: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiversityMetric {
  id: string;
  metricType: 'gender' | 'age' | 'nationality' | 'disability' | 'education' | 'tenure';
  categoryBreakdown: DiversityCategory[];
  leadershipRepresentation: LeadershipDiversity[];
  payEquityMetrics: PayEquityMetric[];
  reportingPeriod: string; // YYYY-MM format
  createdAt: Date;
  updatedAt: Date;
}

export interface DiversityCategory {
  category: string;
  count: number;
  percentage: number;
}

export interface LeadershipDiversity {
  level: string;
  totalPositions: number;
  diversityBreakdown: DiversityCategory[];
}

export interface PayEquityMetric {
  category: string;
  genderPayGap: number; // Percentage
  adjustedPayGap: number; // After controlling for factors
  confidenceLevel: number;
}

export interface SuccessionPlan {
  id: string;
  positionTitle: string;
  department: string;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  successionCandidates: SuccessionCandidate[];
  readinessAssessment: ReadinessAssessment[];
  developmentActions: DevelopmentAction[];
  timelineMonths: number;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuccessionCandidate {
  employeeId: string;
  readinessLevel: 'ready_now' | 'ready_1_year' | 'ready_2_years' | 'not_ready';
  riskLevel: 'low' | 'medium' | 'high';
  developmentNeeds: string[];
  strengths: string[];
  priority: number;
}

export interface ReadinessAssessment {
  employeeId: string;
  competencyGaps: CompetencyGap[];
  experienceGaps: string[];
  developmentPlan: string;
  estimatedReadinessDate: Date;
}

export interface CompetencyGap {
  competency: string;
  currentLevel: number;
  requiredLevel: number;
  developmentActions: string[];
}

export interface DevelopmentAction {
  action: string;
  assignedTo: string;
  dueDate: Date;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

export interface WellnessRecord {
  id: string;
  employeeId: string;
  wellnessType: 'physical' | 'mental' | 'financial' | 'social';
  activityName: string;
  activityDate: Date;
  participationStatus: 'registered' | 'attended' | 'completed' | 'cancelled';
  feedbackScore?: number; // 1.0 to 5.0
  healthImpactScore?: number; // 1.0 to 5.0
  notes?: string;
  createdAt: Date;
}

export interface EmployeeComprehensiveProfile {
  employee: Employee;
  talentProfile?: TalentProfile;
  trainingMetrics: {
    totalCourses: number;
    completedCourses: number;
    completionRate: number;
  };
  performanceMetrics: {
    averageRating?: number;
    averageEngagementScore?: number;
  };
  recentEvaluations: PerformanceEvaluation[];
  activeDevelopmentPlans: DevelopmentPlan[];
  skillsAssessments: SkillsAssessment[];
}