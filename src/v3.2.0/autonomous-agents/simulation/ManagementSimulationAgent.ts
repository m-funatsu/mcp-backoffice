/**
 * AI-OS v3.2.0 経営シミュレーション・エージェント
 * What-ifシナリオ分析とROI最適化提案
 */

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  parameters: ScenarioParameters;
  constraints: SimulationConstraints;
  timeHorizon: number; // 月数
  createdBy: string;
  createdAt: Date;
}

interface ScenarioParameters {
  // 人的資本投資
  humanCapital?: {
    trainingBudget?: number;
    hiringPlan?: HiringPlan;
    compensationAdjustment?: number; // パーセント
    benefitsEnhancement?: BenefitsChange[];
  };
  
  // 組織変更
  organizational?: {
    restructuring?: OrganizationalChange[];
    workStyleChanges?: WorkStyleChange[];
    automationTargets?: AutomationTarget[];
  };
  
  // 財務パラメータ
  financial?: {
    budgetReallocation?: BudgetChange[];
    investmentPriorities?: string[];
    costReductionTargets?: number;
  };
  
  // 外部要因
  externalFactors?: {
    marketGrowth?: number;
    inflationRate?: number;
    regulatoryChanges?: string[];
  };
}

interface SimulationConstraints {
  maxBudget?: number;
  minEmployeeCount?: number;
  complianceRequirements: string[];
  preserveKeyTalent: boolean;
  maintainServiceLevel: number; // 0-1
}

interface HiringPlan {
  departments: Record<string, number>;
  skillProfiles: SkillRequirement[];
  timeline: HiringTimeline[];
}

interface SkillRequirement {
  skill: string;
  level: number;
  count: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface HiringTimeline {
  month: number;
  positions: number;
  department: string;
}

interface BenefitsChange {
  type: string;
  currentValue: any;
  newValue: any;
  affectedEmployees: string; // 'all' | department | role
}

interface OrganizationalChange {
  type: 'merge' | 'split' | 'eliminate' | 'create';
  departments: string[];
  newStructure?: any;
  timeline: number; // 月
}

interface WorkStyleChange {
  type: 'remote' | 'hybrid' | 'flexible_hours' | 'compressed_week';
  scope: string; // 'all' | department
  parameters: any;
}

interface AutomationTarget {
  process: string;
  currentFTE: number;
  automationLevel: number; // 0-1
  implementationTime: number; // 月
  investmentRequired: number;
}

interface BudgetChange {
  category: string;
  currentAmount: number;
  newAmount: number;
  justification: string;
}

interface SimulationResult {
  scenarioId: string;
  outcomes: SimulationOutcomes;
  recommendations: Recommendation[];
  risks: RiskAssessment[];
  confidence: number; // 0-1
  assumptions: string[];
  sensitivityAnalysis: SensitivityAnalysis;
}

interface SimulationOutcomes {
  // 財務指標
  financial: {
    revenue: TimeSeriesData;
    costs: TimeSeriesData;
    roi: number;
    paybackPeriod: number;
    npv: number;
  };
  
  // 人的資本指標
  humanCapital: {
    productivity: TimeSeriesData;
    turnoverRate: TimeSeriesData;
    engagementScore: TimeSeriesData;
    skillLevel: TimeSeriesData;
    talentRetention: number;
  };
  
  // 組織指標
  organizational: {
    efficiency: TimeSeriesData;
    innovationIndex: TimeSeriesData;
    agility: TimeSeriesData;
    customerSatisfaction: TimeSeriesData;
  };
  
  // リスク指標
  risk: {
    complianceRisk: TimeSeriesData;
    operationalRisk: TimeSeriesData;
    reputationalRisk: TimeSeriesData;
  };
}

interface TimeSeriesData {
  values: number[];
  timestamps: Date[];
  trend: 'increasing' | 'stable' | 'decreasing';
  volatility: number;
}

interface Recommendation {
  id: string;
  type: 'immediate' | 'short_term' | 'long_term';
  action: string;
  expectedImpact: Impact;
  prerequisites: string[];
  estimatedCost: number;
  confidenceLevel: number;
}

interface Impact {
  metric: string;
  currentValue: number;
  projectedValue: number;
  timeToImpact: number; // 月
  probability: number;
}

interface RiskAssessment {
  risk: string;
  probability: number;
  impact: number;
  mitigationStrategies: string[];
  monitoringIndicators: string[];
}

interface SensitivityAnalysis {
  criticalFactors: SensitivityFactor[];
  breakPoints: BreakPoint[];
  optimalRanges: OptimalRange[];
}

interface SensitivityFactor {
  parameter: string;
  sensitivity: number; // 変化の影響度
  direction: 'positive' | 'negative';
  threshold: number;
}

interface BreakPoint {
  parameter: string;
  value: number;
  consequence: string;
}

interface OptimalRange {
  parameter: string;
  min: number;
  max: number;
  peakValue: number;
}

export class ManagementSimulationAgent {
  private historicalData: Map<string, any> = new Map();
  private models: Map<string, PredictiveModel> = new Map();
  private scenarios: Map<string, SimulationScenario> = new Map();

  constructor() {
    this.initializeModels();
  }

  /**
   * シミュレーションシナリオを作成
   */
  async createScenario(scenario: SimulationScenario): Promise<SimulationScenario> {
    // シナリオの妥当性を検証
    this.validateScenario(scenario);
    
    // シナリオを保存
    this.scenarios.set(scenario.id, scenario);
    
    console.log(`シナリオ「${scenario.name}」を作成しました`);
    return scenario;
  }

  /**
   * What-ifシナリオを実行
   */
  async runSimulation(scenarioId: string): Promise<SimulationResult> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error('シナリオが見つかりません');
    }

    console.log(`シナリオ「${scenario.name}」のシミュレーションを開始...`);

    // ベースラインを確立
    const baseline = await this.establishBaseline();
    
    // シナリオパラメータを適用
    const projectedState = this.applyScenarioParameters(baseline, scenario.parameters);
    
    // 時系列シミュレーションを実行
    const outcomes = await this.simulateOverTime(
      projectedState,
      scenario.parameters,
      scenario.timeHorizon
    );
    
    // 結果を分析
    const analysis = this.analyzeOutcomes(outcomes, baseline, scenario);
    
