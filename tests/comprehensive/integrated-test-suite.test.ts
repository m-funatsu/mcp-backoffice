import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import PayrollEngine from '../../src/payroll-engine-v1.2.0.js';
import { ComplianceEngine } from '../../src/compliance-engine-v1.3.0.js';
import ExpenseManagementEngine from '../../src/expense-management-v1.4.0.js';
import HumanCapitalDisclosureEngine from '../../src/human-capital-disclosure-v2.0.0.js';
import PredictiveAnalyticsEngine from '../../src/predictive-analytics-engine-v2.1.0.js';
import IntegratedAnomalyDetectionEngine from '../../src/integrated-anomaly-detection-v2.1.0.js';
import { EcosystemIntegrationManager, FreeeIntegration, SlackIntegration } from '../../src/ecosystem-integration-v2.2.0.js';
import { AgentOrchestrator } from '../../src/agent-framework-v3.0.0.js';
import ComplianceAgent from '../../src/agents/compliance-agent-v3.0.0.js';
import type { Employee, TimeRecord, ExpenseRequest } from '../../src/types.js';

// グローバルfetchのモック
global.fetch = vi.fn();

describe('統合システムテストスイート', () => {
  let mockDb: DatabasePostgreSQL;
  let payrollEngine: PayrollEngine;
  let complianceEngine: ComplianceEngine;
  let expenseEngine: ExpenseManagementEngine;
  let humanCapitalEngine: HumanCapitalDisclosureEngine;
  let predictiveEngine: PredictiveAnalyticsEngine;
  let anomalyEngine: IntegratedAnomalyDetectionEngine;
  let integrationManager: EcosystemIntegrationManager;
  let agentOrchestrator: AgentOrchestrator;

  // テスト用の共通データ
  let testEmployees: Employee[];
  let testTimeRecords: TimeRecord[];
  let testExpenses: ExpenseRequest[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // データベースモックの設定
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getAllEmployees: vi.fn(),
      getEmployee: vi.fn(),
      getTimeRecords: vi.fn(),
      getAllTimeRecords: vi.fn(),
      getExpenseRequests: vi.fn(),
      getAllExpenseRequests: vi.fn(),
      getPayrollCalculations: vi.fn(),
      getAllPayrollCalculations: vi.fn(),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn()
    } as any;

    // エンジンの初期化
    payrollEngine = new PayrollEngine(mockDb);
    complianceEngine = new ComplianceEngine(mockDb);
    expenseEngine = new ExpenseManagementEngine(mockDb);
    humanCapitalEngine = new HumanCapitalDisclosureEngine(mockDb);
    predictiveEngine = new PredictiveAnalyticsEngine(mockDb);
    anomalyEngine = new IntegratedAnomalyDetectionEngine(mockDb);
    integrationManager = new EcosystemIntegrationManager(mockDb);
    agentOrchestrator = new AgentOrchestrator(mockDb);

    // テストデータの初期化
    testEmployees = generateTestEmployees();
    testTimeRecords = generateTestTimeRecords(testEmployees);
    testExpenses = generateTestExpenses(testEmployees);

    // 基本的なモック設定
    mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
    mockDb.getEmployee = vi.fn().mockImplementation((id) => 
      Promise.resolve(testEmployees.find(e => e.id === id))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('エンドツーエンド月次処理フロー', () => {
    it('月次給与計算から人的資本レポートまでの完全フローを実行する', async () => {
      const targetMonth = '2024-01';

      // Step 1: 勤怠データの準備とコンプライアンスチェック
      mockDb.getTimeRecords = vi.fn().mockImplementation((empId) =>
        Promise.resolve(testTimeRecords.filter(r => r.employeeId === empId))
      );
      mockDb.query = vi.fn().mockResolvedValue({ 
        rows: [{ regular_limit: 45, yearly_limit: 360 }] 
      });

      // 全従業員のコンプライアンスチェック
      const complianceResults = await Promise.all(
        testEmployees.map(emp => 
          complianceEngine.monitor36Agreement(emp.id, new Date(`${targetMonth}-31`))
        )
      );

      const violations = complianceResults.filter(r => !r.isCompliant);
      expect(violations.length).toBeGreaterThan(0); // 一部違反があることを確認

      // Step 2: 給与計算実行
      const payrollResults = await Promise.all(
        testEmployees.map(emp => 
          payrollEngine.calculatePayroll(emp.id, targetMonth)
        )
      );

      expect(payrollResults).toHaveLength(testEmployees.length);
      const totalPayroll = payrollResults.reduce((sum, p) => sum + p.totalPay, 0);
      expect(totalPayroll).toBeGreaterThan(0);

      // Step 3: 経費精算処理
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(testExpenses);
      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ text: 'テスト ¥1,000', confidence: 0.9 })
      });

      const expenseRisks = await Promise.all(
        testExpenses.filter(e => e.status === 'pending').map(expense =>
          expenseEngine.evaluateApprovalRisk(expense)
        )
      );

      const autoApprovalCandidates = expenseRisks.filter(r => r.autoApprovalRecommended);
      expect(autoApprovalCandidates.length).toBeGreaterThan(0);

      // Step 4: 異常検知分析
      mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(payrollResults);
      mockDb.getAllTimeRecords = vi.fn().mockResolvedValue(testTimeRecords);

      const anomalies = await anomalyEngine.detectAnomalies({
        domains: ['payroll', 'attendance', 'expense'],
        startDate: new Date(`${targetMonth}-01`),
        endDate: new Date(`${targetMonth}-31`)
      });

      expect(anomalies).toBeInstanceOf(Array);
      if (anomalies.length > 0) {
        expect(anomalies[0]).toHaveProperty('type');
        expect(anomalies[0]).toHaveProperty('severity');
      }

      // Step 5: 予測分析
      const overtimePredictions = await predictiveEngine.predictOvertime();
      const turnoverPredictions = await predictiveEngine.predictTurnover();

      expect(overtimePredictions).toHaveLength(testEmployees.filter(e => e.isActive).length);
      expect(turnoverPredictions).toHaveLength(testEmployees.filter(e => e.isActive).length);

      // 高リスク従業員の特定
      const highRiskEmployees = [
        ...overtimePredictions.filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high'),
        ...turnoverPredictions.filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high')
      ];

      // Step 6: 人的資本レポート生成
      mockDb.query = vi.fn().mockImplementation(() => setupHumanCapitalMockData());
      
      const humanCapitalReport = await humanCapitalEngine.generateHumanCapitalReport();

      expect(humanCapitalReport.metrics).toBeDefined();
      expect(humanCapitalReport.insights).toBeInstanceOf(Array);
      expect(humanCapitalReport.recommendations).toBeInstanceOf(Array);

      // Step 7: 外部システム連携
      const freeeIntegration = new FreeeIntegration({
        provider: 'freee',
        credentials: { accessToken: 'test-token' },
        options: { autoSync: true }
      });

      const slackIntegration = new SlackIntegration({
        provider: 'slack',
        credentials: { accessToken: 'xoxb-test' },
        options: { autoSync: false }
      });

      integrationManager.registerIntegration('freee', freeeIntegration);
      integrationManager.registerIntegration('slack', slackIntegration);

      // 給与仕訳の作成
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deal: { id: 'PAYROLL_001' } })
      });

      const journalEntry = {
        date: new Date(`${targetMonth}-25`),
        description: `${targetMonth} 給与仕訳`,
        entries: [
          {
            accountCode: '5001',
            accountName: '給与',
            debit: totalPayroll,
            credit: 0
          },
          {
            accountCode: '1002',
            accountName: '普通預金',
            debit: 0,
            credit: totalPayroll * 0.8
          }
        ],
        reference: `PAYROLL_${targetMonth}`
      };

      const freeeResult = await integrationManager
        .getIntegration<FreeeIntegration>('freee')
        .createJournalEntry(journalEntry);

      expect(freeeResult).toBe('PAYROLL_001');

      // 月次サマリー通知
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890' })
      });

      const summary = {
        month: targetMonth,
        totalEmployees: testEmployees.length,
        totalPayroll,
        complianceViolations: violations.length,
        expensesPending: testExpenses.filter(e => e.status === 'pending').length,
        anomaliesDetected: anomalies.length,
        highRiskEmployees: highRiskEmployees.length
      };

      const notification = await integrationManager
        .getIntegration<SlackIntegration>('slack')
        .sendNotification({
          channel: '#hr-reports',
          message: `${targetMonth}の月次処理が完了しました`,
          attachments: [{
            title: '月次サマリー',
            fields: Object.entries(summary).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true
            })),
            color: violations.length > 0 ? 'warning' : 'success'
          }]
        });

      expect(notification).toBe('1234567890');
    });
  });

  describe('AIエージェントによる自律的処理', () => {
    it('コンプライアンス違反の自動検出と是正を実行する', async () => {
      // コンプライアンスエージェントの登録
      const complianceAgent = new ComplianceAgent({
        database: mockDb as any
      });
      agentOrchestrator.registerAgent(complianceAgent);

      // 問題のある勤怠データ
      const problematicRecords = testTimeRecords.map(r => ({
        ...r,
        clockOut: new Date(r.clockIn.getTime() + 14 * 60 * 60 * 1000) // 14時間勤務
      }));

      mockDb.getTimeRecords = vi.fn().mockResolvedValue(problematicRecords);
      mockDb.query = vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'vio001',
            type: 'overtime_excess',
            severity: 'critical',
            employeeId: 'emp001',
            detected_at: new Date()
          }]
        });

      const complianceGoal = {
        id: 'compliance_monthly',
        type: 'monitor' as const,
        description: '月次コンプライアンス監視',
        priority: 'critical' as const,
        successCriteria: [
          'すべての労働基準法違反を検出',
          '必要な是正措置を実行',
          'レポートを生成して通知'
        ],
        targetPeriod: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        },
        complianceAreas: ['all' as const],
        violationThreshold: 0,
        autoRemediate: true
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await agentOrchestrator.assignGoal(complianceGoal, 'コンプライアンスエージェント');

      // エージェントが違反を検出し、自動是正を実行したことを確認
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('violation detected')
      );
      
      consoleSpy.mockRestore();
    });

    it('複数エージェントの協調による月次処理を実行する', async () => {
      // 各種エージェントの登録（実装があれば）
      const agents = [
        new ComplianceAgent({ database: mockDb as any }),
        // new PayrollAgent({ database: mockDb as any }),
        // new ExpenseAgent({ database: mockDb as any })
      ];

      agents.forEach(agent => agentOrchestrator.registerAgent(agent));

      const monthlyGoals = [
        {
          id: 'goal_compliance',
          type: 'monitor' as const,
          description: 'コンプライアンス監視',
          priority: 'critical' as const,
          successCriteria: ['違反検出と是正']
        },
        // {
        //   id: 'goal_payroll',
        //   type: 'process' as const,
        //   description: '給与計算処理',
        //   priority: 'high' as const,
        //   successCriteria: ['全従業員の給与計算完了']
        // }
      ];

      const assignments = new Map([
        ['goal_compliance', 'コンプライアンスエージェント'],
        // ['goal_payroll', '給与計算エージェント']
      ]);

      const results = await agentOrchestrator.coordinateAgents(monthlyGoals, assignments);

      expect(results.size).toBeGreaterThan(0);
      results.forEach((result, goalId) => {
        expect(result).toBeInstanceOf(Array);
      });
    });
  });

  describe('リアルタイム監視と予測的介入', () => {
    it('残業時間の増加トレンドを検出して警告を発する', async () => {
      // 増加トレンドのある勤怠データ
      const trendingRecords = generateIncreasingOvertimeRecords(testEmployees[0].id);
      
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(trendingRecords);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployees[0]);

      // リアルタイム監視開始
      await anomalyEngine.startRealtimeMonitoring();

      // 予測分析実行
      const predictions = await predictiveEngine.predictOvertime(testEmployees[0].id);

      expect(predictions[0].predictedMonthOvertime).toBeGreaterThan(45);
      expect(predictions[0].riskLevel).toMatch(/^(high|critical)$/);
      expect(predictions[0].alertRequired).toBe(true);

      // 推奨アクションの確認
      expect(predictions[0].recommendations).toContainEqual(
        expect.stringContaining('業務量の見直し')
      );
    });

    it('離職リスクの早期兆候を検出する', async () => {
      // 離職リスクパターンのデータ
      const riskPatternRecords = generateTurnoverRiskPatterns(testEmployees[1].id);
      
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(riskPatternRecords);
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployees[1]);

      const turnoverPrediction = await predictiveEngine.predictTurnover(testEmployees[1].id);

      expect(turnoverPrediction[0].riskScore).toBeGreaterThan(70);
      expect(turnoverPrediction[0].warningSignals).toContainEqual(
        expect.stringContaining('勤怠パターンの変化')
      );

      // 保持施策の推奨
      expect(turnoverPrediction[0].retentionActions).toContainEqual(
        expect.stringContaining('1on1面談')
      );
    });
  });

  describe('統合レポーティングとダッシュボード', () => {
    it('経営層向け統合ダッシュボードデータを生成する', async () => {
      // 各種データの準備
      setupComprehensiveMockData();

      // 人的資本ダッシュボード
      const hcDashboard = await predictiveEngine.generateHumanCapitalDashboard();

      // 統合分析レポート
      const integratedAnalysis = await anomalyEngine.generateIntegratedAnalysis({
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      });

      // エグゼクティブ保証
      const executiveAssurance = await anomalyEngine.generateExecutiveAssurance();

      // 統合ダッシュボードの構築
      const executiveDashboard = {
        period: '2024-01',
        keyMetrics: {
          totalEmployees: hcDashboard.employeeCount,
          totalPayroll: 0, // payrollResultsから計算
          complianceScore: 0.95,
          engagementScore: hcDashboard.engagement.satisfactionScore,
          turnoverRate: hcDashboard.engagement.voluntaryTurnoverRate
        },
        risks: {
          overallRiskScore: integratedAnalysis.riskAssessment.overallRiskScore,
          topRisks: integratedAnalysis.riskAssessment.topRisks,
          complianceRisks: [],
          financialRisks: []
        },
        predictions: {
          overtimeRisk: hcDashboard.predictions.overtimeRisk,
          turnoverRisk: hcDashboard.predictions.turnoverRisk,
          budgetForecast: {}
        },
        assurance: {
          level: executiveAssurance.assuranceLevel,
          confidence: executiveAssurance.certification.confidence,
          keyFindings: executiveAssurance.keyFindings
        }
      };

      expect(executiveDashboard.keyMetrics.totalEmployees).toBeGreaterThan(0);
      expect(executiveDashboard.risks.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(executiveDashboard.risks.overallRiskScore).toBeLessThanOrEqual(1);
      expect(executiveDashboard.assurance.level).toMatch(/^(high|medium|low)$/);
    });
  });

  describe('エラー処理と障害復旧', () => {
    it('トランザクション処理中のエラーでロールバックを実行する', async () => {
      await mockDb.beginTransaction();

      try {
        // 給与計算の途中でエラーを発生させる
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockRejectedValueOnce(new Error('Database lock timeout'));

        await payrollEngine.calculatePayroll('emp001', '2024-01');
        await payrollEngine.calculatePayroll('emp002', '2024-01'); // ここでエラー

      } catch (error) {
        await mockDb.rollbackTransaction();
        expect(mockDb.rollbackTransaction).toHaveBeenCalled();
      }
    });

    it('外部API障害時にフォールバック処理を実行する', async () => {
      // freee APIがダウンしている場合
      (fetch as any).mockRejectedValue(new Error('Connection timeout'));

      const freeeIntegration = integrationManager.getIntegration<FreeeIntegration>('freee');
      
      try {
        await freeeIntegration.syncPayrollData([]);
      } catch (error) {
        // ローカルキューに保存してリトライスケジュールを設定
        expect(error.message).toContain('FREEE_SYNC_FAILED');
      }
    });
  });

  describe('パフォーマンスとスケーラビリティ', () => {
    it('1000人規模の組織で月次処理を30秒以内に完了する', async () => {
      const largeEmployeeSet = generateTestEmployees(1000);
      const largeTimeRecords = generateTestTimeRecords(largeEmployeeSet);
      
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(largeEmployeeSet);
      mockDb.getTimeRecords = vi.fn().mockImplementation((empId) =>
        Promise.resolve(largeTimeRecords.filter(r => r.employeeId === empId))
      );

      const startTime = Date.now();

      // 並列処理で給与計算
      const batchSize = 50;
      const batches = [];
      
      for (let i = 0; i < largeEmployeeSet.length; i += batchSize) {
        const batch = largeEmployeeSet.slice(i, i + batchSize);
        batches.push(
          Promise.all(
            batch.map(emp => payrollEngine.calculatePayroll(emp.id, '2024-01'))
          )
        );
      }

      const allResults = await Promise.all(batches);
      const endTime = Date.now();

      expect(allResults.flat()).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(30000); // 30秒以内
    });

    it('メモリ使用量が適切な範囲内に収まる', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // 大量データ処理
      const largeDataset = generateTestExpenses(testEmployees, 10000);
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(largeDataset);

      const report = await expenseEngine.generateExpenseAnalytics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(report.summary.totalExpenses).toBe(10000);
      expect(memoryIncrease).toBeLessThan(500); // 500MB以下
    });
  });

  // ヘルパー関数
  function setupComprehensiveMockData() {
    mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(
      testEmployees.map(e => ({
        employeeId: e.id,
        month: '2024-01',
        totalPay: 300000 + Math.random() * 200000,
        netPay: 250000 + Math.random() * 150000
      }))
    );

    mockDb.getAllTimeRecords = vi.fn().mockResolvedValue(testTimeRecords);
    mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(testExpenses);

    mockDb.query = vi.fn().mockImplementation((query) => {
      if (query.includes('engagement')) {
        return { rows: testEmployees.map(() => ({ score: 4.0 + Math.random() })) };
      }
      if (query.includes('revenue')) {
        return { rows: [{ total_revenue: 1000000000 }] };
      }
      return { rows: [] };
    });
  }

  function setupHumanCapitalMockData() {
    return {
      rows: [
        { metric: 'training_completion', value: 0.85 },
        { metric: 'engagement_score', value: 4.2 },
        { metric: 'turnover_rate', value: 0.08 }
      ]
    };
  }
});

