import { describe, it, expect, beforeEach, vi } from 'vitest';
import HumanCapitalDisclosureEngine from '../../src/human-capital-disclosure-engine-v2.0.0.js';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import type { 
  Employee, 
  ExtendedEmployee,
  HumanCapitalMetrics,
  HumanCapitalReport 
} from '../../src/types.js';


describe('v2.0.0 人的資本開示エンジン - 網羅的テスト', () => {
  let engine: HumanCapitalDisclosureEngine;
  let mockDb: DatabasePostgreSQL;
  let testEmployees: ExtendedEmployee[];
  let mockLifecycleManagement: any;
  let mockTalentManagement: any;
  let mockLearningManagement: any;

  beforeEach(() => {
    // 多様なテスト従業員データ
    testEmployees = generateDiverseEmployees(100);
    
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getAllEmployees: vi.fn().mockResolvedValue(testEmployees),
      getEmployee: vi.fn(),
      getTimeRecords: vi.fn().mockResolvedValue([]),
      getAllTimeRecords: vi.fn().mockResolvedValue([]),
      getPayrollCalculations: vi.fn().mockResolvedValue([]),
      getAllPayrollCalculations: vi.fn().mockResolvedValue([]),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn()
    } as any;

    // Set up default mock responses for common queries
    mockDb.query = vi.fn().mockImplementation((sql: string) => {
      // Default empty result for all queries
      return Promise.resolve({ rows: [] });
    });

    // Mock the other required services
    mockLifecycleManagement = {};
    mockTalentManagement = {};
    mockLearningManagement = {};

    engine = new HumanCapitalDisclosureEngine(mockDb, mockLifecycleManagement, mockTalentManagement, mockLearningManagement);
  });

  describe('ISO30414準拠指標計算', () => {
    describe('1. コンプライアンス指標', () => {
      it('倫理研修完了率を正確に計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ 
            rows: [{ completed: 80 }]  // Training completions count
          })
          .mockResolvedValueOnce({ rows: [] })  // Incident data
          .mockResolvedValue({ rows: [] });  // Any other queries

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.compliance.ethicsTrainingCompletionRate).toBe(0.8); // 80/100
        expect(metrics.compliance.complianceScore).toBeGreaterThan(0.7);
      });

      it('ハラスメント事案発生率を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ rows: [{ completed: 0 }] }) // 倫理研修
          .mockResolvedValueOnce({ 
            rows: [
              { type: 'harassment', severity: 'medium', count: 1 },
              { type: 'harassment', severity: 'low', count: 1 }
            ]
          })
          .mockResolvedValue({ rows: [] });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.compliance.harassmentIncidentRate).toBe(0.02); // 2/100
        expect(metrics.compliance.incidentTypes.harassment).toBe(2);
      });

      it('コンプライアンス違反の重大度別集計を行う', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ rows: [{ completed: 0 }] }) // 倫理研修
          .mockResolvedValueOnce({ 
            rows: [
              { type: 'policy_violation', severity: 'critical', count: 1 },
              { type: 'harassment', severity: 'high', count: 1 },
              { type: 'discrimination', severity: 'medium', count: 1 },
              { type: 'safety_violation', severity: 'low', count: 1 }
            ]
          })
          .mockResolvedValue({ rows: [] });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.compliance.incidentsBySeverity.critical).toBe(1);
        expect(metrics.compliance.incidentsBySeverity.high).toBe(1);
        expect(metrics.compliance.incidentsBySeverity.medium).toBe(1);
        expect(metrics.compliance.incidentsBySeverity.low).toBe(1);
      });
    });

    describe('2. コスト指標', () => {
      it('総人件費と従業員あたり人件費を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(
          testEmployees.map(e => ({
            employeeId: e.id,
            month: '2024-01',
            totalPay: e.monthlySalary || e.hourlyWage * 160,
            netPay: (e.monthlySalary || e.hourlyWage * 160) * 0.8
          }))
        );

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.costs.totalLaborCost).toBeGreaterThan(0);
        expect(metrics.costs.laborCostPerEmployee).toBe(
          metrics.costs.totalLaborCost / testEmployees.length
        );
      });

      it('採用コストを正確に計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [
              { cost_type: 'recruitment_agency', amount: 500000 },
              { cost_type: 'job_posting', amount: 100000 },
              { cost_type: 'interview_time', amount: 200000 }
            ]
          })
          .mockResolvedValueOnce({
            rows: [{ hired_count: 10 }]
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.costs.totalRecruitmentCost).toBe(800000);
        expect(metrics.costs.costPerHire).toBe(80000); // 800000/10
      });

      it('研修投資額とROIを計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [
              { training_type: 'technical', cost: 1000000, participants: 50 },
              { training_type: 'leadership', cost: 500000, participants: 20 },
              { training_type: 'compliance', cost: 300000, participants: 100 }
            ]
          })
          .mockResolvedValueOnce({
            rows: [{ performance_improvement: 0.15 }] // 15%の生産性向上
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.costs.totalTrainingCost).toBe(1800000);
        expect(metrics.costs.trainingCostPerEmployee).toBe(18000); // 1800000/100
        expect(metrics.development.trainingROI).toBeGreaterThan(1); // 投資効果あり
      });
    });

    describe('3. 多様性指標', () => {
      it('性別多様性を正確に計算する', async () => {
        // testEmployeesは性別がバランスよく設定されている
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.diversity.genderDiversity.male).toBeCloseTo(0.5, 1);
        expect(metrics.diversity.genderDiversity.female).toBeCloseTo(0.4, 1);
        expect(metrics.diversity.genderDiversity.other).toBeCloseTo(0.1, 1);
        expect(metrics.diversity.genderDiversity.total).toBe(1);
      });

      it('年齢層分布を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.diversity.ageDistribution).toHaveProperty('20-29');
        expect(metrics.diversity.ageDistribution).toHaveProperty('30-39');
        expect(metrics.diversity.ageDistribution).toHaveProperty('40-49');
        expect(metrics.diversity.ageDistribution).toHaveProperty('50-59');
        expect(metrics.diversity.ageDistribution).toHaveProperty('60+');

        const totalAge = Object.values(metrics.diversity.ageDistribution)
          .reduce((sum, count) => sum + count, 0);
        expect(totalAge).toBe(testEmployees.length);
      });

      it('管理職の多様性を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.diversity.managementDiversity.femaleManagerRatio)
          .toBeGreaterThanOrEqual(0);
        expect(metrics.diversity.managementDiversity.femaleManagerRatio)
          .toBeLessThanOrEqual(1);
        expect(metrics.diversity.diversityIndex).toBeGreaterThan(0);
      });

      it('国籍・障害者雇用率を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.diversity.nationalityCount).toBeGreaterThan(1);
        expect(metrics.diversity.disabilityEmploymentRate).toBeGreaterThan(0);
        expect(metrics.diversity.inclusionScore).toBeGreaterThan(0);
      });
    });

    describe('4. リーダーシップ指標', () => {
      it('内部昇進率を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn().mockResolvedValue({
          rows: [
            { promotion_type: 'internal', count: 15 },
            { promotion_type: 'external', count: 5 }
          ]
        });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.leadership.internalPromotionRate).toBe(0.75); // 15/20
        expect(metrics.leadership.leadershipDevelopmentScore).toBeGreaterThan(0);
      });

      it('後継者準備率を計算する', async () => {
        const managers = testEmployees.filter(e => 
          e.position?.includes('マネージャー') || e.position?.includes('部長')
        );

        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn().mockResolvedValue({
          rows: managers.slice(0, Math.floor(managers.length * 0.7)).map(m => ({
            position_id: m.id,
            successor_count: Math.floor(Math.random() * 3) + 1
          }))
        });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.leadership.successionReadiness).toBeCloseTo(0.7, 1);
        expect(metrics.leadership.criticalPositionsCoverage).toBeGreaterThan(0);
      });

      it('リーダーシップパイプラインの健全性を評価する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [{ average_tenure: 3.5 }]
          })
          .mockResolvedValueOnce({
            rows: [{ participating_count: 30 }]
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.leadership.leadershipTenure).toBe(3.5);
        expect(metrics.leadership.leadershipPipelineStrength).toBeGreaterThan(0);
      });
    });

    describe('5. 組織文化指標', () => {
      it('従業員エンゲージメントスコアを計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn().mockResolvedValue({
          rows: testEmployees.map(e => ({
            employee_id: e.id,
            engagement_score: 3 + Math.random() * 2, // 3-5の範囲
            survey_date: new Date()
          }))
        });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.culture.engagementScore).toBeGreaterThan(3);
        expect(metrics.culture.engagementScore).toBeLessThanOrEqual(5);
      });

      it('eNPS（従業員推奨度）を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn().mockResolvedValue({
          rows: [
            ...Array(40).fill({ score: 9 }), // プロモーター
            ...Array(40).fill({ score: 7 }), // パッシブ
            ...Array(20).fill({ score: 5 })  // デトラクター
          ]
        });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.culture.eNPS).toBe(20); // (40-20)/100*100
      });

      it('組織文化の健全性を総合評価する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({ rows: Array(80).fill({ score: 4 }) })
          .mockResolvedValueOnce({ rows: [{ satisfaction_avg: 4.2 }] })
          .mockResolvedValueOnce({ rows: [{ wellness_score: 4.0 }] });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.culture.satisfactionScore).toBe(4.2);
        expect(metrics.culture.wellbeingIndex).toBe(4.0);
        expect(metrics.culture.culturalHealthScore).toBeGreaterThan(0);
      });
    });

    describe('6. 安全衛生指標', () => {
      it('労働災害発生率（LTIFR）を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [
              { type: 'injury', severity: 'lost_time', count: 2 },
              { type: 'injury', severity: 'medical_treatment', count: 3 },
              { type: 'injury', severity: 'first_aid', count: 5 }
            ]
          })
          .mockResolvedValueOnce({
            rows: [{ total_hours: 200000 }] // 総労働時間
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.safety.lostTimeInjuryRate).toBe(10); // 2/200000*1000000
        expect(metrics.safety.totalRecordableIncidentRate).toBe(25); // 5/200000*1000000
      });

      it('健康診断受診率を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn().mockResolvedValue({
          rows: testEmployees.slice(0, 95).map(e => ({
            employee_id: e.id,
            exam_date: new Date(),
            exam_type: 'annual'
          }))
        });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.safety.healthCheckupRate).toBe(0.95);
        expect(metrics.safety.healthPromotionScore).toBeGreaterThan(0.9);
      });

      it('メンタルヘルス指標を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [{ stress_check_participation: 0.85 }]
          })
          .mockResolvedValueOnce({
            rows: [
              { reason: 'mental_health', count: 3 },
              { reason: 'physical_health', count: 5 },
              { reason: 'other', count: 2 }
            ]
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.safety.stressCheckParticipationRate).toBe(0.85);
        expect(metrics.safety.mentalHealthSupportUtilization).toBeGreaterThan(0);
      });
    });

    describe('7. 生産性指標', () => {
      it('従業員あたり売上・利益を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [{ total_revenue: 10000000000 }] // 100億円
          })
          .mockResolvedValueOnce({
            rows: [{ total_profit: 1000000000 }] // 10億円
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.productivity.revenuePerEmployee).toBe(100000000); // 1億円
        expect(metrics.productivity.profitPerEmployee).toBe(10000000); // 1000万円
      });

      it('人的資本ROIを計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [{ total_revenue: 10000000000 }]
          })
          .mockResolvedValueOnce({
            rows: [{ total_labor_cost: 3000000000 }] // 30億円
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.productivity.humanCapitalROI).toBeCloseTo(2.33, 2); // (100-30)/30
      });

      it('付加価値生産性を計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [{ 
              total_revenue: 10000000000,
              total_cost: 7000000000
            }]
          })
          .mockResolvedValueOnce({
            rows: [{ average_hours: 1800 }] // 年間平均労働時間
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.productivity.valueAddedPerEmployee).toBe(30000000); // 3000万円
        expect(metrics.productivity.laborProductivityIndex).toBeGreaterThan(0);
      });
    });

    describe('8. 採用・離職指標', () => {
      it('離職率を正確に計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [
              { reason: 'voluntary', count: 8 },
              { reason: 'involuntary', count: 2 },
              { reason: 'retirement', count: 1 }
            ]
          })
          .mockResolvedValueOnce({
            rows: [{ average_employees: 95 }] // 期中平均従業員数
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.recruitment.totalTurnoverRate).toBeCloseTo(0.116, 3); // 11/95
        expect(metrics.recruitment.voluntaryTurnoverRate).toBeCloseTo(0.084, 3); // 8/95
      });

      it('採用充足率と質を評価する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [
              { open_positions: 20, filled_positions: 18 }
            ]
          })
          .mockResolvedValueOnce({
            rows: [
              { quality_score: 4.2, retention_90days: 0.95 }
            ]
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.recruitment.fillRate).toBe(0.9); // 18/20
        expect(metrics.recruitment.qualityOfHire).toBe(4.2);
        expect(metrics.recruitment.newHireRetention90Days).toBe(0.95);
      });

      it('採用までの期間とコストを計算する', async () => {
        mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
        mockDb.query = vi.fn()
          .mockResolvedValueOnce({
            rows: [{ average_days: 45 }]
          })
          .mockResolvedValueOnce({
            rows: [
              { source: 'referral', hires: 10, cost: 500000 },
              { source: 'agency', hires: 5, cost: 1500000 },
              { source: 'direct', hires: 5, cost: 200000 }
            ]
          });

        const metrics = await engine.calculateHumanCapitalMetrics();

        expect(metrics.recruitment.timeToFill).toBe(45);
        expect(metrics.recruitment.costPerHire).toBe(110000); // 2200000/20
        expect(metrics.recruitment.sourceEffectiveness.referral).toBeGreaterThan(0);
      });
    });
  });

  describe('人的資本レポート生成', () => {
    it('包括的な人的資本レポートを生成する', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
      // 各種メトリクスのモックデータ設定
      setupComprehensiveMockData(mockDb);

      const report = await engine.generateHumanCapitalReport();

      expect(report).toMatchObject({
        generatedAt: expect.any(Date),
        period: expect.any(String),
        metrics: expect.objectContaining({
          compliance: expect.any(Object),
          costs: expect.any(Object),
          diversity: expect.any(Object),
          leadership: expect.any(Object),
          culture: expect.any(Object),
          safety: expect.any(Object),
          productivity: expect.any(Object),
          recruitment: expect.any(Object)
        }),
        insights: expect.arrayContaining([
          expect.objectContaining({
            category: expect.any(String),
            finding: expect.any(String),
            significance: expect.stringMatching(/^(high|medium|low)$/),
            recommendation: expect.any(String)
          })
        ]),
        benchmarkComparison: expect.any(Object),
        trends: expect.any(Object),
        recommendations: expect.any(Array)
      });
    });

    it('業界ベンチマークとの比較を行う', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
      setupComprehensiveMockData(mockDb);

      const report = await engine.generateHumanCapitalReport();

      expect(report.benchmarkComparison.turnoverRate).toHaveProperty('company');
      expect(report.benchmarkComparison.turnoverRate).toHaveProperty('industry');
      expect(report.benchmarkComparison.turnoverRate).toHaveProperty('percentile');

      expect(report.benchmarkComparison.engagementScore.percentile)
        .toBeGreaterThanOrEqual(0);
      expect(report.benchmarkComparison.engagementScore.percentile)
        .toBeLessThanOrEqual(100);
    });

    it('トレンド分析を含むレポートを生成する', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
      setupComprehensiveMockData(mockDb);

      // 過去データのモック
      mockDb.query = vi.fn().mockImplementation((query) => {
        if (query.includes('historical')) {
          return {
            rows: Array(12).fill(null).map((_, i) => ({
              month: `2023-${String(i + 1).padStart(2, '0')}`,
              value: 0.1 + Math.random() * 0.05
            }))
          };
        }
        return { rows: [] };
      });

      const report = await engine.generateHumanCapitalReport();

      expect(report.trends.turnoverRate).toHaveProperty('direction');
      expect(report.trends.turnoverRate).toHaveProperty('change');
      expect(report.trends.turnoverRate.direction).toMatch(/^(increasing|decreasing|stable)$/);
    });

    it('重要な洞察と推奨事項を生成する', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
      setupComprehensiveMockData(mockDb);

      const report = await engine.generateHumanCapitalReport();

      expect(report.insights.length).toBeGreaterThan(0);
      
      // 高重要度の洞察が含まれることを確認
      const highPriorityInsights = report.insights.filter(i => i.significance === 'high');
      expect(highPriorityInsights.length).toBeGreaterThan(0);

      // 推奨事項が具体的であることを確認
      expect(report.recommendations.length).toBeGreaterThan(0);
      report.recommendations.forEach(rec => {
        expect(rec.priority).toMatch(/^(immediate|short_term|medium_term|long_term)$/);
        expect(rec.expectedImpact).toMatch(/^(high|medium|low)$/);
        expect(rec.description.length).toBeGreaterThan(10);
      });
    });
  });

  describe('リアルタイムダッシュボード指標', () => {
    it('リアルタイム指標を高速で計算する', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
      setupRealtimeMockData(mockDb);

      const startTime = Date.now();
      const metrics = await engine.calculateRealTimeMetrics();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000); // 3秒以内
      expect(metrics).toHaveProperty('currentHeadcount');
      expect(metrics).toHaveProperty('todayAttendanceRate');
      expect(metrics).toHaveProperty('weeklyTurnover');
      expect(metrics).toHaveProperty('activeRecruitments');
    });

    it('異常値をリアルタイムで検出する', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
      
      // 異常な欠勤率をシミュレート
      mockDb.query = vi.fn().mockResolvedValue({
        rows: [{ attendance_rate: 0.7 }] // 通常は0.95以上
      });

      const metrics = await engine.calculateRealTimeMetrics();

      expect(metrics.alerts).toContainEqual(
        expect.objectContaining({
          type: 'attendance_anomaly',
          severity: 'high'
        })
      );
    });
  });

  describe('エラーハンドリングと検証', () => {
    it('データ欠損時にデフォルト値で処理を継続する', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue([]);

      const metrics = await engine.calculateHumanCapitalMetrics();

      expect(metrics.compliance.ethicsTrainingCompletionRate).toBe(0);
      expect(metrics.diversity.genderDiversity.total).toBe(0);
      Object.values(metrics).forEach(category => {
        expect(category).toBeDefined();
      });
    });

    it('無効なデータを検証してエラーを報告する', async () => {
      const invalidEmployees = [
        { id: 'emp001', name: 'Test', gender: 'invalid' }, // 無効な性別
        { id: 'emp002', name: 'Test2', age: -5 }, // 無効な年齢
        { id: 'emp003', name: 'Test3', startDate: 'invalid-date' } // 無効な日付
      ];

      mockDb.getAllEmployees = vi.fn().mockResolvedValue(invalidEmployees);

      const metrics = await engine.calculateHumanCapitalMetrics();
      
      expect(metrics.dataQuality).toBeDefined();
      expect(metrics.dataQuality.validationErrors).toBeGreaterThan(0);
      expect(metrics.dataQuality.completeness).toBeLessThan(1);
    });

    it('データベースエラーを適切に処理する', async () => {
      mockDb.getAllEmployees = vi.fn().mockRejectedValue(new Error('DB connection failed'));

      await expect(engine.generateHumanCapitalReport())
        .rejects.toThrow('DB connection failed');
    });
  });

  describe('パフォーマンステスト', () => {
    it('1万人規模の従業員データを処理する', async () => {
      const largeEmployeeSet = generateDiverseEmployees(10000);
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(largeEmployeeSet);
      setupComprehensiveMockData(mockDb, largeEmployeeSet.length);

      const startTime = Date.now();
      const metrics = await engine.calculateHumanCapitalMetrics();
      const endTime = Date.now();

      expect(metrics.totalEmployees).toBe(10000);
      expect(endTime - startTime).toBeLessThan(30000); // 30秒以内
    });

    it('複数期間の比較分析を効率的に実行する', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
      
      const periods = ['2023-01', '2023-06', '2023-12', '2024-01'];
      const startTime = Date.now();
      
      const results = await Promise.all(
        periods.map(period => 
          engine.calculateHumanCapitalMetrics(new Date(period))
        )
      );
      
      const endTime = Date.now();

      expect(results).toHaveLength(4);
      expect(endTime - startTime).toBeLessThan(20000); // 20秒以内
    });
  });

  describe('特殊ケースと境界値', () => {
    it('単一従業員の組織でも計算を実行する', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue([testEmployees[0]]);

      const metrics = await engine.calculateHumanCapitalMetrics();

      expect(metrics.totalEmployees).toBe(1);
      expect(metrics.diversity.diversityIndex).toBe(0); // 多様性なし
      expect(metrics.productivity.revenuePerEmployee).toBeDefined();
    });

    it('100%の値でも正常に処理する', async () => {
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(testEmployees);
      
      // 全員が倫理研修完了
      mockDb.query = vi.fn().mockResolvedValue({
        rows: testEmployees.map(e => ({ employee_id: e.id, completed: true }))
      });

      const metrics = await engine.calculateHumanCapitalMetrics();

      expect(metrics.compliance.ethicsTrainingCompletionRate).toBe(1);
      expect(metrics.compliance.complianceScore).toBe(1);
    });

    it('グローバル企業の多言語・多通貨対応', async () => {
      const globalEmployees = testEmployees.map((e, i) => ({
        ...e,
        location: ['Japan', 'USA', 'UK', 'Singapore'][i % 4],
        currency: ['JPY', 'USD', 'GBP', 'SGD'][i % 4],
        language: ['ja', 'en', 'en-GB', 'en-SG'][i % 4]
      }));

      mockDb.getAllEmployees = vi.fn().mockResolvedValue(globalEmployees);

      const metrics = await engine.calculateHumanCapitalMetrics();

      expect(metrics.global).toBeDefined();
      expect(metrics.global.locationCount).toBe(4);
      expect(metrics.global.currencyCount).toBe(4);
    });
  });
});

