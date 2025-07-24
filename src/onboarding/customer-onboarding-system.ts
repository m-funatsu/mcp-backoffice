/**
 * AI-OS 顧客オンボーディング自動化システム
 * 新規顧客の導入プロセスを完全自動化し、最適な体験を提供
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// オンボーディングステージ
export enum OnboardingStage {
  TRIAL_SIGNUP = 'trial_signup',           // トライアル登録
  COMPANY_SETUP = 'company_setup',         // 企業情報設定
  USER_CREATION = 'user_creation',         // ユーザー作成
  INTEGRATION_SETUP = 'integration_setup', // 外部連携設定
  DATA_MIGRATION = 'data_migration',       // データ移行
  FEATURE_TRAINING = 'feature_training',   // 機能トレーニング
  GO_LIVE = 'go_live',                     // 本格運用開始
  SUCCESS_MILESTONE = 'success_milestone'  // 成功マイルストーン
}

// オンボーディング状態
export enum OnboardingStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  SKIPPED = 'skipped'
}

// 顧客タイプ
export enum CustomerType {
  STARTUP = 'startup',           // スタートアップ（1-10名）
  SMB = 'smb',                   // 中小企業（11-100名）
  MIDMARKET = 'midmarket',       // 中堅企業（101-1000名）
  ENTERPRISE = 'enterprise'      // エンタープライズ（1000名以上）
}

// 業界カテゴリー
export enum IndustryCategory {
  TECHNOLOGY = 'technology',
  FINANCE = 'finance',
  HEALTHCARE = 'healthcare',
  MANUFACTURING = 'manufacturing',
  RETAIL = 'retail',
  EDUCATION = 'education',
  GOVERNMENT = 'government',
  OTHER = 'other'
}

// オンボーディングタスク
export interface OnboardingTask {
  id: string;
  stage: OnboardingStage;
  name: string;
  description: string;
  estimatedMinutes: number;
  isRequired: boolean;
  dependencies: string[];
  completionCriteria: CompletionCriteria;
  resources: TaskResource[];
  automatable: boolean;
  customerType?: CustomerType[];
  industryType?: IndustryCategory[];
}

// 完了基準
export interface CompletionCriteria {
  type: 'api_call' | 'user_action' | 'data_validation' | 'time_based';
  condition: string;
  validationFunction?: (context: OnboardingContext) => Promise<boolean>;
}

// タスクリソース
export interface TaskResource {
  type: 'video' | 'document' | 'interactive_tutorial' | 'webinar';
  title: string;
  url: string;
  duration?: number;
  mandatory: boolean;
}

// オンボーディングコンテキスト
export interface OnboardingContext {
  customerId: string;
  companyName: string;
  customerType: CustomerType;
  industry: IndustryCategory;
  employeeCount: number;
  existingSystems: string[];
  primaryContact: ContactInfo;
  technicalContact?: ContactInfo;
  preferences: OnboardingPreferences;
  startDate: Date;
  targetGoLiveDate?: Date;
}

// 連絡先情報
export interface ContactInfo {
  name: string;
  email: string;
  phone?: string;
  role: string;
  timezone: string;
}

// オンボーディング設定
export interface OnboardingPreferences {
  communicationChannel: 'email' | 'slack' | 'phone' | 'in_app';
  preferredTime: string; // "morning" | "afternoon" | "evening"
  pace: 'fast' | 'normal' | 'slow';
  skipNonEssentials: boolean;
  requiresDataMigration: boolean;
  hasITSupport: boolean;
}

// オンボーディングプログレス
export interface OnboardingProgress {
  customerId: string;
  currentStage: OnboardingStage;
  completedTasks: string[];
  skippedTasks: string[];
  blockedTasks: string[];
  overallProgress: number; // 0-100%
  estimatedCompletion: Date;
  actualTimeSpent: number; // minutes
  lastActivity: Date;
  milestones: Milestone[];
}

// マイルストーン
export interface Milestone {
  id: string;
  name: string;
  stage: OnboardingStage;
  completedAt?: Date;
  businessValue: string;
  celebration?: CelebrationAction;
}

// お祝いアクション
export interface CelebrationAction {
  type: 'email' | 'in_app_notification' | 'slack_message' | 'gift';
  content: string;
  triggerImmediately: boolean;
}

/**
 * 顧客オンボーディング自動化システム
 */
