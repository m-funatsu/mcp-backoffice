import { DatabasePostgreSQL } from './database_postgresql.js';
import type { Employee, PayrollCalculation, ExpenseRequest } from './types.js';

/**
 * エコシステム統合エンジン v2.2.0
 * Ecosystem Integration Engine
 * 
 * 戦略的価値:
 * - 顧客の既存業務スタックへのシームレスな組み込み
 * - データサイロの解消と業務自動化
 * - リアルタイム連携による生産性向上
 * 
 * 統合対象:
 * 1. 会計システム（freee, マネーフォワード）
 * 2. コミュニケーション（Slack, Teams）
 * 3. タスク管理（Jira, Asana）
 */

// ===== 共通インターフェース =====

export interface IntegrationConfig {
  provider: 'freee' | 'moneyforward' | 'slack' | 'teams' | 'jira' | 'asana';
  credentials: {
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    webhookUrl?: string;
  };
  options: {
    autoSync: boolean;
    syncInterval?: number; // minutes
    retryAttempts: number;
    timeout: number; // milliseconds
  };
}

export interface SyncResult {
  provider: string;
  status: 'success' | 'partial' | 'failed';
  syncedAt: Date;
  itemsProcessed: number;
  itemsFailed: number;
  errors?: Array<{
    item: string;
    error: string;
    timestamp: Date;
  }>;
  nextSyncScheduled?: Date;
}

export interface WebhookEvent {
  provider: string;
  eventType: string;
  payload: any;
  receivedAt: Date;
  signature?: string;
}

// ===== 会計システム統合 =====

export interface AccountingIntegration {
  createJournalEntry(entry: JournalEntry): Promise<string>;
  syncEmployeeMaster(employees: Employee[]): Promise<SyncResult>;
  syncPayrollData(payroll: PayrollCalculation[]): Promise<SyncResult>;
  syncExpenseData(expenses: ExpenseRequest[]): Promise<SyncResult>;
  getAccountBalance(accountCode: string): Promise<number>;
  validateConnection(): Promise<boolean>;
}

export interface JournalEntry {
  date: Date;
  description: string;
  entries: Array<{
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    taxType?: string;
    department?: string;
  }>;
  reference?: string;
  tags?: string[];
}