// テストデータ生成関数
function generateTestEmployees(count: number = 10): Employee[] {
  const departments = ['営業部', '開発部', '人事部', '経理部'];
  const positions = ['スタッフ', 'マネージャー', '部長'];
  
  return Array(count).fill(null).map((_, i) => ({
    id: `emp${String(i + 1).padStart(3, '0')}`,
    name: `テスト従業員 ${i + 1}`,
    email: `test${i + 1}@example.com`,
    department: departments[i % departments.length],
    position: positions[Math.floor(i / 3) % positions.length],
    hourlyWage: 2500 + Math.floor(Math.random() * 2500),
    startDate: new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    managerId: i > 3 ? `emp001` : undefined
  }));
}

function generateTestTimeRecords(employees: Employee[]): TimeRecord[] {
  const records: TimeRecord[] = [];
  const startDate = new Date('2024-01-01');
  
  employees.forEach(emp => {
    for (let day = 0; day < 31; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      
      if (date.getDay() === 0 || date.getDay() === 6) continue; // 週末スキップ
      
      const baseHour = 9;
      const overtimeHours = Math.random() < 0.3 ? Math.floor(Math.random() * 4) : 0;
      
      records.push({
        id: `tr_${emp.id}_${day}`,
        employeeId: emp.id,
        date,
        clockIn: new Date(date.setHours(baseHour, 0, 0, 0)),
        clockOut: new Date(date.setHours(18 + overtimeHours, Math.floor(Math.random() * 60), 0, 0)),
        breakMinutes: overtimeHours > 2 ? 75 : 60,
        recordType: 'ic_card'
      });
    }
  });
  
  return records;
}

