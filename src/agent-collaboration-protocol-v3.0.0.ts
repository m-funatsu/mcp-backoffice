/**
 * エージェント間協調プロトコル v3.0.0
 * Agent Collaboration Protocol - Advanced Multi-Agent Coordination
 * 
 * 戦略的価値:
 * - マルチエージェント協調による複雑タスク自動化
 * - 動的ワークフロー分散・負荷分散
 * - 自己修復・障害耐性の向上
 * 
 * 技術的特徴:
 * - Pub/Sub メッセージングパターン
 * - 分散トランザクション管理
 * - エージェント能力動的発見
 * - 合意形成アルゴリズム
 */

import { EventEmitter } from 'events';
import { DatabasePostgreSQL } from './database_postgresql.js';
import type { AgentGoal, AgentAction, AgentResult, AgentState } from './agent-framework-v3.0.0.js';

// ===== 協調プロトコル型定義 =====

export interface AgentMessage {
  id: string;
  senderId: string;
  receiverId: string | 'broadcast';
  messageType: 'request' | 'response' | 'notification' | 'heartbeat' | 'consensus';
  payload: unknown;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  ttl?: number; // Time To Live in milliseconds
  correlationId?: string; // リクエスト-レスポンス関連付け
}

export interface AgentCapabilityAdvertisement {
  agentId: string;
  capabilities: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    slaMetrics: {
      averageResponseTime: number;
      successRate: number;
      maxConcurrency: number;
    };
  }>;
  loadMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    queueLength: number;
    isAvailable: boolean;
  };
  lastUpdated: Date;
}

export interface CollaborationWorkflow {
  id: string;
  name: string;
  description: string;
  initiatorAgentId: string;
  participantAgents: string[];
  steps: Array<{
    stepId: string;
    agentId: string;
    action: string;
    dependencies: string[]; // 依存するステップID
    timeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffStrategy: 'fixed' | 'exponential' | 'linear';
      baseDelay: number;
    };
  }>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  executionContext: Map<string, unknown>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ConsensusProposal {
  id: string;
  proposerId: string;
  proposalType: 'workflow_optimization' | 'resource_allocation' | 'conflict_resolution';
  description: string;
  proposedChanges: Record<string, unknown>;
  votingDeadline: Date;
  requiredMajority: number; // percentage
  votes: Map<string, 'accept' | 'reject' | 'abstain'>;
  status: 'voting' | 'accepted' | 'rejected' | 'expired';
}

// ===== エージェント間協調マネージャー =====

export class AgentCollaborationManager extends EventEmitter {
  private agents: Map<string, AgentCapabilityAdvertisement> = new Map();
  private messageQueue: Map<string, AgentMessage[]> = new Map();
  private activeWorkflows: Map<string, CollaborationWorkflow> = new Map();
  private consensusProposals: Map<string, ConsensusProposal> = new Map();
  private heartbeatInterval: NodeJS.Timeout;

  constructor(private db: DatabasePostgreSQL) {
    super();
    this.startHeartbeatMonitoring();
    this.setupEventHandlers();
  }

  /**
   * エージェント登録・能力広告
   */
  async registerAgent(agentId: string, capabilities: AgentCapabilityAdvertisement): Promise<void> {
    this.agents.set(agentId, capabilities);
    this.messageQueue.set(agentId, []);
    
    // 他エージェントに新エージェント参加を通知
    await this.broadcastMessage({
      id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: 'system',
      receiverId: 'broadcast',
      messageType: 'notification',
      payload: {
        type: 'agent_joined',
        agentId,
        capabilities: capabilities.capabilities
      },
      timestamp: new Date(),
      priority: 'medium'
    });

    console.log(`✅ Agent ${agentId} registered with ${capabilities.capabilities.length} capabilities`);
  }

