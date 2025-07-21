# AI-Native Strategic HR Platform
## 導入・展開ガイド v1.0.0

### 目次
1. [システム要件](#システム要件)
2. [インストール手順](#インストール手順)
3. [初期設定](#初期設定)
4. [データ移行](#データ移行)
5. [セキュリティ設定](#セキュリティ設定)
6. [モニタリング設定](#モニタリング設定)
7. [バックアップ・リカバリ](#バックアップリカバリ)
8. [トラブルシューティング](#トラブルシューティング)

---

## システム要件

### ハードウェア要件

#### 最小構成（〜50名）
- **CPU**: 4コア以上
- **メモリ**: 16GB RAM
- **ストレージ**: 500GB SSD
- **ネットワーク**: 100Mbps

#### 推奨構成（50〜500名）
- **CPU**: 8コア以上
- **メモリ**: 32GB RAM
- **ストレージ**: 1TB SSD (RAID構成推奨)
- **ネットワーク**: 1Gbps

#### エンタープライズ構成（500名〜）
- **CPU**: 16コア以上 × 複数ノード
- **メモリ**: 64GB RAM以上 × 複数ノード
- **ストレージ**: 2TB+ NVMe SSD (RAID10)
- **ネットワーク**: 10Gbps冗長構成

### ソフトウェア要件

#### オペレーティングシステム
- Ubuntu 20.04 LTS / 22.04 LTS
- Red Hat Enterprise Linux 8.x / 9.x
- CentOS Stream 8 / 9
- Amazon Linux 2 / 2023

#### 必須ソフトウェア
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 15
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update
sudo apt-get install postgresql-15 postgresql-client-15

# Redis 7
sudo apt-get install redis-server

# Nginx
sudo apt-get install nginx

# Docker (オプション)
curl -fsSL https://get.docker.com | sh
```

---

## インストール手順

### 1. システムパッケージのインストール

```bash
# 依存パッケージ
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  git \
  curl \
  wget \
  python3 \
  python3-pip \
  imagemagick \
  tesseract-ocr \
  tesseract-ocr-jpn
```

### 2. アプリケーションのデプロイ

```bash
# アプリケーションディレクトリ作成
sudo mkdir -p /opt/ai-hr-platform
sudo chown $USER:$USER /opt/ai-hr-platform
cd /opt/ai-hr-platform

# ソースコード取得
git clone https://github.com/your-org/ai-hr-platform.git .
# または
tar -xzf ai-hr-platform-v1.0.0.tar.gz

# 依存関係インストール
npm ci --production

# ビルド実行
npm run build

# 環境変数設定
cp .env.example .env.production
nano .env.production
```

### 3. データベース設定

```sql
-- PostgreSQLユーザー作成
sudo -u postgres psql

CREATE USER hrplatform WITH PASSWORD 'your_secure_password';
CREATE DATABASE hrplatform_production OWNER hrplatform;
GRANT ALL PRIVILEGES ON DATABASE hrplatform_production TO hrplatform;

-- TimescaleDB拡張
\c hrplatform_production
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS uuid-ossp;
```

### 4. データベースマイグレーション

```bash
# マイグレーション実行
npm run migrate:production

# 初期データ投入
npm run seed:production
```

### 5. Webサーバー設定

```nginx
# /etc/nginx/sites-available/ai-hr-platform
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;
    
    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # APIレート制限
        limit_req zone=api_limit burst=20 nodelay;
    }
}
```

### 6. サービス登録

```bash
# systemdサービスファイル作成
sudo nano /etc/systemd/system/ai-hr-platform.service
```

```ini
[Unit]
Description=AI-Native Strategic HR Platform
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=hrplatform
WorkingDirectory=/opt/ai-hr-platform
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ai-hr-platform
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
# サービス有効化・起動
sudo systemctl daemon-reload
sudo systemctl enable ai-hr-platform
sudo systemctl start ai-hr-platform
sudo systemctl status ai-hr-platform
```

---

## 初期設定

### 1. 管理者アカウント作成

```bash
# CLIツールで管理者作成
npm run cli:create-admin -- \
  --email admin@your-company.com \
  --name "システム管理者" \
  --password "temporary_password"
```

### 2. 組織情報設定

```bash
# 組織初期設定
npm run cli:setup-org -- \
  --name "株式会社Example" \
  --industry "IT" \
  --employee-count 100 \
  --fiscal-year-start 4
```

### 3. 基本設定

#### 勤怠設定
```json
{
  "workingHours": {
    "standardHours": 8,
    "coreTimeStart": "10:00",
    "coreTimeEnd": "15:00",
    "flexEnabled": true
  },
  "holidays": {
    "weekends": ["saturday", "sunday"],
    "nationalHolidays": true,
    "companyHolidays": []
  },
  "overtime": {
    "monthlyLimit": 45,
    "yearlyLimit": 360,
    "specialClauseLimit": 100,
    "alertThreshold": 40
  }
}
```

#### 給与設定
```json
{
  "payroll": {
    "payDay": 25,
    "cutoffDay": 15,
    "currency": "JPY",
    "taxTables": "2025"
  },
  "deductions": {
    "socialInsurance": true,
    "employmentInsurance": true,
    "incomeTax": true,
    "residentTax": true
  }
}
```

---

## データ移行

### 1. 既存システムからのデータエクスポート

```bash
# CSVテンプレートダウンロード
wget https://docs.ai-hr-platform.jp/templates/import-templates.zip
unzip import-templates.zip
```

### 2. データ変換・検証

```bash
# データ検証ツール実行
npm run cli:validate-import -- \
  --employees employees.csv \
  --time-records time_records.csv \
  --payroll payroll_history.csv
```

### 3. インポート実行

```bash
# バッチインポート
npm run cli:import -- \
  --type employees \
  --file employees.csv \
  --dry-run  # まずドライラン実行

# 本番インポート
npm run cli:import -- \
  --type employees \
  --file employees.csv \
  --commit
```

### 4. データ整合性確認

```sql
-- 従業員数確認
SELECT COUNT(*) FROM employees WHERE is_active = true;

-- 勤怠データ確認
SELECT 
    DATE_TRUNC('month', date) as month,
    COUNT(DISTINCT employee_id) as employees,
    COUNT(*) as records
FROM time_records
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC;
```

---

## セキュリティ設定

### 1. ファイアウォール設定

```bash
# UFW設定
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. SSL証明書設定

```bash
# Let's Encrypt証明書取得
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. セキュリティ強化

```bash
# fail2ban設定
sudo apt-get install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# 不要なサービス無効化
sudo systemctl disable bluetooth
sudo systemctl disable cups
```

### 4. データベースセキュリティ

```sql
-- 接続制限設定
-- postgresql.conf
listen_addresses = 'localhost'
ssl = on

-- pg_hba.conf
local   all   all                     peer
host    all   all   127.0.0.1/32      scram-sha-256
host    all   all   ::1/128           scram-sha-256
```

---

## モニタリング設定

### 1. アプリケーションモニタリング

```bash
# PM2インストール・設定
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 2. システムモニタリング

```bash
# Prometheus Node Exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xvfz node_exporter-1.6.1.linux-amd64.tar.gz
sudo cp node_exporter-1.6.1.linux-amd64/node_exporter /usr/local/bin/
```

### 3. ログ管理

```bash
# ログローテーション設定
sudo nano /etc/logrotate.d/ai-hr-platform
```

```
/opt/ai-hr-platform/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 hrplatform hrplatform
    sharedscripts
    postrotate
        systemctl reload ai-hr-platform > /dev/null
    endscript
}
```

### 4. アラート設定

```yaml
# alerting-rules.yml
groups:
  - name: hr_platform_alerts
    rules:
      - alert: HighCPUUsage
        expr: cpu_usage > 80
        for: 5m
        annotations:
          summary: "High CPU usage detected"
          
      - alert: DatabaseConnectionFailure
        expr: pg_up == 0
        for: 1m
        annotations:
          summary: "PostgreSQL connection failed"
```

---

## バックアップ・リカバリ

### 1. 自動バックアップ設定

```bash
# バックアップスクリプト
sudo nano /opt/ai-hr-platform/scripts/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backup/ai-hr-platform"
DATE=$(date +%Y%m%d_%H%M%S)

# データベースバックアップ
pg_dump -U hrplatform -h localhost hrplatform_production | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# ファイルバックアップ
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /opt/ai-hr-platform/uploads

# 古いバックアップ削除（30日以上）
find $BACKUP_DIR -type f -mtime +30 -delete
```

### 2. cronジョブ設定

```bash
# crontab -e
0 2 * * * /opt/ai-hr-platform/scripts/backup.sh
0 */6 * * * /opt/ai-hr-platform/scripts/incremental-backup.sh
```

### 3. リストア手順

```bash
# データベースリストア
gunzip < /backup/ai-hr-platform/db_20250801_020000.sql.gz | psql -U hrplatform hrplatform_production

# ファイルリストア
tar -xzf /backup/ai-hr-platform/files_20250801_020000.tar.gz -C /
```

### 4. 災害復旧計画

```yaml
# disaster-recovery-plan.yml
rto: 4h  # Recovery Time Objective
rpo: 1h  # Recovery Point Objective

procedures:
  - step: 1
    action: "新サーバー準備"
    time: "30min"
  - step: 2
    action: "OSとミドルウェアインストール"
    time: "1h"
  - step: 3
    action: "アプリケーションデプロイ"
    time: "30min"
  - step: 4
    action: "データリストア"
    time: "1h"
  - step: 5
    action: "動作確認・切り替え"
    time: "1h"
```

---

## トラブルシューティング

### よくある問題と解決方法

#### 1. 起動時エラー

```bash
# ログ確認
sudo journalctl -u ai-hr-platform -f
tail -f /opt/ai-hr-platform/logs/error.log

# 権限確認
ls -la /opt/ai-hr-platform
sudo chown -R hrplatform:hrplatform /opt/ai-hr-platform

# ポート確認
sudo netstat -tlnp | grep -E "3000|3001"
```

#### 2. データベース接続エラー

```bash
# PostgreSQL状態確認
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"

# 接続テスト
psql -U hrplatform -h localhost -d hrplatform_production -c "SELECT 1;"

# 接続数確認
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
```

#### 3. パフォーマンス問題

```bash
# CPU/メモリ使用率確認
top -u hrplatform
free -h

# ディスク使用率確認
df -h
du -sh /opt/ai-hr-platform/*

# データベーススロークエリ確認
sudo -u postgres psql -d hrplatform_production -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"
```

#### 4. SSL証明書更新

```bash
# 証明書有効期限確認
sudo certbot certificates

# 手動更新
sudo certbot renew --dry-run  # テスト
sudo certbot renew  # 本番更新
sudo nginx -s reload
```

### サポート連絡先

#### テクニカルサポート
- **電話**: 03-XXXX-XXXX (平日 9:00-18:00)
- **メール**: support@ai-hr-platform.jp
- **緊急時**: emergency@ai-hr-platform.jp (24時間)

#### リモートサポート
```bash
# サポート用一時アクセス設定
sudo useradd -m -s /bin/bash -G sudo support_temp
sudo passwd support_temp
# セッション終了後は必ず削除
sudo userdel -r support_temp
```

---

## 付録

### A. 環境変数リファレンス

```bash
# 必須環境変数
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret

# オプション環境変数
LOG_LEVEL=info
MAX_WORKERS=4
UPLOAD_SIZE_LIMIT=10485760
SESSION_TIMEOUT=3600
```

### B. ヘルスチェックエンドポイント

```bash
# アプリケーション状態
curl http://localhost:3001/health

# 詳細ヘルスチェック
curl http://localhost:3001/health/detailed
```

### C. メンテナンスモード

```bash
# メンテナンスモード有効化
npm run maintenance:enable -- --message "定期メンテナンスのため一時停止中"

# メンテナンスモード無効化
npm run maintenance:disable
```

---

*最終更新: 2025年8月1日*  
*ドキュメントバージョン: 1.0.0*