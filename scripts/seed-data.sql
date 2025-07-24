-- AI-OS v1.0.0 初期データセットアップスクリプト
-- 本番環境用の初期マスターデータとサンプル企業データ

BEGIN;

-- ========================================
-- システム管理者アカウント
-- ========================================
INSERT INTO system_administrators (id, email, name, password_hash, created_at) VALUES
('00000000-0000-0000-0000-000000000001', 'admin@ai-os.com', 'システム管理者', '$2b$12$DUMMY_HASH_REPLACE_IN_PROD', NOW());

-- ========================================
-- システムロール（RBAC）
-- ========================================
INSERT INTO roles (id, name, display_name, description, system_role, priority) VALUES
('00000000-0000-0000-0001-000000000001', 'super_admin', 'スーパー管理者', 'システム全体の管理権限', true, 0),
('00000000-0000-0000-0001-000000000002', 'company_admin', '企業管理者', '企業内の全権限', false, 100),
('00000000-0000-0000-0001-000000000003', 'hr_manager', '人事マネージャー', '人事関連の管理権限', false, 200),
('00000000-0000-0000-0001-000000000004', 'finance_manager', '経理マネージャー', '経理関連の管理権限', false, 300),
('00000000-0000-0000-0001-000000000005', 'department_manager', '部門マネージャー', '部門内の管理権限', false, 400),
('00000000-0000-0000-0001-000000000006', 'team_leader', 'チームリーダー', 'チーム内の限定的な管理権限', false, 500),
('00000000-0000-0000-0001-000000000007', 'employee', '一般従業員', '自身のデータへのアクセス権限', false, 1000);

-- ========================================
-- 権限定義
-- ========================================
INSERT INTO permissions (id, resource, action, name, description) VALUES
-- 従業員管理
('00000000-0000-0000-0002-000000000001', 'employee', 'create', '従業員作成', '新規従業員の登録'),
('00000000-0000-0000-0002-000000000002', 'employee', 'read', '従業員参照', '従業員情報の参照'),
('00000000-0000-0000-0002-000000000003', 'employee', 'update', '従業員更新', '従業員情報の更新'),
('00000000-0000-0000-0002-000000000004', 'employee', 'delete', '従業員削除', '従業員の削除'),
-- 勤怠管理
('00000000-0000-0000-0002-000000000011', 'time_record', 'create', '勤怠記録作成', '勤怠記録の作成'),
('00000000-0000-0000-0002-000000000012', 'time_record', 'read', '勤怠記録参照', '勤怠記録の参照'),
('00000000-0000-0000-0002-000000000013', 'time_record', 'update', '勤怠記録更新', '勤怠記録の修正'),
('00000000-0000-0000-0002-000000000014', 'time_record', 'approve', '勤怠承認', '勤怠記録の承認'),
-- 給与管理
('00000000-0000-0000-0002-000000000021', 'payroll', 'calculate', '給与計算', '給与計算の実行'),
('00000000-0000-0000-0002-000000000022', 'payroll', 'read', '給与参照', '給与情報の参照'),
('00000000-0000-0000-0002-000000000023', 'payroll', 'approve', '給与承認', '給与計算結果の承認'),
('00000000-0000-0000-0002-000000000024', 'payroll', 'export', '給与エクスポート', '給与データの出力'),
-- 経費管理
('00000000-0000-0000-0002-000000000031', 'expense', 'create', '経費申請作成', '経費申請の作成'),
('00000000-0000-0000-0002-000000000032', 'expense', 'read', '経費申請参照', '経費申請の参照'),
('00000000-0000-0000-0002-000000000033', 'expense', 'approve', '経費承認', '経費申請の承認'),
('00000000-0000-0000-0002-000000000034', 'expense', 'reject', '経費却下', '経費申請の却下'),
-- レポート・分析
('00000000-0000-0000-0002-000000000041', 'analytics', 'read', 'レポート参照', '分析レポートの参照'),
('00000000-0000-0000-0002-000000000042', 'analytics', 'create', 'レポート作成', 'カスタムレポートの作成'),
('00000000-0000-0000-0002-000000000043', 'analytics', 'export', 'レポート出力', 'レポートのエクスポート'),
-- システム設定
('00000000-0000-0000-0002-000000000051', 'system_settings', 'read', 'システム設定参照', 'システム設定の参照'),
('00000000-0000-0000-0002-000000000052', 'system_settings', 'update', 'システム設定更新', 'システム設定の変更'),
('00000000-0000-0000-0002-000000000053', 'system_settings', 'create', 'システム設定作成', '新規設定の追加'),
-- AIエージェント管理
('00000000-0000-0000-0002-000000000061', 'agent_config', 'read', 'エージェント設定参照', 'AIエージェントの設定参照'),
('00000000-0000-0000-0002-000000000062', 'agent_config', 'update', 'エージェント設定更新', 'AIエージェントの設定変更'),
('00000000-0000-0000-0002-000000000063', 'agent_config', 'execute', 'エージェント実行', 'AIエージェントの手動実行'),
-- 統合管理
('00000000-0000-0000-0002-000000000071', 'integration', 'create', '統合設定作成', '外部システム統合の設定'),
('00000000-0000-0000-0002-000000000072', 'integration', 'read', '統合設定参照', '統合設定の参照'),
('00000000-0000-0000-0002-000000000073', 'integration', 'execute', '統合実行', '統合処理の実行');

