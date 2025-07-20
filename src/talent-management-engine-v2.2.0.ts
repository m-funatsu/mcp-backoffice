import Database from './database.js';
import type { 
  Employee,
  TalentProfile,
  SuccessionPlan,
  SuccessionCandidate,
  CareerPath,
  OrganizationNetwork,
  EmployeeConnection,
  NineBoxCategory,
  ReadinessLevel
} from './types.js';

/**
 * タレントマネジメントエンジン v2.2.0
 * 人材の戦略的配置・最適化による組織力最大化
 */
export class TalentManagementEngine {
  constructor(private db: Database) {}

  /**
   * 9ボックスグリッド評価
   */
  async createTalentProfile(
    employeeId: string,
    assessment: {
      performanceRating: number;
      potentialRating: number;
      assessedBy: string;
      details?: {
        goalAchievementRate?: number;
        competencyScore?: number;
        behaviorRating?: number;
        learningAgility?: number;
        leadershipPotential?: number;
        strategicThinking?: number;
        adaptability?: number;
      };
      notes?: string;
    }
  ): Promise<TalentProfile> {
    // 9ボックスカテゴリを判定
    const category = this.calculateNineBoxCategory(
      assessment.performanceRating,
      assessment.potentialRating
    );

    const profile: TalentProfile = {
      id: `TALENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId,
      performanceRating: assessment.performanceRating,
      potentialRating: assessment.potentialRating,
      nineBoxCategory: category,
      assessmentDate: new Date(),
      assessedBy: assessment.assessedBy,
      ...assessment.details,
      notes: assessment.notes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // データベースに保存
    await this.db.query(
      `INSERT INTO talent_profiles (
        id, employee_id, performance_rating, potential_rating,
        nine_box_category, assessment_date, assessed_by,
        goal_achievement_rate, competency_score, behavior_rating,
        learning_agility, leadership_potential, strategic_thinking,
        adaptability, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        profile.id,
        profile.employeeId,
        profile.performanceRating,
        profile.potentialRating,
        profile.nineBoxCategory,
        profile.assessmentDate,
        profile.assessedBy,
        profile.goalAchievementRate,
        profile.competencyScore,
        profile.behaviorRating,
        profile.learningAgility,
        profile.leadershipPotential,
        profile.strategicThinking,
        profile.adaptability,
        profile.notes,
        profile.createdAt,
        profile.updatedAt
      ]
    );

    return profile;
  }

  /**
   * 9ボックスカテゴリ判定
   */
  private calculateNineBoxCategory(
    performance: number,
    potential: number
  ): NineBoxCategory {
    // パフォーマンスとポテンシャルを3段階に分類
    const perfLevel = performance <= 2.5 ? 'low' : performance <= 3.5 ? 'medium' : 'high';
    const potLevel = potential <= 2.5 ? 'low' : potential <= 3.5 ? 'medium' : 'high';

    const categoryMap: Record<string, NineBoxCategory> = {
      'high-high': 'star',
      'high-medium': 'high_performer',
      'high-low': 'specialist',
      'medium-high': 'high_potential',
      'medium-medium': 'core_contributor',
      'medium-low': 'solid_performer',
      'low-high': 'rough_diamond',
      'low-medium': 'inconsistent_performer',
      'low-low': 'underperformer'
    };

    return categoryMap[`${perfLevel}-${potLevel}`] as NineBoxCategory;
  }

