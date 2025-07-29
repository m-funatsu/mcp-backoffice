/**
 * リファクタリング済みエージェントフレームワーク
 * AI-OS v3.0 - 型安全性強化版
 */

import type { Result } from '@core/result';
import type { ValidationError } from '@core/validation';
import type { DateTime } from '@core/date-time';
import type { DomainEvent } from '@domain/index';

/**
 * エージェント能力定義
 */
export interface AgentCapability {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly supportedActions: ReadonlyArray<string>;
  readonly requiredPermissions: ReadonlyArray<string>;
  readonly constraints?: ReadonlyArray<string>;
}

/**
 * エージェント実行コンテキスト
 */
export interface AgentContext {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly permissions: ReadonlyArray<string>;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly startTime: DateTime;
  readonly correlationId: string;
  readonly traceId: string;
}

/**
 * エージェントゴール（目標）
 */
export interface AgentGoal {
  readonly id: string;
  readonly type: GoalType;
  readonly description: string;
  readonly priority: GoalPriority;
  readonly deadline?: DateTime;
  readonly constraints: ReadonlyArray<string>;
  readonly successCriteria: ReadonlyArray<SuccessCriterion>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly parentGoalId?: string;
}

export type GoalType = 
  | 'process'    // プロセス実行
  | 'monitor'    // 監視
  | 'analyze'    // 分析
  | 'report'     // レポート生成
  | 'optimize'   // 最適化
  | 'collaborate'; // 協調作業

export type GoalPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * 成功基準
 */
export interface SuccessCriterion {
  readonly id: string;
  readonly description: string;
  readonly evaluator: (result: unknown) => boolean;
  readonly weight: number; // 0-1の重み
}

/**
 * エージェントアクション
 */
export interface AgentAction {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly requiredCapabilities: ReadonlyArray<string>;
  readonly estimatedDuration?: number; // ミリ秒
  readonly timeout?: number; // ミリ秒
  readonly retryPolicy?: RetryPolicy;
  readonly compensationAction?: string; // ロールバックアクションID
  readonly preconditions?: ReadonlyArray<Precondition>;
  readonly postconditions?: ReadonlyArray<Postcondition>;
}

/**
 * リトライポリシー
 */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffStrategy: 'fixed' | 'exponential' | 'linear';
  readonly initialDelay: number;
  readonly maxDelay?: number;
  readonly retryableErrors?: ReadonlyArray<string>;
}

/**
 * 事前条件
 */
export interface Precondition {
  readonly description: string;
  readonly validator: (context: AgentContext) => Promise<boolean>;
}

/**
 * 事後条件
 */
export interface Postcondition {
  readonly description: string;
  readonly validator: (result: unknown) => boolean;
}

/**
 * エージェント実行計画
 */
export interface AgentPlan {
  readonly goalId: string;
  readonly actions: ReadonlyArray<AgentAction>;
  readonly dependencies: ReadonlyMap<string, ReadonlyArray<string>>; // actionId -> 依存actionIds
  readonly estimatedTotalDuration: number;
  readonly parallelizable: boolean;
  readonly criticalPath: ReadonlyArray<string>; // クリティカルパス上のアクションID
  readonly resourceRequirements?: ResourceRequirements;
}

/**
 * リソース要件
 */
export interface ResourceRequirements {
  readonly cpu?: number; // コア数
  readonly memory?: number; // MB
  readonly storage?: number; // MB
  readonly network?: 'low' | 'medium' | 'high';
  readonly exclusive?: ReadonlyArray<string>; // 排他的に必要なリソース
}

/**
 * エージェント実行結果
 */
export interface AgentResult<T = unknown> {
  readonly actionId: string;
  readonly status: ResultStatus;
  readonly output?: T;
  readonly error?: AgentError;
  readonly duration: number;
  readonly timestamp: DateTime;
  readonly metrics?: ExecutionMetrics;
  readonly logs?: ReadonlyArray<LogEntry>;
}

export type ResultStatus = 
  | 'success'
  | 'failure'
  | 'partial'
  | 'skipped'
  | 'timeout'
  | 'cancelled';

/**
 * エージェントエラー
 */
export interface AgentError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly cause?: Error;
  readonly retryable: boolean;
  readonly recovery?: string; // 回復方法の説明
}

/**
 * 実行メトリクス
 */
export interface ExecutionMetrics {
  readonly startTime: DateTime;
  readonly endTime: DateTime;
  readonly cpuUsage?: number;
  readonly memoryUsage?: number;
  readonly networkIO?: {
    readonly bytesIn: number;
    readonly bytesOut: number;
  };
  readonly customMetrics?: Record<string, number>;
}

/**
 * ログエントリ
 */
