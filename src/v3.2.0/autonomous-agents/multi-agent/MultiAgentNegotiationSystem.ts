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
    const { request, participants, constraints } = context;
    const task = request.payload.task;
    
    // タスクを実行可能なエージェントを特定
    const capableAgents = participants.filter(agent => 
      agent.id !== request.fromAgent &&
      this.canExecuteTask(agent, task)
    );

    if (capableAgents.length === 0) {
      return {
        success: false,
        message: 'タスクを実行可能なエージェントが見つかりません',
        respondedAt: new Date(),
      };
    }

    // 各エージェントの適性スコアを計算
    const suitabilityScores = capableAgents.map(agent => ({
      agent,
      score: this.calculateSuitability(agent, task, system),
    })).sort((a, b) => b.score - a.score);

    // 最適なエージェントに委譲を提案
    for (const candidate of suitabilityScores) {
      const proposal = this.createDelegationProposal(
        this.findAgent(participants, request.fromAgent)!,
        candidate.agent,
        task
      );

      // エージェントの受諾判断
      const acceptanceScore = system.calculateUtility(candidate.agent, proposal.terms);
      if (acceptanceScore > 0) {
        // 委譲の合意を形成
        const agreement = this.formDelegationAgreement(
          this.findAgent(participants, request.fromAgent)!,
          candidate.agent,
          task,
          proposal
        );

        // 信頼度を更新
        system.updateTrust(request.fromAgent, candidate.agent.id, 'success');
        system.updateTrust(candidate.agent.id, request.fromAgent, 'success');

        return {
          success: true,
          message: `タスクが${candidate.agent.name}に委譲されました`,
          data: agreement,
          respondedAt: new Date(),
        };
      }
    }

    // 条件付き委譲の交渉
    if (constraints.allowCounterProposals) {
      const negotiatedAgreement = await this.negotiateConditions(
        suitabilityScores[0].agent,
        task,
        system,
        context
      );
      
      if (negotiatedAgreement) {
        return {
          success: true,
          message: '条件付きでタスク委譲が成立しました',
          data: negotiatedAgreement,
          respondedAt: new Date(),
        };
      }
    }

    return {
      success: false,
      message: 'タスク委譲の交渉が不成立に終わりました',
      respondedAt: new Date(),
    };
  }

  private canExecuteTask(agent: Agent, task: any): boolean {
    // エージェントの能力とタスク要件をマッチング
    const requiredCapabilities = task.requiredCapabilities || [];
    return requiredCapabilities.every((cap: string) => 
      agent.capabilities.includes(cap)
    );
  }

  private calculateSuitability(agent: Agent, task: any, system: MultiAgentNegotiationSystem): number {
    let score = 0;
    
    // 能力の一致度
    const capabilityMatch = task.requiredCapabilities.filter((cap: string) =>
      agent.capabilities.includes(cap)
    ).length / task.requiredCapabilities.length;
    score += capabilityMatch * 40;
    
    // 現在の負荷
    score += (1 - agent.currentLoad) * 30;
    
    // 優先度の適合性
    const priorityScore = this.getPriorityScore(task.priority, agent.preferences.priorityThreshold);
    score += priorityScore * 20;
    
    // 過去の実績
    const successRate = this.calculateHistoricalSuccessRate(agent);
    score += successRate * 10;
    
    return score;
  }

  private getPriorityScore(taskPriority: Priority, agentThreshold: Priority): number {
    const priorityValues: Record<Priority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    
    const taskValue = priorityValues[taskPriority];
    const thresholdValue = priorityValues[agentThreshold];
    
    if (taskValue >= thresholdValue) return 1;
    return 0.5;
  }

  private calculateHistoricalSuccessRate(agent: Agent): number {
    if (agent.negotiationHistory.length === 0) return 0.5;
    
    const successCount = agent.negotiationHistory.filter(
      record => record.outcome === 'success'
    ).length;
    
    return successCount / agent.negotiationHistory.length;
  }

  private createDelegationProposal(
    delegator: Agent,
    delegatee: Agent,
    task: any
  ): Proposal {
    const estimatedLoad = this.estimateTaskLoad(task);
    
    return {
      fromAgent: delegator.id,
      toAgent: delegatee.id,
      type: 'task_assignment',
      terms: {
        task,
        estimatedLoad,
        deadline: task.deadline || new Date(Date.now() + 86400000), // 24時間後
        compensation: this.calculateTaskCompensation(task, estimatedLoad),
        supportProvided: task.supportLevel || 'standard',
      },
      utility: 0,
    };
  }

  private estimateTaskLoad(task: any): number {
    // タスクの複雑さと所要時間から負荷を推定
    const complexity = task.complexity || 'medium';
    const complexityFactors: Record<string, number> = {
      simple: 0.1,
      medium: 0.3,
      complex: 0.5,
      critical: 0.7,
    };
    
    return complexityFactors[complexity] || 0.3;
  }

  private calculateTaskCompensation(task: any, load: number): any {
    return {
      type: 'credit',
      amount: load * 100 * (task.priority === 'critical' ? 2 : 1),
      description: 'タスク実行に対するクレジット',
    };
  }

  private formDelegationAgreement(
    delegator: Agent,
    delegatee: Agent,
    task: any,
    proposal: Proposal
  ): Agreement {
    return {
      participants: [delegator.id, delegatee.id],
      terms: {
        ...proposal.terms,
        agreedAt: new Date(),
      },
      commitments: [
        {
          agentId: delegatee.id,
          action: `タスク「${task.name}」を実行`,
          deadline: proposal.terms.deadline,
          conditions: ['必要なリソースの提供', 'サポートの利用可能性'],
        },
        {
          agentId: delegator.id,
          action: 'タスク実行のサポートを提供',
          deadline: proposal.terms.deadline,
          conditions: ['進捗の定期報告'],
        },
      ],
    };
  }

  private async negotiateConditions(
    agent: Agent,
    task: any,
    system: MultiAgentNegotiationSystem,
    context: NegotiationContext
  ): Promise<Agreement | null> {
    // 条件交渉のロジック（簡略版）
    const modifiedTerms = {
      ...task,
      deadline: new Date(task.deadline.getTime() + 86400000), // 期限を1日延長
      supportLevel: 'enhanced',
    };

    const modifiedProposal = this.createDelegationProposal(
      this.findAgent(context.participants, context.request.fromAgent)!,
      agent,
      modifiedTerms
    );

    const utility = system.calculateUtility(agent, modifiedProposal.terms);
    if (utility > 0) {
      return this.formDelegationAgreement(
        this.findAgent(context.participants, context.request.fromAgent)!,
        agent,
        modifiedTerms,
        modifiedProposal
      );
    }

    return null;
  }

  private findAgent(agents: Agent[], id: string): Agent | undefined {
    return agents.find(a => a.id === id);
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
    const { request, participants } = context;
    const approvalRequest = request.payload;
    
    // 承認者を特定
    const approvers = participants.filter(agent => 
      agent.id !== request.fromAgent &&
      this.hasApprovalAuthority(agent, approvalRequest)
    );

    if (approvers.length === 0) {
      return {
        success: false,
        message: '承認権限を持つエージェントが見つかりません',
        respondedAt: new Date(),
      };
    }

    // 承認基準を評価
    const approvalCriteria = this.evaluateApprovalCriteria(approvalRequest);
    
    // 各承認者の判断を収集
    const approvalDecisions = await Promise.all(
      approvers.map(async approver => ({
        approver,
        decision: await this.makeApprovalDecision(approver, approvalRequest, approvalCriteria, system),
      }))
    );

    // 承認ルールに基づいて最終決定
    const finalDecision = this.aggregateDecisions(approvalDecisions, approvalRequest.approvalRule);

    if (finalDecision.approved) {
      // 承認記録を作成
      const approvalRecord = this.createApprovalRecord(
        request,
        approvalDecisions,
        finalDecision
      );

      // 信頼度を更新（承認した場合）
      approvalDecisions
        .filter(d => d.decision.approved)
        .forEach(d => {
          system.updateTrust(request.fromAgent, d.approver.id, 'success');
          system.updateTrust(d.approver.id, request.fromAgent, 'success');
        });

      return {
        success: true,
        message: finalDecision.reason || '承認されました',
        data: approvalRecord,
        respondedAt: new Date(),
      };
    }

    return {
      success: false,
      message: finalDecision.reason || '承認が却下されました',
      data: {
        decisions: approvalDecisions.map(d => ({
          approver: d.approver.name,
          approved: d.decision.approved,
          reason: d.decision.reason,
        })),
      },
      respondedAt: new Date(),
    };
  }

  private hasApprovalAuthority(agent: Agent, approvalRequest: any): boolean {
    // エージェントの能力に基づいて承認権限をチェック
    const requiredAuthority = approvalRequest.requiredAuthority || 'general_approval';
    return agent.capabilities.includes(requiredAuthority) ||
           agent.capabilities.includes('approval_authority');
  }

  private evaluateApprovalCriteria(approvalRequest: any): any {
    return {
      amount: approvalRequest.amount || 0,
      riskLevel: approvalRequest.riskLevel || 'medium',
      urgency: approvalRequest.urgency || 'normal',
      category: approvalRequest.category || 'general',
      compliance: approvalRequest.complianceChecked || false,
      documentation: approvalRequest.documentationComplete || false,
    };
  }

  private async makeApprovalDecision(
    approver: Agent,
    approvalRequest: any,
    criteria: any,
    system: MultiAgentNegotiationSystem
  ): Promise<{ approved: boolean; reason?: string; confidence: number }> {
    // 承認者のリスク許容度を考慮
    const riskTolerance = this.getAgentRiskTolerance(approver);
    
    // 各基準を評価
    let approvalScore = 0;
    let reasons: string[] = [];

    // 金額チェック
    if (criteria.amount > 0) {
      const amountScore = this.evaluateAmount(criteria.amount, approver);
      approvalScore += amountScore;
      if (amountScore < 0.5) {
        reasons.push('金額が承認限度を超えています');
      }
    }

    // リスクレベルチェック
    const riskScore = this.evaluateRisk(criteria.riskLevel, riskTolerance);
    approvalScore += riskScore;
    if (riskScore < 0.5) {
      reasons.push('リスクレベルが許容範囲を超えています');
    }

    // コンプライアンスチェック
    if (!criteria.compliance) {
      approvalScore -= 0.5;
      reasons.push('コンプライアンスチェックが完了していません');
    }

    // ドキュメンテーションチェック
    if (!criteria.documentation) {
      approvalScore -= 0.3;
      reasons.push('必要な文書が不足しています');
    }

    // 信頼度を考慮
    const requesterTrust = approver.preferences.trustScores.get(approvalRequest.requesterId) || 0.5;
    approvalScore += requesterTrust * 0.2;

    // 最終的な承認判断
    const approved = approvalScore >= 0.6;
    const confidence = Math.min(1, Math.max(0, approvalScore));

    return {
      approved,
      reason: reasons.length > 0 ? reasons.join(', ') : undefined,
      confidence,
    };
  }

  private getAgentRiskTolerance(agent: Agent): number {
    // エージェントの協力戦略からリスク許容度を推定
    const toleranceMap = {
      collaborative: 0.7,
      balanced: 0.5,
      competitive: 0.3,
    };
    return toleranceMap[agent.preferences.cooperationStrategy];
  }

  private evaluateAmount(amount: number, approver: Agent): number {
    // 金額の妥当性を評価（簡略版）
    const maxApprovalAmount = 1000000; // 100万円
    if (amount > maxApprovalAmount) return 0;
    return 1 - (amount / maxApprovalAmount);
  }

  private evaluateRisk(riskLevel: string, tolerance: number): number {
    const riskValues = {
      low: 0.2,
      medium: 0.5,
      high: 0.8,
      critical: 1.0,
    };
    const risk = riskValues[riskLevel] || 0.5;
    return risk <= tolerance ? 1 : 1 - (risk - tolerance);
  }

  private aggregateDecisions(
    decisions: Array<{ approver: Agent; decision: any }>,
    rule: string = 'majority'
  ): { approved: boolean; reason?: string } {
    const approvedCount = decisions.filter(d => d.decision.approved).length;
    const totalCount = decisions.length;

    switch (rule) {
      case 'unanimous':
        return {
          approved: approvedCount === totalCount,
          reason: approvedCount === totalCount ? '全員一致で承認' : '全員一致が必要です',
        };
      
      case 'majority':
        return {
          approved: approvedCount > totalCount / 2,
          reason: `${approvedCount}/${totalCount}の承認者が承認`,
        };
      
      case 'any':
        return {
          approved: approvedCount > 0,
          reason: approvedCount > 0 ? '承認者による承認' : '承認者が見つかりません',
        };
      
      default:
        return {
          approved: approvedCount > totalCount / 2,
          reason: `${approvedCount}/${totalCount}の承認者が承認`,
        };
    }
  }

  private createApprovalRecord(
    request: CoordinationRequest,
    decisions: Array<{ approver: Agent; decision: any }>,
    finalDecision: any
  ): any {
    return {
      requestId: request.id,
      requestType: request.payload.type,
      requestedAt: request.timestamp,
      approvedAt: new Date(),
      approved: finalDecision.approved,
      approvers: decisions.map(d => ({
        id: d.approver.id,
        name: d.approver.name,
        decision: d.decision.approved,
        confidence: d.decision.confidence,
        reason: d.decision.reason,
      })),
      finalReason: finalDecision.reason,
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
    const resolutions: any[] = [];
    const conflictDetails = request.payload;

    switch (strategy) {
      case 'win-win':
        // 全員が利益を得られる解決案を生成
        resolutions.push({
          type: 'resource_sharing',
          description: 'リソースの時分割共有',
          terms: {
            schedule: this.generateTimeSharingSchedule(participants, conflictDetails),
            compensation: 'mutual_priority_boost',
          },
        });
        
        resolutions.push({
          type: 'collaborative_execution',
          description: '共同実行による相乗効果',
          terms: {
            taskDivision: this.generateTaskDivision(participants, conflictDetails),
            benefitSharing: 'proportional',
          },
        });
        break;

      case 'compromise':
        // 妥協案を生成
        resolutions.push({
          type: 'partial_allocation',
          description: '部分的なリソース割り当て',
          terms: {
            allocation: this.generatePartialAllocation(participants, conflictDetails),
            priority: 'rotating',
          },
        });
        
        resolutions.push({
          type: 'alternative_resource',
          description: '代替リソースの活用',
          terms: {
            alternativeResources: this.identifyAlternatives(conflictDetails),
            compensationMechanism: 'credit_based',
          },
        });
        break;

      default:
        // デフォルトの解決案
        resolutions.push({
          type: 'priority_based',
          description: '優先度に基づく割り当て',
          terms: {
            allocationRule: 'highest_priority_first',
            waitingCompensation: true,
          },
        });
    }

    return resolutions;
  }

  private async conductVoting(
    resolutions: any[],
    participants: Agent[],
    system: MultiAgentNegotiationSystem
  ): Promise<{ accepted: boolean; resolution?: any }> {
    const votes: Map<number, number> = new Map();
    
    // 各参加者が解決案に投票
    for (const participant of participants) {
      const rankings = resolutions.map((resolution, index) => ({
        index,
        score: this.evaluateResolution(resolution, participant, system),
      })).sort((a, b) => b.score - a.score);

      // 最高スコアの解決案に投票
      if (rankings.length > 0 && rankings[0].score > 0) {
        const currentVotes = votes.get(rankings[0].index) || 0;
        votes.set(rankings[0].index, currentVotes + 1);
      }
    }

    // 最多票を獲得した解決案を選択
    let maxVotes = 0;
    let selectedIndex = -1;
    
    votes.forEach((voteCount, index) => {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        selectedIndex = index;
      }
    });

    // 過半数の支持があれば承認
    const acceptanceThreshold = participants.length / 2;
    if (maxVotes > acceptanceThreshold) {
      return {
        accepted: true,
        resolution: {
          ...resolutions[selectedIndex],
          votes: maxVotes,
          totalParticipants: participants.length,
        },
      };
    }

    return { accepted: false };
  }

  private generateTimeSharingSchedule(participants: Agent[], conflictDetails: any): any {
    const totalSlots = 24; // 24時間
    const slotPerParticipant = Math.floor(totalSlots / participants.length);
    
    return participants.map((participant, index) => ({
      agentId: participant.id,
      startHour: index * slotPerParticipant,
      endHour: (index + 1) * slotPerParticipant,
      priority: participant.preferences.priorityThreshold,
    }));
  }

  private generateTaskDivision(participants: Agent[], conflictDetails: any): any {
    // タスクを参加者の能力に基づいて分割
    const subtasks = conflictDetails.subtasks || [];
    const assignments: any[] = [];

    subtasks.forEach((subtask: any, index: number) => {
      const bestAgent = participants.reduce((best, current) => {
        const currentScore = this.calculateTaskFitness(current, subtask);
        const bestScore = this.calculateTaskFitness(best, subtask);
        return currentScore > bestScore ? current : best;
      });

      assignments.push({
        subtaskId: subtask.id || `subtask_${index}`,
        assignedTo: bestAgent.id,
        estimatedEffort: subtask.effort || 1,
      });
    });

    return assignments;
  }

  private generatePartialAllocation(participants: Agent[], conflictDetails: any): any {
    const totalResource = conflictDetails.resourceAmount || 100;
    const equalShare = totalResource / participants.length;
    
    // 優先度に基づいて調整
    return participants.map(participant => {
      const priorityMultiplier = {
        critical: 1.5,
        high: 1.2,
        medium: 1.0,
        low: 0.8,
      };
      const multiplier = priorityMultiplier[participant.preferences.priorityThreshold] || 1.0;
      
      return {
        agentId: participant.id,
        allocation: Math.floor(equalShare * multiplier),
      };
    });
  }

  private identifyAlternatives(conflictDetails: any): any[] {
    // 代替リソースの候補を生成（簡略版）
    return [
      {
        resourceType: 'compute_alternative',
        availability: 0.8,
        performanceRatio: 0.9,
      },
      {
        resourceType: 'external_service',
        availability: 0.6,
        performanceRatio: 0.7,
      },
    ];
  }

  private evaluateResolution(resolution: any, participant: Agent, system: MultiAgentNegotiationSystem): number {
    let score = 0;

    // 解決案のタイプに基づく基本スコア
    const typePreferences = {
      win_win: participant.preferences.cooperationStrategy === 'collaborative' ? 1.0 : 0.6,
      compromise: 0.7,
      priority_based: participant.preferences.cooperationStrategy === 'competitive' ? 0.8 : 0.5,
    };
    score += (typePreferences[resolution.type] || 0.5) * 50;

    // 効用計算
    const utility = system.calculateUtility(participant, resolution.terms);
    score += utility;

    return score;
  }

  private calculateTaskFitness(agent: Agent, subtask: any): number {
    const requiredCapabilities = subtask.requiredCapabilities || [];
    const matchCount = requiredCapabilities.filter((cap: string) => 
      agent.capabilities.includes(cap)
    ).length;
    
    return matchCount / Math.max(requiredCapabilities.length, 1);
  }

  private generateCompromise(participants: Agent[], request: CoordinationRequest): any {
    // 妥協案の生成
    return {
      type: 'compromise',
      terms: 'リソースを均等に分配',
    };
  }
}