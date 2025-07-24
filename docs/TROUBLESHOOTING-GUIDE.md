# AI-OS トラブルシューティングガイド
## システム管理者・サポートチーム向け問題解決ガイド

**バージョン**: 1.0.0  
**最終更新日**: 2025年7月21日  
**緊急時連絡先**: support@ai-os.com / 080-XXXX-XXXX

---

## 🚨 緊急度別対応フロー

### 🔴 Critical（即時対応）
- システム全体停止
- データ損失の可能性
- セキュリティ侵害
- 給与計算エラー

**対応時間**: 15分以内  
**エスカレーション**: CTO直通

### 🟡 High（1時間以内）
- 一部機能の停止
- パフォーマンス重大低下
- 認証システム障害

**対応時間**: 1時間以内  
**エスカレーション**: インフラチーム

### 🟢 Medium（4時間以内）
- 軽微な機能不具合
- UIの表示問題
- 非クリティカルなエラー

**対応時間**: 4時間以内  
**エスカレーション**: 開発チーム

---

## 🔍 問題診断フローチャート

```
問題発生
    ↓
システム全体に影響？
    Yes → 緊急対応プロトコル起動
    No ↓
認証・ログインの問題？
    Yes → セクション1へ
    No ↓
パフォーマンスの問題？
    Yes → セクション2へ
    No ↓
データ・計算の問題？
    Yes → セクション3へ
    No ↓
その他の問題 → セクション7へ
```

---

## 1. 🔐 認証・ログイン問題

### 問題: ログインできない

#### 症状
- ログイン画面でエラーメッセージ
- 「認証に失敗しました」エラー
- ログイン後すぐにログアウトされる

#### 診断手順
```bash
# 1. 認証サービスの状態確認
systemctl status ai-os-auth
curl -f http://localhost:3000/health/auth

# 2. Redisセッションストアの確認
redis-cli ping
redis-cli info stats

# 3. ログ確認
tail -f /var/log/ai-os/auth.log | grep ERROR
```

#### 解決策

**1. パスワードリセット**
```sql
-- 管理者権限でパスワードリセット
UPDATE employees 
SET password_reset_required = true,
    password_reset_token = gen_random_uuid()
WHERE email = 'user@example.com';
```

**2. アカウントロック解除**
```sql
-- ロックされたアカウントの確認
SELECT * FROM employees 
WHERE account_status = 'locked' 
  AND locked_at > NOW() - INTERVAL '1 hour';

-- ロック解除
UPDATE employees 
SET account_status = 'active',
    failed_login_attempts = 0,
    locked_at = NULL
WHERE id = 'emp123';
```

**3. セッションクリア**
```bash
# Redis内の特定ユーザーセッションをクリア
redis-cli --scan --pattern "sess:*emp123*" | xargs redis-cli del

# 全セッションクリア（最終手段）
redis-cli FLUSHDB
```

### 問題: MFA（多要素認証）が機能しない

#### 症状
- QRコードが表示されない
- 認証コードが無効と表示される
- 時刻同期エラー

#### 解決策
```bash
# 1. サーバー時刻の確認と同期
timedatectl status
sudo ntpdate -s time.nist.gov

# 2. MFAリセット（管理者権限）
psql -U postgres -d aios_production << EOF
UPDATE employee_mfa_settings 
SET enabled = false,
    secret = NULL,
    backup_codes = NULL
WHERE employee_id = 'emp123';
EOF
```

---

## 2. 🐌 パフォーマンス問題

### 問題: システムが遅い

#### 症状
- ページロードが3秒以上
- API応答が500ms以上
- タイムアウトエラー頻発

#### 診断手順

**1. システムリソース確認**
```bash
# CPU/メモリ使用率
htop
iostat -x 1 10

# ディスクI/O
iotop -o

# ネットワーク
iftop
netstat -i
```

