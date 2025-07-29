/**
 * AI-OS v3.2.0 条件付きRBACサービス
 * Conditional Role-Based Access Control Service
 * 
 * 金額上限、時間帯制限、部門制限などの詳細な権限制御
 */

import { EventEmitter } from 'events';

// ===== 型定義 =====

export interface ConditionalPermission {
  id: string;
  resource: string;
  action: string;
  conditions: PermissionConditions;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface PermissionConditions {
  amountLimit?: AmountCondition;
  timeRestriction?: TimeRestriction;
  departmentScope?: DepartmentScope;
  geoRestriction?: GeoRestriction;
  customRules?: CustomRule[];
  combinationLogic?: 'AND' | 'OR';
}

export interface AmountCondition {
  min?: number;
  max?: number;
  currency?: string;
  periodLimit?: {
    amount: number;
    period: 'daily' | 'weekly' | 'monthly' | 'yearly';
    used?: number;
  };
}

export interface TimeRestriction {
  allowedDays?: number[]; // 0-6 (日-土)
  allowedHours?: { start: string; end: string }[];
  timezone?: string;
  excludeHolidays?: boolean;
  excludeWeekends?: boolean;
}

export interface DepartmentScope {
  mode: 'include' | 'exclude';
  departments: string[];
  includeSubs?: boolean;
}

export interface GeoRestriction {
  allowedCountries?: string[];
  allowedRegions?: string[];
  allowedIPs?: string[];
  blockedCountries?: string[];
  blockedRegions?: string[];
  blockedIPs?: string[];
}

export interface CustomRule {
  id: string;
  name: string;
  description?: string;
  expression: string; // JavaScriptの条件式
  parameters?: Record<string, any>;
}

export interface PermissionContext {
  userId: string;
  userRole: string;
  userDepartment: string;
  requestTime: Date;
  requestIP?: string;
  requestLocation?: {
    country: string;
    region: string;
    city: string;
  };
  resourceData?: Record<string, any>;
  amount?: number;
  currency?: string;
}

export interface PermissionEvaluation {
  allowed: boolean;
  permission?: ConditionalPermission;
  matchedConditions: string[];
  failedConditions: string[];
  warnings?: string[];
  metadata?: Record<string, any>;
}

export interface ConditionBuilder {
  build(): PermissionConditions;
  withAmountLimit(min?: number, max?: number): ConditionBuilder;
  withTimeRestriction(restriction: TimeRestriction): ConditionBuilder;
  withDepartmentScope(mode: 'include' | 'exclude', departments: string[]): ConditionBuilder;
  withGeoRestriction(restriction: GeoRestriction): ConditionBuilder;
  withCustomRule(rule: CustomRule): ConditionBuilder;
  withCombinationLogic(logic: 'AND' | 'OR'): ConditionBuilder;
}

// ===== カスタムルール評価エンジン =====

class RuleEvaluator {
  private sandbox: any;

  constructor() {
    // セキュアなサンドボックス環境の作成
    this.sandbox = this.createSecureSandbox();
  }

  private createSecureSandbox(): any {
    // 許可された関数のみを含むサンドボックス
    return {
      Math: Math,
      Date: Date,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      // カスタム関数
      between: (value: number, min: number, max: number) => value >= min && value <= max,
      includes: (array: any[], value: any) => array.includes(value),
      matches: (value: string, pattern: string) => new RegExp(pattern).test(value)
    };
  }

  evaluate(expression: string, context: Record<string, any>): boolean {
    try {
      // コンテキストをサンドボックスに追加
      const evalContext = { ...this.sandbox, ...context };
      
      // 安全な評価関数の作成
      const func = new Function(...Object.keys(evalContext), `return ${expression}`);
      
      // 評価の実行
      return func(...Object.values(evalContext));
    } catch (error) {
      console.error('Rule evaluation error:', error);
      return false;
    }
  }
}

// ===== メインサービスクラス =====

export class ConditionalRBACService extends EventEmitter {
  private permissions: Map<string, ConditionalPermission>;
  private rolePermissions: Map<string, Set<string>>;
  private ruleEvaluator: RuleEvaluator;
  private cache: Map<string, { result: PermissionEvaluation; timestamp: number }>;
  private cacheTimeout: number = 60000; // 1分

