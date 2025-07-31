/**
 * ドメイン型定義のユニットテスト
 * Unit tests for domain type definitions
 */

import { describe, it, expect } from 'vitest';
import type {
  Employee,
  EmployeeRole,
  Department,
  EmploymentType,
  EmploymentStatus,
  ContactInfo,
  EmergencyContact,
  BankAccount,
  TaxInfo,
  InsuranceInfo,
  createEmployee,
  validateEmployee,
  calculateAge,
  isManager,
  getFullName
} from '../../src/types/domain/employee';

describe('Employee型', () => {
  describe('createEmployee', () => {
    it('必須フィールドのみで従業員を作成できる', () => {
      const employee = createEmployee({
        employeeCode: 'EMP001',
        firstName: '太郎',
        lastName: '山田',
        firstNameKana: 'タロウ',
        lastNameKana: 'ヤマダ',
        email: 'taro.yamada@example.com',
        hireDate: new Date('2024-01-01'),
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        department: Department.ENGINEERING,
        position: '開発者',
        employmentType: 'full_time',
        workLocation: '東京本社',
        isActive: true
      });
      
      expect(employee.id).toBeDefined();
      expect(employee.employeeCode).toBe('EMP001');
      expect(employee.email).toBe('taro.yamada@example.com');
      expect(employee.role).toBe(EmployeeRole.EMPLOYEE);
    });
  });
  
  describe('validateEmployee', () => {
    it('有効な従業員データの場合、成功結果を返す', () => {
      const employee = createEmployee({
        employeeCode: 'EMP001',
        firstName: '太郎',
        lastName: '山田',
        firstNameKana: 'タロウ',
        lastNameKana: 'ヤマダ',
        email: 'taro.yamada@example.com',
        hireDate: new Date('2024-01-01'),
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        department: Department.ENGINEERING,
        position: '開発者',
        employmentType: 'full_time',
        workLocation: '東京本社',
        isActive: true
      });
      
      const result = validateEmployee(employee);
      
      expect(result.isSuccess).toBe(true);
    });
    
    it('必須フィールドが欠けている場合、失敗結果を返す', () => {
      const invalidEmployee = {
        id: '123',
        employeeCode: 'EMP001',
        firstName: '太郎',
        // lastName が欠けている
        email: 'test@example.com'
      } as any;
      
      const result = validateEmployee(invalidEmployee);
      
      expect(result.isFailure).toBe(true);
      expect(result.error?.field).toBe('lastName');
    });
    
    it('無効なメールアドレスの場合、失敗結果を返す', () => {
      const employee = createEmployee({
        employeeCode: 'EMP001',
        firstName: '太郎',
        lastName: '山田',
        firstNameKana: 'タロウ',
        lastNameKana: 'ヤマダ',
        email: 'invalid-email',
        hireDate: new Date('2024-01-01'),
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        department: Department.ENGINEERING,
        position: '開発者',
        employmentType: 'full_time',
        workLocation: '東京本社',
        isActive: true
      });
      
      const result = validateEmployee(employee);
      
      expect(result.isFailure).toBe(true);
      expect(result.error?.field).toBe('email');
    });
  });
  
  describe('calculateAge', () => {
    it('誕生日から年齢を正しく計算できる', () => {
      const birthDate = new Date('1990-01-01');
      const age = calculateAge(birthDate);
      
      const expectedAge = new Date().getFullYear() - 1990;
      expect(age).toBeGreaterThanOrEqual(expectedAge - 1);
      expect(age).toBeLessThanOrEqual(expectedAge);
    });
  });
  
  describe('isManager', () => {
    it('マネージャーロールの場合 true を返す', () => {
      const manager = createEmployee({
        employeeCode: 'MGR001',
        firstName: '花子',
        lastName: '鈴木',
        firstNameKana: 'ハナコ',
        lastNameKana: 'スズキ',
        email: 'hanako@example.com',
        hireDate: new Date('2020-01-01'),
        birthDate: new Date('1985-01-01'),
        gender: 'female',
        department: Department.HR,
        position: 'HRマネージャー',
        role: EmployeeRole.MANAGER,
        employmentType: 'full_time',
        workLocation: '東京本社',
        isActive: true
      });
      
      expect(isManager(manager)).toBe(true);
    });
    
    it('一般従業員の場合 false を返す', () => {
      const employee = createEmployee({
        employeeCode: 'EMP001',
        firstName: '太郎',
        lastName: '山田',
        firstNameKana: 'タロウ',
        lastNameKana: 'ヤマダ',
        email: 'taro@example.com',
        hireDate: new Date('2024-01-01'),
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        department: Department.ENGINEERING,
        position: '開発者',
        employmentType: 'full_time',
        workLocation: '東京本社',
        isActive: true
      });
      
      expect(isManager(employee)).toBe(false);
    });
  });
  
  describe('getFullName', () => {
    it('日本語形式でフルネームを取得できる', () => {
      const employee = createEmployee({
        employeeCode: 'EMP001',
        firstName: '太郎',
        lastName: '山田',
        firstNameKana: 'タロウ',
        lastNameKana: 'ヤマダ',
        email: 'taro@example.com',
        hireDate: new Date('2024-01-01'),
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        department: Department.ENGINEERING,
        position: '開発者',
        employmentType: 'full_time',
        workLocation: '東京本社',
        isActive: true
      });
      
      expect(getFullName(employee)).toBe('山田 太郎');
    });
    
    it('英語形式でフルネームを取得できる', () => {
      const employee = createEmployee({
        employeeCode: 'EMP001',
        firstName: '太郎',
        lastName: '山田',
        firstNameKana: 'タロウ',
        lastNameKana: 'ヤマダ',
        email: 'taro@example.com',
        hireDate: new Date('2024-01-01'),
        birthDate: new Date('1990-01-01'),
        gender: 'male',
        department: Department.ENGINEERING,
        position: '開発者',
        employmentType: 'full_time',
        workLocation: '東京本社',
        isActive: true
      });
      
      expect(getFullName(employee, 'en')).toBe('太郎 山田');
    });
  });
  
  describe('Department列挙型', () => {
    it('すべての部門が定義されている', () => {
      expect(Department.ENGINEERING).toBe('engineering');
      expect(Department.SALES).toBe('sales');
      expect(Department.MARKETING).toBe('marketing');
      expect(Department.HR).toBe('hr');
      expect(Department.FINANCE).toBe('finance');
      expect(Department.LEGAL).toBe('legal');
      expect(Department.OPERATIONS).toBe('operations');
      expect(Department.PRODUCT).toBe('product');
      expect(Department.DESIGN).toBe('design');
      expect(Department.SUPPORT).toBe('support');
    });
  });
  
  describe('EmploymentType型', () => {
    it('すべての雇用形態が定義されている', () => {
      const fullTime: EmploymentType = 'full_time';
      const partTime: EmploymentType = 'part_time';
      const contract: EmploymentType = 'contract';
      const temporary: EmploymentType = 'temporary';
      const intern: EmploymentType = 'intern';
      
      expect(fullTime).toBe('full_time');
      expect(partTime).toBe('part_time');
      expect(contract).toBe('contract');
      expect(temporary).toBe('temporary');
      expect(intern).toBe('intern');
    });
  });
});