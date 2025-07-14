#!/usr/bin/env tsx

import sqlite3 from 'sqlite3';
import { Client } from 'pg';
import { promisify } from 'util';

// SQLite database connection
const sqliteDb = new sqlite3.Database('attendance.db');
const sqliteGet = promisify(sqliteDb.get.bind(sqliteDb));
const sqliteAll = promisify(sqliteDb.all.bind(sqliteDb));

// PostgreSQL database connection
const pgClient = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'attendance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function migrateData() {
  try {
    console.log('Starting data migration from SQLite to PostgreSQL...');
    
    // Connect to PostgreSQL
    await pgClient.connect();
    console.log('Connected to PostgreSQL');
    
    // Migrate employees
    console.log('Migrating employees...');
    const employees = await sqliteAll('SELECT * FROM employees') as any[];
    
    for (const emp of employees) {
      await pgClient.query(`
        INSERT INTO employees (id, name, department, position, hourly_rate, join_date, manager_id, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
      `, [
        emp.id,
        emp.name,
        emp.department,
        emp.position,
        emp.hourly_rate,
        emp.join_date,
        emp.manager_id,
        emp.is_active === 1,
        emp.created_at,
        emp.updated_at
      ]);
    }
    console.log(`Migrated ${employees.length} employees`);
    
    // Migrate time records
    console.log('Migrating time records...');
    const timeRecords = await sqliteAll('SELECT * FROM time_records') as any[];
    
    for (const record of timeRecords) {
      await pgClient.query(`
        INSERT INTO time_records (id, employee_id, date, clock_in, clock_out, break_minutes, record_type, notes, approved_by, approved_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `, [
        record.id,
        record.employee_id,
        record.date,
        record.clock_in,
        record.clock_out,
        record.break_minutes,
        record.record_type,
        record.notes,
        record.approved_by,
        record.approved_at,
        record.created_at,
        record.updated_at
      ]);
    }
    console.log(`Migrated ${timeRecords.length} time records`);
    
    // Migrate payroll calculations
    console.log('Migrating payroll calculations...');
    const payrollCalculations = await sqliteAll('SELECT * FROM payroll_calculations') as any[];
    
    for (const calc of payrollCalculations) {
      await pgClient.query(`
        INSERT INTO payroll_calculations (id, employee_id, month, regular_hours, overtime_hours, late_night_hours, holiday_hours, regular_pay, overtime_pay, late_night_pay, holiday_pay, total_pay, calculated_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      `, [
        calc.id,
        calc.employee_id,
        calc.month,
        calc.regular_hours,
        calc.overtime_hours,
        calc.late_night_hours,
        calc.holiday_hours,
        calc.regular_pay,
        calc.overtime_pay,
        calc.late_night_pay,
        calc.holiday_pay,
        calc.total_pay,
        calc.calculated_at,
        calc.created_at
      ]);
    }
    console.log(`Migrated ${payrollCalculations.length} payroll calculations`);
    
    // Migrate attendance violations
    console.log('Migrating attendance violations...');
    const violations = await sqliteAll('SELECT * FROM attendance_violations') as any[];
    
    for (const violation of violations) {
      await pgClient.query(`
        INSERT INTO attendance_violations (id, employee_id, violation_type, violation_date, description, severity, resolved, resolved_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
      `, [
        violation.id,
        violation.employee_id,
        violation.violation_type,
        violation.violation_date,
        violation.description,
        violation.severity,
        violation.resolved === 1,
        violation.resolved_at,
        violation.created_at
      ]);
    }
    console.log(`Migrated ${violations.length} attendance violations`);
    
    console.log('Data migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close connections
    sqliteDb.close();
    await pgClient.end();
  }
}

// Run migration
migrateData().catch(console.error);