  constructor() {
    super();
    this.permissions = new Map();
    this.rolePermissions = new Map();
    this.ruleEvaluator = new RuleEvaluator();
    this.cache = new Map();
    
    // キャッシュクリーンアップ
    setInterval(() => this.cleanupCache(), this.cacheTimeout);
  }

  /**
   * 条件付き権限の作成
   */
  createPermission(
    role: string,
    resource: string,
    action: string,
    conditions: PermissionConditions,
    createdBy: string
  ): ConditionalPermission {
    const permission: ConditionalPermission = {
      id: `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      resource,
      action,
      conditions,
      priority: this.calculatePriority(conditions),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy
    };

    // 権限の保存
    this.permissions.set(permission.id, permission);
    
    // ロールとの関連付け
    if (!this.rolePermissions.has(role)) {
      this.rolePermissions.set(role, new Set());
    }
    this.rolePermissions.get(role)!.add(permission.id);

    this.emit('permission:created', { role, permission });
    
    return permission;
  }

  /**
   * 権限の評価
   */
  async evaluatePermission(
    role: string,
    resource: string,
    action: string,
    context: PermissionContext
  ): Promise<PermissionEvaluation> {
    // キャッシュチェック
    const cacheKey = this.generateCacheKey(role, resource, action, context);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.result;
    }

    // ロールに関連する権限を取得
    const rolePermIds = this.rolePermissions.get(role) || new Set();
    const relevantPermissions: ConditionalPermission[] = [];

    for (const permId of rolePermIds) {
      const perm = this.permissions.get(permId);
      if (perm && perm.enabled && perm.resource === resource && perm.action === action) {
        relevantPermissions.push(perm);
      }
    }

    // 優先度順にソート
    relevantPermissions.sort((a, b) => b.priority - a.priority);

    // 各権限を評価
    for (const permission of relevantPermissions) {
      const evaluation = await this.evaluateConditions(permission, context);
      
      if (evaluation.allowed) {
        // キャッシュに保存
        this.cache.set(cacheKey, { result: evaluation, timestamp: Date.now() });
        return evaluation;
      }
    }

    // すべての権限が拒否された場合
    const deniedEvaluation: PermissionEvaluation = {
      allowed: false,
      matchedConditions: [],
      failedConditions: ['No matching permissions found'],
      warnings: ['Access denied by all conditional permissions']
    };

    this.cache.set(cacheKey, { result: deniedEvaluation, timestamp: Date.now() });
    return deniedEvaluation;
  }

  /**
   * 条件の評価
   */
  private async evaluateConditions(
    permission: ConditionalPermission,
    context: PermissionContext
  ): Promise<PermissionEvaluation> {
    const matchedConditions: string[] = [];
    const failedConditions: string[] = [];
    const warnings: string[] = [];

    const conditions = permission.conditions;
    const logic = conditions.combinationLogic || 'AND';
    
    const evaluations: Array<{ name: string; result: boolean }> = [];

    // 金額制限の評価
    if (conditions.amountLimit) {
      const result = await this.evaluateAmountLimit(conditions.amountLimit, context);
      evaluations.push({ name: 'amountLimit', result: result.allowed });
      if (result.allowed) {
        matchedConditions.push(`Amount limit: ${result.message}`);
      } else {
        failedConditions.push(`Amount limit: ${result.message}`);
      }
      if (result.warning) warnings.push(result.warning);
    }

    // 時間制限の評価
    if (conditions.timeRestriction) {
      const result = this.evaluateTimeRestriction(conditions.timeRestriction, context);
      evaluations.push({ name: 'timeRestriction', result: result.allowed });
      if (result.allowed) {
        matchedConditions.push(`Time restriction: ${result.message}`);
      } else {
        failedConditions.push(`Time restriction: ${result.message}`);
      }
    }

    // 部門制限の評価
    if (conditions.departmentScope) {
      const result = this.evaluateDepartmentScope(conditions.departmentScope, context);
      evaluations.push({ name: 'departmentScope', result: result.allowed });
      if (result.allowed) {
        matchedConditions.push(`Department scope: ${result.message}`);
      } else {
        failedConditions.push(`Department scope: ${result.message}`);
      }
    }

    // 地理的制限の評価
    if (conditions.geoRestriction) {
      const result = this.evaluateGeoRestriction(conditions.geoRestriction, context);
      evaluations.push({ name: 'geoRestriction', result: result.allowed });
      if (result.allowed) {
        matchedConditions.push(`Geo restriction: ${result.message}`);
      } else {
        failedConditions.push(`Geo restriction: ${result.message}`);
      }
    }

    // カスタムルールの評価
    if (conditions.customRules) {
      for (const rule of conditions.customRules) {
        const result = this.evaluateCustomRule(rule, context);
        evaluations.push({ name: `customRule:${rule.name}`, result });
        if (result) {
          matchedConditions.push(`Custom rule: ${rule.name}`);
        } else {
          failedConditions.push(`Custom rule: ${rule.name}`);
        }
      }
    }

    // 論理演算に基づく最終評価
    let allowed: boolean;
    if (evaluations.length === 0) {
      allowed = true; // 条件がない場合は許可
    } else if (logic === 'AND') {
      allowed = evaluations.every(e => e.result);
    } else {
      allowed = evaluations.some(e => e.result);
    }

    return {
      allowed,
      permission,
      matchedConditions,
      failedConditions,
      warnings,
      metadata: {
        evaluationCount: evaluations.length,
        logic,
        timestamp: new Date()
      }
    };
  }

  /**
   * 金額制限の評価
   */
  private async evaluateAmountLimit(
    limit: AmountCondition,
    context: PermissionContext
  ): Promise<{ allowed: boolean; message: string; warning?: string }> {
    if (context.amount === undefined) {
      return { allowed: true, message: 'No amount specified' };
    }

    // 最小値・最大値チェック
    if (limit.min !== undefined && context.amount < limit.min) {
      return { 
        allowed: false, 
        message: `Amount ${context.amount} is below minimum ${limit.min}` 
      };
    }

    if (limit.max !== undefined && context.amount > limit.max) {
      return { 
        allowed: false, 
        message: `Amount ${context.amount} exceeds maximum ${limit.max}` 
      };
    }

    // 期間制限チェック
    if (limit.periodLimit) {
      const used = await this.getUsedAmount(
        context.userId, 
        limit.periodLimit.period,
        context.currency || 'JPY'
      );
      
      const remaining = limit.periodLimit.amount - used;
      
      if (context.amount > remaining) {
        return {
          allowed: false,
          message: `Amount ${context.amount} exceeds period limit. Remaining: ${remaining}`
        };
      }

      // 警告（80%以上使用）
      const usage = (used + context.amount) / limit.periodLimit.amount;
      if (usage >= 0.8) {
        return {
          allowed: true,
          message: `Within period limit`,
          warning: `${Math.round(usage * 100)}% of period limit will be used`
        };
      }
    }

    return { allowed: true, message: 'Amount within limits' };
  }

  /**
   * 時間制限の評価
   */
  private evaluateTimeRestriction(
    restriction: TimeRestriction,
    context: PermissionContext
  ): { allowed: boolean; message: string } {
    const now = context.requestTime;
    const timezone = restriction.timezone || 'Asia/Tokyo';
    
    // 曜日チェック
    if (restriction.allowedDays) {
      const dayOfWeek = now.getDay();
      if (!restriction.allowedDays.includes(dayOfWeek)) {
        return { 
          allowed: false, 
          message: `Access not allowed on ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek]}` 
        };
      }
    }

    // 週末除外チェック
    if (restriction.excludeWeekends) {
      const dayOfWeek = now.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { allowed: false, message: 'Access not allowed on weekends' };
      }
    }

    // 時間帯チェック
    if (restriction.allowedHours) {
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentTime = hours * 60 + minutes;

      const isAllowed = restriction.allowedHours.some(range => {
        const [startH, startM] = range.start.split(':').map(Number);
        const [endH, endM] = range.end.split(':').map(Number);
        const startTime = startH * 60 + startM;
        const endTime = endH * 60 + endM;

        if (startTime <= endTime) {
          return currentTime >= startTime && currentTime <= endTime;
        } else {
          // 日を跨ぐ場合
          return currentTime >= startTime || currentTime <= endTime;
        }
      });

      if (!isAllowed) {
        return { allowed: false, message: 'Access not allowed at this time' };
      }
    }

    // 祝日除外チェック（実装簡略化）
    if (restriction.excludeHolidays) {
      const isHoliday = this.checkHoliday(now);
      if (isHoliday) {
        return { allowed: false, message: 'Access not allowed on holidays' };
      }
    }

    return { allowed: true, message: 'Time restriction passed' };
  }

  /**
   * 部門制限の評価
   */
  private evaluateDepartmentScope(
    scope: DepartmentScope,
    context: PermissionContext
  ): { allowed: boolean; message: string } {
    const userDept = context.userDepartment;
    const departments = scope.departments;
    
    let isInScope: boolean;
    
    if (scope.includeSubs) {
      // サブ部門を含む場合
      isInScope = departments.some(dept => 
        userDept.startsWith(dept) || dept.startsWith(userDept)
      );
    } else {
      isInScope = departments.includes(userDept);
    }

    if (scope.mode === 'include') {
      return {
        allowed: isInScope,
        message: isInScope ? 'Department in allowed list' : 'Department not in allowed list'
      };
    } else {
      return {
        allowed: !isInScope,
        message: !isInScope ? 'Department not in excluded list' : 'Department in excluded list'
      };
    }
  }

  /**
   * 地理的制限の評価
   */
  private evaluateGeoRestriction(
    restriction: GeoRestriction,
    context: PermissionContext
  ): { allowed: boolean; message: string } {
    if (!context.requestLocation && !context.requestIP) {
      return { allowed: true, message: 'No location data available' };
    }

    // IPアドレスチェック
    if (context.requestIP) {
      if (restriction.blockedIPs?.includes(context.requestIP)) {
        return { allowed: false, message: 'IP address is blocked' };
      }
      if (restriction.allowedIPs && !restriction.allowedIPs.includes(context.requestIP)) {
        return { allowed: false, message: 'IP address not in allowed list' };
      }
    }

    // 地域チェック
    if (context.requestLocation) {
      const { country, region } = context.requestLocation;
      
      if (restriction.blockedCountries?.includes(country)) {
        return { allowed: false, message: `Country ${country} is blocked` };
      }
      if (restriction.allowedCountries && !restriction.allowedCountries.includes(country)) {
        return { allowed: false, message: `Country ${country} not in allowed list` };
      }
      
      if (restriction.blockedRegions?.includes(region)) {
        return { allowed: false, message: `Region ${region} is blocked` };
      }
      if (restriction.allowedRegions && !restriction.allowedRegions.includes(region)) {
        return { allowed: false, message: `Region ${region} not in allowed list` };
      }
    }

    return { allowed: true, message: 'Geo restriction passed' };
  }

  /**
   * カスタムルールの評価
   */
  private evaluateCustomRule(rule: CustomRule, context: PermissionContext): boolean {
    const evalContext = {
      ...context,
      ...rule.parameters,
      // ヘルパー関数
      now: () => new Date(),
      daysSince: (date: Date) => Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
    };

    return this.ruleEvaluator.evaluate(rule.expression, evalContext);
  }

  /**
   * 優先度の計算
   */
  private calculatePriority(conditions: PermissionConditions): number {
    let priority = 0;
    
    // 条件の複雑さに基づいて優先度を設定
    if (conditions.amountLimit) priority += 10;
    if (conditions.timeRestriction) priority += 5;
    if (conditions.departmentScope) priority += 8;
    if (conditions.geoRestriction) priority += 7;
    if (conditions.customRules) priority += conditions.customRules.length * 3;
    
    // AND条件はより厳格なので優先度を上げる
    if (conditions.combinationLogic === 'AND') priority += 5;
    
    return priority;
  }

  /**
   * 使用済み金額の取得（実装例）
   */
  private async getUsedAmount(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    currency: string
  ): Promise<number> {
    // 実際の実装では、データベースから期間内の使用金額を集計
    // ここでは簡略化
    return 0;
  }

  /**
   * 祝日チェック（実装例）
   */
  private checkHoliday(date: Date): boolean {
    // 実際の実装では、祝日カレンダーAPIなどを使用
    // ここでは簡略化
    return false;
  }

  /**
   * キャッシュキーの生成
   */
  private generateCacheKey(
    role: string,
    resource: string,
    action: string,
    context: PermissionContext
  ): string {
    return `${role}:${resource}:${action}:${context.userId}:${context.userDepartment}`;
  }

  /**
   * キャッシュのクリーンアップ
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((value, key) => {
      if (now - value.timestamp > this.cacheTimeout) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.cache.delete(key));
  }

  /**
   * 条件ビルダーの作成
   */
  createConditionBuilder(): ConditionBuilder {
    return new ConditionalPermissionBuilder();
  }

  /**
   * 権限の更新
   */
  updatePermission(
    permissionId: string,
    updates: Partial<ConditionalPermission>,
    updatedBy: string
  ): ConditionalPermission | null {
    const permission = this.permissions.get(permissionId);
    if (!permission) return null;

    const updated = {
      ...permission,
      ...updates,
      updatedAt: new Date(),
      id: permission.id // IDは変更不可
    };

    this.permissions.set(permissionId, updated);
    this.emit('permission:updated', { permission: updated, updatedBy });
    
    // キャッシュをクリア
    this.cache.clear();
    
    return updated;
  }

  /**
   * 権限の削除
   */
  deletePermission(permissionId: string, deletedBy: string): boolean {
    const permission = this.permissions.get(permissionId);
    if (!permission) return false;

    this.permissions.delete(permissionId);
    
    // ロールとの関連付けを削除
    this.rolePermissions.forEach(permIds => {
      permIds.delete(permissionId);
    });

    this.emit('permission:deleted', { permissionId, deletedBy });
    
    // キャッシュをクリア
    this.cache.clear();
    
    return true;
  }

  /**
   * ロールの全権限取得
   */
  getRolePermissions(role: string): ConditionalPermission[] {
    const permIds = this.rolePermissions.get(role) || new Set();
    const permissions: ConditionalPermission[] = [];

    for (const permId of permIds) {
      const perm = this.permissions.get(permId);
      if (perm) permissions.push(perm);
    }

    return permissions;
  }
}

// ===== 条件ビルダー実装 =====

class ConditionalPermissionBuilder implements ConditionBuilder {
  private conditions: PermissionConditions = {};

  build(): PermissionConditions {
    return { ...this.conditions };
  }

  withAmountLimit(min?: number, max?: number): ConditionBuilder {
    this.conditions.amountLimit = { min, max };
    return this;
  }

  withTimeRestriction(restriction: TimeRestriction): ConditionBuilder {
    this.conditions.timeRestriction = restriction;
    return this;
  }

  withDepartmentScope(mode: 'include' | 'exclude', departments: string[]): ConditionBuilder {
    this.conditions.departmentScope = { mode, departments };
    return this;
  }

  withGeoRestriction(restriction: GeoRestriction): ConditionBuilder {
    this.conditions.geoRestriction = restriction;
    return this;
  }

  withCustomRule(rule: CustomRule): ConditionBuilder {
    if (!this.conditions.customRules) {
      this.conditions.customRules = [];
    }
    this.conditions.customRules.push(rule);
    return this;
  }

  withCombinationLogic(logic: 'AND' | 'OR'): ConditionBuilder {
    this.conditions.combinationLogic = logic;
    return this;
  }
}