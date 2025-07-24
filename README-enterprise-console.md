# AI-OS v3.2.0 エンタープライズ設定管理コンソール

## 概要
AI-Native Enterprise Operating System (AI-OS) のエンタープライズ設定管理コンソールです。
役割と権限管理(RBAC)、AIエージェント設定、統合管理などの高度な管理機能を提供します。

## セットアップ

### 前提条件
- Node.js 18以上
- PostgreSQL 15以上
- npm または yarn

### インストール手順

1. 依存関係のインストール
```bash
npm install
```

2. 環境設定ファイルの作成
```bash
cp .env.example .env
# .envファイルを編集して適切な値を設定
```

3. データベースのセットアップ
```bash
npm run postgres:start
npm run db:init
```

## 起動方法

### 開発環境での起動

1. フロントエンドとAPIサーバーを同時に起動
```bash
npm run dev:all
```

または個別に起動：

2. APIサーバーのみ起動
```bash
npm run api:dev
```

3. フロントエンドのみ起動
```bash
npm run console:dev
```

## アクセスURL

- フロントエンド: http://localhost:5173/enterprise-console/
- APIサーバー: http://localhost:3001/api/v3.2.0
- ヘルスチェック: http://localhost:3001/health

## 主な機能

### 1. システム概要ダッシュボード
- リアルタイムシステムメトリクス
- サービス稼働状況
- パフォーマンスグラフ

### 2. 役割と権限管理 (RBAC)
- 柔軟な役割定義
- 細かい権限設定
- 部門別・期間限定の権限付与

### 3. AIエージェント管理
- エージェントの有効/無効切り替え
- 感度設定と通知設定
- 手動実行とモニタリング

### 4. 統合管理
- 外部サービス連携設定
- OAuth認証管理
- Webhook設定

### 5. 監査ログ
- 全操作の完全追跡
- 異常検知機能
- コンプライアンスレポート

### 6. データガバナンス
- データアクセス制御
- 保持期間設定
- プライバシー設定

## アーキテクチャ

### フロントエンド
- React 19.1.0
- Material-UI v7.2.0
- TypeScript
- Vite

### バックエンド
- Express.js
- PostgreSQL
- JWT認証
- WebSocket対応

## 開発

### テストの実行
```bash
npm test
```

### ビルド
```bash
npm run build
npm run console:build
```

### 本番環境での起動
```bash
npm start
npm run api:start
```

## トラブルシューティング

### ポートが使用中の場合
```bash
# APIサーバーのポートを変更
API_PORT=3002 npm run api:dev

# フロントエンドのポートを変更
# vite.config.tsのserver.portを変更
```

### データベース接続エラー
```bash
# PostgreSQLが起動していることを確認
npm run postgres:start

# 接続情報を確認
# .envのDATABASE_URLを確認
```

## ライセンス
MIT License