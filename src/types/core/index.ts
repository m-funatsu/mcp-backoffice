/**
 * コア型定義
 * Core Type Definitions
 * 
 * プロジェクト全体で使用される基本的な型定義
 */

// Result型: エラーハンドリングのための型
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Maybe型: nullableな値を扱うための型
export type Maybe<T> = T | null | undefined;

// NonEmptyArray型: 空でない配列を保証
export type NonEmptyArray<T> = [T, ...T[]];

// DeepPartial型: ネストされたオブジェクトの部分型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// DeepReadonly型: ネストされたオブジェクトの読み取り専用型
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// Timestamp型: タイムスタンプ
export interface Timestamp {
  createdAt: Date;
  updatedAt: Date;
}

// Entity基底型: すべてのエンティティの基底
export interface BaseEntity extends Timestamp {
  id: string;
  version: number;
}

// ページネーション型
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// ソート型
export interface Sort<T = string> {
  field: T;
  order: 'asc' | 'desc';
}

// フィルター型
export interface Filter<T = string> {
  field: T;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like';
  value: any;
}

// クエリパラメータ型
export interface QueryParams<T = string> {
  filters?: Filter<T>[];
  sort?: Sort<T>;
  pagination?: Partial<Pagination>;
}

// 列挙型のヘルパー
export const createEnum = <T extends string>(...values: T[]) => {
  return Object.freeze(
    values.reduce((acc, value) => {
      acc[value] = value;
      return acc;
    }, {} as { [K in T]: K })
  );
};

// 型ガード
export const isSuccess = <T, E>(result: Result<T, E>): result is { success: true; data: T } => {
  return result.success === true;
};

export const isError = <T, E>(result: Result<T, E>): result is { success: false; error: E } => {
  return result.success === false;
};

export const isDefined = <T>(value: Maybe<T>): value is T => {
  return value !== null && value !== undefined;
};

export const isNonEmptyArray = <T>(array: T[]): array is NonEmptyArray<T> => {
  return array.length > 0;
};

// エラー型
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  stack?: string;
  timestamp: Date;
}

// バリデーションエラー
export interface ValidationError extends AppError {
  code: 'VALIDATION_ERROR';
  fields: Record<string, string[]>;
}

// ビジネスエラー
export interface BusinessError extends AppError {
  code: 'BUSINESS_ERROR';
  businessCode: string;
}

// システムエラー
export interface SystemError extends AppError {
  code: 'SYSTEM_ERROR';
  cause?: Error;
}

// HTTP関連の型
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface HttpHeaders {
  [key: string]: string | string[];
}

// 監査ログ型
export interface AuditLog {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  changes?: Record<string, { old: any; new: any }>;
}

// 通知型
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  metadata?: Record<string, any>;
}

// キャッシュ型
export interface CacheEntry<T> {
  key: string;
  value: T;
  expiresAt?: Date;
  tags?: string[];
}

// イベント型
export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, any>;
  metadata: {
    timestamp: Date;
    userId?: string;
    correlationId?: string;
    causationId?: string;
  };
}

// タスク型
export interface Task {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: AppError;
  result?: any;
}

// 設定型
export interface Config {
  [key: string]: string | number | boolean | Config;
}

// ファイル型
export interface FileInfo {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy: string;
  metadata?: Record<string, any>;
}

// ロケール型
export type Locale = 'ja' | 'en' | 'ko' | 'zh';

// 通貨型
export type Currency = 'JPY' | 'USD' | 'EUR' | 'KRW' | 'CNY';

// タイムゾーン型
export type Timezone = 'Asia/Tokyo' | 'America/New_York' | 'Europe/London' | 'Asia/Seoul' | 'Asia/Shanghai';

// 再エクスポート
export * from './money';
export * from './datetime';
export * from './validation';