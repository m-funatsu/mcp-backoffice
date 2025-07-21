-- ================================================================================
-- AI-OS v3.2.0 エンタープライズ設定管理コンソール
-- データベーススキーマ定義
-- ================================================================================

-- ========================================
-- 1. 役割と権限管理 (RBAC)
-- ========================================

-- 役割定義テーブル
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    system_role BOOLEAN DEFAULT FALSE, -- システム定義の役割かカスタム役割か
    priority INTEGER DEFAULT 1000, -- 優先順位（小さいほど優先）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 権限定義テーブル
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(100) NOT NULL, -- リソース名（例：employee, payroll, expense）
    action VARCHAR(50) NOT NULL, -- アクション（create, read, update, delete, approve）
    scope VARCHAR(50) DEFAULT 'own', -- スコープ（own, department, company）
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource, action, scope)
);

-- 役割-権限マッピング
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    conditions JSONB, -- 条件付き権限（例：金額上限、時間帯制限）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);

-- ユーザー-役割マッピング
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    department_id UUID, -- 部門限定の役割の場合
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_until DATE,
    assigned_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

-- ========================================
-- 2. AIエージェント設定管理
-- ========================================

-- AIエージェント定義
CREATE TABLE IF NOT EXISTS ai_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    agent_type VARCHAR(50) NOT NULL, -- payroll, compliance, expense, analytics
    version VARCHAR(20) NOT NULL,
    capabilities JSONB NOT NULL, -- エージェントの能力定義
    default_config JSONB NOT NULL, -- デフォルト設定
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- エージェント設定（企業・部門別）
CREATE TABLE IF NOT EXISTS agent_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    department_id UUID, -- NULL の場合は全社設定
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB NOT NULL, -- エージェント固有の設定
    sensitivity_settings JSONB, -- 感度設定（アラート閾値など）
    notification_settings JSONB, -- 通知設定
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, company_id, department_id)
);

-- エージェント実行履歴
CREATE TABLE IF NOT EXISTS agent_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES ai_agents(id),
    config_id UUID REFERENCES agent_configurations(id),
    execution_type VARCHAR(50) NOT NULL, -- scheduled, manual, triggered
    status VARCHAR(20) NOT NULL, -- running, completed, failed
    input_data JSONB,
    output_data JSONB,
    performance_metrics JSONB, -- 実行時間、処理件数など
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 3. インテグレーション管理
-- ========================================

-- 外部サービス連携定義
CREATE TABLE IF NOT EXISTS integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL, -- freee, moneyforward, slack, teams
    service_type VARCHAR(50) NOT NULL, -- accounting, communication, project_management
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    auth_type VARCHAR(50) NOT NULL, -- oauth2, api_key, basic
    config_schema JSONB NOT NULL, -- 設定項目のスキーマ定義
    capabilities JSONB NOT NULL, -- 連携可能な機能
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 企業別インテグレーション設定
CREATE TABLE IF NOT EXISTS integration_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    auth_credentials JSONB, -- 暗号化された認証情報
    config JSONB NOT NULL, -- サービス固有の設定
    sync_settings JSONB, -- 同期設定（頻度、対象データなど）
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(20), -- active, error, paused
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(integration_id, company_id)
);

-- ========================================
-- 4. 監査ログ
-- ========================================

-- 設定変更監査ログ
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- role, permission, agent_config, integration
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- create, update, delete, enable, disable
    changes JSONB NOT NULL, -- 変更前後の値
    user_id UUID REFERENCES employees(id),
    user_ip INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    reason TEXT, -- 変更理由（任意）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 監査ログインデックス
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ========================================
-- 5. データガバナンス設定
-- ========================================

-- データ保持ポリシー
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    data_type VARCHAR(100) NOT NULL, -- employee_data, time_records, payroll, expenses
    retention_days INTEGER NOT NULL,
    deletion_strategy VARCHAR(50) NOT NULL, -- hard_delete, soft_delete, anonymize
    legal_basis TEXT, -- 法的根拠
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, data_type)
);

-- データアクセス制御
CREATE TABLE IF NOT EXISTS data_access_controls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    data_category VARCHAR(100) NOT NULL, -- personal_info, salary, performance
    access_rules JSONB NOT NULL, -- 詳細なアクセスルール
    encryption_required BOOLEAN DEFAULT TRUE,
    audit_required BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, data_category)
);

