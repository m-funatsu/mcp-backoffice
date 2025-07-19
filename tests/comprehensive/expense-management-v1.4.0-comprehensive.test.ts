import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExpenseManagementEngine from '../../src/expense-management-v1.4.0.js';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import type { Employee, ExpenseRequest, ApprovalRiskAssessment } from '../../src/types.js';

// グローバルfetchのモック
global.fetch = vi.fn();

describe('v1.4.0 経費管理エンジン - 網羅的テスト', () => {
  let engine: ExpenseManagementEngine;
  let mockDb: DatabasePostgreSQL;
  let testEmployee: Employee;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getEmployee: vi.fn(),
      getAllEmployees: vi.fn(),
      getExpenseRequests: vi.fn(),
      getAllExpenseRequests: vi.fn(),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn()
    } as any;

    engine = new ExpenseManagementEngine(mockDb);

    testEmployee = {
      id: 'emp001',
      name: '山田太郎',
      email: 'yamada@example.com',
      department: '営業部',
      position: 'マネージャー',
      hourlyWage: 4000,
      startDate: '2020-04-01',
      isActive: true,
      managerId: 'mgr001'
    };
  });

  describe('レシート画像処理', () => {
    describe('OCR処理', () => {
      it('鮮明な画像から正確にテキストを抽出する', async () => {
        const mockImageBuffer = Buffer.from('mock-image-data');
        const mockOCRResponse = {
          text: 'ローソン\n2024年1月15日\nコーヒー ¥150\n合計 ¥150',
          confidence: 0.95,
          blocks: [
            { text: 'ローソン', confidence: 0.98 },
            { text: '2024年1月15日', confidence: 0.96 },
            { text: 'コーヒー ¥150', confidence: 0.94 },
            { text: '合計 ¥150', confidence: 0.95 }
          ]
        };

        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockOCRResponse
        });

        const result = await engine.processReceiptImage(mockImageBuffer);

        expect(result.extractedText).toContain('ローソン');
        expect(result.extractedText).toContain('¥150');
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.extractedData.amount).toBe(150);
        expect(result.extractedData.date).toEqual(new Date('2024-01-15'));
      });

      it('複数の金額から合計金額を正確に抽出する', async () => {
        const mockOCRResponse = {
          text: 'レストラン ABC\n商品A ¥1,200\n商品B ¥800\n小計 ¥2,000\n消費税 ¥200\n合計 ¥2,200',
          confidence: 0.92
        };

        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockOCRResponse
        });

        const result = await engine.processReceiptImage(Buffer.from('test'));

        expect(result.extractedData.amount).toBe(2200);
        expect(result.extractedData.items).toHaveLength(2);
        expect(result.extractedData.taxAmount).toBe(200);
      });

      it('画質が悪い画像でも可能な限り情報を抽出する', async () => {
        const mockOCRResponse = {
          text: 'ス□□ー\n202□年□月□5日\n□□□ ¥5□0',
          confidence: 0.65,
          warnings: ['Low image quality detected']
        };

        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockOCRResponse
        });

        const result = await engine.processReceiptImage(Buffer.from('test'));

        expect(result.confidence).toBeLessThan(0.7);
        expect(result.extractedData.vendor).toContain('ス');
        expect(result.extractedData.amount).toBe(500); // 部分的に読み取れた金額
        expect(result.warnings).toContain('Low confidence OCR result');
      });

      it('手書きレシートを処理する', async () => {
        const mockOCRResponse = {
          text: '領収書\n山田商店\n2024/1/15\n¥3,000-\n但 タクシー代として',
          confidence: 0.78,
          isHandwritten: true
        };

        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockOCRResponse
        });

        const result = await engine.processReceiptImage(Buffer.from('test'));

        expect(result.extractedData.amount).toBe(3000);
        expect(result.extractedData.vendor).toBe('山田商店');
        expect(result.extractedData.description).toContain('タクシー代');
        expect(result.metadata.isHandwritten).toBe(true);
      });
    });

    describe('カテゴリ推定', () => {
      it('店舗名から適切なカテゴリを推定する', async () => {
        const testCases = [
          { vendor: 'JR東日本', expectedCategory: '交通費' },
          { vendor: 'セブンイレブン', expectedCategory: '消耗品費' },
          { vendor: 'ヒルトンホテル', expectedCategory: '宿泊費' },
          { vendor: '紀伊國屋書店', expectedCategory: '図書費' },
          { vendor: 'スターバックス', expectedCategory: '会議費' }
        ];

        for (const testCase of testCases) {
          (fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              text: `${testCase.vendor}\n合計 ¥1,000`,
              confidence: 0.9
            })
          });

          const result = await engine.processReceiptImage(Buffer.from('test'));
          expect(result.extractedData.category).toBe(testCase.expectedCategory);
        }
      });

      it('商品内容からカテゴリを推定する', async () => {
        const mockOCRResponse = {
          text: '店名不明\nガソリン レギュラー 40L\n¥6,000',
          confidence: 0.85
        };

        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockOCRResponse
        });

        const result = await engine.processReceiptImage(Buffer.from('test'));
        expect(result.extractedData.category).toBe('交通費');
      });

      it('複数の手がかりを組み合わせてカテゴリを決定する', async () => {
        const mockOCRResponse = {
          text: 'レストラン\n顧客A様、B様\nランチミーティング\n¥5,400',
          confidence: 0.9
        };

        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockOCRResponse
        });

        const result = await engine.processReceiptImage(Buffer.from('test'));
        expect(result.extractedData.category).toBe('接待交際費');
      });
    });

    describe('画像品質評価', () => {
      it('画像品質スコアを算出する', async () => {
        const mockOCRResponse = {
          text: '明確なテキスト',
          confidence: 0.95,
          imageQuality: {
            sharpness: 0.9,
            contrast: 0.85,
            brightness: 0.8,
            resolution: 1200
          }
        };

        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockOCRResponse
        });

        const result = await engine.processReceiptImage(Buffer.from('test'));
        expect(result.qualityScore).toBeGreaterThan(0.8);
        expect(result.isAcceptableQuality).toBe(true);
      });

      it('低品質画像に対して再撮影を推奨する', async () => {
        const mockOCRResponse = {
          text: '不鮮明',
          confidence: 0.45,
          imageQuality: {
            sharpness: 0.3,
            contrast: 0.4,
            brightness: 0.5
          }
        };

        (fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockOCRResponse
        });

        const result = await engine.processReceiptImage(Buffer.from('test'));
        expect(result.qualityScore).toBeLessThan(0.5);
        expect(result.isAcceptableQuality).toBe(false);
        expect(result.recommendations).toContain('画像を再撮影してください');
      });
    });
  });

  describe('自然言語入力処理', () => {
    it('シンプルな経費申請を解析する', async () => {
      const input = '昨日の新幹線代15,000円を申請します';
      
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      
      const result = await engine.createExpenseFromNLInput('emp001', input);

      expect(result.amount).toBe(15000);
      expect(result.categoryId).toBe('交通費');
      expect(result.description).toContain('新幹線代');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(result.expenseDate.toDateString()).toBe(yesterday.toDateString());
    });

    it('複雑な文章から複数の情報を抽出する', async () => {
      const input = '先週の金曜日に大阪出張で使った新幹線往復28,000円とホテル代12,000円、それと顧客との会食8,500円をまとめて申請したいです';
      
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      
      // 複数の経費として解析される想定
      const result = await engine.createExpenseFromNLInput('emp001', input);

      // 最初の経費項目として新幹線代が作成される
      expect(result.amount).toBe(28000);
      expect(result.categoryId).toBe('交通費');
      expect(result.metadata?.additionalExpenses).toHaveLength(2);
      expect(result.metadata?.additionalExpenses[0].amount).toBe(12000);
      expect(result.metadata?.additionalExpenses[0].category).toBe('宿泊費');
      expect(result.metadata?.additionalExpenses[1].amount).toBe(8500);
      expect(result.metadata?.additionalExpenses[1].category).toBe('接待交際費');
    });

    it('曖昧な日付表現を正確に解釈する', async () => {
      const testCases = [
        { input: '今日のランチ代1,200円', expectedDate: new Date() },
        { input: '先月末の出張費', expectedDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 28) },
        { input: '今週月曜日の交通費', expectedDate: getMondayOfThisWeek() },
        { input: '3日前のタクシー代', expectedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) }
      ];

      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

      for (const testCase of testCases) {
        const result = await engine.createExpenseFromNLInput('emp001', testCase.input + ' 1000円');
        expect(result.expenseDate.toDateString()).toBe(testCase.expectedDate.toDateString());
      }
    });

    it('金額の様々な表記を正規化する', async () => {
      const testCases = [
        { input: '1,000円', expected: 1000 },
        { input: '￥5000', expected: 5000 },
        { input: '3万円', expected: 30000 },
        { input: '15千円', expected: 15000 },
        { input: '2.5万', expected: 25000 }
      ];

      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

      for (const testCase of testCases) {
        const result = await engine.createExpenseFromNLInput('emp001', `交通費${testCase.input}`);
        expect(result.amount).toBe(testCase.expected);
      }
    });

    it('不明瞭な入力に対して確認を求める', async () => {
      const input = 'この前の経費を申請';
      
      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      
      await expect(engine.createExpenseFromNLInput('emp001', input))
        .rejects.toThrow('金額が指定されていません');
    });
  });

  describe('スマート承認リスク評価', () => {
    describe('リスクスコア計算', () => {
      it('低リスクの経費申請を識別する', async () => {
        const expense: ExpenseRequest = {
          id: 'exp001',
          employeeId: 'emp001',
          amount: 1500,
          categoryId: '交通費',
          description: '顧客訪問の電車代',
          expenseDate: new Date(),
          status: 'pending',
          createdAt: new Date()
        };

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.getExpenseRequests = vi.fn().mockResolvedValue([
          { amount: 1000, categoryId: '交通費', status: 'approved' },
          { amount: 2000, categoryId: '交通費', status: 'approved' }
        ]);

        const risk = await engine.evaluateApprovalRisk(expense);

        expect(risk.riskScore).toBeLessThan(0.3);
        expect(risk.riskLevel).toBe('low');
        expect(risk.autoApprovalRecommended).toBe(true);
      });

      it('高額経費に高リスクスコアを付与する', async () => {
        const expense: ExpenseRequest = {
          id: 'exp002',
          employeeId: 'emp001',
          amount: 150000, // 15万円
          categoryId: '接待交際費',
          description: '重要顧客との会食',
          expenseDate: new Date(),
          status: 'pending',
          createdAt: new Date()
        };

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.getExpenseRequests = vi.fn().mockResolvedValue([]);

        const risk = await engine.evaluateApprovalRisk(expense);

        expect(risk.riskScore).toBeGreaterThan(0.7);
        expect(risk.riskLevel).toBe('high');
        expect(risk.autoApprovalRecommended).toBe(false);
        expect(risk.riskFactors).toContain('高額経費');
      });

      it('異常なパターンを検出する', async () => {
        const expense: ExpenseRequest = {
          id: 'exp003',
          employeeId: 'emp001',
          amount: 5000,
          categoryId: '交通費',
          description: 'タクシー代',
          expenseDate: new Date('2024-01-14'), // 日曜日
          status: 'pending',
          createdAt: new Date()
        };

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        // 過去の履歴：週末の申請なし
        mockDb.getExpenseRequests = vi.fn().mockResolvedValue(
          Array(20).fill(null).map((_, i) => ({
            amount: 3000,
            categoryId: '交通費',
            expenseDate: new Date(2024, 0, i + 1), // 平日のみ
            status: 'approved'
          }))
        );

        const risk = await engine.evaluateApprovalRisk(expense);

        expect(risk.riskFactors).toContain('週末の経費申請');
        expect(risk.anomalyScore).toBeGreaterThan(0.5);
      });

      it('頻繁な申請パターンを異常として検出する', async () => {
        const expense: ExpenseRequest = {
          id: 'exp004',
          employeeId: 'emp001',
          amount: 2000,
          categoryId: '会議費',
          description: 'コーヒー代',
          expenseDate: new Date(),
          status: 'pending',
          createdAt: new Date()
        };

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        // 同じカテゴリで頻繁な申請
        mockDb.getExpenseRequests = vi.fn().mockResolvedValue(
          Array(15).fill(null).map((_, i) => ({
            amount: 1500 + Math.random() * 1000,
            categoryId: '会議費',
            expenseDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            status: 'approved'
          }))
        );

        const risk = await engine.evaluateApprovalRisk(expense);

        expect(risk.riskFactors).toContain('申請頻度が高い');
        expect(risk.frequencyScore).toBeGreaterThan(0.7);
      });
    });

    describe('承認推奨判定', () => {
      it('信頼度の高い従業員の申請を優遇する', async () => {
        const trustedEmployee = {
          ...testEmployee,
          employmentYears: 5,
          position: 'シニアマネージャー'
        };

        const expense: ExpenseRequest = {
          id: 'exp005',
          employeeId: 'emp001',
          amount: 30000,
          categoryId: '出張費',
          description: '定期的な支社訪問',
          expenseDate: new Date(),
          status: 'pending',
          createdAt: new Date()
        };

        mockDb.getEmployee = vi.fn().mockResolvedValue(trustedEmployee);
        mockDb.getExpenseRequests = vi.fn().mockResolvedValue(
          Array(50).fill(null).map(() => ({
            amount: 25000 + Math.random() * 10000,
            categoryId: '出張費',
            status: 'approved'
          }))
        );

        const risk = await engine.evaluateApprovalRisk(expense);

        expect(risk.employeeTrustScore).toBeGreaterThan(0.8);
        expect(risk.riskScore).toBeLessThan(0.5); // 信頼度が高いため全体リスクは低い
      });

      it('新入社員の高額申請に慎重な評価を行う', async () => {
        const newEmployee = {
          ...testEmployee,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 1ヶ月前入社
        };

        const expense: ExpenseRequest = {
          id: 'exp006',
          employeeId: 'emp001',
          amount: 50000,
          categoryId: '接待交際費',
          description: '顧客接待',
          expenseDate: new Date(),
          status: 'pending',
          createdAt: new Date()
        };

        mockDb.getEmployee = vi.fn().mockResolvedValue(newEmployee);
        mockDb.getExpenseRequests = vi.fn().mockResolvedValue([]);

        const risk = await engine.evaluateApprovalRisk(expense);

        expect(risk.employeeTrustScore).toBeLessThan(0.5);
        expect(risk.riskLevel).toBe('high');
        expect(risk.requiredApprovalLevel).toBe('senior_manager');
      });
    });

    describe('不正検知', () => {
      it('重複申請を検出する', async () => {
        const expense: ExpenseRequest = {
          id: 'exp007',
          employeeId: 'emp001',
          amount: 5000,
          categoryId: '交通費',
          description: '新幹線代（東京-大阪）',
          expenseDate: new Date('2024-01-15'),
          status: 'pending',
          createdAt: new Date()
        };

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        mockDb.getExpenseRequests = vi.fn().mockResolvedValue([
          {
            amount: 5000,
            categoryId: '交通費',
            description: '新幹線（東京→大阪）',
            expenseDate: new Date('2024-01-15'),
            status: 'approved'
          }
        ]);

        const risk = await engine.evaluateApprovalRisk(expense);

        expect(risk.riskLevel).toBe('critical');
        expect(risk.fraudIndicators).toContain('重複申請の可能性');
        expect(risk.autoApprovalRecommended).toBe(false);
        expect(risk.requiredApprovalLevel).toBe('manual_review');
      });

      it('金額の改ざんパターンを検出する', async () => {
        const expense: ExpenseRequest = {
          id: 'exp008',
          employeeId: 'emp001',
          amount: 19900, // 端数が不自然
          categoryId: '消耗品費',
          description: '事務用品',
          expenseDate: new Date(),
          receiptImageUrl: 'receipt.jpg',
          status: 'pending',
          createdAt: new Date()
        };

        // OCRで異なる金額を検出
        mockDb.query = vi.fn().mockResolvedValue({
          rows: [{
            ocr_amount: 1990,
            confidence: 0.95
          }]
        });

        mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
        const risk = await engine.evaluateApprovalRisk(expense);

        expect(risk.fraudIndicators).toContain('レシート金額との不一致');
        expect(risk.riskLevel).toBe('critical');
      });
    });
  });

  describe('会計仕訳自動生成', () => {
    it('経費カテゴリに応じた正確な仕訳を生成する', async () => {
      const testCases = [
        {
          expense: { categoryId: '交通費', amount: 1000 },
          expected: { debit: '旅費交通費', credit: '未払金' }
        },
        {
          expense: { categoryId: '接待交際費', amount: 5000 },
          expected: { debit: '接待交際費', credit: '未払金' }
        },
        {
          expense: { categoryId: '消耗品費', amount: 3000 },
          expected: { debit: '消耗品費', credit: '未払金' }
        }
      ];

      for (const testCase of testCases) {
        const expense: ExpenseRequest = {
          id: 'exp_test',
          employeeId: 'emp001',
          amount: testCase.expense.amount,
          categoryId: testCase.expense.categoryId,
          description: 'テスト',
          expenseDate: new Date(),
          status: 'approved',
          createdAt: new Date()
        };

        const entry = await engine.generateAccountingEntry(expense);

        expect(entry.debitAccount.code).toBe(testCase.expected.debit);
        expect(entry.creditAccount.code).toBe(testCase.expected.credit);
        expect(entry.amount).toBe(testCase.expense.amount);
      });
    });

    it('消費税を正確に計算して仕訳を生成する', async () => {
      const expense: ExpenseRequest = {
        id: 'exp009',
        employeeId: 'emp001',
        amount: 11000, // 税込み
        categoryId: '会議費',
        description: 'レストラン会議',
        expenseDate: new Date(),
        status: 'approved',
        createdAt: new Date(),
        metadata: { includesTax: true }
      };

      const entry = await engine.generateAccountingEntry(expense);

      expect(entry.amount).toBe(10000); // 税抜き金額
      expect(entry.taxAmount).toBe(1000); // 消費税
      expect(entry.taxAccount).toEqual({
        code: '仮払消費税',
        name: '仮払消費税',
        type: 'asset'
      });
    });

    it('前払い費用の仕訳を生成する', async () => {
      const expense: ExpenseRequest = {
        id: 'exp010',
        employeeId: 'emp001',
        amount: 120000,
        categoryId: '保険料',
        description: '年間保険料',
        expenseDate: new Date(),
        status: 'approved',
        createdAt: new Date(),
        metadata: { 
          prepaidMonths: 12,
          startDate: new Date('2024-01-01')
        }
      };

      const entry = await engine.generateAccountingEntry(expense);

      expect(entry.debitAccount.code).toBe('前払費用');
      expect(entry.monthlyAmortization).toBe(10000);
      expect(entry.amortizationPeriod).toBe(12);
    });
  });

  describe('経費分析レポート生成', () => {
    it('部門別・カテゴリ別の集計を行う', async () => {
      const expenses = generateMockExpenses(100);
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(expenses);
      mockDb.getAllEmployees = vi.fn().mockResolvedValue([
        { ...testEmployee, department: '営業部' },
        { id: 'emp002', department: '開発部' },
        { id: 'emp003', department: '人事部' }
      ]);

      const report = await engine.generateExpenseAnalytics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      });

      expect(report.summary.totalAmount).toBeGreaterThan(0);
      expect(report.byDepartment).toHaveProperty('営業部');
      expect(report.byDepartment).toHaveProperty('開発部');
      expect(report.byCategory).toHaveProperty('交通費');
      expect(report.trends.monthOverMonth).toBeDefined();
    });

    it('異常値と外れ値を検出する', async () => {
      const expenses = [
        ...generateMockExpenses(50, { maxAmount: 5000 }),
        {
          id: 'outlier1',
          employeeId: 'emp001',
          amount: 500000, // 異常に高額
          categoryId: '交通費',
          expenseDate: new Date(),
          status: 'approved',
          createdAt: new Date()
        }
      ];

      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(expenses);
      mockDb.getAllEmployees = vi.fn().mockResolvedValue([testEmployee]);

      const report = await engine.generateExpenseAnalytics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      });

      expect(report.anomalies).toHaveLength(1);
      expect(report.anomalies[0].expenseId).toBe('outlier1');
      expect(report.anomalies[0].reason).toContain('異常値');
    });

    it('予算比較と予測を行う', async () => {
      const expenses = generateMockExpenses(90, { 
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31')
      });

      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(expenses);
      mockDb.query = vi.fn().mockResolvedValue({
        rows: [
          { department: '営業部', category: '交通費', monthly_budget: 500000 },
          { department: '営業部', category: '接待交際費', monthly_budget: 300000 }
        ]
      });

      const report = await engine.generateExpenseAnalytics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        includeBudgetAnalysis: true
      });

      expect(report.budgetAnalysis).toBeDefined();
      expect(report.budgetAnalysis?.utilizationRate).toBeGreaterThan(0);
      expect(report.predictions?.nextMonthEstimate).toBeGreaterThan(0);
    });
  });

  describe('エラーハンドリング', () => {
    it('OCRサービスのエラーを適切に処理する', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('OCR service unavailable'));

      await expect(engine.processReceiptImage(Buffer.from('test')))
        .rejects.toThrow('OCR processing failed');
    });

    it('無効な画像形式を検出する', async () => {
      const invalidImage = Buffer.from('not-an-image');

      await expect(engine.processReceiptImage(invalidImage))
        .rejects.toThrow('Invalid image format');
    });

    it('データベースエラーを処理する', async () => {
      mockDb.getEmployee = vi.fn().mockRejectedValue(new Error('DB connection lost'));

      await expect(engine.createExpenseFromNLInput('emp001', 'test'))
        .rejects.toThrow('DB connection lost');
    });

    it('不正な経費データを検証する', async () => {
      const invalidExpense: ExpenseRequest = {
        id: 'exp_invalid',
        employeeId: 'emp001',
        amount: -1000, // 負の金額
        categoryId: '交通費',
        description: '',
        expenseDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 未来の日付
        status: 'pending',
        createdAt: new Date()
      };

      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

      const risk = await engine.evaluateApprovalRisk(invalidExpense);
      
      expect(risk.riskLevel).toBe('critical');
      expect(risk.validationErrors).toContain('無効な金額');
      expect(risk.validationErrors).toContain('未来の日付');
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量の画像を並列処理する', async () => {
      const images = Array(20).fill(null).map(() => Buffer.from('image-data'));
      
      (fetch as any).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              text: 'テスト ¥1,000',
              confidence: 0.9
            })
          }), 50)
        )
      );

      const startTime = Date.now();
      const results = await Promise.all(
        images.map(img => engine.processReceiptImage(img))
      );
      const endTime = Date.now();

      expect(results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
    });

    it('1000件の経費データ分析を10秒以内に完了する', async () => {
      const expenses = generateMockExpenses(1000);
      mockDb.getAllExpenseRequests = vi.fn().mockResolvedValue(expenses);
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(
        Array(50).fill(null).map((_, i) => ({
          ...testEmployee,
          id: `emp${String(i).padStart(3, '0')}`,
          department: ['営業部', '開発部', '人事部'][i % 3]
        }))
      );

      const startTime = Date.now();
      const report = await engine.generateExpenseAnalytics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      });
      const endTime = Date.now();

      expect(report.summary.totalExpenses).toBe(1000);
      expect(endTime - startTime).toBeLessThan(10000);
    });
  });

  describe('特殊ケース', () => {
    it('多通貨の経費を処理する', async () => {
      const expense: ExpenseRequest = {
        id: 'exp_foreign',
        employeeId: 'emp001',
        amount: 100,
        categoryId: '海外出張費',
        description: '米国出張の宿泊費',
        expenseDate: new Date(),
        status: 'pending',
        createdAt: new Date(),
        metadata: {
          currency: 'USD',
          exchangeRate: 150,
          originalAmount: 100
        }
      };

      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);

      const risk = await engine.evaluateApprovalRisk(expense);
      const entry = await engine.generateAccountingEntry(expense);

      expect(risk.requiresExchangeRateVerification).toBe(true);
      expect(entry.amount).toBe(15000); // 100 USD × 150
      expect(entry.metadata.currency).toBe('USD');
    });

    it('分割払いの経費を処理する', async () => {
      const expense: ExpenseRequest = {
        id: 'exp_split',
        employeeId: 'emp001',
        amount: 300000,
        categoryId: '研修費',
        description: '年間研修プログラム',
        expenseDate: new Date(),
        status: 'approved',
        createdAt: new Date(),
        metadata: {
          paymentMethod: 'installment',
          installments: 12,
          monthlyAmount: 25000
        }
      };

      const entry = await engine.generateAccountingEntry(expense);

      expect(entry.installmentSchedule).toHaveLength(12);
      expect(entry.installmentSchedule[0].amount).toBe(25000);
    });

    it('グループ申請を処理する', async () => {
      const groupExpense: ExpenseRequest = {
        id: 'exp_group',
        employeeId: 'emp001',
        amount: 24000,
        categoryId: '会議費',
        description: 'チーム懇親会（8名分）',
        expenseDate: new Date(),
        status: 'pending',
        createdAt: new Date(),
        metadata: {
          isGroupExpense: true,
          participants: ['emp001', 'emp002', 'emp003', 'emp004', 'emp005', 'emp006', 'emp007', 'emp008'],
          perPersonAmount: 3000
        }
      };

      mockDb.getEmployee = vi.fn().mockResolvedValue(testEmployee);
      mockDb.getAllEmployees = vi.fn().mockResolvedValue(
        groupExpense.metadata.participants.map(id => ({ id, department: '営業部' }))
      );

      const risk = await engine.evaluateApprovalRisk(groupExpense);

      expect(risk.groupExpenseValidation).toBe('valid');
      expect(risk.perPersonAmountCheck).toBe('reasonable');
    });
  });
});

