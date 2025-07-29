/**
 * 従業員関連の型定義
 * Employee-related Type Definitions
 */

import { BaseEntity, Maybe } from '../core';

/**
 * 従業員ID
 */
export type EmployeeId = string;

/**
 * 雇用形態
 */
export enum EmploymentType {
  FullTime = 'full_time',          // 正社員
  PartTime = 'part_time',          // パートタイム
  Contract = 'contract',           // 契約社員
  Temporary = 'temporary',         // 派遣社員
  Intern = 'intern',               // インターン
  Executive = 'executive'          // 役員
}

/**
 * 従業員ステータス
 */
export enum EmployeeStatus {
  Active = 'active',               // 在職中
  OnLeave = 'on_leave',           // 休職中
  Suspended = 'suspended',         // 停職中
  Terminated = 'terminated',       // 退職済み
  Pending = 'pending'              // 入社予定
}

/**
 * 性別
 */
export enum Gender {
  Male = 'male',
  Female = 'female',
  Other = 'other',
  PreferNotToSay = 'prefer_not_to_say'
}

/**
 * 個人情報
 */
export interface PersonalInfo {
  firstName: string;
  lastName: string;
  firstNameKana: string;
  lastNameKana: string;
  dateOfBirth: Date;
  gender: Gender;
  nationality: string;
  profilePhoto?: string;
}

/**
 * 連絡先情報
 */
export interface ContactInfo {
  email: string;
  personalEmail?: string;
  phone: string;
  mobilePhone?: string;
  address: Address;
  emergencyContact: EmergencyContact;
}

/**
 * 住所
 */
export interface Address {
  postalCode: string;
  prefecture: string;
  city: string;
  street: string;
  building?: string;
  country: string;
}

/**
 * 緊急連絡先
 */
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  address?: Address;
}

/**
 * 銀行口座情報
 */
export interface BankAccount {
  bankName: string;
  branchName: string;
  accountType: 'checking' | 'savings';
  accountNumber: string;
  accountHolder: string;
}

/**
 * 社会保険情報
 */
export interface SocialInsurance {
  healthInsuranceNumber?: string;
  pensionNumber?: string;
  employmentInsuranceNumber?: string;
  taxWithholdingType: 'ko' | 'otsu' | 'hei';  // 甲・乙・丙
  dependentsCount: number;
}

/**
 * 従業員エンティティ
 */
export interface Employee extends BaseEntity {
  employeeCode: string;
  personal: PersonalInfo;
  contact: ContactInfo;
  employment: EmploymentInfo;
  payroll: PayrollInfo;
  organizationalInfo: OrganizationalInfo;
  socialInsurance: SocialInsurance;
  bankAccount: BankAccount;
  status: EmployeeStatus;
  metadata?: EmployeeMetadata;
}

/**
 * 雇用情報
 */
export interface EmploymentInfo {
  type: EmploymentType;
  hireDate: Date;
  probationEndDate?: Date;
  contractEndDate?: Date;
  terminationDate?: Date;
  workLocation: string;
  remoteWorkAllowed: boolean;
  workingHoursPerWeek: number;
}

/**
 * 給与情報
 */
export interface PayrollInfo {
  baseSalary: number;
  salaryType: 'monthly' | 'hourly' | 'daily' | 'annual';
  paymentMethod: 'bank_transfer' | 'cash' | 'check';
  allowances: Allowance[];
  deductions: Deduction[];
}

/**
 * 手当
 */
export interface Allowance {
  type: AllowanceType;
  amount: number;
  taxable: boolean;
  startDate: Date;
  endDate?: Date;
  conditions?: string;
}

/**
 * 手当タイプ
 */
export enum AllowanceType {
  Transportation = 'transportation',     // 通勤手当
  Housing = 'housing',                  // 住宅手当
  Family = 'family',                    // 家族手当
  Overtime = 'overtime',                // 残業手当
  Holiday = 'holiday',                  // 休日手当
  Night = 'night',                      // 深夜手当
  Position = 'position',                // 役職手当
  Skill = 'skill',                      // 技能手当
  Other = 'other'                       // その他
}

/**
 * 控除
 */
export interface Deduction {
  type: DeductionType;
  amount: number;
  startDate: Date;
  endDate?: Date;
  description?: string;
}

/**
 * 控除タイプ
 */
export enum DeductionType {
  HealthInsurance = 'health_insurance',        // 健康保険
  PensionInsurance = 'pension_insurance',      // 厚生年金
  EmploymentInsurance = 'employment_insurance', // 雇用保険
  IncomeTax = 'income_tax',                    // 所得税
  ResidentTax = 'resident_tax',                // 住民税
  Loan = 'loan',                               // 貸付金返済
  Other = 'other'                              // その他
}

