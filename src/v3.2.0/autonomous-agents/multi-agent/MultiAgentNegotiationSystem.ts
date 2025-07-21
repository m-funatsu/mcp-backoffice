/**
 * AI-OS v3.2.0 マルチエージェント交渉システム
 * エージェント間の協調・交渉による高度なワークフロー実現
 */

import {
  CoordinationRequest,
  CoordinationType,
  CoordinationStatus,
  CoordinationResponse,
  Priority,
} from '../goal-based/types';

interface Agent {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  currentLoad: number; // 0-1
  preferences: AgentPreferences;
  negotiationHistory: NegotiationRecord[];
}

interface AgentPreferences {
  maxLoad: number;
  priorityThreshold: Priority;
  cooperationStrategy: 'collaborative' | 'competitive' | 'balanced';
  trustScores: Map<string, number>; // 他エージェントへの信頼度
}

interface NegotiationRecord {
  partnerId: string;
  outcome: 'success' | 'failure' | 'compromise';
  timestamp: Date;
  trustImpact: number; // -1 to 1
}

interface NegotiationContext {
  request: CoordinationRequest;
  participants: Agent[];
  constraints: NegotiationConstraints;
  history: NegotiationStep[];
}

interface NegotiationConstraints {
  maxRounds: number;
  timeout: number; // ミリ秒
  minimumAcceptanceRate: number; // 0-1
  allowCounterProposals: boolean;
}

interface NegotiationStep {
  round: number;
  proposals: Proposal[];
  agreements: Agreement[];
  timestamp: Date;
}

interface Proposal {
  fromAgent: string;
  toAgent: string;
  type: ProposalType;
  terms: any;
  utility: number; // 提案者にとっての効用
}

type ProposalType = 
  | 'resource_allocation'
  | 'task_assignment'
  | 'schedule_adjustment'
  | 'priority_change'
  | 'compensation_offer';

interface Agreement {
  participants: string[];
  terms: any;
  commitments: Commitment[];
  expiresAt?: Date;
}

interface Commitment {
  agentId: string;
  action: string;
  deadline: Date;
  conditions: string[];
}

export class MultiAgentNegotiationSystem {
  private agents: Map<string, Agent> = new Map();
  private activeNegotiations: Map<string, NegotiationContext> = new Map();
  private negotiationProtocols: Map<CoordinationType, NegotiationProtocol> = new Map();

  constructor() {
    this.initializeProtocols();
  }

