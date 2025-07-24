/**
 * AI-OS フィードバックAPI
 * 顧客フィードバックの管理APIエンドポイント
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../api/middleware/auth';
import { authorize } from '../api/middleware/authorize';
import { validateRequest } from '../api/middleware/validation';
import { body, query, param } from 'express-validator';
import {
  FeedbackManagementSystem,
  FeedbackType,
  FeedbackStatus,
  Priority,
  CreateFeedbackData
} from './feedback-system';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';

const router = Router();
const feedbackSystem = new FeedbackManagementSystem();

// ファイルアップロード設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/feedback'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|log/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

/**
 * フィードバック作成
 * POST /api/v1/feedback
 */
router.post('/',
  authenticate,
  upload.array('attachments', 5),
  [
    body('type').isIn(Object.values(FeedbackType)),
    body('title').notEmpty().isLength({ max: 200 }),
    body('description').notEmpty().isLength({ max: 5000 }),
    body('category').optional().isString(),
    body('tags').optional().isArray()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const user = req.user;
      const files = req.files as Express.Multer.File[] || [];

      const attachments = files.map(file => ({
        id: file.filename,
        filename: file.originalname,
        url: `/uploads/feedback/${file.filename}`,
        size: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date()
      }));

      const feedbackData: CreateFeedbackData = {
        type: req.body.type,
        title: req.body.title,
        description: req.body.description,
        customerId: user.id,
        customerName: user.name,
        customerEmail: user.email,
        customerPlan: user.plan || 'free',
        category: req.body.category,
        tags: req.body.tags || [],
        attachments,
        metadata: {
          source: 'api',
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          version: req.headers['x-app-version'] as string,
          ...req.body.metadata
        }
      };

      const feedback = await feedbackSystem.createFeedback(feedbackData);

      logger.info(`Feedback created: ${feedback.id} by ${user.email}`);

      res.status(201).json({
        feedback,
        message: 'フィードバックを受け付けました。ご意見ありがとうございます。'
      });
    } catch (error) {
      logger.error('Failed to create feedback:', error);
      res.status(500).json({ error: 'フィードバックの作成に失敗しました' });
    }
  }
);

/**
 * フィードバック一覧取得
 * GET /api/v1/feedback
 */
router.get('/',
  authenticate,
  [
    query('type').optional().isIn(Object.values(FeedbackType)),
    query('status').optional().isIn(Object.values(FeedbackStatus)),
    query('priority').optional().isIn(Object.values(Priority)),
    query('page').optional().isInt({ min: 0 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const user = req.user;
      const isAdmin = user.roles?.includes('admin');

      const searchQuery = {
        type: req.query.type as FeedbackType,
        status: req.query.status as FeedbackStatus,
        priority: req.query.priority as Priority,
        customerId: isAdmin ? undefined : user.id,
        searchText: req.query.search as string,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
        page: parseInt(req.query.page as string) || 0,
        limit: parseInt(req.query.limit as string) || 20
      };

      const feedbacks = await feedbackSystem.searchFeedback(searchQuery);

      res.json({
        feedbacks,
        pagination: {
          page: searchQuery.page,
          limit: searchQuery.limit,
          hasMore: feedbacks.length === searchQuery.limit
        }
      });
    } catch (error) {
      logger.error('Failed to search feedback:', error);
      res.status(500).json({ error: 'フィードバックの検索に失敗しました' });
    }
  }
);

/**
 * フィードバック詳細取得
 * GET /api/v1/feedback/:id
 */
router.get('/:id',
  authenticate,
  param('id').isUUID(),
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user;

      const feedbacks = await feedbackSystem.searchFeedback({ limit: 1 });
      const feedback = feedbacks.find(f => f.id === id);

      if (!feedback) {
        return res.status(404).json({ error: 'フィードバックが見つかりません' });
      }

      // 権限チェック
      const isAdmin = user.roles?.includes('admin');
      if (!isAdmin && feedback.customerId !== user.id) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }

      res.json({ feedback });
    } catch (error) {
      logger.error('Failed to get feedback:', error);
      res.status(500).json({ error: 'フィードバックの取得に失敗しました' });
    }
  }
);

/**
 * フィードバック更新（管理者のみ）
 * PUT /api/v1/feedback/:id
 */
router.put('/:id',
  authenticate,
  authorize(['admin']),
  param('id').isUUID(),
  [
    body('status').optional().isIn(Object.values(FeedbackStatus)),
    body('priority').optional().isIn(Object.values(Priority)),
    body('assignedTo').optional().isString(),
    body('category').optional().isString(),
    body('tags').optional().isArray(),
    body('resolution').optional().isString()
  ],
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const feedback = await feedbackSystem.updateFeedback(id, updates);

      logger.info(`Feedback updated: ${id} by ${req.user.email}`);

      res.json({ feedback });
    } catch (error) {
      logger.error('Failed to update feedback:', error);
      res.status(500).json({ error: 'フィードバックの更新に失敗しました' });
    }
  }
);

/**
 * コメント追加
 * POST /api/v1/feedback/:id/comments
 */
