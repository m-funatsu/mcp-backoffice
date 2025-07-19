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

// ===== エージェント基本インターフェース =====

export interface AgentCapability {
  name: string;
  description: string;
  version: string;
  supportedActions: string[];
  requiredPermissions: string[];
}

export interface AgentContext {
  sessionId: string;
  userId: string;
  permissions: string[];
  metadata: Record<string, any>;
  startTime: Date;
}

export interface AgentGoal {
  id: string;
  type: 'process' | 'monitor' | 'analyze' | 'report';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  constraints?: string[];
  successCriteria: string[];
  metadata?: any;
}

export interface AgentAction {
  id: string;
  type: string;
  description: string;
  parameters: Record<string, any>;
  requiredCapabilities: string[];
  estimatedDuration?: number; // milliseconds
  retryable: boolean;
  compensationAction?: string; // rollback action ID
}

export interface AgentPlan {
  goalId: string;
  actions: AgentAction[];
  dependencies: Map<string, string[]>; // action ID -> dependent action IDs
  estimatedTotalDuration: number;
  parallelizable: boolean;
}

export interface AgentResult {
  actionId: string;
  status: 'success' | 'failure' | 'partial' | 'skipped';
  output?: any;
  error?: Error;
  duration: number;
  timestamp: Date;
}

export interface AgentState {
  agentId: string;
  status: 'idle' | 'planning' | 'executing' | 'paused' | 'completed' | 'failed';
  currentGoal?: AgentGoal;
  currentPlan?: AgentPlan;
  currentAction?: string;
  executionProgress: {
    completedActions: string[];
    currentAction?: string;
    pendingActions: string[];
    results: AgentResult[];
  };
  memory: Map<string, any>; // 実行コンテキストの保持
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
      this.state.status = 'failed';
      this.logger.error('Planning failed', error);
      throw error;
    }
  }

  /**
   * 計画の実行
   */
  async executePlan(): Promise<AgentResult[]> {
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
        const failures = groupResults.filter(r => r.status === 'failure');
        if (failures.length > 0) {
          await this.handleFailures(failures);
        }
      }
      
      this.state.status = 'completed';
      this.logger.info('Plan execution completed', { 
        totalActions: results.length,
        successCount: results.filter(r => r.status === 'success').length 
      });
      
      return results;
    } catch (error) {
      this.state.status = 'failed';
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
    return JSON.parse(JSON.stringify(this.state));
  }

  // ===== 抽象メソッド（サブクラスで実装） =====

  protected abstract validateGoal(goal: AgentGoal): Promise<void>;
  protected abstract createPlan(goal: AgentGoal): Promise<AgentPlan>;
  protected abstract executeAction(action: AgentAction): Promise<AgentResult>;

  // ===== ヘルパーメソッド =====

  protected async validatePermissions(permissions: string[]): Promise<void> {
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
        
        this.state.executionProgress.completedActions.push(action.id);
        this.state.executionProgress.pendingActions = 
          this.state.executionProgress.pendingActions.filter(id => id !== action.id);
        this.state.executionProgress.results.push(result);
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (!action.retryable || attempt === maxRetries) {
          return {
            actionId: action.id,
            status: 'failure',
            error: lastError,
            duration: 0,
            timestamp: new Date()
          };
        }
        
        // エクスポネンシャルバックオフ
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }
    
    return {
      actionId: action.id,
      status: 'failure',
      error: lastError,
      duration: 0,
      timestamp: new Date()
    };
  }

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

  protected canParallelize(dependencies: Map<string, string[]>): boolean {
    // 依存関係がない、または依存関係が単純な場合は並列化可能
    return Array.from(dependencies.values()).every(deps => deps.length <= 1);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ===== エージェントロガー =====

class AgentLogger {
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  info(message: string, data?: any): void {
    console.log(`[${new Date().toISOString()}] [${this.agentId}] INFO: ${message}`, data || '');
  }

  warn(message: string, data?: any): void {
    console.warn(`[${new Date().toISOString()}] [${this.agentId}] WARN: ${message}`, data || '');
  }

  error(message: string, error?: any): void {
    console.error(`[${new Date().toISOString()}] [${this.agentId}] ERROR: ${message}`, error || '');
  }
}

// ===== エージェントオーケストレーター =====

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
  async assignGoal(goal: AgentGoal, agentName: string): Promise<AgentResult[]> {
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

  private async handleAssignGoal(args: any): Promise<any> {
    const goal: AgentGoal = {
      id: `GOAL_${Date.now()}`,
      ...args.goal
    };
    
    const results = await this.orchestrator.assignGoal(goal, args.agentName);
    
    return {
      content: [
        {
          type: 'text',
          text: `Goal assigned and executed. ${results.length} actions completed.`
        }
      ]
    };
  }

  private async handleGetAgentsStatus(): Promise<any> {
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

  private async handleCoordinateAgents(args: any): Promise<any> {
    const goals = args.goals.map((g: any) => ({
      id: `GOAL_${Date.now()}_${Math.random()}`,
      ...g
    }));
    
    const assignments = new Map(Object.entries(args.assignments));
    
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