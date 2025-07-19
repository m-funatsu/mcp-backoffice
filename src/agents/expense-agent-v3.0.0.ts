/**
 * 経費管理エージェント v3.0.0
 * Expense Management Agent
 * 
 * 自律的な経費申請処理と不正検知
 */

import { BaseAgent } from '../agent-framework-v3.0.0.js';
import { DatabasePostgreSQL } from '../database_postgresql.js';
import { IntegratedAnomalyDetectionEngine } from '../integrated-anomaly-detection-v2.1.0.js';
import { FreeeIntegration } from '../ecosystem-integration-v2.2.0.js';
import type { AgentGoal, AgentAction, AgentContext } from '../agent-framework-v3.0.0.js';
import type { ExpenseRequest, Employee } from '../types.js';

export interface ExpenseGoal extends AgentGoal {
  period: {
    start: Date;
    end: Date;
  };
  processingRules: {
    autoApprovalLimit: number;
    requireReceiptThreshold: number;
    fraudDetectionSensitivity: 'low' | 'medium' | 'high';
  };
  integrationSettings: {
    syncToAccounting: boolean;
    realTimeNotification: boolean;
  };
}

export interface ExpenseAction extends AgentAction {
  expenseId?: string;
  batchIds?: string[];
  actionType: 'approve' | 'reject' | 'investigate' | 'process' | 'sync';
  reason?: string;
  evidence?: any;
}

export class ExpenseAgent extends BaseAgent {
  private db: DatabasePostgreSQL;
  private anomalyEngine: IntegratedAnomalyDetectionEngine;
  private accountingIntegration: FreeeIntegration;
  private processingQueue: ExpenseRequest[];
  private fraudDetectionModel: any;
  
  constructor(config: any) {
    super({
      id: 'expense_agent_001',
      name: '経費管理エージェント',
      type: 'expense',
      capabilities: [
        'expense_processing',
        'fraud_detection',
        'auto_approval',
        'receipt_ocr',
        'accounting_sync',
        'budget_monitoring',
        'policy_enforcement'
      ],
      autonomyLevel: 0.85
    });
    
    this.db = new DatabasePostgreSQL(config.database);
    this.anomalyEngine = new IntegratedAnomalyDetectionEngine(this.db);
    this.accountingIntegration = new FreeeIntegration(config.freeeConfig);
    this.processingQueue = [];
    this.initializeFraudDetectionModel();
  }

  async processGoal(goal: ExpenseGoal): Promise<void> {
    this.logger.info(`Processing expense goal: ${goal.description}`);
    
    try {
      // 未処理経費の取得
      const pendingExpenses = await this.getPendingExpenses(goal.period);
      this.processingQueue = pendingExpenses;
      
      // バッチ処理の実行
      const batchResults = await this.processBatch(pendingExpenses, goal.processingRules);
      
      // 不正検知の実行
      const fraudAnalysis = await this.detectFraud(pendingExpenses, goal.processingRules.fraudDetectionSensitivity);
      
      // 承認ワークフローの処理
      const approvalResults = await this.processApprovals(batchResults, goal.processingRules);
      
      // 会計システムへの同期
      if (goal.integrationSettings.syncToAccounting) {
        await this.syncToAccounting(approvalResults.approved);
      }
      
      // 予算監視とアラート
      await this.monitorBudget(goal.period);
      
      // レポート生成
      const report = await this.generateExpenseReport({
        period: goal.period,
        processed: batchResults.length,
        approved: approvalResults.approved.length,
        rejected: approvalResults.rejected.length,
        fraudDetected: fraudAnalysis.suspicious.length,
        totalAmount: this.calculateTotalAmount(approvalResults.approved)
      });
      
      // 目標完了
      await this.completeGoal(goal.id, report);
      
    } catch (error) {
      this.logger.error('Expense goal processing failed:', error);
      throw error;
    }
  }

