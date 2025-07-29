/**
 * バリデーション関連の型定義
 * Validation-related Type Definitions
 */

import { Result, ValidationError } from './index';

/**
 * バリデーションルール
 */
export interface ValidationRule<T> {
  name: string;
  validate: (value: T) => boolean | Promise<boolean>;
  message: string | ((value: T) => string);
}

/**
 * バリデーション結果
 */
export type ValidationResult<T> = Result<T, ValidationError>;

/**
 * フィールドバリデーター
 */
export interface FieldValidator<T> {
  field: keyof T;
  rules: ValidationRule<T[keyof T]>[];
}

/**
 * バリデーションスキーマ
 */
export interface ValidationSchema<T> {
  fields: FieldValidator<T>[];
  customValidators?: Array<(value: T) => ValidationResult<T>>;
}

/**
 * バリデーションユーティリティ
 */
export class Validator {
  /**
   * 必須チェック
   */
  static required<T>(message: string = 'This field is required'): ValidationRule<T> {
    return {
      name: 'required',
      validate: (value) => value !== null && value !== undefined && value !== '',
      message
    };
  }

  /**
   * 最小長チェック
   */
  static minLength(min: number, message?: string): ValidationRule<string> {
    return {
      name: 'minLength',
      validate: (value) => value.length >= min,
      message: message || `Must be at least ${min} characters`
    };
  }

  /**
   * 最大長チェック
   */
  static maxLength(max: number, message?: string): ValidationRule<string> {
    return {
      name: 'maxLength',
      validate: (value) => value.length <= max,
      message: message || `Must be at most ${max} characters`
    };
  }

  /**
   * パターンチェック
   */
  static pattern(regex: RegExp, message: string = 'Invalid format'): ValidationRule<string> {
    return {
      name: 'pattern',
      validate: (value) => regex.test(value),
      message
    };
  }

  /**
   * メールアドレスチェック
   */
  static email(message: string = 'Invalid email address'): ValidationRule<string> {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return this.pattern(emailRegex, message);
  }

  /**
   * 電話番号チェック（日本）
   */
  static phoneNumber(message: string = 'Invalid phone number'): ValidationRule<string> {
    const phoneRegex = /^0\d{1,4}-?\d{1,4}-?\d{4}$/;
    return this.pattern(phoneRegex, message);
  }

  /**
   * 郵便番号チェック（日本）
   */
  static postalCode(message: string = 'Invalid postal code'): ValidationRule<string> {
    const postalRegex = /^\d{3}-?\d{4}$/;
    return this.pattern(postalRegex, message);
  }

  /**
   * 数値の最小値チェック
   */
  static min(min: number, message?: string): ValidationRule<number> {
    return {
      name: 'min',
      validate: (value) => value >= min,
      message: message || `Must be at least ${min}`
    };
  }

  /**
   * 数値の最大値チェック
   */
  static max(max: number, message?: string): ValidationRule<number> {
    return {
      name: 'max',
      validate: (value) => value <= max,
      message: message || `Must be at most ${max}`
    };
  }

  /**
   * 範囲チェック
   */
  static range(min: number, max: number, message?: string): ValidationRule<number> {
    return {
      name: 'range',
      validate: (value) => value >= min && value <= max,
      message: message || `Must be between ${min} and ${max}`
    };
  }

  /**
   * 整数チェック
   */
  static integer(message: string = 'Must be an integer'): ValidationRule<number> {
    return {
      name: 'integer',
      validate: (value) => Number.isInteger(value),
      message
    };
  }

  /**
   * 正の数チェック
   */
  static positive(message: string = 'Must be a positive number'): ValidationRule<number> {
    return {
      name: 'positive',
      validate: (value) => value > 0,
      message
    };
  }

  /**
   * 配列の最小要素数チェック
   */
  static minItems<T>(min: number, message?: string): ValidationRule<T[]> {
    return {
      name: 'minItems',
      validate: (value) => value.length >= min,
      message: message || `Must have at least ${min} items`
    };
  }

  /**
   * 配列の最大要素数チェック
   */
  static maxItems<T>(max: number, message?: string): ValidationRule<T[]> {
    return {
      name: 'maxItems',
      validate: (value) => value.length <= max,
      message: message || `Must have at most ${max} items`
    };
  }

  /**
   * カスタムバリデーション
   */
  static custom<T>(
    validate: (value: T) => boolean | Promise<boolean>,
    message: string
  ): ValidationRule<T> {
    return {
      name: 'custom',
      validate,
      message
    };
  }

  /**
   * 日付の過去チェック
   */
  static pastDate(message: string = 'Must be a past date'): ValidationRule<Date> {
    return {
      name: 'pastDate',
      validate: (value) => value < new Date(),
      message
    };
  }

