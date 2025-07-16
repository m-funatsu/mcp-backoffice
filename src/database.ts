import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Employee, TimeRecord, PayrollCalculation, PayrollRules, AttendanceReport, ExpenseCategory, ExpenseRequest, ApprovalWorkflow, ReceiptImage, AccountingEntry, ExtractedReceiptData, LeaveBalance, LeaveType } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Database {
  private db: Client;

  constructor(connectionString?: string) {
    // In test environment, use mock database
    if (process.env.NODE_ENV === 'test') {
      this.db = {
        connect: () => Promise.resolve(),
        end: () => Promise.resolve(),
        query: () => Promise.resolve({ rows: [], rowCount: 0 })
      } as any;
      return;
    }
    
    this.db = new Client({
      connectionString: connectionString || process.env.DATABASE_URL || 'postgresql://localhost:5432/attendance',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async connect(): Promise<void> {
    try {
      await this.db.connect();
      console.log('Connected to PostgreSQL database');
    } catch (err) {
      console.error('Error connecting to database:', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.db.end();
      console.log('Disconnected from PostgreSQL database');
    } catch (err) {
      console.error('Error disconnecting from database:', err);
      throw err;
    }
  }

  // Compatibility methods for SQLite-style API
  async run(sql: string, params: any[], callback?: (err: any) => void): Promise<any> {
    try {
      const pgSql = sql.replace(/\?/g, (match, offset, string) => {
        const paramIndex = string.substring(0, offset).split('?').length;
        return `$${paramIndex}`;
      });
      
      const result = await this.db.query(pgSql, params);
      if (callback) callback(null);
      return result;
    } catch (err) {
      if (callback) callback(err);
      throw err;
    }
  }

  async get(sql: string, params: any[], callback?: (err: any, row: any) => void): Promise<any> {
    try {
      const pgSql = sql.replace(/\?/g, (match, offset, string) => {
        const paramIndex = string.substring(0, offset).split('?').length;
        return `$${paramIndex}`;
      });
      
      const result = await this.db.query(pgSql, params);
      const row = result.rows[0] || null;
      if (callback) callback(null, row);
      return row;
    } catch (err) {
      if (callback) callback(err, null);
      throw err;
    }
  }

  async all(sql: string, params: any[], callback?: (err: any, rows: any[]) => void): Promise<any[]> {
    try {
      const pgSql = sql.replace(/\?/g, (match, offset, string) => {
        const paramIndex = string.substring(0, offset).split('?').length;
        return `$${paramIndex}`;
      });
      
      const result = await this.db.query(pgSql, params);
      if (callback) callback(null, result.rows);
      return result.rows;
    } catch (err) {
      if (callback) callback(err, []);
      throw err;
    }
  }

  async exec(sql: string, callback?: (err: any) => void): Promise<any> {
    try {
      const result = await this.db.query(sql);
      if (callback) callback(null);
      return result;
    } catch (err) {
      if (callback) callback(err);
      throw err;
    }
  }

  // Public query method for direct access
  async query(sql: string, params: any[] = []): Promise<any> {
    return await this.db.query(sql, params);
  }

  // Additional methods for expense engine compatibility
  async getExpenseCategory(categoryId: string): Promise<any> {
    const result = await this.db.query('SELECT * FROM expense_categories WHERE id = $1', [categoryId]);
    return result.rows[0] || null;
  }

  async createAccountingEntry(entry: any): Promise<string> {
    const id = `ACC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.db.query(`
      INSERT INTO accounting_entries (id, expense_request_id, entry_date, description, debit_account, credit_account, amount, tax_amount, reference, exported, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [id, entry.expenseRequestId, entry.entryDate, entry.description, entry.debitAccount, entry.creditAccount, entry.amount, entry.taxAmount, entry.reference, entry.exported, new Date()]);
    return id;
  }

  async getExpenseRequestsByEmployee(employeeId: string): Promise<any[]> {
    const result = await this.db.query('SELECT * FROM expense_requests WHERE employee_id = $1', [employeeId]);
    return result.rows;
  }

  async initializeDatabase(): Promise<void> {
    try {
      await this.connect();
      
      const schemaPath = join(__dirname, '..', 'schema-postgresql.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      await this.db.query(schema);
      console.log('Database initialized successfully');
      
      // Create additional tables (labor standards monitoring and HR extension)
      await this.createLaborStandardsMonitoringTables();
      console.log('Labor standards monitoring tables created successfully');
      
      // Create HR extension tables for v1.5.0-v2.0.0
      await this.createHRExtensionTables();
      console.log('HR extension tables created successfully');
      
      // Create Human Capital Disclosure tables for v2.0.0
      await this.createHumanCapitalDisclosureTables();
      console.log('Human Capital Disclosure tables created successfully');
      
    } catch (err) {
      console.error('Error initializing database:', err);
      throw err;
    }
  }

  private async createLaborStandardsMonitoringTables(): Promise<void> {
    // 36協定（時間外労働協定）管理テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS labor_agreements (
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
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 36協定監視・アラート管理テーブル
    await this.db.query(`
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
        
        -- アラート詳細情報
        current_value REAL,
        threshold_value REAL,
        period_start DATE,
        period_end DATE,
        
        -- 対応状況
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
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS objective_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        record_date DATE NOT NULL,
        
        -- 客観的記録の種類と時刻
        ic_card_in TIMESTAMP,
        ic_card_out TIMESTAMP,
        pc_login TIMESTAMP,
        pc_logout TIMESTAMP,
        gps_checkin TIMESTAMP,
        gps_checkout TIMESTAMP,
        
        -- 自己申告時刻
        self_reported_in TIMESTAMP,
        self_reported_out TIMESTAMP,
        
        -- 記録間の乖離チェック
        time_discrepancy_minutes INTEGER,
        discrepancy_reason TEXT,
        
        -- 承認・確認状況
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
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS labor_hours_summary (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        calculation_period TEXT NOT NULL, -- 'monthly', 'yearly', '2month_avg', '6month_avg'
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        
        -- 労働時間詳細
        total_work_hours REAL DEFAULT 0,
        regular_hours REAL DEFAULT 0,
        overtime_hours REAL DEFAULT 0,
        late_night_hours REAL DEFAULT 0,
        holiday_hours REAL DEFAULT 0,
        
        -- 36協定コンプライアンス
        overtime_limit REAL,
        overtime_utilization_rate REAL,
        is_compliant BOOLEAN DEFAULT TRUE,
        
        -- 特別条項関連
        special_condition_used BOOLEAN DEFAULT FALSE,
        special_condition_count INTEGER DEFAULT 0,
        
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 休憩時間管理テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS break_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        work_date DATE NOT NULL,
        
        -- 休憩時間詳細
        break_start TIMESTAMP,
        break_end TIMESTAMP,
        break_duration_minutes INTEGER,
        break_type TEXT CHECK (break_type IN ('lunch', 'afternoon', 'other')) DEFAULT 'lunch',
        
        -- 法定休憩時間チェック
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
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS employee_extensions (
        employee_id TEXT PRIMARY KEY,
        
        -- 基本情報拡張
        employee_number TEXT,
        full_name_kana TEXT,
        emergency_contact TEXT,
        emergency_phone TEXT,
        
        -- 雇用詳細
        employment_type TEXT CHECK (employment_type IN ('regular', 'contract', 'part_time', 'temporary', 'intern')) DEFAULT 'regular',
        work_location TEXT,
        cost_center TEXT,
        manager_id TEXT,
        
        -- 給与・手当関連
        base_salary DECIMAL(10,2),
        allowances JSONB,
        deductions JSONB,
        pay_grade TEXT,
        
        -- 勤怠関連
        work_schedule TEXT,
        overtime_exemption BOOLEAN DEFAULT FALSE,
        flex_time_eligible BOOLEAN DEFAULT FALSE,
        
        -- 休暇関連
        annual_leave_days INTEGER DEFAULT 20,
        sick_leave_days INTEGER DEFAULT 10,
        special_leave_days INTEGER DEFAULT 5,
        
        -- 人事評価関連
        performance_rating TEXT,
        next_review_date DATE,
        career_level TEXT,
        
        -- 労働法関連
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
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS organization_hierarchy (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        position_title TEXT NOT NULL,
        
        -- 階層情報
        hierarchy_level INTEGER DEFAULT 1,
        reports_to TEXT,
        
        -- 責任範囲
        responsibility_area TEXT,
        budget_authority DECIMAL(12,2),
        
        -- 期間
        effective_from DATE NOT NULL,
        effective_to DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (reports_to) REFERENCES employees(id)
      )
    `);

    // 給与計算履歴テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS payroll_history (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        calculation_period TEXT NOT NULL,
        
        -- 基本給与情報
        base_salary DECIMAL(10,2),
        overtime_pay DECIMAL(10,2),
        allowances DECIMAL(10,2),
        gross_pay DECIMAL(10,2),
        
        -- 控除項目
        income_tax DECIMAL(10,2),
        social_insurance DECIMAL(10,2),
        other_deductions DECIMAL(10,2),
        net_pay DECIMAL(10,2),
        
        -- 時間情報
        regular_hours REAL,
        overtime_hours REAL,
        paid_leave_hours REAL,
        
        -- 処理情報
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_by TEXT,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 税務・社会保険設定テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS tax_settings (
        id TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        tax_type TEXT CHECK (tax_type IN ('income_tax', 'social_insurance', 'employment_insurance', 'other')) NOT NULL,
        
        -- 税率・料率設定
        rate_structure JSONB,
        
        -- 適用条件
        applicable_from DATE,
        applicable_to DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async createHumanCapitalDisclosureTables(): Promise<void> {
    // 人材多様性情報テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS diversity_information (
        employee_id TEXT PRIMARY KEY,
        
        -- 基本属性
        gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
        age_group TEXT CHECK (age_group IN ('under_30', '30_39', '40_49', '50_59', '60_over')),
        nationality TEXT,
        
        -- 障害者雇用
        disability_status TEXT CHECK (disability_status IN ('none', 'physical', 'intellectual', 'mental', 'multiple')),
        
        -- 教育背景
        education_level TEXT CHECK (education_level IN ('high_school', 'vocational', 'bachelor', 'master', 'phd')),
        
        -- 雇用形態
        employment_category TEXT CHECK (employment_category IN ('regular', 'contract', 'part_time', 'temporary')),
        
        -- 管理職・リーダーシップ
        leadership_level TEXT CHECK (leadership_level IN ('executive', 'senior_manager', 'manager', 'supervisor', 'individual')),
        
        -- 多様性指標
        diversity_score REAL,
        inclusion_score REAL,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // スキル・能力管理テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS employee_skills (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        skill_category TEXT CHECK (skill_category IN ('technical', 'soft', 'leadership', 'specialized')) NOT NULL,
        skill_name TEXT NOT NULL,
        proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5) DEFAULT 1,
        
        -- 評価詳細
        assessed_by TEXT,
        assessment_date DATE,
        certification_name TEXT,
        certification_expiry DATE,
        
        -- スキル活用
        last_used_date DATE,
        usage_frequency TEXT CHECK (usage_frequency IN ('daily', 'weekly', 'monthly', 'rarely')),
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 育成・研修管理テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS training_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        training_type TEXT CHECK (training_type IN ('internal', 'external', 'elearning', 'ojt', 'mentoring')) NOT NULL,
        training_name TEXT NOT NULL,
        
        -- 研修詳細
        training_category TEXT,
        provider TEXT,
        duration_hours REAL,
        cost DECIMAL(10,2),
        
        -- 日程
        start_date DATE,
        end_date DATE,
        
        -- 評価
        completion_status TEXT CHECK (completion_status IN ('completed', 'in_progress', 'cancelled', 'no_show')) DEFAULT 'in_progress',
        evaluation_score REAL,
        effectiveness_rating INTEGER CHECK (effectiveness_rating BETWEEN 1 AND 5),
        
        -- カークパトリック4段階評価
        reaction_score REAL,     -- レベル1: 反応
        learning_score REAL,     -- レベル2: 学習
        behavior_score REAL,     -- レベル3: 行動
        results_score REAL,      -- レベル4: 結果
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // パフォーマンス評価テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS performance_evaluations (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        evaluation_period TEXT NOT NULL,
        evaluation_type TEXT CHECK (evaluation_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'project')) NOT NULL,
        
        -- 評価スコア
        overall_rating REAL,
        goal_achievement_score REAL,
        competency_score REAL,
        leadership_score REAL,
        
        -- 360度フィードバック
        self_evaluation REAL,
        supervisor_evaluation REAL,
        peer_evaluation REAL,
        subordinate_evaluation REAL,
        
        -- 評価詳細
        strengths TEXT,
        areas_for_improvement TEXT,
        development_plan TEXT,
        
        -- 昇進・昇格
        promotion_readiness TEXT CHECK (promotion_readiness IN ('ready', 'needs_development', 'not_ready')),
        succession_potential TEXT CHECK (succession_potential IN ('high', 'medium', 'low')),
        
        -- 評価者情報
        evaluator_id TEXT,
        evaluation_date DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (evaluator_id) REFERENCES employees(id)
      )
    `);

    // エンゲージメント・組織文化テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS engagement_surveys (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        survey_type TEXT CHECK (survey_type IN ('annual', 'pulse', 'exit', 'onboarding')) NOT NULL,
        survey_date DATE NOT NULL,
        
        -- エンゲージメント指標
        engagement_score REAL,
        satisfaction_score REAL,
        enps_score INTEGER,  -- Employee Net Promoter Score
        wellbeing_score REAL,
        
        -- 詳細カテゴリ
        job_satisfaction REAL,
        work_life_balance REAL,
        career_development REAL,
        compensation_satisfaction REAL,
        management_effectiveness REAL,
        team_collaboration REAL,
        
        -- 定性フィードバック
        feedback_comments TEXT,
        improvement_suggestions TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 健康・安全管理テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS health_safety_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        incident_type TEXT CHECK (incident_type IN ('accident', 'near_miss', 'occupational_disease', 'safety_violation')) NOT NULL,
        incident_date DATE NOT NULL,
        
        -- 事故・災害詳細
        severity_level TEXT CHECK (severity_level IN ('minor', 'moderate', 'major', 'fatality')) NOT NULL,
        body_part_affected TEXT,
        description TEXT,
        
        -- 対応状況
        immediate_action TEXT,
        investigation_status TEXT CHECK (investigation_status IN ('pending', 'investigating', 'completed')) DEFAULT 'pending',
        root_cause TEXT,
        corrective_measures TEXT,
        
        -- 法的報告
        reported_to_authority BOOLEAN DEFAULT FALSE,
        reporting_date DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // コンプライアンス・倫理テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS compliance_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        incident_type TEXT CHECK (incident_type IN ('harassment', 'discrimination', 'ethics_violation', 'data_breach', 'other')) NOT NULL,
        incident_date DATE NOT NULL,
        
        -- 事案詳細
        severity_level TEXT CHECK (severity_level IN ('minor', 'moderate', 'major', 'critical')) NOT NULL,
        description TEXT,
        
        -- 調査・対応
        investigation_status TEXT CHECK (investigation_status IN ('reported', 'investigating', 'resolved', 'closed')) DEFAULT 'reported',
        assigned_investigator TEXT,
        investigation_notes TEXT,
        
        -- 解決措置
        resolution_action TEXT,
        disciplinary_action TEXT,
        resolved_date DATE,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 人的資本指標算出テーブル
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS human_capital_metrics (
        id TEXT PRIMARY KEY,
        calculation_period TEXT NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        
        -- 人材多様性指標
        total_employees INTEGER,
        gender_diversity_ratio REAL,
        age_diversity_index REAL,
        nationality_diversity_count INTEGER,
        disability_employment_ratio REAL,
        leadership_diversity_ratio REAL,
        
        -- 人材育成指標
        training_hours_per_employee REAL,
        training_cost_per_employee REAL,
        skill_development_index REAL,
        internal_promotion_ratio REAL,
        
        -- エンゲージメント指標
        employee_engagement_score REAL,
        employee_satisfaction_score REAL,
        enps_score REAL,
        
        -- 離職・定着指標
        voluntary_turnover_rate REAL,
        involuntary_turnover_rate REAL,
        average_tenure_years REAL,
        
        -- 健康・安全指標
        accident_frequency_rate REAL,
        occupational_disease_rate REAL,
        safety_training_completion_rate REAL,
        
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        calculated_by TEXT
      )
    `);
  }


  // Employee operations
  async createEmployee(employee: Employee): Promise<string> {
    const { id, name, email, department, position, hourlyRate, startDate } = employee;
    
    await this.db.query(`
      INSERT INTO employees (id, name, email, department, position, hourly_rate, start_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, name, email, department, position, hourlyRate, startDate]);
    
    return id;
  }

  async getEmployee(id: string): Promise<Employee | null> {
    const result = await this.db.query('SELECT * FROM employees WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async getAllEmployees(): Promise<Employee[]> {
    const result = await this.db.query('SELECT * FROM employees ORDER BY name');
    return result.rows;
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<boolean> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) return false;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const sql = `UPDATE employees SET ${setClause} WHERE id = $1`;
    
    const result = await this.db.query(sql, [id, ...values]);
    return (result.rowCount || 0) > 0;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = await this.db.query('DELETE FROM employees WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // Time record operations
  async createTimeRecord(record: TimeRecord): Promise<string> {
    const { id, employeeId, date, clockIn, clockOut, breakDuration, notes } = record;
    
    await this.db.query(`
      INSERT INTO time_records (id, employee_id, date, clock_in, clock_out, break_duration, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, employeeId, date, clockIn, clockOut, breakDuration, notes]);
    
    return id;
  }

  async getTimeRecords(employeeId: string, startDate: string, endDate: string): Promise<TimeRecord[]> {
    const result = await this.db.query(`
      SELECT * FROM time_records 
      WHERE employee_id = $1 AND date >= $2 AND date <= $3
      ORDER BY date DESC
    `, [employeeId, startDate, endDate]);
    
    return result.rows;
  }

  async updateTimeRecord(id: string, updates: Partial<TimeRecord>): Promise<boolean> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) return false;
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const sql = `UPDATE time_records SET ${setClause} WHERE id = $1`;
    
    const result = await this.db.query(sql, [id, ...values]);
    return (result.rowCount || 0) > 0;
  }

  // Payroll operations
  async savePayrollCalculation(calculation: PayrollCalculation): Promise<string> {
    const { id, employeeId, month, regularHours, overtimeHours, lateNightHours, holidayHours, regularPay, overtimePay, lateNightPay, holidayPay, totalPay, calculatedAt } = calculation;
    
    await this.db.query(`
      INSERT INTO payroll_calculations (id, employee_id, month, regular_hours, overtime_hours, late_night_hours, holiday_hours, regular_pay, overtime_pay, late_night_pay, holiday_pay, total_pay, calculated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        regular_hours = EXCLUDED.regular_hours,
        overtime_hours = EXCLUDED.overtime_hours,
        late_night_hours = EXCLUDED.late_night_hours,
        holiday_hours = EXCLUDED.holiday_hours,
        regular_pay = EXCLUDED.regular_pay,
        overtime_pay = EXCLUDED.overtime_pay,
        late_night_pay = EXCLUDED.late_night_pay,
        holiday_pay = EXCLUDED.holiday_pay,
        total_pay = EXCLUDED.total_pay,
        calculated_at = EXCLUDED.calculated_at
    `, [id, employeeId, month, regularHours, overtimeHours, lateNightHours, holidayHours, regularPay, overtimePay, lateNightPay, holidayPay, totalPay, calculatedAt]);
    
    return id;
  }

  async getPayrollCalculation(employeeId: string, month: string): Promise<PayrollCalculation | null> {
    const result = await this.db.query(`
      SELECT * FROM payroll_calculations 
      WHERE employee_id = $1 AND month = $2
    `, [employeeId, month]);
    
    return result.rows[0] || null;
  }

  async getAllPayrollCalculations(month: string): Promise<PayrollCalculation[]> {
    const result = await this.db.query(`
      SELECT * FROM payroll_calculations 
      WHERE month = $1
      ORDER BY employee_id
    `, [month]);
    
    return result.rows;
  }

  // Expense operations
  async createExpenseCategory(category: ExpenseCategory): Promise<string> {
    const { id, name, description, isActive, accountingCode, approvalRequired } = category;
    
    await this.db.query(`
      INSERT INTO expense_categories (id, name, description, is_active, accounting_code, approval_required)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, name, description, isActive, accountingCode, approvalRequired]);
    
    return id;
  }

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    const result = await this.db.query(`
      SELECT * FROM expense_categories 
      WHERE is_active = true
      ORDER BY name
    `);
    
    return result.rows;
  }

  async createExpenseRequest(request: ExpenseRequest): Promise<string> {
    const { id, employeeId, categoryId, amount, description, expenseDate, receiptRequired, status } = request;
    
    await this.db.query(`
      INSERT INTO expense_requests (id, employee_id, category_id, amount, description, expense_date, receipt_required, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, employeeId, categoryId, amount, description, expenseDate, receiptRequired, status]);
    
    return id;
  }

  async getExpenseRequests(employeeId?: string, status?: string): Promise<ExpenseRequest[]> {
    let sql = 'SELECT * FROM expense_requests';
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (employeeId) {
      conditions.push(`employee_id = $${params.length + 1}`);
      params.push(employeeId);
    }
    
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY expense_date DESC';
    
    const result = await this.db.query(sql, params);
    return result.rows;
  }

  // Leave management operations
  async getLeaveBalance(employeeId: string, leaveType?: LeaveType): Promise<LeaveBalance | null> {
    let sql = `SELECT * FROM leave_balances WHERE employee_id = $1`;
    const params: any[] = [employeeId];
    
    if (leaveType) {
      sql += ` AND leave_type = $2`;
      params.push(leaveType);
    }
    
    const result = await this.db.query(sql, params);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      employeeId: row.employee_id,
      leaveType: row.leave_type as LeaveType,
      year: row.year,
      grantedDays: row.granted_days,
      usedDays: row.used_days,
      remainingDays: row.remaining_days,
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  async updateLeaveBalance(employeeId: string, leaveType: string, days: number): Promise<boolean> {
    const result = await this.db.query(`
      UPDATE leave_balances 
      SET ${leaveType}_balance = ${leaveType}_balance + $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $2
    `, [days, employeeId]);
    
    return (result.rowCount || 0) > 0;
  }

  // Legacy method aliases for backward compatibility
  async addEmployee(employee: Employee): Promise<string> {
    return await this.createEmployee(employee);
  }

  async clockIn(employeeId: string, timestamp: Date, notes?: string): Promise<void> {
    // Implementation for clock in
    await this.db.query(`
      INSERT INTO time_records (id, employee_id, date, clock_in, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      `TR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId,
      timestamp.toISOString().split('T')[0],
      timestamp,
      notes || null
    ]);
  }

  async clockOut(employeeId: string, timestamp: Date, breakDuration?: number): Promise<void> {
    // Implementation for clock out
    await this.db.query(`
      UPDATE time_records 
      SET clock_out = $1, break_duration = $2, updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $3 AND date = $4 AND clock_out IS NULL
    `, [timestamp, breakDuration || 0, employeeId, timestamp.toISOString().split('T')[0]]);
  }

  async getPayrollRules(): Promise<any> {
    const result = await this.db.query(`
      SELECT * FROM payroll_rules 
      WHERE effective_from <= CURRENT_DATE 
      AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
      ORDER BY effective_from DESC
      LIMIT 1
    `);
    
    return result.rows[0] || null;
  }

  async isHoliday(date: Date): Promise<boolean> {
    const result = await this.db.query(`
      SELECT COUNT(*) as count FROM holidays 
      WHERE date = $1
    `, [date.toISOString().split('T')[0]]);
    
    return result.rows[0].count > 0;
  }

  async close(): Promise<void> {
    await this.disconnect();
  }

  // Additional methods for expense management
  async updateExpenseRequestStatus(requestId: string, status: string): Promise<boolean> {
    const result = await this.db.query(`
      UPDATE expense_requests 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [status, requestId]);
    
    return (result.rowCount || 0) > 0;
  }

  async getExpenseRequest(requestId: string): Promise<any> {
    const result = await this.db.query(`
      SELECT * FROM expense_requests WHERE id = $1
    `, [requestId]);
    
    return result.rows[0] || null;
  }

  // Compliance monitoring methods
  async monitor36Compliance(employeeId: string, period: any): Promise<any> {
    // Implementation for 36 agreement compliance monitoring
    const result = await this.db.query(`
      SELECT * FROM labor_hours_summary 
      WHERE employee_id = $1 AND period_start >= $2 AND period_end <= $3
    `, [employeeId, period.start, period.end]);
    
    return result.rows;
  }

  async generateComplianceAlert(alertData: any): Promise<string> {
    const alertId = `ALERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.query(`
      INSERT INTO compliance_alerts (id, employee_id, alert_type, severity, current_value, threshold_value, period_start, period_end)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      alertId,
      alertData.employeeId,
      alertData.alertType,
      alertData.severity,
      alertData.currentValue,
      alertData.thresholdValue,
      alertData.periodStart,
      alertData.periodEnd
    ]);
    
    return alertId;
  }

  async saveObjectiveRecord(record: any): Promise<string> {
    const recordId = `OR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.query(`
      INSERT INTO objective_records (id, employee_id, record_date, ic_card_in, ic_card_out, self_reported_in, self_reported_out)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      recordId,
      record.employeeId,
      record.recordDate,
      record.icCardIn,
      record.icCardOut,
      record.selfReportedIn,
      record.selfReportedOut
    ]);
    
    return recordId;
  }

  async generateComplianceReport(period: any): Promise<any> {
    const result = await this.db.query(`
      SELECT * FROM compliance_alerts 
      WHERE alert_date >= $1 AND alert_date <= $2
      ORDER BY alert_date DESC
    `, [period.start, period.end]);
    
    return {
      alerts: result.rows,
      summary: {
        totalAlerts: result.rows.length,
        criticalAlerts: result.rows.filter((a: any) => a.severity === 'critical').length,
        warningAlerts: result.rows.filter((a: any) => a.severity === 'warning').length
      }
    };
  }

  async recordHealthCheckMeasure(measure: any): Promise<string> {
    const measureId = `HM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.query(`
      INSERT INTO health_safety_records (id, employee_id, incident_type, incident_date, severity_level, description)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      measureId,
      measure.employeeId,
      'health_check',
      measure.date,
      'minor',
      measure.description
    ]);
    
    return measureId;
  }

  // Utility methods
  async runQuery(sql: string, params: any[] = []): Promise<any> {
    return await this.query(sql, params);
  }


}

// Singleton instance
let database: Database | null = null;

export function getDatabase(): Database {
  if (!database) {
    database = new Database();
  }
  return database;
}

export default Database;
export { Database };