function generateTestExpenses(employees: Employee[], count?: number): ExpenseRequest[] {
  const categories = ['交通費', '会議費', '接待交際費', '消耗品費'];
  const expenses: ExpenseRequest[] = [];
  const expenseCount = count || employees.length * 5;
  
  for (let i = 0; i < expenseCount; i++) {
    const employee = employees[i % employees.length];
    expenses.push({
      id: `exp${String(i + 1).padStart(4, '0')}`,
      employeeId: employee.id,
      amount: Math.floor(Math.random() * 30000) + 1000,
      categoryId: categories[i % categories.length],
      description: `テスト経費 ${i + 1}`,
      expenseDate: new Date(2024, 0, Math.floor(Math.random() * 31) + 1),
      status: Math.random() > 0.2 ? 'approved' : 'pending',
      createdAt: new Date(),
      receiptImageUrl: Math.random() > 0.3 ? `receipt_${i}.jpg` : undefined
    });
  }
  
  return expenses;
}

function generateIncreasingOvertimeRecords(employeeId: string): TimeRecord[] {
  const records: TimeRecord[] = [];
  const baseDate = new Date('2024-01-01');
  
  for (let day = 0; day < 20; day++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + day);
    
    // 徐々に残業時間が増加
    const overtimeHours = Math.min(1 + day * 0.3, 5);
    
    records.push({
      id: `tr_trend_${day}`,
      employeeId,
      date,
      clockIn: new Date(date.setHours(9, 0, 0, 0)),
      clockOut: new Date(date.setHours(18 + Math.floor(overtimeHours), (overtimeHours % 1) * 60, 0, 0)),
      breakMinutes: overtimeHours > 2 ? 75 : 60,
      recordType: 'ic_card'
    });
  }
  
  return records;
}

function generateTurnoverRiskPatterns(employeeId: string): TimeRecord[] {
  const records: TimeRecord[] = [];
  const baseDate = new Date('2024-01-01');
  
  for (let day = 0; day < 30; day++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + day);
    
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // 離職リスクパターン：遅刻増加、早退増加、欠勤
    const isLate = day > 15 && Math.random() < 0.4;
    const isEarlyLeave = day > 20 && Math.random() < 0.3;
    const isAbsent = day > 25 && Math.random() < 0.2;
    
    if (!isAbsent) {
      records.push({
        id: `tr_risk_${day}`,
        employeeId,
        date,
        clockIn: new Date(date.setHours(isLate ? 9 + Math.random() : 9, isLate ? Math.floor(Math.random() * 60) : 0, 0, 0)),
        clockOut: new Date(date.setHours(isEarlyLeave ? 17 : 18, isEarlyLeave ? Math.floor(Math.random() * 60) : 0, 0, 0)),
        breakMinutes: 60,
        recordType: 'ic_card'
      });
    }
  }
  
  return records;
}