/**
 * 従業員エンティティ
 * ドメイン層の中核となるビジネスエンティティ
 */

import type { Result } from '../../types/core/result';
import { Result as ResultImpl } from '../../types/core/result';
import type { ValidationError } from '../../types/core/validation';
import type { Money } from '../../types/core/money';
import type { 
  EmployeeRole, 
  Department, 
  EmploymentType,
  EmploymentStatus,
  Gender
} from '../../types/domain/employee';
import type { IDomainEvent } from '../events/base.event';
import {
  EmployeeCreatedEvent,
  EmployeeEmailChangedEvent,
  EmployeeDepartmentChangedEvent,
  EmployeePromotedEvent,
  EmployeeSalaryUpdatedEvent,
  EmployeeTerminatedEvent
} from '../events/employee.events';

/**
 * 従業員エンティティ
 * ビジネスロジックとバリデーションを含む
 */
export class EmployeeEntity {
  private _domainEvents: IDomainEvent[] = [];

  private constructor(
    private readonly _id: string,
    private _employeeCode: string,
    private _firstName: string,
    private _lastName: string,
    private _firstNameKana: string,
    private _lastNameKana: string,
    private _email: string,
    private _phoneNumber?: string,
    private _hireDate: Date,
    private _birthDate: Date,
    private _gender: Gender,
    private _nationality: string = 'JP',
    private _department: Department,
    private _position: string,
    private _role: EmployeeRole = EmployeeRole.EMPLOYEE,
    private _employmentType: EmploymentType,
    private _employmentStatus: EmploymentStatus = 'active',
    private _workLocation: string,
    private _baseSalary?: number,
    private _hourlyRate?: number,
    private _isActive: boolean = true,
    private _terminationDate?: Date,
    private _terminationReason?: string
  ) {}

  // Getters
  get id(): string { return this._id; }
  get employeeCode(): string { return this._employeeCode; }
  get firstName(): string { return this._firstName; }
  get lastName(): string { return this._lastName; }
  get firstNameKana(): string { return this._firstNameKana; }
  get lastNameKana(): string { return this._lastNameKana; }
  get email(): string { return this._email; }
  get phoneNumber(): string | undefined { return this._phoneNumber; }
  get hireDate(): Date { return this._hireDate; }
  get birthDate(): Date { return this._birthDate; }
  get gender(): Gender { return this._gender; }
  get nationality(): string { return this._nationality; }
  get department(): Department { return this._department; }
  get position(): string { return this._position; }
  get role(): EmployeeRole { return this._role; }
  get employmentType(): EmploymentType { return this._employmentType; }
  get employmentStatus(): EmploymentStatus { return this._employmentStatus; }
  get workLocation(): string { return this._workLocation; }
  get baseSalary(): number | undefined { return this._baseSalary; }
  get hourlyRate(): number | undefined { return this._hourlyRate; }
  get isActive(): boolean { return this._isActive; }
  get terminationDate(): Date | undefined { return this._terminationDate; }
  get terminationReason(): string | undefined { return this._terminationReason; }

  /**
   * ドメインイベントの取得とクリア
   */
  getAndClearEvents(): IDomainEvent[] {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    return events;
  }

  /**
   * ドメインイベントの追加
   */
  private addDomainEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * 従業員エンティティの作成
   */
  static create(params: {
    id?: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    firstNameKana: string;
    lastNameKana: string;
    email: string;
    phoneNumber?: string;
    hireDate: Date;
    birthDate: Date;
    gender: Gender;
    nationality?: string;
    department: Department;
    position: string;
    role?: EmployeeRole;
    employmentType: EmploymentType;
    employmentStatus?: EmploymentStatus;
    workLocation: string;
    baseSalary?: number;
    hourlyRate?: number;
    isActive?: boolean;
    terminationDate?: Date;
    terminationReason?: string;
  }): Result<EmployeeEntity, ValidationError> {
    // バリデーション
    const validationResult = this.validate(params);
    if (validationResult.isFailure) {
      return validationResult;
    }

    const employeeId = params.id || this.generateId();
    const employee = new EmployeeEntity(
      employeeId,
      params.employeeCode,
      params.firstName,
      params.lastName,
      params.firstNameKana,
      params.lastNameKana,
      params.email,
      params.phoneNumber,
      params.hireDate,
      params.birthDate,
      params.gender,
      params.nationality,
      params.department,
      params.position,
      params.role,
      params.employmentType,
      params.employmentStatus,
      params.workLocation,
      params.baseSalary,
      params.hourlyRate,
      params.isActive ?? true,
      params.terminationDate,
      params.terminationReason
    );

    // 作成イベントを発行
    employee.addDomainEvent(new EmployeeCreatedEvent(
      employeeId,
      params.employeeCode,
      params.email,
      params.department,
      params.position
    ));

    return ResultImpl.success(employee);
  }

  /**
   * フルネームの取得
   */
  getFullName(format: 'ja' | 'en' = 'ja'): string {
    return format === 'ja' 
      ? `${this._lastName} ${this._firstName}`
      : `${this._firstName} ${this._lastName}`;
  }

  /**
   * フルネーム（カナ）の取得
   */
  getFullNameKana(): string {
    return `${this._lastNameKana} ${this._firstNameKana}`;
  }

