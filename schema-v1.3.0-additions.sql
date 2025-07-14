-- v1.3.0 Compliance Enhancement Schema Additions
-- Japanese Labor Standards Act Article 36 Agreement Monitoring

-- 36協定（時間外労働協定）管理テーブル
CREATE TABLE labor_agreements (
    id TEXT PRIMARY KEY,
    company_id TEXT DEFAULT 'DEFAULT_COMPANY',
    agreement_type TEXT CHECK (agreement_type IN ('36_standard', '36_special', 'other')) DEFAULT '36_standard',
    effective_from DATE NOT NULL,
    effective_to DATE NOT NULL,
    
    -- 標準的な36協定の上限
    monthly_overtime_limit REAL DEFAULT 45.0,      -- 月間時間外労働上限（時間）
    yearly_overtime_limit REAL DEFAULT 360.0,      -- 年間時間外労働上限（時間）
    
    -- 特別条項付き36協定の上限
    special_monthly_limit REAL DEFAULT 100.0,      -- 特別条項時の月間上限（時間）
    special_yearly_limit REAL DEFAULT 720.0,       -- 特別条項時の年間上限（時間）
    special_2month_avg_limit REAL DEFAULT 80.0,    -- 複数月平均上限（時間）
    special_6month_avg_limit REAL DEFAULT 80.0,    -- 6ヶ月平均上限（時間）
    special_monthly_count_limit INTEGER DEFAULT 6,  -- 特別条項適用可能月数
    
    -- 健康確保措置
    health_measures TEXT,
    notification_authority TEXT,    -- 届出労働基準監督署
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 36協定監視・アラート管理テーブル
CREATE TABLE compliance_alerts (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    alert_type TEXT CHECK (alert_type IN (
        'monthly_overtime_approaching',   -- 月間上限接近
        'monthly_overtime_exceeded',      -- 月間上限超過
        'yearly_overtime_approaching',    -- 年間上限接近
        'yearly_overtime_exceeded',       -- 年間上限超過
        'special_limit_approaching',      -- 特別条項上限接近
        'special_limit_exceeded',         -- 特別条項上限超過
        'health_check_required',          -- 健康確保措置必要
        'continuous_work_violation'       -- 連続勤務違反
    )) NOT NULL,
    
    alert_level TEXT CHECK (alert_level IN ('info', 'warning', 'critical', 'emergency')) DEFAULT 'warning',
    target_period TEXT NOT NULL,       -- 対象期間（YYYY-MM または YYYY）
    current_hours REAL NOT NULL,       -- 現在の時間外労働時間
    limit_hours REAL NOT NULL,         -- 上限時間
    threshold_percentage REAL DEFAULT 80.0, -- アラート発動閾値（%）
    
    message TEXT NOT NULL,
    auto_generated BOOLEAN DEFAULT TRUE,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by TEXT,
    acknowledged_at DATETIME,
    
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at DATETIME,
    resolution_notes TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (acknowledged_by) REFERENCES employees(id)
);

-- 客観的記録システム（ICカード・PCログ対応）
CREATE TABLE objective_time_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    record_date DATE NOT NULL,
    
    -- ICカードデータ
    ic_card_in DATETIME,
    ic_card_out DATETIME,
    ic_card_device_id TEXT,
    ic_card_location TEXT,
    
    -- PCログデータ  
    pc_login DATETIME,
    pc_logout DATETIME,
    pc_device_id TEXT,
    pc_ip_address TEXT,
    
    -- 自己申告データ
    self_reported_in DATETIME,
    self_reported_out DATETIME,
    self_report_reason TEXT,
    
    -- 乖離チェック結果
    discrepancy_detected BOOLEAN DEFAULT FALSE,
    discrepancy_minutes INTEGER DEFAULT 0,
    discrepancy_explanation TEXT,
    
    -- 承認・確認
    verified_in DATETIME,           -- 最終確定された出勤時刻
    verified_out DATETIME,          -- 最終確定された退勤時刻
    verified_by TEXT,               -- 確定者
    verification_method TEXT CHECK (verification_method IN (
        'ic_card', 'pc_log', 'manual_review', 'supervisor_approval'
    )),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (verified_by) REFERENCES employees(id),
    UNIQUE(employee_id, record_date)
);

