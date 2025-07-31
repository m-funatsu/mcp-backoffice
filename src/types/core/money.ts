/**
 * 金額関連の型定義
 * Money-related Type Definitions
 */

import { Currency } from './index';

/**
 * 金額を表す型
 * 整数で管理し、通貨の最小単位で表現
 * 例: 日本円の場合、100 = 1円
 */
export interface Money {
  amount: number;
  currency: Currency;
  precision: number;
}

/**
 * 金額範囲
 */
export interface MoneyRange {
  min: Money;
  max: Money;
}

/**
 * 税金情報
 */
export interface Tax {
  name: string;
  rate: number; // パーセンテージ（例: 10 = 10%）
  amount: Money;
  isInclusive: boolean;
}

/**
 * 割引情報
 */
export interface Discount {
  type: 'percentage' | 'fixed';
  value: number;
  amount: Money;
  description?: string;
}

/**
 * 支払い方法
 */
export type PaymentMethod = 
  | 'bank_transfer'
  | 'credit_card'
  | 'cash'
  | 'payroll_deduction'
  | 'expense_reimbursement';

/**
 * 支払い情報
 */
export interface Payment {
  id: string;
  amount: Money;
  method: PaymentMethod;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  paidAt?: Date;
  reference?: string;
  metadata?: Record<string, any>;
}

/**
 * 為替レート
 */
export interface ExchangeRate {
  from: Currency;
  to: Currency;
  rate: number;
  effectiveDate: Date;
  source: string;
}

/**
 * 金額計算ユーティリティ
 */
export class MoneyCalculator {
  /**
   * 金額を加算
   */
  static add(a: Money, b: Money): Money {
    if (a.currency !== b.currency) {
      throw new Error('Cannot add different currencies');
    }
    return {
      amount: a.amount + b.amount,
      currency: a.currency,
      precision: a.precision
    };
  }

  /**
   * 金額を減算
   */
  static subtract(a: Money, b: Money): Money {
    if (a.currency !== b.currency) {
      throw new Error('Cannot subtract different currencies');
    }
    return {
      amount: a.amount - b.amount,
      currency: a.currency,
      precision: a.precision
    };
  }

  /**
   * 金額を乗算
   */
  static multiply(money: Money, multiplier: number): Money {
    return {
      amount: Math.round(money.amount * multiplier),
      currency: money.currency,
      precision: money.precision
    };
  }

  /**
   * 金額を除算
   */
  static divide(money: Money, divisor: number): Money {
    if (divisor === 0) {
      throw new Error('Cannot divide by zero');
    }
    return {
      amount: Math.round(money.amount / divisor),
      currency: money.currency,
      precision: money.precision
    };
  }

  /**
   * パーセンテージを計算
   */
  static percentage(money: Money, percentage: number): Money {
    return this.multiply(money, percentage / 100);
  }

  /**
   * 金額を比較
   */
  static compare(a: Money, b: Money): number {
    if (a.currency !== b.currency) {
      throw new Error('Cannot compare different currencies');
    }
    return a.amount - b.amount;
  }

  /**
   * 金額が等しいか判定
   */
  static equals(a: Money, b: Money): boolean {
    return a.currency === b.currency && a.amount === b.amount;
  }

  /**
   * 金額をフォーマット
   */
  static format(money: Money, locale: string = 'ja-JP'): string {
    const divisor = Math.pow(10, money.precision);
    const amount = money.amount / divisor;
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: money.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: money.precision
    }).format(amount);
  }

  /**
   * ゼロ金額を作成
   */
  static zero(currency: Currency, precision: number = 0): Money {
    return {
      amount: 0,
      currency,
      precision
    };
  }

  /**
   * 文字列から金額を作成
   */
  static fromString(value: string, currency: Currency, precision: number = 0): Money {
    const cleanValue = value.replace(/[^0-9.-]/g, '');
    const numericValue = parseFloat(cleanValue);
    
    if (isNaN(numericValue)) {
      throw new Error('Invalid money format');
    }
    
    const multiplier = Math.pow(10, precision);
    return {
      amount: Math.round(numericValue * multiplier),
      currency,
      precision
    };
  }

  /**
   * 金額の合計を計算
   */
  static sum(moneys: Money[]): Money {
    if (moneys.length === 0) {
      throw new Error('Cannot sum empty array');
    }
    
    const currency = moneys[0].currency;
    const precision = moneys[0].precision;
    
    const total = moneys.reduce((sum, money) => {
      if (money.currency !== currency) {
        throw new Error('Cannot sum different currencies');
      }
      return sum + money.amount;
    }, 0);
    
    return {
      amount: total,
      currency,
      precision
    };
  }

  /**
   * 金額の最小値を取得
   */
  static min(moneys: Money[]): Money {
    if (moneys.length === 0) {
      throw new Error('Cannot find min of empty array');
    }
    
    return moneys.reduce((min, money) => {
      return this.compare(money, min) < 0 ? money : min;
    });
  }

  /**
   * 金額の最大値を取得
   */
  static max(moneys: Money[]): Money {
    if (moneys.length === 0) {
      throw new Error('Cannot find max of empty array');
    }
    
    return moneys.reduce((max, money) => {
      return this.compare(money, max) > 0 ? money : max;
    });
  }

  /**
   * 金額を丸める
   */
  static round(money: Money, precision: number): Money {
    const factor = Math.pow(10, money.precision - precision);
    return {
      amount: Math.round(money.amount / factor) * factor,
      currency: money.currency,
      precision: money.precision
    };
  }

  /**
   * 通貨を変換
   */
  static convert(money: Money, rate: ExchangeRate): Money {
    if (money.currency !== rate.from) {
      throw new Error('Currency mismatch');
    }
    
    return {
      amount: Math.round(money.amount * rate.rate),
      currency: rate.to,
      precision: money.precision
    };
  }
}

