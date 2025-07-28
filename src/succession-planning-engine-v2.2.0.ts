import Database from './database.js';
import type { 
  Employee,
  TalentProfile,
  SuccessionPlan,
  SuccessionCandidate,
  ReadinessLevel
} from './types.js';

/**
 * 後継者計画エンジン v2.2.0
 * 重要ポジションの継承管理と候補者育成
 */
export class SuccessionPlanningEngine {
  constructor(private db: Database) {}

  /**
   * ポジション重要度評価
   */
  async assessPositionCriticality(
    positionId: string,
    criteria: {
      businessImpact: number; // 1-5
      skillRarity: number; // 1-5  
      decisionAuthority: number; // 1-5
      teamSize: number;
      budgetResponsibility: number;
      customerImpact: number; // 1-5
    }
  ): Promise<{
    criticalityScore: number;
    criticalityLevel: 'critical' | 'important' | 'standard';
    riskFactors: string[];
    recommendations: string[];
  }> {
    // 重要度スコア計算（加重平均）
    const weights = {
      businessImpact: 0.3,
      skillRarity: 0.2,
      decisionAuthority: 0.2,
      teamSize: 0.1,
      budgetResponsibility: 0.1,
      customerImpact: 0.1
    };

    const criticalityScore = 
      criteria.businessImpact * weights.businessImpact +
      criteria.skillRarity * weights.skillRarity +
      criteria.decisionAuthority * weights.decisionAuthority +
      Math.min(criteria.teamSize / 10, 5) * weights.teamSize +
      Math.min(criteria.budgetResponsibility / 1000000, 5) * weights.budgetResponsibility +
      criteria.customerImpact * weights.customerImpact;

    // レベル判定
    let criticalityLevel: 'critical' | 'important' | 'standard';
    if (criticalityScore >= 4.0) {
      criticalityLevel = 'critical';
    } else if (criticalityScore >= 3.0) {
      criticalityLevel = 'important';
    } else {
      criticalityLevel = 'standard';
    }

    // リスク要因特定
    const riskFactors: string[] = [];
    if (criteria.skillRarity >= 4) {
      riskFactors.push('希少スキルポジション - 外部採用困難');
    }
    if (criteria.teamSize >= 20) {
      riskFactors.push('大規模チーム管理 - 空席時の影響大');
    }
    if (criteria.budgetResponsibility >= 10000000) {
      riskFactors.push('高額予算責任 - 経営影響大');
    }

    // 推奨事項生成
    const recommendations: string[] = [];
    if (criticalityLevel === 'critical') {
      recommendations.push('複数の後継者候補の準備が必要');
      recommendations.push('緊急時対応プランの策定');
    }
    if (criteria.skillRarity >= 4) {
      recommendations.push('スキル伝承プログラムの実施');
    }

    return {
      criticalityScore,
      criticalityLevel,
      riskFactors,
      recommendations
    };
  }

