/**
 * ドメイン型定義エクスポート
 * AI-OS v3.0
 */

// 従業員管理
export * from './employee';

// 勤怠管理
export * from './attendance';

// 給与計算
export * from './payroll';

// 経費管理
export * from './expense';

// コンプライアンス管理
export * from './compliance';

// 共通型定義
export interface DomainEntity {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface AuditableEntity extends DomainEntity {
  readonly createdBy: string;
  readonly updatedBy: string;
  readonly deletedAt?: Date;
  readonly deletedBy?: string;
}

export interface TenantEntity extends AuditableEntity {
  readonly tenantId: string;
}

// ドメインイベント
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly timestamp: Date;
  readonly userId: string;
  readonly data: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

// ページネーション
export interface PageRequest {
  readonly page: number;
  readonly size: number;
  readonly sort?: SortOrder[];
}

export interface PageResponse<T> {
  readonly content: ReadonlyArray<T>;
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

export interface SortOrder {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

// 検索条件
export interface SearchCriteria {
  readonly query?: string;
  readonly filters?: Record<string, unknown>;
  readonly dateRange?: {
    readonly start: Date;
    readonly end: Date;
  };
  readonly tags?: string[];
}

// 集計
export interface AggregationResult<T> {
  readonly groupBy: string;
  readonly data: ReadonlyArray<{
    readonly key: string;
    readonly value: T;
    readonly count: number;
  }>;
  readonly total: T;
}

// 時系列データ
export interface TimeSeriesData<T> {
  readonly timestamp: Date;
  readonly value: T;
  readonly metadata?: Record<string, unknown>;
}

export interface TimeSeriesResult<T> {
  readonly series: ReadonlyArray<TimeSeriesData<T>>;
  readonly interval: 'hour' | 'day' | 'week' | 'month' | 'year';
  readonly aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
}