// freee API統合
export class FreeeIntegration implements AccountingIntegration {
  private config: IntegrationConfig;
  private apiBaseUrl = 'https://api.freee.co.jp';
  private rateLimiter: RateLimiter;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter({
      maxRequests: 300,
      windowMs: 60000 // 1分間に300リクエスト
    });
  }

  async createJournalEntry(entry: JournalEntry): Promise<string> {
    await this.rateLimiter.checkLimit();
    
    const freeeEntry = this.transformToFreeeFormat(entry);
    
    try {
      const response = await this.apiRequest('/api/1/deals', 'POST', freeeEntry);
      return response.deal.id;
    } catch (error) {
      console.error('Freee journal entry creation failed:', error);
      throw new IntegrationError('FREEE_JOURNAL_FAILED', error);
    }
  }

  async syncEmployeeMaster(employees: Employee[]): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: any[] = [];
    let successCount = 0;

    for (const employee of employees) {
      try {
        await this.createOrUpdateEmployee(employee);
        successCount++;
      } catch (error) {
        errors.push({
          item: employee.id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }

    return {
      provider: 'freee',
      status: errors.length === 0 ? 'success' : errors.length < employees.length ? 'partial' : 'failed',
      syncedAt: new Date(),
      itemsProcessed: successCount,
      itemsFailed: errors.length,
      errors
    };
  }

  async syncPayrollData(payrollData: PayrollCalculation[]): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: any[] = [];
    let successCount = 0;

    // 給与データを月次でグループ化
    const monthlyPayroll = this.groupPayrollByMonth(payrollData);

    for (const [month, data] of monthlyPayroll) {
      try {
        // 給与仕訳の作成
        const journalEntry = this.createPayrollJournalEntry(month, data);
        await this.createJournalEntry(journalEntry);
        
        // 源泉徴収票データの連携
        await this.syncWithholdingData(month, data);
        
        successCount += data.length;
      } catch (error) {
        errors.push({
          item: `Payroll_${month}`,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }

    return {
      provider: 'freee',
      status: errors.length === 0 ? 'success' : 'partial',
      syncedAt: new Date(),
      itemsProcessed: successCount,
      itemsFailed: errors.length,
      errors
    };
  }

  async syncExpenseData(expenses: ExpenseRequest[]): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: any[] = [];
    let successCount = 0;

    for (const expense of expenses) {
      try {
        // 経費精算の仕訳作成
        const journalEntry = this.createExpenseJournalEntry(expense);
        await this.createJournalEntry(journalEntry);
        
        // 領収書の添付
        if (expense.receiptImageUrl) {
          await this.attachReceipt(expense.id, expense.receiptImageUrl);
        }
        
        successCount++;
      } catch (error) {
        errors.push({
          item: expense.id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }

    return {
      provider: 'freee',
      status: errors.length === 0 ? 'success' : 'partial',
      syncedAt: new Date(),
      itemsProcessed: successCount,
      itemsFailed: errors.length,
      errors
    };
  }

  async getAccountBalance(accountCode: string): Promise<number> {
    await this.rateLimiter.checkLimit();
    
    try {
      const response = await this.apiRequest(
        `/api/1/account_items/${accountCode}/balance`,
        'GET'
      );
      return response.balance;
    } catch (error) {
      console.error('Failed to get account balance:', error);
      throw error;
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      const response = await this.apiRequest('/api/1/users/me', 'GET');
      return response.user !== undefined;
    } catch (error) {
      return false;
    }
  }

  // Private methods
  private async apiRequest(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Content-Type': 'application/json',
      'X-Api-Version': '2020-06-15'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      throw new Error(`Freee API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private transformToFreeeFormat(entry: JournalEntry): any {
    return {
      issue_date: entry.date.toISOString().split('T')[0],
      type: 'expense',
      company_id: 1, // TODO: 設定から取得
      details: entry.entries.map(e => ({
        account_item_id: this.getAccountItemId(e.accountCode),
        amount: e.debit > 0 ? e.debit : -e.credit,
        tax_code: e.taxType || 'non_taxable',
        description: e.accountName,
        tag_ids: entry.tags || []
      }))
    };
  }

  private getAccountItemId(accountCode: string): number {
    // アカウントコードマッピング（実装簡略化）
    const mapping: Record<string, number> = {
      '1001': 101, // 現金
      '1002': 102, // 普通預金
      '5001': 501, // 給与
      '5002': 502, // 法定福利費
      '6001': 601  // 交通費
    };
    return mapping[accountCode] || 999;
  }

  private createOrUpdateEmployee(employee: Employee): Promise<void> {
    // 従業員マスタの作成・更新（実装簡略化）
    return Promise.resolve();
  }

  private groupPayrollByMonth(payrollData: PayrollCalculation[]): Map<string, PayrollCalculation[]> {
    const grouped = new Map<string, PayrollCalculation[]>();
    
    payrollData.forEach(payroll => {
      const month = payroll.month;
      if (!grouped.has(month)) {
        grouped.set(month, []);
      }
      grouped.get(month)!.push(payroll);
    });
    
    return grouped;
  }

  private createPayrollJournalEntry(month: string, payrollData: PayrollCalculation[]): JournalEntry {
    const totalGross = payrollData.reduce((sum, p) => sum + p.totalPay, 0);
    const totalNet = payrollData.reduce((sum, p) => sum + (p.totalPay * 0.8), 0); // 簡略化
    const totalTax = totalGross - totalNet;

    return {
      date: new Date(`${month}-25`), // 給与支払日
      description: `${month} 給与仕訳`,
      entries: [
        {
          accountCode: '5001',
          accountName: '給与',
          debit: totalGross,
          credit: 0
        },
        {
          accountCode: '2001',
          accountName: '未払給与',
          debit: 0,
          credit: totalNet
        },
        {
          accountCode: '2002',
          accountName: '預り金（源泉所得税）',
          debit: 0,
          credit: totalTax
        }
      ],
      reference: `PAYROLL_${month}`,
      tags: ['給与', '月次処理']
    };
  }

  private createExpenseJournalEntry(expense: ExpenseRequest): JournalEntry {
    return {
      date: expense.expenseDate,
      description: expense.description,
      entries: [
        {
          accountCode: this.getExpenseAccountCode(expense.categoryId),
          accountName: expense.categoryId,
          debit: expense.amount,
          credit: 0
        },
        {
          accountCode: '1001',
          accountName: '小口現金',
          debit: 0,
          credit: expense.amount
        }
      ],
      reference: expense.id,
      tags: ['経費']
    };
  }

  private getExpenseAccountCode(category: string): string {
    const mapping: Record<string, string> = {
      '交通費': '6001',
      '会議費': '6002',
      '接待交際費': '6003',
      '消耗品費': '6004'
    };
    return mapping[category] || '6999';
  }

  private async syncWithholdingData(month: string, payrollData: PayrollCalculation[]): Promise<void> {
    // 源泉徴収データの連携（実装簡略化）
    return Promise.resolve();
  }

  private async attachReceipt(expenseId: string, receiptUrl: string): Promise<void> {
    // 領収書の添付（実装簡略化）
    return Promise.resolve();
  }
}

// ===== コミュニケーション統合 =====

export interface CommunicationIntegration {
  sendNotification(notification: Notification): Promise<string>;
  createApprovalRequest(request: ApprovalRequest): Promise<string>;
  updateChannelStatus(status: ChannelStatus): Promise<void>;
  handleWebhook(event: WebhookEvent): Promise<void>;
}

export interface Notification {
  channel: string;
  message: string;
  attachments?: Array<{
    title: string;
    text: string;
    color?: string;
    fields?: Array<{
      title: string;
      value: string;
      short?: boolean;
    }>;
    actions?: Array<{
      type: string;
      text: string;
      url?: string;
      value?: string;
    }>;
  }>;
  mentions?: string[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ApprovalRequest {
  id: string;
  type: 'expense' | 'leave' | 'overtime';
  requester: string;
  approver: string;
  details: any;
  actions: Array<{
    label: string;
    value: string;
    style?: 'primary' | 'danger';
  }>;
}

export interface ChannelStatus {
  channel: string;
  status: string;
  emoji?: string;
  expiration?: Date;
}

// Slack統合
export class SlackIntegration implements CommunicationIntegration {
  private config: IntegrationConfig;
  private apiBaseUrl = 'https://slack.com/api';

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  async sendNotification(notification: Notification): Promise<string> {
    try {
      const slackMessage = this.transformToSlackFormat(notification);
      
      const response = await this.apiRequest('chat.postMessage', slackMessage);
      
      if (!response.ok) {
        throw new Error(`Slack API error: ${response.error}`);
      }
      
      return response.ts; // メッセージタイムスタンプ
    } catch (error) {
      console.error('Slack notification failed:', error);
      throw new IntegrationError('SLACK_NOTIFICATION_FAILED', error);
    }
  }

  async createApprovalRequest(request: ApprovalRequest): Promise<string> {
    const interactiveMessage = {
      channel: this.getApproverChannel(request.approver),
      text: `承認依頼: ${request.type}`,
      attachments: [{
        title: `${request.type}承認依頼`,
        text: this.formatApprovalDetails(request),
        callback_id: request.id,
        color: 'warning',
        actions: request.actions.map(action => ({
          name: 'approval_action',
          text: action.label,
          type: 'button',
          value: action.value,
          style: action.style
        }))
      }]
    };

    const response = await this.apiRequest('chat.postMessage', interactiveMessage);
    return response.ts;
  }

  async updateChannelStatus(status: ChannelStatus): Promise<void> {
    const statusUpdate = {
      profile: {
        status_text: status.status,
        status_emoji: status.emoji || ':office:',
        status_expiration: status.expiration?.getTime() || 0
      }
    };

    await this.apiRequest('users.profile.set', statusUpdate);
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    // Webhook署名の検証
    if (!this.verifyWebhookSignature(event)) {
      throw new Error('Invalid webhook signature');
    }

    // イベントタイプに応じた処理
    switch (event.eventType) {
      case 'interactive_message':
        await this.handleInteractiveMessage(event.payload);
        break;
      case 'slash_command':
        await this.handleSlashCommand(event.payload);
        break;
      default:
        console.log('Unhandled webhook event:', event.eventType);
    }
  }

  // Private methods
  private async apiRequest(method: string, data: any): Promise<any> {
    const url = `${this.apiBaseUrl}/${method}`;
    const headers = {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack API error: ${response.status} - ${errorText}`);
      }

      return response.json();
    } catch (error: any) {
      // ネットワークエラーやその他のエラーを適切に処理
      if (error.message.includes('Network error') || error.message.includes('fetch')) {
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  private transformToSlackFormat(notification: Notification): any {
    const slackMessage: any = {
      channel: notification.channel,
      text: notification.message
    };

    if (notification.attachments) {
      slackMessage.attachments = notification.attachments.map(att => ({
        ...att,
        color: this.getSlackColor(att.color),
        actions: att.actions?.map(action => ({
          type: 'button',
          text: action.text,
          url: action.url,
          value: action.value
        }))
      }));
    }

    if (notification.mentions) {
      slackMessage.text = notification.mentions
        .map(user => `<@${user}>`)
        .join(' ') + ' ' + slackMessage.text;
    }

    return slackMessage;
  }

  private getSlackColor(color?: string): string {
    const colorMap: Record<string, string> = {
      'success': 'good',
      'warning': 'warning',
      'error': 'danger',
      'info': '#439FE0'
    };
    return color ? (colorMap[color] || color) : '#439FE0';
  }

  private getApproverChannel(approver: string): string {
    // ユーザーIDからチャンネルを取得（実装簡略化）
    return `@${approver}`;
  }

  private formatApprovalDetails(request: ApprovalRequest): string {
    switch (request.type) {
      case 'expense':
        return `申請者: ${request.requester}\n金額: ¥${request.details.amount}\n内容: ${request.details.description}`;
      case 'leave':
        return `申請者: ${request.requester}\n期間: ${request.details.startDate} - ${request.details.endDate}\n種別: ${request.details.type}`;
      case 'overtime':
        return `申請者: ${request.requester}\n日付: ${request.details.date}\n時間: ${request.details.hours}時間`;
      default:
        return JSON.stringify(request.details);
    }
  }

  private verifyWebhookSignature(event: WebhookEvent): boolean {
    // Slack署名検証（実装簡略化）
    return true;
  }

  private async handleInteractiveMessage(payload: any): Promise<void> {
    // インタラクティブメッセージの処理
    console.log('Interactive message:', payload);
  }

  private async handleSlashCommand(payload: any): Promise<void> {
    // スラッシュコマンドの処理
    console.log('Slash command:', payload);
  }
}

// Microsoft Teams統合
export class TeamsIntegration implements CommunicationIntegration {
  private config: IntegrationConfig;
  private apiBaseUrl = 'https://graph.microsoft.com/v1.0';

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  async sendNotification(notification: Notification): Promise<string> {
    try {
      const teamsMessage = this.transformToTeamsFormat(notification);
      
      // チャンネルメッセージの送信
      const response = await this.apiRequest(
        `/teams/${notification.channel}/channels/messages`,
        'POST',
        teamsMessage
      );
      
      return response.id;
    } catch (error) {
      console.error('Teams notification failed:', error);
      throw new IntegrationError('TEAMS_NOTIFICATION_FAILED', error);
    }
  }

  async createApprovalRequest(request: ApprovalRequest): Promise<string> {
    // アダプティブカードフォーマットで承認依頼を作成
    const adaptiveCard = {
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.2',
        body: [
          {
            type: 'TextBlock',
            text: `${request.type}承認依頼`,
            weight: 'bolder',
            size: 'large'
          },
          {
            type: 'TextBlock',
            text: `申請者: ${request.requester}`,
            wrap: true
          },
          {
            type: 'FactSet',
            facts: this.createFactsFromDetails(request)
          }
        ],
        actions: request.actions.map(action => ({
          type: 'Action.Submit',
          title: action.label,
          data: {
            action: action.value,
            requestId: request.id
          },
          style: action.style === 'danger' ? 'destructive' : 'positive'
        }))
      }
    };

    const message = {
      subject: `承認依頼: ${request.type}`,
      body: {
        contentType: 'html',
        content: `<p>${request.requester}からの${request.type}承認依頼です。</p>`
      },
      attachments: [adaptiveCard]
    };

    const response = await this.apiRequest(
      `/users/${await this.getUserId(request.approver)}/sendMail`,
      'POST',
      { message, saveToSentItems: true }
    );

    return request.id;
  }

  async updateChannelStatus(status: ChannelStatus): Promise<void> {
    // Teams状態更新（プレゼンス）
    const presence = {
      availability: this.mapStatusToAvailability(status.status),
      activity: status.status,
      expirationDuration: status.expiration ? 
        `PT${Math.floor((status.expiration.getTime() - Date.now()) / 60000)}M` : 
        undefined
    };

    await this.apiRequest('/me/presence/setPresence', 'POST', presence);
  }

  async handleWebhook(event: WebhookEvent): Promise<void> {
    // Webhook署名の検証
    if (!this.verifyWebhookSignature(event)) {
      throw new Error('Invalid webhook signature');
    }

    // イベントタイプに応じた処理
    switch (event.payload.type) {
      case 'message':
        await this.handleMessage(event.payload);
        break;
      case 'actionableMessage':
        await this.handleActionableMessage(event.payload);
        break;
      default:
        console.log('Unhandled Teams webhook event:', event.payload.type);
    }
  }

  // Private methods
  private async apiRequest(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response || !response.ok) {
      const error = response ? await response.text() : 'No response';
      const status = response?.status || 'Unknown';
      throw new Error(`Teams API error: ${status} - ${error}`);
    }

    return response.json();
  }

  private transformToTeamsFormat(notification: Notification): any {
    const message: any = {
      body: {
        contentType: 'html',
        content: this.formatMessageContent(notification)
      }
    };

    if (notification.attachments && notification.attachments.length > 0) {
      message.attachments = notification.attachments.map(att => ({
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.2',
          body: [
            {
              type: 'TextBlock',
              text: att.title,
              weight: 'bolder',
              size: 'medium'
            },
            {
              type: 'TextBlock',
              text: att.text,
              wrap: true
            }
          ]
        }
      }));
    }

    if (notification.priority === 'urgent') {
      message.importance = 'high';
    }

    return message;
  }

  private formatMessageContent(notification: Notification): string {
    let content = `<p>${notification.message}</p>`;
    
    if (notification.mentions) {
      // メンション処理
      notification.mentions.forEach(userId => {
        content = content.replace(
          new RegExp(`@${userId}`, 'g'),
          `<at id="${userId}">@${userId}</at>`
        );
      });
    }
    
    return content;
  }

  private createFactsFromDetails(request: ApprovalRequest): any[] {
    const facts = [];
    
    switch (request.type) {
      case 'expense':
        facts.push(
          { title: '金額', value: `¥${request.details.amount}` },
          { title: '内容', value: request.details.description }
        );
        break;
      case 'leave':
        facts.push(
          { title: '期間', value: `${request.details.startDate} - ${request.details.endDate}` },
          { title: '種別', value: request.details.type }
        );
        break;
      case 'overtime':
        facts.push(
          { title: '日付', value: request.details.date },
          { title: '時間', value: `${request.details.hours}時間` }
        );
        break;
    }
    
    return facts;
  }

  private async getUserId(email: string): Promise<string> {
    try {
      const response = await this.apiRequest(
        `/users/${email}`,
        'GET'
      );
      return response.id;
    } catch (error) {
      console.error('Failed to find user:', email);
      throw error;
    }
  }

  private mapStatusToAvailability(status: string): string {
    const mapping: Record<string, string> = {
      'available': 'Available',
      'busy': 'Busy',
      'dnd': 'DoNotDisturb',
      'away': 'Away',
      'offline': 'Offline'
    };
    return mapping[status] || 'Available';
  }

  private verifyWebhookSignature(event: WebhookEvent): boolean {
    // Teams Webhook署名検証（実装簡略化）
    return true;
  }

  private async handleMessage(payload: any): Promise<void> {
    console.log('Teams message received:', payload);
  }

  private async handleActionableMessage(payload: any): Promise<void> {
    console.log('Teams actionable message:', payload);
    
    // 承認・却下アクションの処理
    if (payload.data?.action && payload.data?.requestId) {
      // アクション結果をデータベースに保存
      console.log(`Processing action: ${payload.data.action} for request: ${payload.data.requestId}`);
    }
  }
}

// ===== タスク管理統合 =====

export interface TaskManagementIntegration {
  createTask(task: Task): Promise<string>;
  updateTask(taskId: string, updates: Partial<Task>): Promise<void>;
  linkToHREvent(taskId: string, event: HREvent): Promise<void>;
  syncProjects(projects: Project[]): Promise<SyncResult>;
}

export interface Task {
  title: string;
  description: string;
  assignee: string;
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  labels: string[];
  customFields?: Record<string, any>;
}

export interface HREvent {
  type: 'onboarding' | 'offboarding' | 'review' | 'training';
  employeeId: string;
  date: Date;
  details: any;
}

export interface Project {
  id: string;
  name: string;
  members: string[];
  startDate: Date;
  endDate?: Date;
}

// Jira統合
export class JiraIntegration implements TaskManagementIntegration {
  private config: IntegrationConfig;
  private apiBaseUrl = 'https://api.atlassian.com/ex/jira';
  private cloudId: string;

  constructor(config: IntegrationConfig, cloudId: string) {
    this.config = config;
    this.cloudId = cloudId;
  }

  async createTask(task: Task): Promise<string> {
    const jiraIssue = {
      fields: {
        project: { key: (this.config.options as any).projectKey || 'HR' },
        summary: task.title,
        description: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: task.description
            }]
          }]
        },
        issuetype: { name: 'Task' },
        priority: { name: this.mapPriority(task.priority) },
        assignee: { accountId: await this.getUserAccountId(task.assignee) },
        duedate: task.dueDate?.toISOString().split('T')[0],
        labels: task.labels
      }
    };

    try {
      const response = await this.apiRequest('/rest/api/3/issue', 'POST', jiraIssue);
      return response.key;
    } catch (error) {
      console.error('Jira task creation failed:', error);
      throw new IntegrationError('JIRA_CREATE_FAILED', error);
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const jiraUpdates: any = { fields: {} };

    if (updates.title) jiraUpdates.fields.summary = updates.title;
    if (updates.description) {
      jiraUpdates.fields.description = {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: updates.description
          }]
        }]
      };
    }
    if (updates.priority) {
      jiraUpdates.fields.priority = { name: this.mapPriority(updates.priority) };
    }
    if (updates.dueDate) {
      jiraUpdates.fields.duedate = updates.dueDate.toISOString().split('T')[0];
    }

    try {
      await this.apiRequest(`/rest/api/3/issue/${taskId}`, 'PUT', jiraUpdates);
    } catch (error) {
      console.error('Jira task update failed:', error);
      throw new IntegrationError('JIRA_UPDATE_FAILED', error);
    }
  }

  async linkToHREvent(taskId: string, event: HREvent): Promise<void> {
    const comment = {
      body: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: `HRイベント連携: ${event.type} - 従業員ID: ${event.employeeId}`,
            marks: [{ type: 'strong' }]
          }]
        }, {
          type: 'paragraph',
          content: [{
            type: 'text',
            text: `日付: ${event.date.toLocaleDateString('ja-JP')}\n詳細: ${JSON.stringify(event.details, null, 2)}`
          }]
        }]
      }
    };

    await this.apiRequest(`/rest/api/3/issue/${taskId}/comment`, 'POST', comment);

    // カスタムフィールドにHRイベント情報を保存
    const customField = {
      fields: {
        [(this.config.options as any).hrEventFieldId || 'customfield_10001']: {
          type: event.type,
          employeeId: event.employeeId,
          date: event.date.toISOString()
        }
      }
    };

    await this.apiRequest(`/rest/api/3/issue/${taskId}`, 'PUT', customField);
  }

  async syncProjects(projects: Project[]): Promise<SyncResult> {
    const errors: any[] = [];
    let successCount = 0;

    for (const project of projects) {
      try {
        // プロジェクトが存在するかチェック
        const existingProject = await this.findProject(project.name);
        
        if (existingProject) {
          // プロジェクトメンバーの更新
          await this.updateProjectMembers(existingProject.key, project.members);
        } else {
          // 新規プロジェクトの作成
          await this.createProject(project);
        }
        
        successCount++;
      } catch (error) {
        errors.push({
          item: project.id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }

    return {
      provider: 'jira',
      status: errors.length === 0 ? 'success' : 'partial',
      syncedAt: new Date(),
      itemsProcessed: successCount,
      itemsFailed: errors.length,
      errors
    };
  }

  // Private methods
  private async apiRequest(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.apiBaseUrl}/${this.cloudId}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  private mapPriority(priority: string): string {
    const mapping: Record<string, string> = {
      'urgent': 'Highest',
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low'
    };
    return mapping[priority] || 'Medium';
  }

  private async getUserAccountId(email: string): Promise<string> {
    try {
      const response = await this.apiRequest(
        `/rest/api/3/user/search?query=${email}`,
        'GET'
      );
      return response[0]?.accountId || '';
    } catch (error) {
      console.error('Failed to find user:', email);
      return '';
    }
  }

  private async findProject(name: string): Promise<any> {
    const response = await this.apiRequest(
      `/rest/api/3/project/search?query=${encodeURIComponent(name)}`,
      'GET'
    );
    return response.values?.find((p: any) => p.name === name);
  }

  private async createProject(project: Project): Promise<void> {
    const jiraProject = {
      key: project.id.substring(0, 10).toUpperCase(),
      name: project.name,
      projectTypeKey: 'business',
      leadAccountId: await this.getUserAccountId(project.members[0]),
      description: `開始日: ${project.startDate.toLocaleDateString('ja-JP')}`
    };

    await this.apiRequest('/rest/api/3/project', 'POST', jiraProject);
  }

  private async updateProjectMembers(projectKey: string, members: string[]): Promise<void> {
    // プロジェクトロールへのメンバー追加（実装簡略化）
    for (const member of members) {
      const accountId = await this.getUserAccountId(member);
      if (accountId) {
        await this.apiRequest(
          `/rest/api/3/project/${projectKey}/role/10002`,
          'POST',
          { user: [accountId] }
        );
      }
    }
  }
}

// Asana統合
export class AsanaIntegration implements TaskManagementIntegration {
  private config: IntegrationConfig;
  private apiBaseUrl = 'https://app.asana.com/api/1.0';
  private workspaceGid: string;

  constructor(config: IntegrationConfig, workspaceGid: string) {
    this.config = config;
    this.workspaceGid = workspaceGid;
  }

  async createTask(task: Task): Promise<string> {
    const asanaTask = {
      data: {
        name: task.title,
        notes: task.description,
        assignee: await this.getUserGid(task.assignee),
        due_on: task.dueDate?.toISOString().split('T')[0],
        projects: [(this.config.options as any).projectGid],
        tags: await this.getTagGids(task.labels),
        custom_fields: this.mapCustomFields(task.customFields)
      }
    };

    try {
      const response = await this.apiRequest('/tasks', 'POST', asanaTask);
      return response.data.gid;
    } catch (error) {
      console.error('Asana task creation failed:', error);
      throw new IntegrationError('ASANA_CREATE_FAILED', error);
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const asanaUpdates: any = { data: {} };

    if (updates.title) asanaUpdates.data.name = updates.title;
    if (updates.description) asanaUpdates.data.notes = updates.description;
    if (updates.assignee) {
      asanaUpdates.data.assignee = await this.getUserGid(updates.assignee);
    }
    if (updates.dueDate) {
      asanaUpdates.data.due_on = updates.dueDate.toISOString().split('T')[0];
    }

    try {
      await this.apiRequest(`/tasks/${taskId}`, 'PUT', asanaUpdates);
    } catch (error) {
      console.error('Asana task update failed:', error);
      throw new IntegrationError('ASANA_UPDATE_FAILED', error);
    }
  }

  async linkToHREvent(taskId: string, event: HREvent): Promise<void> {
    // ストーリーとしてコメントを追加
    const story = {
      data: {
        text: `🔗 HRイベント連携\n\n` +
              `種別: ${this.getEventTypeName(event.type)}\n` +
              `従業員ID: ${event.employeeId}\n` +
              `日付: ${event.date.toLocaleDateString('ja-JP')}\n\n` +
              `詳細:\n${JSON.stringify(event.details, null, 2)}`
      }
    };

    await this.apiRequest(`/tasks/${taskId}/stories`, 'POST', story);

    // カスタムフィールドの更新
    if ((this.config.options as any).hrEventFieldGid) {
      const customFieldUpdate = {
        data: {
          custom_fields: {
            [(this.config.options as any).hrEventFieldGid]: JSON.stringify({
              type: event.type,
              employeeId: event.employeeId,
              date: event.date.toISOString()
            })
          }
        }
      };

      await this.apiRequest(`/tasks/${taskId}`, 'PUT', customFieldUpdate);
    }
  }

  async syncProjects(projects: Project[]): Promise<SyncResult> {
    const errors: any[] = [];
    let successCount = 0;

    for (const project of projects) {
      try {
        // プロジェクトの検索
        const existingProject = await this.findProject(project.name);
        
        if (existingProject) {
          // プロジェクトの更新
          await this.updateProject(existingProject.gid, project);
        } else {
          // 新規プロジェクトの作成
          await this.createProject(project);
        }
        
        successCount++;
      } catch (error) {
        errors.push({
          item: project.id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }

    return {
      provider: 'asana',
      status: errors.length === 0 ? 'success' : 'partial',
      syncedAt: new Date(),
      itemsProcessed: successCount,
      itemsFailed: errors.length,
      errors
    };
  }

  // Private methods
  private async apiRequest(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.config.credentials.accessToken}`,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Asana API error: ${response.status} - ${(error as any).errors?.[0]?.message || 'Unknown error'}`);
    }

    return response.json();
  }

  private async getUserGid(email: string): Promise<string> {
    try {
      const response = await this.apiRequest(
        `/workspaces/${this.workspaceGid}/users`,
        'GET'
      );
      const user = response.data.find((u: any) => u.email === email);
      return user?.gid || '';
    } catch (error) {
      console.error('Failed to find user:', email);
      return '';
    }
  }

  private async getTagGids(labels: string[]): Promise<string[]> {
    const gids: string[] = [];
    
    for (const label of labels) {
      try {
        const response = await this.apiRequest(
          `/workspaces/${this.workspaceGid}/tags`,
          'GET'
        );
        const tag = response.data.find((t: any) => t.name === label);
        
        if (tag) {
          gids.push(tag.gid);
        } else {
          // タグが存在しない場合は作成
          const newTag = await this.apiRequest('/tags', 'POST', {
            data: {
              name: label,
              workspace: this.workspaceGid,
              color: 'light-blue'
            }
          });
          gids.push(newTag.data.gid);
        }
      } catch (error) {
        console.error('Failed to get/create tag:', label);
      }
    }
    
    return gids;
  }

  private mapCustomFields(fields?: Record<string, any>): Record<string, any> {
    if (!fields) return {};
    
    const mapped: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      // カスタムフィールドのGIDマッピング（実装簡略化）
      const fieldGid = (this.config.options as any).customFieldMapping?.[key];
      if (fieldGid) {
        mapped[fieldGid] = value;
      }
    }
    
    return mapped;
  }

  private getEventTypeName(type: string): string {
    const names: Record<string, string> = {
      'onboarding': 'オンボーディング',
      'offboarding': 'オフボーディング',
      'review': '評価面談',
      'training': '研修'
    };
    return names[type] || type;
  }

  private async findProject(name: string): Promise<any> {
    const response = await this.apiRequest(
      `/workspaces/${this.workspaceGid}/projects`,
      'GET'
    );
    return response.data.find((p: any) => p.name === name);
  }

  private async createProject(project: Project): Promise<void> {
    const asanaProject = {
      data: {
        name: project.name,
        workspace: this.workspaceGid,
        notes: `開始日: ${project.startDate.toLocaleDateString('ja-JP')}\n` +
               `終了日: ${project.endDate?.toLocaleDateString('ja-JP') || '未定'}`,
        team: (this.config.options as any).teamGid
      }
    };

    const response = await this.apiRequest('/projects', 'POST', asanaProject);
    
    // メンバーの追加
    for (const member of project.members) {
      const userGid = await this.getUserGid(member);
      if (userGid) {
        await this.apiRequest(
          `/projects/${response.data.gid}/addMembers`,
          'POST',
          { data: { members: [userGid] } }
        );
      }
    }
  }

  private async updateProject(projectGid: string, project: Project): Promise<void> {
    const updates = {
      data: {
        notes: `開始日: ${project.startDate.toLocaleDateString('ja-JP')}\n` +
               `終了日: ${project.endDate?.toLocaleDateString('ja-JP') || '未定'}`
      }
    };

    await this.apiRequest(`/projects/${projectGid}`, 'PUT', updates);
  }
}

// ===== 共通ユーティリティ =====

class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(config: { maxRequests: number; windowMs: number }) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
  }

  async checkLimit(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkLimit();
    }
    
    this.requests.push(now);
  }
}