// ヘルパー関数
function generateDiverseEmployees(count: number = 100): ExtendedEmployee[] {
  const departments = ['営業部', '開発部', '人事部', '経理部', '企画部'];
  const positions = ['スタッフ', 'シニアスタッフ', 'マネージャー', 'シニアマネージャー', '部長'];
  const genders = ['male', 'female', 'other'];
  const nationalities = ['日本', 'アメリカ', '中国', '韓国', 'インド', 'その他'];
  
  const employees: ExtendedEmployee[] = [];

  for (let i = 0; i < count; i++) {
    const age = 22 + Math.floor(Math.random() * 43); // 22-65歳
    const yearsOfService = Math.min(age - 22, Math.floor(Math.random() * 20));
    
    employees.push({
      id: `emp${String(i + 1).padStart(4, '0')}`,
      name: `従業員 ${i + 1}`,
      email: `employee${i + 1}@example.com`,
      department: departments[i % departments.length],
      position: positions[Math.floor(Math.random() * positions.length)],
      hourlyWage: 2000 + Math.floor(Math.random() * 3000),
      monthlySalary: (() => {
        const position = positions[Math.floor(Math.random() * positions.length)];
        const base = positions.indexOf(position || 'スタッフ');
        return 250000 + base * 150000 + Math.random() * 100000;
      })(),
      startDate: new Date(Date.now() - yearsOfService * 365 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: Math.random() > 0.05,
      gender: genders[i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : Math.random() > 0.9 ? 2 : i % 2],
      age,
      nationality: nationalities[Math.floor(Math.random() * nationalities.length)],
      disability: Math.random() < 0.03,
      education: ['高校', '専門学校', '大学', '大学院'][Math.floor(Math.random() * 4)],
      managerId: i > 10 ? `emp${String(Math.floor(i / 10)).padStart(4, '0')}` : undefined,
      skills: generateRandomSkills(),
      performanceRating: 2 + Math.random() * 3,
      lastPromotionDate: Math.random() > 0.7 ? 
        new Date(Date.now() - Math.random() * 2 * 365 * 24 * 60 * 60 * 1000).toISOString() : 
        undefined
    });
  }

  return employees;
}

function generateRandomSkills() {
  const allSkills = [
    'プロジェクト管理', 'データ分析', 'プログラミング', '営業',
    'マーケティング', '会計', '人事', '法務', 'リーダーシップ',
    'コミュニケーション', '問題解決', '戦略立案'
  ];
  
  const count = Math.floor(Math.random() * 5) + 1;
  const skills = [];
  
  for (let i = 0; i < count; i++) {
    const skill = allSkills[Math.floor(Math.random() * allSkills.length)];
    if (!skills.find(s => s.name === skill)) {
      skills.push({
        name: skill,
        level: Math.floor(Math.random() * 5) + 1,
        certifiedDate: Math.random() > 0.5 ? 
          new Date(Date.now() - Math.random() * 3 * 365 * 24 * 60 * 60 * 1000).toISOString() :
          undefined
      });
    }
  }
  
  return skills;
}

function setupComprehensiveMockData(mockDb: any, employeeCount: number = 100) {
  mockDb.query = vi.fn().mockImplementation((query) => {
    // 各種クエリに対するモックレスポンスを設定
    if (query.includes('ethics_training')) {
      return { rows: Array(Math.floor(employeeCount * 0.8)).fill({ completed: true }) };
    }
    if (query.includes('incidents')) {
      return { rows: Array(5).fill({ type: 'harassment', severity: 'low' }) };
    }
    if (query.includes('recruitment_cost')) {
      return { rows: [{ total_cost: 5000000, hired_count: 20 }] };
    }
    if (query.includes('revenue')) {
      return { rows: [{ total_revenue: employeeCount * 100000000 }] };
    }
    if (query.includes('engagement')) {
      return { rows: Array(employeeCount).fill({ score: 4.0 + Math.random() * 0.5 }) };
    }
    return { rows: [] };
  });

  mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(
    Array(employeeCount).fill(null).map((_, i) => ({
      employeeId: `emp${String(i + 1).padStart(4, '0')}`,
      totalPay: 300000 + Math.random() * 200000
    }))
  );
}

function setupRealtimeMockData(mockDb: any) {
  mockDb.query = vi.fn().mockImplementation((query) => {
    if (query.includes('attendance_today')) {
      return { rows: [{ present: 95, total: 100 }] };
    }
    if (query.includes('weekly_turnover')) {
      return { rows: [{ terminated: 2 }] };
    }
    if (query.includes('active_recruitment')) {
      return { rows: [{ open_positions: 15 }] };
    }
    return { rows: [] };
  });
}