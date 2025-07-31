/**
 * 従業員更新ユースケース
 */

import type { Result } from '../../../types/core/result';
import type { ValidationError } from '../../../types/core/validation';
import type { IEmployeeRepository } from '../../../domain/repositories/employee.repository.interface';
import type { Department, EmployeeRole } from '../../../types/domain/employee';

/**
 * 従業員更新の入力DTO
 */
export interface UpdateEmployeeInput {
  id: string;
  email?: string;
  phoneNumber?: string;
  department?: Department;
  position?: string;
  role?: EmployeeRole;
  workLocation?: string;
  baseSalary?: number;
  hourlyRate?: number;
}

/**
 * 従業員更新の出力DTO
 */
export interface UpdateEmployeeOutput {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  department: Department;
  position: string;
  updatedAt: Date;
}

/**
 * 従業員更新ユースケース
 */
export class UpdateEmployeeUseCase {
  constructor(
    private readonly employeeRepository: IEmployeeRepository
  ) {}

  /**
   * 従業員情報を更新する
   */
  async execute(input: UpdateEmployeeInput): Promise<Result<UpdateEmployeeOutput, ValidationError | Error>> {
    try {
      // 1. 従業員の取得
      const employeeResult = await this.employeeRepository.findById(input.id);
      
      if (employeeResult.isFailure) {
        return Result.failure(employeeResult.error);
      }

      const employee = employeeResult.value;

      // 2. メールアドレスの更新と重複チェック
      if (input.email && input.email !== employee.email) {
        const emailTakenResult = await this.employeeRepository.isEmailTaken(input.email, input.id);
        
        if (emailTakenResult.isFailure) {
          return Result.failure(emailTakenResult.error);
        }

        if (emailTakenResult.value) {
          return Result.failure({
            field: 'email',
            message: 'このメールアドレスは既に使用されています',
            code: 'EMAIL_ALREADY_EXISTS'
          });
        }

        const updateEmailResult = employee.updateEmail(input.email);
        if (updateEmailResult.isFailure) {
          return Result.failure(updateEmailResult.error);
        }
      }

      // 3. 部署・役職の更新
      if (input.department && input.position) {
        employee.changeDepartment(input.department, input.position);
      }

      // 4. 役職の昇進
      if (input.role && input.position) {
        employee.promote(input.role, input.position);
      }

      // 5. 給与の更新
      if (input.baseSalary !== undefined || input.hourlyRate !== undefined) {
        const updateSalaryResult = employee.updateSalary(input.baseSalary, input.hourlyRate);
        if (updateSalaryResult.isFailure) {
          return Result.failure(updateSalaryResult.error);
        }
      }

      // 6. リポジトリに保存
      const saveResult = await this.employeeRepository.save(employee);

      if (saveResult.isFailure) {
        return Result.failure(saveResult.error);
      }

      const savedEmployee = saveResult.value;

      // 7. 出力DTOの作成
      const output: UpdateEmployeeOutput = {
        id: savedEmployee.id,
        employeeCode: savedEmployee.employeeCode,
        fullName: savedEmployee.getFullName(),
        email: savedEmployee.email,
        department: savedEmployee.department,
        position: savedEmployee.position,
        updatedAt: new Date()
      };

      return Result.success(output);

    } catch (error) {
      return Result.failure(
        error instanceof Error 
          ? error 
          : new Error('従業員の更新中にエラーが発生しました')
      );
    }
  }
}