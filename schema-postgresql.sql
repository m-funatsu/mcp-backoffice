-- Attendance Management System Database Schema for PostgreSQL
-- Compliant with Japanese Labor Standards Act

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    hourly_rate DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    manager_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);

-- Time records table (勤怠記録)
CREATE TABLE IF NOT EXISTS time_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    date DATE NOT NULL,
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP,
    break_duration INTEGER DEFAULT 0,
    record_type TEXT CHECK (record_type IN ('ic_card', 'pc_log', 'manual')) DEFAULT 'manual',
    notes TEXT,
    approved_by TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id)
);

-- Payroll calculations table (給与計算)
CREATE TABLE IF NOT EXISTS payroll_calculations (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    month TEXT NOT NULL, -- YYYY-MM format
    regular_hours DECIMAL(10,2) NOT NULL,
    overtime_hours DECIMAL(10,2) NOT NULL,
    late_night_hours DECIMAL(10,2) NOT NULL,
    holiday_hours DECIMAL(10,2) NOT NULL,
    regular_pay DECIMAL(10,2) NOT NULL,
    overtime_pay DECIMAL(10,2) NOT NULL,
    late_night_pay DECIMAL(10,2) NOT NULL,
    holiday_pay DECIMAL(10,2) NOT NULL,
    total_pay DECIMAL(10,2) NOT NULL,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, month)
);

-- Payroll rules table (給与規則)
CREATE TABLE IF NOT EXISTS payroll_rules (
    id SERIAL PRIMARY KEY,
    regular_hours_per_day DECIMAL(5,2) DEFAULT 8.0,
    regular_hours_per_week DECIMAL(5,2) DEFAULT 40.0,
    break_minutes_for_6_hours INTEGER DEFAULT 45,
    break_minutes_for_8_hours INTEGER DEFAULT 60,
    overtime_rate DECIMAL(5,2) DEFAULT 1.25,
    late_night_rate DECIMAL(5,2) DEFAULT 1.25,
    holiday_rate DECIMAL(5,2) DEFAULT 1.35,
    high_overtime_rate DECIMAL(5,2) DEFAULT 1.50,
    late_night_start INTEGER DEFAULT 22, -- 22:00
    late_night_end INTEGER DEFAULT 5,   -- 5:00
    monthly_overtime_limit DECIMAL(10,2) DEFAULT 45.0,
    yearly_overtime_limit DECIMAL(10,2) DEFAULT 360.0,
    high_overtime_threshold DECIMAL(10,2) DEFAULT 60.0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Holidays table (祝日・休日)
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('national', 'company', 'weekend')) DEFAULT 'national',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance violations table (勤怠違反)
CREATE TABLE IF NOT EXISTS attendance_violations (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    violation_type TEXT NOT NULL,
    violation_date DATE NOT NULL,
    description TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('warning', 'minor', 'major', 'critical')) DEFAULT 'warning',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_records_employee_date ON time_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_time_records_date ON time_records(date);
CREATE INDEX IF NOT EXISTS idx_payroll_calculations_employee_month ON payroll_calculations(employee_id, month);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_attendance_violations_employee ON attendance_violations(employee_id);

-- Insert default payroll rules based on Japanese Labor Standards Act
INSERT INTO payroll_rules (
    regular_hours_per_day,
    regular_hours_per_week,
    break_minutes_for_6_hours,
    break_minutes_for_8_hours,
    overtime_rate,
    late_night_rate,
    holiday_rate,
    high_overtime_rate,
    late_night_start,
    late_night_end,
    monthly_overtime_limit,
    yearly_overtime_limit,
    high_overtime_threshold,
    effective_from
) VALUES (
    8.0,    -- 1日8時間
    40.0,   -- 週40時間
    45,     -- 6時間超で45分休憩
    60,     -- 8時間超で60分休憩
    1.25,   -- 時間外労働25%割増
    1.25,   -- 深夜労働25%割増
    1.35,   -- 休日労働35%割増
    1.50,   -- 月60時間超の時間外労働50%割増
    22,     -- 深夜時間開始（22時）
    5,      -- 深夜時間終了（5時）
    45.0,   -- 月間時間外労働上限45時間
    360.0,  -- 年間時間外労働上限360時間
    60.0,   -- 高割増率適用の閾値60時間
    '2024-01-01'
) ON CONFLICT DO NOTHING;

-- Leave/Vacation Management Tables (休暇・有給管理)

