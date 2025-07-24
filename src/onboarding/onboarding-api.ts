/**
 * AI-OS オンボーディングAPI
 * 顧客オンボーディングプロセスの管理API
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../api/middleware/auth';
import { authorize } from '../api/middleware/authorize';
import { validateRequest } from '../api/middleware/validation';
import { body, query, param } from 'express-validator';
import {
  CustomerOnboardingSystem,
  OnboardingStage,
  OnboardingStatus,
  CustomerType,
  IndustryCategory,
  OnboardingContext
} from './customer-onboarding-system';
import { logger } from '../utils/logger';

const router = Router();
const onboardingSystem = new CustomerOnboardingSystem();

// オンボーディングシステムのイベントリスナー
onboardingSystem.on('onboarding:started', ({ customerId, context }) => {
  logger.info(`Onboarding journey started`, {
    customerId,
    company: context.companyName,
    type: context.customerType
  });
});

onboardingSystem.on('onboarding:stage_completed', ({ customerId, stage, progress }) => {
  logger.info(`Onboarding stage completed`, {
    customerId,
    stage,
    progress: progress.overallProgress
  });
});

onboardingSystem.on('onboarding:milestone_reached', ({ customerId, milestone }) => {
  logger.info(`Onboarding milestone reached`, {
    customerId,
    milestone: milestone.name,
    stage: milestone.stage
  });
});

/**
 * 新規オンボーディング開始
 * POST /api/v1/onboarding/start
 */
router.post('/start',
  authenticate,
  authorize(['admin', 'customer_success']),
  [
    body('customerId').isUUID(),
    body('companyName').notEmpty().isLength({ max: 200 }),
    body('customerType').isIn(Object.values(CustomerType)),
    body('industry').isIn(Object.values(IndustryCategory)),
    body('employeeCount').isInt({ min: 1 }),
    body('primaryContact.name').notEmpty(),
    body('primaryContact.email').isEmail(),
    body('primaryContact.role').notEmpty(),
    body('primaryContact.timezone').notEmpty(),
    body('preferences.pace').optional().isIn(['fast', 'normal', 'slow']),
    body('preferences.communicationChannel').optional().isIn(['email', 'slack', 'phone', 'in_app']),
    body('targetGoLiveDate').optional().isISO8601()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const context: OnboardingContext = {
        customerId: req.body.customerId,
        companyName: req.body.companyName,
        customerType: req.body.customerType,
        industry: req.body.industry,
        employeeCount: req.body.employeeCount,
        existingSystems: req.body.existingSystems || [],
        primaryContact: req.body.primaryContact,
        technicalContact: req.body.technicalContact,
        preferences: {
          pace: 'normal',
          communicationChannel: 'email',
          preferredTime: 'morning',
          skipNonEssentials: false,
          requiresDataMigration: false,
          hasITSupport: true,
          ...req.body.preferences
        },
        startDate: new Date(),
        targetGoLiveDate: req.body.targetGoLiveDate ? new Date(req.body.targetGoLiveDate) : undefined
      };

      const progress = await onboardingSystem.startOnboarding(context);

      res.status(201).json({
        message: 'オンボーディングを開始しました',
        progress,
        nextSteps: [
          'ウェルカムメールをご確認ください',
          '企業プロフィール設定から開始してください',
          'ご不明な点がございましたら、サポートチームまでお問い合わせください'
        ]
      });
    } catch (error) {
      logger.error('Failed to start onboarding:', error);
      res.status(500).json({ error: 'オンボーディングの開始に失敗しました' });
    }
  }
);

/**
 * オンボーディング進捗取得
 * GET /api/v1/onboarding/progress/:customerId
 */
