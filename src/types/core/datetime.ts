/**
 * 日時関連の型定義
 * DateTime-related Type Definitions
 */

import { Timezone } from './index';

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