export interface LogEntry {
  readonly timestamp: DateTime;
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

/**
 * エージェント状態
 */
export interface AgentState {
  readonly agentId: string;
  readonly status: AgentStatus;
  readonly currentGoal?: AgentGoal;
  readonly currentPlan?: AgentPlan;
  readonly currentAction?: string;
  readonly executionProgress: ExecutionProgress;
  readonly memory: ReadonlyMap<string, unknown>; // 実行コンテキストの保持
  readonly lastHeartbeat: DateTime;
  readonly healthStatus: HealthStatus;
}

export type AgentStatus = 
  | 'idle'       // アイドル
  | 'planning'   // 計画中
  | 'executing'  // 実行中
  | 'paused'     // 一時停止
  | 'completed'  // 完了
  | 'failed'     // 失敗
  | 'terminated'; // 終了

/**
 * 実行進捗
 */
export interface ExecutionProgress {
  readonly totalActions: number;
  readonly completedActions: ReadonlyArray<string>;
  readonly currentAction?: string;
  readonly pendingActions: ReadonlyArray<string>;
  readonly results: ReadonlyArray<AgentResult>;
  readonly progressPercentage: number;
  readonly estimatedTimeRemaining?: number; // ミリ秒
}

/**
 * ヘルスステータス
 */
export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly lastCheck: DateTime;
  readonly issues?: ReadonlyArray<HealthIssue>;
}

export interface HealthIssue {
  readonly type: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly description: string;
  readonly since: DateTime;
}

/**
 * エージェント間メッセージ
 */
export interface AgentMessage<T = unknown> {
  readonly id: string;
  readonly from: string; // エージェントID
  readonly to: string | string[]; // 宛先エージェントID
  readonly type: MessageType;
  readonly payload: T;
  readonly timestamp: DateTime;
  readonly correlationId?: string;
  readonly replyTo?: string; // 返信先メッセージID
  readonly ttl?: number; // Time to Live（ミリ秒）
}

export type MessageType = 
  | 'request'
  | 'response'
  | 'event'
  | 'command'
  | 'query'
  | 'notification';

/**
 * エージェント協調プロトコル
 */
export interface CollaborationProtocol {
  readonly name: string;
  readonly version: string;
  readonly participants: ReadonlyArray<ParticipantRole>;
  readonly workflow: ReadonlyArray<CollaborationStep>;
  readonly timeout?: number;
  readonly conflictResolution?: ConflictResolutionStrategy;
}

export interface ParticipantRole {
  readonly roleId: string;
  readonly capabilities: ReadonlyArray<string>;
  readonly responsibilities: ReadonlyArray<string>;
  readonly cardinality: { min: number; max?: number };
}

export interface CollaborationStep {
  readonly id: string;
  readonly participants: ReadonlyArray<string>; // roleIds
  readonly action: string;
  readonly inputSchema?: unknown; // JSON Schema
  readonly outputSchema?: unknown; // JSON Schema
  readonly timeout?: number;
}

export type ConflictResolutionStrategy = 
  | 'consensus'    // 合意形成
  | 'voting'       // 投票
  | 'priority'     // 優先度ベース
  | 'coordinator'; // コーディネーター決定

/**
 * 基本エージェント抽象クラス
 */
