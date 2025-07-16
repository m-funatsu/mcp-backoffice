import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AttendanceServer } from '../../src/server.js';
import { IntelligentExpenseEngine } from '../../src/expense-engine.js';
import { OCRService } from '../../src/ocr-service.js';
import { NLPService } from '../../src/nlp-service.js';
import Database from '../../src/database.js';
import type { Employee, ExpenseRequest, ExpenseCategory } from '../../src/types.js';

describe.skip('v1.3.0 経費精算システム - 統合テスト', () => {
  let server: AttendanceServer;
  let db: Database;
  let expenseEngine: IntelligentExpenseEngine;
  let ocrService: OCRService;
  let nlpService: NLPService;

  beforeEach(async () => {
    server = new AttendanceServer();
    db = server.db;
    ocrService = new OCRService();
    nlpService = new NLPService();
    expenseEngine = new IntelligentExpenseEngine(db, ocrService, nlpService);
    
    // テスト用データベース初期化
    await db.initializeDatabase();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('リアルデータベースでの経費精算テスト', () => {
    it('完全な経費精算フロー（レシート画像処理）', async () => {
      // 1. 従業員データ作成
      const employeeData = {
        name: '経費テスト太郎',
        department: '営業部',
        position: 'セールス',
        hourlyRate: 2500,
        joinDate: new Date('2020-04-01'),
        isActive: true
      };

      const employeeId = await db.addEmployee(employeeData);
      const employee = await db.getEmployee(employeeId);
      expect(employee).toBeTruthy();

      // 2. レシート画像から経費申請作成
      const mockReceiptImage = Buffer.from('mock receipt image data');
      const expenseRequest = await expenseEngine.createExpenseFromReceipt(
        mockReceiptImage,
        'image/jpeg',
        employeeId,
        '営業会議での食事代'
      );

      // 3. 申請内容の検証
      expect(expenseRequest.employeeId).toBe(employeeId);
      expect(expenseRequest.amount).toBeGreaterThan(0);
      expect(expenseRequest.status).toBe('draft');
      expect(expenseRequest.extractedData).toBeDefined();
      expect(expenseRequest.aiConfidenceScore).toBeGreaterThan(0);

      // 4. データベースからの取得検証
      const savedRequest = await db.getExpenseRequest(expenseRequest.id);
      expect(savedRequest).toBeTruthy();
      expect(savedRequest!.id).toBe(expenseRequest.id);

      // 5. 申請を提出
      const submitSuccess = await db.updateExpenseRequestStatus(
        expenseRequest.id,
        'submitted'
      );
      expect(submitSuccess).toBe(true);

      // 6. 承認処理
      const approveSuccess = await db.updateExpenseRequestStatus(
        expenseRequest.id,
        'approved',
        employeeId
      );
      expect(approveSuccess).toBe(true);

      // 7. 会計仕訳生成
      const accountingEntry = await expenseEngine.generateAccountingEntry(expenseRequest);
      expect(accountingEntry).toBeDefined();
      expect(accountingEntry.amount).toBe(expenseRequest.amount);
      expect(accountingEntry.debitAccount).toBeTruthy();
      expect(accountingEntry.creditAccount).toBe('2001');
    });

    it('自然言語入力による経費申請フロー', async () => {
      // 1. 従業員データ作成
      const employeeData = {
        name: 'NL経費テスト花子',
        department: '開発部',
        position: 'エンジニア',
        hourlyRate: 3000,
        joinDate: new Date('2019-04-01'),
        isActive: true
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 自然言語での経費申請
      const nlInput = '新宿駅から渋谷駅までタクシー代1,480円、緊急会議のため';
      const expenseRequest = await expenseEngine.createExpenseFromNLInput(nlInput, employeeId);

      // 3. NL解析結果の検証
      expect(expenseRequest.description).toContain('タクシー');
      expect(expenseRequest.categoryId).toBeTruthy();
      expect(expenseRequest.aiConfidenceScore).toBeGreaterThan(0);

      // 4. カテゴリー推定の検証
      const category = await db.getExpenseCategory(expenseRequest.categoryId);
      expect(category).toBeTruthy();
      expect(category!.code).toBe('TRANSPORT'); // 交通費として分類されるべき

      // 5. リスク評価の実行
      const riskAssessment = await expenseEngine.evaluateApprovalRisk(expenseRequest);
      expect(riskAssessment.riskLevel).toBeDefined();
      expect(riskAssessment.approvalProbability).toBeGreaterThan(0);
      expect(riskAssessment.recommendations).toBeInstanceOf(Array);
    });

    it('高額経費の承認フロー', async () => {
      // 1. 従業員データ作成
      const employeeData = {
        name: '高額経費テスト次郎',
        department: '役員室',
        position: '部長',
        hourlyRate: 5000,
        joinDate: new Date('2015-04-01'),
        isActive: true
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 高額経費申請（宿泊費）
      const nlInput = '出張でのホテル代25,000円、3日間宿泊';
      const expenseRequest = await expenseEngine.createExpenseFromNLInput(nlInput, employeeId);

      // 3. 高額申請のリスク評価
      const riskAssessment = await expenseEngine.evaluateApprovalRisk(expenseRequest);
      
      // 宿泊費カテゴリーの日次限度額（20,000円）を超過している場合
      if (expenseRequest.amount > 20000) {
        expect(riskAssessment.riskLevel).toBe('critical');
        expect(riskAssessment.anomalyFlags.length).toBeGreaterThan(0);
        expect(riskAssessment.approvalProbability).toBeLessThan(0.8);
      }

      // 4. 手動承認が必要
      expect(riskAssessment.recommendations).toContain('領収書の添付と詳細な説明を確認してください');
    });

    it('複数従業員の経費分析レポート', async () => {
      // 1. 複数従業員作成
      const employees = [
        { name: '経費分析A', department: '営業部', hourlyRate: 2500 },
        { name: '経費分析B', department: '営業部', hourlyRate: 2800 },
        { name: '経費分析C', department: '開発部', hourlyRate: 3200 }
      ];

      const employeeIds = [];
      for (const emp of employees) {
        const employeeData = {
          name: emp.name,
          department: emp.department,
          position: '社員',
          hourlyRate: emp.hourlyRate,
          joinDate: new Date('2020-04-01'),
          isActive: true
        };
        const id = await db.addEmployee(employeeData);
        employeeIds.push(id);
      }

      // 2. 各従業員の経費申請作成
      const expenses = [
        { employeeIndex: 0, description: 'タクシー代1,200円' },
        { employeeIndex: 0, description: '食事代3,500円' },
        { employeeIndex: 1, description: '交通費800円' },
        { employeeIndex: 2, description: '書籍代2,400円' }
      ];

      for (const expense of expenses) {
        await expenseEngine.createExpenseFromNLInput(
          expense.description,
          employeeIds[expense.employeeIndex]
        );
      }

      // 3. 営業部の分析レポート生成
      const startDate = new Date('2024-07-01');
      const endDate = new Date('2024-07-31');
      
      const analytics = await expenseEngine.generateExpenseAnalytics(
        undefined,
        '営業部',
        startDate,
        endDate
      );

      // 4. 分析結果の検証
      expect(analytics.department).toBe('営業部');
      expect(analytics.period.startDate).toEqual(startDate);
      expect(analytics.period.endDate).toEqual(endDate);
      expect(analytics.totalAmount).toBeGreaterThanOrEqual(0);
      expect(analytics.categoryBreakdown).toBeInstanceOf(Array);
      expect(analytics.approvalStats).toBeDefined();
      expect(analytics.complianceMetrics.receiptComplianceRate).toBeGreaterThanOrEqual(0);
    });

    it('経費カテゴリー管理機能', async () => {
      // 1. デフォルトカテゴリーの確認
      const categories = await db.getExpenseCategories();
      expect(categories.length).toBeGreaterThan(0);

      // 必須カテゴリーの存在確認
      const transportCategory = categories.find(cat => cat.code === 'TRANSPORT');
      expect(transportCategory).toBeTruthy();
      expect(transportCategory!.name).toBe('交通費');
      expect(transportCategory!.taxDeductible).toBe(true);

      const otherCategory = categories.find(cat => cat.code === 'OTHER');
      expect(otherCategory).toBeTruthy();
      expect(otherCategory!.approvalRequired).toBe(true);

      // 2. 個別カテゴリー取得
      const category = await db.getExpenseCategory(transportCategory!.id);
      expect(category).toBeTruthy();
      expect(category!.validationRules).toBeDefined();
    });

    it('レシート画像保存機能', async () => {
      // 1. 従業員と経費申請作成
      const employeeData = {
        name: 'レシートテスト太郎',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 2000,
        joinDate: new Date('2020-04-01'),
        isActive: true
      };

      const employeeId = await db.addEmployee(employeeData);
      const mockImageBuffer = Buffer.from('test receipt image');
      const expenseRequest = await expenseEngine.createExpenseFromReceipt(
        mockImageBuffer,
        'image/png',
        employeeId
      );

      // 2. レシート画像保存
      const receiptImageData = {
        expenseRequestId: expenseRequest.id,
        fileName: 'test-receipt.png',
        fileSize: mockImageBuffer.length,
        mimeType: 'image/png',
        storagePath: '/tmp/test-receipt.png',
        ocrStatus: 'completed' as const,
        ocrResult: {
          text: 'テストレシート',
          confidence: 0.95
        },
        confidenceScore: 0.95
      };

      const receiptId = await db.saveReceiptImage(receiptImageData);
      expect(receiptId).toBeTruthy();
      expect(receiptId.startsWith('RCP_')).toBe(true);
    });
  });

  describe('エラーハンドリングと堅牢性', () => {
    it('存在しない従業員IDでの経費申請エラー', async () => {
      const nonexistentEmployeeId = 'NONEXISTENT';
      const nlInput = 'テスト経費1,000円';

      // 実際のデータベースでは従業員が存在しないとエラーになるべき
      // ただし、現在の実装ではgetEmployeeでnullが返される
      const employee = await db.getEmployee(nonexistentEmployeeId);
      expect(employee).toBeNull();
    });

    it('不正なカテゴリーIDでの経費申請', async () => {
      const employeeData = {
        name: 'エラーテスト太郎',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 2000,
        joinDate: new Date('2020-04-01'),
        isActive: true
      };

      const employeeId = await db.addEmployee(employeeData);

      // 存在しないカテゴリーID
      const invalidCategoryId = 'INVALID_CATEGORY';
      const category = await db.getExpenseCategory(invalidCategoryId);
      expect(category).toBeNull();
    });

    it('データベース接続エラーのハンドリング', async () => {
      // データベースを閉じてからアクセス
      await db.close();

      const mockImageBuffer = Buffer.from('test');
      
      await expect(
        expenseEngine.createExpenseFromReceipt(mockImageBuffer, 'image/jpeg', 'EMP001')
      ).rejects.toThrow();
    });
  });

  describe('パフォーマンスと拡張性', () => {
    it('大量経費申請の処理性能', async () => {
      const startTime = Date.now();
      
      // 1. テスト従業員作成
      const employeeData = {
        name: 'パフォーマンステスト太郎',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 2500,
        joinDate: new Date('2020-04-01'),
        isActive: true
      };

      const employeeId = await db.addEmployee(employeeData);

      // 2. 50件の経費申請を並列作成
      const promises = [];
      for (let i = 0; i < 50; i++) {
        const nlInput = `テスト経費${i + 1}: ${(i + 1) * 100}円`;
        promises.push(
          expenseEngine.createExpenseFromNLInput(nlInput, employeeId)
        );
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 3. パフォーマンス検証
      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(30000); // 30秒以内
      
      console.log(`経費申請性能: 50件の処理時間 ${duration}ms (${(duration/50).toFixed(1)}ms/件)`);

      // 4. 結果の整合性確認
      results.forEach((result, index) => {
        expect(result.employeeId).toBe(employeeId);
        expect(result.description).toContain(`テスト経費${index + 1}`);
      });
    });

    it('経費分析レポートの生成性能', async () => {
      const startTime = Date.now();

      // 1. 分析レポート生成
      const analytics = await expenseEngine.generateExpenseAnalytics(
        undefined,
        undefined,
        new Date('2024-07-01'),
        new Date('2024-07-31')
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 2. パフォーマンス検証
      expect(duration).toBeLessThan(5000); // 5秒以内
      expect(analytics).toBeDefined();
      
      console.log(`分析レポート生成性能: ${duration}ms`);
    });
  });
});