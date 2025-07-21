import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DatabasePostgreSQL } from '../../src/database_postgresql';
import { IntegratedPayrollEngine } from '../../src/payroll-engine';
import { ComplianceEngine } from '../../src/compliance-engine';
import ExpenseManagementEngine from '../../src/expense-engine';
import HumanCapitalDisclosureEngine from '../../src/human-capital-disclosure-engine-v2.0.0';
import PredictiveAnalyticsEngine from '../../src/predictive-analytics-engine-v2.1.0';
import { TalentManagementEngine } from '../../src/talent-management-engine-v2.2.0';
import { SkillManagementEngine } from '../../src/skill-management-engine-v2.3.0';
import IntegratedAnomalyDetectionEngine from '../../src/integrated-anomaly-detection-v2.1.0';
import { EcosystemIntegrationManager } from '../../src/ecosystem-integration-v2.2.0';
import { AgentOrchestrator } from '../../src/agent-framework-v3.0.0';
import { GenerativeUIEngine } from '../../src/generative-ui-engine-v3.1.0';
import { SecurityValidator } from '../../src/security-validator';
import { PerformanceOptimizer } from '../../src/performance-optimizer';
import type { Employee, TimeRecord, ExpenseRequest } from '../../src/types';

/**
 * AI-Native Strategic HR Platform
 * マスターテストスイート v1.0.0
 * 
 * 全機能の包括的な統合テスト
 */
