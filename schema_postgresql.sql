-- Attendance Management System Database Schema for PostgreSQL
-- Compliant with Japanese Labor Standards Act

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(255) PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    hourly_rate DECIMAL(10,2) NOT NULL,
    join_date DATE NOT NULL,
    manager_id VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);

-- Time records table (勤怠記録)
CREATE TABLE IF NOT EXISTS time_records (
    id VARCHAR(255) PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP,
    break_minutes INTEGER DEFAULT 0,
    record_type VARCHAR(50) CHECK (record_type IN ('ic_card', 'pc_log', 'manual')) DEFAULT 'manual',
    notes TEXT,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id)
);

-- Payroll calculations table (給与計算)
CREATE TABLE IF NOT EXISTS payroll_calculations (
    id VARCHAR(255) PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    month VARCHAR(7) NOT NULL, -- YYYY-MM format
    regular_hours DECIMAL(10,2) NOT NULL,
    overtime_hours DECIMAL(10,2) NOT NULL,
    late_night_hours DECIMAL(10,2) NOT NULL,
    holiday_hours DECIMAL(10,2) NOT NULL,
    regular_pay DECIMAL(12,2) NOT NULL,
    overtime_pay DECIMAL(12,2) NOT NULL,
    late_night_pay DECIMAL(12,2) NOT NULL,
    holiday_pay DECIMAL(12,2) NOT NULL,
    total_pay DECIMAL(12,2) NOT NULL,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, month)
);

-- Payroll rules table (給与規則)
CREATE TABLE IF NOT EXISTS payroll_rules (
    id SERIAL PRIMARY KEY,
    regular_hours_per_day DECIMAL(4,2) DEFAULT 8.0,
    regular_hours_per_week DECIMAL(4,2) DEFAULT 40.0,
    break_minutes_for_6_hours INTEGER DEFAULT 45,
    break_minutes_for_8_hours INTEGER DEFAULT 60,
    overtime_rate DECIMAL(4,2) DEFAULT 1.25,
    late_night_rate DECIMAL(4,2) DEFAULT 1.25,
    holiday_rate DECIMAL(4,2) DEFAULT 1.35,
    high_overtime_rate DECIMAL(4,2) DEFAULT 1.50,
    late_night_start INTEGER DEFAULT 22, -- 22:00
    late_night_end INTEGER DEFAULT 5,   -- 5:00
    monthly_overtime_limit DECIMAL(6,2) DEFAULT 45.0,
    yearly_overtime_limit DECIMAL(6,2) DEFAULT 360.0,
    high_overtime_threshold DECIMAL(6,2) DEFAULT 60.0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Holidays table (祝日・休日)
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type VARCHAR(50) CHECK (type IN ('national', 'company', 'weekend')) DEFAULT 'national',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance violations table (勤怠違反)
CREATE TABLE IF NOT EXISTS attendance_violations (
    id VARCHAR(255) PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    violation_type TEXT NOT NULL,
    violation_date DATE NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(50) CHECK (severity IN ('warning', 'minor', 'major', 'critical')) DEFAULT 'warning',
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

-- Insert default payroll rules based on Japanese Labor Standards Act (if not exists)  
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
) 
SELECT 8.0, 40.0, 45, 60, 1.25, 1.25, 1.35, 1.50, 22, 5, 45.0, 360.0, 60.0, '2024-01-01'
WHERE NOT EXISTS (SELECT 1 FROM payroll_rules WHERE effective_from = '2024-01-01');

-- Insert some common Japanese holidays for 2024-2025 (if not exists)
INSERT INTO holidays (date, name, type) 
SELECT t.date::date, t.name, t.type FROM (VALUES
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
) AS t(date, name, type)
WHERE NOT EXISTS (SELECT 1 FROM holidays WHERE holidays.date = t.date::date);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Leave requests table (休暇申請)
CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(255) PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    leave_type VARCHAR(50) CHECK (leave_type IN ('annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_days DECIMAL(3,1) NOT NULL,
    reason TEXT,
    status VARCHAR(20) CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
    is_half_day BOOLEAN DEFAULT FALSE,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    manager_id VARCHAR(255),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (approved_by) REFERENCES employees(id),
    FOREIGN KEY (manager_id) REFERENCES employees(id)
);

-- Leave balances table (休暇残高)
CREATE TABLE IF NOT EXISTS leave_balances (
    employee_id VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    annual_leave_days DECIMAL(4,1) DEFAULT 20.0, -- Japanese law: 20 days for 6+ years service
    annual_leave_used DECIMAL(4,1) DEFAULT 0.0,
    sick_leave_days DECIMAL(4,1) DEFAULT 10.0,
    sick_leave_used DECIMAL(4,1) DEFAULT 0.0,
    special_leave_used DECIMAL(4,1) DEFAULT 0.0,
    carry_over_days DECIMAL(4,1) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (employee_id, year),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Create indexes for leave management
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_date ON leave_requests(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date_range ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_balances_year ON leave_balances(year);

-- Create triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_time_records_updated_at ON time_records;
CREATE TRIGGER update_time_records_updated_at BEFORE UPDATE ON time_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leave_balances_updated_at ON leave_balances;
CREATE TRIGGER update_leave_balances_updated_at BEFORE UPDATE ON leave_balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();