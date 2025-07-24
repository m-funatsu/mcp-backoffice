# AI-OS セキュリティインシデント対応手順書
## CSIRT (Computer Security Incident Response Team) ガイドライン

**機密レベル**: 🔴 社外秘  
**バージョン**: 1.0.0  
**最終更新日**: 2025年7月21日

---

## 🚨 緊急連絡先

### インシデント発生時の即時連絡先
```
🔴 セキュリティホットライン: 080-XXXX-XXXX (24/7)
📧 緊急メール: security-incident@ai-os.com
💬 緊急Slack: #security-incident-response
```

---

## 📋 インシデント分類

### 重要度レベル

| レベル | 定義 | 対応時間 | 例 |
|--------|------|----------|-----|
| **P1 - Critical** | 事業継続に重大な影響 | 15分以内 | データ漏洩、システム全体停止、ランサムウェア |
| **P2 - High** | 重要機能への影響 | 1時間以内 | 不正アクセス検出、DDoS攻撃 |
| **P3 - Medium** | 限定的な影響 | 4時間以内 | 脆弱性発見、単一アカウント侵害 |
| **P4 - Low** | 軽微な影響 | 24時間以内 | スキャン検出、設定ミス |

---

## 🔄 インシデント対応フロー

### フェーズ1: 検出と分析（0-30分）

#### 1.1 初期トリアージ
```bash
#!/bin/bash
# incident-triage.sh

echo "=== インシデント初期分析 ==="
date

# 1. 影響範囲の特定
echo "▶ 影響を受けているシステム:"
kubectl get pods --all-namespaces | grep -v Running

# 2. ネットワーク接続確認
echo "▶ 異常な外部接続:"
netstat -an | grep ESTABLISHED | grep -v "10.0" | head -20

# 3. ログ分析
echo "▶ 直近のエラーログ:"
journalctl -p err -since "30 minutes ago" | tail -50

# 4. リソース使用状況
echo "▶ システムリソース:"
top -b -n 1 | head -20

# 5. アクセスログ確認
echo "▶ 不審なアクセス:"
tail -n 1000 /var/log/nginx/access.log | \
    awk '$9 ~ /4[0-9][0-9]|5[0-9][0-9]/ {print $1, $9, $7}' | \
    sort | uniq -c | sort -rn | head -20
```

#### 1.2 証拠保全
```bash
# 証拠保全スクリプト
INCIDENT_ID=$(date +%Y%m%d_%H%M%S)
EVIDENCE_DIR="/secure/evidence/$INCIDENT_ID"

mkdir -p $EVIDENCE_DIR

# メモリダンプ
sudo dd if=/dev/mem of=$EVIDENCE_DIR/memory.dump bs=1M

# ネットワーク状態
netstat -anp > $EVIDENCE_DIR/netstat.txt
ss -anp > $EVIDENCE_DIR/ss.txt
iptables -L -n -v > $EVIDENCE_DIR/iptables.txt

# プロセス情報
ps auxww > $EVIDENCE_DIR/ps.txt
lsof -n > $EVIDENCE_DIR/lsof.txt

# システムログ
tar -czf $EVIDENCE_DIR/logs.tar.gz /var/log/

# ハッシュ値記録
find $EVIDENCE_DIR -type f -exec sha256sum {} \; > $EVIDENCE_DIR/checksums.txt
```

### フェーズ2: 封じ込め（30分-2時間）

#### 2.1 短期封じ込め
```yaml
# kubernetes-isolation.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: emergency-isolation
  namespace: production
spec:
  podSelector:
    matchLabels:
      quarantine: "true"
  policyTypes:
  - Ingress
  - Egress
  ingress: []
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: logging
    ports:
    - protocol: TCP
      port: 514
```