describe('AI-Native Strategic HR Platform - マスターテストスイート', () => {
  let db: DatabasePostgreSQL;
  let payrollEngine: IntegratedPayrollEngine;
  let complianceEngine: ComplianceEngine;
  let expenseEngine: ExpenseManagementEngine;
  let humanCapitalEngine: HumanCapitalDisclosureEngine;
  let predictiveEngine: PredictiveAnalyticsEngine;
  let talentEngine: TalentManagementEngine;
  let skillEngine: SkillManagementEngine;
  let anomalyEngine: IntegratedAnomalyDetectionEngine;
  let integrationManager: EcosystemIntegrationManager;
  let agentOrchestrator: AgentOrchestrator;
  let uiEngine: GenerativeUIEngine;
  let securityValidator: SecurityValidator;
  let performanceOptimizer: PerformanceOptimizer;

  // テストデータ
  let testEmployees: Employee[];
  let testTimeRecords: TimeRecord[];
  let testExpenses: ExpenseRequest[];

  beforeAll(async () => {
    // データベースとエンジンの初期化
    db = createMockDatabase();
    
    payrollEngine = new IntegratedPayrollEngine(db);
    complianceEngine = new ComplianceEngine(db);
    expenseEngine = new ExpenseManagementEngine(db);
    humanCapitalEngine = new HumanCapitalDisclosureEngine(db);
    predictiveEngine = new PredictiveAnalyticsEngine(db);
    talentEngine = new TalentManagementEngine(db);
    skillEngine = new SkillManagementEngine(db);
    anomalyEngine = new IntegratedAnomalyDetectionEngine(db);
    integrationManager = new EcosystemIntegrationManager(db);
    agentOrchestrator = new AgentOrchestrator(db);
    uiEngine = new GenerativeUIEngine();
    securityValidator = new SecurityValidator();
    performanceOptimizer = new PerformanceOptimizer(
      { max: 10, min: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000, statementTimeout: 10000 },
      'redis://localhost:6379',
      10
    );

    // テストデータの準備
    testEmployees = generateComprehensiveTestEmployees();
    testTimeRecords = generateComprehensiveTimeRecords(testEmployees);
    testExpenses = generateComprehensiveExpenses(testEmployees);
  });

  afterAll(async () => {
    await performanceOptimizer.close();
  });

  describe('フェーズ1: コア機能の統合テスト', () => {
    describe('v1.2.0 統合給与計算エンジン', () => {
      it('日本労働基準法に準拠した給与計算を実行する', async () => {
        const employee = testEmployees[0];
        const result = await payrollEngine.calculatePayroll(employee.id, '2025-07');

        expect(result).toMatchObject({
          employeeId: employee.id,
          month: '2025-07',
          basePay: expect.any(Number),
          overtimePay: expect.any(Number),
          lateNightPay: expect.any(Number),
          holidayPay: expect.any(Number),
          totalPay: expect.any(Number),
          deductions: expect.objectContaining({
            incomeTax: expect.any(Number),
            residentTax: expect.any(Number),
            socialInsurance: expect.any(Number),
            employmentInsurance: expect.any(Number)
          })
        });

        // 複雑な割増率の検証
        if (result.overtimeHours > 60) {
          const expectedRate = 1.5; // 月60時間超
          expect(result.overtimePay / (employee.hourlyWage * result.overtimeHours))
            .toBeCloseTo(expectedRate, 1);
        }
      });

      it('大量の従業員に対してバッチ給与計算を実行する', async () => {
        const startTime = performance.now();
        
        const results = await performanceOptimizer.optimizedBatchProcess(
          testEmployees.slice(0, 50),
          (emp) => payrollEngine.calculatePayroll(emp.id, '2025-07'),
          10
        );

        const endTime = performance.now();
        
        expect(results).toHaveLength(50);
        expect(endTime - startTime).toBeLessThan(10000); // 10秒以内
      });
    });

    describe('v1.3.0 コンプライアンス強化勤怠管理', () => {
      it('36協定違反をリアルタイムで検出する', async () => {
        const problematicEmployee = testEmployees[1];
        
        // 月45時間を超える残業記録
        const overtimeRecords = generateOvertimeRecords(problematicEmployee.id, 50);
        db.getTimeRecords = vi.fn().mockResolvedValue(overtimeRecords);

        const result = await complianceEngine.monitor36Agreement(
          problematicEmployee.id,
          new Date('2025-07-31')
        );

        expect(result.isCompliant).toBe(false);
        expect(result.violations).toContainEqual(
          expect.objectContaining({
            type: 'monthly_overtime_excess',
            limit: 45,
            actual: expect.any(Number)
          })
        );
        expect(result.alerts.length).toBeGreaterThan(0);
      });

      it('有給休暇の自動付与と失効管理を行う', async () => {
        const longTermEmployee = {
          ...testEmployees[2],
          startDate: new Date('2019-04-01').toISOString()
        };

        const leaveBalance = await complianceEngine.calculateLeaveBalance(
          longTermEmployee.id,
          new Date('2025-07-31')
        );

        expect(leaveBalance.totalDays).toBe(20); // 6.5年勤続で20日
        expect(leaveBalance.expiringDays).toBeDefined();
        expect(leaveBalance.recommendations).toContain('失効リスクのある有給休暇があります');
      });
    });

    describe('v1.4.0 AI経費管理', () => {
      it('OCRを使用してレシートを自動処理する', async () => {
        const mockOCRResponse = {
          text: 'タクシー代\n東京駅→品川駅\n¥2,340\n2025/07/21',
          confidence: 0.95,
          extractedData: {
            amount: 2340,
            category: '交通費',
            date: '2025-07-21',
            vendor: 'タクシー'
          }
        };

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockOCRResponse
        });

        const expense = {
          ...testExpenses[0],
          receiptImageUrl: 'receipt.jpg'
        };

        const processed = await expenseEngine.processReceipt(expense.receiptImageUrl);
        expect(processed.amount).toBe(2340);
        expect(processed.confidence).toBeGreaterThan(0.9);
      });

      it('リスクベースの承認ワークフローを実行する', async () => {
        const expenses = testExpenses.slice(0, 10);
        
        const riskAssessments = await Promise.all(
          expenses.map(exp => expenseEngine.evaluateApprovalRisk(exp))
        );

        const autoApprovalCandidates = riskAssessments.filter(
          r => r.autoApprovalRecommended
        );
        const manualReviewRequired = riskAssessments.filter(
          r => !r.autoApprovalRecommended
        );

        expect(autoApprovalCandidates.length).toBeGreaterThan(0);
        expect(manualReviewRequired.length).toBeGreaterThan(0);

        // 高リスク経費の特定
        const highRiskExpenses = riskAssessments.filter(
          r => r.riskScore > 0.7
        );
        expect(highRiskExpenses.every(r => !r.autoApprovalRecommended)).toBe(true);
      });
    });
  });

  describe('フェーズ2: AI・分析機能の統合テスト', () => {
    describe('v2.0.0 人的資本開示システム', () => {
      it('金融庁指針に準拠した人的資本レポートを生成する', async () => {
        setupHumanCapitalMockData(db);

        const report = await humanCapitalEngine.generateHumanCapitalReport(
          'Test Company',
          { startDate: new Date('2025-01-01'), endDate: new Date('2025-06-30') }
        );

        // ISO30414準拠の指標確認
        expect(report.metrics).toMatchObject({
          diversity: expect.objectContaining({
            genderRatio: expect.any(Object),
            femaleManagerRatio: expect.any(Number)
          }),
          leadership: expect.objectContaining({
            leadershipDevelopment: expect.any(Object),
            successionPlanning: expect.any(Object)
          }),
          skills: expect.objectContaining({
            skillsGap: expect.any(Object),
            trainingInvestment: expect.any(Object)
          }),
          engagement: expect.objectContaining({
            satisfactionScore: expect.any(Number),
            voluntaryTurnoverRate: expect.any(Number)
          })
        });

        expect(report.complianceStatus.iso30414).toBe(true);
        expect(report.complianceStatus.japaneseDisclosureGuidelines).toBe(true);
      });
    });

    describe('v2.1.0 予測的HRアナリティクス', () => {
      it('残業時間を高精度で予測する', async () => {
        const historicalData = generateHistoricalOvertimeData(testEmployees[0].id);
        db.query = vi.fn().mockResolvedValue({ rows: historicalData });

        const predictions = await predictiveEngine.predictOvertime(
          testEmployees[0].id,
          3 // 3ヶ月予測
        );

        expect(predictions).toHaveLength(3);
        predictions.forEach(pred => {
          expect(pred.confidence).toBeGreaterThan(0.8);
          expect(pred.predictedHours).toBeGreaterThanOrEqual(0);
          expect(pred.riskLevel).toMatch(/low|medium|high/);
        });
      });

      it('離職リスクを多角的に評価する', async () => {
        const riskFactors = {
          performanceDecline: true,
          engagementDrop: true,
          compensationGap: true,
          managerChange: true
        };

        setupEmployeeRiskData(db, testEmployees[3].id, riskFactors);

        const riskAssessment = await predictiveEngine.assessTurnoverRisk(
          testEmployees[3].id
        );

        expect(riskAssessment.riskScore).toBeGreaterThan(0.7);
        expect(riskAssessment.topFactors).toContain('engagement_decline');
        expect(riskAssessment.retentionActions).toContainEqual(
          expect.objectContaining({
            action: expect.any(String),
            priority: 'high',
            estimatedImpact: expect.any(Number)
          })
        );
      });
    });

    describe('v2.2.0 タレントマネジメント', () => {
      it('9ボックスグリッドで従業員を適切に分類する', async () => {
        const assessments = [
          { employeeId: 'emp001', performance: 4.5, potential: 4.8 }, // Star
          { employeeId: 'emp002', performance: 4.2, potential: 3.0 }, // High Performer
          { employeeId: 'emp003', performance: 2.0, potential: 4.5 }, // Question Mark
          { employeeId: 'emp004', performance: 2.5, potential: 2.5 }  // Underperformer
        ];

        const results = await Promise.all(
          assessments.map(a => talentEngine.assessTalent(a.employeeId, {
            performanceRating: a.performance,
            potentialRating: a.potential,
            assessedBy: 'mgr001'
          }))
        );

        expect(results[0].nineBoxCategory).toBe('star');
        expect(results[1].nineBoxCategory).toBe('high_performer');
        expect(results[2].nineBoxCategory).toBe('question_mark');
        expect(results[3].nineBoxCategory).toBe('underperformer');
      });

      it('AIを活用してキャリアパスを最適化する', async () => {
        const employeeProfile = {
          currentRole: 'Software Engineer',
          skills: ['TypeScript', 'React', 'Node.js'],
          interests: ['Architecture', 'Team Leadership'],
          performanceHistory: [4.0, 4.2, 4.5]
        };

        const careerPaths = await talentEngine.recommendCareerPaths(
          testEmployees[4].id,
          employeeProfile
        );

        expect(careerPaths).toContainEqual(
          expect.objectContaining({
            targetPosition: expect.stringContaining('Architect'),
            fitScore: expect.any(Number),
            requiredSkills: expect.arrayContaining(['System Design']),
            estimatedTimeframe: expect.any(Number)
          })
        );
      });
    });

    describe('v2.3.0 スキル管理', () => {
      it('組織全体のスキルギャップを分析する', async () => {
        const requiredSkills = ['AI/ML', 'Cloud Architecture', 'DevOps'];
        const currentSkills = await skillEngine.analyzeOrganizationSkills();

        const gapAnalysis = await skillEngine.identifySkillGaps(
          requiredSkills,
          currentSkills
        );

        expect(gapAnalysis.criticalGaps).toBeDefined();
        expect(gapAnalysis.trainingRecommendations).toBeDefined();
        expect(gapAnalysis.hiringRecommendations).toBeDefined();
        expect(gapAnalysis.estimatedClosureTime).toBeDefined();
      });

      it('個別最適化された学習推奨を生成する', async () => {
        const learningRecommendations = await skillEngine.generateLearningPath(
          testEmployees[5].id,
          'Data Science'
        );

        expect(learningRecommendations.path).toHaveLength(5); // 5段階の学習パス
        expect(learningRecommendations.estimatedDuration).toBeDefined();
        expect(learningRecommendations.roi).toBeGreaterThan(1.5);
      });
    });

    describe('v2.4.0 統合異常検知', () => {
      it('クロスドメインで不正パターンを検出する', async () => {
        // 給与・勤怠・経費の異常パターン
        const anomalousData = {
          payroll: { suddenIncrease: 200 }, // 200%増
          attendance: { unusualPattern: true },
          expense: { highFrequency: true, largeAmounts: true }
        };

        setupAnomalousData(db, testEmployees[6].id, anomalousData);

        const anomalies = await anomalyEngine.detectAnomalies({
          domains: ['payroll', 'attendance', 'expense'],
          startDate: new Date('2025-06-01'),
          endDate: new Date('2025-06-30')
        });

        expect(anomalies.length).toBeGreaterThan(0);
        expect(anomalies).toContainEqual(
          expect.objectContaining({
            type: 'cross_domain_anomaly',
            severity: 'high',
            affectedDomains: expect.arrayContaining(['payroll', 'expense'])
          })
        );
      });
    });
  });

  describe('フェーズ3: 先進機能の統合テスト', () => {
    describe('v3.0.0 AIエージェントフレームワーク', () => {
      it('複数エージェントが協調して月次処理を完了する', async () => {
        const monthlyGoals = [
          {
            id: 'payroll_processing',
            type: 'process' as const,
            description: '全従業員の給与計算',
            priority: 'high' as const,
            targetDate: new Date('2025-07-25')
          },
          {
            id: 'compliance_check',
            type: 'monitor' as const,
            description: 'コンプライアンス監視',
            priority: 'critical' as const,
            targetPeriod: {
              start: new Date('2025-07-01'),
              end: new Date('2025-07-31')
            }
          }
        ];

        const results = await agentOrchestrator.executeMonthlyWorkflow(monthlyGoals);

        expect(results.payroll_processing).toMatchObject({
          status: 'completed',
          processedCount: expect.any(Number),
          errors: []
        });

        expect(results.compliance_check).toMatchObject({
          status: 'completed',
          violationsFound: expect.any(Number),
          actionsToken: expect.any(Array)
        });
      });

      it('エージェントが自己修復を実行する', async () => {
        // エラーを注入
        const errorScenario = {
          type: 'database_connection_error',
          frequency: 3
        };

        const agent = agentOrchestrator.getAgent('PayrollAgent');
        const result = await agent.handleError(errorScenario);

        expect(result.recovered).toBe(true);
        expect(result.strategy).toBe('connection_pool_refresh');
        expect(result.downtime).toBeLessThan(5000); // 5秒以内に回復
      });
    });

    describe('v3.1.0 ジェネレーティブUI', () => {
      it('自然言語クエリから適切なUIを生成する', async () => {
        const queries = [
          {
            input: '営業部の今月の残業状況を見せて',
            expectedComponents: ['BarChart', 'DataTable', 'SummaryCard']
          },
          {
            input: '女性管理職の推移をグラフで',
            expectedComponents: ['LineChart', 'PieChart', 'TrendIndicator']
          },
          {
            input: 'スキル不足の従業員をリストアップ',
            expectedComponents: ['FilterableTable', 'SkillGapMatrix', 'ActionButtons']
          }
        ];

        for (const query of queries) {
          const result = await uiEngine.generateUI(query.input, {
            userId: 'test_user',
            role: 'hr_admin',
            permissions: ['view_all']
          });

          expect(result.intent.confidence).toBeGreaterThan(0.85);
          expect(result.components.map(c => c.type)).toEqual(
            expect.arrayContaining(query.expectedComponents)
          );
          expect(result.layout.type).toMatch(/grid|flex|dashboard/);
        }
      });

      it('ユーザーの使用パターンを学習して最適化する', async () => {
        const userPatterns = [
          { action: 'view_overtime', frequency: 20 },
          { action: 'export_report', frequency: 15 },
          { action: 'approve_expense', frequency: 30 }
        ];

        await uiEngine.learnUserPatterns('usr001', userPatterns);
        
        const optimizedUI = await uiEngine.generateUI('ダッシュボード', {
          userId: 'usr001',
          role: 'manager'
        });

        // 頻繁に使用する機能が優先的に配置される
        expect(optimizedUI.components[0].type).toBe('QuickActions');
        expect(optimizedUI.components[0].config.actions).toContain('approve_expense');
      });
    });
  });

  describe('セキュリティとパフォーマンスの統合テスト', () => {
    describe('セキュリティ検証', () => {
      it('OWASP Top 10の脆弱性に対して保護されている', async () => {
        const securityTests = [
          {
            name: 'SQLインジェクション',
            payload: "'; DROP TABLE employees; --",
            test: () => securityValidator.sanitizeInput(payload)
          },
          {
            name: 'XSS',
            payload: '<script>alert("XSS")</script>',
            test: () => securityValidator.sanitizeHTML(payload)
          },
          {
            name: 'CSRF',
            test: () => securityValidator.generateCSRFToken('session123')
          }
        ];

        for (const test of securityTests) {
          const result = await test.test();
          expect(result).not.toContain('DROP TABLE');
          expect(result).not.toContain('<script>');
        }
      });

      it('レート制限が適切に機能する', async () => {
        const results = [];
        
        for (let i = 0; i < 15; i++) {
          const result = await securityValidator.checkRateLimit(
            '192.168.1.100',
            'api_call'
          );
          results.push(result.allowed);
        }

        const allowedCount = results.filter(r => r).length;
        expect(allowedCount).toBeLessThanOrEqual(10); // 10回まで許可
      });
    });

    describe('パフォーマンス最適化', () => {
      it('大規模データセットでも高速に処理する', async () => {
        const largeDataset = generateComprehensiveTestEmployees(10000);
        
        const startTime = performance.now();
        
        // バッチ処理とキャッシングを活用
        const results = await performanceOptimizer.optimizedBatchProcess(
          largeDataset,
          async (emp) => ({
            payroll: await payrollEngine.calculatePayroll(emp.id, '2025-07'),
            compliance: await complianceEngine.checkCompliance(emp.id)
          }),
          100 // バッチサイズ
        );

        const endTime = performance.now();
        const processingTime = endTime - startTime;

        expect(results).toHaveLength(10000);
        expect(processingTime).toBeLessThan(120000); // 2分以内
        
        // 1従業員あたりの処理時間
        const timePerEmployee = processingTime / 10000;
        expect(timePerEmployee).toBeLessThan(12); // 12ms以下
      });

      it('キャッシュヒット率が目標を達成する', async () => {
        // 同じデータに複数回アクセス
        const employeeId = testEmployees[0].id;
        
        const results = [];
        for (let i = 0; i < 10; i++) {
          const startTime = performance.now();
          await performanceOptimizer.optimizedQuery(
            'SELECT * FROM employees WHERE id = ?',
            [employeeId],
            { ttl: 300, maxSize: 1000, invalidationRules: [] }
          );
          const endTime = performance.now();
          results.push(endTime - startTime);
        }

        // 初回以降はキャッシュから取得されるため高速
        const cacheHits = results.slice(1).filter(time => time < 5).length;
        const hitRate = cacheHits / 9;
        
        expect(hitRate).toBeGreaterThan(0.8); // 80%以上のヒット率
      });
    });
  });

  describe('エンドツーエンド統合シナリオ', () => {
    it('新入社員のオンボーディングから評価まで完全自動化する', async () => {
      const newEmployee = {
        id: 'emp999',
        name: '新入 太郎',
        email: 'shinyu@example.com',
        department: '開発部',
        position: 'ジュニアエンジニア',
        startDate: new Date().toISOString(),
        hourlyWage: 2000
      };

      // 1. 従業員登録
      await db.createEmployee(newEmployee);

      // 2. 自動的な初期設定
      const onboardingTasks = await agentOrchestrator.executeOnboarding(newEmployee.id);
      expect(onboardingTasks.completed).toContain('access_provisioning');
      expect(onboardingTasks.completed).toContain('training_assignment');

      // 3. 勤怠記録の蓄積（1ヶ月分をシミュレート）
      const timeRecords = generateTimeRecordsForPeriod(newEmployee.id, 30);
      await db.bulkInsertTimeRecords(timeRecords);

      // 4. 初回給与計算
      const firstPayroll = await payrollEngine.calculatePayroll(
        newEmployee.id,
        new Date().toISOString().substring(0, 7)
      );
      expect(firstPayroll.totalPay).toBeGreaterThan(0);

      // 5. パフォーマンス評価（試用期間）
      const evaluation = await talentEngine.evaluateProbation(newEmployee.id);
      expect(evaluation.recommendation).toMatch(/pass|extend|fail/);

      // 6. スキル評価と学習計画
      const skillAssessment = await skillEngine.assessNewEmployee(newEmployee.id);
      expect(skillAssessment.learningPlan).toBeDefined();
      expect(skillAssessment.mentorAssignment).toBeDefined();
    });

    it('年度末の包括的な人事処理を実行する', async () => {
      const fiscalYearEnd = new Date('2025-03-31');

      // 1. 全従業員の年次評価
      const evaluations = await talentEngine.conductAnnualReview(
        testEmployees,
        fiscalYearEnd
      );

      // 2. 昇進・昇給の推奨
      const promotionRecommendations = evaluations
        .filter(e => e.promotionRecommended)
        .map(e => ({
          employeeId: e.employeeId,
          currentPosition: e.currentPosition,
          recommendedPosition: e.recommendedPosition,
          salaryIncrease: e.recommendedSalaryIncrease
        }));

      expect(promotionRecommendations.length).toBeGreaterThan(0);

      // 3. 人的資本開示レポート生成
      const annualReport = await humanCapitalEngine.generateAnnualReport(
        'Test Company',
        fiscalYearEnd.getFullYear()
      );

      expect(annualReport.sections).toContain('diversity_metrics');
      expect(annualReport.sections).toContain('talent_development');
      expect(annualReport.sections).toContain('compensation_analysis');

      // 4. 次年度の予測と計画
      const nextYearPredictions = await predictiveEngine.generateAnnualForecast({
        historicalData: evaluations,
        marketTrends: await fetchMarketData(),
        organizationGoals: await fetchStrategicGoals()
      });

      expect(nextYearPredictions.headcountPlan).toBeDefined();
      expect(nextYearPredictions.skillRequirements).toBeDefined();
      expect(nextYearPredictions.budgetEstimate).toBeDefined();
    });
  });
});

