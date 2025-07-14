import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Employee, TimeRecord, PayrollCalculation, PayrollRules, AttendanceReport } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Database {
  private db: sqlite3.Database;

  constructor(dbPath: string = 'attendance.db') {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
      }
    });
  }

  async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const schemaPath = join(__dirname, '..', 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      this.db.exec(schema, (err) => {
        if (err) {
          // Check if error is due to table already existing - this is acceptable for tests
          if (err.message.includes('already exists')) {
            console.log('Database tables already exist, skipping initialization');
            resolve();
          } else {
            console.error('Error initializing database:', err);
            reject(err);
          }
        } else {
          console.log('Database initialized successfully');
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

  async clockOut(employeeId: string, clockOutTime: Date, breakMinutes: number = 0): Promise<boolean> {
    const dateStr = clockOutTime.toISOString().split('T')[0];
    
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE time_records 
        SET clock_out = ?, break_minutes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = ? AND date = ? AND clock_out IS NULL
      `;
      
      this.db.run(sql, [
        clockOutTime.toISOString(),
        breakMinutes,
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
}

export default Database;

// Export for initialization
export async function initializeDatabase(): Promise<void> {
  const db = new Database();
  await db.initializeDatabase();
  await db.close();
}