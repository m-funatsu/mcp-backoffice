#!/usr/bin/env node

import * as readline from 'readline';
import DatabasePostgreSQL from './database_postgresql.js';
import PayrollCalculator from './payroll.js';
import DataExporter from './export.js';
import { format } from 'date-fns';

/**
 * Command Line Interface for Attendance Management System
 */

class AttendanceCLI {
  private db: DatabasePostgreSQL;
  private payrollCalculator: PayrollCalculator | null = null;
  private dataExporter: DataExporter;
  private rl: readline.Interface;

  constructor() {
    this.db = new DatabasePostgreSQL();
    this.dataExporter = new DataExporter(this.db);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private async initializePayrollCalculator(): Promise<void> {
    if (!this.payrollCalculator) {
      const rules = await this.db.getPayrollRules();
      this.payrollCalculator = new PayrollCalculator(this.db, rules);
    }
  }

  private async processCommand(command: string): Promise<string> {
    const parts = command.trim().split(' ');
    const action = parts[0]?.toLowerCase();

    try {
      switch (action) {
        case 'help':
          return this.getHelpMessage();
        
        case 'add-employee':
          return await this.addEmployee(parts.slice(1));
        
        case 'list-employees':
          return await this.listEmployees();
        
        case 'employee':
          return await this.getEmployee(parts[1]);
        
        case 'clock-in':
          return await this.clockIn(parts[1]);
        
        case 'clock-out':
          return await this.clockOut(parts[1], parts[2]);
        
        case 'time-records':
          return await this.getTimeRecords(parts[1], parts[2], parts[3]);
        
        case 'payroll':
          return await this.calculatePayroll(parts[1], parts[2]);
        
        case 'payroll-summary':
          return await this.getPayrollSummary(parts[1]);
        
        case 'attendance-report':
          return await this.getAttendanceReport(parts[1], parts[2]);
        
        case 'export':
          return await this.exportData(parts.slice(1));
        
        case 'import':
          return await this.importData(parts[1]);
        
        case 'exit':
          this.rl.close();
          await this.db.close();
          process.exit(0);
        
        default:
          return `❓ Unknown command: ${action}. Type 'help' for available commands.`;
      }
    } catch (error) {
      return `❌ Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async addEmployee(args: string[]): Promise<string> {
    if (args.length < 5) {
      return `❌ Usage: add-employee <name> <department> <position> <hourlyRate> <startDate>
Example: add-employee "田中太郎" "開発部" "エンジニア" 3000 2024-01-15`;
    }

    const [name, department, position, hourlyRateStr, startDate] = args;
    const hourlyRate = parseFloat(hourlyRateStr);

    if (isNaN(hourlyRate)) {
      return `❌ Invalid hourly rate: ${hourlyRateStr}`;
    }

    const employeeId = await this.db.addEmployee({
      name,
      department,
      position,
      hourlyRate,
      startDate: new Date(startDate),
      isActive: true,
    });

    return `✅ Employee added successfully:
ID: ${employeeId}
Name: ${name}
Department: ${department}
Position: ${position}
Hourly Rate: ¥${hourlyRate}
Join Date: ${startDate}`;
  }

  private async listEmployees(): Promise<string> {
    const employees = await this.db.getAllEmployees();
    if (employees.length === 0) {
      return `ℹ️ No employees found.`;
    }

    const employeeList = employees.map(emp => 
      `${emp.id}: ${emp.name} (${emp.department}, ${emp.position})`
    ).join('\n');

    return `👥 All Active Employees (${employees.length}):
${employeeList}`;
  }

  private async getEmployee(employeeId: string): Promise<string> {
    if (!employeeId) {
      return `❌ Usage: employee <employeeId>`;
    }

    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      return `❌ Employee not found: ${employeeId}`;
    }

    return `👤 Employee Information:
ID: ${employee.id}
Name: ${employee.name}
Department: ${employee.department}
Position: ${employee.position}
Hourly Rate: ¥${employee.hourlyRate}
Join Date: ${format(employee.startDate, 'yyyy-MM-dd')}
Manager ID: ${employee.managerId || 'None'}
Active: ${employee.isActive ? 'Yes' : 'No'}`;
  }

  private async clockIn(employeeId: string): Promise<string> {
    if (!employeeId) {
      return `❌ Usage: clock-in <employeeId>`;
    }

    const clockInTime = new Date();
    const recordId = await this.db.clockIn(employeeId, clockInTime, 'manual');
    
    return `✅ Clock-in recorded successfully:
Record ID: ${recordId}
Employee: ${employeeId}
Time: ${format(clockInTime, 'yyyy-MM-dd HH:mm:ss')}`;
  }

  private async clockOut(employeeId: string, breakMinutesStr?: string): Promise<string> {
    if (!employeeId) {
      return `❌ Usage: clock-out <employeeId> [breakMinutes]`;
    }

    const clockOutTime = new Date();
    const breakMinutes = breakMinutesStr ? parseInt(breakMinutesStr) : 0;

    if (isNaN(breakMinutes)) {
      return `❌ Invalid break minutes: ${breakMinutesStr}`;
    }

    const success = await this.db.clockOut(employeeId, clockOutTime, breakMinutes);
    
    if (!success) {
      return `❌ No open clock-in record found for employee ${employeeId} on ${format(clockOutTime, 'yyyy-MM-dd')}`;
    }

    return `✅ Clock-out recorded successfully:
Employee: ${employeeId}
Time: ${format(clockOutTime, 'yyyy-MM-dd HH:mm:ss')}
Break: ${breakMinutes} minutes`;
  }

  private async getTimeRecords(employeeId: string, startDate: string, endDate: string): Promise<string> {
    if (!employeeId || !startDate || !endDate) {
      return `❌ Usage: time-records <employeeId> <startDate> <endDate>
Example: time-records EMP_123 2024-01-01 2024-01-31`;
    }

    const records = await this.db.getTimeRecords(
      employeeId,
      new Date(startDate),
      new Date(endDate)
    );

    if (records.length === 0) {
      return `ℹ️ No time records found for employee ${employeeId} from ${startDate} to ${endDate}`;
    }

    const recordsText = records.map(record => {
      const clockOutText = record.clockOut ? 
        format(record.clockOut, 'HH:mm:ss') : 
        'Not clocked out';
      
      const breakMinutes = record.breakMinutes || record.breakDuration || 0;
      const workingHours = record.clockOut ? 
        ((record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60 * 60) - breakMinutes / 60).toFixed(2) : 
        'N/A';
      
      return `${format(record.date, 'yyyy-MM-dd')}: ${format(record.clockIn, 'HH:mm:ss')} - ${clockOutText} (${workingHours}h, break: ${breakMinutes}min)`;
    }).join('\n');

    return `📋 Time records for employee ${employeeId} (${startDate} to ${endDate}):
${recordsText}`;
  }

  private async calculatePayroll(employeeId: string, month: string): Promise<string> {
    if (!employeeId || !month) {
      return `❌ Usage: payroll <employeeId> <month>
Example: payroll EMP_123 2024-01`;
    }

    await this.initializePayrollCalculator();
    const calculation = await this.payrollCalculator!.calculateMonthlyPayroll(employeeId, month);
    
    const employee = await this.db.getEmployee(employeeId);
    
    return `💰 給与計算結果 - ${employee?.name} (${month})
通常労働時間: ${calculation.regularHours.toFixed(2)}時間
時間外労働時間: ${calculation.overtimeHours.toFixed(2)}時間
深夜労働時間: ${calculation.lateNightHours.toFixed(2)}時間
休日労働時間: ${calculation.holidayHours.toFixed(2)}時間
基本給: ¥${calculation.regularPay.toLocaleString()}
時間外手当: ¥${calculation.overtimePay.toLocaleString()}
深夜手当: ¥${calculation.lateNightPay.toLocaleString()}
休日手当: ¥${calculation.holidayPay.toLocaleString()}
合計: ¥${calculation.totalPay.toLocaleString()}`;
  }

  private async getPayrollSummary(month: string): Promise<string> {
    if (!month) {
      return `❌ Usage: payroll-summary <month>
Example: payroll-summary 2024-01`;
    }

    await this.initializePayrollCalculator();
    const summary = await this.payrollCalculator!.generatePayrollSummary(month);
    
    const violationsText = summary.violations.length > 0 ? 
      `\n\n⚠️ 法令違反の疑い:\n${summary.violations.map(v => `${v.employeeId}: ${v.violation}`).join('\n')}` : 
      '\n\n✅ 労働基準法違反なし';
    
    return `💰 給与サマリー (${month})
対象従業員数: ${summary.totalEmployees}人
基本給合計: ¥${summary.totalRegularPay.toLocaleString()}
時間外手当合計: ¥${summary.totalOvertimePay.toLocaleString()}
深夜手当合計: ¥${summary.totalLateNightPay.toLocaleString()}
休日手当合計: ¥${summary.totalHolidayPay.toLocaleString()}
総支給額: ¥${summary.totalPay.toLocaleString()}${violationsText}`;
  }

  private async getAttendanceReport(employeeId: string, month: string): Promise<string> {
    if (!employeeId || !month) {
      return `❌ Usage: attendance-report <employeeId> <month>
Example: attendance-report EMP_123 2024-01`;
    }

    await this.initializePayrollCalculator();
    const report = await this.payrollCalculator!.generateAttendanceReport(employeeId, month);
    
    const violationsText = report.violations && report.violations.length > 0 ? 
      `\n\n⚠️ 違反事項:\n${report.violations.join('\n')}` : 
      '\n\n✅ 違反事項なし';
    
    return `📊 勤怠レポート - ${report.employeeName} (${month})
出勤日数: ${report.totalWorkingDays}日
通常労働時間: ${report.totalRegularHours?.toFixed(2) || 0}時間
時間外労働時間: ${report.totalOvertimeHours?.toFixed(2) || 0}時間
深夜労働時間: ${report.totalLateNightHours?.toFixed(2) || 0}時間
休日労働時間: ${report.totalHolidayHours?.toFixed(2) || 0}時間
給与: ¥${report.calculatedPay?.totalPay?.toLocaleString() || 0}${violationsText}`;
  }

  private async exportData(args: string[]): Promise<string> {
    try {
      // Parse arguments for export options
      const format = args.find(arg => ['json', 'csv', 'xlsx'].includes(arg)) || 'json';
      const includeFiles = !args.includes('--no-files');
      
      // Parse date range if provided
      let dateRange;
      const startDateIndex = args.findIndex(arg => arg === '--start-date');
      const endDateIndex = args.findIndex(arg => arg === '--end-date');
      
      if (startDateIndex !== -1 && endDateIndex !== -1 && args[startDateIndex + 1] && args[endDateIndex + 1]) {
        dateRange = {
          startDate: new Date(args[startDateIndex + 1]),
          endDate: new Date(args[endDateIndex + 1])
        };
      }
      
      // Parse employee IDs if provided
      let employeeIds;
      const employeeIndex = args.findIndex(arg => arg === '--employees');
      if (employeeIndex !== -1 && args[employeeIndex + 1]) {
        employeeIds = args[employeeIndex + 1].split(',');
      }

      const exportOptions = {
        format: format as 'json' | 'csv' | 'xlsx',
        includeFiles,
        fileExtensions: ['.mp4', '.avi', '.mov', '.mkv', '.pdf', '.doc', '.docx', '.jpg', '.png'],
        dateRange,
        employeeIds
      };

      const exportPath = await this.dataExporter.exportData(exportOptions);
      
      return `✅ データエクスポートが完了しました
📁 エクスポートパス: ${exportPath}
📄 フォーマット: ${format}
📹 ファイル含む: ${includeFiles ? 'はい' : 'いいえ'}
📅 期間: ${dateRange ? `${dateRange.startDate.toISOString().split('T')[0]} から ${dateRange.endDate.toISOString().split('T')[0]}` : '全期間'}
👥 対象従業員: ${employeeIds ? `${employeeIds.length}人指定` : '全員'}

💡 このエクスポートは次回大会で再利用できます。`;
    } catch (error) {
      return `❌ エクスポートに失敗しました: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async importData(importPath: string): Promise<string> {
    if (!importPath) {
      return `❌ Usage: import <importPath>
Example: import ./exports/attendance_export_2024-01-15T10-30-00-000Z`;
    }

    try {
      await this.dataExporter.importData(importPath);
      
      return `✅ データインポートが完了しました
📁 インポートパス: ${importPath}
🔄 すべてのデータとファイルが復元されました

💡 前回大会のデータが正常に読み込まれました。`;
    } catch (error) {
      return `❌ インポートに失敗しました: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private getHelpMessage(): string {
    return `🏢 勤怠管理システム - 使用可能なコマンド:

👥 従業員管理:
  add-employee <name> <department> <position> <hourlyRate> <startDate>
  list-employees
  employee <employeeId>

⏰ 打刻:
  clock-in <employeeId>
  clock-out <employeeId> [breakMinutes]

📋 勤怠記録:
  time-records <employeeId> <startDate> <endDate>

💰 給与計算:
  payroll <employeeId> <month>
  payroll-summary <month>

📊 レポート:
  attendance-report <employeeId> <month>

📦 データ管理:
  export [format] [--start-date YYYY-MM-DD] [--end-date YYYY-MM-DD] [--employees id1,id2] [--no-files]
  import <importPath>

🔧 その他:
  help - このヘルプを表示
  exit - 終了

Example usage:
  add-employee "田中太郎" "開発部" "エンジニア" 3000 2024-01-15
  clock-in EMP_123
  clock-out EMP_123 60
  payroll EMP_123 2024-01
  export json --start-date 2024-01-01 --end-date 2024-12-31
  import ./exports/attendance_export_2024-01-15T10-30-00-000Z`;
  }

  async start(): Promise<void> {
    // Connect to database
    await this.db.connect();
    
    // Initialize database
    await this.db.initializeDatabase();
    
    console.log('\n🏢 勤怠管理システムへようこそ！');
    console.log('💡 「help」と入力してコマンドを確認してください。');
    console.log('🚪 「exit」で終了します。\n');

    const askQuestion = (): void => {
      this.rl.question('📝 コマンドを入力してください > ', async (command) => {
        if (command.trim()) {
          const response = await this.processCommand(command);
          console.log(`\n${response}\n`);
        }
        askQuestion();
      });
    };

    askQuestion();
  }
}

// Main execution
async function main() {
  const cli = new AttendanceCLI();
  
  try {
    await cli.start();
  } catch (error) {
    console.error('Failed to start CLI:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}