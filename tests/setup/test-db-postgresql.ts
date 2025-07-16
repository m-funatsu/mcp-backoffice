import { Database } from '../../src/database.js';

// Test database configuration for PostgreSQL
const TEST_DB_CONFIG = {
  connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/attendance_test',
  ssl: false
};

export class TestDatabase extends Database {
  constructor() {
    super(TEST_DB_CONFIG.connectionString);
  }

  async setupTestDatabase(): Promise<void> {
    await this.connect();
    await this.initializeDatabase();
  }

  async cleanupTestDatabase(): Promise<void> {
    // Clean up test data
    await this.db.query('TRUNCATE TABLE payroll_calculations CASCADE');
    await this.db.query('TRUNCATE TABLE time_records CASCADE');
    await this.db.query('TRUNCATE TABLE employees CASCADE');
    await this.db.query('TRUNCATE TABLE expense_requests CASCADE');
    await this.db.query('TRUNCATE TABLE leave_requests CASCADE');
    await this.db.query('TRUNCATE TABLE leave_balances CASCADE');
    await this.db.query('TRUNCATE TABLE compliance_alerts CASCADE');
    await this.db.query('TRUNCATE TABLE labor_hours_summary CASCADE');
    await this.db.query('TRUNCATE TABLE human_capital_metrics CASCADE');
    await this.db.query('TRUNCATE TABLE diversity_information CASCADE');
    await this.db.query('TRUNCATE TABLE employee_skills CASCADE');
    await this.db.query('TRUNCATE TABLE training_records CASCADE');
    await this.db.query('TRUNCATE TABLE performance_evaluations CASCADE');
    await this.db.query('TRUNCATE TABLE engagement_surveys CASCADE');
    await this.db.query('TRUNCATE TABLE health_safety_records CASCADE');
    await this.db.query('TRUNCATE TABLE compliance_records CASCADE');
    await this.db.query('TRUNCATE TABLE employee_extensions CASCADE');
    await this.db.query('TRUNCATE TABLE organization_hierarchy CASCADE');
    await this.db.query('TRUNCATE TABLE payroll_history CASCADE');
    await this.db.query('TRUNCATE TABLE objective_records CASCADE');
    await this.db.query('TRUNCATE TABLE break_records CASCADE');
    await this.disconnect();
  }
}

export const createTestDatabase = () => new TestDatabase();