/**
 * 組織情報
 */
export interface OrganizationalInfo {
  departmentId: string;
  divisionId?: string;
  teamId?: string;
  positionId: string;
  jobTitle: string;
  managerId?: EmployeeId;
  reportingTo: EmployeeId[];
  grade?: string;
  costCenter?: string;
}

/**
 * 従業員メタデータ
 */
export interface EmployeeMetadata {
  customFields?: Record<string, any>;
  tags?: string[];
  notes?: string;
  lastReviewDate?: Date;
  nextReviewDate?: Date;
}

/**
 * 従業員検索条件
 */
export interface EmployeeSearchCriteria {
  employeeCode?: string;
  name?: string;
  email?: string;
  departmentId?: string;
  status?: EmployeeStatus[];
  employmentType?: EmploymentType[];
  managerId?: EmployeeId;
  hiredAfter?: Date;
  hiredBefore?: Date;
}

/**
 * 従業員統計
 */
export interface EmployeeStatistics {
  totalCount: number;
  byStatus: Record<EmployeeStatus, number>;
  byEmploymentType: Record<EmploymentType, number>;
  byDepartment: Record<string, number>;
  averageTenure: number;
  turnoverRate: number;
  genderDiversity: Record<Gender, number>;
  ageDistribution: AgeRange[];
}

/**
 * 年齢層
 */
export interface AgeRange {
  min: number;
  max: number;
  count: number;
  percentage: number;
}

/**
 * 従業員変更履歴
 */
export interface EmployeeHistory {
  employeeId: EmployeeId;
  changeType: EmployeeChangeType;
  fieldName: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  changedAt: Date;
  reason?: string;
}

/**
 * 従業員変更タイプ
 */
export enum EmployeeChangeType {
  PersonalInfo = 'personal_info',
  ContactInfo = 'contact_info',
  Employment = 'employment',
  Payroll = 'payroll',
  Organization = 'organization',
  Status = 'status',
  Other = 'other'
}

/**
 * 従業員ライフサイクルイベント
 */
export interface EmployeeLifecycleEvent {
  employeeId: EmployeeId;
  eventType: LifecycleEventType;
  eventDate: Date;
  details?: Record<string, any>;
  processedBy?: string;
}

/**
 * ライフサイクルイベントタイプ
 */
export enum LifecycleEventType {
  Onboarding = 'onboarding',           // 入社
  ProbationEnd = 'probation_end',      // 試用期間終了
  Promotion = 'promotion',             // 昇進
  Transfer = 'transfer',               // 異動
  LeaveStart = 'leave_start',          // 休職開始
  LeaveEnd = 'leave_end',              // 休職終了
  Termination = 'termination',         // 退職
  Rehire = 'rehire'                    // 再雇用
}

/**
 * 従業員サービスインターフェース
 */
export interface IEmployeeService {
  // CRUD操作
  create(employee: Omit<Employee, keyof BaseEntity>): Promise<Employee>;
  findById(id: EmployeeId): Promise<Maybe<Employee>>;
  findByCode(code: string): Promise<Maybe<Employee>>;
  update(id: EmployeeId, updates: Partial<Employee>): Promise<Employee>;
  delete(id: EmployeeId): Promise<void>;
  
  // 検索・一覧
  search(criteria: EmployeeSearchCriteria): Promise<Employee[]>;
  findAll(): Promise<Employee[]>;
  findByDepartment(departmentId: string): Promise<Employee[]>;
  findByManager(managerId: EmployeeId): Promise<Employee[]>;
  
  // ステータス管理
  activate(id: EmployeeId): Promise<void>;
  suspend(id: EmployeeId, reason: string): Promise<void>;
  terminate(id: EmployeeId, date: Date, reason: string): Promise<void>;
  
  // 統計
  getStatistics(): Promise<EmployeeStatistics>;
  getHeadcount(date?: Date): Promise<number>;
  getTurnoverRate(startDate: Date, endDate: Date): Promise<number>;
  
  // 履歴
  getHistory(id: EmployeeId): Promise<EmployeeHistory[]>;
  recordChange(change: EmployeeHistory): Promise<void>;
  
  // ライフサイクル
  processLifecycleEvent(event: EmployeeLifecycleEvent): Promise<void>;
  getLifecycleEvents(id: EmployeeId): Promise<EmployeeLifecycleEvent[]>;
}