// ヘルパー関数

function createMockDatabase(): any {
  const mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    getAllEmployees: vi.fn().mockResolvedValue([]),
    getEmployee: vi.fn(),
    createEmployee: vi.fn().mockResolvedValue({ id: 'new_emp' }),
    getTimeRecords: vi.fn().mockResolvedValue([]),
    bulkInsertTimeRecords: vi.fn().mockResolvedValue(true),
    getAllTimeRecords: vi.fn().mockResolvedValue([]),
    getExpenseRequests: vi.fn().mockResolvedValue([]),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn()
  };

  // その他の必要なメソッドを追加
  return mockDb;
}

function generateComprehensiveTestEmployees(count: number = 100): Employee[] {
  const departments = ['営業部', '開発部', '人事部', '経理部', '製造部', 'マーケティング部'];
  const positions = ['スタッフ', 'シニアスタッフ', 'リーダー', 'マネージャー', '部長', '執行役員'];
  
  return Array(count).fill(null).map((_, i) => ({
    id: `emp${String(i + 1).padStart(3, '0')}`,
    name: `テスト従業員 ${i + 1}`,
    email: `employee${i + 1}@example.com`,
    department: departments[i % departments.length],
    position: positions[Math.floor(i / 20) % positions.length],
    hourlyWage: 2000 + Math.floor(i / 10) * 500,
    startDate: new Date(
      Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000
    ).toISOString(),
    isActive: true,
    managerId: i > 10 ? `emp${String(Math.floor(i / 10)).padStart(3, '0')}` : undefined,
    // 拡張フィールド
    gender: i % 3 === 0 ? 'female' : 'male',
    age: 25 + Math.floor(i / 5),
    skills: generateRandomSkills(),
    performanceRating: 3 + Math.random() * 2,
    potentialRating: 3 + Math.random() * 2
  }));
}

