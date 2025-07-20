import { DatabasePostgreSQL } from '../../src/database_postgresql.js';

/**
 * テスト用データベースアダプター
 * DatabasePostgreSQLインターフェースをComplianceEngineが期待する形式に変換
 */
export class TestDatabaseAdapter {
  constructor(private db: DatabasePostgreSQL) {}

  async get(sql: string, params: any[] = []): Promise<any> {
    const result = await this.db.query(sql, params);
    return result.rows?.[0] || null;
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    const result = await this.db.query(sql, params);
    return result.rows || [];
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    await this.db.query(sql, params);
    return { lastID: 0, changes: 1 };
  }

  // DatabasePostgreSQLのメソッドをプロキシ
  async getEmployee(id: string) {
    return this.db.getEmployee?.(id);
  }

  async getAllEmployees() {
    return this.db.getAllEmployees?.();
  }

  async getTimeRecords(employeeId: string, startDate?: Date, endDate?: Date) {
    return this.db.getTimeRecords?.(employeeId, startDate, endDate);
  }

  async getAllTimeRecords(startDate?: Date, endDate?: Date) {
    return this.db.getAllTimeRecords?.(startDate, endDate);
  }

  async getObjectiveTimeRecords(employeeId: string, startDate?: Date, endDate?: Date) {
    return this.db.getObjectiveTimeRecords?.(employeeId, startDate, endDate);
  }

  async getExpenseRequests(employeeId?: string, status?: string) {
    return this.db.getExpenseRequests?.(employeeId, status);
  }

  async getAllExpenseRequests(status?: string) {
    return this.db.getAllExpenseRequests?.(status);
  }

  async getPayrollCalculations(employeeId: string, startMonth?: string, endMonth?: string) {
    return this.db.getPayrollCalculations?.(employeeId, startMonth, endMonth);
  }

  async getAllPayrollCalculations(month?: string) {
    return this.db.getAllPayrollCalculations?.(month);
  }

  async getPayrollRules() {
    return this.db.getPayrollRules?.() || {
      regularHoursPerDay: 8,
      regularHoursPerWeek: 40,
      overtimeRate: 1.25,
      lateNightRate: 1.25,
      holidayRate: 1.35,
      highOvertimeRate: 1.50
    };
  }

  async query(sql: string, params: any[] = []) {
    return this.db.query(sql, params);
  }

  async beginTransaction() {
    return this.db.beginTransaction?.();
  }

  async commitTransaction() {
    return this.db.commitTransaction?.();
  }

  async rollbackTransaction() {
    return this.db.rollbackTransaction?.();
  }
}