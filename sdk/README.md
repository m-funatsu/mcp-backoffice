# AI-OS SDK ドキュメント

AI-OSプラットフォームと簡単に統合するための公式SDKです。JavaScript、TypeScript、Pythonをサポートしています。

## 🚀 クイックスタート

### インストール

#### JavaScript/TypeScript
```bash
npm install @ai-os/sdk
# または
yarn add @ai-os/sdk
```

#### Python
```bash
pip install ai-os-sdk
```

### 基本的な使い方

#### JavaScript
```javascript
const { AIOSClient } = require('@ai-os/sdk');

const client = new AIOSClient({
  apiKey: 'your-api-key-here'
});

// 従業員一覧を取得
const employees = await client.employees.list();
console.log(employees);

// 出勤打刻
const clockIn = await client.timeRecords.clockIn('emp123');
console.log('打刻完了:', clockIn.timestamp);
```

#### TypeScript
```typescript
import { AIOSClient, Employee } from '@ai-os/sdk';

const client = new AIOSClient({
  apiKey: 'your-api-key-here'
});

// 型安全な従業員情報取得
const employee: Employee = await client.employees.get('emp123');
console.log(employee.name);
```

#### Python
```python
from ai_os_sdk import AIOSClient

client = AIOSClient(api_key="your-api-key-here")

# 従業員一覧を取得
employees = client.employees.list(limit=10)
print(f"従業員数: {employees['total']}")

# 休暇残高確認
balance = client.leaves.get_balance("emp123")
print(f"有給残: {balance.paid_leave['remaining']}日")
```

## 📚 主な機能

### 従業員管理
- 従業員の作成・更新・削除
- 従業員情報の検索・フィルタリング
- 部門・役職での絞り込み

### 勤怠管理
- 出勤・退勤打刻
- 勤怠記録の取得
- 月次勤怠サマリー
- 残業時間の自動計算

### 給与計算
- 月次給与計算の実行
- 給与明細の取得
- 税金・社会保険の自動計算
- バッチ承認

### 休暇管理
- 休暇申請・承認
- 休暇残高の確認
- 有給休暇の自動付与
- 失効アラート

### 経費精算
- 経費申請の作成
- レシートのOCR処理
- AI による承認推奨
- 会計システム連携

### レポート・分析
- 人的資本指標の取得
- カスタムレポート生成
- リアルタイムダッシュボード
- 予測分析

## 🔧 高度な機能

### エラーハンドリング

```javascript
try {
  const employee = await client.employees.get('emp123');
} catch (error) {
  if (error.statusCode === 404) {
    console.log('従業員が見つかりません');
  } else if (error.statusCode === 401) {
    console.log('認証エラー');
  }
}
```

### ページング処理

```javascript
let offset = 0;
let hasMore = true;
const allEmployees = [];

while (hasMore) {
  const response = await client.employees.list({
    limit: 100,
    offset: offset
  });
  
  allEmployees.push(...response.data);
  hasMore = response.hasMore;
  offset += 100;
}
```

### Webhook設定

```javascript
const webhook = await client.webhooks.create({
  url: 'https://your-app.com/webhooks',
  events: [
    'employee.created',
    'timerecord.clocked_in',
    'leave.requested'
  ]
});
```

### バッチ処理

```javascript
// 複数の従業員の休暇残高を並列取得
const employeeIds = ['emp001', 'emp002', 'emp003'];
const balances = await Promise.all(
  employeeIds.map(id => client.leaves.getBalance(id))
);
```

## 🔐 認証

SDKは Bearer トークン認証を使用します。APIキーは以下の方法で設定できます：

1. **コンストラクタで直接指定**
```javascript
const client = new AIOSClient({
  apiKey: 'your-api-key-here'
});
```

2. **環境変数を使用**
```bash
export AIOS_API_KEY=your-api-key-here
```

```javascript
const client = new AIOSClient(); // 環境変数から自動的に読み込み
```

## 📖 サンプルコード

各言語のサンプルコードは以下のディレクトリにあります：

- JavaScript: `javascript/examples/`
- TypeScript: `typescript/examples/`
- Python: `python/examples/`

### 基本的な例
- `basic-usage.js` - 基本的なAPI呼び出し
- `advanced-features.js` - 高度な機能の使用例

### 実践的なワークフロー
- 勤怠管理ワークフロー
- 給与計算と承認
- 経費精算フロー
- 人的資本分析

## 🌐 API エンドポイント

デフォルトのベースURL: `https://api.ai-os.com`

主なエンドポイント：
- `/api/v1/employees` - 従業員管理
- `/api/v1/time-records` - 勤怠記録
- `/api/v1/payroll` - 給与計算
- `/api/v1/leaves` - 休暇管理
- `/api/v1/expenses` - 経費精算
- `/api/v1/reports` - レポート・分析

## ⚙️ 設定オプション

```javascript
const client = new AIOSClient({
  apiKey: 'your-api-key',      // 必須: APIキー
  baseUrl: 'https://custom.api', // オプション: カスタムAPI URL
  timeout: 30000,               // オプション: タイムアウト（ミリ秒）
  retryAttempts: 3,             // オプション: リトライ回数
  retryDelay: 1000              // オプション: リトライ間隔（ミリ秒）
});
```

## 🐛 トラブルシューティング

### よくある問題

**Q: 401 Unauthorized エラーが発生する**
A: APIキーが正しく設定されているか確認してください。

**Q: タイムアウトエラーが発生する**
A: timeout 設定を増やすか、ネットワーク接続を確認してください。

**Q: レート制限エラー（429）が発生する**
A: SDKは自動的にリトライしますが、頻度を調整することを検討してください。

## 📝 ライセンス

このSDKはMITライセンスで提供されています。

## 🤝 サポート

- ドキュメント: https://docs.ai-os.com
- APIリファレンス: https://api.ai-os.com/docs
- サポート: support@ai-os.com

## 🔄 更新履歴

### v1.0.0 (2025-07-21)
- 初回リリース
- JavaScript、TypeScript、Python SDKの提供
- 全主要APIのサポート
- 包括的なエラーハンドリング
- 自動リトライ機能