  /**
   * 日付の未来チェック
   */
  static futureDate(message: string = 'Must be a future date'): ValidationRule<Date> {
    return {
      name: 'futureDate',
      validate: (value) => value > new Date(),
      message
    };
  }

  /**
   * 日付範囲チェック
   */
  static dateRange(
    start: Date,
    end: Date,
    message?: string
  ): ValidationRule<Date> {
    return {
      name: 'dateRange',
      validate: (value) => value >= start && value <= end,
      message: message || `Must be between ${start.toISOString()} and ${end.toISOString()}`
    };
  }

  /**
   * URL形式チェック
   */
  static url(message: string = 'Invalid URL'): ValidationRule<string> {
    return {
      name: 'url',
      validate: (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      message
    };
  }

  /**
   * JSONチェック
   */
  static json(message: string = 'Invalid JSON'): ValidationRule<string> {
    return {
      name: 'json',
      validate: (value) => {
        try {
          JSON.parse(value);
          return true;
        } catch {
          return false;
        }
      },
      message
    };
  }

  /**
   * 列挙値チェック
   */
  static enum<T>(values: T[], message?: string): ValidationRule<T> {
    return {
      name: 'enum',
      validate: (value) => values.includes(value),
      message: message || `Must be one of: ${values.join(', ')}`
    };
  }

  /**
   * 条件付きバリデーション
   */
  static when<T>(
    condition: (value: T) => boolean,
    rule: ValidationRule<T>
  ): ValidationRule<T> {
    return {
      name: `when_${rule.name}`,
      validate: async (value) => {
        if (!condition(value)) {
          return true;
        }
        return rule.validate(value);
      },
      message: rule.message
    };
  }

  /**
   * 複数のルールを組み合わせ（AND）
   */
  static and<T>(...rules: ValidationRule<T>[]): ValidationRule<T> {
    return {
      name: 'and',
      validate: async (value) => {
        for (const rule of rules) {
          const result = await rule.validate(value);
          if (!result) return false;
        }
        return true;
      },
      message: (value) => {
        for (const rule of rules) {
          const result = rule.validate(value);
          if (!result) {
            return typeof rule.message === 'function' 
              ? rule.message(value) 
              : rule.message;
          }
        }
        return '';
      }
    };
  }

  /**
   * 複数のルールを組み合わせ（OR）
   */
  static or<T>(...rules: ValidationRule<T>[]): ValidationRule<T> {
    return {
      name: 'or',
      validate: async (value) => {
        for (const rule of rules) {
          const result = await rule.validate(value);
          if (result) return true;
        }
        return false;
      },
      message: `At least one condition must be met`
    };
  }
}

/**
 * バリデーション実行クラス
 */
export class ValidationExecutor {
  /**
   * 単一の値をバリデート
   */
  static async validateValue<T>(
    value: T,
    rules: ValidationRule<T>[]
  ): Promise<string[]> {
    const errors: string[] = [];
    
    for (const rule of rules) {
      const isValid = await rule.validate(value);
      if (!isValid) {
        const message = typeof rule.message === 'function' 
          ? rule.message(value) 
          : rule.message;
        errors.push(message);
      }
    }
    
    return errors;
  }

  /**
   * オブジェクトをバリデート
   */
  static async validateObject<T>(
    obj: T,
    schema: ValidationSchema<T>
  ): Promise<ValidationResult<T>> {
    const errors: Record<string, string[]> = {};
    
    // フィールドバリデーション
    for (const fieldValidator of schema.fields) {
      const fieldErrors = await this.validateValue(
        obj[fieldValidator.field],
        fieldValidator.rules
      );
      
      if (fieldErrors.length > 0) {
        errors[fieldValidator.field as string] = fieldErrors;
      }
    }
    
    // カスタムバリデーション
    if (schema.customValidators) {
      for (const customValidator of schema.customValidators) {
        const result = await customValidator(obj);
        if (!result.success) {
          Object.assign(errors, result.error.fields);
        }
      }
    }
    
    if (Object.keys(errors).length > 0) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          fields: errors,
          timestamp: new Date()
        }
      };
    }
    
    return {
      success: true,
      data: obj
    };
  }

  /**
   * 部分的なバリデーション
   */
  static async validatePartial<T>(
    obj: Partial<T>,
    schema: ValidationSchema<T>
  ): Promise<ValidationResult<Partial<T>>> {
    const filteredSchema: ValidationSchema<Partial<T>> = {
      fields: schema.fields
        .filter(fv => obj.hasOwnProperty(fv.field))
        .map(fv => ({
          field: fv.field as keyof Partial<T>,
          rules: fv.rules
        })),
      customValidators: schema.customValidators?.map(cv => 
        (value: Partial<T>) => cv(value as T)
      )
    };
    
    return this.validateObject(obj, filteredSchema);
  }
}