**2. データベース診断**
```sql
-- 実行中のクエリ確認
SELECT pid, age(clock_timestamp(), query_start), usename, query 
FROM pg_stat_activity
WHERE query != '<IDLE>' AND query NOT ILIKE '%pg_stat%'
ORDER BY query_start DESC;

-- スロークエリの特定
SELECT query, calls, total_time, mean, stddev_time
FROM pg_stat_statements
WHERE mean > 100
ORDER BY mean DESC
LIMIT 20;

-- インデックス使用状況
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan;
```

**3. アプリケーションレベル診断**
```bash
# Node.jsプロセス確認
pm2 list
pm2 monit

# メモリリーク確認
node --inspect app.js
# Chrome DevToolsで接続してヒープスナップショット取得
```

#### 解決策

**1. 即時対応**
```bash
# アプリケーション再起動
pm2 restart all

# データベース接続リセット
psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes';"

# キャッシュクリア
redis-cli FLUSHALL
```

**2. クエリ最適化**
```sql
-- 統計情報更新
ANALYZE;

-- インデックス作成
CREATE INDEX CONCURRENTLY idx_time_records_employee_date 
ON time_records(employee_id, work_date);

-- バキューム実行
VACUUM ANALYZE;
```

**3. スケーリング**
```bash
# ワーカープロセス増加
pm2 scale ai-os-app +2

# Nginxワーカー調整
sudo nano /etc/nginx/nginx.conf
# worker_processes auto;
# worker_connections 2048;
sudo nginx -s reload
```

### 問題: メモリ不足

#### 症状
- "JavaScript heap out of memory"エラー
- アプリケーションの突然の終了
- swap使用率が高い

#### 解決策
```bash
# 1. Node.jsメモリ制限の増加
export NODE_OPTIONS="--max-old-space-size=4096"
pm2 restart ai-os-app

# 2. メモリリーク箇所の特定
npm install heapdump
# コード内でheapdumpを実装してメモリスナップショット取得

# 3. システムメモリの確認と最適化
free -h
sudo sysctl vm.swappiness=10
```

---

## 3. 💰 給与計算・データ問題

### 問題: 給与計算エラー

#### 症状
- 計算結果が0円
- 税額が異常
- 計算処理がタイムアウト

#### 診断手順
```sql
-- 従業員マスタデータ確認
SELECT * FROM employees 
WHERE id = 'emp123' 
  AND (base_salary IS NULL OR base_salary = 0);

-- 勤怠データ確認
SELECT COUNT(*), SUM(work_hours) 
FROM time_records 
WHERE employee_id = 'emp123' 
  AND work_date BETWEEN '2025-07-01' AND '2025-07-31';

-- 給与計算ログ確認
SELECT * FROM payroll_calculation_logs 
WHERE employee_id = 'emp123' 
  AND calculation_month = '2025-07'
ORDER BY created_at DESC;
```

#### 解決策

**1. データ整合性チェック**
```sql
-- 必須データの存在確認
WITH missing_data AS (
  SELECT 
    e.id,
    e.name,
    CASE 
      WHEN e.base_salary IS NULL THEN '基本給未設定'
      WHEN e.tax_table_id IS NULL THEN '税テーブル未設定'
      WHEN e.insurance_type IS NULL THEN '保険区分未設定'
    END as issue
  FROM employees e
  WHERE e.account_status = 'active'
    AND (e.base_salary IS NULL 
      OR e.tax_table_id IS NULL 
      OR e.insurance_type IS NULL)
)
SELECT * FROM missing_data;
```

**2. 再計算実行**
```bash
# 特定従業員の再計算
curl -X POST https://api.ai-os.com/api/v1/payroll/recalculate \
  -H "Authorization: Bearer $API_KEY" \
  -d '{
    "employeeId": "emp123",
    "yearMonth": "2025-07",
    "force": true
  }'
```

**3. 税率・保険料率の更新**
```sql
-- 最新の税率テーブル確認
SELECT * FROM tax_tables 
WHERE effective_date <= CURRENT_DATE 
ORDER BY effective_date DESC 
LIMIT 1;

-- 保険料率の更新
UPDATE insurance_rates 
SET health_insurance_rate = 0.0493,
    pension_rate = 0.0915,
    updated_at = NOW()
WHERE year = 2025;
```

