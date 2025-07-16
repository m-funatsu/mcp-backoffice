# 🚀 本番デプロイメントガイド

## 概要
MCP勤怠管理システムの本番環境デプロイメント手順です。

## 📋 事前準備

### 1. インフラ要件
```bash
# 最小システム要件
CPU: 2 cores
RAM: 4GB
Storage: 50GB SSD
Network: 100Mbps

# 推奨システム要件
CPU: 4 cores
RAM: 8GB
Storage: 100GB SSD
Network: 1Gbps
```

### 2. 必要なソフトウェア
```bash
# Docker & Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. SSL証明書準備
```bash
# Let's Encrypt証明書取得
sudo certbot certonly --standalone -d your-domain.com

# 証明書をSSLディレクトリにコピー
mkdir -p ssl
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
```

## 🔧 環境設定

### 1. 環境変数設定
```bash
# .env.production をコピー
cp .env.production .env

# 必要な値を設定
export DATABASE_URL="postgresql://username:password@localhost:5432/attendance"
export POSTGRES_USER="your_db_user"
export POSTGRES_PASSWORD="your_secure_password"
export SESSION_SECRET="your-secure-session-secret"
```

### 2. セキュリティ設定
```bash
# データベースパスワード生成
openssl rand -base64 32

# セッションシークレット生成
openssl rand -base64 64

# JWT秘密鍵生成
openssl rand -base64 32
```

### 3. ファイアウォール設定
```bash
# UFW設定
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# fail2ban設定
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 🚀 デプロイメント手順

### 1. アプリケーションビルド
```bash
# リポジトリクローン
git clone https://github.com/your-repo/mcp-attendance.git
cd mcp-attendance

# 本番用ビルド
docker-compose -f docker-compose.prod.yml build
```

### 2. データベース初期化
```bash
# PostgreSQL起動
docker-compose -f docker-compose.prod.yml up -d postgres

# 初期化完了を待機
docker-compose -f docker-compose.prod.yml logs -f postgres

# データベース初期化
docker-compose -f docker-compose.prod.yml exec postgres psql -U ${POSTGRES_USER} -d attendance -f /docker-entrypoint-initdb.d/01-schema.sql
```

### 3. アプリケーション起動
```bash
# 全サービス起動
docker-compose -f docker-compose.prod.yml up -d

# 起動確認
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f app
```

### 4. ヘルスチェック
```bash
# アプリケーション確認
curl -f http://localhost:3000/health

# データベース確認
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U ${POSTGRES_USER}

# Redis確認
docker-compose -f docker-compose.prod.yml exec redis redis-cli ping
```

## 📊 監視・運用

### 1. ログ監視
```bash
# アプリケーションログ
docker-compose -f docker-compose.prod.yml logs -f app

# データベースログ
docker-compose -f docker-compose.prod.yml logs -f postgres

# Nginxログ
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### 2. メトリクス監視
```bash
# Prometheusメトリクス確認
curl http://localhost:9090/metrics

# データベース統計
docker-compose -f docker-compose.prod.yml exec postgres psql -U ${POSTGRES_USER} -d attendance -c "SELECT * FROM pg_stat_database WHERE datname = 'attendance';"
```

### 3. バックアップ設定
```bash
# データベースバックアップスクリプト
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U ${POSTGRES_USER} attendance | gzip > "${BACKUP_DIR}/attendance_${DATE}.sql.gz"
find ${BACKUP_DIR} -name "attendance_*.sql.gz" -mtime +7 -delete
EOF

chmod +x backup.sh

# Cron設定
crontab -e
# 毎日午前2時にバックアップ
0 2 * * * /path/to/backup.sh
```

## 🔄 アップデート手順

### 1. ローリングアップデート
```bash
# 新しいバージョンのプル
git pull origin main

# 新しいイメージビルド
docker-compose -f docker-compose.prod.yml build app

# アプリケーションの更新
docker-compose -f docker-compose.prod.yml up -d app

# 動作確認
curl -f http://localhost:3000/health
```

### 2. データベースマイグレーション
```bash
# マイグレーション実行
docker-compose -f docker-compose.prod.yml exec app npm run migrate

# 動作確認
docker-compose -f docker-compose.prod.yml exec app npm run test:integration
```

## 🔐 セキュリティ対策

### 1. 定期的なセキュリティ更新
```bash
# システムパッケージ更新
sudo apt update && sudo apt upgrade -y

# Docker イメージ更新
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### 2. SSL証明書更新
```bash
# Let's Encrypt自動更新
sudo crontab -e
# 毎月1日午前3時に更新
0 3 1 * * certbot renew --quiet
```

### 3. アクセスログ監視
```bash
# 不審なアクセスパターンの確認
sudo tail -f /var/log/nginx/access.log | grep -E "(40[0-9]|50[0-9])"

# IP制限の追加
# nginx.confでallow/deny設定
```

## 📞 トラブルシューティング

### 1. 一般的な問題
```bash
# コンテナ状態確認
docker-compose -f docker-compose.prod.yml ps

# リソース使用量確認
docker stats

# ディスク使用量確認
df -h
du -sh /var/lib/docker/
```

### 2. パフォーマンス問題
```bash
# データベース接続数確認
docker-compose -f docker-compose.prod.yml exec postgres psql -U ${POSTGRES_USER} -d attendance -c "SELECT count(*) FROM pg_stat_activity;"

# スロークエリ確認
docker-compose -f docker-compose.prod.yml exec postgres psql -U ${POSTGRES_USER} -d attendance -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### 3. 復旧手順
```bash
# 緊急時の復旧
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# バックアップからの復元
gunzip -c /backups/attendance_YYYYMMDD_HHMMSS.sql.gz | docker-compose -f docker-compose.prod.yml exec -T postgres psql -U ${POSTGRES_USER} attendance
```

## 📈 パフォーマンス最適化

### 1. データベース最適化
```sql
-- インデックス最適化
ANALYZE;
REINDEX DATABASE attendance;

-- 統計情報更新
UPDATE pg_stat_statements SET calls = 0, total_time = 0;
```

### 2. アプリケーション最適化
```bash
# Node.js最適化
export NODE_OPTIONS="--max-old-space-size=4096"

# Redis キャッシュ設定
docker-compose -f docker-compose.prod.yml exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## 🚨 監視・アラート

### 1. Prometheusアラート設定
```yaml
# alerts.yml
groups:
  - name: mcp-attendance
    rules:
      - alert: HighCPUUsage
        expr: cpu_usage > 80
        for: 5m
        labels:
          severity: warning
      - alert: DatabaseConnectionHigh
        expr: pg_stat_activity_count > 50
        for: 5m
        labels:
          severity: critical
```

### 2. 外部監視サービス
```bash
# Uptime Robot設定
curl -X POST https://api.uptimerobot.com/v2/newMonitor \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your_api_key",
    "url": "https://your-domain.com/health",
    "type": 1,
    "friendly_name": "MCP Attendance Health Check"
  }'
```

---

## 📞 サポート

本番環境で問題が発生した場合は、以下の順序で対応してください：

1. **ログ確認**: アプリケーション・データベース・Nginxログを確認
2. **リソース確認**: CPU・メモリ・ディスク使用量を確認
3. **ネットワーク確認**: 接続性とファイアウォール設定を確認
4. **バックアップ確認**: 最新のバックアップが正常に作成されているか確認

緊急時は即座にバックアップからの復旧を検討してください。