  /**
   * 後継者候補の発掘と評価
   */
  async identifySuccessionCandidates(
    planId: string,
    criteria: {
      minPerformanceRating?: number;
      minPotentialRating?: number;
      requiredSkills?: string[];
      maxTimeToReady?: ReadinessLevel;
      includeCrossDepartment?: boolean;
    } = {}
  ): Promise<{
    candidates: Array<{
      employee: Employee;
      profile: TalentProfile;
      matchScore: number;
      readinessEstimate: ReadinessLevel;
      strengthAreas: string[];
      developmentNeeds: string[];
    }>;
    summary: {
      totalCandidates: number;
      readyNow: number;
      within1Year: number;
      within2Years: number;
      recommendations: string[];
    };
  }> {
    // 後継者計画の詳細取得
    const plan = await this.getSuccessionPlan(planId);
    if (!plan) {
      throw new Error('Succession plan not found');
    }

    // 候補者検索クエリ構築
    let query = `
      SELECT e.*, tp.*, 
             COALESCE(AVG(tp2.performance_rating), 0) as avg_performance,
             COALESCE(AVG(tp2.potential_rating), 0) as avg_potential
      FROM employees e
      LEFT JOIN talent_profiles tp ON e.id = tp.employee_id
      LEFT JOIN talent_profiles tp2 ON e.id = tp2.employee_id
      WHERE e.is_active = true
        AND tp.assessment_date = (
          SELECT MAX(assessment_date) 
          FROM talent_profiles tp3 
          WHERE tp3.employee_id = e.id
        )
    `;

    const params: any[] = [];

    // フィルタ条件追加
    if (criteria.minPerformanceRating) {
      query += ` AND tp.performance_rating >= $${params.length + 1}`;
      params.push(criteria.minPerformanceRating);
    }

    if (criteria.minPotentialRating) {
      query += ` AND tp.potential_rating >= $${params.length + 1}`;
      params.push(criteria.minPotentialRating);
    }

    if (!criteria.includeCrossDepartment) {
      query += ` AND e.department = $${params.length + 1}`;
      params.push(plan.department);
    }

    query += ` GROUP BY e.id, tp.id ORDER BY avg_performance DESC, avg_potential DESC`;

    const result = await this.db.query(query, params);

    // 候補者評価
    const candidates = await Promise.all(
      result.rows.map(async (row: any) => {
        const employee: Employee = {
          id: row.id,
          name: row.name,
          email: row.email,
          department: row.department,
          position: row.position,
          employeeNumber: row.employee_number,
          startDate: row.start_date,
          isActive: row.is_active
        };

        const profile: TalentProfile = {
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

        // マッチスコア計算
        const matchScore = await this.calculateCandidateMatch(employee, profile, plan);
        
        // レディネス推定
        const readinessEstimate = this.estimateReadiness(profile, plan);
        
        // 強み・育成ニーズ分析
        const strengthAreas = this.identifyStrengthAreas(profile);
        const developmentNeeds = await this.identifyDevelopmentNeeds(employee, plan);

        return {
          employee,
          profile,
          matchScore,
          readinessEstimate,
          strengthAreas,
          developmentNeeds
        };
      })
    );

    // 上位候補者のみ返す（スコア順）
    const topCandidates = candidates
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    // サマリー生成
    const summary = {
      totalCandidates: topCandidates.length,
      readyNow: topCandidates.filter(c => c.readinessEstimate === 'ready_now').length,
      within1Year: topCandidates.filter(c => c.readinessEstimate === '1_year').length,
      within2Years: topCandidates.filter(c => c.readinessEstimate === '2_years').length,
      recommendations: this.generateCandidateRecommendations(topCandidates)
    };

    return {
      candidates: topCandidates,
      summary
    };
  }

  /**
   * 後継者育成計画の策定
   */
  async createDevelopmentPlan(
    candidateId: string,
    planId: string,
    targetReadiness: ReadinessLevel,
    customActions?: string[]
  ): Promise<{
    plan: {
      candidateId: string;
      targetReadiness: ReadinessLevel;
      estimatedTimeline: number; // months
      phases: Array<{
        phase: string;
        duration: number; // months
        objectives: string[];
        actions: string[];
        milestones: string[];
      }>;
    };
    riskMitigation: string[];
    successMetrics: string[];
  }> {
    // 候補者の現在状況取得
    const candidate = await this.db.getEmployee(candidateId);
    if (!candidate) throw new Error('Candidate not found');

    const successionPlan = await this.getSuccessionPlan(planId);
    if (!successionPlan) throw new Error('Succession plan not found');

    // ギャップ分析
    const gapAnalysis = await this.performGapAnalysis(candidateId, planId);

    // フェーズ別育成計画策定
    const phases: Array<{
      phase: string;
      duration: number;
      objectives: string[];
      actions: string[];
      milestones: string[];
    }> = [];

    // Phase 1: 基礎強化（3-6ヶ月）
    if (gapAnalysis.skillGaps.length > 0) {
      phases.push({
        phase: '基礎スキル強化',
        duration: 6,
        objectives: [
          'コアスキルの習得',
          '業務知識の拡充',
          'ネットワーク構築'
        ],
        actions: [
          ...gapAnalysis.skillGaps.map(skill => `${skill}研修の受講`),
          '現職務でのストレッチアサインメント',
          '社内エキスパートとのメンタリング'
        ],
        milestones: [
          '必要スキルの70%習得',
          'メンター関係構築',
          '初回評価完了'
        ]
      });
    }

    // Phase 2: 実践経験（6-12ヶ月）
    phases.push({
      phase: '実践経験積上げ',
      duration: 8,
      objectives: [
        'リーダーシップ経験',
        '意思決定権限拡大',
        'クロスファンクション経験'
      ],
      actions: [
        'プロジェクトリーダー任命',
        '部門横断プロジェクト参加',
        '予算責任の段階的付与',
        ...(customActions || [])
      ],
      milestones: [
        'プロジェクト成功完了',
        'チーム評価向上',
        '360度フィードバック改善'
      ]
    });

    // Phase 3: 最終準備（3-6ヶ月）
    if (targetReadiness === 'ready_now' || targetReadiness === '1_year') {
      phases.push({
        phase: '最終準備・移行',
        duration: 4,
        objectives: [
          'ポジション固有業務習得',
          'ステークホルダー関係構築',
          '移行準備完了'
        ],
        actions: [
          '現任者からの直接指導',
          'キーステークホルダーとの関係構築',
          '緊急時対応プロトコル習得'
        ],
        milestones: [
          '業務引継ぎ完了',
          'ステークホルダー承認',
          '移行準備完了'
        ]
      });
    }

    const estimatedTimeline = phases.reduce((total, phase) => total + phase.duration, 0);

    return {
      plan: {
        candidateId,
        targetReadiness,
        estimatedTimeline,
        phases
      },
      riskMitigation: [
        '定期的な進捗評価と軌道修正',
        'メンター・コーチのサポート体制',
        '複数候補者の並行育成'
      ],
      successMetrics: [
        'スキル習得率90%以上',
        '360度評価4.0以上',
        'プロジェクト成功率80%以上'
      ]
    };
  }

  /**
   * 後継者計画の詳細取得
   */
  private async getSuccessionPlan(planId: string): Promise<SuccessionPlan | null> {
    const result = await this.db.query(
      'SELECT * FROM succession_plans WHERE id = $1',
      [planId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      positionId: row.position_id,
      positionTitle: row.position_title,
      department: row.department,
      criticality: row.criticality,
      incumbentId: row.incumbent_id,
      vacancyRisk: row.vacancy_risk,
      requiredExperienceYears: row.required_experience_years,
      requiredSkills: JSON.parse(row.required_skills || '[]'),
      requiredCompetencies: JSON.parse(row.required_competencies || '[]'),
      candidates: [], // 別途取得
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * 候補者マッチスコア計算
   */
  private async calculateCandidateMatch(
    employee: Employee,
    profile: TalentProfile,
    plan: SuccessionPlan
  ): Promise<number> {
    let score = 0.5; // ベーススコア

    // パフォーマンス評価（30%）
    score += (profile.performanceRating - 3) * 0.1;

    // ポテンシャル評価（30%）
    score += (profile.potentialRating - 3) * 0.1;

    // 部門一致（20%）
    if (employee.department === plan.department) {
      score += 0.2;
    }

    // スキルマッチ（20%）
    if (plan.requiredSkills && plan.requiredSkills.length > 0) {
      const employeeSkills = await this.getEmployeeSkills(employee.id);
      const matchedSkills = plan.requiredSkills.filter(skill => 
        employeeSkills.includes(skill)
      );
      score += (matchedSkills.length / plan.requiredSkills.length) * 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * レディネス推定
   */
  private estimateReadiness(profile: TalentProfile, plan: SuccessionPlan): ReadinessLevel {
    const performanceWeight = 0.6;
    const potentialWeight = 0.4;
    
    const readinessScore = 
      profile.performanceRating * performanceWeight +
      profile.potentialRating * potentialWeight;

    // スター人材（高パフォーマンス・高ポテンシャル）は即座準備完了
    if (profile.category === 'stars' && readinessScore >= 4.0) return 'ready_now';
    
    if (readinessScore >= 4.5) return 'ready_now';
    if (readinessScore >= 4.0) return '1_year';
    if (readinessScore >= 3.5) return '2_years';
    return '3_years_plus';
  }

  /**
   * 強み分野特定
   */
  private identifyStrengthAreas(profile: TalentProfile): string[] {
    const strengths: string[] = [];

    if (profile.performanceRating >= 4.5) {
      strengths.push('高いパフォーマンス実績');
    }
    if (profile.potentialRating >= 4.5) {
      strengths.push('高い成長ポテンシャル');
    }
    if (profile.nineBoxCategory === 'star') {
      strengths.push('スター人材（高パフォーマンス・高ポテンシャル）');
    }

    return strengths;
  }

  /**
   * 育成ニーズ特定
   */
  private async identifyDevelopmentNeeds(
    employee: Employee,
    plan: SuccessionPlan
  ): Promise<string[]> {
    const needs: string[] = [];

    // スキルギャップ
    if (plan.requiredSkills) {
      const employeeSkills = await this.getEmployeeSkills(employee.id);
      const missingSkills = plan.requiredSkills.filter(skill => 
        !employeeSkills.includes(skill)
      );
      needs.push(...missingSkills.map(skill => `${skill}スキルの習得`));
    }

    // 経験ギャップ
    if (plan.requiredExperienceYears) {
      const currentExperience = this.calculateExperience(employee);
      if (currentExperience < plan.requiredExperienceYears) {
        needs.push('管理経験の積み上げ');
      }
    }

    return needs;
  }

  /**
   * 従業員スキル取得
   */
  private async getEmployeeSkills(employeeId: string): Promise<string[]> {
    try {
      const result = await this.db.query(
        'SELECT skill_name FROM employee_skills WHERE employee_id = $1 AND proficiency_level >= 3',
        [employeeId]
      );
      return result?.rows?.map((row: any) => row.skill_name) || [];
    } catch (error) {
      console.warn(`Failed to get skills for employee ${employeeId}:`, error);
      return [];
    }
  }

  /**
   * 経験年数計算
   */
  private calculateExperience(employee: Employee): number {
    if (!employee.startDate) return 0;
    const startDate = new Date(employee.startDate);
    const today = new Date();
    return Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
  }

  /**
   * ギャップ分析実行
   */
  private async performGapAnalysis(candidateId: string, planId: string): Promise<{
    skillGaps: string[];
    experienceGaps: string[];
    competencyGaps: string[];
  }> {
    const plan = await this.getSuccessionPlan(planId);
    if (!plan) throw new Error('Plan not found');

    const candidate = await this.db.getEmployee(candidateId);
    if (!candidate) throw new Error('Candidate not found');

    const candidateSkills = await this.getEmployeeSkills(candidateId);

    return {
      skillGaps: (plan.requiredSkills || []).filter(skill => 
        !candidateSkills.includes(skill)
      ),
      experienceGaps: [], // 実装簡略化
      competencyGaps: [] // 実装簡略化
    };
  }

  /**
   * 候補者推奨事項生成
   */
  private generateCandidateRecommendations(candidates: any[]): string[] {
    const recommendations: string[] = [];

    if (candidates.length === 0) {
      recommendations.push('適切な後継者候補が不足しています。外部採用を検討してください。');
    } else if (candidates.length < 3) {
      recommendations.push('後継者候補の多様化を図ってください。');
    }

    const readyNowCount = candidates.filter(c => c.readinessEstimate === 'ready_now').length;
    if (readyNowCount === 0) {
      recommendations.push('緊急時に備え、加速育成プログラムの導入を検討してください。');
    }

    return recommendations;
  }
}

export default SuccessionPlanningEngine;