  /**
   * 年齢の計算
   */
  getAge(): number {
    const today = new Date();
    let age = today.getFullYear() - this._birthDate.getFullYear();
    const monthDiff = today.getMonth() - this._birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this._birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * 勤続年数の計算
   */
  getYearsOfService(): number {
    const endDate = this._terminationDate || new Date();
    const years = endDate.getFullYear() - this._hireDate.getFullYear();
    const monthDiff = endDate.getMonth() - this._hireDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < this._hireDate.getDate())) {
      return years - 1;
    }
    
    return years;
  }

  /**
   * 管理職かどうかの判定
   */
  isManager(): boolean {
    return this._role === EmployeeRole.MANAGER || 
           this._role === EmployeeRole.EXECUTIVE ||
           this._role === EmployeeRole.ADMIN;
  }

  /**
   * 正社員かどうかの判定
   */
  isFullTime(): boolean {
    return this._employmentType === 'full_time';
  }

  /**
   * メールアドレスの更新
   */
  updateEmail(newEmail: string): Result<void, ValidationError> {
    if (!EmployeeEntity.isValidEmail(newEmail)) {
      return ResultImpl.failure({
        field: 'email',
        message: '無効なメールアドレス形式です',
        code: 'INVALID_EMAIL'
      });
    }

    const oldEmail = this._email;
    this._email = newEmail;

    // メール変更イベントを発行
    this.addDomainEvent(new EmployeeEmailChangedEvent(
      this._id,
      oldEmail,
      newEmail
    ));

    return ResultImpl.success(undefined);
  }

  /**
   * 部署の変更
   */
  changeDepartment(newDepartment: Department, newPosition: string): void {
    const oldDepartment = this._department;
    const oldPosition = this._position;
    
    this._department = newDepartment;
    this._position = newPosition;

    // 部署変更イベントを発行
    this.addDomainEvent(new EmployeeDepartmentChangedEvent(
      this._id,
      oldDepartment,
      newDepartment,
      oldPosition,
      newPosition
    ));
  }

  /**
   * 昇進
   */
  promote(newRole: EmployeeRole, newPosition: string): void {
    const oldRole = this._role;
    const oldPosition = this._position;
    
    this._role = newRole;
    this._position = newPosition;

    // 昇進イベントを発行
    this.addDomainEvent(new EmployeePromotedEvent(
      this._id,
      oldRole,
      newRole,
      oldPosition,
      newPosition
    ));
  }

  /**
   * 給与の更新
   */
  updateSalary(baseSalary?: number, hourlyRate?: number): Result<void, ValidationError> {
    if (baseSalary !== undefined && baseSalary < 0) {
      return ResultImpl.failure({
        field: 'baseSalary',
        message: '基本給は0以上である必要があります',
        code: 'INVALID_SALARY'
      });
    }

    if (hourlyRate !== undefined && hourlyRate < 0) {
      return ResultImpl.failure({
        field: 'hourlyRate',
        message: '時給は0以上である必要があります',
        code: 'INVALID_HOURLY_RATE'
      });
    }

    const oldBaseSalary = this._baseSalary;
    const oldHourlyRate = this._hourlyRate;

    if (baseSalary !== undefined) {
      this._baseSalary = baseSalary;
    }
    if (hourlyRate !== undefined) {
      this._hourlyRate = hourlyRate;
    }

    // 給与更新イベントを発行
    this.addDomainEvent(new EmployeeSalaryUpdatedEvent(
      this._id,
      oldBaseSalary,
      this._baseSalary,
      oldHourlyRate,
      this._hourlyRate
    ));

    return ResultImpl.success(undefined);
  }

  /**
   * 退職処理
   */
  terminate(terminationDate: Date, reason: string): void {
    this._isActive = false;
    this._employmentStatus = 'terminated';
    this._terminationDate = terminationDate;
    this._terminationReason = reason;

    // 退職イベントを発行
    this.addDomainEvent(new EmployeeTerminatedEvent(
      this._id,
      terminationDate,
      reason
    ));
  }

  /**
   * バリデーション
   */
  private static validate(params: any): Result<void, ValidationError> {
    // 必須フィールドのチェック
    const requiredFields = [
      'employeeCode', 'firstName', 'lastName', 
      'firstNameKana', 'lastNameKana', 'email',
      'hireDate', 'birthDate', 'gender', 'department',
      'position', 'employmentType', 'workLocation'
    ];

    for (const field of requiredFields) {
      if (!params[field]) {
        return ResultImpl.failure({
          field,
          message: `${field}は必須です`,
          code: 'REQUIRED'
        });
      }
    }

    // メールアドレスの形式チェック
    if (!this.isValidEmail(params.email)) {
      return ResultImpl.failure({
        field: 'email',
        message: '無効なメールアドレス形式です',
        code: 'INVALID_EMAIL'
      });
    }

    // 給与情報のチェック
    if (!params.baseSalary && !params.hourlyRate) {
      return ResultImpl.failure({
        field: 'salary',
        message: '基本給または時給のいずれかは必須です',
        code: 'SALARY_REQUIRED'
      });
    }

    return ResultImpl.success(undefined);
  }

  /**
   * メールアドレスのバリデーション
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * ID生成
   */
  private static generateId(): string {
    return `EMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}