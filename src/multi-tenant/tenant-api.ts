/**
 * AI-OS テナント管理API
 * マルチテナント・組織階層管理のAPI
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../api/middleware/auth';
import { authorize } from '../api/middleware/authorize';
import { validateRequest } from '../api/middleware/validation';
import { body, query, param } from 'express-validator';
import {
  OrganizationManagementSystem,
  TenantConfiguration,
  TenantType,
  OrganizationType,
  HierarchyLevel,
  Organization
} from './organization-management-system';
import { logger } from '../utils/logger';

const router = Router();
const orgManagementSystem = new OrganizationManagementSystem();

// システムイベントリスナー
orgManagementSystem.on('tenant:created', (tenant) => {
  logger.info(`New tenant created`, {
    id: tenant.id,
    name: tenant.name,
    type: tenant.type,
    subdomain: tenant.subdomain
  });
});

orgManagementSystem.on('organization:created', (org) => {
  logger.info(`New organization created`, {
    id: org.id,
    name: org.name,
    type: org.type,
    level: org.level,
    tenantId: org.tenantId
  });
});

orgManagementSystem.on('organization:moved', (event) => {
  logger.info(`Organization moved`, {
    organizationId: event.organizationId,
    from: event.oldPath,
    to: event.newPath
  });
});

/**
 * テナント作成
 * POST /api/v1/tenants
 */
router.post('/',
  authenticate,
  authorize(['system_admin']),
  [
    body('name').notEmpty().isLength({ max: 100 }),
    body('displayName').notEmpty().isLength({ max: 200 }),
    body('type').isIn(Object.values(TenantType)),
    body('subdomain').notEmpty().matches(/^[a-z0-9-]+$/).isLength({ min: 3, max: 50 }),
    body('customDomain').optional().isFQDN(),
    body('settings.timezone').notEmpty(),
    body('settings.locale').notEmpty(),
    body('settings.currency').notEmpty().isLength({ min: 3, max: 3 }),
    body('billing.plan').notEmpty(),
    body('billing.pricePerUser').isFloat({ min: 0 }),
    body('limits.maxUsers').isInt({ min: 1 }),
    body('limits.maxStorageGB').isInt({ min: 1 })
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const tenantConfig: Omit<TenantConfiguration, 'id' | 'createdAt' | 'updatedAt'> = {
        name: req.body.name,
        displayName: req.body.displayName,
        type: req.body.type,
        subdomain: req.body.subdomain.toLowerCase(),
        customDomain: req.body.customDomain?.toLowerCase(),
        isActive: true,
        settings: {
          timezone: req.body.settings.timezone || 'Asia/Tokyo',
          locale: req.body.settings.locale || 'ja-JP',
          currency: req.body.settings.currency || 'JPY',
          dateFormat: req.body.settings.dateFormat || 'YYYY-MM-DD',
          fiscalYearStart: req.body.settings.fiscalYearStart || 4,
          workWeekStart: req.body.settings.workWeekStart || 1,
          businessHours: req.body.settings.businessHours || getDefaultBusinessHours(),
          holidays: req.body.settings.holidays || [],
          complianceRegion: req.body.settings.complianceRegion || 'JP'
        },
        billing: {
          plan: req.body.billing.plan,
          pricePerUser: req.body.billing.pricePerUser,
          currency: req.body.billing.currency || 'JPY',
          billingCycle: req.body.billing.billingCycle || 'monthly',
          billingContact: req.body.billing.billingContact,
          invoiceSettings: req.body.billing.invoiceSettings || {
            recipientEmails: [req.body.billing.billingContact.email],
            autoSend: true,
            language: 'ja',
            taxRate: 10
          }
        },
        limits: {
          maxUsers: req.body.limits.maxUsers,
          maxStorageGB: req.body.limits.maxStorageGB,
          maxAPICallsPerMonth: req.body.limits.maxAPICallsPerMonth || 10000,
          maxOrganizations: req.body.limits.maxOrganizations || 100,
          maxHierarchyLevels: req.body.limits.maxHierarchyLevels || 6,
          retentionMonths: req.body.limits.retentionMonths || 84
        },
        features: req.body.features || getDefaultFeatures(req.body.billing.plan),
        customization: req.body.customization || {
          branding: {},
          customFields: [],
          workflows: [],
          emailTemplates: []
        }
      };

      const tenant = await orgManagementSystem.createTenant(tenantConfig);

      res.status(201).json({
        message: 'テナントを作成しました',
        tenant: {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          customDomain: tenant.customDomain,
          type: tenant.type,
          urls: {
            dashboard: `https://${tenant.subdomain}.ai-os.com`,
            customDomain: tenant.customDomain ? `https://${tenant.customDomain}` : null
          },
          createdAt: tenant.createdAt
        },
        nextSteps: [
          '管理者ユーザーアカウントの作成',
          '組織階層の設定',
          '従業員データの登録',
          '初期設定の確認'
        ]
      });
    } catch (error) {
      logger.error('Failed to create tenant:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'テナントの作成に失敗しました' });
      }
    }
  }
);