function generateComprehensiveTimeRecords(employees: Employee[]): TimeRecord[] {
  const records: TimeRecord[] = [];
  const baseDate = new Date('2025-07-01');
  
  employees.forEach(emp => {
    for (let day = 0; day < 31; day++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + day);
      
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      const baseHour = 9;
      const variation = Math.random();
      let clockIn = new Date(date.setHours(baseHour, Math.floor(Math.random() * 30), 0, 0));
      let clockOut: Date;
      
      if (variation < 0.7) {
        // 通常勤務
        clockOut = new Date(date.setHours(18, Math.floor(Math.random() * 30), 0, 0));
      } else if (variation < 0.9) {
        // 残業
        clockOut = new Date(date.setHours(20 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0));
      } else {
        // 早退
        clockOut = new Date(date.setHours(16, Math.floor(Math.random() * 60), 0, 0));
      }
      
      records.push({
        id: `tr_${emp.id}_${day}`,
        employeeId: emp.id,
        date: new Date(date),
        clockIn,
        clockOut,
        breakMinutes: clockOut.getHours() - clockIn.getHours() > 6 ? 60 : 45,
        recordType: Math.random() > 0.1 ? 'ic_card' : 'manual'
      });
    }
  });
  
  return records;
}

function generateComprehensiveExpenses(employees: Employee[]): ExpenseRequest[] {
  const categories = ['交通費', '会議費', '接待交際費', '消耗品費', '研修費', '出張費'];
  const expenses: ExpenseRequest[] = [];
  
  employees.forEach((emp, empIndex) => {
    const expenseCount = Math.floor(Math.random() * 10) + 1;
    
    for (let i = 0; i < expenseCount; i++) {
      expenses.push({
        id: `exp${String(empIndex * 10 + i + 1).padStart(4, '0')}`,
        employeeId: emp.id,
        amount: Math.floor(Math.random() * 50000) + 1000,
        categoryId: categories[i % categories.length],
        description: `${categories[i % categories.length]}支出 ${i + 1}`,
        expenseDate: new Date(2025, 6, Math.floor(Math.random() * 31) + 1),
        status: Math.random() > 0.3 ? 'approved' : 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        currency: 'JPY',
        purpose: '業務関連',
        receiptImageUrl: Math.random() > 0.2 ? `receipt_${empIndex}_${i}.jpg` : undefined,
        approvalRisk: Math.random()
      });
    }
  });
  
  return expenses;
}