-- Leave balances table (有給残高管理)
CREATE TABLE IF NOT EXISTS leave_balances (
    id SERIAL PRIMARY KEY,
    employee_id TEXT NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement', 'personal')),
    year INTEGER NOT NULL,
    granted_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    used_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    remaining_days DECIMAL(5,2) NOT NULL DEFAULT 0,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, leave_type, year)
);

-- Leave requests table (休暇申請)
CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement', 'personal')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested DECIMAL(5,2) NOT NULL,
    half_day BOOLEAN DEFAULT FALSE,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by TEXT,
    approved_at TIMESTAMP,
    approval_notes TEXT,
    auto_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id)
);

-- Team calendar table (チームカレンダー)
CREATE TABLE IF NOT EXISTS team_calendar (
    id SERIAL PRIMARY KEY,
    department TEXT NOT NULL,
    date DATE NOT NULL,
    employee_id TEXT NOT NULL,
    event_type TEXT CHECK (event_type IN ('leave', 'meeting', 'training', 'holiday')) DEFAULT 'leave',
    event_title TEXT NOT NULL,
    all_day BOOLEAN DEFAULT TRUE,
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Leave policies table (休暇規則)
CREATE TABLE IF NOT EXISTS leave_policies (
    id SERIAL PRIMARY KEY,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement', 'personal')),
    tenure_months INTEGER NOT NULL DEFAULT 0,
    granted_days DECIMAL(5,2) NOT NULL,
    max_consecutive_days INTEGER,
    advance_notice_days INTEGER DEFAULT 0,
    requires_approval BOOLEAN DEFAULT TRUE,
    auto_approval_conditions TEXT,
    carryover_allowed BOOLEAN DEFAULT FALSE,
    carryover_limit_days INTEGER,
    expiry_months INTEGER,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for leave management
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON leave_balances(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_team_calendar_department_date ON team_calendar(department, date);
CREATE INDEX IF NOT EXISTS idx_team_calendar_employee_date ON team_calendar(employee_id, date);

-- Insert default leave policies based on Japanese Labor Standards Act
INSERT INTO leave_policies (leave_type, tenure_months, granted_days, max_consecutive_days, advance_notice_days, requires_approval, auto_approval_conditions, carryover_allowed, carryover_limit_days, expiry_months, effective_from) VALUES
-- Annual leave (年次有給休暇)
('annual', 6, 10, 20, 1, TRUE, 'department_coverage_ok', TRUE, 20, 24, '2024-01-01'),
('annual', 18, 11, 20, 1, TRUE, 'department_coverage_ok', TRUE, 20, 24, '2024-01-01'),
('annual', 30, 12, 20, 1, TRUE, 'department_coverage_ok', TRUE, 20, 24, '2024-01-01'),
('annual', 42, 14, 20, 1, TRUE, 'department_coverage_ok', TRUE, 20, 24, '2024-01-01'),
('annual', 54, 16, 20, 1, TRUE, 'department_coverage_ok', TRUE, 20, 24, '2024-01-01'),
('annual', 66, 18, 20, 1, TRUE, 'department_coverage_ok', TRUE, 20, 24, '2024-01-01'),
('annual', 78, 20, 20, 1, TRUE, 'department_coverage_ok', TRUE, 20, 24, '2024-01-01'),

-- Sick leave (病気休暇)
('sick', 0, 5, 30, 0, FALSE, 'auto_approve_up_to_3_days', FALSE, 0, 12, '2024-01-01'),

-- Special leave (特別休暇)
('special', 0, 5, 10, 3, TRUE, NULL, FALSE, 0, 12, '2024-01-01'),

-- Maternity leave (産前産後休暇)
('maternity', 0, 98, 98, 30, TRUE, NULL, FALSE, 0, 12, '2024-01-01'),

-- Paternity leave (育児休暇)
('paternity', 0, 30, 30, 14, TRUE, NULL, FALSE, 0, 12, '2024-01-01'),

-- Bereavement leave (忌引き休暇)
('bereavement', 0, 7, 7, 0, TRUE, 'auto_approve_immediate_family', FALSE, 0, 1, '2024-01-01'),

-- Personal leave (個人休暇)
('personal', 0, 3, 5, 1, TRUE, NULL, FALSE, 0, 12, '2024-01-01')
ON CONFLICT DO NOTHING;

-- Insert some common Japanese holidays for 2024-2025
INSERT INTO holidays (date, name, type) VALUES
('2024-01-01', '元日', 'national'),
('2024-01-08', '成人の日', 'national'),
('2024-02-11', '建国記念の日', 'national'),
('2024-02-23', '天皇誕生日', 'national'),
('2024-03-20', '春分の日', 'national'),
('2024-04-29', '昭和の日', 'national'),
('2024-05-03', '憲法記念日', 'national'),
('2024-05-04', 'みどりの日', 'national'),
('2024-05-05', 'こどもの日', 'national'),
('2024-07-15', '海の日', 'national'),
('2024-08-11', '山の日', 'national'),
('2024-09-16', '敬老の日', 'national'),
('2024-09-22', '秋分の日', 'national'),
('2024-10-14', 'スポーツの日', 'national'),
('2024-11-03', '文化の日', 'national'),
('2024-11-23', '勤労感謝の日', 'national'),
('2025-01-01', '元日', 'national'),
('2025-01-13', '成人の日', 'national'),
('2025-02-11', '建国記念の日', 'national'),
('2025-02-23', '天皇誕生日', 'national'),
('2025-03-20', '春分の日', 'national'),
('2025-04-29', '昭和の日', 'national'),
('2025-05-03', '憲法記念日', 'national'),
('2025-05-04', 'みどりの日', 'national'),
('2025-05-05', 'こどもの日', 'national'),
('2025-07-21', '海の日', 'national'),
('2025-08-11', '山の日', 'national'),
('2025-09-15', '敬老の日', 'national'),
('2025-09-23', '秋分の日', 'national'),
('2025-10-13', 'スポーツの日', 'national'),
('2025-11-03', '文化の日', 'national'),
('2025-11-23', '勤労感謝の日', 'national')
ON CONFLICT (date) DO NOTHING;

-- Expense Management System Tables (経費精算システム) - v1.3.0

-- Expense categories table (経費カテゴリー)
CREATE TABLE IF NOT EXISTS expense_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_category_id TEXT,
    tax_deductible BOOLEAN DEFAULT FALSE,
    approval_required BOOLEAN DEFAULT TRUE,
    daily_limit DECIMAL(10,2),
    monthly_limit DECIMAL(10,2),
    validation_rules JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_category_id) REFERENCES expense_categories(id)
);

-- Expense requests table (経費申請)
CREATE TABLE IF NOT EXISTS expense_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'JPY',
    expense_date DATE NOT NULL,
    description TEXT NOT NULL,
    purpose TEXT,
    receipt_image_url TEXT,
    extracted_data JSONB, -- OCR抽出データ
    status TEXT CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'reimbursed')) DEFAULT 'draft',
    submitted_at TIMESTAMP,
    approved_by TEXT,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    ai_confidence_score DECIMAL(5,2), -- AI判定の信頼度
    tax_deductible BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (category_id) REFERENCES expense_categories(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id)
);