  protected async plan(context: AgentContext): Promise<ExpenseAction[]> {
    const actions: ExpenseAction[] = [];
    
    // 1. OCR処理アクション
    const needsOCR = context.expenses?.filter(e => e.receiptImageUrl && !e.ocrProcessed) || [];
    if (needsOCR.length > 0) {
      actions.push({
        id: `action_${Date.now()}_ocr`,
        type: 'process',
        description: `${needsOCR.length}件のレシートOCR処理`,
        actionType: 'process',
        batchIds: needsOCR.map(e => e.id),
        execute: async () => {
          const results = await this.processReceiptOCR(needsOCR);
          return { success: true, data: results };
        }
      });
    }
    
    // 2. 不正検知アクション
    const toInvestigate = context.expenses?.filter(e => e.status === 'pending') || [];
    if (toInvestigate.length > 0) {
      actions.push({
        id: `action_${Date.now()}_fraud_detection`,
        type: 'analyze',
        description: '経費申請の不正検知分析',
        actionType: 'investigate',
        batchIds: toInvestigate.map(e => e.id),
        execute: async () => {
          const fraudResults = await this.runFraudDetection(toInvestigate);
          return { success: true, data: fraudResults };
        }
      });
    }
    
    // 3. 自動承認アクション
    const autoApprovable = this.filterAutoApprovable(context.expenses || [], context.rules);
    if (autoApprovable.length > 0) {
      actions.push({
        id: `action_${Date.now()}_auto_approve`,
        type: 'approve',
        description: `${autoApprovable.length}件の自動承認`,
        actionType: 'approve',
        batchIds: autoApprovable.map(e => e.id),
        reason: 'ポリシー基準内での自動承認',
        execute: async () => {
          const approvalResults = await this.autoApprove(autoApprovable);
          return { success: true, data: approvalResults };
        }
      });
    }
    
    // 4. 会計同期アクション
    const toSync = context.expenses?.filter(e => e.status === 'approved' && !e.syncedToAccounting) || [];
    if (toSync.length > 0) {
      actions.push({
        id: `action_${Date.now()}_sync`,
        type: 'sync',
        description: '会計システムへの同期',
        actionType: 'sync',
        batchIds: toSync.map(e => e.id),
        execute: async () => {
          const syncResults = await this.syncExpensesToAccounting(toSync);
          return { success: true, data: syncResults };
        }
      });
    }
    
    return actions;
  }

  protected async execute(action: ExpenseAction): Promise<any> {
    this.logger.info(`Executing expense action: ${action.description}`);
    
    try {
      const result = await action.execute();
      
      // アクション結果の記録
      await this.recordActionResult(action, result);
      
      // 必要に応じて通知
      if (action.actionType === 'reject' || (action.actionType === 'investigate' && result.data?.suspicious)) {
        await this.notifyRelevantParties(action, result);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`Action execution failed: ${action.id}`, error);
      throw error;
    }
  }

  protected async monitor(context: AgentContext): Promise<void> {
    // リアルタイム経費監視
    setInterval(async () => {
      try {
        // 新規経費申請の確認
        const newExpenses = await this.checkNewExpenses();
        if (newExpenses.length > 0) {
          context.expenses = [...(context.expenses || []), ...newExpenses];
          
          // 高額経費の即時チェック
          const highValueExpenses = newExpenses.filter(e => e.amount > 50000);
          if (highValueExpenses.length > 0) {
            await this.handleHighValueExpenses(highValueExpenses);
          }
        }
        
        // 予算超過の監視
        const budgetStatus = await this.checkBudgetStatus();
        if (budgetStatus.exceededDepartments.length > 0) {
          await this.handleBudgetExcess(budgetStatus);
        }
        
        // ポリシー違反の検出
        const violations = await this.detectPolicyViolations();
        if (violations.length > 0) {
          await this.handlePolicyViolations(violations);
        }
        
      } catch (error) {
        this.logger.error('Monitoring error:', error);
      }
    }, 60000); // 1分ごと
  }

