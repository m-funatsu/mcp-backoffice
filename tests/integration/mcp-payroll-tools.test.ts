import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AttendanceServer } from '../../src/server.js';
import Database from '../../src/database.js';

describe('MCP給与計算ツール機能テスト', () => {
  let server: AttendanceServer;
  let db: Database;

  beforeEach(async () => {
    server = new AttendanceServer();
    db = server.db;
    await db.initializeDatabase();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('calculate_compliance_payroll ツールテスト', () => {
    it('標準的な従業員の給与計算が正しく実行される', async () => {
      // 1. 従業員データ準備
      const employeeData = {
        name: 'MCP給与テスト太郎',
        department: '開発部',
        position: 'エンジニア',
        hourlyRate: 3000,
        joinDate: new Date('2020-04-01'),
        isActive: true,
        contractType: 'full_time' as const,
        salaryType: 'hourly' as const
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 勤怠データ準備
      const timeRecords = [
        {
          employeeId,
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card' as const
        },
        {
          employeeId,
          date: new Date('2024-07-02'),
          clockIn: new Date('2024-07-02T09:00:00'),
          clockOut: new Date('2024-07-02T20:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card' as const
        }
      ];

      for (const record of timeRecords) {
        await db.addTimeRecord(record);
      }

      // 3. MCPツール実行
      const result = await server['handleCalculateCompliancePayroll']({
        employeeId,
        month: '2024-07'
      });

      // 4. 結果検証
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      
      const response = result.content[0].text;
      expect(response).toContain('💰 統合給与計算結果');
      expect(response).toContain('MCP給与テスト太郎');
      expect(response).toContain('通常時間: 16.0時間');
      expect(response).toContain('残業時間: 3.0時間');
      expect(response).toContain('基本給: ¥48,000');
      expect(response).toContain('残業代: ¥11,250');
      expect(response).toContain('✅ 労働基準法準拠');
    });

    it('残業時間が45時間を超える場合の警告表示', async () => {
      // 1. 従業員データ準備
      const employeeData = {
        name: '残業過多太郎',
        department: '営業部',
        position: '営業',
        hourlyRate: 2500,
        joinDate: new Date('2020-04-01'),
        isActive: true,
        contractType: 'full_time' as const,
        salaryType: 'hourly' as const
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 大量残業データ準備
      const timeRecords = [];
      for (let day = 1; day <= 20; day++) {
        const date = new Date(`2024-07-${day.toString().padStart(2, '0')}`);
        if (date.getDay() === 0 || date.getDay() === 6) continue; // 土日スキップ
        
        timeRecords.push({
          employeeId,
          date,
          clockIn: new Date(date.getTime() + 9 * 60 * 60 * 1000), // 9:00
          clockOut: new Date(date.getTime() + 22 * 60 * 60 * 1000), // 22:00
          breakMinutes: 60,
          recordType: 'ic_card' as const
        });
      }

      for (const record of timeRecords) {
        await db.addTimeRecord(record);
      }

      // 3. MCPツール実行
      const result = await server['handleCalculateCompliancePayroll']({
        employeeId,
        month: '2024-07'
      });

      // 4. 結果検証
      const response = result.content[0].text;
      expect(response).toContain('💰 統合給与計算結果');
      expect(response).toContain('残業過多太郎');
      expect(response).toContain('⚠️ 月間残業時間が法定上限を超過');
      expect(response).toContain('high');
    });

    it('存在しない従業員IDでエラーが発生する', async () => {
      await expect(
        server['handleCalculateCompliancePayroll']({
          employeeId: 'NONEXISTENT',
          month: '2024-07'
        })
      ).rejects.toThrow('Employee not found');
    });
  });

  describe('generate_payslip ツールテスト', () => {
    it('詳細な給与明細が生成される', async () => {
      // 1. 従業員データ準備
      const employeeData = {
        name: '給与明細テスト花子',
        department: '経理部',
        position: '主任',
        hourlyRate: 3500,
        joinDate: new Date('2018-04-01'),
        isActive: true,
        contractType: 'full_time' as const,
        salaryType: 'hourly' as const,
        taxInfo: {
          dependents: 2,
          taxRate: 0.10,
          isDisabled: false,
          isSingleParent: false,
          hasSpouseDeduction: true
        }
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 勤怠データ準備
      const timeRecord = {
        employeeId,
        date: new Date('2024-07-01'),
        clockIn: new Date('2024-07-01T09:00:00'),
        clockOut: new Date('2024-07-01T19:00:00'),
        breakMinutes: 60,
        recordType: 'ic_card' as const
      };

      await db.addTimeRecord(timeRecord);

      // 3. MCPツール実行
      const result = await server['handleGeneratePayslip']({
        employeeId,
        month: '2024-07'
      });

      // 4. 結果検証
      const response = result.content[0].text;
      expect(response).toContain('📄 給与明細書');
      expect(response).toContain('給与明細テスト花子');
      expect(response).toContain('対象月: 2024-07');
      expect(response).toContain('💰 支給項目:');
      expect(response).toContain('基本給:');
      expect(response).toContain('時間外手当:');
      expect(response).toContain('📉 控除項目:');
      expect(response).toContain('所得税:');
      expect(response).toContain('住民税:');
      expect(response).toContain('健康保険:');
      expect(response).toContain('厚生年金:');
      expect(response).toContain('雇用保険:');
      expect(response).toContain('🧾 勤怠サマリー:');
      expect(response).toContain('💸 差引支給額:');
    });

    it('深夜労働手当が明細に表示される', async () => {
      // 1. 従業員データ準備
      const employeeData = {
        name: '深夜勤務者',
        department: '運用部',
        position: 'オペレーター',
        hourlyRate: 2000,
        joinDate: new Date('2021-04-01'),
        isActive: true,
        contractType: 'full_time' as const,
        salaryType: 'hourly' as const
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 深夜勤務データ準備
      const timeRecord = {
        employeeId,
        date: new Date('2024-07-01'),
        clockIn: new Date('2024-07-01T22:00:00'),
        clockOut: new Date('2024-07-02T06:00:00'),
        breakMinutes: 60,
        recordType: 'ic_card' as const
      };

      await db.addTimeRecord(timeRecord);

      // 3. MCPツール実行
      const result = await server['handleGeneratePayslip']({
        employeeId,
        month: '2024-07'
      });

      // 4. 結果検証
      const response = result.content[0].text;
      expect(response).toContain('深夜手当:');
      expect(response).toContain('深夜時間:');
    });
  });

  describe('validate_labor_compliance ツールテスト', () => {
    it('労働基準法準拠状況が正確に表示される', async () => {
      // 1. 従業員データ準備
      const employeeData = {
        name: 'コンプライアンステスト太郎',
        department: '法務部',
        position: '法務',
        hourlyRate: 3000,
        joinDate: new Date('2019-04-01'),
        isActive: true,
        contractType: 'full_time' as const,
        salaryType: 'hourly' as const
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 適法な勤怠データ準備
      const timeRecord = {
        employeeId,
        date: new Date('2024-07-01'),
        clockIn: new Date('2024-07-01T09:00:00'),
        clockOut: new Date('2024-07-01T18:00:00'),
        breakMinutes: 60,
        recordType: 'ic_card' as const
      };

      await db.addTimeRecord(timeRecord);

      // 3. MCPツール実行
      const result = await server['handleValidateLaborCompliance']({
        employeeId,
        month: '2024-07'
      });

      // 4. 結果検証
      const response = result.content[0].text;
      expect(response).toContain('⚖️ 労働基準法準拠チェック');
      expect(response).toContain('コンプライアンステスト太郎');
      expect(response).toContain('📊 準拠状況:');
      expect(response).toContain('✅ 適合');
      expect(response).toContain('リスクレベル: low');
      expect(response).toContain('✅ 労働基準法違反なし');
    });

    it('違反がある場合の詳細な表示', async () => {
      // 1. 従業員データ準備
      const employeeData = {
        name: '違反者太郎',
        department: '営業部',
        position: '営業',
        hourlyRate: 2500,
        joinDate: new Date('2020-04-01'),
        isActive: true,
        contractType: 'full_time' as const,
        salaryType: 'hourly' as const
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 違反レベルの勤怠データ準備
      const timeRecords = [];
      for (let day = 1; day <= 15; day++) {
        const date = new Date(`2024-07-${day.toString().padStart(2, '0')}`);
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        timeRecords.push({
          employeeId,
          date,
          clockIn: new Date(date.getTime() + 9 * 60 * 60 * 1000),
          clockOut: new Date(date.getTime() + 23 * 60 * 60 * 1000), // 23:00まで
          breakMinutes: 60,
          recordType: 'ic_card' as const
        });
      }

      for (const record of timeRecords) {
        await db.addTimeRecord(record);
      }

      // 3. MCPツール実行
      const result = await server['handleValidateLaborCompliance']({
        employeeId,
        month: '2024-07'
      });

      // 4. 結果検証
      const response = result.content[0].text;
      expect(response).toContain('❌ 違反あり');
      expect(response).toContain('overtime_limit');
      expect(response).toContain('労働基準法第36条');
      expect(response).toContain('💡 改善提案:');
    });
  });

  describe('get_payroll_report ツールテスト', () => {
    it('月次給与レポートが正しく生成される', async () => {
      // 1. 複数従業員データ準備
      const employees = [
        { name: 'レポート太郎', hourlyRate: 3000, department: '開発部' },
        { name: 'レポート花子', hourlyRate: 2500, department: '営業部' },
        { name: 'レポート次郎', hourlyRate: 3500, department: '管理部' }
      ];

      const employeeIds = [];
      for (const emp of employees) {
        const employeeData = {
          name: emp.name,
          department: emp.department,
          position: '社員',
          hourlyRate: emp.hourlyRate,
          joinDate: new Date('2020-04-01'),
          isActive: true,
          contractType: 'full_time' as const,
          salaryType: 'hourly' as const
        };
        const id = await db.addEmployee(employeeData);
        employeeIds.push(id);
      }

      // 2. 各従業員の勤怠データ準備
      for (const id of employeeIds) {
        const timeRecord = {
          employeeId: id,
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card' as const
        };
        await db.addTimeRecord(timeRecord);
      }

      // 3. MCPツール実行
      const result = await server['handleGetPayrollReport']({
        month: '2024-07'
      });

      // 4. 結果検証
      const response = result.content[0].text;
      expect(response).toContain('📊 月次給与レポート');
      expect(response).toContain('対象月: 2024-07');
      expect(response).toContain('👥 従業員数: 3名');
      expect(response).toContain('💰 給与総額:');
      expect(response).toContain('基本給合計:');
      expect(response).toContain('残業代合計:');
      expect(response).toContain('総支給額:');
      expect(response).toContain('⚖️ 労働基準法準拠状況:');
    });

    it('違反がある場合のレポート表示', async () => {
      // 1. 従業員データ準備
      const employeeData = {
        name: '違反レポート太郎',
        department: '営業部',
        position: '営業',
        hourlyRate: 2500,
        joinDate: new Date('2020-04-01'),
        isActive: true,
        contractType: 'full_time' as const,
        salaryType: 'hourly' as const
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 違反レベルの勤怠データ準備
      const timeRecords = [];
      for (let day = 1; day <= 20; day++) {
        const date = new Date(`2024-07-${day.toString().padStart(2, '0')}`);
        if (date.getDay() === 0 || date.getDay() === 6) continue;
        
        timeRecords.push({
          employeeId,
          date,
          clockIn: new Date(date.getTime() + 9 * 60 * 60 * 1000),
          clockOut: new Date(date.getTime() + 23 * 60 * 60 * 1000),
          breakMinutes: 60,
          recordType: 'ic_card' as const
        });
      }

      for (const record of timeRecords) {
        await db.addTimeRecord(record);
      }

      // 3. MCPツール実行
      const result = await server['handleGetPayrollReport']({
        month: '2024-07'
      });

      // 4. 結果検証
      const response = result.content[0].text;
      expect(response).toContain('📊 月次給与レポート');
      expect(response).toContain('⚠️');
      expect(response).toContain('違反レポート太郎');
    });
  });

  describe('MCPツールのエラーハンドリング', () => {
    it('不正なパラメータでエラーが発生する', async () => {
      // 空の employeeId
      await expect(
        server['handleCalculateCompliancePayroll']({
          employeeId: '',
          month: '2024-07'
        })
      ).rejects.toThrow();

      // 不正な月形式
      await expect(
        server['handleCalculateCompliancePayroll']({
          employeeId: 'EMP001',
          month: 'invalid-month'
        })
      ).rejects.toThrow();
    });

    it('データベース接続エラーの処理', async () => {
      // データベースを閉じる
      await db.close();

      // 新しいリクエストは失敗する
      await expect(
        server['handleCalculateCompliancePayroll']({
          employeeId: 'EMP001',
          month: '2024-07'
        })
      ).rejects.toThrow();
    });
  });

  describe('MCPツールのパフォーマンス', () => {
    it('大量データでの応答時間が許容範囲内', async () => {
      // 1. 大量従業員データ準備
      const employeeCount = 5;
      const employeeIds = [];

      for (let i = 0; i < employeeCount; i++) {
        const employeeData = {
          name: `パフォーマンステスト従業員${i + 1}`,
          department: `部署${i % 3 + 1}`,
          position: '社員',
          hourlyRate: 2000 + (i * 100),
          joinDate: new Date('2020-04-01'),
          isActive: true,
          contractType: 'full_time' as const,
          salaryType: 'hourly' as const
        };
        const id = await db.addEmployee(employeeData);
        employeeIds.push(id);
      }

      // 2. 各従業員の勤怠データ準備
      for (const id of employeeIds) {
        const timeRecord = {
          employeeId: id,
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card' as const
        };
        await db.addTimeRecord(timeRecord);
      }

      // 3. パフォーマンス測定
      const startTime = Date.now();
      const result = await server['handleGetPayrollReport']({
        month: '2024-07'
      });
      const endTime = Date.now();

      // 4. 結果検証
      expect(result.content[0].text).toContain('📊 月次給与レポート');
      expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
      
      console.log(`MCPツールパフォーマンス: ${employeeCount}名の処理時間 ${endTime - startTime}ms`);
    });
  });
});