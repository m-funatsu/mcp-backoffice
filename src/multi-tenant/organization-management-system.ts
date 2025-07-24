/**
 * AI-OS マルチテナント・組織階層管理システム
 * 企業の複雑な組織構造とテナント分離を完全サポート
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// 組織タイプ
export enum OrganizationType {
  CORPORATION = 'corporation',         // 法人
  SUBSIDIARY = 'subsidiary',           // 子会社
  BRANCH = 'branch',                   // 支社・支店
  DEPARTMENT = 'department',           // 部署
  DIVISION = 'division',               // 事業部
  SECTION = 'section',                 // 課・係
  TEAM = 'team',                       // チーム
  PROJECT = 'project',                 // プロジェクト
  COST_CENTER = 'cost_center'          // コストセンター
}

// テナントタイプ
export enum TenantType {
  ENTERPRISE = 'enterprise',           // エンタープライズ（独立テナント）
  MULTI_COMPANY = 'multi_company',     // 複数法人管理
  SHARED = 'shared',                   // 共有テナント
  TRIAL = 'trial'                      // トライアル
}

// 組織階層レベル
export enum HierarchyLevel {
  LEVEL_1 = 1,  // 最上位（法人）
  LEVEL_2 = 2,  // 第2層（事業部・支社）
  LEVEL_3 = 3,  // 第3層（部署）
  LEVEL_4 = 4,  // 第4層（課・係）
  LEVEL_5 = 5,  // 第5層（チーム）
  LEVEL_6 = 6   // 第6層以下
}

// テナント設定
export interface TenantConfiguration {
  id: string;
  name: string;
  displayName: string;
  type: TenantType;
  subdomain: string;
  customDomain?: string;
  isActive: boolean;
  settings: TenantSettings;
  billing: BillingConfiguration;
  limits: TenantLimits;
  features: FeatureFlags;
  customization: TenantCustomization;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // トライアル用
}

// テナント設定
export interface TenantSettings {
  timezone: string;
  locale: string;
  currency: string;
  dateFormat: string;
  fiscalYearStart: number; // 1-12月
  workWeekStart: number;   // 0-6 (日-土)
  businessHours: BusinessHours;
  holidays: Holiday[];
  complianceRegion: string; // JP, US, EU等
}

// 営業時間設定
export interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

// 日別スケジュール
export interface DaySchedule {
  isWorkingDay: boolean;
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  breakTime?: {
    start: string;
    end: string;
  };
}

// 祝日設定
export interface Holiday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD or MM-DD (毎年)
  isRecurring: boolean;
  type: 'national' | 'company' | 'regional';
}

// 請求設定
export interface BillingConfiguration {
  plan: string;
  pricePerUser: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  paymentMethod?: string;
  billingContact: ContactInfo;
  invoiceSettings: InvoiceSettings;
}

// 請求書設定
export interface InvoiceSettings {
  recipientEmails: string[];
  autoSend: boolean;
  language: string;
  taxRate: number;
  taxId?: string;
}

// テナント制限
export interface TenantLimits {
  maxUsers: number;
  maxStorageGB: number;
  maxAPICallsPerMonth: number;
  maxOrganizations: number;
  maxHierarchyLevels: number;
  retentionMonths: number;
}

// 機能フラグ
export interface FeatureFlags {
  advancedAnalytics: boolean;
  aiPredictions: boolean;
  customReports: boolean;
  apiAccess: boolean;
  ssoIntegration: boolean;
  auditLogs: boolean;
  whiteLabeling: boolean;
  multiLanguage: boolean;
  mobileApp: boolean;
  slackIntegration: boolean;
  teamsIntegration: boolean;
  webhooks: boolean;
}

// テナントカスタマイゼーション
export interface TenantCustomization {
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
  customFields: CustomField[];
  workflows: WorkflowCustomization[];
  emailTemplates: EmailTemplate[];
}

// カスタムフィールド
export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect';
  required: boolean;
  options?: string[]; // select/multiselect用
  applyTo: 'employee' | 'timesheet' | 'expense' | 'all';
}

// ワークフロー設定
export interface WorkflowCustomization {
  id: string;
  name: string;
  type: 'approval' | 'notification' | 'automation';
  config: any;
}

// メールテンプレート
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'welcome' | 'reminder' | 'approval' | 'notification';
}

// 組織情報
export interface Organization {
  id: string;
  tenantId: string;
  parentId?: string;
  code: string;
  name: string;
  displayName: string;
  type: OrganizationType;
  level: HierarchyLevel;
  path: string; // /corp/div/dept形式
  isActive: boolean;
  manager?: EmployeeReference;
  settings: OrganizationSettings;
  metadata: OrganizationMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// 従業員参照
export interface EmployeeReference {
  id: string;
  name: string;
  email: string;
}

// 組織設定
export interface OrganizationSettings {
  budgetCenter?: string;
  costCenter?: string;
  location?: string;
  address?: Address;
  phone?: string;
  email?: string;
  defaultWorkingHours?: DaySchedule;
  overtimeRules?: OvertimeRules;
  approvalChain?: ApprovalChain[];
}

// 住所
export interface Address {
  country: string;
  postalCode: string;
  state: string;
  city: string;
  address1: string;
  address2?: string;
}

// 残業ルール
export interface OvertimeRules {
  dailyThreshold: number;    // 日次残業開始時間
  weeklyThreshold: number;   // 週次残業開始時間
  monthlyThreshold: number;  // 月次残業上限
  multipliers: {
    normal: number;          // 通常残業率
    lateNight: number;       // 深夜残業率
    holiday: number;         // 休日出勤率
  };
}

// 承認チェーン
export interface ApprovalChain {
  step: number;
  approverRole: string;
  approverIds?: string[];
  isRequired: boolean;
  type: 'any' | 'all' | 'majority';
}

// 組織メタデータ
export interface OrganizationMetadata {
  employeeCount: number;
  establishedDate?: Date;
  businessType?: string;
  description?: string;
  tags: string[];
  customAttributes: Record<string, any>;
}

// 連絡先情報
export interface ContactInfo {
  name: string;
  email: string;
  phone?: string;
  title?: string;
}

/**
 * マルチテナント・組織管理システム
 */