  protected async learn(context: AgentContext): Promise<void> {
    // 経費パターンの学習
    const historicalExpenses = await this.getHistoricalExpenses();
    
    // 不正検知モデルの更新
    await this.updateFraudDetectionModel(historicalExpenses);
    
    // 承認パターンの分析
    const approvalPatterns = this.analyzeApprovalPatterns(historicalExpenses);
    
    // カテゴリ別支出トレンドの学習
    const spendingTrends = this.analyzeSpendingTrends(historicalExpenses);
    
    // 学習結果の適用
    await this.applyLearnings({
      fraudPatterns: this.fraudDetectionModel.getPatterns(),
      approvalInsights: approvalPatterns,
      trendPredictions: spendingTrends
    });
  }

  // ===== プライベートメソッド =====

  private initializeFraudDetectionModel(): void {
    // 不正検知モデルの初期化
    this.fraudDetectionModel = {
      patterns: new Map(),
      thresholds: {
        duplicateWindow: 7, // 日
        amountDeviation: 3, // 標準偏差
        frequencyLimit: 10 // 回/月
      },
      getPatterns: () => Array.from(this.fraudDetectionModel.patterns.values())
    };
  }

  private async getPendingExpenses(period: { start: Date; end: Date }): Promise<ExpenseRequest[]> {
    const result = await this.db.query(
      `SELECT * FROM expense_requests 
       WHERE status = 'pending' 
       AND expense_date BETWEEN $1 AND $2
       ORDER BY created_at ASC`,
      [period.start, period.end]
    );
    
    return result.rows;
  }

