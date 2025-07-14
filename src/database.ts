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