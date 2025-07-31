/**
 * Result型 - エラーハンドリングのための型
 * Result Type - Type for Error Handling
 */

/**
 * 成功または失敗を表す型
 * @template T 成功時の値の型
 * @template E エラーの型
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * 成功を表す型
 */
export interface Success<T> {
  readonly isSuccess: true;
  readonly isFailure: false;
  readonly value: T;
}

/**
 * 失敗を表す型
 */
export interface Failure<E> {
  readonly isSuccess: false;
  readonly isFailure: true;
  readonly error: E;
}

/**
 * 成功の Result を作成
 */
export function success<T>(value: T): Success<T> {
  return {
    isSuccess: true,
    isFailure: false,
    value
  };
}

/**
 * 失敗の Result を作成
 */
export function failure<E>(error: E): Failure<E> {
  return {
    isSuccess: false,
    isFailure: true,
    error
  };
}

/**
 * Result が成功かどうかを判定
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.isSuccess;
}

/**
 * Result が失敗かどうかを判定
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.isFailure;
}

/**
 * Result の値を取得（成功時のみ）
 */
export function getValue<T, E>(result: Result<T, E>): T {
  if (isFailure(result)) {
    throw new Error('Cannot get value from failure result');
  }
  return result.value;
}

/**
 * Result のエラーを取得（失敗時のみ）
 */
export function getError<T, E>(result: Result<T, E>): E {
  if (isSuccess(result)) {
    throw new Error('Cannot get error from success result');
  }
  return result.error;
}

/**
 * Result をマップ（成功時のみ変換）
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (isSuccess(result)) {
    return success(fn(result.value));
  }
  return result;
}

/**
 * Result をフラットマップ（成功時のみ変換し、Result を返す）
 */
export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isSuccess(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * エラーをマップ（失敗時のみ変換）
 */
export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (isFailure(result)) {
    return failure(fn(result.error));
  }
  return result;
}

/**
 * Result に対してマッチング
 */
export function matchResult<T, E, R>(
  result: Result<T, E>,
  patterns: {
    success: (value: T) => R;
    failure: (error: E) => R;
  }
): R {
  if (isSuccess(result)) {
    return patterns.success(result.value);
  }
  return patterns.failure(result.error);
}

/**
 * Result をデフォルト値で展開
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isSuccess(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Result を関数でデフォルト値を生成して展開
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  if (isSuccess(result)) {
    return result.value;
  }
  return fn(result.error);
}

/**
 * 複数の Result を結合（すべて成功時のみ成功）
 */
export function combineResults<T, E>(
  results: Result<T, E>[]
): Result<T[], E> {
  const values: T[] = [];
  
  for (const result of results) {
    if (isFailure(result)) {
      return result;
    }
    values.push(result.value);
  }
  
  return success(values);
}

/**
 * Promise を Result に変換
 */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  errorHandler?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return success(value);
  } catch (error) {
    if (errorHandler) {
      return failure(errorHandler(error));
    }
    return failure(error as E);
  }
}

/**
 * Result を Promise に変換
 */
export function toPromise<T, E>(result: Result<T, E>): Promise<T> {
  if (isSuccess(result)) {
    return Promise.resolve(result.value);
  }
  return Promise.reject(result.error);
}

/**
 * Result チェーン用のビルダー
 */
export class ResultBuilder<T, E> {
  constructor(private result: Result<T, E>) {}

  map<U>(fn: (value: T) => U): ResultBuilder<U, E> {
    return new ResultBuilder(mapResult(this.result, fn));
  }

  flatMap<U>(fn: (value: T) => Result<U, E>): ResultBuilder<U, E> {
    return new ResultBuilder(flatMapResult(this.result, fn));
  }

  mapError<F>(fn: (error: E) => F): ResultBuilder<T, F> {
    return new ResultBuilder(mapError(this.result, fn));
  }

  unwrap(): T {
    return getValue(this.result);
  }

  unwrapOr(defaultValue: T): T {
    return unwrapOr(this.result, defaultValue);
  }

  unwrapOrElse(fn: (error: E) => T): T {
    return unwrapOrElse(this.result, fn);
  }

  match<R>(patterns: { success: (value: T) => R; failure: (error: E) => R }): R {
    return matchResult(this.result, patterns);
  }

  get(): Result<T, E> {
    return this.result;
  }
}

/**
 * Result ビルダーを作成
 */
export function result<T, E>(value: Result<T, E>): ResultBuilder<T, E> {
  return new ResultBuilder(value);
}