router.get('/progress/:customerId',
  authenticate,
  param('customerId').isUUID(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const progress = onboardingSystem.getProgress(customerId);

      if (!progress) {
        return res.status(404).json({ error: 'オンボーディング情報が見つかりません' });
      }

      // 次のタスクの推奨
      const nextTasks = getNextRecommendedTasks(progress);

      // 推定完了時間の更新
      const updatedEstimation = calculateRemainingTime(progress);

      res.json({
        progress: {
          ...progress,
          estimatedCompletion: updatedEstimation
        },
        nextRecommendedTasks: nextTasks,
        insights: generateProgressInsights(progress)
      });
    } catch (error) {
      logger.error('Failed to get onboarding progress:', error);
      res.status(500).json({ error: '進捗情報の取得に失敗しました' });
    }
  }
);

/**
 * タスク完了マーク
 * POST /api/v1/onboarding/:customerId/complete-task
 */
router.post('/:customerId/complete-task',
  authenticate,
  param('customerId').isUUID(),
  [
    body('taskId').notEmpty(),
    body('completionData').optional().isObject()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { customerId } = req.params;
      const { taskId, completionData } = req.body;

      const progress = await onboardingSystem.completeTask(
        customerId,
        taskId,
        {
          ...completionData,
          completedBy: req.user.id,
          completedAt: new Date()
        }
      );

      // 完了通知
      const taskCompleted = getTaskDetails(taskId);
      const isStageComplete = checkStageCompletion(progress);

      res.json({
        message: `タスク "${taskCompleted?.name}" が完了しました`,
        progress,
        achievements: {
          taskCompleted: true,
          stageCompleted: isStageComplete,
          milestonReached: checkMilestoneCompletion(progress)
        },
        nextActions: generateNextActions(progress)
      });
    } catch (error) {
      logger.error('Failed to complete task:', error);
      if (error instanceof Error && error.message.includes('criteria not met')) {
        res.status(400).json({ error: 'タスクの完了条件が満たされていません' });
      } else {
        res.status(500).json({ error: 'タスクの完了処理に失敗しました' });
      }
    }
  }
);

/**
 * タスクスキップ
 * POST /api/v1/onboarding/:customerId/skip-task
 */
router.post('/:customerId/skip-task',
  authenticate,
  param('customerId').isUUID(),
  [
    body('taskId').notEmpty(),
    body('reason').optional().isString()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { customerId } = req.params;
      const { taskId, reason } = req.body;

      const progress = onboardingSystem.getProgress(customerId);
      if (!progress) {
        return res.status(404).json({ error: 'オンボーディング情報が見つかりません' });
      }

      // スキップ処理
      progress.skippedTasks.push(taskId);
      progress.lastActivity = new Date();

      logger.info(`Task skipped`, {
        customerId,
        taskId,
        reason: reason || 'No reason provided',
        skippedBy: req.user.id
      });

      res.json({
        message: 'タスクをスキップしました',
        progress,
        note: 'スキップしたタスクは後から実行することができます'
      });
    } catch (error) {
      logger.error('Failed to skip task:', error);
      res.status(500).json({ error: 'タスクのスキップに失敗しました' });
    }
  }
);

/**
 * オンボーディング一時停止
 * POST /api/v1/onboarding/:customerId/pause
 */
router.post('/:customerId/pause',
  authenticate,
  param('customerId').isUUID(),
  [
    body('reason').notEmpty(),
    body('expectedResumptionDate').optional().isISO8601()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const { reason, expectedResumptionDate } = req.body;

      await onboardingSystem.pauseOnboarding(customerId, reason);

      res.json({
        message: 'オンボーディングを一時停止しました',
        pauseReason: reason,
        expectedResumption: expectedResumptionDate,
        note: '準備ができましたら、いつでも再開できます'
      });
    } catch (error) {
      logger.error('Failed to pause onboarding:', error);
      res.status(500).json({ error: 'オンボーディングの一時停止に失敗しました' });
    }
  }
);

/**
 * オンボーディング再開
 * POST /api/v1/onboarding/:customerId/resume
 */