/**
 * 金額バリデーター
 */
export class MoneyValidator {
  /**
   * 金額が正の値か検証
   */
  static isPositive(money: Money): boolean {
    return money.amount > 0;
  }

  /**
   * 金額が負の値か検証
   */
  static isNegative(money: Money): boolean {
    return money.amount < 0;
  }

  /**
   * 金額がゼロか検証
   */
  static isZero(money: Money): boolean {
    return money.amount === 0;
  }

  /**
   * 金額が範囲内か検証
   */
  static isInRange(money: Money, range: MoneyRange): boolean {
    return MoneyCalculator.compare(money, range.min) >= 0 &&
           MoneyCalculator.compare(money, range.max) <= 0;
  }

  /**
   * 金額が有効か検証
   */
  static isValid(money: Money): boolean {
    return (
      typeof money.amount === 'number' &&
      !isNaN(money.amount) &&
      isFinite(money.amount) &&
      typeof money.currency === 'string' &&
      money.currency.length === 3 &&
      typeof money.precision === 'number' &&
      money.precision >= 0
    );
  }
}

/**
 * ヘルパー関数
 */

/**
 * Money オブジェクトを作成
 */
export function createMoney(amount: number, currency: Currency = 'JPY', precision: number = 0): Money {
  return {
    amount: Math.round(amount * Math.pow(10, precision)),
    currency,
    precision
  };
}

/**
 * 文字列から Money オブジェクトを作成
 */
export function parseMoney(value: string, currency: Currency = 'JPY', precision: number = 0): Money {
  return MoneyCalculator.fromString(value, currency, precision);
}

/**
 * Money を加算
 */
export function addMoney(a: Money, b: Money): Money {
  return MoneyCalculator.add(a, b);
}

/**
 * Money を減算
 */
export function subtractMoney(a: Money, b: Money): Money {
  return MoneyCalculator.subtract(a, b);
}

/**
 * Money を乗算
 */
export function multiplyMoney(money: Money, multiplier: number): Money {
  return MoneyCalculator.multiply(money, multiplier);
}

/**
 * Money を除算
 */
export function divideMoney(money: Money, divisor: number): Money {
  return MoneyCalculator.divide(money, divisor);
}

/**
 * Money をフォーマット
 */
export function formatMoney(money: Money, locale: string = 'ja-JP'): string {
  return MoneyCalculator.format(money, locale);
}

/**
 * ゼロ金額を作成
 */
export function zeroMoney(currency: Currency = 'JPY', precision: number = 0): Money {
  return MoneyCalculator.zero(currency, precision);
}

/**
 * Money の合計を計算
 */
export function sumMoney(moneys: Money[]): Money {
  return MoneyCalculator.sum(moneys);
}

/**
 * Money が正の値か判定
 */
export function isPositiveMoney(money: Money): boolean {
  return MoneyValidator.isPositive(money);
}

/**
 * Money がゼロか判定
 */
export function isZeroMoney(money: Money): boolean {
  return MoneyValidator.isZero(money);
}

/**
 * Money が等しいか判定
 */
export function equalsMoney(a: Money, b: Money): boolean {
  return MoneyCalculator.equals(a, b);
}

/**
 * Money を比較
 */
export function compareMoney(a: Money, b: Money): number {
  return MoneyCalculator.compare(a, b);
}