  /**
   * 協調ワークフロー実行
   */
  async executeCollaborativeWorkflow(
    workflowDefinition: Omit<CollaborationWorkflow, 'id' | 'status' | 'executionContext' | 'createdAt'>
  ): Promise<string> {
    const workflowId = `WF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const workflow: CollaborationWorkflow = {
      ...workflowDefinition,
      id: workflowId,
      status: 'pending',
      executionContext: new Map(),
      createdAt: new Date()
    };

    this.activeWorkflows.set(workflowId, workflow);

    // 参加エージェントに実行準備通知
    for (const agentId of workflow.participantAgents) {
      await this.sendMessage({
        id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        senderId: 'collaboration_manager',
        receiverId: agentId,
        messageType: 'notification',
        payload: {
          type: 'workflow_preparation',
          workflowId,
          assignedSteps: workflow.steps.filter(step => step.agentId === agentId)
        },
        timestamp: new Date(),
        priority: 'high',
        correlationId: workflowId
      });
    }

    // ワークフロー実行開始
    await this.startWorkflowExecution(workflowId);
    
    return workflowId;
  }

  /**
   * 動的能力発見・マッチング
   */
  async findCapableAgents(
    requiredCapability: string,
    constraints?: {
      maxResponseTime?: number;
      minSuccessRate?: number;
      excludeAgents?: string[];
    }
  ): Promise<Array<{
    agentId: string;
    capability: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      outputSchema: Record<string, unknown>;
      slaMetrics: {
        averageResponseTime: number;
        successRate: number;
        maxConcurrency: number;
      };
    };
    suitabilityScore: number;
  }>> {
    const candidates: Array<{
      agentId: string;
      capability: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        outputSchema: Record<string, unknown>;
        slaMetrics: {
          averageResponseTime: number;
          successRate: number;
          maxConcurrency: number;
        };
      };
      suitabilityScore: number;
    }> = [];

    for (const [agentId, advertisement] of this.agents.entries()) {
      // 除外エージェントをスキップ
      if (constraints?.excludeAgents?.includes(agentId)) continue;

      // 利用可能性チェック
      if (!advertisement.loadMetrics.isAvailable) continue;

      // 能力マッチング
      const matchingCapability = advertisement.capabilities.find(cap => 
        cap.name === requiredCapability || 
        cap.description.toLowerCase().includes(requiredCapability.toLowerCase())
      );

      if (!matchingCapability) continue;

      // 制約チェック
      if (constraints?.maxResponseTime && 
          matchingCapability.slaMetrics.averageResponseTime > constraints.maxResponseTime) continue;
      
      if (constraints?.minSuccessRate && 
          matchingCapability.slaMetrics.successRate < constraints.minSuccessRate) continue;

      // 適合性スコア計算
      const suitabilityScore = this.calculateSuitabilityScore(
        matchingCapability,
        advertisement.loadMetrics,
        constraints
      );

      candidates.push({
        agentId,
        capability: matchingCapability,
        suitabilityScore
      });
    }

    // スコア順にソート
    return candidates.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }

  /**
   * 分散合意形成
   */
  async initiateConsensus(
    proposerId: string,
    proposal: Omit<ConsensusProposal, 'id' | 'votes' | 'status'>
  ): Promise<string> {
    const proposalId = `PROP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const consensusProposal: ConsensusProposal = {
      ...proposal,
      id: proposalId,
      proposerId,
      votes: new Map(),
      status: 'voting'
    };

    this.consensusProposals.set(proposalId, consensusProposal);

    // 全エージェントに投票要求を送信
    await this.broadcastMessage({
      id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: proposerId,
      receiverId: 'broadcast',
      messageType: 'request',
      payload: {
        type: 'consensus_vote_request',
        proposalId,
        proposal: consensusProposal,
        votingDeadline: proposal.votingDeadline
      },
      timestamp: new Date(),
      priority: 'high',
      correlationId: proposalId
    });

    // 投票期限後の集計スケジューリング
    const timeUntilDeadline = proposal.votingDeadline.getTime() - Date.now();
    setTimeout(() => {
      this.tallyVotes(proposalId);
    }, timeUntilDeadline);

    return proposalId;
  }

  /**
   * メッセージ送信
   */
  async sendMessage(message: AgentMessage): Promise<void> {
    // TTL チェック
    if (message.ttl && Date.now() - message.timestamp.getTime() > message.ttl) {
      console.warn(`Message ${message.id} expired (TTL: ${message.ttl}ms)`);
      return;
    }

    if (message.receiverId === 'broadcast') {
      await this.broadcastMessage(message);
    } else {
      const queue = this.messageQueue.get(message.receiverId);
      if (queue) {
        // 優先度順でキューに挿入
        const insertIndex = queue.findIndex(msg => 
          this.getPriorityWeight(msg.priority) < this.getPriorityWeight(message.priority)
        );
        
        if (insertIndex === -1) {
          queue.push(message);
        } else {
          queue.splice(insertIndex, 0, message);
        }

        // エージェントに新メッセージ通知
        this.emit('message', message.receiverId, message);
      }
    }

    // メッセージログ保存
    await this.logMessage(message);
  }

  /**
   * メッセージ受信
   */
  async receiveMessage(agentId: string): Promise<AgentMessage | null> {
    const queue = this.messageQueue.get(agentId);
    if (!queue || queue.length === 0) return null;

    return queue.shift() || null;
  }