-- Approval workflows table (承認ワークフロー)
CREATE TABLE IF NOT EXISTS approval_workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    min_amount DECIMAL(10,2) DEFAULT 0,
    max_amount DECIMAL(10,2),
    approval_steps JSONB NOT NULL, -- 承認ステップ定義
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Receipt images table (レシート画像)
CREATE TABLE IF NOT EXISTS receipt_images (
    id TEXT PRIMARY KEY,
    expense_request_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    ocr_status TEXT CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    ocr_result JSONB, -- OCR結果データ
    ai_extracted_data JSONB, -- AI抽出データ
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_request_id) REFERENCES expense_requests(id)
);

-- Accounting entries table (会計仕訳)
CREATE TABLE IF NOT EXISTS accounting_entries (
    id TEXT PRIMARY KEY,
    expense_request_id TEXT NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    debit_account TEXT NOT NULL,
    credit_account TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    reference TEXT,
    exported BOOLEAN DEFAULT FALSE,
    exported_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_request_id) REFERENCES expense_requests(id)
);

-- Create indexes for expense management
CREATE INDEX IF NOT EXISTS idx_expense_requests_employee ON expense_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_requests_status ON expense_requests(status);
CREATE INDEX IF NOT EXISTS idx_expense_requests_date ON expense_requests(expense_date);
CREATE INDEX IF NOT EXISTS idx_expense_requests_category ON expense_requests(category_id);
CREATE INDEX IF NOT EXISTS idx_receipt_images_expense ON receipt_images(expense_request_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_expense ON accounting_entries(expense_request_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_exported ON accounting_entries(exported);

-- Insert default expense categories
INSERT INTO expense_categories (id, name, code, description, tax_deductible, approval_required, daily_limit, monthly_limit, validation_rules) VALUES
('EXP_CAT_001', '交通費', 'TRANSPORT', '電車、バス、タクシー、ガソリン代など', TRUE, FALSE, 10000, 100000, '{"receipt_required": false, "description_required": true}'),
('EXP_CAT_002', '宿泊費', 'ACCOMMODATION', 'ホテル、旅館などの宿泊費', TRUE, TRUE, 20000, 200000, '{"receipt_required": true, "business_purpose_required": true}'),
('EXP_CAT_003', '食事・接待費', 'MEALS', '会議費、接待費、出張時の食事代', TRUE, TRUE, 5000, 50000, '{"receipt_required": true, "attendees_required": true}'),
('EXP_CAT_004', '通信費', 'COMMUNICATION', '携帯電話、インターネット、郵送費など', TRUE, FALSE, 3000, 30000, '{"receipt_required": true}'),
('EXP_CAT_005', '事務用品', 'OFFICE_SUPPLIES', '文房具、コピー用紙、プリンター用品など', TRUE, FALSE, 5000, 20000, '{"receipt_required": true}'),
('EXP_CAT_006', '研修・セミナー', 'TRAINING', '研修費、セミナー参加費、書籍代など', TRUE, TRUE, 50000, 200000, '{"receipt_required": true, "learning_objective_required": true}'),
('EXP_CAT_007', '会議費', 'MEETING', '会議室利用料、資料印刷費など', TRUE, FALSE, 10000, 50000, '{"receipt_required": true, "meeting_purpose_required": true}'),
('EXP_CAT_008', 'その他', 'OTHER', 'その他の業務関連費用', TRUE, TRUE, NULL, NULL, '{"receipt_required": true, "detailed_description_required": true}')
ON CONFLICT (id) DO NOTHING;

-- Insert default approval workflows
INSERT INTO approval_workflows (id, name, department, min_amount, max_amount, approval_steps, is_default, is_active) VALUES
('WORKFLOW_001', '標準承認フロー（〜10万円）', NULL, 0, 100000, 
'[{"step": 1, "role": "manager", "required": true}, {"step": 2, "role": "finance", "required": false}]', 
TRUE, TRUE),
('WORKFLOW_002', '高額承認フロー（10万円〜）', NULL, 100000, NULL, 
'[{"step": 1, "role": "manager", "required": true}, {"step": 2, "role": "finance", "required": true}, {"step": 3, "role": "director", "required": true}]', 
FALSE, TRUE),
('WORKFLOW_003', '開発部承認フロー', '開発部', 0, 50000, 
'[{"step": 1, "role": "tech_lead", "required": true}, {"step": 2, "role": "manager", "required": true}]', 
FALSE, TRUE),
('WORKFLOW_004', '営業部承認フロー', '営業部', 0, 30000, 
'[{"step": 1, "role": "sales_manager", "required": true}, {"step": 2, "role": "finance", "required": false}]', 
FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Human Capital Disclosure System Tables (人的資本開示システム) - v2.0.0

-- Extended employee master for human capital disclosure
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_number TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other', 'not_specified'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS disability_status TEXT CHECK (disability_status IN ('none', 'physical', 'mental', 'other', 'not_specified'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS education_level TEXT CHECK (education_level IN ('elementary', 'middle', 'high', 'vocational', 'bachelor', 'master', 'doctorate', 'other'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'temporary', 'intern', 'consultant'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS management_level TEXT CHECK (management_level IN ('executive', 'senior_manager', 'manager', 'supervisor', 'team_lead', 'individual_contributor'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS tenure_years DECIMAL(5,2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS annual_salary DECIMAL(12,2);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS work_model TEXT CHECK (work_model IN ('onsite', 'remote', 'hybrid'));

-- Skills and competencies management
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('technical', 'soft', 'leadership', 'domain_specific', 'language', 'certification')),
    description TEXT,
    competency_levels INTEGER DEFAULT 5, -- 1-5 scale
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_skills (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    proficiency_level INTEGER NOT NULL CHECK (proficiency_level >= 1 AND proficiency_level <= 5),
    certification_date DATE,
    certification_expiry DATE,
    assessment_date DATE,
    assessor_id TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (skill_id) REFERENCES skills(id),
    FOREIGN KEY (assessor_id) REFERENCES employees(id),
    UNIQUE(employee_id, skill_id)
);

-- Training and development tracking
CREATE TABLE IF NOT EXISTS training_history (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    training_name TEXT NOT NULL,
    training_type TEXT NOT NULL CHECK (training_type IN ('internal', 'external', 'e_learning', 'on_job', 'mentoring', 'coaching')),
    provider TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    duration_hours DECIMAL(10,2),
    cost DECIMAL(10,2),
    status TEXT CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'failed')) DEFAULT 'scheduled',
    completion_rate DECIMAL(5,2), -- 0-100%
    effectiveness_rating INTEGER CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),
    roi_calculated DECIMAL(10,2),
    related_skills JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Performance evaluations and goal management
