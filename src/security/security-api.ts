/**
 * AI-OS セキュリティAPI
 * セキュリティ管理・監視のREST API
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../api/middleware/auth';
import { authorize } from '../api/middleware/authorize';
import { validateRequest } from '../api/middleware/validation';
import { body, query, param } from 'express-validator';
import { ContinuousSecuritySystem, SecurityCheckType, ThreatLevel } from './continuous-security-system';
import { logger } from '../utils/logger';

const router = Router();
const securitySystem = new ContinuousSecuritySystem();

// セキュリティイベントリスナー
securitySystem.on('vulnerability:critical', (vulnerability) => {
  logger.error(`Critical vulnerability detected: ${vulnerability.title}`);
});

securitySystem.on('incident:created', (incident) => {
  logger.warn(`Security incident detected: ${incident.type} - ${incident.severity}`);
});

securitySystem.on('scan:completed', (result) => {
  logger.info(`Security scan completed: ${result.type}`);
});

/**
 * セキュリティダッシュボード概要
 * GET /api/v1/security/dashboard
 */
router.get('/dashboard',
  authenticate,
  authorize(['admin', 'security']),
  async (req: Request, res: Response) => {
    try {
      const metrics = await securitySystem.calculateSecurityMetrics();
      const report = await securitySystem.generateSecurityReport();

      res.json({
        overview: {
          securityScore: report.summary.overallScore,
          complianceScore: report.summary.complianceScore,
          status: report.summary.overallScore >= 80 ? 'secure' : 'at_risk'
        },
        metrics,
        alerts: {
          critical: report.summary.criticalVulnerabilities,
          active: report.summary.activeIncidents
        },
        lastScan: new Date(),
        nextScheduledScan: new Date(Date.now() + 86400000)
      });
    } catch (error) {
      logger.error('Failed to get security dashboard:', error);
      res.status(500).json({ error: 'セキュリティダッシュボードの取得に失敗しました' });
    }
  }
);

/**
 * 脆弱性スキャン実行
 * POST /api/v1/security/scan/vulnerabilities
 */
router.post('/scan/vulnerabilities',
  authenticate,
  authorize(['admin', 'security']),
  [
    body('scanType').optional().isIn(['full', 'quick', 'targeted']),
    body('targets').optional().isArray()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { scanType = 'full', targets = [] } = req.body;

      // スキャンを非同期で実行
      securitySystem.runVulnerabilityS​can()
        .then(vulnerabilities => {
          logger.info(`Vulnerability scan completed: ${vulnerabilities.length} issues found`);
        })
        .catch(error => {
          logger.error('Vulnerability scan failed:', error);
        });

      res.status(202).json({
        message: '脆弱性スキャンを開始しました',
        scanType,
        estimatedDuration: '5-15分',
        resultUrl: '/api/v1/security/vulnerabilities'
      });
    } catch (error) {
      logger.error('Failed to start vulnerability scan:', error);
      res.status(500).json({ error: '脆弱性スキャンの開始に失敗しました' });
    }
  }
);

/**
 * 脆弱性一覧取得
 * GET /api/v1/security/vulnerabilities
 */
router.get('/vulnerabilities',
  authenticate,
  authorize(['admin', 'security']),
  [
    query('severity').optional().isIn(Object.values(ThreatLevel)),
    query('status').optional().isIn(['open', 'mitigated', 'resolved', 'accepted']),
    query('type').optional().isString()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const filters = {
        severity: req.query.severity as ThreatLevel,
        status: req.query.status as string,
        type: req.query.type as string
      };

      const vulnerabilities = await securitySystem.getVulnerabilities(filters);

      res.json({
        vulnerabilities: vulnerabilities.map(v => ({
          id: v.id,
          type: v.type,
          severity: v.severity,
          title: v.title,
          description: v.description,
          affectedComponent: v.affectedComponent,
          cve: v.cve,
          cvss: v.cvss,
          status: v.status,
          discoveredAt: v.discoveredAt,
          remediation: v.remediation
        })),
        totalCount: vulnerabilities.length,
        criticalCount: vulnerabilities.filter(v => v.severity === ThreatLevel.CRITICAL).length
      });
    } catch (error) {
      logger.error('Failed to get vulnerabilities:', error);
      res.status(500).json({ error: '脆弱性情報の取得に失敗しました' });
    }
  }
);

/**
 * 脆弱性詳細取得
 * GET /api/v1/security/vulnerabilities/:vulnerabilityId
 */