export class CustomerOnboardingSystem extends EventEmitter {
  private onboardingTasks: Map<string, OnboardingTask> = new Map();
  private customerProgress: Map<string, OnboardingProgress> = new Map();
  private aiPersonalizationEngine: PersonalizationEngine;
  private communicationEngine: CommunicationEngine;
  private integrationEngine: IntegrationEngine;

  constructor() {
    super();
    this.aiPersonalizationEngine = new PersonalizationEngine();
    this.communicationEngine = new CommunicationEngine();
    this.integrationEngine = new IntegrationEngine();
    this.initializeStandardTasks();
  }

  /**
   * 標準オンボーディングタスクの初期化
   */
  private initializeStandardTasks() {
    // Stage 1: トライアル登録
    this.registerTask({
      id: 'trial-signup',
      stage: OnboardingStage.TRIAL_SIGNUP,
      name: 'トライアル登録完了',
      description: 'アカウント作成とメール認証を完了する',
      estimatedMinutes: 5,
      isRequired: true,
      dependencies: [],
      completionCriteria: {
        type: 'api_call',
        condition: 'email_verified'
      },
      resources: [{
        type: 'video',
        title: 'AI-OS紹介動画',
        url: '/onboarding/intro-video',
        duration: 3,
        mandatory: false
      }],
      automatable: true
    });

    this.registerTask({
      id: 'welcome-email',
      stage: OnboardingStage.TRIAL_SIGNUP,
      name: 'ウェルカムメール送信',
      description: 'パーソナライズされたウェルカムメールを送信',
      estimatedMinutes: 0,
      isRequired: true,
      dependencies: ['trial-signup'],
      completionCriteria: {
        type: 'api_call',
        condition: 'email_sent'
      },
      resources: [],
      automatable: true
    });

    // Stage 2: 企業情報設定
    this.registerTask({
      id: 'company-profile',
      stage: OnboardingStage.COMPANY_SETUP,
      name: '企業プロフィール設定',
      description: '会社情報、業界、従業員数などの基本情報を設定',
      estimatedMinutes: 10,
      isRequired: true,
      dependencies: ['trial-signup'],
      completionCriteria: {
        type: 'data_validation',
        condition: 'company_info_complete'
      },
      resources: [{
        type: 'interactive_tutorial',
        title: '企業設定ガイド',
        url: '/onboarding/company-setup',
        mandatory: true
      }],
      automatable: false
    });

    this.registerTask({
      id: 'legal-compliance',
      stage: OnboardingStage.COMPANY_SETUP,
      name: '法的要件設定',
      description: '労働基準法、36協定などの法的要件を設定',
      estimatedMinutes: 15,
      isRequired: true,
      dependencies: ['company-profile'],
      completionCriteria: {
        type: 'data_validation',
        condition: 'legal_settings_complete'
      },
      resources: [{
        type: 'document',
        title: '労働基準法準拠ガイド',
        url: '/docs/legal-compliance',
        mandatory: true
      }],
      automatable: false,
      customerType: [CustomerType.SMB, CustomerType.MIDMARKET, CustomerType.ENTERPRISE]
    });

    // Stage 3: ユーザー作成
    this.registerTask({
      id: 'admin-user-setup',
      stage: OnboardingStage.USER_CREATION,
      name: '管理者ユーザー設定',
      description: 'システム管理者とHR管理者のアカウントを作成',
      estimatedMinutes: 8,
      isRequired: true,
      dependencies: ['company-profile'],
      completionCriteria: {
        type: 'data_validation',
        condition: 'admin_users_created'
      },
      resources: [{
        type: 'video',
        title: 'ユーザー管理チュートリアル',
        url: '/onboarding/user-management',
        duration: 5,
        mandatory: true
      }],
      automatable: false
    });

    this.registerTask({
      id: 'bulk-user-import',
      stage: OnboardingStage.USER_CREATION,
      name: '従業員一括登録',
      description: 'CSVまたはExcelファイルから従業員を一括登録',
      estimatedMinutes: 20,
      isRequired: false,
      dependencies: ['admin-user-setup'],
      completionCriteria: {
        type: 'data_validation',
        condition: 'employees_imported'
      },
      resources: [{
        type: 'document',
        title: 'CSV取り込みテンプレート',
        url: '/templates/employee-import.csv',
        mandatory: true
      }],
      automatable: true,
      customerType: [CustomerType.SMB, CustomerType.MIDMARKET, CustomerType.ENTERPRISE]
    });

    // Stage 4: 外部連携設定
    this.registerTask({
      id: 'accounting-integration',
      stage: OnboardingStage.INTEGRATION_SETUP,
      name: '会計ソフト連携',
      description: 'freee、マネーフォワード、弥生会計との連携設定',
      estimatedMinutes: 15,
      isRequired: false,
      dependencies: ['admin-user-setup'],
      completionCriteria: {
        type: 'api_call',
        condition: 'accounting_connected'
      },
      resources: [{
        type: 'video',
        title: '会計連携設定ガイド',
        url: '/onboarding/accounting-integration',
        duration: 8,
        mandatory: true
      }],
      automatable: true,
      customerType: [CustomerType.SMB, CustomerType.MIDMARKET, CustomerType.ENTERPRISE]
    });

    this.registerTask({
      id: 'slack-integration',
      stage: OnboardingStage.INTEGRATION_SETUP,
      name: 'Slack連携設定',
      description: 'Slackワークスペースとの連携で承認通知を自動化',
      estimatedMinutes: 10,
      isRequired: false,
      dependencies: ['admin-user-setup'],
      completionCriteria: {
        type: 'api_call',
        condition: 'slack_connected'
      },
      resources: [{
        type: 'interactive_tutorial',
        title: 'Slack連携チュートリアル',
        url: '/onboarding/slack-integration',
        mandatory: true
      }],
      automatable: true
    });

    // Stage 5: データ移行
    this.registerTask({
      id: 'legacy-data-migration',
      stage: OnboardingStage.DATA_MIGRATION,
      name: '既存データ移行',
      description: '既存の勤怠・給与データをAI-OSに移行',
      estimatedMinutes: 60,
      isRequired: false,
      dependencies: ['bulk-user-import'],
      completionCriteria: {
        type: 'data_validation',
        condition: 'data_migration_complete'
      },
      resources: [{
        type: 'document',
        title: 'データ移行ガイド',
        url: '/docs/data-migration',
        mandatory: true
      }],
      automatable: true,
      customerType: [CustomerType.MIDMARKET, CustomerType.ENTERPRISE]
    });

    // Stage 6: 機能トレーニング
    this.registerTask({
      id: 'admin-training',
      stage: OnboardingStage.FEATURE_TRAINING,
      name: '管理者向けトレーニング',
      description: 'システム管理者向けの包括的な機能トレーニング',
      estimatedMinutes: 45,
      isRequired: true,
      dependencies: ['admin-user-setup'],
      completionCriteria: {
        type: 'user_action',
        condition: 'training_completed'
      },
      resources: [{
        type: 'webinar',
        title: '管理者向けライブトレーニング',
        url: '/onboarding/admin-training',
        duration: 45,
        mandatory: true
      }],
      automatable: false
    });

    this.registerTask({
      id: 'end-user-training',
      stage: OnboardingStage.FEATURE_TRAINING,
      name: '従業員向けトレーニング',
      description: '一般従業員向けの基本操作トレーニング',
      estimatedMinutes: 20,
      isRequired: true,
      dependencies: ['bulk-user-import'],
      completionCriteria: {
        type: 'user_action',
        condition: 'user_training_completed'
      },
      resources: [{
        type: 'video',
        title: '従業員向け操作ガイド',
        url: '/onboarding/user-training',
        duration: 15,
        mandatory: true
      }],
      automatable: false
    });

    // Stage 7: 本格運用開始
    this.registerTask({
      id: 'go-live-checklist',
      stage: OnboardingStage.GO_LIVE,
      name: '本格運用チェックリスト',
      description: '本格運用開始前の最終確認項目をクリア',
      estimatedMinutes: 30,
      isRequired: true,
      dependencies: ['admin-training', 'end-user-training'],
      completionCriteria: {
        type: 'data_validation',
        condition: 'go_live_approved'
      },
      resources: [{
        type: 'document',
        title: '本格運用チェックリスト',
        url: '/docs/go-live-checklist',
        mandatory: true
      }],
      automatable: false
    });

    // Stage 8: 成功マイルストーン
    this.registerTask({
      id: 'first-payroll',
      stage: OnboardingStage.SUCCESS_MILESTONE,
      name: '初回給与計算完了',
      description: 'AI-OSでの初回給与計算を成功完了',
      estimatedMinutes: 0,
      isRequired: false,
      dependencies: ['go-live-checklist'],
      completionCriteria: {
        type: 'api_call',
        condition: 'first_payroll_completed'
      },
      resources: [],
      automatable: true
    });
  }