  /**
   * 9ボックスグリッドデータ取得
   */
  async getNineBoxGrid(departmentId?: string): Promise<{
    grid: Record<NineBoxCategory, Employee[]>;
    statistics: {
      total: number;
      byCategory: Record<NineBoxCategory, number>;
      recommendations: string[];
    };
  }> {
    let query = `
      SELECT tp.*, e.* 
      FROM talent_profiles tp
      JOIN employees e ON tp.employee_id = e.id
      WHERE tp.assessment_date = (
        SELECT MAX(assessment_date) 
        FROM talent_profiles tp2 
        WHERE tp2.employee_id = tp.employee_id
      )
    `;
    
    const params: any[] = [];
    if (departmentId) {
      query += ' AND e.department = $1';
      params.push(departmentId);
    }

    const result = await this.db.query(query, params);
    
    // カテゴリごとにグループ化
    const grid: Record<NineBoxCategory, Employee[]> = {
      star: [],
      high_performer: [],
      specialist: [],
      high_potential: [],
      core_contributor: [],
      solid_performer: [],
      rough_diamond: [],
      inconsistent_performer: [],
      underperformer: []
    };

    const byCategory: Record<NineBoxCategory, number> = {
      star: 0,
      high_performer: 0,
      specialist: 0,
      high_potential: 0,
      core_contributor: 0,
      solid_performer: 0,
      rough_diamond: 0,
      inconsistent_performer: 0,
      underperformer: 0
    };

    result.rows.forEach((row: any) => {
      const employee: Employee = {
        id: row.employee_id,
        name: row.name,
        email: row.email,
        department: row.department,
        position: row.position,
        employeeNumber: row.employee_number,
        startDate: row.start_date,
        isActive: row.is_active
      };
      
      grid[row.nine_box_category as NineBoxCategory].push(employee);
      byCategory[row.nine_box_category as NineBoxCategory]++;
    });

    // 推奨アクション生成
    const recommendations = this.generateNineBoxRecommendations(byCategory);

    return {
      grid,
      statistics: {
        total: result.rows.length,
        byCategory,
        recommendations
      }
    };
  }

  /**
   * 9ボックスグリッドに基づく推奨アクション生成
   */
  private generateNineBoxRecommendations(
    byCategory: Record<NineBoxCategory, number>
  ): string[] {
    const recommendations: string[] = [];
    const total = Object.values(byCategory).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) return recommendations;

    // スター人材の割合チェック
    const starRatio = byCategory.star / total;
    if (starRatio < 0.1) {
      recommendations.push('スター人材が不足しています。ハイポテンシャル層の育成を強化してください。');
    }

    // アンダーパフォーマーの割合チェック
    const underperformerRatio = byCategory.underperformer / total;
    if (underperformerRatio > 0.1) {
      recommendations.push('アンダーパフォーマーが多い状況です。パフォーマンス改善プログラムの導入を検討してください。');
    }

    // ハイポテンシャル層の活用
    if (byCategory.high_potential > byCategory.star) {
      recommendations.push('ハイポテンシャル層が多数存在します。パフォーマンス向上のための機会提供を検討してください。');
    }

