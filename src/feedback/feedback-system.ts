/**
 * AI-OS 顧客フィードバック管理システム
 * フィードバックの収集、分析、対応を統合管理
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// フィードバックタイプ
export enum FeedbackType {
  BUG_REPORT = 'bug_report',
  FEATURE_REQUEST = 'feature_request',
  IMPROVEMENT = 'improvement',
  COMPLAINT = 'complaint',
  PRAISE = 'praise',
  QUESTION = 'question'
}

// フィードバックステータス
export enum FeedbackStatus {
  NEW = 'new',
  TRIAGED = 'triaged',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  WONT_FIX = 'wont_fix'
}

// 優先度
export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// センチメント（感情分析結果）
export enum Sentiment {
  VERY_POSITIVE = 'very_positive',
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  NEGATIVE = 'negative',
  VERY_NEGATIVE = 'very_negative'
}

// フィードバックインターフェース
export interface Feedback {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPlan: string;
  status: FeedbackStatus;
  priority: Priority;
  sentiment?: Sentiment;
  category?: string;
  tags: string[];
  attachments: Attachment[];
  metadata: FeedbackMetadata;
  assignedTo?: string;
  resolution?: string;
  internalNotes: Note[];
  publicComments: Comment[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  satisfactionScore?: number;
}

// 添付ファイル
interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}

// メタデータ
interface FeedbackMetadata {
  source: string; // web, email, api, chat
  userAgent?: string;
  ipAddress?: string;
  url?: string;
  version?: string;
  environment?: string;
  customFields?: Record<string, any>;
}

// 内部メモ
interface Note {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
}

// 公開コメント
interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
}

// フィードバック作成データ
export interface CreateFeedbackData {
  type: FeedbackType;
  title: string;
  description: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPlan: string;
  category?: string;
  tags?: string[];
  attachments?: Attachment[];
  metadata?: Partial<FeedbackMetadata>;
}

// フィードバック管理システム
export class FeedbackManagementSystem extends EventEmitter {
  private feedbacks: Map<string, Feedback> = new Map();
  private aiAnalyzer: AIFeedbackAnalyzer;
  private notificationService: NotificationService;
  private automationEngine: AutomationEngine;

  constructor() {
    super();
    this.aiAnalyzer = new AIFeedbackAnalyzer();
    this.notificationService = new NotificationService();
    this.automationEngine = new AutomationEngine();
  }

  /**
   * フィードバック作成
   */
  async createFeedback(data: CreateFeedbackData): Promise<Feedback> {
    const feedback: Feedback = {
      id: uuidv4(),
      type: data.type,
      title: data.title,
      description: data.description,
      customerId: data.customerId,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPlan: data.customerPlan,
      status: FeedbackStatus.NEW,
      priority: Priority.MEDIUM,
      category: data.category,
      tags: data.tags || [],
      attachments: data.attachments || [],
      metadata: {
        source: 'web',
        ...data.metadata
      },
      internalNotes: [],
      publicComments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // AI分析
    const analysis = await this.aiAnalyzer.analyze(feedback);
    feedback.sentiment = analysis.sentiment;
    feedback.priority = analysis.suggestedPriority;
    feedback.category = analysis.suggestedCategory || feedback.category;
    feedback.tags = [...new Set([...feedback.tags, ...analysis.suggestedTags])];

    // 保存
    this.feedbacks.set(feedback.id, feedback);

    // イベント発火
    this.emit('feedback:created', feedback);

    // 自動化ルール実行
    await this.automationEngine.processFeedback(feedback);

    // 通知送信
    await this.notificationService.sendNewFeedbackNotification(feedback);

    return feedback;
  }

  /**
   * フィードバック更新
   */
  async updateFeedback(
    id: string,
    updates: Partial<Feedback>
  ): Promise<Feedback> {
    const feedback = this.feedbacks.get(id);
    if (!feedback) {
      throw new Error('Feedback not found');
    }

    const previousStatus = feedback.status;
    const updatedFeedback = {
      ...feedback,
      ...updates,
      updatedAt: new Date()
    };

    // ステータス変更時の処理
    if (updates.status && updates.status !== previousStatus) {
      if (updates.status === FeedbackStatus.RESOLVED) {
        updatedFeedback.resolvedAt = new Date();
      }
      
      this.emit('feedback:status_changed', {
        feedback: updatedFeedback,
        previousStatus,
        newStatus: updates.status
      });
    }

    this.feedbacks.set(id, updatedFeedback);
    this.emit('feedback:updated', updatedFeedback);

    return updatedFeedback;
  }

  /**
   * コメント追加
   */
  async addComment(
    feedbackId: string,
    comment: Omit<Comment, 'id' | 'createdAt'>
  ): Promise<Comment> {
    const feedback = this.feedbacks.get(feedbackId);
    if (!feedback) {
      throw new Error('Feedback not found');
    }

    const newComment: Comment = {
      ...comment,
      id: uuidv4(),
      createdAt: new Date()
    };

    feedback.publicComments.push(newComment);
    feedback.updatedAt = new Date();
    
    this.feedbacks.set(feedbackId, feedback);
    this.emit('feedback:comment_added', { feedback, comment: newComment });

    // 顧客への通知
    if (!comment.isInternal) {
      await this.notificationService.sendCommentNotification(feedback, newComment);
    }

    return newComment;
  }

  /**
   * 内部メモ追加
   */
  async addInternalNote(
    feedbackId: string,
    note: Omit<Note, 'id' | 'createdAt'>
  ): Promise<Note> {
    const feedback = this.feedbacks.get(feedbackId);
    if (!feedback) {
      throw new Error('Feedback not found');
    }

    const newNote: Note = {
      ...note,
      id: uuidv4(),
      createdAt: new Date()
    };

    feedback.internalNotes.push(newNote);
    feedback.updatedAt = new Date();
    
    this.feedbacks.set(feedbackId, feedback);
    this.emit('feedback:note_added', { feedback, note: newNote });

    return newNote;
  }

  /**
   * フィードバック検索
   */
  async searchFeedback(query: FeedbackSearchQuery): Promise<Feedback[]> {
    let results = Array.from(this.feedbacks.values());

    // フィルタリング
    if (query.type) {
      results = results.filter(f => f.type === query.type);
    }
    if (query.status) {
      results = results.filter(f => f.status === query.status);
    }
    if (query.priority) {
      results = results.filter(f => f.priority === query.priority);
    }
    if (query.customerId) {
      results = results.filter(f => f.customerId === query.customerId);
    }
    if (query.assignedTo) {
      results = results.filter(f => f.assignedTo === query.assignedTo);
    }
    if (query.tags && query.tags.length > 0) {
      results = results.filter(f => 
        query.tags!.some(tag => f.tags.includes(tag))
      );
    }
    if (query.searchText) {
      const searchLower = query.searchText.toLowerCase();
      results = results.filter(f => 
        f.title.toLowerCase().includes(searchLower) ||
        f.description.toLowerCase().includes(searchLower)
      );
    }

    // 日付フィルタリング
    if (query.createdAfter) {
      results = results.filter(f => f.createdAt >= query.createdAfter!);
    }
    if (query.createdBefore) {
      results = results.filter(f => f.createdAt <= query.createdBefore!);
    }

    // ソート
    results.sort((a, b) => {
      switch (query.sortBy) {
        case 'createdAt':
          return query.sortOrder === 'asc' 
            ? a.createdAt.getTime() - b.createdAt.getTime()
            : b.createdAt.getTime() - a.createdAt.getTime();
        case 'priority':
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return query.sortOrder === 'asc'
            ? priorityOrder[a.priority] - priorityOrder[b.priority]
            : priorityOrder[b.priority] - priorityOrder[a.priority];
        default:
          return 0;
      }
    });

    // ページング
    if (query.limit) {
      const start = (query.page || 0) * query.limit;
      results = results.slice(start, start + query.limit);
    }

    return results;
  }

  /**
   * 統計情報取得
   */
  async getStatistics(period: StatisticsPeriod): Promise<FeedbackStatistics> {
    const feedbacks = Array.from(this.feedbacks.values());
    const now = new Date();
    const periodStart = this.getPeriodStart(now, period);

    const periodFeedbacks = feedbacks.filter(f => f.createdAt >= periodStart);

    return {
      total: periodFeedbacks.length,
      byType: this.groupBy(periodFeedbacks, 'type'),
      byStatus: this.groupBy(periodFeedbacks, 'status'),
      byPriority: this.groupBy(periodFeedbacks, 'priority'),
      bySentiment: this.groupBy(periodFeedbacks, 'sentiment'),
      averageResolutionTime: this.calculateAverageResolutionTime(periodFeedbacks),
      satisfactionScore: this.calculateAverageSatisfaction(periodFeedbacks),
      topTags: this.getTopTags(periodFeedbacks, 10),
      trendsOverTime: this.calculateTrends(feedbacks, period)
    };
  }

  private groupBy(feedbacks: Feedback[], key: keyof Feedback): Record<string, number> {
    return feedbacks.reduce((acc, f) => {
      const value = f[key] as string;
      if (value) {
        acc[value] = (acc[value] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
  }

  private calculateAverageResolutionTime(feedbacks: Feedback[]): number {
    const resolved = feedbacks.filter(f => f.resolvedAt);
    if (resolved.length === 0) return 0;

    const totalTime = resolved.reduce((sum, f) => {
      return sum + (f.resolvedAt!.getTime() - f.createdAt.getTime());
    }, 0);

    return totalTime / resolved.length / (1000 * 60 * 60); // 時間単位
  }

  private calculateAverageSatisfaction(feedbacks: Feedback[]): number {
    const withScore = feedbacks.filter(f => f.satisfactionScore !== undefined);
    if (withScore.length === 0) return 0;

    return withScore.reduce((sum, f) => sum + f.satisfactionScore!, 0) / withScore.length;
  }

  private getTopTags(feedbacks: Feedback[], limit: number): Array<{ tag: string; count: number }> {
    const tagCounts: Record<string, number> = {};
    
    feedbacks.forEach(f => {
      f.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private calculateTrends(feedbacks: Feedback[], period: StatisticsPeriod): TrendData[] {
    // 簡略化した実装
    return [];
  }

  private getPeriodStart(now: Date, period: StatisticsPeriod): Date {
    const start = new Date(now);
    switch (period) {
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
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
    return start;
  }
}

// AI分析エンジン
class AIFeedbackAnalyzer {
  async analyze(feedback: Feedback): Promise<AIAnalysisResult> {
    // 実際の実装では、自然言語処理APIを使用
    const sentiment = await this.analyzeSentiment(feedback.description);
    const category = await this.categorize(feedback);
    const priority = await this.prioritize(feedback);
    const tags = await this.extractTags(feedback);

    return {
      sentiment,
      suggestedCategory: category,
      suggestedPriority: priority,
      suggestedTags: tags,
      similarFeedbacks: [],
      automationSuggestions: []
    };
  }

  private async analyzeSentiment(text: string): Promise<Sentiment> {
    // 簡略化した感情分析
    const negativeWords = ['bad', 'poor', 'terrible', 'hate', 'broken'];
    const positiveWords = ['good', 'great', 'excellent', 'love', 'perfect'];
    
    const lowerText = text.toLowerCase();
    const negativeCount = negativeWords.filter(w => lowerText.includes(w)).length;
    const positiveCount = positiveWords.filter(w => lowerText.includes(w)).length;

    if (negativeCount > positiveCount) {
      return negativeCount > 2 ? Sentiment.VERY_NEGATIVE : Sentiment.NEGATIVE;
    } else if (positiveCount > negativeCount) {
      return positiveCount > 2 ? Sentiment.VERY_POSITIVE : Sentiment.POSITIVE;
    }
    return Sentiment.NEUTRAL;
  }

  private async categorize(feedback: Feedback): Promise<string> {
    // カテゴリー推定ロジック
    const categories = {
      'ui': ['interface', 'design', 'layout', 'button', 'screen'],
      'performance': ['slow', 'fast', 'speed', 'loading', 'lag'],
      'integration': ['api', 'integration', 'connect', 'sync'],
      'billing': ['payment', 'invoice', 'charge', 'billing', 'price']
    };

    const description = feedback.description.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => description.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  private async prioritize(feedback: Feedback): Promise<Priority> {
    // 優先度判定ロジック
    if (feedback.customerPlan === 'enterprise') {
      return Priority.HIGH;
    }
    
    if (feedback.type === FeedbackType.BUG_REPORT) {
      return Priority.HIGH;
    }
    
    if (feedback.type === FeedbackType.COMPLAINT) {
      return Priority.MEDIUM;
    }

    return Priority.MEDIUM;
  }

  private async extractTags(feedback: Feedback): Promise<string[]> {
    // タグ抽出ロジック
    const tags: string[] = [];
    
    // プランタグ
    tags.push(feedback.customerPlan);
    
    // タイプタグ
    tags.push(feedback.type);
    
    // キーワード抽出（簡略版）
    const keywords = ['login', 'report', 'export', 'import', 'mobile'];
    const description = feedback.description.toLowerCase();
    
    keywords.forEach(keyword => {
      if (description.includes(keyword)) {
        tags.push(keyword);
      }
    });

    return tags;
  }
}

// 通知サービス
class NotificationService {
  async sendNewFeedbackNotification(feedback: Feedback): Promise<void> {
    // 優先度に応じて通知先を決定
    const recipients = this.getRecipients(feedback);
    
    // メール通知
    await this.sendEmail(recipients, {
      subject: `新しいフィードバック: ${feedback.title}`,
      template: 'new-feedback',
      data: feedback
    });

    // Slack通知
    if (feedback.priority === Priority.CRITICAL || feedback.priority === Priority.HIGH) {
      await this.sendSlackNotification({
        channel: '#feedback-urgent',
        message: this.formatSlackMessage(feedback)
      });
    }
  }

  async sendCommentNotification(feedback: Feedback, comment: Comment): Promise<void> {
    await this.sendEmail([feedback.customerEmail], {
      subject: `Re: ${feedback.title}`,
      template: 'feedback-comment',
      data: { feedback, comment }
    });
  }

  private getRecipients(feedback: Feedback): string[] {
    const recipients: string[] = [];
    
    // カテゴリー別の担当者
    const categoryOwners: Record<string, string[]> = {
      'ui': ['design-team@ai-os.com'],
      'performance': ['infra-team@ai-os.com'],
      'integration': ['api-team@ai-os.com'],
      'billing': ['billing-team@ai-os.com']
    };

    if (feedback.category && categoryOwners[feedback.category]) {
      recipients.push(...categoryOwners[feedback.category]);
    }

    // 優先度別の追加通知
    if (feedback.priority === Priority.CRITICAL) {
      recipients.push('management@ai-os.com');
    }

    return recipients;
  }

  private formatSlackMessage(feedback: Feedback): string {
    return `
🆕 *新しいフィードバック*
*タイプ*: ${feedback.type}
*優先度*: ${feedback.priority}
*顧客*: ${feedback.customerName} (${feedback.customerPlan})
*タイトル*: ${feedback.title}
*センチメント*: ${feedback.sentiment || 'N/A'}
*詳細*: https://feedback.ai-os.com/feedback/${feedback.id}
    `.trim();
  }

  private async sendEmail(recipients: string[], options: any): Promise<void> {
    // メール送信実装
    console.log('Sending email to:', recipients, options);
  }

  private async sendSlackNotification(options: any): Promise<void> {
    // Slack通知実装
    console.log('Sending Slack notification:', options);
  }
}

// 自動化エンジン
class AutomationEngine {
  private rules: AutomationRule[] = [
    {
      name: 'Auto-assign critical bugs',
      condition: (f) => f.type === FeedbackType.BUG_REPORT && f.priority === Priority.CRITICAL,
      action: async (f) => {
        f.assignedTo = 'senior-dev-oncall';
        f.status = FeedbackStatus.TRIAGED;
      }
    },
    {
      name: 'Tag enterprise feedback',
      condition: (f) => f.customerPlan === 'enterprise',
      action: async (f) => {
        if (!f.tags.includes('enterprise')) {
          f.tags.push('enterprise');
        }
      }
    },
    {
      name: 'Auto-respond to praise',
      condition: (f) => f.type === FeedbackType.PRAISE,
      action: async (f) => {
        // 自動返信メール送信
        console.log('Sending thank you email for praise');
      }
    }
  ];

  async processFeedback(feedback: Feedback): Promise<void> {
    for (const rule of this.rules) {
      if (rule.condition(feedback)) {
        await rule.action(feedback);
        console.log(`Applied automation rule: ${rule.name}`);
      }
    }
  }
}

// インターフェース定義
interface FeedbackSearchQuery {
  type?: FeedbackType;
  status?: FeedbackStatus;
  priority?: Priority;
  customerId?: string;
  assignedTo?: string;
  tags?: string[];
  searchText?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  sortBy?: 'createdAt' | 'priority' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface FeedbackStatistics {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  bySentiment: Record<string, number>;
  averageResolutionTime: number;
  satisfactionScore: number;
  topTags: Array<{ tag: string; count: number }>;
  trendsOverTime: TrendData[];
}

interface AIAnalysisResult {
  sentiment: Sentiment;
  suggestedCategory: string;
  suggestedPriority: Priority;
  suggestedTags: string[];
  similarFeedbacks: string[];
  automationSuggestions: string[];
}

interface AutomationRule {
  name: string;
  condition: (feedback: Feedback) => boolean;
  action: (feedback: Feedback) => Promise<void>;
}

interface TrendData {
  date: Date;
  count: number;
  type?: string;
}

type StatisticsPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';

// エクスポート
export { FeedbackManagementSystem, AIFeedbackAnalyzer };