  /**
   * オンボーディングタスクの登録
   */
  registerTask(task: OnboardingTask): void {
    this.onboardingTasks.set(task.id, task);
    logger.info(`Onboarding task registered: ${task.name}`);
  }

  /**
   * 新規顧客のオンボーディング開始
   */
  async startOnboarding(context: OnboardingContext): Promise<OnboardingProgress> {
    const customerId = context.customerId;
    
    // AI による個人化されたオンボーディングプランの生成
    const personalizedTasks = await this.aiPersonalizationEngine.generatePersonalizedPlan(
      context,
      Array.from(this.onboardingTasks.values())
    );

    const progress: OnboardingProgress = {
      customerId,
      currentStage: OnboardingStage.TRIAL_SIGNUP,
      completedTasks: [],
      skippedTasks: [],
      blockedTasks: [],
      overallProgress: 0,
      estimatedCompletion: this.calculateEstimatedCompletion(personalizedTasks, context.pace),
      actualTimeSpent: 0,
      lastActivity: new Date(),
      milestones: this.generateMilestones(personalizedTasks)
    };

    this.customerProgress.set(customerId, progress);

    // ウェルカムコミュニケーションの開始
    await this.communicationEngine.sendWelcomeSequence(context);

    // 自動実行可能なタスクの開始
    await this.executeAutomatableTasks(customerId, OnboardingStage.TRIAL_SIGNUP);

    this.emit('onboarding:started', { customerId, context });
    logger.info(`Onboarding started for customer: ${customerId}`);

    return progress;
  }