  /**
   * ワークフロー実行管理
   */
  private async startWorkflowExecution(workflowId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    workflow.status = 'running';
    workflow.startedAt = new Date();

    // 依存関係解決とステップ実行
    const executionPlan = this.resolveDependencies(workflow.steps);
    
    for (const executionLevel of executionPlan) {
      // 同レベルのステップを並列実行
      const promises = executionLevel.map(step => this.executeWorkflowStep(workflowId, step));
      
      try {
        await Promise.all(promises);
      } catch (error) {
        console.error(`Workflow ${workflowId} failed at step level:`, error);
        workflow.status = 'failed';
        return;
      }
    }

    workflow.status = 'completed';
    workflow.completedAt = new Date();
    
    console.log(`✅ Workflow ${workflowId} completed successfully`);
  }

  private async executeWorkflowStep(
    workflowId: string, 
    step: {
      stepId: string;
      agentId: string;
      action: string;
      dependencies: string[];
      timeout: number;
      retryPolicy: {
        maxRetries: number;
        backoffStrategy: 'fixed' | 'exponential' | 'linear';
        baseDelay: number;
      };
    }
  ): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    // ステップ実行要求送信
    await this.sendMessage({
      id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: 'collaboration_manager',
      receiverId: step.agentId,
      messageType: 'request',
      payload: {
        type: 'execute_workflow_step',
        workflowId,
        stepId: step.stepId,
        action: step.action,
        context: Object.fromEntries(workflow.executionContext)
      },
      timestamp: new Date(),
      priority: 'high',
      ttl: step.timeout,
      correlationId: `${workflowId}-${step.stepId}`
    });
  }

  /**
   * ユーティリティメソッド
   */
  private calculateSuitabilityScore(
    capability: {
      slaMetrics: {
        averageResponseTime: number;
        successRate: number;
        maxConcurrency: number;
      };
    },
    loadMetrics: {
      cpuUsage: number;
      memoryUsage: number;
      queueLength: number;
      isAvailable: boolean;
    },
    constraints?: {
      maxResponseTime?: number;
      minSuccessRate?: number;
      excludeAgents?: string[];
    }
  ): number {
    let score = 0.5;

    // SLA指標による評価
    score += (capability.slaMetrics.successRate / 100) * 0.3;
    score += (1 - (capability.slaMetrics.averageResponseTime / 10000)) * 0.2; // 10秒基準

    // 負荷状況による評価
    score += (1 - loadMetrics.cpuUsage) * 0.2;
    score += (1 - loadMetrics.memoryUsage) * 0.1;
    score += (loadMetrics.queueLength === 0 ? 0.2 : Math.max(0, 0.2 - loadMetrics.queueLength * 0.05));

    return Math.max(0, Math.min(1, score));
  }

  private resolveDependencies(steps: Array<{
    stepId: string;
    agentId: string;
    action: string;
    dependencies: string[];
    timeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffStrategy: 'fixed' | 'exponential' | 'linear';
      baseDelay: number;
    };
  }>): Array<Array<{
    stepId: string;
    agentId: string;
    action: string;
    dependencies: string[];
    timeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffStrategy: 'fixed' | 'exponential' | 'linear';
      baseDelay: number;
    };
  }>> {
    type StepType = typeof steps[0];
    const executionLevels: StepType[][] = [];
    const executed = new Set<string>();
    const stepMap = new Map(steps.map(step => [step.stepId, step]));

    while (executed.size < steps.length) {
      const currentLevel: StepType[] = [];
      
      for (const step of steps) {
        if (executed.has(step.stepId)) continue;
        
        // 依存関係チェック
        const dependenciesMet = step.dependencies.every((depId: string) => executed.has(depId));
        
        if (dependenciesMet) {
          currentLevel.push(step);
        }
      }

      if (currentLevel.length === 0) {
        throw new Error('Circular dependency detected or unresolvable dependencies');
      }

      executionLevels.push(currentLevel);
      currentLevel.forEach(step => executed.add(step.stepId));
    }

    return executionLevels;
  }

  private async broadcastMessage(message: AgentMessage): Promise<void> {
    for (const agentId of this.agents.keys()) {
      if (agentId !== message.senderId) {
        await this.sendMessage({
          ...message,
          receiverId: agentId
        });
      }
    }
  }

  private getPriorityWeight(priority: string): number {
    const weights = { urgent: 4, high: 3, medium: 2, low: 1 };
    return weights[priority as keyof typeof weights] || 1;
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(async () => {
      for (const [agentId, advertisement] of this.agents.entries()) {
        // ハートビート要求送信
        await this.sendMessage({
          id: `HB_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          senderId: 'collaboration_manager',
          receiverId: agentId,
          messageType: 'heartbeat',
          payload: { timestamp: new Date() },
          timestamp: new Date(),
          priority: 'low',
          ttl: 30000 // 30秒
        });
      }
    }, 60000); // 1分間隔
  }

  private setupEventHandlers(): void {
    this.on('agent_failure', (agentId: string) => {
      console.warn(`🚨 Agent ${agentId} failed - initiating failover procedures`);
      this.handleAgentFailure(agentId);
    });

    this.on('workflow_step_completed', (workflowId: string, stepId: string, result: unknown) => {
      const workflow = this.activeWorkflows.get(workflowId);
      if (workflow) {
        workflow.executionContext.set(stepId, result);
      }
    });
  }

  private async handleAgentFailure(failedAgentId: string): Promise<void> {
    // 失敗エージェントを利用不可に設定
    const advertisement = this.agents.get(failedAgentId);
    if (advertisement) {
      advertisement.loadMetrics.isAvailable = false;
    }

    // 実行中ワークフローの回復処理
    for (const [workflowId, workflow] of this.activeWorkflows.entries()) {
      if (workflow.status === 'running' && workflow.participantAgents.includes(failedAgentId)) {
        await this.recoverWorkflow(workflowId, failedAgentId);
      }
    }
  }

  private async recoverWorkflow(workflowId: string, failedAgentId: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    // 失敗したエージェントのステップを特定
    const failedSteps = workflow.steps.filter(step => step.agentId === failedAgentId);
    
    for (const step of failedSteps) {
      // 代替エージェント検索
      const alternativeAgents = await this.findCapableAgents(step.action, {
        excludeAgents: [failedAgentId]
      });

      if (alternativeAgents.length > 0) {
        step.agentId = alternativeAgents[0].agentId;
        console.log(`🔄 Reassigned step ${step.stepId} to agent ${step.agentId}`);
      } else {
        console.error(`❌ No alternative agent found for step ${step.stepId}`);
        workflow.status = 'failed';
        return;
      }
    }
  }

  private async tallyVotes(proposalId: string): Promise<void> {
    const proposal = this.consensusProposals.get(proposalId);
    if (!proposal || proposal.status !== 'voting') return;

    const totalAgents = this.agents.size;
    const totalVotes = proposal.votes.size;
    const acceptVotes = Array.from(proposal.votes.values()).filter(vote => vote === 'accept').length;
    
    const acceptanceRate = (acceptVotes / totalVotes) * 100;

    if (acceptanceRate >= proposal.requiredMajority) {
      proposal.status = 'accepted';
      console.log(`✅ Consensus proposal ${proposalId} accepted (${acceptanceRate.toFixed(1)}%)`);
      
      // 提案実行
      await this.executeConsensusDecision(proposal);
    } else {
      proposal.status = 'rejected';
      console.log(`❌ Consensus proposal ${proposalId} rejected (${acceptanceRate.toFixed(1)}%)`);
    }

    // 結果を全エージェントに通知
    await this.broadcastMessage({
      id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: 'collaboration_manager',
      receiverId: 'broadcast',
      messageType: 'notification',
      payload: {
        type: 'consensus_result',
        proposalId,
        status: proposal.status,
        acceptanceRate,
        totalVotes
      },
      timestamp: new Date(),
      priority: 'medium'
    });
  }

  private async executeConsensusDecision(proposal: ConsensusProposal): Promise<void> {
    // 合意された提案の実行（実装簡略化）
    console.log(`Executing consensus decision: ${proposal.proposalType}`);
  }

  private async logMessage(message: AgentMessage): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO agent_messages (id, sender_id, receiver_id, message_type, payload, timestamp, priority, correlation_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          message.id,
          message.senderId,
          message.receiverId,
          message.messageType,
          JSON.stringify(message.payload),
          message.timestamp,
          message.priority,
          message.correlationId
        ]
      );
    } catch (error) {
      console.error('Failed to log message:', error);
    }
  }

  /**
   * 終了処理
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // 全エージェントに終了通知
    await this.broadcastMessage({
      id: `MSG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: 'collaboration_manager',
      receiverId: 'broadcast',
      messageType: 'notification',
      payload: { type: 'system_shutdown' },
      timestamp: new Date(),
      priority: 'urgent'
    });
    
    console.log('🔌 Agent Collaboration Manager shutdown complete');
  }
}

export default AgentCollaborationManager;