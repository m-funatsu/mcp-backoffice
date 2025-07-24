/**
 * AI-OS レポートAPI
 * レポート生成・管理・スケジュールAPI
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../api/middleware/auth';
import { authorize } from '../api/middleware/authorize';
import { validateRequest } from '../api/middleware/validation';
import { body, query, param } from 'express-validator';
import {
  ReportGenerationEngine,
  ReportType,
  OutputFormat,
  ReportStatus,
  ReportRequest,
  ScheduledReport,
  ReportConfiguration
} from './report-generation-engine';
import { logger } from '../utils/logger';

const router = Router();
const reportEngine = new ReportGenerationEngine();

// レポートエンジンのイベントリスナー
reportEngine.on('report:requested', (request) => {
  logger.info(`Report generation requested`, {
    id: request.id,
    type: request.type,
    format: request.format,
    requestedBy: request.requestedBy
  });
});

reportEngine.on('report:completed', ({ request, result }) => {
  logger.info(`Report generation completed`, {
    requestId: request.id,
    fileName: result.fileName,
    fileSize: result.fileSize,
    generationTime: result.metadata.generationTime
  });
});

reportEngine.on('report:failed', ({ request, error }) => {
  logger.error(`Report generation failed`, {
    requestId: request.id,
    type: request.type,
    error: error.message
  });
});

/**
 * 利用可能レポートタイプ一覧
 * GET /api/v1/reports/types
 */
router.get('/types',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const reportTypes = [
        {
          type: ReportType.ATTENDANCE_SUMMARY,
          name: '勤怠サマリーレポート',
          description: '期間内の勤怠状況集計',
          category: 'attendance',
          outputFormats: [OutputFormat.PDF, OutputFormat.EXCEL, OutputFormat.CSV],
          schedulable: true
        },
        {
          type: ReportType.OVERTIME_ANALYSIS,
          name: '残業時間分析レポート',
          description: '残業時間の傾向分析とコンプライアンス確認',
          category: 'attendance',
          outputFormats: [OutputFormat.PDF, OutputFormat.EXCEL],
          schedulable: true
        },
        {
          type: ReportType.PAYROLL_SUMMARY,
          name: '給与サマリーレポート',
          description: '給与計算結果の集計レポート',
          category: 'payroll',
          outputFormats: [OutputFormat.PDF, OutputFormat.EXCEL, OutputFormat.CSV],
          schedulable: true
        },
        {
          type: ReportType.EXPENSE_REPORT,
          name: '経費レポート',
          description: '経費精算状況の分析レポート',
          category: 'expenses',
          outputFormats: [OutputFormat.PDF, OutputFormat.EXCEL, OutputFormat.CSV],
          schedulable: true
        },
        {
          type: ReportType.COMPLIANCE_AUDIT,
          name: 'コンプライアンス監査レポート',
          description: '法的準拠状況の包括的監査レポート',
          category: 'compliance',
          outputFormats: [OutputFormat.PDF, OutputFormat.EXCEL],
          schedulable: true
        },
        {
          type: ReportType.HUMAN_CAPITAL_METRICS,
          name: '人的資本指標レポート',
          description: 'ISO30414準拠の人的資本指標',
          category: 'hr_analytics',
          outputFormats: [OutputFormat.PDF, OutputFormat.EXCEL, OutputFormat.POWERPOINT],
          schedulable: true
        },
        {
          type: ReportType.PREDICTIVE_ANALYTICS,
          name: '予測分析レポート',
          description: 'AIによる離職・残業・パフォーマンス予測',
          category: 'analytics',
          outputFormats: [OutputFormat.PDF, OutputFormat.EXCEL, OutputFormat.JSON],
          schedulable: true
        }
      ];

      res.json({
        reportTypes,
        totalCount: reportTypes.length
      });
    } catch (error) {
      logger.error('Failed to get report types:', error);
      res.status(500).json({ error: 'レポートタイプの取得に失敗しました' });
    }
  }
);

/**
 * レポート生成要求
 * POST /api/v1/reports/generate
 */
