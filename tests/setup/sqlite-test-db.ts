import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SQLiteTestDatabase {
  private db: Database.Database;

  constructor() {
    this.db = new Database(':memory:');
  }

  async connect(): Promise<void> {
    // SQLiteはファイルベースなので接続処理は不要
    console.log('Connected to SQLite in-memory database');
  }

  async disconnect(): Promise<void> {
    this.db.close();
    console.log('Disconnected from SQLite database');
  }

  async initializeDatabase(): Promise<void> {
    try {
      // SQLite用のスキーマを作成
      this.createTables();
      console.log('SQLite test database initialized successfully');
    } catch (err) {
      console.error('Error initializing SQLite test database:', err);
      throw err;
    }
  }

  private createTables(): void {
    // 従業員テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT,
        position TEXT,
        hourly_rate REAL,
        start_date DATE,
        manager_id TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 時間記録テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS time_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        date DATE NOT NULL,
        clock_in TIMESTAMP,
        clock_out TIMESTAMP,
        break_duration INTEGER DEFAULT 0,
        record_type TEXT CHECK (record_type IN ('manual', 'card', 'auto')) DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 給与計算テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS payroll_calculations (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        calculation_date DATE NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        regular_hours REAL DEFAULT 0,
        overtime_hours REAL DEFAULT 0,
        late_night_hours REAL DEFAULT 0,
        holiday_hours REAL DEFAULT 0,
        regular_pay REAL DEFAULT 0,
        overtime_pay REAL DEFAULT 0,
        late_night_pay REAL DEFAULT 0,
        holiday_pay REAL DEFAULT 0,
        total_pay REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 休暇管理テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS leave_balances (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        leave_type TEXT NOT NULL,
        total_days REAL DEFAULT 0,
        used_days REAL DEFAULT 0,
        remaining_days REAL DEFAULT 0,
        year INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 人的資本情報テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS human_capital_metrics (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        metric_value REAL,
        metric_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);

    // 多様性情報テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS diversity_information (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        gender TEXT,
        age INTEGER,
        nationality TEXT,
        disability_status TEXT,
        education_level TEXT,
        employment_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
      )
    `);
  }

  // 基本的なデータベース操作メソッド
  async addEmployee(employee: any): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO employees (id, name, department, position, hourly_rate, start_date, manager_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      employee.id,
      employee.name,
      employee.department,
      employee.position,
      employee.hourlyRate,
      employee.startDate,
      employee.managerId,
      employee.isActive ? 1 : 0
    );
  }

  async getEmployee(id: string): Promise<any> {
    const stmt = this.db.prepare('SELECT * FROM employees WHERE id = ?');
    return stmt.get(id);
  }

  async getAllEmployees(): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * FROM employees');
    return stmt.all();
  }

  async cleanup(): Promise<void> {
    // テーブルをクリア
    this.db.exec('DELETE FROM payroll_calculations');
    this.db.exec('DELETE FROM time_records');
    this.db.exec('DELETE FROM leave_balances');
    this.db.exec('DELETE FROM human_capital_metrics');
    this.db.exec('DELETE FROM diversity_information');
    this.db.exec('DELETE FROM employees');
  }
}

export const createTestDatabase = () => new SQLiteTestDatabase();