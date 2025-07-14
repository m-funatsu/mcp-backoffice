-- Extended Employee Master Data for Payroll System v1.2.0
-- This script extends the employees table with payroll-specific fields

-- Add new columns to employees table for enhanced payroll support
ALTER TABLE employees ADD COLUMN employee_number TEXT UNIQUE;
ALTER TABLE employees ADD COLUMN social_insurance_number TEXT;
ALTER TABLE employees ADD COLUMN contract_type TEXT CHECK (contract_type IN ('full_time', 'part_time', 'contract', 'temporary')) DEFAULT 'full_time';
ALTER TABLE employees ADD COLUMN salary_type TEXT CHECK (salary_type IN ('hourly', 'monthly', 'annual')) DEFAULT 'hourly';
ALTER TABLE employees ADD COLUMN base_salary REAL;

-- Bank Account Information
CREATE TABLE IF NOT EXISTS employee_bank_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    account_type TEXT CHECK (account_type IN ('checking', 'savings')) DEFAULT 'checking',
    account_number TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Tax Information
CREATE TABLE IF NOT EXISTS employee_tax_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL UNIQUE,
    dependents INTEGER DEFAULT 0,
    tax_rate REAL DEFAULT 0.0,
    is_disabled BOOLEAN DEFAULT FALSE,
    is_single_parent BOOLEAN DEFAULT FALSE,
    has_spouse_deduction BOOLEAN DEFAULT FALSE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Employee Allowances
CREATE TABLE IF NOT EXISTS employee_allowances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    type TEXT CHECK (type IN ('transport', 'housing', 'family', 'position', 'qualification', 'other')) NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    is_fixed BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Employee Deductions
CREATE TABLE IF NOT EXISTS employee_deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    type TEXT CHECK (type IN ('union_fees', 'company_housing', 'loan_repayment', 'insurance', 'other')) NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    is_fixed BOOLEAN DEFAULT TRUE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Payslip Storage
CREATE TABLE IF NOT EXISTS payslips (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    month TEXT NOT NULL, -- YYYY-MM format
    base_salary REAL NOT NULL,
    gross_pay REAL NOT NULL,
    total_allowances REAL NOT NULL,
    total_deductions REAL NOT NULL,
    income_tax REAL NOT NULL,
    resident_tax REAL NOT NULL,
    health_insurance REAL NOT NULL,
    pension_insurance REAL NOT NULL,
    unemployment_insurance REAL NOT NULL,
    long_term_care_insurance REAL NOT NULL,
    net_pay REAL NOT NULL,
    regular_hours REAL NOT NULL,
    overtime_hours REAL NOT NULL,
    late_night_hours REAL NOT NULL,
    holiday_hours REAL NOT NULL,
    working_days INTEGER NOT NULL,
    absent_days INTEGER NOT NULL,
    paid_leaves INTEGER NOT NULL,
    generated_at TIMESTAMP NOT NULL,
    approved_by TEXT,
    approved_at TIMESTAMP,
    status TEXT CHECK (status IN ('draft', 'pending', 'approved', 'paid')) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE(employee_id, month)
);

-- Payslip Line Items (Detailed breakdown)
CREATE TABLE IF NOT EXISTS payslip_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payslip_id TEXT NOT NULL,
    category TEXT CHECK (category IN ('allowance', 'deduction', 'tax', 'insurance')) NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    hours REAL,
    rate REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payslip_id) REFERENCES payslips(id)
);

-- Social Insurance Calculations
CREATE TABLE IF NOT EXISTS social_insurance_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    health_insurance_rate REAL NOT NULL, -- 健康保険料率
    pension_insurance_rate REAL NOT NULL, -- 厚生年金保険料率
    unemployment_insurance_rate REAL NOT NULL, -- 雇用保険料率
    long_term_care_insurance_rate REAL NOT NULL, -- 介護保険料率 (40歳以上)
    workers_compensation_rate REAL NOT NULL, -- 労災保険料率
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax Brackets for Income Tax Calculation
CREATE TABLE IF NOT EXISTS tax_brackets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    min_income REAL NOT NULL,
    max_income REAL,
    tax_rate REAL NOT NULL,
    deduction REAL NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_bank_accounts_employee ON employee_bank_accounts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_tax_info_employee ON employee_tax_info(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_allowances_employee ON employee_allowances(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_deductions_employee ON employee_deductions(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee_month ON payslips(employee_id, month);
CREATE INDEX IF NOT EXISTS idx_payslip_line_items_payslip ON payslip_line_items(payslip_id);

-- Insert default social insurance rates for 2024
INSERT OR IGNORE INTO social_insurance_rates (
    year, health_insurance_rate, pension_insurance_rate, unemployment_insurance_rate, 
    long_term_care_insurance_rate, workers_compensation_rate, effective_from
) VALUES (
    2024, 0.0991, 0.183, 0.006, 0.0123, 0.003, '2024-01-01'
);

-- Insert 2024 Japanese income tax brackets
INSERT OR IGNORE INTO tax_brackets (year, min_income, max_income, tax_rate, deduction, effective_from) VALUES
(2024, 0, 1950000, 0.05, 0, '2024-01-01'),
(2024, 1950000, 3300000, 0.10, 97500, '2024-01-01'),
(2024, 3300000, 6950000, 0.20, 427500, '2024-01-01'),
(2024, 6950000, 9000000, 0.23, 636000, '2024-01-01'),
(2024, 9000000, 18000000, 0.33, 1536000, '2024-01-01'),
(2024, 18000000, 40000000, 0.40, 2796000, '2024-01-01'),
(2024, 40000000, NULL, 0.45, 4796000, '2024-01-01');