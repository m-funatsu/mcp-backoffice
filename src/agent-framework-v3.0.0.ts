/**
 * AI エージェントフレームワーク v3.0.0
 * AI Agent Framework - MCP-Based Autonomous System
 * 
 * 戦略的価値:
 * - 自動化から自律化へのパラダイムシフト
 * - ワークフロー全体の自律的実行
 * - 人間の介入最小化と効率最大化
 * 
 * 技術的特徴:
 * - Model Context Protocol (MCP) 準拠
 * - JSON-RPC ベース通信
 * - プラグ可能なエージェントアーキテクチャ
 * - 非同期・並列処理対応
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DatabasePostgreSQL } from './database_postgresql.js';
import type { Employee, TimeRecord, PayrollCalculation, ComplianceAlert } from './types.js';
import type { Result } from './types/core/result.js';
import type { DateTime } from './types/core/datetime.js';
import { success, failure, isSuccess } from './types/core/result.js';
import { createDateTime, formatDateTime } from './types/core/datetime.js';

// ===== エージェント基本インターフェース =====

/**
 * エージェントの機能定義
 * @description エージェントが持つ能力と必要な権限
 */
export interface AgentCapability {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly supportedActions: ReadonlyArray<string>;
  readonly requiredPermissions: ReadonlyArray<string>;
}

/**
 * エージェント実行コンテキスト
 * @description エージェントの実行環境情報
 */
export interface AgentContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly permissions: ReadonlyArray<string>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly startTime: DateTime;
}

/** ゴールタイプ */
export type GoalType = 'process' | 'monitor' | 'analyze' | 'report';

/** 優先度 */
export type Priority = 'low' | 'medium' | 'high' | 'critical';

/**
 * エージェントゴール
 * @description エージェントが達成すべき目標
 */
export interface AgentGoal {
  readonly id: string;
  readonly type: GoalType;
  readonly description: string;
  readonly priority: Priority;
  readonly deadline?: DateTime;
  readonly constraints?: ReadonlyArray<string>;
  readonly successCriteria: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AgentAction {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly requiredCapabilities: ReadonlyArray<string>;
  readonly estimatedDuration?: number; // milliseconds
  readonly retryable: boolean;
  readonly compensationAction?: string; // rollback action ID
}

export interface AgentPlan {
  readonly goalId: string;
  readonly actions: ReadonlyArray<AgentAction>;
  readonly dependencies: ReadonlyMap<string, ReadonlyArray<string>>; // action ID -> dependent action IDs
  readonly estimatedTotalDuration: number;
  readonly parallelizable: boolean;
}

/** 実行結果ステータス */
export type ResultStatus = 'success' | 'failure' | 'partial' | 'skipped';

/**
 * エージェント実行結果
 * @description アクション実行の結果情報
 */
export interface AgentResult {
  readonly actionId: string;
  readonly status: ResultStatus;
  readonly output?: unknown;
  readonly error?: Error;
  readonly duration: number;
  readonly timestamp: DateTime;
}

/** エージェントステータス */
export type AgentStatus = 'idle' | 'planning' | 'executing' | 'paused' | 'completed' | 'failed';

/**
 * エージェント状態
 * @description エージェントの現在の実行状態
 */
export interface AgentState {
  readonly agentId: string;
  status: AgentStatus;
  currentGoal?: AgentGoal;
  currentPlan?: AgentPlan;
  currentAction?: string;
  executionProgress: {
    completedActions: ReadonlyArray<string>;
    currentAction?: string;
    pendingActions: ReadonlyArray<string>;
    results: ReadonlyArray<AgentResult>;
  };
  memory: Map<string, unknown>; // 実行コンテキストの保持
}

// ===== 基本エージェントクラス =====

export abstract class BaseAgent {
  public readonly id: string;
  public readonly name: string;
  protected capabilities: AgentCapability;
  protected state: AgentState;
  protected db: DatabasePostgreSQL;
  protected logger: AgentLogger;

  constructor(
    name: string,
    capabilities: AgentCapability,
    db: DatabasePostgreSQL
  ) {
    this.id = `AGENT_${name.toUpperCase()}_${Date.now()}`;
    this.name = name;
    this.capabilities = capabilities;
    this.db = db;
    this.logger = new AgentLogger(this.id);
    
    this.state = {
      agentId: this.id,
      status: 'idle',
      executionProgress: {
        completedActions: [],
        pendingActions: [],
        results: []
      },
      memory: new Map()
    };
  }

  /**
   * エージェントの初期化
   */
  async initialize(context: AgentContext): Promise<void> {
    this.logger.info('Initializing agent', { context });
    await this.validatePermissions(context.permissions);
    this.state.memory.set('context', context);
  }