  /**
   * エージェントを登録
   */
  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    console.log(`エージェント「${agent.name}」を登録しました`);
  }

  /**
   * 交渉を開始
   */
  async initiateNegotiation(request: CoordinationRequest): Promise<CoordinationResponse> {
    console.log(`交渉開始: ${request.type} from ${request.fromAgent} to ${request.toAgent}`);

    // 参加エージェントを特定
    const participants = this.identifyParticipants(request);
    if (participants.length < 2) {
      return {
        success: false,
        message: '交渉に必要なエージェントが不足しています',
        respondedAt: new Date(),
      };
    }

    // 交渉コンテキストを作成
    const context: NegotiationContext = {
      request,
      participants,
      constraints: this.getDefaultConstraints(request.type),
      history: [],
    };

    this.activeNegotiations.set(request.id, context);

    // 適切なプロトコルを選択
    const protocol = this.negotiationProtocols.get(request.type);
    if (!protocol) {
      return {
        success: false,
        message: '適切な交渉プロトコルが見つかりません',
        respondedAt: new Date(),
      };
    }

    // 交渉を実行
    try {
      const result = await protocol.negotiate(context, this);
      return result;
    } finally {
      this.activeNegotiations.delete(request.id);
    }
  }

  /**
   * 交渉プロトコルを初期化
   */
  private initializeProtocols(): void {
    // リソース要求プロトコル
    this.negotiationProtocols.set('resource_request', new ResourceNegotiationProtocol());
    
    // タスク委譲プロトコル
    this.negotiationProtocols.set('task_delegation', new TaskDelegationProtocol());
    
    // 承認要求プロトコル
    this.negotiationProtocols.set('approval_request', new ApprovalProtocol());
    
    // 競合解決プロトコル
    this.negotiationProtocols.set('conflict_resolution', new ConflictResolutionProtocol());
  }

  /**
   * 交渉参加者を特定
   */
  private identifyParticipants(request: CoordinationRequest): Agent[] {
    const participants: Agent[] = [];
    
    // 送信元エージェント
    const fromAgent = this.agents.get(request.fromAgent);
    if (fromAgent) participants.push(fromAgent);
    
    // 宛先エージェント
    if (request.toAgent === 'all') {
      // 全エージェントが対象
      this.agents.forEach(agent => {
        if (agent.id !== request.fromAgent) {
          participants.push(agent);
        }
      });
    } else {
      const toAgent = this.agents.get(request.toAgent);
      if (toAgent) participants.push(toAgent);
    }
    
    return participants;
  }

  /**
   * デフォルトの交渉制約を取得
   */
  private getDefaultConstraints(type: CoordinationType): NegotiationConstraints {
    const constraints: Record<CoordinationType, NegotiationConstraints> = {
      resource_request: {
        maxRounds: 5,
        timeout: 30000, // 30秒
        minimumAcceptanceRate: 0.6,
        allowCounterProposals: true,
      },
      information_request: {
        maxRounds: 1,
        timeout: 10000, // 10秒
        minimumAcceptanceRate: 1.0,
        allowCounterProposals: false,
      },
      task_delegation: {
        maxRounds: 3,
        timeout: 60000, // 1分
        minimumAcceptanceRate: 0.7,
        allowCounterProposals: true,
      },
      approval_request: {
        maxRounds: 2,
        timeout: 120000, // 2分
        minimumAcceptanceRate: 0.8,
        allowCounterProposals: false,
      },
      conflict_resolution: {
        maxRounds: 10,
        timeout: 300000, // 5分
        minimumAcceptanceRate: 0.5,
        allowCounterProposals: true,
      },
      synchronization: {
        maxRounds: 1,
        timeout: 5000, // 5秒
        minimumAcceptanceRate: 1.0,
        allowCounterProposals: false,
      },
    };

    return constraints[type] || {
      maxRounds: 3,
      timeout: 60000,
      minimumAcceptanceRate: 0.7,
      allowCounterProposals: true,
    };
  }

  /**
   * エージェントの効用を計算
   */
  calculateUtility(agent: Agent, proposal: any): number {
    let utility = 0;

    // 負荷に基づく効用
    if (proposal.additionalLoad) {
      const newLoad = agent.currentLoad + proposal.additionalLoad;
      if (newLoad > agent.preferences.maxLoad) {
        utility -= (newLoad - agent.preferences.maxLoad) * 10;
      } else {
        utility += (agent.preferences.maxLoad - newLoad) * 2;
      }
    }

    // 優先度に基づく効用
    if (proposal.priority) {
      const priorityValues = { critical: 4, high: 3, medium: 2, low: 1 };
      utility += priorityValues[proposal.priority] * 3;
    }

    // 信頼度に基づく効用
    if (proposal.partnerId) {
      const trust = agent.preferences.trustScores.get(proposal.partnerId) || 0.5;
      utility += trust * 5;
    }

    return utility;
  }

  /**
   * 信頼度を更新
   */
  updateTrust(agentId: string, partnerId: string, outcome: 'success' | 'failure' | 'compromise'): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const currentTrust = agent.preferences.trustScores.get(partnerId) || 0.5;
    let trustDelta = 0;

    switch (outcome) {
      case 'success':
        trustDelta = 0.1;
        break;
      case 'compromise':
        trustDelta = 0.05;
        break;
      case 'failure':
        trustDelta = -0.15;
        break;
    }

    const newTrust = Math.max(0, Math.min(1, currentTrust + trustDelta));
    agent.preferences.trustScores.set(partnerId, newTrust);

    // 交渉履歴を記録
    agent.negotiationHistory.push({
      partnerId,
      outcome,
      timestamp: new Date(),
      trustImpact: trustDelta,
    });
  }
}

