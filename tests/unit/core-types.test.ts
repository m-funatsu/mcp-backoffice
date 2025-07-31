/**
 * コア型定義のユニットテスト
 * Unit tests for core type definitions
 */

import { describe, it, expect } from 'vitest';
import { Result } from '../../src/types/core/result';
import { Money } from '../../src/types/core/money';
import { DateTime } from '../../src/types/core/date-time';
import { ValidationError } from '../../src/types/core/validation';

describe('Result型', () => {
  describe('success', () => {
    it('成功結果を正しく作成できる', () => {
      const result = Result.success('成功データ');
      
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBe('成功データ');
    });
    
    it('複雑な型の成功結果を作成できる', () => {
      interface User {
        id: string;
        name: string;
      }
      
      const user: User = { id: '123', name: 'テスト太郎' };
      const result = Result.success(user);
      
      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual(user);
    });
  });
  
  describe('failure', () => {
    it('失敗結果を正しく作成できる', () => {
      const error = new Error('エラーが発生しました');
      const result = Result.failure(error);
      
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
    
    it('ValidationError型の失敗結果を作成できる', () => {
      const validationError: ValidationError = {
        field: 'email',
        message: '無効なメールアドレスです',
        code: 'INVALID_EMAIL'
      };
      
      const result = Result.failure(validationError);
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toEqual(validationError);
    });
  });
  
  describe('map', () => {
    it('成功結果を変換できる', () => {
      const result = Result.success(10);
      const mapped = result.map(value => value * 2);
      
      expect(mapped.isSuccess).toBe(true);
      expect(mapped.value).toBe(20);
    });
    
    it('失敗結果はそのまま伝播する', () => {
      const error = new Error('エラー');
      const result = Result.failure<number, Error>(error);
      const mapped = result.map(value => value * 2);
      
      expect(mapped.isFailure).toBe(true);
      expect(mapped.error).toBe(error);
    });
  });
});

describe('Money型', () => {
  describe('from', () => {
    it('数値から Money インスタンスを作成できる', () => {
      const money = Money.from(1000);
      
      expect(money.amount).toBe(1000);
      expect(money.currency).toBe('JPY');
    });
    
    it('文字列から Money インスタンスを作成できる', () => {
      const money = Money.from('2500');
      
      expect(money.amount).toBe(2500);
    });
    
    it('無効な値の場合はエラーをスローする', () => {
      expect(() => Money.from('invalid')).toThrow('Invalid amount');
    });
  });
  
  describe('add', () => {
    it('同じ通貨の金額を加算できる', () => {
      const money1 = Money.from(1000);
      const money2 = Money.from(500);
      const result = money1.add(money2);
      
      expect(result.amount).toBe(1500);
    });
  });
  
  describe('subtract', () => {
    it('同じ通貨の金額を減算できる', () => {
      const money1 = Money.from(1000);
      const money2 = Money.from(300);
      const result = money1.subtract(money2);
      
      expect(result.amount).toBe(700);
    });
  });
  
  describe('multiply', () => {
    it('金額を乗算できる', () => {
      const money = Money.from(100);
      const result = money.multiply(1.5);
      
      expect(result.amount).toBe(150);
    });
  });
  
  describe('isPositive', () => {
    it('正の金額の場合 true を返す', () => {
      const money = Money.from(100);
      expect(money.isPositive()).toBe(true);
    });
    
    it('0 または負の金額の場合 false を返す', () => {
      const zero = Money.from(0);
      expect(zero.isPositive()).toBe(false);
    });
  });
  
  describe('format', () => {
    it('日本円を正しくフォーマットできる', () => {
      const money = Money.from(1234567);
      expect(money.format()).toBe('¥1,234,567');
    });
  });
});

describe('DateTime型', () => {
  describe('now', () => {
    it('現在時刻の DateTime インスタンスを作成できる', () => {
      const dateTime = DateTime.now();
      
      expect(dateTime.value).toBeInstanceOf(Date);
      expect(dateTime.timezone).toBe('Asia/Tokyo');
    });
  });
  
  describe('from', () => {
    it('Date から DateTime インスタンスを作成できる', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const dateTime = DateTime.from(date);
      
      expect(dateTime.value).toEqual(date);
    });
    
    it('文字列から DateTime インスタンスを作成できる', () => {
      const dateTime = DateTime.from('2024-01-15');
      
      expect(dateTime.value).toBeInstanceOf(Date);
    });
  });
  
  describe('startOfDay', () => {
    it('日付の開始時刻を取得できる', () => {
      const dateTime = DateTime.from('2024-01-15T15:30:45');
      const startOfDay = DateTime.startOfDay(dateTime);
      
      expect(startOfDay.value.getHours()).toBe(0);
      expect(startOfDay.value.getMinutes()).toBe(0);
      expect(startOfDay.value.getSeconds()).toBe(0);
    });
  });
  
  describe('endOfDay', () => {
    it('日付の終了時刻を取得できる', () => {
      const dateTime = DateTime.from('2024-01-15T10:00:00');
      const endOfDay = DateTime.endOfDay(dateTime);
      
      expect(endOfDay.value.getHours()).toBe(23);
      expect(endOfDay.value.getMinutes()).toBe(59);
      expect(endOfDay.value.getSeconds()).toBe(59);
    });
  });
  
  describe('format', () => {
    it('日付を指定形式でフォーマットできる', () => {
      const dateTime = DateTime.from('2024-01-15T10:00:00');
      
      expect(dateTime.format('YYYY-MM-DD')).toBe('2024-01-15');
      expect(dateTime.format('YYYY年MM月DD日')).toBe('2024年01月15日');
    });
  });
  
  describe('isBefore', () => {
    it('日付の前後関係を正しく判定できる', () => {
      const earlier = DateTime.from('2024-01-15');
      const later = DateTime.from('2024-01-16');
      
      expect(earlier.isBefore(later)).toBe(true);
      expect(later.isBefore(earlier)).toBe(false);
    });
  });
});

describe('ValidationError型', () => {
  it('必須フィールドを含む検証エラーを作成できる', () => {
    const error: ValidationError = {
      field: 'email',
      message: 'メールアドレスは必須です',
      code: 'REQUIRED'
    };
    
    expect(error.field).toBe('email');
    expect(error.message).toBe('メールアドレスは必須です');
    expect(error.code).toBe('REQUIRED');
  });
  
  it('詳細情報を含む検証エラーを作成できる', () => {
    const error: ValidationError = {
      field: 'age',
      message: '年齢は0以上である必要があります',
      code: 'MIN_VALUE',
      details: {
        minValue: 0,
        actualValue: -5
      }
    };
    
    expect(error.details).toEqual({
      minValue: 0,
      actualValue: -5
    });
  });
});