### 問題: 勤怠データ不整合

#### 症状
- 打刻時刻がおかしい
- 労働時間が正しく計算されない
- 休憩時間が反映されない

#### 解決策
```sql
-- 1. 異常な打刻データの検出
SELECT * FROM time_records
WHERE (clock_out - clock_in) > INTERVAL '24 hours'
   OR clock_out < clock_in
   OR work_date > CURRENT_DATE;

-- 2. 打刻データの修正
UPDATE time_records
SET clock_out = clock_in + INTERVAL '9 hours'
WHERE id = 'record123'
  AND clock_out IS NULL
  AND work_date < CURRENT_DATE;

-- 3. 休憩時間の自動適用
UPDATE time_records
SET break_minutes = 
  CASE 
    WHEN (clock_out - clock_in) > INTERVAL '8 hours' THEN 60
    WHEN (clock_out - clock_in) > INTERVAL '6 hours' THEN 45
    ELSE 0
  END
WHERE break_minutes IS NULL;
```

---

## 4. 🔌 統合・連携問題

### 問題: 外部システム連携エラー

#### 症状
- 会計システムへのデータ送信失敗
- APIタイムアウト
- 認証エラー

#### 診断手順
```bash
# 1. 外部API疎通確認
curl -v https://api.freee.co.jp/health
curl -v https://api.moneyforward.com/health

# 2. 連携ログ確認
grep "integration" /var/log/ai-os/app.log | tail -100
```

#### 解決策

**1. 認証トークン更新**
```javascript
// OAuth2トークンのリフレッシュ
const refreshToken = async (integration) => {
  const response = await fetch(`${integration.tokenUrl}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
      client_id: process.env[`${integration.name.toUpperCase()}_CLIENT_ID`],
      client_secret: process.env[`${integration.name.toUpperCase()}_CLIENT_SECRET`],
    }),
  });
  
  const data = await response.json();
  // データベースに新しいトークンを保存
  await updateIntegrationTokens(integration.id, data);
};
```

**2. リトライ機構の実装**
```javascript
// 指数バックオフでリトライ
async function retryWithExponentialBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## 5. 🗄️ データベース問題

### 問題: デッドロック

#### 症状
- "deadlock detected"エラー
- トランザクションタイムアウト
- 処理の停止

#### 診断手順
```sql
-- デッドロック情報確認
SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';

-- ブロッキングクエリの特定
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

#### 解決策
```sql
-- 1. 問題のあるセッションを強制終了
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE pid = 12345;

