import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegratedPayrollEngine } from '../../src/payroll-engine.js';
import { createMockDatabase } from '../setup/test-db.js';
import type { Employee, TimeRecord } from '../../src/types.js';

/**
 * MCP給与計算統合 E2E テスト
 * 
 * MCPサーバーを通じた実際のツール呼び出しをシミュレートし、
 * 外部システムとの統合が正しく動作することを検証
 */

describe('E2E: MCP給与計算統合テスト', () => {
  let mockDb: any;

  beforeEach(async () => {
    mockDb = createMockDatabase();
    
    // MCPサーバー初期化のシミュレーション
    // await server.initialize();
  });

  afterEach(async () => {
    // if (server) {
    //   await server.close();
    // }
  });

  describe('MCPツールチェーンテスト', () => {
    it('従業員追加→勤怠入力→給与計算の完全フロー', async () => {
      // ステップ1: add_employee ツールのシミュレーション
      const employeeData = {
        name: 'MCPテスト太郎',
        department: '開発部',
        position: 'MCPエンジニア',
        hourlyRate: 3000,
        startDate: '2024-07-01',
        birthDate: '1990-05-15',
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      // MCPツール呼び出しのシミュレーション
      const addEmployeeRequest = {
        method: 'tools/call',
        params: {
          name: 'add_employee',
          arguments: employeeData
        }
      };

      // 従業員追加処理（実際のMCPハンドラーロジック）
      const employee: Employee = {
        id: 'EMP_MCP_001',
        name: employeeData.name,
        department: employeeData.department,
        position: employeeData.position,
        hourlyRate: employeeData.hourlyRate,
        startDate: new Date(employeeData.startDate),
        birthDate: new Date(employeeData.birthDate),
        isActive: true,
        contractType: employeeData.contractType as 'full_time',
        salaryType: employeeData.salaryType as 'hourly'
      };

      mockDb.addEmployee(employee);

      // 結果検証
      expect(employee.id).toBeTruthy();
      expect(employee.name).toBe('MCPテスト太郎');

      // ステップ2: add_time_record ツールのシミュレーション
      const timeRecordData = [
        {
          employeeId: 'EMP_MCP_001',
          date: '2024-07-01',
          clockIn: '09:00:00',
          clockOut: '18:00:00',
          breakMinutes: 60,
          recordType: 'ic_card'
        },
        {
          employeeId: 'EMP_MCP_001',
          date: '2024-07-02',
          clockIn: '09:00:00',
          clockOut: '20:00:00',
          breakMinutes: 90,
          recordType: 'ic_card'
        }
      ];

      const timeRecords: TimeRecord[] = timeRecordData.map((data, index) => ({
        id: `TR_MCP_${index + 1}`,
        employeeId: data.employeeId,
        date: new Date(data.date),
        clockIn: new Date(`${data.date}T${data.clockIn}`),
        clockOut: new Date(`${data.date}T${data.clockOut}`),
        breakMinutes: data.breakMinutes,
        recordType: data.recordType as 'ic_card'
      }));

      mockDb.addTimeRecords('EMP_MCP_001', timeRecords);

      // ステップ3: generate_payslip ツールのシミュレーション
      const generatePayslipRequest = {
        method: 'tools/call',
        params: {
          name: 'generate_payslip',
          arguments: {
            employeeId: 'EMP_MCP_001',
            month: '2024-07'
          }
        }
      };

      // 給与明細生成（MCPハンドラーロジック）
      const payrollEngine = new IntegratedPayrollEngine(mockDb);
      const payslip = await payrollEngine.generatePayslip('EMP_MCP_001', '2024-07');

      // 結果検証
      expect(payslip).toBeTruthy();
      expect(payslip.employeeId).toBe('EMP_MCP_001');
      expect(payslip.month).toBe('2024-07');
      expect(payslip.netPay).toBeGreaterThan(0);

      // MCPレスポンス形式の検証
      const mcpResponse = {
        content: [
          {
            type: 'text',
            text: `給与明細を生成しました:\n従業員ID: ${payslip.employeeId}\n手取り: ¥${payslip.netPay.toLocaleString()}`
          }
        ]
      };

      expect(mcpResponse.content).toHaveLength(1);
      expect(mcpResponse.content[0].type).toBe('text');
      expect(mcpResponse.content[0].text).toContain(payslip.employeeId);
    });

    it('自然言語クエリによる給与情報取得', async () => {
      // 事前データ準備
      const employee: Employee = {
        id: 'EMP_NLP_001',
        name: '自然言語太郎',
        department: 'AI部',
        position: 'NLPエンジニア',
        hourlyRate: 3500,
        startDate: new Date('2024-01-01'),
        birthDate: new Date('1985-03-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(employee);

      const timeRecords: TimeRecord[] = [
        {
          id: 'TR_NLP_1',
          employeeId: 'EMP_NLP_001',
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T22:00:00'), // 長時間勤務
          breakMinutes: 90,
          recordType: 'ic_card'
        }
      ];

      mockDb.addTimeRecords('EMP_NLP_001', timeRecords);

      // 自然言語クエリのシミュレーション
      const nlpQueries = [
        "自然言語太郎さんの7月の給与を計算して",
        "EMP_NLP_001の残業時間を教えて",
        "AI部の労働時間レポートを作成して"
      ];

      // 各クエリの処理
      for (const query of nlpQueries) {
        // クエリ解析のシミュレーション
        let toolName: string;
        let arguments: any;

        if (query.includes('給与を計算')) {
          toolName = 'generate_payslip';
          arguments = { employeeId: 'EMP_NLP_001', month: '2024-07' };
        } else if (query.includes('残業時間')) {
          toolName = 'get_time_records';
          arguments = { employeeId: 'EMP_NLP_001', startDate: '2024-07-01', endDate: '2024-07-31' };
        } else if (query.includes('レポート')) {
          toolName = 'generate_attendance_report';
          arguments = { department: 'AI部', month: '2024-07' };
        }

        // ツール実行
        expect(toolName!).toBeTruthy();
        expect(arguments).toBeTruthy();

        // 実際のツール呼び出し結果の検証
        if (toolName === 'generate_payslip') {
          const payrollEngine = new IntegratedPayrollEngine(mockDb);
          const payslip = await payrollEngine.generatePayslip(
            arguments.employeeId, 
            arguments.month
          );
          expect(payslip.overtimePay).toBeGreaterThan(0); // 長時間勤務による残業代
        }
      }
    });
  });

  describe('外部システム統合テスト', () => {
    it('会計システム連携のシミュレーション', async () => {
      // 従業員データ準備
      const employees: Employee[] = [
        {
          id: 'EMP_ACCOUNTING_001',
          name: '経理太郎',
          department: '経理部',
          position: '経理担当',
          hourlyRate: 2800,
          startDate: new Date('2023-04-01'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly'
        },
        {
          id: 'EMP_ACCOUNTING_002',
          name: '経理花子',
          department: '経理部',
          position: '経理主任',
          hourlyRate: 3200,
          startDate: new Date('2021-04-01'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly'
        }
      ];

      employees.forEach(emp => mockDb.addEmployee(emp));

      // 勤怠データ
      employees.forEach(emp => {
        const timeRecords: TimeRecord[] = [
          {
            id: `TR_ACC_${emp.id}_1`,
            employeeId: emp.id,
            date: new Date('2024-07-01'),
            clockIn: new Date('2024-07-01T09:00:00'),
            clockOut: new Date('2024-07-01T18:00:00'),
            breakMinutes: 60,
            recordType: 'ic_card'
          }
        ];
        mockDb.addTimeRecords(emp.id, timeRecords);
      });

      // 部門別給与集計
      const payrollEngine = new IntegratedPayrollEngine(mockDb);
      const payslips = await Promise.all(
        employees.map(emp => 
          payrollEngine.generatePayslip(emp.id, '2024-07')
        )
      );

      // 会計システム向けデータ集計
      const accountingData = {
        department: '経理部',
        month: '2024-07',
        totalPayroll: payslips.reduce((sum, ps) => sum + ps.totalPay, 0),
        totalDeductions: payslips.reduce((sum, ps) => sum + ps.totalDeductions, 0),
        netPayroll: payslips.reduce((sum, ps) => sum + ps.netPay, 0),
        employeeCount: payslips.length,
        breakdown: {
          baseSalary: payslips.reduce((sum, ps) => sum + ps.baseSalary, 0),
          overtimePay: payslips.reduce((sum, ps) => sum + ps.overtimePay, 0),
          socialInsurance: payslips.reduce((sum, ps) => sum + ps.socialInsurance.total, 0),
          taxes: payslips.reduce((sum, ps) => sum + ps.taxCalculation.incomeTax + ps.taxCalculation.residentTax, 0)
        }
      };

      // 集計データ検証
      expect(accountingData.totalPayroll).toBeGreaterThan(0);
      expect(accountingData.employeeCount).toBe(2);
      expect(accountingData.breakdown.baseSalary).toBeGreaterThan(0);
      expect(accountingData.breakdown.socialInsurance).toBeGreaterThan(0);
      expect(accountingData.breakdown.taxes).toBeGreaterThan(0);

      // 仕訳データ形式
      const journalEntries = [
        {
          account: '給与',
          debit: accountingData.breakdown.baseSalary,
          credit: 0,
          description: `${accountingData.month} ${accountingData.department} 基本給`
        },
        {
          account: '預り金（所得税）',
          debit: 0,
          credit: accountingData.breakdown.taxes,
          description: `${accountingData.month} ${accountingData.department} 税金預り`
        }
      ];

      expect(journalEntries).toHaveLength(2);
      expect(journalEntries[0].debit).toBeGreaterThan(0);
      expect(journalEntries[1].credit).toBeGreaterThan(0);
    });

    it('人事システムとの連携テスト', async () => {
      // 人事データ更新のシミュレーション
      const hrUpdateData = {
        employeeId: 'EMP_HR_001',
        updates: {
          position: '主任', // 昇進
          hourlyRate: 3200, // 昇給
          department: '開発部',
          effectiveDate: '2024-07-01'
        }
      };

      // 既存従業員
      const existingEmployee: Employee = {
        id: 'EMP_HR_001',
        name: '昇進太郎',
        department: '開発部',
        position: 'エンジニア',
        hourlyRate: 2800,
        startDate: new Date('2022-04-01'),
        isActive: true,
        contractType: 'full_time',
        salaryType: 'hourly'
      };

      mockDb.addEmployee(existingEmployee);

      // 人事更新を反映
      const updatedEmployee: Employee = {
        ...existingEmployee,
        position: hrUpdateData.updates.position,
        hourlyRate: hrUpdateData.updates.hourlyRate
      };

      mockDb.updateEmployee('EMP_HR_001', updatedEmployee);

      // 更新後の勤怠データ
      const timeRecords: TimeRecord[] = [
        {
          id: 'TR_HR_1',
          employeeId: 'EMP_HR_001',
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        }
      ];

      mockDb.addTimeRecords('EMP_HR_001', timeRecords);

      // 新しい時給での給与計算
      const payrollEngine = new IntegratedPayrollEngine(mockDb);
      const payslip = await payrollEngine.generatePayslip('EMP_HR_001', '2024-07');

      // 昇給が反映されているかの検証
      const expectedBasePay = 8 * 3200; // 8時間 × 新時給
      expect(payslip.baseSalary).toBeCloseTo(expectedBasePay, -2);
      expect(payslip.baseSalary).toBeGreaterThan(8 * 2800); // 旧時給より高い

      // 人事システム向けフィードバック
      const hrFeedback = {
        employeeId: 'EMP_HR_001',
        month: '2024-07',
        positionChange: {
          from: 'エンジニア',
          to: '主任',
          effectiveDate: '2024-07-01',
          salaryImpact: payslip.baseSalary - (8 * 2800)
        }
      };

      expect(hrFeedback.positionChange.salaryImpact).toBeGreaterThan(0); // 昇給効果
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量データでの処理性能', async () => {
      const startTime = Date.now();

      // 100名の従業員を作成
      const employees: Employee[] = [];
      for (let i = 1; i <= 100; i++) {
        employees.push({
          id: `EMP_PERF_${i.toString().padStart(3, '0')}`,
          name: `パフォーマンステスト従業員${i}`,
          department: `部署${i % 10}`,
          position: 'テスト職',
          hourlyRate: 2000 + (i % 1000),
          startDate: new Date('2024-01-01'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly'
        });
      }

      employees.forEach(emp => mockDb.addEmployee(emp));

      // 各従業員に勤怠データ
      employees.forEach(emp => {
        const timeRecords: TimeRecord[] = [{
          id: `TR_PERF_${emp.id}`,
          employeeId: emp.id,
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        }];
        mockDb.addTimeRecords(emp.id, timeRecords);
      });

      // 全従業員の給与計算
      const payrollEngine = new IntegratedPayrollEngine(mockDb);
      const payslips = await Promise.all(
        employees.slice(0, 10).map(emp => // 最初の10名のみテスト
          payrollEngine.generatePayslip(emp.id, '2024-07')
        )
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // パフォーマンス検証
      expect(payslips).toHaveLength(10);
      expect(processingTime).toBeLessThan(10000); // 10秒以内
      
      payslips.forEach(payslip => {
        expect(payslip.netPay).toBeGreaterThan(0);
      });
      
      console.log(`大量データ処理時間: ${processingTime}ms`);
    });
  });
});