/**
 * テナント一覧取得
 * GET /api/v1/tenants
 */
router.get('/',
  authenticate,
  authorize(['system_admin']),
  [
    query('page').optional().isInt({ min: 0 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(Object.values(TenantType)),
    query('active').optional().isBoolean(),
    query('search').optional().isString()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string;
      const type = req.query.type as TenantType;
      const active = req.query.active === 'true';

      // テナント一覧の取得（モックデータ）
      const allTenants = [
        {
          id: 'tenant-001',
          name: 'acme-corp',
          displayName: 'Acme Corporation',
          type: TenantType.ENTERPRISE,
          subdomain: 'acme',
          customDomain: 'hr.acme.com',
          isActive: true,
          limits: { maxUsers: 500, maxStorageGB: 100 },
          features: { advancedAnalytics: true, aiPredictions: true },
          createdAt: new Date('2024-01-15'),
          stats: {
            userCount: 287,
            organizationCount: 15,
            storageUsedGB: 45.2,
            lastActivity: new Date('2025-01-21')
          }
        },
        {
          id: 'tenant-002',
          name: 'startup-tech',
          displayName: 'StartupTech Inc.',
          type: TenantType.SHARED,
          subdomain: 'startuptech',
          isActive: true,
          limits: { maxUsers: 50, maxStorageGB: 10 },
          features: { advancedAnalytics: false, aiPredictions: true },
          createdAt: new Date('2024-03-20'),
          stats: {
            userCount: 23,
            organizationCount: 3,
            storageUsedGB: 2.1,
            lastActivity: new Date('2025-01-20')
          }
        }
      ];

      // フィルタリング
      let filteredTenants = allTenants;
      if (type) {
        filteredTenants = filteredTenants.filter(t => t.type === type);
      }
      if (active !== undefined) {
        filteredTenants = filteredTenants.filter(t => t.isActive === active);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        filteredTenants = filteredTenants.filter(t => 
          t.name.toLowerCase().includes(searchLower) ||
          t.displayName.toLowerCase().includes(searchLower)
        );
      }

      // ページング
      const paginatedTenants = filteredTenants.slice(page * limit, (page + 1) * limit);

      res.json({
        tenants: paginatedTenants,
        pagination: {
          page,
          limit,
          totalCount: filteredTenants.length,
          totalPages: Math.ceil(filteredTenants.length / limit),
          hasMore: (page + 1) * limit < filteredTenants.length
        }
      });
    } catch (error) {
      logger.error('Failed to get tenants:', error);
      res.status(500).json({ error: 'テナント一覧の取得に失敗しました' });
    }
  }
);

/**
 * 現在のテナント情報取得
 * GET /api/v1/tenants/current
 */
router.get('/current',
  authenticate,
  async (req: Request & { tenant?: any }, res: Response) => {
    try {
      const tenantId = req.tenant?.id || 'default-tenant';
      const tenant = orgManagementSystem.getTenant(tenantId);

      if (!tenant) {
        return res.status(404).json({ error: 'テナント情報が見つかりません' });
      }

      // 統計情報の取得
      const statistics = await orgManagementSystem.getOrganizationStatistics(tenantId);

      res.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          displayName: tenant.displayName,
          type: tenant.type,
          subdomain: tenant.subdomain,
          customDomain: tenant.customDomain,
          settings: tenant.settings,
          features: tenant.features,
          limits: tenant.limits
        },
        statistics,
        usage: {
          userCount: statistics.totalEmployees,
          organizationCount: statistics.totalOrganizations,
          apiCallsThisMonth: 2847, // モックデータ
          storageUsedGB: 12.5 // モックデータ
        }
      });
    } catch (error) {
      logger.error('Failed to get current tenant:', error);
      res.status(500).json({ error: 'テナント情報の取得に失敗しました' });
    }
  }
);

