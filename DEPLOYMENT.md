# MCP勤怠管理システム デプロイメントガイド

## Claude Desktop連携設定

### 前提条件
- Node.js 18+ がインストールされていること
- Claude Desktop がインストールされていること
- 本プロジェクトがビルド済みであること

### 1. プロジェクトのビルド

```bash
cd /path/to/MCP_勤怠
npm install
npm run build
```

### 2. データベースの初期化

```bash
# SQLiteを使用する場合
npm run init-db

# PostgreSQLを使用する場合（オプション）
npm run init-pg
```

### 3. Claude Desktop設定

Claude Desktopの設定ファイルを編集します：

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

設定内容：
```json
{
  "mcpServers": {
    "attendance-management": {
      "command": "node",
      "args": ["dist/server.js"],
      "cwd": "/path/to/your/MCP_勤怠",
      "env": {
        "NODE_ENV": "production",
        "DB_PATH": "attendance.db"
      }
    }
  }
}
```

**重要:** `cwd` パスを実際のプロジェクトディレクトリに変更してください。

### 4. Claude Desktopの再起動

設定変更後、Claude Desktopを完全に終了し、再起動します。

### 5. 動作確認

Claude Desktopで以下のように話しかけて動作を確認：

```
新しい従業員を追加してください。
名前：田中太郎
部署：開発部
職位：エンジニア
時給：3000円
入社日：2024年1月1日
```

## 本格運用のための設定

### 環境変数設定

本格運用時は環境変数で設定を行います：

```bash
# データベースパス
export DB_PATH="/path/to/production/attendance.db"

# PostgreSQL使用時
export DATABASE_URL="postgresql://user:password@localhost:5432/attendance"

# ログレベル
export LOG_LEVEL="info"

# セキュリティ設定
export ENABLE_AUTH="true"
export JWT_SECRET="your-secret-key"
```

### systemd サービス設定（Linux）

```ini
# /etc/systemd/system/mcp-attendance.service
[Unit]
Description=MCP Attendance Management Server
After=network.target

[Service]
Type=simple
User=attendance
WorkingDirectory=/opt/mcp-attendance
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=DB_PATH=/var/lib/mcp-attendance/attendance.db

[Install]
WantedBy=multi-user.target
```

### Docker デプロイメント

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY schema.sql ./

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  mcp-attendance:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_PATH=/data/attendance.db
    volumes:
      - attendance_data:/data
    restart: unless-stopped

volumes:
  attendance_data:
```

## セキュリティ設定

### ファイアウォール設定

```bash
# UFW (Ubuntu)
sudo ufw allow from 127.0.0.1 to any port 3000
sudo ufw deny 3000

# iptables
iptables -A INPUT -s 127.0.0.1 -p tcp --dport 3000 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

### SSL/TLS証明書（HTTPS対応）

```bash
# Let's Encrypt使用例
sudo certbot certonly --standalone -d your-domain.com
```

### データベースバックアップ

```bash
# SQLite バックアップスクリプト
#!/bin/bash
DB_PATH="/path/to/attendance.db"
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)

sqlite3 $DB_PATH ".backup $BACKUP_DIR/attendance_backup_$DATE.db"

# 古いバックアップの削除（30日以上前）
find $BACKUP_DIR -name "attendance_backup_*.db" -mtime +30 -delete
```

## 監視とログ

### ログ設定

```javascript
// 本格運用用のログ設定例
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### ヘルスチェック

```bash
# サーバーヘルスチェック用エンドポイント
curl -f http://localhost:3000/health || exit 1
```

### システム監視

```bash
# Prometheus metrics例
# メトリクス収集用のエンドポイントを追加
# /metrics エンドポイントでシステム指標を公開
```

## パフォーマンス最適化

### データベース最適化

```sql
-- インデックス作成
CREATE INDEX idx_time_records_employee_date ON time_records(employee_id, date);
CREATE INDEX idx_time_records_date_range ON time_records(date);
CREATE INDEX idx_employees_active ON employees(is_active);

-- 定期的なVACUUM（SQLite）
PRAGMA auto_vacuum = INCREMENTAL;
```

### Node.js最適化

```javascript
// プロダクション用設定
process.env.NODE_ENV = 'production';
process.env.UV_THREADPOOL_SIZE = '16'; // ファイルI/O並列度向上
```

## トラブルシューティング

### よくある問題と解決方法

1. **Claude Desktopで認識されない**
   - 設定ファイルのパスを確認
   - Node.jsのバージョンを確認（18+）
   - Claude Desktopの再起動

2. **データベース接続エラー**
   - ファイルパーミッションを確認
   - ディスクスペースを確認
   - SQLiteファイルの整合性チェック

3. **パフォーマンスが遅い**
   - データベースインデックスを確認
   - 古いデータのアーカイブ
   - システムリソースの監視

### ログファイルの確認

```bash
# アプリケーションログ
tail -f logs/combined.log

# システムログ（Linux）
journalctl -u mcp-attendance -f

# エラーログのみ
tail -f logs/error.log
```

## 運用チェックリスト

### 日次チェック
- [ ] サーバーが正常に動作している
- [ ] データベースバックアップが完了している
- [ ] エラーログに異常がない
- [ ] ディスクスペースが十分にある

### 週次チェック
- [ ] パフォーマンス指標の確認
- [ ] セキュリティログの確認
- [ ] データ整合性チェック
- [ ] バックアップの復元テスト

### 月次チェック
- [ ] システムアップデートの適用
- [ ] 古いログファイルのローテーション
- [ ] パフォーマンス分析レポート
- [ ] 災害復旧計画の見直し

このガイドに従って設定することで、MCP勤怠管理システムを安全かつ効率的に本格運用できます。