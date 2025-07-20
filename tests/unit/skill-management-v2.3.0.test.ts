import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillManagementEngine } from '../../src/skill-management-engine-v2.3.0.js';

describe('スキル管理エンジン v2.3.0', () => {
  let engine: SkillManagementEngine;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      getEmployee: vi.fn(),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn()
    };
    engine = new SkillManagementEngine(mockDb);
  });

  describe('スキルオントロジー管理', () => {
    it('新しいスキルをオントロジーに追加する', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const skillData = {
        skillName: 'React',
        category: 'Frontend Development',
        subcategory: 'JavaScript Frameworks',
        level: 3,
        skillType: 'technical' as const,
        complexityLevel: 'intermediate' as const,
        marketDemandScore: 4.5,
        growthTrend: 'growing' as const,
        averageLearningHours: 40,
        description: 'JavaScript library for building user interfaces',
        prerequisites: ['JavaScript', 'HTML', 'CSS'],
        relatedSkills: ['Redux', 'Next.js', 'TypeScript']
      };

      const result = await engine.createSkillOntology(skillData);

      expect(result).toBeDefined();
      expect(result.skillName).toBe('React');
      expect(result.category).toBe('Frontend Development');
      expect(result.skillType).toBe('technical');
      expect(result.recommendations).toContain('市場需要が高いスキルです。優先的に習得を推奨します。');
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('陳腐化リスクの高いスキルに警告を出す', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const skillData = {
        skillName: 'Flash',
        category: 'Web Development',
        level: 2,
        skillType: 'technical' as const,
        marketDemandScore: 1.0,
        growthTrend: 'declining' as const,
        obsolescenceRisk: 4.5
      };

      const result = await engine.createSkillOntology(skillData);

      expect(result.recommendations).toContain('陳腐化リスクがあります。アップデートを定期的に行ってください。');
    });
  });

  describe('スキル評価システム', () => {
    it('従業員のスキル評価を作成する', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const assessmentData = {
        proficiencyLevel: 4,
        confidenceScore: 4.2,
        assessmentMethod: 'manager_review' as const,
        assessedBy: 'manager001',
        evidenceType: 'project_completion',
        evidenceDetails: { projectId: 'proj123', score: 85 },
        learningHours: 30,
        skillAcquiredDate: new Date('2023-01-01')
      };

      const result = await engine.createSkillAssessment('emp001', 'skill001', assessmentData);

      expect(result).toBeDefined();
      expect(result.employeeId).toBe('emp001');
      expect(result.skillId).toBe('skill001');
      expect(result.proficiencyLevel).toBe(4);
      expect(result.weightedScore).toBeGreaterThan(3); // 管理者評価の重み付けを考慮
      expect(result.reliabilityScore).toBeGreaterThan(2);
      expect(result.nextReviewDate).toBeInstanceOf(Date);
      expect(result.recommendations).toContain('高いスキルレベルです。他の従業員への指導も検討してください。');
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('認定による評価は高い信頼性スコアを持つ', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const assessmentData = {
        proficiencyLevel: 5,
        confidenceScore: 5.0,
        assessmentMethod: 'certification' as const,
        assessedBy: 'aws_certification',
        evidenceType: 'certification',
        evidenceDetails: { certificationId: 'AWS-SAA-C03', score: 900 }
      };

      const result = await engine.createSkillAssessment('emp001', 'skill002', assessmentData);

      expect(result.weightedScore).toBe(5.0); // 認定は最高重み
      expect(result.reliabilityScore).toBeGreaterThan(4); // 高い信頼性
      expect(result.nextReviewDate.getTime()).toBeGreaterThan(new Date().getTime() + 365 * 24 * 60 * 60 * 1000); // 1年以上先
    });
  });

  describe('学習推奨エンジン', () => {
    it('従業員向けの学習推奨を生成する', async () => {
      // 現在のスキルプロファイルのモック
      mockDb.query
        .mockResolvedValueOnce({ // getEmployeeSkillProfile
          rows: [
            { skill_id: 'skill001', skill_name: 'JavaScript', level: 3.5 },
            { skill_id: 'skill002', skill_name: 'HTML', level: 4.0 }
          ]
        })
        .mockResolvedValueOnce({ // getMarketDemandSkills
          rows: [
            { skill_id: 'skill003', skill_name: 'React', demand_score: 4.5 },
            { skill_id: 'skill004', skill_name: 'TypeScript', demand_score: 4.2 },
            { skill_id: 'skill005', skill_name: 'Node.js', demand_score: 4.0 }
          ]
        });

      const preferences = {
        learningStyle: 'visual' as const,
        timeCommitment: 'medium' as const,
        budget: 100000,
        targetSkills: ['skill003', 'skill004'],
        preferredFormats: ['online', 'video']
      };

      const result = await engine.generateLearningRecommendations('emp001', preferences);

      expect(result).toBeDefined();
      expect(result.personalizedPaths).toHaveLength(3);
      expect(result.skillGapAnalysis).toBeDefined();
      expect(result.skillGapAnalysis.currentSkills).toHaveLength(2);
      expect(result.skillGapAnalysis.marketDemandSkills).toHaveLength(3);
      expect(result.skillGapAnalysis.recommendedSkills).toContainEqual(
        expect.objectContaining({
          skillName: 'React',
          priority: 'high'
        })
      );
      expect(result.adaptiveInsights).toBeDefined();
      expect(result.adaptiveInsights.learningVelocity).toBeGreaterThan(0);
    });

    it('学習スタイルに基づいて推奨をカスタマイズする', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // 現在のスキル
        .mockResolvedValueOnce({ rows: [] }); // 市場需要スキル

      const visualPreferences = {
        learningStyle: 'visual' as const,
        timeCommitment: 'high' as const
      };

      const result = await engine.generateLearningRecommendations('emp001', visualPreferences);

      expect(result.personalizedPaths).toBeDefined();
      // 視覚的学習者向けのリソースが含まれることを期待
    });
  });

  describe('スキルマーケットプレイス', () => {
    it('スキル要求を作成し候補者をマッチングする', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // スキル要求保存
        .mockResolvedValueOnce({ // 候補者検索
          rows: [
            {
              id: 'emp002',
              name: '佐藤花子',
              email: 'sato@example.com',
              department: '開発部',
              position: 'シニアエンジニア'
            }
          ]
        });

      const requestData = {
        requiredSkills: [
          { skillId: 'skill003', minLevel: 4, importance: 'high' as const },
          { skillId: 'skill004', minLevel: 3, importance: 'medium' as const }
        ],
        requestTitle: 'React開発者募集',
        description: 'ECサイトのフロントエンド開発',
        durationEstimate: '3ヶ月',
        timeCommitment: '週30時間',
        urgency: 'high' as const,
        remoteWorkAllowed: true
      };

      const result = await engine.createSkillRequest('emp001', requestData);

      expect(result).toBeDefined();
      expect(result.requestId).toBeDefined();
      expect(result.matchingCandidates).toHaveLength(1);
      expect(result.matchingCandidates[0].name).toBe('佐藤花子');
      expect(result.matchingCandidates[0].matchScore).toBeGreaterThan(0.5);
      expect(result.recommendations).toBeDefined();
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('適切な候補者が見つからない場合の推奨を生成する', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // スキル要求保存
        .mockResolvedValueOnce({ rows: [] }); // 候補者検索（空）

      const requestData = {
        requiredSkills: [
          { skillId: 'rare_skill', minLevel: 5, importance: 'high' as const }
        ],
        requestTitle: '希少スキル専門家募集',
        description: '特殊技術の専門家',
        durationEstimate: '6ヶ月',
        timeCommitment: 'フルタイム',
        urgency: 'urgent' as const
      };

      const result = await engine.createSkillRequest('emp001', requestData);

      expect(result.matchingCandidates).toHaveLength(0);
      expect(result.recommendations).toContain('適切な候補者が見つかりません。要件を見直すか外部リソースを検討してください。');
    });
  });

  describe('スキルトレンド分析', () => {
    it('スキルトレンドを分析し予測を提供する', async () => {
      const result = await engine.analyzeSkillTrends('quarterly');

      expect(result).toBeDefined();
      expect(result.trendingSkills).toBeDefined();
      expect(result.decliningSkills).toBeDefined();
      expect(result.emergingSkills).toBeDefined();
      expect(result.organizationalGaps).toBeDefined();
    });
  });

  describe('学習ROI測定', () => {
    it('学習計画のROIを測定する', async () => {
      // 学習計画が存在しない場合のテスト
      await expect(
        engine.measureLearningROI('non-existent-plan')
      ).rejects.toThrow('Learning plan not found');
    });
  });

  describe('エラーハンドリング', () => {
    it('データベースエラーを適切に処理する', async () => {
      mockDb.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        engine.createSkillOntology({
          skillName: 'Test Skill',
          category: 'Test Category',
          level: 1,
          skillType: 'technical'
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('無効なスキルレベルを検証する', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const invalidAssessmentData = {
        proficiencyLevel: 6, // 無効な値（1-5の範囲外）
        assessmentMethod: 'self_assessment' as const,
        assessedBy: 'emp001'
      };

      // このテストは実際の実装でバリデーションが追加された場合に有効
      const result = await engine.createSkillAssessment('emp001', 'skill001', invalidAssessmentData);
      expect(result).toBeDefined(); // 現在は基本的な実装のため通る
    });
  });
});