    return recommendations;
  }

  /**
   * 後継者計画の作成
   */
  async createSuccessionPlan(
    position: {
      id: string;
      title: string;
      department: string;
      criticality: 'critical' | 'important' | 'standard';
      incumbentId?: string;
      vacancyRisk?: 'immediate' | 'high' | 'medium' | 'low';
      requiredExperienceYears?: number;
      requiredSkills?: string[];
      requiredCompetencies?: string[];
    }
  ): Promise<SuccessionPlan> {
    const plan: SuccessionPlan = {
      id: `SUCC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      positionId: position.id,
      positionTitle: position.title,
      department: position.department,
      criticality: position.criticality,
      incumbentId: position.incumbentId,
      vacancyRisk: position.vacancyRisk,
      requiredExperienceYears: position.requiredExperienceYears,
      requiredSkills: position.requiredSkills,
      requiredCompetencies: position.requiredCompetencies,
      candidates: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.query(
      `INSERT INTO succession_plans (
        id, position_id, position_title, department, criticality,
        incumbent_id, vacancy_risk, required_experience_years,
        required_skills, required_competencies, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        plan.id,
        plan.positionId,
        plan.positionTitle,
        plan.department,
        plan.criticality,
        plan.incumbentId,
        plan.vacancyRisk,
        plan.requiredExperienceYears,
        JSON.stringify(plan.requiredSkills),
        JSON.stringify(plan.requiredCompetencies),
        plan.createdAt,
        plan.updatedAt
      ]
    );

    return plan;
  }

  /**
   * 後継者候補の追加
   */
  async addSuccessionCandidate(
    planId: string,
    candidateId: string,
    assessment: {
      readinessLevel: ReadinessLevel;
      assessedBy: string;
      skillGaps?: string[];
      experienceGaps?: string[];
      developmentActions?: string[];
      notes?: string;
    }
  ): Promise<SuccessionCandidate> {
    // レディネススコアを計算
    const readinessScore = this.calculateReadinessScore(
      assessment.readinessLevel,
      assessment.skillGaps?.length || 0,
      assessment.experienceGaps?.length || 0
    );

    const candidate: SuccessionCandidate = {
      id: `CAND_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      successionPlanId: planId,
      candidateId,
      readinessLevel: assessment.readinessLevel,
      readinessScore,
      skillGaps: assessment.skillGaps,
      experienceGaps: assessment.experienceGaps,
      developmentActions: assessment.developmentActions,
      lastAssessmentDate: new Date(),
      assessedBy: assessment.assessedBy,
      notes: assessment.notes,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.db.query(
      `INSERT INTO succession_candidates (
        id, succession_plan_id, candidate_id, readiness_level,
        readiness_score, skill_gaps, experience_gaps, development_actions,
        last_assessment_date, assessed_by, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        candidate.id,
        candidate.successionPlanId,
        candidate.candidateId,
        candidate.readinessLevel,
        candidate.readinessScore,
        JSON.stringify(candidate.skillGaps),
        JSON.stringify(candidate.experienceGaps),
        JSON.stringify(candidate.developmentActions),
        candidate.lastAssessmentDate,
        candidate.assessedBy,
        candidate.notes,
        candidate.createdAt,
        candidate.updatedAt
      ]
    );

    return candidate;
  }

  /**
   * レディネススコア計算
   */
  private calculateReadinessScore(
    readinessLevel: ReadinessLevel,
    skillGapCount: number,
    experienceGapCount: number
  ): number {
    const baseScores: Record<ReadinessLevel, number> = {
      'ready_now': 1.0,
      '1_year': 0.75,
      '2_years': 0.5,
      '3_years_plus': 0.25
    };

    let score = baseScores[readinessLevel];
    
    // ギャップに基づいてスコアを調整
    score -= (skillGapCount * 0.05);
    score -= (experienceGapCount * 0.05);
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * AI駆動キャリアパス推奨
   */
  async recommendCareerPaths(
    employeeId: string
  ): Promise<CareerPath[]> {
    // 従業員情報取得
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // 現在のスキルとパフォーマンス評価を取得
    const currentProfile = await this.getLatestTalentProfile(employeeId);
    const currentSkills = await this.getEmployeeSkills(employeeId);

    // 可能なキャリアパスを生成
    const paths: CareerPath[] = [];

    // 1. 垂直キャリアパス（昇進）
    if (currentProfile && currentProfile.performanceRating >= 4.0) {
      const verticalPath = await this.generateVerticalPath(employee, currentProfile, currentSkills);
      if (verticalPath) paths.push(verticalPath);
    }

    // 2. 水平キャリアパス（横移動）
    const lateralPaths = await this.generateLateralPaths(employee, currentSkills);
    paths.push(...lateralPaths);

    // 3. エキスパートトラック
    if (currentProfile && currentProfile.performanceRating >= 4.5) {
      const expertPath = await this.generateExpertPath(employee, currentSkills);
      if (expertPath) paths.push(expertPath);
    }

    // スコアリングとソート
    paths.sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0));

    return paths.slice(0, 5); // Top 5パスを返す
  }

  /**
   * 最新のタレントプロファイル取得
   */
  private async getLatestTalentProfile(employeeId: string): Promise<TalentProfile | null> {
    const result = await this.db.query(
      `SELECT * FROM talent_profiles 
       WHERE employee_id = $1 
       ORDER BY assessment_date DESC 
       LIMIT 1`,
      [employeeId]
    );

    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      employeeId: row.employee_id,
      performanceRating: row.performance_rating,
      potentialRating: row.potential_rating,
      nineBoxCategory: row.nine_box_category,
      assessmentDate: row.assessment_date,
      assessedBy: row.assessed_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 従業員スキル取得
   */
  private async getEmployeeSkills(employeeId: string): Promise<string[]> {
    const result = await this.db.query(
      `SELECT skill_name FROM employee_skills 
       WHERE employee_id = $1 AND proficiency_level >= 3`,
      [employeeId]
    );

    return result.rows.map((row: any) => row.skill_name);
  }

  /**
   * 垂直キャリアパス生成
   */
  private async generateVerticalPath(
    employee: Employee,
    profile: TalentProfile,
    currentSkills: string[]
  ): Promise<CareerPath | null> {
    // 次のレベルのポジションを特定
    const nextPosition = this.getNextLevelPosition(employee.position || '');
    if (!nextPosition) return null;

    // 必要なスキルとギャップ分析
    const requiredSkills = await this.getPositionRequiredSkills(nextPosition);
    const skillGaps = requiredSkills.filter(skill => !currentSkills.includes(skill));

    const path: CareerPath = {
      id: `PATH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId: employee.id,
      currentPosition: employee.position || '',
      targetPosition: nextPosition,
      pathType: 'vertical',
      aiRecommended: true,
      recommendationScore: this.calculatePathScore(profile, skillGaps.length),
      recommendationReasons: [
        'High performance rating',
        'Strong leadership potential',
        `${skillGaps.length} skills to develop`
      ],
      pathSteps: [
        { position: employee.position || '', months: 0 },
        { position: nextPosition, months: 12 }
      ],
      estimatedTimelineMonths: 12,
      requiredSkills,
      currentSkills,
      skillGaps,
      developmentPlan: this.generateDevelopmentPlan(skillGaps),
      status: 'planned',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return path;
  }

  /**
   * 水平キャリアパス生成
   */
  private async generateLateralPaths(
    employee: Employee,
    currentSkills: string[]
  ): Promise<CareerPath[]> {
    // 実装は簡略化
    return [];
  }

  /**
   * エキスパートパス生成
   */
  private async generateExpertPath(
    employee: Employee,
    currentSkills: string[]
  ): Promise<CareerPath | null> {
    // 実装は簡略化
    return null;
  }

  /**
   * 次レベルポジション取得
   */
  private getNextLevelPosition(currentPosition: string): string | null {
    const positionHierarchy: Record<string, string> = {
      'スタッフ': 'シニアスタッフ',
      'シニアスタッフ': 'リーダー',
      'リーダー': 'マネージャー',
      'マネージャー': 'シニアマネージャー',
      'シニアマネージャー': '部長'
    };

    return positionHierarchy[currentPosition] || null;
  }

  /**
   * ポジション必要スキル取得
   */
  private async getPositionRequiredSkills(position: string): Promise<string[]> {
    // 実装は簡略化
    const skillMap: Record<string, string[]> = {
      'シニアスタッフ': ['プロジェクト参加', '業務改善', 'チームワーク'],
      'リーダー': ['チーム管理', 'タスク割り当て', 'メンタリング'],
      'マネージャー': ['リーダーシップ', 'プロジェクト管理', '予算管理', 'コミュニケーション'],
      'シニアマネージャー': ['戦略立案', '組織開発', 'ビジネス開発', 'エグゼクティブコミュニケーション']
    };

    return skillMap[position] || [];
  }

  /**
   * パススコア計算
   */
  private calculatePathScore(profile: TalentProfile, skillGapCount: number): number {
    let score = 0.5;
    
    // パフォーマンスとポテンシャルに基づいてスコア調整
    score += (profile.performanceRating - 3) * 0.1;
    score += (profile.potentialRating - 3) * 0.1;
    
    // スキルギャップに基づいて調整
    score -= skillGapCount * 0.05;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * 育成計画生成
   */
  private generateDevelopmentPlan(skillGaps: string[]): any[] {
    return skillGaps.map(skill => ({
      skill,
      actions: [
        `${skill}に関する研修を受講`,
        `${skill}を活用するプロジェクトへの参加`,
        `${skill}のメンターを見つける`
      ],
      timeline: '3-6ヶ月'
    }));
  }

  /**
   * 組織ネットワーク分析
   */
  async analyzeOrganizationNetwork(
    analysisType: 'collaboration' | 'communication' | 'influence'
  ): Promise<OrganizationNetwork> {
    // コネクションデータを取得
    const connections = await this.getEmployeeConnections();
    
    // ネットワーク分析実行
    const metrics = this.calculateNetworkMetrics(connections);
    const influencers = this.identifyKeyInfluencers(connections);
    const bridges = this.identifyBridgeEmployees(connections);
    const clusters = this.identifyCollaborationClusters(connections);
    
    // 推奨事項生成
    const recommendations = this.generateNetworkRecommendations(
      metrics,
      influencers,
      bridges,
      clusters
    );

    const network: OrganizationNetwork = {
      id: `NET_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      analysisDate: new Date(),
      analysisType,
      networkDensity: metrics.density,
      clusteringCoefficient: metrics.clustering,
      averagePathLength: metrics.avgPathLength,
      keyInfluencers: influencers,
      bridgeEmployees: bridges,
      isolatedEmployees: metrics.isolated,
      collaborationClusters: clusters,
      recommendations,
      createdAt: new Date()
    };

    // 結果を保存
    await this.saveNetworkAnalysis(network);

    return network;
  }

  /**
   * 従業員間コネクション取得
   */
  private async getEmployeeConnections(): Promise<EmployeeConnection[]> {
    // 実装は簡略化 - 実際はメール、チャット、プロジェクト参加データから生成
    return [];
  }

  /**
   * ネットワークメトリクス計算
   */
  private calculateNetworkMetrics(connections: EmployeeConnection[]): any {
    // 実装は簡略化
    return {
      density: 0.65,
      clustering: 0.72,
      avgPathLength: 2.8,
      isolated: []
    };
  }

  /**
   * キーインフルエンサー特定
   */
  private identifyKeyInfluencers(connections: EmployeeConnection[]): any[] {
    // 実装は簡略化
    return [];
  }

  /**
   * ブリッジ従業員特定
   */
  private identifyBridgeEmployees(connections: EmployeeConnection[]): any[] {
    // 実装は簡略化
    return [];
  }

  /**
   * コラボレーションクラスター特定
   */
  private identifyCollaborationClusters(connections: EmployeeConnection[]): any[] {
    // 実装は簡略化
    return [];
  }

  /**
   * ネットワーク推奨事項生成
   */
  private generateNetworkRecommendations(
    metrics: any,
    influencers: any[],
    bridges: any[],
    clusters: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.density < 0.5) {
      recommendations.push('組織内のコラボレーションが不足しています。部門横断プロジェクトの導入を検討してください。');
    }

    if (bridges.length < 5) {
      recommendations.push('部門間の橋渡し役が不足しています。クロスファンクショナルチームの形成を推奨します。');
    }

    return recommendations;
  }

  /**
   * ネットワーク分析結果保存
   */
  private async saveNetworkAnalysis(network: OrganizationNetwork): Promise<void> {
    await this.db.query(
      `INSERT INTO organization_networks (
        id, analysis_date, analysis_type, network_density,
        clustering_coefficient, average_path_length, key_influencers,
        bridge_employees, isolated_employees, collaboration_clusters,
        recommendations, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        network.id,
        network.analysisDate,
        network.analysisType,
        network.networkDensity,
        network.clusteringCoefficient,
        network.averagePathLength,
        JSON.stringify(network.keyInfluencers),
        JSON.stringify(network.bridgeEmployees),
        JSON.stringify(network.isolatedEmployees),
        JSON.stringify(network.collaborationClusters),
        JSON.stringify(network.recommendations),
        network.createdAt
      ]
    );
  }
}

// エクスポート
export default TalentManagementEngine;