  /**
   * タスクの完了マーク
   */
  async completeTask(
    customerId: string, 
    taskId: string,
    completionData?: any
  ): Promise<OnboardingProgress> {
    const progress = this.customerProgress.get(customerId);
    const task = this.onboardingTasks.get(taskId);

    if (!progress || !task) {
      throw new Error('Progress or task not found');
    }

    // 完了基準の検証
    const isValid = await this.validateTaskCompletion(task, completionData);
    if (!isValid) {
      throw new Error('Task completion criteria not met');
    }

    // 進捗の更新
    progress.completedTasks.push(taskId);
    progress.actualTimeSpent += task.estimatedMinutes;
    progress.lastActivity = new Date();
    progress.overallProgress = this.calculateProgress(progress, customerId);

    // 次のステージに移行可能かチェック
    const nextStage = this.getNextStage(progress.currentStage);
    if (nextStage && this.canMoveToNextStage(progress, nextStage)) {
      progress.currentStage = nextStage;
      
      // 次のステージの自動タスクを実行
      await this.executeAutomatableTasks(customerId, nextStage);
      
      this.emit('onboarding:stage_completed', { 
        customerId, 
        stage: nextStage, 
        progress 
      });
    }

    // マイルストーンチェック
    await this.checkMilestones(progress);

    // 進捗通知
    await this.communicationEngine.sendProgressUpdate(customerId, progress);

    this.emit('onboarding:task_completed', { customerId, taskId, progress });
    
    return progress;
  }

