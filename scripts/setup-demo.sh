#!/bin/bash

# AI-OS v1.0.0 デモ環境構築スクリプト
# 顧客向けデモ環境を自動構築するスクリプト

set -euo pipefail

# ========================================
# 設定
# ========================================
DEMO_VERSION="1.0.0"
DEMO_PREFIX="demo"
DEMO_DOMAIN="${DEMO_DOMAIN:-demo.ai-os.com}"
DEMO_DATA_SIZE="${DEMO_DATA_SIZE:-small}" # small, medium, large
DEMO_DURATION="${DEMO_DURATION:-30}" # days

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ========================================
# ヘルパー関数
# ========================================
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# ========================================
# デモ環境セットアップ
# ========================================
setup_demo_environment() {
    local company_name=$1
    local company_id=$2
    local admin_email=$3
    
    log "デモ環境を構築中: ${company_name}"
    
    # 環境名を生成
    local env_name="${DEMO_PREFIX}-${company_id}"
    local subdomain="${company_id}.${DEMO_DOMAIN}"
    
    # Dockerコンテナでデモ環境を起動
    docker-compose -f docker-compose.demo.yml up -d \
        -e DEMO_ENV_NAME="${env_name}" \
        -e DEMO_SUBDOMAIN="${subdomain}" \
        -e DEMO_COMPANY_NAME="${company_name}" \
        -e DEMO_ADMIN_EMAIL="${admin_email}"
    
    # データベースを初期化
    log "データベースを初期化中..."
    docker exec "${env_name}-db" psql -U aios -d aios_demo << EOF
-- デモ企業を作成
INSERT INTO companies (id, name, name_kana, industry_code, employee_count) VALUES
('${company_id}', '${company_name}', '${company_name}', '01', 100);

-- 管理者アカウントを作成
INSERT INTO employees (
    id, company_id, employee_code, email, name, name_kana, 
    department_id, position, employment_type, join_date
) VALUES (
    gen_random_uuid(), '${company_id}', 'ADMIN001', '${admin_email}', 
    'デモ管理者', 'デモカンリシャ', NULL, '管理者', 'full_time', CURRENT_DATE
);

-- 管理者権限を付与
INSERT INTO user_roles (user_id, role_id, assigned_by)
SELECT e.id, r.id, e.id
FROM employees e, roles r
WHERE e.email = '${admin_email}' AND r.name = 'company_admin';
EOF
    
    # サンプルデータを生成
    generate_sample_data "${env_name}" "${company_id}" "${DEMO_DATA_SIZE}"
    
    # SSL証明書を設定（Let's Encrypt）
    log "SSL証明書を設定中..."
    docker exec "${env_name}-nginx" certbot --nginx -d "${subdomain}" \
        --non-interactive --agree-tos --email "ssl@ai-os.com"
    
    success "デモ環境構築完了: https://${subdomain}"
}

# ========================================
# サンプルデータ生成
# ========================================
generate_sample_data() {
    local env_name=$1
    local company_id=$2
    local data_size=$3
    
    log "サンプルデータを生成中 (サイズ: ${data_size})"
    
    case $data_size in
        "small")
            local employee_count=10
            local months_history=3
            ;;
        "medium")
            local employee_count=50
            local months_history=6
            ;;
        "large")
            local employee_count=200
            local months_history=12
            ;;
    esac
    
    # Node.jsスクリプトでサンプルデータを生成
    docker exec "${env_name}-app" node scripts/generate-demo-data.js \
        --company-id "${company_id}" \
        --employees "${employee_count}" \
        --months "${months_history}"
}

# ========================================
# デモ環境リスト表示
# ========================================
list_demo_environments() {
    log "アクティブなデモ環境一覧:"
    
    docker ps --filter "label=ai-os.demo=true" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | \
    while read -r line; do
        if [[ $line != *"NAMES"* ]]; then
            local env_name=$(echo $line | awk '{print $1}')
            local status=$(echo $line | awk '{print $2}')
            local expiry=$(docker inspect -f '{{.Config.Labels.expiry}}' "$env_name" 2>/dev/null || echo "N/A")
            echo -e "${env_name}\t${status}\t期限: ${expiry}"
        fi
    done
}

# ========================================
# デモ環境削除
# ========================================
delete_demo_environment() {
    local env_name=$1
    
    warning "デモ環境を削除します: ${env_name}"
    read -p "本当に削除しますか？ (y/N): " -r
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose -f docker-compose.demo.yml down -v \
            --project-name "${env_name}"
        
        # データベースバックアップを作成
        local backup_file="/backup/demo/${env_name}_$(date +%Y%m%d_%H%M%S).sql.gz"
        docker exec "${env_name}-db" pg_dump -U aios aios_demo | gzip > "$backup_file"
        
        success "デモ環境を削除しました: ${env_name}"
        log "バックアップ: ${backup_file}"
    else
        log "削除をキャンセルしました"
    fi
}