  /**
   * ゴールの受信と計画立案
   */
  async receiveGoal(goal: AgentGoal): Promise<AgentPlan> {
    this.logger.info('Goal received', { goal });
    
    this.state.currentGoal = goal;
    this.state.status = 'planning';
    
    try {
      // ゴールの妥当性検証
      await this.validateGoal(goal);
      
      // 実行計画の生成
      const plan = await this.createPlan(goal);
      
      // 計画の最適化
      const optimizedPlan = await this.optimizePlan(plan);
      
      this.state.currentPlan = optimizedPlan;
      this.state.executionProgress.pendingActions = optimizedPlan.actions.map(a => a.id);
      
      this.logger.info('Plan created', { 
        goalId: goal.id, 
        actionCount: optimizedPlan.actions.length,
        estimatedDuration: optimizedPlan.estimatedTotalDuration 
      });
      
      return optimizedPlan;
    } catch (error) {
      this.state.status = 'failed' as AgentStatus;
      this.logger.error('Planning failed', error);
      throw error;
    }
  }

  /**
   * 計画の実行
   */
  async executePlan(): Promise<ReadonlyArray<AgentResult>> {
    if (!this.state.currentPlan) {
      throw new Error('No plan to execute');
    }
    
    this.state.status = 'executing';
    const results: AgentResult[] = [];
    
    try {
      // 並列実行可能なアクションをグループ化
      const executionGroups = this.groupActionsForExecution(
        this.state.currentPlan.actions,
        this.state.currentPlan.dependencies
      );
      
      // グループごとに実行
      for (const group of executionGroups) {
        const groupResults = await this.executeActionGroup(group);
        results.push(...groupResults);
        
        // 失敗したアクションがある場合の処理
        if (groupResults && groupResults.length > 0) {
          const failures = groupResults.filter(r => r && r.status === 'failure');
          if (failures.length > 0) {
            await this.handleFailures(failures);
          }
        }
      }
      
      this.state.status = 'completed';
      this.logger.info('Plan execution completed', { 
        totalActions: results.length,
        successCount: results.filter(r => r && r.status === 'success').length 
      });
      
      return results;
    } catch (error) {
      this.state.status = 'failed' as AgentStatus;
      this.logger.error('Execution failed', error);
      throw error;
    }
  }

  /**
   * エージェントの一時停止
   */
  async pause(): Promise<void> {
    if (this.state.status === 'executing') {
      this.state.status = 'paused';
      this.logger.info('Agent paused');
    }
  }

  /**
   * エージェントの再開
   */
  async resume(): Promise<void> {
    if (this.state.status === 'paused') {
      this.state.status = 'executing';
      this.logger.info('Agent resumed');
      await this.executePlan();
    }
  }

  /**
   * 状態のスナップショット取得
   */
  getStateSnapshot(): AgentState {
    return {
      ...this.state,
      memory: new Map(this.state.memory)
    };
  }

  // ===== 抽象メソッド（サブクラスで実装） =====

  protected abstract validateGoal(goal: AgentGoal): Promise<void>;
  protected abstract createPlan(goal: AgentGoal): Promise<AgentPlan>;
  protected abstract executeAction(action: AgentAction): Promise<AgentResult>;

  // ===== ヘルパーメソッド =====

  protected async validatePermissions(permissions: ReadonlyArray<string>): Promise<void> {
    const required = this.capabilities.requiredPermissions;
    const missing = required.filter(p => !permissions.includes(p));
    
    if (missing.length > 0) {
      throw new Error(`Missing required permissions: ${missing.join(', ')}`);
    }
  }

  protected async optimizePlan(plan: AgentPlan): Promise<AgentPlan> {
    // 依存関係を考慮した実行順序の最適化
    const optimizedActions = this.topologicalSort(plan.actions, plan.dependencies);
    
    return {
      ...plan,
      actions: optimizedActions,
      parallelizable: this.canParallelize(plan.dependencies)
    };
  }

  protected groupActionsForExecution(
    actions: AgentAction[],
    dependencies: Map<string, string[]>
  ): AgentAction[][] {
    const groups: AgentAction[][] = [];
    const executed = new Set<string>();
    
    while (executed.size < actions.length) {
      const group = actions.filter(action => {
        if (executed.has(action.id)) return false;
        
        const deps = dependencies.get(action.id) || [];
        return deps.every(dep => executed.has(dep));
      });
      
      if (group.length === 0) {
        throw new Error('Circular dependency detected in action plan');
      }
      
      groups.push(group);
      group.forEach(action => executed.add(action.id));
    }
    
    return groups;
  }

