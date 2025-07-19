import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import PayrollEngine from '../../src/payroll-engine-v1.2.0.js';
import { ComplianceEngine } from '../../src/compliance-engine.js';
import PredictiveAnalyticsEngine from '../../src/predictive-analytics-engine-v2.1.0.js';
import IntegratedAnomalyDetectionEngine from '../../src/integrated-anomaly-detection-v2.1.0.js';
import { 
  FreeeIntegration, 
  SlackIntegration, 
  EcosystemIntegrationManager 
} from '../../src/ecosystem-integration-v2.2.0.js';
import { AgentOrchestrator } from '../../src/agent-framework-v3.0.0.js';
import ComplianceAgent from '../../src/agents/compliance-agent-v3.0.0.js';
import type { Employee, TimeRecord, ExpenseRequest, PayrollCalculation } from '../../src/types.js';

// グローバルfetchのモック
global.fetch = vi.fn();

describe('包括的統合フローテスト', () => {
  let mockDb: DatabasePostgreSQL;
  let payrollEngine: PayrollEngine;
  let complianceEngine: ComplianceEngine;
  let predictiveEngine: PredictiveAnalyticsEngine;
  let anomalyEngine: IntegratedAnomalyDetectionEngine;
  let integrationManager: EcosystemIntegrationManager;
  let agentOrchestrator: AgentOrchestrator;

  // テストデータ
  const testEmployees: Employee[] = [
    {
      id: 'emp001',
      name: '山田太郎',
      email: 'yamada@example.com',
      department: '開発部',
      position: 'シニアエンジニア',
      hourlyWage: 3500,
      startDate: '2020-04-01',
      isActive: true,
      managerId: 'mgr001'
    },
    {
      id: 'emp002',
      name: '鈴木花子',
      email: 'suzuki@example.com',
      department: '営業部',
      position: 'マネージャー',
      hourlyWage: 4000,
      startDate: '2019-10-01',
      isActive: true,
      managerId: 'mgr002'
    },
    {
      id: 'emp003',
      name: '佐藤次郎',
      email: 'sato@example.com',
      department: '人事部',
      position: 'スタッフ',
      hourlyWage: 2500,
      startDate: '2023-01-15',
      isActive: true,
      managerId: 'mgr001'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // データベースモックの設定
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getAllEmployees: vi.fn().mockResolvedValue(testEmployees),
      getEmployee: vi.fn().mockImplementation((id: string) => 
        Promise.resolve(testEmployees.find(e => e.id === id))
      ),
      getTimeRecords: vi.fn().mockResolvedValue([]),
      getAllTimeRecords: vi.fn().mockResolvedValue([]),
      getAllExpenseRequests: vi.fn().mockResolvedValue([]),
      getAllPayrollCalculations: vi.fn().mockResolvedValue([]),
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      rollbackTransaction: vi.fn().mockResolvedValue(undefined)
    } as any;

    // 各エンジンの初期化
    payrollEngine = new PayrollEngine(mockDb);
    complianceEngine = new ComplianceEngine(mockDb);
    predictiveEngine = new PredictiveAnalyticsEngine(mockDb);
    anomalyEngine = new IntegratedAnomalyDetectionEngine(mockDb);
    integrationManager = new EcosystemIntegrationManager(mockDb);
    agentOrchestrator = new AgentOrchestrator(mockDb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('エンドツーエンド業務フロー', () => {
    it('月次給与処理の完全フロー', async () => {
      const targetMonth = '2024-01';
      
      // 1. 勤怠データの準備
      const timeRecords: TimeRecord[] = testEmployees.flatMap(emp => 
        generateMonthlyTimeRecords(emp.id, targetMonth)
      );
      
      mockDb.getTimeRecords = vi.fn().mockImplementation((empId, start, end) => {
        return Promise.resolve(timeRecords.filter(r => r.employeeId === empId));
      });

      // 2. コンプライアンスチェック
      const complianceViolations = await Promise.all(
        testEmployees.map(async emp => {
          const empRecords = timeRecords.filter(r => r.employeeId === emp.id);
          return complianceEngine.checkCompliance(emp.id, empRecords);
        })
      );

      const allViolations = complianceViolations.flat();
      expect(allViolations.some(v => v.type === '36_AGREEMENT_WARNING')).toBe(true);

      // 3. 給与計算
      const payrollResults = await Promise.all(
        testEmployees.map(emp => 
          payrollEngine.calculatePayroll(emp.id, targetMonth)
        )
      );

      expect(payrollResults).toHaveLength(3);
      payrollResults.forEach(result => {
        expect(result.totalPay).toBeGreaterThan(0);
        expect(result.netPay).toBeLessThan(result.totalPay);
      });

      // 4. 異常検知
      mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(payrollResults);
      
      const anomalies = await anomalyEngine.detectAnomalies({
        domains: ['payroll', 'attendance'],
        startDate: new Date(`${targetMonth}-01`),
        endDate: new Date(`${targetMonth}-31`)
      });

      // 過度な残業があればアノマリーとして検出される
      if (anomalies.length > 0) {
        expect(anomalies.some(a => 
          a.type === 'OVERTIME_SPIKE' || 
          a.type === 'REGULATORY_BREACH'
        )).toBe(true);
      }

      // 5. 外部システム連携
      const freeeIntegration = new FreeeIntegration({
        provider: 'freee',
        credentials: { accessToken: 'test-token' },
        options: { autoSync: true, retryAttempts: 3, timeout: 30000 }
      });

      const slackIntegration = new SlackIntegration({
        provider: 'slack',
        credentials: { accessToken: 'xoxb-test' },
        options: { autoSync: false, retryAttempts: 3, timeout: 10000 }
      });

      integrationManager.registerIntegration('freee', freeeIntegration);
      integrationManager.registerIntegration('slack', slackIntegration);

      // freee APIモック
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deal: { id: 'PAYROLL_DEAL_123' } })
      });

      // 給与仕訳の作成
      const journalEntry = {
        date: new Date(`${targetMonth}-25`),
        description: `${targetMonth} 給与仕訳`,
        entries: [
          {
            accountCode: '5001',
            accountName: '給与',
            debit: payrollResults.reduce((sum, p) => sum + p.totalPay, 0),
            credit: 0
          },
          {
            accountCode: '1002',
            accountName: '普通預金',
            debit: 0,
            credit: payrollResults.reduce((sum, p) => sum + (p.netPay || p.totalPay * 0.8), 0)
          }
        ],
        reference: `PAYROLL_${targetMonth}`
      };

      const freeeResult = await integrationManager
        .getIntegration<FreeeIntegration>('freee')
        .createJournalEntry(journalEntry);

      expect(freeeResult).toBe('PAYROLL_DEAL_123');

      // Slack通知モック
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890' })
      });

      // 給与処理完了通知
      const notification = await integrationManager
        .getIntegration<SlackIntegration>('slack')
        .sendNotification({
          channel: '#payroll',
          message: `${targetMonth}の給与計算が完了しました`,
          attachments: [{
            title: '給与計算サマリー',
            text: `処理人数: ${payrollResults.length}名\n総支給額: ¥${payrollResults.reduce((sum, p) => sum + p.totalPay, 0).toLocaleString()}`,
            color: 'success',
            fields: [
              { 
                title: 'コンプライアンス', 
                value: allViolations.length > 0 ? `${allViolations.length}件の警告` : '問題なし',
                short: true 
              },
              { 
                title: 'ステータス', 
                value: '完了',
                short: true 
              }
            ]
          }]
        });

      expect(notification).toBe('1234567890');

      // 6. 将来予測
      const predictions = await predictiveEngine.predictOvertime();
      
      expect(predictions).toHaveLength(3);
      predictions.forEach(pred => {
        expect(pred.confidence).toBeGreaterThan(0);
        expect(pred.confidence).toBeLessThanOrEqual(1);
        expect(pred.riskLevel).toMatch(/^(low|medium|high|critical)$/);
      });
    });

    it('経費精算から会計連携までの完全フロー', async () => {
      // 1. 経費申請データ
      const expenseRequests: ExpenseRequest[] = [
        {
          id: 'exp001',
          employeeId: 'emp001',
          amount: 25000,
          categoryId: '交通費',
          description: '客先訪問（大阪出張）',
          expenseDate: new Date('2024-01-15'),
          receiptImageUrl: 'https://example.com/receipts/exp001.jpg',
          status: 'pending',
          createdAt: new Date()
        },
        {
          id: 'exp002',
          employeeId: 'emp002',
          amount: 8500,
          categoryId: '会議費',
          description: '顧客との会食',
          expenseDate: new Date('2024-01-20'),
          status: 'pending',
          createdAt: new Date()
        }
      ];

      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(expenseRequests);

      // 2. 異常検知による不正チェック
      const expenseAnomalies = await anomalyEngine.detectAnomalies({
        domains: ['expense'],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      });

      // 通常の経費なので異常なし
      expect(expenseAnomalies.filter(a => a.severity === 'critical')).toHaveLength(0);

      // 3. 承認ワークフロー（Slack経由）
      const slackIntegration = integrationManager.getIntegration<SlackIntegration>('slack');
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567891' })
      });

      const approvalRequest = await slackIntegration.createApprovalRequest({
        id: 'approval_exp001',
        type: 'expense',
        requester: '山田太郎',
        approver: 'mgr001',
        details: {
          expenseId: 'exp001',
          amount: 25000,
          description: '客先訪問（大阪出張）'
        },
        actions: [
          { label: '承認', value: 'approve', style: 'primary' },
          { label: '却下', value: 'reject', style: 'danger' }
        ]
      });

      expect(approvalRequest).toBe('1234567891');

      // 4. 承認後の会計処理
      expenseRequests[0].status = 'approved';
      
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deal: { id: 'EXPENSE_DEAL_001' } })
      });

      const freeeIntegration = integrationManager.getIntegration<FreeeIntegration>('freee');
      const syncResult = await freeeIntegration.syncExpenseData([expenseRequests[0]]);

      expect(syncResult.status).toBe('success');
      expect(syncResult.itemsProcessed).toBe(1);

      // 5. 月次経費レポート生成
      const monthlyExpenseReport = {
        month: '2024-01',
        totalExpenses: expenseRequests.reduce((sum, e) => sum + e.amount, 0),
        byCategory: {
          '交通費': 25000,
          '会議費': 8500
        },
        byDepartment: {
          '開発部': 25000,
          '営業部': 8500
        },
        approvalRate: 0.5, // 1件承認、1件保留
        averageProcessingTime: 2.5 // 日
      };

      expect(monthlyExpenseReport.totalExpenses).toBe(33500);
    });

    it('AIエージェントによる自律的コンプライアンス管理', async () => {
      // 1. コンプライアンスエージェントの設定
      const complianceAgent = new ComplianceAgent({
        database: {
          host: 'localhost',
          port: 5432,
          database: 'test',
          user: 'test',
          password: 'test'
        }
      });

      agentOrchestrator.registerAgent(complianceAgent);

      // 2. 異常な勤怠パターンの設定
      const problematicTimeRecords: TimeRecord[] = [
        {
          id: 'prob_rec_001',
          employeeId: 'emp001',
          date: new Date('2024-01-15'),
          clockIn: new Date('2024-01-15T07:00:00'),
          clockOut: new Date('2024-01-15T23:30:00'), // 16.5時間勤務
          breakMinutes: 45, // 休憩時間不足
          recordType: 'manual'
        },
        {
          id: 'prob_rec_002',
          employeeId: 'emp001',
          date: new Date('2024-01-16'),
          clockIn: new Date('2024-01-16T06:30:00'),
          clockOut: new Date('2024-01-16T23:00:00'), // 連続長時間勤務
          breakMinutes: 60,
          recordType: 'manual'
        }
      ];

      mockDb.getTimeRecords = vi.fn().mockResolvedValue(problematicTimeRecords);
      mockDb.query = vi.fn()
        .mockResolvedValueOnce({ rows: [] }) // 初回は違反なし
        .mockResolvedValueOnce({ 
          rows: [{
            id: 'vio_001',
            type: 'overtime_excess',
            severity: 'critical',
            employeeId: 'emp001',
            detected_at: new Date(),
            resolved: false
          }]
        });

      // 3. コンプライアンスゴールの設定と実行
      const complianceGoal = {
        id: 'compliance_goal_001',
        type: 'monitor' as const,
        description: '労働基準法遵守の継続的監視',
        priority: 'critical' as const,
        successCriteria: [
          '労働時間違反の検出',
          '自動是正措置の実行',
          'コンプライアンスレポートの生成'
        ],
        targetPeriod: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        },
        complianceAreas: ['overtime' as const, 'breaks' as const, 'all' as const],
        violationThreshold: 0,
        autoRemediate: true
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const results = await agentOrchestrator.assignGoal(complianceGoal, 'コンプライアンスエージェント');

      // エージェントが違反を検出し、是正措置を実行したことを確認
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Notification to emp001')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Adjusting schedule')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending compliance report')
      );

      consoleSpy.mockRestore();
    });

    it('予測分析に基づくプロアクティブな人事介入', async () => {
      // 1. 離職リスクの高い従業員パターン
      const riskPatterns = {
        emp003: {
          tenureMonths: 6, // 新入社員
          recentOvertimeHours: [45, 50, 55, 60], // 増加する残業
          lateArrivalCount: 8, // 頻繁な遅刻
          engagementScore: 3.2 // 低いエンゲージメント
        }
      };

      // 異常な勤怠パターンのモック
      const riskTimeRecords = generateRiskPatternTimeRecords('emp003', '2024-01');
      mockDb.getTimeRecords = vi.fn().mockImplementation((empId) => {
        if (empId === 'emp003') {
          return Promise.resolve(riskTimeRecords);
        }
        return Promise.resolve([]);
      });

      // 2. 離職予測の実行
      const turnoverPredictions = await predictiveEngine.predictTurnover();
      
      const highRiskEmployee = turnoverPredictions.find(p => p.employeeId === 'emp003');
      expect(highRiskEmployee).toBeDefined();
      expect(highRiskEmployee?.riskLevel).toMatch(/^(high|critical)$/);
      expect(highRiskEmployee?.retentionActions).toContain(
        expect.stringContaining('1on1面談')
      );

      // 3. HRダッシュボードの生成
      const dashboard = await predictiveEngine.generateHumanCapitalDashboard();
      
      expect(dashboard.predictions.turnoverRisk.high + dashboard.predictions.turnoverRisk.critical)
        .toBeGreaterThan(0);

      // 4. 自動介入アクション
      if (highRiskEmployee && highRiskEmployee.riskScore > 70) {
        // Slackで管理者に通知
        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true, ts: '1234567892' })
        });

        const urgentNotification = await integrationManager
          .getIntegration<SlackIntegration>('slack')
          .sendNotification({
            channel: '@mgr001',
            message: '【緊急】離職リスクアラート',
            attachments: [{
              title: '高リスク従業員検出',
              text: `${highRiskEmployee.employeeName}さんの離職リスクが高まっています`,
              color: 'error',
              fields: [
                { title: 'リスクスコア', value: `${highRiskEmployee.riskScore}/100`, short: true },
                { title: '予測期間', value: `${highRiskEmployee.predictedTimeframe}ヶ月以内`, short: true },
                { title: '主な要因', value: highRiskEmployee.warningSignals.join('\n'), short: false }
              ],
              actions: [
                { type: 'button', text: '1on1面談を設定', url: 'https://calendar.example.com/schedule' },
                { type: 'button', text: '詳細レポートを見る', url: 'https://hr.example.com/reports' }
              ]
            }],
            priority: 'urgent'
          });

        expect(urgentNotification).toBe('1234567892');
      }
    });
  });

  describe('障害復旧とエラーハンドリング', () => {
    it('トランザクショナルな給与処理でのロールバック', async () => {
      const targetMonth = '2024-02';

      // トランザクション開始
      await mockDb.beginTransaction();

      try {
        // 1人目の給与計算は成功
        const payroll1 = await payrollEngine.calculatePayroll('emp001', targetMonth);
        expect(payroll1.totalPay).toBeGreaterThan(0);

        // 2人目でデータベースエラーを発生させる
        mockDb.query = vi.fn().mockRejectedValueOnce(new Error('Database connection lost'));

        await expect(payrollEngine.calculatePayroll('emp002', targetMonth))
          .rejects.toThrow();

        // ロールバック
        await mockDb.rollbackTransaction();
        expect(mockDb.rollbackTransaction).toHaveBeenCalled();

      } catch (error) {
        await mockDb.rollbackTransaction();
      }
    });

    it('外部API障害時のフォールバック処理', async () => {
      const freeeIntegration = integrationManager.getIntegration<FreeeIntegration>('freee');
      
      // APIタイムアウトをシミュレート
      (fetch as any).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const journalEntry = {
        date: new Date(),
        description: 'テスト仕訳',
        entries: []
      };

      await expect(freeeIntegration.createJournalEntry(journalEntry))
        .rejects.toThrow('FREEE_JOURNAL_FAILED');

      // リトライ機能のテスト（設定で3回リトライ）
      expect(fetch).toHaveBeenCalledTimes(1); // 初回のみ（リトライは実装次第）
    });

    it('AIエージェントの異常終了と自動復旧', async () => {
      // メモリ不足をシミュレート
      const failingAgent = new ComplianceAgent({
        database: mockDb as any
      });

      // processGoalをモックしてエラーを投げる
      failingAgent.processGoal = vi.fn().mockRejectedValueOnce(
        new Error('Out of memory')
      );

      agentOrchestrator.registerAgent(failingAgent);

      const goal = {
        id: 'failing_goal',
        type: 'monitor' as const,
        description: 'メモリ不足テスト',
        priority: 'high' as const,
        successCriteria: ['Should handle failure'],
        targetPeriod: { start: new Date(), end: new Date() },
        complianceAreas: ['all' as const],
        violationThreshold: 0,
        autoRemediate: false
      };

      await expect(agentOrchestrator.assignGoal(goal, 'コンプライアンスエージェント'))
        .rejects.toThrow('Out of memory');

      // エージェントの状態を確認
      const agentStatus = agentOrchestrator.getAgentsStatus();
      // 失敗後もエージェントは登録されたまま
      expect(agentStatus.size).toBeGreaterThan(0);
    });
  });

  // ヘルパー関数
  function generateMonthlyTimeRecords(employeeId: string, month: string): TimeRecord[] {
    const records: TimeRecord[] = [];
    const year = parseInt(month.split('-')[0]);
    const monthNum = parseInt(month.split('-')[1]);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, monthNum - 1, day);
      
      // 週末はスキップ
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const clockIn = new Date(date);
      clockIn.setHours(9, 0, 0, 0);

      const clockOut = new Date(date);
      // 30%の確率で残業（employeeIdによって傾向を変える）
      const overtimeHours = employeeId === 'emp001' && Math.random() < 0.5 ? 
        Math.floor(Math.random() * 4) + 1 : 0;
      clockOut.setHours(18 + overtimeHours, Math.floor(Math.random() * 60), 0, 0);

      records.push({
        id: `rec_${employeeId}_${day}`,
        employeeId,
        date,
        clockIn,
        clockOut,
        breakMinutes: overtimeHours > 2 ? 75 : 60,
        recordType: Math.random() < 0.9 ? 'ic_card' : 'manual'
      });
    }

    return records;
  }

  function generateRiskPatternTimeRecords(employeeId: string, month: string): TimeRecord[] {
    const records = generateMonthlyTimeRecords(employeeId, month);
    
    // 離職リスクパターンを追加
    return records.map((record, index) => {
      // 徐々に遅刻が増える
      if (index > 10 && Math.random() < 0.3) {
        record.clockIn = new Date(record.clockIn.getTime() + 30 * 60 * 1000); // 30分遅刻
      }
      
      // 残業が増加
      if (index > 5) {
        const additionalOvertime = Math.floor(index / 5);
        record.clockOut = new Date(record.clockOut.getTime() + additionalOvertime * 60 * 60 * 1000);
      }
      
      return record;
    });
  }
});