    // 推奨事項を生成
    const recommendations = this.generateRecommendations(analysis, scenario);
    
    // リスク評価
    const risks = this.assessRisks(outcomes, scenario);
    
    // 感度分析
    const sensitivityAnalysis = await this.performSensitivityAnalysis(
      scenario,
      outcomes
    );

    return {
      scenarioId,
      outcomes,
      recommendations,
      risks,
      confidence: this.calculateConfidence(outcomes, scenario),
      assumptions: this.listAssumptions(scenario),
      sensitivityAnalysis,
    };
  }

  /**
   * ROI最適化分析
   */
  async optimizeROI(
    budget: number,
    objectives: string[],
    constraints: SimulationConstraints
  ): Promise<OptimizationResult> {
    console.log('ROI最適化分析を開始...');

    // 可能な投資オプションを生成
    const investmentOptions = this.generateInvestmentOptions(budget, objectives);
    
    // 各オプションのROIを計算
    const roiAnalysis = await Promise.all(
      investmentOptions.map(option => this.calculateOptionROI(option, constraints))
    );
    
    // パレート最適解を特定
    const paretoOptimal = this.findParetoOptimalSolutions(roiAnalysis);
    
    // 最適な組み合わせを選択
    const optimalPortfolio = this.selectOptimalPortfolio(
      paretoOptimal,
      objectives,
      constraints
    );

    return {
      optimalPortfolio,
      expectedROI: optimalPortfolio.roi || 0,
      investmentBreakdown: optimalPortfolio.breakdown,
      implementationPlan: this.createImplementationPlan(optimalPortfolio),
      alternativeOptions: paretoOptimal.slice(0, 3),
    };
  }

  /**
   * 予測モデルを初期化
   */
  private initializeModels(): void {
    // 生産性予測モデル
    this.models.set('productivity', new ProductivityModel());
    
    // 離職率予測モデル
    this.models.set('turnover', new TurnoverModel());
    
    // エンゲージメント予測モデル
    this.models.set('engagement', new EngagementModel());
    
    // 財務予測モデル
    this.models.set('financial', new FinancialModel());
  }

  /**
   * ベースラインを確立
   */
  private async establishBaseline(): Promise<any> {
    // 現在の組織状態を取得
    return {
      employees: 1000,
      avgProductivity: 0.75,
      turnoverRate: 0.12,
      engagementScore: 0.68,
      revenue: 100000000,
      costs: 80000000,
      skills: {
        technical: 0.7,
        leadership: 0.6,
        innovation: 0.5,
      },
    };
  }

  /**
   * シナリオパラメータを適用
   */
  private applyScenarioParameters(baseline: any, parameters: ScenarioParameters): any {
    const projected = { ...baseline };

    // 人的資本投資の効果
    if (parameters.humanCapital) {
      if (parameters.humanCapital.trainingBudget) {
        const trainingImpact = parameters.humanCapital.trainingBudget / 1000000;
        projected.skills.technical += trainingImpact * 0.1;
        projected.skills.innovation += trainingImpact * 0.05;
      }

      if (parameters.humanCapital.compensationAdjustment) {
        const compAdjustment = parameters.humanCapital.compensationAdjustment / 100;
        projected.turnoverRate *= (1 - compAdjustment * 0.5);
        projected.engagementScore += compAdjustment * 0.2;
      }
    }

    // 組織変更の効果
    if (parameters.organizational) {
      if (parameters.organizational.automationTargets) {
        const automationLevel = parameters.organizational.automationTargets
          .reduce((sum, target) => sum + target.automationLevel, 0) / 
          parameters.organizational.automationTargets.length;
        projected.avgProductivity += automationLevel * 0.3;
        projected.costs *= (1 - automationLevel * 0.2);
      }
    }

    return projected;
  }

  /**
   * 時系列シミュレーション
   */
  private async simulateOverTime(
    initialState: any,
    parameters: ScenarioParameters,
    months: number
  ): Promise<SimulationOutcomes> {
    const outcomes: SimulationOutcomes = {
      financial: {
        revenue: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        costs: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        roi: 0,
        paybackPeriod: 0,
        npv: 0,
      },
      humanCapital: {
        productivity: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        turnoverRate: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        engagementScore: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        skillLevel: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        talentRetention: 0,
      },
      organizational: {
        efficiency: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        innovationIndex: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        agility: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        customerSatisfaction: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
      },
      risk: {
        complianceRisk: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        operationalRisk: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
        reputationalRisk: { values: [], timestamps: [], trend: 'stable', volatility: 0 },
      },
    };

    let currentState = { ...initialState };

    // 各月のシミュレーション
    for (let month = 0; month < months; month++) {
      const timestamp = new Date();
      timestamp.setMonth(timestamp.getMonth() + month);

      // 各モデルで予測
      const productivity = this.models.get('productivity')!.predict(currentState, parameters);
      const turnover = this.models.get('turnover')!.predict(currentState, parameters);
      const engagement = this.models.get('engagement')!.predict(currentState, parameters);
      const financial = this.models.get('financial')!.predict(currentState, parameters);

      // 結果を記録
      outcomes.humanCapital.productivity.values.push(productivity);
      outcomes.humanCapital.productivity.timestamps.push(timestamp);
      outcomes.humanCapital.turnoverRate.values.push(turnover);
      outcomes.humanCapital.turnoverRate.timestamps.push(timestamp);
      outcomes.humanCapital.engagementScore.values.push(engagement);
      outcomes.humanCapital.engagementScore.timestamps.push(timestamp);
      outcomes.financial.revenue.values.push(financial.revenue);
      outcomes.financial.revenue.timestamps.push(timestamp);
      outcomes.financial.costs.values.push(financial.costs);
      outcomes.financial.costs.timestamps.push(timestamp);

      // 状態を更新
      currentState = this.updateState(currentState, {
        productivity,
        turnover,
        engagement,
        financial,
      });
    }

    // 集計指標を計算
    outcomes.financial.roi = this.calculateROI(outcomes.financial);
    outcomes.financial.npv = this.calculateNPV(outcomes.financial);
    outcomes.humanCapital.talentRetention = this.calculateTalentRetention(outcomes.humanCapital);

    // トレンドを分析
    this.analyzeTrends(outcomes);

    return outcomes;
  }

  /**
   * ROIを計算
   */
  private calculateROI(financial: any): number {
    const totalRevenue = financial.revenue.values.reduce((a: number, b: number) => a + b, 0);
    const totalCosts = financial.costs.values.reduce((a: number, b: number) => a + b, 0);
    const netBenefit = totalRevenue - totalCosts;
    const investment = totalCosts * 0.2; // 投資額は総コストの20%と仮定
    return (netBenefit / investment) * 100;
  }

  /**
   * NPVを計算
   */
  private calculateNPV(financial: any): number {
    const discountRate = 0.1 / 12; // 月次割引率
    let npv = 0;
    
    for (let i = 0; i < financial.revenue.values.length; i++) {
      const cashFlow = financial.revenue.values[i] - financial.costs.values[i];
      npv += cashFlow / Math.pow(1 + discountRate, i + 1);
    }
    
    return npv;
  }

  /**
   * タレント保持率を計算
   */
  private calculateTalentRetention(humanCapital: any): number {
    const avgTurnover = humanCapital.turnoverRate.values.reduce(
      (a: number, b: number) => a + b, 0
    ) / humanCapital.turnoverRate.values.length;
    
    return 1 - avgTurnover;
  }

  /**
   * トレンドを分析
   */
  private analyzeTrends(outcomes: SimulationOutcomes): void {
    // 各時系列データのトレンドを分析
    for (const category of Object.values(outcomes)) {
      for (const metric of Object.values(category)) {
        if (metric.values && metric.values.length > 1) {
          const trend = this.calculateTrend(metric.values);
          metric.trend = trend;
          metric.volatility = this.calculateVolatility(metric.values);
        }
      }
    }
  }

  /**
   * トレンドを計算
   */
  private calculateTrend(values: number[]): 'increasing' | 'stable' | 'decreasing' {
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.05) return 'increasing';
    if (secondAvg < firstAvg * 0.95) return 'decreasing';
    return 'stable';
  }

  /**
   * ボラティリティを計算
   */
  private calculateVolatility(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  /**
   * 状態を更新
   */
  private updateState(currentState: any, predictions: any): any {
    return {
      ...currentState,
      avgProductivity: predictions.productivity,
      turnoverRate: predictions.turnover,
      engagementScore: predictions.engagement,
      revenue: predictions.financial.revenue,
      costs: predictions.financial.costs,
    };
  }

  /**
   * 結果を分析
   */
  private analyzeOutcomes(
    outcomes: SimulationOutcomes,
    baseline: any,
    scenario: SimulationScenario
  ): any {
    return {
      improvements: this.identifyImprovements(outcomes, baseline),
      challenges: this.identifyChallenges(outcomes),
      opportunities: this.identifyOpportunities(outcomes, scenario),
    };
  }

  /**
   * 改善点を特定
   */
  private identifyImprovements(outcomes: SimulationOutcomes, baseline: any): any[] {
    const improvements = [];
    
    // 生産性の改善
    const finalProductivity = outcomes.humanCapital.productivity.values.slice(-1)[0];
    if (finalProductivity > baseline.avgProductivity * 1.1) {
      improvements.push({
        metric: 'productivity',
        improvement: ((finalProductivity / baseline.avgProductivity - 1) * 100).toFixed(1),
      });
    }
    
    return improvements;
  }

  /**
   * 課題を特定
   */
  private identifyChallenges(outcomes: SimulationOutcomes): any[] {
    const challenges = [];
    
    // 離職率の増加
    if (outcomes.humanCapital.turnoverRate.trend === 'increasing') {
      challenges.push({
        issue: 'turnover_increase',
        severity: 'high',
        recommendation: '報酬体系の見直しとエンゲージメント向上施策',
      });
    }
    
    return challenges;
  }

  /**
   * 機会を特定
   */
  private identifyOpportunities(outcomes: SimulationOutcomes, scenario: SimulationScenario): any[] {
    return [];
  }

  /**
   * 推奨事項を生成
   */
  private generateRecommendations(
    analysis: any,
    scenario: SimulationScenario
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // 即時実行可能な推奨事項
    if (analysis.improvements.some((i: any) => i.metric === 'productivity')) {
      recommendations.push({
        id: 'rec_1',
        type: 'immediate',
        action: '特定された生産性向上施策を即座に実行',
        expectedImpact: {
          metric: 'productivity',
          currentValue: 0.75,
          projectedValue: 0.85,
          timeToImpact: 3,
          probability: 0.8,
        },
        prerequisites: ['予算承認', 'チームの準備'],
        estimatedCost: 1000000,
        confidenceLevel: 0.85,
      });
    }

    return recommendations;
  }

  /**
   * リスクを評価
   */
  private assessRisks(
    outcomes: SimulationOutcomes,
    scenario: SimulationScenario
  ): RiskAssessment[] {
    return [
      {
        risk: '実行リスク',
        probability: 0.3,
        impact: 0.6,
        mitigationStrategies: ['段階的実装', '継続的モニタリング'],
        monitoringIndicators: ['進捗率', 'ステークホルダー満足度'],
      },
    ];
  }

  /**
   * 感度分析を実行
   */
  private async performSensitivityAnalysis(
    scenario: SimulationScenario,
    outcomes: SimulationOutcomes
  ): Promise<SensitivityAnalysis> {
    return {
      criticalFactors: [
        {
          parameter: 'trainingBudget',
          sensitivity: 0.8,
          direction: 'positive',
          threshold: 500000,
        },
      ],
      breakPoints: [
        {
          parameter: 'turnoverRate',
          value: 0.2,
          consequence: '生産性の急激な低下',
        },
      ],
      optimalRanges: [
        {
          parameter: 'compensationAdjustment',
          min: 5,
          max: 15,
          peakValue: 10,
        },
      ],
    };
  }

  /**
   * 信頼度を計算
   */
  private calculateConfidence(outcomes: SimulationOutcomes, scenario: SimulationScenario): number {
    // モデルの精度、データの質、シナリオの現実性などを考慮
    let confidence = 0.7;
    
    // ボラティリティが高い場合は信頼度を下げる
    const avgVolatility = Object.values(outcomes.humanCapital)
      .filter(metric => metric.volatility !== undefined)
      .reduce((sum, metric) => sum + metric.volatility, 0) / 4;
    
    if (avgVolatility > 0.2) confidence -= 0.1;
    if (avgVolatility > 0.3) confidence -= 0.2;
    
    return Math.max(0.3, confidence);
  }

  /**
   * 前提条件をリスト化
   */
  private listAssumptions(scenario: SimulationScenario): string[] {
    return [
      '現在の市場環境が継続すると仮定',
      '主要な競合他社の戦略に大きな変化がないと仮定',
      '規制環境が安定していると仮定',
      'テクノロジーの進化が予測可能な範囲内と仮定',
    ];
  }

  /**
   * 投資オプションを生成
   */
  private generateInvestmentOptions(budget: number, objectives: string[]): InvestmentOption[] {
    const options: InvestmentOption[] = [];
    const categories = this.getInvestmentCategories(objectives);
    
    // 単一カテゴリへの集中投資オプション
    for (const category of categories) {
      options.push({
        id: `concentrated_${category.id}`,
        name: `${category.name}集中投資`,
        allocation: { [category.id]: budget },
        expectedOutcomes: this.estimateOutcomes(budget, category.id),
        risk: 'high',
        timeframe: category.timeframe,
      });
    }
    
    // バランス型投資オプション
    const balanced = this.createBalancedAllocation(budget, categories);
    options.push({
      id: 'balanced',
      name: 'バランス型投資',
      allocation: balanced,
      expectedOutcomes: this.estimateBalancedOutcomes(balanced, categories),
      risk: 'medium',
      timeframe: 12,
    });
    
    // リスク最小化オプション
    const conservative = this.createConservativeAllocation(budget, categories);
    options.push({
      id: 'conservative',
      name: '安定性重視投資',
      allocation: conservative,
      expectedOutcomes: this.estimateConservativeOutcomes(conservative, categories),
      risk: 'low',
      timeframe: 24,
    });
    
    // 段階的投資オプション
    const phased = this.createPhasedAllocation(budget, categories);
    options.push({
      id: 'phased',
      name: '段階的投資',
      allocation: phased,
      expectedOutcomes: this.estimatePhasedOutcomes(phased, categories),
      risk: 'medium',
      timeframe: 18,
    });
    
    return options;
  }
  
  private getInvestmentCategories(objectives: string[]): InvestmentCategory[] {
    const allCategories: InvestmentCategory[] = [
      { id: 'training', name: '人材育成', expectedROI: 0.25, timeframe: 12 },
      { id: 'technology', name: 'テクノロジー', expectedROI: 0.35, timeframe: 6 },
      { id: 'automation', name: '自動化', expectedROI: 0.45, timeframe: 18 },
      { id: 'wellness', name: '福利厚生', expectedROI: 0.15, timeframe: 24 },
      { id: 'infrastructure', name: 'インフラ', expectedROI: 0.20, timeframe: 36 },
    ];
    
    // マッピングを改善
    const categoryMapping: Record<string, string[]> = {
      'training': ['training', 'education', 'skill', 'development', '育成', '研修'],
      'technology': ['technology', 'tech', 'it', 'system', 'digital', 'テクノロジー', 'システム'],
      'automation': ['automation', 'automate', 'efficiency', 'rpa', '自動化', '効率化'],
      'wellness': ['wellness', 'welfare', 'benefit', 'satisfaction', 'employee', '福利', '厚生', '満足'],
      'infrastructure': ['infrastructure', 'infra', 'facility', 'インフラ', '設備'],
    };
    
    const selectedCategories = allCategories.filter(cat => 
      objectives.some(obj => {
        const objLower = obj.toLowerCase();
        const keywords = categoryMapping[cat.id] || [];
        return keywords.some(keyword => objLower.includes(keyword));
      })
    );
    
    // もし何も選択されない場合は、バランス型として全カテゴリを返す
    return selectedCategories.length > 0 ? selectedCategories : allCategories;
  }
  
  private createBalancedAllocation(budget: number, categories: InvestmentCategory[]): Record<string, number> {
    const allocation: Record<string, number> = {};
    const perCategory = budget / categories.length;
    
    for (const category of categories) {
      allocation[category.id] = perCategory;
    }
    
    return allocation;
  }
  
  private createConservativeAllocation(budget: number, categories: InvestmentCategory[]): Record<string, number> {
    const allocation: Record<string, number> = {};
    const lowRiskCategories = categories.filter(c => c.expectedROI < 0.3);
    const highRiskCategories = categories.filter(c => c.expectedROI >= 0.3);
    
    const lowRiskBudget = budget * 0.7;
    const highRiskBudget = budget * 0.3;
    
    if (lowRiskCategories.length > 0) {
      const perLowRisk = lowRiskBudget / lowRiskCategories.length;
      for (const category of lowRiskCategories) {
        allocation[category.id] = perLowRisk;
      }
    }
    
    if (highRiskCategories.length > 0) {
      const perHighRisk = highRiskBudget / highRiskCategories.length;
      for (const category of highRiskCategories) {
        allocation[category.id] = perHighRisk;
      }
    }
    
    return allocation;
  }
  
  private createPhasedAllocation(budget: number, categories: InvestmentCategory[]): Record<string, number> {
    const allocation: Record<string, number> = {};
    const sortedCategories = categories.sort((a, b) => a.timeframe - b.timeframe);
    
    let remainingBudget = budget;
    for (let i = 0; i < sortedCategories.length; i++) {
      const category = sortedCategories[i];
      const weight = 1 - (i / sortedCategories.length) * 0.5;
      const amount = remainingBudget * weight / (sortedCategories.length - i);
      allocation[category.id] = amount;
      remainingBudget -= amount;
    }
    
    return allocation;
  }
  
  private estimateOutcomes(budget: number, categoryId: string): any {
    const baseROI = this.getBaseROI(categoryId);
    const diminishingFactor = Math.log10(budget / 1000000 + 1);
    const adjustedROI = baseROI * diminishingFactor;
    
    return {
      roi: adjustedROI,
      productivityGain: adjustedROI * 0.3,
      costReduction: adjustedROI * 0.2,
      employeeSatisfaction: adjustedROI * 0.1,
    };
  }
  
  private estimateBalancedOutcomes(allocation: Record<string, number>, categories: InvestmentCategory[]): any {
    let totalROI = 0;
    let totalProductivity = 0;
    let totalCostReduction = 0;
    let totalSatisfaction = 0;
    
    for (const category of categories) {
      const amount = allocation[category.id] || 0;
      const outcomes = this.estimateOutcomes(amount, category.id);
      const weight = amount / Object.values(allocation).reduce((a, b) => a + b, 0);
      
      totalROI += outcomes.roi * weight;
      totalProductivity += outcomes.productivityGain * weight;
      totalCostReduction += outcomes.costReduction * weight;
      totalSatisfaction += outcomes.employeeSatisfaction * weight;
    }
    
    return {
      roi: totalROI * 0.9, // シナジー効果で10%減
      productivityGain: totalProductivity,
      costReduction: totalCostReduction,
      employeeSatisfaction: totalSatisfaction * 1.1, // バランスの良さで10%増
    };
  }
  
  private estimateConservativeOutcomes(allocation: Record<string, number>, categories: InvestmentCategory[]): any {
    const balanced = this.estimateBalancedOutcomes(allocation, categories);
    return {
      roi: balanced.roi * 0.7,
      productivityGain: balanced.productivityGain * 0.8,
      costReduction: balanced.costReduction * 0.9,
      employeeSatisfaction: balanced.employeeSatisfaction * 1.2,
    };
  }
  
  private estimatePhasedOutcomes(allocation: Record<string, number>, categories: InvestmentCategory[]): any {
    const balanced = this.estimateBalancedOutcomes(allocation, categories);
    return {
      roi: balanced.roi * 0.85,
      productivityGain: balanced.productivityGain * 0.95,
      costReduction: balanced.costReduction * 0.9,
      employeeSatisfaction: balanced.employeeSatisfaction,
    };
  }
  
  private getBaseROI(categoryId: string): number {
    const baseROIs: Record<string, number> = {
      training: 0.25,
      technology: 0.35,
      automation: 0.45,
      wellness: 0.15,
      infrastructure: 0.20,
    };
    return baseROIs[categoryId] || 0.2;
  }

  /**
   * オプションのROIを計算
   */
  private async calculateOptionROI(option: InvestmentOption, constraints: SimulationConstraints): Promise<InvestmentAnalysis> {
    const analysis: InvestmentAnalysis = {
      option,
      roi: 0,
      npv: 0,
      paybackPeriod: 0,
      breakEvenPoint: 0,
      constraints: [],
      feasibility: 1,
    };
    
    // 各投資カテゴリの効果を計算
    let totalInvestment = 0;
    let totalReturn = 0;
    let monthlyReturns: number[] = [];
    
    for (const [categoryId, amount] of Object.entries(option.allocation)) {
      totalInvestment += amount;
      const categoryReturns = this.calculateCategoryReturns(categoryId, amount, option.timeframe);
      monthlyReturns = this.combineReturns(monthlyReturns, categoryReturns);
    }
    
    // 制約条件のチェック
    if (constraints.maxBudget && totalInvestment > constraints.maxBudget) {
      analysis.constraints.push('予算超過');
      analysis.feasibility *= 0.5;
    }
    
    // ROI計算
    totalReturn = monthlyReturns.reduce((sum, ret) => sum + ret, 0);
    analysis.roi = ((totalReturn - totalInvestment) / totalInvestment) * 100;
    
    // NPV計算（月次割引率0.8%）
    const discountRate = 0.008;
    analysis.npv = monthlyReturns.reduce((npv, ret, month) => {
      return npv + ret / Math.pow(1 + discountRate, month + 1);
    }, -totalInvestment);
    
    // 回収期間計算
    let cumulativeReturn = 0;
    for (let month = 0; month < monthlyReturns.length; month++) {
      cumulativeReturn += monthlyReturns[month];
      if (cumulativeReturn >= totalInvestment) {
        analysis.paybackPeriod = month + 1;
        analysis.breakEvenPoint = month + 1;
        break;
      }
    }
    
    // リスク調整
    if (option.risk === 'high') {
      analysis.roi *= 0.8;
      analysis.feasibility *= 0.9;
    } else if (option.risk === 'low') {
      analysis.roi *= 0.95;
      analysis.feasibility *= 1.1;
    }
    
    return analysis;
  }
  
  private calculateCategoryReturns(categoryId: string, amount: number, months: number): number[] {
    const returns: number[] = [];
    const baseROI = this.getBaseROI(categoryId);
    const monthlyRate = baseROI / 12;
    
    // S字カーブでリターンをモデル化
    for (let month = 0; month < months; month++) {
      const progress = month / months;
      const sCurve = 1 / (1 + Math.exp(-10 * (progress - 0.5)));
      const monthlyReturn = amount * monthlyRate * sCurve;
      returns.push(monthlyReturn);
    }
    
    return returns;
  }
  
  private combineReturns(returns1: number[], returns2: number[]): number[] {
    const maxLength = Math.max(returns1.length, returns2.length);
    const combined: number[] = [];
    
    for (let i = 0; i < maxLength; i++) {
      const ret1 = returns1[i] || 0;
      const ret2 = returns2[i] || 0;
      combined.push(ret1 + ret2);
    }
    
    return combined;
  }

  /**
   * パレート最適解を特定
   */
  private findParetoOptimalSolutions(roiAnalysis: InvestmentAnalysis[]): InvestmentAnalysis[] {
    const paretoOptimal: InvestmentAnalysis[] = [];
    
    // 実行可能な解のみを対象とする
    const feasibleSolutions = roiAnalysis.filter(analysis => analysis.feasibility > 0.5);
    
    for (const candidate of feasibleSolutions) {
      let isDominated = false;
      
      for (const other of feasibleSolutions) {
        if (candidate === other) continue;
        
        // 他の解が全ての目的関数で優れているかチェック
        const otherBetterROI = other.roi > candidate.roi;
        const otherBetterNPV = other.npv > candidate.npv;
        const otherBetterPayback = other.paybackPeriod < candidate.paybackPeriod;
        const otherBetterFeasibility = other.feasibility > candidate.feasibility;
        
        // 全ての指標で劣っている場合は支配されている
        if (otherBetterROI && otherBetterNPV && otherBetterPayback && otherBetterFeasibility) {
          isDominated = true;
          break;
        }
      }
      
      if (!isDominated) {
        paretoOptimal.push(candidate);
      }
    }
    
    // ROIでソート
    return paretoOptimal.sort((a, b) => b.roi - a.roi);
  }

  /**
   * 最適なポートフォリオを選択
   */
  private selectOptimalPortfolio(
    paretoOptimal: InvestmentAnalysis[],
    objectives: string[],
    constraints: SimulationConstraints
  ): OptimalPortfolio {
    if (paretoOptimal.length === 0) {
      throw new Error('実行可能な投資オプションがありません');
    }
    
    // 目的に応じた重み付け
    const weights = this.calculateObjectiveWeights(objectives);
    
    // 各解のスコアを計算
    let bestScore = -Infinity;
    let bestAnalysis: InvestmentAnalysis = paretoOptimal[0];
    
    for (const analysis of paretoOptimal) {
      let score = 0;
      
      // ROIの重み付け
      score += analysis.roi * weights.roi;
      
      // NPVの重み付け（正規化）
      const normalizedNPV = analysis.npv / 1000000; // 百万円単位
      score += normalizedNPV * weights.npv;
      
      // 回収期間の重み付け（短いほど良い）
      const paybackScore = analysis.paybackPeriod > 0 ? 36 / analysis.paybackPeriod : 0;
      score += paybackScore * weights.payback;
      
      // 実現可能性の重み付け
      score += analysis.feasibility * weights.feasibility;
      
      // サービスレベル維持の考慮
      if (constraints.maintainServiceLevel > 0.8) {
        // リスクが低いオプションを優遇
        if (analysis.option.risk === 'low') {
          score *= 1.2;
        } else if (analysis.option.risk === 'high') {
          score *= 0.8;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestAnalysis = analysis;
      }
    }
    
    return {
      analysis: bestAnalysis,
      score: bestScore,
      roi: bestAnalysis.roi,
      breakdown: this.createBreakdown(bestAnalysis),
      justification: this.createJustification(bestAnalysis, objectives, weights),
    };
  }
  
  private calculateObjectiveWeights(objectives: string[]): ObjectiveWeights {
    const weights: ObjectiveWeights = {
      roi: 0.25,
      npv: 0.25,
      payback: 0.25,
      feasibility: 0.25,
    };
    
    // 目的に応じて重みを調整
    for (const objective of objectives) {
      if (objective.includes('profit') || objective.includes('revenue')) {
        weights.roi = 0.4;
        weights.npv = 0.3;
      } else if (objective.includes('quick') || objective.includes('fast')) {
        weights.payback = 0.4;
        weights.roi = 0.2;
      } else if (objective.includes('safe') || objective.includes('stable')) {
        weights.feasibility = 0.4;
        weights.payback = 0.3;
      }
    }
    
    // 正規化
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    for (const key in weights) {
      weights[key as keyof ObjectiveWeights] /= total;
    }
    
    return weights;
  }
  
  private createBreakdown(analysis: InvestmentAnalysis): InvestmentBreakdown {
    const breakdown: InvestmentBreakdown = {
      categories: [],
      total: 0,
      timeline: [],
    };
    
    for (const [categoryId, amount] of Object.entries(analysis.option.allocation)) {
      breakdown.categories.push({
        id: categoryId,
        name: this.getCategoryName(categoryId),
        amount,
        percentage: 0,
      });
      breakdown.total += amount;
    }
    
    // パーセンテージを計算
    for (const category of breakdown.categories) {
      category.percentage = (category.amount / breakdown.total) * 100;
    }
    
    // タイムラインを作成
    const months = analysis.option.timeframe;
    for (let month = 1; month <= months; month += 3) {
      breakdown.timeline.push({
        month,
        investment: breakdown.total * (month / months),
        expectedReturn: breakdown.total * analysis.roi / 100 * (month / months),
      });
    }
    
    return breakdown;
  }
  
  private createJustification(analysis: InvestmentAnalysis, objectives: string[], weights: ObjectiveWeights): string {
    const reasons: string[] = [];
    
    reasons.push(`このポートフォリオは${analysis.roi.toFixed(1)}%のROIを実現します。`);
    
    if (analysis.paybackPeriod > 0) {
      reasons.push(`投資回収期間は${analysis.paybackPeriod}ヶ月です。`);
    }
    
    if (analysis.option.risk === 'low') {
      reasons.push('低リスクで安定した成果が期待できます。');
    } else if (analysis.option.risk === 'medium') {
      reasons.push('リスクとリターンのバランスが取れています。');
    }
    
    if (weights.roi > 0.3) {
      reasons.push('収益性を重視した選択です。');
    } else if (weights.feasibility > 0.3) {
      reasons.push('実現可能性を重視した選択です。');
    }
    
    return reasons.join(' ');
  }
  
  private getCategoryName(categoryId: string): string {
    const names: Record<string, string> = {
      training: '人材育成',
      technology: 'テクノロジー',
      automation: '自動化',
      wellness: '福利厚生',
      infrastructure: 'インフラ',
    };
    return names[categoryId] || categoryId;
  }

  /**
   * 実装計画を作成
   */
  private createImplementationPlan(portfolio: OptimalPortfolio): ImplementationPlan {
    const plan: ImplementationPlan = {
      phases: [],
      milestones: [],
      resources: [],
      risks: [],
      totalDuration: portfolio.analysis.option.timeframe,
    };
    
    // フェーズを作成
    const phases = this.createImplementationPhases(portfolio);
    plan.phases = phases;
    
    // マイルストーンを設定
    plan.milestones = this.createMilestones(phases, portfolio);
    
    // 必要リソースを特定
    plan.resources = this.identifyRequiredResources(portfolio);
    
    // 実装リスクを評価
    plan.risks = this.assessImplementationRisks(portfolio);
    
    return plan;
  }
  
  private createImplementationPhases(portfolio: OptimalPortfolio): ImplementationPhase[] {
    const phases: ImplementationPhase[] = [];
    const sortedCategories = Object.entries(portfolio.analysis.option.allocation)
      .sort(([, a], [, b]) => b - a); // 投資額の大きい順
    
    // 準備フェーズ
    phases.push({
      id: 'preparation',
      name: '準備・計画フェーズ',
      duration: 1,
      activities: [
        'ステークホルダーの合意形成',
        'プロジェクトチームの編成',
        '詳細計画の策定',
        'ベースライン測定',
      ],
      dependencies: [],
      deliverables: ['実装計画書', '体制図', 'KPI定義書'],
    });
    
    // カテゴリごとの実装フェーズ
    let startMonth = 2;
    for (const [categoryId, amount] of sortedCategories) {
      const duration = Math.ceil(amount / 1000000) + 2; // 投資額に応じた期間
      phases.push({
        id: `implement_${categoryId}`,
        name: `${this.getCategoryName(categoryId)}実装フェーズ`,
        duration,
        activities: this.getCategoryActivities(categoryId),
        dependencies: ['preparation'],
        deliverables: this.getCategoryDeliverables(categoryId),
      });
      startMonth += duration;
    }
    
    // 定着・最適化フェーズ
    phases.push({
      id: 'optimization',
      name: '定着・最適化フェーズ',
      duration: 3,
      activities: [
        '効果測定',
        'フィードバック収集',
        'プロセス最適化',
        'ベストプラクティス展開',
      ],
      dependencies: sortedCategories.map(([id]) => `implement_${id}`),
      deliverables: ['効果測定レポート', '改善提案書'],
    });
    
    return phases;
  }
  
  private getCategoryActivities(categoryId: string): string[] {
    const activities: Record<string, string[]> = {
      training: [
        'スキルギャップ分析',
        '研修プログラム設計',
        'トレーナー育成',
        '研修実施',
        '効果測定',
      ],
      technology: [
        'システム要件定義',
        'ベンダー選定',
        'システム導入',
        'データ移行',
        'ユーザートレーニング',
      ],
      automation: [
        'プロセス分析',
        '自動化対象選定',
        'RPA/AI開発',
        'パイロット実施',
        '本番展開',
      ],
      wellness: [
        '従業員ニーズ調査',
        '福利厚生プログラム設計',
        'ベンダー契約',
        'プログラム導入',
        '利用促進活動',
      ],
      infrastructure: [
        'インフラ評価',
        '設計・調達',
        '構築・設定',
        'テスト・検証',
        '本番移行',
      ],
    };
    return activities[categoryId] || ['計画', '実装', 'テスト', '展開'];
  }
  
  private getCategoryDeliverables(categoryId: string): string[] {
    const deliverables: Record<string, string[]> = {
      training: ['研修カリキュラム', '教材', 'スキル向上レポート'],
      technology: ['システム仕様書', '運用マニュアル', '移行完了報告書'],
      automation: ['自動化設計書', 'RPAボット', '効率化レポート'],
      wellness: ['福利厚生ガイド', '利用規程', '満足度調査結果'],
      infrastructure: ['インフラ設計書', '構築完了報告書', '運用手順書'],
    };
    return deliverables[categoryId] || ['実装完了報告書'];
  }
  
  private createMilestones(phases: ImplementationPhase[], portfolio: OptimalPortfolio): Milestone[] {
    const milestones: Milestone[] = [];
    let cumulativeMonth = 0;
    
    for (const phase of phases) {
      cumulativeMonth += phase.duration;
      milestones.push({
        id: `milestone_${phase.id}`,
        name: `${phase.name}完了`,
        targetDate: cumulativeMonth,
        criteria: phase.deliverables.map(d => `${d}の完成`),
        impact: this.estimatePhaseImpact(phase, portfolio),
      });
    }
    
    // 主要マイルストーンを追加
    milestones.push({
      id: 'milestone_halfway',
      name: '中間評価',
      targetDate: Math.floor(portfolio.analysis.option.timeframe / 2),
      criteria: ['KPI達成率50%以上', 'リスク評価', '計画見直し'],
      impact: 'high',
    });
    
    milestones.push({
      id: 'milestone_completion',
      name: 'プロジェクト完了',
      targetDate: portfolio.analysis.option.timeframe,
      criteria: ['全フェーズ完了', 'ROI目標達成', '定着確認'],
      impact: 'critical',
    });
    
    return milestones.sort((a, b) => a.targetDate - b.targetDate);
  }
  
  private estimatePhaseImpact(phase: ImplementationPhase, portfolio: OptimalPortfolio): string {
    if (phase.id === 'preparation') return 'medium';
    if (phase.id === 'optimization') return 'high';
    
    // 投資額に基づいて影響度を判定
    const categoryId = phase.id.replace('implement_', '');
    const investment = portfolio.analysis.option.allocation[categoryId] || 0;
    const totalInvestment = Object.values(portfolio.analysis.option.allocation)
      .reduce((sum, amount) => sum + amount, 0);
    const percentage = investment / totalInvestment;
    
    if (percentage > 0.4) return 'critical';
    if (percentage > 0.2) return 'high';
    return 'medium';
  }
  
  private identifyRequiredResources(portfolio: OptimalPortfolio): RequiredResource[] {
    const resources: RequiredResource[] = [];
    
    // プロジェクトマネジメント
    resources.push({
      type: 'human',
      role: 'プロジェクトマネージャー',
      quantity: 1,
      duration: portfolio.analysis.option.timeframe,
      skills: ['プロジェクト管理', '変革管理', 'ステークホルダー管理'],
    });
    
    // カテゴリ別リソース
    for (const [categoryId, amount] of Object.entries(portfolio.analysis.option.allocation)) {
      const categoryResources = this.getCategoryResources(categoryId, amount);
      resources.push(...categoryResources);
    }
    
    // 予算リソース
    resources.push({
      type: 'financial',
      role: '投資予算',
      quantity: portfolio.breakdown.total,
      duration: portfolio.analysis.option.timeframe,
      skills: [],
    });
    
    return resources;
  }
  
  private getCategoryResources(categoryId: string, amount: number): RequiredResource[] {
    const resources: RequiredResource[] = [];
    const scale = amount / 1000000; // 百万円単位
    
    switch (categoryId) {
      case 'training':
        resources.push({
          type: 'human',
          role: '研修講師',
          quantity: Math.ceil(scale / 5),
          duration: 6,
          skills: ['専門知識', '教育スキル'],
        });
        break;
      case 'technology':
        resources.push({
          type: 'human',
          role: 'ITエンジニア',
          quantity: Math.ceil(scale / 3),
          duration: 12,
          skills: ['システム開発', 'インフラ構築'],
        });
        break;
      case 'automation':
        resources.push({
          type: 'human',
          role: 'RPA開発者',
          quantity: Math.ceil(scale / 4),
          duration: 9,
          skills: ['RPA開発', 'プロセス分析'],
        });
        break;
    }
    
    return resources;
  }
  
  private assessImplementationRisks(portfolio: OptimalPortfolio): ImplementationRisk[] {
    const risks: ImplementationRisk[] = [];
    
    // 共通リスク
    risks.push({
      id: 'risk_resistance',
      category: '組織',
      description: '変革への抵抗',
      probability: 0.6,
      impact: 0.7,
      mitigation: '段階的導入とコミュニケーション強化',
    });
    
    risks.push({
      id: 'risk_budget',
      category: '財務',
      description: '予算超過',
      probability: 0.4,
      impact: 0.6,
      mitigation: '厳格な予算管理と早期警告システム',
    });
    
    // 投資規模に応じたリスク
    if (portfolio.breakdown.total > 10000000) {
      risks.push({
        id: 'risk_complexity',
        category: 'プロジェクト',
        description: '複雑性による遅延',
        probability: 0.7,
        impact: 0.5,
        mitigation: 'フェーズ分割と段階的実装',
      });
    }
    
    // リスクレベルに応じたリスク
    if (portfolio.analysis.option.risk === 'high') {
      risks.push({
        id: 'risk_technology',
        category: '技術',
        description: '新技術の導入失敗',
        probability: 0.5,
        impact: 0.8,
        mitigation: 'POC実施とフォールバック計画',
      });
    }
    
    return risks;
  }

  /**
   * シナリオの妥当性を検証
   */
  private validateScenario(scenario: SimulationScenario): void {
    if (scenario.timeHorizon < 1 || scenario.timeHorizon > 60) {
      throw new Error('シミュレーション期間は1〜60ヶ月の範囲で設定してください');
    }
  }
}

// 予測モデルの基底クラス
abstract class PredictiveModel {
  abstract predict(state: any, parameters: any): any;
}

// 具体的な予測モデル
class ProductivityModel extends PredictiveModel {
  predict(state: any, parameters: any): number {
    let productivity = state.avgProductivity;
    
    // トレーニングの効果
    if (parameters.humanCapital?.trainingBudget) {
      const trainingEffect = Math.log(parameters.humanCapital.trainingBudget / 1000000 + 1) * 0.05;
      productivity += trainingEffect;
    }
    
    // エンゲージメントの影響
    productivity *= (0.5 + state.engagementScore * 0.5);
    
    return Math.min(1, productivity);
  }
}

class TurnoverModel extends PredictiveModel {
  predict(state: any, parameters: any): number {
    let turnover = state.turnoverRate;
    
    // 報酬調整の効果
    if (parameters.humanCapital?.compensationAdjustment) {
      const compEffect = parameters.humanCapital.compensationAdjustment / 100;
      turnover *= (1 - compEffect * 0.4);
    }
    
    // エンゲージメントの影響
    turnover *= (2 - state.engagementScore);
    
    return Math.max(0, Math.min(0.5, turnover));
  }
}

class EngagementModel extends PredictiveModel {
  predict(state: any, parameters: any): number {
    let engagement = state.engagementScore;
    
    // 各種施策の効果
    if (parameters.humanCapital?.benefitsEnhancement) {
      engagement += parameters.humanCapital.benefitsEnhancement.length * 0.02;
    }
    
    if (parameters.organizational?.workStyleChanges) {
      engagement += parameters.organizational.workStyleChanges.length * 0.03;
    }
    
    return Math.min(1, engagement);
  }
}

class FinancialModel extends PredictiveModel {
  predict(state: any, parameters: any): { revenue: number; costs: number } {
    const productivityImpact = state.avgProductivity / 0.75; // ベースライン比
    
    let revenue = state.revenue * productivityImpact;
    let costs = state.costs;
    
    // 自動化の効果
    if (parameters.organizational?.automationTargets) {
      const automationSavings = parameters.organizational.automationTargets
        .reduce((sum: number, target: any) => sum + target.currentFTE * 50000 * target.automationLevel, 0);
      costs -= automationSavings / 12; // 月次換算
    }
    
    return { revenue, costs };
  }
}

// 追加の型定義
interface InvestmentOption {
  id: string;
  name: string;
  allocation: Record<string, number>;
  expectedOutcomes: any;
  risk: 'low' | 'medium' | 'high';
  timeframe: number;
}

interface InvestmentCategory {
  id: string;
  name: string;
  expectedROI: number;
  timeframe: number;
}

interface InvestmentAnalysis {
  option: InvestmentOption;
  roi: number;
  npv: number;
  paybackPeriod: number;
  breakEvenPoint: number;
  constraints: string[];
  feasibility: number;
}

interface OptimalPortfolio {
  analysis: InvestmentAnalysis;
  score: number;
  roi: number;
  breakdown: InvestmentBreakdown;
  justification: string;
}

interface InvestmentBreakdown {
  categories: Array<{
    id: string;
    name: string;
    amount: number;
    percentage: number;
  }>;
  total: number;
  timeline: Array<{
    month: number;
    investment: number;
    expectedReturn: number;
  }>;
}

interface ObjectiveWeights {
  roi: number;
  npv: number;
  payback: number;
  feasibility: number;
}

interface ImplementationPlan {
  phases: ImplementationPhase[];
  milestones: Milestone[];
  resources: RequiredResource[];
  risks: ImplementationRisk[];
  totalDuration: number;
}

interface ImplementationPhase {
  id: string;
  name: string;
  duration: number;
  activities: string[];
  dependencies: string[];
  deliverables: string[];
}

interface Milestone {
  id: string;
  name: string;
  targetDate: number;
  criteria: string[];
  impact: string;
}

interface RequiredResource {
  type: 'human' | 'financial' | 'technical';
  role: string;
  quantity: number;
  duration: number;
  skills: string[];
}

interface ImplementationRisk {
  id: string;
  category: string;
  description: string;
  probability: number;
  impact: number;
  mitigation: string;
}

// 最適化結果の型定義
interface OptimizationResult {
  optimalPortfolio: OptimalPortfolio;
  expectedROI: number;
  investmentBreakdown: InvestmentBreakdown;
  implementationPlan: ImplementationPlan;
  alternativeOptions: InvestmentAnalysis[];
}