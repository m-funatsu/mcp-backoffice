/**
 * AI-OS コンプライアンス監査API
 * 監査の実行、結果確認、レポート生成のエンドポイント
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../api/middleware/auth';
import { authorize } from '../api/middleware/authorize';
import { validateRequest } from '../api/middleware/validation';
import { body, query, param } from 'express-validator';
import {
  ComplianceAuditSystem,
  AuditType,
  AuditStatus,
  ComplianceStatus,
  RiskLevel,
  AuditContext
} from './compliance-audit-system';
import { logger } from '../utils/logger';
import { generatePDF } from '../utils/pdf-generator';

const router = Router();
const auditSystem = new ComplianceAuditSystem();

// 監査システムのイベントリスナー設定
auditSystem.on('audit:completed', ({ item, result }) => {
  logger.info(`Audit completed: ${item.name}`, {
    status: result.status,
    findings: result.findings.length
  });
});

auditSystem.on('audit:critical', ({ item, findings }) => {
  logger.error(`Critical findings in audit: ${item.name}`, {
    count: findings.length,
    findings: findings.map(f => f.title)
  });
  
  // 重大な発見事項がある場合は通知を送信
  // notificationService.sendCriticalAlert(...);
});

auditSystem.on('audit:failed', ({ item, error }) => {
  logger.error(`Audit failed: ${item.name}`, error);
});

/**
 * 監査項目一覧取得
 * GET /api/v1/compliance/audit-items
 */
router.get('/audit-items',
  authenticate,
  authorize(['admin', 'compliance_officer']),
  async (req: Request, res: Response) => {
    try {
      const schedule = auditSystem.getAuditSchedule();
      
      res.json({
        items: schedule,
        total: schedule.length
      });
    } catch (error) {
      logger.error('Failed to get audit items:', error);
      res.status(500).json({ error: '監査項目の取得に失敗しました' });
    }
  }
);

/**
 * 手動監査の実行
 * POST /api/v1/compliance/audit/execute
 */
router.post('/audit/execute',
  authenticate,
  authorize(['admin', 'compliance_officer']),
  [
    body('itemIds').isArray().withMessage('itemIds must be an array'),
    body('itemIds.*').isString(),
    body('period.start').optional().isISO8601(),
    body('period.end').optional().isISO8601(),
    body('scope').optional().isArray()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { itemIds, period, scope, metadata } = req.body;
      
      const context: AuditContext = {
        organizationId: req.user.organizationId || 'default',
        period: period || {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 過去30日
          end: new Date()
        },
        scope,
        metadata: {
          ...metadata,
          executedBy: req.user.id,
          executedByName: req.user.name
        }
      };
      
      const results = await auditSystem.runManualAudit(itemIds, context);
      
      logger.info(`Manual audit executed by ${req.user.email}`, {
        itemCount: itemIds.length,
        resultsCount: results.length
      });
      
      res.json({
        results,
        summary: {
          total: results.length,
          compliant: results.filter(r => r.status === ComplianceStatus.COMPLIANT).length,
          nonCompliant: results.filter(r => r.status === ComplianceStatus.NON_COMPLIANT).length,
          findings: results.reduce((sum, r) => sum + r.findings.length, 0)
        }
      });
    } catch (error) {
      logger.error('Failed to execute audit:', error);
      res.status(500).json({ error: '監査の実行に失敗しました' });
    }
  }
);

/**
 * 包括的監査レポート生成
 * POST /api/v1/compliance/audit/report
 */
