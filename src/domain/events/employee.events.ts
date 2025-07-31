/**
 * 従業員関連のドメインイベント
 */

import { DomainEvent } from './base.event';
import type { Department, EmployeeRole, EmploymentType } from '../../types/domain/employee';

/**
 * 従業員作成イベント
 */
export class EmployeeCreatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      employeeCode: string;
      fullName: string;
      email: string;
      department: Department;
      position: string;
      employmentType: EmploymentType;
      hireDate: Date;
    }
  ) {
    super(aggregateId, 'EmployeeCreated');
  }
}

/**
 * 従業員情報更新イベント
 */
export class EmployeeUpdatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      changes: {
        field: string;
        oldValue: unknown;
        newValue: unknown;
      }[];
      updatedBy?: string;
    }
  ) {
    super(aggregateId, 'EmployeeUpdated');
  }
}

/**
 * 従業員メールアドレス変更イベント
 */
export class EmployeeEmailChangedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      oldEmail: string;
      newEmail: string;
    }
  ) {
    super(aggregateId, 'EmployeeEmailChanged');
  }
}

/**
 * 従業員部署変更イベント
 */
export class EmployeeDepartmentChangedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      oldDepartment: Department;
      newDepartment: Department;
      oldPosition: string;
      newPosition: string;
      effectiveDate: Date;
    }
  ) {
    super(aggregateId, 'EmployeeDepartmentChanged');
  }
}

/**
 * 従業員昇進イベント
 */
export class EmployeePromotedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      oldRole: EmployeeRole;
      newRole: EmployeeRole;
      oldPosition: string;
      newPosition: string;
      effectiveDate: Date;
    }
  ) {
    super(aggregateId, 'EmployeePromoted');
  }
}

/**
 * 従業員給与更新イベント
 */
export class EmployeeSalaryUpdatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      oldBaseSalary?: number;
      newBaseSalary?: number;
      oldHourlyRate?: number;
      newHourlyRate?: number;
      effectiveDate: Date;
      reason?: string;
    }
  ) {
    super(aggregateId, 'EmployeeSalaryUpdated');
  }
}

/**
 * 従業員退職イベント
 */
export class EmployeeTerminatedEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      terminationDate: Date;
      reason: string;
      lastWorkingDay: Date;
    }
  ) {
    super(aggregateId, 'EmployeeTerminated');
  }
}

/**
 * 従業員再雇用イベント
 */
export class EmployeeRehiredEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      rehireDate: Date;
      newEmployeeCode: string;
      department: Department;
      position: string;
    }
  ) {
    super(aggregateId, 'EmployeeRehired');
  }
}

/**
 * 従業員誕生日通知イベント
 */
export class EmployeeBirthdayEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      employeeName: string;
      birthDate: Date;
      age: number;
    }
  ) {
    super(aggregateId, 'EmployeeBirthday');
  }
}

/**
 * 従業員勤続記念日イベント
 */
export class EmployeeAnniversaryEvent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly data: {
      employeeName: string;
      hireDate: Date;
      yearsOfService: number;
    }
  ) {
    super(aggregateId, 'EmployeeAnniversary');
  }
}