/**
 * 組織階層取得
 * GET /api/v1/tenants/current/organizations
 */
router.get('/current/organizations',
  authenticate,
  [
    query('rootId').optional().isUUID(),
    query('recursive').optional().isBoolean(),
    query('includeInactive').optional().isBoolean()
  ],
  validateRequest,
  async (req: Request & { tenant?: any }, res: Response) => {
    try {
      const tenantId = req.tenant?.id || 'default-tenant';
      const rootId = req.query.rootId as string;
      const recursive = req.query.recursive === 'true';
      const includeInactive = req.query.includeInactive === 'true';

      let organizations = orgManagementSystem.getOrganizationHierarchy(tenantId, rootId);

      // 非アクティブ組織のフィルタリング
      if (!includeInactive) {
        organizations = organizations.filter(org => org.isActive);
      }

      // 階層構造の生成
      const hierarchyTree = buildHierarchyTree(organizations);

      res.json({
        organizations: recursive ? organizations : hierarchyTree,
        totalCount: organizations.length,
        maxLevel: Math.max(...organizations.map(org => org.level)),
        structure: recursive ? 'flat' : 'tree'
      });
    } catch (error) {
      logger.error('Failed to get organizations:', error);
      res.status(500).json({ error: '組織階層の取得に失敗しました' });
    }
  }
);

/**
 * 組織作成
 * POST /api/v1/tenants/current/organizations
 */
router.post('/current/organizations',
  authenticate,
  authorize(['admin', 'hr_manager']),
  [
    body('code').notEmpty().matches(/^[A-Z0-9_-]+$/).isLength({ max: 20 }),
    body('name').notEmpty().isLength({ max: 100 }),
    body('displayName').notEmpty().isLength({ max: 200 }),
    body('type').isIn(Object.values(OrganizationType)),
    body('parentId').optional().isUUID(),
    body('managerId').optional().isUUID(),
    body('settings').optional().isObject()
  ],
  validateRequest,
  async (req: Request & { tenant?: any, user?: any }, res: Response) => {
    try {
      const tenantId = req.tenant?.id || 'default-tenant';

      const organization: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'> = {
        tenantId,
        parentId: req.body.parentId,
        code: req.body.code.toUpperCase(),
        name: req.body.name,
        displayName: req.body.displayName,
        type: req.body.type,
        level: HierarchyLevel.LEVEL_1, // 自動設定される
        path: '', // 自動生成される
        isActive: true,
        manager: req.body.managerId ? {
          id: req.body.managerId,
          name: 'Manager Name', // 実際は従業員マスタから取得
          email: 'manager@example.com'
        } : undefined,
        settings: {
          ...getDefaultOrganizationSettings(),
          ...req.body.settings
        },
        metadata: {
          employeeCount: 0,
          establishedDate: new Date(),
          businessType: req.body.businessType,
          description: req.body.description,
          tags: req.body.tags || [],
          customAttributes: req.body.customAttributes || {}
        }
      };

      const createdOrg = await orgManagementSystem.createOrganization(organization);

      res.status(201).json({
        message: '組織を作成しました',
        organization: {
          id: createdOrg.id,
          code: createdOrg.code,
          name: createdOrg.name,
          type: createdOrg.type,
          level: createdOrg.level,
          path: createdOrg.path,
          parentId: createdOrg.parentId,
          createdAt: createdOrg.createdAt
        }
      });
    } catch (error) {
      logger.error('Failed to create organization:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({ error: '組織コードが既に存在します' });
      } else {
        res.status(500).json({ error: '組織の作成に失敗しました' });
      }
    }
  }
);