router.post('/audit/report',
  authenticate,
  authorize(['admin', 'compliance_officer']),
  [
    body('type').isIn(Object.values(AuditType)),
    body('period.start').isISO8601(),
    body('period.end').isISO8601(),
    body('format').optional().isIn(['json', 'pdf'])
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { type, period, format = 'json' } = req.body;
      
      const report = await auditSystem.generateComprehensiveReport(
        type,
        {
          start: new Date(period.start),
          end: new Date(period.end)
        }
      );
      
      if (format === 'pdf') {
        // PDF生成
        const pdfBuffer = await generateCompliancePDF(report);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=compliance-report-${type}-${new Date().toISOString().slice(0, 10)}.pdf`
        );
        res.send(pdfBuffer);
      } else {
        res.json({ report });
      }
    } catch (error) {
      logger.error('Failed to generate audit report:', error);
      res.status(500).json({ error: 'レポートの生成に失敗しました' });
    }
  }
);

/**
 * 監査統計情報取得
 * GET /api/v1/compliance/statistics
 */
router.get('/statistics',
  authenticate,
  authorize(['admin', 'compliance_officer', 'executive']),
  query('period').optional().isIn(['month', 'quarter', 'year']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const period = req.query.period as string || 'month';
      
      // 期間の計算
      const end = new Date();
      const start = new Date();
      switch (period) {
        case 'month':
          start.setMonth(start.getMonth() - 1);
          break;
        case 'quarter':
          start.setMonth(start.getMonth() - 3);
          break;
        case 'year':
          start.setFullYear(start.getFullYear() - 1);
          break;
      }
      
      // 各タイプの監査を実行して統計を収集
      const statistics: any = {
        byType: {},
        overall: {
          totalAudits: 0,
          compliantItems: 0,
          nonCompliantItems: 0,
          criticalFindings: 0,
          highFindings: 0
        }
      };
      
      for (const type of Object.values(AuditType)) {
        const report = await auditSystem.generateComprehensiveReport(type, { start, end });
        statistics.byType[type] = {
          complianceRate: report.statistics.complianceRate,
          findings: {
            critical: report.statistics.criticalFindings,
            high: report.statistics.highFindings,
            medium: report.statistics.mediumFindings,
            low: report.statistics.lowFindings
          }
        };
        
        statistics.overall.totalAudits += report.statistics.totalItems;
        statistics.overall.compliantItems += report.statistics.compliantItems;
        statistics.overall.nonCompliantItems += report.statistics.nonCompliantItems;
        statistics.overall.criticalFindings += report.statistics.criticalFindings;
        statistics.overall.highFindings += report.statistics.highFindings;
      }
      
      statistics.overall.complianceRate = 
        statistics.overall.totalAudits > 0
          ? (statistics.overall.compliantItems / statistics.overall.totalAudits) * 100
          : 0;
      
      res.json({
        period: { start, end },
        statistics
      });
    } catch (error) {
      logger.error('Failed to get compliance statistics:', error);
      res.status(500).json({ error: '統計情報の取得に失敗しました' });
    }
  }
);

/**
 * リスクダッシュボード
 * GET /api/v1/compliance/risk-dashboard
 */
router.get('/risk-dashboard',
  authenticate,
  authorize(['admin', 'compliance_officer', 'executive']),
  async (req: Request, res: Response) => {
    try {
      // リスクレベル別の集計（モックデータ）
      const riskSummary = {
        critical: {
          count: 2,
          items: [
            {
              type: AuditType.LABOR_LAW,
              title: '月間時間外労働上限超過',
              affectedCount: 5,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
          ]
        },
        high: {
          count: 5,
          items: [
            {
              type: AuditType.LABOR_LAW,
              title: '有給休暇取得義務未達成リスク',
              affectedCount: 12,
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            {
              type: AuditType.SECURITY,
              title: 'パスワードポリシー違反',
              affectedCount: 8,
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
            }
          ]
        },
        medium: {
          count: 8,
          items: []
        },
        low: {
          count: 3,
          items: []
        }
      };
      
      // コンプライアンススコア
      const complianceScore = {
        overall: 85.5,
        trend: '+2.3%',
        byCategory: {
          laborLaw: 82.0,
          taxCompliance: 95.0,
          dataProtection: 88.5,
          security: 78.0
        }
      };
      
      // 今後の監査予定
      const upcomingAudits = auditSystem.getAuditSchedule()
        .filter(item => item.nextScheduled > new Date())
        .sort((a, b) => a.nextScheduled.getTime() - b.nextScheduled.getTime())
        .slice(0, 5);
      
      res.json({
        riskSummary,
        complianceScore,
        upcomingAudits,
        lastUpdated: new Date()
      });
    } catch (error) {
      logger.error('Failed to get risk dashboard:', error);
      res.status(500).json({ error: 'リスクダッシュボードの取得に失敗しました' });
    }
  }
);

/**
 * 是正措置の記録
 * POST /api/v1/compliance/remediation
 */
router.post('/remediation',
  authenticate,
  authorize(['admin', 'compliance_officer']),
  [
    body('findingId').isUUID(),
    body('action').notEmpty(),
    body('status').isIn(['planned', 'in_progress', 'completed']),
    body('completionDate').optional().isISO8601(),
    body('evidence').optional().isArray()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const remediation = {
        id: require('uuid').v4(),
        findingId: req.body.findingId,
        action: req.body.action,
        status: req.body.status,
        completionDate: req.body.completionDate,
        evidence: req.body.evidence || [],
        createdBy: req.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // 是正措置を保存（実装簡略化のため省略）
      logger.info(`Remediation recorded for finding ${req.body.findingId}`);
      
      res.status(201).json({
        remediation,
        message: '是正措置が記録されました'
      });
    } catch (error) {
      logger.error('Failed to record remediation:', error);
      res.status(500).json({ error: '是正措置の記録に失敗しました' });
    }
  }
);

/**
 * 監査証跡のエクスポート
 * GET /api/v1/compliance/export-evidence
 */
router.get('/export-evidence',
  authenticate,
  authorize(['admin', 'compliance_officer', 'auditor']),
  [
    query('auditId').optional().isUUID(),
    query('type').optional().isIn(Object.values(AuditType)),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      // 証跡データの収集（実装簡略化）
      const evidencePackage = {
        exportId: require('uuid').v4(),
        exportDate: new Date(),
        filters: {
          auditId: req.query.auditId,
          type: req.query.type,
          period: {
            start: req.query.startDate,
            end: req.query.endDate
          }
        },
        evidence: [
          {
            type: 'log',
            title: 'システム監査ログ',
            count: 1543,
            size: '45.2MB'
          },
          {
            type: 'document',
            title: '承認記録',
            count: 234,
            size: '12.8MB'
          },
          {
            type: 'data',
            title: '集計データ',
            count: 89,
            size: '3.4MB'
          }
        ],
        downloadUrl: `/api/v1/compliance/download-evidence/${require('uuid').v4()}`,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24時間後
      };
      
      res.json({
        evidencePackage,
        message: '証跡データの準備が完了しました。24時間以内にダウンロードしてください。'
      });
    } catch (error) {
      logger.error('Failed to export evidence:', error);
      res.status(500).json({ error: '証跡のエクスポートに失敗しました' });
    }
  }
);

// PDF生成ヘルパー関数
async function generateCompliancePDF(report: any): Promise<Buffer> {
  // 実際の実装では、PDFライブラリを使用して詳細なレポートを生成
  const content = `
    コンプライアンス監査レポート
    
    期間: ${report.period.start.toLocaleDateString()} - ${report.period.end.toLocaleDateString()}
    タイプ: ${report.type}
    全体ステータス: ${report.overallStatus}
    
    エグゼクティブサマリー:
    ${report.executiveSummary}
    
    統計:
    - 総項目数: ${report.statistics.totalItems}
    - 準拠項目: ${report.statistics.compliantItems}
    - 非準拠項目: ${report.statistics.nonCompliantItems}
    - 準拠率: ${report.statistics.complianceRate.toFixed(1)}%
    
    重大な発見事項: ${report.statistics.criticalFindings}件
    高リスク発見事項: ${report.statistics.highFindings}件
    
    推奨事項:
    ${report.recommendations.map((r: string) => `- ${r}`).join('\n')}
    
    次のステップ:
    ${report.nextSteps.map((s: string) => `- ${s}`).join('\n')}
  `;
  
  // PDFバッファを返す（実装簡略化）
  return Buffer.from(content, 'utf-8');
}

export default router;