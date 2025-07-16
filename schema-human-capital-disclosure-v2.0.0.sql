-- =============================================================================
-- 人的資本開示対応データベース拡張スキーマ v2.0.0
-- Human Capital Disclosure Database Extension Schema
-- =============================================================================
-- 【目的】
-- 金融庁「人的資本可視化指針」・ISO30414準拠の人的資本開示に必要な
-- データを網羅的に格納し、戦略的人事決定を支援する情報基盤を構築
-- 
-- 【戦略的価値】
-- 1. 法的要件への完全準拠（開示義務対応）
-- 2. データ駆動型人事戦略の実現
-- 3. 無形資産（スキル・エンゲージメント）の可視化
-- 4. 予測的人事アナリティクスの基盤構築
-- =============================================================================

-- 1. 従業員マスタテーブルの拡張
-- 多様性・リーダーシップ・組織階層管理の強化
-- PostgreSQLでは IF NOT EXISTS が標準でサポートされている
-- 既存のテーブルに新しいカラムを追加
BEGIN;
-- 各カラムを個別に追加（PostgreSQLでは IF NOT EXISTS 使用）
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS disability_status VARCHAR(50);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS education_level VARCHAR(100);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'full_time';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id INTEGER;
COMMIT;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_employees_gender ON employees(gender);
CREATE INDEX IF NOT EXISTS idx_employees_age ON employees(age);
CREATE INDEX IF NOT EXISTS idx_employees_nationality ON employees(nationality);
CREATE INDEX IF NOT EXISTS idx_employees_employment_type ON employees(employment_type);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);

-- =============================================================================
-- 2. スキル・能力管理テーブル群
-- =============================================================================

-- スキルマスタテーブル
CREATE TABLE IF NOT EXISTS skills (
    skill_id TEXT PRIMARY KEY,
    skill_name VARCHAR(255) NOT NULL,
    skill_category VARCHAR(100) NOT NULL,
    skill_type VARCHAR(50) CHECK (skill_type IN ('technical', 'soft', 'leadership', 'domain_specific')),
    description TEXT,
    industry_standard BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 従業員スキル関連テーブル
CREATE TABLE IF NOT EXISTS employee_skills (
    employee_skill_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    skill_level INTEGER CHECK (skill_level BETWEEN 1 AND 5) NOT NULL,
    proficiency_description TEXT,
    assessment_date DATE NOT NULL,
    assessment_method VARCHAR(50) CHECK (assessment_method IN ('self_assessment', 'manager_assessment', 'peer_review', 'certification', 'external_test')),
    assessed_by TEXT,
    certification_name VARCHAR(200),
    expiry_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id),
    FOREIGN KEY (assessed_by) REFERENCES employees(id)
);

-- スキル評価履歴テーブル
CREATE TABLE IF NOT EXISTS skill_assessment_history (
    assessment_history_id TEXT PRIMARY KEY,
    employee_skill_id TEXT NOT NULL,
    previous_level INTEGER,
    new_level INTEGER,
    assessment_date DATE NOT NULL,
    improvement_reason TEXT,
    assessment_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_skill_id) REFERENCES employee_skills(employee_skill_id)
);

-- =============================================================================
-- 3. 育成・研修管理テーブル群
-- =============================================================================

