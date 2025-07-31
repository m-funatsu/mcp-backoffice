/**
 * 拡張給与計算型定義
 * Extended Payroll Type Definitions
 */

import type { PayrollCalculation, PayrollWarning } from '../../types';
import type { PayslipData } from '../../payroll-engine';

/**
 * 拡張PayrollCalculation型（互換性維持用）
 */
export interface ExtendedPayrollCalculation extends PayrollCalculation {
  warnings?: ExtendedPayrollWarning[];
  complianceReport?: {
    yearlyOvertimeTotal: number;
  };
  payslip?: PayslipData;
}

/**
 * 拡張PayrollWarning型
 */
export interface ExtendedPayrollWarning extends PayrollWarning {
  type: string;
  message: string;
  severity: string;
}

/**
 * 手当タイプの厳密な定義
 */
export type AllowanceType = 
  | 'overtime' 
  | 'late_night' 
  | 'holiday' 
  | 'special' 
  | 'transport' 
  | 'housing';

/**
 * 控除タイプの厳密な定義
 */
export type DeductionType = 
  | 'income_tax' 
  | 'resident_tax' 
  | 'social_insurance' 
  | 'unemployment' 
  | 'other';

/**
 * 従業員手当情報
 */
export interface EmployeeAllowance {
  type: AllowanceType | string;
  description: string;
  amount: number;
}

/**
 * 従業員控除情報
 */
export interface EmployeeDeduction {
  type: DeductionType | string;
  description: string;
  amount: number;
}

/**
 * 従業員税金情報
 */
export interface EmployeeTaxInfo {
  dependents?: number;
  isDisabled?: boolean;
  isSingleParent?: boolean;
  hasSpouseDeduction?: boolean;
}

/**
 * 拡張Employee型（税金情報付き）
 */
export interface EmployeeWithTaxInfo {
  id: string;
  name: string;
  hourlyRate?: number;
  hourlyWage?: number;
  birthDate?: Date;
  allowances?: EmployeeAllowance[];
  deductions?: EmployeeDeduction[];
  taxInfo?: EmployeeTaxInfo;
}