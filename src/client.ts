#!/usr/bin/env node

import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as readline from 'readline';

/**
 * AI Agent Client for Attendance Management
 * 
 * This client provides a natural language interface to the MCP attendance server.
 * It simulates an AI agent that can understand user requests and translate them
 * into appropriate MCP tool calls.
 */

class AttendanceAgent {
  private client: Client;
  private transport: StdioClientTransport;
  private rl: readline.Interface;

  constructor() {
    this.client = new Client(
      {
        name: 'attendance-agent',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async connect(): Promise<void> {
    // Start the MCP server as a subprocess
    const serverProcess = spawn('node', ['dist/server.js'], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.transport = new StdioClientTransport({
      reader: serverProcess.stdout,
      writer: serverProcess.stdin,
    });

    await this.client.connect(this.transport);
    console.log('🤖 AI Agent connected to Attendance Management System');
  }

  async processNaturalLanguageQuery(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();
    
    try {
      // Simple pattern matching for demo purposes
      // In a real implementation, this would use LLM function calling
      
      if (lowerQuery.includes('add employee') || lowerQuery.includes('新しい従業員')) {
        return await this.handleAddEmployeeIntent(query);
      }
      
      if (lowerQuery.includes('clock in') || lowerQuery.includes('出勤')) {
        return await this.handleClockInIntent(query);
      }
      
      if (lowerQuery.includes('clock out') || lowerQuery.includes('退勤')) {
        return await this.handleClockOutIntent(query);
      }
      
      if (lowerQuery.includes('time records') || lowerQuery.includes('勤怠記録')) {
        return await this.handleTimeRecordsIntent(query);
      }
      
      if (lowerQuery.includes('payroll') || lowerQuery.includes('給与')) {
        return await this.handlePayrollIntent(query);
      }
      
      if (lowerQuery.includes('attendance report') || lowerQuery.includes('勤怠レポート')) {
        return await this.handleAttendanceReportIntent(query);
      }
      
      if (lowerQuery.includes('employee') || lowerQuery.includes('従業員')) {
        return await this.handleEmployeeIntent(query);
      }
      
      if (lowerQuery.includes('help') || lowerQuery.includes('ヘルプ')) {
        return this.getHelpMessage();
      }

      return this.getUnknownQueryResponse(query);
    } catch (error) {
      return `❌ エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async handleAddEmployeeIntent(query: string): Promise<string> {
    // Extract employee information from query
    // This is a simplified example - in real implementation, use LLM to extract entities
    const nameMatch = query.match(/name[:\\s]+([^,\\n]+)/i);
    const deptMatch = query.match(/department[:\\s]+([^,\\n]+)/i);
    const posMatch = query.match(/position[:\\s]+([^,\\n]+)/i);
    const rateMatch = query.match(/rate[:\\s]+(\\d+)/i);
    const dateMatch = query.match(/date[:\\s]+(\\d{4}-\\d{2}-\\d{2})/i);

    if (!nameMatch || !deptMatch || !posMatch || !rateMatch || !dateMatch) {
      return `ℹ️ 従業員追加には以下の情報が必要です:\\n` +
             `- name: 従業員名\\n` +
             `- department: 部署\\n` +
             `- position: 役職\\n` +
             `- rate: 時給\\n` +
             `- date: 入社日 (YYYY-MM-DD)\\n\\n` +
             `例: "Add employee name: 田中太郎, department: 開発部, position: エンジニア, rate: 3000, date: 2024-01-15"`;
    }

    const result = await this.client.callTool({
      name: 'add_employee',
      arguments: {
        name: nameMatch[1].trim(),
        department: deptMatch[1].trim(),
        position: posMatch[1].trim(),
        hourlyRate: parseInt(rateMatch[1]),
        joinDate: dateMatch[1],
      },
    });

    return `✅ ${this.formatToolResult(result)}`;
  }

  private async handleClockInIntent(query: string): Promise<string> {
    // Extract employee ID from query
    const idMatch = query.match(/(?:id[:\\s]+|employee[:\\s]+)([A-Z0-9_]+)/i);
    
    if (!idMatch) {
      return `ℹ️ 出勤打刻には従業員IDが必要です。\\n例: "Clock in employee: EMP_123"`;
    }

    const result = await this.client.callTool({
      name: 'clock_in',
      arguments: {
        employeeId: idMatch[1],
        recordType: 'manual',
      },
    });

    return `✅ ${this.formatToolResult(result)}`;
  }

  private async handleClockOutIntent(query: string): Promise<string> {
    const idMatch = query.match(/(?:id[:\\s]+|employee[:\\s]+)([A-Z0-9_]+)/i);
    const breakMatch = query.match(/break[:\\s]+(\\d+)/i);
    
    if (!idMatch) {
      return `ℹ️ 退勤打刻には従業員IDが必要です。\\n例: "Clock out employee: EMP_123, break: 60"`;
    }

    const result = await this.client.callTool({
      name: 'clock_out',
      arguments: {
        employeeId: idMatch[1],
        breakMinutes: breakMatch ? parseInt(breakMatch[1]) : 0,
      },
    });

    return `✅ ${this.formatToolResult(result)}`;
  }

  private async handleTimeRecordsIntent(query: string): Promise<string> {
    const idMatch = query.match(/(?:id[:\\s]+|employee[:\\s]+)([A-Z0-9_]+)/i);
    const startMatch = query.match(/start[:\\s]+(\\d{4}-\\d{2}-\\d{2})/i);
    const endMatch = query.match(/end[:\\s]+(\\d{4}-\\d{2}-\\d{2})/i);
    
    if (!idMatch || !startMatch || !endMatch) {
      return `ℹ️ 勤怠記録取得には従業員ID、開始日、終了日が必要です。\\n` +
             `例: "Get time records employee: EMP_123, start: 2024-01-01, end: 2024-01-31"`;
    }

    const result = await this.client.callTool({
      name: 'get_time_records',
      arguments: {
        employeeId: idMatch[1],
        startDate: startMatch[1],
        endDate: endMatch[1],
      },
    });

    return `📋 ${this.formatToolResult(result)}`;
  }

  private async handlePayrollIntent(query: string): Promise<string> {
    const idMatch = query.match(/(?:id[:\\s]+|employee[:\\s]+)([A-Z0-9_]+)/i);
    const monthMatch = query.match(/month[:\\s]+(\\d{4}-\\d{2})/i);
    
    if (query.toLowerCase().includes('summary') || query.toLowerCase().includes('サマリー')) {
      if (!monthMatch) {
        return `ℹ️ 給与サマリーには月（YYYY-MM）が必要です。\\n例: "Get payroll summary month: 2024-01"`;
      }

      const result = await this.client.callTool({
        name: 'get_payroll_summary',
        arguments: {
          month: monthMatch[1],
        },
      });

      return `💰 ${this.formatToolResult(result)}`;
    }
    
    if (!idMatch || !monthMatch) {
      return `ℹ️ 給与計算には従業員IDと月（YYYY-MM）が必要です。\\n` +
             `例: "Calculate payroll employee: EMP_123, month: 2024-01"`;
    }

    const result = await this.client.callTool({
      name: 'calculate_payroll',
      arguments: {
        employeeId: idMatch[1],
        month: monthMatch[1],
      },
    });

    return `💰 ${this.formatToolResult(result)}`;
  }

  private async handleAttendanceReportIntent(query: string): Promise<string> {
    const idMatch = query.match(/(?:id[:\\s]+|employee[:\\s]+)([A-Z0-9_]+)/i);
    const monthMatch = query.match(/month[:\\s]+(\\d{4}-\\d{2})/i);
    
    if (!idMatch || !monthMatch) {
      return `ℹ️ 勤怠レポートには従業員IDと月（YYYY-MM）が必要です。\\n` +
             `例: "Get attendance report employee: EMP_123, month: 2024-01"`;
    }

    const result = await this.client.callTool({
      name: 'get_attendance_report',
      arguments: {
        employeeId: idMatch[1],
        month: monthMatch[1],
      },
    });

    return `📊 ${this.formatToolResult(result)}`;
  }

  private async handleEmployeeIntent(query: string): Promise<string> {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('all') || lowerQuery.includes('list') || lowerQuery.includes('一覧')) {
      const result = await this.client.callTool({
        name: 'get_all_employees',
        arguments: {},
      });

      return `👥 ${this.formatToolResult(result)}`;
    }
    
    const idMatch = query.match(/(?:id[:\\s]+|employee[:\\s]+)([A-Z0-9_]+)/i);
    if (!idMatch) {
      return `ℹ️ 従業員情報取得には従業員IDが必要です。\\n例: "Get employee: EMP_123"`;
    }

    const result = await this.client.callTool({
      name: 'get_employee',
      arguments: {
        employeeId: idMatch[1],
      },
    });

    return `👤 ${this.formatToolResult(result)}`;
  }

  private formatToolResult(result: CallToolResult): string {
    if (result.content && result.content.length > 0) {
      return result.content[0].text || 'No content';
    }
    return 'No result';
  }

  private getHelpMessage(): string {
    return `🤖 勤怠管理AIエージェント - 使用可能なコマンド:\\n\\n` +
           `👥 従業員管理:\\n` +
           `- "Add employee name: 田中太郎, department: 開発部, position: エンジニア, rate: 3000, date: 2024-01-15"\\n` +
           `- "Get employee: EMP_123"\\n` +
           `- "Get all employees"\\n\\n` +
           `⏰ 打刻:\\n` +
           `- "Clock in employee: EMP_123"\\n` +
           `- "Clock out employee: EMP_123, break: 60"\\n\\n` +
           `📋 勤怠記録:\\n` +
           `- "Get time records employee: EMP_123, start: 2024-01-01, end: 2024-01-31"\\n\\n` +
           `💰 給与計算:\\n` +
           `- "Calculate payroll employee: EMP_123, month: 2024-01"\\n` +
           `- "Get payroll summary month: 2024-01"\\n\\n` +
           `📊 レポート:\\n` +
           `- "Get attendance report employee: EMP_123, month: 2024-01"\\n\\n` +
           `💡 ヒント: 自然言語での指示も可能です！`;
  }

  private getUnknownQueryResponse(query: string): string {
    return `❓ 申し訳ございません。「${query}」を理解できませんでした。\\n` +
           `「help」と入力して使用可能なコマンドを確認してください。`;
  }

  async startInteractiveMode(): Promise<void> {
    console.log('\\n🤖 勤怠管理AIエージェントへようこそ！');
    console.log('💡 「help」と入力してコマンドを確認してください。');
    console.log('🚪 「exit」で終了します。\\n');

    const askQuestion = (): void => {
      this.rl.question('💬 何をお手伝いしましょうか？ > ', async (query) => {
        if (query.toLowerCase().trim() === 'exit') {
          console.log('\\n👋 お疲れ様でした！');
          this.rl.close();
          process.exit(0);
        }

        if (query.trim()) {
          const response = await this.processNaturalLanguageQuery(query);
          console.log(`\\n${response}\\n`);
        }

        askQuestion();
      });
    };

    askQuestion();
  }
}

// Main execution
async function main() {
  const agent = new AttendanceAgent();
  
  try {
    await agent.connect();
    await agent.startInteractiveMode();
  } catch (error) {
    console.error('Failed to start agent:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}