#### 2.2 影響アカウントの無効化
```sql
-- 不審なアカウントの即時無効化
BEGIN;

-- 影響を受けたユーザーの特定
CREATE TEMP TABLE compromised_users AS
SELECT DISTINCT user_id
FROM audit_logs
WHERE action IN ('unauthorized_access', 'suspicious_activity')
  AND created_at > NOW() - INTERVAL '24 hours';

-- アカウントの無効化
UPDATE employees
SET 
    account_status = 'suspended',
    suspension_reason = 'Security incident investigation',
    suspended_at = NOW(),
    suspended_by = 'SECURITY_SYSTEM'
WHERE id IN (SELECT user_id FROM compromised_users);

-- パスワードリセット要求
UPDATE employees
SET password_reset_required = true
WHERE id IN (SELECT user_id FROM compromised_users);

-- セッションの無効化
DELETE FROM active_sessions
WHERE user_id IN (SELECT user_id FROM compromised_users);

COMMIT;
```

### フェーズ3: 根絶（2-8時間）

#### 3.1 マルウェア除去
```bash
#!/bin/bash
# malware-removal.sh

# ClamAVでスキャン
clamscan -r -i --remove=yes /var/www/ai-os/

# 不審なcronジョブの確認
echo "▶ Cronジョブ確認:"
for user in $(cut -f1 -d: /etc/passwd); do
    echo "User: $user"
    crontab -l -u $user 2>/dev/null
done

# 不審なサービスの確認
systemctl list-units --type=service --state=running | \
    grep -v "ai-os\|postgresql\|redis\|nginx"

# 不正なSSHキーの確認
find /home -name "authorized_keys" -exec cat {} \; | \
    grep -v "ssh-rsa AAAAB3NzaC1" # 既知のキー以外
```

#### 3.2 脆弱性修正
```bash
# パッチ適用
apt update && apt upgrade -y

# 設定の強化
# nginx設定
cat > /etc/nginx/conf.d/security.conf << EOF
# セキュリティヘッダー
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;

# レート制限
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;
EOF

nginx -t && systemctl reload nginx
```

### フェーズ4: 復旧（8-24時間）

#### 4.1 システム復旧手順
```bash
#!/bin/bash
# system-recovery.sh

echo "システム復旧を開始します..."

# 1. バックアップからの復旧準備
RESTORE_POINT=$(date -d "1 day ago" +%Y%m%d)
BACKUP_FILE="/backup/daily/db_backup_${RESTORE_POINT}_020000.dump"

# 2. データベース復旧
systemctl stop ai-os-app
pg_restore -U postgres -d aios_production_restore $BACKUP_FILE

# 3. 整合性チェック
psql -U postgres -d aios_production_restore << EOF
-- データ整合性チェック
SELECT 'Employees', COUNT(*) FROM employees
UNION ALL
SELECT 'Audit Logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'Time Records', COUNT(*) FROM time_records;

-- 不審なデータの確認
SELECT * FROM audit_logs
WHERE action LIKE '%delete%' OR action LIKE '%drop%'
  AND created_at > NOW() - INTERVAL '48 hours';
EOF

# 4. アプリケーション再起動
systemctl start ai-os-app
```

#### 4.2 監視強化
```yaml
# enhanced-monitoring.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: security-monitoring
data:
  prometheus-rules.yml: |
    groups:
    - name: security_enhanced
      interval: 10s
      rules:
      - alert: SuspiciousAPIActivity
        expr: |
          rate(http_requests_total{status=~"401|403"}[1m]) > 5
        for: 1m
        labels:
          severity: high
          team: security
        annotations:
          summary: "異常なAPI活動を検出"
          
      - alert: UnusualDataAccess
        expr: |
          rate(database_queries_total{query_type="bulk_export"}[5m]) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "大量データアクセスを検出"
```

### フェーズ5: 事後分析（24-72時間）

#### 5.1 インシデント分析レポート

