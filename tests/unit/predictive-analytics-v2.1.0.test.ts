import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PredictiveAnalyticsEngineV2 } from '../../src/predictive-analytics-v2.1.0.js';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import type { Employee } from '../../src/types.js';

// モックデータベース
const mockDb = {
  getEmployee: vi.fn(),
  getAllEmployees: vi.fn(),
  getTimeRecords: vi.fn(),
  getLeaveRecords: vi.fn(),
  getEmployeesByDepartment: vi.fn()
} as any;

describe('予測的HRアナリティクスエンジン v2.1.0', () => {
  let engine: PredictiveAnalyticsEngineV2;
  let mockEmployee: Employee;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new PredictiveAnalyticsEngineV2(mockDb);
    
    mockEmployee = {
      id: 'EMP001',
      name: '山田太郎',
      department: '開発部',
      position: 'シニアエンジニア',
      hourlyRate: 3500,
      startDate: new Date('2022-04-01'),
      isActive: true
    };
  });

  describe('残業時間予測', () => {
    it('個別従業員の残業時間を予測できる', async () => {
      mockDb.getEmployee.mockResolvedValue(mockEmployee);
      mockDb.getTimeRecords.mockResolvedValue(generateMockTimeRecords(180));
      
      const forecast = await engine.forecastOvertime('EMP001');
      
      expect(forecast).toBeDefined();
      expect(forecast.employeeId).toBe('EMP001');
      expect(forecast.predictions).toHaveLength(30); // 30日間の予測
      expect(forecast.trend).toMatch(/increasing|stable|decreasing/);
      expect(forecast.riskAssessment.level).toMatch(/low|medium|high|critical/);
      expect(forecast.recommendations).toBeInstanceOf(Array);
    });

    it('予測値に信頼区間が含まれる', async () => {
      mockDb.getEmployee.mockResolvedValue(mockEmployee);
      mockDb.getTimeRecords.mockResolvedValue(generateMockTimeRecords(180));
      
      const forecast = await engine.forecastOvertime('EMP001');
      
      forecast.predictions.forEach(pred => {
        expect(pred.upperBound).toBeGreaterThanOrEqual(pred.predictedHours);
        expect(pred.lowerBound).toBeLessThanOrEqual(pred.predictedHours);
        expect(pred.confidence).toBeGreaterThan(0);
        expect(pred.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('高リスクの場合、緊急推奨事項が生成される', async () => {
      mockDb.getEmployee.mockResolvedValue(mockEmployee);
      // 高い残業時間のデータを生成
      const highOvertimeRecords = generateMockTimeRecords(180, { overtimeHours: 60 });
      mockDb.getTimeRecords.mockResolvedValue(highOvertimeRecords);
      
      const forecast = await engine.forecastOvertime('EMP001');
      
      expect(forecast.riskAssessment.level).toMatch(/high|critical/);
      expect(forecast.recommendations.some(r => r.priority === 'immediate')).toBe(true);
    });
  });

  describe('離職リスク分析', () => {
    it('個別従業員の離職リスクを分析できる', async () => {
      mockDb.getEmployee.mockResolvedValue(mockEmployee);
      mockDb.getTimeRecords.mockResolvedValue(generateMockTimeRecords(180));
      mockDb.getEmployeesByDepartment.mockResolvedValue([mockEmployee]);
      
      const analysis = await engine.analyzeTurnoverRisk('EMP001');
      
      expect(analysis).toBeDefined();
      expect(analysis.employeeId).toBe('EMP001');
      expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
      expect(analysis.riskScore).toBeLessThanOrEqual(100);
      expect(analysis.riskLevel).toMatch(/low|medium|high|critical/);
      expect(analysis.riskFactors).toBeInstanceOf(Array);
      expect(analysis.retentionStrategies).toBeInstanceOf(Array);
    });

    it('リスクファクターが正しく計算される', async () => {
      mockDb.getEmployee.mockResolvedValue(mockEmployee);
      mockDb.getTimeRecords.mockResolvedValue(generateMockTimeRecords(180));
      mockDb.getEmployeesByDepartment.mockResolvedValue([mockEmployee]);
      
      const analysis = await engine.analyzeTurnoverRisk('EMP001');
      
      const factors = analysis.riskFactors;
      expect(factors.find(f => f.factor === '残業時間')).toBeDefined();
      expect(factors.find(f => f.factor === '勤怠パターン')).toBeDefined();
      expect(factors.find(f => f.factor === '在籍期間')).toBeDefined();
      
      factors.forEach(factor => {
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
        expect(factor.weight).toBeGreaterThan(0);
        expect(factor.weight).toBeLessThanOrEqual(1);
      });
    });

    it('新入社員は高い離職リスクと判定される', async () => {
      const newEmployee = {
        ...mockEmployee,
        startDate: new Date() // 入社直後
      };
      mockDb.getEmployee.mockResolvedValue(newEmployee);
      mockDb.getTimeRecords.mockResolvedValue(generateMockTimeRecords(30));
      mockDb.getEmployeesByDepartment.mockResolvedValue([newEmployee]);
      
      const analysis = await engine.analyzeTurnoverRisk('EMP001');
      
      const tenureFactor = analysis.riskFactors.find(f => f.factor === '在籍期間');
      expect(tenureFactor?.score).toBeGreaterThan(50);
    });
  });

  describe('予測ダッシュボード生成', () => {
    it('包括的な予測ダッシュボードを生成できる', async () => {
      const employees = [
        mockEmployee,
        { ...mockEmployee, id: 'EMP002', name: '鈴木花子' },
        { ...mockEmployee, id: 'EMP003', name: '田中次郎' }
      ];
      
      mockDb.getAllEmployees.mockResolvedValue(employees);
      mockDb.getEmployee.mockImplementation((id) => 
        employees.find(e => e.id === id)
      );
      mockDb.getTimeRecords.mockResolvedValue(generateMockTimeRecords(180));
      mockDb.getEmployeesByDepartment.mockResolvedValue(employees);
      
      const dashboard = await engine.runPredictiveAnalysis();
      
      expect(dashboard).toBeDefined();
      expect(dashboard.generatedAt).toBeInstanceOf(Date);
      expect(dashboard.overview.totalEmployees).toBe(3);
      expect(dashboard.overtimeAnalysis).toBeDefined();
      expect(dashboard.turnoverAnalysis).toBeDefined();
      expect(dashboard.recommendations).toBeDefined();
    });

    it('部署別の分析が含まれる', async () => {
      const employees = [
        mockEmployee,
        { ...mockEmployee, id: 'EMP002', department: '営業部' },
        { ...mockEmployee, id: 'EMP003', department: '人事部' }
      ];
      
      mockDb.getAllEmployees.mockResolvedValue(employees);
      mockDb.getEmployee.mockImplementation((id) => 
        employees.find(e => e.id === id)
      );
      mockDb.getTimeRecords.mockResolvedValue(generateMockTimeRecords(180));
      mockDb.getEmployeesByDepartment.mockResolvedValue(employees);
      
      const dashboard = await engine.runPredictiveAnalysis();
      
      expect(dashboard.overtimeAnalysis.departmentBreakdown.length).toBeGreaterThan(0);
      expect(dashboard.turnoverAnalysis.departmentRisk.length).toBeGreaterThan(0);
    });
  });

  describe('予測アラート生成', () => {
    it('重要度順にソートされたアラートを生成する', async () => {
      const employees = [mockEmployee];
      mockDb.getAllEmployees.mockResolvedValue(employees);
      mockDb.getEmployee.mockResolvedValue(mockEmployee);
      mockDb.getTimeRecords.mockResolvedValue(generateMockTimeRecords(180, { overtimeHours: 50 }));
      mockDb.getEmployeesByDepartment.mockResolvedValue(employees);
      
      const alerts = await engine.generatePredictiveAlerts();
      
      expect(alerts).toBeInstanceOf(Array);
      
      // 重要度順にソートされているか確認
      for (let i = 0; i < alerts.length - 1; i++) {
        const currentSeverity = alerts[i].severity;
        const nextSeverity = alerts[i + 1].severity;
        const severityOrder = { critical: 0, alert: 1, warning: 2, info: 3 };
        expect(severityOrder[currentSeverity]).toBeLessThanOrEqual(severityOrder[nextSeverity]);
      }
    });

    it('各アラートに必要な情報が含まれる', async () => {
      const employees = [mockEmployee];
      mockDb.getAllEmployees.mockResolvedValue(employees);
      mockDb.getEmployee.mockResolvedValue(mockEmployee);
      mockDb.getTimeRecords.mockResolvedValue(generateMockTimeRecords(180, { overtimeHours: 50 }));
      mockDb.getEmployeesByDepartment.mockResolvedValue(employees);
      
      const alerts = await engine.generatePredictiveAlerts();
      
      alerts.forEach(alert => {
        expect(alert.id).toBeDefined();
        expect(alert.type).toMatch(/overtime|turnover|compliance|performance|wellbeing/);
        expect(alert.severity).toMatch(/info|warning|alert|critical/);
        expect(alert.title).toBeDefined();
        expect(alert.description).toBeDefined();
        expect(alert.createdAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('設定カスタマイズ', () => {
    it('カスタム設定で初期化できる', () => {
      const customConfig = {
        overtimePrediction: {
          horizonDays: 60,
          alertThresholdHours: 60
        },
        turnoverPrediction: {
          riskThreshold: 70,
          factorWeights: {
            overtime: 0.4,
            attendance: 0.3,
            tenure: 0.2,
            performance: 0.1
          }
        }
      };
      
      const customEngine = new PredictiveAnalyticsEngineV2(mockDb, customConfig);
      expect(customEngine).toBeDefined();
    });
  });
});

// ヘルパー関数
function generateMockTimeRecords(days: number, options?: { overtimeHours?: number }) {
  const records = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - days);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    
    if (date.getDay() === 0 || date.getDay() === 6) continue; // 週末スキップ
    
    const clockIn = new Date(date);
    clockIn.setHours(9, 0, 0, 0);
    
    const clockOut = new Date(date);
    const workHours = 8 + (options?.overtimeHours || 0) / 20; // 月20日で分散
    clockOut.setHours(9 + workHours + 1, 0, 0, 0); // 1時間休憩含む
    
    records.push({
      id: `TR${i}`,
      employeeId: 'EMP001',
      date,
      clockIn,
      clockOut,
      breakMinutes: 60,
      recordType: 'ic_card' as const
    });
  }
  
  return records;
}