// ヘルパー関数
function generateMockExpenses(count: number, options?: {
  startDate?: Date;
  endDate?: Date;
  maxAmount?: number;
}): ExpenseRequest[] {
  const categories = ['交通費', '会議費', '接待交際費', '消耗品費', '通信費'];
  const expenses: ExpenseRequest[] = [];
  
  const startDate = options?.startDate || new Date('2024-01-01');
  const endDate = options?.endDate || new Date('2024-01-31');
  const dateRange = endDate.getTime() - startDate.getTime();
  const maxAmount = options?.maxAmount || 50000;

  for (let i = 0; i < count; i++) {
    expenses.push({
      id: `exp_mock_${i}`,
      employeeId: `emp${String((i % 3) + 1).padStart(3, '0')}`,
      amount: Math.floor(Math.random() * maxAmount) + 1000,
      categoryId: categories[i % categories.length],
      description: `Mock expense ${i}`,
      expenseDate: new Date(startDate.getTime() + Math.random() * dateRange),
      status: Math.random() > 0.1 ? 'approved' : 'pending',
      createdAt: new Date(),
      receiptImageUrl: Math.random() > 0.3 ? `receipt_${i}.jpg` : undefined
    });
  }

  return expenses;
}

function getMondayOfThisWeek(): Date {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(today.setDate(diff));
}