CREATE TABLE IF NOT EXISTS performance_evaluations (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    evaluator_id TEXT NOT NULL,
    evaluation_period TEXT NOT NULL, -- e.g., '2024-Q1', '2024-Annual'
    evaluation_type TEXT NOT NULL CHECK (evaluation_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'project_based')),
    evaluation_date DATE NOT NULL,
    overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
    competency_ratings JSONB, -- JSON object with competency scores
    goals_achievement DECIMAL(5,2), -- 0-100%
    strengths TEXT,
    areas_for_improvement TEXT,
    development_plans TEXT,
    promotion_readiness TEXT CHECK (promotion_readiness IN ('ready', 'developing', 'not_ready')),
    succession_potential TEXT CHECK (succession_potential IN ('high', 'medium', 'low')),
    retention_risk TEXT CHECK (retention_risk IN ('high', 'medium', 'low')),
    feedback_360 JSONB, -- 360-degree feedback data
    comments TEXT,
    status TEXT CHECK (status IN ('draft', 'completed', 'approved', 'archived')) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (evaluator_id) REFERENCES employees(id)
);

-- Goals and OKRs management
CREATE TABLE IF NOT EXISTS goals_okrs (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK (goal_type IN ('individual', 'team', 'department', 'company', 'okr')),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('performance', 'development', 'behavioral', 'project', 'strategic')),
    target_value DECIMAL(10,2),
    current_value DECIMAL(10,2) DEFAULT 0,
    unit TEXT, -- e.g., 'percentage', 'count', 'hours'
    weight INTEGER DEFAULT 100, -- relative importance
    priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT CHECK (status IN ('draft', 'active', 'completed', 'paused', 'cancelled')) DEFAULT 'draft',
    achievement_rate DECIMAL(5,2), -- 0-100%
    key_results JSONB, -- for OKRs
    milestones JSONB,
    parent_goal_id TEXT,
    related_skills JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (parent_goal_id) REFERENCES goals_okrs(id)
);

