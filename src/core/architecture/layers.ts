/**
 * アーキテクチャレイヤー定義
 * AI-OS v3.0 - クリーンアーキテクチャ実装
 */

/**
 * プレゼンテーション層
 * - ユーザーインターフェース
 * - API エンドポイント
 * - コントローラー
 */
export namespace Presentation {
  export interface Controller<TRequest, TResponse> {
    handle(request: TRequest): Promise<TResponse>;
  }

  export interface Presenter<TInput, TOutput> {
    present(input: TInput): TOutput;
  }

  export interface Validator<T> {
    validate(input: unknown): input is T;
  }
}

/**
 * アプリケーション層
 * - ユースケース
 * - アプリケーションサービス
 * - DTOs
 */
export namespace Application {
  export interface UseCase<TInput, TOutput> {
    execute(input: TInput): Promise<TOutput>;
  }

  export interface ApplicationService {
    // アプリケーション固有のビジネスロジック
  }

  export interface Port {
    // 外部システムとの境界
  }
}

/**
 * ドメイン層
 * - エンティティ
 * - 値オブジェクト
 * - ドメインサービス
 * - リポジトリインターフェース
 */
export namespace Domain {
  export interface Entity<TId> {
    readonly id: TId;
    equals(other: Entity<TId>): boolean;
  }

  export interface ValueObject<T> {
    readonly value: T;
    equals(other: ValueObject<T>): boolean;
  }

  export interface DomainService {
    // ドメインロジック
  }

  export interface Repository<TEntity, TId> {
    findById(id: TId): Promise<TEntity | null>;
    save(entity: TEntity): Promise<void>;
    delete(id: TId): Promise<void>;
  }

  export interface Specification<T> {
    isSatisfiedBy(candidate: T): boolean;
    and(other: Specification<T>): Specification<T>;
    or(other: Specification<T>): Specification<T>;
    not(): Specification<T>;
  }
}

/**
 * インフラストラクチャ層
 * - リポジトリ実装
 * - 外部サービス連携
 * - データベースアクセス
 */
export namespace Infrastructure {
  export interface DataMapper<TEntity, TRecord> {
    toDomain(record: TRecord): TEntity;
    toPersistence(entity: TEntity): TRecord;
  }

  export interface QueryBuilder<T> {
    where(condition: Partial<T>): QueryBuilder<T>;
    orderBy(field: keyof T, direction: 'asc' | 'desc'): QueryBuilder<T>;
    limit(count: number): QueryBuilder<T>;
    offset(count: number): QueryBuilder<T>;
    build(): string;
  }

  export interface UnitOfWork {
    begin(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
  }
}