-- ========================================
-- 6. システムデフォルト設定
-- ========================================

-- デフォルト役割の挿入
INSERT INTO roles (name, display_name, description, system_role, priority) VALUES
('super_admin', 'スーパー管理者', 'すべての機能にアクセス可能', TRUE, 1),
('company_admin', '企業管理者', '企業全体の設定管理が可能', TRUE, 10),
('hr_manager', '人事マネージャー', '人事関連機能の管理', TRUE, 20),
('finance_manager', '経理マネージャー', '経理関連機能の管理', TRUE, 30),
('department_manager', '部門マネージャー', '部門内の管理機能', TRUE, 40),
('employee', '一般従業員', '基本的な機能のみ利用可能', TRUE, 100);

-- デフォルトAIエージェントの挿入
INSERT INTO ai_agents (name, display_name, description, agent_type, version, capabilities, default_config) VALUES
('payroll_agent', '給与計算エージェント', '自律的な給与計算を実行', 'payroll', '1.0.0',
    '{"auto_calculation": true, "validation": true, "compliance_check": true}',
    '{"calculation_day": 25, "payment_day": 25, "overtime_threshold": 45}'
),
('compliance_agent', 'コンプライアンス監視エージェント', '労働法違反を24/7監視', 'compliance', '1.0.0',
    '{"real_time_monitoring": true, "alert_generation": true, "auto_reporting": true}',
    '{"alert_threshold": "warning", "monitoring_interval": 300}'
),
('expense_agent', '経費処理エージェント', 'OCRと承認ワークフローを自動化', 'expense', '1.0.0',
    '{"ocr_processing": true, "auto_approval": true, "fraud_detection": true}',
    '{"auto_approve_limit": 10000, "ocr_confidence_threshold": 0.9}'
);

-- ========================================
-- 7. ビューの作成
-- ========================================

-- ユーザー権限の統合ビュー
CREATE OR REPLACE VIEW user_permissions_view AS
SELECT 
    ur.user_id,
    u.name as user_name,
    r.name as role_name,
    p.resource,
    p.action,
    p.scope,
    rp.conditions,
    ur.department_id,
    ur.effective_from,
    ur.effective_until
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
JOIN employees u ON ur.user_id = u.id
WHERE ur.effective_from <= CURRENT_DATE
  AND (ur.effective_until IS NULL OR ur.effective_until >= CURRENT_DATE);

-- エージェント設定状態ビュー
CREATE OR REPLACE VIEW agent_status_view AS
SELECT 
    a.name as agent_name,
    a.display_name,
    a.agent_type,
    ac.company_id,
    ac.department_id,
    ac.enabled,
    ac.updated_at as last_config_update,
    el.status as last_execution_status,
    el.completed_at as last_execution_time
FROM ai_agents a
LEFT JOIN agent_configurations ac ON a.id = ac.agent_id
LEFT JOIN LATERAL (
    SELECT status, completed_at
    FROM agent_execution_logs
    WHERE agent_id = a.id AND config_id = ac.id
    ORDER BY created_at DESC
    LIMIT 1
) el ON TRUE;

-- ========================================
-- 8. トリガー関数
-- ========================================

-- 更新日時自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを適用
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON ai_agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_configurations_updated_at BEFORE UPDATE ON agent_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_integration_configs_updated_at BEFORE UPDATE ON integration_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 監査ログ自動記録トリガー（例：役割変更）
CREATE OR REPLACE FUNCTION audit_role_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, changes, user_id)
        VALUES (
            'role',
            NEW.id,
            'update',
            jsonb_build_object(
                'before', to_jsonb(OLD),
                'after', to_jsonb(NEW)
            ),
            current_setting('app.current_user_id')::UUID
        );
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (entity_type, entity_id, action, changes, user_id)
        VALUES (
            'role',
            OLD.id,
            'delete',
            jsonb_build_object('deleted', to_jsonb(OLD)),
            current_setting('app.current_user_id')::UUID
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_roles_changes
    AFTER UPDATE OR DELETE ON roles
    FOR EACH ROW EXECUTE FUNCTION audit_role_changes();