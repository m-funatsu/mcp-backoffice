#!/bin/bash
# AI-OS v1.0.0 本番環境デプロイメントスクリプト
# Production Deployment Script

set -euo pipefail

# =============================================================================
# AI-OS Production Deployment Script v1.0.0
# =============================================================================

# 基本設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_LOG="/var/log/ai-os/deployment-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="/backup/ai-os/$(date +%Y%m%d-%H%M%S)"

# 色付きログ出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

# エラーハンドリング
trap 'log_error "Deployment failed at line $LINENO. Exit code: $?"' ERR

# =============================================================================
# 設定値確認
# =============================================================================

check_environment() {
    log_info "=== Environment Validation ==="
    
    # 必須環境変数の確認
    required_vars=(
        "ENVIRONMENT"
        "DATABASE_URL"
        "REDIS_URL"
        "AWS_REGION"
        "EKS_CLUSTER_NAME"
        "DOMAIN_NAME"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
        log_success "✓ $var is set"
    done
    
    # Kubernetes接続確認
    if ! kubectl cluster-info &>/dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    log_success "✓ Kubernetes cluster connection established"
    
    # Docker Registry接続確認
    if ! docker info &>/dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    log_success "✓ Docker is running"
    
    # AWS CLI設定確認
    if ! aws sts get-caller-identity &>/dev/null; then
        log_error "AWS CLI is not configured properly"
        exit 1
    fi
    log_success "✓ AWS CLI is configured"
}

# =============================================================================
# 事前準備・バックアップ
# =============================================================================

create_backup() {
    log_info "=== Creating System Backup ==="
    
    # バックアップディレクトリ作成
    mkdir -p "$BACKUP_DIR"/{database,redis,config,logs}
    
    # データベースバックアップ
    log_info "Creating database backup..."
    pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/database/ai-os-$(date +%Y%m%d-%H%M%S).sql.gz"
    log_success "✓ Database backup completed"
    
    # Redis バックアップ
    log_info "Creating Redis backup..."
    redis-cli --rdb "$BACKUP_DIR/redis/ai-os-$(date +%Y%m%d-%H%M%S).rdb"
    log_success "✓ Redis backup completed"
    
    # 設定ファイルバックアップ
    log_info "Creating configuration backup..."
    kubectl get configmaps -o yaml > "$BACKUP_DIR/config/configmaps.yaml"
    kubectl get secrets -o yaml > "$BACKUP_DIR/config/secrets.yaml"
    log_success "✓ Configuration backup completed"
    
    # バックアップ検証
    if [[ -f "$BACKUP_DIR/database/ai-os-$(date +%Y%m%d-%H%M%S).sql.gz" ]]; then
        log_success "✓ Backup verification passed"
    else
        log_error "Backup verification failed"
        exit 1
    fi
}

# =============================================================================
# イメージビルド・プッシュ
# =============================================================================

build_and_push_images() {
    log_info "=== Building and Pushing Docker Images ==="
    
    # ECR ログイン
    aws ecr get-login-password --region "$AWS_REGION" | \
        docker login --username AWS --password-stdin "${ECR_REPOSITORY_URI}"
    
    # アプリケーションイメージビルド
    log_info "Building main application image..."
    docker build -t "ai-os:${BUILD_VERSION}" \
                 -f "$PROJECT_ROOT/Dockerfile" \
                 "$PROJECT_ROOT"
    
    # タグ付けとプッシュ
    docker tag "ai-os:${BUILD_VERSION}" "${ECR_REPOSITORY_URI}/ai-os:${BUILD_VERSION}"
    docker tag "ai-os:${BUILD_VERSION}" "${ECR_REPOSITORY_URI}/ai-os:latest"
    
    docker push "${ECR_REPOSITORY_URI}/ai-os:${BUILD_VERSION}"
    docker push "${ECR_REPOSITORY_URI}/ai-os:latest"
    
    log_success "✓ Application image pushed: ${BUILD_VERSION}"
    
    # 依存サービスイメージの確認
    for service in postgres redis nginx; do
        log_info "Verifying $service image..."
        if docker pull "$service:latest" &>/dev/null; then
            log_success "✓ $service image available"
        else
            log_error "$service image not available"
            exit 1
        fi
    done
}

# =============================================================================
# データベース Migration
# =============================================================================

run_database_migration() {
    log_info "=== Running Database Migration ==="
    
    # Migration 用 Pod デプロイ
    kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ai-os-migration-$(date +%s)
  namespace: ai-os-production
spec:
  template:
    spec:
      containers:
      - name: migration
        image: ${ECR_REPOSITORY_URI}/ai-os:${BUILD_VERSION}
        command: ["npm", "run", "migrate:production"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ai-os-secrets
              key: database-url
        - name: NODE_ENV
          value: "production"
      restartPolicy: Never
  backoffLimit: 3
EOF
    
    # Migration完了待ち
    kubectl wait --for=condition=complete job/ai-os-migration-$(date +%s) \
                  --namespace=ai-os-production --timeout=600s
    
    log_success "✓ Database migration completed"
}

# =============================================================================
# Kubernetes デプロイメント
# =============================================================================

deploy_kubernetes_resources() {
    log_info "=== Deploying Kubernetes Resources ==="
    
    # ConfigMap更新
    log_info "Applying ConfigMaps..."
    envsubst < "$PROJECT_ROOT/k8s/configmap.yaml" | kubectl apply -f -
    
    # Secrets更新 (存在しない場合のみ)
    if ! kubectl get secret ai-os-secrets --namespace=ai-os-production &>/dev/null; then
        log_info "Creating Secrets..."
        envsubst < "$PROJECT_ROOT/k8s/secrets.yaml" | kubectl apply -f -
    fi
    
    # Persistent Volume Claims
    log_info "Applying PVCs..."
    kubectl apply -f "$PROJECT_ROOT/k8s/pvc.yaml"
    
    # Services
    log_info "Applying Services..."
    kubectl apply -f "$PROJECT_ROOT/k8s/services.yaml"
    
    # Deployments (Rolling Update)
    log_info "Deploying applications..."
    envsubst < "$PROJECT_ROOT/k8s/deployment.yaml" | kubectl apply -f -
    
    # Ingress
    log_info "Applying Ingress..."
    envsubst < "$PROJECT_ROOT/k8s/ingress.yaml" | kubectl apply -f -
    
    # HPA (Horizontal Pod Autoscaler)
    log_info "Applying HPA..."
    kubectl apply -f "$PROJECT_ROOT/k8s/hpa.yaml"
    
    log_success "✓ Kubernetes resources deployed"
}

# =============================================================================
# デプロイメント確認
# =============================================================================

verify_deployment() {
    log_info "=== Verifying Deployment ==="
    
    # Pod Status確認
    log_info "Checking Pod status..."
    kubectl rollout status deployment/ai-os-app --namespace=ai-os-production --timeout=600s
    kubectl rollout status deployment/ai-os-worker --namespace=ai-os-production --timeout=600s
    
    # Pod健康状態確認
    if kubectl get pods --namespace=ai-os-production | grep -E "(Error|CrashLoopBackOff|ImagePullBackOff)"; then
        log_error "Some pods are in error state"
        kubectl describe pods --namespace=ai-os-production
        exit 1
    fi
    log_success "✓ All pods are healthy"
    
    # Service エンドポイント確認
    log_info "Checking service endpoints..."
    for service in ai-os-app ai-os-worker ai-os-database; do
        if kubectl get endpoints "$service" --namespace=ai-os-production | grep -q "none"; then
            log_error "Service $service has no endpoints"
            exit 1
        fi
        log_success "✓ Service $service has active endpoints"
    done
    
    # アプリケーションヘルスチェック
    log_info "Running application health check..."
    sleep 30  # Pod起動待ち
    
    for i in {1..10}; do
        if curl -f "https://${DOMAIN_NAME}/api/health" &>/dev/null; then
            log_success "✓ Application health check passed"
            break
        fi
        if [[ $i -eq 10 ]]; then
            log_error "Application health check failed after 10 attempts"
            exit 1
        fi
        log_info "Health check attempt $i/10 failed, retrying in 30s..."
        sleep 30
    done
}

# =============================================================================
# 負荷テスト
# =============================================================================

run_load_test() {
    log_info "=== Running Load Test ==="
    
    # k6 負荷テスト実行
    kubectl run load-test-$(date +%s) \
        --image=loadimpact/k6:latest \
        --rm -i --restart=Never \
        --namespace=ai-os-production \
        -- run --vus 100 --duration 5m - <<EOF
import http from 'k6/http';
import { check } from 'k6';

export default function() {
    const response = http.get('https://${DOMAIN_NAME}/api/health');
    check(response, {
        'status is 200': (r) => r.status === 200,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });
}
EOF
    
    log_success "✓ Load test completed"
}

# =============================================================================
# SSL証明書・DNS設定
# =============================================================================

configure_ssl_dns() {
    log_info "=== Configuring SSL Certificate and DNS ==="
    
    # Let's Encrypt証明書発行（cert-manager使用）
    kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ai-os-tls
  namespace: ai-os-production
spec:
  secretName: ai-os-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - ${DOMAIN_NAME}
  - api.${DOMAIN_NAME}
  - admin.${DOMAIN_NAME}
EOF
    
    # 証明書発行待ち
    kubectl wait --for=condition=Ready certificate/ai-os-tls \
                  --namespace=ai-os-production --timeout=300s
    
    # Route53 DNS レコード更新
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$HOSTED_ZONE_ID" \
        --change-batch file://dns-changeset.json
    
    log_success "✓ SSL certificate and DNS configured"
}

# =============================================================================
# 監視・ログ設定
# =============================================================================

setup_monitoring() {
    log_info "=== Setting up Monitoring and Logging ==="
    
    # Prometheus Operator インストール
    if ! kubectl get namespace monitoring &>/dev/null; then
        kubectl create namespace monitoring
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        helm install prometheus prometheus-community/kube-prometheus-stack \
             --namespace monitoring \
             --set grafana.adminPassword="${GRAFANA_ADMIN_PASSWORD}"
    fi
    
    # アプリケーション固有メトリクス設定
    kubectl apply -f "$PROJECT_ROOT/k8s/monitoring/"
    
    # ログ集約設定（Fluent Bit）
    kubectl apply -f "$PROJECT_ROOT/k8s/logging/"
    
    log_success "✓ Monitoring and logging configured"
}

# =============================================================================
# 通知設定
# =============================================================================

setup_notifications() {
    log_info "=== Setting up Notifications ==="
    
    # Slack通知設定
    kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-slack
  namespace: monitoring
data:
  slack-webhook-url: $(echo -n "$SLACK_WEBHOOK_URL" | base64)
EOF
    
    # メール通知設定
    kubectl patch configmap alertmanager-prometheus-kube-prometheus-alertmanager \
                  --namespace monitoring \
                  --patch-file "$PROJECT_ROOT/k8s/alertmanager-config.yaml"
    
    log_success "✓ Notifications configured"
}

# =============================================================================
# デプロイメント完了処理
# =============================================================================

finalize_deployment() {
    log_info "=== Finalizing Deployment ==="
    
    # 古いReplicaSetクリーンアップ
    kubectl patch deployment ai-os-app --namespace=ai-os-production \
            -p '{"spec":{"revisionHistoryLimit":3}}'
    
    # 不要なPodクリーンアップ
    kubectl delete pods --field-selector=status.phase=Succeeded \
                         --namespace=ai-os-production
    
    # デプロイメント情報の記録
    cat > "$BACKUP_DIR/deployment-info.json" <<EOF
{
    "version": "${BUILD_VERSION}",
    "deploymentTime": "$(date -Iseconds)",
    "gitCommit": "$(git rev-parse HEAD)",
    "deployer": "$(whoami)",
    "environment": "${ENVIRONMENT}",
    "backupLocation": "${BACKUP_DIR}"
}
EOF
    
    log_success "✓ Deployment finalized"
}

# =============================================================================
# ロールバック機能
# =============================================================================

rollback_deployment() {
    log_error "=== ROLLING BACK DEPLOYMENT ==="
    
    # 最新のバックアップディレクトリを取得
    LATEST_BACKUP=$(ls -1t /backup/ai-os/ | head -n1)
    
    # データベースロールバック
    log_info "Rolling back database..."
    gunzip -c "/backup/ai-os/$LATEST_BACKUP/database/"*.sql.gz | psql "$DATABASE_URL"
    
    # Kubernetesロールバック
    log_info "Rolling back Kubernetes deployments..."
    kubectl rollout undo deployment/ai-os-app --namespace=ai-os-production
    kubectl rollout undo deployment/ai-os-worker --namespace=ai-os-production
    
    # 設定ロールバック
    log_info "Rolling back configurations..."
    kubectl apply -f "/backup/ai-os/$LATEST_BACKUP/config/configmaps.yaml"
    
    log_warning "Rollback completed. Please verify system status."
}

# =============================================================================
# メイン実行フロー
# =============================================================================

main() {
    log_info "=== AI-OS v1.0.0 Production Deployment Started ==="
    log_info "Build Version: ${BUILD_VERSION}"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "Deployment started at: $(date)"
    
    # フェーズ1: 事前確認
    check_environment
    
    # フェーズ2: バックアップ作成
    create_backup
    
    # フェーズ3: イメージビルド
    build_and_push_images
    
    # フェーズ4: データベース更新
    run_database_migration
    
    # フェーズ5: Kubernetesデプロイ
    deploy_kubernetes_resources
    
    # フェーズ6: デプロイメント確認
    verify_deployment
    
    # フェーズ7: SSL・DNS設定
    configure_ssl_dns
    
    # フェーズ8: 監視設定
    setup_monitoring
    
    # フェーズ9: 通知設定
    setup_notifications
    
    # フェーズ10: 負荷テスト
    run_load_test
    
    # フェーズ11: 最終処理
    finalize_deployment
    
    log_success "=== AI-OS v1.0.0 Production Deployment Completed ==="
    log_success "Application URL: https://${DOMAIN_NAME}"
    log_success "Admin Dashboard: https://admin.${DOMAIN_NAME}"
    log_success "API Endpoint: https://api.${DOMAIN_NAME}"
    log_success "Monitoring: https://monitoring.${DOMAIN_NAME}"
    log_success "Deployment completed at: $(date)"
    
    echo ""
    echo "🎉 AI-OS v1.0.0 is now live in production!"
    echo "📊 Monitor the system at: https://monitoring.${DOMAIN_NAME}"
    echo "📞 For issues, contact: devops@ai-os.com"
    echo ""
}

# エラー時のロールバック
if [[ "${1:-}" == "--rollback" ]]; then
    rollback_deployment
    exit 0
fi

# メイン処理実行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi