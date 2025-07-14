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
import type { MCPToolName } from './types.js';

/**
 * MCP Server for Attendance Management System
 * Compliant with Japanese Labor Standards Act
 */

class AttendanceServer {
  private server: Server;
  public db: Database;
  private payrollCalculator: PayrollCalculator | null = null;
  private payrollEngine: IntegratedPayrollEngine;
  private dataExporter: DataExporter;
  private leaveManagement: LeaveManagement;
  private expenseEngine: IntelligentExpenseEngine;
  private ocrService: OCRService;
  private nlpService: NLPService;

  constructor() {
    this.server = new Server(
      {
        name: 'attendance-management-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.db = new Database();
    this.payrollEngine = new IntegratedPayrollEngine(this.db);
    this.dataExporter = new DataExporter(this.db as any);
    this.leaveManagement = new LeaveManagement(this.db);
    
    // Initialize expense management services
    this.ocrService = new OCRService();
    this.nlpService = new NLPService();
    this.expenseEngine = new IntelligentExpenseEngine(this.db, this.ocrService, this.nlpService);
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private async initializePayrollCalculator(): Promise<void> {
    if (!this.payrollCalculator) {
      const rules = await this.db.getPayrollRules();
      this.payrollCalculator = new PayrollCalculator(this.db as any, rules);
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.db.close();
      process.exit(0);
    });
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
                joinDate: {
                  type: 'string',
                  description: 'Join date in YYYY-MM-DD format',
                },
                managerId: {
                  type: 'string',
                  description: 'Manager employee ID (optional)',
                },
              },
              required: ['name', 'department', 'position', 'hourlyRate', 'joinDate'],
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

  public async handleClockIn(args: any) {
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

  public async handleClockOut(args: any) {
    const schema = z.object({
      employeeId: z.string(),
      clockOutTime: z.string().optional(),
      breakMinutes: z.number().min(0, 'Break minutes must be non-negative').default(0),
    });

    const { employeeId, clockOutTime, breakMinutes } = schema.parse(args);
    const clockOut = clockOutTime ? new Date(clockOutTime) : new Date();

    const success = await this.db.clockOut(employeeId, clockOut, breakMinutes);
    
    if (!success) {
      throw new Error(`No open clock-in record found for employee ${employeeId} on ${format(clockOut, 'yyyy-MM-dd')}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Clock-out recorded successfully.\\nEmployee: ${employeeId}\\nTime: ${format(clockOut, 'yyyy-MM-dd HH:mm:ss')}\\nBreak: ${breakMinutes} minutes`,
        },
      ],
    };
  }

  private async handleGetTimeRecords(args: any) {
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
      
      const workingHours = record.clockOut ? 
        ((record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60 * 60) - record.breakMinutes / 60).toFixed(2) : 
        'N/A';
      
      return `${format(record.date, 'yyyy-MM-dd')}: ${format(record.clockIn, 'HH:mm:ss')} - ${clockOutText} (${workingHours}h, break: ${record.breakMinutes}min)`;
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

  public async handleCalculatePayroll(args: any) {
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

  public async handleGetPayrollSummary(args: any) {
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

  private async handleGetAttendanceReport(args: any) {
    const schema = z.object({
      employeeId: z.string(),
      month: z.string(),
    });

    const { employeeId, month } = schema.parse(args);
    
    await this.initializePayrollCalculator();
    const report = await this.payrollCalculator!.generateAttendanceReport(employeeId, month);
    
    const violationsText = report.violations.length > 0 ? 
      `\\n\\n⚠️ 違反事項:\\n${report.violations.join('\\n')}` : 
      '\\n\\n✅ 違反事項なし';
    
    return {
      content: [
        {
          type: 'text',
          text: `勤怠レポート - ${report.employeeName} (${month})\\n` +
                `出勤日数: ${report.totalWorkingDays}日\\n` +
                `通常労働時間: ${report.totalRegularHours.toFixed(2)}時間\\n` +
                `時間外労働時間: ${report.totalOvertimeHours.toFixed(2)}時間\\n` +
                `深夜労働時間: ${report.totalLateNightHours.toFixed(2)}時間\\n` +
                `休日労働時間: ${report.totalHolidayHours.toFixed(2)}時間\\n` +
                `給与: ¥${report.calculatedPay.totalPay.toLocaleString()}${violationsText}`,
        },
      ],
    };
  }

  public async handleAddEmployee(args: any) {
    const schema = z.object({
      name: z.string(),
      department: z.string(),
      position: z.string(),
      hourlyRate: z.number(),
      joinDate: z.string(),
      managerId: z.string().optional(),
    });

    const { name, department, position, hourlyRate, joinDate, managerId } = schema.parse(args);
    
    const employeeId = await this.db.addEmployee({
      name,
      department,
      position,
      hourlyRate,
      joinDate: new Date(joinDate),
      managerId,
      isActive: true,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Employee added successfully:\\nID: ${employeeId}\\nName: ${name}\\nDepartment: ${department}\\nPosition: ${position}\\nHourly Rate: ¥${hourlyRate}\\nJoin Date: ${joinDate}`,
        },
      ],
    };
  }

  public async handleGetEmployee(args: any) {
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
          text: `Employee Information:\\nID: ${employee.id}\\nName: ${employee.name}\\nDepartment: ${employee.department}\\nPosition: ${employee.position}\\nHourly Rate: ¥${employee.hourlyRate}\\nJoin Date: ${format(employee.joinDate, 'yyyy-MM-dd')}\\nManager ID: ${employee.managerId || 'None'}\\nActive: ${employee.isActive ? 'Yes' : 'No'}`,
        },
      ],
    };
  }

  private async handleGetAllEmployees(args: any) {
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

  private async handleExportData(args: any) {
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

  private async handleImportData(args: any) {
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

  private async handleRequestLeave(args: any) {
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

  private async handleApproveLeave(args: any) {
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

  private async handleRejectLeave(args: any) {
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

  private async handleGetLeaveBalance(args: any) {
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

  private async handleGetTeamCalendar(args: any) {
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

  private async handleGetLeaveAnalytics(args: any) {
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

  private async handleCalculateCompliancePayroll(args: any) {
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

  private async handleGeneratePayslip(args: any) {
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

  private async handleValidateLaborCompliance(args: any) {
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

  private async handleGetPayrollReport(args: any) {
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

  private async handleCreateExpenseFromReceipt(args: any) {
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

  private async handleCreateExpenseFromText(args: any) {
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

  private async handleApproveExpense(args: any) {
    const schema = z.object({
      requestId: z.string(),
      approverId: z.string(),
      comments: z.string().optional(),
    });

    const { requestId, approverId, comments } = schema.parse(args);
    
    try {
      const success = await this.db.updateExpenseRequestStatus(
        requestId,
        'approved',
        approverId
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

  private async handleRejectExpense(args: any) {
    const schema = z.object({
      requestId: z.string(),
      approverId: z.string(),
      reason: z.string(),
    });

    const { requestId, approverId, reason } = schema.parse(args);
    
    try {
      const success = await this.db.updateExpenseRequestStatus(
        requestId,
        'rejected',
        undefined,
        reason
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

  private async handleGetExpenseAnalytics(args: any) {
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

  private async handleExportAccountingData(args: any) {
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

  async run(): Promise<void> {
    // Initialize database (SQLite doesn't need explicit connection)
    try {
      await this.db.initializeDatabase();
    } catch (error) {
      // Database might already be initialized, continue
      console.error('Database initialization note:', (error as Error).message);
    }
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Attendance Management MCP server running on stdio');
  }
}

// Export for testing
export { AttendanceServer };

const server = new AttendanceServer();
server.run().catch(console.error);