/**
 * AI-OS SDK 基本的な使用例
 * このファイルはAI-OS JavaScript SDKの基本的な使い方を示します
 */

const { AIOSClient } = require('../ai-os-sdk');

// クライアントの初期化
const client = new AIOSClient({
  apiKey: 'your-api-key-here', // 実際のAPIキーに置き換えてください
  baseUrl: 'https://api.ai-os.com' // デフォルトのままでOK
});

/**
 * 基本的な使用例
 */
async function basicExamples() {
  try {
    console.log('=== AI-OS SDK 基本使用例 ===\n');

    // 1. 従業員一覧の取得
    console.log('1. 従業員一覧を取得中...');
    const employees = await client.employees.list({
      limit: 10,
      offset: 0,
      department: 'engineering'
    });
    console.log(`従業員数: ${employees.total}`);
    console.log('最初の従業員:', employees.data[0]);

    // 2. 特定の従業員情報取得
    console.log('\n2. 特定の従業員情報を取得中...');
    const employee = await client.employees.get('emp123');
    console.log('従業員名:', employee.name);
    console.log('部署:', employee.department);

    // 3. 出勤打刻
    console.log('\n3. 出勤打刻を実行中...');
    const clockInResult = await client.timeRecords.clockIn('emp123');
    console.log('打刻時刻:', clockInResult.timestamp);
    console.log('打刻タイプ:', clockInResult.type);

    // 4. 月次勤怠サマリー取得
    console.log('\n4. 月次勤怠サマリーを取得中...');
    const summary = await client.timeRecords.getMonthlySummary('emp123', '2025-07');
    console.log('総労働時間:', summary.totalHours);
    console.log('残業時間:', summary.overtimeHours);

    // 5. 休暇残高確認
    console.log('\n5. 休暇残高を確認中...');
    const leaveBalance = await client.leaves.getBalance('emp123');
    console.log('有給休暇残日数:', leaveBalance.paidLeave.remaining);
    console.log('次回付与日:', leaveBalance.paidLeave.nextGrantDate);

  } catch (error) {
    console.error('エラーが発生しました:', error.message);
    if (error.response) {
      console.error('詳細:', error.response);
    }
  }
}

/**
 * エラーハンドリングの例
 */
async function errorHandlingExample() {
  console.log('\n=== エラーハンドリングの例 ===\n');

  try {
    // 存在しない従業員を取得しようとする
    await client.employees.get('non-existent-id');
  } catch (error) {
    if (error.statusCode === 404) {
      console.log('従業員が見つかりません');
    } else if (error.statusCode === 401) {
      console.log('認証エラー: APIキーを確認してください');
    } else {
      console.log('予期しないエラー:', error.message);
    }
  }
}

/**
 * ページング処理の例
 */
async function paginationExample() {
  console.log('\n=== ページング処理の例 ===\n');

  const pageSize = 20;
  let offset = 0;
  let hasMore = true;
  let allEmployees = [];

  while (hasMore) {
    const response = await client.employees.list({
      limit: pageSize,
      offset: offset
    });

    allEmployees = allEmployees.concat(response.data);
    offset += pageSize;
    hasMore = response.data.length === pageSize;

    console.log(`${response.data.length}件の従業員を取得（合計: ${allEmployees.length}件）`);
  }

  console.log(`全従業員数: ${allEmployees.length}`);
}

/**
 * 非同期バッチ処理の例
 */
async function batchProcessingExample() {
  console.log('\n=== バッチ処理の例 ===\n');

  const employeeIds = ['emp001', 'emp002', 'emp003', 'emp004', 'emp005'];

  // Promise.allを使った並列処理
  console.log('全従業員の休暇残高を並列で取得中...');
  const balancePromises = employeeIds.map(id => 
    client.leaves.getBalance(id).catch(error => ({
      employeeId: id,
      error: error.message
    }))
  );

  const balances = await Promise.all(balancePromises);
  
  balances.forEach((balance, index) => {
    if (balance.error) {
      console.log(`${employeeIds[index]}: エラー - ${balance.error}`);
    } else {
      console.log(`${employeeIds[index]}: 有給残 ${balance.paidLeave.remaining}日`);
    }
  });
}

/**
 * Webhook設定の例
 */
async function webhookExample() {
  console.log('\n=== Webhook設定の例 ===\n');

  // Webhookの登録
  const webhook = await client.webhooks.create({
    url: 'https://your-app.com/webhooks/ai-os',
    events: [
      'employee.created',
      'employee.updated',
      'timerecord.clocked_in',
      'timerecord.clocked_out',
      'leave.requested',
      'expense.submitted'
    ],
    secret: 'your-webhook-secret'
  });

  console.log('Webhook登録完了:', webhook.id);
  console.log('対象イベント:', webhook.events.join(', '));
}

// メイン実行関数
async function main() {
  await basicExamples();
  await errorHandlingExample();
  // await paginationExample();  // コメントアウト: 大量のAPI呼び出しを避けるため
  // await batchProcessingExample();  // コメントアウト: 大量のAPI呼び出しを避けるため
  // await webhookExample();  // コメントアウト: 実際のWebhook URLが必要なため
}

// 実行
if (require.main === module) {
  main().catch(console.error);
}