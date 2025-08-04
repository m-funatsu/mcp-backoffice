/**
 * 依存性注入コンテナ
 * アプリケーション全体の依存関係を管理
 */

import Database from '../../database';
import { EmployeeRepository } from '../repositories/employee.repository';
import { CreateEmployeeUseCase } from '../../application/use-cases/employee/create-employee.use-case';
import { UpdateEmployeeUseCase } from '../../application/use-cases/employee/update-employee.use-case';
import type { IEmployeeRepository } from '../../domain/repositories/employee.repository.interface';

/**
 * DIコンテナインターフェース
 */
export interface IContainer {
  // インフラストラクチャ
  database: Database;
  
  // リポジトリ
  employeeRepository: IEmployeeRepository;
  
  // ユースケース
  createEmployeeUseCase: CreateEmployeeUseCase;
  updateEmployeeUseCase: UpdateEmployeeUseCase;
}

/**
 * DIコンテナクラス
 * シングルトンパターンで実装
 */
export class Container implements IContainer {
  private static instance: Container;
  
  // インフラストラクチャ
  private _database: Database;
  
  // リポジトリ
  private _employeeRepository: IEmployeeRepository;
  
  // ユースケース
  private _createEmployeeUseCase: CreateEmployeeUseCase;
  private _updateEmployeeUseCase: UpdateEmployeeUseCase;
  
  private constructor() {
    // インフラストラクチャの初期化
    this._database = new Database({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'ai_native_hr',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.DB_SSL === 'true'
    });
    
    // リポジトリの初期化
    this._employeeRepository = new EmployeeRepository(this._database);
    
    // ユースケースの初期化
    this._createEmployeeUseCase = new CreateEmployeeUseCase(this._employeeRepository);
    this._updateEmployeeUseCase = new UpdateEmployeeUseCase(this._employeeRepository);
  }
  
  /**
   * コンテナインスタンスの取得
   */
  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }
  
  // Getters
  get database(): Database {
    return this._database;
  }
  
  get employeeRepository(): IEmployeeRepository {
    return this._employeeRepository;
  }
  
  get createEmployeeUseCase(): CreateEmployeeUseCase {
    return this._createEmployeeUseCase;
  }
  
  get updateEmployeeUseCase(): UpdateEmployeeUseCase {
    return this._updateEmployeeUseCase;
  }
  
  /**
   * カスタム依存関係の登録
   * テストなどで使用
   */
  register<T extends keyof IContainer>(key: T, instance: IContainer[T]): void {
    (this as Record<string, unknown>)[`_${key}`] = instance;
  }
  
  /**
   * コンテナのリセット
   * テストなどで使用
   */
  static reset(): void {
    Container.instance = null as unknown as Container;
  }
}

/**
 * グローバルコンテナインスタンス
 */
export const container = Container.getInstance();