-- 労働時間計算詳細テーブル（36協定監視用）
CREATE TABLE detailed_work_hours (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    calculation_date DATE NOT NULL,
    
    -- 基本労働時間
    regular_hours REAL DEFAULT 0,          -- 所定労働時間
    actual_work_hours REAL DEFAULT 0,      -- 実労働時間
    
    -- 時間外労働の詳細分類
    daily_overtime REAL DEFAULT 0,         -- 1日8時間超の時間外
    weekly_overtime REAL DEFAULT 0,        -- 週40時間超の時間外
    statutory_overtime REAL DEFAULT 0,     -- 法定時間外労働（36協定対象）
    
    -- 深夜・休日労働
    late_night_hours REAL DEFAULT 0,       -- 深夜労働時間
    holiday_work_hours REAL DEFAULT 0,     -- 休日労働時間
    statutory_holiday_hours REAL DEFAULT 0, -- 法定休日労働時間
    
    -- 休憩時間
    break_minutes INTEGER DEFAULT 0,
    break_law_compliant BOOLEAN DEFAULT TRUE,
    
    -- 36協定遵守状況
    agreement_compliant BOOLEAN DEFAULT TRUE,
    compliance_notes TEXT,
    
    -- 計算基準
    payroll_calculation_id TEXT,           -- 給与計算との紐づけ
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (payroll_calculation_id) REFERENCES payroll_calculations(id),
    UNIQUE(employee_id, calculation_date)
);

-- 健康確保措置記録テーブル
CREATE TABLE health_check_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    check_date DATE NOT NULL,
    check_type TEXT CHECK (check_type IN (
        'medical_interview',      -- 医師の面接指導
        'health_questionnaire',   -- 健康状態チェック
        'stress_check',          -- ストレスチェック
        'work_load_review'       -- 業務負荷見直し
    )) NOT NULL,
    
    trigger_reason TEXT,                   -- 実施理由（80時間超、100時間超等）
    overtime_hours REAL,                   -- 対象期間の時間外労働時間
    
    -- 面接指導結果
    doctor_name TEXT,
    health_status TEXT CHECK (health_status IN (
        'good', 'caution', 'requires_attention', 'requires_treatment'
    )),
    recommendations TEXT,
    work_restrictions TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    
    completed BOOLEAN DEFAULT FALSE,
    completed_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- インデックス作成
CREATE INDEX idx_labor_agreements_effective ON labor_agreements(effective_from, effective_to);
CREATE INDEX idx_compliance_alerts_employee_date ON compliance_alerts(employee_id, created_at);
CREATE INDEX idx_compliance_alerts_type_level ON compliance_alerts(alert_type, alert_level);
CREATE INDEX idx_objective_records_employee_date ON objective_time_records(employee_id, record_date);
CREATE INDEX idx_detailed_hours_employee_date ON detailed_work_hours(employee_id, calculation_date);
CREATE INDEX idx_health_checks_employee_date ON health_check_records(employee_id, check_date);

-- 初期データ挿入
INSERT INTO labor_agreements (
    id,
    agreement_type,
    effective_from,
    effective_to,
    monthly_overtime_limit,
    yearly_overtime_limit,
    special_monthly_limit,
    special_yearly_limit,
    special_2month_avg_limit,
    special_6month_avg_limit,
    special_monthly_count_limit,
    health_measures,
    notification_authority
) VALUES (
    'DEFAULT_36_AGREEMENT_2024',
    '36_special',
    '2024-04-01',
    '2025-03-31',
    45.0,      -- 原則月45時間
    360.0,     -- 原則年360時間
    100.0,     -- 特別条項月100時間未満
    720.0,     -- 特別条項年720時間
    80.0,      -- 複数月平均80時間
    80.0,      -- 6ヶ月平均80時間
    6,         -- 特別条項適用は年6回まで
    '月80時間超の場合は医師の面接指導を実施',
    '○○労働基準監督署'
);