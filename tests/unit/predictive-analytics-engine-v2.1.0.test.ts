import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import PredictiveAnalyticsEngine from '../../src/predictive-analytics-engine-v2.1.0.js';
import Database from '../../src/database.js';
import type { Employee, TimeRecord, PayrollCalculation } from '../../src/types.js';

// モックデータ
const mockEmployees: Employee[] = [
  {
    id: 'emp1',
    name: '田中 太郎',
    email: 'tanaka@example.com',
    department: '開発部',
    position: 'エンジニア',
    hourlyWage: 3000,
    startDate: '2022-04-01',
    isActive: true
  },
  {
    id: 'emp2',
    name: '鈴木 花子',
    email: 'suzuki@example.com',
    department: '営業部',
    position: 'マネージャー',
    hourlyWage: 4000,
    startDate: '2020-01-15',
    isActive: true
  },
  {
    id: 'emp3',
    name: '佐藤 次郎',
    email: 'sato@example.com',
    department: '人事部',
    position: 'スタッフ',
    hourlyWage: 2500,
    startDate: '2023-06-01',
    isActive: true
  }
];

const generateTimeRecords = (employeeId: string, startDate: Date, days: number): TimeRecord[] => {
  const records: TimeRecord[] = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    // 週末は休み
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    // 基本的な勤務パターン（9:00-18:00）
    const clockIn = new Date(date);
    clockIn.setHours(9, 0, 0, 0);
    
    const clockOut = new Date(date);
    // 残業をランダムに設定（30%の確率で残業）
    const overtime = Math.random() < 0.3 ? Math.floor(Math.random() * 4) : 0;
    clockOut.setHours(18 + overtime, Math.floor(Math.random() * 60), 0, 0);
    
    records.push({
      id: `record_${employeeId}_${i}`,
      employeeId,
      date,
      clockIn,
      clockOut,
      breakMinutes: 60,
      recordType: 'ic_card'
    });
  }
  
  return records;
};

