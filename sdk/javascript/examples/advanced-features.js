/**
 * AI-OS SDK 高度な機能の使用例
 * このファイルは給与計算、経費処理、レポート生成などの高度な機能を示します
 */

const { AIOSClient, AIOSError } = require('../ai-os-sdk');
const fs = require('fs');
const path = require('path');

// クライアントの初期化
const client = new AIOSClient({
  apiKey: process.env.AIOS_API_KEY || 'your-api-key-here',
  timeout: 60000, // 長時間処理用にタイムアウトを延長
  retryAttempts: 5 // リトライ回数を増加
});

/**
 * 給与計算の例
 */
async function payrollCalculationExample() {
  console.log('=== 給与計算の例 ===\n');

  try {
    // 1. 給与計算実行（月次バッチ）
    console.log('2025年7月の給与計算を実行中...');
    const payrollBatch = await client.payroll.calculate({
      yearMonth: '2025-07',
      departmentIds: ['dept001', 'dept002'],
      includeBonus: false,
      calculateTax: true,
      calculateInsurance: true
    });

    console.log('給与計算バッチID:', payrollBatch.batchId);
    console.log('処理件数:', payrollBatch.employeeCount);
    console.log('総支給額:', payrollBatch.totalAmount.toLocaleString(), '円');

    // 2. 個別の給与明細確認
    console.log('\n特定従業員の給与明細を取得中...');
    const payslip = await client.payroll.getPayslip('emp123', '2025-07');
    
    console.log('基本給:', payslip.baseSalary.toLocaleString(), '円');
    console.log('時間外手当:', payslip.overtimePay.toLocaleString(), '円');
    console.log('総支給額:', payslip.grossPay.toLocaleString(), '円');
    console.log('控除額合計:', payslip.totalDeductions.toLocaleString(), '円');
    console.log('手取り額:', payslip.netPay.toLocaleString(), '円');

    // 3. 給与承認
    console.log('\n給与計算結果を承認中...');
    const approval = await client.payroll.approve(payrollBatch.batchId);
    console.log('承認ステータス:', approval.status);
    console.log('承認日時:', approval.approvedAt);

  } catch (error) {
    console.error('給与計算エラー:', error.message);
  }
}

/**
 * 経費処理の高度な例
 */
async function expenseProcessingExample() {
  console.log('\n=== 経費処理の高度な例 ===\n');

  try {
    // 1. レシート画像のアップロードとOCR処理
    console.log('レシート画像をアップロード中...');
    
    // ダミーのレシートファイル（実際の実装では実ファイルを使用）
    const receiptFile = new File(['dummy receipt data'], 'receipt.jpg', {
      type: 'image/jpeg'
    });

    const ocrResult = await client.expenses.uploadReceipt(receiptFile, {
      employeeId: 'emp123',
      category: 'transportation'
    });

    console.log('OCR処理結果:');
    console.log('- 店舗名:', ocrResult.merchantName);
    console.log('- 金額:', ocrResult.amount, '円');
    console.log('- 日付:', ocrResult.date);
    console.log('- 信頼度:', ocrResult.confidence);

    // 2. OCR結果を使って経費申請
    if (ocrResult.confidence > 0.8) {
      console.log('\n自動で経費申請を作成中...');
      const expense = await client.expenses.submit({
        employeeId: 'emp123',
        amount: ocrResult.amount,
        category: 'transportation',
        date: ocrResult.date,
        description: `${ocrResult.merchantName} - 交通費`,
        receiptId: ocrResult.receiptId,
        projectCode: 'PROJ001'
      });

      console.log('経費申請ID:', expense.id);
      console.log('ステータス:', expense.status);
    }

    // 3. 経費の一括承認（管理者向け）
    console.log('\n未承認の経費一覧を取得中...');
    const pendingExpenses = await client.expenses.list({
      status: 'pending',
      submittedAfter: '2025-07-01',
      limit: 100
    });

    console.log(`${pendingExpenses.total}件の未承認経費があります`);

    // AIによる自動承認推奨
    const autoApproveList = pendingExpenses.data.filter(expense => 
      expense.aiRecommendation === 'approve' && 
      expense.amount < 10000
    );

    console.log(`${autoApproveList.length}件を自動承認対象として検出`);

    // バッチ承認
    for (const expense of autoApproveList) {
      await client.expenses.approve(expense.id);
      console.log(`経費 ${expense.id} を承認しました`);
    }

  } catch (error) {
    console.error('経費処理エラー:', error.message);
  }
}