class IntegrationError extends Error {
  code: string;
  originalError: any;

  constructor(code: string, originalError: any) {
    super(`Integration error: ${code}`);
    this.code = code;
    this.originalError = originalError;
  }
}

// ===== 統合マネージャー =====

export class EcosystemIntegrationManager {
  private db: DatabasePostgreSQL;
  private integrations: Map<string, any>;
  private webhookHandlers: Map<string, (event: WebhookEvent) => Promise<void>>;

  constructor(database: DatabasePostgreSQL) {
    this.db = database;
    this.integrations = new Map();
    this.webhookHandlers = new Map();
  }

  registerIntegration(name: string, integration: any): void {
    this.integrations.set(name, integration);
    
    // Webhook対応の統合の場合、ハンドラーを登録
    if (typeof integration.handleWebhook === 'function') {
      this.webhookHandlers.set(name, integration.handleWebhook.bind(integration));
    }
  }

  async syncAll(): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();
    
    for (const [name, integration] of this.integrations) {
      try {
        if (typeof integration.sync === 'function') {
          const result = await integration.sync();
          results.set(name, result);
        }
      } catch (error) {
        results.set(name, {
          provider: name,
          status: 'failed',
          syncedAt: new Date(),
          itemsProcessed: 0,
          itemsFailed: 0,
          errors: [{
            item: 'sync',
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          }]
        });
      }
    }
    
    return results;
  }

  async handleWebhook(provider: string, event: WebhookEvent): Promise<void> {
    const handler = this.webhookHandlers.get(provider);
    if (!handler) {
      throw new Error(`No webhook handler registered for provider: ${provider}`);
    }
    
    await handler(event);
  }

  getIntegration<T>(name: string): T {
    const integration = this.integrations.get(name);
    if (!integration) {
      throw new Error(`Integration not found: ${name}`);
    }
    return integration as T;
  }
}