  private async processBatch(expenses: ExpenseRequest[], rules: any): Promise<any[]> {
    const results = [];
    
    for (const expense of expenses) {
      try {
        // 基本検証
        const validation = await this.validateExpense(expense);
        
        // OCR処理（必要な場合）
        if (expense.receiptImageUrl && !expense.ocrProcessed) {
          const ocrResult = await this.processReceiptOCR([expense]);
          expense.ocrData = ocrResult[0];
        }
        
        // カテゴリ分類
        if (!expense.categoryId) {
          expense.categoryId = await this.classifyExpense(expense);
        }
        
        results.push({
          expenseId: expense.id,
          status: 'processed',
          validation,
          ocrProcessed: !!expense.ocrData
        });
        
      } catch (error) {
        results.push({
          expenseId: expense.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  }

  private async detectFraud(expenses: ExpenseRequest[], sensitivity: string): Promise<any> {
    const suspicious = [];
    const clean = [];
    
    for (const expense of expenses) {
      const fraudScore = await this.calculateFraudScore(expense, sensitivity);
      
      if (fraudScore > this.getFraudThreshold(sensitivity)) {
        suspicious.push({
          expense,
          score: fraudScore,
          reasons: this.identifyFraudReasons(expense, fraudScore)
        });
      } else {
        clean.push(expense);
      }
    }
    
    return { suspicious, clean };
  }

  private async processApprovals(batchResults: any[], rules: any): Promise<any> {
    const approved = [];
    const rejected = [];
    const pending = [];
    
    for (const result of batchResults) {
      if (result.status === 'error') {
        rejected.push({
          expenseId: result.expenseId,
          reason: result.error
        });
        continue;
      }
      
      const expense = await this.getExpenseById(result.expenseId);
      
      // 自動承認判定
      if (this.canAutoApprove(expense, rules)) {
        approved.push(expense);
        await this.approveExpense(expense.id, 'auto', 'ポリシー基準内');
      } 
      // 自動却下判定
      else if (this.shouldAutoReject(expense, rules)) {
        rejected.push({
          expenseId: expense.id,
          reason: 'ポリシー違反'
        });
        await this.rejectExpense(expense.id, 'auto', 'ポリシー違反');
      }
      // 手動承認待ち
      else {
        pending.push(expense);
      }
    }
    
    return { approved, rejected, pending };
  }

  private async syncToAccounting(approvedExpenses: ExpenseRequest[]): Promise<void> {
    const syncResult = await this.accountingIntegration.syncExpenseData(approvedExpenses);
    
    if (syncResult.status === 'success') {
      // 同期済みフラグを更新
      for (const expense of approvedExpenses) {
        await this.db.query(
          `UPDATE expense_requests 
           SET synced_to_accounting = true, 
               synced_at = $1,
               accounting_ref = $2
           WHERE id = $3`,
          [new Date(), syncResult.reference, expense.id]
        );
      }
    } else {
      this.logger.error('Accounting sync failed:', syncResult.errors);
      throw new Error('会計システムへの同期に失敗しました');
    }
  }

  private async monitorBudget(period: { start: Date; end: Date }): Promise<void> {
    // 部門別予算使用状況の確認
    const budgetStatus = await this.db.query(
      `SELECT 
         department,
         SUM(amount) as total_spent,
         budget_limit,
         (SUM(amount) / budget_limit * 100) as usage_percentage
       FROM expense_requests e
       JOIN department_budgets b ON e.department = b.department
       WHERE e.status = 'approved'
       AND e.expense_date BETWEEN $1 AND $2
       GROUP BY department, budget_limit`,
      [period.start, period.end]
    );
    
    // 予算超過アラート
    for (const dept of budgetStatus.rows) {
      if (dept.usage_percentage > 90) {
        await this.sendBudgetAlert(dept);
      }
    }
  }

  private async generateExpenseReport(data: any): Promise<any> {
    const report = {
      generatedAt: new Date(),
      period: data.period,
      summary: {
        totalProcessed: data.processed,
        totalApproved: data.approved,
        totalRejected: data.rejected,
        fraudCasesDetected: data.fraudDetected,
        totalAmount: data.totalAmount
      },
      categoryBreakdown: await this.getCategoryBreakdown(data.period),
      departmentBreakdown: await this.getDepartmentBreakdown(data.period),
      topSpenders: await this.getTopSpenders(data.period),
      fraudAnalysis: {
        casesDetected: data.fraudDetected,
        preventedLoss: data.fraudDetected * 50000 // 仮定値
      },
      trends: await this.analyzeTrends(data.period),
      recommendations: this.generateRecommendations(data)
    };
    
    // レポートの保存
    await this.saveExpenseReport(report);
    
    return report;
  }

  private async processReceiptOCR(expenses: ExpenseRequest[]): Promise<any[]> {
    const results = [];
    
    for (const expense of expenses) {
      if (!expense.receiptImageUrl) continue;
      
      try {
        // OCR処理（実際はOCRサービスを呼び出す）
        const ocrData = await this.performOCR(expense.receiptImageUrl);
        
        // データ抽出
        const extractedData = {
          vendor: ocrData.vendor || '',
          amount: ocrData.totalAmount || expense.amount,
          date: ocrData.date || expense.expenseDate,
          items: ocrData.lineItems || [],
          taxInfo: ocrData.tax || {}
        };
        
        // データベース更新
        await this.db.query(
          `UPDATE expense_requests 
           SET ocr_data = $1, ocr_processed = true
           WHERE id = $2`,
          [JSON.stringify(extractedData), expense.id]
        );
        
        results.push({
          expenseId: expense.id,
          ocrData: extractedData,
          confidence: ocrData.confidence || 0.85
        });
        
      } catch (error) {
        this.logger.error(`OCR failed for expense ${expense.id}:`, error);
        results.push({
          expenseId: expense.id,
          error: error.message
        });
      }
    }
    
    return results;
  }

  private async runFraudDetection(expenses: ExpenseRequest[]): Promise<any> {
    const fraudResults = [];
    
    for (const expense of expenses) {
      // 複数の不正検知手法を適用
      const checks = {
        duplicate: await this.checkDuplicateExpense(expense),
        anomalousAmount: await this.checkAnomalousAmount(expense),
        suspiciousPattern: await this.checkSuspiciousPattern(expense),
        policyViolation: await this.checkPolicyViolation(expense)
      };
      
      const fraudScore = this.calculateOverallFraudScore(checks);
      
      fraudResults.push({
        expenseId: expense.id,
        fraudScore,
        checks,
        riskLevel: this.determineFraudRiskLevel(fraudScore),
        recommendation: this.generateFraudRecommendation(fraudScore, checks)
      });
    }
    
    return fraudResults;
  }

  private filterAutoApprovable(expenses: ExpenseRequest[], rules: any): ExpenseRequest[] {
    return expenses.filter(expense => {
      // 金額制限チェック
      if (expense.amount > rules.autoApprovalLimit) return false;
      
      // レシート必須チェック
      if (expense.amount > rules.requireReceiptThreshold && !expense.receiptImageUrl) return false;
      
      // カテゴリ制限チェック
      if (rules.restrictedCategories?.includes(expense.categoryId)) return false;
      
      // 従業員の承認履歴チェック
      if (this.hasRecentRejections(expense.employeeId)) return false;
      
      return true;
    });
  }

  private async autoApprove(expenses: ExpenseRequest[]): Promise<any[]> {
    const results = [];
    
    for (const expense of expenses) {
      try {
        await this.approveExpense(expense.id, 'auto', '自動承認基準を満たす');
        results.push({
          expenseId: expense.id,
          status: 'approved',
          approvedAt: new Date()
        });
      } catch (error) {
        results.push({
          expenseId: expense.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  }

  private async syncExpensesToAccounting(expenses: ExpenseRequest[]): Promise<any> {
    try {
      const syncResult = await this.accountingIntegration.syncExpenseData(expenses);
      
      // 同期結果の記録
      for (const expense of expenses) {
        await this.db.query(
          `UPDATE expense_requests 
           SET synced_to_accounting = $1,
               synced_at = $2,
               sync_status = $3
           WHERE id = $4`,
          [true, new Date(), 'success', expense.id]
        );
      }
      
      return {
        success: true,
        syncedCount: expenses.length,
        syncResult
      };
      
    } catch (error) {
      this.logger.error('Accounting sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async recordActionResult(action: ExpenseAction, result: any): Promise<void> {
    await this.db.query(
      `INSERT INTO expense_action_log 
       (action_id, action_type, description, result, executed_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [action.id, action.actionType, action.description, JSON.stringify(result), new Date()]
    );
  }

  private async notifyRelevantParties(action: ExpenseAction, result: any): Promise<void> {
    // 却下通知
    if (action.actionType === 'reject') {
      await this.sendNotification(action.expenseId!, {
        type: 'rejection',
        reason: action.reason,
        recipient: 'employee'
      });
    }
    
    // 不正検知通知
    if (action.actionType === 'investigate' && result.data?.suspicious) {
      await this.sendNotification(action.expenseId!, {
        type: 'fraud_alert',
        details: result.data,
        recipient: 'finance_team'
      });
    }
  }

  // ヘルパーメソッド

  private async validateExpense(expense: ExpenseRequest): Promise<any> {
    const validation = {
      isValid: true,
      errors: []
    };
    
    // 必須フィールドチェック
    if (!expense.amount || expense.amount <= 0) {
      validation.errors.push('無効な金額');
      validation.isValid = false;
    }
    
    if (!expense.description) {
      validation.errors.push('説明が必要です');
      validation.isValid = false;
    }
    
    // 日付チェック
    if (expense.expenseDate > new Date()) {
      validation.errors.push('未来の日付は指定できません');
      validation.isValid = false;
    }
    
    return validation;
  }

  private async classifyExpense(expense: ExpenseRequest): Promise<string> {
    // キーワードベースの分類（実際はMLモデルを使用）
    const description = expense.description.toLowerCase();
    
    if (description.includes('交通') || description.includes('電車') || description.includes('タクシー')) {
      return 'transportation';
    } else if (description.includes('会議') || description.includes('打ち合わせ')) {
      return 'meeting';
    } else if (description.includes('書籍') || description.includes('本')) {
      return 'books';
    } else {
      return 'other';
    }
  }

  private async calculateFraudScore(expense: ExpenseRequest, sensitivity: string): Promise<number> {
    let score = 0;
    
    // 重複チェック
    const isDuplicate = await this.checkDuplicateExpense(expense);
    if (isDuplicate) score += 0.4;
    
    // 金額異常チェック
    const isAnomalousAmount = await this.checkAnomalousAmount(expense);
    if (isAnomalousAmount) score += 0.3;
    
    // パターン異常チェック
    const hasSupiciousPattern = await this.checkSuspiciousPattern(expense);
    if (hasSupiciousPattern) score += 0.3;
    
    // 感度による調整
    const sensitivityMultiplier = {
      low: 0.7,
      medium: 1.0,
      high: 1.3
    };
    
    return Math.min(1.0, score * sensitivityMultiplier[sensitivity]);
  }

  private getFraudThreshold(sensitivity: string): number {
    const thresholds = {
      low: 0.7,
      medium: 0.5,
      high: 0.3
    };
    return thresholds[sensitivity];
  }

  private identifyFraudReasons(expense: ExpenseRequest, score: number): string[] {
    const reasons = [];
    
    if (score > 0.8) {
      reasons.push('高い不正リスクスコア');
    }
    
    // 具体的な理由を追加（実際の検出結果に基づく）
    
    return reasons;
  }

  private canAutoApprove(expense: ExpenseRequest, rules: any): boolean {
    return expense.amount <= rules.autoApprovalLimit && 
           !rules.restrictedCategories?.includes(expense.categoryId);
  }

  private shouldAutoReject(expense: ExpenseRequest, rules: any): boolean {
    // ポリシー違反の自動却下条件
    return false; // 実装簡略化
  }

  private async approveExpense(expenseId: string, approver: string, reason: string): Promise<void> {
    await this.db.query(
      `UPDATE expense_requests 
       SET status = 'approved',
           approved_by = $1,
           approved_at = $2,
           approval_reason = $3
       WHERE id = $4`,
      [approver, new Date(), reason, expenseId]
    );
  }

  private async rejectExpense(expenseId: string, rejector: string, reason: string): Promise<void> {
    await this.db.query(
      `UPDATE expense_requests 
       SET status = 'rejected',
           rejected_by = $1,
           rejected_at = $2,
           rejection_reason = $3
       WHERE id = $4`,
      [rejector, new Date(), reason, expenseId]
    );
  }

  private async getExpenseById(expenseId: string): Promise<ExpenseRequest> {
    const result = await this.db.query(
      'SELECT * FROM expense_requests WHERE id = $1',
      [expenseId]
    );
    return result.rows[0];
  }

  private calculateTotalAmount(expenses: ExpenseRequest[]): number {
    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
  }

  private async completeGoal(goalId: string, report: any): Promise<void> {
    await this.updateGoalStatus(goalId, 'completed', report);
  }

  private async checkNewExpenses(): Promise<ExpenseRequest[]> {
    const result = await this.db.query(
      `SELECT * FROM expense_requests 
       WHERE status = 'pending' 
       AND created_at > NOW() - INTERVAL '5 minutes'`
    );
    return result.rows;
  }

  private async handleHighValueExpenses(expenses: ExpenseRequest[]): Promise<void> {
    for (const expense of expenses) {
      await this.sendNotification(expense.id, {
        type: 'high_value_alert',
        amount: expense.amount,
        recipient: 'finance_manager'
      });
    }
  }

  private async checkBudgetStatus(): Promise<any> {
    const result = await this.db.query(
      `SELECT department, 
              SUM(amount) as spent,
              budget_limit,
              (SUM(amount) / budget_limit) as usage_ratio
       FROM expense_requests e
       JOIN department_budgets b ON e.department = b.department
       WHERE e.status = 'approved'
       AND e.expense_date >= DATE_TRUNC('month', CURRENT_DATE)
       GROUP BY department, budget_limit
       HAVING SUM(amount) > budget_limit * 0.9`
    );
    
    return {
      exceededDepartments: result.rows.filter(r => r.usage_ratio > 1)
    };
  }

  private async handleBudgetExcess(budgetStatus: any): Promise<void> {
    for (const dept of budgetStatus.exceededDepartments) {
      await this.sendNotification(null, {
        type: 'budget_exceeded',
        department: dept.department,
        usage: dept.usage_ratio,
        recipient: 'department_head'
      });
    }
  }

  private async detectPolicyViolations(): Promise<any[]> {
    // ポリシー違反検出ロジック
    return [];
  }

  private async handlePolicyViolations(violations: any[]): Promise<void> {
    // ポリシー違反処理
  }

  private async getHistoricalExpenses(): Promise<ExpenseRequest[]> {
    const result = await this.db.query(
      `SELECT * FROM expense_requests 
       WHERE created_at > NOW() - INTERVAL '90 days'
       ORDER BY created_at DESC`
    );
    return result.rows;
  }

  private async updateFraudDetectionModel(historicalData: ExpenseRequest[]): Promise<void> {
    // 不正パターンの更新
    const patterns = this.extractFraudPatterns(historicalData);
    
    for (const [key, pattern] of patterns) {
      this.fraudDetectionModel.patterns.set(key, pattern);
    }
  }

  private analyzeApprovalPatterns(historicalData: ExpenseRequest[]): any {
    // 承認パターンの分析
    return {
      autoApprovalRate: 0.65,
      averageApprovalTime: 2.5,
      rejectionRate: 0.08
    };
  }

  private analyzeSpendingTrends(historicalData: ExpenseRequest[]): any {
    // 支出トレンドの分析
    return {
      monthlyGrowth: 0.05,
      seasonalPatterns: {},
      categoryTrends: {}
    };
  }

  private async applyLearnings(learnings: any): Promise<void> {
    // 学習結果の適用
    console.log('Applying learnings:', learnings);
  }

  private async performOCR(imageUrl: string): Promise<any> {
    // OCR処理（実際はOCRサービスを呼び出す）
    return {
      vendor: 'サンプル店舗',
      totalAmount: 5000,
      date: new Date(),
      lineItems: [],
      tax: { rate: 0.1, amount: 454 },
      confidence: 0.92
    };
  }

  private async checkDuplicateExpense(expense: ExpenseRequest): Promise<boolean> {
    const result = await this.db.query(
      `SELECT COUNT(*) FROM expense_requests
       WHERE employee_id = $1
       AND amount = $2
       AND expense_date = $3
       AND id != $4`,
      [expense.employeeId, expense.amount, expense.expenseDate, expense.id]
    );
    
    return result.rows[0].count > 0;
  }

  private async checkAnomalousAmount(expense: ExpenseRequest): Promise<boolean> {
    // カテゴリ別の平均金額と比較
    const stats = await this.db.query(
      `SELECT AVG(amount) as avg, STDDEV(amount) as stddev
       FROM expense_requests
       WHERE category_id = $1
       AND status = 'approved'`,
      [expense.categoryId]
    );
    
    const { avg, stddev } = stats.rows[0];
    const zScore = Math.abs((expense.amount - avg) / stddev);
    
    return zScore > this.fraudDetectionModel.thresholds.amountDeviation;
  }

  private async checkSuspiciousPattern(expense: ExpenseRequest): Promise<boolean> {
    // 疑わしいパターンのチェック
    return false; // 実装簡略化
  }

  private async checkPolicyViolation(expense: ExpenseRequest): Promise<boolean> {
    // ポリシー違反チェック
    return false; // 実装簡略化
  }

  private calculateOverallFraudScore(checks: any): number {
    let score = 0;
    let weight = 0;
    
    if (checks.duplicate) {
      score += 0.4;
      weight += 0.4;
    }
    
    if (checks.anomalousAmount) {
      score += 0.3;
      weight += 0.3;
    }
    
    if (checks.suspiciousPattern) {
      score += 0.2;
      weight += 0.2;
    }
    
    if (checks.policyViolation) {
      score += 0.1;
      weight += 0.1;
    }
    
    return weight > 0 ? score / weight : 0;
  }

  private determineFraudRiskLevel(score: number): string {
    if (score > 0.8) return 'critical';
    if (score > 0.6) return 'high';
    if (score > 0.4) return 'medium';
    return 'low';
  }

  private generateFraudRecommendation(score: number, checks: any): string {
    if (score > 0.8) {
      return '即座に調査が必要です';
    } else if (score > 0.6) {
      return '追加の確認を推奨します';
    } else {
      return '通常の承認プロセスで処理可能です';
    }
  }

  private hasRecentRejections(employeeId: string): boolean {
    // 最近の却下履歴チェック（実装簡略化）
    return false;
  }

  private async sendBudgetAlert(dept: any): Promise<void> {
    console.log(`Budget alert for ${dept.department}: ${dept.usage_percentage}% used`);
  }

  private async getCategoryBreakdown(period: any): Promise<any> {
    const result = await this.db.query(
      `SELECT category_id, COUNT(*) as count, SUM(amount) as total
       FROM expense_requests
       WHERE status = 'approved'
       AND expense_date BETWEEN $1 AND $2
       GROUP BY category_id`,
      [period.start, period.end]
    );
    
    return result.rows;
  }

  private async getDepartmentBreakdown(period: any): Promise<any> {
    const result = await this.db.query(
      `SELECT department, COUNT(*) as count, SUM(amount) as total
       FROM expense_requests
       WHERE status = 'approved'
       AND expense_date BETWEEN $1 AND $2
       GROUP BY department`,
      [period.start, period.end]
    );
    
    return result.rows;
  }

  private async getTopSpenders(period: any): Promise<any> {
    const result = await this.db.query(
      `SELECT employee_id, COUNT(*) as count, SUM(amount) as total
       FROM expense_requests
       WHERE status = 'approved'
       AND expense_date BETWEEN $1 AND $2
       GROUP BY employee_id
       ORDER BY total DESC
       LIMIT 10`,
      [period.start, period.end]
    );
    
    return result.rows;
  }

  private async analyzeTrends(period: any): Promise<any> {
    // トレンド分析
    return {
      monthlyGrowth: 0.05,
      categoryTrends: {},
      seasonalPatterns: {}
    };
  }

  private generateRecommendations(data: any): string[] {
    const recommendations = [];
    
    if (data.fraudDetected > 5) {
      recommendations.push('不正検知の感度を上げることを推奨');
    }
    
    if (data.rejected / data.processed > 0.2) {
      recommendations.push('承認基準の見直しを検討');
    }
    
    return recommendations;
  }

  private async saveExpenseReport(report: any): Promise<void> {
    await this.db.query(
      `INSERT INTO expense_reports (report_data, generated_at)
       VALUES ($1, $2)`,
      [JSON.stringify(report), report.generatedAt]
    );
  }

  private async sendNotification(expenseId: string | null, notification: any): Promise<void> {
    console.log(`Notification:`, notification);
  }

  private extractFraudPatterns(historicalData: ExpenseRequest[]): Map<string, any> {
    const patterns = new Map();
    
    // パターン抽出ロジック
    patterns.set('duplicate_window', { days: 7, threshold: 0.9 });
    patterns.set('amount_spike', { multiplier: 3, baseline: 'category_average' });
    
    return patterns;
  }
}

export default ExpenseAgent;