import Database from './database.js';
import type { 
  Employee,
  TalentProfile,
  CareerPath,
  SkillAssessment
} from './types.js';

/**
 * キャリアパス最適化エンジン v2.2.0
 * AI駆動キャリア推奨とスキルベース人材配置
 */
export class CareerPathOptimizationEngine {
  constructor(private db: Database) {}

  /**
   * AI駆動キャリアパス推奨
   */
  async generateCareerRecommendations(
    employeeId: string,
    preferences?: {
      preferredDirection?: 'vertical' | 'lateral' | 'expert';
      targetTimeframe?: number; // months
      willingToRelocate?: boolean;
      learningCommitment?: 'low' | 'medium' | 'high';
    }
  ): Promise<{
    recommendations: CareerPath[];
    personalizedInsights: {
      strengthAreas: string[];
      growthOpportunities: string[];
      marketTrends: string[];
      salaryProjections: Array<{
        position: string;
        currentRange: [number, number];
        futureRange: [number, number];
        timeframe: string;
      }>;
    };
    developmentRoadmap: {
      phase: string;
      duration: number;
      milestones: string[];
      resources: string[];
    }[];
  }> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) throw new Error('Employee not found');

    // 現在のプロファイル分析
    const currentProfile = await this.getCurrentProfile(employeeId);
    const skillAssessment = await this.getComprehensiveSkillAssessment(employeeId);
    
    // 市場分析データ取得
    const marketData = await this.getMarketTrendData();
    
    // AIアルゴリズムによる推奨生成
    const recommendations = await this.generateAIRecommendations(
      employee,
      currentProfile,
      skillAssessment,
      marketData,
      preferences
    );

    // パーソナライズされたインサイト生成
    const personalizedInsights = await this.generatePersonalizedInsights(
      employee,
      skillAssessment,
      marketData
    );

    // 育成ロードマップ策定
    const developmentRoadmap = await this.createDevelopmentRoadmap(
      recommendations[0], // 最高スコアの推奨パス
      skillAssessment
    );

    return {
      recommendations,
      personalizedInsights,
      developmentRoadmap
    };
  }

  /**
   * スキルギャップ分析とマッチング
   */
  async analyzeSkillGaps(
    employeeId: string,
    targetPositions: string[]
  ): Promise<{
    gapAnalysis: Array<{
      position: string;
      requiredSkills: string[];
      currentSkills: string[];
      criticalGaps: string[];
      developableGaps: string[];
      matchPercentage: number;
      estimatedLearningTime: number; // hours
    }>;
    prioritizedLearning: Array<{
      skill: string;
      priority: 'critical' | 'important' | 'nice-to-have';
      estimatedTime: number; // hours
      learningPaths: Array<{
        type: 'internal_training' | 'external_course' | 'certification' | 'project_assignment';
        provider: string;
        duration: string;
        cost: number;
        effectiveness: number; // 1-5
      }>;
    }>;
    recommendations: string[];
  }> {
    const currentSkills = await this.getEmployeeSkills(employeeId);
    const gapAnalysis: any[] = [];
    const allGaps = new Set<string>();

    for (const position of targetPositions) {
      const requiredSkills = await this.getPositionRequiredSkills(position);
      const criticalGaps = requiredSkills.filter(skill => 
        !currentSkills.some(cs => cs.name === skill)
      );
      
      const developableGaps = requiredSkills.filter(skill => {
        const currentSkill = currentSkills.find(cs => cs.name === skill);
        return currentSkill && currentSkill.level < 4; // レベル4未満は向上の余地あり
      });

      criticalGaps.forEach(gap => allGaps.add(gap));
      developableGaps.forEach(gap => allGaps.add(gap));

      const matchPercentage = this.calculateSkillMatch(currentSkills, requiredSkills);
      const estimatedLearningTime = this.estimateLearningTime(criticalGaps, developableGaps);

      gapAnalysis.push({
        position,
        requiredSkills,
        currentSkills: currentSkills.map(s => s.name),
        criticalGaps,
        developableGaps,
        matchPercentage,
        estimatedLearningTime
      });
    }

    // 優先度付き学習計画
    const prioritizedLearning = await this.createPrioritizedLearningPlan(
      Array.from(allGaps),
      gapAnalysis
    );

    // 推奨事項生成
    const recommendations = this.generateGapAnalysisRecommendations(gapAnalysis);

    return {
      gapAnalysis,
      prioritizedLearning,
      recommendations
    };
  }

  /**
   * 内部人材流動性最適化
   */
  async optimizeInternalMobility(
    openPositions: Array<{
      positionId: string;
      title: string;
      department: string;
      requiredSkills: string[];
      urgency: 'immediate' | 'high' | 'medium' | 'low';
    }>,
    constraints?: {
      maxCandidatesPerPosition?: number;
      includeCrossDepartment?: boolean;
      minReadinessLevel?: number;
    }
  ): Promise<{
    matchings: Array<{
      positionId: string;
      positionTitle: string;
      candidates: Array<{
        employee: Employee;
        matchScore: number;
        readinessLevel: 'ready_now' | '3_months' | '6_months' | '1_year';
        transferRisk: 'low' | 'medium' | 'high';
        retentionImpact: number; // 1-5
        businessImpact: string;
      }>;
      recommendations: string[];
    }>;
    globalInsights: {
      totalMatches: number;
      averageMatchScore: number;
      potentialTransfers: number;
      skillGapPriorities: string[];
      organizationalRecommendations: string[];
    };
  }> {
    const matchings: any[] = [];
    let totalMatches = 0;
    let totalScore = 0;

    for (const position of openPositions) {
      // 候補者検索
      const candidates = await this.findInternalCandidates(
        position,
        constraints?.includeCrossDepartment || false
      );

      // 候補者評価
      const evaluatedCandidates = await Promise.all(
        candidates.map(async (candidate) => {
          const matchScore = await this.calculatePositionMatch(candidate, position);
          const readinessLevel = await this.assessReadinessLevel(candidate.id, position.positionId);
          const transferRisk = await this.assessTransferRisk(candidate, position);
          const retentionImpact = await this.assessRetentionImpact(candidate.id);
          
          totalMatches++;
          totalScore += matchScore;

          return {
            employee: candidate,
            matchScore,
            readinessLevel,
            transferRisk,
            retentionImpact,
            businessImpact: this.assessBusinessImpact(matchScore, transferRisk)
          };
        })
      );

      // 上位候補者のみ選定
      const topCandidates = evaluatedCandidates
        .filter(c => c.matchScore >= (constraints?.minReadinessLevel || 0.6))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, constraints?.maxCandidatesPerPosition || 5);

      const recommendations = this.generatePositionRecommendations(position, topCandidates);

      matchings.push({
        positionId: position.positionId,
        positionTitle: position.title,
        candidates: topCandidates,
        recommendations
      });
    }

    // グローバルインサイト生成
    const skillGapPriorities = await this.identifyOrganizationalSkillGaps(openPositions);
    const organizationalRecommendations = this.generateOrganizationalRecommendations(matchings);

    return {
      matchings,
      globalInsights: {
        totalMatches,
        averageMatchScore: totalMatches > 0 ? totalScore / totalMatches : 0,
        potentialTransfers: matchings.reduce((sum, m) => sum + m.candidates.length, 0),
        skillGapPriorities,
        organizationalRecommendations
      }
    };
  }

  /**
   * 現在のプロファイル取得
   */
  private async getCurrentProfile(employeeId: string): Promise<TalentProfile | null> {
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
   * 包括的スキル評価取得
   */
  private async getComprehensiveSkillAssessment(employeeId: string): Promise<SkillAssessment[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM employee_skills 
         WHERE employee_id = $1 
         ORDER BY skill_category, skill_name`,
        [employeeId]
      );

      return result.rows.map((row: any) => ({
        id: row.id,
        employeeId: row.employee_id,
        skillName: row.skill_name,
        skillCategory: row.skill_category,
        proficiencyLevel: row.proficiency_level,
        assessedDate: row.assessed_date,
        assessedBy: row.assessed_by,
        verificationStatus: row.verification_status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.warn(`Failed to get skill assessment for employee ${employeeId}:`, error);
      return [];
    }
  }

  /**
   * 市場トレンドデータ取得（シミュレーション）
   */
  private async getMarketTrendData(): Promise<any> {
    // 実際の実装では外部API（LinkedIn, Glassdoor等）から取得
    return {
      inDemandSkills: ['AI/ML', 'データサイエンス', 'クラウド', 'サイバーセキュリティ'],
      growingRoles: ['データサイエンティスト', 'AIエンジニア', 'DevOpsエンジニア'],
      salaryTrends: {
        'データサイエンティスト': { growth: 15, demandLevel: 'high' },
        'AIエンジニア': { growth: 20, demandLevel: 'very_high' }
      }
    };
  }

  /**
   * AI推奨生成
   */
  private async generateAIRecommendations(
    employee: Employee,
    profile: TalentProfile | null,
    skills: SkillAssessment[],
    marketData: any,
    preferences?: any
  ): Promise<CareerPath[]> {
    const recommendations: CareerPath[] = [];

    // 簡略化されたAIロジック
    if (profile && profile.performanceRating >= 4.0) {
      // 高パフォーマンス者向け垂直パス
      recommendations.push(await this.createVerticalPath(employee, profile, skills));
    }

    if (preferences?.preferredDirection === 'lateral' || skills.length >= 10) {
      // 豊富なスキルを持つ人向け水平パス
      recommendations.push(await this.createLateralPath(employee, skills));
    }

    // マーケットトレンドベースの推奨
    if (marketData.inDemandSkills.some((skill: string) => 
        skills.some(s => s.skillName.includes(skill)))) {
      recommendations.push(await this.createTrendBasedPath(employee, skills, marketData));
    }

    return recommendations.filter(Boolean);
  }

  /**
   * パーソナライズドインサイト生成
   */
  private async generatePersonalizedInsights(
    employee: Employee,
    skills: SkillAssessment[],
    marketData: any
  ): Promise<any> {
    return {
      strengthAreas: skills
        .filter(s => s.proficiencyLevel >= 4)
        .map(s => s.skillName)
        .slice(0, 5),
      growthOpportunities: [
        'リーダーシップスキルの向上',
        '戦略的思考力の強化',
        'デジタルスキルの習得'
      ],
      marketTrends: marketData.inDemandSkills,
      salaryProjections: [
        {
          position: '現職',
          currentRange: [6000000, 8000000],
          futureRange: [6500000, 8500000],
          timeframe: '1年後'
        }
      ]
    };
  }

  /**
   * 育成ロードマップ作成
   */
  private async createDevelopmentRoadmap(
    careerPath: CareerPath,
    skills: SkillAssessment[]
  ): Promise<any[]> {
    return [
      {
        phase: '基礎強化',
        duration: 3,
        milestones: ['コアスキル習得', '基礎知識確立'],
        resources: ['内部研修', 'eラーニング', 'メンタリング']
      },
      {
        phase: '実践経験',
        duration: 6,
        milestones: ['プロジェクト完了', '実務スキル向上'],
        resources: ['ストレッチアサインメント', '外部研修']
      }
    ];
  }

  // ヘルパーメソッド（簡略化）
  private async getEmployeeSkills(employeeId: string): Promise<Array<{name: string, level: number}>> {
    try {
      const result = await this.db.query(
        'SELECT skill_name, proficiency_level FROM employee_skills WHERE employee_id = $1',
        [employeeId]
      );
      return result.rows.map((row: any) => ({
        name: row.skill_name,
        level: row.proficiency_level
      }));
    } catch (error) {
      return [];
    }
  }

  private async getPositionRequiredSkills(position: string): Promise<string[]> {
    // 簡略化：固定データ
    const skillMap: Record<string, string[]> = {
      'データサイエンティスト': ['Python', 'SQL', '統計学', '機械学習'],
      'プロダクトマネージャー': ['プロダクト戦略', 'アジャイル', 'データ分析', 'コミュニケーション']
    };
    return skillMap[position] || [];
  }

  private calculateSkillMatch(currentSkills: Array<{name: string, level: number}>, requiredSkills: string[]): number {
    const matches = requiredSkills.filter(required => 
      currentSkills.some(current => current.name === required && current.level >= 3)
    );
    return requiredSkills.length > 0 ? matches.length / requiredSkills.length : 0;
  }

  private estimateLearningTime(criticalGaps: string[], developableGaps: string[]): number {
    return criticalGaps.length * 40 + developableGaps.length * 20; // hours
  }

  private async createPrioritizedLearningPlan(gaps: string[], analysis: any[]): Promise<any[]> {
    return gaps.map(skill => ({
      skill,
      priority: 'important' as const,
      estimatedTime: 30,
      learningPaths: [
        {
          type: 'internal_training' as const,
          provider: '社内研修',
          duration: '2週間',
          cost: 0,
          effectiveness: 4
        }
      ]
    }));
  }

  private generateGapAnalysisRecommendations(analysis: any[]): string[] {
    return [
      '優先度の高いスキルから順次習得を開始してください',
      '実践的なプロジェクトを通じてスキルを定着させてください'
    ];
  }

  private async findInternalCandidates(position: any, includeCrossDepartment: boolean): Promise<Employee[]> {
    let query = `
      SELECT * FROM employees 
      WHERE is_active = true
    `;
    
    if (!includeCrossDepartment) {
      query += ` AND department = '${position.department}'`;
    }

    const result = await this.db.query(query);
    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      department: row.department,
      position: row.position,
      employeeNumber: row.employee_number,
      startDate: row.start_date,
      isActive: row.is_active
    }));
  }

  private async calculatePositionMatch(candidate: Employee, position: any): Promise<number> {
    // 簡略化
    return Math.random() * 0.4 + 0.6; // 0.6-1.0の範囲
  }

  private async assessReadinessLevel(candidateId: string, positionId: string): Promise<'ready_now' | '3_months' | '6_months' | '1_year'> {
    // 簡略化
    const levels: ('ready_now' | '3_months' | '6_months' | '1_year')[] = ['ready_now', '3_months', '6_months', '1_year'];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  private async assessTransferRisk(candidate: Employee, position: any): Promise<'low' | 'medium' | 'high'> {
    // 簡略化
    return candidate.department === position.department ? 'low' : 'medium';
  }

  private async assessRetentionImpact(candidateId: string): Promise<number> {
    // 簡略化
    return Math.floor(Math.random() * 3) + 3; // 3-5の範囲
  }

  private assessBusinessImpact(matchScore: number, transferRisk: 'low' | 'medium' | 'high'): string {
    if (matchScore >= 0.8 && transferRisk === 'low') return '高い正の影響';
    if (matchScore >= 0.6) return '中程度の正の影響';
    return '限定的な影響';
  }

  private generatePositionRecommendations(position: any, candidates: any[]): string[] {
    const recommendations: string[] = [];
    if (candidates.length === 0) {
      recommendations.push('適切な内部候補者が見つかりません。外部採用を検討してください。');
    } else if (candidates[0].matchScore >= 0.8) {
      recommendations.push('優秀な内部候補者が見つかりました。積極的に検討してください。');
    }
    return recommendations;
  }

  private async identifyOrganizationalSkillGaps(positions: any[]): Promise<string[]> {
    // 全ポジションの必要スキルを集計
    const allRequiredSkills = positions.flatMap(p => p.requiredSkills);
    const uniqueSkills = [...new Set(allRequiredSkills)];
    return uniqueSkills.slice(0, 5); // 上位5つを返す
  }

  private generateOrganizationalRecommendations(matchings: any[]): string[] {
    return [
      '組織全体でのスキル開発プログラムを強化してください',
      '部門間の人材交流を促進してください'
    ];
  }

  private async createVerticalPath(employee: Employee, profile: TalentProfile, skills: SkillAssessment[]): Promise<CareerPath> {
    return {
      id: `PATH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId: employee.id,
      currentPosition: employee.position || '',
      targetPosition: this.getNextLevelPosition(employee.position || ''),
      pathType: 'vertical',
      aiRecommended: true,
      recommendationScore: 0.8,
      recommendationReasons: ['高いパフォーマンス', '豊富なスキル'],
      pathSteps: [
        { position: employee.position || '', months: 0 },
        { position: this.getNextLevelPosition(employee.position || ''), months: 12 }
      ],
      estimatedTimelineMonths: 12,
      requiredSkills: [],
      currentSkills: skills.map(s => s.skillName),
      skillGaps: [],
      status: 'planned',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async createLateralPath(employee: Employee, skills: SkillAssessment[]): Promise<CareerPath> {
    return {
      id: `PATH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId: employee.id,
      currentPosition: employee.position || '',
      targetPosition: '他部門での同等ポジション',
      pathType: 'lateral',
      aiRecommended: true,
      recommendationScore: 0.7,
      recommendationReasons: ['スキルの多様性', '経験の幅'],
      pathSteps: [],
      estimatedTimelineMonths: 6,
      requiredSkills: [],
      currentSkills: skills.map(s => s.skillName),
      skillGaps: [],
      status: 'planned',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private async createTrendBasedPath(employee: Employee, skills: SkillAssessment[], marketData: any): Promise<CareerPath> {
    return {
      id: `PATH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId: employee.id,
      currentPosition: employee.position || '',
      targetPosition: 'トレンド対応ポジション',
      pathType: 'expert_track',
      aiRecommended: true,
      recommendationScore: 0.9,
      recommendationReasons: ['市場需要の高さ', '将来性'],
      pathSteps: [],
      estimatedTimelineMonths: 18,
      requiredSkills: marketData.inDemandSkills,
      currentSkills: skills.map(s => s.skillName),
      skillGaps: [],
      status: 'planned',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private getNextLevelPosition(currentPosition: string): string {
    const hierarchy: Record<string, string> = {
      'スタッフ': 'シニアスタッフ',
      'シニアスタッフ': 'リーダー',
      'リーダー': 'マネージャー',
      'マネージャー': 'シニアマネージャー'
    };
    return hierarchy[currentPosition] || 'シニアレベル';
  }
}

export default CareerPathOptimizationEngine;