/**
 * 交渉プロトコルの基底クラス
 */
abstract class NegotiationProtocol {
  abstract negotiate(
    context: NegotiationContext,
    system: MultiAgentNegotiationSystem
  ): Promise<CoordinationResponse>;

  /**
   * 提案を生成
   */
  protected generateProposal(
    fromAgent: Agent,
    toAgent: Agent,
    request: CoordinationRequest
  ): Proposal {
    return {
      fromAgent: fromAgent.id,
      toAgent: toAgent.id,
      type: 'resource_allocation',
      terms: request.payload,
      utility: 0,
    };
  }

  /**
   * 提案を評価
   */
  protected evaluateProposal(
    agent: Agent,
    proposal: Proposal,
    system: MultiAgentNegotiationSystem
  ): number {
    return system.calculateUtility(agent, proposal.terms);
  }

  /**
   * 合意を形成
   */
  protected formAgreement(
    participants: Agent[],
    acceptedProposal: Proposal
  ): Agreement {
    const commitments: Commitment[] = participants.map(agent => ({
      agentId: agent.id,
      action: this.getCommitmentAction(agent, acceptedProposal),
      deadline: new Date(Date.now() + 3600000), // 1時間後
      conditions: [],
    }));

    return {
      participants: participants.map(a => a.id),
      terms: acceptedProposal.terms,
      commitments,
    };
  }

  /**
   * エージェントのコミットメントアクションを取得
   */
  protected getCommitmentAction(agent: Agent, proposal: Proposal): string {
    return `${proposal.type}を実行`;
  }
}

/**
 * リソース交渉プロトコル
 */
class ResourceNegotiationProtocol extends NegotiationProtocol {
  async negotiate(
    context: NegotiationContext,
    system: MultiAgentNegotiationSystem
  ): Promise<CoordinationResponse> {
    const { request, participants, constraints } = context;
    let round = 0;

    while (round < constraints.maxRounds) {
      round++;
      console.log(`交渉ラウンド ${round}/${constraints.maxRounds}`);

      const proposals: Proposal[] = [];

      // 各参加者から提案を収集
      for (const participant of participants) {
        if (participant.id === request.fromAgent) continue;

        const proposal = this.generateResourceProposal(
          this.findAgent(participants, request.fromAgent)!,
          participant,
          request
        );

        const utility = system.calculateUtility(participant, proposal.terms);
        proposal.utility = utility;

        if (utility > 0) {
          proposals.push(proposal);
        }
      }

      // 最良の提案を選択
      if (proposals.length > 0) {
        const bestProposal = proposals.sort((a, b) => b.utility - a.utility)[0];
        
        // 承諾率をチェック
        const acceptanceRate = proposals.filter(p => p.utility > 0).length / participants.length;
        if (acceptanceRate >= constraints.minimumAcceptanceRate) {
          const agreement = this.formAgreement(
            [
              this.findAgent(participants, bestProposal.fromAgent)!,
              this.findAgent(participants, bestProposal.toAgent)!,
            ],
            bestProposal
          );

          // 信頼度を更新
          system.updateTrust(bestProposal.fromAgent, bestProposal.toAgent, 'success');
          system.updateTrust(bestProposal.toAgent, bestProposal.fromAgent, 'success');

          return {
            success: true,
            message: 'リソース交渉が成功しました',
            data: agreement,
            respondedAt: new Date(),
          };
        }
      }

      // カウンター提案を許可する場合
      if (constraints.allowCounterProposals && round < constraints.maxRounds) {
        // カウンター提案のロジック
        await this.delay(1000); // シミュレーション用の遅延
      }
    }

    return {
      success: false,
      message: '交渉が合意に達しませんでした',
      respondedAt: new Date(),
    };
  }

