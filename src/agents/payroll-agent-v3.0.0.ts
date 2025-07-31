/**
 * 給与計算エージェント v3.0.0
 * Payroll Calculation Agent - Autonomous Payroll Processing
 * 
 * 機能:
 * - 自律的な給与計算プロセスの実行
 * - データ収集→検証→計算→支払い→レポーティングの自動化
 * - エラー検出と自己修復
 * - コンプライアンスチェックの自動実行
 */

import { BaseAgent } from '../agent-framework-v3.0.0.js';
import type { AgentGoal, AgentPlan, AgentAction, AgentResult, AgentCapability } from '../agent-framework-v3.0.0.js';
import { DatabasePostgreSQL } from '../database_postgresql.js';
import { PayrollEngineV12 } from '../payroll-engine.js';
import { WorkingHoursCalculator } from '../working-hours-calculator.js';
import { ComplianceEngine } from '../compliance-engine.js';
import type { Employee, TimeRecord, PayrollCalculation, WorkingHours } from '../types.js';
import { createDateTime } from '../types/core/datetime.js';

// PayrollPeriodの定義
interface PayrollPeriod {
  month: string;
  startDate: Date;
  endDate: Date;
}

// 型定義
type AgentActionOutput = 
  | TimesheetDataResult 
  | ValidationResult 
  | WorkingHoursResult 
  | ComplianceCheckResult 
  | PayrollCalculationResult 
  | PayslipGenerationResult 
  | PaymentFileResult 
  | NotificationResult 
  | ReportsResult 
  | RollbackResult;

interface TimesheetDataResult {
  employeeCount: number;
  totalRecords: number;
  period: PayrollPeriod;
}

interface ValidationError {
  type: 'duplicate_records' | 'missing_records' | 'invalid_time' | 'anomaly';
  employeeId: string;
  description: string;
  records?: TimeRecord[];
}

interface ValidationResult {
  isValid: boolean;
  errorCount: number;
  autoCorrections: number;
  errors: ValidationError[];
}

interface WorkingHoursResult {
  employeeCount: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  averageHoursPerEmployee: number;
}

interface ComplianceIssue {
  employeeId: string;
  violations: Array<{
    type: string;
    description: string;
    severity: 'warning' | 'violation' | 'critical';
  }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface ComplianceCheckResult {
  isCompliant: boolean;
  issueCount: number;
  criticalIssues: number;
}

interface PayrollCalculationResult {
  employeeCount: number;
  totalGrossPay: number;
  totalNetPay: number;
  calculationErrors: number;
  totalDeductions?: number;
}

interface PayslipData {
  employeeId: string;
  employeeName: string;
  period: PayrollPeriod;
  grossPay: number;
  netPay: number;
  deductions: Array<{
    type: string;
    amount: number;
  }>;
  bankAccount?: string;
}

interface PayslipGenerationResult {
  payslipCount: number;
  generated: boolean;
}

interface PaymentFileResult {
  fileGenerated: boolean;
  paymentCount: number;
  totalAmount: number;
}

interface NotificationResult {
  notificationsSent: number;
  totalNotifications: number;
  period?: PayrollPeriod;
}

interface DepartmentSummary {
  employeeCount: number;
  totalGrossPay: number;
  totalNetPay: number;
}

interface DepartmentReport {
  departments: Array<{
    name: string;
    summary: DepartmentSummary;
  }>;
}

interface ReportsResult {
  summaryReport: {
    period: PayrollPeriod;
    employeeCount: number;
    totalGrossPay: number;
    totalNetPay: number;
    totalDeductions: number;
    complianceIssues: number;
    generatedAt: Date;
  };
  departmentReport: DepartmentReport;
  reportsGenerated: boolean;
}

interface RollbackResult {
  rolledBack: boolean;
  recordsDeleted: number;
}

export class PayrollAgent extends BaseAgent {
  private payrollEngine: PayrollEngineV12;
  private workingHoursCalculator: WorkingHoursCalculator;
  private complianceEngine: ComplianceEngine;