/**
 * 組織移動
 * PUT /api/v1/tenants/current/organizations/:id/move
 */
router.put('/current/organizations/:id/move',
  authenticate,
  authorize(['admin', 'hr_manager']),
  param('id').isUUID(),
  [
    body('newParentId').optional().isUUID(),
    body('maintainEmployees').optional().isBoolean()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newParentId, maintainEmployees = true } = req.body;

      await orgManagementSystem.moveOrganization(id, newParentId, maintainEmployees);

      res.json({
        message: '組織を移動しました',
        organizationId: id,
        newParentId,
        note: maintainEmployees 
          ? '従業員は移動先に引き継がれます' 
          : '従業員の配属先を再設定してください'
      });
    } catch (error) {
      logger.error('Failed to move organization:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: '組織が見つかりません' });
      } else if (error instanceof Error && error.message.includes('circular')) {
        res.status(400).json({ error: '循環参照が発生するため移動できません' });
      } else {
        res.status(500).json({ error: '組織の移動に失敗しました' });
      }
    }
  }
);

/**
 * データ共有設定
 * POST /api/v1/tenants/current/data-sharing
 */
router.post('/current/data-sharing',
  authenticate,
  authorize(['admin']),
  [
    body('sourceOrgId').isUUID(),
    body('targetOrgId').isUUID(),
    body('dataTypes').isArray(),
    body('dataTypes.*').isIn(['employees', 'timesheet', 'payroll', 'expenses', 'reports']),
    body('permissions').isArray(),
    body('permissions.*').isIn(['read', 'write', 'delete', 'export'])
  ],
  validateRequest,
  async (req: Request & { tenant?: any }, res: Response) => {
    try {
      const tenantId = req.tenant?.id || 'default-tenant';
      const { sourceOrgId, targetOrgId, dataTypes, permissions } = req.body;

      await orgManagementSystem.configureDataSharing(
        tenantId,
        sourceOrgId,
        targetOrgId,
        dataTypes,
        permissions
      );

      res.json({
        message: 'データ共有を設定しました',
        configuration: {
          sourceOrgId,
          targetOrgId,
          dataTypes,
          permissions,
          configuredAt: new Date()
        },
        note: '設定は即座に有効になります'
      });
    } catch (error) {
      logger.error('Failed to configure data sharing:', error);
      res.status(500).json({ error: 'データ共有設定に失敗しました' });
    }
  }
);

/**
 * テナント設定更新
 * PUT /api/v1/tenants/current/settings
 */
router.put('/current/settings',
  authenticate,
  authorize(['admin']),
  [
    body('settings').optional().isObject(),
    body('features').optional().isObject(),
    body('customization').optional().isObject()
  ],
  validateRequest,
  async (req: Request & { tenant?: any }, res: Response) => {
    try {
      const tenantId = req.tenant?.id || 'default-tenant';
      const updates = {
        settings: req.body.settings,
        features: req.body.features,
        customization: req.body.customization,
        updatedAt: new Date()
      };

      const updatedTenant = await orgManagementSystem.updateTenantSettings(tenantId, updates);

      res.json({
        message: 'テナント設定を更新しました',
        settings: {
          timezone: updatedTenant.settings.timezone,
          locale: updatedTenant.settings.locale,
          currency: updatedTenant.settings.currency,
          features: updatedTenant.features
        },
        updatedAt: updatedTenant.updatedAt
      });
    } catch (error) {
      logger.error('Failed to update tenant settings:', error);
      res.status(500).json({ error: 'テナント設定の更新に失敗しました' });
    }
  }
);