export class OrganizationManagementSystem extends EventEmitter {
  private tenants: Map<string, TenantConfiguration> = new Map();
  private organizations: Map<string, Organization> = new Map();
  private tenantsByDomain: Map<string, string> = new Map(); // domain -> tenantId
  private hierarchyCache: Map<string, Organization[]> = new Map();
  private accessController: TenantAccessController;
  private dataIsolationEngine: DataIsolationEngine;

  constructor() {
    super();
    this.accessController = new TenantAccessController();
    this.dataIsolationEngine = new DataIsolationEngine();
  }

  /**
   * テナント作成
   */
  async createTenant(config: Omit<TenantConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<TenantConfiguration> {
    const tenant: TenantConfiguration = {
      ...config,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // サブドメインの重複チェック
    if (this.tenantsByDomain.has(tenant.subdomain)) {
      throw new Error(`Subdomain already exists: ${tenant.subdomain}`);
    }

    // カスタムドメインの重複チェック
    if (tenant.customDomain && this.tenantsByDomain.has(tenant.customDomain)) {
      throw new Error(`Custom domain already exists: ${tenant.customDomain}`);
    }

    // テナントの保存
    this.tenants.set(tenant.id, tenant);
    this.tenantsByDomain.set(tenant.subdomain, tenant.id);
    if (tenant.customDomain) {
      this.tenantsByDomain.set(tenant.customDomain, tenant.id);
    }

    // デフォルト組織の作成
    await this.createRootOrganization(tenant);

    // データベーススキーマの初期化
    await this.dataIsolationEngine.initializeTenantSchema(tenant.id);

    this.emit('tenant:created', tenant);
    logger.info(`Tenant created: ${tenant.name} (${tenant.id})`);

    return tenant;
  }

  /**
   * ルート組織の作成
   */
  private async createRootOrganization(tenant: TenantConfiguration): Promise<Organization> {
    const rootOrg: Organization = {
      id: uuidv4(),
      tenantId: tenant.id,
      parentId: undefined,
      code: 'ROOT',
      name: tenant.name,
      displayName: tenant.displayName,
      type: OrganizationType.CORPORATION,
      level: HierarchyLevel.LEVEL_1,
      path: '/',
      isActive: true,
      settings: {
        defaultWorkingHours: {
          isWorkingDay: true,
          startTime: '09:00',
          endTime: '18:00',
          breakTime: { start: '12:00', end: '13:00' }
        },
        overtimeRules: {
          dailyThreshold: 8,
          weeklyThreshold: 40,
          monthlyThreshold: 45,
          multipliers: { normal: 1.25, lateNight: 1.5, holiday: 1.35 }
        },
        approvalChain: []
      },
      metadata: {
        employeeCount: 0,
        establishedDate: new Date(),
        tags: [],
        customAttributes: {}
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return this.createOrganization(rootOrg);
  }

  /**
   * 組織作成
   */
  async createOrganization(org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<Organization> {
    const organization: Organization = {
      ...org,
      id: org.id || uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 親組織の存在確認
    if (organization.parentId) {
      const parent = this.organizations.get(organization.parentId);
      if (!parent) {
        throw new Error(`Parent organization not found: ${organization.parentId}`);
      }
      
      // 階層レベルの自動設定
      organization.level = Math.min(parent.level + 1, HierarchyLevel.LEVEL_6) as HierarchyLevel;
      
      // パスの生成
      organization.path = `${parent.path}${parent.code}/`.replace('//', '/');
    }

    // 組織コードの重複チェック（テナント内）
    const existingOrg = Array.from(this.organizations.values())
      .find(o => o.tenantId === organization.tenantId && o.code === organization.code);
    if (existingOrg) {
      throw new Error(`Organization code already exists in tenant: ${organization.code}`);
    }

    // 組織の保存
    this.organizations.set(organization.id, organization);
    
    // 階層キャッシュの更新
    this.updateHierarchyCache(organization.tenantId);

    this.emit('organization:created', organization);
    logger.info(`Organization created: ${organization.name} (${organization.id})`);

    return organization;
  }

  /**
   * テナント取得（ドメインベース）
   */
  getTenantByDomain(domain: string): TenantConfiguration | null {
    const tenantId = this.tenantsByDomain.get(domain);
    return tenantId ? this.tenants.get(tenantId) || null : null;
  }

  /**
   * テナント取得（ID）
   */
  getTenant(tenantId: string): TenantConfiguration | null {
    return this.tenants.get(tenantId) || null;
  }

  /**
   * 組織階層取得
   */
  getOrganizationHierarchy(tenantId: string, rootId?: string): Organization[] {
    const cacheKey = `${tenantId}:${rootId || 'all'}`;
    let hierarchy = this.hierarchyCache.get(cacheKey);
    
    if (!hierarchy) {
      hierarchy = this.buildHierarchy(tenantId, rootId);
      this.hierarchyCache.set(cacheKey, hierarchy);
    }
    
    return hierarchy;
  }

  /**
   * 組織の子組織取得
   */
  getChildOrganizations(organizationId: string, recursive: boolean = false): Organization[] {
    const children: Organization[] = [];
    
    for (const org of this.organizations.values()) {
      if (org.parentId === organizationId) {
        children.push(org);
        
        if (recursive) {
          children.push(...this.getChildOrganizations(org.id, true));
        }
      }
    }
    
    return children;
  }

  /**
   * 従業員の組織パス取得
   */
  getEmployeeOrganizationPath(employeeId: string): string[] {
    // 実装簡略化：実際は従業員マスタから組織を取得
    const orgId = 'sample-org-id';
    const org = this.organizations.get(orgId);
    
    if (!org) return [];
    
    const path: string[] = [];
    let current: Organization | undefined = org;
    
    while (current) {
      path.unshift(current.name);
      current = current.parentId ? this.organizations.get(current.parentId) : undefined;
    }
    
    return path;
  }

  /**
   * 組織間データ共有設定
   */
  async configureDataSharing(
    tenantId: string,
    sourceOrgId: string,
    targetOrgId: string,
    dataTypes: string[],
    permissions: string[]
  ): Promise<void> {
    await this.dataIsolationEngine.configureSharing(
      tenantId,
      sourceOrgId,
      targetOrgId,
      dataTypes,
      permissions
    );

    this.emit('data_sharing:configured', {
      tenantId,
      sourceOrgId,
      targetOrgId,
      dataTypes,
      permissions
    });

    logger.info(`Data sharing configured: ${sourceOrgId} -> ${targetOrgId}`);
  }

  /**
   * 組織統計情報取得
   */
  async getOrganizationStatistics(tenantId: string): Promise<any> {
    const tenantOrgs = Array.from(this.organizations.values())
      .filter(org => org.tenantId === tenantId);

    const stats = {
      totalOrganizations: tenantOrgs.length,
      byType: this.groupBy(tenantOrgs, 'type'),
      byLevel: this.groupBy(tenantOrgs, 'level'),
      activeOrganizations: tenantOrgs.filter(o => o.isActive).length,
      averageChildrenPerOrg: this.calculateAverageChildren(tenantOrgs),
      deepestLevel: Math.max(...tenantOrgs.map(o => o.level)),
      totalEmployees: tenantOrgs.reduce((sum, o) => sum + o.metadata.employeeCount, 0)
    };

    return stats;
  }

  /**
   * 組織移動（リオーガナイゼーション）
   */
  async moveOrganization(
    organizationId: string,
    newParentId?: string,
    maintainEmployees: boolean = true
  ): Promise<void> {
    const org = this.organizations.get(organizationId);
    if (!org) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    const oldParentId = org.parentId;
    const oldPath = org.path;

    // 新しい親の検証
    if (newParentId) {
      const newParent = this.organizations.get(newParentId);
      if (!newParent) {
        throw new Error(`New parent organization not found: ${newParentId}`);
      }
      
      // 循環参照チェック
      if (this.wouldCreateCircularReference(organizationId, newParentId)) {
        throw new Error('Move would create circular reference');
      }
    }

    // 組織情報の更新
    org.parentId = newParentId;
    org.updatedAt = new Date();
    
    // パスの再計算
    await this.recalculateOrganizationPaths(org);

    // 子組織のパスも更新
    const children = this.getChildOrganizations(organizationId, true);
    for (const child of children) {
      await this.recalculateOrganizationPaths(child);
    }

    // 階層キャッシュの更新
    this.updateHierarchyCache(org.tenantId);

    this.emit('organization:moved', {
      organizationId,
      oldParentId,
      newParentId,
      oldPath,
      newPath: org.path
    });

    logger.info(`Organization moved: ${org.name} from ${oldPath} to ${org.path}`);
  }

  /**
   * テナント設定更新
   */
  async updateTenantSettings(
    tenantId: string,
    updates: Partial<TenantConfiguration>
  ): Promise<TenantConfiguration> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const updatedTenant = {
      ...tenant,
      ...updates,
      updatedAt: new Date()
    };

    this.tenants.set(tenantId, updatedTenant);

    this.emit('tenant:updated', updatedTenant);
    logger.info(`Tenant settings updated: ${tenant.name}`);

    return updatedTenant;
  }

  // プライベートヘルパーメソッド

  private buildHierarchy(tenantId: string, rootId?: string): Organization[] {
    const tenantOrgs = Array.from(this.organizations.values())
      .filter(org => org.tenantId === tenantId);

    if (rootId) {
      // 特定のルートから階層を構築
      const root = tenantOrgs.find(org => org.id === rootId);
      if (!root) return [];
      
      return this.buildSubHierarchy(root, tenantOrgs);
    } else {
      // 全階層を構築
      const roots = tenantOrgs.filter(org => !org.parentId);
      const hierarchy: Organization[] = [];
      
      for (const root of roots) {
        hierarchy.push(...this.buildSubHierarchy(root, tenantOrgs));
      }
      
      return hierarchy;
    }
  }

  private buildSubHierarchy(parent: Organization, allOrgs: Organization[]): Organization[] {
    const result = [parent];
    const children = allOrgs.filter(org => org.parentId === parent.id);
    
    for (const child of children) {
      result.push(...this.buildSubHierarchy(child, allOrgs));
    }
    
    return result;
  }

  private updateHierarchyCache(tenantId: string): void {
    // テナント関連のキャッシュをクリア
    for (const [key] of this.hierarchyCache) {
      if (key.startsWith(`${tenantId}:`)) {
        this.hierarchyCache.delete(key);
      }
    }
  }

  private wouldCreateCircularReference(orgId: string, newParentId: string): boolean {
    const visited = new Set<string>();
    let current: string | undefined = newParentId;
    
    while (current && !visited.has(current)) {
      if (current === orgId) {
        return true;
      }
      
      visited.add(current);
      const org = this.organizations.get(current);
      current = org?.parentId;
    }
    
    return false;
  }

  private async recalculateOrganizationPaths(org: Organization): Promise<void> {
    if (!org.parentId) {
      org.path = '/';
      return;
    }
    
    const parent = this.organizations.get(org.parentId);
    if (parent) {
      org.path = `${parent.path}${parent.code}/`.replace('//', '/');
      org.level = Math.min(parent.level + 1, HierarchyLevel.LEVEL_6) as HierarchyLevel;
    }
    
    org.updatedAt = new Date();
  }

  private groupBy<T extends Record<string, any>>(
    items: T[],
    key: keyof T
  ): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateAverageChildren(orgs: Organization[]): number {
    if (orgs.length === 0) return 0;
    
    const totalChildren = orgs.reduce((sum, org) => {
      return sum + orgs.filter(o => o.parentId === org.id).length;
    }, 0);
    
    return totalChildren / orgs.length;
  }
}

// テナントアクセスコントローラー
class TenantAccessController {
  async validateTenantAccess(tenantId: string, userId: string): Promise<boolean> {
    // テナントアクセス権限の検証
    return true; // 簡略化
  }

  async getTenantPermissions(tenantId: string, userId: string): Promise<string[]> {
    // ユーザーのテナント内権限を取得
    return ['read', 'write']; // 簡略化
  }

  async enforceDataIsolation(tenantId: string, query: any): Promise<any> {
    // テナント分離を強制するクエリ変更
    return { ...query, tenantId };
  }
}

// データ分離エンジン
class DataIsolationEngine {
  async initializeTenantSchema(tenantId: string): Promise<void> {
    logger.info(`Initializing schema for tenant: ${tenantId}`);
    // テナント固有のデータベーススキーマ初期化
  }

  async configureSharing(
    tenantId: string,
    sourceOrgId: string,
    targetOrgId: string,
    dataTypes: string[],
    permissions: string[]
  ): Promise<void> {
    logger.info(`Configuring data sharing: ${sourceOrgId} -> ${targetOrgId}`);
    // 組織間データ共有の設定
  }

  async isolateQuery(tenantId: string, organizationId: string, query: any): Promise<any> {
    // クエリにテナント・組織フィルターを追加
    return {
      ...query,
      where: {
        ...query.where,
        tenantId,
        organizationId
      }
    };
  }
}

export { OrganizationManagementSystem };