/**
 * 経営シミュレーション・エージェントのテスト
 */

import { ManagementSimulationAgent } from '../ManagementSimulationAgent';

describe('ManagementSimulationAgent', () => {
  let agent: ManagementSimulationAgent;

  beforeEach(() => {
    agent = new ManagementSimulationAgent();
  });

  describe('シナリオ作成', () => {
    it('有効なシナリオを作成できる', async () => {
      const scenario = {
        id: 'scenario_1',
        name: '人材育成投資シナリオ',
        description: '年間2000万円の研修予算投入による生産性向上',
        parameters: {
          humanCapital: {
            trainingBudget: 20000000,
            compensationAdjustment: 5,
          },
        },
        constraints: {
          maxBudget: 30000000,
          complianceRequirements: ['労働基準法準拠'],
          preserveKeyTalent: true,
          maintainServiceLevel: 0.9,
        },
        timeHorizon: 12,
        createdBy: 'test_user',
        createdAt: new Date(),
      };

      const created = await agent.createScenario(scenario);
      expect(created).toEqual(scenario);
    });

    it('無効な期間のシナリオはエラーになる', async () => {
      const scenario = {
        id: 'scenario_2',
        name: 'テストシナリオ',
        description: 'テスト',
        parameters: {},
        constraints: {
          complianceRequirements: [],
          preserveKeyTalent: false,
          maintainServiceLevel: 0.8,
        },
        timeHorizon: 100, // 無効な期間
        createdBy: 'test_user',
        createdAt: new Date(),
      };

      await expect(agent.createScenario(scenario)).rejects.toThrow(
        'シミュレーション期間は1〜60ヶ月の範囲で設定してください'
      );
    });
  });

  describe('シミュレーション実行', () => {
    beforeEach(async () => {
      // テスト用シナリオを作成
      const scenario = {
        id: 'test_scenario',
        name: '統合投資シナリオ',
        description: '複数領域への戦略的投資',
        parameters: {
          humanCapital: {
            trainingBudget: 10000000,
            compensationAdjustment: 3,
            benefitsEnhancement: [
              {
                type: 'health_insurance',
                currentValue: 'basic',
                newValue: 'premium',
                affectedEmployees: 'all',
              },
            ],
          },
          organizational: {
            automationTargets: [
              {
                process: '経費精算',
                currentFTE: 5,
                automationLevel: 0.8,
                implementationTime: 6,
                investmentRequired: 5000000,
              },
            ],
            workStyleChanges: [
              {
                type: 'hybrid',
                scope: 'all',
                parameters: { daysInOffice: 2 },
              },
            ],
          },
        },
        constraints: {
          maxBudget: 20000000,
          minEmployeeCount: 900,
          complianceRequirements: ['労働基準法', '個人情報保護法'],
          preserveKeyTalent: true,
          maintainServiceLevel: 0.85,
        },
        timeHorizon: 24,
        createdBy: 'test_user',
        createdAt: new Date(),
      };
      await agent.createScenario(scenario);
    });

    it('シナリオのシミュレーションを実行できる', async () => {
      const result = await agent.runSimulation('test_scenario');

      expect(result).toBeDefined();
      expect(result.scenarioId).toBe('test_scenario');
      expect(result.outcomes).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.risks).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.assumptions).toBeInstanceOf(Array);
      expect(result.sensitivityAnalysis).toBeDefined();
    });

    it('財務指標が正しく計算される', async () => {
      const result = await agent.runSimulation('test_scenario');
      const financial = result.outcomes.financial;

      expect(financial.revenue.values).toHaveLength(24);
      expect(financial.costs.values).toHaveLength(24);
      expect(financial.roi).toBeGreaterThan(-100);
      expect(financial.npv).toBeDefined();
      expect(financial.paybackPeriod).toBeGreaterThanOrEqual(0);
    });

    it('人的資本指標が正しく計算される', async () => {
      const result = await agent.runSimulation('test_scenario');
      const humanCapital = result.outcomes.humanCapital;

      expect(humanCapital.productivity.values).toHaveLength(24);
      expect(humanCapital.turnoverRate.values).toHaveLength(24);
      expect(humanCapital.engagementScore.values).toHaveLength(24);
      expect(humanCapital.talentRetention).toBeGreaterThan(0);
      expect(humanCapital.talentRetention).toBeLessThanOrEqual(1);
    });

    it('トレンド分析が実行される', async () => {
      const result = await agent.runSimulation('test_scenario');
      const productivity = result.outcomes.humanCapital.productivity;

      expect(['increasing', 'stable', 'decreasing']).toContain(productivity.trend);
      expect(productivity.volatility).toBeGreaterThanOrEqual(0);
    });

    it('推奨事項が生成される', async () => {
      const result = await agent.runSimulation('test_scenario');
      const recommendations = result.recommendations;

      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec.id).toBeDefined();
        expect(['immediate', 'short_term', 'long_term']).toContain(rec.type);
        expect(rec.action).toBeDefined();
        expect(rec.expectedImpact).toBeDefined();
        expect(rec.confidenceLevel).toBeGreaterThan(0);
        expect(rec.confidenceLevel).toBeLessThanOrEqual(1);
      }
    });

    it('リスク評価が実行される', async () => {
      const result = await agent.runSimulation('test_scenario');
      const risks = result.risks;

      expect(risks.length).toBeGreaterThan(0);
      const risk = risks[0];
      expect(risk.risk).toBeDefined();
      expect(risk.probability).toBeGreaterThan(0);
      expect(risk.probability).toBeLessThanOrEqual(1);
      expect(risk.impact).toBeGreaterThan(0);
      expect(risk.impact).toBeLessThanOrEqual(1);
      expect(risk.mitigationStrategies).toBeInstanceOf(Array);
    });

    it('感度分析が実行される', async () => {
      const result = await agent.runSimulation('test_scenario');
      const sensitivity = result.sensitivityAnalysis;

      expect(sensitivity.criticalFactors).toBeInstanceOf(Array);
      expect(sensitivity.breakPoints).toBeInstanceOf(Array);
      expect(sensitivity.optimalRanges).toBeInstanceOf(Array);

      if (sensitivity.criticalFactors.length > 0) {
        const factor = sensitivity.criticalFactors[0];
        expect(factor.parameter).toBeDefined();
        expect(factor.sensitivity).toBeGreaterThan(0);
        expect(['positive', 'negative']).toContain(factor.direction);
        expect(factor.threshold).toBeDefined();
      }
    });

    it('存在しないシナリオはエラーになる', async () => {
      await expect(agent.runSimulation('non_existent')).rejects.toThrow(
        'シナリオが見つかりません'
      );
    });
  });

  describe('ROI最適化', () => {
    it('投資オプションを生成できる', async () => {
      const budget = 10000000;
      const objectives = ['productivity', 'cost_reduction', 'employee_satisfaction'];
      const constraints = {
        maxBudget: budget,
        complianceRequirements: ['労働基準法'],
        preserveKeyTalent: true,
        maintainServiceLevel: 0.9,
      };

      const result = await agent.optimizeROI(budget, objectives, constraints);

      expect(result).toBeDefined();
      expect(result.optimalPortfolio).toBeDefined();
      expect(result.expectedROI).toBeGreaterThan(-100);
      expect(result.investmentBreakdown).toBeDefined();
      expect(result.implementationPlan).toBeDefined();
      expect(result.alternativeOptions).toBeInstanceOf(Array);
    });

    it('最適ポートフォリオが選択される', async () => {
      const budget = 20000000;
      const objectives = ['automation', 'technology'];
      const constraints = {
        maxBudget: budget,
        complianceRequirements: [],
        preserveKeyTalent: false,
        maintainServiceLevel: 0.8,
      };

      const result = await agent.optimizeROI(budget, objectives, constraints);
      const portfolio = result.optimalPortfolio;

      expect(portfolio.roi).toBeDefined();
      expect(portfolio.breakdown).toBeDefined();
      expect(portfolio.breakdown.total).toBeLessThanOrEqual(budget);
      expect(portfolio.justification).toBeDefined();
    });

    it('実装計画が生成される', async () => {
      const budget = 15000000;
      const objectives = ['training', 'wellness'];
      const constraints = {
        maxBudget: budget,
        complianceRequirements: [],
        preserveKeyTalent: true,
        maintainServiceLevel: 0.85,
      };

      const result = await agent.optimizeROI(budget, objectives, constraints);
      const plan = result.implementationPlan;

      expect(plan.phases).toBeInstanceOf(Array);
      expect(plan.phases.length).toBeGreaterThan(0);
      expect(plan.milestones).toBeInstanceOf(Array);
      expect(plan.resources).toBeInstanceOf(Array);
      expect(plan.risks).toBeInstanceOf(Array);
      expect(plan.totalDuration).toBeGreaterThan(0);
    });

    it('フェーズが正しく構成される', async () => {
      const budget = 10000000;
      const objectives = ['technology', 'automation'];
      const constraints = {
        maxBudget: budget,
        complianceRequirements: [],
        preserveKeyTalent: false,
        maintainServiceLevel: 0.8,
      };

      const result = await agent.optimizeROI(budget, objectives, constraints);
      const phases = result.implementationPlan.phases;

      // 準備フェーズが最初にある
      expect(phases[0].id).toBe('preparation');
      expect(phases[0].name).toContain('準備');
      expect(phases[0].activities).toBeInstanceOf(Array);
      expect(phases[0].deliverables).toBeInstanceOf(Array);

      // 最適化フェーズが最後にある
      const lastPhase = phases[phases.length - 1];
      expect(lastPhase.id).toBe('optimization');
      expect(lastPhase.name).toContain('最適化');
    });

    it('必要リソースが特定される', async () => {
      const budget = 5000000;
      const objectives = ['training'];
      const constraints = {
        maxBudget: budget,
        complianceRequirements: [],
        preserveKeyTalent: false,
        maintainServiceLevel: 0.8,
      };

      const result = await agent.optimizeROI(budget, objectives, constraints);
      const resources = result.implementationPlan.resources;

      // プロジェクトマネージャーは必須
      const pmResource = resources.find(r => r.role === 'プロジェクトマネージャー');
      expect(pmResource).toBeDefined();
      expect(pmResource?.type).toBe('human');
      expect(pmResource?.quantity).toBe(1);

      // 予算リソース
      const budgetResource = resources.find(r => r.type === 'financial');
      expect(budgetResource).toBeDefined();
      expect(budgetResource?.quantity).toBeLessThanOrEqual(budget);
    });

    it('代替オプションが提示される', async () => {
      const budget = 15000000;
      const objectives = ['automation', 'training', 'technology'];
      const constraints = {
        maxBudget: budget,
        complianceRequirements: [],
        preserveKeyTalent: true,
        maintainServiceLevel: 0.9,
      };

      const result = await agent.optimizeROI(budget, objectives, constraints);
      const alternatives = result.alternativeOptions;

      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.length).toBeLessThanOrEqual(3);

      for (const alt of alternatives) {
        expect(alt.option).toBeDefined();
        expect(alt.roi).toBeDefined();
        expect(alt.feasibility).toBeGreaterThan(0);
      }
    });
  });
});