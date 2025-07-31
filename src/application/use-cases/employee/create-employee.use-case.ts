/**
 * 従業員作成ユースケース
 * アプリケーション層のビジネスロジック
 */

import type { Result } from '../../../types/core/result';
import { Result as ResultImpl } from '../../../types/core/result';
import type { ValidationError } from '../../../types/core/validation';
import type { IEmployeeRepository } from '../../../domain/repositories/employee.repository.interface';
import { EmployeeEntity } from '../../../domain/entities/employee.entity';
import type { 
  Department, 
  EmploymentType, 
  Gender,
  EmployeeRole 
} from '../../../types/domain/employee';
import type { IEventPublisher } from '../../../domain/events/base.event';

/**
 * 従業員作成の入力DTO
 */
export interface CreateEmployeeInput {
  readonly employeeCode: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly firstNameKana: string;
  readonly lastNameKana: string;
  readonly email: string;
  readonly phoneNumber?: string;
  readonly hireDate: Date;
  readonly birthDate: Date;
  readonly gender: Gender;
  readonly nationality?: string;
  readonly department: Department;
  readonly position: string;
  readonly role?: EmployeeRole;
  readonly employmentType: EmploymentType;
  readonly workLocation: string;
  readonly baseSalary?: number;
  readonly hourlyRate?: number;
}

/**
 * 従業員作成の出力DTO
 */
export interface CreateEmployeeOutput {
  readonly id: string;
  readonly employeeCode: string;
  readonly fullName: string;
  readonly email: string;
  readonly department: Department;
  readonly position: string;
  readonly createdAt: Date;
}

/**
 * 従業員作成ユースケース
 */
export class CreateEmployeeUseCase {
  constructor(
    private readonly employeeRepository: IEmployeeRepository,
    private readonly eventPublisher?: IEventPublisher
  ) {}

  /**
   * 従業員を作成する
   */
  async execute(input: CreateEmployeeInput): Promise<Result<CreateEmployeeOutput, ValidationError | Error>> {
    try {
      // 1. 重複チェック
      const duplicateChecks = await Promise.all([
        this.employeeRepository.isEmailTaken(input.email),
        this.employeeRepository.isEmployeeCodeTaken(input.employeeCode)
      ]);

      const [emailTakenResult, codeTokenResult] = duplicateChecks;

      if (emailTakenResult.isFailure) {
        return ResultImpl.failure(emailTakenResult.error);
      }

      if (codeTokenResult.isFailure) {
        return ResultImpl.failure(codeTokenResult.error);
      }

      if (emailTakenResult.value) {
        return ResultImpl.failure({
          field: 'email',
          message: 'このメールアドレスは既に使用されています',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }

      if (codeTokenResult.value) {
        return ResultImpl.failure({
          field: 'employeeCode',
          message: 'この従業員コードは既に使用されています',
          code: 'EMPLOYEE_CODE_ALREADY_EXISTS'
        });
      }

      // 2. エンティティの作成
      const employeeResult = EmployeeEntity.create({
        ...input,
        isActive: true
      });

      if (employeeResult.isFailure) {
        return ResultImpl.failure(employeeResult.error);
      }

      const employee = employeeResult.value;

      // 3. リポジトリに保存
      const saveResult = await this.employeeRepository.save(employee);

      if (saveResult.isFailure) {
        return ResultImpl.failure(saveResult.error);
      }

      const savedEmployee = saveResult.value;

      // 4. ドメインイベントの発行
      const events = employee.getAndClearEvents();
      if (this.eventPublisher && events.length > 0) {
        await this.eventPublisher.publishMany(events);
      }

      // 5. 出力DTOの作成
      const output: CreateEmployeeOutput = {
        id: savedEmployee.id,
        employeeCode: savedEmployee.employeeCode,
        fullName: savedEmployee.getFullName(),
        email: savedEmployee.email,
        department: savedEmployee.department,
        position: savedEmployee.position,
        createdAt: new Date()
      };

      return ResultImpl.success(output);

    } catch (error) {
      return ResultImpl.failure(
        error instanceof Error 
          ? error 
          : new Error('従業員の作成中にエラーが発生しました')
      );
    }
  }

  /**
   * 一括作成
   */
  async executeBatch(inputs: ReadonlyArray<CreateEmployeeInput>): Promise<Result<ReadonlyArray<CreateEmployeeOutput>, Error>> {
    try {
      const results: CreateEmployeeOutput[] = [];
      const errors: Array<{ index: number; error: ValidationError | Error }> = [];

      // 各従業員を順次処理
      for (let i = 0; i < inputs.length; i++) {
        const result = await this.execute(inputs[i]);
        
        if (result.isSuccess) {
          results.push(result.value);
        } else {
          errors.push({ index: i, error: result.error });
        }
      }

      // エラーがある場合は集約エラーを返す
      if (errors.length > 0) {
        const errorMessage = errors
          .map(e => `Row ${e.index + 1}: ${e.error instanceof Error ? e.error.message : (e.error as ValidationError).message}`)
          .join(', ');
        
        return ResultImpl.failure(new Error(`一括作成でエラーが発生しました: ${errorMessage}`));
      }

      return ResultImpl.success(results);

    } catch (error) {
      return ResultImpl.failure(
        error instanceof Error 
          ? error 
          : new Error('一括作成中にエラーが発生しました')
      );
    }
  }
}