router.get('/vulnerabilities/:vulnerabilityId',
  authenticate,
  authorize(['admin', 'security']),
  param('vulnerabilityId').notEmpty(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { vulnerabilityId } = req.params;
      const vulnerability = await securitySystem.getVulnerabilityById(vulnerabilityId);

      if (!vulnerability) {
        return res.status(404).json({ error: '脆弱性情報が見つかりません' });
      }

      res.json({ vulnerability });
    } catch (error) {
      logger.error('Failed to get vulnerability details:', error);
      res.status(500).json({ error: '脆弱性詳細の取得に失敗しました' });
    }
  }
);

/**
 * 脆弱性修復実行
 * POST /api/v1/security/vulnerabilities/:vulnerabilityId/remediate
 */
router.post('/vulnerabilities/:vulnerabilityId/remediate',
  authenticate,
  authorize(['admin', 'security']),
  param('vulnerabilityId').notEmpty(),
  [
    body('action').optional().isIn(['auto', 'manual']),
    body('notes').optional().isString()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { vulnerabilityId } = req.params;
      const { action = 'auto', notes } = req.body;

      const result = await securitySystem.remediateVulnerability(vulnerabilityId, {
        action,
        notes,
        executedBy: req.user?.id
      });

      res.json({
        message: '修復プロセスを開始しました',
        vulnerabilityId,
        status: result.status,
        actions: result.actions
      });
    } catch (error) {
      logger.error('Failed to remediate vulnerability:', error);
      res.status(500).json({ error: '脆弱性修復の開始に失敗しました' });
    }
  }
);

/**
 * セキュリティインシデント一覧
 * GET /api/v1/security/incidents
 */
router.get('/incidents',
  authenticate,
  authorize(['admin', 'security']),
  [
    query('status').optional().isIn(['detected', 'investigating', 'contained', 'resolved']),
    query('severity').optional().isIn(Object.values(ThreatLevel)),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const filters = {
        status: req.query.status as string,
        severity: req.query.severity as ThreatLevel,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      const incidents = await securitySystem.getIncidents(filters);

      res.json({
        incidents: incidents.map(i => ({
          id: i.id,
          type: i.type,
          severity: i.severity,
          timestamp: i.timestamp,
          source: i.source,
          target: i.target,
          description: i.description,
          status: i.status,
          responseActions: i.response.actions.length
        })),
        totalCount: incidents.length,
        activeCount: incidents.filter(i => i.status !== 'resolved').length
      });
    } catch (error) {
      logger.error('Failed to get incidents:', error);
      res.status(500).json({ error: 'インシデント情報の取得に失敗しました' });
    }
  }
);

/**
 * インシデント対応実行
 * POST /api/v1/security/incidents/:incidentId/respond
 */
router.post('/incidents/:incidentId/respond',
  authenticate,
  authorize(['admin', 'security']),
  param('incidentId').notEmpty(),
  [
    body('action').notEmpty(),
    body('description').notEmpty(),
    body('automated').optional().isBoolean()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { incidentId } = req.params;
      const { action, description, automated = false } = req.body;

      const result = await securitySystem.respondToIncident(incidentId, {
        action,
        description,
        automated,
        executedBy: req.user?.id
      });

      res.json({
        message: 'インシデント対応を実行しました',
        incidentId,
        action,
        success: result.success,
        newStatus: result.newStatus
      });
    } catch (error) {
      logger.error('Failed to respond to incident:', error);
      res.status(500).json({ error: 'インシデント対応の実行に失敗しました' });
    }
  }
);

/**
 * コンプライアンスチェック実行
 * POST /api/v1/security/compliance/check
 */
router.post('/compliance/check',
  authenticate,
  authorize(['admin', 'security']),
  [
    body('framework').optional().isIn(['all', 'owasp', 'gdpr', 'pci-dss', 'pipa'])
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { framework = 'all' } = req.body;

      const requirements = await securitySystem.runComplianceCheck(framework);

      res.json({
        framework,
        requirements: requirements.map(r => ({
          id: r.id,
          framework: r.framework,
          requirement: r.requirement,
          description: r.description,
          status: r.status,
          lastChecked: r.lastChecked
        })),
        summary: {
          total: requirements.length,
          compliant: requirements.filter(r => r.status === 'compliant').length,
          nonCompliant: requirements.filter(r => r.status === 'non_compliant').length,
          partial: requirements.filter(r => r.status === 'partial').length
        }
      });
    } catch (error) {
      logger.error('Failed to run compliance check:', error);
      res.status(500).json({ error: 'コンプライアンスチェックの実行に失敗しました' });
    }
  }
);

