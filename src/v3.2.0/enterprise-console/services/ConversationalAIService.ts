/**
 * AI-OS v3.2.0 会話型AI設定サービス
 * Conversational AI Configuration Service
 * 
 * 自然言語による設定変更の処理と意図解析
 */

import { EventEmitter } from 'events';

// ===== 型定義 =====

export interface ConversationIntent {
  type: 'enable' | 'disable' | 'update' | 'query' | 'schedule' | 'permission' | 'unknown';
  confidence: number;
  entities: IntentEntity[];
  parameters: Record<string, any>;
}

export interface IntentEntity {
  type: 'agent' | 'permission' | 'user' | 'role' | 'schedule' | 'value' | 'resource';
  value: string;
  confidence: number;
  position: [number, number];
}

export interface ConfigurationContext {
  currentConfig: any;
  userRole: string;
  permissions: string[];
  previousActions: ConfigurationAction[];
}

export interface ConfigurationAction {
  timestamp: Date;
  intent: ConversationIntent;
  changes: ConfigChange[];
  success: boolean;
}

export interface ConfigChange {
  path: string;
  oldValue: any;
  newValue: any;
  description: string;
  validation?: ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface ProcessingResult {
  success: boolean;
  message: string;
  configChanges?: ConfigChange[];
  followUpQuestions?: string[];
  suggestions?: string[];
}

// ===== 意図パターン定義 =====

const INTENT_PATTERNS = {
  enable: [
    /(?:有効|オン|起動|開始|enable|turn on|activate|start)(?:に)?(?:して|する)/i,
    /(?:使える|使用可能|利用可能)(?:に)?(?:して|する)/i
  ],
  disable: [
    /(?:無効|オフ|停止|終了|disable|turn off|deactivate|stop)(?:に)?(?:して|する)/i,
    /(?:使えない|使用不可|利用不可)(?:に)?(?:して|する)/i
  ],
  update: [
    /(?:変更|更新|設定|修正|update|change|set|modify)(?:して|する)/i,
    /(?:を|に)(.+?)(?:に)?(?:して|する|変更|設定)/i
  ],
  schedule: [
    /(?:毎日|毎週|毎月|定期的に|スケジュール).*?(?:実行|起動|開始)/i,
    /(?:\d+)(?:時|分|秒)(?:に|で).*?(?:実行|起動)/i
  ],
  permission: [
    /(?:権限|許可|アクセス|permission|access).*?(?:付与|設定|追加|削除)/i,
    /(?:できる|できない)(?:ように)?(?:して|する)/i
  ],
  query: [
    /(?:教えて|確認|表示|見せて|show|display|tell me)/i,
    /(?:どう|何|いつ|どこ|なぜ|how|what|when|where|why)/i
  ]
};

// ===== エンティティパターン定義 =====

const ENTITY_PATTERNS = {
  agent: [
    /(?:給与計算|勤怠|経費|コンプライアンス|payroll|attendance|expense|compliance)(?:エージェント|agent)?/i
  ],
  role: [
    /(?:管理者|マネージャー|一般社員|経理|人事|admin|manager|employee|accounting|hr)/i
  ],
  schedule: [
    /(?:毎日|毎週|毎月|daily|weekly|monthly)(?:\s*(\d+)(?:時|分|:|h|m))?/i,
    /(?:(\d+)(?:時|分|:|h|m))(?:に|at)?/i
  ],
  value: [
    /(?:(\d+(?:\.\d+)?)\s*(?:円|万円|%|パーセント|yen|percent))/i,
    /(?:(\d+(?:\.\d+)?))/
  ]
};

// ===== メインサービスクラス =====

export class ConversationalAIService extends EventEmitter {
  private configTemplates: Map<string, any>;
  private validationRules: Map<string, (value: any) => ValidationResult>;
  
  constructor() {
    super();
    this.configTemplates = new Map();
    this.validationRules = new Map();
    this.initializeTemplates();
    this.initializeValidationRules();
  }

