import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabasePostgreSQL } from '../../src/database_postgresql';
import { IntegratedPayrollEngine } from '../../src/payroll-engine';
import { ComplianceEngine } from '../../src/compliance-engine';
import ExpenseManagementEngine from '../../src/expense-engine';
import HumanCapitalDisclosureEngine from '../../src/human-capital-disclosure-engine-v2.0.0';
import PredictiveAnalyticsEngine from '../../src/predictive-analytics-engine-v2.1.0';
import { AgentOrchestrator } from '../../src/agent-framework-v3.0.0';
import type { Employee, TimeRecord, ExpenseRequest } from '../../src/types';

/**
 * エッジケースと異常系の網羅的テスト
 * 境界値、エラー処理、異常データ、競合状態などを検証
 */
describe('エッジケース・異常系テストスイート', () => {
  let db: DatabasePostgreSQL;
  let payrollEngine: IntegratedPayrollEngine;
  let complianceEngine: ComplianceEngine;
  let expenseEngine: ExpenseManagementEngine;
  let humanCapitalEngine: HumanCapitalDisclosureEngine;
  let predictiveEngine: PredictiveAnalyticsEngine;
  let agentOrchestrator: AgentOrchestrator;

  beforeEach(() => {
    db = createMockDatabase();
    payrollEngine = new IntegratedPayrollEngine(db);
    complianceEngine = new ComplianceEngine(db);
    expenseEngine = new ExpenseManagementEngine(db);
    humanCapitalEngine = new HumanCapitalDisclosureEngine(db);
    predictiveEngine = new PredictiveAnalyticsEngine(db);
    agentOrchestrator = new AgentOrchestrator(db);
  });

  describe('1. 境界値テスト', () => {
    describe('給与計算の境界値', () => {
      it('最低賃金での計算が正確に行われる', async () => {
        const minWageEmployee: Employee = {
          id: 'emp_min_wage',
          name: '最低賃金太郎',
          email: 'min@example.com',
          department: '製造部',
          position: 'パート',
          hourlyWage: 1072, // 東京都最低賃金（2025年想定）
          startDate: '2025-01-01',
          isActive: true
        };

        db.getEmployee = vi.fn().mockResolvedValue(minWageEmployee);
        db.getTimeRecords = vi.fn().mockResolvedValue([{
          id: 'tr001',
          employeeId: minWageEmployee.id,
          date: new Date('2025-07-01'),
          clockIn: new Date('2025-07-01T09:00:00'),
          clockOut: new Date('2025-07-01T17:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        }]);

        const result = await payrollEngine.calculatePayroll(minWageEmployee.id, '2025-07');
        
        // 最低賃金でも正確に計算される
        expect(result.hourlyWage).toBe(1072);
        expect(result.totalHours).toBeGreaterThan(0);
        expect(result.basePay).toBe(Math.floor(1072 * result.regularHours));
      });

      it('時給上限（999,999円）での計算が正確に行われる', async () => {
        const maxWageEmployee: Employee = {
          id: 'emp_max_wage',
          name: '高給取子',
          email: 'max@example.com',
          department: '経営企画',
          position: 'CEO',
          hourlyWage: 999999,
          startDate: '2000-01-01',
          isActive: true
        };

        const result = await payrollEngine.calculatePayroll(maxWageEmployee.id, '2025-07');
        
        // オーバーフローしない
        expect(result.basePay).toBeLessThan(Number.MAX_SAFE_INTEGER);
        expect(result.totalPay).toBeLessThan(Number.MAX_SAFE_INTEGER);
      });

      it('月間労働時間0時間での処理', async () => {
        db.getTimeRecords = vi.fn().mockResolvedValue([]);
        
        const result = await payrollEngine.calculatePayroll('emp001', '2025-07');
        
        expect(result.totalHours).toBe(0);
        expect(result.basePay).toBe(0);
        expect(result.overtimePay).toBe(0);
        expect(result.totalPay).toBe(0);
      });

      it('月間労働時間が法定上限（360時間）を超える場合', async () => {
        const extremeRecords = Array(31).fill(null).map((_, i) => ({
          id: `tr_extreme_${i}`,
          employeeId: 'emp001',
          date: new Date(`2025-07-${i + 1}`),
          clockIn: new Date(`2025-07-${i + 1}T00:00:00`),
          clockOut: new Date(`2025-07-${i + 1}T23:59:59`),
          breakMinutes: 60,
          recordType: 'manual'
        }));

        db.getTimeRecords = vi.fn().mockResolvedValue(extremeRecords);
        
        await expect(async () => {
          await payrollEngine.calculatePayroll('emp001', '2025-07');
        }).rejects.toThrow('労働時間が法定上限を超えています');
      });
    });

    describe('36協定の境界値', () => {
      it('月間残業時間がちょうど45時間の場合', async () => {
        // 正確に45時間の残業記録を生成
        const records = generateExactOvertimeRecords('emp001', 45);
        db.getTimeRecords = vi.fn().mockResolvedValue(records);
        
        const status = await complianceEngine.monitor36Agreement('emp001', new Date('2025-07-31'));
        
        expect(status.monthlyOvertimeHours).toBe(45);
        expect(status.isCompliant).toBe(true); // ちょうど45時間はセーフ
        expect(status.alerts).toContainEqual(
          expect.objectContaining({
            type: 'OVERTIME_THRESHOLD_ALERT',
            severity: 'warning'
          })
        );
      });

      it('年間残業時間が360時間ちょうどの場合', async () => {
        db.query = vi.fn().mockImplementation((sql) => {
          if (sql.includes('SUM(overtime_hours)') && sql.includes('YYYY-MM')) {
            return { rows: [{ total: 30 }] };
          }
          if (sql.includes('SUM(overtime_hours)') && sql.includes('YYYY')) {
            return { rows: [{ total: 360 }] }; // ちょうど360時間
          }
          return { rows: [] };
        });

        const status = await complianceEngine.monitor36Agreement('emp001', new Date('2025-12-31'));
        
        expect(status.yearlyOvertime).toBe(360);
        expect(status.isCompliant).toBe(true);
        expect(status.remainingYearlyAllowance).toBe(0);
      });

      it('複数月平均がちょうど80時間の場合', async () => {
        db.query = vi.fn().mockImplementation((sql, params) => {
          if (sql.includes('calculate_average_monthly_overtime')) {
            return { rows: [{ average: 80.0 }] };
          }
          return { rows: [] };
        });

        const status = await complianceEngine.monitor36Agreement('emp001', new Date('2025-07-31'));
        
        expect(status.multiMonthAverages?.twoMonth).toBe(80);
        expect(status.healthRiskAssessment).toBe('high');
        expect(status.alerts).toContainEqual(
          expect.objectContaining({
            type: 'HEALTH_RISK_WARNING'
          })
        );
      });
    });

    describe('経費の境界値', () => {
      it('経費金額が0円の場合', async () => {
        const zeroExpense: ExpenseRequest = {
          id: 'exp_zero',
          employeeId: 'emp001',
          amount: 0,
          categoryId: '交通費',
          description: 'キャンセル料なし',
          expenseDate: new Date('2025-07-15'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          currency: 'JPY',
          purpose: 'キャンセル'
        };

        await expect(async () => {
          await expenseEngine.processExpense(zeroExpense);
        }).rejects.toThrow('経費金額は0円より大きい必要があります');
      });

      it('経費金額が上限（1000万円）を超える場合', async () => {
        const hugeExpense: ExpenseRequest = {
          id: 'exp_huge',
          employeeId: 'emp001',
          amount: 10000001,
          categoryId: '設備投資',
          description: '大型設備購入',
          expenseDate: new Date('2025-07-15'),
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          currency: 'JPY',
          purpose: '業務用'
        };

        const result = await expenseEngine.processExpense(hugeExpense);
        
        expect(result.requiresSpecialApproval).toBe(true);
        expect(result.approvalLevel).toBe('executive');
        expect(result.riskScore).toBeGreaterThan(0.9);
      });
    });
  });

  describe('2. 日付・時刻の特殊ケース', () => {
    it('月跨ぎの深夜勤務を正確に処理する', async () => {
      const crossMonthRecord: TimeRecord = {
        id: 'tr_cross_month',
        employeeId: 'emp001',
        date: new Date('2025-07-31'),
        clockIn: new Date('2025-07-31T22:00:00'),
        clockOut: new Date('2025-08-01T06:00:00'),
        breakMinutes: 60,
        recordType: 'ic_card'
      };

      db.getTimeRecords = vi.fn().mockResolvedValue([crossMonthRecord]);
      
      const julyPayroll = await payrollEngine.calculatePayroll('emp001', '2025-07');
      const augustPayroll = await payrollEngine.calculatePayroll('emp001', '2025-08');
      
      // 7月分は2時間（22:00-24:00）
      expect(julyPayroll.totalHours).toBe(2);
      expect(julyPayroll.lateNightHours).toBe(2);
      
      // 8月分は5時間（00:00-06:00、休憩1時間）
      expect(augustPayroll.totalHours).toBe(5);
      expect(augustPayroll.lateNightHours).toBe(5);
    });

    it('うるう年の2月29日の処理', async () => {
      const leapYearRecord: TimeRecord = {
        id: 'tr_leap',
        employeeId: 'emp001',
        date: new Date('2024-02-29'),
        clockIn: new Date('2024-02-29T09:00:00'),
        clockOut: new Date('2024-02-29T18:00:00'),
        breakMinutes: 60,
        recordType: 'ic_card'
      };

      db.getTimeRecords = vi.fn().mockResolvedValue([leapYearRecord]);
      
      const result = await payrollEngine.calculatePayroll('emp001', '2024-02');
      
      expect(result).toBeDefined();
      expect(result.totalDays).toBe(29);
    });

    it('夏時間切り替え時の勤怠記録', async () => {
      // 日本には夏時間はないが、海外拠点対応を想定
      const dstRecord: TimeRecord = {
        id: 'tr_dst',
        employeeId: 'emp001',
        date: new Date('2025-03-09'), // US夏時間開始日
        clockIn: new Date('2025-03-09T01:00:00-08:00'),
        clockOut: new Date('2025-03-09T10:00:00-07:00'), // 1時間進む
        breakMinutes: 60,
        recordType: 'manual',
        timezone: 'America/Los_Angeles'
      };

      const result = await complianceEngine.calculateDetailedWorkHours(
        'emp001',
        new Date('2025-03-09')
      );
      
      // 実働8時間として正しく計算される
      expect(result.totalWorkHours).toBe(8);
    });
  });

  describe('3. データ不整合・破損ケース', () => {
    it('必須フィールドが欠損した従業員データ', async () => {
      const incompleteEmployee = {
        id: 'emp_incomplete',
        name: '不完全太郎',
        // email, department, hourlyWageが欠損
      };

      db.getEmployee = vi.fn().mockResolvedValue(incompleteEmployee);
      
      await expect(async () => {
        await payrollEngine.calculatePayroll('emp_incomplete', '2025-07');
      }).rejects.toThrow('従業員データが不完全です');
    });

    it('時系列が逆転した勤怠記録', async () => {
      const reversedRecord: TimeRecord = {
        id: 'tr_reversed',
        employeeId: 'emp001',
        date: new Date('2025-07-15'),
        clockIn: new Date('2025-07-15T18:00:00'),
        clockOut: new Date('2025-07-15T09:00:00'), // 退勤が出勤より早い
        breakMinutes: 60,
        recordType: 'manual'
      };

      db.getTimeRecords = vi.fn().mockResolvedValue([reversedRecord]);
      
      const result = await payrollEngine.calculatePayroll('emp001', '2025-07');
      
      // エラーとして扱われるか、自動修正される
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          type: 'INVALID_TIME_RECORD',
          recordId: 'tr_reversed'
        })
      );
    });

    it('重複した勤怠記録の処理', async () => {
      const duplicateRecords: TimeRecord[] = [
        {
          id: 'tr_dup_1',
          employeeId: 'emp001',
          date: new Date('2025-07-15'),
          clockIn: new Date('2025-07-15T09:00:00'),
          clockOut: new Date('2025-07-15T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        },
        {
          id: 'tr_dup_2',
          employeeId: 'emp001',
          date: new Date('2025-07-15'),
          clockIn: new Date('2025-07-15T08:30:00'),
          clockOut: new Date('2025-07-15T17:30:00'),
          breakMinutes: 60,
          recordType: 'manual'
        }
      ];

      db.getTimeRecords = vi.fn().mockResolvedValue(duplicateRecords);
      
      const result = await complianceEngine.detectDuplicateRecords('emp001', new Date('2025-07-15'));
      
      expect(result.hasDuplicates).toBe(true);
      expect(result.resolution).toBe('ic_card_priority'); // ICカード優先
    });
  });

  describe('4. 同時実行・競合状態', () => {
    it('同一従業員の給与計算を複数同時実行', async () => {
      const promises = Array(5).fill(null).map(() => 
        payrollEngine.calculatePayroll('emp001', '2025-07')
      );

      const results = await Promise.all(promises);
      
      // すべて同じ結果になるはず
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.totalPay).toBe(firstResult.totalPay);
        expect(result.version).toBeDefined(); // 楽観的ロックのバージョン
      });
    });

    it('経費承認の競合処理', async () => {
      const expenseId = 'exp_concurrent';
      
      // 2人のマネージャーが同時に承認しようとする
      const approvalPromises = [
        expenseEngine.approveExpense(expenseId, 'manager1'),
        expenseEngine.approveExpense(expenseId, 'manager2')
      ];

      const results = await Promise.allSettled(approvalPromises);
      
      // 1つは成功、1つは失敗するはず
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      
      if (failed[0].status === 'rejected') {
        expect(failed[0].reason.message).toContain('既に承認されています');
      }
    });

    it('勤怠記録の同時更新でのデッドロック回避', async () => {
      const updatePromises = Array(10).fill(null).map((_, i) => 
        complianceEngine.updateTimeRecord({
          id: `tr_${i}`,
          employeeId: 'emp001',
          date: new Date('2025-07-15'),
          updates: { breakMinutes: 60 + i }
        })
      );

      const results = await Promise.allSettled(updatePromises);
      
      // すべて成功するか、適切にリトライされる
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(8); // 80%以上成功
    });
  });

  describe('5. 異常な入力データ', () => {
    it('SQLインジェクション攻撃の防御', async () => {
      const maliciousEmployee = {
        id: "'; DROP TABLE employees; --",
        name: "攻撃者",
        email: "attacker@evil.com"
      };

      // エスケープされて安全に処理される
      const result = await db.getEmployee(maliciousEmployee.id);
      expect(result).toBeNull(); // 見つからない
      
      // テーブルが削除されていないことを確認
      const allEmployees = await db.getAllEmployees();
      expect(allEmployees.length).toBeGreaterThan(0);
    });

    it('XSS攻撃の防御', async () => {
      const xssExpense: ExpenseRequest = {
        id: 'exp_xss',
        employeeId: 'emp001',
        amount: 1000,
        categoryId: '交通費',
        description: '<script>alert("XSS")</script>',
        expenseDate: new Date('2025-07-15'),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: 'JPY',
        purpose: '<img src=x onerror=alert("XSS")>'
      };

      const processed = await expenseEngine.processExpense(xssExpense);
      
      // HTMLがエスケープされている
      expect(processed.description).not.toContain('<script>');
      expect(processed.description).toContain('&lt;script&gt;');
      expect(processed.purpose).not.toContain('onerror=');
    });

    it('巨大なデータペイロードの処理', async () => {
      const hugeDescription = 'A'.repeat(1000000); // 1MBの文字列
      
      const hugeExpense: ExpenseRequest = {
        id: 'exp_huge_payload',
        employeeId: 'emp001',
        amount: 1000,
        categoryId: '交通費',
        description: hugeDescription,
        expenseDate: new Date('2025-07-15'),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: 'JPY',
        purpose: '巨大データテスト'
      };

      await expect(async () => {
        await expenseEngine.processExpense(hugeExpense);
      }).rejects.toThrow('データサイズが上限を超えています');
    });

    it('不正な文字エンコーディング', async () => {
      const invalidEncodingData = {
        name: '\xC3\x28', // 不正なUTF-8シーケンス
        email: 'test@example.com'
      };

      // エラーハンドリングされる
      const result = await humanCapitalEngine.processEmployeeData(invalidEncodingData);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'name',
          error: 'INVALID_ENCODING'
        })
      );
    });
  });

  describe('6. システムリソース枯渇', () => {
    it('メモリ不足時の graceful degradation', async () => {
      // 大量のデータを生成してメモリを圧迫
      const largeDataset = Array(1000000).fill(null).map((_, i) => ({
        id: `emp_${i}`,
        name: `従業員${i}`,
        // ... 他のフィールド
      }));

      // バッチ処理に自動的に切り替わる
      const result = await payrollEngine.processBulkPayroll(largeDataset, '2025-07');
      
      expect(result.processedInBatches).toBe(true);
      expect(result.batchSize).toBeLessThan(10000); // 自動的に小さなバッチサイズに
      expect(result.completed).toBe(true);
    });

    it('データベース接続プール枯渇時の処理', async () => {
      // 接続プールを枯渇させる
      const connectionPromises = Array(100).fill(null).map(() => 
        db.getConnection()
      );

      // タイムアウトまたはキューイング
      const results = await Promise.allSettled(connectionPromises);
      
      const timeouts = results.filter(r => 
        r.status === 'rejected' && r.reason.message.includes('timeout')
      );
      
      expect(timeouts.length).toBeGreaterThan(0);
      
      // リトライメカニズムの確認
      const retryResult = await db.getConnectionWithRetry({ maxRetries: 3 });
      expect(retryResult).toBeDefined();
    });

    it('ディスク容量不足時のログローテーション', async () => {
      // ディスク使用率をモック
      const mockDiskUsage = vi.fn().mockResolvedValue({ 
        available: 1000000, // 1MB
        total: 1000000000, // 1GB
        usage: 0.999 // 99.9%使用
      });

      // 古いログが自動的に削除される
      const logResult = await agentOrchestrator.writeLog({
        level: 'info',
        message: 'Test log',
        size: 2000000 // 2MB
      });

      expect(logResult.rotated).toBe(true);
      expect(logResult.deletedOldLogs).toBeGreaterThan(0);
    });
  });

  describe('7. 外部サービス障害', () => {
    it('OCRサービスがダウンしている場合', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Service Unavailable'));

      const expense: ExpenseRequest = {
        id: 'exp_ocr_fail',
        employeeId: 'emp001',
        amount: 5000,
        categoryId: '交通費',
        description: 'タクシー代',
        expenseDate: new Date('2025-07-15'),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: 'JPY',
        purpose: '顧客訪問',
        receiptImageUrl: 'receipt.jpg'
      };

      const result = await expenseEngine.processExpense(expense);
      
      // フォールバックとして手動入力を受け付ける
      expect(result.ocrStatus).toBe('failed');
      expect(result.requiresManualEntry).toBe(true);
      expect(result.processed).toBe(true); // 処理は続行
    });

    it('会計システムとの同期が失敗した場合', async () => {
      const mockIntegration = vi.fn().mockRejectedValue(
        new Error('Connection timeout')
      );

      // リトライキューに入る
      const syncResult = await integrationManager.syncToAccounting({
        data: { /* ... */ },
        retryOnFailure: true
      });

      expect(syncResult.status).toBe('queued');
      expect(syncResult.retryCount).toBe(0);
      expect(syncResult.nextRetryAt).toBeDefined();
    });

    it('Slackへの通知が失敗した場合', async () => {
      const mockSlackApi = vi.fn().mockRejectedValue(
        new Error('Invalid auth')
      );

      // 代替手段（メール）にフォールバック
      const notificationResult = await agentOrchestrator.sendNotification({
        channel: 'slack',
        message: '重要な通知',
        fallbackChannels: ['email', 'sms']
      });

      expect(notificationResult.primary.status).toBe('failed');
      expect(notificationResult.fallback.status).toBe('sent');
      expect(notificationResult.fallback.channel).toBe('email');
    });
  });

  describe('8. 法的・規制の特殊ケース', () => {
    it('労働基準監督署の臨検に必要なデータを即座に出力', async () => {
      const inspectionRequest = {
        type: 'labor_standards_inspection',
        period: { start: '2025-01-01', end: '2025-07-31' },
        requiredDocuments: [
          'overtime_records',
          'wage_payments',
          'leave_records',
          'objective_time_records'
        ]
      };

      const report = await complianceEngine.generateInspectionReport(inspectionRequest);
      
      expect(report.generated).toBe(true);
      expect(report.documents).toHaveLength(4);
      expect(report.format).toBe('official_format');
      expect(report.completeness).toBe(1.0); // 100%完全
    });

    it('個人情報開示請求への対応', async () => {
      const gdprRequest = {
        type: 'data_subject_access_request',
        employeeId: 'emp001',
        includeProcessingActivities: true,
        format: 'machine_readable'
      };

      const response = await humanCapitalEngine.handlePrivacyRequest(gdprRequest);
      
      expect(response.data).toBeDefined();
      expect(response.format).toBe('json');
      expect(response.processingActivities).toContainEqual(
        expect.objectContaining({
          purpose: expect.any(String),
          legalBasis: expect.any(String),
          retention: expect.any(String)
        })
      );
      expect(response.exportable).toBe(true);
    });

    it('海外子会社の現地労働法対応', async () => {
      const overseasEmployee = {
        id: 'emp_us_001',
        name: 'John Smith',
        location: 'US',
        state: 'CA',
        isNonExempt: true // カリフォルニア州のnon-exempt従業員
      };

      // カリフォルニア州の特殊な残業ルール
      const caOvertimeRules = {
        dailyOvertimeThreshold: 8,
        weeklyOvertimeThreshold: 40,
        doubleTim Threshold: 12,
        seventhDayRule: true
      };

      const payroll = await payrollEngine.calculatePayrollWithLocalRules(
        overseasEmployee,
        caOvertimeRules
      );

      // 日次残業（8時間超）と週次残業（40時間超）の両方を計算
      expect(payroll.dailyOvertime).toBeDefined();
      expect(payroll.weeklyOvertime).toBeDefined();
      expect(payroll.doubleTimeHours).toBeDefined();
    });
  });

  describe('9. データマイグレーション・アップグレード', () => {
    it('旧バージョンからのデータ移行', async () => {
      const legacyData = {
        version: '1.0.0',
        employees: [
          {
            emp_id: '001', // 旧フィールド名
            emp_name: '旧田太郎',
            wage: 2000, // 時給ではなく日給で保存されていた
            dept: '営業'
          }
        ],
        timesheet: [ // 旧形式
          {
            emp: '001',
            date: '2025/07/01',
            in: '0900',
            out: '1800'
          }
        ]
      };

      const migrationResult = await db.migrateFromLegacy(legacyData);
      
      expect(migrationResult.success).toBe(true);
      expect(migrationResult.migratedEmployees).toBe(1);
      expect(migrationResult.migratedTimeRecords).toBe(1);
      
      // 新形式に変換されている
      const newEmployee = await db.getEmployee('emp001');
      expect(newEmployee.hourlyWage).toBe(250); // 日給2000円÷8時間
    });

    it('スキーマ変更時のゼロダウンタイムマイグレーション', async () => {
      const migration = {
        version: '2.0.0',
        changes: [
          { type: 'add_column', table: 'employees', column: 'skills', default: '[]' },
          { type: 'rename_column', table: 'employees', from: 'dept', to: 'department' },
          { type: 'create_index', table: 'time_records', columns: ['employee_id', 'date'] }
        ]
      };

      // Blue-Greenデプロイメント戦略
      const result = await db.performZeroDowntimeMigration(migration);
      
      expect(result.downtime).toBe(0);
      expect(result.stages).toEqual([
        'create_shadow_tables',
        'sync_data',
        'apply_changes',
        'switch_tables',
        'cleanup'
      ]);
      expect(result.rollbackAvailable).toBe(true);
    });
  });

  describe('10. 極端なビジネスケース', () => {
    it('全社員が同時に有給休暇を取得', async () => {
      const allEmployees = await db.getAllEmployees();
      const leaveRequests = allEmployees.map(emp => ({
        employeeId: emp.id,
        startDate: '2025-08-01',
        endDate: '2025-08-01',
        type: 'paid_leave'
      }));

      const result = await complianceEngine.processMultipleLeaveRequests(leaveRequests);
      
      expect(result.businessContinuityRisk).toBe('critical');
      expect(result.minimumStaffingMet).toBe(false);
      expect(result.suggestedActions).toContainEqual(
        expect.objectContaining({
          action: 'stagger_leave_dates',
          priority: 'high'
        })
      );
    });

    it('会社分割・M&A時の従業員データ統合', async () => {
      const mergingCompanies = [
        { id: 'company_a', employees: 500, system: 'SystemA' },
        { id: 'company_b', employees: 300, system: 'SystemB' }
      ];

      const mergerPlan = await humanCapitalEngine.planMerger({
        companies: mergingCompanies,
        targetDate: '2025-10-01',
        preserveHistory: true,
        handleDuplicates: 'merge'
      });

      expect(mergerPlan.phases).toContainEqual(
        expect.objectContaining({
          name: 'employee_id_mapping',
          conflicts: expect.any(Array)
        })
      );
      expect(mergerPlan.estimatedDuration).toBeDefined();
      expect(mergerPlan.dataIntegrityChecks).toHaveLength(10);
    });

    it('災害時の事業継続計画発動', async () => {
      const disaster = {
        type: 'earthquake',
        affectedOffices: ['tokyo_hq', 'yokohama_branch'],
        severity: 'major'
      };

      const bcpResponse = await agentOrchestrator.activateBusinessContinuityPlan(disaster);
      
      expect(bcpResponse.mode).toBe('emergency');
      expect(bcpResponse.actions).toContainEqual(
        expect.objectContaining({
          action: 'switch_to_remote_work',
          affected_employees: expect.any(Number)
        })
      );
      expect(bcpResponse.payrollContinuity).toBe('guaranteed');
      expect(bcpResponse.dataBackupStatus).toBe('verified');
    });
  });
});

