/**
 * 日時関連の型定義
 * DateTime-related Type Definitions
 */

import { Timezone } from './index';

/**
 * DateTime型 - タイムゾーン付き日時
 */
export interface DateTime {
  date: Date;
  timezone: string;
  offset: number; // offset in minutes
}

/**
 * 日付範囲
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * 時刻
 */
export interface Time {
  hours: number;
  minutes: number;
  seconds?: number;
  milliseconds?: number;
}

/**
 * 時間範囲
 */
export interface TimeRange {
  start: Time;
  end: Time;
}

/**
 * 営業時間
 */
export interface BusinessHours {
  dayOfWeek: DayOfWeek;
  ranges: TimeRange[];
  isHoliday?: boolean;
}

/**
 * 曜日
 */
export enum DayOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6
}

/**
 * 期間の単位
 */
export type DurationUnit = 
  | 'milliseconds'
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years';

/**
 * 期間
 */
export interface Duration {
  value: number;
  unit: DurationUnit;
}

/**
 * 定期的なスケジュール
 */
export interface RecurringSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: DayOfWeek[];
  dayOfMonth?: number;
  monthOfYear?: number;
  time?: Time;
  timezone: Timezone;
  startDate: Date;
  endDate?: Date;
  exceptions?: Date[];
}

/**
 * カレンダーイベント
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDateTime: Date;
  endDateTime: Date;
  allDay: boolean;
  recurring?: RecurringSchedule;
  timezone: Timezone;
  location?: string;
  attendees?: string[];
  reminders?: Duration[];
}

/**
 * 祝日
 */
export interface Holiday {
  date: Date;
  name: string;
  type: 'national' | 'bank' | 'observance';
  country: string;
}

/**
 * 労働時間
 */
export interface WorkingHours {
  date: Date;
  startTime: Date;
  endTime: Date;
  breakDuration: Duration;
  overtime?: Duration;
  holidayWork?: boolean;
  nightWork?: boolean;
}

/**
 * 日時計算ユーティリティ
 */
export class DateTimeCalculator {
  /**
   * 日付を加算
   */
  static add(date: Date, duration: Duration): Date {
    const result = new Date(date);
    
    switch (duration.unit) {
      case 'milliseconds':
        result.setMilliseconds(result.getMilliseconds() + duration.value);
        break;
      case 'seconds':
        result.setSeconds(result.getSeconds() + duration.value);
        break;
      case 'minutes':
        result.setMinutes(result.getMinutes() + duration.value);
        break;
      case 'hours':
        result.setHours(result.getHours() + duration.value);
        break;
      case 'days':
        result.setDate(result.getDate() + duration.value);
        break;
      case 'weeks':
        result.setDate(result.getDate() + duration.value * 7);
        break;
      case 'months':
        result.setMonth(result.getMonth() + duration.value);
        break;
      case 'years':
        result.setFullYear(result.getFullYear() + duration.value);
        break;
    }
    
    return result;
  }

  /**
   * 日付を減算
   */
  static subtract(date: Date, duration: Duration): Date {
    return this.add(date, { ...duration, value: -duration.value });
  }

  /**
   * 日付間の期間を計算
   */
  static diff(start: Date, end: Date, unit: DurationUnit): number {
    const diffMs = end.getTime() - start.getTime();
    
    switch (unit) {
      case 'milliseconds':
        return diffMs;
      case 'seconds':
        return Math.floor(diffMs / 1000);
      case 'minutes':
        return Math.floor(diffMs / (1000 * 60));
      case 'hours':
        return Math.floor(diffMs / (1000 * 60 * 60));
      case 'days':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
      case 'weeks':
        return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
      case 'months':
        return (end.getFullYear() - start.getFullYear()) * 12 + 
               (end.getMonth() - start.getMonth());
      case 'years':
        return end.getFullYear() - start.getFullYear();
    }
  }

  /**
   * 日付が範囲内か判定
   */
  static isInRange(date: Date, range: DateRange): boolean {
    return date >= range.start && date <= range.end;
  }

  /**
   * 営業日か判定
   */
  static isBusinessDay(date: Date, holidays: Holiday[] = []): boolean {
    const dayOfWeek = date.getDay();
    
    // 週末チェック
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return false;
    }
    
