import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Employee, TimeRecord, PayrollCalculation, PayrollRules, AttendanceReport, ExpenseCategory, ExpenseRequest, ApprovalWorkflow, ReceiptImage, AccountingEntry, ExtractedReceiptData, LeaveBalance, LeaveType } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseSQLite {
  private db: sqlite3.Database;
  private isMemoryDB: boolean = false;

  constructor(dbPath: string = 'attendance.db') {
    if (dbPath === ':memory:') {
      this.isMemoryDB = true;
    }
    
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        throw err;
      }
      console.log('Connected to SQLite database');
    });
  }

  async connect(): Promise<void> {
    // SQLite doesn't require explicit connection
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Disconnected from SQLite database');
          resolve();
        }
      });
    });
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async exec(sql: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    return { rows: await this.all(sql, params) };
  }

  async initializeDatabase(): Promise<void> {
    try {
      const schemaPath = join(__dirname, '..', 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      await this.exec(schema);
      console.log('Database initialized successfully');
      
      // Create additional tables
      await this.createLaborStandardsMonitoringTables();
      console.log('Labor standards monitoring tables created successfully');
      
      await this.createHRExtensionTables();
      console.log('HR extension tables created successfully');
      
      await this.createHumanCapitalDisclosureTables();
      console.log('Human Capital Disclosure tables created successfully');
      
      await this.createTalentManagementTables();
      console.log('Talent Management tables created successfully');
      
    } catch (err) {
      console.error('Error initializing database:', err);
      throw err;
    }
  }

  private async createLaborStandardsMonitoringTables(): Promise<void> {
    // 36協定（時間外労働協定）管理テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS labor_agreements (
        id TEXT PRIMARY KEY,
        company_id TEXT DEFAULT 'DEFAULT_COMPANY',
        agreement_type TEXT CHECK (agreement_type IN ('36_standard', '36_special', 'other')) DEFAULT '36_standard',
        effective_from DATE NOT NULL,
        effective_to DATE NOT NULL,
        
        monthly_overtime_limit REAL DEFAULT 45.0,
        yearly_overtime_limit REAL DEFAULT 360.0,
        
        special_monthly_limit REAL DEFAULT 100.0,
        special_yearly_limit REAL DEFAULT 720.0,
        special_2month_avg_limit REAL DEFAULT 80.0,
        special_6month_avg_limit REAL DEFAULT 80.0,
        special_monthly_count_limit INTEGER DEFAULT 6,
        
        health_measures TEXT,
        notification_authority TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 36協定監視・アラート管理テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS compliance_alerts (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        alert_type TEXT CHECK (alert_type IN (
          'overtime_approaching_monthly', 'overtime_exceeded_monthly',
          'overtime_approaching_yearly', 'overtime_exceeded_yearly',
          'special_condition_used', 'special_condition_exceeded',
          'health_checkup_required', 'break_time_violation',
          'continuous_work_violation', 'holiday_work_violation'
        )) NOT NULL,
        
        severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) NOT NULL,
        alert_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        current_value REAL,
        threshold_value REAL,
        period_start DATE,
        period_end DATE,
        
        status TEXT CHECK (status IN ('active', 'acknowledged', 'resolved')) DEFAULT 'active',
        acknowledged_by TEXT,
        acknowledged_at TIMESTAMP,
        resolved_by TEXT,
        resolved_at TIMESTAMP,
        resolution_notes TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 客観的記録システム（勤怠データ確認・承認）
    await this.exec(`
      CREATE TABLE IF NOT EXISTS objective_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        record_date DATE NOT NULL,
        
        ic_card_in TIMESTAMP,
        ic_card_out TIMESTAMP,
        pc_login TIMESTAMP,
        pc_logout TIMESTAMP,
        gps_checkin TIMESTAMP,
        gps_checkout TIMESTAMP,
        
        self_reported_in TIMESTAMP,
        self_reported_out TIMESTAMP,
        
        time_discrepancy_minutes INTEGER,
        discrepancy_reason TEXT,
        
        approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_correction')) DEFAULT 'pending',
        approved_by TEXT,
        approved_at TIMESTAMP,
        rejection_reason TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 労働時間集計・分析テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS labor_hours_summary (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        calculation_period TEXT NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        
        total_work_hours REAL DEFAULT 0,
        regular_hours REAL DEFAULT 0,
        overtime_hours REAL DEFAULT 0,
        late_night_hours REAL DEFAULT 0,
        holiday_hours REAL DEFAULT 0,
        
        overtime_limit REAL,
        overtime_utilization_rate REAL,
        is_compliant BOOLEAN DEFAULT TRUE,
        
        special_condition_used BOOLEAN DEFAULT FALSE,
        special_condition_count INTEGER DEFAULT 0,
        
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 休憩時間管理テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS break_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        work_date DATE NOT NULL,
        
        break_start TIMESTAMP,
        break_end TIMESTAMP,
        break_duration_minutes INTEGER,
        break_type TEXT CHECK (break_type IN ('lunch', 'afternoon', 'other')) DEFAULT 'lunch',
        
        required_break_minutes INTEGER,
        actual_break_minutes INTEGER,
        is_compliant BOOLEAN DEFAULT TRUE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);
  }

  private async createHRExtensionTables(): Promise<void> {
    // 従業員マスタ拡張テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS employee_extensions (
        employee_id TEXT PRIMARY KEY,
        
        employee_number TEXT,
        full_name_kana TEXT,
        emergency_contact TEXT,
        emergency_phone TEXT,
        
        employment_type TEXT CHECK (employment_type IN ('regular', 'contract', 'part_time', 'temporary', 'intern')) DEFAULT 'regular',
        work_location TEXT,
        cost_center TEXT,
        manager_id TEXT,
        
        base_salary DECIMAL(10,2),
        allowances TEXT,
        deductions TEXT,
        pay_grade TEXT,
        
        work_schedule TEXT,
        overtime_exemption BOOLEAN DEFAULT FALSE,
        flex_time_eligible BOOLEAN DEFAULT FALSE,
        
        annual_leave_days INTEGER DEFAULT 20,
        sick_leave_days INTEGER DEFAULT 10,
        special_leave_days INTEGER DEFAULT 5,
        
        performance_rating TEXT,
        next_review_date DATE,
        career_level TEXT,
        
        probation_end_date DATE,
        contract_end_date DATE,
        labor_union_member BOOLEAN DEFAULT FALSE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (manager_id) REFERENCES employees(id)
      )
    `);

    // 組織階層テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS organization_hierarchy (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        position_title TEXT NOT NULL,
        
        hierarchy_level INTEGER DEFAULT 1,
        reports_to TEXT,
        
        responsibility_area TEXT,
        budget_authority DECIMAL(12,2),
        
        effective_from DATE NOT NULL,
        effective_to DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (reports_to) REFERENCES employees(id)
      )
    `);

    // 給与計算履歴テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS payroll_history (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        calculation_period TEXT NOT NULL,
        
        base_salary DECIMAL(10,2),
        overtime_pay DECIMAL(10,2),
        allowances DECIMAL(10,2),
        gross_pay DECIMAL(10,2),
        
        income_tax DECIMAL(10,2),
        social_insurance DECIMAL(10,2),
        other_deductions DECIMAL(10,2),
        net_pay DECIMAL(10,2),
        
        regular_hours REAL,
        overtime_hours REAL,
        paid_leave_hours REAL,
        
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_by TEXT,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 税務・社会保険設定テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS tax_settings (
        id TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        tax_type TEXT CHECK (tax_type IN ('income_tax', 'social_insurance', 'employment_insurance', 'other')) NOT NULL,
        
        rate_structure TEXT,
        
        applicable_from DATE,
        applicable_to DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async createHumanCapitalDisclosureTables(): Promise<void> {
    // 人材多様性情報テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS diversity_information (
        employee_id TEXT PRIMARY KEY,
        
        gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
        age_group TEXT CHECK (age_group IN ('under_30', '30_39', '40_49', '50_59', '60_over')),
        nationality TEXT,
        
        disability_status TEXT CHECK (disability_status IN ('none', 'physical', 'intellectual', 'mental', 'multiple')),
        
        education_level TEXT CHECK (education_level IN ('high_school', 'vocational', 'bachelor', 'master', 'phd')),
        
        employment_category TEXT CHECK (employment_category IN ('regular', 'contract', 'part_time', 'temporary')),
        
        leadership_level TEXT CHECK (leadership_level IN ('executive', 'senior_manager', 'manager', 'supervisor', 'individual')),
        
        diversity_score REAL,
        inclusion_score REAL,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // スキル・能力管理テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS employee_skills (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        skill_category TEXT CHECK (skill_category IN ('technical', 'soft', 'leadership', 'specialized')) NOT NULL,
        skill_name TEXT NOT NULL,
        proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5) DEFAULT 1,
        
        assessed_by TEXT,
        assessment_date DATE,
        certification_name TEXT,
        certification_expiry DATE,
        
        last_used_date DATE,
        usage_frequency TEXT CHECK (usage_frequency IN ('daily', 'weekly', 'monthly', 'rarely')),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 育成・研修管理テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS training_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        training_type TEXT CHECK (training_type IN ('internal', 'external', 'elearning', 'ojt', 'mentoring')) NOT NULL,
        training_name TEXT NOT NULL,
        
        training_category TEXT,
        provider TEXT,
        duration_hours REAL,
        cost DECIMAL(10,2),
        
        start_date DATE,
        end_date DATE,
        
        completion_status TEXT CHECK (completion_status IN ('completed', 'in_progress', 'cancelled', 'no_show')) DEFAULT 'in_progress',
        evaluation_score REAL,
        effectiveness_rating INTEGER CHECK (effectiveness_rating BETWEEN 1 AND 5),
        
        reaction_score REAL,
        learning_score REAL,
        behavior_score REAL,
        results_score REAL,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // パフォーマンス評価テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS performance_evaluations (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        evaluation_period TEXT NOT NULL,
        evaluation_type TEXT CHECK (evaluation_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'project')) NOT NULL,
        
        overall_rating REAL,
        goal_achievement_score REAL,
        competency_score REAL,
        leadership_score REAL,
        
        self_evaluation REAL,
        supervisor_evaluation REAL,
        peer_evaluation REAL,
        subordinate_evaluation REAL,
        
        strengths TEXT,
        areas_for_improvement TEXT,
        development_plan TEXT,
        
        promotion_readiness TEXT CHECK (promotion_readiness IN ('ready', 'needs_development', 'not_ready')),
        succession_potential TEXT CHECK (succession_potential IN ('high', 'medium', 'low')),
        
        evaluator_id TEXT,
        evaluation_date DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (evaluator_id) REFERENCES employees(id)
      )
    `);

    // エンゲージメント・組織文化テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS engagement_surveys (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        survey_type TEXT CHECK (survey_type IN ('annual', 'pulse', 'exit', 'onboarding')) NOT NULL,
        survey_date DATE NOT NULL,
        
        engagement_score REAL,
        satisfaction_score REAL,
        enps_score INTEGER,
        wellbeing_score REAL,
        
        job_satisfaction REAL,
        work_life_balance REAL,
        career_development REAL,
        compensation_satisfaction REAL,
        management_effectiveness REAL,
        team_collaboration REAL,
        
        feedback_comments TEXT,
        improvement_suggestions TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 健康・安全管理テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS health_safety_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        incident_type TEXT CHECK (incident_type IN ('accident', 'near_miss', 'occupational_disease', 'safety_violation')) NOT NULL,
        incident_date DATE NOT NULL,
        
        severity_level TEXT CHECK (severity_level IN ('minor', 'moderate', 'major', 'fatality')) NOT NULL,
        body_part_affected TEXT,
        description TEXT,
        
        immediate_action TEXT,
        investigation_status TEXT CHECK (investigation_status IN ('pending', 'investigating', 'completed')) DEFAULT 'pending',
        root_cause TEXT,
        corrective_measures TEXT,
        
        reported_to_authority BOOLEAN DEFAULT FALSE,
        reporting_date DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // コンプライアンス・倫理テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS compliance_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        incident_type TEXT CHECK (incident_type IN ('harassment', 'discrimination', 'ethics_violation', 'data_breach', 'other')) NOT NULL,
        incident_date DATE NOT NULL,
        
        severity_level TEXT CHECK (severity_level IN ('minor', 'moderate', 'major', 'critical')) NOT NULL,
        description TEXT,
        
        investigation_status TEXT CHECK (investigation_status IN ('reported', 'investigating', 'resolved', 'closed')) DEFAULT 'reported',
        assigned_investigator TEXT,
        investigation_notes TEXT,
        
        resolution_action TEXT,
        disciplinary_action TEXT,
        resolved_date DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 人的資本指標算出テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS human_capital_metrics (
        id TEXT PRIMARY KEY,
        calculation_period TEXT NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        
        total_employees INTEGER,
        gender_diversity_ratio REAL,
        age_diversity_index REAL,
        nationality_diversity_count INTEGER,
        disability_employment_ratio REAL,
        leadership_diversity_ratio REAL,
        
        training_hours_per_employee REAL,
        training_cost_per_employee REAL,
        skill_development_index REAL,
        internal_promotion_ratio REAL,
        
        employee_engagement_score REAL,
        employee_satisfaction_score REAL,
        enps_score REAL,
        
        voluntary_turnover_rate REAL,
        involuntary_turnover_rate REAL,
        average_tenure_years REAL,
        
        accident_frequency_rate REAL,
        occupational_disease_rate REAL,
        safety_training_completion_rate REAL,
        
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        calculated_by TEXT
      )
    `);
  }

  private async createTalentManagementTables(): Promise<void> {
    // スキルマスタテーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        competency_levels INTEGER DEFAULT 5,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 研修履歴テーブル
    await this.exec(`
      CREATE TABLE IF NOT EXISTS training_history (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        training_name TEXT NOT NULL,
        training_type TEXT NOT NULL,
        provider TEXT,
        start_date DATE NOT NULL,
        end_date DATE,
        duration_hours DECIMAL(5,2) NOT NULL,
        cost DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'scheduled',
        completion_rate DECIMAL(5,2),
        evaluation_score DECIMAL(3,2),
        kirkpatrick_level INTEGER,
        related_skills TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 目標管理テーブル（MBO & OKR対応）
    await this.exec(`
      CREATE TABLE IF NOT EXISTS goals_okrs (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        goal_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        target_value DECIMAL(10,2),
        current_value DECIMAL(10,2) DEFAULT 0,
        unit TEXT,
        weight DECIMAL(5,2) DEFAULT 100,
        priority TEXT DEFAULT 'medium',
        start_date DATE NOT NULL,
        due_date DATE NOT NULL,
        status TEXT DEFAULT 'in_progress',
        achievement_rate DECIMAL(5,2) DEFAULT 0,
        evaluation_rating DECIMAL(3,2),
        key_results TEXT,
        milestones TEXT,
        parent_goal_id TEXT,
        related_skills TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (parent_goal_id) REFERENCES goals_okrs(id)
      )
    `);
  }

  // Employee operations
  async createEmployee(employee: Employee): Promise<string> {
    const id = employee.id || `EMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { name, email, department, position, hourlyRate, startDate } = employee;
    
    await this.run(`
      INSERT INTO employees (id, name, email, department, position, hourly_rate, start_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, name, email, department, position, hourlyRate, startDate.toISOString().split('T')[0]]);
    
    return id;
  }

  async getEmployee(id: string): Promise<Employee | null> {
    const row = await this.get('SELECT * FROM employees WHERE id = ?', [id]);
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      department: row.department,
      position: row.position,
      hourlyRate: row.hourly_rate,
      startDate: new Date(row.start_date),
      managerId: row.manager_id,
      isActive: row.is_active || true
    };
  }

  async getAllEmployees(): Promise<Employee[]> {
    const rows = await this.all('SELECT * FROM employees ORDER BY name');
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      department: row.department,
      position: row.position,
      hourlyRate: row.hourly_rate,
      startDate: new Date(row.start_date),
      managerId: row.manager_id,
      isActive: row.is_active || true
    }));
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<boolean> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) return false;
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const sql = `UPDATE employees SET ${setClause} WHERE id = ?`;
    
    const result = await this.run(sql, [...values, id]);
    return result.changes > 0;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = await this.run('DELETE FROM employees WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // Time record operations
  async createTimeRecord(record: TimeRecord): Promise<string> {
    const { id, employeeId, date, clockIn, clockOut, breakDuration, notes } = record;
    
    await this.run(`
      INSERT INTO time_records (id, employee_id, date, clock_in, clock_out, break_duration, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, employeeId, date.toISOString().split('T')[0], clockIn?.toISOString(), clockOut?.toISOString(), breakDuration, notes]);
    
    return id;
  }

  async getTimeRecords(employeeId: string, startDate: string, endDate: string): Promise<TimeRecord[]> {
    const rows = await this.all(`
      SELECT * FROM time_records 
      WHERE employee_id = ? AND date >= ? AND date <= ?
      ORDER BY date DESC
    `, [employeeId, startDate, endDate]);
    
    return rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id,
      date: new Date(row.date),
      clockIn: row.clock_in ? new Date(row.clock_in) : undefined,
      clockOut: row.clock_out ? new Date(row.clock_out) : undefined,
      breakDuration: row.break_duration,
      notes: row.notes
    }));
  }

  async updateTimeRecord(id: string, updates: Partial<TimeRecord>): Promise<boolean> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) return false;
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const sql = `UPDATE time_records SET ${setClause} WHERE id = ?`;
    
    const result = await this.run(sql, [...values, id]);
    return result.changes > 0;
  }

  // Payroll operations
  async savePayrollCalculation(calculation: PayrollCalculation): Promise<string> {
    const { id, employeeId, month, regularHours, overtimeHours, lateNightHours, holidayHours, regularPay, overtimePay, lateNightPay, holidayPay, totalPay, calculatedAt } = calculation;
    
    await this.run(`
      INSERT OR REPLACE INTO payroll_calculations (id, employee_id, month, regular_hours, overtime_hours, late_night_hours, holiday_hours, regular_pay, overtime_pay, late_night_pay, holiday_pay, total_pay, calculated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, employeeId, month, regularHours, overtimeHours, lateNightHours, holidayHours, regularPay, overtimePay, lateNightPay, holidayPay, totalPay, calculatedAt.toISOString()]);
    
    return id;
  }

  async getPayrollCalculation(employeeId: string, month: string): Promise<PayrollCalculation | null> {
    const row = await this.get(`
      SELECT * FROM payroll_calculations 
      WHERE employee_id = ? AND month = ?
    `, [employeeId, month]);
    
    if (!row) return null;
    
    return {
      id: row.id,
      employeeId: row.employee_id,
      month: row.month,
      regularHours: row.regular_hours,
      overtimeHours: row.overtime_hours,
      lateNightHours: row.late_night_hours,
      holidayHours: row.holiday_hours,
      regularPay: row.regular_pay,
      overtimePay: row.overtime_pay,
      lateNightPay: row.late_night_pay,
      holidayPay: row.holiday_pay,
      totalPay: row.total_pay,
      calculatedAt: new Date(row.calculated_at)
    };
  }

  async getAllPayrollCalculations(month: string): Promise<PayrollCalculation[]> {
    const rows = await this.all(`
      SELECT * FROM payroll_calculations 
      WHERE month = ?
      ORDER BY employee_id
    `, [month]);
    
    return rows.map(row => ({
      id: row.id,
      employeeId: row.employee_id,
      month: row.month,
      regularHours: row.regular_hours,
      overtimeHours: row.overtime_hours,
      lateNightHours: row.late_night_hours,
      holidayHours: row.holiday_hours,
      regularPay: row.regular_pay,
      overtimePay: row.overtime_pay,
      lateNightPay: row.late_night_pay,
      holidayPay: row.holiday_pay,
      totalPay: row.total_pay,
      calculatedAt: new Date(row.calculated_at)
    }));
  }

  // Legacy method aliases for backward compatibility
  async addEmployee(employee: Employee): Promise<string> {
    return await this.createEmployee(employee);
  }

  async clockIn(employeeId: string, timestamp: Date, notes?: string): Promise<void> {
    await this.run(`
      INSERT INTO time_records (id, employee_id, date, clock_in, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [
      `TR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId,
      timestamp.toISOString().split('T')[0],
      timestamp.toISOString(),
      notes || null
    ]);
  }

  async clockOut(employeeId: string, timestamp: Date, breakDuration?: number): Promise<void> {
    await this.run(`
      UPDATE time_records 
      SET clock_out = ?, break_duration = ?
      WHERE employee_id = ? AND date = ? AND clock_out IS NULL
    `, [timestamp.toISOString(), breakDuration || 0, employeeId, timestamp.toISOString().split('T')[0]]);
  }

  async getPayrollRules(): Promise<PayrollRules> {
    const row = await this.get(`
      SELECT * FROM payroll_rules 
      WHERE effective_from <= date('now') 
      AND (effective_to IS NULL OR effective_to >= date('now'))
      ORDER BY effective_from DESC
      LIMIT 1
    `);
    
    if (!row) {
      // Return default rules if none found
      return {
        regularHoursPerDay: 8,
        regularHoursPerWeek: 40,
        breakMinutesFor6Hours: 45,
        breakMinutesFor8Hours: 60,
        overtimeRate: 1.25,
        lateNightRate: 1.25,
        holidayRate: 1.35,
        highOvertimeRate: 1.50,
        lateNightStart: 22,
        lateNightEnd: 5,
        monthlyOvertimeLimit: 45,
        yearlyOvertimeLimit: 360,
        highOvertimeThreshold: 60
      };
    }
    
    return {
      regularHoursPerDay: row.regular_hours_per_day,
      regularHoursPerWeek: row.regular_hours_per_week,
      breakMinutesFor6Hours: row.break_minutes_for_6_hours,
      breakMinutesFor8Hours: row.break_minutes_for_8_hours,
      overtimeRate: row.overtime_rate,
      lateNightRate: row.late_night_rate,
      holidayRate: row.holiday_rate,
      highOvertimeRate: row.high_overtime_rate,
      lateNightStart: row.late_night_start,
      lateNightEnd: row.late_night_end,
      monthlyOvertimeLimit: row.monthly_overtime_limit,
      yearlyOvertimeLimit: row.yearly_overtime_limit,
      highOvertimeThreshold: row.high_overtime_threshold
    };
  }

  async isHoliday(date: Date): Promise<boolean> {
    const row = await this.get(`
      SELECT COUNT(*) as count FROM holidays 
      WHERE date = ?
    `, [date.toISOString().split('T')[0]]);
    
    return row.count > 0;
  }

  async close(): Promise<void> {
    await this.disconnect();
  }

  // Additional utility methods
  async runQuery(sql: string, params: any[] = []): Promise<any> {
    return await this.query(sql, params);
  }
}

// Singleton instance
let database: DatabaseSQLite | null = null;

export function getDatabase(): DatabaseSQLite {
  if (!database) {
    database = new DatabaseSQLite();
  }
  return database;
}

export default DatabaseSQLite;
export { DatabaseSQLite };