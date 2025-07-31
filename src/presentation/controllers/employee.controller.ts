/**
 * 従業員コントローラー
 * HTTPリクエストの処理とレスポンスの生成
 */

import { TOKENS } from '../../core/di/container';
import { CreateEmployeeUseCase } from '../../application/use-cases/employee/create-employee.use-case';
import { UpdateEmployeeUseCase } from '../../application/use-cases/employee/update-employee.use-case';
import type { 
  CreateEmployeeInput,
  CreateEmployeeOutput 
} from '../../application/use-cases/employee/create-employee.use-case';
import type {
  UpdateEmployeeInput,
  UpdateEmployeeOutput
} from '../../application/use-cases/employee/update-employee.use-case';
import type { EmployeeSearchCriteria, PaginationParams } from '../../domain/repositories/employee.repository.interface';
import type { IEmployeeRepository } from '../../domain/repositories/employee.repository.interface';

/**
 * HTTPリクエストボディの型定義
 */
export interface CreateEmployeeRequest {
  readonly employeeCode: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly firstNameKana: string;
  readonly lastNameKana: string;
  readonly email: string;
  readonly phoneNumber?: string;
  readonly hireDate: string; // ISO 8601 形式
  readonly birthDate: string; // ISO 8601 形式
  readonly gender: 'male' | 'female' | 'other';
  readonly nationality?: string;
  readonly department: string;
  readonly position: string;
  readonly role?: string;
  readonly employmentType: string;
  readonly workLocation: string;
  readonly baseSalary?: number;
  readonly hourlyRate?: number;
}

export interface UpdateEmployeeRequest {
  readonly email?: string;
  readonly phoneNumber?: string;
  readonly department?: string;
  readonly position?: string;
  readonly role?: string;
  readonly workLocation?: string;
  readonly baseSalary?: number;
  readonly hourlyRate?: number;
}

export interface SearchEmployeesRequest {
  readonly department?: string;
  readonly employmentType?: string;
  readonly role?: string;
  readonly isActive?: boolean;
  readonly searchText?: string;
  readonly hiredAfter?: string;
  readonly hiredBefore?: string;
  readonly page?: number;
  readonly pageSize?: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * HTTPレスポンスの型定義
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly field?: string;
  };
  readonly meta?: {
    readonly timestamp: string;
    readonly version: string;
  };
}

export interface PaginatedApiResponse<T> extends ApiResponse<ReadonlyArray<T>> {
  readonly pagination?: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

/**
 * 従業員コントローラークラス
 */
export class EmployeeController {
  constructor(
    private readonly createEmployeeUseCase: CreateEmployeeUseCase,
    private readonly updateEmployeeUseCase: UpdateEmployeeUseCase,
    private readonly employeeRepository: IEmployeeRepository
  ) {}

  /**
   * 従業員の作成
   */
  async createEmployee(request: CreateEmployeeRequest): Promise<ApiResponse<CreateEmployeeOutput>> {
    try {
      // 入力データの変換
      const input: CreateEmployeeInput = {
        ...request,
        hireDate: new Date(request.hireDate),
        birthDate: new Date(request.birthDate),
        gender: request.gender as any,
        department: request.department as any,
        role: request.role as any,
        employmentType: request.employmentType as any
      };

      // ユースケースの実行
      const result = await this.createEmployeeUseCase.execute(input);

      if (result.isFailure) {
        const error = result.error;
        return {
          success: false,
          error: {
            code: error instanceof Error ? 'INTERNAL_ERROR' : error.code,
            message: error instanceof Error ? error.message : error.message,
            field: error instanceof Error ? undefined : error.field
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      return {
        success: true,
        data: result.value,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '予期しないエラーが発生しました'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * 従業員の更新
   */
  async updateEmployee(id: string, request: UpdateEmployeeRequest): Promise<ApiResponse<UpdateEmployeeOutput>> {
    try {
      const input: UpdateEmployeeInput = {
        id,
        ...request,
        department: request.department as any,
        role: request.role as any
      };

      const result = await this.updateEmployeeUseCase.execute(input);

      if (result.isFailure) {
        const error = result.error;
        return {
          success: false,
          error: {
            code: error instanceof Error ? 'INTERNAL_ERROR' : error.code,
            message: error instanceof Error ? error.message : error.message,
            field: error instanceof Error ? undefined : error.field
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      return {
        success: true,
        data: result.value,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '予期しないエラーが発生しました'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * 従業員の取得
   */
  async getEmployee(id: string): Promise<ApiResponse<any>> {
    try {
      const result = await this.employeeRepository.findById(id);

      if (result.isFailure) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: result.error.message
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      const employee = result.value;

      return {
        success: true,
        data: {
          id: employee.id,
          employeeCode: employee.employeeCode,
          fullName: employee.getFullName(),
          fullNameKana: employee.getFullNameKana(),
          email: employee.email,
          phoneNumber: employee.phoneNumber,
          hireDate: employee.hireDate,
          birthDate: employee.birthDate,
          age: employee.getAge(),
          yearsOfService: employee.getYearsOfService(),
          gender: employee.gender,
          nationality: employee.nationality,
          department: employee.department,
          position: employee.position,
          role: employee.role,
          employmentType: employee.employmentType,
          employmentStatus: employee.employmentStatus,
          workLocation: employee.workLocation,
          baseSalary: employee.baseSalary,
          hourlyRate: employee.hourlyRate,
          isActive: employee.isActive,
          isManager: employee.isManager(),
          isFullTime: employee.isFullTime()
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '予期しないエラーが発生しました'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * 従業員の検索
   */
  async searchEmployees(request: SearchEmployeesRequest): Promise<PaginatedApiResponse<any>> {
    try {
      const criteria: EmployeeSearchCriteria = {
        department: request.department as any,
        employmentType: request.employmentType as any,
        role: request.role as any,
        isActive: request.isActive,
        searchText: request.searchText,
        hiredAfter: request.hiredAfter ? new Date(request.hiredAfter) : undefined,
        hiredBefore: request.hiredBefore ? new Date(request.hiredBefore) : undefined
      };

      const pagination: PaginationParams = {
        page: request.page || 1,
        pageSize: request.pageSize || 20,
        sortBy: request.sortBy,
        sortOrder: request.sortOrder
      };

      const result = await this.employeeRepository.search(criteria, pagination);

      if (result.isFailure) {
        return {
          success: false,
          error: {
            code: 'SEARCH_ERROR',
            message: result.error.message
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      const paginatedResult = result.value;
      const employees = paginatedResult.items.map(employee => ({
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.getFullName(),
        email: employee.email,
        department: employee.department,
        position: employee.position,
        employmentType: employee.employmentType,
        isActive: employee.isActive
      }));

      return {
        success: true,
        data: employees,
        pagination: {
          page: paginatedResult.page,
          pageSize: paginatedResult.pageSize,
          total: paginatedResult.total,
          totalPages: paginatedResult.totalPages
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '予期しないエラーが発生しました'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }
  }

  /**
   * 従業員の削除
   */
  async deleteEmployee(id: string): Promise<ApiResponse<void>> {
    try {
      const result = await this.employeeRepository.delete(id);

      if (result.isFailure) {
        return {
          success: false,
          error: {
            code: 'DELETE_ERROR',
            message: result.error.message
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        };
      }

      return {
        success: true,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '予期しないエラーが発生しました'
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      };
    }
  }
}