router.post('/generate',
  authenticate,
  authorize(['admin', 'hr_manager', 'manager']),
  [
    body('type').isIn(Object.values(ReportType)),
    body('format').isIn(Object.values(OutputFormat)),
    body('filters').isObject(),
    body('parameters').optional().isObject(),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('deliveryMethod').optional().isIn(['download', 'email', 'webhook']),
    body('deliveryTarget').optional().isString()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const request: ReportRequest = {
        id: require('uuid').v4(),
        type: req.body.type,
        format: req.body.format,
        filters: req.body.filters,
        parameters: req.body.parameters || {},
        requestedBy: req.user.id,
        requestedAt: new Date(),
        priority: req.body.priority || 'normal',
        deliveryMethod: req.body.deliveryMethod || 'download',
        deliveryTarget: req.body.deliveryTarget
      };

      const requestId = await reportEngine.generateReport(request);

      res.status(202).json({
        message: 'レポート生成を開始しました',
        requestId,
        estimatedTime: '2-5分',
        statusUrl: `/api/v1/reports/status/${requestId}`,
        note: 'ステータスURLで進行状況を確認できます'
      });
    } catch (error) {
      logger.error('Failed to generate report:', error);
      if (error instanceof Error && error.message.includes('Unknown report type')) {
        res.status(400).json({ error: 'サポートされていないレポートタイプです' });
      } else if (error instanceof Error && error.message.includes('Required')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'レポート生成要求に失敗しました' });
      }
    }
  }
);

/**
 * レポート生成状況確認
 * GET /api/v1/reports/status/:requestId
 */
router.get('/status/:requestId',
  authenticate,
  param('requestId').isUUID(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const result = reportEngine.getReportResult(requestId);

      if (!result) {
        return res.status(404).json({ error: 'レポート要求が見つかりません' });
      }

      const response: any = {
        requestId,
        status: result.status,
        progress: result.status === ReportStatus.GENERATING ? 'processing' : 'completed'
      };

      if (result.status === ReportStatus.COMPLETED) {
        response.result = {
          fileName: result.fileName,
          fileSize: result.fileSize,
          downloadUrl: result.downloadUrl,
          expiresAt: result.expiresAt,
          metadata: {
            recordCount: result.metadata.recordCount,
            generationTime: result.metadata.generationTime,
            columns: result.metadata.columns.length
          }
        };
      } else if (result.status === ReportStatus.FAILED) {
        response.error = result.error;
      }

      res.json(response);
    } catch (error) {
      logger.error('Failed to get report status:', error);
      res.status(500).json({ error: 'レポート状況の取得に失敗しました' });
    }
  }
);

/**
 * 定型レポート生成（簡単生成）
 * POST /api/v1/reports/quick-generate
 */
router.post('/quick-generate',
  authenticate,
  [
    body('reportName').isIn([
      'monthly_attendance',
      'payroll_current_month',
      'overtime_this_week',
      'expenses_this_month',
      'compliance_current_quarter'
    ]),
    body('format').optional().isIn(Object.values(OutputFormat))
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { reportName, format = OutputFormat.PDF } = req.body;
      
      // 定型レポートの設定
      const quickReports = {
        monthly_attendance: {
          type: ReportType.ATTENDANCE_SUMMARY,
          filters: {
            period: {
              start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              end: new Date()
            }
          },
          parameters: { groupBy: 'department' }
        },
        payroll_current_month: {
          type: ReportType.PAYROLL_SUMMARY,
          filters: {
            payrollMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          },
          parameters: { detailLevel: 'summary' }
        },
        overtime_this_week: {
          type: ReportType.OVERTIME_ANALYSIS,
          filters: {
            period: {
              start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              end: new Date()
            }
          },
          parameters: { complianceCheck: true }
        },
        expenses_this_month: {
          type: ReportType.EXPENSE_REPORT,
          filters: {
            period: {
              start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              end: new Date()
            }
          },
          parameters: {}
        },
        compliance_current_quarter: {
          type: ReportType.COMPLIANCE_AUDIT,
          filters: {
            auditPeriod: {
              start: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1),
              end: new Date()
            }
          },
          parameters: { includeRemediation: true }
        }
      };

      const config = quickReports[reportName as keyof typeof quickReports];
      if (!config) {
        return res.status(400).json({ error: '不正なレポート名です' });
      }

      const request: ReportRequest = {
        id: require('uuid').v4(),
        type: config.type,
        format,
        filters: config.filters,
        parameters: config.parameters,
        requestedBy: req.user.id,
        requestedAt: new Date(),
        priority: 'normal',
        deliveryMethod: 'download'
      };

      const requestId = await reportEngine.generateReport(request);

      res.status(202).json({
        message: `${reportName}レポートの生成を開始しました`,
        requestId,
        statusUrl: `/api/v1/reports/status/${requestId}`
      });
    } catch (error) {
      logger.error('Failed to generate quick report:', error);
      res.status(500).json({ error: '定型レポートの生成に失敗しました' });
    }
  }
);

/**
 * スケジュールレポート一覧
 * GET /api/v1/reports/scheduled
 */