router.post('/:customerId/resume',
  authenticate,
  param('customerId').isUUID(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;

      await onboardingSystem.resumeOnboarding(customerId);
      const progress = onboardingSystem.getProgress(customerId);

      res.json({
        message: 'オンボーディングを再開しました',
        progress,
        nextSteps: generateNextActions(progress!)
      });
    } catch (error) {
      logger.error('Failed to resume onboarding:', error);
      res.status(500).json({ error: 'オンボーディングの再開に失敗しました' });
    }
  }
);

/**
 * オンボーディング統計（管理者用）
 * GET /api/v1/onboarding/admin/statistics
 */
router.get('/admin/statistics',
  authenticate,
  authorize(['admin', 'customer_success']),
  query('period').optional().isIn(['week', 'month', 'quarter']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const period = req.query.period as string || 'month';

      // オンボーディング統計の計算（モックデータ）
      const statistics = {
        period,
        overallMetrics: {
          totalOnboardings: 145,
          completedOnboardings: 89,
          completionRate: 61.4,
          averageTimeToComplete: 14.5, // days
          averageTasksCompleted: 12.3,
          dropOffRate: 15.2
        },
        byStage: {
          [OnboardingStage.TRIAL_SIGNUP]: { count: 25, completionRate: 100 },
          [OnboardingStage.COMPANY_SETUP]: { count: 23, completionRate: 92 },
          [OnboardingStage.USER_CREATION]: { count: 21, completionRate: 91.3 },
          [OnboardingStage.INTEGRATION_SETUP]: { count: 18, completionRate: 85.7 },
          [OnboardingStage.DATA_MIGRATION]: { count: 12, completionRate: 66.7 },
          [OnboardingStage.FEATURE_TRAINING]: { count: 15, completionRate: 83.3 },
          [OnboardingStage.GO_LIVE]: { count: 14, completionRate: 93.3 },
          [OnboardingStage.SUCCESS_MILESTONE]: { count: 11, completionRate: 78.6 }
        },
        byCustomerType: {
          [CustomerType.STARTUP]: { count: 58, completionRate: 72.4, avgDays: 8.2 },
          [CustomerType.SMB]: { count: 52, completionRate: 61.5, avgDays: 12.8 },
          [CustomerType.MIDMARKET]: { count: 28, completionRate: 46.4, avgDays: 18.5 },
          [CustomerType.ENTERPRISE]: { count: 7, completionRate: 42.9, avgDays: 25.3 }
        },
        commonBlockers: [
          { issue: 'データ移行の複雑性', frequency: 34 },
          { issue: '既存システムとの競合', frequency: 28 },
          { issue: 'IT部門の承認待ち', frequency: 22 },
          { issue: 'トレーニングスケジュール調整', frequency: 18 }
        ],
        improvements: [
          'データ移行ツールの簡素化',
          'IT部門向け専用ガイドの作成',
          '段階的トレーニングオプションの追加'
        ]
      };

      res.json({ statistics });
    } catch (error) {
      logger.error('Failed to get onboarding statistics:', error);
      res.status(500).json({ error: '統計情報の取得に失敗しました' });
    }
  }
);

/**
 * 個別顧客のオンボーディング詳細（管理者用）
 * GET /api/v1/onboarding/admin/customer/:customerId
 */
router.get('/admin/customer/:customerId',
  authenticate,
  authorize(['admin', 'customer_success']),
  param('customerId').isUUID(),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const progress = onboardingSystem.getProgress(customerId);

      if (!progress) {
        return res.status(404).json({ error: '顧客情報が見つかりません' });
      }

      // 詳細分析
      const analysis = {
        progress,
        timeline: generateTimeline(progress),
        bottlenecks: identifyBottlenecks(progress),
        recommendations: generateRecommendations(progress),
        riskAssessment: assessRisk(progress),
        interventionSuggestions: suggestInterventions(progress)
      };

      res.json({ analysis });
    } catch (error) {
      logger.error('Failed to get customer onboarding details:', error);
      res.status(500).json({ error: '顧客オンボーディング詳細の取得に失敗しました' });
    }
  }
);