  protected async executeActionGroup(actions: AgentAction[]): Promise<AgentResult[]> {
    // 並列実行
    const promises = actions.map(action => this.executeActionWithRetry(action));
    return Promise.all(promises);
  }

  protected async executeActionWithRetry(
    action: AgentAction,
    maxRetries: number = 3
  ): Promise<AgentResult> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.state.currentAction = action.id;
        const startTime = Date.now();
        
        const result = await this.executeAction(action);
        
        this.state.executionProgress = {
          ...this.state.executionProgress,
          completedActions: [...this.state.executionProgress.completedActions, action.id],
          pendingActions: this.state.executionProgress.pendingActions.filter(id => id !== action.id),
          results: [...this.state.executionProgress.results, result]
        };
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (!action.retryable || attempt === maxRetries) {
          return {
            actionId: action.id,
            status: 'failure' as ResultStatus,
            error: lastError,
            duration: 0,
            timestamp: createDateTime(new Date())
          };
        }
        
        // エクスポネンシャルバックオフ
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }
    
    return {
      actionId: action.id,
      status: 'failure' as ResultStatus,
      error: lastError,
      duration: 0,
      timestamp: createDateTime(new Date())
    };
  }

  /**
   * 失敗のハンドリング
   * @param failures - 失敗した結果の配列
   */
  protected async handleFailures(failures: AgentResult[]): Promise<void> {
    for (const failure of failures) {
      const action = this.state.currentPlan?.actions.find(a => a.id === failure.actionId);
      
      if (action?.compensationAction) {
        // 補償アクションの実行
        const compensationAction = this.state.currentPlan?.actions.find(
          a => a.id === action.compensationAction
        );
        
        if (compensationAction) {
          await this.executeAction(compensationAction);
        }
      }
    }
  }

  /**
   * トポロジカルソート
   * @param actions - アクションの配列
   * @param dependencies - 依存関係マップ
   * @returns ソートされたアクション
   */
  protected topologicalSort(
    actions: AgentAction[],
    dependencies: Map<string, string[]>
  ): AgentAction[] {
    const sorted: AgentAction[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (actionId: string) => {
      if (visited.has(actionId)) return;
      if (visiting.has(actionId)) {
        throw new Error(`Circular dependency detected at action: ${actionId}`);
      }
      
      visiting.add(actionId);
      
      const deps = dependencies.get(actionId) || [];
      deps.forEach(dep => visit(dep));
      
      visiting.delete(actionId);
      visited.add(actionId);
      
      const action = actions.find(a => a.id === actionId);
      if (action) sorted.push(action);
    };
    
    actions.forEach(action => visit(action.id));
    
    return sorted.reverse();
  }

  /**
   * 並列化可能か判定
   * @param dependencies - 依存関係マップ
   * @returns 並列化可能かどうか
   */
  protected canParallelize(dependencies: Map<string, string[]>): boolean {
    // 依存関係がない、または依存関係が単純な場合は並列化可能
    return Array.from(dependencies.values()).every(deps => deps.length <= 1);
  }

  /**
   * スリープユーティリティ
   * @param ms - ミリ秒
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== エージェントロガー =====

/**
 * エージェント専用ロガー
 * @description エージェントの動作ログを記録
 */
class AgentLogger {
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  /**
   * 情報ログ
   * @param message - メッセージ
   * @param data - 追加データ
   */
  info(message: string, data?: unknown): void {
    console.log(`[${new Date().toISOString()}] [${this.agentId}] INFO: ${message}`, data || '');
  }

  /**
   * 警告ログ
   * @param message - メッセージ
   * @param data - 追加データ
   */
  warn(message: string, data?: unknown): void {
    console.warn(`[${new Date().toISOString()}] [${this.agentId}] WARN: ${message}`, data || '');
  }

  /**
   * エラーログ
   * @param message - メッセージ
   * @param error - エラー情報
   */
  error(message: string, error?: unknown): void {
    console.error(`[${new Date().toISOString()}] [${this.agentId}] ERROR: ${message}`, error || '');
  }
}

// ===== エージェントオーケストレーター =====

/**
 * エージェントオーケストレーター
 * @description 複数エージェントの管理と協調
 */
export class AgentOrchestrator {
  private agents: Map<string, BaseAgent>;
  private activeGoals: Map<string, AgentGoal>;
  private db: DatabasePostgreSQL;

  constructor(db: DatabasePostgreSQL) {
    this.db = db;
    this.agents = new Map();
    this.activeGoals = new Map();
  }

  /**
   * エージェントの登録
   */
  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * ゴールの割り当てと実行
   */
  async assignGoal(goal: AgentGoal, agentName: string): Promise<ReadonlyArray<AgentResult>> {
    const agent = Array.from(this.agents.values()).find(a => a.name === agentName);
    
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }
    
    // ゴールの割り当て
    this.activeGoals.set(goal.id, goal);
    
    // 計画立案
    const plan = await agent.receiveGoal(goal);
    
    // 実行
    const results = await agent.executePlan();
    
    // 完了処理
    this.activeGoals.delete(goal.id);
    
    return results;
  }

  /**
   * 複数エージェントの協調実行
   */
  async coordinateAgents(
    goals: AgentGoal[],
    agentAssignments: Map<string, string>
  ): Promise<Map<string, AgentResult[]>> {
    const results = new Map<string, AgentResult[]>();
    
    // 並列実行可能なゴールをグループ化
    const executionPromises = goals.map(async goal => {
      const agentName = agentAssignments.get(goal.id);
      if (!agentName) {
        throw new Error(`No agent assigned for goal: ${goal.id}`);
      }
      
      const agentResults = await this.assignGoal(goal, agentName);
      results.set(goal.id, agentResults);
    });
    
    await Promise.all(executionPromises);
    
    return results;
  }

  /**
   * 全エージェントの状態取得
   */
  getAgentsStatus(): Map<string, AgentState> {
    const status = new Map<string, AgentState>();
    
    this.agents.forEach((agent, id) => {
      status.set(id, agent.getStateSnapshot());
    });
    
    return status;
  }
}