/**
 * 人的資本分析とレポート生成
 */
async function humanCapitalAnalyticsExample() {
  console.log('\n=== 人的資本分析の例 ===\n');

  try {
    // 1. 人的資本指標の取得
    console.log('2025年第2四半期の人的資本指標を取得中...');
    const metrics = await client.reports.getHumanCapitalMetrics({
      startDate: '2025-04-01',
      endDate: '2025-06-30',
      groupBy: 'department'
    });

    console.log('全社指標:');
    console.log('- 従業員数:', metrics.employeeCount);
    console.log('- 平均勤続年数:', metrics.averageTenure, '年');
    console.log('- 離職率:', metrics.turnoverRate, '%');
    console.log('- エンゲージメントスコア:', metrics.engagementScore);
    console.log('- 生産性指標:', metrics.productivityIndex);

    // 部門別分析
    console.log('\n部門別離職リスク:');
    metrics.departments.forEach(dept => {
      if (dept.turnoverRisk > 0.7) {
        console.log(`⚠️  ${dept.name}: リスク ${(dept.turnoverRisk * 100).toFixed(1)}%`);
      } else {
        console.log(`✅ ${dept.name}: リスク ${(dept.turnoverRisk * 100).toFixed(1)}%`);
      }
    });

    // 2. カスタムレポート生成
    console.log('\n経営層向けレポートを生成中...');
    const executiveReport = await client.reports.generate('executive-summary', {
      period: '2025-Q2',
      includeSections: [
        'workforce-composition',
        'talent-development',
        'compensation-analysis',
        'predictive-insights'
      ],
      format: 'pdf'
    });

    console.log('レポート生成完了:', executiveReport.reportId);
    console.log('ダウンロードURL:', executiveReport.downloadUrl);

    // 3. リアルタイムダッシュボードデータ
    console.log('\nリアルタイムダッシュボードデータを取得中...');
    const dashboard = await client.reports.getDashboard('main-dashboard');

    console.log('現在の状況:');
    console.log('- 出勤中:', dashboard.currentlyWorking, '名');
    console.log('- 本日の残業予測:', dashboard.overtimePrediction, '時間');
    console.log('- 今月の人件費進捗:', dashboard.laborCostProgress, '%');

  } catch (error) {
    console.error('分析エラー:', error.message);
  }
}

/**
 * 休暇管理の高度な例
 */
async function advancedLeaveManagement() {
  console.log('\n=== 休暇管理の高度な例 ===\n');

  try {
    // 1. AI推奨による休暇取得促進
    console.log('休暇取得が必要な従業員を分析中...');
    
    // 全従業員の休暇残高を取得
    const employees = await client.employees.list({ limit: 100 });
    const leaveAnalysis = [];

    for (const emp of employees.data) {
      const balance = await client.leaves.getBalance(emp.id);
      if (balance.paidLeave.remaining > 10 && balance.paidLeave.expiringWithin90Days > 5) {
        leaveAnalysis.push({
          employeeId: emp.id,
          name: emp.name,
          remaining: balance.paidLeave.remaining,
          expiring: balance.paidLeave.expiringWithin90Days
        });
      }
    }

    console.log(`${leaveAnalysis.length}名に休暇取得を推奨`);
    leaveAnalysis.forEach(emp => {
      console.log(`- ${emp.name}: 残${emp.remaining}日（90日以内に${emp.expiring}日失効）`);
    });

    // 2. 部門の休暇調整（同時休暇防止）
    console.log('\n休暇申請の競合をチェック中...');
    const leaveRequests = await client.leaves.listRequests({
      status: 'pending',
      startDate: '2025-08-01',
      endDate: '2025-08-31'
    });

    // 部門ごとの休暇重複をチェック
    const departmentConflicts = {};
    leaveRequests.data.forEach(request => {
      const dept = request.department;
      if (!departmentConflicts[dept]) {
        departmentConflicts[dept] = [];
      }
      departmentConflicts[dept].push(request);
    });

    // 競合する休暇申請を検出
    Object.entries(departmentConflicts).forEach(([dept, requests]) => {
      if (requests.length > 2) {
        console.log(`⚠️  ${dept}部門で${requests.length}件の休暇申請が重複`);
      }
    });

  } catch (error) {
    console.error('休暇管理エラー:', error.message);
  }
}

