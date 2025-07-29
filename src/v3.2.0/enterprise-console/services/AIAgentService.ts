/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * AIエージェントサービス - エージェント管理とモニタリング
 */

import { 
  AgentConfiguration, 
  AgentType, 
  AgentStatus, 
  AgentMetrics, 
  AgentAction,
  NotificationChannel,
  NotificationRecipient,
  ActionType,
  TimeRange,
  CustomRule,
  ApiResponse,
} from '../types';

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  configuration: AgentConfiguration;
  metrics: AgentMetrics;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentExecutionLog {
  id: string;
  agentId: string;
  action: string;
  status: 'success' | 'failure' | 'pending';
  startTime: Date;
  endTime?: Date;
  details: any;
  error?: string;
}

export interface AgentHealthCheck {
  agentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  metrics: {
    cpu: number;
    memory: number;
    responseTime: number;
    errorRate: number;
  };
  issues: string[];
}

export class AIAgentService {
  private agents: Map<string, Agent> = new Map();
  private executionLogs: AgentExecutionLog[] = [];
  private websocket: WebSocket | null = null;

  constructor() {
    this.initializeAgents();
    this.setupWebSocket();
  }

  /**
   * エージェント一覧の取得
   */
  async getAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  /**
   * 特定のエージェントを取得
   */
  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agents.get(agentId) || null;
  }

  /**
   * エージェントの設定を更新
   */
  async updateAgentConfiguration(
    agentId: string, 
    configuration: Partial<AgentConfiguration>
  ): Promise<ApiResponse<Agent>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        success: false,
        error: 'Agent not found',
      };
    }

    // 設定の検証
    if (configuration.settings) {
      const validation = this.validateAgentSettings(configuration.settings);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }
    }

    // 設定を更新
    agent.configuration = {
      ...agent.configuration,
      ...configuration,
      settings: {
        ...agent.configuration.settings,
        ...configuration.settings,
      },
    };
    agent.updatedAt = new Date();

    this.agents.set(agentId, agent);

    // 設定変更をエージェントに通知
    await this.notifyAgentConfigurationChange(agentId, agent.configuration);

    return {
      success: true,
      data: agent,
    };
  }

  /**
   * エージェントの有効/無効を切り替え
   */
  async toggleAgent(agentId: string, enabled: boolean): Promise<ApiResponse<void>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        success: false,
        error: 'Agent not found',
      };
    }

    agent.configuration.enabled = enabled;
    agent.status = enabled ? 'active' : 'inactive';
    agent.updatedAt = new Date();

    this.agents.set(agentId, agent);

    // ステータス変更をログに記録
    this.logAgentAction(agentId, enabled ? 'enable' : 'disable', {
      previousStatus: agent.status,
      newStatus: enabled ? 'active' : 'inactive',
    });

    return { success: true };
  }

  /**
   * エージェントのメトリクスを取得
   */
  async getAgentMetrics(agentId: string, timeRange?: TimeRange): Promise<AgentMetrics | null> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }

    // 実際の実装では、時間範囲に基づいてメトリクスを集計
    return agent.metrics;
  }

  /**
   * エージェントの実行ログを取得
   */
  async getAgentExecutionLogs(
    agentId?: string,
    limit: number = 100
  ): Promise<AgentExecutionLog[]> {
    let logs = this.executionLogs;
    
    if (agentId) {
      logs = logs.filter(log => log.agentId === agentId);
    }

    return logs.slice(-limit);
  }

  /**
   * エージェントのヘルスチェック
   */
  async checkAgentHealth(agentId: string): Promise<AgentHealthCheck> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // 実際の実装では、エージェントのエンドポイントにヘルスチェックリクエストを送信
    const health: AgentHealthCheck = {
      agentId,
      status: 'healthy',
      lastCheck: new Date(),
      metrics: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        responseTime: Math.random() * 500,
        errorRate: Math.random() * 5,
      },
      issues: [],
    };

    // 閾値チェック
    if (health.metrics.cpu > 80) {
      health.status = 'degraded';
      health.issues.push('High CPU usage');
    }
    if (health.metrics.memory > 85) {
      health.status = 'degraded';
      health.issues.push('High memory usage');
    }
    if (health.metrics.errorRate > 10) {
      health.status = 'unhealthy';
      health.issues.push('High error rate');
    }

    return health;
  }

  /**
   * カスタムルールの追加
   */
  async addCustomRule(agentId: string, rule: CustomRule): Promise<ApiResponse<void>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        success: false,
        error: 'Agent not found',
      };
    }

    // ルールの検証
    const validation = this.validateCustomRule(rule);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    agent.configuration.settings.customRules.push(rule);
    agent.updatedAt = new Date();

    this.agents.set(agentId, agent);

    return { success: true };
  }

  /**
   * カスタムルールの削除
   */
  async removeCustomRule(agentId: string, ruleId: string): Promise<ApiResponse<void>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        success: false,
        error: 'Agent not found',
      };
    }

    agent.configuration.settings.customRules = agent.configuration.settings.customRules.filter(
      rule => rule.id !== ruleId
    );
    agent.updatedAt = new Date();

    this.agents.set(agentId, agent);

    return { success: true };
  }

  /**
   * エージェントアクションの実行
   */
  async executeAgentAction(
    agentId: string,
    action: AgentAction
  ): Promise<ApiResponse<any>> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        success: false,
        error: 'Agent not found',
      };
    }

    if (!agent.configuration.enabled) {
      return {
        success: false,
        error: 'Agent is disabled',
      };
    }

    // 実行ログの作成
    const log: AgentExecutionLog = {
      id: `log_${Date.now()}`,
      agentId,
      action: action.type,
      status: 'pending',
      startTime: new Date(),
      details: action.parameters,
    };
    this.executionLogs.push(log);

    try {
      // 実際の実装では、エージェントのAPIを呼び出す
      const result = await this.simulateAgentExecution(agent, action);
      
      log.status = 'success';
      log.endTime = new Date();
      log.details = { ...log.details, result };

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      log.status = 'failure';
      log.endTime = new Date();
      log.error = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: log.error,
      };
    }
  }

  // ===== プライベートメソッド =====

  /**
   * エージェントの初期化
   */
  private initializeAgents(): void {
    // デフォルトエージェントの設定
    const defaultAgents: Agent[] = [
      {
        id: 'agent_payroll',
        name: '給与計算エージェント',
        type: 'payroll',
        status: 'active',
        configuration: {
          agentId: 'agent_payroll',
          agentType: 'payroll',
          enabled: true,
          settings: {
            sensitivity: {
              alertThreshold: 80,
              anomalyDetection: 'medium',
              autoActionThreshold: 90,
            },
            notifications: {
              channels: ['email', 'slack'] as NotificationChannel[],
              recipients: [],
              frequency: 'realtime',
            },
            executionLimits: {
              maxActionsPerHour: 100,
              requireApprovalFor: ['delete', 'modify_salary'] as ActionType[],
              blackoutPeriods: [],
            },
            customRules: [],
          },
        },
        metrics: {
          totalExecutions: 1250,
          successRate: 99.2,
          averageExecutionTime: 2.5,
          lastExecutionTime: new Date(),
          errorCount: 10,
          activeAlerts: 0,
        },
        lastActivity: new Date(),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
      {
        id: 'agent_compliance',
        name: 'コンプライアンス監視エージェント',
        type: 'compliance',
        status: 'active',
        configuration: {
          agentId: 'agent_compliance',
          agentType: 'compliance',
          enabled: true,
          settings: {
            sensitivity: {
              alertThreshold: 70,
              anomalyDetection: 'high',
              autoActionThreshold: 95,
            },
            notifications: {
              channels: ['email', 'system'] as NotificationChannel[],
              recipients: [],
              frequency: 'hourly',
            },
            executionLimits: {
              maxActionsPerHour: 50,
              requireApprovalFor: ['enforce_policy'] as ActionType[],
              blackoutPeriods: [],
            },
            customRules: [],
          },
        },
        metrics: {
          totalExecutions: 5420,
          successRate: 100,
          averageExecutionTime: 1.2,
          lastExecutionTime: new Date(),
          errorCount: 0,
          activeAlerts: 2,
        },
        lastActivity: new Date(),
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
      {
        id: 'agent_expense',
        name: '経費処理エージェント',
        type: 'expense',
        status: 'active',
        configuration: {
          agentId: 'agent_expense',
          agentType: 'expense',
          enabled: true,
          settings: {
            sensitivity: {
              alertThreshold: 75,
              anomalyDetection: 'medium',
              autoActionThreshold: 85,
            },
            notifications: {
              channels: ['email'] as NotificationChannel[],
              recipients: [],
              frequency: 'daily',
            },
            executionLimits: {
              maxActionsPerHour: 200,
              requireApprovalFor: ['reject_expense'] as ActionType[],
              blackoutPeriods: [],
            },
            customRules: [],
          },
        },
        metrics: {
          totalExecutions: 3200,
          successRate: 98.5,
          averageExecutionTime: 3.2,
          lastExecutionTime: new Date(),
          errorCount: 48,
          activeAlerts: 1,
        },
        lastActivity: new Date(),
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    ];

    defaultAgents.forEach(agent => {
      this.agents.set(agent.id, agent);
    });
  }

  /**
   * WebSocketのセットアップ
   */
  private setupWebSocket(): void {
    // 実際の実装では、WebSocketサーバーに接続
    // this.websocket = new WebSocket('ws://localhost:8080/agents');
  }

  /**
   * エージェント設定の検証
   */
  private validateAgentSettings(settings: any): { valid: boolean; error?: string } {
    if (settings.sensitivity) {
      if (settings.sensitivity.alertThreshold < 0 || settings.sensitivity.alertThreshold > 100) {
        return { valid: false, error: 'Alert threshold must be between 0 and 100' };
      }
      if (settings.sensitivity.autoActionThreshold < settings.sensitivity.alertThreshold) {
        return { valid: false, error: 'Auto action threshold must be higher than alert threshold' };
      }
    }

    if (settings.executionLimits) {
      if (settings.executionLimits.maxActionsPerHour < 1) {
        return { valid: false, error: 'Max actions per hour must be at least 1' };
      }
    }

    return { valid: true };
  }

  /**
   * カスタムルールの検証
   */
  private validateCustomRule(rule: CustomRule): { valid: boolean; error?: string } {
    if (!rule.name || rule.name.trim().length === 0) {
      return { valid: false, error: 'Rule name is required' };
    }

    if (!rule.condition || Object.keys(rule.condition).length === 0) {
      return { valid: false, error: 'Rule condition is required' };
    }

    if (!rule.actions || rule.actions.length === 0) {
      return { valid: false, error: 'At least one action is required' };
    }

    return { valid: true };
  }

  /**
   * エージェント設定変更の通知
   */
  private async notifyAgentConfigurationChange(
    agentId: string,
    configuration: AgentConfiguration
  ): Promise<void> {
    // 実際の実装では、エージェントのAPIを呼び出す
    console.log(`Notifying agent ${agentId} of configuration change:`, configuration);
  }

  /**
   * エージェントアクションのログ記録
   */
  private logAgentAction(agentId: string, action: string, details: any): void {
    const log: AgentExecutionLog = {
      id: `log_${Date.now()}`,
      agentId,
      action,
      status: 'success',
      startTime: new Date(),
      endTime: new Date(),
      details,
    };
    this.executionLogs.push(log);
  }

  /**
   * エージェント実行のシミュレーション
   */
  private async simulateAgentExecution(agent: Agent, action: AgentAction): Promise<any> {
    // 実行時間のシミュレーション
    await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 1000));

    // 結果のシミュレーション
    const success = Math.random() > 0.1; // 90%の成功率
    if (!success) {
      throw new Error('Simulated execution error');
    }

    return {
      executionId: `exec_${Date.now()}`,
      status: 'completed',
      result: action.parameters,
      timestamp: new Date(),
    };
  }
}

// シングルトンインスタンス
export const aiAgentService = new AIAgentService();