// ===== MCP サーバー実装 =====

export class AgentMCPServer {
  private server: Server;
  private orchestrator: AgentOrchestrator;
  private db: DatabasePostgreSQL;

  constructor(db: DatabasePostgreSQL) {
    this.db = db;
    this.orchestrator = new AgentOrchestrator(db);
    this.server = new Server(
      {
        name: 'ai-agent-server',
        version: '3.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // ツール一覧の提供
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'assign_goal',
          description: 'エージェントにゴールを割り当てて実行',
          inputSchema: {
            type: 'object',
            properties: {
              goal: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  description: { type: 'string' },
                  priority: { type: 'string' },
                  successCriteria: { type: 'array', items: { type: 'string' } }
                },
                required: ['type', 'description', 'priority', 'successCriteria']
              },
              agentName: { type: 'string' }
            },
            required: ['goal', 'agentName']
          }
        },
        {
          name: 'get_agents_status',
          description: '全エージェントの状態を取得',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'coordinate_agents',
          description: '複数エージェントの協調実行',
          inputSchema: {
            type: 'object',
            properties: {
              goals: { type: 'array' },
              assignments: { type: 'object' }
            },
            required: ['goals', 'assignments']
          }
        }
      ],
    }));

    // ツール実行ハンドラー
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'assign_goal':
          return this.handleAssignGoal(request.params.arguments);
        
        case 'get_agents_status':
          return this.handleGetAgentsStatus();
        
        case 'coordinate_agents':
          return this.handleCoordinateAgents(request.params.arguments);
        
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  private async handleAssignGoal(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    const typedArgs = args as { goal: Omit<AgentGoal, 'id'>; agentName: string };
    const goal: AgentGoal = {
      id: `GOAL_${Date.now()}`,
      ...typedArgs.goal
    };
    
    const results = await this.orchestrator.assignGoal(goal, typedArgs.agentName);
    
    return {
      content: [
        {
          type: 'text',
          text: `Goal assigned and executed. ${results.length} actions completed.`
        }
      ]
    };
  }

  private async handleGetAgentsStatus(): Promise<{ content: Array<{ type: string; text: string }> }> {
    const status = this.orchestrator.getAgentsStatus();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(Array.from(status.entries()), null, 2)
        }
      ]
    };
  }

  private async handleCoordinateAgents(args: unknown): Promise<{ content: Array<{ type: string; text: string }> }> {
    const typedArgs = args as { goals: Array<Omit<AgentGoal, 'id'>>; assignments: Record<string, string> };
    const goals = typedArgs.goals.map((g) => ({
      id: `GOAL_${Date.now()}_${Math.random()}`,
      ...g
    }));
    
    const assignments = new Map(Object.entries(typedArgs.assignments));
    
    const results = await this.orchestrator.coordinateAgents(goals, assignments);
    
    return {
      content: [
        {
          type: 'text',
          text: `Coordinated execution completed. ${results.size} goals processed.`
        }
      ]
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Agent MCP Server started');
  }
}