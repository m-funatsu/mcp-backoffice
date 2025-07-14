# PostgreSQL + MCP統合セットアップガイド

## 概要

このガイドでは、勤怠管理システムをPostgreSQLに移行し、PostgreSQL MCPサーバーと統合する手順を説明します。

## 前提条件

- PostgreSQL 12以上がインストールされている
- Node.js 18以上がインストールされている
- Claude Desktop（Pro plan）がインストールされている

## 1. PostgreSQL環境の準備

### 1.1 PostgreSQLの起動

```bash
# PostgreSQLサービスの起動
sudo systemctl start postgresql
# または
brew services start postgresql
```

### 1.2 データベースの作成

```bash
# PostgreSQLに接続
psql -U postgres

# データベースの作成
CREATE DATABASE attendance_db;

# データベースの確認
\l

# 接続テスト
\c attendance_db
```

## 2. 環境変数の設定

### 2.1 .envファイルの作成

```bash
# .envファイルをコピー
cp .env.example .env

# 必要に応じてデータベース接続情報を編集
vi .env
```

### 2.2 環境変数の内容

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=attendance_db
DB_USER=postgres
DB_PASSWORD=your_password_here
NODE_ENV=production
```

## 3. システムの初期化

### 3.1 依存関係のインストール

```bash
# PostgreSQLクライアントライブラリのインストール
npm install

# TypeScriptビルド
npm run build
```

### 3.2 PostgreSQLデータベースの初期化

```bash
# PostgreSQLスキーマの作成
npm run init-pg
```

### 3.3 既存データの移行（必要に応じて）

```bash
# SQLiteからPostgreSQLへのデータ移行
npm run migrate
```

## 4. MCP統合の設定

### 4.1 Claude Desktop設定ファイルの配置

**Windows:**
```bash
# 設定ファイルのコピー
cp claude_desktop_config.json "%APPDATA%\Claude\claude_desktop_config.json"
```

**macOS:**
```bash
# 設定ファイルのコピー
cp claude_desktop_config.json "~/Library/Application Support/Claude/claude_desktop_config.json"
```

### 4.2 設定ファイルの内容確認

```json
{
  "mcpServers": {
    "postgresql": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://postgres:password@localhost:5432/attendance_db"],
      "env": {}
    },
    "attendance-system": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "/path/to/your/project",
      "env": {
        "NODE_ENV": "production",
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_NAME": "attendance_db",
        "DB_USER": "postgres",
        "DB_PASSWORD": "password"
      }
    }
  }
}
```

**重要:** `cwd`パスを実際のプロジェクトパスに変更してください。

## 5. 動作確認

### 5.1 PostgreSQL接続テスト

```bash
# PostgreSQLサーバーの起動
npm run start

# 別のターミナルで接続テスト
psql -U postgres -d attendance_db -c "SELECT * FROM employees LIMIT 5;"
```

### 5.2 Claude Desktop再起動

1. Claude Desktopを完全に終了
2. Claude Desktopを再起動
3. 新しいチャットを開始

### 5.3 統合テスト

Claude Desktopで以下のコマンドを試してください：

```
# 勤怠管理MCPサーバーのテスト
従業員「テスト太郎」を開発部のエンジニアとして時給3000円で追加してください。

# PostgreSQL MCPサーバーのテスト
従業員テーブルから全ての従業員を取得してください。

# 複合操作のテスト
今月の勤怠データを集計して、残業時間が多い従業員を教えてください。
```

## 6. 運用

### 6.1 定期的なバックアップ

```bash
# データベースのバックアップ
pg_dump -U postgres attendance_db > backup_$(date +%Y%m%d).sql

# バックアップの復元
psql -U postgres attendance_db < backup_20240101.sql
```

### 6.2 ログの監視

```bash
# アプリケーションログの確認
tail -f /var/log/attendance-system.log

# PostgreSQLログの確認
tail -f /var/log/postgresql/postgresql-*.log
```

## 7. トラブルシューティング

### 7.1 PostgreSQL接続エラー

```bash
# PostgreSQLサービスの状態確認
sudo systemctl status postgresql

# 接続設定の確認
psql -U postgres -h localhost -p 5432 -d attendance_db
```

### 7.2 MCP接続エラー

1. Claude Desktop設定ファイルの構文確認
2. パスの確認（`cwd`設定）
3. 環境変数の確認
4. Claude Desktop再起動

### 7.3 権限エラー

```bash
# PostgreSQLユーザーの権限確認
psql -U postgres -c "\du"

# データベースの権限確認
psql -U postgres -c "\l"
```

## 8. 利用可能な機能

### 8.1 勤怠管理MCPサーバー

- 出勤・退勤打刻
- 給与計算
- 法令チェック
- 従業員管理

### 8.2 PostgreSQL MCPサーバー

- 自然言語でのSQL実行
- データ分析
- レポート生成
- 複雑な集計処理

## 9. パフォーマンス最適化

### 9.1 インデックスの確認

```sql
-- インデックスの一覧表示
\di

-- インデックスの使用状況確認
SELECT * FROM pg_stat_user_indexes;
```

### 9.2 クエリパフォーマンス

```sql
-- スロークエリの確認
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

これで PostgreSQL + MCP統合の勤怠管理システムが完成です。