  /**
   * 設定テンプレートの初期化
   */
  private initializeTemplates(): void {
    // エージェント設定テンプレート
    this.configTemplates.set('agent_enable', {
      path: 'agents.{agentName}.enabled',
      valueTemplate: true,
      description: '{agentName}エージェントを有効化'
    });

    this.configTemplates.set('agent_disable', {
      path: 'agents.{agentName}.enabled',
      valueTemplate: false,
      description: '{agentName}エージェントを無効化'
    });

    // 権限設定テンプレート
    this.configTemplates.set('permission_grant', {
      path: 'permissions.{role}.{resource}.{action}',
      valueTemplate: true,
      description: '{role}に{resource}の{action}権限を付与'
    });

    // スケジュール設定テンプレート
    this.configTemplates.set('schedule_create', {
      path: 'schedules.{taskName}',
      valueTemplate: {
        enabled: true,
        cron: '{cronExpression}',
        description: '{description}'
      },
      description: '{taskName}のスケジュールを設定'
    });

    // 閾値設定テンプレート
    this.configTemplates.set('threshold_update', {
      path: 'thresholds.{metric}',
      valueTemplate: '{value}',
      description: '{metric}の閾値を{value}に設定'
    });
  }

  /**
   * バリデーションルールの初期化
   */
  private initializeValidationRules(): void {
    // 金額のバリデーション
    this.validationRules.set('amount', (value: any) => {
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(num)) {
        return { valid: false, errors: ['有効な数値ではありません'] };
      }
      if (num < 0) {
        return { valid: false, errors: ['金額は0以上である必要があります'] };
      }
      if (num > 100000000) {
        return { valid: false, warnings: ['非常に大きな金額です。正しいですか？'] };
      }
      return { valid: true };
    });

    // パーセンテージのバリデーション
    this.validationRules.set('percentage', (value: any) => {
      const num = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(num)) {
        return { valid: false, errors: ['有効な数値ではありません'] };
      }
      if (num < 0 || num > 100) {
        return { valid: false, errors: ['パーセンテージは0から100の間である必要があります'] };
      }
      return { valid: true };
    });

    // Cron式のバリデーション
    this.validationRules.set('cron', (value: string) => {
      // 簡易的なCron式バリデーション
      const cronPattern = /^(\*|([0-9]|[1-5][0-9])) (\*|([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|[1-2][0-9]|3[0-1])) (\*|([1-9]|1[0-2])) (\*|[0-6])$/;
      if (!cronPattern.test(value)) {
        return { valid: false, errors: ['有効なCron式ではありません'] };
      }
      return { valid: true };
    });
  }

  /**
   * 自然言語メッセージの処理
   */
  async processMessage(
    message: string, 
    context: ConfigurationContext
  ): Promise<ProcessingResult> {
    try {
      // 意図解析
      const intent = this.analyzeIntent(message);
      
      if (intent.type === 'unknown') {
        return {
          success: false,
          message: 'すみません、ご要望を理解できませんでした。もう少し具体的に教えていただけますか？',
          suggestions: this.generateSuggestions(context)
        };
      }

      // エンティティ抽出
      const entities = this.extractEntities(message, intent);
      intent.entities = entities;

      // 設定変更の生成
      const configChanges = this.generateConfigChanges(intent, context);

      // バリデーション
      const validationResults = await this.validateChanges(configChanges, context);
      const hasErrors = validationResults.some(r => !r.validation?.valid);

      if (hasErrors) {
        const errors = validationResults
          .filter(r => r.validation?.errors)
          .flatMap(r => r.validation!.errors!);
        
        return {
          success: false,
          message: `設定変更にエラーがあります:\n${errors.join('\n')}`,
          configChanges: []
        };
      }

      // 確認メッセージの生成
      const confirmMessage = this.generateConfirmationMessage(configChanges);
      
      return {
        success: true,
        message: confirmMessage,
        configChanges,
        followUpQuestions: this.generateFollowUpQuestions(intent, context)
      };

    } catch (error) {
      console.error('Message processing error:', error);
      return {
        success: false,
        message: 'メッセージの処理中にエラーが発生しました。',
        suggestions: ['もう一度お試しください', 'サポートにお問い合わせください']
      };
    }
  }

