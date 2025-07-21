# AI-OS v3.2.0 エンタープライズ設定管理コンソール

## 概要

AI-OS v3.2.0では、エンタープライズ環境でAIエージェントを安全かつ効果的に運用するための統合管理コンソールを提供します。このコンソールは、役割ベースのアクセス制御（RBAC）、AIエージェント設定管理、外部サービス連携、監査ログ、データガバナンスを一元的に管理する「コックピット」として機能します。

## 🎯 主要機能

### 1. 役割と権限管理（RBAC）
- **階層的な権限モデル**: company > department > own のスコープ階層
- **条件付き権限**: 金額上限、時間帯制限、部門制限など
- **システム定義役割**: 
  - スーパー管理者
  - 企業管理者
  - 人事マネージャー
  - 経理マネージャー
  - 部門マネージャー
  - 一般従業員

### 2. AIエージェント設定管理
- **統一された設定インターフェース**: GUI操作とAI会話型設定のハイブリッド
- **リアルタイム制御**: エージェントの有効/無効、感度調整、通知設定
- **実行監視**: パフォーマンスメトリクス、実行履歴、エラー追跡

### 3. インテグレーションハブ
- **サポートされるサービス**:
  - 会計: freee、マネーフォワード、弥生会計
  - コミュニケーション: Slack、Microsoft Teams
  - プロジェクト管理: Jira、Asana
- **OAuth 2.0認証**: セキュアな外部サービス連携
- **双方向データ同期**: リアルタイム、スケジュール実行対応

### 4. 監査ログシステム
- **完全な変更追跡**: 誰が、いつ、何を、どのように変更したか
- **異常検知**: 深夜の大量操作、権限エスカレーション、大量削除
- **コンプライアンス対応**: 監査証跡の長期保存、エクスポート機能

### 5. データガバナンス
- **データ保持ポリシー**: 法的要件に基づく自動削除・匿名化
- **アクセス制御**: 個人情報、給与情報、パフォーマンスデータの厳格な管理
- **暗号化要件**: 機密データの保護

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    エンタープライズコンソール                    │
├─────────────────┬─────────────────┬─────────────────────────┤
│   統合ダッシュボード  │  設定管理UI    │    通知センター        │
├─────────────────┴─────────────────┴─────────────────────────┤
│                        サービス層                              │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│   RBAC   │AIエージェント│インテグレーション│監査ログ │データガバナンス│
├──────────┴──────────┴──────────┴──────────┴────────────────┤
│                    PostgreSQLデータベース                      │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 セットアップ

### 前提条件
- Node.js 20 LTS以上
- PostgreSQL 15以上
- TypeScript 5.0以上

### インストール

```bash
# 依存関係のインストール
npm install

# データベースのセットアップ
psql -U postgres -d aios -f src/v3.2.0/enterprise-console/database-schema.sql

# 開発サーバーの起動
npm run dev:console
```

### 環境変数

```env
# データベース接続
DATABASE_URL=postgresql://user:password@localhost:5432/aios

# セッション管理
SESSION_SECRET=your-secret-key

# OAuth設定（各サービス用）
FREEE_CLIENT_ID=xxx
FREEE_CLIENT_SECRET=xxx
SLACK_CLIENT_ID=xxx
SLACK_CLIENT_SECRET=xxx
```

## 📝 使用方法

### 基本的なワークフロー

1. **初期設定**
   - スーパー管理者でログイン
   - 企業情報の登録
   - 部門構造の設定

2. **役割と権限の設定**
   - カスタム役割の作成
   - 権限の割り当て
   - ユーザーへの役割付与

3. **AIエージェントの設定**
   - 必要なエージェントの有効化
   - 感度やアラート閾値の調整
   - 通知先の設定

4. **外部サービス連携**
   - OAuth認証の実行
   - データマッピングの設定
   - 同期スケジュールの設定

### コード例

```typescript
// RBACサービスの使用例
import { RBACService } from './services/RBACService';

const rbacService = new RBACService(db);

// 権限チェック
const hasPermission = await rbacService.checkPermission(
  userId,
  'expense',
  'approve',
  { departmentId: 'dept1', amount: 50000 }
);

// 役割の割り当て
await rbacService.assignRoleToUser(
  'user123',
  'department_manager',
  'admin1',
  { departmentId: 'dept1' }
);
```

```typescript
// 監査ログの記録
import { AuditLogService } from './services/AuditLogService';

const auditService = new AuditLogService(db);

await auditService.log({
  entityType: 'agent_config',
  entityId: 'payroll_agent',
  action: 'update',
  changes: {
    before: { enabled: false },
    after: { enabled: true }
  },
  userId: currentUser.id,
  reason: '月次給与計算のため有効化'
});
```

## 🔒 セキュリティ

### 実装済みのセキュリティ対策

1. **認証・認可**
   - JWTベースの認証
   - 役割ベースのアクセス制御
   - セッション管理

2. **データ保護**
   - 機密情報の暗号化
   - SQLインジェクション対策
   - XSS対策

3. **監査とコンプライアンス**
   - 全操作の監査ログ
   - 異常検知アラート
   - データ保持ポリシー

### セキュリティベストプラクティス

```typescript
// 権限チェックの実装例
app.post('/api/v3.2.0/agents/:id/config', async (req, res) => {
  // 1. 認証チェック
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 2. 権限チェック
  const hasPermission = await rbacService.checkPermission(
    req.user.id,
    'agent_config',
    'update'
  );

  if (!hasPermission) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. 監査ログ記録
  await auditService.log({
    entityType: 'agent_config',
    entityId: req.params.id,
    action: 'update',
    changes: { before: oldConfig, after: req.body },
    userId: req.user.id,
    userIp: req.ip,
    userAgent: req.headers['user-agent'],
    sessionId: req.sessionID
  });

  // 4. 実際の更新処理
  // ...
});
```

## 📊 パフォーマンス指標

### 目標値
- API応答時間: < 200ms (95%ile)
- ダッシュボード読み込み: < 1秒
- 同時接続数: 1,000+
- データベースクエリ: < 50ms

### 最適化手法
- インデックスの適切な配置
- クエリの最適化
- キャッシング戦略
- 非同期処理

## 🧪 テスト

```bash
# 単体テスト
npm run test:unit

# 統合テスト
npm run test:integration

# E2Eテスト
npm run test:e2e

# カバレッジレポート
npm run test:coverage
```

## 📚 関連ドキュメント

- [API仕様書](./docs/api-spec.md)
- [データベース設計](./database-schema.sql)
- [型定義](./types/index.ts)
- [セキュリティガイドライン](./docs/security.md)

## 🛣️ 今後の拡張計画

### Phase 3残り30%の実装
1. **高度な自律性機能**
   - 目標ベースの行動計画
   - マルチエージェント交渉
   - 強化学習による最適化

2. **経営シミュレーション・エージェント**
   - What-ifシナリオ分析エンジン
   - ROI最適化提案
   - リスク評価

3. **エンタープライズ統合**
   - レガシーシステム橋渡し
   - 複雑なワークフロー自動化
   - 組織横断的な最適化

## 📞 サポート

技術的な質問や問題がある場合は、以下にお問い合わせください：
- GitHub Issues: [AI-OS Repository](https://github.com/aios/enterprise-console)
- ドキュメント: [AI-OS Docs](https://docs.aios.com)

---

*AI-OS v3.2.0 - 企業全体のパフォーマンスを最適化する知的生命体*