  /**
   * オンボーディングの一時停止
   */
  async pauseOnboarding(customerId: string, reason: string): Promise<void> {
    const progress = this.customerProgress.get(customerId);
    if (!progress) return;

    // 通信エンジンに一時停止を通知
    await this.communicationEngine.handlePause(customerId, reason);
    
    this.emit('onboarding:paused', { customerId, reason });
    logger.info(`Onboarding paused for customer: ${customerId}, reason: ${reason}`);
  }

  /**
   * オンボーディングの再開
   */
  async resumeOnboarding(customerId: string): Promise<void> {
    const progress = this.customerProgress.get(customerId);
    if (!progress) return;

    progress.lastActivity = new Date();
    
    // 再開コミュニケーション
    await this.communicationEngine.sendResumeMessage(customerId, progress);
    
    // 次の自動タスクを実行
    await this.executeAutomatableTasks(customerId, progress.currentStage);
    
    this.emit('onboarding:resumed', { customerId, progress });
    logger.info(`Onboarding resumed for customer: ${customerId}`);
  }

  /**
   * オンボーディング進捗の取得
   */
  getProgress(customerId: string): OnboardingProgress | null {
    return this.customerProgress.get(customerId) || null;
  }

  /**
   * 自動実行可能なタスクの実行
   */
  private async executeAutomatableTasks(
    customerId: string, 
    stage: OnboardingStage
  ): Promise<void> {
    const tasks = Array.from(this.onboardingTasks.values())
      .filter(task => task.stage === stage && task.automatable);

    for (const task of tasks) {
      try {
        await this.executeTask(customerId, task);
      } catch (error) {
        logger.error(`Failed to execute automatic task: ${task.id}`, error);
        // 自動タスクの失敗は進行を阻害しない
      }
    }
  }

  /**
   * 個別タスクの実行
   */
  private async executeTask(customerId: string, task: OnboardingTask): Promise<void> {
    const context = this.getCustomerContext(customerId);
    if (!context) return;

    switch (task.id) {
      case 'welcome-email':
        await this.communicationEngine.sendWelcomeEmail(context);
        await this.completeTask(customerId, task.id);
        break;
      
      case 'accounting-integration':
        await this.integrationEngine.setupAccountingIntegration(customerId);
        break;
      
      case 'slack-integration':
        await this.integrationEngine.setupSlackIntegration(customerId);
        break;
      
      case 'legacy-data-migration':
        await this.integrationEngine.startDataMigration(customerId);
        break;
      
      default:
        // その他の自動タスク
        break;
    }
  }

  // ヘルパーメソッド

  private async validateTaskCompletion(
    task: OnboardingTask, 
    completionData?: any
  ): Promise<boolean> {
    if (task.completionCriteria.validationFunction) {
      return task.completionCriteria.validationFunction({} as OnboardingContext);
    }
    return true; // 簡略化
  }

  private calculateProgress(progress: OnboardingProgress, customerId: string): number {
    const allTasks = this.getApplicableTasks(customerId);
    const completed = progress.completedTasks.length;
    return Math.round((completed / allTasks.length) * 100);
  }

  private getApplicableTasks(customerId: string): OnboardingTask[] {
    // 顧客タイプと業界に基づいて適用可能なタスクを返す
    return Array.from(this.onboardingTasks.values());
  }

  private getNextStage(currentStage: OnboardingStage): OnboardingStage | null {
    const stages = Object.values(OnboardingStage);
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  }

  private canMoveToNextStage(
    progress: OnboardingProgress, 
    nextStage: OnboardingStage
  ): boolean {
    const stageTasks = Array.from(this.onboardingTasks.values())
      .filter(task => task.stage === progress.currentStage && task.isRequired);
    
    return stageTasks.every(task => 
      progress.completedTasks.includes(task.id) || 
      progress.skippedTasks.includes(task.id)
    );
  }

  private calculateEstimatedCompletion(
    tasks: OnboardingTask[], 
    pace: 'fast' | 'normal' | 'slow'
  ): Date {
    const totalMinutes = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
    const multiplier = { fast: 0.8, normal: 1.0, slow: 1.5 }[pace];
    const adjustedMinutes = totalMinutes * multiplier;
    
    return new Date(Date.now() + adjustedMinutes * 60 * 1000);
  }