function generateOvertimeRecords(employeeId: string, hours: number): TimeRecord[] {
  const records: TimeRecord[] = [];
  const daysNeeded = Math.ceil(hours / 3); // 1日平均3時間の残業
  
  for (let i = 0; i < daysNeeded; i++) {
    const date = new Date('2025-07-01');
    date.setDate(date.getDate() + i);
    
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    records.push({
      id: `ot_${employeeId}_${i}`,
      employeeId,
      date,
      clockIn: new Date(date.setHours(9, 0, 0, 0)),
      clockOut: new Date(date.setHours(22, 0, 0, 0)), // 13時間勤務
      breakMinutes: 60,
      recordType: 'ic_card'
    });
  }
  
  return records;
}

function generateHistoricalOvertimeData(employeeId: string): any[] {
  const data = [];
  
  for (let i = 12; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    
    data.push({
      employee_id: employeeId,
      month: date.toISOString().substring(0, 7),
      overtime_hours: 20 + Math.sin(i) * 15 + Math.random() * 10,
      project_load: 0.6 + Math.sin(i * 0.5) * 0.3,
      team_size: 5 + Math.floor(Math.random() * 3)
    });
  }
  
  return data;
}

function generateRandomSkills(): string[] {
  const allSkills = [
    'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'AWS', 'Docker',
    'Kubernetes', 'SQL', 'NoSQL', 'CI/CD', 'Agile', 'Scrum', 'Leadership',
    'Communication', 'Problem Solving', 'Project Management'
  ];
  
  const skillCount = Math.floor(Math.random() * 5) + 3;
  const skills: string[] = [];
  
  for (let i = 0; i < skillCount; i++) {
    const skill = allSkills[Math.floor(Math.random() * allSkills.length)];
    if (!skills.includes(skill)) {
      skills.push(skill);
    }
  }
  
  return skills;
}

