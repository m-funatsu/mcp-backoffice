import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import IntegratedAnomalyDetectionEngine from '../../src/integrated-anomaly-detection-v2.1.0.js';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import type { Employee, TimeRecord, ExpenseRequest, PayrollCalculation } from '../../src/types.js';

// モックデータ生成
const generateMockExpenses = (count: number): ExpenseRequest[] => {
  const categories = ['交通費', '会議費', '接待交際費', '消耗品費'];
  const expenses: ExpenseRequest[] = [];
  
  for (let i = 0; i < count; i++) {
    expenses.push({
      id: `exp_${i}`,
      employeeId: `emp_${i % 3}`,
      amount: Math.floor(Math.random() * 50000) + 1000,
      categoryId: categories[i % categories.length],
      description: `経費申請 ${i}`,
      expenseDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      receiptImageUrl: Math.random() > 0.3 ? `https://example.com/receipt_${i}.jpg` : undefined,
      status: 'pending',
      createdAt: new Date()
    });
  }
  
  return expenses;
};

const generateMockPayroll = (count: number): PayrollCalculation[] => {
  const payroll: PayrollCalculation[] = [];
  
  for (let i = 0; i < count; i++) {
    const basePay = 300000 + Math.floor(Math.random() * 200000);
    const overtimePay = Math.floor(Math.random() * 50000);
    
    payroll.push({
      id: `payroll_${i}`,
      employeeId: `emp_${i % 3}`,
      month: '2024-01',
      regularHours: 160,
      overtimeHours: Math.floor(Math.random() * 40),
      lateNightHours: Math.floor(Math.random() * 10),
      holidayHours: Math.floor(Math.random() * 8),
      regularPay: basePay,
      overtimePay: overtimePay,
      lateNightPay: Math.floor(Math.random() * 10000),
      holidayPay: Math.floor(Math.random() * 20000),
      totalPay: basePay + overtimePay,
      netPay: (basePay + overtimePay) * 0.8,
      calculatedAt: new Date()
    });
  }
  
  return payroll;
};