export abstract class BaseAgent {
  protected readonly logger: Logger;
  
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly capabilities: AgentCapability,
    protected readonly eventBus: EventBus,
    logger?: Logger
  ) {
    this.logger = logger || new ConsoleLogger();
  }

  /**
   * ゴール検証
   */
  abstract validateGoal(goal: AgentGoal): Result<AgentGoal, ValidationError>;

  /**
   * 実行計画作成
   */
  abstract createPlan(goal: AgentGoal, context: AgentContext): Promise<Result<AgentPlan, AgentError>>;

  /**
   * アクション実行
   */
  abstract executeAction(action: AgentAction, context: AgentContext): Promise<Result<unknown, AgentError>>;

  /**
   * ゴール実行（テンプレートメソッド）
   */
  async executeGoal(goal: AgentGoal, context: AgentContext): Promise<Result<unknown, AgentError>> {
    // 1. ゴール検証
    const validationResult = this.validateGoal(goal);
    if (validationResult.isFailure) {
      return Result.failure({
        code: 'INVALID_GOAL',
        message: validationResult.error.message,
        retryable: false,
      });
    }

    // 2. 計画作成
    const planResult = await this.createPlan(goal, context);
    if (planResult.isFailure) {
      return planResult;
    }

    // 3. 計画実行
    const plan = planResult.value;
    const executionResult = await this.executePlan(plan, context);

    // 4. 結果評価
    return this.evaluateResults(goal, executionResult);
  }

  /**
   * 計画実行
   */
  protected async executePlan(
    plan: AgentPlan,
    context: AgentContext
  ): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>();
    const pendingActions = new Set(plan.actions.map(a => a.id));
    const executingActions = new Set<string>();

    while (pendingActions.size > 0) {
      // 実行可能なアクションを取得
      const executableActions = this.getExecutableActions(
        plan,
        pendingActions,
        executingActions,
        results
      );

      if (executableActions.length === 0 && executingActions.size === 0) {
        // デッドロック状態
        break;
      }

      // 並列実行
      const promises = executableActions.map(async (action) => {
        pendingActions.delete(action.id);
        executingActions.add(action.id);

        try {
          const startTime = DateTime.now();
          const result = await this.executeAction(action, context);
          const duration = DateTime.diffInMilliseconds(DateTime.now(), startTime);

          const agentResult: AgentResult = {
            actionId: action.id,
            status: result.isSuccess ? 'success' : 'failure',
            output: result.isSuccess ? result.value : undefined,
            error: result.isFailure ? result.error : undefined,
            duration,
            timestamp: DateTime.now(),
          };

          results.set(action.id, agentResult);
          executingActions.delete(action.id);

          // イベント発行
          await this.eventBus.publish({
            eventId: `evt_${Date.now()}`,
            eventType: 'agent.action.completed',
            aggregateId: this.id,
            aggregateType: 'agent',
            timestamp: new Date(),
            userId: context.userId,
            data: { action, result: agentResult },
          });

          return agentResult;
        } catch (error) {
          const agentResult: AgentResult = {
            actionId: action.id,
            status: 'failure',
            error: {
              code: 'EXECUTION_ERROR',
              message: error instanceof Error ? error.message : '不明なエラー',
              retryable: false,
            },
            duration: 0,
            timestamp: DateTime.now(),
          };

          results.set(action.id, agentResult);
          executingActions.delete(action.id);
          
          return agentResult;
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  /**
   * 実行可能なアクション取得
   */
  protected getExecutableActions(
    plan: AgentPlan,
    pendingActions: Set<string>,
    executingActions: Set<string>,
    results: Map<string, AgentResult>
  ): AgentAction[] {
    return plan.actions.filter((action) => {
      if (!pendingActions.has(action.id)) {
        return false;
      }

      const dependencies = plan.dependencies.get(action.id) || [];
      return dependencies.every((depId) => {
        const result = results.get(depId);
        return result && result.status === 'success';
      });
    });
  }

  /**
   * 結果評価
   */
  protected evaluateResults(
    goal: AgentGoal,
    results: Map<string, AgentResult>
  ): Result<unknown, AgentError> {
    const allResults = Array.from(results.values());
    const failures = allResults.filter(r => r.status === 'failure');

    if (failures.length > 0) {
      return Result.failure({
        code: 'GOAL_EXECUTION_FAILED',
        message: `${failures.length}個のアクションが失敗しました`,
        details: { failures },
        retryable: failures.some(f => f.error?.retryable ?? false),
      });
    }

    // 成功基準の評価
    const outputs = allResults.map(r => r.output);
    const criteriaResults = goal.successCriteria.map(criterion => ({
      criterion,
      success: criterion.evaluator(outputs),
    }));

    const totalWeight = criteriaResults.reduce((sum, r) => sum + r.criterion.weight, 0);
    const achievedWeight = criteriaResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.criterion.weight, 0);

    const successRate = totalWeight > 0 ? achievedWeight / totalWeight : 0;

    if (successRate >= 0.8) { // 80%以上で成功
      return Result.success({ results: allResults, successRate });
    } else {
      return Result.failure({
        code: 'SUCCESS_CRITERIA_NOT_MET',
        message: `成功基準の達成率が不十分です（${Math.round(successRate * 100)}%）`,
        details: { criteriaResults, successRate },
        retryable: true,
      });
    }
  }

  /**
   * ヘルスチェック
   */
  async checkHealth(): Promise<HealthStatus> {
    // 基本的なヘルスチェック実装
    return {
      status: 'healthy',
      lastCheck: DateTime.now(),
    };
  }

  /**
   * メッセージ処理
   */
  async handleMessage(message: AgentMessage): Promise<void> {
    this.logger.info(`Agent ${this.id} received message`, { message });
    // サブクラスでオーバーライド
  }
}

// サポートインターフェース
interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void;
}

// 基本実装
class ConsoleLogger implements Logger {
  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[DEBUG] ${message}`, context);
  }
  
  info(message: string, context?: Record<string, unknown>): void {
    console.info(`[INFO] ${message}`, context);
  }
  
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, context);
  }
  
  error(message: string, context?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, context);
  }
}