-- 研修コースマスタテーブル
CREATE TABLE IF NOT EXISTS training_courses (
    course_id TEXT PRIMARY KEY,
    course_name VARCHAR(255) NOT NULL,
    course_category VARCHAR(100) NOT NULL,
    course_type VARCHAR(50) CHECK (course_type IN ('internal', 'external', 'e_learning', 'on_the_job', 'mentoring')),
    provider VARCHAR(200),
    duration_hours INTEGER,
    cost_per_person DECIMAL(10, 2),
    target_audience TEXT,
    learning_objectives TEXT,
    prerequisites TEXT,
    certification_available BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 研修受講履歴テーブル
CREATE TABLE IF NOT EXISTS training_history (
    training_record_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    enrollment_date DATE NOT NULL,
    start_date DATE,
    completion_date DATE,
    status VARCHAR(50) CHECK (status IN ('enrolled', 'in_progress', 'completed', 'cancelled', 'failed')) DEFAULT 'enrolled',
    attendance_rate DECIMAL(5, 2),
    final_score DECIMAL(5, 2),
    certification_earned BOOLEAN DEFAULT FALSE,
    cost_invested DECIMAL(10, 2),
    feedback TEXT,
    impact_assessment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (course_id) REFERENCES training_courses(course_id)
);

-- 研修効果測定テーブル
CREATE TABLE IF NOT EXISTS training_effectiveness (
    effectiveness_id TEXT PRIMARY KEY,
    training_record_id TEXT NOT NULL,
    measurement_date DATE NOT NULL,
    kirkpatrick_level INTEGER CHECK (kirkpatrick_level BETWEEN 1 AND 4),
    satisfaction_score DECIMAL(3, 2),
    learning_score DECIMAL(3, 2),
    behavior_change_score DECIMAL(3, 2),
    business_impact_score DECIMAL(3, 2),
    roi_percentage DECIMAL(5, 2),
    measurement_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (training_record_id) REFERENCES training_history(training_record_id)
);

-- =============================================================================
-- 4. パフォーマンス評価・目標管理テーブル群
-- =============================================================================

-- パフォーマンス評価テーブル
CREATE TABLE IF NOT EXISTS performance_evaluations (
    evaluation_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    evaluator_id TEXT NOT NULL,
    evaluation_period VARCHAR(50) NOT NULL,
    evaluation_type VARCHAR(50) CHECK (evaluation_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'project_based')),
    evaluation_date DATE NOT NULL,
    overall_rating DECIMAL(3, 2),
    performance_score INTEGER CHECK (performance_score BETWEEN 1 AND 5),
    competency_ratings JSON,
    strengths_summary TEXT,
    areas_for_development TEXT,
    career_development_plan TEXT,
    promotion_readiness VARCHAR(50),
    retention_risk_level VARCHAR(20) CHECK (retention_risk_level IN ('low', 'medium', 'high')),
    status VARCHAR(50) CHECK (status IN ('draft', 'submitted', 'approved', 'finalized')) DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (evaluator_id) REFERENCES employees(id)
);

-- 目標・OKR管理テーブル
CREATE TABLE IF NOT EXISTS goals_okrs (
    goal_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    goal_type VARCHAR(50) CHECK (goal_type IN ('OKR', 'MBO', 'SMART', 'development')),
    goal_category VARCHAR(100),
    objective TEXT NOT NULL,
    key_results JSON,
    target_value DECIMAL(10, 2),
    current_value DECIMAL(10, 2),
    achievement_percentage DECIMAL(5, 2),
    priority_level VARCHAR(20) CHECK (priority_level IN ('high', 'medium', 'low')),
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'overdue')) DEFAULT 'draft',
    completion_date DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- 360度フィードバックテーブル
CREATE TABLE IF NOT EXISTS feedback_360 (
    feedback_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    feedback_provider_id TEXT NOT NULL,
    feedback_type VARCHAR(50) CHECK (feedback_type IN ('supervisor', 'peer', 'subordinate', 'customer', 'self')),
    feedback_cycle VARCHAR(50) NOT NULL,
    competency_ratings JSON,
    strengths TEXT,
    development_areas TEXT,
    specific_examples TEXT,
    overall_rating DECIMAL(3, 2),
    anonymous BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (feedback_provider_id) REFERENCES employees(id)
);

-- =============================================================================
-- 5. 組織文化・エンゲージメント管理テーブル群
-- =============================================================================

