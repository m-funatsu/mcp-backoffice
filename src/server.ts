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
import type { MCPToolName } from './types.js';

/**
 * MCP Server for Attendance Management System
 * Compliant with Japanese Labor Standards Act
 */

class AttendanceServer {
  private server: Server;
  public db: Database;
  private payrollCalculator: PayrollCalculator | null = null;
  private dataExporter: DataExporter;
  private leaveManagement: LeaveManagement;

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
    this.dataExporter = new DataExporter(this.db as any);
    this.leaveManagement = new LeaveManagement(this.db);
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