    // 祝日チェック
    return !holidays.some(holiday => 
      this.isSameDay(date, holiday.date)
    );
  }

  /**
   * 同じ日か判定
   */
  static isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  /**
   * 同じ月か判定
   */
  static isSameMonth(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth();
  }

  /**
   * 月の開始日を取得
   */
  static startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /**
   * 月の終了日を取得
   */
  static endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  /**
   * 週の開始日を取得
   */
  static startOfWeek(date: Date, startDay: DayOfWeek = DayOfWeek.Monday): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = (day < startDay ? 7 : 0) + day - startDay;
    result.setDate(result.getDate() - diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  /**
   * 週の終了日を取得
   */
  static endOfWeek(date: Date, startDay: DayOfWeek = DayOfWeek.Monday): Date {
    const result = this.startOfWeek(date, startDay);
    result.setDate(result.getDate() + 6);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  /**
   * 日付をフォーマット
   */
  static format(date: Date, format: string, locale: string = 'ja-JP'): string {
    // 簡易的なフォーマット実装
    const formatter = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    return formatter.format(date);
  }

  /**
   * 次の営業日を取得
   */
  static nextBusinessDay(date: Date, holidays: Holiday[] = []): Date {
    let result = new Date(date);
    result.setDate(result.getDate() + 1);
    
    while (!this.isBusinessDay(result, holidays)) {
      result.setDate(result.getDate() + 1);
    }
    
    return result;
  }

  /**
   * 営業日数を計算
   */
  static businessDaysBetween(start: Date, end: Date, holidays: Holiday[] = []): number {
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      if (this.isBusinessDay(current, holidays)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  /**
   * タイムゾーン変換
   */
  static convertTimezone(date: Date, from: Timezone, to: Timezone): Date {
    // 簡易的な実装（実際にはより複雑な処理が必要）
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: from,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const dateString = parts.map(p => p.value).join('');
    
    return new Date(dateString + ' ' + to);
  }

  /**
   * 年の開始日を取得
   */
  static startOfYear(date: Date): Date {
    return new Date(date.getFullYear(), 0, 1);
  }

  /**
   * 年の終了日を取得
   */
  static endOfYear(date: Date): Date {
    return new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  /**
   * 営業日を加算
   */
  static addBusinessDays(date: Date, days: number, holidays: Holiday[] = []): Date {
    let result = new Date(date);
    let remaining = Math.abs(days);
    const direction = days > 0 ? 1 : -1;
    
    while (remaining > 0) {
      result.setDate(result.getDate() + direction);
      if (this.isBusinessDay(result, holidays)) {
        remaining--;
      }
    }
    
    return result;
  }

  /**
   * 労働時間を計算
   */
  static calculateWorkingHours(
    startTime: Date,
    endTime: Date,
    breakMinutes: number = 0
  ): Duration {
    const totalMinutes = this.diff(startTime, endTime, 'minutes');
    const workingMinutes = totalMinutes - breakMinutes;
    
    return {
      value: workingMinutes,
      unit: 'minutes'
    };
  }

  /**
   * 深夜労働時間を計算（22:00-5:00）
   */
  static calculateNightWorkHours(
    startTime: Date,
    endTime: Date
  ): Duration {
    let nightMinutes = 0;
    const current = new Date(startTime);
    
    while (current < endTime) {
      const hour = current.getHours();
      if (hour >= 22 || hour < 5) {
        nightMinutes++;
      }
      current.setMinutes(current.getMinutes() + 1);
    }
    
    return {
      value: nightMinutes,
      unit: 'minutes'
    };
  }
}

/**
 * 日時バリデーター
 */
export class DateTimeValidator {
  /**
   * 有効な日付か検証
   */
  static isValidDate(date: any): date is Date {
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * 有効な時刻か検証
   */
  static isValidTime(time: Time): boolean {
    return time.hours >= 0 && time.hours < 24 &&
           time.minutes >= 0 && time.minutes < 60 &&
           (time.seconds === undefined || (time.seconds >= 0 && time.seconds < 60)) &&
           (time.milliseconds === undefined || (time.milliseconds >= 0 && time.milliseconds < 1000));
  }

  /**
   * 有効な日付範囲か検証
   */
  static isValidDateRange(range: DateRange): boolean {
    return this.isValidDate(range.start) &&
           this.isValidDate(range.end) &&
           range.start <= range.end;
  }

  /**
   * 有効な時間範囲か検証
   */
  static isValidTimeRange(range: TimeRange): boolean {
    return this.isValidTime(range.start) && this.isValidTime(range.end);
  }

  /**
   * 過去の日付か検証
   */
  static isPast(date: Date): boolean {
    return date < new Date();
  }

  /**
   * 未来の日付か検証
   */
  static isFuture(date: Date): boolean {
    return date > new Date();
  }

  /**
   * 今日か検証
   */
  static isToday(date: Date): boolean {
    return DateTimeCalculator.isSameDay(date, new Date());
  }
}

/**
 * ヘルパー関数
 */

/**
 * DateTimeFactory - DateTime オブジェクトの生成
 */
export const DateTimeFactory = {
  fromDate(date: Date, timezone?: string): DateTime {
    return {
      date,
      timezone: timezone || 'Asia/Tokyo',
      offset: 9 * 60 // JST offset in minutes
    };
  },

  now(timezone?: string): DateTime {
    return this.fromDate(new Date(), timezone);
  }
};

/**
 * DateTimeFormatter - DateTime のフォーマット
 */
export const DateTimeFormatter = {
  format(datetime: DateTime, pattern: string): string {
    const date = datetime.date;
    const replacements: Record<string, string> = {
      'yyyy': date.getFullYear().toString(),
      'yy': date.getFullYear().toString().slice(-2),
      'MM': (date.getMonth() + 1).toString().padStart(2, '0'),
      'M': (date.getMonth() + 1).toString(),
      'dd': date.getDate().toString().padStart(2, '0'),
      'd': date.getDate().toString(),
      'HH': date.getHours().toString().padStart(2, '0'),
      'H': date.getHours().toString(),
      'mm': date.getMinutes().toString().padStart(2, '0'),
      'm': date.getMinutes().toString(),
      'ss': date.getSeconds().toString().padStart(2, '0'),
      's': date.getSeconds().toString(),
    };

    let formatted = pattern;
    Object.entries(replacements).forEach(([key, value]) => {
      formatted = formatted.replace(new RegExp(key, 'g'), value);
    });

    return formatted;
  },

  formatJapanese(datetime: DateTime): string {
    const date = datetime.date;
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}時${date.getMinutes()}分`;
  }
};

/**
 * DateTime オブジェクトを作成
 */
export function createDateTime(value: Date | string | number, timezone?: string): DateTime {
  const date = value instanceof Date ? value : new Date(value);
  return DateTimeFactory.fromDate(date, timezone);
}

/**
 * 現在の DateTime を取得
 */
export function nowDateTime(timezone?: string): DateTime {
  return DateTimeFactory.now(timezone);
}

/**
 * DateTime をフォーマット
 */
export function formatDateTime(datetime: DateTime, pattern: string = 'yyyy-MM-dd HH:mm:ss'): string {
  return DateTimeFormatter.format(datetime, pattern);
}

/**
 * DateTime を日本語形式でフォーマット
 */
export function formatDateTimeJapanese(datetime: DateTime): string {
  return DateTimeFormatter.formatJapanese(datetime);
}

/**
 * 日付範囲を作成
 */
export function createDateRange(start: Date | string, end: Date | string): DateRange {
  return {
    start: start instanceof Date ? start : new Date(start),
    end: end instanceof Date ? end : new Date(end)
  };
}

/**
 * 時刻を作成
 */
export function createTime(hours: number, minutes: number, seconds?: number, milliseconds?: number): Time {
  return { hours, minutes, seconds, milliseconds };
}

/**
 * DateTime を加算
 */
export function addDateTime(datetime: DateTime, duration: Duration): DateTime {
  const newDate = DateTimeCalculator.add(datetime.date, duration);
  return {
    ...datetime,
    date: newDate
  };
}

/**
 * DateTime を減算
 */
export function subtractDateTime(datetime: DateTime, duration: Duration): DateTime {
  const newDate = DateTimeCalculator.subtract(datetime.date, duration);
  return {
    ...datetime,
    date: newDate
  };
}

/**
 * DateTime 間の差分を計算
 */
export function diffDateTime(a: DateTime, b: DateTime, unit: DurationUnit = 'milliseconds'): number {
  return DateTimeCalculator.diff(a.date, b.date, unit);
}

/**
 * 営業日を計算
 */
export function addBusinessDays(date: Date, days: number, holidays?: Holiday[]): Date {
  return DateTimeCalculator.addBusinessDays(date, days, holidays);
}

/**
 * 営業日数を計算
 */
export function businessDaysBetween(start: Date, end: Date, holidays?: Holiday[]): number {
  return DateTimeCalculator.businessDaysBetween(start, end, holidays);
}

/**
 * 月の開始日を取得
 */
export function startOfMonth(date: Date): Date {
  return DateTimeCalculator.startOfMonth(date);
}

/**
 * 月の終了日を取得
 */
export function endOfMonth(date: Date): Date {
  return DateTimeCalculator.endOfMonth(date);
}

/**
 * 年の開始日を取得
 */
export function startOfYear(date: Date): Date {
  return DateTimeCalculator.startOfYear(date);
}

/**
 * 年の終了日を取得
 */
export function endOfYear(date: Date): Date {
  return DateTimeCalculator.endOfYear(date);
}

/**
 * 同じ日か判定
 */
export function isSameDay(a: Date, b: Date): boolean {
  return DateTimeCalculator.isSameDay(a, b);
}

/**
 * 同じ月か判定
 */
export function isSameMonth(a: Date, b: Date): boolean {
  return DateTimeCalculator.isSameMonth(a, b);
}

/**
 * 日付が範囲内か判定
 */
export function isDateInRange(date: Date, range: DateRange): boolean {
  return DateTimeCalculator.isInRange(date, range);
}

/**
 * 有効な日付か判定
 */
export function isValidDate(date: any): date is Date {
  return DateTimeValidator.isValidDate(date);
}

/**
 * 過去の日付か判定
 */
export function isPastDate(date: Date): boolean {
  return DateTimeValidator.isPast(date);
}

/**
 * 未来の日付か判定
 */
export function isFutureDate(date: Date): boolean {
  return DateTimeValidator.isFuture(date);
}

/**
 * 今日か判定
 */
export function isTodayDate(date: Date): boolean {
  return DateTimeValidator.isToday(date);
}