```markdown
# インシデント分析レポート

## インシデント概要
- **ID**: INC-20250721-001
- **発生日時**: 2025/07/21 14:30 JST
- **検出時刻**: 2025/07/21 14:32 JST
- **解決時刻**: 2025/07/21 18:45 JST
- **影響度**: P2 - High
- **影響範囲**: 限定的（特定部門のみ）

## タイムライン
| 時刻 | イベント | 対応者 |
|------|---------|--------|
| 14:30 | 異常なAPIアクセス検出 | 監視システム |
| 14:32 | アラート発報 | SOC |
| 14:35 | 初期分析開始 | セキュリティチーム |
| 14:45 | 影響範囲特定 | インシデントマネージャー |
| 15:00 | 封じ込め実施 | 技術チーム |
| 16:30 | 根本原因特定 | フォレンジックチーム |
| 17:00 | 修正適用開始 | 開発チーム |
| 18:45 | 復旧完了 | 運用チーム |

## 根本原因
- APIエンドポイントの認証バイパス脆弱性
- 特定条件下でのセッション管理不備

## 実施した対策
1. 脆弱性の修正パッチ適用
2. WAFルール強化
3. 監視ルール追加
4. インシデント対応手順の改善

## 改善提案
1. セキュリティコードレビューの強化
2. ペネトレーションテストの頻度増加
3. インシデント対応訓練の定期実施
```

---

## 🛡️ 予防的セキュリティ対策

### 日次セキュリティチェック
```bash
#!/bin/bash
# daily-security-check.sh

echo "=== 日次セキュリティチェック ==="

# 1. 脆弱性スキャン
echo "▶ 脆弱性スキャン実行中..."
trivy image ai-os/app:latest

# 2. 設定監査
echo "▶ セキュリティ設定確認..."
lynis audit system --quick

# 3. ログ分析
echo "▶ 異常ログ検出..."
grep -E "(CRITICAL|ERROR|WARNING|failed|denied)" /var/log/ai-os/*.log | \
    tail -100

# 4. アクセスパターン分析
echo "▶ 異常アクセスパターン..."
awk '{print $1}' /var/log/nginx/access.log | \
    sort | uniq -c | sort -rn | head -20

# 5. 証明書有効期限確認
echo "▶ SSL証明書有効期限..."
echo | openssl s_client -servername ai-os.com -connect ai-os.com:443 2>/dev/null | \
    openssl x509 -noout -dates
```

### セキュリティKPI

| 指標 | 目標 | 測定方法 |
|------|------|----------|
| 平均検出時間 (MTTD) | < 15分 | インシデント発生から検出まで |
| 平均対応時間 (MTTR) | < 4時間 | 検出から解決まで |
| 脆弱性修正時間 | Critical: 24h | 発見から修正まで |
| セキュリティトレーニング受講率 | 100% | 四半期ごと |

---

## 📞 エスカレーションマトリクス

### 技術チーム

| 役割 | 担当者 | 連絡先 | 対応時間 |
|------|--------|--------|----------|
| CISO | [氏名] | XXX-XXXX-XXXX | 24/7 |
| セキュリティリード | [氏名] | XXX-XXXX-XXXX | 24/7 |
| SOCマネージャー | [氏名] | XXX-XXXX-XXXX | 24/7 |
| フォレンジック専門家 | [氏名] | XXX-XXXX-XXXX | オンコール |

### 外部連携

| 組織 | 用途 | 連絡先 |
|------|------|--------|
| JPCERT/CC | インシデント報告 | info@jpcert.or.jp |
| 警察サイバー犯罪対策 | 犯罪被害相談 | 03-XXXX-XXXX |
| 顧問弁護士 | 法的相談 | legal@lawfirm.com |
| 保険会社 | サイバー保険 | cyber@insurance.com |

---

## 📝 チェックリスト

### インシデント発生時
- [ ] インシデントの分類と重要度判定
- [ ] 初期対応チームの招集
- [ ] 証拠保全の開始
- [ ] 影響範囲の特定
- [ ] ステークホルダーへの通知

### 対応中
- [ ] 封じ込め措置の実施
- [ ] 根本原因の調査
- [ ] 修正措置の適用
- [ ] 監視の強化

### 事後対応
- [ ] インシデントレポート作成
- [ ] 再発防止策の実装
- [ ] 関係者への報告
- [ ] 手順書の更新
- [ ] 訓練の実施

---

**重要**: このドキュメントは機密情報を含みます。適切に管理し、定期的に更新してください。