/**
 * 従業員リポジトリインターフェース
 * ドメイン層で定義し、インフラストラクチャ層で実装する
 */

import type { Result } from '../../types/core/result';
import type { EmployeeEntity } from '../entities/employee.entity';
import type { Department, EmploymentType, EmployeeRole } from '../../types/domain/employee';

/**
 * 従業員検索条件
 */
export interface EmployeeSearchCriteria {
  readonly department?: Department;
  readonly employmentType?: EmploymentType;
  readonly role?: EmployeeRole;
  readonly isActive?: boolean;
  readonly searchText?: string; // 名前やメールでの検索
  readonly hiredAfter?: Date;
  readonly hiredBefore?: Date;
}

/**
 * ページネーション情報
 */
export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * ページネーション結果
 */
export interface PaginatedResult<T> {
  readonly items: ReadonlyArray<T>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

/**
 * 従業員リポジトリインターフェース
 */
export interface IEmployeeRepository {
  /**
   * IDによる従業員の取得
   */
  findById(id: string): Promise<Result<EmployeeEntity, Error>>;

  /**
   * 従業員コードによる従業員の取得
   */
  findByEmployeeCode(employeeCode: string): Promise<Result<EmployeeEntity, Error>>;

  /**
   * メールアドレスによる従業員の取得
   */
  findByEmail(email: string): Promise<Result<EmployeeEntity, Error>>;

  /**
   * 複数の従業員を取得
   */
  findByIds(ids: ReadonlyArray<string>): Promise<Result<ReadonlyArray<EmployeeEntity>, Error>>;

  /**
   * 条件に基づく従業員の検索
   */
  search(
    criteria: EmployeeSearchCriteria,
    pagination?: PaginationParams
  ): Promise<Result<PaginatedResult<EmployeeEntity>, Error>>;

  /**
   * すべてのアクティブな従業員を取得
   */
  findAllActive(): Promise<Result<ReadonlyArray<EmployeeEntity>, Error>>;

  /**
   * 部署別の従業員を取得
   */
  findByDepartment(department: Department): Promise<Result<ReadonlyArray<EmployeeEntity>, Error>>;

  /**
   * マネージャーの一覧を取得
   */
  findManagers(): Promise<Result<ReadonlyArray<EmployeeEntity>, Error>>;

  /**
   * 従業員の保存（新規作成または更新）
   */
  save(employee: EmployeeEntity): Promise<Result<EmployeeEntity, Error>>;

  /**
   * 複数の従業員を一括保存
   */
  saveMany(employees: ReadonlyArray<EmployeeEntity>): Promise<Result<ReadonlyArray<EmployeeEntity>, Error>>;

  /**
   * 従業員の削除（論理削除）
   */
  delete(id: string): Promise<Result<void, Error>>;

  /**
   * 従業員数のカウント
   */
  count(criteria?: EmployeeSearchCriteria): Promise<Result<number, Error>>;

  /**
   * 従業員が存在するかチェック
   */
  exists(id: string): Promise<Result<boolean, Error>>;

  /**
   * メールアドレスが既に使用されているかチェック
   */
  isEmailTaken(email: string, excludeEmployeeId?: string): Promise<Result<boolean, Error>>;

  /**
   * 従業員コードが既に使用されているかチェック
   */
  isEmployeeCodeTaken(employeeCode: string, excludeEmployeeId?: string): Promise<Result<boolean, Error>>;

  /**
   * 部署の従業員数を取得
   */
  countByDepartment(): Promise<Result<Map<Department, number>, Error>>;

  /**
   * 雇用形態別の従業員数を取得
   */
  countByEmploymentType(): Promise<Result<Map<EmploymentType, number>, Error>>;

  /**
   * 今月入社した従業員を取得
   */
  findNewHires(month: Date): Promise<Result<ReadonlyArray<EmployeeEntity>, Error>>;

  /**
   * 誕生日が近い従業員を取得
   */
  findUpcomingBirthdays(days: number): Promise<Result<ReadonlyArray<EmployeeEntity>, Error>>;

  /**
   * 勤続年数でグループ化した従業員数を取得
   */
  countByYearsOfService(): Promise<Result<Map<string, number>, Error>>;
}