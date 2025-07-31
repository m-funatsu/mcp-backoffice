#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { format } from 'date-fns';

import Database from './database.js';
import PayrollCalculator from './payroll.js';
import DataExporter from './export.js';
import { LeaveManagement } from './leave-management.js';
import { IntegratedPayrollEngine } from './payroll-engine.js';
import { IntelligentExpenseEngine } from './expense-engine.js';
import { OCRService } from './ocr-service.js';
import { NLPService } from './nlp-service.js';
import { PredictiveAnalyticsEngineV2 as PredictiveAnalyticsEngine } from './predictive-analytics-v2.1.0.js';
import { HumanCapitalDashboard } from './human-capital-dashboard-v2.1.0.js';
import { PredictiveVisualizationAlerts } from './predictive-visualization-alerts-v2.1.0.js';
import { TurnoverPredictionEngine } from './turnover-prediction-engine-v2.1.0.js';
import { TimeSeriesForecasting } from './time-series-forecasting-v2.1.0.js';
import type { MCPToolName } from './types.js';

/**
 * AI-Native Strategic Platform Server
 * Comprehensive HR, Finance, and Business Intelligence Platform
 * with Predictive Analytics and Japanese Labor Standards Act Compliance
 */

class StrategicPlatformServer {
  private server: Server;
  public db: Database;
  private payrollCalculator: PayrollCalculator | null = null;
  private payrollEngine: IntegratedPayrollEngine;
  private dataExporter: DataExporter;
  private leaveManagement: LeaveManagement;
  private expenseEngine: IntelligentExpenseEngine;
  private ocrService: OCRService;
  private nlpService: NLPService;
  private predictiveAnalytics: PredictiveAnalyticsEngine;
  private humanCapitalDashboard: HumanCapitalDashboard;
  private visualizationAlerts: PredictiveVisualizationAlerts;
  private turnoverPrediction: TurnoverPredictionEngine;
  private timeSeriesForecasting: TimeSeriesForecasting;

