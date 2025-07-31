/**
 * 依存性注入コンテナ
 * AI-OS v3.0
 */

type Constructor<T = {}> = new (...args: any[]) => T;
type Factory<T> = () => T | Promise<T>;
type Token<T> = Constructor<T> | string | symbol;

/**
 * サービスプロバイダー
 */
export interface ServiceProvider {
  register(container: Container): void;
}

export type LifeTime = 'singleton' | 'transient' | 'scoped';

interface Registration<T> {
  token: Token<T>;
  factory: Factory<T>;
  lifetime: LifeTime;
  instance?: T;
}

/**
 * DIコンテナ
 */
export class Container {
  private readonly registrations = new Map<Token<any>, Registration<any>>();
  private readonly scopedInstances = new Map<Token<any>, any>();

  /**
   * サービス登録
   */
  register<T>(
    token: Token<T>,
    factory: Factory<T>,
    lifetime: LifeTime = 'transient'
  ): this {
    this.registrations.set(token, {
      token,
      factory,
      lifetime,
    });
    return this;
  }

  /**
   * シングルトン登録
   */
  registerSingleton<T>(token: Token<T>, factory: Factory<T>): this {
    return this.register(token, factory, 'singleton');
  }

  /**
   * トランジェント登録
   */
  registerTransient<T>(token: Token<T>, factory: Factory<T>): this {
    return this.register(token, factory, 'transient');
  }

  /**
   * スコープ登録
   */
  registerScoped<T>(token: Token<T>, factory: Factory<T>): this {
    return this.register(token, factory, 'scoped');
  }

  /**
   * インスタンス登録
   */
  registerInstance<T>(token: Token<T>, instance: T): this {
    this.registrations.set(token, {
      token,
      factory: () => instance,
      lifetime: 'singleton',
      instance,
    });
    return this;
  }

  /**
   * サービス解決
   */
  async resolve<T>(token: Token<T>): Promise<T> {
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new Error(`No registration found for token: ${String(token)}`);
    }

    switch (registration.lifetime) {
      case 'singleton':
        if (!registration.instance) {
          registration.instance = await registration.factory();
        }
        return registration.instance;

      case 'scoped':
        if (!this.scopedInstances.has(token)) {
          const instance = await registration.factory();
          this.scopedInstances.set(token, instance);
        }
        return this.scopedInstances.get(token);

      case 'transient':
        return await registration.factory();

      default:
        throw new Error(`Unknown lifetime: ${registration.lifetime}`);
    }
  }

  /**
   * 同期的解決
   */
  resolveSync<T>(token: Token<T>): T {
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new Error(`No registration found for token: ${String(token)}`);
    }

    const factory = registration.factory;
    const result = factory();
    
    if (result instanceof Promise) {
      throw new Error('Cannot resolve async factory synchronously');
    }

    return result;
  }

  /**
   * スコープ作成
   */
  createScope(): Container {
    const scopedContainer = new Container();
    scopedContainer.registrations = new Map(this.registrations);
    return scopedContainer;
  }

  /**
   * スコープクリア
   */
  clearScope(): void {
    this.scopedInstances.clear();
  }

  /**
   * 登録確認
   */
  has<T>(token: Token<T>): boolean {
    return this.registrations.has(token);
  }

  /**
   * すべてクリア
   */
  clear(): void {
    this.registrations.clear();
    this.scopedInstances.clear();
  }
}

/**
 * デコレーター用メタデータキー
 */
const INJECT_METADATA_KEY = Symbol('INJECT_METADATA_KEY');

/**
 * インジェクションデコレーター
 */
export function Inject(token: Token<any>) {
  return function (target: any, propertyKey: string | symbol, parameterIndex: number) {
    const existingTokens = Reflect.getMetadata(INJECT_METADATA_KEY, target, propertyKey) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_METADATA_KEY, existingTokens, target, propertyKey);
  };
}

/**
 * サービスデコレーター
 */
export function Service(lifetime: LifeTime = 'transient') {
  return function <T extends Constructor>(target: T) {
    // サービスのメタデータを設定
    Reflect.defineMetadata('lifetime', lifetime, target);
    return target;
  };
}

/**
 * グローバルコンテナインスタンス
 */
export const container = new Container();

/**
 * ファクトリー関数ヘルパー
 */
export function factory<T>(fn: () => T | Promise<T>): Factory<T> {
  return fn;
}

/**
 * 型安全なトークン生成
 */
export function token<T>(name: string): Token<T> {
  return Symbol(name) as Token<T>;
}

// インポートして型を利用
import type { IEmployeeRepository } from '../../domain/repositories/employee.repository.interface';
import type { IEventPublisher, IEventSubscriber } from '../../domain/events/base.event';

// よく使うトークン
export const TOKENS = {
  // リポジトリ
  EmployeeRepository: token<IEmployeeRepository>('EmployeeRepository'),
  AttendanceRepository: token<any>('AttendanceRepository'),
  PayrollRepository: token<any>('PayrollRepository'),
  ExpenseRepository: token<any>('ExpenseRepository'),
  
  // サービス
  PayrollService: token<any>('PayrollService'),
  AttendanceService: token<any>('AttendanceService'),
  ExpenseService: token<any>('ExpenseService'),
  NotificationService: token<any>('NotificationService'),
  
  // インフラ
  Database: token<any>('Database'),
  Logger: token<any>('Logger'),
  EventPublisher: token<IEventPublisher>('EventPublisher'),
  EventSubscriber: token<IEventSubscriber>('EventSubscriber'),
  Cache: token<any>('Cache'),
  
  // 設定
  Config: token<any>('Config'),
  AppSettings: token<any>('AppSettings'),
} as const;