-- Engagement and culture surveys
CREATE TABLE IF NOT EXISTS engagement_surveys (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    survey_type TEXT NOT NULL CHECK (survey_type IN ('annual', 'pulse', 'exit', 'onboarding', 'project_feedback')),
    survey_date DATE NOT NULL,
    engagement_score INTEGER CHECK (engagement_score >= 1 AND engagement_score <= 10),
    satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 10),
    enps_score INTEGER CHECK (enps_score >= 0 AND enps_score <= 10), -- Employee Net Promoter Score
    wellbeing_score INTEGER CHECK (wellbeing_score >= 1 AND wellbeing_score <= 10),
    work_life_balance_score INTEGER CHECK (work_life_balance_score >= 1 AND work_life_balance_score <= 10),
    career_development_score INTEGER CHECK (career_development_score >= 1 AND career_development_score <= 10),
    manager_effectiveness_score INTEGER CHECK (manager_effectiveness_score >= 1 AND manager_effectiveness_score <= 10),
    responses JSONB, -- detailed survey responses
    comments TEXT,
    anonymous BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Succession planning and leadership pipeline
CREATE TABLE IF NOT EXISTS succession_plans (
    id TEXT PRIMARY KEY,
    position_id TEXT NOT NULL, -- target position
    employee_id TEXT NOT NULL, -- successor candidate
    readiness_level TEXT CHECK (readiness_level IN ('ready_now', 'ready_1_year', 'ready_2_years', 'long_term')) NOT NULL,
    development_needs TEXT,
    development_plan TEXT,
    probability_score INTEGER CHECK (probability_score >= 1 AND probability_score <= 10),
    last_reviewed DATE,
    next_review_date DATE,
    status TEXT CHECK (status IN ('active', 'archived', 'promoted', 'withdrawn')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Health, safety, and compliance tracking
CREATE TABLE IF NOT EXISTS health_safety_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('injury', 'illness', 'near_miss', 'safety_violation', 'health_check')),
    incident_date DATE NOT NULL,
    severity_level TEXT CHECK (severity_level IN ('minor', 'moderate', 'serious', 'critical')) NOT NULL,
    description TEXT NOT NULL,
    location TEXT,
    witnesses TEXT,
    immediate_action TEXT,
    root_cause TEXT,
    corrective_measures TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Compliance and ethics tracking
CREATE TABLE IF NOT EXISTS compliance_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('harassment', 'discrimination', 'ethics_violation', 'data_breach', 'policy_violation')),
    incident_date DATE NOT NULL,
    severity_level TEXT CHECK (severity_level IN ('minor', 'moderate', 'serious', 'critical')) NOT NULL,
    description TEXT NOT NULL,
    investigation_status TEXT CHECK (investigation_status IN ('reported', 'investigating', 'resolved', 'closed', 'escalated')) DEFAULT 'reported',
    investigation_notes TEXT,
    resolution_measures TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Compensation and benefits tracking