  /**
   * 意図解析
   */
  private analyzeIntent(message: string): ConversationIntent {
    let bestMatch: ConversationIntent = {
      type: 'unknown',
      confidence: 0,
      entities: [],
      parameters: {}
    };

    // 各意図パターンをチェック
    for (const [intentType, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          const confidence = this.calculateConfidence(message, pattern);
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              type: intentType as any,
              confidence,
              entities: [],
              parameters: {}
            };
          }
        }
      }
    }

    return bestMatch;
  }

  /**
   * エンティティ抽出
   */
  private extractEntities(message: string, intent: ConversationIntent): IntentEntity[] {
    const entities: IntentEntity[] = [];

    // 各エンティティパターンをチェック
    for (const [entityType, patterns] of Object.entries(ENTITY_PATTERNS)) {
      for (const pattern of patterns) {
        const matches = message.matchAll(new RegExp(pattern, 'gi'));
        for (const match of matches) {
          if (match.index !== undefined) {
            entities.push({
              type: entityType as any,
              value: match[0],
              confidence: 0.8,
              position: [match.index, match.index + match[0].length]
            });
          }
        }
      }
    }

    // エージェント名の正規化
    this.normalizeAgentNames(entities);

    return entities;
  }

  /**
   * エージェント名の正規化
   */
  private normalizeAgentNames(entities: IntentEntity[]): void {
    const agentNameMap: Record<string, string> = {
      '給与計算': 'payroll',
      '給与': 'payroll',
      'payroll': 'payroll',
      '勤怠': 'attendance',
      'attendance': 'attendance',
      '経費': 'expense',
      'expense': 'expense',
      'コンプライアンス': 'compliance',
      'compliance': 'compliance'
    };

    entities
      .filter(e => e.type === 'agent')
      .forEach(entity => {
        const normalized = agentNameMap[entity.value.toLowerCase().replace(/エージェント|agent/gi, '').trim()];
        if (normalized) {
          entity.value = normalized;
        }
      });
  }

  /**
   * 設定変更の生成
   */
  private generateConfigChanges(
    intent: ConversationIntent,
    context: ConfigurationContext
  ): ConfigChange[] {
    const changes: ConfigChange[] = [];

    switch (intent.type) {
      case 'enable':
      case 'disable':
        const agentEntity = intent.entities.find(e => e.type === 'agent');
        if (agentEntity) {
          const templateKey = intent.type === 'enable' ? 'agent_enable' : 'agent_disable';
          const template = this.configTemplates.get(templateKey)!;
          
          changes.push({
            path: template.path.replace('{agentName}', agentEntity.value),
            oldValue: context.currentConfig?.agents?.[agentEntity.value]?.enabled || false,
            newValue: template.valueTemplate,
            description: template.description.replace('{agentName}', agentEntity.value)
          });
        }
        break;

      case 'schedule':
        const scheduleEntity = intent.entities.find(e => e.type === 'schedule');
        if (scheduleEntity) {
          const cronExpression = this.convertToCron(scheduleEntity.value);
          const template = this.configTemplates.get('schedule_create')!;
          
          changes.push({
            path: template.path.replace('{taskName}', 'backup'), // 例として
            oldValue: null,
            newValue: {
              ...template.valueTemplate,
              cron: cronExpression
            },
            description: 'バックアップスケジュールを設定'
          });
        }
        break;

      case 'permission':
        const roleEntity = intent.entities.find(e => e.type === 'role');
        if (roleEntity) {
          const template = this.configTemplates.get('permission_grant')!;
          
          changes.push({
            path: template.path
              .replace('{role}', roleEntity.value)
              .replace('{resource}', 'config')
              .replace('{action}', 'update'),
            oldValue: false,
            newValue: true,
            description: `${roleEntity.value}に設定更新権限を付与`
          });
        }
        break;
    }

    return changes;
  }

  /**
   * 自然言語のスケジュール表現をCron式に変換
   */
  private convertToCron(schedule: string): string {
    const scheduleMap: Record<string, string> = {
      '毎日': '0 0 * * *',
      '毎週': '0 0 * * 0',
      '毎月': '0 0 1 * *',
      'daily': '0 0 * * *',
      'weekly': '0 0 * * 0',
      'monthly': '0 0 1 * *'
    };

    // 時間指定がある場合
    const timeMatch = schedule.match(/(\d+)(?:時|:)/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      if (schedule.includes('毎日') || schedule.includes('daily')) {
        return `0 ${hour} * * *`;
      }
    }

    return scheduleMap[schedule.toLowerCase()] || '0 0 * * *';
  }

  /**
   * 変更のバリデーション
   */
  private async validateChanges(
    changes: ConfigChange[],
    context: ConfigurationContext
  ): Promise<ConfigChange[]> {
    return Promise.all(changes.map(async change => {
      // パスに基づいてバリデーションルールを適用
      let validation: ValidationResult = { valid: true };

      if (change.path.includes('thresholds') && change.path.includes('amount')) {
        validation = this.validationRules.get('amount')!(change.newValue);
      } else if (change.path.includes('thresholds') && change.path.includes('percentage')) {
        validation = this.validationRules.get('percentage')!(change.newValue);
      } else if (change.path.includes('schedules') && change.newValue?.cron) {
        validation = this.validationRules.get('cron')!(change.newValue.cron);
      }

      return { ...change, validation };
    }));
  }

  /**
   * 確認メッセージの生成
   */
  private generateConfirmationMessage(changes: ConfigChange[]): string {
    if (changes.length === 0) {
      return '変更する設定項目が見つかりませんでした。';
    }

    const changeDescriptions = changes.map(c => `• ${c.description}`).join('\n');
    
    return `以下の設定変更を行います:\n\n${changeDescriptions}\n\nよろしいですか？`;
  }

  /**
   * フォローアップ質問の生成
   */
  private generateFollowUpQuestions(
    intent: ConversationIntent,
    context: ConfigurationContext
  ): string[] {
    const questions: string[] = [];

    switch (intent.type) {
      case 'enable':
      case 'disable':
        questions.push(
          '関連する通知設定も変更しますか？',
          '変更後のログレベルを設定しますか？'
        );
        break;

      case 'schedule':
        questions.push(
          'スケジュール実行時の通知先を設定しますか？',
          'エラー時の再試行設定を行いますか？'
        );
        break;

      case 'permission':
        questions.push(
          '他の権限も一緒に設定しますか？',
          '権限の有効期限を設定しますか？'
        );
        break;
    }

    return questions;
  }

  /**
   * 提案の生成
   */
  private generateSuggestions(context: ConfigurationContext): string[] {
    const suggestions: string[] = [
      '「給与計算エージェントを有効にして」',
      '「毎日午前9時にバックアップを実行」',
      '「管理者に全ての権限を付与」',
      '「承認の金額上限を100万円に設定」'
    ];

    // コンテキストに基づいて関連性の高い提案を優先
    if (context.previousActions.length > 0) {
      const lastAction = context.previousActions[context.previousActions.length - 1];
      if (lastAction.intent.type === 'enable') {
        suggestions.unshift('関連するエージェントも有効にしますか？');
      }
    }

    return suggestions.slice(0, 3);
  }

  /**
   * 信頼度の計算
   */
  private calculateConfidence(message: string, pattern: RegExp): number {
    const match = message.match(pattern);
    if (!match) return 0;

    // マッチした文字列の長さと全体の長さの比率
    const coverage = match[0].length / message.length;
    
    // パターンの複雑さ（グループの数）
    const complexity = (pattern.source.match(/\(/g) || []).length;
    
    // 基本信頼度
    let confidence = 0.5 + coverage * 0.3;
    
    // 複雑なパターンほど高い信頼度
    confidence += Math.min(complexity * 0.05, 0.2);
    
    return Math.min(confidence, 1.0);
  }

  /**
   * 設定変更の適用
   */
  async applyConfigChange(change: {
    path: string;
    value: any;
    userId: string;
    reason: string;
  }): Promise<void> {
    // 実際の設定変更処理
    this.emit('config:change', {
      ...change,
      timestamp: new Date(),
      source: 'conversational'
    });
  }

  /**
   * 会話履歴の分析
   */
  analyzeConversationHistory(messages: any[]): {
    commonIntents: Record<string, number>;
    successRate: number;
    avgResponseTime: number;
    suggestions: string[];
  } {
    const intentCounts: Record<string, number> = {};
    let successCount = 0;
    let totalResponseTime = 0;

    messages.forEach((msg, index) => {
      if (msg.role === 'user' && index + 1 < messages.length) {
        const response = messages[index + 1];
        if (response.role === 'assistant') {
          // 意図のカウント
          const intent = this.analyzeIntent(msg.content);
          intentCounts[intent.type] = (intentCounts[intent.type] || 0) + 1;

          // 成功率の計算
          if (response.status === 'success') {
            successCount++;
          }

          // 応答時間の計算
          const responseTime = new Date(response.timestamp).getTime() - 
                              new Date(msg.timestamp).getTime();
          totalResponseTime += responseTime;
        }
      }
    });

    const userMessages = messages.filter(m => m.role === 'user');
    const successRate = userMessages.length > 0 ? successCount / userMessages.length : 0;
    const avgResponseTime = userMessages.length > 0 ? totalResponseTime / userMessages.length : 0;

    // 改善提案の生成
    const suggestions: string[] = [];
    if (successRate < 0.8) {
      suggestions.push('より具体的な指示を使用すると成功率が向上します');
    }
    if (avgResponseTime > 5000) {
      suggestions.push('複雑な変更は複数の簡単な指示に分けることをお勧めします');
    }

    return {
      commonIntents: intentCounts,
      successRate,
      avgResponseTime,
      suggestions
    };
  }
}