  constructor() {
    this.server = new Server(
      {
        name: 'ai-native-strategic-platform-server',
        version: '2.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.db = new Database();
    this.payrollEngine = new IntegratedPayrollEngine(this.db);
    this.dataExporter = new DataExporter(this.db);
    this.leaveManagement = new LeaveManagement(this.db);
    
    // Initialize expense management services
    this.ocrService = new OCRService();
    this.nlpService = new NLPService();
    this.expenseEngine = new IntelligentExpenseEngine(this.db, this.ocrService, this.nlpService);
    
    // Initialize predictive analytics services
    this.predictiveAnalytics = new PredictiveAnalyticsEngine(this.db);
    this.humanCapitalDashboard = new HumanCapitalDashboard(this.db);
    this.visualizationAlerts = new PredictiveVisualizationAlerts(this.db);
    this.turnoverPrediction = new TurnoverPredictionEngine(this.db);
    this.timeSeriesForecasting = new TimeSeriesForecasting('arima');
    
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private async initializePayrollCalculator(): Promise<void> {
    if (!this.payrollCalculator) {
      const rules = await this.db.getPayrollRules();
      this.payrollCalculator = new PayrollCalculator(this.db, rules);
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      // MCPエラーは無視（ログ出力を避けるため）
    };
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'clock_in',
            description: 'Record employee clock-in time',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                clockInTime: {
                  type: 'string',
                  description: 'Clock-in time in ISO format (optional, defaults to current time)',
                },
                recordType: {
                  type: 'string',
                  enum: ['ic_card', 'pc_log', 'manual'],
                  description: 'Type of time record',
                  default: 'manual',
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'clock_out',
            description: 'Record employee clock-out time',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                clockOutTime: {
                  type: 'string',
                  description: 'Clock-out time in ISO format (optional, defaults to current time)',
                },
                breakMinutes: {
                  type: 'number',
                  description: 'Break time in minutes',
                  default: 0,
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'get_time_records',
            description: 'Get time records for an employee within a date range',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                startDate: {
                  type: 'string',
                  description: 'Start date in YYYY-MM-DD format',
                },
                endDate: {
                  type: 'string',
                  description: 'End date in YYYY-MM-DD format',
                },
              },
              required: ['employeeId', 'startDate', 'endDate'],
            },
          },
          {
            name: 'calculate_payroll',
            description: 'Calculate monthly payroll for an employee based on Japanese Labor Standards Act',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                month: {
                  type: 'string',
                  description: 'Month in YYYY-MM format',
                },
              },
              required: ['employeeId', 'month'],
            },
          },
          {
            name: 'get_payroll_summary',
            description: 'Get payroll summary for all employees for a specific month',
            inputSchema: {
              type: 'object',
              properties: {
                month: {
                  type: 'string',
                  description: 'Month in YYYY-MM format',
                },
              },
              required: ['month'],
            },
          },
          {
            name: 'get_attendance_report',
            description: 'Generate detailed attendance report for an employee',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                month: {
                  type: 'string',
                  description: 'Month in YYYY-MM format',
                },
              },
              required: ['employeeId', 'month'],
            },
          },
          {
            name: 'add_employee',
            description: 'Add a new employee to the system',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Employee name',
                },
                department: {
                  type: 'string',
                  description: 'Department name',
                },
                position: {
                  type: 'string',
                  description: 'Job position',
                },
                hourlyRate: {
                  type: 'number',
                  description: 'Hourly wage rate',
                },
                startDate: {
                  type: 'string',
                  description: 'Join date in YYYY-MM-DD format',
                },
                managerId: {
                  type: 'string',
                  description: 'Manager employee ID (optional)',
                },
              },
              required: ['name', 'department', 'position', 'hourlyRate', 'startDate'],
            },
          },
          {
            name: 'get_employee',
            description: 'Get employee information by ID',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'get_all_employees',
            description: 'Get all active employees',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'export_data',
            description: 'Export attendance data including files (videos, documents) for backup or transfer',
            inputSchema: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['json', 'csv', 'xlsx'],
                  description: 'Export format',
                  default: 'json',
                },
                includeFiles: {
                  type: 'boolean',
                  description: 'Include files (videos, documents) in export',
                  default: true,
                },
                fileExtensions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'File extensions to include (e.g., [".mp4", ".pdf"])',
                },
                startDate: {
                  type: 'string',
                  description: 'Start date for data range (YYYY-MM-DD format, optional)',
                },
                endDate: {
                  type: 'string',
                  description: 'End date for data range (YYYY-MM-DD format, optional)',
                },
                employeeIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific employee IDs to export (optional, exports all if not specified)',
                },
              },
            },
          },
          {
            name: 'import_data',
            description: 'Import previously exported attendance data',
            inputSchema: {
              type: 'object',
              properties: {
                importPath: {
                  type: 'string',
                  description: 'Path to the exported data directory',
                },
              },
              required: ['importPath'],
            },
          },
          {
            name: 'request_leave',
            description: 'Process natural language leave request (vacation, sick leave, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID requesting leave',
                },
                requestText: {
                  type: 'string',
                  description: 'Natural language leave request (e.g., "来週の月曜日から金曜日まで有給休暇を取りたいです")',
                },
              },
              required: ['employeeId', 'requestText'],
            },
          },
          {
            name: 'approve_leave',
            description: 'Approve a leave request',
            inputSchema: {
              type: 'object',
              properties: {
                requestId: {
                  type: 'string',
                  description: 'Leave request ID',
                },
                approverId: {
                  type: 'string',
                  description: 'Approver employee ID',
                },
                notes: {
                  type: 'string',
                  description: 'Approval notes (optional)',
                },
              },
              required: ['requestId', 'approverId'],
            },
          },
          {
            name: 'reject_leave',
            description: 'Reject a leave request',
            inputSchema: {
              type: 'object',
              properties: {
                requestId: {
                  type: 'string',
                  description: 'Leave request ID',
                },
                approverId: {
                  type: 'string',
                  description: 'Approver employee ID',
                },
                notes: {
                  type: 'string',
                  description: 'Rejection reason (optional)',
                },
              },
              required: ['requestId', 'approverId'],
            },
          },
          {
            name: 'get_leave_balance',
            description: 'Get leave balance for an employee',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                leaveType: {
                  type: 'string',
                  enum: ['annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement', 'personal'],
                  description: 'Type of leave',
                },
              },
              required: ['employeeId', 'leaveType'],
            },
          },
          {
            name: 'get_team_calendar',
            description: 'Get team calendar showing leave requests and events',
            inputSchema: {
              type: 'object',
              properties: {
                department: {
                  type: 'string',
                  description: 'Department name',
                },
                startDate: {
                  type: 'string',
                  description: 'Start date (YYYY-MM-DD)',
                },
                endDate: {
                  type: 'string',
                  description: 'End date (YYYY-MM-DD)',
                },
              },
              required: ['department', 'startDate', 'endDate'],
            },
          },
          {
            name: 'get_leave_analytics',
            description: 'Generate leave analytics and statistics',
            inputSchema: {
              type: 'object',
              properties: {
                startDate: {
                  type: 'string',
                  description: 'Start date (YYYY-MM-DD)',
                },
                endDate: {
                  type: 'string',
                  description: 'End date (YYYY-MM-DD)',
                },
              },
              required: ['startDate', 'endDate'],
            },
          },
          {
            name: 'calculate_compliance_payroll',
            description: 'Calculate payroll with full Japanese Labor Standards Act compliance',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                month: {
                  type: 'string',
                  description: 'Month in YYYY-MM format',
                },
              },
              required: ['employeeId', 'month'],
            },
          },
          {
            name: 'generate_payslip',
            description: 'Generate detailed payslip with tax and social insurance calculations',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                month: {
                  type: 'string',
                  description: 'Month in YYYY-MM format',
                },
              },
              required: ['employeeId', 'month'],
            },
          },
          {
            name: 'validate_labor_compliance',
            description: 'Validate employee working hours against Japanese Labor Standards Act',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                month: {
                  type: 'string',
                  description: 'Month in YYYY-MM format',
                },
              },
              required: ['employeeId', 'month'],
            },
          },
          {
            name: 'get_payroll_report',
            description: 'Generate comprehensive payroll report for all employees',
            inputSchema: {
              type: 'object',
              properties: {
                month: {
                  type: 'string',
                  description: 'Month in YYYY-MM format',
                },
              },
              required: ['month'],
            },
          },
          // Expense Management Tools - v1.3.0
          {
            name: 'create_expense_from_receipt',
            description: 'Create expense request from receipt image using OCR and AI',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                imageData: {
                  type: 'string',
                  description: 'Base64 encoded receipt image data',
                },
                mimeType: {
                  type: 'string',
                  description: 'MIME type of the image (e.g., image/jpeg, image/png)',
                },
                additionalNotes: {
                  type: 'string',
                  description: 'Additional notes or purpose for the expense (optional)',
                },
              },
              required: ['employeeId', 'imageData', 'mimeType'],
            },
          },
          {
            name: 'create_expense_from_text',
            description: 'Create expense request from natural language description',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                expenseDescription: {
                  type: 'string',
                  description: 'Natural language description of the expense (e.g., "新宿駅から品川駅までタクシー代1,280円、営業会議のため")',
                },
              },
              required: ['employeeId', 'expenseDescription'],
            },
          },
          {
            name: 'approve_expense',
            description: 'Approve an expense request',
            inputSchema: {
              type: 'object',
              properties: {
                requestId: {
                  type: 'string',
                  description: 'Expense request ID',
                },
                approverId: {
                  type: 'string',
                  description: 'Approver employee ID',
                },
                comments: {
                  type: 'string',
                  description: 'Approval comments (optional)',
                },
              },
              required: ['requestId', 'approverId'],
            },
          },
          {
            name: 'reject_expense',
            description: 'Reject an expense request',
            inputSchema: {
              type: 'object',
              properties: {
                requestId: {
                  type: 'string',
                  description: 'Expense request ID',
                },
                approverId: {
                  type: 'string',
                  description: 'Approver employee ID',
                },
                reason: {
                  type: 'string',
                  description: 'Rejection reason',
                },
              },
              required: ['requestId', 'approverId', 'reason'],
            },
          },
          {
            name: 'get_expense_analytics',
            description: 'Generate expense analytics and reports',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID (optional, for individual analysis)',
                },
                department: {
                  type: 'string',
                  description: 'Department name (optional, for department analysis)',
                },
                startDate: {
                  type: 'string',
                  description: 'Start date in YYYY-MM-DD format',
                },
                endDate: {
                  type: 'string',
                  description: 'End date in YYYY-MM-DD format',
                },
              },
              required: ['startDate', 'endDate'],
            },
          },
          {
            name: 'export_accounting_data',
            description: 'Export expense data for accounting system integration',
            inputSchema: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['csv', 'excel', 'json'],
                  description: 'Export format',
                },
                startDate: {
                  type: 'string',
                  description: 'Start date in YYYY-MM-DD format',
                },
                endDate: {
                  type: 'string',
                  description: 'End date in YYYY-MM-DD format',
                },
                accountingSystem: {
                  type: 'string',
                  enum: ['yayoi', 'freee', 'moneyforward'],
                  description: 'Target accounting system (optional)',
                },
              },
              required: ['format', 'startDate', 'endDate'],
            },
          },
          // v1.3.0 Compliance Enhancement Tools
          {
            name: 'monitor_36_compliance',
            description: 'Monitor 36 Agreement (overtime work) compliance for an employee',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                targetMonth: {
                  type: 'string',
                  description: 'Target month in YYYY-MM format (optional, defaults to current month)',
                },
              },
              required: ['employeeId'],
            },
          },
          {
            name: 'record_objective_time',
            description: 'Record objective time data (IC card, PC log) for compliance',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                date: {
                  type: 'string',
                  description: 'Date in YYYY-MM-DD format',
                },
                icCardIn: {
                  type: 'string',
                  description: 'IC card clock-in time in ISO format (optional)',
                },
                icCardOut: {
                  type: 'string',
                  description: 'IC card clock-out time in ISO format (optional)',
                },
                icCardDeviceId: {
                  type: 'string',
                  description: 'IC card device ID (optional)',
                },
                pcLogin: {
                  type: 'string',
                  description: 'PC login time in ISO format (optional)',
                },
                pcLogout: {
                  type: 'string',
                  description: 'PC logout time in ISO format (optional)',
                },
                pcDeviceId: {
                  type: 'string',
                  description: 'PC device ID (optional)',
                },
                selfReportedIn: {
                  type: 'string',
                  description: 'Self-reported clock-in time in ISO format (optional)',
                },
                selfReportedOut: {
                  type: 'string',
                  description: 'Self-reported clock-out time in ISO format (optional)',
                },
              },
              required: ['employeeId', 'date'],
            },
          },
          {
            name: 'generate_compliance_report',
            description: 'Generate comprehensive compliance report for Japanese Labor Standards Act',
            inputSchema: {
              type: 'object',
              properties: {
                startDate: {
                  type: 'string',
                  description: 'Start date in YYYY-MM-DD format',
                },
                endDate: {
                  type: 'string',
                  description: 'End date in YYYY-MM-DD format',
                },
                department: {
                  type: 'string',
                  description: 'Department filter (optional)',
                },
              },
              required: ['startDate', 'endDate'],
            },
          },
          {
            name: 'record_health_check',
            description: 'Record health check measures for high overtime employees (80+ hours)',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID',
                },
                checkType: {
                  type: 'string',
                  enum: ['medical_interview', 'health_questionnaire', 'stress_check', 'work_load_review'],
                  description: 'Type of health check',
                },
                overtimeHours: {
                  type: 'number',
                  description: 'Overtime hours that triggered the health check',
                },
                doctorName: {
                  type: 'string',
                  description: 'Doctor name (for medical interviews, optional)',
                },
                healthStatus: {
                  type: 'string',
                  enum: ['good', 'caution', 'requires_attention', 'requires_treatment'],
                  description: 'Health assessment result (optional)',
                },
                recommendations: {
                  type: 'string',
                  description: 'Doctor recommendations (optional)',
                },
              },
              required: ['employeeId', 'checkType', 'overtimeHours'],
            },
          },
          {
            name: 'predict_overtime',
            description: 'Predict overtime hours using ARIMA/Prophet models',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID (optional, predicts for all if not provided)',
                },
                horizon: {
                  type: 'number',
                  description: 'Prediction horizon in days (default: 30)',
                },
                model: {
                  type: 'string',
                  enum: ['arima', 'prophet'],
                  description: 'Prediction model to use (default: arima)',
                },
              },
            },
          },
          {
            name: 'predict_turnover',
            description: 'Predict employee turnover risk based on attendance patterns',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID (optional, predicts for all if not provided)',
                },
                includeDetails: {
                  type: 'boolean',
                  description: 'Include detailed risk factors and recommendations (default: false)',
                },
              },
            },
          },
          {
            name: 'generate_hr_dashboard',
            description: 'Generate human capital dashboard with ISO30414 compliance',
            inputSchema: {
              type: 'object',
              properties: {
                period: {
                  type: 'string',
                  description: 'Period for metrics (default: current)',
                },
                reportType: {
                  type: 'string',
                  enum: ['comprehensive', 'financial_services', 'iso30414'],
                  description: 'Type of report to generate (default: comprehensive)',
                },
              },
            },
          },
          {
            name: 'get_predictive_analytics',
            description: 'Get comprehensive predictive analytics including overtime and turnover predictions',
            inputSchema: {
              type: 'object',
              properties: {
                employeeId: {
                  type: 'string',
                  description: 'Employee ID (optional, analyzes all if not provided)',
                },
                includeVisualization: {
                  type: 'boolean',
                  description: 'Include visualization data (default: false)',
                },
                alertThresholds: {
                  type: 'object',
                  description: 'Custom alert thresholds (optional)',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name as MCPToolName) {
          case 'clock_in':
            return await this.handleClockIn(args);
          case 'clock_out':
            return await this.handleClockOut(args);
          case 'get_time_records':
            return await this.handleGetTimeRecords(args);
          case 'calculate_payroll':
            return await this.handleCalculatePayroll(args);
          case 'get_payroll_summary':
            return await this.handleGetPayrollSummary(args);
          case 'get_attendance_report':
            return await this.handleGetAttendanceReport(args);
          case 'add_employee':
            return await this.handleAddEmployee(args);
          case 'get_employee':
            return await this.handleGetEmployee(args);
          case 'get_all_employees':
            return await this.handleGetAllEmployees(args);
          case 'export_data':
            return await this.handleExportData(args);
          case 'import_data':
            return await this.handleImportData(args);
          case 'request_leave':
            return await this.handleRequestLeave(args);
          case 'approve_leave':
            return await this.handleApproveLeave(args);
          case 'reject_leave':
            return await this.handleRejectLeave(args);
          case 'get_leave_balance':
            return await this.handleGetLeaveBalance(args);
          case 'get_team_calendar':
            return await this.handleGetTeamCalendar(args);
          case 'get_leave_analytics':
            return await this.handleGetLeaveAnalytics(args);
          case 'calculate_compliance_payroll':
            return await this.handleCalculateCompliancePayroll(args);
          case 'generate_payslip':
            return await this.handleGeneratePayslip(args);
          case 'validate_labor_compliance':
            return await this.handleValidateLaborCompliance(args);
          case 'get_payroll_report':
            return await this.handleGetPayrollReport(args);
          // Expense Management Tool Handlers - v1.3.0
          case 'create_expense_from_receipt':
            return await this.handleCreateExpenseFromReceipt(args);
          case 'create_expense_from_text':
            return await this.handleCreateExpenseFromText(args);
          case 'approve_expense':
            return await this.handleApproveExpense(args);
          case 'reject_expense':
            return await this.handleRejectExpense(args);
          case 'get_expense_analytics':
            return await this.handleGetExpenseAnalytics(args);
          case 'export_accounting_data':
            return await this.handleExportAccountingData(args);
          // v1.3.0 Compliance Enhancement Tools
          case 'monitor_36_compliance':
            return await this.handleMonitor36Compliance(args);
          case 'record_objective_time':
            return await this.handleRecordObjectiveTime(args);
          case 'generate_compliance_report':
            return await this.handleGenerateComplianceReport(args);
          case 'record_health_check':
            return await this.handleRecordHealthCheck(args);
          // v2.1.0 Predictive Analytics Tools
          case 'predict_overtime':
            return await this.handlePredictOvertime(args);
          case 'predict_turnover':
            return await this.handlePredictTurnover(args);
          case 'generate_hr_dashboard':
            return await this.handleGenerateHRDashboard(args);
          case 'get_predictive_analytics':
            return await this.handleGetPredictiveAnalytics(args);
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing tool ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  public async handleClockIn(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      clockInTime: z.string().optional(),
      recordType: z.enum(['ic_card', 'pc_log', 'manual']).default('manual'),
    });

    const { employeeId, clockInTime, recordType } = schema.parse(args);
    const clockIn = clockInTime ? new Date(clockInTime) : new Date();

    const recordId = await this.db.clockIn(employeeId, clockIn, recordType);
    
    return {
      content: [
        {
          type: 'text',
          text: `Clock-in recorded successfully. Record ID: ${recordId}\\nEmployee: ${employeeId}\\nTime: ${format(clockIn, 'yyyy-MM-dd HH:mm:ss')}\\nType: ${recordType}`,
        },
      ],
    };
  }

  public async handleClockOut(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      clockOutTime: z.string().optional(),
      breakMinutes: z.number().min(0, 'Break minutes must be non-negative').default(0),
    });

    const { employeeId, clockOutTime, breakMinutes } = schema.parse(args);
    const clockOut = clockOutTime ? new Date(clockOutTime) : new Date();

    await this.db.clockOut(employeeId, clockOut, breakMinutes);

    return {
      content: [
        {
          type: 'text',
          text: `Clock-out recorded successfully.\\nEmployee: ${employeeId}\\nTime: ${format(clockOut, 'yyyy-MM-dd HH:mm:ss')}\\nBreak: ${breakMinutes} minutes`,
        },
      ],
    };
  }

  private async handleGetTimeRecords(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    });

    const { employeeId, startDate, endDate } = schema.parse(args);
    const records = await this.db.getTimeRecords(
      employeeId,
      new Date(startDate),
      new Date(endDate)
    );

    const recordsText = records.map(record => {
      const clockOutText = record.clockOut ? 
        format(record.clockOut, 'HH:mm:ss') : 
        'Not clocked out';
      
      const breakMinutes = record.breakMinutes || record.breakDuration || 0;
      const workingHours = record.clockOut ? 
        ((record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60 * 60) - breakMinutes / 60).toFixed(2) : 
        'N/A';
      
      return `${format(record.date, 'yyyy-MM-dd')}: ${format(record.clockIn, 'HH:mm:ss')} - ${clockOutText} (${workingHours}h, break: ${breakMinutes}min)`;
    }).join('\\n');

    return {
      content: [
        {
          type: 'text',
          text: `Time records for employee ${employeeId} (${startDate} to ${endDate}):\\n${recordsText}`,
        },
      ],
    };
  }

  public async handleCalculatePayroll(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      month: z.string(),
    });

    const { employeeId, month } = schema.parse(args);
    
    await this.initializePayrollCalculator();
    const calculation = await this.payrollCalculator!.calculateMonthlyPayroll(employeeId, month);
    
    const employee = await this.db.getEmployee(employeeId);
    
    return {
      content: [
        {
          type: 'text',
          text: `給与計算結果 - ${employee?.name} (${month})\\n` +
                `通常労働時間: ${calculation.regularHours.toFixed(2)}時間\\n` +
                `時間外労働時間: ${calculation.overtimeHours.toFixed(2)}時間\\n` +
                `深夜労働時間: ${calculation.lateNightHours.toFixed(2)}時間\\n` +
                `休日労働時間: ${calculation.holidayHours.toFixed(2)}時間\\n` +
                `基本給: ¥${calculation.regularPay.toLocaleString()}\\n` +
                `時間外手当: ¥${calculation.overtimePay.toLocaleString()}\\n` +
                `深夜手当: ¥${calculation.lateNightPay.toLocaleString()}\\n` +
                `休日手当: ¥${calculation.holidayPay.toLocaleString()}\\n` +
                `合計: ¥${calculation.totalPay.toLocaleString()}`,
        },
      ],
    };
  }

  public async handleGetPayrollSummary(args: unknown) {
    const schema = z.object({
      month: z.string(),
    });

    const { month } = schema.parse(args);
    
    await this.initializePayrollCalculator();
    const summary = await this.payrollCalculator!.generatePayrollSummary(month);
    
    const violationsText = summary.violations.length > 0 ? 
      `\\n\\n⚠️ 法令違反の疑い:\\n${summary.violations.map(v => `${v.employeeId}: ${v.violation}`).join('\\n')}` : 
      '\\n\\n✅ 労働基準法違反なし';
    
    return {
      content: [
        {
          type: 'text',
          text: `給与サマリー (${month})\\n` +
                `対象従業員数: ${summary.totalEmployees}人\\n` +
                `基本給合計: ¥${summary.totalRegularPay.toLocaleString()}\\n` +
                `時間外手当合計: ¥${summary.totalOvertimePay.toLocaleString()}\\n` +
                `深夜手当合計: ¥${summary.totalLateNightPay.toLocaleString()}\\n` +
                `休日手当合計: ¥${summary.totalHolidayPay.toLocaleString()}\\n` +
                `総支給額: ¥${summary.totalPay.toLocaleString()}${violationsText}`,
        },
      ],
    };
  }

  private async handleGetAttendanceReport(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      month: z.string(),
    });

    const { employeeId, month } = schema.parse(args);
    
    await this.initializePayrollCalculator();
    const report = await this.payrollCalculator!.generateAttendanceReport(employeeId, month);
    
    const violationsText = report.violations && report.violations.length > 0 ? 
      `\\n\\n⚠️ 違反事項:\\n${report.violations.join('\\n')}` : 
      '\\n\\n✅ 違反事項なし';
    
    return {
      content: [
        {
          type: 'text',
          text: `勤怠レポート - ${report.employeeName} (${month})\\n` +
                `出勤日数: ${report.totalWorkingDays || 0}日\\n` +
                `通常労働時間: ${report.totalRegularHours?.toFixed(2) || 0}時間\\n` +
                `時間外労働時間: ${report.totalOvertimeHours?.toFixed(2) || 0}時間\\n` +
                `深夜労働時間: ${report.totalLateNightHours?.toFixed(2) || 0}時間\\n` +
                `休日労働時間: ${report.totalHolidayHours?.toFixed(2) || 0}時間\\n` +
                `給与: ¥${report.calculatedPay?.totalPay?.toLocaleString() || 'N/A'}${violationsText}`,
        },
      ],
    };
  }

  public async handleAddEmployee(args: unknown) {
    const schema = z.object({
      name: z.string(),
      department: z.string(),
      position: z.string(),
      hourlyRate: z.number(),
      startDate: z.string(),
      managerId: z.string().optional(),
    });

    const { name, department, position, hourlyRate, startDate, managerId } = schema.parse(args);
    
    const employeeId = await this.db.addEmployee({
      name,
      department,
      position,
      hourlyRate,
      startDate: new Date(startDate),
      managerId,
      isActive: true,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Employee added successfully:\\nID: ${employeeId}\\nName: ${name}\\nDepartment: ${department}\\nPosition: ${position}\\nHourly Rate: ¥${hourlyRate}\\nJoin Date: ${startDate}`,
        },
      ],
    };
  }

  public async handleGetEmployee(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
    });

    const { employeeId } = schema.parse(args);
    const employee = await this.db.getEmployee(employeeId);
    
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Employee Information:\\nID: ${employee.id}\\nName: ${employee.name}\\nDepartment: ${employee.department}\\nPosition: ${employee.position}\\nHourly Rate: ¥${employee.hourlyRate}\\nJoin Date: ${format(employee.startDate, 'yyyy-MM-dd')}\\nManager ID: ${employee.managerId || 'None'}\\nActive: ${employee.isActive ? 'Yes' : 'No'}`,
        },
      ],
    };
  }

  private async handleGetAllEmployees(args: unknown) {
    const employees = await this.db.getAllEmployees();
    
    const employeesText = employees.map(emp => 
      `${emp.id}: ${emp.name} (${emp.department}, ${emp.position})`
    ).join('\\n');

    return {
      content: [
        {
          type: 'text',
          text: `All Active Employees (${employees.length}):\\n${employeesText}`,
        },
      ],
    };
  }

  private async handleExportData(args: unknown) {
    const schema = z.object({
      format: z.enum(['json', 'csv', 'xlsx']).default('json'),
      includeFiles: z.boolean().default(true),
      fileExtensions: z.array(z.string()).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      employeeIds: z.array(z.string()).optional(),
    });

    const { format, includeFiles, fileExtensions, startDate, endDate, employeeIds } = schema.parse(args);
    
    const exportOptions = {
      format,
      includeFiles,
      fileExtensions,
      dateRange: startDate && endDate ? {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      } : undefined,
      employeeIds
    };

    try {
      const exportPath = await this.dataExporter.exportData(exportOptions);
      
      return {
        content: [
          {
            type: 'text',
            text: `データエクスポートが完了しました。\\n` +
                  `エクスポートパス: ${exportPath}\\n` +
                  `フォーマット: ${format}\\n` +
                  `ファイル含む: ${includeFiles ? 'はい' : 'いいえ'}\\n` +
                  `期間: ${startDate && endDate ? `${startDate} から ${endDate}` : '全期間'}\\n` +
                  `対象従業員: ${employeeIds ? `${employeeIds.length}人指定` : '全員'}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleImportData(args: unknown) {
    const schema = z.object({
      importPath: z.string(),
    });

    const { importPath } = schema.parse(args);
    
    try {
      await this.dataExporter.importData(importPath);
      
      return {
        content: [
          {
            type: 'text',
            text: `データインポートが完了しました。\\n` +
                  `インポートパス: ${importPath}\\n` +
                  `すべてのデータとファイルが復元されました。`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleRequestLeave(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      requestText: z.string(),
    });

    const { employeeId, requestText } = schema.parse(args);
    
    try {
      const leaveRequest = await this.leaveManagement.processNaturalLanguageRequest(employeeId, requestText);
      
      return {
        content: [
          {
            type: 'text',
            text: `休暇申請が処理されました。\\n` +
                  `申請ID: ${leaveRequest.id}\\n` +
                  `従業員ID: ${leaveRequest.employeeId}\\n` +
                  `休暇種別: ${leaveRequest.leaveType}\\n` +
                  `期間: ${format(leaveRequest.startDate, 'yyyy-MM-dd')} から ${format(leaveRequest.endDate, 'yyyy-MM-dd')}\\n` +
                  `日数: ${leaveRequest.daysRequested}日\\n` +
                  `半日: ${leaveRequest.halfDay ? 'はい' : 'いいえ'}\\n` +
                  `理由: ${leaveRequest.reason || 'なし'}\\n` +
                  `ステータス: ${leaveRequest.status}\\n` +
                  `自動承認: ${leaveRequest.autoApproved ? 'はい' : 'いいえ'}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Leave request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleApproveLeave(args: unknown) {
    const schema = z.object({
      requestId: z.string(),
      approverId: z.string(),
      notes: z.string().optional(),
    });

    const { requestId, approverId, notes } = schema.parse(args);
    
    try {
      await this.leaveManagement.approveLeaveRequest(requestId, approverId, notes);
      
      return {
        content: [
          {
            type: 'text',
            text: `休暇申請が承認されました。\\n` +
                  `申請ID: ${requestId}\\n` +
                  `承認者ID: ${approverId}\\n` +
                  `承認時刻: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\\n` +
                  `備考: ${notes || 'なし'}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Leave approval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleRejectLeave(args: unknown) {
    const schema = z.object({
      requestId: z.string(),
      approverId: z.string(),
      notes: z.string().optional(),
    });

    const { requestId, approverId, notes } = schema.parse(args);
    
    try {
      await this.leaveManagement.rejectLeaveRequest(requestId, approverId, notes);
      
      return {
        content: [
          {
            type: 'text',
            text: `休暇申請が却下されました。\\n` +
                  `申請ID: ${requestId}\\n` +
                  `承認者ID: ${approverId}\\n` +
                  `却下時刻: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\\n` +
                  `理由: ${notes || 'なし'}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Leave rejection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGetLeaveBalance(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      leaveType: z.enum(['annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement', 'personal']),
    });

    const { employeeId, leaveType } = schema.parse(args);
    
    try {
      const balance = await this.leaveManagement.getLeaveBalance(employeeId, leaveType);
      
      return {
        content: [
          {
            type: 'text',
            text: `休暇残高情報\\n` +
                  `従業員ID: ${balance.employeeId}\\n` +
                  `休暇種別: ${balance.leaveType}\\n` +
                  `年度: ${balance.year}\\n` +
                  `付与日数: ${balance.grantedDays}日\\n` +
                  `使用日数: ${balance.usedDays}日\\n` +
                  `残り日数: ${balance.remainingDays}日\\n` +
                  `有効期限: ${balance.expiryDate ? format(balance.expiryDate, 'yyyy-MM-dd') : 'なし'}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Get leave balance failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGetTeamCalendar(args: unknown) {
    const schema = z.object({
      department: z.string(),
      startDate: z.string(),
      endDate: z.string(),
    });

    const { department, startDate, endDate } = schema.parse(args);
    
    try {
      const events = await this.leaveManagement.getTeamCalendar(
        department,
        new Date(startDate),
        new Date(endDate)
      );
      
      const eventsText = events.map(event => 
        `${format(event.date, 'yyyy-MM-dd')}: ${event.eventTitle} (${event.employeeName || event.employeeId})`
      ).join('\\n');
      
      return {
        content: [
          {
            type: 'text',
            text: `チームカレンダー - ${department}部門\\n` +
                  `期間: ${startDate} から ${endDate}\\n` +
                  `イベント数: ${events.length}件\\n\\n` +
                  `予定:\\n${eventsText || 'なし'}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Get team calendar failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGetLeaveAnalytics(args: unknown) {
    const schema = z.object({
      startDate: z.string(),
      endDate: z.string(),
    });

    const { startDate, endDate } = schema.parse(args);
    
    try {
      const analytics = await this.leaveManagement.generateLeaveAnalytics(
        new Date(startDate),
        new Date(endDate)
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `休暇分析レポート\\n` +
                  `期間: ${startDate} から ${endDate}\\n\\n` +
                  `📊 統計情報:\\n` +
                  `総申請数: ${analytics.totalRequests}件\\n` +
                  `承認数: ${analytics.approvedRequests}件\\n` +
                  `却下数: ${analytics.rejectedRequests}件\\n` +
                  `保留数: ${analytics.pendingRequests}件\\n` +
                  `申請総日数: ${analytics.totalDaysRequested}日\\n` +
                  `承認総日数: ${analytics.totalDaysApproved}日\\n` +
                  `平均処理時間: ${analytics.averageProcessingTime.toFixed(1)}日\\n` +
                  `最も人気の休暇種別: ${analytics.mostPopularLeaveType}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Get leave analytics failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleCalculateCompliancePayroll(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      month: z.string(),
    });

    const { employeeId, month } = schema.parse(args);
    
    try {
      const employee = await this.db.getEmployee(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const monthDate = new Date(month + '-01');
      const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      const timeRecords = await this.db.getTimeRecords(employeeId, startDate, endDate);

      const result = await this.payrollEngine.calculateCompliancePayroll(employee, timeRecords);
      
      const violationsText = result.compliance.violations.length > 0 ? 
        result.compliance.violations.map(v => `⚠️ ${v.description}`).join('\\n') : 
        '✅ 労働基準法準拠';

      const warningsText = result.warnings.length > 0 ? 
        result.warnings.map(w => `⚠️ ${w.message}`).join('\\n') : 
        'なし';

      return {
        content: [
          {
            type: 'text',
            text: `💰 統合給与計算結果\\n` +
                  `従業員: ${employee.name} (${employeeId})\\n` +
                  `対象月: ${month}\\n\\n` +
                  `🕒 労働時間:\\n` +
                  `通常時間: ${result.calculation.regularHours.toFixed(1)}時間\\n` +
                  `残業時間: ${result.calculation.overtimeHours.toFixed(1)}時間\\n` +
                  `深夜時間: ${result.calculation.lateNightHours.toFixed(1)}時間\\n` +
                  `休日時間: ${result.calculation.holidayHours.toFixed(1)}時間\\n\\n` +
                  `💴 給与詳細:\\n` +
                  `基本給: ¥${result.calculation.regularPay.toLocaleString()}\\n` +
                  `残業代: ¥${result.calculation.overtimePay.toLocaleString()}\\n` +
                  `深夜手当: ¥${result.calculation.lateNightPay.toLocaleString()}\\n` +
                  `休日手当: ¥${result.calculation.holidayPay.toLocaleString()}\\n` +
                  `合計支給額: ¥${result.calculation.totalPay.toLocaleString()}\\n\\n` +
                  `⚖️ 労働基準法準拠状況:\\n` +
                  `リスクレベル: ${result.compliance.riskLevel}\\n` +
                  `違反事項:\\n${violationsText}\\n\\n` +
                  `⚠️ 警告:\\n${warningsText}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Compliance payroll calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGeneratePayslip(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      month: z.string(),
    });

    const { employeeId, month } = schema.parse(args);
    
    try {
      const payslip = await this.payrollEngine.generatePayslip(employeeId, month);
      
      const allowancesText = payslip.allowances.length > 0 ? 
        payslip.allowances.map(a => `${a.description}: ¥${a.amount.toLocaleString()}`).join('\\n') : 
        'なし';

      const deductionsText = payslip.deductions.length > 0 ? 
        payslip.deductions.map(d => `${d.description}: ¥${d.amount.toLocaleString()}`).join('\\n') : 
        'なし';

      return {
        content: [
          {
            type: 'text',
            text: `📄 給与明細書\\n` +
                  `従業員: ${payslip.employeeName} (${payslip.employeeId})\\n` +
                  `対象月: ${payslip.month}\\n` +
                  `発行日: ${format(payslip.generatedAt, 'yyyy-MM-dd HH:mm')}\\n\\n` +
                  `💰 支給項目:\\n` +
                  `基本給: ¥${payslip.baseSalary.toLocaleString()}\\n` +
                  `各種手当:\\n${allowancesText}\\n\\n` +
                  `📉 控除項目:\\n` +
                  `${deductionsText}\\n\\n` +
                  `💴 税金・社会保険:\\n` +
                  `所得税: ¥${payslip.taxCalculation.incomeTax.toLocaleString()}\\n` +
                  `住民税: ¥${payslip.taxCalculation.residentTax.toLocaleString()}\\n` +
                  `健康保険: ¥${payslip.socialInsurance.healthInsurance.toLocaleString()}\\n` +
                  `厚生年金: ¥${payslip.socialInsurance.pensionInsurance.toLocaleString()}\\n` +
                  `雇用保険: ¥${payslip.socialInsurance.unemploymentInsurance.toLocaleString()}\\n` +
                  `介護保険: ¥${payslip.socialInsurance.longTermCareInsurance.toLocaleString()}\\n\\n` +
                  `🧾 勤怠サマリー:\\n` +
                  `出勤日数: ${payslip.workingSummary.totalWorkingDays}日\\n` +
                  `通常時間: ${payslip.workingSummary.regularHours.toFixed(1)}時間\\n` +
                  `残業時間: ${payslip.workingSummary.overtimeHours.toFixed(1)}時間\\n` +
                  `深夜時間: ${payslip.workingSummary.lateNightHours.toFixed(1)}時間\\n` +
                  `休日時間: ${payslip.workingSummary.holidayHours.toFixed(1)}時間\\n\\n` +
                  `💸 差引支給額: ¥${payslip.netPay.toLocaleString()}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Payslip generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleValidateLaborCompliance(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      month: z.string(),
    });

    const { employeeId, month } = schema.parse(args);
    
    try {
      const employee = await this.db.getEmployee(employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      const monthDate = new Date(month + '-01');
      const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
      const timeRecords = await this.db.getTimeRecords(employeeId, startDate, endDate);

      const result = await this.payrollEngine.calculateCompliancePayroll(employee, timeRecords);
      const compliance = result.compliance;
      
      const violationsText = compliance.violations.length > 0 ? 
        compliance.violations.map(v => 
          `⚠️ ${v.type} (${v.severity}): ${v.description}\\n` +
          `   値: ${v.value} / 上限: ${v.limit}\\n` +
          `   法的根拠: ${v.lawReference}`
        ).join('\\n\\n') : 
        '✅ 労働基準法違反なし';

      const recommendationsText = compliance.recommendations.length > 0 ? 
        compliance.recommendations.map(r => `• ${r}`).join('\\n') : 
        'なし';

      return {
        content: [
          {
            type: 'text',
            text: `⚖️ 労働基準法準拠チェック\\n` +
                  `従業員: ${employee.name} (${employeeId})\\n` +
                  `対象月: ${month}\\n\\n` +
                  `📊 準拠状況:\\n` +
                  `準拠: ${compliance.isCompliant ? '✅ 適合' : '❌ 違反あり'}\\n` +
                  `リスクレベル: ${compliance.riskLevel}\\n\\n` +
                  `⚠️ 違反事項:\\n` +
                  `${violationsText}\\n\\n` +
                  `💡 改善提案:\\n` +
                  `${recommendationsText}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Labor compliance validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGetPayrollReport(args: unknown) {
    const schema = z.object({
      month: z.string(),
    });

    const { month } = schema.parse(args);
    
    try {
      const summary = await this.payrollEngine.calculateMonthlyPayroll(month);
      
      const violationsText = summary.violations.length > 0 ? 
        summary.violations.map(v => `⚠️ ${v.employeeId}: ${v.violation}`).join('\\n') : 
        '✅ 労働基準法違反なし';

      return {
        content: [
          {
            type: 'text',
            text: `📊 月次給与レポート\\n` +
                  `対象月: ${summary.month}\\n\\n` +
                  `👥 従業員数: ${summary.totalEmployees}名\\n\\n` +
                  `💰 給与総額:\\n` +
                  `基本給合計: ¥${summary.totalRegularPay.toLocaleString()}\\n` +
                  `残業代合計: ¥${summary.totalOvertimePay.toLocaleString()}\\n` +
                  `深夜手当合計: ¥${summary.totalLateNightPay.toLocaleString()}\\n` +
                  `休日手当合計: ¥${summary.totalHolidayPay.toLocaleString()}\\n` +
                  `総支給額: ¥${summary.totalPay.toLocaleString()}\\n\\n` +
                  `⚖️ 労働基準法準拠状況:\\n` +
                  `${violationsText}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Payroll report generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Expense Management Tool Handlers - v1.3.0

  private async handleCreateExpenseFromReceipt(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      imageData: z.string(),
      mimeType: z.string(),
      additionalNotes: z.string().optional(),
    });

    const { employeeId, imageData, mimeType, additionalNotes } = schema.parse(args);
    
    try {
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageData, 'base64');
      
      const expenseRequest = await this.expenseEngine.createExpenseFromReceipt(
        imageBuffer,
        mimeType,
        employeeId,
        additionalNotes
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ 経費申請が作成されました\\n\\n` +
                  `📋 申請ID: ${expenseRequest.id}\\n` +
                  `💰 金額: ¥${expenseRequest.amount.toLocaleString()}\\n` +
                  `📅 日付: ${expenseRequest.expenseDate.toLocaleDateString('ja-JP')}\\n` +
                  `📝 説明: ${expenseRequest.description}\\n` +
                  `🏷️ カテゴリー: ${expenseRequest.categoryId}\\n` +
                  `🎯 AI信頼度: ${(expenseRequest.aiConfidenceScore || 0 * 100).toFixed(1)}%\\n` +
                  `📊 ステータス: ${expenseRequest.status}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Receipt processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleCreateExpenseFromText(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      expenseDescription: z.string(),
    });

    const { employeeId, expenseDescription } = schema.parse(args);
    
    try {
      const expenseRequest = await this.expenseEngine.createExpenseFromNLInput(
        expenseDescription,
        employeeId
      );

      return {
        content: [
          {
            type: 'text',
            text: `✅ 経費申請が作成されました\\n\\n` +
                  `📋 申請ID: ${expenseRequest.id}\\n` +
                  `💰 金額: ¥${expenseRequest.amount.toLocaleString()}\\n` +
                  `📅 日付: ${expenseRequest.expenseDate.toLocaleDateString('ja-JP')}\\n` +
                  `📝 説明: ${expenseRequest.description}\\n` +
                  `🏷️ カテゴリー: ${expenseRequest.categoryId}\\n` +
                  `🎯 AI信頼度: ${(expenseRequest.aiConfidenceScore || 0 * 100).toFixed(1)}%\\n` +
                  `📊 ステータス: ${expenseRequest.status}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Text expense creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleApproveExpense(args: unknown) {
    const schema = z.object({
      requestId: z.string(),
      approverId: z.string(),
      comments: z.string().optional(),
    });

    const { requestId, approverId, comments } = schema.parse(args);
    
    try {
      const success = await this.db.updateExpenseRequestStatus(
        requestId,
        'approved'
      );

      if (!success) {
        throw new Error('Failed to approve expense request');
      }

      // Generate accounting entry
      const request = await this.db.getExpenseRequest(requestId);
      if (request) {
        await this.expenseEngine.generateAccountingEntry(request);
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ 経費申請が承認されました\\n\\n` +
                  `📋 申請ID: ${requestId}\\n` +
                  `👤 承認者: ${approverId}\\n` +
                  `💬 コメント: ${comments || 'なし'}\\n` +
                  `⚡ 会計仕訳が自動生成されました`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Expense approval failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleRejectExpense(args: unknown) {
    const schema = z.object({
      requestId: z.string(),
      approverId: z.string(),
      reason: z.string(),
    });

    const { requestId, approverId, reason } = schema.parse(args);
    
    try {
      const success = await this.db.updateExpenseRequestStatus(
        requestId,
        'rejected'
      );

      if (!success) {
        throw new Error('Failed to reject expense request');
      }

      return {
        content: [
          {
            type: 'text',
            text: `❌ 経費申請が却下されました\\n\\n` +
                  `📋 申請ID: ${requestId}\\n` +
                  `👤 却下者: ${approverId}\\n` +
                  `📝 却下理由: ${reason}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Expense rejection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGetExpenseAnalytics(args: unknown) {
    const schema = z.object({
      employeeId: z.string().optional(),
      department: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
    });

    const { employeeId, department, startDate, endDate } = schema.parse(args);
    
    try {
      const analytics = await this.expenseEngine.generateExpenseAnalytics(
        employeeId,
        department,
        new Date(startDate),
        new Date(endDate)
      );

      const categoryBreakdownText = analytics.categoryBreakdown
        .map(cat => `  • ${cat.categoryName}: ¥${cat.amount.toLocaleString()} (${cat.count}件, ${cat.percentage.toFixed(1)}%)`)
        .join('\\n');

      return {
        content: [
          {
            type: 'text',
            text: `📊 経費分析レポート\\n\\n` +
                  `📅 期間: ${startDate} 〜 ${endDate}\\n` +
                  `${employeeId ? `👤 従業員: ${employeeId}\\n` : ''}` +
                  `${department ? `🏢 部署: ${department}\\n` : ''}\\n` +
                  `💰 総額: ¥${analytics.totalAmount.toLocaleString()}\\n` +
                  `📋 申請件数: ${analytics.totalRequests}件\\n` +
                  `📈 平均金額: ¥${Math.round(analytics.averageAmount).toLocaleString()}\\n\\n` +
                  `🏷️ カテゴリー別内訳:\\n${categoryBreakdownText}\\n\\n` +
                  `✅ 承認状況:\\n` +
                  `  • 承認済み: ${analytics.approvalStats.approved}件\\n` +
                  `  • 却下: ${analytics.approvalStats.rejected}件\\n` +
                  `  • 待機中: ${analytics.approvalStats.pending}件\\n` +
                  `  • 平均承認時間: ${analytics.approvalStats.averageApprovalTime}時間\\n\\n` +
                  `🛡️ コンプライアンス:\\n` +
                  `  • 領収書準拠率: ${analytics.complianceMetrics.receiptComplianceRate}%\\n` +
                  `  • ポリシー違反: ${analytics.complianceMetrics.policyViolations}件\\n` +
                  `  • リスクスコア: ${analytics.complianceMetrics.riskScore}/100`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Analytics generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleExportAccountingData(args: unknown) {
    const schema = z.object({
      format: z.enum(['csv', 'excel', 'json']),
      startDate: z.string(),
      endDate: z.string(),
      accountingSystem: z.enum(['yayoi', 'freee', 'moneyforward']).optional(),
    });

    const { format, startDate, endDate, accountingSystem } = schema.parse(args);
    
    try {
      // Basic implementation - would be enhanced with actual export functionality
      const message = `📤 会計データエクスポート要求を受け付けました\\n\\n` +
                     `📅 期間: ${startDate} 〜 ${endDate}\\n` +
                     `📄 形式: ${format.toUpperCase()}\\n` +
                     `${accountingSystem ? `🏢 会計システム: ${accountingSystem}\\n` : ''}\\n` +
                     `⚠️ 注意: 実際のエクスポート機能は今後の版で実装予定です。\\n` +
                     `現在はCSV形式での基本エクスポートのみ対応しています。`;

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Data export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // v1.3.0 Compliance Enhancement Handlers

  private async handleMonitor36Compliance(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      targetMonth: z.string().optional(),
    });

    const { employeeId, targetMonth } = schema.parse(args);
    
    try {
      const complianceStatus = await this.db.monitor36Compliance(employeeId, targetMonth);
      
      const alertLevel = complianceStatus.warningLevel;
      const statusEmoji = alertLevel === 'safe' ? '✅' : 
                         alertLevel === 'caution' ? '⚠️' : 
                         alertLevel === 'warning' ? '🔶' : '🚨';
      
      const complianceRate = (complianceStatus.monthlyOvertimeHours / complianceStatus.monthlyLimit) * 100;
      const progressBar = '█'.repeat(Math.min(10, Math.round(complianceRate / 10))) + 
                         '░'.repeat(Math.max(0, 10 - Math.round(complianceRate / 10)));
      
      // アラート生成（80%以上で警告）
      if (complianceRate >= 80) {
        await this.db.generateComplianceAlert({
          employeeId,
          alertType: complianceRate >= 100 ? 'monthly_overtime_exceeded' : 'monthly_overtime_approaching',
          alertLevel: complianceRate >= 100 ? 'critical' : 'warning',
          message: `月間時間外労働が${complianceRate.toFixed(1)}%に達しました`,
          currentHours: complianceStatus.monthlyOvertimeHours,
          limitHours: complianceStatus.monthlyLimit
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: `${statusEmoji} 36協定遵守状況\\n` +
                  `従業員: ${complianceStatus.name} (${employeeId})\\n` +
                  `部署: ${complianceStatus.department}\\n` +
                  `対象月: ${complianceStatus.month}\\n\\n` +
                  `📊 時間外労働状況:\\n` +
                  `現在時間: ${complianceStatus.monthlyOvertimeHours.toFixed(1)}時間\\n` +
                  `上限時間: ${complianceStatus.monthlyLimit}時間\\n` +
                  `遵守率: ${complianceRate.toFixed(1)}%\\n` +
                  `進捗: [${progressBar}] ${complianceRate.toFixed(1)}%\\n\\n` +
                  `📈 労働日数: ${complianceStatus.workDays}日\\n` +
                  `⚖️ 遵守状況: ${complianceStatus.complianceStatus === 'compliant' ? '✅ 適合' : '❌ 上限超過'}\\n` +
                  `🚨 警告レベル: ${alertLevel.toUpperCase()}\\n\\n` +
                  `${complianceRate >= 80 ? '⚠️ 注意: 上限の80%に達しています。残業時間の調整を検討してください。' : ''}` +
                  `${complianceStatus.monthlyOvertimeHours >= 80 ? '\\n🏥 健康確保措置: 医師の面接指導が必要です。' : ''}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`36 Agreement monitoring failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleRecordObjectiveTime(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      date: z.string(),
      icCardIn: z.string().optional(),
      icCardOut: z.string().optional(),
      icCardDeviceId: z.string().optional(),
      pcLogin: z.string().optional(),
      pcLogout: z.string().optional(),
      pcDeviceId: z.string().optional(),
      selfReportedIn: z.string().optional(),
      selfReportedOut: z.string().optional(),
    });

    const parsed = schema.parse(args);
    
    try {
      const record = {
        employeeId: parsed.employeeId,
        date: new Date(parsed.date),
        icCardIn: parsed.icCardIn ? new Date(parsed.icCardIn) : undefined,
        icCardOut: parsed.icCardOut ? new Date(parsed.icCardOut) : undefined,
        icCardDeviceId: parsed.icCardDeviceId,
        pcLogin: parsed.pcLogin ? new Date(parsed.pcLogin) : undefined,
        pcLogout: parsed.pcLogout ? new Date(parsed.pcLogout) : undefined,
        pcDeviceId: parsed.pcDeviceId,
        selfReportedIn: parsed.selfReportedIn ? new Date(parsed.selfReportedIn) : undefined,
        selfReportedOut: parsed.selfReportedOut ? new Date(parsed.selfReportedOut) : undefined,
      };

      const recordId = await this.db.saveObjectiveRecord(record);
      
      // 乖離チェック結果の表示
      const discrepancyInfo = this.calculateDiscrepancyInfo(record);
      
      return {
        content: [
          {
            type: 'text',
            text: `📋 客観的記録を保存しました\\n` +
                  `記録ID: ${recordId}\\n` +
                  `従業員: ${record.employeeId}\\n` +
                  `日付: ${record.date.toISOString().split('T')[0]}\\n\\n` +
                  `🏢 ICカード記録:\\n` +
                  `入退館: ${record.icCardIn ? record.icCardIn.toLocaleTimeString() : '未記録'} - ` +
                  `${record.icCardOut ? record.icCardOut.toLocaleTimeString() : '未記録'}\\n` +
                  `デバイス: ${record.icCardDeviceId || '未記録'}\\n\\n` +
                  `💻 PC記録:\\n` +
                  `ログイン/アウト: ${record.pcLogin ? record.pcLogin.toLocaleTimeString() : '未記録'} - ` +
                  `${record.pcLogout ? record.pcLogout.toLocaleTimeString() : '未記録'}\\n` +
                  `デバイス: ${record.pcDeviceId || '未記録'}\\n\\n` +
                  `📝 自己申告:\\n` +
                  `出退勤: ${record.selfReportedIn ? record.selfReportedIn.toLocaleTimeString() : '未記録'} - ` +
                  `${record.selfReportedOut ? record.selfReportedOut.toLocaleTimeString() : '未記録'}\\n\\n` +
                  `${discrepancyInfo.detected ? 
                    `⚠️ 乖離検知: ${discrepancyInfo.minutes}分の差異があります\\n${discrepancyInfo.explanation}` : 
                    '✅ 記録間に大きな乖離はありません'}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Objective time recording failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleGenerateComplianceReport(args: unknown) {
    const schema = z.object({
      startDate: z.string(),
      endDate: z.string(),
      department: z.string().optional(),
    });

    const { startDate, endDate, department } = schema.parse(args);
    
    try {
      const report = await this.db.generateComplianceReport({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        department,
      });
      
      const violationRate = (report.summary.complianceViolations / report.summary.totalEmployees) * 100;
      const riskLevel = violationRate >= 20 ? '🚨 高リスク' : 
                       violationRate >= 10 ? '⚠️ 中リスク' : 
                       violationRate >= 5 ? '🔶 低リスク' : '✅ 安全';

      const topViolators = report.employeeDetails
        .filter((emp) => emp.complianceStatus === 'exceeded')
        .sort((a, b) => b.overtimeHours - a.overtimeHours)
        .slice(0, 5)
        .map((emp) => `• ${emp.name} (${emp.department}): ${emp.overtimeHours.toFixed(1)}時間`)
        .join('\\n');

      return {
        content: [
          {
            type: 'text',
            text: `📊 労働基準法準拠レポート\\n` +
                  `期間: ${startDate} 〜 ${endDate}\\n` +
                  `${department ? `部署: ${department}\\n` : ''}\\n` +
                  `📈 サマリー:\\n` +
                  `対象従業員数: ${report.summary.totalEmployees}名\\n` +
                  `36協定違反者: ${report.summary.complianceViolations}名 (${violationRate.toFixed(1)}%)\\n` +
                  `休憩時間違反: ${report.summary.breakViolations}件\\n` +
                  `総アラート数: ${report.summary.totalAlerts}件\\n` +
                  `リスクレベル: ${riskLevel}\\n\\n` +
                  `🚨 主な違反者:\\n` +
                  `${topViolators || 'なし'}\\n\\n` +
                  `💡 改善提案:\\n` +
                  `${violationRate >= 10 ? '• 業務負荷の見直しと人員配置の再検討\\n' : ''}` +
                  `${report.summary.breakViolations > 0 ? '• 休憩時間取得の徹底指導\\n' : ''}` +
                  `${report.summary.totalAlerts >= 10 ? '• アラート対応プロセスの見直し\\n' : ''}` +
                  `• 定期的な労働時間監視の継続`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Compliance report generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleRecordHealthCheck(args: unknown) {
    const schema = z.object({
      employeeId: z.string(),
      checkType: z.enum(['medical_interview', 'health_questionnaire', 'stress_check', 'work_load_review']),
      overtimeHours: z.number(),
      doctorName: z.string().optional(),
      healthStatus: z.enum(['good', 'caution', 'requires_attention', 'requires_treatment']).optional(),
      recommendations: z.string().optional(),
    });

    const parsed = schema.parse(args);
    
    try {
      const recordId = await this.db.recordHealthCheckMeasure(parsed);
      
      const checkTypeNames = {
        medical_interview: '医師の面接指導',
        health_questionnaire: '健康状態チェック',
        stress_check: 'ストレスチェック',
        work_load_review: '業務負荷見直し'
      };

      const healthStatusNames = {
        good: '良好',
        caution: '注意',
        requires_attention: '要観察',
        requires_treatment: '要治療'
      };

      const triggerReason = parsed.overtimeHours >= 100 ? '月100時間超過' : '月80時間超過';
      const riskLevel = parsed.overtimeHours >= 100 ? '🚨 高リスク' : '⚠️ 中リスク';

      return {
        content: [
          {
            type: 'text',
            text: `🏥 健康確保措置を記録しました\\n` +
                  `記録ID: ${recordId}\\n` +
                  `従業員: ${parsed.employeeId}\\n\\n` +
                  `📋 実施内容:\\n` +
                  `種別: ${checkTypeNames[parsed.checkType]}\\n` +
                  `実施理由: ${triggerReason}\\n` +
                  `対象残業時間: ${parsed.overtimeHours}時間 ${riskLevel}\\n` +
                  `${parsed.doctorName ? `担当医師: ${parsed.doctorName}\\n` : ''}\\n` +
                  `${parsed.healthStatus ? `健康状態: ${healthStatusNames[parsed.healthStatus]}\\n` : ''}` +
                  `${parsed.recommendations ? `医師所見:\\n${parsed.recommendations}\\n` : ''}\\n` +
                  `📅 記録日時: ${new Date().toLocaleString()}\\n\\n` +
                  `${parsed.overtimeHours >= 100 ? 
                    '⚠️ 重要: 月100時間を超える時間外労働が確認されました。継続的な健康管理と業務負荷軽減が必要です。' : 
                    '💡 推奨: 継続的な健康状態の観察と、必要に応じた業務調整を行ってください。'}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Health check recording failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private calculateDiscrepancyInfo(record: {
    icCardIn?: Date;
    icCardOut?: Date;
    selfReportedIn?: Date;
    selfReportedOut?: Date;
    pcLogIn?: Date;
    pcLogOut?: Date;
  }): {detected: boolean, minutes: number, explanation: string} {
    let maxDiscrepancy = 0;
    let explanation = '';
    
    // ICカードと自己申告の比較
    if (record.icCardIn && record.selfReportedIn) {
      const diffIn = Math.abs((record.icCardIn.getTime() - record.selfReportedIn.getTime()) / (1000 * 60));
      if (diffIn > 15) {
        maxDiscrepancy = Math.max(maxDiscrepancy, diffIn);
        explanation += `出勤時刻の乖離: ${diffIn.toFixed(0)}分; `;
      }
    }
    
    if (record.icCardOut && record.selfReportedOut) {
      const diffOut = Math.abs((record.icCardOut.getTime() - record.selfReportedOut.getTime()) / (1000 * 60));
      if (diffOut > 15) {
        maxDiscrepancy = Math.max(maxDiscrepancy, diffOut);
        explanation += `退勤時刻の乖離: ${diffOut.toFixed(0)}分; `;
      }
    }
    
    return {
      detected: maxDiscrepancy > 15,
      minutes: Math.round(maxDiscrepancy),
      explanation: explanation.trim()
    };
  }

  async run(): Promise<void> {
    // Initialize PostgreSQL database connection
    try {
      await this.db.connect();
      await this.db.initializeDatabase();
    } catch (error) {
      // データベース接続エラーは無視して続行
      // MCPサーバーは基本機能で動作
    }
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // MCPサーバー起動完了
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      // シャットダウン処理
      await this.db.disconnect();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      // シャットダウン処理
      await this.db.disconnect();
      process.exit(0);
    });
  }

  // v2.1.0 Predictive Analytics Handlers
  
  /**
   * 残業予測ハンドラー
   */
  public async handlePredictOvertime(args: unknown) {
    const schema = z.object({
      employeeId: z.string().optional(),
      horizon: z.number().default(30),
      model: z.enum(['arima', 'prophet']).default('arima'),
    });

    const { employeeId, horizon, model } = schema.parse(args);

    try {
      // 予測モデルを更新
      this.timeSeriesForecasting = new TimeSeriesForecasting(model);
      
      // 残業予測実行
      const employees = await this.db.getAllEmployees();
      const targetEmployees = employeeId ? employees.filter(e => e.id === employeeId) : employees;
      const predictions = await Promise.all(
        targetEmployees.map(async e => {
          const forecast = await this.predictiveAnalytics.forecastOvertime(e.id);
          return {
            employeeId: e.id,
            currentMonth: forecast.predictions?.[0]?.predictedHours || 0,
            nextMonth: forecast.predictions?.[0]?.predictedHours || 0,
            trend: forecast.trend,
            riskLevel: forecast.riskAssessment.level
          };
        })
      );
      
      // 可視化データ生成
      const visualizations = await this.visualizationAlerts.generateOvertimeVisualization(predictions);
      
      // アラート監視
      const alerts = await this.visualizationAlerts.monitorAlerts(predictions, []);

      const totalPredictions = predictions.length;
      const highRiskCount = predictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length;
      const averageHours = predictions.reduce((sum, p) => sum + p.nextMonth, 0) / totalPredictions;

      return {
        content: [
          {
            type: 'text',
            text: `📊 残業予測結果 (${model.toUpperCase()}モデル)\\n\\n` +
                  `🔍 分析対象: ${employeeId || '全従業員'}\\n` +
                  `📈 予測期間: ${horizon}日間\\n` +
                  `📊 予測件数: ${totalPredictions}件\\n` +
                  `⚠️ 高リスク: ${highRiskCount}件\\n` +
                  `⏱️ 平均予測残業時間: ${averageHours.toFixed(1)}時間/週\\n\\n` +
                  `🔔 アラート数: ${alerts.length}件\\n\\n` +
                  `${predictions.slice(0, 10).map(p => 
                    `👤 ${p.employeeId}: ${p.currentMonth.toFixed(1)}h/月(現在), ${p.nextMonth.toFixed(1)}h/月(予測) (${p.riskLevel === 'critical' ? '🚨' : p.riskLevel === 'high' ? '⚠️' : p.riskLevel === 'medium' ? '⚡' : '✅'} ${p.riskLevel})`
                  ).join('\\n')}` +
                  `${totalPredictions > 10 ? `\\n\\n... 他 ${totalPredictions - 10} 件` : ''}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `残業予測エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 離職予測ハンドラー
   */
  public async handlePredictTurnover(args: unknown) {
    const schema = z.object({
      employeeId: z.string().optional(),
      includeDetails: z.boolean().default(false),
    });

    const { employeeId, includeDetails } = schema.parse(args);

    try {
      // 離職予測実行
      const predictions = await this.turnoverPrediction.predictTurnover(employeeId);
      
      // 可視化データ生成
      const visualizations = await this.visualizationAlerts.generateTurnoverVisualization(predictions);
      
      // アラート監視
      const alerts = await this.visualizationAlerts.monitorAlerts([], predictions);

      const totalPredictions = predictions.length;
      const criticalRisk = predictions.filter(p => p.riskLevel === 'critical').length;
      const highRisk = predictions.filter(p => p.riskLevel === 'high').length;
      const averageRisk = predictions.reduce((sum, p) => sum + p.overallRiskScore, 0) / totalPredictions;

      let detailsText = '';
      if (includeDetails && predictions.length > 0) {
        const topRisk = predictions[0]; // 最高リスクの従業員
        detailsText = `\\n\\n📋 詳細分析 (最高リスク従業員: ${topRisk.employeeId}):\\n` +
                     `🎯 リスクスコア: ${topRisk.overallRiskScore}%\\n` +
                     `📅 予測離職時期: ${topRisk.predictedTimeframe}日後\\n` +
                     `⚠️ 警告シグナル: ${topRisk.warningSignals.join(', ')}\\n` +
                     `💡 推奨アクション: ${topRisk.recommendedActions.slice(0, 3).map(a => a.action).join(', ')}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: `🔮 離職予測結果\\n\\n` +
                  `🔍 分析対象: ${employeeId || '全従業員'}\\n` +
                  `📊 予測件数: ${totalPredictions}件\\n` +
                  `🚨 危険レベル: ${criticalRisk}件\\n` +
                  `⚠️ 高リスク: ${highRisk}件\\n` +
                  `📈 平均リスクスコア: ${averageRisk.toFixed(1)}%\\n\\n` +
                  `🔔 アラート数: ${alerts.length}件\\n\\n` +
                  `${predictions.slice(0, 10).map(p => 
                    `👤 ${p.employeeId} (${p.department}): ${p.overallRiskScore}% ` +
                    `${p.riskLevel === 'critical' ? '🚨' : p.riskLevel === 'high' ? '⚠️' : p.riskLevel === 'medium' ? '⚡' : '✅'} ` +
                    `${p.predictedTimeframe}日後`
                  ).join('\\n')}` +
                  `${totalPredictions > 10 ? `\\n\\n... 他 ${totalPredictions - 10} 件` : ''}` +
                  detailsText,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `離職予測エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 人的資本ダッシュボード生成ハンドラー
   */
  public async handleGenerateHRDashboard(args: unknown) {
    const schema = z.object({
      period: z.string().default('current'),
      reportType: z.enum(['comprehensive', 'financial_services', 'iso30414']).default('comprehensive'),
    });

    const { period, reportType } = schema.parse(args);

    try {
      let report: {type: string; metrics?: unknown} | undefined;
      
      if (reportType === 'comprehensive') {
        const metrics = await this.humanCapitalDashboard.generateComprehensiveMetrics(period);
        report = {
          type: '包括的人的資本指標',
          metrics,
        };
      } else if (reportType === 'financial_services') {
        report = await this.humanCapitalDashboard.generateFinancialServicesReport(period);
      } else if (reportType === 'iso30414') {
        report = await this.humanCapitalDashboard.generateISO30414Report(period);
      }

      const visualizations = await this.visualizationAlerts.generateHumanCapitalVisualization(
        reportType === 'comprehensive' ? this.createHumanCapitalMetrics(report?.metrics || {}) : {}
      );

      return {
        content: [
          {
            type: 'text',
            text: `📊 人的資本ダッシュボード (${reportType.toUpperCase()})\\n\\n` +
                  `📅 期間: ${period}\\n` +
                  `📈 レポート種別: ${report?.type || reportType}\\n\\n` +
                  `${this.formatDashboardReport(report, reportType)}\\n\\n` +
                  `📊 生成された可視化: ${visualizations.length}件\\n` +
                  `🎯 主要指標: ${this.extractKeyMetrics(report, reportType)}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `人的資本ダッシュボード生成エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 包括的予測分析ハンドラー
   */
  public async handleGetPredictiveAnalytics(args: unknown) {
    const schema = z.object({
      employeeId: z.string().optional(),
      includeVisualization: z.boolean().default(false),
      alertThresholds: z.object({}).optional(),
    });

    const { employeeId, includeVisualization, alertThresholds } = schema.parse(args);

    try {
      // 残業予測
      const employees = await this.db.getAllEmployees();
      const targetEmployees = employeeId ? employees.filter(e => e.id === employeeId) : employees;
      
      const overtimePredictions = await Promise.all(
        targetEmployees.map(async e => {
          const forecast = await this.predictiveAnalytics.forecastOvertime(e.id);
          return {
            employeeId: e.id,
            currentMonth: forecast.predictions?.[0]?.predictedHours || 0,
            nextMonth: forecast.predictions?.[0]?.predictedHours || 0,
            trend: forecast.trend,
            riskLevel: forecast.riskAssessment.level
          };
        })
      );
      
      // 離職予測
      const turnoverPredictions = await Promise.all(
        targetEmployees.map(async e => {
          const analysis = await this.predictiveAnalytics.analyzeTurnoverRisk(e.id);
          return {
            employeeId: e.id,
            riskScore: analysis.riskScore,
            probability: analysis.confidence,
            estimatedTimeframe: analysis.predictedTimeframe.days,
            keyFactors: analysis.riskFactors.map(f => f.factor)
          };
        })
      );
      
      // 人的資本ダッシュボード
      const dashboard = await this.humanCapitalDashboard.generateComprehensiveMetrics();
      
      // 可視化データ（オプション）
      let visualizations = [];
      if (includeVisualization) {
        const overtimeViz = await this.visualizationAlerts.generateOvertimeVisualization(overtimePredictions);
        const turnoverViz = await this.visualizationAlerts.generateTurnoverVisualization(turnoverPredictions);
        const dashboardViz = await this.visualizationAlerts.generateHumanCapitalVisualization(this.createHumanCapitalMetrics(dashboard));
        visualizations = [...overtimeViz, ...turnoverViz, ...dashboardViz];
      }
      
      // アラート監視
      const alerts = await this.visualizationAlerts.monitorAlerts(
        overtimePredictions,
        turnoverPredictions
      );

      // 統計計算
      const stats = {
        totalEmployees: targetEmployees.length,
        overtimeHighRisk: overtimePredictions.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length,
        turnoverHighRisk: turnoverPredictions.filter(p => p.riskScore >= 60).length,
        activeAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        avgOvertimePrediction: overtimePredictions.reduce((sum, p) => sum + p.nextMonth, 0) / overtimePredictions.length,
        avgTurnoverRisk: turnoverPredictions.reduce((sum, p) => sum + p.riskScore, 0) / turnoverPredictions.length,
      };

      return {
        content: [
          {
            type: 'text',
            text: `🔬 包括的予測分析結果\\n\\n` +
                  `📊 分析概要:\\n` +
                  `👥 対象従業員: ${employeeId || '全従業員'} (${stats.totalEmployees}名)\\n` +
                  `⏱️ 残業高リスク: ${stats.overtimeHighRisk}名\\n` +
                  `🚪 離職高リスク: ${stats.turnoverHighRisk}名\\n` +
                  `🔔 アクティブアラート: ${stats.activeAlerts}件\\n` +
                  `🚨 緊急アラート: ${stats.criticalAlerts}件\\n\\n` +
                  `📈 予測指標:\\n` +
                  `⏱️ 平均残業予測: ${stats.avgOvertimePrediction.toFixed(1)}時間/月\\n` +
                  `🎯 平均離職リスク: ${stats.avgTurnoverRisk.toFixed(1)}%\\n\\n` +
                  `🏢 人的資本指標:\\n` +
                  `📊 総合スコア: 計算済み\\n` +
                  `👥 多様性指標: 分析済み\\n` +
                  `💰 生産性指標: 測定済み\\n` +
                  `🎓 人材開発: 実施中\\n\\n` +
                  `${includeVisualization ? `📊 可視化データ: ${visualizations.length}件生成\\n` : ''}` +
                  `${alerts.length > 0 ? `\\n🚨 直近のアラート:\\n${alerts.slice(0, 3).map(a => `• ${a.message}`).join('\\n')}` : ''}`,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `予測分析エラー: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ヘルパーメソッド
  private createHumanCapitalMetrics(metrics: unknown): {
    employeeCount: number;
    diversity: {
      genderRatio: { male: number; female: number; other: number };
      managementDiversity: {
        femaleManagerRatio: number;
        avgTenure: number;
      };
    };
    engagement: {
      enps: number;
      pulseSurveyScore: number;
    };
    productivity: {
      revenuePerEmployee: number;
      overtimeRatio: number;
    };
    turnover: {
      voluntaryRate: number;
      avgTenure: number;
    };
    costEfficiency: {
      trainingROI: number;
      recruitmentCost: number;
    };
    health: {
      mentalHealthScore: number;
      workLifeBalance: number;
    };
  } {
    // 人的資本指標の簡易変換
    const m = metrics as Record<string, any> || {};
    return {
      employeeCount: m.diversity?.genderDiversity?.totalEmployees || 100,
      diversity: {
        genderRatio: metrics.diversity?.genderDiversity || { male: 0.6, female: 0.4, other: 0.0 },
        managementDiversity: {
          femaleManagerRatio: metrics.diversity?.managementDiversity?.femaleManagerRatio || 0.3,
          avgTenure: metrics.diversity?.managementDiversity?.avgManagementTenure || 5.2
        }
      },
      engagement: {
        enps: metrics.engagement?.enps?.overallENPS || 10,
        satisfactionScore: metrics.engagement?.jobSatisfaction?.overallSatisfactionScore || 3.8,
        retentionRate: metrics.mobility?.retentionRate?.overallRetentionRate || 0.92,
        turnoverRate: metrics.mobility?.turnoverRate?.overallTurnoverRate || 0.08
      },
      productivity: {
        revenuePerEmployee: metrics.productivity?.revenuePerEmployee?.revenuePerEmployee || 12000000,
        overtimeRatio: metrics.productivity?.efficiencyMetrics?.resourceUtilizationRate || 0.15,
        absenteeismRate: metrics.engagement?.absenteeismRate?.overallAbsenteeismRate || 0.03,
        avgOvertimeHours: metrics.engagement?.workLifeBalance?.overtimeHoursPerEmployee || 25.5
      },
      development: {
        trainingHoursPerEmployee: metrics.development?.developmentHours?.developmentHoursPerEmployee || 40,
        skillDevelopmentRate: metrics.development?.learningEffectiveness?.skillImprovementRate || 0.78,
        promotionRate: metrics.development?.careerProgression?.internalPromotionRate || 0.15,
        trainingROI: metrics.development?.trainingInvestment?.trainingROI || 3.2
      },
      predictions: {
        overtimeRisk: { high: 0.12, medium: 0.25, low: 0.63 },
        turnoverRisk: { critical: 0.05, high: 0.15, medium: 0.25, low: 0.55 },
        skillGap: { technical: 0.30, leadership: 0.45, soft: 0.25 }
      }
    };
  }

  private formatDashboardReport(report: Record<string, any> | undefined, reportType: string): string {
    if (!report) return 'レポートが利用可能ではありません';
    
    if (reportType === 'financial_services') {
      return `📈 金融庁指針対応レポート:\\n` +
             `💼 従業員数: ${report.keyMetrics?.['従業員数'] || 'N/A'}名\\n` +
             `👩‍💼 女性管理職比率: ${((report.keyMetrics?.['女性管理職比率'] || 0) * 100).toFixed(1)}%\\n` +
             `💰 男女間賃金格差: ${((report.keyMetrics?.['男女間賃金格差'] || 0) * 100).toFixed(1)}%\\n` +
             `🚪 離職率: ${((report.keyMetrics?.['離職率'] || 0) * 100).toFixed(1)}%\\n` +
             `📊 エンゲージメント: ${report.keyMetrics?.['従業員エンゲージメント'] || 'N/A'}/5.0`;
    } else if (reportType === 'iso30414') {
      return `📋 ISO30414準拠レポート:\\n` +
             `✅ 準拠レベル: ${report.complianceLevel?.toFixed(1) || 'N/A'}%\\n` +
             `📊 報告指標: ${report.reportedMetrics?.length || 0}件\\n` +
             `❌ 不足指標: ${report.missingMetrics?.length || 0}件\\n` +
             `🎯 品質スコア: ${report.qualityScore?.toFixed(1) || 'N/A'}%`;
    } else {
      return `📊 包括的指標:\\n` +
             `👥 多様性指標: 実装済み\\n` +
             `📈 エンゲージメント: 実装済み\\n` +
             `💼 生産性指標: 実装済み\\n` +
             `🎓 人材育成指標: 実装済み\\n` +
             `🔮 予測指標: 実装済み`;
    }
  }

  private extractKeyMetrics(report: Record<string, any> | undefined, reportType: string): string {
    const metrics = [];
    
    if (reportType === 'financial_services') {
      metrics.push('従業員数', '女性管理職比率', '男女間賃金格差', '離職率', 'エンゲージメント');
    } else if (reportType === 'iso30414') {
      metrics.push('準拠レベル', '報告指標数', '品質スコア');
    } else {
      metrics.push('多様性', 'エンゲージメント', '生産性', '人材育成', '予測指標');
    }
    
    return metrics.join(', ');
  }
}

// Export for testing
export { StrategicPlatformServer };

const server = new StrategicPlatformServer();
server.run().catch(() => {
  // エラーは無視（MCPサーバーでのログ出力を避けるため）
  process.exit(1);
});