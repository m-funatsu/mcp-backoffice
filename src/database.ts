import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Employee, TimeRecord, PayrollCalculation, PayrollRules, AttendanceReport, ExpenseCategory, ExpenseRequest, ApprovalWorkflow, ReceiptImage, AccountingEntry, ExtractedReceiptData, LeaveBalance, LeaveType } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = 'attendance.db') {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.error('Connected to SQLite database');
      }
    });
  }

  async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const schemaPath = join(__dirname, '..', 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      this.db.exec(schema, async (err) => {
        if (err) {
          // Check if error is due to table already existing - this is acceptable for tests
          if (err.message.includes('already exists')) {
            console.error('Database tables already exist, skipping initialization');
          } else {
            console.error('Error initializing database:', err);
            reject(err);
            return;
          }
        } else {
          console.error('Database initialized successfully');
        }
        
        // Always try to create additional tables (labor standards monitoring and HR extension)
        try {
          await this.createLaborStandardsMonitoringTables();
          console.error('Labor standards monitoring tables created successfully');
          
          // Create HR extension tables for v1.5.0-v2.0.0
          await this.createHRExtensionTables();
          console.error('HR extension tables created successfully');
          
          // Create Human Capital Disclosure tables for v2.0.0
          await this.createHumanCapitalDisclosureTables();
          console.error('Human Capital Disclosure tables created successfully');
          
          resolve();
        } catch (monitoringErr) {
          console.error('Error creating additional tables:', monitoringErr);
          reject(monitoringErr);
        }
      });
    });
  }

  private async createLaborStandardsMonitoringTables(): Promise<void> {
    // 36協定（時間外労働協定）管理テーブル
    await this.run(`
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
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 36協定監視・アラート管理テーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS compliance_alerts (
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
      )
    `);

    // 客観的記録システム（ICカード・PCログ対応）
    await this.run(`
      CREATE TABLE IF NOT EXISTS objective_time_records (
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
      )
    `);

    // 労働時間計算詳細テーブル（36協定監視用）
    await this.run(`
      CREATE TABLE IF NOT EXISTS detailed_work_hours (
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
      )
    `);

    // 健康確保措置記録テーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS health_check_records (
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
      )
    `);

    // インデックス作成
    await this.run('CREATE INDEX IF NOT EXISTS idx_labor_agreements_effective ON labor_agreements(effective_from, effective_to)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_compliance_alerts_employee_date ON compliance_alerts(employee_id, created_at)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_compliance_alerts_type_level ON compliance_alerts(alert_type, alert_level)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_objective_records_employee_date ON objective_time_records(employee_id, record_date)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_detailed_hours_employee_date ON detailed_work_hours(employee_id, calculation_date)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_health_checks_employee_date ON health_check_records(employee_id, check_date)');

    // 初期データ挿入
    await this.run(`
      INSERT OR IGNORE INTO labor_agreements (
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
      )
    `);
  }

  private async createHRExtensionTables(): Promise<void> {
    try {
      // Read and execute HR extension schema
      const schemaPath = join(__dirname, '..', 'schema-hr-extensions-v1.5.0-v2.0.0.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      // Split by semicolon and execute each statement
      const statements = schema.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await this.run(statement.trim());
        }
      }
    } catch (error) {
      console.error('Error creating HR extension tables:', error);
      throw error;
    }
  }

  private async createHumanCapitalDisclosureTables(): Promise<void> {
    try {
      // 1. 従業員テーブルの拡張（エラーを無視）
      await this.extendEmployeesTable();
      
      // 2. 人的資本開示用テーブルの作成
      await this.createHumanCapitalTables();
      
      // 3. 初期データの投入
      await this.insertHumanCapitalInitialData();
      
    } catch (error) {
      console.error('Error creating Human Capital Disclosure tables:', error);
      throw error;
    }
  }
  
  private async extendEmployeesTable(): Promise<void> {
    // 既存のemployeesテーブルに新しいカラムを追加（エラーは無視）
    const newColumns = [
      'gender VARCHAR(20)',
      'age INTEGER',
      'nationality VARCHAR(100)',
      'disability_status VARCHAR(50)',
      'education_level VARCHAR(100)',
      'employment_type VARCHAR(50) DEFAULT \'full_time\'',
      'manager_id INTEGER'
    ];
    
    for (const column of newColumns) {
      try {
        await this.run(`ALTER TABLE employees ADD COLUMN ${column}`);
      } catch (error: any) {
        // カラムが既に存在する場合はエラーを無視
        if (!error.message.includes('duplicate column name')) {
          console.error(`Warning: Could not add column ${column}:`, error.message);
        }
      }
    }
    
    // インデックスの作成
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_employees_gender ON employees(gender)',
      'CREATE INDEX IF NOT EXISTS idx_employees_age ON employees(age)',
      'CREATE INDEX IF NOT EXISTS idx_employees_nationality ON employees(nationality)',
      'CREATE INDEX IF NOT EXISTS idx_employees_employment_type ON employees(employment_type)',
      'CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id)'
    ];
    
    for (const index of indexes) {
      try {
        await this.run(index);
      } catch (error: any) {
        console.error(`Warning: Could not create index:`, error.message);
      }
    }
  }
  
  private async createHumanCapitalTables(): Promise<void> {
    // スキルマスタテーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS skills (
        skill_id TEXT PRIMARY KEY,
        skill_name VARCHAR(255) NOT NULL,
        skill_category VARCHAR(100) NOT NULL,
        skill_type VARCHAR(50) CHECK (skill_type IN ('technical', 'soft', 'leadership', 'domain_specific')),
        description TEXT,
        industry_standard BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 従業員スキル関連テーブル
    await this.run(`
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
        FOREIGN KEY (skill_id) REFERENCES skills(skill_id)
      )
    `);
    
    // 研修コースマスタテーブル
    await this.run(`
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
      )
    `);
    
    // 研修受講履歴テーブル（外部キー制約なし）
    await this.run(`
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
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);
    
    // パフォーマンス評価テーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS performance_evaluations (
        evaluation_id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        evaluator_id TEXT NOT NULL,
        evaluation_period VARCHAR(50) NOT NULL,
        evaluation_type VARCHAR(50) CHECK (evaluation_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'project_based')),
        evaluation_date DATE NOT NULL,
        overall_rating DECIMAL(3, 2),
        performance_score INTEGER CHECK (performance_score BETWEEN 1 AND 5),
        competency_ratings TEXT,
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
      )
    `);
    
    // 従業員エンゲージメントサーベイテーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS employee_engagement_surveys (
        survey_id TEXT PRIMARY KEY,
        survey_name VARCHAR(255) NOT NULL,
        survey_type VARCHAR(50) CHECK (survey_type IN ('annual', 'pulse', 'exit', 'onboarding', 'custom')),
        survey_period VARCHAR(50) NOT NULL,
        questions TEXT NOT NULL,
        launch_date DATE NOT NULL,
        close_date DATE NOT NULL,
        participation_rate DECIMAL(5, 2),
        response_rate DECIMAL(5, 2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // サーベイ回答テーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS survey_responses (
        response_id TEXT PRIMARY KEY,
        survey_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        responses TEXT NOT NULL,
        response_date DATE NOT NULL,
        overall_satisfaction DECIMAL(3, 2),
        enps_score INTEGER CHECK (enps_score BETWEEN 0 AND 10),
        engagement_score DECIMAL(3, 2),
        wellbeing_score DECIMAL(3, 2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (survey_id) REFERENCES employee_engagement_surveys(survey_id),
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);
    
    // 健康・安全事故テーブル
    await this.run(`
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
      )
    `);
    
    // コンプライアンス事案テーブル
    await this.run(`
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
      )
    `);
    
    // 人的資本指標テーブル
    await this.run(`
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
      )
    `);
  }
  
  private async insertHumanCapitalInitialData(): Promise<void> {
    // 基本的なスキルカテゴリの挿入
    const basicSkills = [
      ['SKILL_001', 'プロジェクト管理', 'マネジメント', 'leadership', 'プロジェクトの計画・実行・監視・完了を統括する能力', 1],
      ['SKILL_002', 'チームリーダーシップ', 'リーダーシップ', 'leadership', 'チームを導き、モチベーションを高める能力', 1],
      ['SKILL_003', 'コミュニケーション', 'ソフトスキル', 'soft', '効果的な意思疎通を行う能力', 1],
      ['SKILL_004', 'データ分析', 'テクニカル', 'technical', 'データを分析し、洞察を得る能力', 1],
      ['SKILL_005', 'プログラミング（Python）', 'テクニカル', 'technical', 'Python言語でのプログラミング能力', 1],
      ['SKILL_006', 'プログラミング（JavaScript）', 'テクニカル', 'technical', 'JavaScript言語でのプログラミング能力', 1],
      ['SKILL_007', '問題解決', 'ソフトスキル', 'soft', '複雑な問題を分析し、解決策を見出す能力', 1],
      ['SKILL_008', 'プレゼンテーション', 'ソフトスキル', 'soft', '効果的なプレゼンテーションを行う能力', 1]
    ];
    
    for (const skill of basicSkills) {
      await this.run(`
        INSERT OR IGNORE INTO skills (skill_id, skill_name, skill_category, skill_type, description, industry_standard)
        VALUES (?, ?, ?, ?, ?, ?)
      `, skill);
    }
    
    // 基本的な研修コースの挿入
    const basicCourses = [
      ['COURSE_001', 'リーダーシップ基礎研修', 'リーダーシップ', 'internal', null, 16, null, '新任管理職', 'リーダーシップの基本概念と実践方法を習得する'],
      ['COURSE_002', 'プロジェクト管理入門', 'マネジメント', 'external', null, 24, null, '中級社員', 'プロジェクト管理の基本手法を学ぶ'],
      ['COURSE_003', 'データ分析基礎', 'テクニカル', 'e_learning', null, 20, null, '全社員', 'データ分析の基本概念と手法を理解する'],
      ['COURSE_004', 'コミュニケーション向上研修', 'ソフトスキル', 'internal', null, 8, null, '全社員', '効果的なコミュニケーション技術を身につける'],
      ['COURSE_005', 'ハラスメント防止研修', 'コンプライアンス', 'internal', null, 4, null, '全社員', 'ハラスメントの理解と予防方法を学ぶ']
    ];
    
    for (const course of basicCourses) {
      try {
        await this.run(`
          INSERT OR IGNORE INTO training_courses (course_id, course_name, course_category, course_type, provider, duration_hours, cost_per_person, target_audience, learning_objectives)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, course);
      } catch (error: any) {
        console.error('Warning: Could not insert training course:', error.message);
      }
    }
  }

  private async run(sql: string, params?: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async addEmployee(employee: Omit<Employee, 'id'>): Promise<string> {
    const id = `EMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO employees (id, name, department, position, hourly_rate, join_date, manager_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        employee.name,
        employee.department,
        employee.position,
        employee.hourlyRate,
        employee.joinDate.toISOString(),
        employee.managerId || null,
        employee.isActive ? 1 : 0
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  async getEmployee(id: string): Promise<Employee | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM employees WHERE id = ?`;
      
      this.db.get(sql, [id], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve({
            id: row.id,
            name: row.name,
            department: row.department,
            position: row.position,
            hourlyRate: row.hourly_rate,
            joinDate: new Date(row.join_date),
            managerId: row.manager_id,
            isActive: row.is_active === 1
          });
        }
      });
    });
  }

  async getAllEmployees(): Promise<Employee[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM employees WHERE is_active = 1 ORDER BY name`;
      
      this.db.all(sql, [], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const employees = rows.map(row => ({
            id: row.id,
            name: row.name,
            department: row.department,
            position: row.position,
            hourlyRate: row.hourly_rate,
            joinDate: new Date(row.join_date),
            managerId: row.manager_id,
            isActive: row.is_active === 1
          }));
          resolve(employees);
        }
      });
    });
  }

  async clockIn(employeeId: string, clockInTime: Date, recordType: 'ic_card' | 'pc_log' | 'manual' = 'manual'): Promise<string> {
    const recordId = `TR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const dateStr = clockInTime.toISOString().split('T')[0];
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO time_records (id, employee_id, date, clock_in, record_type)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        recordId,
        employeeId,
        dateStr,
        clockInTime.toISOString(),
        recordType
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(recordId);
        }
      });
    });
  }

  async clockOut(employeeId: string, clockOutTime: Date, breakMinutes: number = 0, notes?: string): Promise<boolean> {
    const dateStr = clockOutTime.toISOString().split('T')[0];
    
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE time_records 
        SET clock_out = ?, break_minutes = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = ? AND date = ? AND clock_out IS NULL
      `;
      
      this.db.run(sql, [
        clockOutTime.toISOString(),
        breakMinutes,
        notes || null,
        employeeId,
        dateStr
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  async getTimeRecords(employeeId: string, startDate: Date, endDate: Date): Promise<TimeRecord[]> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM time_records 
        WHERE employee_id = ? AND date BETWEEN ? AND ?
        ORDER BY date DESC
      `;
      
      this.db.all(sql, [
        employeeId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const records = rows.map(row => ({
            id: row.id,
            employeeId: row.employee_id,
            date: new Date(row.date),
            clockIn: new Date(row.clock_in),
            clockOut: row.clock_out ? new Date(row.clock_out) : undefined,
            breakMinutes: row.break_minutes,
            recordType: row.record_type as 'ic_card' | 'pc_log' | 'manual',
            notes: row.notes,
            approvedBy: row.approved_by,
            approvedAt: row.approved_at ? new Date(row.approved_at) : undefined
          }));
          resolve(records);
        }
      });
    });
  }

  async savePayrollCalculation(calculation: PayrollCalculation): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO payroll_calculations (
          id, employee_id, month, regular_hours, overtime_hours, late_night_hours, holiday_hours,
          regular_pay, overtime_pay, late_night_pay, holiday_pay, total_pay, calculated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const id = `PAY_${calculation.employeeId}_${calculation.month}`;
      
      this.db.run(sql, [
        id,
        calculation.employeeId,
        calculation.month,
        calculation.regularHours,
        calculation.overtimeHours,
        calculation.lateNightHours,
        calculation.holidayHours,
        calculation.regularPay,
        calculation.overtimePay,
        calculation.lateNightPay,
        calculation.holidayPay,
        calculation.totalPay,
        calculation.calculatedAt.toISOString()
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async getPayrollCalculation(employeeId: string, month: string): Promise<PayrollCalculation | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM payroll_calculations WHERE employee_id = ? AND month = ?`;
      
      this.db.get(sql, [employeeId, month], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve({
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
          });
        }
      });
    });
  }

  async getPayrollRules(): Promise<PayrollRules> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM payroll_rules 
        WHERE effective_from <= date('now') AND (effective_to IS NULL OR effective_to > date('now'))
        ORDER BY effective_from DESC
        LIMIT 1
      `;
      
      this.db.get(sql, [], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          // Return default rules if none found
          resolve({
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
          });
        } else {
          resolve({
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
          });
        }
      });
    });
  }

  async isHoliday(date: Date): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const dateStr = date.toISOString().split('T')[0];
      const sql = `SELECT COUNT(*) as count FROM holidays WHERE date = ?`;
      
      this.db.get(sql, [dateStr], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count > 0);
        }
      });
    });
  }

  // Expense Management Methods - v1.3.0
  
  async createExpenseRequest(request: Omit<ExpenseRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = `EXP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO expense_requests (
          id, employee_id, category_id, amount, currency, expense_date, 
          description, purpose, receipt_image_url, extracted_data, 
          status, ai_confidence_score, tax_deductible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        request.employeeId,
        request.categoryId,
        request.amount,
        request.currency,
        request.expenseDate.toISOString().split('T')[0],
        request.description,
        request.purpose || null,
        request.receiptImageUrl || null,
        request.extractedData ? JSON.stringify(request.extractedData) : null,
        request.status,
        request.aiConfidenceScore || null,
        request.taxDeductible ? 1 : 0
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  async getExpenseRequest(id: string): Promise<ExpenseRequest | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM expense_requests WHERE id = ?`;
      
      this.db.get(sql, [id], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve({
            id: row.id,
            employeeId: row.employee_id,
            categoryId: row.category_id,
            amount: row.amount,
            currency: row.currency,
            expenseDate: new Date(row.expense_date),
            description: row.description,
            purpose: row.purpose,
            receiptImageUrl: row.receipt_image_url,
            extractedData: row.extracted_data ? JSON.parse(row.extracted_data) : undefined,
            status: row.status,
            submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
            approvedBy: row.approved_by,
            approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
            rejectionReason: row.rejection_reason,
            aiConfidenceScore: row.ai_confidence_score,
            taxDeductible: row.tax_deductible === 1,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          });
        }
      });
    });
  }

  async getExpenseRequestsByEmployee(employeeId: string, startDate?: Date, endDate?: Date): Promise<ExpenseRequest[]> {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM expense_requests WHERE employee_id = ?`;
      const params: any[] = [employeeId];
      
      if (startDate && endDate) {
        sql += ` AND expense_date BETWEEN ? AND ?`;
        params.push(startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]);
      }
      
      sql += ` ORDER BY expense_date DESC`;
      
      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const requests = rows.map(row => ({
            id: row.id,
            employeeId: row.employee_id,
            categoryId: row.category_id,
            amount: row.amount,
            currency: row.currency,
            expenseDate: new Date(row.expense_date),
            description: row.description,
            purpose: row.purpose,
            receiptImageUrl: row.receipt_image_url,
            extractedData: row.extracted_data ? JSON.parse(row.extracted_data) : undefined,
            status: row.status,
            submittedAt: row.submitted_at ? new Date(row.submitted_at) : undefined,
            approvedBy: row.approved_by,
            approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
            rejectionReason: row.rejection_reason,
            aiConfidenceScore: row.ai_confidence_score,
            taxDeductible: row.tax_deductible === 1,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          }));
          resolve(requests);
        }
      });
    });
  }

  async updateExpenseRequestStatus(
    id: string, 
    status: 'submitted' | 'approved' | 'rejected' | 'reimbursed',
    approvedBy?: string,
    rejectionReason?: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let sql = `UPDATE expense_requests SET status = ?, updated_at = CURRENT_TIMESTAMP`;
      const params: any[] = [status];
      
      if (status === 'submitted') {
        sql += `, submitted_at = CURRENT_TIMESTAMP`;
      } else if (status === 'approved' && approvedBy) {
        sql += `, approved_by = ?, approved_at = CURRENT_TIMESTAMP`;
        params.push(approvedBy);
      } else if (status === 'rejected') {
        sql += `, rejection_reason = ?`;
        params.push(rejectionReason || 'No reason provided');
      }
      
      sql += ` WHERE id = ?`;
      params.push(id);
      
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name`;
      
      this.db.all(sql, [], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const categories = rows.map(row => ({
            id: row.id,
            name: row.name,
            code: row.code,
            description: row.description,
            parentCategoryId: row.parent_category_id,
            taxDeductible: row.tax_deductible === 1,
            approvalRequired: row.approval_required === 1,
            dailyLimit: row.daily_limit,
            monthlyLimit: row.monthly_limit,
            validationRules: row.validation_rules ? JSON.parse(row.validation_rules) : {},
            isActive: row.is_active === 1,
            createdAt: new Date(row.created_at)
          }));
          resolve(categories);
        }
      });
    });
  }

  async getExpenseCategory(id: string): Promise<ExpenseCategory | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM expense_categories WHERE id = ?`;
      
      this.db.get(sql, [id], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve({
            id: row.id,
            name: row.name,
            code: row.code,
            description: row.description,
            parentCategoryId: row.parent_category_id,
            taxDeductible: row.tax_deductible === 1,
            approvalRequired: row.approval_required === 1,
            dailyLimit: row.daily_limit,
            monthlyLimit: row.monthly_limit,
            validationRules: row.validation_rules ? JSON.parse(row.validation_rules) : {},
            isActive: row.is_active === 1,
            createdAt: new Date(row.created_at)
          });
        }
      });
    });
  }

  async saveReceiptImage(receiptImage: Omit<ReceiptImage, 'id' | 'createdAt'>): Promise<string> {
    const id = `RCP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO receipt_images (
          id, expense_request_id, file_name, file_size, mime_type, 
          storage_path, ocr_status, ocr_result, ai_extracted_data, confidence_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        receiptImage.expenseRequestId,
        receiptImage.fileName,
        receiptImage.fileSize,
        receiptImage.mimeType,
        receiptImage.storagePath,
        receiptImage.ocrStatus,
        receiptImage.ocrResult ? JSON.stringify(receiptImage.ocrResult) : null,
        receiptImage.aiExtractedData ? JSON.stringify(receiptImage.aiExtractedData) : null,
        receiptImage.confidenceScore || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  async createAccountingEntry(entry: Omit<AccountingEntry, 'id' | 'createdAt'>): Promise<string> {
    const id = `ACC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO accounting_entries (
          id, expense_request_id, entry_date, description, debit_account, 
          credit_account, amount, tax_amount, reference, exported
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        entry.expenseRequestId,
        entry.entryDate.toISOString().split('T')[0],
        entry.description,
        entry.debitAccount,
        entry.creditAccount,
        entry.amount,
        entry.taxAmount,
        entry.reference || null,
        entry.exported ? 1 : 0
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // v1.3.0 Compliance Enhancement Methods

  /**
   * 36協定遵守状況の監視
   */
  async monitor36Compliance(employeeId: string, targetMonth?: string): Promise<any> {
    const month = targetMonth || new Date().toISOString().slice(0, 7); // YYYY-MM
    
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          e.id,
          e.name,
          e.department,
          COALESCE(SUM(
            CASE 
              WHEN (julianday(tr.clock_out) - julianday(tr.clock_in)) * 24 - (tr.break_minutes / 60.0) > 8 
              THEN (julianday(tr.clock_out) - julianday(tr.clock_in)) * 24 - (tr.break_minutes / 60.0) - 8
              ELSE 0 
            END
          ), 0) as monthly_overtime_hours,
          COUNT(tr.id) as work_days
        FROM employees e
        LEFT JOIN time_records tr ON e.id = tr.employee_id 
          AND strftime('%Y-%m', tr.date) = ?
          AND tr.clock_out IS NOT NULL
        WHERE e.id = ? AND e.is_active = 1
        GROUP BY e.id, e.name, e.department
      `;
      
      this.db.get(sql, [month, employeeId], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          const result = {
            employeeId: row?.id || employeeId,
            name: row?.name || 'Unknown',
            department: row?.department || 'Unknown',
            month,
            monthlyOvertimeHours: row?.monthly_overtime_hours || 0,
            workDays: row?.work_days || 0,
            monthlyLimit: 45.0, // 標準的な36協定上限
            complianceStatus: (row?.monthly_overtime_hours || 0) <= 45.0 ? 'compliant' : 'exceeded',
            warningLevel: this.calculateWarningLevel(row?.monthly_overtime_hours || 0)
          };
          resolve(result);
        }
      });
    });
  }

  /**
   * 客観的記録の保存（ICカード・PCログ）
   */
  async saveObjectiveRecord(record: {
    employeeId: string;
    date: Date;
    icCardIn?: Date;
    icCardOut?: Date;
    icCardDeviceId?: string;
    pcLogin?: Date;
    pcLogout?: Date;
    pcDeviceId?: string;
    selfReportedIn?: Date;
    selfReportedOut?: Date;
  }): Promise<string> {
    const id = `OBJ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO objective_time_records (
          id, employee_id, record_date,
          ic_card_in, ic_card_out, ic_card_device_id,
          pc_login, pc_logout, pc_device_id,
          self_reported_in, self_reported_out,
          discrepancy_detected, discrepancy_minutes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      // 乖離チェック
      const discrepancy = this.checkTimeDiscrepancy(record);
      
      this.db.run(sql, [
        id,
        record.employeeId,
        record.date.toISOString().split('T')[0],
        record.icCardIn?.toISOString(),
        record.icCardOut?.toISOString(),
        record.icCardDeviceId,
        record.pcLogin?.toISOString(),
        record.pcLogout?.toISOString(),
        record.pcDeviceId,
        record.selfReportedIn?.toISOString(),
        record.selfReportedOut?.toISOString(),
        discrepancy.detected ? 1 : 0,
        discrepancy.minutes
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 法定休憩時間の自動計算
   */
  calculateRequiredBreak(workHours: number): number {
    if (workHours > 8) {
      return 60; // 8時間超は1時間以上
    } else if (workHours > 6) {
      return 45; // 6時間超は45分以上
    }
    return 0;
  }

  /**
   * 複雑な割増率計算（重複適用対応）
   */
  calculateComprehensivePremiums(workTime: {
    regularHours: number;
    overtimeHours: number;
    lateNightHours: number;
    holidayHours: number;
    isStatutoryHoliday: boolean;
    monthlyOvertimeTotal: number;
  }): {
    regularPay: number;
    overtimePremium: number;
    lateNightPremium: number;
    holidayPremium: number;
    highOvertimePremium: number;
    totalPremiumRate: number;
  } {
    const baseRate = 1.0;
    let overtimePremium = 0;
    let lateNightPremium = 0;
    let holidayPremium = 0;
    let highOvertimePremium = 0;

    // 基本時間外労働（25%増）
    if (workTime.overtimeHours > 0) {
      overtimePremium = workTime.overtimeHours * 0.25;
    }

    // 月60時間超の高割増（50%増）
    if (workTime.monthlyOvertimeTotal > 60) {
      const highOvertimeHours = Math.min(workTime.overtimeHours, workTime.monthlyOvertimeTotal - 60);
      highOvertimePremium = highOvertimeHours * 0.25; // 25% → 50%への差額
    }

    // 深夜労働（25%増）
    if (workTime.lateNightHours > 0) {
      lateNightPremium = workTime.lateNightHours * 0.25;
    }

    // 休日労働（35%増）
    if (workTime.holidayHours > 0) {
      if (workTime.isStatutoryHoliday) {
        holidayPremium = workTime.holidayHours * 0.35; // 法定休日
      } else {
        holidayPremium = workTime.holidayHours * 0.25; // 所定休日（時間外扱い）
      }
    }

    // 重複適用の計算
    // 深夜 + 時間外 = 50%増 (25% + 25%)
    // 深夜 + 休日 = 60%増 (25% + 35%)
    const totalPremiumRate = baseRate + overtimePremium + lateNightPremium + holidayPremium + highOvertimePremium;

    return {
      regularPay: workTime.regularHours * baseRate,
      overtimePremium,
      lateNightPremium,
      holidayPremium,
      highOvertimePremium,
      totalPremiumRate
    };
  }

  /**
   * 36協定アラート生成
   */
  async generateComplianceAlert(alert: {
    employeeId: string;
    alertType: string;
    alertLevel: 'info' | 'warning' | 'critical' | 'emergency';
    message: string;
    currentHours: number;
    limitHours: number;
  }): Promise<string> {
    const id = `ALERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO compliance_alerts (
          id, employee_id, alert_type, alert_level, target_period,
          current_hours, limit_hours, message, auto_generated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      this.db.run(sql, [
        id,
        alert.employeeId,
        alert.alertType,
        alert.alertLevel,
        currentMonth,
        alert.currentHours,
        alert.limitHours,
        alert.message,
        1
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 有給休暇残高取得
   */
  async getLeaveBalance(employeeId: string, leaveType: string): Promise<LeaveBalance> {
    const currentYear = new Date().getFullYear();
    
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM leave_balances 
        WHERE employee_id = ? AND leave_type = ? AND year = ?
      `;

      this.db.get(sql, [employeeId, leaveType, currentYear], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          // デフォルト残高を返す
          resolve({
            id: 0,
            employeeId,
            leaveType: leaveType as LeaveType,
            year: currentYear,
            grantedDays: 0,
            usedDays: 0,
            remainingDays: 0,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        } else {
          resolve({
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
          });
        }
      });
    });
  }

  /**
   * 健康確保措置の記録
   */
  async recordHealthCheckMeasure(record: {
    employeeId: string;
    checkType: 'medical_interview' | 'health_questionnaire' | 'stress_check' | 'work_load_review';
    overtimeHours: number;
    doctorName?: string;
    healthStatus?: 'good' | 'caution' | 'requires_attention' | 'requires_treatment';
    recommendations?: string;
  }): Promise<string> {
    const id = `HEALTH_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO health_check_records (
          id, employee_id, check_date, check_type, trigger_reason,
          overtime_hours, doctor_name, health_status, recommendations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const triggerReason = record.overtimeHours >= 100 ? '月100時間超' : '月80時間超';
      
      this.db.run(sql, [
        id,
        record.employeeId,
        new Date().toISOString().split('T')[0],
        record.checkType,
        triggerReason,
        record.overtimeHours,
        record.doctorName,
        record.healthStatus,
        record.recommendations
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * コンプライアンスレポート生成
   */
  async generateComplianceReport(params: {
    startDate: Date;
    endDate: Date;
    department?: string;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          e.id,
          e.name,
          e.department,
          COUNT(DISTINCT tr.date) as work_days,
          COALESCE(SUM(
            CASE 
              WHEN (julianday(tr.clock_out) - julianday(tr.clock_in)) * 24 - (tr.break_minutes / 60.0) > 8 
              THEN (julianday(tr.clock_out) - julianday(tr.clock_in)) * 24 - (tr.break_minutes / 60.0) - 8
              ELSE 0 
            END
          ), 0) as total_overtime_hours,
          COALESCE(SUM(
            CASE 
              WHEN tr.break_minutes < CASE 
                WHEN (julianday(tr.clock_out) - julianday(tr.clock_in)) * 24 > 8 THEN 60
                WHEN (julianday(tr.clock_out) - julianday(tr.clock_in)) * 24 > 6 THEN 45
                ELSE 0
              END
              THEN 1 ELSE 0
            END
          ), 0) as break_violations,
          COUNT(ca.id) as total_alerts
        FROM employees e
        LEFT JOIN time_records tr ON e.id = tr.employee_id 
          AND tr.date BETWEEN ? AND ?
          AND tr.clock_out IS NOT NULL
        LEFT JOIN compliance_alerts ca ON e.id = ca.employee_id
          AND DATE(ca.created_at) BETWEEN ? AND ?
        WHERE e.is_active = 1
        ${params.department ? 'AND e.department = ?' : ''}
        GROUP BY e.id, e.name, e.department
        ORDER BY total_overtime_hours DESC
      `;
      
      const queryParams = [
        params.startDate.toISOString().split('T')[0],
        params.endDate.toISOString().split('T')[0],
        params.startDate.toISOString().split('T')[0],
        params.endDate.toISOString().split('T')[0]
      ];
      
      if (params.department) {
        queryParams.push(params.department);
      }
      
      this.db.all(sql, queryParams, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const report = {
            reportPeriod: {
              startDate: params.startDate,
              endDate: params.endDate,
              department: params.department
            },
            summary: {
              totalEmployees: rows.length,
              complianceViolations: rows.filter(r => r.total_overtime_hours > 45).length,
              breakViolations: rows.reduce((sum, r) => sum + r.break_violations, 0),
              totalAlerts: rows.reduce((sum, r) => sum + r.total_alerts, 0)
            },
            employeeDetails: rows.map(row => ({
              employeeId: row.id,
              name: row.name,
              department: row.department,
              workDays: row.work_days,
              overtimeHours: row.total_overtime_hours,
              complianceStatus: row.total_overtime_hours <= 45 ? 'compliant' : 'exceeded',
              breakViolations: row.break_violations,
              alertsCount: row.total_alerts
            }))
          };
          resolve(report);
        }
      });
    });
  }

  // v2.0.0 Human Capital Disclosure System Methods
  
  /**
   * 従業員ライフサイクル段階の管理
   */
  async createEmployeeLifecycleStage(stage: {
    employeeId: string;
    stage: 'pre_hire' | 'onboarding' | 'active' | 'performance_review' | 'transition' | 'offboarding';
    startDate: Date;
    endDate?: Date;
    responsibleManager?: string;
    checklistData?: any;
    notes?: string;
  }): Promise<string> {
    const id = `LIFECYCLE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO employee_lifecycle_stages (
          id, employee_id, stage, start_date, end_date, 
          responsible_manager, checklist_data, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        stage.employeeId,
        stage.stage,
        stage.startDate.toISOString().split('T')[0],
        stage.endDate?.toISOString().split('T')[0] || null,
        stage.responsibleManager || null,
        stage.checklistData ? JSON.stringify(stage.checklistData) : null,
        stage.notes || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * オンボーディング計画の作成
   */
  async createOnboardingPlan(plan: {
    employeeId: string;
    planType: 'standard' | 'manager' | 'executive' | 'intern';
    departmentSpecificItems?: any;
    durationWeeks?: number;
    mentorId?: string;
    hrContactId?: string;
  }): Promise<string> {
    const id = `ONBOARD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO onboarding_plans (
          id, employee_id, plan_type, department_specific_items,
          duration_weeks, mentor_id, hr_contact_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        plan.employeeId,
        plan.planType,
        plan.departmentSpecificItems ? JSON.stringify(plan.departmentSpecificItems) : null,
        plan.durationWeeks || 4,
        plan.mentorId || null,
        plan.hrContactId || null,
        'active'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 人事評価の作成
   */
  async createPerformanceEvaluation(evaluation: {
    employeeId: string;
    evaluatorId: string;
    evaluationPeriod: string;
    evaluationType: 'annual' | 'semi_annual' | 'quarterly' | 'probation' | 'special';
    overallRating?: number;
    performanceMetrics?: any;
    strengths?: string;
    areasForImprovement?: string;
    developmentGoals?: string;
    careerAdvancementRecommendation?: string;
  }): Promise<string> {
    const id = `EVAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO performance_evaluations (
          id, employee_id, evaluator_id, evaluation_period, evaluation_type,
          overall_rating, performance_metrics, strengths, areas_for_improvement,
          development_goals, career_advancement_recommendation, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        evaluation.employeeId,
        evaluation.evaluatorId,
        evaluation.evaluationPeriod,
        evaluation.evaluationType,
        evaluation.overallRating || null,
        evaluation.performanceMetrics ? JSON.stringify(evaluation.performanceMetrics) : null,
        evaluation.strengths || null,
        evaluation.areasForImprovement || null,
        evaluation.developmentGoals || null,
        evaluation.careerAdvancementRecommendation || null,
        'draft'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 人材プロファイルの作成・更新
   */
  async upsertTalentProfile(profile: {
    employeeId: string;
    careerLevel: 'entry' | 'junior' | 'mid' | 'senior' | 'expert' | 'leadership';
    coreCompetencies?: any;
    technicalSkills?: any;
    softSkills?: any;
    careerAspirations?: string;
    mobilityPreferences?: any;
    performanceTrend?: 'improving' | 'stable' | 'declining';
    potentialRating?: 'high' | 'medium' | 'low';
    retentionRisk?: 'low' | 'medium' | 'high';
    successionReadiness?: 'ready_now' | 'ready_1_year' | 'ready_2_years' | 'not_ready';
  }): Promise<string> {
    const id = `TALENT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO talent_profiles (
          id, employee_id, career_level, core_competencies, technical_skills,
          soft_skills, career_aspirations, mobility_preferences, performance_trend,
          potential_rating, retention_risk, succession_readiness, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(sql, [
        id,
        profile.employeeId,
        profile.careerLevel,
        profile.coreCompetencies ? JSON.stringify(profile.coreCompetencies) : null,
        profile.technicalSkills ? JSON.stringify(profile.technicalSkills) : null,
        profile.softSkills ? JSON.stringify(profile.softSkills) : null,
        profile.careerAspirations || null,
        profile.mobilityPreferences ? JSON.stringify(profile.mobilityPreferences) : null,
        profile.performanceTrend || 'stable',
        profile.potentialRating || 'medium',
        profile.retentionRisk || 'low',
        profile.successionReadiness || 'not_ready'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 研修コース受講登録
   */
  async enrollInCourse(enrollment: {
    employeeId: string;
    courseId: string;
    enrollmentDate: Date;
    targetCompletionDate?: Date;
  }): Promise<string> {
    const id = `ENROLL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO course_enrollments (
          id, employee_id, course_id, enrollment_date, target_completion_date, status
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        enrollment.employeeId,
        enrollment.courseId,
        enrollment.enrollmentDate.toISOString().split('T')[0],
        enrollment.targetCompletionDate?.toISOString().split('T')[0] || null,
        'enrolled'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 研修進捗の更新
   */
  async updateCourseProgress(enrollmentId: string, progress: {
    status?: 'enrolled' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
    completionPercentage?: number;
    finalScore?: number;
    certificationEarned?: boolean;
    actualCompletionDate?: Date;
    feedback?: string;
  }): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let sql = `UPDATE course_enrollments SET updated_at = CURRENT_TIMESTAMP`;
      const params: any[] = [];
      
      if (progress.status) {
        sql += `, status = ?`;
        params.push(progress.status);
      }
      
      if (progress.completionPercentage !== undefined) {
        sql += `, completion_percentage = ?`;
        params.push(progress.completionPercentage);
      }
      
      if (progress.finalScore !== undefined) {
        sql += `, final_score = ?`;
        params.push(progress.finalScore);
      }
      
      if (progress.certificationEarned !== undefined) {
        sql += `, certification_earned = ?`;
        params.push(progress.certificationEarned ? 1 : 0);
      }
      
      if (progress.actualCompletionDate) {
        sql += `, actual_completion_date = ?`;
        params.push(progress.actualCompletionDate.toISOString().split('T')[0]);
      }
      
      if (progress.feedback) {
        sql += `, feedback = ?`;
        params.push(progress.feedback);
      }
      
      sql += ` WHERE id = ?`;
      params.push(enrollmentId);
      
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * スキルアセスメントの記録
   */
  async recordSkillsAssessment(assessment: {
    employeeId: string;
    assessmentType: 'self_assessment' | 'manager_assessment' | 'peer_assessment' | 'external_assessment';
    skillCategory: 'technical' | 'leadership' | 'communication' | 'problem_solving' | 'teamwork';
    skillItems: any;
    overallScore: number;
    assessmentDate: Date;
    assessorId?: string;
    notes?: string;
  }): Promise<string> {
    const id = `SKILL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO skills_assessments (
          id, employee_id, assessment_type, skill_category, skill_items,
          overall_score, assessment_date, assessor_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        assessment.employeeId,
        assessment.assessmentType,
        assessment.skillCategory,
        JSON.stringify(assessment.skillItems),
        assessment.overallScore,
        assessment.assessmentDate.toISOString().split('T')[0],
        assessment.assessorId || null,
        assessment.notes || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 従業員エンゲージメント調査の回答記録
   */
  async recordSurveyResponse(response: {
    surveyId: string;
    employeeId: string;
    responses: any;
    responseDate: Date;
    overallSatisfaction: number;
  }): Promise<string> {
    const id = `RESPONSE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO survey_responses (
          id, survey_id, employee_id, responses, response_date, overall_satisfaction
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        response.surveyId,
        response.employeeId,
        JSON.stringify(response.responses),
        response.responseDate.toISOString().split('T')[0],
        response.overallSatisfaction
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 人的資本指標の記録
   */
  async recordHumanCapitalMetric(metric: {
    metricName: string;
    metricCategory: 'workforce' | 'costs' | 'productivity' | 'engagement' | 'diversity' | 'skills' | 'recruitment' | 'retention';
    metricValue: number;
    metricUnit: string;
    calculationMethod: string;
    reportingPeriod: string;
    benchmarkValue?: number;
    isIso30414Compliant?: boolean;
  }): Promise<string> {
    const id = `METRIC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO human_capital_metrics (
          id, metric_name, metric_category, metric_value, metric_unit,
          calculation_method, reporting_period, benchmark_value, is_iso30414_compliant
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        metric.metricName,
        metric.metricCategory,
        metric.metricValue,
        metric.metricUnit,
        metric.calculationMethod,
        metric.reportingPeriod,
        metric.benchmarkValue || null,
        metric.isIso30414Compliant ? 1 : 0
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 多様性指標の記録
   */
  async recordDiversityMetric(metric: {
    metricType: 'gender' | 'age' | 'nationality' | 'disability' | 'education' | 'tenure';
    categoryBreakdown: any;
    leadershipRepresentation: any;
    payEquityMetrics: any;
    reportingPeriod: string;
  }): Promise<string> {
    const id = `DIVERSITY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO diversity_metrics (
          id, metric_type, category_breakdown, leadership_representation,
          pay_equity_metrics, reporting_period
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        metric.metricType,
        JSON.stringify(metric.categoryBreakdown),
        JSON.stringify(metric.leadershipRepresentation),
        JSON.stringify(metric.payEquityMetrics),
        metric.reportingPeriod
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }

  /**
   * 人的資本指標の取得
   */
  async getHumanCapitalMetrics(reportingPeriod: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM human_capital_metrics 
        WHERE reporting_period = ?
        ORDER BY metric_category, metric_name
      `;
      
      this.db.all(sql, [reportingPeriod], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const metrics = rows.map(row => ({
            id: row.id,
            metricName: row.metric_name,
            metricCategory: row.metric_category,
            metricValue: row.metric_value,
            metricUnit: row.metric_unit,
            calculationMethod: row.calculation_method,
            reportingPeriod: row.reporting_period,
            benchmarkValue: row.benchmark_value,
            isIso30414Compliant: row.is_iso30414_compliant === 1,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          }));
          resolve(metrics);
        }
      });
    });
  }

  /**
   * 従業員の包括的プロファイル取得
   */
  async getEmployeeComprehensiveProfile(employeeId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          e.*,
          tp.career_level,
          tp.core_competencies,
          tp.technical_skills,
          tp.soft_skills,
          tp.performance_trend,
          tp.potential_rating,
          tp.retention_risk,
          tp.succession_readiness,
          COUNT(DISTINCT ce.id) as total_courses,
          COUNT(DISTINCT CASE WHEN ce.status = 'completed' THEN ce.id END) as completed_courses,
          AVG(CASE WHEN pe.overall_rating IS NOT NULL THEN pe.overall_rating END) as avg_performance_rating,
          AVG(CASE WHEN sr.overall_satisfaction IS NOT NULL THEN sr.overall_satisfaction END) as avg_engagement_score
        FROM employees e
        LEFT JOIN talent_profiles tp ON e.id = tp.employee_id
        LEFT JOIN course_enrollments ce ON e.id = ce.employee_id
        LEFT JOIN performance_evaluations pe ON e.id = pe.employee_id
        LEFT JOIN survey_responses sr ON e.id = sr.employee_id
        WHERE e.id = ?
        GROUP BY e.id
      `;
      
      this.db.get(sql, [employeeId], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve({
            employee: {
              id: row.id,
              name: row.name,
              department: row.department,
              position: row.position,
              hourlyRate: row.hourly_rate,
              joinDate: new Date(row.join_date),
              managerId: row.manager_id,
              isActive: row.is_active === 1
            },
            talentProfile: {
              careerLevel: row.career_level,
              coreCompetencies: row.core_competencies ? JSON.parse(row.core_competencies) : null,
              technicalSkills: row.technical_skills ? JSON.parse(row.technical_skills) : null,
              softSkills: row.soft_skills ? JSON.parse(row.soft_skills) : null,
              performanceTrend: row.performance_trend,
              potentialRating: row.potential_rating,
              retentionRisk: row.retention_risk,
              successionReadiness: row.succession_readiness
            },
            trainingMetrics: {
              totalCourses: row.total_courses || 0,
              completedCourses: row.completed_courses || 0,
              completionRate: row.total_courses > 0 ? (row.completed_courses / row.total_courses) * 100 : 0
            },
            performanceMetrics: {
              averageRating: row.avg_performance_rating || null,
              averageEngagementScore: row.avg_engagement_score || null
            }
          });
        }
      });
    });
  }

  // v2.0.0 人的資本開示対応メソッド群
  
  /**
   * 人的資本指標の算出・記録
   */
  async calculateHumanCapitalMetrics(reportingPeriod: string): Promise<any> {
    const metrics = {
      workforce: await this.calculateWorkforceMetrics(reportingPeriod),
      diversity: await this.calculateDiversityMetrics(reportingPeriod),
      skills: await this.calculateSkillsMetrics(reportingPeriod),
      engagement: await this.calculateEngagementMetrics(reportingPeriod),
      development: await this.calculateDevelopmentMetrics(reportingPeriod),
      performance: await this.calculatePerformanceMetrics(reportingPeriod),
      health_safety: await this.calculateHealthSafetyMetrics(reportingPeriod),
      compliance: await this.calculateComplianceMetrics(reportingPeriod)
    };
    
    // 計算結果をデータベースに保存
    for (const [category, categoryMetrics] of Object.entries(metrics)) {
      for (const [metricName, value] of Object.entries(categoryMetrics as any)) {
        await this.saveHumanCapitalMetric({
          metricName,
          metricCategory: category,
          metricValue: value as number,
          reportingPeriod,
          calculatedAt: new Date()
        });
      }
    }
    
    return metrics;
  }
  
  /**
   * 労働力構成指標の算出
   */
  private async calculateWorkforceMetrics(reportingPeriod: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_employees,
          COUNT(CASE WHEN employment_type = 'full_time' THEN 1 END) as full_time_employees,
          COUNT(CASE WHEN employment_type = 'part_time' THEN 1 END) as part_time_employees,
          COUNT(CASE WHEN employment_type = 'contract' THEN 1 END) as contract_employees,
          AVG(CASE WHEN age IS NOT NULL THEN age END) as average_age,
          AVG(CASE WHEN join_date IS NOT NULL THEN 
            (julianday('now') - julianday(join_date)) / 365.25 
          END) as average_tenure_years
        FROM employees 
        WHERE is_active = 1
      `;
      
      this.db.get(sql, [], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            total_employees: row.total_employees || 0,
            full_time_ratio: row.total_employees > 0 ? (row.full_time_employees / row.total_employees) * 100 : 0,
            part_time_ratio: row.total_employees > 0 ? (row.part_time_employees / row.total_employees) * 100 : 0,
            contract_ratio: row.total_employees > 0 ? (row.contract_employees / row.total_employees) * 100 : 0,
            average_age: row.average_age || 0,
            average_tenure_years: row.average_tenure_years || 0
          });
        }
      });
    });
  }
  
  /**
   * 多様性指標の算出
   */
  private async calculateDiversityMetrics(reportingPeriod: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_employees,
          COUNT(CASE WHEN gender = 'female' THEN 1 END) as female_employees,
          COUNT(CASE WHEN gender = 'male' THEN 1 END) as male_employees,
          COUNT(CASE WHEN gender = 'female' AND manager_id IS NOT NULL THEN 1 END) as female_managers,
          COUNT(CASE WHEN manager_id IS NOT NULL THEN 1 END) as total_managers,
          COUNT(DISTINCT nationality) as nationality_diversity,
          COUNT(CASE WHEN disability_status IS NOT NULL AND disability_status != 'none' THEN 1 END) as employees_with_disabilities
        FROM employees 
        WHERE is_active = 1
      `;
      
      this.db.get(sql, [], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            gender_diversity_ratio: row.total_employees > 0 ? (row.female_employees / row.total_employees) * 100 : 0,
            female_leadership_ratio: row.total_managers > 0 ? (row.female_managers / row.total_managers) * 100 : 0,
            nationality_diversity_count: row.nationality_diversity || 0,
            disability_inclusion_ratio: row.total_employees > 0 ? (row.employees_with_disabilities / row.total_employees) * 100 : 0
          });
        }
      });
    });
  }
  
  /**
   * スキル指標の算出
   */
  private async calculateSkillsMetrics(reportingPeriod: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(DISTINCT employee_id) as employees_with_skills,
          COUNT(DISTINCT skill_id) as total_unique_skills,
          AVG(skill_level) as average_skill_level,
          COUNT(CASE WHEN skill_level >= 4 THEN 1 END) as expert_level_skills,
          COUNT(*) as total_skill_records
        FROM employee_skills
      `;
      
      this.db.get(sql, [], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            skill_coverage_ratio: row.employees_with_skills || 0,
            unique_skills_count: row.total_unique_skills || 0,
            average_skill_level: row.average_skill_level || 0,
            expert_skills_ratio: row.total_skill_records > 0 ? (row.expert_level_skills / row.total_skill_records) * 100 : 0
          });
        }
      });
    });
  }
  
  /**
   * エンゲージメント指標の算出
   */
  private async calculateEngagementMetrics(reportingPeriod: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(DISTINCT employee_id) as survey_respondents,
          AVG(overall_satisfaction) as average_satisfaction,
          AVG(engagement_score) as average_engagement,
          AVG(enps_score) as average_enps,
          COUNT(CASE WHEN enps_score >= 9 THEN 1 END) as promoters,
          COUNT(CASE WHEN enps_score <= 6 THEN 1 END) as detractors,
          COUNT(*) as total_responses
        FROM survey_responses
        WHERE strftime('%Y-%m', response_date) = ?
      `;
      
      this.db.get(sql, [reportingPeriod], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          const eNPS = row.total_responses > 0 ? 
            ((row.promoters - row.detractors) / row.total_responses) * 100 : 0;
          
          resolve({
            survey_participation_rate: row.survey_respondents || 0,
            average_satisfaction_score: row.average_satisfaction || 0,
            average_engagement_score: row.average_engagement || 0,
            employee_net_promoter_score: eNPS
          });
        }
      });
    });
  }
  
  /**
   * 育成・研修指標の算出
   */
  private async calculateDevelopmentMetrics(reportingPeriod: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(DISTINCT employee_id) as employees_trained,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_trainings,
          COUNT(*) as total_training_enrollments,
          AVG(final_score) as average_training_score,
          SUM(CASE WHEN completion_date IS NOT NULL THEN 
            (julianday(completion_date) - julianday(start_date)) 
          END) as total_training_days
        FROM training_history th
        JOIN training_courses tc ON th.course_id = tc.course_id
        WHERE strftime('%Y-%m', th.enrollment_date) = ?
      `;
      
      this.db.get(sql, [reportingPeriod], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            training_participation_rate: row.employees_trained || 0,
            training_completion_rate: row.total_training_enrollments > 0 ? 
              (row.completed_trainings / row.total_training_enrollments) * 100 : 0,
            average_training_score: row.average_training_score || 0,
            total_training_hours: row.total_training_days ? row.total_training_days * 8 : 0
          });
        }
      });
    });
  }
  
  /**
   * パフォーマンス指標の算出
   */
  private async calculatePerformanceMetrics(reportingPeriod: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(DISTINCT employee_id) as evaluated_employees,
          AVG(overall_rating) as average_performance_rating,
          AVG(performance_score) as average_performance_score,
          COUNT(CASE WHEN retention_risk_level = 'high' THEN 1 END) as high_risk_employees,
          COUNT(CASE WHEN promotion_readiness IN ('ready', 'ready_soon') THEN 1 END) as promotion_ready_employees,
          COUNT(*) as total_evaluations
        FROM performance_evaluations
        WHERE evaluation_period = ?
      `;
      
      this.db.get(sql, [reportingPeriod], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            performance_evaluation_coverage: row.evaluated_employees || 0,
            average_performance_rating: row.average_performance_rating || 0,
            high_performer_ratio: row.total_evaluations > 0 ? 
              (row.promotion_ready_employees / row.total_evaluations) * 100 : 0,
            retention_risk_ratio: row.total_evaluations > 0 ? 
              (row.high_risk_employees / row.total_evaluations) * 100 : 0
          });
        }
      });
    });
  }
  
  /**
   * 健康・安全指標の算出
   */
  private async calculateHealthSafetyMetrics(reportingPeriod: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_incidents,
          COUNT(CASE WHEN severity_level = 'critical' THEN 1 END) as critical_incidents,
          COUNT(CASE WHEN medical_treatment_required = 1 THEN 1 END) as medical_treatment_cases,
          SUM(lost_time_hours) as total_lost_time_hours,
          COUNT(CASE WHEN incident_type = 'workplace_injury' THEN 1 END) as workplace_injuries
        FROM health_safety_incidents
        WHERE strftime('%Y-%m', incident_date) = ?
      `;
      
      this.db.get(sql, [reportingPeriod], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            total_safety_incidents: row.total_incidents || 0,
            critical_incidents_count: row.critical_incidents || 0,
            workplace_injury_rate: row.workplace_injuries || 0,
            lost_time_injury_rate: row.total_lost_time_hours || 0
          });
        }
      });
    });
  }
  
  /**
   * コンプライアンス指標の算出
   */
  private async calculateComplianceMetrics(reportingPeriod: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_compliance_incidents,
          COUNT(CASE WHEN incident_type = 'harassment' THEN 1 END) as harassment_cases,
          COUNT(CASE WHEN incident_type = 'discrimination' THEN 1 END) as discrimination_cases,
          COUNT(CASE WHEN incident_type = 'ethics_violation' THEN 1 END) as ethics_violations,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_cases
        FROM compliance_incidents
        WHERE strftime('%Y-%m', report_date) = ?
      `;
      
      this.db.get(sql, [reportingPeriod], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            compliance_incidents_count: row.total_compliance_incidents || 0,
            harassment_incident_rate: row.harassment_cases || 0,
            discrimination_incident_rate: row.discrimination_cases || 0,
            ethics_violation_rate: row.ethics_violations || 0,
            case_resolution_rate: row.total_compliance_incidents > 0 ? 
              (row.resolved_cases / row.total_compliance_incidents) * 100 : 0
          });
        }
      });
    });
  }
  
  /**
   * 人的資本指標の保存
   */
  private async saveHumanCapitalMetric(metric: {
    metricName: string;
    metricCategory: string;
    metricValue: number;
    reportingPeriod: string;
    calculatedAt: Date;
  }): Promise<string> {
    const id = `METRIC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO human_capital_metrics (
          metric_id, metric_name, metric_category, metric_value, 
          reporting_period, calculation_method, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        id,
        metric.metricName,
        metric.metricCategory,
        metric.metricValue,
        metric.reportingPeriod,
        'システム自動計算',
        metric.calculatedAt.toISOString()
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(id);
        }
      });
    });
  }
  
  /**
   * 人的資本開示レポートの生成
   */
  async generateHumanCapitalDisclosureReport(reportingPeriod: string): Promise<any> {
    const metrics = await this.calculateHumanCapitalMetrics(reportingPeriod);
    
    return {
      reportingPeriod,
      generatedAt: new Date(),
      disclosure: {
        workforce_composition: {
          total_employees: metrics.workforce.total_employees,
          employment_type_breakdown: {
            full_time_ratio: metrics.workforce.full_time_ratio,
            part_time_ratio: metrics.workforce.part_time_ratio,
            contract_ratio: metrics.workforce.contract_ratio
          },
          demographics: {
            average_age: metrics.workforce.average_age,
            average_tenure: metrics.workforce.average_tenure_years
          }
        },
        diversity_inclusion: {
          gender_diversity: {
            female_ratio: metrics.diversity.gender_diversity_ratio,
            female_leadership_ratio: metrics.diversity.female_leadership_ratio
          },
          cultural_diversity: {
            nationality_count: metrics.diversity.nationality_diversity_count
          },
          disability_inclusion: {
            inclusion_ratio: metrics.diversity.disability_inclusion_ratio
          }
        },
        skills_capabilities: {
          skill_coverage: metrics.skills.skill_coverage_ratio,
          average_skill_level: metrics.skills.average_skill_level,
          expert_skills_ratio: metrics.skills.expert_skills_ratio
        },
        engagement_culture: {
          satisfaction_score: metrics.engagement.average_satisfaction_score,
          engagement_score: metrics.engagement.average_engagement_score,
          net_promoter_score: metrics.engagement.employee_net_promoter_score
        },
        development_training: {
          participation_rate: metrics.development.training_participation_rate,
          completion_rate: metrics.development.training_completion_rate,
          total_training_hours: metrics.development.total_training_hours
        },
        performance_management: {
          evaluation_coverage: metrics.performance.performance_evaluation_coverage,
          average_rating: metrics.performance.average_performance_rating,
          retention_risk: metrics.performance.retention_risk_ratio
        },
        health_safety: {
          safety_incidents: metrics.health_safety.total_safety_incidents,
          injury_rate: metrics.health_safety.workplace_injury_rate,
          lost_time_rate: metrics.health_safety.lost_time_injury_rate
        },
        compliance_ethics: {
          compliance_incidents: metrics.compliance.compliance_incidents_count,
          resolution_rate: metrics.compliance.case_resolution_rate
        }
      },
      iso30414_compliance: {
        covered_areas: [
          'workforce_composition',
          'diversity_inclusion',
          'skills_capabilities',
          'engagement_culture',
          'development_training',
          'performance_management',
          'health_safety',
          'compliance_ethics'
        ],
        compliance_percentage: 100
      }
    };
  }

  // プライベートヘルパーメソッド

  private calculateWarningLevel(overtimeHours: number): 'safe' | 'caution' | 'warning' | 'critical' {
    if (overtimeHours >= 45) return 'critical';
    if (overtimeHours >= 36) return 'warning';  // 80%
    if (overtimeHours >= 27) return 'caution';  // 60%
    return 'safe';
  }

  private checkTimeDiscrepancy(record: any): {detected: boolean, minutes: number} {
    let maxDiscrepancy = 0;
    
    // ICカードと自己申告の比較
    if (record.icCardIn && record.selfReportedIn) {
      const diffIn = Math.abs(
        (record.icCardIn.getTime() - record.selfReportedIn.getTime()) / (1000 * 60)
      );
      maxDiscrepancy = Math.max(maxDiscrepancy, diffIn);
    }
    
    if (record.icCardOut && record.selfReportedOut) {
      const diffOut = Math.abs(
        (record.icCardOut.getTime() - record.selfReportedOut.getTime()) / (1000 * 60)
      );
      maxDiscrepancy = Math.max(maxDiscrepancy, diffOut);
    }
    
    return {
      detected: maxDiscrepancy > 15, // 15分以上の乖離で検知
      minutes: Math.round(maxDiscrepancy)
    };
  }
}

export default Database;

// Export for initialization
export async function initializeDatabase(): Promise<void> {
  const db = new Database();
  await db.initializeDatabase();
  await db.close();
}