-- 2. ロック順序の統一（アプリケーション側）
-- 常に同じ順序でテーブルをロック
BEGIN;
LOCK TABLE employees IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE time_records IN SHARE ROW EXCLUSIVE MODE;
-- 処理
COMMIT;
```

### 問題: ディスク容量不足

#### 症状
- "could not extend file"エラー
- バックアップ失敗
- ログファイルの肥大化

#### 解決策
```bash
# 1. 容量確認
df -h
du -sh /var/lib/postgresql/*

# 2. 不要ファイルの削除
# 古いログファイル
find /var/log/ai-os -name "*.log" -mtime +30 -delete

# 古いバックアップ
find /backup -name "*.dump" -mtime +7 -delete

# 3. データベースのVACUUM
psql -U postgres -d aios_production -c "VACUUM FULL;"

# 4. ログローテーション設定
cat > /etc/logrotate.d/ai-os << EOF
/var/log/ai-os/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 640 ai-os ai-os
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

---

## 6. 🔔 通知・アラート問題

### 問題: 通知が届かない

#### 症状
- メール通知の未着
- Slack通知の失敗
- Webhook呼び出しエラー

#### 診断手順
```bash
# メールキュー確認
mailq

# メール送信ログ
tail -f /var/log/mail.log

# 通知サービスステータス
systemctl status ai-os-notifications
```

#### 解決策

**1. メール設定確認**
```javascript
// SMTP設定のテスト
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

// テストメール送信
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP設定エラー:', error);
  } else {
    console.log('SMTPサーバー接続成功');
  }
});
```

**2. Webhook再送信**
```bash
# 失敗したWebhookの再送信
curl -X POST http://localhost:3000/api/webhooks/retry \
  -H "Content-Type: application/json" \
  -d '{
    "webhookId": "webhook123",
    "eventId": "event456"
  }'
```

---

## 7. 🔧 その他の問題

### 問題: ファイルアップロードエラー

#### 症状
- "File too large"エラー
- アップロード後ファイルが見つからない
- 権限エラー

#### 解決策
```bash
# 1. アップロードディレクトリの権限確認
ls -la /var/www/ai-os/uploads
sudo chown -R www-data:www-data /var/www/ai-os/uploads
sudo chmod -R 755 /var/www/ai-os/uploads

# 2. Nginxのアップロードサイズ制限
sudo nano /etc/nginx/nginx.conf
# client_max_body_size 50M;
sudo nginx -s reload

# 3. Node.jsのボディサイズ制限
# app.js内で設定
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
```

### 問題: PDF生成エラー

#### 症状
- 給与明細PDFが生成されない
- 文字化け
- タイムアウト

#### 解決策
```bash
# 1. 日本語フォントのインストール
sudo apt-get install fonts-ipafont fonts-ipaexfont

# 2. Puppeteerの依存関係
sudo apt-get install -y \
  gconf-service libasound2 libatk1.0-0 libc6 libcairo2 \
  libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 \
  libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
  libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
  libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
  libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
  libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation \
  libappindicator1 libnss3 lsb-release xdg-utils wget

# 3. メモリ不足対策
export NODE_OPTIONS="--max-old-space-size=2048"
```

---

## 📊 監視・予防策

### ヘルスチェックスクリプト
```bash
#!/bin/bash
# health-check.sh

# APIヘルスチェック
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ $API_STATUS -ne 200 ]; then
    echo "API異常: HTTP $API_STATUS"
    # アラート送信
fi

# データベース接続チェック
DB_CHECK=$(psql -U postgres -d aios_production -c "SELECT 1" 2>&1)
if [ $? -ne 0 ]; then
    echo "データベース接続エラー"
    # アラート送信
fi

# ディスク容量チェック
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "ディスク容量警告: ${DISK_USAGE}%"
    # アラート送信
fi

# メモリ使用率チェック
MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo "メモリ使用率警告: ${MEM_USAGE}%"
    # アラート送信
fi
```

### 予防的メンテナンス
```bash
# 毎日実行
0 2 * * * /opt/ai-os/scripts/daily-maintenance.sh

# weekly-maintenance.sh内容
#!/bin/bash
# データベース最適化
psql -U postgres -d aios_production -c "VACUUM ANALYZE;"

# ログローテーション
logrotate -f /etc/logrotate.d/ai-os

# 古いセッションクリア
redis-cli --scan --pattern "sess:*" | \
  xargs -I {} sh -c 'TTL=$(redis-cli ttl {}); [ $TTL -lt 0 ] && redis-cli del {}'
```

---

## 🆘 エスカレーション

### レベル1: サポートチーム
- 対応時間: 24/7
- 連絡先: support@ai-os.com
- 対応範囲: 基本的なトラブルシューティング

### レベル2: 技術チーム
- 対応時間: 平日9:00-18:00
- 連絡先: tech@ai-os.com
- 対応範囲: システム障害、パフォーマンス問題

### レベル3: 開発チーム
- 対応時間: オンコール
- 連絡先: dev-oncall@ai-os.com
- 対応範囲: バグ修正、緊急パッチ

### レベル4: CTO直通
- 対応時間: 緊急時のみ
- 連絡先: cto@ai-os.com
- 対応範囲: 重大インシデント、ビジネス影響大

---

**重要**: このガイドは定期的に更新してください。新しい問題と解決策を継続的に追加し、チーム全体で共有することで、サポート品質の向上につながります。