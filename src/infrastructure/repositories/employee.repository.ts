/**
 * 従業員リポジトリ実装
 * PostgreSQLを使用した永続化層
 */

import type { Result } from '../../types/core/result';
import type { 
  IEmployeeRepository, 
  EmployeeSearchCriteria, 
  PaginationParams, 
  PaginatedResult 
} from '../../domain/repositories/employee.repository.interface';
import { EmployeeEntity } from '../../domain/entities/employee.entity';
import type { Department, EmploymentType, EmployeeRole } from '../../types/domain/employee';
import Database from '../../database';

/**
 * 従業員リポジトリ実装クラス
 */
export class EmployeeRepository implements IEmployeeRepository {
  constructor(
    private readonly db: Database
  ) {}

  /**
   * IDによる従業員の取得
   */
  async findById(id: string): Promise<Result<EmployeeEntity, Error>> {
    try {
      const result = await this.db.query(
        'SELECT * FROM employees WHERE id = $1',
        [id]
      );

      if (!result.rows || result.rows.length === 0) {
        return Result.failure(new Error(`従業員が見つかりません: ${id}`));
      }

      const employee = await this.mapToEntity(result.rows[0]);
      return Result.success(employee);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の取得に失敗しました')
      );
    }
  }

  /**
   * 従業員コードによる従業員の取得
   */
  async findByEmployeeCode(employeeCode: string): Promise<Result<EmployeeEntity, Error>> {
    try {
      const result = await this.db.query(
        'SELECT * FROM employees WHERE employee_code = $1',
        [employeeCode]
      );

      if (!result.rows || result.rows.length === 0) {
        return Result.failure(new Error(`従業員が見つかりません: ${employeeCode}`));
      }

      const employee = await this.mapToEntity(result.rows[0]);
      return Result.success(employee);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の取得に失敗しました')
      );
    }
  }

  /**
   * メールアドレスによる従業員の取得
   */
  async findByEmail(email: string): Promise<Result<EmployeeEntity, Error>> {
    try {
      const result = await this.db.query(
        'SELECT * FROM employees WHERE email = $1',
        [email]
      );

      if (!result.rows || result.rows.length === 0) {
        return Result.failure(new Error(`従業員が見つかりません: ${email}`));
      }

      const employee = await this.mapToEntity(result.rows[0]);
      return Result.success(employee);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の取得に失敗しました')
      );
    }
  }

  /**
   * 複数の従業員を取得
   */
  async findByIds(ids: string[]): Promise<Result<EmployeeEntity[], Error>> {
    try {
      const result = await this.db.query(
        'SELECT * FROM employees WHERE id = ANY($1)',
        [ids]
      );

      const employees = await Promise.all(
        (result.rows || []).map(row => this.mapToEntity(row))
      );

      return Result.success(employees);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の取得に失敗しました')
      );
    }
  }

  /**
   * 条件に基づく従業員の検索
   */
  async search(
    criteria: EmployeeSearchCriteria,
    pagination?: PaginationParams
  ): Promise<Result<PaginatedResult<EmployeeEntity>, Error>> {
    try {
      // WHERE句の構築
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (criteria.department) {
        conditions.push(`department = $${paramIndex++}`);
        params.push(criteria.department);
      }

      if (criteria.employmentType) {
        conditions.push(`employment_type = $${paramIndex++}`);
        params.push(criteria.employmentType);
      }

      if (criteria.role) {
        conditions.push(`role = $${paramIndex++}`);
        params.push(criteria.role);
      }

      if (criteria.isActive !== undefined) {
        conditions.push(`is_active = $${paramIndex++}`);
        params.push(criteria.isActive);
      }

      if (criteria.searchText) {
        conditions.push(`(
          first_name ILIKE $${paramIndex} OR 
          last_name ILIKE $${paramIndex} OR 
          email ILIKE $${paramIndex}
        )`);
        params.push(`%${criteria.searchText}%`);
        paramIndex++;
      }

      if (criteria.hiredAfter) {
        conditions.push(`hire_date >= $${paramIndex++}`);
        params.push(criteria.hiredAfter);
      }

      if (criteria.hiredBefore) {
        conditions.push(`hire_date <= $${paramIndex++}`);
        params.push(criteria.hiredBefore);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // カウントクエリ
      const countQuery = `SELECT COUNT(*) FROM employees ${whereClause}`;
      const countResult = await this.db.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // ページネーション設定
      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 20;
      const offset = (page - 1) * pageSize;
      const sortBy = pagination?.sortBy || 'employee_code';
      const sortOrder = pagination?.sortOrder || 'asc';

      // データクエリ
      const dataQuery = `
        SELECT * FROM employees 
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(pageSize, offset);
      const dataResult = await this.db.query(dataQuery, params);

      const employees = await Promise.all(
        (dataResult.rows || []).map(row => this.mapToEntity(row))
      );

      return Result.success({
        items: employees,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      });

    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の検索に失敗しました')
      );
    }
  }

  /**
   * すべてのアクティブな従業員を取得
   */
  async findAllActive(): Promise<Result<EmployeeEntity[], Error>> {
    try {
      const result = await this.db.query(
        'SELECT * FROM employees WHERE is_active = true ORDER BY employee_code',
        []
      );

      const employees = await Promise.all(
        (result.rows || []).map(row => this.mapToEntity(row))
      );

      return Result.success(employees);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の取得に失敗しました')
      );
    }
  }

  /**
   * 部署別の従業員を取得
   */
  async findByDepartment(department: Department): Promise<Result<EmployeeEntity[], Error>> {
    try {
      const result = await this.db.query(
        'SELECT * FROM employees WHERE department = $1 AND is_active = true ORDER BY employee_code',
        [department]
      );

      const employees = await Promise.all(
        (result.rows || []).map(row => this.mapToEntity(row))
      );

      return Result.success(employees);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の取得に失敗しました')
      );
    }
  }

  /**
   * マネージャーの一覧を取得
   */
  async findManagers(): Promise<Result<EmployeeEntity[], Error>> {
    try {
      const result = await this.db.query(
        'SELECT * FROM employees WHERE role IN ($1, $2, $3) AND is_active = true ORDER BY employee_code',
        [EmployeeRole.MANAGER, EmployeeRole.EXECUTIVE, EmployeeRole.ADMIN]
      );

      const employees = await Promise.all(
        (result.rows || []).map(row => this.mapToEntity(row))
      );

      return Result.success(employees);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('マネージャーの取得に失敗しました')
      );
    }
  }

  /**
   * 従業員の保存（新規作成または更新）
   */
  async save(employee: EmployeeEntity): Promise<Result<EmployeeEntity, Error>> {
    try {
      const existsResult = await this.exists(employee.id);
      
      if (existsResult.isFailure) {
        return Result.failure(existsResult.error);
      }

      if (existsResult.value) {
        // 更新
        await this.db.query(
          `UPDATE employees SET
            employee_code = $1, first_name = $2, last_name = $3,
            first_name_kana = $4, last_name_kana = $5, email = $6,
            phone_number = $7, hire_date = $8, birth_date = $9,
            gender = $10, nationality = $11, department = $12,
            position = $13, role = $14, employment_type = $15,
            employment_status = $16, work_location = $17,
            base_salary = $18, hourly_rate = $19, is_active = $20,
            termination_date = $21, termination_reason = $22,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $23`,
          [
            employee.employeeCode, employee.firstName, employee.lastName,
            employee.firstNameKana, employee.lastNameKana, employee.email,
            employee.phoneNumber, employee.hireDate, employee.birthDate,
            employee.gender, employee.nationality, employee.department,
            employee.position, employee.role, employee.employmentType,
            employee.employmentStatus, employee.workLocation,
            employee.baseSalary, employee.hourlyRate, employee.isActive,
            employee.terminationDate, employee.terminationReason,
            employee.id
          ]
        );
      } else {
        // 新規作成
        await this.db.query(
          `INSERT INTO employees (
            id, employee_code, first_name, last_name,
            first_name_kana, last_name_kana, email, phone_number,
            hire_date, birth_date, gender, nationality,
            department, position, role, employment_type,
            employment_status, work_location, base_salary, hourly_rate,
            is_active, termination_date, termination_reason,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )`,
          [
            employee.id, employee.employeeCode, employee.firstName, employee.lastName,
            employee.firstNameKana, employee.lastNameKana, employee.email, employee.phoneNumber,
            employee.hireDate, employee.birthDate, employee.gender, employee.nationality,
            employee.department, employee.position, employee.role, employee.employmentType,
            employee.employmentStatus, employee.workLocation, employee.baseSalary, employee.hourlyRate,
            employee.isActive, employee.terminationDate, employee.terminationReason
          ]
        );
      }

      return Result.success(employee);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の保存に失敗しました')
      );
    }
  }

  /**
   * 複数の従業員を一括保存
   */
  async saveMany(employees: EmployeeEntity[]): Promise<Result<EmployeeEntity[], Error>> {
    try {
      // トランザクション開始
      await this.db.query('BEGIN', []);

      try {
        const savedEmployees: EmployeeEntity[] = [];

        for (const employee of employees) {
          const result = await this.save(employee);
          if (result.isFailure) {
            throw result.error;
          }
          savedEmployees.push(result.value);
        }

        await this.db.query('COMMIT', []);
        return Result.success(savedEmployees);

      } catch (error) {
        await this.db.query('ROLLBACK', []);
        throw error;
      }

    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の一括保存に失敗しました')
      );
    }
  }

  /**
   * 従業員の削除（論理削除）
   */
  async delete(id: string): Promise<Result<void, Error>> {
    try {
      await this.db.query(
        'UPDATE employees SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員の削除に失敗しました')
      );
    }
  }

  /**
   * 従業員数のカウント
   */
  async count(criteria?: EmployeeSearchCriteria): Promise<Result<number, Error>> {
    try {
      if (!criteria) {
        const result = await this.db.query(
          'SELECT COUNT(*) FROM employees WHERE is_active = true',
          []
        );
        return Result.success(parseInt(result.rows[0].count));
      }

      // 条件付きカウント
      const searchResult = await this.search(criteria, { page: 1, pageSize: 1 });
      if (searchResult.isFailure) {
        return Result.failure(searchResult.error);
      }

      return Result.success(searchResult.value.total);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員数の取得に失敗しました')
      );
    }
  }

  /**
   * 従業員が存在するかチェック
   */
  async exists(id: string): Promise<Result<boolean, Error>> {
    try {
      const result = await this.db.query(
        'SELECT 1 FROM employees WHERE id = $1',
        [id]
      );

      return Result.success(result.rows.length > 0);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('存在チェックに失敗しました')
      );
    }
  }

  /**
   * メールアドレスが既に使用されているかチェック
   */
  async isEmailTaken(email: string, excludeEmployeeId?: string): Promise<Result<boolean, Error>> {
    try {
      let query = 'SELECT 1 FROM employees WHERE email = $1';
      const params: any[] = [email];

      if (excludeEmployeeId) {
        query += ' AND id != $2';
        params.push(excludeEmployeeId);
      }

      const result = await this.db.query(query, params);
      return Result.success(result.rows.length > 0);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('メールアドレスのチェックに失敗しました')
      );
    }
  }

  /**
   * 従業員コードが既に使用されているかチェック
   */
  async isEmployeeCodeTaken(employeeCode: string, excludeEmployeeId?: string): Promise<Result<boolean, Error>> {
    try {
      let query = 'SELECT 1 FROM employees WHERE employee_code = $1';
      const params: any[] = [employeeCode];

      if (excludeEmployeeId) {
        query += ' AND id != $2';
        params.push(excludeEmployeeId);
      }

      const result = await this.db.query(query, params);
      return Result.success(result.rows.length > 0);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('従業員コードのチェックに失敗しました')
      );
    }
  }

  /**
   * 部署の従業員数を取得
   */
  async countByDepartment(): Promise<Result<Map<Department, number>, Error>> {
    try {
      const result = await this.db.query(
        'SELECT department, COUNT(*) as count FROM employees WHERE is_active = true GROUP BY department',
        []
      );

      const map = new Map<Department, number>();
      for (const row of result.rows) {
        map.set(row.department as Department, parseInt(row.count));
      }

      return Result.success(map);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('部署別従業員数の取得に失敗しました')
      );
    }
  }

  /**
   * 雇用形態別の従業員数を取得
   */
  async countByEmploymentType(): Promise<Result<Map<EmploymentType, number>, Error>> {
    try {
      const result = await this.db.query(
        'SELECT employment_type, COUNT(*) as count FROM employees WHERE is_active = true GROUP BY employment_type',
        []
      );

      const map = new Map<EmploymentType, number>();
      for (const row of result.rows) {
        map.set(row.employment_type as EmploymentType, parseInt(row.count));
      }

      return Result.success(map);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('雇用形態別従業員数の取得に失敗しました')
      );
    }
  }

  /**
   * 今月入社した従業員を取得
   */
  async findNewHires(month: Date): Promise<Result<EmployeeEntity[], Error>> {
    try {
      const year = month.getFullYear();
      const monthNum = month.getMonth() + 1;

      const result = await this.db.query(
        `SELECT * FROM employees 
         WHERE EXTRACT(YEAR FROM hire_date) = $1 
         AND EXTRACT(MONTH FROM hire_date) = $2
         AND is_active = true
         ORDER BY hire_date`,
        [year, monthNum]
      );

      const employees = await Promise.all(
        (result.rows || []).map(row => this.mapToEntity(row))
      );

      return Result.success(employees);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('新入社員の取得に失敗しました')
      );
    }
  }

  /**
   * 誕生日が近い従業員を取得
   */
  async findUpcomingBirthdays(days: number): Promise<Result<EmployeeEntity[], Error>> {
    try {
      const result = await this.db.query(
        `SELECT * FROM employees 
         WHERE is_active = true
         AND (
           DATE_PART('doy', birth_date) - DATE_PART('doy', CURRENT_DATE)
         ) BETWEEN 0 AND $1
         ORDER BY DATE_PART('doy', birth_date)`,
        [days]
      );

      const employees = await Promise.all(
        (result.rows || []).map(row => this.mapToEntity(row))
      );

      return Result.success(employees);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('誕生日情報の取得に失敗しました')
      );
    }
  }

  /**
   * 勤続年数でグループ化した従業員数を取得
   */
  async countByYearsOfService(): Promise<Result<Map<string, number>, Error>> {
    try {
      const result = await this.db.query(
        `SELECT 
          CASE 
            WHEN DATE_PART('year', AGE(CURRENT_DATE, hire_date)) < 1 THEN '1年未満'
            WHEN DATE_PART('year', AGE(CURRENT_DATE, hire_date)) < 3 THEN '1-3年'
            WHEN DATE_PART('year', AGE(CURRENT_DATE, hire_date)) < 5 THEN '3-5年'
            WHEN DATE_PART('year', AGE(CURRENT_DATE, hire_date)) < 10 THEN '5-10年'
            ELSE '10年以上'
          END as service_group,
          COUNT(*) as count
         FROM employees 
         WHERE is_active = true
         GROUP BY service_group
         ORDER BY service_group`,
        []
      );

      const map = new Map<string, number>();
      for (const row of result.rows) {
        map.set(row.service_group, parseInt(row.count));
      }

      return Result.success(map);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error('勤続年数別従業員数の取得に失敗しました')
      );
    }
  }

  /**
   * DBレコードをエンティティにマッピング
   */
  private async mapToEntity(row: any): Promise<EmployeeEntity> {
    const result = EmployeeEntity.create({
      id: row.id,
      employeeCode: row.employee_code,
      firstName: row.first_name,
      lastName: row.last_name,
      firstNameKana: row.first_name_kana,
      lastNameKana: row.last_name_kana,
      email: row.email,
      phoneNumber: row.phone_number,
      hireDate: row.hire_date,
      birthDate: row.birth_date,
      gender: row.gender,
      nationality: row.nationality,
      department: row.department,
      position: row.position,
      role: row.role,
      employmentType: row.employment_type,
      employmentStatus: row.employment_status,
      workLocation: row.work_location,
      baseSalary: row.base_salary,
      hourlyRate: row.hourly_rate,
      isActive: row.is_active,
      terminationDate: row.termination_date,
      terminationReason: row.termination_reason
    });

    if (result.isFailure) {
      throw new Error(`エンティティのマッピングに失敗しました: ${result.error.message}`);
    }

    return result.value;
  }
}