-- ========================================
-- ロールと権限の関連付け
-- ========================================
-- スーパー管理者には全権限
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0001-000000000001', id FROM permissions;

-- 企業管理者
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0001-000000000002', id FROM permissions
WHERE resource NOT IN ('system_settings');

-- 人事マネージャー
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0001-000000000003', id FROM permissions
WHERE resource IN ('employee', 'time_record', 'analytics', 'agent_config');

-- 経理マネージャー
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0001-000000000004', id FROM permissions
WHERE resource IN ('payroll', 'expense', 'analytics', 'integration');

-- 一般従業員
INSERT INTO role_permissions (role_id, permission_id, conditions)
VALUES 
('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0002-000000000002', '{"scope": "own"}'),
('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0002-000000000011', '{"scope": "own"}'),
('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0002-000000000012', '{"scope": "own"}'),
('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0002-000000000031', '{"scope": "own"}'),
('00000000-0000-0000-0001-000000000007', '00000000-0000-0000-0002-000000000032', '{"scope": "own"}');

-- ========================================
-- 業種マスタ
-- ========================================
INSERT INTO industries (code, name, category) VALUES
('01', '情報通信業', 'サービス'),
('02', '製造業', '製造'),
('03', '卸売業・小売業', '流通'),
('04', '金融業・保険業', '金融'),
('05', '不動産業', 'サービス'),
('06', '建設業', '建設'),
('07', '運輸業・郵便業', '物流'),
('08', '医療・福祉', 'サービス'),
('09', '教育・学習支援業', 'サービス'),
('10', '宿泊業・飲食サービス業', 'サービス');

-- ========================================
-- 職種マスタ
-- ========================================
INSERT INTO job_categories (code, name, description) VALUES
('J01', '営業・販売', '営業、販売、カスタマーサービス'),
('J02', '企画・マーケティング', '商品企画、マーケティング、広報'),
('J03', '事務・管理', '総務、人事、経理、法務'),
('J04', '技術・開発', 'エンジニア、研究開発、生産技術'),
('J05', '製造・生産', '製造オペレーター、品質管理'),
('J06', 'クリエイティブ', 'デザイナー、ライター、編集'),
('J07', '専門職', 'コンサルタント、アナリスト、専門サービス'),
('J08', '医療・福祉', '医師、看護師、介護士'),
('J09', '教育', '教師、講師、インストラクター'),
('J10', 'サービス', '接客、調理、清掃');

-- ========================================
-- スキルカテゴリマスタ
-- ========================================
INSERT INTO skill_categories (id, name, description, parent_id) VALUES
('00000000-0000-0000-0003-000000000001', '技術スキル', 'プログラミング、エンジニアリング関連', NULL),
('00000000-0000-0000-0003-000000000002', 'ビジネススキル', 'ビジネス遂行に必要なスキル', NULL),
('00000000-0000-0000-0003-000000000003', 'ソフトスキル', '対人関係、コミュニケーション関連', NULL),
('00000000-0000-0000-0003-000000000004', 'リーダーシップ', 'マネジメント、リーダーシップ関連', NULL),
('00000000-0000-0000-0003-000000000005', '専門知識', '業界特有の専門知識', NULL);

-- ========================================
-- 祝日マスタ（2025年）
-- ========================================
INSERT INTO holidays (date, name, type, country) VALUES
('2025-01-01', '元日', 'national', 'JP'),
('2025-01-13', '成人の日', 'national', 'JP'),
('2025-02-11', '建国記念の日', 'national', 'JP'),
('2025-02-23', '天皇誕生日', 'national', 'JP'),
('2025-02-24', '振替休日', 'national', 'JP'),
('2025-03-20', '春分の日', 'national', 'JP'),
('2025-04-29', '昭和の日', 'national', 'JP'),
('2025-05-03', '憲法記念日', 'national', 'JP'),
('2025-05-04', 'みどりの日', 'national', 'JP'),
('2025-05-05', 'こどもの日', 'national', 'JP'),
('2025-05-06', '振替休日', 'national', 'JP'),
('2025-07-21', '海の日', 'national', 'JP'),
('2025-08-11', '山の日', 'national', 'JP'),
('2025-09-15', '敬老の日', 'national', 'JP'),
('2025-09-23', '秋分の日', 'national', 'JP'),
('2025-10-13', 'スポーツの日', 'national', 'JP'),
('2025-11-03', '文化の日', 'national', 'JP'),
('2025-11-23', '勤労感謝の日', 'national', 'JP'),
('2025-11-24', '振替休日', 'national', 'JP');

-- ========================================
-- AIエージェント初期設定
-- ========================================
INSERT INTO ai_agents (id, agent_type, name, description, status, capabilities, model_config, enabled) VALUES
('00000000-0000-0000-0004-000000000001', 'payroll', '給与計算エージェント', '月次給与計算を自動実行', 'active', 
 '["calculate_salary", "validate_timesheet", "generate_payslip"]',
 '{"model": "gpt-4", "temperature": 0.1, "max_tokens": 4096}', true),
 