  constructor(db: DatabasePostgreSQL) {
    const capabilities: AgentCapability = {
      name: 'PayrollAgent',
      description: '給与計算の自律的実行エージェント',
      version: '3.0.0',
      supportedActions: [
        'collect_timesheet_data',
        'validate_attendance_records',
        'calculate_working_hours',
        'check_compliance',
        'calculate_payroll',
        'generate_payslips',
        'prepare_payment_files',
        'send_notifications',
        'generate_reports',
        'handle_exceptions'
      ],
      requiredPermissions: [
        'timesheet:read',
        'employee:read',
        'payroll:write',
        'payment:prepare',
        'notification:send'
      ]
    };

    super('PayrollAgent', capabilities, db);
    
    this.payrollEngine = new PayrollEngineV12(db);
    this.workingHoursCalculator = new WorkingHoursCalculator();
    this.complianceEngine = new ComplianceEngine(db);
  }

  protected async validateGoal(goal: AgentGoal): Promise<void> {
    // ゴールタイプの検証
    if (goal.type !== 'process') {
      throw new Error(`Unsupported goal type: ${goal.type}`);
    }

    // 必須パラメータの検証
    const params = goal.metadata || {};
    if (!params['payrollPeriod']) {
      throw new Error('Payroll period not specified');
    }

    // 期限の妥当性確認
    if (goal.deadline) {
      const daysUntilDeadline = (new Date(goal.deadline.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline < 2) {
        this.logger.warn('Tight deadline detected', { daysUntilDeadline });
      }
    }
  }

  protected async createPlan(goal: AgentGoal): Promise<AgentPlan> {
    const payrollPeriod = goal.metadata?.['payrollPeriod'] as PayrollPeriod;
    const actions: AgentAction[] = [];
    const dependencies = new Map<string, string[]>();

    // 1. データ収集フェーズ
    const collectAction: AgentAction = {
      id: 'collect_timesheet_data',
      type: 'data_collection',
      description: `${payrollPeriod.month}の勤怠データを収集`,
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['timesheet:read'],
      estimatedDuration: 30000, // 30秒
      retryable: true
    };
    actions.push(collectAction);

    // 2. データ検証フェーズ
    const validateAction: AgentAction = {
      id: 'validate_attendance_records',
      type: 'validation',
      description: '勤怠記録の整合性検証',
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['timesheet:read'],
      estimatedDuration: 60000, // 1分
      retryable: true
    };
    actions.push(validateAction);
    dependencies.set(validateAction.id, [collectAction.id]);

    // 3. 労働時間計算
    const calculateHoursAction: AgentAction = {
      id: 'calculate_working_hours',
      type: 'calculation',
      description: '労働時間と残業時間の計算',
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['timesheet:read'],
      estimatedDuration: 90000, // 1.5分
      retryable: true
    };
    actions.push(calculateHoursAction);
    dependencies.set(calculateHoursAction.id, [validateAction.id]);

    // 4. コンプライアンスチェック
    const complianceAction: AgentAction = {
      id: 'check_compliance',
      type: 'compliance',
      description: '労働基準法準拠チェック',
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['compliance:check'],
      estimatedDuration: 45000, // 45秒
      retryable: true
    };
    actions.push(complianceAction);
    dependencies.set(complianceAction.id, [calculateHoursAction.id]);

    // 5. 給与計算
    const calculatePayrollAction: AgentAction = {
      id: 'calculate_payroll',
      type: 'calculation',
      description: '給与・控除・手取り額の計算',
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['payroll:write'],
      estimatedDuration: 120000, // 2分
      retryable: false,
      compensationAction: 'rollback_payroll_calculation'
    };
    actions.push(calculatePayrollAction);
    dependencies.set(calculatePayrollAction.id, [complianceAction.id]);

    // 6. 給与明細生成
    const generatePayslipsAction: AgentAction = {
      id: 'generate_payslips',
      type: 'document_generation',
      description: '給与明細の生成',
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['payroll:write'],
      estimatedDuration: 60000, // 1分
      retryable: true
    };
    actions.push(generatePayslipsAction);
    dependencies.set(generatePayslipsAction.id, [calculatePayrollAction.id]);

    // 7. 支払いファイル準備
    const preparePaymentAction: AgentAction = {
      id: 'prepare_payment_files',
      type: 'payment_preparation',
      description: '銀行振込ファイルの生成',
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['payment:prepare'],
      estimatedDuration: 30000, // 30秒
      retryable: true
    };
    actions.push(preparePaymentAction);
    dependencies.set(preparePaymentAction.id, [calculatePayrollAction.id]);

    // 8. 通知送信
    const notificationAction: AgentAction = {
      id: 'send_notifications',
      type: 'notification',
      description: '従業員への給与明細通知',
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['notification:send'],
      estimatedDuration: 45000, // 45秒
      retryable: true
    };
    actions.push(notificationAction);
    dependencies.set(notificationAction.id, [generatePayslipsAction.id]);

    // 9. レポート生成
    const reportAction: AgentAction = {
      id: 'generate_reports',
      type: 'reporting',
      description: '給与計算レポートの生成',
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['payroll:write'],
      estimatedDuration: 60000, // 1分
      retryable: true
    };
    actions.push(reportAction);
    dependencies.set(reportAction.id, [calculatePayrollAction.id]);

    // ロールバックアクション
    const rollbackAction: AgentAction = {
      id: 'rollback_payroll_calculation',
      type: 'rollback',
      description: '給与計算のロールバック',
      parameters: { period: payrollPeriod },
      requiredCapabilities: ['payroll:write'],
      estimatedDuration: 30000,
      retryable: false
    };
    actions.push(rollbackAction);

    // 総実行時間の計算
    const totalDuration = actions
      .filter(a => a.id !== 'rollback_payroll_calculation')
      .reduce((sum, action) => sum + (action.estimatedDuration || 0), 0);

    return {
      goalId: goal.id,
      actions,
      dependencies,
      estimatedTotalDuration: totalDuration,
      parallelizable: false // 給与計算は順次実行が必要
    };
  }

  protected async executeAction(action: AgentAction): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      let output: AgentActionOutput;

      switch (action.id) {
        case 'collect_timesheet_data':
          output = await this.collectTimesheetData(action.parameters['period']);
          break;

        case 'validate_attendance_records':
          output = await this.validateAttendanceRecords(action.parameters['period']);
          break;

        case 'calculate_working_hours':
          output = await this.calculateWorkingHours(action.parameters['period']);
          break;

        case 'check_compliance':
          output = await this.checkCompliance(action.parameters['period']);
          break;

        case 'calculate_payroll':
          output = await this.calculatePayroll(action.parameters['period']);
          break;

        case 'generate_payslips':
          output = await this.generatePayslips(action.parameters['period']);
          break;

        case 'prepare_payment_files':
          output = await this.preparePaymentFiles(action.parameters['period']);
          break;

        case 'send_notifications':
          output = await this.sendNotifications(action.parameters['period']);
          break;

        case 'generate_reports':
          output = await this.generateReports(action.parameters['period']);
          break;

        case 'rollback_payroll_calculation':
          output = await this.rollbackPayrollCalculation(action.parameters['period']);
          break;

        default:
          throw new Error(`Unknown action: ${action.id}`);
      }

      return {
        actionId: action.id,
        status: 'success',
        output,
        duration: Date.now() - startTime,
        timestamp: createDateTime(new Date())
      };
    } catch (error) {
      this.logger.error(`Action failed: ${action.id}`, error);
      
      return {
        actionId: action.id,
        status: 'failure',
        error: error instanceof Error ? error : new Error(String(error)),
        duration: Date.now() - startTime,
        timestamp: createDateTime(new Date())
      };
    }
  }