describe('PredictiveAnalyticsEngine v2.1.0', () => {
  let engine: PredictiveAnalyticsEngine;
  let mockDb: Database;
  
  beforeEach(() => {
    // データベースのモック
    mockDb = {
      getAllEmployees: vi.fn().mockResolvedValue(mockEmployees),
      getEmployee: vi.fn().mockImplementation((id: string) => 
        Promise.resolve(mockEmployees.find(e => e.id === id))
      ),
      getTimeRecords: vi.fn().mockImplementation((employeeId: string, start: Date, end: Date) => {
        const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return Promise.resolve(generateTimeRecords(employeeId, start, days));
      })
    } as any;
    
    engine = new PredictiveAnalyticsEngine(mockDb);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('残業時間予測', () => {
    it('従業員の残業時間を予測できる', async () => {
      const predictions = await engine.predictOvertime('emp1');
      
      expect(predictions).toHaveLength(1);
      expect(predictions[0]).toMatchObject({
        employeeId: 'emp1',
        employeeName: '田中 太郎',
        department: '開発部',
        currentWeekOvertime: expect.any(Number),
        predictedWeekOvertime: expect.any(Number),
        predictedMonthOvertime: expect.any(Number),
        riskLevel: expect.stringMatching(/^(low|medium|high|critical)$/),
        confidence: expect.any(Number),
        alertRequired: expect.any(Boolean)
      });
    });

    it('全従業員の残業時間を予測できる', async () => {
      const predictions = await engine.predictOvertime();
      
      expect(predictions).toHaveLength(3);
      expect(predictions[0].riskLevel).toBeDefined();
      // リスクレベルでソートされていることを確認
      for (let i = 1; i < predictions.length; i++) {
        const prevRisk = predictions[i-1].riskLevel;
        const currRisk = predictions[i].riskLevel;
        const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        expect(riskOrder[prevRisk] >= riskOrder[currRisk]).toBe(true);
      }
    });

    it('高リスクの従業員にアラートフラグを設定する', async () => {
      // 高い残業時間のモックデータを設定
      const highOvertimeRecords = generateTimeRecords('emp1', new Date(), 30).map(record => ({
        ...record,
        clockOut: new Date(record.clockOut!.getTime() + 4 * 60 * 60 * 1000) // 4時間追加
      }));
      
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(highOvertimeRecords);
      
      const predictions = await engine.predictOvertime('emp1');
      
      expect(predictions[0].riskLevel).toMatch(/^(high|critical)$/);
      expect(predictions[0].alertRequired).toBe(true);
    });

    it('予測信頼度が0から1の範囲内である', async () => {
      const predictions = await engine.predictOvertime();
      
      predictions.forEach(prediction => {
        expect(prediction.confidence).toBeGreaterThanOrEqual(0);
        expect(prediction.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('推奨事項が高リスクレベルに応じて生成される', async () => {
      const predictions = await engine.predictOvertime();
      
      predictions.forEach(prediction => {
        expect(prediction.recommendations).toBeInstanceOf(Array);
        if (prediction.riskLevel === 'critical') {
          expect(prediction.recommendations.length).toBeGreaterThan(0);
          expect(prediction.recommendations.some(r => r.includes('即座に'))).toBe(true);
        }
      });
    });
  });

  describe('離職予測', () => {
    it('従業員の離職リスクを予測できる', async () => {
      const predictions = await engine.predictTurnover('emp1');
      
      expect(predictions).toHaveLength(1);
      expect(predictions[0]).toMatchObject({
        employeeId: 'emp1',
        employeeName: '田中 太郎',
        department: '開発部',
        position: 'エンジニア',
        riskScore: expect.any(Number),
        riskLevel: expect.stringMatching(/^(low|medium|high|critical)$/),
        confidence: expect.any(Number),
        predictedTimeframe: expect.any(Number),
        warningSignals: expect.any(Array),
        retentionActions: expect.any(Array)
      });
    });

    it('リスクスコアが0から100の範囲内である', async () => {
      const predictions = await engine.predictTurnover();
      
      predictions.forEach(prediction => {
        expect(prediction.riskScore).toBeGreaterThanOrEqual(0);
        expect(prediction.riskScore).toBeLessThanOrEqual(100);
      });
    });

    it('新入社員（2年未満）の離職リスクが高く評価される', async () => {
      const newEmployee: Employee = {
        id: 'emp_new',
        name: '新人 太郎',
        email: 'newbie@example.com',
        department: '開発部',
        position: 'ジュニアエンジニア',
        hourlyWage: 2000,
        startDate: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 6ヶ月前
        isActive: true
      };
      
      mockDb.getEmployee = vi.fn().mockResolvedValue(newEmployee);
      
      const predictions = await engine.predictTurnover('emp_new');
      
      expect(predictions[0].keyFactors.tenureMonths).toBeLessThan(24);
      expect(predictions[0].riskScore).toBeGreaterThan(50);
    });

    it('警告シグナルが適切に検出される', async () => {
      // 異常な勤怠パターンのモックデータ
      const irregularRecords = generateTimeRecords('emp1', new Date(), 30).map((record, index) => ({
        ...record,
        // 遅刻を頻繁に設定
        clockIn: index % 3 === 0 ? 
          new Date(record.clockIn.getTime() + 30 * 60 * 1000) : // 30分遅刻
          record.clockIn
      }));
      
      mockDb.getTimeRecords = vi.fn().mockResolvedValue(irregularRecords);
      
      const predictions = await engine.predictTurnover('emp1');
      
      expect(predictions[0].warningSignals.length).toBeGreaterThan(0);
      expect(predictions[0].warningSignals.some(signal => signal.includes('遅刻'))).toBe(true);
    });

    it('離職防止アクションが重要度順に生成される', async () => {
      const predictions = await engine.predictTurnover();
      
      predictions.forEach(prediction => {
        expect(prediction.retentionActions).toBeInstanceOf(Array);
        if (prediction.riskLevel === 'critical') {
          expect(prediction.retentionActions.some(action => action.includes('緊急'))).toBe(true);
        }
      });
    });
  });

  describe('人的資本ダッシュボード', () => {
    it('包括的な人的資本指標を生成できる', async () => {
      const dashboard = await engine.generateHumanCapitalDashboard();
      
      expect(dashboard).toMatchObject({
        period: 'current',
        employeeCount: 3,
        diversity: {
          genderRatio: expect.any(Object),
          ageDistribution: expect.any(Object),
          managementDiversity: expect.any(Object)
        },
        engagement: {
          enps: expect.any(Number),
          satisfactionScore: expect.any(Number),
          retentionRate: expect.any(Number),
          voluntaryTurnoverRate: expect.any(Number)
        },
        productivity: {
          revenuePerEmployee: expect.any(Number),
          overtimeRatio: expect.any(Number),
          absenteeismRate: expect.any(Number),
          avgOvertimeHours: expect.any(Number)
        },
        development: {
          trainingHoursPerEmployee: expect.any(Number),
          skillDevelopmentRate: expect.any(Number),
          internalPromotionRate: expect.any(Number),
          trainingROI: expect.any(Number)
        },
        predictions: {
          overtimeRisk: expect.any(Object),
          turnoverRisk: expect.any(Object),
          skillGap: expect.any(Object)
        }
      });
    });

    it('多様性指標が正しく計算される', async () => {
      const dashboard = await engine.generateHumanCapitalDashboard();
      
      const genderRatio = dashboard.diversity.genderRatio;
      const totalRatio = genderRatio.male + genderRatio.female + genderRatio.other;
      
      expect(totalRatio).toBeCloseTo(1, 2);
      expect(dashboard.diversity.managementDiversity.femaleManagerRatio).toBeGreaterThanOrEqual(0);
      expect(dashboard.diversity.managementDiversity.femaleManagerRatio).toBeLessThanOrEqual(1);
    });

    it('エンゲージメント指標が妥当な範囲内である', async () => {
      const dashboard = await engine.generateHumanCapitalDashboard();
      
      expect(dashboard.engagement.enps).toBeGreaterThanOrEqual(-100);
      expect(dashboard.engagement.enps).toBeLessThanOrEqual(100);
      expect(dashboard.engagement.satisfactionScore).toBeGreaterThanOrEqual(0);
      expect(dashboard.engagement.satisfactionScore).toBeLessThanOrEqual(5);
      expect(dashboard.engagement.retentionRate).toBeGreaterThanOrEqual(0);
      expect(dashboard.engagement.retentionRate).toBeLessThanOrEqual(1);
    });

    it('予測リスク指標が正しく集計される', async () => {
      const dashboard = await engine.generateHumanCapitalDashboard();
      
      const overtimeRisk = dashboard.predictions.overtimeRisk;
      const totalOvertimeRisk = overtimeRisk.high + overtimeRisk.medium + overtimeRisk.low;
      
      expect(totalOvertimeRisk).toBeCloseTo(1, 2);
      
      const turnoverRisk = dashboard.predictions.turnoverRisk;
      const totalTurnoverRisk = turnoverRisk.critical + turnoverRisk.high + 
                               turnoverRisk.medium + turnoverRisk.low;
      
      expect(totalTurnoverRisk).toBeCloseTo(1, 2);
    });

    it('期間を指定してダッシュボードを生成できる', async () => {
      const customPeriod = '2024-Q1';
      const dashboard = await engine.generateHumanCapitalDashboard(customPeriod);
      
      expect(dashboard.period).toBe(customPeriod);
    });
  });

  describe('エラーハンドリング', () => {
    it('従業員が存在しない場合、空の予測結果を返す', async () => {
      mockDb.getEmployee = vi.fn().mockResolvedValue(null);
      
      const predictions = await engine.predictOvertime('non_existent');
      
      expect(predictions).toHaveLength(0);
    });

    it('データベースエラーが発生した場合、エラーを投げる', async () => {
      mockDb.getAllEmployees = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      
      await expect(engine.predictOvertime()).rejects.toThrow('Database connection failed');
    });

    it('時系列データが不足している場合でも予測を実行する', async () => {
      mockDb.getTimeRecords = vi.fn().mockResolvedValue([]);
      
      const predictions = await engine.predictOvertime('emp1');
      
      expect(predictions).toHaveLength(1);
      expect(predictions[0].confidence).toBeLessThan(0.5); // 信頼度が低い
    });
  });

  describe('パフォーマンス', () => {
    it('大量の従業員データでも適切な時間内に処理が完了する', async () => {
      const largeEmployeeSet = Array.from({ length: 100 }, (_, i) => ({
        ...mockEmployees[0],
        id: `emp_${i}`,
        name: `従業員 ${i}`
      }));
      
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(largeEmployeeSet);
      
      const startTime = Date.now();
      const predictions = await engine.predictOvertime();
      const endTime = Date.now();
      
      expect(predictions).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
    });
  });

  describe('設定のカスタマイズ', () => {
    it('カスタム設定で予測モデルを初期化できる', () => {
      const customConfig = {
        model: 'prophet' as const,
        seasonality: false,
        trend: true,
        holidays: false,
        confidence_interval: 0.90,
        prediction_horizon: 60
      };
      
      const customEngine = new PredictiveAnalyticsEngine(mockDb, customConfig);
      
      expect(customEngine).toBeDefined();
      // 設定が適用されていることを確認（内部状態のテスト）
    });
  });
});

describe('PredictiveAnalyticsEngine エッジケース', () => {
  let engine: PredictiveAnalyticsEngine;
  let mockDb: Database;
  
  beforeEach(() => {
    mockDb = {
      getAllEmployees: vi.fn().mockResolvedValue(mockEmployees),
      getEmployee: vi.fn(),
      getTimeRecords: vi.fn()
    } as any;
    
    engine = new PredictiveAnalyticsEngine(mockDb);
  });

  it('極端に高い残業時間でも適切に処理される', async () => {
    const extremeOvertimeRecords = generateTimeRecords('emp1', new Date(), 30).map(record => ({
      ...record,
      clockOut: new Date(record.date.setHours(23, 59, 0, 0)) // 深夜まで勤務
    }));
    
    mockDb.getTimeRecords = vi.fn().mockResolvedValue(extremeOvertimeRecords);
    mockDb.getEmployee = vi.fn().mockResolvedValue(mockEmployees[0]);
    
    const predictions = await engine.predictOvertime('emp1');
    
    expect(predictions[0].riskLevel).toBe('critical');
    expect(predictions[0].predictedMonthOvertime).toBeGreaterThan(100);
  });

  it('非アクティブな従業員は予測から除外される', async () => {
    const inactiveEmployee = { ...mockEmployees[0], isActive: false };
    mockDb.getAllEmployees = vi.fn().mockResolvedValue([
      ...mockEmployees,
      inactiveEmployee
    ]);
    
    const predictions = await engine.predictOvertime();
    
    expect(predictions.find(p => p.employeeId === inactiveEmployee.id)).toBeUndefined();
  });

  it('週末や祝日の勤務パターンも考慮される', async () => {
    const weekendRecords = [];
    const startDate = new Date('2024-01-01');
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // 週末も含める
      const clockIn = new Date(date);
      clockIn.setHours(9, 0, 0, 0);
      
      const clockOut = new Date(date);
      clockOut.setHours(18, 0, 0, 0);
      
      weekendRecords.push({
        id: `record_${i}`,
        employeeId: 'emp1',
        date,
        clockIn,
        clockOut,
        breakMinutes: 60,
        recordType: 'ic_card' as const
      });
    }
    
    mockDb.getTimeRecords = vi.fn().mockResolvedValue(weekendRecords);
    mockDb.getEmployee = vi.fn().mockResolvedValue(mockEmployees[0]);
    
    const predictions = await engine.predictOvertime('emp1');
    
    expect(predictions[0].factors.seasonalPattern).toBeGreaterThan(0);
  });
});