('00000000-0000-0000-0004-000000000002', 'compliance', 'コンプライアンス監視エージェント', '労働法違反を24時間監視', 'active',
 '["monitor_overtime", "check_36agreement", "alert_violations"]',
 '{"model": "gpt-4", "temperature": 0.2, "scan_interval": 3600}', true),
 
('00000000-0000-0000-0004-000000000003', 'expense', '経費処理エージェント', 'OCR認識と自動承認処理', 'active',
 '["ocr_receipt", "validate_expense", "auto_approve", "fraud_detection"]',
 '{"model": "gpt-4-vision", "confidence_threshold": 0.95}', true),
 
('00000000-0000-0000-0004-000000000004', 'analytics', '予測分析エージェント', '離職予測と生産性分析', 'active',
 '["predict_turnover", "analyze_productivity", "generate_insights"]',
 '{"model": "gpt-4", "prediction_horizon": 90}', true),
 
('00000000-0000-0000-0004-000000000005', 'hr_assistant', 'HR支援エージェント', '従業員の質問に自動応答', 'active',
 '["answer_questions", "provide_guidance", "schedule_meetings"]',
 '{"model": "gpt-3.5-turbo", "temperature": 0.7}', true);

-- ========================================
-- デモ企業データ（オプション）
-- ========================================
-- 注: 本番環境では必要に応じて削除

INSERT INTO companies (id, name, name_kana, industry_code, employee_count, fiscal_year_start, founded_date) VALUES
('00000000-0000-0000-0005-000000000001', 'デモ株式会社', 'デモカブシキガイシャ', '01', 100, 4, '2020-04-01');

INSERT INTO departments (id, company_id, name, code, parent_id, manager_id) VALUES
('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0005-000000000001', '経営企画部', 'MGMT', NULL, NULL),
('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0005-000000000001', '営業部', 'SALES', NULL, NULL),
('00000000-0000-0000-0006-000000000003', '00000000-0000-0000-0005-000000000001', '開発部', 'DEV', NULL, NULL),
('00000000-0000-0000-0006-000000000004', '00000000-0000-0000-0005-000000000001', '人事総務部', 'HR', NULL, NULL);

-- ========================================
-- システム設定初期値
-- ========================================
INSERT INTO system_settings (key, value, category, description) VALUES
('overtime.monthly_limit', '45', 'compliance', '月間残業時間上限（時間）'),
('overtime.yearly_limit', '360', 'compliance', '年間残業時間上限（時間）'),
('overtime.alert_threshold', '0.8', 'compliance', 'アラート発生閾値（上限の何割）'),
('payroll.calculation_day', '25', 'payroll', '給与計算締め日'),
('payroll.payment_day', '10', 'payroll', '給与支払日'),
('vacation.annual_grant_month', '4', 'vacation', '年次有給休暇付与月'),
('expense.auto_approve_limit', '10000', 'expense', '自動承認上限金額（円）'),
('ai.agent_execution_hour', '2', 'ai', 'AIエージェント定期実行時刻'),
('security.password_min_length', '12', 'security', 'パスワード最小文字数'),
('security.session_timeout', '28800', 'security', 'セッションタイムアウト（秒）');

-- ========================================
-- 通知テンプレート
-- ========================================
INSERT INTO notification_templates (id, code, name, subject, body, variables) VALUES
('00000000-0000-0000-0007-000000000001', 'overtime_alert', '残業時間アラート', 
 '残業時間が上限に近づいています', 
 '{{employee_name}}様\n\n今月の残業時間が{{hours}}時間となり、上限の{{percentage}}%に達しました。\n健康管理にご注意ください。',
 '["employee_name", "hours", "percentage"]'),
 
('00000000-0000-0000-0007-000000000002', 'payroll_complete', '給与計算完了', 
 '{{month}}月分の給与明細が確認可能です', 
 '{{employee_name}}様\n\n{{month}}月分の給与計算が完了しました。\nシステムにログインして給与明細をご確認ください。',
 '["employee_name", "month"]'),
 
('00000000-0000-0000-0007-000000000003', 'expense_approved', '経費承認完了', 
 '経費申請が承認されました', 
 '{{employee_name}}様\n\n申請番号{{expense_id}}の経費申請が承認されました。\n金額: {{amount}}円\n支払予定日: {{payment_date}}',
 '["employee_name", "expense_id", "amount", "payment_date"]');

COMMIT;

-- ========================================
-- インデックス作成
-- ========================================
CREATE INDEX idx_holidays_date ON holidays(date);
CREATE INDEX idx_roles_name ON roles(name);
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX idx_companies_industry ON companies(industry_code);
CREATE INDEX idx_departments_company ON departments(company_id);
CREATE INDEX idx_ai_agents_type_status ON ai_agents(agent_type, status) WHERE enabled = true;

-- ========================================
-- 統計情報更新
-- ========================================
ANALYZE;