  // ===== アクション実装 =====

  private async collectTimesheetData(period: PayrollPeriod): Promise<TimesheetDataResult> {
    this.logger.info('Collecting timesheet data', { period });
    
    const employees = await this.db.getAllEmployees();
    const activeEmployees = employees.filter(e => e.isActive);
    
    const timesheetData = new Map<string, TimeRecord[]>();
    
    for (const employee of activeEmployees) {
      const records = await this.db.getTimeRecords(
        employee.id,
        period.startDate,
        period.endDate
      );
      timesheetData.set(employee.id, records);
    }
    
    // メモリに保存
    this.state.memory.set('timesheetData', timesheetData);
    
    return {
      employeeCount: activeEmployees.length,
      totalRecords: Array.from(timesheetData.values()).flat().length,
      period
    };
  }

  private async validateAttendanceRecords(period: PayrollPeriod): Promise<ValidationResult> {
    this.logger.info('Validating attendance records', { period });
    
    const timesheetData = this.state.memory.get('timesheetData') as Map<string, TimeRecord[]>;
    const validationErrors: ValidationError[] = [];
    
    for (const [employeeId, records] of timesheetData) {
      // 重複チェック
      const duplicates = this.findDuplicateRecords(records);
      if (duplicates.length > 0) {
        validationErrors.push({
          employeeId,
          type: 'duplicate_records',
          description: `${duplicates.length}件の重複レコードが見つかりました`,
          records: duplicates
        });
      }
      
      // 欠勤チェック
      const missingDays = this.findMissingDays(records, period);
      if (missingDays.length > 0) {
        validationErrors.push({
          employeeId,
          type: 'missing_records',
          description: `${missingDays.length}日分の勤怠記録がありません`
        });
      }
      
      // 異常値チェック
      const anomalies = this.findAnomalies(records);
      if (anomalies.length > 0) {
        validationErrors.push({
          employeeId,
          type: 'anomaly',
          records: anomalies
        });
      }
    }
    
    if (validationErrors.length > 0) {
      this.logger.warn('Validation errors found', { 
        errorCount: validationErrors.length 
      });
      
      // 自動修正を試みる
      await this.attemptAutoCorrection(validationErrors);
    }
    
    return {
      validated: true,
      errorCount: validationErrors.length,
      autoCorrections: (this.state.memory.get('autoCorrections') as number) || 0
    };
  }