CREATE TABLE IF NOT EXISTS compensation_history (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    effective_date DATE NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('hire', 'promotion', 'merit_increase', 'market_adjustment', 'bonus', 'equity')),
    previous_salary DECIMAL(12,2),
    new_salary DECIMAL(12,2),
    percentage_change DECIMAL(5,2),
    reason TEXT,
    approved_by TEXT,
    approved_date DATE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id)
);

-- Diversity and inclusion metrics
CREATE TABLE IF NOT EXISTS diversity_metrics (
    id TEXT PRIMARY KEY,
    metric_date DATE NOT NULL,
    department TEXT,
    level TEXT, -- management level or job level
    metric_type TEXT NOT NULL CHECK (metric_type IN ('gender', 'age', 'ethnicity', 'disability', 'tenure', 'education')),
    category TEXT NOT NULL, -- specific category within metric_type
    employee_count INTEGER NOT NULL,
    percentage DECIMAL(5,2),
    target_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Human capital KPI calculations
CREATE TABLE IF NOT EXISTS human_capital_kpis (
    id TEXT PRIMARY KEY,
    calculation_date DATE NOT NULL,
    kpi_category TEXT NOT NULL CHECK (kpi_category IN ('diversity', 'engagement', 'performance', 'development', 'retention', 'health_safety', 'compliance', 'succession')),
    kpi_name TEXT NOT NULL,
    kpi_value DECIMAL(10,2),
    kpi_unit TEXT,
    target_value DECIMAL(10,2),
    benchmark_value DECIMAL(10,2),
    calculation_method TEXT,
    data_source TEXT,
    period_type TEXT CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for human capital disclosure system
CREATE INDEX IF NOT EXISTS idx_employee_skills_employee ON employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_skills_skill ON employee_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_training_history_employee ON training_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_history_dates ON training_history(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_employee ON performance_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_period ON performance_evaluations(evaluation_period);
CREATE INDEX IF NOT EXISTS idx_goals_okrs_employee ON goals_okrs(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_okrs_status ON goals_okrs(status);
CREATE INDEX IF NOT EXISTS idx_engagement_surveys_employee ON engagement_surveys(employee_id);
CREATE INDEX IF NOT EXISTS idx_engagement_surveys_type ON engagement_surveys(survey_type);
CREATE INDEX IF NOT EXISTS idx_succession_plans_employee ON succession_plans(employee_id);
CREATE INDEX IF NOT EXISTS idx_succession_plans_position ON succession_plans(position_id);
CREATE INDEX IF NOT EXISTS idx_health_safety_records_employee ON health_safety_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_employee ON compliance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_compensation_history_employee ON compensation_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_diversity_metrics_date ON diversity_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_human_capital_kpis_category ON human_capital_kpis(kpi_category);

-- Insert sample skills data
INSERT INTO skills (id, name, category, description) VALUES
('SKILL_001', 'JavaScript', 'technical', 'JavaScript programming language'),
('SKILL_002', 'Python', 'technical', 'Python programming language'),
('SKILL_003', 'SQL', 'technical', 'Database query language'),
('SKILL_004', 'プロジェクト管理', 'soft', 'Project management skills'),
('SKILL_005', 'チームリーダーシップ', 'leadership', 'Team leadership abilities'),
('SKILL_006', 'コミュニケーション', 'soft', 'Communication skills'),
('SKILL_007', 'データ分析', 'technical', 'Data analysis and interpretation'),
('SKILL_008', '問題解決', 'soft', 'Problem solving capabilities'),
('SKILL_009', 'UI/UX設計', 'technical', 'User interface and experience design'),
('SKILL_010', '英語', 'language', 'English language proficiency')
ON CONFLICT (id) DO NOTHING;