  private generateResourceProposal(
    requester: Agent,
    provider: Agent,
    request: CoordinationRequest
  ): Proposal {
    const requestedResource = request.payload.resource;
    const requestedAmount = request.payload.amount;

    // プロバイダーの利用可能リソースを確認
    const availableCapacity = (1 - provider.currentLoad) * 100;
    const offeredAmount = Math.min(requestedAmount, availableCapacity * 0.8);

    return {
      fromAgent: requester.id,
      toAgent: provider.id,
      type: 'resource_allocation',
      terms: {
        resource: requestedResource,
        amount: offeredAmount,
        duration: request.payload.duration || 3600000,
        compensation: this.calculateCompensation(offeredAmount, provider),
      },
      utility: 0,
    };
  }

  private calculateCompensation(amount: number, provider: Agent): any {
    // 協力戦略に基づく補償計算
    const baseCompensation = amount * 10;
    const strategyMultiplier = {
      collaborative: 0.8,
      balanced: 1.0,
      competitive: 1.2,
    };

    return {
      type: 'priority_boost',
      value: baseCompensation * strategyMultiplier[provider.preferences.cooperationStrategy],
    };
  }

  private findAgent(agents: Agent[], id: string): Agent | undefined {
    return agents.find(a => a.id === id);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * タスク委譲プロトコル
 */
class TaskDelegationProtocol extends NegotiationProtocol {
  async negotiate(
    context: NegotiationContext,
    system: MultiAgentNegotiationSystem
  ): Promise<CoordinationResponse> {
    // 実装は省略（ResourceNegotiationProtocolと同様のパターン）
    return {
      success: true,
      message: 'タスク委譲が成功しました',
      respondedAt: new Date(),
    };
  }
}

/**
 * 承認プロトコル
 */
class ApprovalProtocol extends NegotiationProtocol {
  async negotiate(
    context: NegotiationContext,
    system: MultiAgentNegotiationSystem
  ): Promise<CoordinationResponse> {
    // 実装は省略（シンプルな承認ロジック）
    return {
      success: true,
      message: '承認されました',
      respondedAt: new Date(),
    };
  }
}

/**
 * 競合解決プロトコル
 */
class ConflictResolutionProtocol extends NegotiationProtocol {
  async negotiate(
    context: NegotiationContext,
    system: MultiAgentNegotiationSystem
  ): Promise<CoordinationResponse> {
    const { request, participants } = context;
    
    // 競合の性質を分析
    const conflictType = this.analyzeConflict(request.payload);
    
    // 適切な解決戦略を選択
    const strategy = this.selectResolutionStrategy(conflictType, participants);
    
    // 解決案を生成
    const resolutions = this.generateResolutions(strategy, participants, request);
    
    // 投票による解決
    const votingResult = await this.conductVoting(resolutions, participants, system);
    
    if (votingResult.accepted) {
      return {
        success: true,
        message: '競合が解決されました',
        data: votingResult.resolution,
        respondedAt: new Date(),
      };
    }

    return {
      success: false,
      message: '競合解決に失敗しました',
      alternativeProposal: this.generateCompromise(participants, request),
      respondedAt: new Date(),
    };
  }

  private analyzeConflict(payload: any): string {
    // 競合タイプの分析ロジック
    if (payload.type === 'resource_conflict') return 'resource';
    if (payload.type === 'priority_conflict') return 'priority';
    return 'general';
  }

  private selectResolutionStrategy(conflictType: string, participants: Agent[]): string {
    // 競合タイプと参加者の特性に基づいて戦略を選択
    const collaborativeCount = participants.filter(
      p => p.preferences.cooperationStrategy === 'collaborative'
    ).length;
    
    if (collaborativeCount > participants.length / 2) {
      return 'win-win';
    }
    
    return 'compromise';
  }

  private generateResolutions(
    strategy: string,
    participants: Agent[],
    request: CoordinationRequest
  ): any[] {
    // 解決案の生成ロジック
    return [];
  }

  private async conductVoting(
    resolutions: any[],
    participants: Agent[],
    system: MultiAgentNegotiationSystem
  ): Promise<{ accepted: boolean; resolution?: any }> {
    // 投票ロジック
    return { accepted: false };
  }

  private generateCompromise(participants: Agent[], request: CoordinationRequest): any {
    // 妥協案の生成
    return {
      type: 'compromise',
      terms: 'リソースを均等に分配',
    };
  }
}