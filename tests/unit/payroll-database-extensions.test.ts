import { describe, test, expect, beforeEach } from 'vitest';
import { PayrollDatabaseExtensions } from '../../src/payroll-database-extensions.js';
import Database from '../../src/database.js';
import type { Employee, BankAccount, TaxInfo, EmployeeAllowance, EmployeeDeduction } from '../../src/types.js';

describe.skip('PayrollDatabaseExtensions', () => {
  let database: Database;
  let payrollExtensions: PayrollDatabaseExtensions;
  let testEmployee: Employee;

  beforeEach(async () => {
    database = new Database(':memory:');
    await database.initializeDatabase();
    
    payrollExtensions = new PayrollDatabaseExtensions(database);
    await payrollExtensions.initializePayrollSchema();
    
    // Create test employee
    const employeeId = await database.addEmployee({
      name: '給与太郎',
      department: '開発部',
      position: 'シニアエンジニア',
      hourlyRate: 4000,
      joinDate: new Date('2023-04-01'),
      isActive: true,
      contractType: 'full_time',
      salaryType: 'monthly'
    });

    testEmployee = await database.getEmployee(employeeId) as Employee;
  });

  describe('Schema Initialization', () => {
    test('should initialize payroll schema successfully', async () => {
      // This test passes if beforeEach completes without error
      expect(payrollExtensions).toBeDefined();
    });

    test('should handle duplicate schema initialization gracefully', async () => {
      // Should not throw error when schema already exists
      await expect(payrollExtensions.initializePayrollSchema()).resolves.not.toThrow();
    });
  });

  describe('Extended Employee Information', () => {
    test('should update employee extended information', async () => {
      const updates = {
        employeeNumber: 'EMP-2024-001',
        socialInsuranceNumber: '12345-67890',
        contractType: 'full_time' as const,
        salaryType: 'monthly' as const,
        baseSalary: 400000
      };

      await payrollExtensions.updateEmployeeExtendedInfo(testEmployee.id, updates);
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      
      expect(extendedEmployee?.employeeNumber).toBe('EMP-2024-001');
      expect(extendedEmployee?.socialInsuranceNumber).toBe('12345-67890');
      expect(extendedEmployee?.contractType).toBe('full_time');
      expect(extendedEmployee?.salaryType).toBe('monthly');
      expect(extendedEmployee?.baseSalary).toBe(400000);
    });

    test('should handle partial updates', async () => {
      await payrollExtensions.updateEmployeeExtendedInfo(testEmployee.id, {
        employeeNumber: 'EMP-2024-002'
      });

      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      expect(extendedEmployee?.employeeNumber).toBe('EMP-2024-002');
      expect(extendedEmployee?.contractType).toBe('full_time'); // Default value
    });
  });

  describe('Bank Account Management', () => {
    test('should set and retrieve bank account information', async () => {
      const bankAccount: BankAccount = {
        bankName: '三菱UFJ銀行',
        branchName: '東京駅前支店',
        accountType: 'checking',
        accountNumber: '1234567',
        accountHolderName: '給与太郎'
      };

      await payrollExtensions.setEmployeeBankAccount(testEmployee.id, bankAccount);
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      
      expect(extendedEmployee?.bankAccount).toEqual(bankAccount);
    });

    test('should handle savings account type', async () => {
      const bankAccount: BankAccount = {
        bankName: 'みずほ銀行',
        branchName: '新宿支店',
        accountType: 'savings',
        accountNumber: '9876543',
        accountHolderName: '給与太郎'
      };

      await payrollExtensions.setEmployeeBankAccount(testEmployee.id, bankAccount);
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      expect(extendedEmployee?.bankAccount?.accountType).toBe('savings');
    });
  });

  describe('Tax Information Management', () => {
    test('should set and retrieve tax information', async () => {
      const taxInfo: TaxInfo = {
        dependents: 2,
        taxRate: 0.15,
        isDisabled: false,
        isSingleParent: false,
        hasSpouseDeduction: true
      };

      await payrollExtensions.setEmployeeTaxInfo(testEmployee.id, taxInfo);
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      
      expect(extendedEmployee?.taxInfo).toEqual(taxInfo);
    });

    test('should handle special tax circumstances', async () => {
      const taxInfo: TaxInfo = {
        dependents: 3,
        taxRate: 0.10,
        isDisabled: true,
        isSingleParent: true,
        hasSpouseDeduction: false
      };

      await payrollExtensions.setEmployeeTaxInfo(testEmployee.id, taxInfo);
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      expect(extendedEmployee?.taxInfo?.isDisabled).toBe(true);
      expect(extendedEmployee?.taxInfo?.isSingleParent).toBe(true);
      expect(extendedEmployee?.taxInfo?.dependents).toBe(3);
    });
  });

  describe('Employee Allowances', () => {
    test('should add and retrieve transport allowance', async () => {
      const allowance: EmployeeAllowance = {
        type: 'transport',
        description: '交通費',
        amount: 15000,
        isFixed: true,
        effectiveFrom: new Date('2024-01-01')
      };

      await payrollExtensions.addEmployeeAllowance(testEmployee.id, allowance);
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      
      expect(extendedEmployee?.allowances).toHaveLength(1);
      expect(extendedEmployee?.allowances?.[0].type).toBe('transport');
      expect(extendedEmployee?.allowances?.[0].amount).toBe(15000);
    });

    test('should add multiple allowances', async () => {
      const allowances: EmployeeAllowance[] = [
        {
          type: 'transport',
          description: '交通費',
          amount: 15000,
          isFixed: true,
          effectiveFrom: new Date('2024-01-01')
        },
        {
          type: 'housing',
          description: '住宅手当',
          amount: 30000,
          isFixed: true,
          effectiveFrom: new Date('2024-01-01')
        },
        {
          type: 'position',
          description: '役職手当',
          amount: 50000,
          isFixed: true,
          effectiveFrom: new Date('2024-01-01')
        }
      ];

      for (const allowance of allowances) {
        await payrollExtensions.addEmployeeAllowance(testEmployee.id, allowance);
      }
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      
      expect(extendedEmployee?.allowances).toHaveLength(3);
      
      const totalAllowances = extendedEmployee?.allowances?.reduce((sum, a) => sum + a.amount, 0);
      expect(totalAllowances).toBe(95000); // 15000 + 30000 + 50000
    });

    test('should handle temporary allowances with end dates', async () => {
      const allowance: EmployeeAllowance = {
        type: 'qualification',
        description: '資格手当（期間限定）',
        amount: 10000,
        isFixed: true,
        effectiveFrom: new Date('2024-01-01'),
        effectiveTo: new Date('2024-12-31')
      };

      await payrollExtensions.addEmployeeAllowance(testEmployee.id, allowance);
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      expect(extendedEmployee?.allowances?.[0].effectiveTo).toEqual(new Date('2024-12-31'));
    });
  });

  describe('Employee Deductions', () => {
    test('should add and retrieve union fees deduction', async () => {
      const deduction: EmployeeDeduction = {
        type: 'union_fees',
        description: '組合費',
        amount: 3000,
        isFixed: true,
        effectiveFrom: new Date('2024-01-01')
      };

      await payrollExtensions.addEmployeeDeduction(testEmployee.id, deduction);
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      
      expect(extendedEmployee?.deductions).toHaveLength(1);
      expect(extendedEmployee?.deductions?.[0].type).toBe('union_fees');
      expect(extendedEmployee?.deductions?.[0].amount).toBe(3000);
    });

    test('should add multiple deductions', async () => {
      const deductions: EmployeeDeduction[] = [
        {
          type: 'union_fees',
          description: '組合費',
          amount: 3000,
          isFixed: true,
          effectiveFrom: new Date('2024-01-01')
        },
        {
          type: 'company_housing',
          description: '社宅費',
          amount: 20000,
          isFixed: true,
          effectiveFrom: new Date('2024-01-01')
        },
        {
          type: 'insurance',
          description: '団体保険料',
          amount: 5000,
          isFixed: true,
          effectiveFrom: new Date('2024-01-01')
        }
      ];

      for (const deduction of deductions) {
        await payrollExtensions.addEmployeeDeduction(testEmployee.id, deduction);
      }
      
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      
      expect(extendedEmployee?.deductions).toHaveLength(3);
      
      const totalDeductions = extendedEmployee?.deductions?.reduce((sum, d) => sum + d.amount, 0);
      expect(totalDeductions).toBe(28000); // 3000 + 20000 + 5000
    });
  });

  describe('Social Insurance and Tax Rates', () => {
    test('should retrieve current social insurance rates', async () => {
      const rates = await payrollExtensions.getSocialInsuranceRates(2024);
      
      expect(rates.health_insurance_rate).toBe(0.0991);
      expect(rates.pension_insurance_rate).toBe(0.183);
      expect(rates.unemployment_insurance_rate).toBe(0.006);
      expect(rates.long_term_care_insurance_rate).toBe(0.0123);
      expect(rates.workers_compensation_rate).toBe(0.003);
    });

    test('should retrieve tax brackets for income calculation', async () => {
      const brackets = await payrollExtensions.getTaxBrackets(2024);
      
      expect(brackets).toHaveLength(7); // Japanese tax brackets
      expect(brackets[0].min_income).toBe(0);
      expect(brackets[0].tax_rate).toBe(0.05);
      expect(brackets[brackets.length - 1].tax_rate).toBe(0.45); // Highest rate
    });

    test('should handle missing year gracefully', async () => {
      const rates = await payrollExtensions.getSocialInsuranceRates(2030); // Future year
      
      // Should return default values
      expect(rates.health_insurance_rate).toBeDefined();
      expect(rates.pension_insurance_rate).toBeDefined();
    });
  });

  describe('Complete Employee Profile', () => {
    test('should create and retrieve complete employee profile', async () => {
      // Update extended info
      await payrollExtensions.updateEmployeeExtendedInfo(testEmployee.id, {
        employeeNumber: 'EMP-2024-FULL',
        socialInsuranceNumber: '12345-67890',
        contractType: 'full_time',
        salaryType: 'monthly',
        baseSalary: 500000
      });

      // Set bank account
      await payrollExtensions.setEmployeeBankAccount(testEmployee.id, {
        bankName: '三井住友銀行',
        branchName: '渋谷支店',
        accountType: 'checking',
        accountNumber: '1111111',
        accountHolderName: '給与太郎'
      });

      // Set tax info
      await payrollExtensions.setEmployeeTaxInfo(testEmployee.id, {
        dependents: 1,
        taxRate: 0.12,
        isDisabled: false,
        isSingleParent: false,
        hasSpouseDeduction: true
      });

      // Add allowances
      await payrollExtensions.addEmployeeAllowance(testEmployee.id, {
        type: 'transport',
        description: '交通費',
        amount: 20000,
        isFixed: true,
        effectiveFrom: new Date('2024-01-01')
      });

      // Add deductions
      await payrollExtensions.addEmployeeDeduction(testEmployee.id, {
        type: 'union_fees',
        description: '組合費',
        amount: 2500,
        isFixed: true,
        effectiveFrom: new Date('2024-01-01')
      });

      // Retrieve complete profile
      const completeEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      
      expect(completeEmployee).toBeDefined();
      expect(completeEmployee?.employeeNumber).toBe('EMP-2024-FULL');
      expect(completeEmployee?.bankAccount?.bankName).toBe('三井住友銀行');
      expect(completeEmployee?.taxInfo?.dependents).toBe(1);
      expect(completeEmployee?.allowances).toHaveLength(1);
      expect(completeEmployee?.deductions).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent employee gracefully', async () => {
      const result = await payrollExtensions.getExtendedEmployee('INVALID_ID');
      expect(result).toBeNull();
    });

    test('should handle empty allowances and deductions gracefully', async () => {
      const extendedEmployee = await payrollExtensions.getExtendedEmployee(testEmployee.id);
      
      expect(extendedEmployee?.allowances).toEqual([]);
      expect(extendedEmployee?.deductions).toEqual([]);
    });
  });
});