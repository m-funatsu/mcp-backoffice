# AI-OS バックアップ・リストア手順書
## システム管理者向け完全ガイド

**バージョン**: 1.0.0  
**最終更新日**: 2025年7月21日  
**重要度**: 🔴 極めて重要

---

## 📋 目次

1. [概要](#概要)
2. [バックアップ戦略](#バックアップ戦略)
3. [バックアップ手順](#バックアップ手順)
4. [リストア手順](#リストア手順)
5. [災害復旧手順](#災害復旧手順)
6. [テスト手順](#テスト手順)
7. [トラブルシューティング](#トラブルシューティング)

---

## 🔍 概要

### バックアップ対象

| 対象 | 種別 | 重要度 | バックアップ頻度 |
|------|------|--------|----------------|
| PostgreSQLデータベース | データ | 🔴 最重要 | 日次（差分）、週次（完全） |
| アップロードファイル | データ | 🟡 重要 | 日次 |
| 設定ファイル | 設定 | 🟡 重要 | 変更時 |
| AIモデル | モデル | 🟢 標準 | 週次 |
| ログファイル | ログ | 🟢 標準 | 日次 |

### バックアップ保持期間

- **日次バックアップ**: 7日間
- **週次バックアップ**: 4週間
- **月次バックアップ**: 12ヶ月
- **年次バックアップ**: 7年間（法的要件）

---

## 🛡️ バックアップ戦略

### 3-2-1ルール
- **3**: データのコピーを最低3つ保持
- **2**: 2つの異なるメディアに保存
- **1**: 1つはオフサイトに保管

### バックアップ構成
```
プライマリ（本番環境）
    ├── ローカルバックアップ（高速リストア用）
    ├── リモートバックアップ（AWS S3）
    └── オフサイトバックアップ（別リージョン）
```

---

## 💾 バックアップ手順

### 1. 自動バックアップ（推奨）

#### 日次バックアップスクリプト
```bash
#!/bin/bash
# /opt/ai-os/scripts/daily-backup.sh

# 設定
BACKUP_DIR="/backup/ai-os/daily"
S3_BUCKET="s3://ai-os-backups/daily"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# バックアップ実行
echo "[$(date)] 日次バックアップを開始します"

# 1. データベースバックアップ
pg_dump -h localhost -U aios -d aios_production \
    --format=custom \
    --compress=9 \
    --file="$BACKUP_DIR/db_backup_$DATE.dump"

# 2. ファイルバックアップ
tar -czf "$BACKUP_DIR/files_backup_$DATE.tar.gz" \
    /var/www/ai-os/uploads \
    /var/www/ai-os/config \
    --exclude='*.log'

# 3. S3へアップロード
aws s3 sync "$BACKUP_DIR" "$S3_BUCKET" \
    --exclude "*" \
    --include "*_$DATE.*"

# 4. 古いバックアップを削除
find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
aws s3 ls "$S3_BUCKET" | \
    awk '{print $4}' | \
    while read file; do
        file_date=$(echo $file | grep -oP '\d{8}')
        if [[ $(date -d "$file_date" +%s) -lt $(date -d "$RETENTION_DAYS days ago" +%s) ]]; then
            aws s3 rm "$S3_BUCKET/$file"
        fi
    done

echo "[$(date)] 日次バックアップが完了しました"
```

#### Cronジョブ設定
```bash
# crontab -e
# 日次バックアップ（毎日午前2時）
0 2 * * * /opt/ai-os/scripts/daily-backup.sh >> /var/log/ai-os/backup.log 2>&1

# 週次完全バックアップ（毎週日曜日午前3時）
0 3 * * 0 /opt/ai-os/scripts/weekly-backup.sh >> /var/log/ai-os/backup.log 2>&1

# 月次アーカイブ（毎月1日午前4時）
0 4 1 * * /opt/ai-os/scripts/monthly-archive.sh >> /var/log/ai-os/backup.log 2>&1
```

### 2. 手動バックアップ

#### 緊急バックアップ手順
```bash
# 1. システムをメンテナンスモードに切り替え
sudo systemctl stop ai-os-app
echo "メンテナンス中" > /var/www/ai-os/maintenance.flag

# 2. データベースの完全バックアップ
sudo -u postgres pg_dump aios_production > /backup/emergency/db_$(date +%Y%m%d_%H%M%S).sql

# 3. アプリケーションファイルのバックアップ
tar -czf /backup/emergency/app_$(date +%Y%m%d_%H%M%S).tar.gz \
    /var/www/ai-os \
    --exclude='node_modules' \
    --exclude='*.log'

# 4. 設定ファイルのバックアップ
cp -r /etc/ai-os /backup/emergency/config_$(date +%Y%m%d_%H%M%S)

# 5. システムを再開
rm /var/www/ai-os/maintenance.flag
sudo systemctl start ai-os-app
```

### 3. 増分バックアップ

```bash
# PostgreSQL WALアーカイブ設定
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /backup/wal/%f && cp %p /backup/wal/%f'

# 増分バックアップスクリプト
#!/bin/bash
pg_basebackup -h localhost -D /backup/incremental/$(date +%Y%m%d) \
    -U replication -v -P -W \
    --wal-method=stream \
    --checkpoint=fast
```

---

## 🔄 リストア手順

### 1. 計画的リストア

#### 事前準備チェックリスト
- [ ] リストア対象の特定
- [ ] バックアップファイルの確認
- [ ] メンテナンス時間の通知
- [ ] ロールバック計画の準備

#### リストア実行手順
```bash
# 1. 現在の状態をバックアップ
/opt/ai-os/scripts/pre-restore-backup.sh

# 2. アプリケーションを停止
sudo systemctl stop ai-os-app
sudo systemctl stop ai-os-workers

# 3. データベースをリストア
# 特定時点へのリストア（PITR）
sudo -u postgres psql -c "DROP DATABASE IF EXISTS aios_production;"
sudo -u postgres psql -c "CREATE DATABASE aios_production;"
pg_restore -h localhost -U postgres -d aios_production \
    /backup/daily/db_backup_20250720_020000.dump

# 4. ファイルをリストア
cd /
tar -xzf /backup/daily/files_backup_20250720_020000.tar.gz

# 5. 権限を修正
chown -R www-data:www-data /var/www/ai-os/uploads
chmod -R 755 /var/www/ai-os

# 6. アプリケーションを再起動
sudo systemctl start ai-os-app
sudo systemctl start ai-os-workers

# 7. 動作確認
curl -f http://localhost:3000/health || echo "Health check failed!"
```

### 2. 緊急リストア

#### 障害発生時の即時対応
```bash
#!/bin/bash
# /opt/ai-os/scripts/emergency-restore.sh

echo "🚨 緊急リストアを開始します"

# 最新のバックアップを特定
LATEST_BACKUP=$(ls -t /backup/daily/db_backup_*.dump | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ バックアップが見つかりません"
    exit 1
fi

echo "📁 使用するバックアップ: $LATEST_BACKUP"

# 確認プロンプト
read -p "本当にリストアを実行しますか？ (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ リストアをキャンセルしました"
    exit 0
fi

# リストア実行
systemctl stop ai-os-app

# データベースリストア
sudo -u postgres dropdb --if-exists aios_production
sudo -u postgres createdb aios_production
pg_restore -U postgres -d aios_production "$LATEST_BACKUP"

# アプリケーション再起動
systemctl start ai-os-app

echo "✅ 緊急リストアが完了しました"
```

### 3. 部分リストア

#### 特定テーブルのみリストア
```bash
# バックアップから特定テーブルを抽出
pg_restore -t employees -t departments \
    /backup/db_backup.dump > partial_restore.sql

# 既存データを退避
pg_dump -t employees -t departments aios_production > before_restore.sql

# テーブルをリストア
psql -U postgres -d aios_production < partial_restore.sql
```

#### 特定期間のデータリストア
```sql
-- タイムスタンプ付きテーブルの場合
CREATE TEMP TABLE temp_time_records AS 
SELECT * FROM backup.time_records 
WHERE created_at BETWEEN '2025-07-01' AND '2025-07-15';

-- 既存データとマージ
INSERT INTO time_records 
SELECT * FROM temp_time_records 
ON CONFLICT (id) DO NOTHING;
```

---

## 🌊 災害復旧手順

### 災害レベル定義

| レベル | 状況 | RTO | RPO |
|--------|------|-----|-----|
| 1 | 単一サーバー障害 | 1時間 | 1時間 |
| 2 | データセンター障害 | 4時間 | 4時間 |
| 3 | リージョン全体障害 | 24時間 | 24時間 |

### レベル1: 単一サーバー障害

```bash
# 1. スタンバイサーバーへの切り替え
/opt/ai-os/scripts/failover-to-standby.sh

# 2. DNSの更新
aws route53 change-resource-record-sets \
    --hosted-zone-id Z1234567890ABC \
    --change-batch file://dns-failover.json

# 3. 通知
/opt/ai-os/scripts/notify-failover.sh "Server failover completed"
```

### レベル2: データセンター障害

```bash
# 1. DR環境の起動
terraform apply -var="environment=dr" -auto-approve

# 2. 最新バックアップのリストア
aws s3 cp s3://ai-os-backups/latest/ /backup/dr/ --recursive
/opt/ai-os/scripts/restore-to-dr.sh

# 3. DNSの切り替え
aws route53 change-resource-record-sets \
    --hosted-zone-id Z1234567890ABC \
    --change-batch file://dns-dr-failover.json

# 4. 全ユーザーへの通知
/opt/ai-os/scripts/mass-notification.sh "System switched to DR site"
```

### レベル3: リージョン全体障害

1. **災害対策本部の設置**
2. **別リージョンでの環境構築**
3. **オフサイトバックアップからのリストア**
4. **段階的なサービス復旧**

---

## 🧪 テスト手順

### 月次リストアテスト

```bash
#!/bin/bash
# /opt/ai-os/scripts/monthly-restore-test.sh

echo "📋 月次リストアテストを開始します"

# テスト環境の準備
TEST_DB="aios_restore_test"
TEST_DIR="/tmp/restore_test"

# データベーステスト
sudo -u postgres createdb $TEST_DB
pg_restore -U postgres -d $TEST_DB /backup/weekly/latest.dump

# 整合性チェック
EMPLOYEE_COUNT=$(psql -U postgres -d $TEST_DB -t -c "SELECT COUNT(*) FROM employees")
echo "従業員数: $EMPLOYEE_COUNT"

# クリーンアップ
sudo -u postgres dropdb $TEST_DB
rm -rf $TEST_DIR

echo "✅ リストアテスト完了"
```

### 年次DR訓練

**訓練シナリオ**:
1. 本番環境の疑似障害
2. DR環境への切り替え
3. 業務継続性の確認
4. 本番環境への切り戻し

---

## 🔧 トラブルシューティング

### よくある問題と対処法

#### 問題1: バックアップ容量不足
```bash
# 容量確認
df -h /backup

# 古いバックアップの手動削除
find /backup -type f -mtime +30 -name "*.dump" -delete

# S3の不要ファイル削除
aws s3 rm s3://ai-os-backups/ --recursive \
    --exclude "*" --include "*_2024*"
```

#### 問題2: リストア時のエラー
```bash
# エラーログの確認
tail -f /var/log/postgresql/postgresql-*.log

# 権限問題の解決
sudo chown postgres:postgres /backup/*
sudo chmod 600 /backup/*.dump

# 接続問題の解決
sudo -u postgres psql -c "ALTER USER aios WITH SUPERUSER;"
```

#### 問題3: リストア後の不整合
```sql
-- シーケンスのリセット
SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));

-- インデックスの再構築
REINDEX DATABASE aios_production;

-- 統計情報の更新
ANALYZE;
```

### 緊急連絡先

| 担当 | 連絡先 | 対応時間 |
|------|--------|---------|
| インフラチーム | infra@ai-os.com | 24/7 |
| データベース管理者 | dba@ai-os.com | 24/7 |
| セキュリティチーム | security@ai-os.com | 24/7 |
| 緊急ホットライン | 080-XXXX-XXXX | 24/7 |

---

## 📝 チェックリスト

### 日次チェック
- [ ] バックアップジョブの成功確認
- [ ] バックアップファイルのサイズ確認
- [ ] S3への転送確認
- [ ] アラートの確認

### 週次チェック
- [ ] リストアテストの実施
- [ ] バックアップ容量の確認
- [ ] バックアップログのレビュー
- [ ] ドキュメントの更新

### 月次チェック
- [ ] 完全リストアテスト
- [ ] DR環境の動作確認
- [ ] バックアップ戦略の見直し
- [ ] 手順書の更新

---

**重要**: この手順書は定期的に見直し、最新の状態を保つこと。  
最終レビュー日: 2025年7月21日  
次回レビュー予定: 2025年8月21日