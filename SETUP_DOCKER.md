# 🐳 Docker環境構築ガイド

## 概要
MCP勤怠管理システムのPostgreSQL環境をDocker Composeで構築します。

## 前提条件
- Docker Desktop がインストールされている
- Node.js 18+ がインストールされている
- npm または yarn が利用可能

## 🚀 クイックスタート

### 1. 環境変数設定
```bash
# .env.exampleから.envをコピー
cp .env.example .env

# 必要に応じて.envを編集
# DATABASE_URL=postgresql://postgres:password@localhost:5432/attendance
# TEST_DATABASE_URL=postgresql://postgres:password@localhost:5433/attendance_test
```

### 2. Docker環境起動
```bash
# PostgreSQL起動
npm run docker:up

# 初期化完了まで待機（約10秒）
npm run db:setup

# 状態確認
npm run docker:logs
```

### 3. 動作確認
```bash
# ビルド
npm run build

# テスト実行
npm test

# 開発サーバー起動
npm run start
```

## 📋 利用可能なコマンド

### Docker操作
```bash
npm run docker:up      # PostgreSQL起動
npm run docker:down    # PostgreSQL停止
npm run docker:logs    # ログ確認
npm run docker:reset   # 完全リセット（データ削除）
```

### データベース操作
```bash
npm run db:setup       # 初期化（Docker起動含む）
npm run db:init        # データベース初期化のみ
npm run migrate        # マイグレーション実行
npm run test-data      # テストデータ投入
```

### 開発・テスト
```bash
npm run build          # TypeScriptビルド
npm run test           # 全テスト実行
npm run test:unit      # 単体テスト
npm run test:integration # 統合テスト
npm run start          # サーバー起動
```

## 🔧 トラブルシューティング

### ポート競合エラー
```bash
# 既存のPostgreSQLサービスを停止
sudo systemctl stop postgresql

# または別のポートを使用（docker-compose.yml編集）
ports:
  - "5434:5432"  # 5432 → 5434に変更
```

### データベース接続エラー
```bash
# コンテナ状態確認
docker ps

# PostgreSQLログ確認
docker logs mcp-attendance-postgres

# 手動接続テスト
psql postgresql://postgres:password@localhost:5432/attendance
```

### 初期化エラー
```bash
# 完全リセット
npm run docker:reset

# 再初期化
npm run db:setup
```

## 📊 データベース構成

### 本番用データベース
- **コンテナ**: `mcp-attendance-postgres`
- **ポート**: `5432`
- **データベース名**: `attendance`

### テスト用データベース
- **コンテナ**: `mcp-attendance-postgres-test`
- **ポート**: `5433`
- **データベース名**: `attendance_test`

## 🔐 セキュリティ設定

### 本番環境向け
```bash
# 強力なパスワード設定
POSTGRES_PASSWORD=your_strong_password_here

# SSL有効化
DB_SSL_ENABLED=true
DB_SSL_REJECT_UNAUTHORIZED=true
```

### 開発環境向け
```bash
# 簡易設定（デフォルト）
POSTGRES_PASSWORD=password
DB_SSL_ENABLED=false
```

## 💾 バックアップ・復旧

### バックアップ
```bash
# データベースバックアップ
docker exec mcp-attendance-postgres pg_dump -U postgres attendance > backup.sql

# 圧縮バックアップ
docker exec mcp-attendance-postgres pg_dump -U postgres attendance | gzip > backup.sql.gz
```

### 復旧
```bash
# バックアップから復旧
docker exec -i mcp-attendance-postgres psql -U postgres attendance < backup.sql

# 圧縮ファイルから復旧
gunzip -c backup.sql.gz | docker exec -i mcp-attendance-postgres psql -U postgres attendance
```

## 🌐 本番デプロイ準備

### 環境変数
```bash
# 本番環境用.env.production
DATABASE_URL=postgresql://user:password@prod-host:5432/attendance
NODE_ENV=production
DB_SSL_ENABLED=true
DB_MAX_CONNECTIONS=100
```

### Docker Compose Override
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - /var/lib/postgresql/data:/var/lib/postgresql/data
    restart: always
```

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. **Docker Desktop** が正常に起動している
2. **ポート5432, 5433** が使用可能
3. **環境変数** が正しく設定されている
4. **ログ** でエラーメッセージを確認

詳細なログは `npm run docker:logs` で確認できます。