router.get('/scheduled',
  authenticate,
  authorize(['admin', 'hr_manager']),
  async (req: Request & { user?: any }, res: Response) => {
    try {
      // スケジュールレポートの取得（モックデータ）
      const scheduledReports = [
        {
          id: 'sched-001',
          name: '月次勤怠サマリー',
          type: ReportType.ATTENDANCE_SUMMARY,
          schedule: {
            frequency: 'monthly',
            time: '09:00',
            dayOfMonth: 1,
            timezone: 'Asia/Tokyo'
          },
          recipients: [
            { type: 'email', target: 'hr-team@company.com', format: OutputFormat.PDF }
          ],
          isActive: true,
          lastRun: new Date('2025-01-01T09:00:00Z'),
          nextRun: new Date('2025-02-01T09:00:00Z'),
          createdBy: req.user.id,
          createdAt: new Date('2024-12-01')
        },
        {
          id: 'sched-002',
          name: '週次残業時間分析',
          type: ReportType.OVERTIME_ANALYSIS,
          schedule: {
            frequency: 'weekly',
            time: '08:00',
            dayOfWeek: 1, // Monday
            timezone: 'Asia/Tokyo'
          },
          recipients: [
            { type: 'email', target: 'managers@company.com', format: OutputFormat.EXCEL }
          ],
          isActive: true,
          lastRun: new Date('2025-01-20T08:00:00Z'),
          nextRun: new Date('2025-01-27T08:00:00Z'),
          createdBy: req.user.id,
          createdAt: new Date('2024-12-15')
        }
      ];

      res.json({
        scheduledReports,
        totalCount: scheduledReports.length
      });
    } catch (error) {
      logger.error('Failed to get scheduled reports:', error);
      res.status(500).json({ error: 'スケジュールレポートの取得に失敗しました' });
    }
  }
);

/**
 * スケジュールレポート作成
 * POST /api/v1/reports/schedule
 */