/**
 * 組織統計情報
 * GET /api/v1/tenants/current/statistics
 */
router.get('/current/statistics',
  authenticate,
  authorize(['admin', 'hr_manager']),
  async (req: Request & { tenant?: any }, res: Response) => {
    try {
      const tenantId = req.tenant?.id || 'default-tenant';
      const statistics = await orgManagementSystem.getOrganizationStatistics(tenantId);

      const detailedStats = {
        ...statistics,
        growthMetrics: {
          organizationsAddedThisMonth: 3,
          employeesAddedThisMonth: 15,
          averageOrgSize: Math.round(statistics.totalEmployees / statistics.totalOrganizations),
          mostCommonOrgType: Object.entries(statistics.byType)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'department'
        },
        healthMetrics: {
          organizationUtilization: 87.5, // %
          hierarchyBalance: 'good',
          spanOfControl: 'optimal',
          orphanedEmployees: 0
        }
      };

      res.json({ statistics: detailedStats });
    } catch (error) {
      logger.error('Failed to get organization statistics:', error);
      res.status(500).json({ error: '組織統計情報の取得に失敗しました' });
    }
  }
);

// ヘルパー関数

function getDefaultBusinessHours(): any {
  const defaultDay = {
    isWorkingDay: true,
    startTime: '09:00',
    endTime: '18:00',
    breakTime: { start: '12:00', end: '13:00' }
  };

  return {
    monday: defaultDay,
    tuesday: defaultDay,
    wednesday: defaultDay,
    thursday: defaultDay,
    friday: defaultDay,
    saturday: { isWorkingDay: false },
    sunday: { isWorkingDay: false }
  };
}

function getDefaultFeatures(plan: string): any {
  const planFeatures = {
    free: {
      advancedAnalytics: false,
      aiPredictions: false,
      customReports: false,
      apiAccess: false,
      ssoIntegration: false,
      auditLogs: false,
      whiteLabeling: false,
      multiLanguage: false,
      mobileApp: true,
      slackIntegration: true,
      teamsIntegration: false,
      webhooks: false
    },
    professional: {
      advancedAnalytics: true,
      aiPredictions: true,
      customReports: true,
      apiAccess: true,
      ssoIntegration: true,
      auditLogs: true,
      whiteLabeling: false,
      multiLanguage: true,
      mobileApp: true,
      slackIntegration: true,
      teamsIntegration: true,
      webhooks: true
    },
    enterprise: {
      advancedAnalytics: true,
      aiPredictions: true,
      customReports: true,
      apiAccess: true,
      ssoIntegration: true,
      auditLogs: true,
      whiteLabeling: true,
      multiLanguage: true,
      mobileApp: true,
      slackIntegration: true,
      teamsIntegration: true,
      webhooks: true
    }
  };

  return planFeatures[plan as keyof typeof planFeatures] || planFeatures.free;
}

function getDefaultOrganizationSettings(): any {
  return {
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
  };
}

function buildHierarchyTree(organizations: Organization[]): any[] {
  const orgMap = new Map<string, any>();
  const rootOrgs: any[] = [];

  // 組織マップの作成
  for (const org of organizations) {
    orgMap.set(org.id, {
      ...org,
      children: []
    });
  }

  // 階層構造の構築
  for (const org of organizations) {
    const orgNode = orgMap.get(org.id)!;
    
    if (org.parentId) {
      const parent = orgMap.get(org.parentId);
      if (parent) {
        parent.children.push(orgNode);
      } else {
        rootOrgs.push(orgNode);
      }
    } else {
      rootOrgs.push(orgNode);
    }
  }

  return rootOrgs;
}

export default router;