router.post('/:id/comments',
  authenticate,
  param('id').isUUID(),
  body('content').notEmpty().isLength({ max: 2000 }),
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const user = req.user;
      const isAdmin = user.roles?.includes('admin');

      // フィードバックの存在と権限チェック
      const feedbacks = await feedbackSystem.searchFeedback({ limit: 1 });
      const feedback = feedbacks.find(f => f.id === id);

      if (!feedback) {
        return res.status(404).json({ error: 'フィードバックが見つかりません' });
      }

      if (!isAdmin && feedback.customerId !== user.id) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }

      const comment = await feedbackSystem.addComment(id, {
        authorId: user.id,
        authorName: user.name,
        content,
        isInternal: false
      });

      res.status(201).json({ comment });
    } catch (error) {
      logger.error('Failed to add comment:', error);
      res.status(500).json({ error: 'コメントの追加に失敗しました' });
    }
  }
);

/**
 * 内部メモ追加（管理者のみ）
 * POST /api/v1/feedback/:id/notes
 */
router.post('/:id/notes',
  authenticate,
  authorize(['admin', 'support']),
  param('id').isUUID(),
  body('content').notEmpty().isLength({ max: 2000 }),
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const user = req.user;

      const note = await feedbackSystem.addInternalNote(id, {
        authorId: user.id,
        authorName: user.name,
        content
      });

      res.status(201).json({ note });
    } catch (error) {
      logger.error('Failed to add note:', error);
      res.status(500).json({ error: '内部メモの追加に失敗しました' });
    }
  }
);

/**
 * 満足度評価
 * POST /api/v1/feedback/:id/satisfaction
 */
router.post('/:id/satisfaction',
  authenticate,
  param('id').isUUID(),
  body('score').isInt({ min: 1, max: 5 }),
  validateRequest,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      const { id } = req.params;
      const { score } = req.body;
      const user = req.user;

      // フィードバックの存在と権限チェック
      const feedbacks = await feedbackSystem.searchFeedback({ limit: 1 });
      const feedback = feedbacks.find(f => f.id === id);

      if (!feedback) {
        return res.status(404).json({ error: 'フィードバックが見つかりません' });
      }

      if (feedback.customerId !== user.id) {
        return res.status(403).json({ error: 'アクセス権限がありません' });
      }

      if (feedback.status !== FeedbackStatus.RESOLVED && feedback.status !== FeedbackStatus.CLOSED) {
        return res.status(400).json({ error: '解決済みのフィードバックのみ評価できます' });
      }

      await feedbackSystem.updateFeedback(id, { satisfactionScore: score });

      res.json({ 
        message: '評価を受け付けました。ありがとうございます。',
        score 
      });
    } catch (error) {
      logger.error('Failed to add satisfaction score:', error);
      res.status(500).json({ error: '満足度評価の追加に失敗しました' });
    }
  }
);

/**
 * 統計情報取得（管理者のみ）
 * GET /api/v1/feedback/statistics
 */
router.get('/statistics',
  authenticate,
  authorize(['admin', 'support']),
  query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']),
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const period = (req.query.period as any) || 'month';
      const statistics = await feedbackSystem.getStatistics(period);

      res.json({ statistics, period });
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      res.status(500).json({ error: '統計情報の取得に失敗しました' });
    }
  }
);

/**
 * フィードバックエクスポート（管理者のみ）
 * GET /api/v1/feedback/export
 */
router.get('/export',
  authenticate,
  authorize(['admin']),
  [
    query('format').optional().isIn(['csv', 'json', 'excel']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validateRequest,
  async (req: Request, res: Response) => {
    try {
      const format = req.query.format || 'csv';
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const feedbacks = await feedbackSystem.searchFeedback({
        createdAfter: startDate,
        createdBefore: endDate,
        limit: 10000 // 最大エクスポート数
      });

      switch (format) {
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.csv');
          res.send(convertToCSV(feedbacks));
          break;
        case 'json':
          res.json({ feedbacks });
          break;
        case 'excel':
          // Excel形式のエクスポート実装
          res.status(501).json({ error: 'Excel形式は準備中です' });
          break;
      }
    } catch (error) {
      logger.error('Failed to export feedback:', error);
      res.status(500).json({ error: 'フィードバックのエクスポートに失敗しました' });
    }
  }
);

// CSV変換ヘルパー関数
function convertToCSV(feedbacks: any[]): string {
  if (feedbacks.length === 0) return '';

  const headers = [
    'ID', 'Type', 'Title', 'Description', 'Customer Name', 'Customer Email',
    'Status', 'Priority', 'Sentiment', 'Category', 'Tags', 'Created At',
    'Resolved At', 'Satisfaction Score'
  ];

  const rows = feedbacks.map(f => [
    f.id,
    f.type,
    `"${f.title.replace(/"/g, '""')}"`,
    `"${f.description.replace(/"/g, '""')}"`,
    f.customerName,
    f.customerEmail,
    f.status,
    f.priority,
    f.sentiment || '',
    f.category || '',
    f.tags.join(';'),
    f.createdAt.toISOString(),
    f.resolvedAt?.toISOString() || '',
    f.satisfactionScore || ''
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export default router;