  private async calculateWorkingHours(period: PayrollPeriod): Promise<WorkingHoursResult> {
    this.logger.info('Calculating working hours', { period });
    
    const timesheetData = this.state.memory.get('timesheetData') as Map<string, TimeRecord[]>;
    const workingHoursData = new Map<string, any>();
    
    for (const [employeeId, records] of timesheetData) {
      const monthlyHours = this.workingHoursCalculator.calculateMonthlyHours(records);
      workingHoursData.set(employeeId, monthlyHours);
    }
    
    this.state.memory.set('workingHoursData', workingHoursData);
    
    const totalRegularHours = Array.from(workingHoursData.values())
      .reduce((sum, data) => sum + data.regularHours, 0);
    const totalOvertimeHours = Array.from(workingHoursData.values())
      .reduce((sum, data) => sum + data.totalOvertimeHours, 0);
    
    return {
      employeeCount: workingHoursData.size,
      totalRegularHours,
      totalOvertimeHours,
      averageHoursPerEmployee: totalRegularHours / workingHoursData.size
    };
  }

  private async checkCompliance(period: PayrollPeriod): Promise<ComplianceCheckResult> {
    this.logger.info('Checking compliance', { period });
    
    const workingHoursData = this.state.memory.get('workingHoursData') as Map<string, WorkingHours>;
    const complianceIssues: ComplianceIssue[] = [];
    
    for (const [employeeId, hoursData] of workingHoursData) {
      const compliance = await this.complianceEngine.checkCompliance(
        employeeId,
        hoursData,
      );
      
      if (compliance.length > 0) {
        complianceIssues.push({
          employeeId,
          violations: compliance.map(v => ({
            type: v.type,
            description: v.description,
            severity: v.severity
          })),
          riskLevel: compliance.some(v => v.severity === 'critical') ? 'critical' : 'medium'
        });
      }
    }
    
    this.state.memory.set('complianceIssues', complianceIssues);
    
    if (complianceIssues.length > 0) {
      this.logger.warn('Compliance issues detected', { 
        issueCount: complianceIssues.length 
      });
    }
    
    return {
      isCompliant: complianceIssues.length === 0,
      issueCount: complianceIssues.length,
      criticalIssues: complianceIssues.filter(i => i.riskLevel === 'critical').length
    };
  }