/**
 * Webhook受信サーバーの例
 */
function webhookServerExample() {
  console.log('\n=== Webhook受信サーバーの例 ===\n');

  const express = require('express');
  const crypto = require('crypto');
  const app = express();

  app.use(express.json());

  // Webhook受信エンドポイント
  app.post('/webhooks/ai-os', (req, res) => {
    // 署名検証
    const signature = req.headers['x-aios-signature'];
    const secret = process.env.AIOS_WEBHOOK_SECRET;
    
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(req.body));
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // イベント処理
    const { event, data } = req.body;
    
    console.log(`Webhookイベント受信: ${event}`);
    
    switch (event) {
      case 'employee.created':
        console.log(`新規従業員登録: ${data.employee.name}`);
        // 新規従業員の初期設定処理
        break;
        
      case 'timerecord.overtime_alert':
        console.log(`残業アラート: ${data.employee.name} - ${data.overtimeHours}時間`);
        // 管理者への通知処理
        break;
        
      case 'expense.auto_approved':
        console.log(`経費自動承認: ${data.expense.id} - ${data.amount}円`);
        // 会計システムへの連携処理
        break;
        
      case 'compliance.violation_detected':
        console.log(`コンプライアンス違反検出: ${data.violationType}`);
        // 緊急対応処理
        break;
    }

    res.json({ status: 'received' });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Webhookサーバーがポート${PORT}で起動しました`);
  });
}

/**
 * エラーリトライとフォールバック処理
 */
async function errorHandlingStrategies() {
  console.log('\n=== エラーリトライとフォールバック ===\n');

  // カスタムリトライロジック
  async function retryWithBackoff(fn, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (error.statusCode === 429) {
          // レート制限エラーの場合
          const retryAfter = error.response?.retryAfter || Math.pow(2, i) * 1000;
          console.log(`レート制限に達しました。${retryAfter}ms後にリトライ...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter));
        } else if (error.statusCode >= 500) {
          // サーバーエラーの場合
          const delay = Math.pow(2, i) * 1000;
          console.log(`サーバーエラー。${delay}ms後にリトライ...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // リトライ不可能なエラー
          throw error;
        }
      }
    }
    
    throw lastError;
  }

  // 使用例
  try {
    const result = await retryWithBackoff(async () => {
      return await client.payroll.calculate({
        yearMonth: '2025-07',
        departmentIds: ['all']
      });
    });
    
    console.log('給与計算成功:', result.batchId);
  } catch (error) {
    console.error('最大リトライ回数を超えました:', error.message);
    
    // フォールバック処理
    console.log('フォールバック: 手動処理キューに追加しました');
  }
}

// メイン実行関数
async function main() {
  await payrollCalculationExample();
  await expenseProcessingExample();
  await humanCapitalAnalyticsExample();
  await advancedLeaveManagement();
  await errorHandlingStrategies();
  
  // Webhookサーバーは別プロセスで実行
  // webhookServerExample();
}

// 実行
if (require.main === module) {
  main().catch(console.error);
}