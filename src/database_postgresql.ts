import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Employee, TimeRecord, PayrollCalculation, PayrollRules, AttendanceReport } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabasePostgreSQL {
  private client: Client;

  constructor() {
    this.client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'attendance_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      console.log('Connected to PostgreSQL database');
    } catch (err) {
      console.error('Error connecting to database:', err);
      throw err;
    }
  }

  async initializeDatabase(): Promise<void> {
    try {
      const schemaPath = join(__dirname, '..', 'schema_postgresql.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      await this.client.query(schema);
      console.log('Database initialized successfully');
    } catch (err) {
      console.error('Error initializing database:', err);
      throw err;
    }
  }

  async addEmployee(employee: Omit<Employee, 'id'>): Promise<string> {
    const id = `EMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const sql = `
      INSERT INTO employees (id, name, department, position, hourly_rate, join_date, manager_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await this.client.query(sql, [
      id,
      employee.name,
      employee.department,
      employee.position,
      employee.hourlyRate,
      employee.joinDate.toISOString().split('T')[0],
      employee.managerId || null,
      employee.isActive
    ]);
    
    return id;
  }

  async getEmployee(id: string): Promise<Employee | null> {
    const sql = `SELECT * FROM employees WHERE id = $1`;
    
    const result = await this.client.query(sql, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      department: row.department,
      position: row.position,
      hourlyRate: parseFloat(row.hourly_rate),
      joinDate: new Date(row.join_date),
      managerId: row.manager_id,
      isActive: row.is_active
    };
  }

  async getAllEmployees(): Promise<Employee[]> {
    const sql = `SELECT * FROM employees WHERE is_active = true ORDER BY name`;
    
    const result = await this.client.query(sql);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      department: row.department,
      position: row.position,
      hourlyRate: parseFloat(row.hourly_rate),
      joinDate: new Date(row.join_date),
      managerId: row.manager_id,
      isActive: row.is_active
    }));
  }

  async clockIn(employeeId: string, clockInTime: Date, recordType: 'ic_card' | 'pc_log' | 'manual' = 'manual'): Promise<string> {
    const recordId = `TR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const dateStr = clockInTime.toISOString().split('T')[0];
    
    const sql = `
      INSERT INTO time_records (id, employee_id, date, clock_in, record_type)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    await this.client.query(sql, [
      recordId,
      employeeId,
      dateStr,
      clockInTime.toISOString(),
      recordType
    ]);
    
    return recordId;
  }

  async clockOut(employeeId: string, clockOutTime: Date, breakMinutes: number = 0): Promise<boolean> {
    const dateStr = clockOutTime.toISOString().split('T')[0];
    
    const sql = `
      UPDATE time_records 
      SET clock_out = $1, break_minutes = $2, updated_at = CURRENT_TIMESTAMP
      WHERE employee_id = $3 AND date = $4 AND clock_out IS NULL
    `;
    
    const result = await this.client.query(sql, [
      clockOutTime.toISOString(),
      breakMinutes,
      employeeId,
      dateStr
    ]);
    
    return (result.rowCount || 0) > 0;
  }

  async getTimeRecords(employeeId: string, startDate: Date, endDate: Date): Promise<TimeRecord[]> {
    const sql = `
      SELECT * FROM time_records 
      WHERE employee_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date DESC
    `;
    
    const result = await this.client.query(sql, [
      employeeId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ]);
    
    return result.rows.map(row => ({
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
  }

  async savePayrollCalculation(calculation: PayrollCalculation): Promise<void> {
    const sql = `
      INSERT INTO payroll_calculations (
        id, employee_id, month, regular_hours, overtime_hours, late_night_hours, holiday_hours,
        regular_pay, overtime_pay, late_night_pay, holiday_pay, total_pay, calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (employee_id, month) DO UPDATE SET
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
    `;
    
    const id = `PAY_${calculation.employeeId}_${calculation.month}`;
    
    await this.client.query(sql, [
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
    ]);
  }

  async getPayrollCalculation(employeeId: string, month: string): Promise<PayrollCalculation | null> {
    const sql = `SELECT * FROM payroll_calculations WHERE employee_id = $1 AND month = $2`;
    
    const result = await this.client.query(sql, [employeeId, month]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      employeeId: row.employee_id,
      month: row.month,
      regularHours: parseFloat(row.regular_hours),
      overtimeHours: parseFloat(row.overtime_hours),
      lateNightHours: parseFloat(row.late_night_hours),
      holidayHours: parseFloat(row.holiday_hours),
      regularPay: parseFloat(row.regular_pay),
      overtimePay: parseFloat(row.overtime_pay),
      lateNightPay: parseFloat(row.late_night_pay),
      holidayPay: parseFloat(row.holiday_pay),
      totalPay: parseFloat(row.total_pay),
      calculatedAt: new Date(row.calculated_at)
    };
  }

  async getPayrollRules(): Promise<PayrollRules> {
    const sql = `
      SELECT * FROM payroll_rules 
      WHERE effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
      ORDER BY effective_from DESC
      LIMIT 1
    `;
    
    const result = await this.client.query(sql);
    
    if (result.rows.length === 0) {
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
    
    const row = result.rows[0];
    return {
      regularHoursPerDay: parseFloat(row.regular_hours_per_day),
      regularHoursPerWeek: parseFloat(row.regular_hours_per_week),
      breakMinutesFor6Hours: row.break_minutes_for_6_hours,
      breakMinutesFor8Hours: row.break_minutes_for_8_hours,
      overtimeRate: parseFloat(row.overtime_rate),
      lateNightRate: parseFloat(row.late_night_rate),
      holidayRate: parseFloat(row.holiday_rate),
      highOvertimeRate: parseFloat(row.high_overtime_rate),
      lateNightStart: row.late_night_start,
      lateNightEnd: row.late_night_end,
      monthlyOvertimeLimit: parseFloat(row.monthly_overtime_limit),
      yearlyOvertimeLimit: parseFloat(row.yearly_overtime_limit),
      highOvertimeThreshold: parseFloat(row.high_overtime_threshold)
    };
  }

  async isHoliday(date: Date): Promise<boolean> {
    const dateStr = date.toISOString().split('T')[0];
    const sql = `SELECT COUNT(*) as count FROM holidays WHERE date = $1`;
    
    const result = await this.client.query(sql, [dateStr]);
    
    return parseInt(result.rows[0].count) > 0;
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

export default DatabasePostgreSQL;

// Export for initialization
export async function initializeDatabase(): Promise<void> {
  const db = new DatabasePostgreSQL();
  await db.connect();
  await db.initializeDatabase();
  await db.close();
}