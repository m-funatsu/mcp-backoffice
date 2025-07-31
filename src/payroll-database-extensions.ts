import type { Employee, BankAccount, TaxInfo, EmployeeAllowance, EmployeeDeduction } from './types.js';
import Database from './database.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Type guard for database row objects
interface DatabaseRow {
  [key: string]: unknown;
}

function isRecord(value: unknown): value is DatabaseRow {
  return typeof value === 'object' && value !== null;
}

function getStringField(row: DatabaseRow, field: string): string | undefined {
  const value = row[field];
  return typeof value === 'string' ? value : undefined;
}

function getNumberField(row: DatabaseRow, field: string): number | undefined {
  const value = row[field];
  return typeof value === 'number' ? value : undefined;
}

function getBooleanField(row: DatabaseRow, field: string): boolean {
  const value = row[field];
  return value === 1 || value === true;
}

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
      
      this.db.exec(schema).then(() => {
        console.error('Payroll schema extensions initialized successfully');
        resolve();
      }).catch((err: unknown) => {
        // Check if error is due to column already existing
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('duplicate column name') || errorMessage.includes('already exists')) {
          console.error('Payroll schema extensions already exist, skipping initialization');
          resolve();
        } else {
          console.error('Error initializing payroll schema:', err);
          reject(err);
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
      let paramIndex = 1;

      if (updates.employeeNumber !== undefined) {
        fields.push(`employee_number = $${paramIndex}`);
        values.push(updates.employeeNumber);
        paramIndex++;
      }
      if (updates.socialInsuranceNumber !== undefined) {
        fields.push(`social_insurance_number = $${paramIndex}`);
        values.push(updates.socialInsuranceNumber);
        paramIndex++;
      }
      if (updates.contractType !== undefined) {
        fields.push(`contract_type = $${paramIndex}`);
        values.push(updates.contractType);
        paramIndex++;
      }
      if (updates.salaryType !== undefined) {
        fields.push(`salary_type = $${paramIndex}`);
        values.push(updates.salaryType);
        paramIndex++;
      }
      if (updates.baseSalary !== undefined) {
        fields.push(`base_salary = $${paramIndex}`);
        values.push(updates.baseSalary);
        paramIndex++;
      }

      if (fields.length === 0) {
        resolve();
        return;
      }

      const sql = `UPDATE employees SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
      values.push(employeeId);

      this.db.run(sql, values).then(() => {
        resolve();
      }).catch((err: unknown) => {
        reject(err);
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
        INSERT INTO employee_bank_accounts (
          employee_id, bank_name, branch_name, account_type, 
          account_number, account_holder_name, is_primary
        ) VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        ON CONFLICT (employee_id) DO UPDATE SET
          bank_name = $2,
          branch_name = $3,
          account_type = $4,
          account_number = $5,
          account_holder_name = $6,
          is_primary = TRUE
      `;

      this.db.run(sql, [
        employeeId,
        bankAccount.bankName,
        bankAccount.branchName,
        bankAccount.accountType,
        bankAccount.accountNumber,
        bankAccount.accountHolderName
      ]).then(() => {
        resolve();
      }).catch((err: unknown) => {
        reject(err);
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
        INSERT INTO employee_tax_info (
          employee_id, dependents, tax_rate, is_disabled, 
          is_single_parent, has_spouse_deduction, effective_from
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
        ON CONFLICT (employee_id) DO UPDATE SET
          dependents = $2,
          tax_rate = $3,
          is_disabled = $4,
          is_single_parent = $5,
          has_spouse_deduction = $6,
          effective_from = CURRENT_DATE
      `;

      this.db.run(sql, [
        employeeId,
        taxInfo.dependents,
        taxInfo.taxRate,
        taxInfo.isDisabled ? 1 : 0,
        taxInfo.isSingleParent ? 1 : 0,
        taxInfo.hasSpouseDeduction ? 1 : 0
      ]).then(() => {
        resolve();
      }).catch((err: unknown) => {
        reject(err);
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      this.db.run(sql, [
        employeeId,
        allowance.type,
        allowance.description,
        allowance.amount,
        allowance.isFixed ? 1 : 0,
        allowance.effectiveFrom.toISOString().split('T')[0],
        allowance.effectiveTo ? allowance.effectiveTo.toISOString().split('T')[0] : null
      ]).then(() => {
        resolve();
      }).catch((err: unknown) => {
        reject(err);
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;

      this.db.run(sql, [
        employeeId,
        deduction.type,
        deduction.description,
        deduction.amount,
        deduction.isFixed ? 1 : 0,
        deduction.effectiveFrom.toISOString().split('T')[0],
        deduction.effectiveTo ? deduction.effectiveTo.toISOString().split('T')[0] : null
      ]).then(() => {
        resolve();
      }).catch((err: unknown) => {
        reject(err);
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

  private async getEmployeeExtendedFields(employeeId: string): Promise<{
    employee_number?: string;
    social_insurance_number?: string;
    contract_type?: 'full_time' | 'part_time' | 'contract' | 'temporary';
    salary_type?: 'hourly' | 'monthly' | 'annual';
    base_salary?: number;
  }> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT employee_number, social_insurance_number, contract_type, salary_type, base_salary
        FROM employees WHERE id = $1
      `;

      this.db.get(sql, [employeeId]).then((row: unknown) => {
        if (!row || !isRecord(row)) {
          resolve({});
          return;
        }
        resolve({
          employee_number: getStringField(row, 'employee_number'),
          social_insurance_number: getStringField(row, 'social_insurance_number'),
          contract_type: getStringField(row, 'contract_type') as 'full_time' | 'part_time' | 'contract' | 'temporary' | undefined,
          salary_type: getStringField(row, 'salary_type') as 'hourly' | 'monthly' | 'annual' | undefined,
          base_salary: getNumberField(row, 'base_salary')
        });
      }).catch((err: unknown) => {
        reject(err);
      });
    });
  }

  private async getEmployeeBankAccount(employeeId: string): Promise<BankAccount | undefined> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM employee_bank_accounts 
        WHERE employee_id = $1 AND is_primary = TRUE 
        ORDER BY created_at DESC LIMIT 1
      `;

      this.db.get(sql, [employeeId]).then((row: unknown) => {
        if (!row || !isRecord(row)) {
          resolve(undefined);
        } else {
          resolve({
            bankName: getStringField(row, 'bank_name') || '',
            branchName: getStringField(row, 'branch_name') || '',
            accountType: getStringField(row, 'account_type') as 'checking' | 'savings' | undefined,
            accountNumber: getStringField(row, 'account_number') || '',
            accountHolderName: getStringField(row, 'account_holder_name') || ''
          });
        }
      }).catch((err: unknown) => {
        reject(err);
      });
    });
  }

  private async getEmployeeTaxInfo(employeeId: string): Promise<TaxInfo | undefined> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM employee_tax_info 
        WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      `;

      this.db.get(sql, [employeeId]).then((row: unknown) => {
        if (!row || !isRecord(row)) {
          resolve(undefined);
        } else {
          resolve({
            dependents: getNumberField(row, 'dependents') || 0,
            taxRate: getNumberField(row, 'tax_rate') || 0,
            isDisabled: getBooleanField(row, 'is_disabled'),
            isSingleParent: getBooleanField(row, 'is_single_parent'),
            hasSpouseDeduction: getBooleanField(row, 'has_spouse_deduction')
          });
        }
      }).catch((err: unknown) => {
        reject(err);
      });
    });
  }

  private async getEmployeeAllowances(employeeId: string): Promise<EmployeeAllowance[]> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM employee_allowances 
        WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
        ORDER BY effective_from DESC
      `;

      this.db.all(sql, [employeeId]).then((rows: unknown[]) => {
        if (!Array.isArray(rows)) {
          resolve([]);
          return;
        }
        const allowances = rows.filter(isRecord).map(row => ({
          type: getStringField(row, 'type') || '',
          description: getStringField(row, 'description') || '',
          amount: getNumberField(row, 'amount') || 0,
          isFixed: getBooleanField(row, 'is_fixed'),
          effectiveFrom: new Date(getStringField(row, 'effective_from') || Date.now()),
          effectiveTo: getStringField(row, 'effective_to') ? new Date(getStringField(row, 'effective_to')!) : undefined
        }));
        resolve(allowances);
      }).catch((err: unknown) => {
        reject(err);
      });
    });
  }

  private async getEmployeeDeductions(employeeId: string): Promise<EmployeeDeduction[]> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM employee_deductions 
        WHERE employee_id = $1 AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
        ORDER BY effective_from DESC
      `;

      this.db.all(sql, [employeeId]).then((rows: unknown[]) => {
        if (!Array.isArray(rows)) {
          resolve([]);
          return;
        }
        const deductions = rows.filter(isRecord).map(row => ({
          type: getStringField(row, 'type') || '',
          description: getStringField(row, 'description') || '',
          amount: getNumberField(row, 'amount') || 0,
          isFixed: getBooleanField(row, 'is_fixed'),
          effectiveFrom: new Date(getStringField(row, 'effective_from') || Date.now()),
          effectiveTo: getStringField(row, 'effective_to') ? new Date(getStringField(row, 'effective_to')!) : undefined
        }));
        resolve(deductions);
      }).catch((err: unknown) => {
        reject(err);
      });
    });
  }

  /**
   * 社会保険料率の取得
   * Get social insurance rates for calculation
   */
  async getSocialInsuranceRates(year: number = new Date().getFullYear()): Promise<{
    health_insurance_rate: number;
    pension_insurance_rate: number;
    unemployment_insurance_rate: number;
    long_term_care_insurance_rate: number;
    workers_compensation_rate: number;
  }> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM social_insurance_rates 
        WHERE year = $1 AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
        ORDER BY effective_from DESC LIMIT 1
      `;

      this.db.get(sql, [year]).then((row: unknown) => {
        if (!row || !isRecord(row)) {
          resolve({
            health_insurance_rate: 0.0991,
            pension_insurance_rate: 0.183,
            unemployment_insurance_rate: 0.006,
            long_term_care_insurance_rate: 0.0123,
            workers_compensation_rate: 0.003
          });
        } else {
          resolve({
            health_insurance_rate: getNumberField(row, 'health_insurance_rate') || 0.0991,
            pension_insurance_rate: getNumberField(row, 'pension_insurance_rate') || 0.183,
            unemployment_insurance_rate: getNumberField(row, 'unemployment_insurance_rate') || 0.006,
            long_term_care_insurance_rate: getNumberField(row, 'long_term_care_insurance_rate') || 0.0123,
            workers_compensation_rate: getNumberField(row, 'workers_compensation_rate') || 0.003
          });
        }
      }).catch((err: unknown) => {
        reject(err);
      });
    });
  }

  /**
   * 所得税率の取得
   * Get income tax brackets for calculation
   */
  async getTaxBrackets(year: number = new Date().getFullYear()): Promise<Array<{
    min_income: number;
    max_income: number | null;
    tax_rate: number;
    deduction: number;
  }>> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM tax_brackets 
        WHERE year = $1 AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
        ORDER BY min_income ASC
      `;

      this.db.all(sql, [year]).then((rows: unknown[]) => {
        if (!Array.isArray(rows)) {
          resolve([]);
          return;
        }
        const brackets = rows.filter(isRecord).map(row => ({
          min_income: getNumberField(row, 'min_income') || 0,
          max_income: getNumberField(row, 'max_income') || null,
          tax_rate: getNumberField(row, 'tax_rate') || 0,
          deduction: getNumberField(row, 'deduction') || 0
        }));
        resolve(brackets);
      }).catch((err: unknown) => {
        reject(err);
      });
    });
  }
}