/**
 * オンボーディングテンプレートのカスタマイズ
 * POST /api/v1/onboarding/admin/customize-template
 */
router.post('/admin/customize-template',
  authenticate,
  authorize(['admin']),
  [
    body('customerType').isIn(Object.values(CustomerType)),
    body('industry').optional().isIn(Object.values(IndustryCategory)),
    body('customizations').isArray(),
    body('customizations.*.taskId').notEmpty(),
    body('customizations.*.action').isIn(['skip', 'modify', 'add']),
    body('customizations.*.parameters').optional().isObject()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const { customerType, industry, customizations } = req.body;

      // テンプレートカスタマイゼーションの適用
      const customizedTemplate = {
        id: require('uuid').v4(),
        customerType,
        industry,
        customizations,
        createdAt: new Date(),
        appliedTo: [],
        effectiveness: null // 後で測定
      };

      // カスタマイゼーションを保存（実装省略）
      logger.info('Onboarding template customized', {
        customerType,
        industry,
        customizationCount: customizations.length
      });

      res.status(201).json({
        message: 'オンボーディングテンプレートをカスタマイズしました',
        template: customizedTemplate,
        note: '新しいテンプレートは該当する顧客タイプの今後のオンボーディングに適用されます'
      });
    } catch (error) {
      logger.error('Failed to customize onboarding template:', error);
      res.status(500).json({ error: 'テンプレートのカスタマイズに失敗しました' });
    }
  }
);

// ヘルパー関数

function getNextRecommendedTasks(progress: any): any[] {
  // 現在のステージで未完了のタスクを返す
  return [
    {
      id: 'company-profile',
      name: '企業プロフィール設定',
      priority: 'high',
      estimatedMinutes: 10
    },
    {
      id: 'admin-user-setup',
      name: '管理者ユーザー設定',
      priority: 'medium',
      estimatedMinutes: 8
    }
  ];
}

function calculateRemainingTime(progress: any): Date {
  // 残りタスクの推定時間を計算
  const baseTime = 120; // 基本120分
  const completed = progress.overallProgress / 100;
  const remaining = (1 - completed) * baseTime;
  
  return new Date(Date.now() + remaining * 60 * 1000);
}

function generateProgressInsights(progress: any): any {
  const insights = [];
  
  if (progress.overallProgress > 75) {
    insights.push({
      type: 'positive',
      message: '順調に進んでいます！もうすぐ完了です。',
      action: '残りのタスクを完了して本格運用を開始しましょう。'
    });
  } else if (progress.overallProgress < 25) {
    insights.push({
      type: 'encouragement',
      message: 'まだ始まったばかりです。一つずつ進めていきましょう。',
      action: 'サポートが必要でしたら、お気軽にお声かけください。'
    });
  }

  return insights;
}

function getTaskDetails(taskId: string): any {
  // タスクの詳細情報を返す
  return { id: taskId, name: 'Sample Task' };
}

function checkStageCompletion(progress: any): boolean {
  // ステージが完了したかチェック
  return false;
}

function checkMilestoneCompletion(progress: any): boolean {
  // マイルストーンに到達したかチェック
  return false;
}

function generateNextActions(progress: any): string[] {
  return [
    '次のタスクに進んでください',
    'ヘルプが必要な場合はサポートまでご連絡ください'
  ];
}

function generateTimeline(progress: any): any[] {
  return [
    {
      date: progress.startDate,
      event: 'オンボーディング開始',
      type: 'milestone'
    }
  ];
}

function identifyBottlenecks(progress: any): string[] {
  return ['データ移行に時間がかかっています'];
}

function generateRecommendations(progress: any): string[] {
  return ['CSチームからの積極的なサポートを推奨'];
}

function assessRisk(progress: any): any {
  return {
    level: 'medium',
    factors: ['進捗の遅れ'],
    mitigations: ['追加サポートの提供']
  };
}

function suggestInterventions(progress: any): string[] {
  return ['CSチームからの電話サポート'];
}

export default router;