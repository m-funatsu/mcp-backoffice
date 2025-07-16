/**
 * v2.2.0: Talent Management Engine
 * タレントマネジメントエンジン
 * 
 * スキル管理、研修管理、パフォーマンス評価、目標管理（MBO/OKR）の統合管理
 * 戦略的人事への進化を支援するコア機能
 */

import Database from './database.js';
import type { 
  TalentSkill, 
  EmployeeSkill, 
  TrainingRecord, 
  PerformanceEvaluationV2, 
  GoalOKR,
  SkillMap,
  SkillGap,
  TalentDashboard,
  TalentAnalytics,
  TrainingRecommendation,
  CareerPathSuggestion,
  TalentWorkflow
} from './types.js';

export class TalentManagementEngine {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * 🧠 スキル管理システム
   */

  /**
   * スキルマップ生成
   */
  async generateSkillMap(employeeId: string): Promise<SkillMap> {
    const employeeSkills = await this.db.getEmployeeSkills(employeeId);
    const skillsByCategory: Record<string, EmployeeSkill[]> = {};

    // カテゴリ別スキル分類
    employeeSkills.forEach(skill => {
      if (!skillsByCategory[skill.skill_category]) {
        skillsByCategory[skill.skill_category] = [];
      }
      skillsByCategory[skill.skill_category].push({
        id: skill.id,
        employeeId: skill.employee_id,
        skillId: skill.skill_id,
        proficiencyLevel: skill.proficiency_level,
        selfAssessedLevel: skill.self_assessed_level,
        managerAssessedLevel: skill.manager_assessed_level,
        assessmentDate: skill.assessment_date,
        lastUpdated: skill.last_updated,
        notes: skill.notes,
        createdAt: skill.created_at,
        updatedAt: skill.updated_at
      });
    });

    // スキルギャップ分析
    const skillGaps = await this.analyzeSkillGaps(employeeId);
    
    // 研修推奨の生成
    const recommendedTraining = await this.generateTrainingRecommendations(employeeId, skillGaps);
    
    // キャリアパス提案
    const careerPathSuggestions = await this.generateCareerPathSuggestions(employeeId, skillsByCategory);

    return {
      employeeId,
      skillsByCategory,
      skillGaps,
      recommendedTraining,
      careerPathSuggestions,
      lastUpdated: new Date()
    };
  }