router.post('/schedule',
  authenticate,
  authorize(['admin', 'hr_manager']),
  [
    body('name').notEmpty().isLength({ max: 200 }),
    body('type').isIn(Object.values(ReportType)),
    body('format').isIn(Object.values(OutputFormat)),
    body('schedule.frequency').isIn(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
    body('schedule.time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('schedule.timezone').notEmpty(),
    body('recipients').isArray().withMessage('recipients must be an array'),
    body('recipients.*.type').isIn(['user', 'email', 'webhook']),
    body('recipients.*.target').notEmpty(),
    body('recipients.*.format').isIn(Object.values(OutputFormat)),
    body('filters').optional().isObject(),
    body('parameters').optional().isObject()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const scheduledReport: ScheduledReport = {
        id: require('uuid').v4(),
        name: req.body.name,
        reportConfig: {
          id: req.body.type,
          type: req.body.type,
          name: req.body.name,
          description: `Scheduled ${req.body.name}`,
          dataSources: [], // 実際は設定から取得
          filters: [],
          parameters: [],
          outputFormats: [req.body.format],
          schedulable: true,
          accessLevel: 'internal',
          retentionDays: 90
        },
        schedule: {
          frequency: req.body.schedule.frequency,
          time: req.body.schedule.time,
          dayOfWeek: req.body.schedule.dayOfWeek,
          dayOfMonth: req.body.schedule.dayOfMonth,
          timezone: req.body.schedule.timezone,
          endDate: req.body.schedule.endDate ? new Date(req.body.schedule.endDate) : undefined
        },
        recipients: req.body.recipients,
        isActive: true,
        createdBy: req.user.id,
        createdAt: new Date()
      };

      await reportEngine.scheduleReport(scheduledReport);

      res.status(201).json({
        message: 'スケジュールレポートを作成しました',
        scheduledReport: {
          id: scheduledReport.id,
          name: scheduledReport.name,
          nextRun: scheduledReport.nextRun,
          recipients: scheduledReport.recipients.length
        }
      });
    } catch (error) {
      logger.error('Failed to create scheduled report:', error);
      res.status(500).json({ error: 'スケジュールレポートの作成に失敗しました' });
    }
  }
);

/**
 * レポート履歴
 * GET /api/v1/reports/history
 */
router.get('/history',
  authenticate,
  [
    query('page').optional().isInt({ min: 0 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(Object.values(ReportType)),
    query('status').optional().isIn(Object.values(ReportStatus)),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 0;
      const limit = parseInt(req.query.limit as string) || 20;

      // レポート履歴の取得（モックデータ）
      const history = [
        {
          id: 'req-001',
          type: ReportType.ATTENDANCE_SUMMARY,
          format: OutputFormat.PDF,
          status: ReportStatus.COMPLETED,
          fileName: '勤怠サマリーレポート_2025-01-21.pdf',
          fileSize: 1234567,
          requestedBy: req.user.id,
          requestedAt: new Date('2025-01-21T10:00:00Z'),
          completedAt: new Date('2025-01-21T10:03:00Z'),
          downloadUrl: '/downloads/reports/req-001.pdf',
          expiresAt: new Date('2025-01-28T10:03:00Z'),
          metadata: {
            recordCount: 150,
            generationTime: 180
          }
        },
        {
          id: 'req-002',
          type: ReportType.PAYROLL_SUMMARY,
          format: OutputFormat.EXCEL,
          status: ReportStatus.COMPLETED,
          fileName: '給与サマリーレポート_2025-01-20.xlsx',
          fileSize: 987654,
          requestedBy: req.user.id,
          requestedAt: new Date('2025-01-20T14:30:00Z'),
          completedAt: new Date('2025-01-20T14:35:00Z'),
          downloadUrl: '/downloads/reports/req-002.xlsx',
          expiresAt: new Date('2025-01-27T14:35:00Z'),
          metadata: {
            recordCount: 89,
            generationTime: 300
          }
        }
      ];

      res.json({
        reports: history,
        pagination: {
          page,
          limit,
          totalCount: history.length,
          hasMore: false
        }
      });
    } catch (error) {
      logger.error('Failed to get report history:', error);
      res.status(500).json({ error: 'レポート履歴の取得に失敗しました' });
    }
  }
);

/**
 * レポート統計（管理者用）
 * GET /api/v1/reports/admin/statistics
 */
router.get('/admin/statistics',
  authenticate,
  authorize(['admin', 'hr_manager']),
  query('period').optional().isIn(['week', 'month', 'quarter']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const period = req.query.period as string || 'month';

      // レポート統計の取得（モックデータ）
      const statistics = {
        period,
        summary: {
          totalReports: 1247,
          completedReports: 1198,
          failedReports: 49,
          successRate: 96.1,
          averageGenerationTime: 145, // seconds
          totalDataProcessed: '15.7GB'
        },
        byType: {
          [ReportType.ATTENDANCE_SUMMARY]: { count: 345, avgTime: 120, successRate: 98.5 },
          [ReportType.PAYROLL_SUMMARY]: { count: 234, avgTime: 180, successRate: 97.2 },
          [ReportType.OVERTIME_ANALYSIS]: { count: 156, avgTime: 95, successRate: 99.1 },
          [ReportType.EXPENSE_REPORT]: { count: 123, avgTime: 110, successRate: 96.7 },
          [ReportType.COMPLIANCE_AUDIT]: { count: 89, avgTime: 300, successRate: 94.4 },
          [ReportType.HUMAN_CAPITAL_METRICS]: { count: 67, avgTime: 220, successRate: 95.5 },
          [ReportType.PREDICTIVE_ANALYTICS]: { count: 45, avgTime: 420, successRate: 91.1 }
        },
        byFormat: {
          [OutputFormat.PDF]: { count: 567, percentage: 45.5 },
          [OutputFormat.EXCEL]: { count: 423, percentage: 33.9 },
          [OutputFormat.CSV]: { count: 189, percentage: 15.2 },
          [OutputFormat.JSON]: { count: 68, percentage: 5.4 }
        },
        usage: {
          peakHours: ['09:00', '14:00', '17:00'],
          busyDays: ['Monday', 'Friday'],
          averageReportsPerUser: 8.7,
          scheduledReportsRatio: 42.3
        },
        performance: {
          averageQueueTime: 12, // seconds
          processingEfficiency: 94.2, // %
          resourceUtilization: 78.5 // %
        }
      };

      res.json({ statistics });
    } catch (error) {
      logger.error('Failed to get report statistics:', error);
      res.status(500).json({ error: 'レポート統計の取得に失敗しました' });
    }
  }
);

/**
 * カスタムレポート作成（上級者向け）
 * POST /api/v1/reports/custom
 */
router.post('/custom',
  authenticate,
  authorize(['admin', 'advanced_user']),
  [
    body('name').notEmpty().isLength({ max: 200 }),
    body('description').optional().isLength({ max: 1000 }),
    body('query').isObject(),
    body('visualizations').optional().isArray(),
    body('parameters').optional().isArray()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const customReport = {
        id: require('uuid').v4(),
        name: req.body.name,
        description: req.body.description,
        query: req.body.query,
        visualizations: req.body.visualizations || [],
        parameters: req.body.parameters || [],
        createdBy: req.user.id,
        createdAt: new Date(),
        isPublic: req.body.isPublic || false
      };

      // カスタムレポートの保存（実装省略）
      logger.info(`Custom report created: ${customReport.name} by ${req.user.id}`);

      res.status(201).json({
        message: 'カスタムレポートを作成しました',
        report: {
          id: customReport.id,
          name: customReport.name,
          createdAt: customReport.createdAt
        },
        note: 'カスタムレポートは管理者の承認後に利用可能になります'
      });
    } catch (error) {
      logger.error('Failed to create custom report:', error);
      res.status(500).json({ error: 'カスタムレポートの作成に失敗しました' });
    }
  }
);

export default router;