# ========================================
# デモ環境延長
# ========================================
extend_demo_environment() {
    local env_name=$1
    local days=$2
    
    log "デモ環境の有効期限を延長: ${env_name} (+${days}日)"
    
    # 新しい有効期限を計算
    local new_expiry=$(date -d "+${days} days" +%Y-%m-%d)
    
    # Dockerラベルを更新
    docker update --label-add "expiry=${new_expiry}" "${env_name}-app"
    docker update --label-add "expiry=${new_expiry}" "${env_name}-db"
    docker update --label-add "expiry=${new_expiry}" "${env_name}-nginx"
    
    success "有効期限を延長しました: ${new_expiry}"
}

# ========================================
# デモアクセス情報生成
# ========================================
generate_access_info() {
    local env_name=$1
    local company_name=$2
    local admin_email=$3
    local subdomain=$4
    
    # 一時パスワードを生成
    local temp_password=$(openssl rand -base64 12)
    
    # パスワードをデータベースに設定
    local password_hash=$(docker exec "${env_name}-app" node -e "
        const bcrypt = require('bcrypt');
        console.log(bcrypt.hashSync('${temp_password}', 12));
    ")
    
    docker exec "${env_name}-db" psql -U aios -d aios_demo -c "
        UPDATE employees SET password_hash = '${password_hash}' 
        WHERE email = '${admin_email}';
    "
    
    # アクセス情報をファイルに出力
    cat > "demo-access-${env_name}.txt" << EOF
=====================================
AI-OS デモ環境アクセス情報
=====================================

会社名: ${company_name}
環境ID: ${env_name}

アクセスURL: https://${subdomain}
管理者メール: ${admin_email}
初期パスワード: ${temp_password}

有効期限: $(date -d "+${DEMO_DURATION} days" +%Y-%m-%d)

【初回ログイン時の手順】
1. 上記URLにアクセス
2. メールアドレスとパスワードでログイン
3. パスワードの変更を求められるので、新しいパスワードを設定
4. ダッシュボードが表示されます

【デモデータについて】
- 従業員データ、勤怠記録、給与データがサンプルとして登録されています
- AIエージェントは学習済みの状態で稼働しています
- 全機能を自由にお試しいただけます

【サポート】
ご不明な点がございましたら、以下までお問い合わせください：
- メール: demo-support@ai-os.com
- 電話: 03-XXXX-XXXX (平日 9:00-18:00)

=====================================
EOF
    
    success "アクセス情報を生成しました: demo-access-${env_name}.txt"
}

# ========================================
# 期限切れデモ環境の自動削除
# ========================================
cleanup_expired_demos() {
    log "期限切れデモ環境をチェック中..."
    
    local today=$(date +%Y-%m-%d)
    local count=0
    
    docker ps --filter "label=ai-os.demo=true" --format "{{.Names}}" | while read -r env_name; do
        local expiry=$(docker inspect -f '{{.Config.Labels.expiry}}' "$env_name" 2>/dev/null)
        
        if [[ -n "$expiry" && "$expiry" < "$today" ]]; then
            warning "期限切れ: ${env_name} (期限: ${expiry})"
            delete_demo_environment "${env_name}"
            ((count++))
        fi
    done
    
    if [[ $count -eq 0 ]]; then
        log "期限切れのデモ環境はありません"
    else
        success "${count}個の期限切れデモ環境を削除しました"
    fi
}

# ========================================
# メイン処理
# ========================================
main() {
    case "${1:-help}" in
        "create")
            if [[ $# -lt 4 ]]; then
                error "使用方法: $0 create <会社名> <会社ID> <管理者メール>"
            fi
            setup_demo_environment "$2" "$3" "$4"
            generate_access_info "demo-$3" "$2" "$4" "$3.${DEMO_DOMAIN}"
            ;;
        "list")
            list_demo_environments
            ;;
        "delete")
            if [[ $# -lt 2 ]]; then
                error "使用方法: $0 delete <環境名>"
            fi
            delete_demo_environment "$2"
            ;;
        "extend")
            if [[ $# -lt 3 ]]; then
                error "使用方法: $0 extend <環境名> <日数>"
            fi
            extend_demo_environment "$2" "$3"
            ;;
        "cleanup")
            cleanup_expired_demos
            ;;
        "help"|*)
            cat << EOF
AI-OS デモ環境管理ツール

使用方法:
  $0 create <会社名> <会社ID> <管理者メール>  新規デモ環境を作成
  $0 list                                    アクティブなデモ環境一覧
  $0 delete <環境名>                         デモ環境を削除
  $0 extend <環境名> <日数>                  有効期限を延長
  $0 cleanup                                 期限切れ環境を自動削除
  $0 help                                    このヘルプを表示

例:
  $0 create "株式会社サンプル" "sample001" "demo@sample.com"
  $0 extend demo-sample001 30
  $0 delete demo-sample001

環境変数:
  DEMO_DOMAIN      デモ環境のドメイン (デフォルト: demo.ai-os.com)
  DEMO_DATA_SIZE   サンプルデータサイズ: small/medium/large (デフォルト: small)
  DEMO_DURATION    有効期限日数 (デフォルト: 30)
EOF
            ;;
    esac
}

# 実行
main "$@"