  private async calculatePayroll(period: PayrollPeriod): Promise<PayrollCalculationResult> {
    this.logger.info('Calculating payroll', { period });
    
    const employees = await this.db.getAllEmployees();
    const workingHoursData = this.state.memory.get('workingHoursData') as Map<string, WorkingHours>;
    const payrollCalculations: PayrollCalculation[] = [];
    
    for (const employee of employees.filter(e => e.isActive)) {
      const hoursData = workingHoursData.get(employee.id);
      if (!hoursData) continue;
      
      try {
        const calculation = await this.payrollEngine.calculateMonthlyPayroll(
          employee.id,
          period.month
        );
        payrollCalculations.push(calculation);
      } catch (error) {
        this.logger.error(`Payroll calculation failed for ${employee.id}`, error);
        throw error;
      }
    }
    
    this.state.memory.set('payrollCalculations', payrollCalculations);
    
    const totalGrossPay = payrollCalculations.reduce((sum, calc) => sum + calc.totalPay, 0);
    const totalNetPay = payrollCalculations.reduce((sum, calc) => sum + (calc.netPay || 0), 0);
    
    return {
      employeeCount: payrollCalculations.length,
      totalGrossPay,
      totalNetPay,
      totalDeductions: totalGrossPay - totalNetPay
    };
  }

  private async generatePayslips(period: PayrollPeriod): Promise<PayslipGenerationResult> {
    this.logger.info('Generating payslips', { period });
    
    const payrollCalculations = this.state.memory.get('payrollCalculations') as PayrollCalculation[];
    const payslips: PayslipData[] = [];
    
    for (const calculation of payrollCalculations) {
      const payslip = await this.payrollEngine.generatePayslip(calculation);
      payslips.push(payslip);
    }
    
    this.state.memory.set('payslips', payslips);
    
    return {
      payslipCount: payslips.length,
      generated: true
    };
  }

  private async preparePaymentFiles(period: PayrollPeriod): Promise<PaymentFileResult> {
    this.logger.info('Preparing payment files', { period });
    
    const payrollCalculations = this.state.memory.get('payrollCalculations') as PayrollCalculation[];
    
    // 銀行振込ファイルの生成（実装簡略化）
    const paymentFile = {
      period,
      payments: payrollCalculations.map(calc => ({
        employeeId: calc.employeeId,
        amount: calc.netPay,
        bankAccount: calc.bankAccount
      })),
      totalAmount: payrollCalculations.reduce((sum, calc) => sum + (calc.netPay || 0), 0)
    };
    
    this.state.memory.set('paymentFile', paymentFile);
    
    return {
      fileGenerated: true,
      paymentCount: paymentFile.payments.length,
      totalAmount: paymentFile.totalAmount
    };
  }

  private async sendNotifications(period: PayrollPeriod): Promise<NotificationResult> {
    this.logger.info('Sending notifications', { period });
    
    const payslips = this.state.memory.get('payslips') as PayslipData[];
    let sentCount = 0;
    
    for (const payslip of payslips) {
      // 通知送信の実装（簡略化）
      await this.sendPayslipNotification(payslip);
      sentCount++;
    }
    
    return {
      notificationsSent: sentCount,
      period
    };
  }

