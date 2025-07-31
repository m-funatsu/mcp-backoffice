/**
 * アーキテクチャ基底クラス
 * AI-OS v3.0
 */

import { Result } from '@core/result';
import { ValidationError } from '@core/validation';
import { DomainEvent } from '@domain/index';

/**
 * 基底エンティティクラス
 */
export abstract class BaseEntity<TId> {
  private _domainEvents: DomainEvent[] = [];

  constructor(
    public readonly id: TId,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearEvents(): void {
    this._domainEvents = [];
  }

  equals(other: BaseEntity<TId>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (!(other instanceof BaseEntity)) {
      return false;
    }
    return this.id === other.id;
  }
}

/**
 * 基底値オブジェクトクラス
 */
export abstract class BaseValueObject<T> {
  constructor(public readonly value: T) {
    this.validate();
  }

  protected abstract validate(): void;

  equals(other: BaseValueObject<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }
    if (!(other instanceof BaseValueObject)) {
      return false;
    }
    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }
}

/**
 * 基底集約ルートクラス
 */
export abstract class AggregateRoot<TId> extends BaseEntity<TId> {
  private _version: number = 0;

  get version(): number {
    return this._version;
  }

  protected incrementVersion(): void {
    this._version++;
  }

  markChangesAsCommitted(): void {
    this.clearEvents();
  }
}

/**
 * 基底リポジトリクラス
 */
export abstract class BaseRepository<TEntity extends BaseEntity<TId>, TId> {
  abstract findById(id: TId): Promise<TEntity | null>;
  abstract findAll(): Promise<TEntity[]>;
  abstract save(entity: TEntity): Promise<void>;
  abstract delete(id: TId): Promise<void>;
  abstract exists(id: TId): Promise<boolean>;
}

/**
 * 基底仕様クラス
 */
export abstract class BaseSpecification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: BaseSpecification<T>): BaseSpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: BaseSpecification<T>): BaseSpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): BaseSpecification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: BaseSpecification<T>,
    private right: BaseSpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

class OrSpecification<T> extends BaseSpecification<T> {
  constructor(
    private left: BaseSpecification<T>,
    private right: BaseSpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private specification: BaseSpecification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.specification.isSatisfiedBy(candidate);
  }
}

/**
 * 基底ユースケースクラス
 */
export abstract class BaseUseCase<TRequest, TResponse> {
  abstract execute(request: TRequest): Promise<Result<TResponse, ValidationError>>;

  protected async validateRequest(request: TRequest): Promise<Result<void, ValidationError>> {
    // デフォルト実装（オーバーライド可能）
    return Result.success(undefined);
  }
}

/**
 * 基底ドメインサービスクラス
 */
export abstract class BaseDomainService {
  // 共通のドメインサービス機能
}

/**
 * 基底アプリケーションサービスクラス
 */
export abstract class BaseApplicationService {
  // 共通のアプリケーションサービス機能
}

/**
 * イベントハンドラーインターフェース
 */
export interface IEventHandler<TEvent extends DomainEvent> {
  handle(event: TEvent): Promise<void>;
}

/**
 * イベントディスパッチャーインターフェース
 */
export interface IEventDispatcher {
  dispatch(event: DomainEvent): Promise<void>;
  register<TEvent extends DomainEvent>(
    eventType: string,
    handler: IEventHandler<TEvent>
  ): void;
}