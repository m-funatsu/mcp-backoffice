#!/bin/bash

# AI-OS v1.0.0 Deployment Script
# This script handles the deployment process for production environment

set -euo pipefail

# ========================================
# Configuration
# ========================================
APP_NAME="ai-os"
VERSION="1.0.0"
DEPLOY_USER="deploy"
DEPLOY_HOST="${DEPLOY_HOST:-prod.ai-os.com}"
DEPLOY_PATH="/var/www/ai-os"
BACKUP_PATH="/var/backups/ai-os"
LOG_FILE="/var/log/ai-os/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========================================
# Helper Functions
# ========================================
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

# ========================================
# Pre-deployment Checks
# ========================================
pre_deploy_checks() {
    log "Starting pre-deployment checks..."
    
    # Check if running as deploy user
    if [[ "$USER" != "$DEPLOY_USER" ]]; then
        error "This script must be run as $DEPLOY_USER user"
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v)
    if [[ ! "$NODE_VERSION" =~ ^v20\. ]]; then
        error "Node.js 20.x is required. Current version: $NODE_VERSION"
    fi
    
    # Check if production environment file exists
    if [[ ! -f "config/production.env" ]]; then
        error "Production environment file not found"
    fi
    
    # Check database connectivity
    log "Checking database connectivity..."
    npm run db:ping:prod || error "Database connection failed"
    
    # Check Redis connectivity
    log "Checking Redis connectivity..."
    npm run redis:ping:prod || error "Redis connection failed"
    
    success "Pre-deployment checks passed"
}

# ========================================
# Build Application
# ========================================
build_application() {
    log "Building application..."
    
    # Install dependencies
    log "Installing production dependencies..."
    npm ci --production=false
    
    # Run tests
    log "Running tests..."
    npm test || error "Tests failed"
    
    # Build TypeScript
    log "Building TypeScript..."
    npm run build || error "Build failed"
    
    # Run security audit
    log "Running security audit..."
    npm audit --production || warning "Security vulnerabilities found"
    
    # Create production bundle
    log "Creating production bundle..."
    npm run bundle:prod || error "Bundle creation failed"
    
    success "Application built successfully"
}

# ========================================
# Backup Current Version
# ========================================
backup_current() {
    log "Backing up current version..."
    
    TIMESTAMP=$(date +'%Y%m%d_%H%M%S')
    BACKUP_DIR="$BACKUP_PATH/backup_$TIMESTAMP"
    
    # Create backup directory
    ssh $DEPLOY_USER@$DEPLOY_HOST "mkdir -p $BACKUP_DIR"
    
    # Backup application files
    ssh $DEPLOY_USER@$DEPLOY_HOST "cp -r $DEPLOY_PATH $BACKUP_DIR/"
    
    # Backup database
    log "Backing up database..."
    ssh $DEPLOY_USER@$DEPLOY_HOST "pg_dump $DB_NAME | gzip > $BACKUP_DIR/database.sql.gz"
    
    # Keep only last 5 backups
    ssh $DEPLOY_USER@$DEPLOY_HOST "ls -t $BACKUP_PATH | tail -n +6 | xargs -I {} rm -rf $BACKUP_PATH/{}"
    
    success "Backup completed: $BACKUP_DIR"
}

# ========================================
# Deploy Application
# ========================================
deploy_application() {
    log "Deploying application to $DEPLOY_HOST..."
    
    # Create deployment directory if not exists
    ssh $DEPLOY_USER@$DEPLOY_HOST "mkdir -p $DEPLOY_PATH/releases"
    
    RELEASE_DIR="$DEPLOY_PATH/releases/$VERSION-$(date +'%Y%m%d%H%M%S')"
    
    # Upload application bundle
    log "Uploading application bundle..."
    scp -r dist/* $DEPLOY_USER@$DEPLOY_HOST:$RELEASE_DIR/
    
    # Upload configuration files
    log "Uploading configuration..."
    scp config/production.env $DEPLOY_USER@$DEPLOY_HOST:$RELEASE_DIR/.env
    
    # Install production dependencies on server
    log "Installing dependencies on server..."
    ssh $DEPLOY_USER@$DEPLOY_HOST "cd $RELEASE_DIR && npm ci --production"
    
    # Run database migrations
    log "Running database migrations..."
    ssh $DEPLOY_USER@$DEPLOY_HOST "cd $RELEASE_DIR && npm run db:migrate:prod"
    
    # Update symlink
    log "Updating application symlink..."
    ssh $DEPLOY_USER@$DEPLOY_HOST "ln -sfn $RELEASE_DIR $DEPLOY_PATH/current"
    
    success "Application deployed to $RELEASE_DIR"
}

# ========================================
# Post-deployment Tasks
# ========================================
post_deploy() {
    log "Running post-deployment tasks..."
    
    # Restart application
    log "Restarting application..."
    ssh $DEPLOY_USER@$DEPLOY_HOST "sudo systemctl restart ai-os"
    
    # Wait for application to start
    sleep 10
    
    # Run health check
    log "Running health check..."
    HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://$DEPLOY_HOST/health)
    if [[ "$HEALTH_CHECK" != "200" ]]; then
        error "Health check failed with status: $HEALTH_CHECK"
    fi
    
    # Clear cache
    log "Clearing cache..."
    ssh $DEPLOY_USER@$DEPLOY_HOST "cd $DEPLOY_PATH/current && npm run cache:clear:prod"
    
    # Warm up cache
    log "Warming up cache..."
    ssh $DEPLOY_USER@$DEPLOY_HOST "cd $DEPLOY_PATH/current && npm run cache:warmup:prod"
    
    # Send deployment notification
    log "Sending deployment notification..."
    curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
        -H 'Content-type: application/json' \
        -d "{\"text\":\"AI-OS v$VERSION deployed successfully to production\"}"
    
    success "Post-deployment tasks completed"
}

# ========================================
# Rollback Function
# ========================================
rollback() {
    warning "Rolling back deployment..."
    
    # Get previous release
    PREVIOUS_RELEASE=$(ssh $DEPLOY_USER@$DEPLOY_HOST "ls -t $DEPLOY_PATH/releases | head -2 | tail -1")
    
    if [[ -z "$PREVIOUS_RELEASE" ]]; then
        error "No previous release found for rollback"
    fi
    
    # Update symlink to previous release
    ssh $DEPLOY_USER@$DEPLOY_HOST "ln -sfn $DEPLOY_PATH/releases/$PREVIOUS_RELEASE $DEPLOY_PATH/current"
    
    # Restart application
    ssh $DEPLOY_USER@$DEPLOY_HOST "sudo systemctl restart ai-os"
    
    success "Rolled back to $PREVIOUS_RELEASE"
}

# ========================================
# Main Deployment Flow
# ========================================
main() {
    log "=== Starting AI-OS v$VERSION Deployment ==="
    
    # Parse command line arguments
    case "${1:-deploy}" in
        "deploy")
            pre_deploy_checks
            build_application
            backup_current
            deploy_application
            post_deploy
            
            success "=== Deployment completed successfully ==="
            log "Application URL: https://$DEPLOY_HOST"
            log "Version: $VERSION"
            log "Deployment time: $(date)"
            ;;
        "rollback")
            rollback
            ;;
        "health")
            curl -s https://$DEPLOY_HOST/health | jq .
            ;;
        *)
            echo "Usage: $0 [deploy|rollback|health]"
            exit 1
            ;;
    esac
}

# ========================================
# Error Handler
# ========================================
trap 'error "Deployment failed at line $LINENO"' ERR

# ========================================
# Execute Main Function
# ========================================
main "$@"