import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuccessionPlanningEngine } from '../../src/succession-planning-engine-v2.2.0.js';

describe('後継者計画エンジン v2.2.0', () => {
  let engine: SuccessionPlanningEngine;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
      getEmployee: vi.fn(),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn()
    };
    engine = new SuccessionPlanningEngine(mockDb);
  });

  describe('ポジション重要度評価', () => {
    it('クリティカルなポジションを正しく評価する', async () => {
      const criteria = {
        businessImpact: 5,
        skillRarity: 4,
        decisionAuthority: 5,
        teamSize: 25,
        budgetResponsibility: 50000000,
        customerImpact: 4
      };

      const result = await engine.assessPositionCriticality('pos001', criteria);

      expect(result.criticalityLevel).toBe('critical');
      expect(result.criticalityScore).toBeGreaterThan(4.0);
      expect(result.riskFactors).toContain('希少スキルポジション - 外部採用困難');
      expect(result.riskFactors).toContain('大規模チーム管理 - 空席時の影響大');
      expect(result.recommendations).toContain('複数の後継者候補の準備が必要');
    });

    it('標準的なポジションを正しく評価する', async () => {
      const criteria = {
        businessImpact: 2,
        skillRarity: 2,
        decisionAuthority: 2,
        teamSize: 5,
        budgetResponsibility: 1000000,
        customerImpact: 2
      };

      const result = await engine.assessPositionCriticality('pos002', criteria);

      expect(result.criticalityLevel).toBe('standard');
      expect(result.criticalityScore).toBeLessThan(3.0);
      expect(result.riskFactors).toHaveLength(0);
    });
  });

  describe('後継者候補発掘', () => {
    it('適切な候補者を発掘し評価する', async () => {
      // 後継者計画のモック
      mockDb.query
        .mockResolvedValueOnce({ // getSuccessionPlan
          rows: [{
            id: 'plan001',
            position_id: 'pos001',
            position_title: '営業部長',
            department: '営業部',
            criticality: 'critical',
            required_skills: JSON.stringify(['リーダーシップ', '営業管理']),
            required_competencies: JSON.stringify(['戦略思考', '意思決定']),
            required_experience_years: null
          }]
        })
        .mockResolvedValueOnce({ // 候補者検索
          rows: [
            {
              id: 'emp001',
              name: '山田太郎',
              email: 'yamada@example.com',
              department: '営業部',
              position: 'マネージャー',
              employee_number: 'E001',
              start_date: '2020-01-01',
              is_active: true,
              employee_id: 'emp001',
              performance_rating: 4.5,
              potential_rating: 4.2,
              nine_box_category: 'star',
              assessment_date: '2024-01-01',
              assessed_by: 'hr001',
              created_at: '2024-01-01',
              updated_at: '2024-01-01'
            }
          ]
        })
        .mockResolvedValueOnce({ // emp001のスキル
          rows: [
            { skill_name: 'リーダーシップ' },
            { skill_name: '営業管理' }
          ]
        });

      const result = await engine.identifySuccessionCandidates('plan001', {
        minPerformanceRating: 3.5,
        minPotentialRating: 4.0
      });

      expect(result.candidates).toHaveLength(1);
      
      const topCandidate = result.candidates[0];
      expect(topCandidate.employee.name).toBe('山田太郎');
      expect(topCandidate.matchScore).toBeGreaterThan(0.5);
      expect(topCandidate.readinessEstimate).toBe('ready_now');
      expect(topCandidate.strengthAreas).toContain('スター人材（高パフォーマンス・高ポテンシャル）');

      expect(result.summary.totalCandidates).toBe(1);
      expect(result.summary.readyNow).toBe(1);
    });
  });

  describe('育成計画策定', () => {
    it('基本的な育成計画を策定する', async () => {
      mockDb.getEmployee.mockResolvedValue({
        id: 'emp001',
        name: '山田太郎',
        department: '営業部',
        position: 'マネージャー',
        startDate: '2020-01-01'
      });

      // 後継者計画のモック
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'plan001',
            position_id: 'pos001',
            position_title: '営業部長',
            department: '営業部',
            criticality: 'critical',
            required_skills: JSON.stringify(['戦略立案', '組織開発']),
            required_competencies: JSON.stringify(['意思決定', '変革リーダーシップ']),
            required_experience_years: null
          }]
        })
        .mockResolvedValueOnce({ // スキル情報
          rows: [
            { skill_name: 'リーダーシップ' },
            { skill_name: '営業管理' }
          ]
        });

      const result = await engine.createDevelopmentPlan(
        'emp001',
        'plan001',
        '1_year'
      );

      expect(result.plan.candidateId).toBe('emp001');
      expect(result.plan.targetReadiness).toBe('1_year');
      expect(result.plan.phases.length).toBeGreaterThan(0);
      expect(result.riskMitigation).toContain('定期的な進捗評価と軌道修正');
      expect(result.successMetrics).toContain('スキル習得率90%以上');
    });
  });

  describe('エラーハンドリング', () => {
    it('存在しない後継者計画でエラーをスローする', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      await expect(
        engine.identifySuccessionCandidates('non-existent-plan')
      ).rejects.toThrow('Succession plan not found');
    });

    it('存在しない候補者でエラーをスローする', async () => {
      mockDb.getEmployee.mockResolvedValue(null);

      await expect(
        engine.createDevelopmentPlan('non-existent', 'plan001', '1_year')
      ).rejects.toThrow('Candidate not found');
    });
  });
});