  private generateMilestones(tasks: OnboardingTask[]): Milestone[] {
    return [
      {
        id: 'setup-complete',
        name: '初期設定完了',
        stage: OnboardingStage.COMPANY_SETUP,
        businessValue: '企業情報とユーザーの基本設定が完了し、システム利用の準備が整いました',
        celebration: {
          type: 'email',
          content: '設定完了おめでとうございます！',
          triggerImmediately: true
        }
      },
      {
        id: 'training-complete',
        name: 'トレーニング完了',
        stage: OnboardingStage.FEATURE_TRAINING,
        businessValue: 'チーム全体がシステムの使い方を習得し、効率的な運用が可能になりました'
      },
      {
        id: 'go-live',
        name: '本格運用開始',
        stage: OnboardingStage.GO_LIVE,
        businessValue: 'AI-OSでの本格的な人事・労務管理がスタートしました',
        celebration: {
          type: 'slack_message',
          content: '🎉 AI-OSの本格運用開始おめでとうございます！',
          triggerImmediately: true
        }
      }
    ];
  }

  private async checkMilestones(progress: OnboardingProgress): Promise<void> {
    for (const milestone of progress.milestones) {
      if (!milestone.completedAt && progress.currentStage === milestone.stage) {
        milestone.completedAt = new Date();
        
        if (milestone.celebration) {
          await this.communicationEngine.sendCelebration(
            progress.customerId, 
            milestone
          );
        }
        
        this.emit('onboarding:milestone_reached', { 
          customerId: progress.customerId, 
          milestone 
        });
      }
    }
  }

  private getCustomerContext(customerId: string): OnboardingContext | null {
    // 実際の実装では、データベースから取得
    return null;
  }
}

// パーソナライゼーションエンジン
class PersonalizationEngine {
  async generatePersonalizedPlan(
    context: OnboardingContext,
    allTasks: OnboardingTask[]
  ): Promise<OnboardingTask[]> {
    // AIベースの個人化ロジック
    return allTasks.filter(task => {
      // 顧客タイプによるフィルタリング
      if (task.customerType && !task.customerType.includes(context.customerType)) {
        return false;
      }
      
      // 業界によるフィルタリング
      if (task.industryType && !task.industryType.includes(context.industry)) {
        return false;
      }
      
      return true;
    });
  }
}

// コミュニケーションエンジン
class CommunicationEngine {
  async sendWelcomeSequence(context: OnboardingContext): Promise<void> {
    logger.info(`Sending welcome sequence to ${context.primaryContact.email}`);
    // ウェルカムメールシーケンスの実装
  }

  async sendWelcomeEmail(context: OnboardingContext): Promise<void> {
    logger.info(`Sending welcome email to ${context.primaryContact.email}`);
    // ウェルカムメール送信の実装
  }

  async sendProgressUpdate(
    customerId: string, 
    progress: OnboardingProgress
  ): Promise<void> {
    logger.info(`Sending progress update to customer ${customerId}: ${progress.overallProgress}%`);
    // 進捗更新通知の実装
  }

  async sendCelebration(customerId: string, milestone: Milestone): Promise<void> {
    logger.info(`Sending celebration for milestone: ${milestone.name}`);
    // お祝いメッセージの実装
  }

  async handlePause(customerId: string, reason: string): Promise<void> {
    logger.info(`Handling onboarding pause for ${customerId}: ${reason}`);
    // 一時停止処理の実装
  }

  async sendResumeMessage(
    customerId: string, 
    progress: OnboardingProgress
  ): Promise<void> {
    logger.info(`Sending resume message to customer ${customerId}`);
    // 再開メッセージの実装
  }
}

// 統合エンジン
class IntegrationEngine {
  async setupAccountingIntegration(customerId: string): Promise<void> {
    logger.info(`Setting up accounting integration for ${customerId}`);
    // 会計システム連携の実装
  }

  async setupSlackIntegration(customerId: string): Promise<void> {
    logger.info(`Setting up Slack integration for ${customerId}`);
    // Slack連携の実装
  }

  async startDataMigration(customerId: string): Promise<void> {
    logger.info(`Starting data migration for ${customerId}`);
    // データ移行の実装
  }
}

export { CustomerOnboardingSystem };