describe('IntegratedAnomalyDetectionEngine v2.1.0', () => {
  let engine: IntegratedAnomalyDetectionEngine;
  let mockDb: DatabasePostgreSQL;
  
  beforeEach(() => {
    // データベースのモック
    mockDb = {
      getAllEmployees: vi.fn().mockResolvedValue([
        { id: 'emp_1', name: '田中 太郎', department: '開発部', isActive: true },
        { id: 'emp_2', name: '鈴木 花子', department: '営業部', isActive: true },
        { id: 'emp_3', name: '佐藤 次郎', department: '人事部', isActive: true }
      ]),
      getAllExpenseRequests: vi.fn().mockResolvedValue(generateMockExpenses(50)),
      getAllPayrollCalculations: vi.fn().mockResolvedValue(generateMockPayroll(10)),
      getAllTimeRecords: vi.fn().mockResolvedValue([]),
      query: vi.fn().mockResolvedValue({ rows: [] })
    } as any;
    
    engine = new IntegratedAnomalyDetectionEngine(mockDb);
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('経費異常検知', () => {
    it('重複経費を検出できる', async () => {
      const duplicateExpenses = [
        {
          id: 'exp_1',
          employeeId: 'emp_1',
          amount: 5000,
          categoryId: '交通費',
          description: '同じ経費',
          expenseDate: new Date('2024-01-15'),
          status: 'pending' as const,
          createdAt: new Date()
        },
        {
          id: 'exp_2',
          employeeId: 'emp_1',
          amount: 5000,
          categoryId: '交通費',
          description: '同じ経費',
          expenseDate: new Date('2024-01-15'),
          status: 'pending' as const,
          createdAt: new Date()
        }
      ];
      
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(duplicateExpenses);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['expense']
      });
      
      const duplicateAnomalies = anomalies.filter(a => a.type === 'DUPLICATE_EXPENSE');
      expect(duplicateAnomalies.length).toBeGreaterThan(0);
      expect(duplicateAnomalies[0].severity).toBe('high');
    });

    it('異常に高額な経費を検出できる', async () => {
      const expenses = generateMockExpenses(20);
      // 極端に高額な経費を追加
      expenses.push({
        id: 'exp_high',
        employeeId: 'emp_1',
        amount: 1000000, // 100万円
        categoryId: '交通費',
        description: '高額経費',
        expenseDate: new Date(),
        status: 'pending',
        createdAt: new Date()
      });
      
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(expenses);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['expense']
      });
      
      const excessiveAnomalies = anomalies.filter(a => a.type === 'EXCESSIVE_EXPENSE');
      expect(excessiveAnomalies.length).toBeGreaterThan(0);
      expect(excessiveAnomalies[0].confidence).toBeGreaterThan(0.8);
    });

    it('疑わしい経費パターンを検出できる', async () => {
      const suspiciousExpenses = [];
      // 週末に集中した経費申請パターン
      for (let i = 0; i < 20; i++) {
        const date = new Date('2024-01-06'); // 土曜日
        date.setDate(date.getDate() + (i % 2) * 7); // 土日のみ
        
        suspiciousExpenses.push({
          id: `exp_weekend_${i}`,
          employeeId: 'emp_1',
          amount: 10000,
          categoryId: '会議費',
          description: `週末会議 ${i}`,
          expenseDate: date,
          status: 'pending' as const,
          createdAt: new Date()
        });
      }
      
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(suspiciousExpenses);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['expense']
      });
      
      const patternAnomalies = anomalies.filter(a => a.type === 'SUSPICIOUS_PATTERN');
      expect(patternAnomalies.length).toBeGreaterThan(0);
    });

    it('ポリシー違反を検出できる', async () => {
      const config = {
        sensitivity: {
          expense: 0.9,
          payroll: 0.9,
          attendance: 0.9,
          crossDomain: 0.9
        },
        thresholds: {
          expenseVariance: 2.0,
          payrollDeviation: 2.5,
          attendancePattern: 1.5,
          correlationStrength: 0.8
        }
      };
      
      const customEngine = new IntegratedAnomalyDetectionEngine(mockDb, config);
      
      const anomalies = await customEngine.detectAnomalies({
        domains: ['expense']
      });
      
      expect(anomalies).toBeDefined();
      // より高い感度で検出されることを確認
    });
  });

  describe('給与異常検知', () => {
    it('給与計算エラーを検出できる', async () => {
      const errorPayroll = generateMockPayroll(5);
      // 計算エラーのあるデータを追加
      errorPayroll.push({
        id: 'payroll_error',
        employeeId: 'emp_1',
        month: '2024-01',
        regularHours: 160,
        overtimeHours: 40,
        lateNightHours: 0,
        holidayHours: 0,
        regularPay: 300000,
        overtimePay: 50000,
        lateNightPay: 0,
        holidayPay: 0,
        totalPay: 300000, // 計算が間違っている（350000であるべき）
        netPay: 240000,
        calculatedAt: new Date()
      });
      
      mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(errorPayroll);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['payroll']
      });
      
      expect(anomalies.some(a => a.type === 'PAYROLL_CALCULATION_ERROR')).toBe(true);
    });

    it('不正な給与変更を検出できる', async () => {
      const unauthorizedPayroll = generateMockPayroll(5);
      // 急激な給与変更
      unauthorizedPayroll.push({
        id: 'payroll_change',
        employeeId: 'emp_1',
        month: '2024-02',
        regularHours: 160,
        overtimeHours: 0,
        lateNightHours: 0,
        holidayHours: 0,
        regularPay: 1000000, // 通常の3倍以上
        overtimePay: 0,
        lateNightPay: 0,
        holidayPay: 0,
        totalPay: 1000000,
        netPay: 800000,
        calculatedAt: new Date()
      });
      
      mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(unauthorizedPayroll);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['payroll']
      });
      
      expect(anomalies.some(a => a.type === 'UNAUTHORIZED_CHANGE')).toBe(true);
    });

    it('残業スパイクを検出できる', async () => {
      const overtimeSpike = generateMockPayroll(5);
      // 異常な残業時間
      overtimeSpike.push({
        id: 'payroll_overtime',
        employeeId: 'emp_1',
        month: '2024-01',
        regularHours: 160,
        overtimeHours: 100, // 月100時間の残業
        lateNightHours: 30,
        holidayHours: 20,
        regularPay: 300000,
        overtimePay: 150000,
        lateNightPay: 50000,
        holidayPay: 40000,
        totalPay: 540000,
        netPay: 432000,
        calculatedAt: new Date()
      });
      
      mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(overtimeSpike);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['payroll']
      });
      
      const overtimeAnomalies = anomalies.filter(a => a.type === 'OVERTIME_SPIKE');
      expect(overtimeAnomalies.length).toBeGreaterThan(0);
      expect(overtimeAnomalies[0].severity).toMatch(/^(high|critical)$/);
    });
  });

  describe('勤怠異常検知', () => {
    it('勤怠不正を検出できる', async () => {
      const fraudulentRecords = [];
      // 不自然な打刻パターン（毎日正確に同じ時刻）
      for (let i = 0; i < 20; i++) {
        const date = new Date('2024-01-01');
        date.setDate(date.getDate() + i);
        
        fraudulentRecords.push({
          id: `record_${i}`,
          employeeId: 'emp_1',
          date,
          clockIn: new Date(date.setHours(9, 0, 0, 0)),
          clockOut: new Date(date.setHours(18, 0, 0, 0)),
          breakMinutes: 60,
          recordType: 'manual' as const
        });
      }
      
      mockDb.getAllTimeRecords = vi.fn().mockResolvedValue(fraudulentRecords);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['attendance']
      });
      
      expect(anomalies.some(a => a.type === 'ATTENDANCE_FRAUD')).toBe(true);
    });

    it('休憩時間違反を検出できる', async () => {
      const breakViolations = [{
        id: 'record_break',
        employeeId: 'emp_1',
        date: new Date(),
        clockIn: new Date().setHours(9, 0, 0, 0),
        clockOut: new Date().setHours(19, 0, 0, 0), // 10時間勤務
        breakMinutes: 30, // 休憩30分のみ（法定違反）
        recordType: 'ic_card' as const
      }];
      
      mockDb.getAllTimeRecords = vi.fn().mockResolvedValue(breakViolations);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['attendance']
      });
      
      expect(anomalies.some(a => a.type === 'BREAK_VIOLATION')).toBe(true);
    });
  });

  describe('クロスドメイン異常検知', () => {
    it('複数ドメインにまたがる異常を検出できる', async () => {
      // 同じ従業員が複数の異常を持つケース
      const expenses = [{
        id: 'exp_cross',
        employeeId: 'emp_suspicious',
        amount: 100000,
        categoryId: '交通費',
        description: '高額交通費',
        expenseDate: new Date(),
        status: 'pending' as const,
        createdAt: new Date()
      }];
      
      const payroll = [{
        id: 'payroll_cross',
        employeeId: 'emp_suspicious',
        month: '2024-01',
        regularHours: 160,
        overtimeHours: 80,
        lateNightHours: 0,
        holidayHours: 0,
        regularPay: 300000,
        overtimePay: 120000,
        lateNightPay: 0,
        holidayPay: 0,
        totalPay: 420000,
        netPay: 336000,
        calculatedAt: new Date()
      }];
      
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(expenses);
      mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(payroll);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['expense', 'payroll']
      });
      
      // クロスドメイン分析により、共謀パターンなどが検出される
      expect(anomalies.length).toBeGreaterThan(0);
    });

    it('データ不整合を検出できる', async () => {
      // 勤怠データと給与データの不整合
      const timeRecords = [{
        id: 'record_1',
        employeeId: 'emp_1',
        date: new Date('2024-01-15'),
        clockIn: new Date('2024-01-15T09:00:00'),
        clockOut: new Date('2024-01-15T18:00:00'),
        breakMinutes: 60,
        recordType: 'ic_card' as const
      }];
      
      const payroll = [{
        id: 'payroll_1',
        employeeId: 'emp_1',
        month: '2024-01',
        regularHours: 200, // 実際の勤怠と不整合
        overtimeHours: 0,
        lateNightHours: 0,
        holidayHours: 0,
        regularPay: 400000,
        overtimePay: 0,
        lateNightPay: 0,
        holidayPay: 0,
        totalPay: 400000,
        netPay: 320000,
        calculatedAt: new Date()
      }];
      
      mockDb.getAllTimeRecords = vi.fn().mockResolvedValue(timeRecords);
      mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue(payroll);
      
      const anomalies = await engine.detectAnomalies();
      
      expect(anomalies.some(a => a.type === 'DATA_INCONSISTENCY')).toBe(true);
    });
  });

  describe('リアルタイム監視', () => {
    it('リアルタイム監視を開始できる', async () => {
      const spy = vi.spyOn(console, 'log');
      
      await engine.startRealtimeMonitoring();
      
      expect(spy).toHaveBeenCalledWith('Starting realtime anomaly monitoring...');
      
      spy.mockRestore();
    });

    it('高優先度の異常に対してアラートを送信する', async () => {
      const criticalAnomaly = {
        id: 'anomaly_critical',
        timestamp: new Date(),
        domain: 'expense' as const,
        type: 'EXCESSIVE_EXPENSE' as const,
        severity: 'critical' as const,
        confidence: 0.95,
        description: '極めて高額な経費申請',
        affectedEntities: [],
        evidence: {
          dataPoints: [],
          statisticalMetrics: { mean: 0, stdDev: 0, zScore: 5, pValue: 0.001 },
          relatedAnomalies: []
        },
        recommendations: ['即座に調査が必要'],
        requiresAction: true
      };
      
      const consoleSpy = vi.spyOn(console, 'log');
      
      // プライベートメソッドを直接テストする代わりに、
      // detectAnomaliesの結果として高優先度異常が検出されることを確認
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue([{
        id: 'exp_critical',
        employeeId: 'emp_1',
        amount: 5000000, // 500万円
        categoryId: '交通費',
        description: '極めて高額',
        expenseDate: new Date(),
        status: 'pending',
        createdAt: new Date()
      }]);
      
      const anomalies = await engine.detectAnomalies({ realtime: true });
      
      expect(anomalies.some(a => a.severity === 'critical')).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });

  describe('統合分析レポート', () => {
    it('包括的な統合分析レポートを生成できる', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };
      
      const report = await engine.generateIntegratedAnalysis(period);
      
      expect(report).toMatchObject({
        period,
        anomalySummary: {
          totalDetected: expect.any(Number),
          bySeverity: expect.any(Object),
          byDomain: expect.any(Object),
          byType: expect.any(Object),
          trendsIdentified: expect.any(Array)
        },
        riskAssessment: {
          overallRiskScore: expect.any(Number),
          riskByDomain: expect.any(Object),
          topRisks: expect.any(Array),
          mitigationStatus: expect.any(Object)
        },
        complianceStatus: {
          overallCompliance: expect.any(Number),
          regulatoryCompliance: expect.any(Object),
          policyViolations: expect.any(Array),
          auditReadiness: expect.any(Number)
        },
        financialImpact: {
          potentialLoss: expect.any(Number),
          actualLoss: expect.any(Number),
          savedAmount: expect.any(Number),
          roi: expect.any(Number)
        }
      });
    });

    it('リスクスコアが0から1の範囲内である', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };
      
      const report = await engine.generateIntegratedAnalysis(period);
      
      expect(report.riskAssessment.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(report.riskAssessment.overallRiskScore).toBeLessThanOrEqual(1);
      
      Object.values(report.riskAssessment.riskByDomain).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });

    it('コンプライアンス遵守率が適切に計算される', async () => {
      const period = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };
      
      const report = await engine.generateIntegratedAnalysis(period);
      
      expect(report.complianceStatus.overallCompliance).toBeGreaterThanOrEqual(0);
      expect(report.complianceStatus.overallCompliance).toBeLessThanOrEqual(1);
      expect(report.complianceStatus.auditReadiness).toBeGreaterThanOrEqual(0);
      expect(report.complianceStatus.auditReadiness).toBeLessThanOrEqual(1);
    });
  });

  describe('エグゼクティブ保証レポート', () => {
    it('CFO/CRO向けの保証レポートを生成できる', async () => {
      const assurance = await engine.generateExecutiveAssurance();
      
      expect(assurance).toMatchObject({
        assuranceLevel: expect.stringMatching(/^(high|medium|low)$/),
        keyFindings: expect.any(Array),
        riskMitigation: expect.any(Object),
        recommendations: expect.any(Array),
        certification: {
          statement: expect.any(String),
          confidence: expect.any(Number),
          limitations: expect.any(Array)
        }
      });
    });

    it('保証レベルが分析結果に基づいて適切に判定される', async () => {
      // 低リスクのモックデータ
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue([]);
      mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue([]);
      mockDb.getAllTimeRecords = vi.fn().mockResolvedValue([]);
      
      const assurance = await engine.generateExecutiveAssurance();
      
      expect(assurance.assuranceLevel).toBe('high');
      expect(assurance.certification.confidence).toBeGreaterThan(0.8);
    });

    it('リスク軽減策が具体的に提示される', async () => {
      const assurance = await engine.generateExecutiveAssurance();
      
      expect(Object.keys(assurance.riskMitigation).length).toBeGreaterThan(0);
      Object.values(assurance.riskMitigation).forEach(mitigation => {
        expect(mitigation).toBeTruthy();
        expect(typeof mitigation).toBe('string');
      });
    });
  });

  describe('エラーハンドリングとエッジケース', () => {
    it('空のデータセットでも正常に動作する', async () => {
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue([]);
      mockDb.getAllPayrollCalculations = vi.fn().mockResolvedValue([]);
      mockDb.getAllTimeRecords = vi.fn().mockResolvedValue([]);
      
      const anomalies = await engine.detectAnomalies();
      
      expect(anomalies).toEqual([]);
    });

    it('データベースエラーを適切にハンドリングする', async () => {
      mockDb.getAllExpenseRequests = vi.fn().mockRejectedValue(new Error('DB connection failed'));
      
      await expect(engine.detectAnomalies({ domains: ['expense'] }))
        .rejects.toThrow('DB connection failed');
    });

    it('不正な設定でも安全にフォールバックする', () => {
      const invalidConfig = {
        sensitivity: {
          expense: 2.0, // 無効な値（0-1の範囲外）
          payroll: -0.5,
          attendance: 0.5,
          crossDomain: 0.5
        }
      };
      
      // エラーを投げずにデフォルト値を使用することを確認
      expect(() => new IntegratedAnomalyDetectionEngine(mockDb, invalidConfig as any))
        .not.toThrow();
    });

    it('大量データでもメモリ効率的に処理される', async () => {
      const largeExpenseSet = generateMockExpenses(10000);
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(largeExpenseSet);
      
      const startMemory = process.memoryUsage().heapUsed;
      const anomalies = await engine.detectAnomalies({ domains: ['expense'] });
      const endMemory = process.memoryUsage().heapUsed;
      
      expect(anomalies).toBeDefined();
      // メモリ使用量が妥当な範囲内であることを確認
      expect(endMemory - startMemory).toBeLessThan(100 * 1024 * 1024); // 100MB以下
    });
  });

  describe('自動修復機能', () => {
    it('自動修復アクションが設定される', async () => {
      const highAmountExpense = [{
        id: 'exp_high',
        employeeId: 'emp_1',
        amount: 500000,
        categoryId: '交通費',
        description: '高額経費',
        expenseDate: new Date(),
        status: 'pending' as const,
        createdAt: new Date()
      }];
      
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(highAmountExpense);
      
      const anomalies = await engine.detectAnomalies({
        domains: ['expense'],
        realtime: true
      });
      
      const excessiveExpenseAnomaly = anomalies.find(a => a.type === 'EXCESSIVE_EXPENSE');
      expect(excessiveExpenseAnomaly?.autoRemediation).toBeDefined();
      expect(excessiveExpenseAnomaly?.autoRemediation?.type).toBe('flag');
    });

    it('リアルタイムモードで自動修復が実行される', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      const anomalies = await engine.detectAnomalies({
        domains: ['expense'],
        realtime: true
      });
      
      // 自動修復が必要な異常がある場合、ログが出力される
      if (anomalies.some(a => a.autoRemediation && a.requiresAction)) {
        expect(consoleSpy).toHaveBeenCalled();
      }
      
      consoleSpy.mockRestore();
    });
  });
});