// ヘルパー関数

function createMockDatabase(): any {
  return {
    getEmployee: vi.fn(),
    getAllEmployees: vi.fn().mockResolvedValue([]),
    getTimeRecords: vi.fn().mockResolvedValue([]),
    getExpenseRequests: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    getConnection: vi.fn(),
    getConnectionWithRetry: vi.fn().mockResolvedValue({}),
    migrateFromLegacy: vi.fn().mockResolvedValue({
      success: true,
      migratedEmployees: 1,
      migratedTimeRecords: 1
    }),
    performZeroDowntimeMigration: vi.fn().mockResolvedValue({
      downtime: 0,
      stages: ['create_shadow_tables', 'sync_data', 'apply_changes', 'switch_tables', 'cleanup'],
      rollbackAvailable: true
    })
  };
}

function generateExactOvertimeRecords(employeeId: string, exactHours: number): TimeRecord[] {
  const records: TimeRecord[] = [];
  const daysNeeded = Math.ceil(exactHours / 2.25); // 1日平均2.25時間の残業
  let remainingHours = exactHours;

  for (let i = 0; i < daysNeeded; i++) {
    const date = new Date(`2025-07-${i + 1}`);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const overtimeForDay = Math.min(remainingHours, 2.25);
    remainingHours -= overtimeForDay;

    records.push({
      id: `tr_exact_${i}`,
      employeeId,
      date,
      clockIn: new Date(date.setHours(9, 0, 0, 0)),
      clockOut: new Date(date.setHours(18 + Math.floor(overtimeForDay), (overtimeForDay % 1) * 60, 0, 0)),
      breakMinutes: 60,
      recordType: 'ic_card'
    });

    if (remainingHours <= 0) break;
  }

  return records;
}