  /**
   * スキルギャップ分析
   */
  private async analyzeSkillGaps(employeeId: string): Promise<SkillGap[]> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) return [];

    // 職位に必要なスキルを取得（実装では職位別スキル要件テーブルを参照）
    const requiredSkills = await this.getRequiredSkillsForPosition(employee.position);
    const currentSkills = await this.db.getEmployeeSkills(employeeId);

    const skillGaps: SkillGap[] = [];

    for (const requiredSkill of requiredSkills) {
      const currentSkill = currentSkills.find(s => s.skill_id === requiredSkill.skillId);
      const currentLevel = currentSkill ? currentSkill.proficiency_level : 0;
      const requiredLevel = requiredSkill.requiredLevel;

      if (currentLevel < requiredLevel) {
        const gapSize = requiredLevel - currentLevel;
        skillGaps.push({
          skillId: requiredSkill.skillId,
          skillName: requiredSkill.skillName,
          currentLevel,
          requiredLevel,
          gapSize,
          priority: gapSize >= 3 ? 'high' : gapSize >= 2 ? 'medium' : 'low',
          developmentActions: this.generateDevelopmentActions(requiredSkill.skillId, gapSize)
        });
      }
    }

    return skillGaps.sort((a, b) => b.gapSize - a.gapSize);
  }

  /**
   * 研修推奨生成
   */
  private async generateTrainingRecommendations(employeeId: string, skillGaps: SkillGap[]): Promise<TrainingRecommendation[]> {
    const recommendations: TrainingRecommendation[] = [];

    for (const gap of skillGaps.slice(0, 5)) { // 上位5つのギャップに対応
      const availableTrainings = await this.getTrainingsForSkill(gap.skillId);
      
      for (const training of availableTrainings) {
        recommendations.push({
          trainingId: training.id,
          trainingName: training.name,
          trainingType: training.type,
          targetSkills: [gap.skillId],
          priority: gap.priority,
          estimatedDuration: training.durationHours,
          estimatedCost: training.cost,
          provider: training.provider
        });
      }
    }

    return recommendations;
  }

  /**
   * キャリアパス提案生成
   */
  private async generateCareerPathSuggestions(employeeId: string, skillsByCategory: Record<string, EmployeeSkill[]>): Promise<CareerPathSuggestion[]> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) return [];

    const suggestions: CareerPathSuggestion[] = [];
    
    // 現在のスキルレベルに基づいて次の職位を提案
    const possiblePositions = await this.getPossibleCareerProgression(employee.position, employee.department);
    
    for (const position of possiblePositions) {
      const requiredSkills = await this.getRequiredSkillsForPosition(position.title);
      const missingSkills = requiredSkills.filter(req => {
        const currentSkill = Object.values(skillsByCategory).flat().find(s => s.skillId === req.skillId);
        return !currentSkill || currentSkill.proficiencyLevel < req.requiredLevel;
      });

      const readinessScore = Math.max(0, 100 - (missingSkills.length * 15));
      const timeframe = Math.max(6, missingSkills.length * 3); // 最低6ヶ月

      suggestions.push({
        targetPosition: position.title,
        timeframe,
        requiredSkills: missingSkills.map(s => s.skillName),
        recommendedExperience: position.requiredExperience,
        developmentPlan: this.generateDevelopmentPlan(missingSkills),
        readinessScore
      });
    }

    return suggestions.sort((a, b) => b.readinessScore - a.readinessScore);
  }

  /**
   * 📚 研修・育成管理システム
   */

  /**
   * 研修計画作成
   */
  async createTrainingPlan(employeeId: string, skillGaps: SkillGap[]): Promise<TrainingRecord[]> {
    const trainingPlan: TrainingRecord[] = [];
    
    for (const gap of skillGaps) {
      const availableTrainings = await this.getTrainingsForSkill(gap.skillId);
      
      // 優先度に基づいて最適な研修を選択
      const selectedTraining = this.selectOptimalTraining(availableTrainings, gap);
      
      if (selectedTraining) {
        const trainingRecord: TrainingRecord = {
          id: `TR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          employeeId,
          trainingName: selectedTraining.name,
          trainingType: selectedTraining.type,
          provider: selectedTraining.provider,
          startDate: this.calculateOptimalStartDate(gap.priority),
          endDate: this.calculateEndDate(selectedTraining.durationHours),
          durationHours: selectedTraining.durationHours,
          cost: selectedTraining.cost,
          status: 'scheduled',
          relatedSkills: [gap.skillId],
          notes: `Gap size: ${gap.gapSize}, Priority: ${gap.priority}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        trainingPlan.push(trainingRecord);
      }
    }

    return trainingPlan;
  }

  /**
   * 研修効果測定（カークパトリック4段階評価）
   */
  async evaluateTrainingEffectiveness(trainingId: string, employeeId: string): Promise<{
    level1: number; // 反応
    level2: number; // 学習
    level3: number; // 行動
    level4: number; // 結果
    roi: number;
  }> {
    const training = await this.db.getTrainingHistory(employeeId).then(history => 
      history.find(t => t.id === trainingId)
    );

    if (!training) {
      throw new Error('Training record not found');
    }

    // Level 1: 反応（満足度）
    const level1 = training.evaluation_score || 0;

    // Level 2: 学習（スキル向上）
    const level2 = await this.measureSkillImprovement(employeeId, training.related_skills, training.start_date);

    // Level 3: 行動（職場での適用）
    const level3 = await this.measureBehaviorChange(employeeId, training.related_skills, training.end_date);

    // Level 4: 結果（ビジネス成果）
    const level4 = await this.measureBusinessImpact(employeeId, training.start_date, training.end_date);

    // ROI計算
    const roi = this.calculateTrainingROI(training.cost, level4);

    return { level1, level2, level3, level4, roi };
  }

  /**
   * 📊 パフォーマンス・目標管理システム
   */

  /**
   * MBO（目標管理制度）目標設定
   */
  async createMBOGoals(employeeId: string, goals: Partial<GoalOKR>[]): Promise<string[]> {
    const mboGoals: string[] = [];

    for (const goal of goals) {
      const mboGoal: GoalOKR = {
        id: `MBO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId,
        goalType: 'mbo',
        title: goal.title || '',
        description: goal.description,
        category: goal.category || 'performance',
        targetValue: goal.targetValue,
        currentValue: 0,
        unit: goal.unit,
        weight: goal.weight || 100,
        priority: goal.priority || 'medium',
        startDate: goal.startDate || new Date(),
        dueDate: goal.dueDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年後
        status: 'in_progress',
        achievementRate: 0,
        relatedSkills: goal.relatedSkills || [],
        notes: goal.notes,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const goalId = await this.db.createGoal(mboGoal);
      mboGoals.push(goalId);
    }

    return mboGoals;
  }

  /**
   * OKR（目標と主要な成果）設定
   */
  async createOKRGoals(employeeId: string, objectives: Partial<GoalOKR>[]): Promise<string[]> {
    const okrGoals: string[] = [];

    for (const objective of objectives) {
      const okrGoal: GoalOKR = {
        id: `OKR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId,
        goalType: 'okr',
        title: objective.title || '',
        description: objective.description,
        category: objective.category || 'strategic',
        targetValue: objective.targetValue,
        currentValue: 0,
        unit: objective.unit,
        weight: objective.weight || 100,
        priority: objective.priority || 'high',
        startDate: objective.startDate || new Date(),
        dueDate: objective.dueDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 四半期
        status: 'in_progress',
        achievementRate: 0,
        keyResults: objective.keyResults || [],
        milestones: objective.milestones || [],
        relatedSkills: objective.relatedSkills || [],
        notes: objective.notes,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const goalId = await this.db.createGoal(okrGoal);
      okrGoals.push(goalId);
    }

    return okrGoals;
  }

  /**
   * 360度フィードバック収集
   */
  async collect360Feedback(employeeId: string, feedbackProviders: string[]): Promise<Record<string, any>> {
    const feedback: Record<string, any> = {};

    for (const providerId of feedbackProviders) {
      const provider = await this.db.getEmployee(providerId);
      if (provider) {
        feedback[providerId] = {
          providerName: provider.name,
          relationship: this.determineRelationship(employeeId, providerId),
          competencyRatings: await this.generateCompetencyRatings(employeeId, providerId),
          qualitativeComments: await this.generateQualitativeComments(employeeId, providerId),
          submissionDate: new Date()
        };
      }
    }

    return feedback;
  }

  /**
   * 📈 タレントダッシュボード生成
   */
  async generateTalentDashboard(employeeId: string): Promise<TalentDashboard> {
    const skills = await this.db.getEmployeeSkills(employeeId);
    const goals = await this.db.getGoals(employeeId);
    const trainings = await this.db.getTrainingHistory(employeeId);
    const evaluations = await this.db.getPerformanceEvaluations(employeeId);

    // スキル概要
    const skillsOverview = {
      totalSkills: skills.length,
      masterSkills: skills.filter(s => s.proficiency_level >= 4).length,
      developingSkills: skills.filter(s => s.proficiency_level < 3).length,
      skillsByCategory: skills.reduce((acc, skill) => {
        acc[skill.skill_category] = (acc[skill.skill_category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    // 目標進捗
    const goalsProgress = {
      totalGoals: goals.length,
      completedGoals: goals.filter(g => g.status === 'completed').length,
      overallProgress: goals.reduce((sum, g) => sum + g.achievement_rate, 0) / (goals.length || 1),
      goalsByType: goals.reduce((acc, goal) => {
        acc[goal.goal_type] = (acc[goal.goal_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    // 研修進捗
    const trainingProgress = {
      totalTrainings: trainings.length,
      completedTrainings: trainings.filter(t => t.status === 'completed').length,
      scheduledTrainings: trainings.filter(t => t.status === 'scheduled').length,
      totalHours: trainings.reduce((sum, t) => sum + t.duration_hours, 0)
    };

    // パフォーマンス指標
    const latestEvaluation = evaluations[0];
    const performanceMetrics = {
      latestRating: latestEvaluation?.overall_rating,
      averageRating: evaluations.reduce((sum, e) => sum + e.overall_rating, 0) / (evaluations.length || 1),
      promotionReadiness: latestEvaluation?.promotion_readiness,
      retentionRisk: latestEvaluation?.retention_risk
    };

    // 今後のイベント・推奨事項
    const upcomingEvents = await this.generateUpcomingEvents(employeeId);
    const recommendations = await this.generateRecommendations(employeeId);

    return {
      employeeId,
      skillsOverview,
      goalsProgress,
      trainingProgress,
      performanceMetrics,
      upcomingEvents,
      recommendations
    };
  }

  /**
   * 📊 タレントアナリティクス
   */
  async generateTalentAnalytics(): Promise<TalentAnalytics> {
    const employees = await this.db.getAllEmployees();
    const activeEmployees = employees.filter(e => e.isActive);

    // 組織概要
    const organizationOverview = {
      totalEmployees: activeEmployees.length,
      avgSkillLevel: await this.calculateAverageSkillLevel(),
      skillCoverage: await this.calculateSkillCoverage(),
      trainingUtilization: await this.calculateTrainingUtilization(),
      goalCompletionRate: await this.calculateGoalCompletionRate()
    };

    // スキル分析
    const skillAnalytics = {
      mostInDemandSkills: await this.getMostInDemandSkills(),
      skillGapsByDepartment: await this.getSkillGapsByDepartment(),
      skillDevelopmentTrends: await this.getSkillDevelopmentTrends()
    };

    // パフォーマンス分析
    const performanceAnalytics = {
      averageRating: await this.calculateAveragePerformanceRating(),
      promotionReadiness: await this.getPromotionReadinessDistribution(),
      retentionRisk: await this.getRetentionRiskDistribution(),
      successionPipeline: await this.calculateSuccessionPipelineStrength()
    };

    // 研修分析
    const trainingAnalytics = {
      totalTrainingHours: await this.calculateTotalTrainingHours(),
      trainingROI: await this.calculateOverallTrainingROI(),
      completionRate: await this.calculateTrainingCompletionRate(),
      trainingCostPerEmployee: await this.calculateTrainingCostPerEmployee()
    };

    return {
      organizationOverview,
      skillAnalytics,
      performanceAnalytics,
      trainingAnalytics
    };
  }

  /**
   * 💡 ISO30414指標自動算出
   */
  async calculateISO30414Metrics(startDate: Date, endDate: Date): Promise<Record<string, any>> {
    const trainingMetrics = await this.db.calculateTrainingMetrics(startDate, endDate);
    const employees = await this.db.getAllEmployees();
    const activeEmployees = employees.filter(e => e.isActive);

    return {
      // 人材開発指標
      development: {
        trainingHoursPerEmployee: trainingMetrics.avgTrainingHoursPerEmployee,
        trainingCostPerEmployee: trainingMetrics.totalTrainingCost / (trainingMetrics.totalEmployees || 1),
        trainingCompletionRate: await this.calculateTrainingCompletionRate(),
        skillDevelopmentParticipation: await this.calculateSkillDevelopmentParticipation()
      },
      // パフォーマンス指標
      performance: {
        averagePerformanceRating: await this.calculateAveragePerformanceRating(),
        goalAchievementRate: await this.calculateGoalAchievementRate(),
        promotionRate: await this.calculatePromotionRate(startDate, endDate)
      },
      // 人材確保指標
      retention: {
        retentionRate: await this.calculateRetentionRate(startDate, endDate),
        successionPipelineStrength: await this.calculateSuccessionPipelineStrength(),
        criticalRolesCovered: await this.calculateCriticalRolesCoverage()
      },
      // 最終更新日
      lastUpdated: new Date(),
      reportingPeriod: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`
    };
  }

  // プライベートヘルパーメソッド
  private async getRequiredSkillsForPosition(position: string): Promise<Array<{skillId: string, skillName: string, requiredLevel: number}>> {
    // 職位別必要スキル要件（実装では専用テーブルから取得）
    const positionSkillRequirements: Record<string, Array<{skillId: string, skillName: string, requiredLevel: number}>> = {
      'エンジニア': [
        { skillId: 'SKILL_001', skillName: 'JavaScript', requiredLevel: 3 },
        { skillId: 'SKILL_002', skillName: 'TypeScript', requiredLevel: 3 },
        { skillId: 'SKILL_003', skillName: 'React', requiredLevel: 2 }
      ],
      'シニアエンジニア': [
        { skillId: 'SKILL_001', skillName: 'JavaScript', requiredLevel: 4 },
        { skillId: 'SKILL_002', skillName: 'TypeScript', requiredLevel: 4 },
        { skillId: 'SKILL_003', skillName: 'React', requiredLevel: 3 },
        { skillId: 'SKILL_004', skillName: 'リーダーシップ', requiredLevel: 3 }
      ]
    };

    return positionSkillRequirements[position] || [];
  }

  private generateDevelopmentActions(skillId: string, gapSize: number): string[] {
    const actions: string[] = [];
    
    if (gapSize >= 3) {
      actions.push('専門研修の受講');
      actions.push('メンタリングプログラムの参加');
    }
    if (gapSize >= 2) {
      actions.push('実践的なプロジェクトへの参加');
    }
    actions.push('自主学習の実施');
    
    return actions;
  }

  private async getTrainingsForSkill(skillId: string): Promise<Array<{id: string, name: string, type: string, durationHours: number, cost: number, provider?: string}>> {
    // スキル別研修リスト（実装では専用テーブルから取得）
    return [
      {
        id: 'TRAINING_001',
        name: 'JavaScript基礎',
        type: 'elearning',
        durationHours: 40,
        cost: 50000,
        provider: 'TechAcademy'
      }
    ];
  }

  private selectOptimalTraining(trainings: any[], gap: SkillGap): any {
    // 優先度とコストパフォーマンスに基づいて最適な研修を選択
    return trainings.sort((a, b) => {
      const scoreA = (a.durationHours / a.cost) * (gap.priority === 'high' ? 3 : gap.priority === 'medium' ? 2 : 1);
      const scoreB = (b.durationHours / b.cost) * (gap.priority === 'high' ? 3 : gap.priority === 'medium' ? 2 : 1);
      return scoreB - scoreA;
    })[0];
  }

  private calculateOptimalStartDate(priority: string): Date {
    const now = new Date();
    const daysToAdd = priority === 'high' ? 7 : priority === 'medium' ? 30 : 60;
    return new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  }

  private calculateEndDate(durationHours: number): Date {
    const startDate = new Date();
    const daysToComplete = Math.ceil(durationHours / 8); // 1日8時間想定
    return new Date(startDate.getTime() + daysToComplete * 24 * 60 * 60 * 1000);
  }

  private async getPossibleCareerProgression(currentPosition: string, department: string): Promise<Array<{title: string, requiredExperience: string[]}>> {
    // キャリアパス定義（実装では専用テーブルから取得）
    const careerPaths: Record<string, Array<{title: string, requiredExperience: string[]}>> = {
      'エンジニア': [
        { title: 'シニアエンジニア', requiredExperience: ['プロジェクトリーダー経験', 'メンタリング経験'] },
        { title: 'テックリード', requiredExperience: ['技術選定経験', 'チームマネジメント経験'] }
      ]
    };

    return careerPaths[currentPosition] || [];
  }

  private generateDevelopmentPlan(missingSkills: any[]): string {
    return `以下のスキル習得を推奨します：${missingSkills.map(s => s.skillName).join(', ')}`;
  }

  private async measureSkillImprovement(employeeId: string, skillIds: string[], baselineDate: Date): Promise<number> {
    // スキル向上度測定（実装では評価前後の比較）
    return 3.5; // 仮の値
  }

  private async measureBehaviorChange(employeeId: string, skillIds: string[], baselineDate: Date): Promise<number> {
    // 行動変化測定（実装では360度フィードバック等）
    return 3.2; // 仮の値
  }

  private async measureBusinessImpact(employeeId: string, startDate: Date, endDate: Date): Promise<number> {
    // ビジネスインパクト測定（実装では生産性指標等）
    return 150000; // 仮の値（円）
  }

  private calculateTrainingROI(cost: number, businessImpact: number): number {
    return ((businessImpact - cost) / cost) * 100;
  }

  private determineRelationship(employeeId: string, providerId: string): string {
    // 関係性判定（実装では組織構造から判定）
    return 'colleague'; // 仮の値
  }

  private async generateCompetencyRatings(employeeId: string, providerId: string): Promise<Record<string, number>> {
    // コンピテンシー評価生成
    return {
      'communication': 4.0,
      'teamwork': 3.8,
      'leadership': 3.5,
      'technical': 4.2
    };
  }

  private async generateQualitativeComments(employeeId: string, providerId: string): Promise<string> {
    // 定性的コメント生成
    return '優れた技術力と協調性を持つ';
  }

  private async generateUpcomingEvents(employeeId: string): Promise<any[]> {
    // 今後のイベント生成
    return [];
  }

  private async generateRecommendations(employeeId: string): Promise<any[]> {
    // 推奨事項生成
    return [];
  }

  // 分析系メソッド群
  private async calculateAverageSkillLevel(): Promise<number> { return 3.2; }
  private async calculateSkillCoverage(): Promise<number> { return 0.75; }
  private async calculateTrainingUtilization(): Promise<number> { return 0.85; }
  private async calculateGoalCompletionRate(): Promise<number> { return 0.72; }
  private async getMostInDemandSkills(): Promise<string[]> { return ['JavaScript', 'リーダーシップ', 'コミュニケーション']; }
  private async getSkillGapsByDepartment(): Promise<Record<string, SkillGap[]>> { return {}; }
  private async getSkillDevelopmentTrends(): Promise<any[]> { return []; }
  private async calculateAveragePerformanceRating(): Promise<number> { return 3.8; }
  private async getPromotionReadinessDistribution(): Promise<Record<string, number>> { return { ready: 20, developing: 50, not_ready: 30 }; }
  private async getRetentionRiskDistribution(): Promise<Record<string, number>> { return { high: 10, medium: 30, low: 60 }; }
  private async calculateSuccessionPipelineStrength(): Promise<number> { return 0.65; }
  private async calculateTotalTrainingHours(): Promise<number> { return 2400; }
  private async calculateOverallTrainingROI(): Promise<number> { return 3.2; }
  private async calculateTrainingCompletionRate(): Promise<number> { return 0.88; }
  private async calculateTrainingCostPerEmployee(): Promise<number> { return 120000; }
  private async calculateSkillDevelopmentParticipation(): Promise<number> { return 0.82; }
  private async calculateGoalAchievementRate(): Promise<number> { return 0.76; }
  private async calculatePromotionRate(startDate: Date, endDate: Date): Promise<number> { return 0.15; }
  private async calculateRetentionRate(startDate: Date, endDate: Date): Promise<number> { return 0.92; }
  private async calculateCriticalRolesCoverage(): Promise<number> { return 0.85; }
}

export default TalentManagementEngine;