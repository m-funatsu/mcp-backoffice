import type { Employee, BankAccount, TaxInfo, EmployeeAllowance, EmployeeDeduction } from './types.js';
import Database from './database.js';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 給与計算システム用データベース拡張機能
 * Database Extensions for Payroll Calculation System
 */
export class PayrollDatabaseExtensions {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * 給与計算用スキーマの初期化
   * Initialize payroll-specific database schema
   */
  async initializePayrollSchema(): Promise<void> {
    return new Promise((resolve, reject) => {
      const schemaPath = join(__dirname, '..', 'sql', 'payroll-extensions.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      this.db['db'].exec(schema, (err) => {
        if (err) {
          // Check if error is due to column already existing
          if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
            console.error('Payroll schema extensions already exist, skipping initialization');
            resolve();
          } else {
            console.error('Error initializing payroll schema:', err);
            reject(err);
          }
        } else {
          console.error('Payroll schema extensions initialized successfully');
          resolve();
        }
      });
    });
  }

  /**
   * 拡張従業員情報の更新
   * Update extended employee information
   */
  async updateEmployeeExtendedInfo(
    employeeId: string, 
    updates: {
      employeeNumber?: string;
      socialInsuranceNumber?: string;
      contractType?: 'full_time' | 'part_time' | 'contract' | 'temporary';
      salaryType?: 'hourly' | 'monthly' | 'annual';
      baseSalary?: number;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];

      if (updates.employeeNumber !== undefined) {
        fields.push('employee_number = ?');
        values.push(updates.employeeNumber);
      }
      if (updates.socialInsuranceNumber !== undefined) {
        fields.push('social_insurance_number = ?');
        values.push(updates.socialInsuranceNumber);
      }
      if (updates.contractType !== undefined) {
        fields.push('contract_type = ?');
        values.push(updates.contractType);
      }
      if (updates.salaryType !== undefined) {
        fields.push('salary_type = ?');
        values.push(updates.salaryType);
      }
      if (updates.baseSalary !== undefined) {
        fields.push('base_salary = ?');
        values.push(updates.baseSalary);
      }

      if (fields.length === 0) {
        resolve();
        return;
      }

      const sql = `UPDATE employees SET ${fields.join(', ')} WHERE id = ?`;
      values.push(employeeId);

      this.db['db'].run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 銀行口座情報の設定
   * Set employee bank account information
   */
  async setEmployeeBankAccount(employeeId: string, bankAccount: BankAccount): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO employee_bank_accounts (
          employee_id, bank_name, branch_name, account_type, 
          account_number, account_holder_name, is_primary
        ) VALUES (?, ?, ?, ?, ?, ?, TRUE)
      `;

      this.db['db'].run(sql, [
        employeeId,
        bankAccount.bankName,
        bankAccount.branchName,
        bankAccount.accountType,
        bankAccount.accountNumber,
        bankAccount.accountHolderName
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 税務情報の設定
   * Set employee tax information
   */
  async setEmployeeTaxInfo(employeeId: string, taxInfo: TaxInfo): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO employee_tax_info (
          employee_id, dependents, tax_rate, is_disabled, 
          is_single_parent, has_spouse_deduction, effective_from
        ) VALUES (?, ?, ?, ?, ?, ?, DATE('now'))
      `;

      this.db['db'].run(sql, [
        employeeId,
        taxInfo.dependents,
        taxInfo.taxRate,
        taxInfo.isDisabled ? 1 : 0,
        taxInfo.isSingleParent ? 1 : 0,
        taxInfo.hasSpouseDeduction ? 1 : 0
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 従業員手当の追加
   * Add employee allowance
   */
  async addEmployeeAllowance(employeeId: string, allowance: EmployeeAllowance): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO employee_allowances (
          employee_id, type, description, amount, is_fixed, effective_from, effective_to
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.db['db'].run(sql, [
        employeeId,
        allowance.type,
        allowance.description,
        allowance.amount,
        allowance.isFixed ? 1 : 0,
        allowance.effectiveFrom.toISOString().split('T')[0],
        allowance.effectiveTo ? allowance.effectiveTo.toISOString().split('T')[0] : null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 従業員控除の追加
   * Add employee deduction
   */
  async addEmployeeDeduction(employeeId: string, deduction: EmployeeDeduction): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO employee_deductions (
          employee_id, type, description, amount, is_fixed, effective_from, effective_to
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.db['db'].run(sql, [
        employeeId,
        deduction.type,
        deduction.description,
        deduction.amount,
        deduction.isFixed ? 1 : 0,
        deduction.effectiveFrom.toISOString().split('T')[0],
        deduction.effectiveTo ? deduction.effectiveTo.toISOString().split('T')[0] : null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 拡張従業員情報の取得
   * Get extended employee information
   */
  async getExtendedEmployee(employeeId: string): Promise<Employee | null> {
    const baseEmployee = await this.db.getEmployee(employeeId);
    if (!baseEmployee) {
      return null;
    }

    // Get extended fields
    const extendedInfo = await this.getEmployeeExtendedFields(employeeId);
    const bankAccount = await this.getEmployeeBankAccount(employeeId);
    const taxInfo = await this.getEmployeeTaxInfo(employeeId);
    const allowances = await this.getEmployeeAllowances(employeeId);
    const deductions = await this.getEmployeeDeductions(employeeId);

    return {
      ...baseEmployee,
      employeeNumber: extendedInfo.employeeNumber,
      socialInsuranceNumber: extendedInfo.socialInsuranceNumber,
      contractType: extendedInfo.contractType || 'full_time',
      salaryType: extendedInfo.salaryType || 'hourly',
      baseSalary: extendedInfo.baseSalary,
      bankAccount,
      taxInfo,
      allowances,
      deductions
    };
  }

  private async getEmployeeExtendedFields(employeeId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT employee_number, social_insurance_number, contract_type, salary_type, base_salary
        FROM employees WHERE id = ?
      `;

      this.db['db'].get(sql, [employeeId], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {});
        }
      });
    });
  }

  private async getEmployeeBankAccount(employeeId: string): Promise<BankAccount | undefined> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM employee_bank_accounts 
        WHERE employee_id = ? AND is_primary = TRUE 
        ORDER BY created_at DESC LIMIT 1
      `;

      this.db['db'].get(sql, [employeeId], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(undefined);
        } else {
          resolve({
            bankName: row.bank_name,
            branchName: row.branch_name,
            accountType: row.account_type,
            accountNumber: row.account_number,
            accountHolderName: row.account_holder_name
          });
        }
      });
    });
  }

  private async getEmployeeTaxInfo(employeeId: string): Promise<TaxInfo | undefined> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM employee_tax_info 
        WHERE employee_id = ? AND (effective_to IS NULL OR effective_to > DATE('now'))
        ORDER BY effective_from DESC LIMIT 1
      `;

      this.db['db'].get(sql, [employeeId], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(undefined);
        } else {
          resolve({
            dependents: row.dependents,
            taxRate: row.tax_rate,
            isDisabled: row.is_disabled === 1,
            isSingleParent: row.is_single_parent === 1,
            hasSpouseDeduction: row.has_spouse_deduction === 1
          });
        }
      });
    });
  }

  private async getEmployeeAllowances(employeeId: string): Promise<EmployeeAllowance[]> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM employee_allowances 
        WHERE employee_id = ? AND (effective_to IS NULL OR effective_to > DATE('now'))
        ORDER BY effective_from DESC
      `;

      this.db['db'].all(sql, [employeeId], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const allowances = rows.map(row => ({
            type: row.type,
            description: row.description,
            amount: row.amount,
            isFixed: row.is_fixed === 1,
            effectiveFrom: new Date(row.effective_from),
            effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined
          }));
          resolve(allowances);
        }
      });
    });
  }

  private async getEmployeeDeductions(employeeId: string): Promise<EmployeeDeduction[]> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM employee_deductions 
        WHERE employee_id = ? AND (effective_to IS NULL OR effective_to > DATE('now'))
        ORDER BY effective_from DESC
      `;

      this.db['db'].all(sql, [employeeId], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const deductions = rows.map(row => ({
            type: row.type,
            description: row.description,
            amount: row.amount,
            isFixed: row.is_fixed === 1,
            effectiveFrom: new Date(row.effective_from),
            effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined
          }));
          resolve(deductions);
        }
      });
    });
  }

  /**
   * 社会保険料率の取得
   * Get social insurance rates for calculation
   */
  async getSocialInsuranceRates(year: number = new Date().getFullYear()): Promise<any> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM social_insurance_rates 
        WHERE year = ? AND (effective_to IS NULL OR effective_to > DATE('now'))
        ORDER BY effective_from DESC LIMIT 1
      `;

      this.db['db'].get(sql, [year], (err, row: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {
            health_insurance_rate: 0.0991,
            pension_insurance_rate: 0.183,
            unemployment_insurance_rate: 0.006,
            long_term_care_insurance_rate: 0.0123,
            workers_compensation_rate: 0.003
          });
        }
      });
    });
  }

  /**
   * 所得税率の取得
   * Get income tax brackets for calculation
   */
  async getTaxBrackets(year: number = new Date().getFullYear()): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tax_brackets 
        WHERE year = ? AND (effective_to IS NULL OR effective_to > DATE('now'))
        ORDER BY min_income ASC
      `;

      this.db['db'].all(sql, [year], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}