/**
 * セキュリティパッチ適用
 * POST /api/v1/security/patches/apply
 */
router.post('/patches/apply',
  authenticate,
  authorize(['admin']),
  [
    body('patchType').optional().isIn(['os', 'dependencies', 'docker', 'all']),
    body('testMode').optional().isBoolean()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { patchType = 'all', testMode = false } = req.body;

      if (testMode) {
        res.json({
          message: 'パッチ適用テストモード',
          patchType,
          availablePatches: 12,
          estimatedDowntime: '5-10分'
        });
      } else {
        // パッチ適用を非同期で実行
        securitySystem.applySecurityPatches()
          .then(() => {
            logger.info('Security patches applied successfully');
          })
          .catch(error => {
            logger.error('Failed to apply security patches:', error);
          });

        res.status(202).json({
          message: 'セキュリティパッチの適用を開始しました',
          patchType,
          warning: 'システムが一時的に再起動される可能性があります'
        });
      }
    } catch (error) {
      logger.error('Failed to apply patches:', error);
      res.status(500).json({ error: 'パッチ適用の開始に失敗しました' });
    }
  }
);

/**
 * セキュリティレポート生成
 * GET /api/v1/security/reports/generate
 */
router.get('/reports/generate',
  authenticate,
  authorize(['admin', 'security', 'executive']),
  [
    query('format').optional().isIn(['json', 'pdf', 'html']),
    query('period').optional().isIn(['daily', 'weekly', 'monthly', 'custom']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const format = req.query.format as string || 'json';
      const period = req.query.period as string || 'monthly';

      const report = await securitySystem.generateSecurityReport();

      if (format === 'json') {
        res.json({ report });
      } else {
        // PDF/HTML生成（実装簡略化）
        res.json({
          message: 'レポートを生成しました',
          format,
          downloadUrl: `/api/v1/security/reports/download/${report.id}`
        });
      }
    } catch (error) {
      logger.error('Failed to generate security report:', error);
      res.status(500).json({ error: 'セキュリティレポートの生成に失敗しました' });
    }
  }
);

/**
 * セキュリティ設定取得
 * GET /api/v1/security/configurations
 */
router.get('/configurations',
  authenticate,
  authorize(['admin', 'security']),
  async (req: Request, res: Response) => {
    try {
      const configurations = await securitySystem.getSecurityConfigurations();

      res.json({
        configurations: configurations.map(config => ({
          id: config.id,
          category: config.category,
          setting: config.setting,
          currentValue: config.currentValue,
          recommendedValue: config.recommendedValue,
          compliance: config.compliance,
          risk: config.risk
        })),
        nonCompliantCount: configurations.filter(c => !c.compliance).length
      });
    } catch (error) {
      logger.error('Failed to get security configurations:', error);
      res.status(500).json({ error: 'セキュリティ設定の取得に失敗しました' });
    }
  }
);

/**
 * セキュリティ設定更新
 * PATCH /api/v1/security/configurations/:configId
 */
router.patch('/configurations/:configId',
  authenticate,
  authorize(['admin']),
  param('configId').notEmpty(),
  [
    body('value').notEmpty(),
    body('reason').optional().isString()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { configId } = req.params;
      const { value, reason } = req.body;

      const result = await securitySystem.updateSecurityConfiguration(configId, {
        value,
        reason,
        updatedBy: req.user?.id
      });

      res.json({
        message: 'セキュリティ設定を更新しました',
        configuration: result
      });
    } catch (error) {
      logger.error('Failed to update security configuration:', error);
      res.status(500).json({ error: 'セキュリティ設定の更新に失敗しました' });
    }
  }
);

/**
 * 脅威インテリジェンス取得
 * GET /api/v1/security/threat-intelligence
 */
router.get('/threat-intelligence',
  authenticate,
  authorize(['admin', 'security']),
  async (req: Request, res: Response) => {
    try {
      const intelligence = await securitySystem.getThreatIntelligence();

      res.json({
        threats: intelligence.activeTh​reats,
        indicators: intelligence.indicators,
        recommendations: intelligence.recommendations,
        lastUpdated: intelligence.lastUpdated
      });
    } catch (error) {
      logger.error('Failed to get threat intelligence:', error);
      res.status(500).json({ error: '脅威インテリジェンスの取得に失敗しました' });
    }
  }
);

export default router;