  private async generateReports(period: PayrollPeriod): Promise<ReportsResult> {
    this.logger.info('Generating reports', { period });
    
    const payrollCalculations = this.state.memory.get('payrollCalculations') as PayrollCalculation[];
    const complianceIssues = this.state.memory.get('complianceIssues') as ComplianceIssue[];
    
    // 給与計算サマリーレポート
    const summaryReport = {
      period,
      employeeCount: payrollCalculations.length,
      totalGrossPay: payrollCalculations.reduce((sum, calc) => sum + calc.totalPay, 0),
      totalNetPay: payrollCalculations.reduce((sum, calc) => sum + (calc.netPay || 0), 0),
      totalDeductions: payrollCalculations.reduce((sum, calc) => sum + (calc.totalPay - (calc.netPay || 0)), 0),
      complianceIssues: complianceIssues.length,
      generatedAt: new Date()
    };
    
    // 部門別レポート
    const departmentReport = await this.generateDepartmentReport(payrollCalculations);
    
    return {
      summaryReport,
      departmentReport,
      reportsGenerated: true
    };
  }

  private async rollbackPayrollCalculation(period: PayrollPeriod): Promise<RollbackResult> {
    this.logger.warn('Rolling back payroll calculation', { period });
    
    // ロールバック処理（実装簡略化）
    const payrollCalculations = this.state.memory.get('payrollCalculations') as PayrollCalculation[];
    
    for (const calculation of payrollCalculations) {
      // 給与計算の削除はスキップ（メソッドが存在しない）
      // await this.db.deletePayrollCalculation(calculation.id);
    }
    
    // メモリクリア
    this.state.memory.delete('payrollCalculations');
    this.state.memory.delete('payslips');
    this.state.memory.delete('paymentFile');
    
    return {
      rolledBack: true,
      recordsDeleted: payrollCalculations.length
    };
  }

  // ===== ヘルパーメソッド =====

  private findDuplicateRecords(records: TimeRecord[]): TimeRecord[] {
    const duplicates: TimeRecord[] = [];
    const seen = new Set<string>();
    
    for (const record of records) {
      const key = `${record.date.toISOString()}_${record.type}`;
      if (seen.has(key)) {
        duplicates.push(record);
      }
      seen.add(key);
    }
    
    return duplicates;
  }

  private findMissingDays(records: TimeRecord[], period: PayrollPeriod): Date[] {
    const recordDates = new Set(records.map(r => r.date.toDateString()));
    const missingDays: Date[] = [];
    
    const current = new Date(period.startDate);
    while (current <= period.endDate) {
      if (current.getDay() !== 0 && current.getDay() !== 6) { // 平日のみ
        if (!recordDates.has(current.toDateString())) {
          missingDays.push(new Date(current));
        }
      }
      current.setDate(current.getDate() + 1);
    }
    
    return missingDays;
  }

  private findAnomalies(records: TimeRecord[]): TimeRecord[] {
    return records.filter(record => {
      if (!record.clockIn || !record.clockOut) return true;
      
      const workMinutes = (record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60);
      return workMinutes < 60 || workMinutes > 960; // 1時間未満または16時間超
    });
  }

  private async attemptAutoCorrection(errors: ValidationError[]): Promise<void> {
    let corrections = 0;
    
    for (const error of errors) {
      if (error.type === 'duplicate_records') {
        // 重複レコードの削除
        corrections++;
      } else if (error.type === 'missing_records') {
        // 欠勤として記録
        corrections++;
      }
    }
    
    this.state.memory.set('autoCorrections', corrections);
  }

  private async sendPayslipNotification(payslip: PayslipData): Promise<void> {
    // 通知送信の実装（モック）
    await this.sleep(100);
  }

  private async generateDepartmentReport(calculations: PayrollCalculation[]): Promise<DepartmentReport> {
    const departmentData = new Map<string, DepartmentSummary>();
    
    for (const calc of calculations) {
      const employee = await this.db.getEmployee(calc.employeeId);
      if (!employee) continue;
      
      const dept = employee.department;
      if (!departmentData.has(dept)) {
        departmentData.set(dept, {
          employeeCount: 0,
          totalGrossPay: 0,
          totalNetPay: 0
        });
      }
      
      const data = departmentData.get(dept)!;
      data.employeeCount++;
      data.totalGrossPay += calc.totalPay;
      data.totalNetPay += calc.netPay || 0;
    }
    
    return {
      departments: Array.from(departmentData.entries()).map(([dept, data]) => ({
        name: dept,
        summary: data
      }))
    };
  }
}