-- 従業員エンゲージメントサーベイテーブル
CREATE TABLE IF NOT EXISTS employee_engagement_surveys (
    survey_id TEXT PRIMARY KEY,
    survey_name VARCHAR(255) NOT NULL,
    survey_type VARCHAR(50) CHECK (survey_type IN ('annual', 'pulse', 'exit', 'onboarding', 'custom')),
    survey_period VARCHAR(50) NOT NULL,
    questions JSON NOT NULL,
    launch_date DATE NOT NULL,
    close_date DATE NOT NULL,
    participation_rate DECIMAL(5, 2),
    response_rate DECIMAL(5, 2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- サーベイ回答テーブル
CREATE TABLE IF NOT EXISTS survey_responses (
    response_id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    responses JSON NOT NULL,
    response_date DATE NOT NULL,
    overall_satisfaction DECIMAL(3, 2),
    enps_score INTEGER CHECK (enps_score BETWEEN 0 AND 10),
    engagement_score DECIMAL(3, 2),
    wellbeing_score DECIMAL(3, 2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES employee_engagement_surveys(survey_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- 後継者計画テーブル
CREATE TABLE IF NOT EXISTS succession_planning (
    succession_id TEXT PRIMARY KEY,
    key_position_id TEXT NOT NULL,
    position_title VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    successor_employee_id TEXT NOT NULL,
    readiness_level VARCHAR(50) CHECK (readiness_level IN ('ready_now', 'ready_1_year', 'ready_2_years', 'ready_3_years', 'not_ready')),
    succession_probability DECIMAL(3, 2),
    development_needs TEXT,
    development_timeline TEXT,
    mentorship_plan TEXT,
    status VARCHAR(50) CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (successor_employee_id) REFERENCES employees(id)
);

-- 組織文化指標テーブル
CREATE TABLE IF NOT EXISTS culture_metrics (
    metric_id TEXT PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    metric_category VARCHAR(100) NOT NULL,
    measurement_period VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10, 2) NOT NULL,
    target_value DECIMAL(10, 2),
    benchmark_value DECIMAL(10, 2),
    calculation_method TEXT,
    data_source VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 6. 健康・安全・コンプライアンス管理テーブル群
-- =============================================================================

-- 健康・安全事故テーブル
CREATE TABLE IF NOT EXISTS health_safety_incidents (
    incident_id TEXT PRIMARY KEY,
    employee_id TEXT,
    incident_date DATE NOT NULL,
    incident_type VARCHAR(100) CHECK (incident_type IN ('workplace_injury', 'near_miss', 'occupational_illness', 'safety_violation', 'environmental_incident')),
    severity_level VARCHAR(20) CHECK (severity_level IN ('minor', 'moderate', 'major', 'critical')),
    location VARCHAR(255),
    description TEXT NOT NULL,
    immediate_action_taken TEXT,
    root_cause_analysis TEXT,
    preventive_measures TEXT,
    lost_time_hours DECIMAL(10, 2),
    medical_treatment_required BOOLEAN DEFAULT FALSE,
    reported_to_authorities BOOLEAN DEFAULT FALSE,
    investigation_status VARCHAR(50) CHECK (investigation_status IN ('pending', 'ongoing', 'completed', 'closed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- コンプライアンス事案テーブル
CREATE TABLE IF NOT EXISTS compliance_incidents (
    incident_id TEXT PRIMARY KEY,
    incident_type VARCHAR(100) CHECK (incident_type IN ('harassment', 'discrimination', 'ethics_violation', 'data_breach', 'conflict_of_interest', 'misconduct')),
    report_date DATE NOT NULL,
    incident_date DATE,
    reported_by TEXT,
    affected_employee_id TEXT,
    accused_employee_id TEXT,
    department VARCHAR(100),
    description TEXT NOT NULL,
    investigation_findings TEXT,
    resolution_action TEXT,
    disciplinary_action TEXT,
    status VARCHAR(50) CHECK (status IN ('reported', 'investigating', 'resolved', 'closed', 'escalated')),
    confidentiality_level VARCHAR(20) CHECK (confidentiality_level IN ('public', 'internal', 'confidential', 'restricted')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (affected_employee_id) REFERENCES employees(id),
    FOREIGN KEY (accused_employee_id) REFERENCES employees(id)
);

-- 労働安全衛生チェックテーブル
CREATE TABLE IF NOT EXISTS occupational_health_checks (
    check_id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    check_date DATE NOT NULL,
    check_type VARCHAR(50) CHECK (check_type IN ('regular_checkup', 'stress_check', 'ergonomic_assessment', 'mental_health_screening')),
    health_status VARCHAR(50) CHECK (health_status IN ('excellent', 'good', 'fair', 'poor', 'requires_attention')),
    stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 5),
    recommendations TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    conducted_by VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- =============================================================================
-- 7. 人的資本指標計算・管理テーブル群
-- =============================================================================

-- 人的資本指標テーブル
CREATE TABLE IF NOT EXISTS human_capital_metrics (
    metric_id TEXT PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    metric_category VARCHAR(100) CHECK (metric_category IN ('workforce', 'diversity', 'skills', 'engagement', 'development', 'performance', 'health_safety', 'compliance')),
    iso30414_category VARCHAR(100),
    metric_value DECIMAL(15, 4) NOT NULL,
    metric_unit VARCHAR(50),
    calculation_method TEXT,
    data_source TEXT,
    reporting_period VARCHAR(50) NOT NULL,
    benchmark_value DECIMAL(15, 4),
    target_value DECIMAL(15, 4),
    trend_direction VARCHAR(20) CHECK (trend_direction IN ('improving', 'stable', 'declining')),
    is_kpi BOOLEAN DEFAULT FALSE,
    visibility_level VARCHAR(20) CHECK (visibility_level IN ('public', 'internal', 'executive', 'confidential')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 多様性指標テーブル
CREATE TABLE IF NOT EXISTS diversity_metrics (
    diversity_metric_id TEXT PRIMARY KEY,
    metric_type VARCHAR(50) CHECK (metric_type IN ('gender', 'age', 'nationality', 'disability', 'education', 'tenure', 'leadership')),
    category_breakdown JSON NOT NULL,
    leadership_representation JSON,
    pay_equity_metrics JSON,
    progression_rates JSON,
    reporting_period VARCHAR(50) NOT NULL,
    analysis_notes TEXT,
    improvement_areas TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 人材定着・流動性指標テーブル
CREATE TABLE IF NOT EXISTS retention_turnover_metrics (
    retention_metric_id TEXT PRIMARY KEY,
    reporting_period VARCHAR(50) NOT NULL,
    voluntary_turnover_rate DECIMAL(5, 2),
    involuntary_turnover_rate DECIMAL(5, 2),
    total_turnover_rate DECIMAL(5, 2),
    retention_rate DECIMAL(5, 2),
    average_tenure DECIMAL(5, 2),
    time_to_fill_positions DECIMAL(5, 2),
    cost_per_hire DECIMAL(10, 2),
    new_hire_90_day_retention DECIMAL(5, 2),
    regrettable_turnover_rate DECIMAL(5, 2),
    department_breakdown JSON,
    age_group_breakdown JSON,
    tenure_analysis JSON,
    exit_reasons JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 8. インデックス作成
-- =============================================================================

-- スキル関連インデックス
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(skill_category);
CREATE INDEX IF NOT EXISTS idx_skills_type ON skills(skill_type);
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee ON employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill ON employee_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_level ON employee_skills(skill_level);
CREATE INDEX IF NOT EXISTS idx_employee_skills_date ON employee_skills(assessment_date);

-- 研修関連インデックス
CREATE INDEX IF NOT EXISTS idx_training_courses_category ON training_courses(course_category);
CREATE INDEX IF NOT EXISTS idx_training_courses_type ON training_courses(course_type);
CREATE INDEX IF NOT EXISTS idx_training_history_employee ON training_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_history_course ON training_history(course_id);
CREATE INDEX IF NOT EXISTS idx_training_history_status ON training_history(status);
CREATE INDEX IF NOT EXISTS idx_training_history_completion ON training_history(completion_date);

-- 評価関連インデックス
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_employee ON performance_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_evaluator ON performance_evaluations(evaluator_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_period ON performance_evaluations(evaluation_period);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_rating ON performance_evaluations(overall_rating);
CREATE INDEX IF NOT EXISTS idx_goals_okrs_employee ON goals_okrs(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_okrs_type ON goals_okrs(goal_type);
CREATE INDEX IF NOT EXISTS idx_goals_okrs_status ON goals_okrs(status);

-- エンゲージメント関連インデックス
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_employee ON survey_responses(employee_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_date ON survey_responses(response_date);
CREATE INDEX IF NOT EXISTS idx_survey_responses_satisfaction ON survey_responses(overall_satisfaction);

-- 健康・安全関連インデックス
CREATE INDEX IF NOT EXISTS idx_health_safety_incidents_employee ON health_safety_incidents(employee_id);
CREATE INDEX IF NOT EXISTS idx_health_safety_incidents_date ON health_safety_incidents(incident_date);
CREATE INDEX IF NOT EXISTS idx_health_safety_incidents_type ON health_safety_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_health_safety_incidents_severity ON health_safety_incidents(severity_level);

-- コンプライアンス関連インデックス
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_type ON compliance_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_date ON compliance_incidents(report_date);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_status ON compliance_incidents(status);
CREATE INDEX IF NOT EXISTS idx_compliance_incidents_affected ON compliance_incidents(affected_employee_id);

-- 人的資本指標関連インデックス
CREATE INDEX IF NOT EXISTS idx_human_capital_metrics_category ON human_capital_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_human_capital_metrics_period ON human_capital_metrics(reporting_period);
CREATE INDEX IF NOT EXISTS idx_human_capital_metrics_kpi ON human_capital_metrics(is_kpi);
CREATE INDEX IF NOT EXISTS idx_diversity_metrics_type ON diversity_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_diversity_metrics_period ON diversity_metrics(reporting_period);

-- =============================================================================
-- 9. 初期データ挿入
-- =============================================================================

-- 基本的なスキルカテゴリの挿入
INSERT INTO skills (skill_id, skill_name, skill_category, skill_type, description, industry_standard) VALUES
('SKILL_001', 'プロジェクト管理', 'マネジメント', 'leadership', 'プロジェクトの計画・実行・監視・完了を統括する能力', TRUE),
('SKILL_002', 'チームリーダーシップ', 'リーダーシップ', 'leadership', 'チームを導き、モチベーションを高める能力', TRUE),
('SKILL_003', 'コミュニケーション', 'ソフトスキル', 'soft', '効果的な意思疎通を行う能力', TRUE),
('SKILL_004', 'データ分析', 'テクニカル', 'technical', 'データを分析し、洞察を得る能力', TRUE),
('SKILL_005', 'プログラミング（Python）', 'テクニカル', 'technical', 'Python言語でのプログラミング能力', TRUE),
('SKILL_006', 'プログラミング（JavaScript）', 'テクニカル', 'technical', 'JavaScript言語でのプログラミング能力', TRUE),
('SKILL_007', '問題解決', 'ソフトスキル', 'soft', '複雑な問題を分析し、解決策を見出す能力', TRUE),
('SKILL_008', 'プレゼンテーション', 'ソフトスキル', 'soft', '効果的なプレゼンテーションを行う能力', TRUE)
ON CONFLICT (skill_id) DO NOTHING;

-- 基本的な研修コースの挿入
INSERT INTO training_courses (course_id, course_name, course_category, course_type, duration_hours, target_audience, learning_objectives) VALUES
('COURSE_001', 'リーダーシップ基礎研修', 'リーダーシップ', 'internal', 16, '新任管理職', 'リーダーシップの基本概念と実践方法を習得する'),
('COURSE_002', 'プロジェクト管理入門', 'マネジメント', 'external', 24, '中級社員', 'プロジェクト管理の基本手法を学ぶ'),
('COURSE_003', 'データ分析基礎', 'テクニカル', 'e_learning', 20, '全社員', 'データ分析の基本概念と手法を理解する'),
('COURSE_004', 'コミュニケーション向上研修', 'ソフトスキル', 'internal', 8, '全社員', '効果的なコミュニケーション技術を身につける'),
('COURSE_005', 'ハラスメント防止研修', 'コンプライアンス', 'internal', 4, '全社員', 'ハラスメントの理解と予防方法を学ぶ')
ON CONFLICT (course_id) DO NOTHING;

-- 基本的な人的資本指標の定義
INSERT INTO human_capital_metrics (metric_id, metric_name, metric_category, iso30414_category, metric_unit, calculation_method, is_kpi, visibility_level) VALUES
('METRIC_001', '従業員エンゲージメント率', 'engagement', 'Organizational culture', '%', 'エンゲージメントサーベイ結果の平均値', TRUE, 'internal'),
('METRIC_002', '離職率', 'workforce', 'Workforce composition', '%', '年間離職者数 / 期首従業員数 × 100', TRUE, 'public'),
('METRIC_003', '女性管理職比率', 'diversity', 'Diversity', '%', '女性管理職数 / 全管理職数 × 100', TRUE, 'public'),
('METRIC_004', '研修時間（一人当たり）', 'development', 'Skills and capabilities', 'hours', '年間研修時間合計 / 従業員数', TRUE, 'internal'),
('METRIC_005', '労働災害発生率', 'health_safety', 'Health, safety and well-being', 'incidents/1000employees', '年間労働災害件数 / 従業員数 × 1000', TRUE, 'public')
ON CONFLICT (metric_id) DO NOTHING;

-- =============================================================================
-- 10. ビュー定義（レポーティング用）
-- =============================================================================

-- 従業員包括プロファイルビュー
CREATE VIEW IF NOT EXISTS employee_comprehensive_profile AS
SELECT 
    e.id,
    e.name,
    e.department,
    e.position,
    e.gender,
    e.age,
    e.nationality,
    e.education_level,
    e.employment_type,
    e.join_date,
    e.manager_id,
    COUNT(DISTINCT es.skill_id) as total_skills,
    AVG(es.skill_level) as avg_skill_level,
    COUNT(DISTINCT th.course_id) as completed_courses,
    AVG(pe.overall_rating) as avg_performance_rating,
    AVG(sr.engagement_score) as avg_engagement_score,
    MAX(sr.response_date) as last_survey_date
FROM employees e
LEFT JOIN employee_skills es ON e.id = es.employee_id
LEFT JOIN training_history th ON e.id = th.employee_id AND th.status = 'completed'
LEFT JOIN performance_evaluations pe ON e.id = pe.employee_id
LEFT JOIN survey_responses sr ON e.id = sr.employee_id
WHERE e.is_active = true
GROUP BY e.id, e.name, e.department, e.position, e.gender, e.age, e.nationality, e.education_level, e.employment_type, e.join_date, e.manager_id;

-- 部署別人的資本指標ビュー
CREATE VIEW IF NOT EXISTS department_human_capital_metrics AS
SELECT 
    e.department,
    COUNT(DISTINCT e.id) as total_employees,
    COUNT(DISTINCT CASE WHEN e.gender = 'female' THEN e.id END) as female_employees,
    COUNT(DISTINCT CASE WHEN e.gender = 'male' THEN e.id END) as male_employees,
    ROUND(COUNT(DISTINCT CASE WHEN e.gender = 'female' THEN e.id END) * 100.0 / COUNT(DISTINCT e.id), 2) as female_ratio,
    AVG(CASE WHEN e.age IS NOT NULL THEN e.age END) as avg_age,
    COUNT(DISTINCT CASE WHEN e.employment_type = 'full_time' THEN e.id END) as full_time_employees,
    COUNT(DISTINCT CASE WHEN e.employment_type = 'part_time' THEN e.id END) as part_time_employees,
    COUNT(DISTINCT CASE WHEN e.employment_type = 'contract' THEN e.id END) as contract_employees,
    AVG(es.skill_level) as avg_skill_level,
    AVG(pe.overall_rating) as avg_performance_rating,
    AVG(sr.engagement_score) as avg_engagement_score,
    COUNT(DISTINCT th.training_record_id) as total_training_records,
    COUNT(DISTINCT CASE WHEN th.status = 'completed' THEN th.training_record_id END) as completed_training_records
FROM employees e
LEFT JOIN employee_skills es ON e.id = es.employee_id
LEFT JOIN performance_evaluations pe ON e.id = pe.employee_id
LEFT JOIN survey_responses sr ON e.id = sr.employee_id
LEFT JOIN training_history th ON e.id = th.employee_id
WHERE e.is_active = true
GROUP BY e.department;

-- スキル分布ビュー
CREATE VIEW IF NOT EXISTS skills_distribution AS
SELECT 
    s.skill_category,
    s.skill_name,
    COUNT(DISTINCT es.employee_id) as employee_count,
    AVG(es.skill_level) as avg_skill_level,
    COUNT(DISTINCT CASE WHEN es.skill_level >= 4 THEN es.employee_id END) as expert_count,
    COUNT(DISTINCT CASE WHEN es.skill_level <= 2 THEN es.employee_id END) as beginner_count
FROM skills s
LEFT JOIN employee_skills es ON s.skill_id = es.skill_id
GROUP BY s.skill_category, s.skill_name;

-- =============================================================================
-- スキーマ作成完了
-- =============================================================================