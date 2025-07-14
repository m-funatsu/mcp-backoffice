import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * End-to-End Tests for Natural Language Interactions
 * 
 * These tests simulate real-world scenarios where users interact with
 * the AI agent using natural language, testing the complete flow from
 * user input to system response.
 */

describe('E2E Natural Language Interactions', () => {
  let mockAgent: any;
  let mockMcpServer: any;
  let mockDatabase: any;

  beforeEach(() => {
    // Mock database with test data
    mockDatabase = {
      employees: new Map([
        ['EMP001', {
          id: 'EMP001',
          name: '田中太郎',
          department: '開発部',
          position: 'シニアエンジニア',
          hourlyRate: 3000,
          joinDate: new Date('2023-04-01'),
          managerId: null,
          isActive: true
        }],
        ['EMP002', {
          id: 'EMP002',
          name: '佐藤花子',
          department: '営業部',
          position: 'マネージャー',
          hourlyRate: 3500,
          joinDate: new Date('2022-01-15'),
          managerId: null,
          isActive: true
        }]
      ]),
      timeRecords: new Map([
        ['2024-01', [
          {
            id: 'TR001',
            employeeId: 'EMP001',
            date: new Date('2024-01-15'),
            clockIn: new Date('2024-01-15T09:00:00'),
            clockOut: new Date('2024-01-15T20:00:00'), // Long day
            breakMinutes: 60,
            recordType: 'ic_card'
          }
        ]]
      ])
    };

    // Mock MCP server functions
    mockMcpServer = {
      getEmployee: vi.fn(),
      getTimeRecords: vi.fn(),
      calculatePayroll: vi.fn(),
      generateAttendanceReport: vi.fn(),
      getPayrollSummary: vi.fn()
    };

    // Mock AI agent that processes natural language
    mockAgent = {
      processNaturalLanguage: vi.fn(),
      generateUI: vi.fn()
    };
  });

  describe('Happy Path Scenarios', () => {
    it('should handle monthly attendance closure request', async () => {
      const userInput = "7月分の勤怠を締めてください";
      
      // Mock successful processing
      mockMcpServer.getPayrollSummary.mockResolvedValue({
        month: '2024-07',
        totalEmployees: 25,
        totalRegularPay: 5000000,
        totalOvertimePay: 750000,
        totalLateNightPay: 150000,
        totalHolidayPay: 200000,
        totalPay: 6100000,
        violations: []
      });

      mockAgent.processNaturalLanguage.mockResolvedValue({
        intent: 'close_monthly_attendance',
        parameters: { month: '2024-07' },
        tools_used: ['get_payroll_summary'],
        confidence: 0.95
      });

      mockAgent.generateUI.mockResolvedValue({
        type: 'summary_card',
        title: '7月度勤怠集計完了',
        content: {
          summary: '対象従業員: 25名',
          totalPay: '¥6,100,000',
          violations: '労働基準法違反なし',
          status: 'completed'
        },
        actions: [
          { label: '詳細レポート', action: 'view_detailed_report' },
          { label: '承認', action: 'approve_monthly_closure' }
        ]
      });

      const result = await processUserRequest(userInput);

      expect(result.success).toBe(true);
      expect(result.ui.title).toContain('7月度勤怠集計完了');
      expect(result.ui.content.violations).toBe('労働基準法違反なし');
    });

    it('should retrieve specific employee attendance data', async () => {
      const userInput = "田中太郎さんの1月の勤怠データを教えて";

      mockMcpServer.getEmployee.mockResolvedValue(mockDatabase.employees.get('EMP001'));
      mockMcpServer.getTimeRecords.mockResolvedValue(mockDatabase.timeRecords.get('2024-01'));

      mockAgent.processNaturalLanguage.mockResolvedValue({
        intent: 'get_employee_attendance',
        parameters: { 
          employeeName: '田中太郎',
          month: '2024-01'
        },
        tools_used: ['get_employee', 'get_time_records'],
        confidence: 0.92
      });

      mockAgent.generateUI.mockResolvedValue({
        type: 'employee_attendance_card',
        title: '田中太郎さんの勤怠データ（2024年1月）',
        content: {
          employee: '田中太郎（開発部・シニアエンジニア）',
          workingDays: 20,
          totalHours: 180,
          overtimeHours: 20,
          violations: ['1/15: 11時間勤務（法定労働時間超過）']
        }
      });

      const result = await processUserRequest(userInput);

      expect(result.success).toBe(true);
      expect(result.ui.title).toContain('田中太郎');
      expect(result.ui.content.violations).toHaveLength(1);
    });
  });

  describe('Exception Handling Scenarios', () => {
    it('should handle missing clock-out records gracefully', async () => {
      const userInput = "今月の勤怠を確認して";

      // Mock data with missing clock-out
      const incompleteRecords = [
        {
          id: 'TR001',
          employeeId: 'EMP001',
          date: new Date('2024-01-15'),
          clockIn: new Date('2024-01-15T09:00:00'),
          clockOut: null, // Missing clock-out
          breakMinutes: 0,
          recordType: 'manual'
        }
      ];

      mockMcpServer.getTimeRecords.mockResolvedValue(incompleteRecords);

      mockAgent.processNaturalLanguage.mockResolvedValue({
        intent: 'check_monthly_attendance',
        parameters: { month: 'current' },
        tools_used: ['get_time_records'],
        confidence: 0.88
      });

      mockAgent.generateUI.mockResolvedValue({
        type: 'error_resolution_card',
        title: '勤怠データに不備があります',
        content: {
          issues: [
            {
              employee: '田中太郎',
              date: '2024-01-15',
              issue: '退勤打刻がありません',
              suggested_action: '手動で退勤時刻を入力'
            }
          ]
        },
        actions: [
          { label: '手動修正', action: 'manual_correction' },
          { label: '従業員に確認', action: 'contact_employee' }
        ]
      });

      const result = await processUserRequest(userInput);

      expect(result.success).toBe(false);
      expect(result.ui.title).toContain('不備があります');
      expect(result.ui.content.issues).toHaveLength(1);
      expect(result.ui.actions).toHaveLength(2);
    });

    it('should detect labor law violations and require human intervention', async () => {
      const userInput = "残業時間の多い従業員をチェックして";

      mockMcpServer.generateAttendanceReport.mockResolvedValue({
        employeeId: 'EMP001',
        employeeName: '田中太郎',
        month: '2024-01',
        totalWorkingDays: 22,
        totalRegularHours: 176,
        totalOvertimeHours: 65, // Exceeds 45-hour limit
        violations: [
          '月間時間外労働時間が上限45時間を超過しています（65時間）',
          '36協定の特別条項の確認が必要です'
        ]
      });

      mockAgent.processNaturalLanguage.mockResolvedValue({
        intent: 'check_overtime_violations',
        parameters: { scope: 'all_employees' },
        tools_used: ['generate_attendance_report'],
        confidence: 0.90
      });

      mockAgent.generateUI.mockResolvedValue({
        type: 'compliance_alert_card',
        title: '⚠️ 労働基準法違反の疑い',
        severity: 'high',
        content: {
          violations: [
            {
              employee: '田中太郎',
              violation: '月間残業65時間（上限45時間超過）',
              legal_requirement: '36協定特別条項の確認',
              risk_level: 'high'
            }
          ]
        },
        actions: [
          { label: '36協定確認', action: 'check_36_agreement', priority: 'high' },
          { label: '労働時間短縮計画', action: 'create_reduction_plan', priority: 'medium' },
          { label: '産業医面談設定', action: 'schedule_medical_consultation', priority: 'medium' }
        ]
      });

      const result = await processUserRequest(userInput);

      expect(result.success).toBe(true);
      expect(result.ui.severity).toBe('high');
      expect(result.ui.title).toContain('労働基準法違反');
      expect(result.ui.actions.some(a => a.priority === 'high')).toBe(true);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should correctly classify overtime at exactly 45 hours', async () => {
      const testCases = [
        { hours: 44.95, expected: 'within_limit' },
        { hours: 45.00, expected: 'at_limit' },
        { hours: 45.05, expected: 'exceeds_limit' }
      ];

      for (const testCase of testCases) {
        mockMcpServer.calculatePayroll.mockResolvedValue({
          employeeId: 'EMP001',
          month: '2024-01',
          overtimeHours: testCase.hours,
          violations: testCase.expected === 'exceeds_limit' ? ['月間時間外労働時間が上限を超過'] : []
        });

        const userInput = `EMP001の残業時間を確認して`;
        const result = await processUserRequest(userInput);

        if (testCase.expected === 'exceeds_limit') {
          expect(result.ui.content.violations?.length).toBeGreaterThan(0);
        } else {
          expect(result.ui.content.violations?.length || 0).toBe(0);
        }
      }
    });
  });

  describe('Multi-step Workflow Testing', () => {
    it('should handle complex approval workflow', async () => {
      const userInput = "7月分の勤怠を承認手続きまで完了させて";

      // Step 1: Generate summary
      mockMcpServer.getPayrollSummary.mockResolvedValueOnce({
        month: '2024-07',
        totalEmployees: 10,
        violations: ['EMP001: 残業超過']
      });

      // Step 2: Show violations requiring resolution
      mockAgent.generateUI.mockResolvedValueOnce({
        type: 'violation_resolution_card',
        title: '承認前に解決が必要な問題',
        content: {
          violations: [{ employee: 'EMP001', issue: '残業超過' }]
        },
        actions: [
          { label: '問題を解決', action: 'resolve_violations' },
          { label: '例外承認', action: 'exception_approval' }
        ]
      });

      // Step 3: After resolution, proceed to approval
      mockAgent.generateUI.mockResolvedValueOnce({
        type: 'approval_confirmation_card',
        title: '7月度勤怠承認完了',
        content: {
          status: 'approved',
          approver: 'システム管理者',
          timestamp: new Date().toISOString()
        }
      });

      const result = await processUserRequest(userInput);

      expect(result.success).toBe(true);
      expect(mockMcpServer.getPayrollSummary).toHaveBeenCalled();
      expect(mockAgent.generateUI).toHaveBeenCalledTimes(2);
    });
  });

  // Helper function to simulate the complete request processing pipeline
  async function processUserRequest(userInput: string) {
    try {
      // 1. Natural language processing
      const nlpResult = await mockAgent.processNaturalLanguage(userInput);
      
      // 2. Execute appropriate MCP server tools based on intent
      let mcpResult;
      switch (nlpResult.intent) {
        case 'close_monthly_attendance':
          mcpResult = await mockMcpServer.getPayrollSummary(nlpResult.parameters.month);
          break;
        case 'get_employee_attendance':
          const employee = await mockMcpServer.getEmployee(nlpResult.parameters.employeeName);
          mcpResult = await mockMcpServer.getTimeRecords(employee.id, nlpResult.parameters.month);
          break;
        case 'check_monthly_attendance':
          mcpResult = await mockMcpServer.getTimeRecords(nlpResult.parameters.month);
          break;
        case 'check_overtime_violations':
          mcpResult = await mockMcpServer.generateAttendanceReport();
          break;
        default:
          throw new Error(`Unknown intent: ${nlpResult.intent}`);
      }

      // 3. Generate UI based on results
      const ui = await mockAgent.generateUI(mcpResult);

      return {
        success: !mcpResult.violations || mcpResult.violations.length === 0,
        ui,
        nlpResult,
        mcpResult
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        ui: {
          type: 'error_card',
          title: 'エラーが発生しました',
          content: { message: error.message }
        }
      };
    }
  }
});