function setupHumanCapitalMockData(db: any): void {
  db.query = vi.fn().mockImplementation((query: string) => {
    if (query.includes('COUNT(*)')) {
      return { rows: [{ count: 100 }] };
    }
    if (query.includes('gender')) {
      return { rows: [{ gender: 'male', count: 60 }, { gender: 'female', count: 40 }] };
    }
    if (query.includes('training')) {
      return { rows: [{ avg_hours: 48.5, completion_rate: 0.85 }] };
    }
    if (query.includes('engagement')) {
      return { rows: [{ avg_score: 4.2 }] };
    }
    return { rows: [] };
  });
}

function setupEmployeeRiskData(db: any, employeeId: string, riskFactors: any): void {
  db.query = vi.fn().mockImplementation((query: string) => {
    if (query.includes('performance')) {
      return { rows: [{ trend: -0.5 }] }; // 下降トレンド
    }
    if (query.includes('engagement')) {
      return { rows: [{ current: 2.5, previous: 4.0 }] }; // 大幅低下
    }
    if (query.includes('compensation')) {
      return { rows: [{ gap: 0.2 }] }; // 20%のギャップ
    }
    return { rows: [] };
  });
}

function setupAnomalousData(db: any, employeeId: string, anomalies: any): void {
  db.query = vi.fn().mockImplementation((query: string) => {
    const results = [];
    
    if (query.includes('payroll') && anomalies.payroll) {
      results.push({
        employee_id: employeeId,
        metric: 'salary_change',
        value: anomalies.payroll.suddenIncrease,
        zscore: 4.5 // 高い異常スコア
      });
    }
    
    if (query.includes('expense') && anomalies.expense) {
      results.push({
        employee_id: employeeId,
        metric: 'expense_frequency',
        value: 50, // 通常の5倍
        zscore: 3.8
      });
    }
    
    return { rows: results };
  });
}

function generateTimeRecordsForPeriod(employeeId: string, days: number): TimeRecord[] {
  const records: TimeRecord[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    records.push({
      id: `tr_${employeeId}_period_${i}`,
      employeeId,
      date,
      clockIn: new Date(date.setHours(9, Math.floor(Math.random() * 15), 0, 0)),
      clockOut: new Date(date.setHours(18 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0)),
      breakMinutes: 60,
      recordType: 'ic_card'
    });
  }
  
  return records;
}

async function fetchMarketData(): Promise<any> {
  // 市場データのモック
  return {
    averageSalaryIncrease: 0.03,
    talentAvailability: 0.7,
    skillDemand: ['AI/ML', 'Cloud', 'Security']
  };
}

async function fetchStrategicGoals(): Promise<any> {
  // 戦略目標のモック
  return {
    revenueGrowth: 0.15,
    headcountGrowth: 0.1,
    digitalizationTargets: ['HR Process', 'Customer Service']
  };
}