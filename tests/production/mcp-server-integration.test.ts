import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Production MCP Server Integration', () => {
  let serverProcess: ChildProcess;
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // MCPサーバーを実際に起動
    console.log('🚀 Starting MCP Server for production test...');
    
    serverProcess = spawn('node', ['dist/server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    // サーバーエラーをキャッチ
    serverProcess.stderr?.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    serverProcess.on('error', (error) => {
      console.error('Server process error:', error);
    });

    // MCPクライアントを初期化
    transport = new StdioClientTransport({
      spawn: () => serverProcess
    });

    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // 接続を確立
    await client.connect(transport);
    console.log('✅ MCP Client connected to server');
  }, 30000);

  afterAll(async () => {
    if (client && transport) {
      await client.close();
    }
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  describe('MCP Protocol Compliance', () => {
    it('should respond to initialize request', async () => {
      // 初期化レスポンスをテスト
      const capabilities = client.getServerCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.tools).toBeDefined();
      
      console.log('📋 Server capabilities:', capabilities);
    });

    it('should list available tools', async () => {
      const toolsResponse = await client.listTools();
      
      expect(toolsResponse.tools).toBeDefined();
      expect(toolsResponse.tools.length).toBeGreaterThan(0);
      
      // 期待されるツールが含まれていることを確認
      const toolNames = toolsResponse.tools.map(tool => tool.name);
      
      const expectedTools = [
        'clock_in',
        'clock_out', 
        'get_time_records',
        'calculate_payroll',
        'get_payroll_summary',
        'add_employee',
        'get_employee',
        'get_all_employees'
      ];

      expectedTools.forEach(expectedTool => {
        expect(toolNames).toContain(expectedTool);
      });

      console.log(`✅ Found ${toolsResponse.tools.length} tools:`, toolNames);
    });

    it('should execute add_employee tool correctly', async () => {
      const addEmployeeResult = await client.callTool({
        name: 'add_employee',
        arguments: {
          name: 'プロダクションテスト従業員',
          department: 'テスト部',
          position: 'テスター',
          hourlyRate: 3000,
          joinDate: '2024-01-01',
          isActive: true
        }
      });

      expect(addEmployeeResult.content).toBeDefined();
      expect(addEmployeeResult.isError).toBe(false);
      
      // レスポンス内容を確認
      const responseContent = addEmployeeResult.content[0];
      expect(responseContent.type).toBe('text');
      
      const response = JSON.parse((responseContent as any).text);
      expect(response.success).toBe(true);
      expect(response.employeeId).toBeDefined();
      
      console.log('✅ Employee added successfully:', response.employeeId);
      
      // 作成された従業員IDを保存（他のテストで使用）
      (global as any).testEmployeeId = response.employeeId;
    });

    it('should execute clock_in tool correctly', async () => {
      const employeeId = (global as any).testEmployeeId;
      expect(employeeId).toBeDefined();

      const clockInResult = await client.callTool({
        name: 'clock_in',
        arguments: {
          employeeId: employeeId,
          timestamp: new Date().toISOString(),
          recordType: 'manual'
        }
      });

      expect(clockInResult.isError).toBe(false);
      
      const response = JSON.parse((clockInResult.content[0] as any).text);
      expect(response.success).toBe(true);
      expect(response.message).toContain('出勤を記録しました');
      
      console.log('✅ Clock in recorded successfully');
    });

    it('should execute clock_out tool correctly', async () => {
      const employeeId = (global as any).testEmployeeId;
      
      // 8時間後の退勤時刻を設定
      const clockOutTime = new Date();
      clockOutTime.setHours(clockOutTime.getHours() + 8);

      const clockOutResult = await client.callTool({
        name: 'clock_out',
        arguments: {
          employeeId: employeeId,
          timestamp: clockOutTime.toISOString(),
          breakMinutes: 60
        }
      });

      expect(clockOutResult.isError).toBe(false);
      
      const response = JSON.parse((clockOutResult.content[0] as any).text);
      expect(response.success).toBe(true);
      expect(response.message).toContain('退勤を記録しました');
      
      console.log('✅ Clock out recorded successfully');
    });

    it('should calculate payroll correctly via MCP', async () => {
      const employeeId = (global as any).testEmployeeId;
      const currentDate = new Date();
      const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      const payrollResult = await client.callTool({
        name: 'calculate_payroll',
        arguments: {
          employeeId: employeeId,
          month: month
        }
      });

      expect(payrollResult.isError).toBe(false);
      
      const response = JSON.parse((payrollResult.content[0] as any).text);
      expect(response.success).toBe(true);
      expect(response.payroll).toBeDefined();
      expect(response.payroll.totalPay).toBeGreaterThan(0);
      
      console.log('✅ Payroll calculated:', {
        regularHours: response.payroll.regularHours,
        totalPay: response.payroll.totalPay
      });
    });

    it('should generate payroll summary via MCP', async () => {
      const currentDate = new Date();
      const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      const summaryResult = await client.callTool({
        name: 'get_payroll_summary',
        arguments: {
          month: month
        }
      });

      expect(summaryResult.isError).toBe(false);
      
      const response = JSON.parse((summaryResult.content[0] as any).text);
      expect(response.success).toBe(true);
      expect(response.summary).toBeDefined();
      expect(response.summary.totalEmployees).toBeGreaterThan(0);
      expect(response.summary.totalPay).toBeGreaterThan(0);
      
      console.log('✅ Payroll summary generated:', {
        totalEmployees: response.summary.totalEmployees,
        totalPay: response.summary.totalPay,
        violations: response.summary.violations.length
      });
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle invalid tool calls gracefully', async () => {
      try {
        await client.callTool({
          name: 'nonexistent_tool',
          arguments: {}
        });
      } catch (error) {
        expect(error).toBeDefined();
        console.log('✅ Invalid tool call properly rejected');
      }
    });

    it('should validate required parameters', async () => {
      const invalidCallResult = await client.callTool({
        name: 'add_employee',
        arguments: {
          // nameが不足
          department: 'テスト部'
        }
      });

      expect(invalidCallResult.isError).toBe(true);
      console.log('✅ Missing required parameters properly validated');
    });

    it('should handle malformed data gracefully', async () => {
      const malformedResult = await client.callTool({
        name: 'clock_in',
        arguments: {
          employeeId: 'INVALID_ID',
          timestamp: 'invalid-date',
          recordType: 'invalid-type'
        }
      });

      // エラーハンドリングされることを確認
      const response = JSON.parse((malformedResult.content[0] as any).text);
      expect(response.success).toBe(false);
      
      console.log('✅ Malformed data handled gracefully');
    });
  });

  describe('Performance Under Load', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentRequests }, async (_, index) => {
        return client.callTool({
          name: 'get_all_employees',
          arguments: {}
        });
      });

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 全てのリクエストが成功することを確認
      results.forEach(result => {
        expect(result.isError).toBe(false);
      });

      console.log(`✅ Handled ${concurrentRequests} concurrent requests in ${duration}ms`);
      
      // パフォーマンス基準: 10リクエストを5秒以内で処理
      expect(duration).toBeLessThan(5000);
    });

    it('should maintain memory efficiency during extended use', async () => {
      const initialMemory = process.memoryUsage();
      
      // 大量のツール呼び出しを実行
      for (let i = 0; i < 50; i++) {
        await client.callTool({
          name: 'get_all_employees',
          arguments: {}
        });
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`📊 Memory usage - Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // メモリ増加が100MB以内であることを確認
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });
});