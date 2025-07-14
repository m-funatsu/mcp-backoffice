-- Attendance Management System Database Schema
-- Compliant with Japanese Labor Standards Act

-- Employees table
CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    hourly_rate REAL NOT NULL,
    join_date DATE NOT NULL,
    manager_id TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);

-- Time records table (勤怠記録)
CREATE TABLE time_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    date DATE NOT NULL,
    clock_in DATETIME NOT NULL,
    clock_out DATETIME,
    break_minutes INTEGER DEFAULT 0,
    record_type TEXT CHECK (record_type IN ('ic_card', 'pc_log', 'manual')) DEFAULT 'manual',
    notes TEXT,
    approved_by TEXT,
    approved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id)
);

-- Payroll calculations table (給与計算)
CREATE TABLE payroll_calculations (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    month TEXT NOT NULL, -- YYYY-MM format
    regular_hours REAL NOT NULL,
    overtime_hours REAL NOT NULL,
    late_night_hours REAL NOT NULL,
    holiday_hours REAL NOT NULL,
    regular_pay REAL NOT NULL,
    overtime_pay REAL NOT NULL,
    late_night_pay REAL NOT NULL,
    holiday_pay REAL NOT NULL,
    total_pay REAL NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, month)
);

-- Payroll rules table (給与規則)
CREATE TABLE payroll_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    regular_hours_per_day REAL DEFAULT 8.0,
    regular_hours_per_week REAL DEFAULT 40.0,
    break_minutes_for_6_hours INTEGER DEFAULT 45,
    break_minutes_for_8_hours INTEGER DEFAULT 60,
    overtime_rate REAL DEFAULT 1.25,
    late_night_rate REAL DEFAULT 1.25,
    holiday_rate REAL DEFAULT 1.35,
    high_overtime_rate REAL DEFAULT 1.50,
    late_night_start INTEGER DEFAULT 22, -- 22:00
    late_night_end INTEGER DEFAULT 5,   -- 5:00
    monthly_overtime_limit REAL DEFAULT 45.0,
    yearly_overtime_limit REAL DEFAULT 360.0,
    high_overtime_threshold REAL DEFAULT 60.0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Holidays table (祝日・休日)
CREATE TABLE holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('national', 'company', 'weekend')) DEFAULT 'national',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Attendance violations table (勤怠違反)
CREATE TABLE attendance_violations (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    violation_type TEXT NOT NULL,
    violation_date DATE NOT NULL,
    description TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('warning', 'minor', 'major', 'critical')) DEFAULT 'warning',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Create indexes for better performance
CREATE INDEX idx_time_records_employee_date ON time_records(employee_id, date);
CREATE INDEX idx_time_records_date ON time_records(date);
CREATE INDEX idx_payroll_calculations_employee_month ON payroll_calculations(employee_id, month);
CREATE INDEX idx_holidays_date ON holidays(date);
CREATE INDEX idx_attendance_violations_employee ON attendance_violations(employee_id);

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
);

-- Leave/Vacation Management Tables (休暇・有給管理)

-- Leave balances table (有給残高管理)
CREATE TABLE leave_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement', 'personal')),
    year INTEGER NOT NULL,
    granted_days REAL NOT NULL DEFAULT 0,
    used_days REAL NOT NULL DEFAULT 0,
    remaining_days REAL NOT NULL DEFAULT 0,
    expiry_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, leave_type, year)
);

-- Leave requests table (休暇申請)
CREATE TABLE leave_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement', 'personal')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested REAL NOT NULL,
    half_day BOOLEAN DEFAULT FALSE,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_by TEXT,
    approved_at DATETIME,
    approval_notes TEXT,
    auto_approved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id)
);

-- Team calendar table (チームカレンダー)
CREATE TABLE team_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT NOT NULL,
    date DATE NOT NULL,
    employee_id TEXT NOT NULL,
    event_type TEXT CHECK (event_type IN ('leave', 'meeting', 'training', 'holiday')) DEFAULT 'leave',
    event_title TEXT NOT NULL,
    all_day BOOLEAN DEFAULT TRUE,
    start_time TIME,
    end_time TIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Leave policies table (休暇規則)
CREATE TABLE leave_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement', 'personal')),
    tenure_months INTEGER NOT NULL DEFAULT 0,
    granted_days REAL NOT NULL,
    max_consecutive_days INTEGER,
    advance_notice_days INTEGER DEFAULT 0,
    requires_approval BOOLEAN DEFAULT TRUE,
    auto_approval_conditions TEXT,
    carryover_allowed BOOLEAN DEFAULT FALSE,
    carryover_limit_days INTEGER,
    expiry_months INTEGER,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for leave management
CREATE INDEX idx_leave_balances_employee ON leave_balances(employee_id);
CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX idx_team_calendar_department_date ON team_calendar(department, date);
CREATE INDEX idx_team_calendar_employee_date ON team_calendar(employee_id, date);

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
('personal', 0, 3, 5, 1, TRUE, NULL, FALSE, 0, 12, '2024-01-01');

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
('2025-11-23', '勤労感謝の日', 'national');