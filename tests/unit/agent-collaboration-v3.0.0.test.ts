import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AgentCollaborationManager } from '../../src/agent-collaboration-protocol-v3.0.0.js';
import { IntegratedWorkflowAutomationEngine } from '../../src/integrated-workflow-automation-v3.0.0.js';

describe('エージェント協調プロトコル v3.0.0', () => {
  let collaborationManager: AgentCollaborationManager;
  let workflowEngine: IntegratedWorkflowAutomationEngine;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getEmployee: vi.fn(),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn()
    };
    
    collaborationManager = new AgentCollaborationManager(mockDb);
    workflowEngine = new IntegratedWorkflowAutomationEngine(mockDb, collaborationManager);
  });

  afterEach(() => {
    // クリーンアップ
    if (collaborationManager) {
      collaborationManager.shutdown();
    }
  });

  describe('エージェント登録・能力広告', () => {
    it('エージェントを正常に登録し能力を広告する', async () => {
      const agentCapabilities = {
        agentId: 'payroll_agent_001',
        capabilities: [
          {
            name: 'calculate_payroll',
            description: '月次給与計算の実行',
            inputSchema: { employeeIds: 'array', month: 'string' },
            outputSchema: { calculations: 'array', summary: 'object' },
            slaMetrics: {
              averageResponseTime: 5000,
              successRate: 99.5,
              maxConcurrency: 10
            }
          }
        ],
        loadMetrics: {
          cpuUsage: 0.3,
          memoryUsage: 0.4,
          queueLength: 0,
          isAvailable: true
        },
        lastUpdated: new Date()
      };

      await collaborationManager.registerAgent('payroll_agent_001', agentCapabilities);

      // メッセージログ確認
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_messages'),
        expect.arrayContaining([
          expect.stringMatching(/MSG_/),
          'system',
          'broadcast',
          'notification'
        ])
      );
    });

    it('複数エージェントの能力発見・マッチングを行う', async () => {
      // エージェント1: 給与計算専門
      await collaborationManager.registerAgent('payroll_agent', {
        agentId: 'payroll_agent',
        capabilities: [{
          name: 'payroll_calculation',
          description: '給与計算処理',
          inputSchema: {},
          outputSchema: {},
          slaMetrics: { averageResponseTime: 3000, successRate: 99.8, maxConcurrency: 5 }
        }],
        loadMetrics: { cpuUsage: 0.2, memoryUsage: 0.3, queueLength: 0, isAvailable: true },
        lastUpdated: new Date()
      });

      // エージェント2: コンプライアンス専門
      await collaborationManager.registerAgent('compliance_agent', {
        agentId: 'compliance_agent',
        capabilities: [{
          name: 'compliance_check',
          description: 'コンプライアンス監査',
          inputSchema: {},
          outputSchema: {},
          slaMetrics: { averageResponseTime: 2000, successRate: 99.9, maxConcurrency: 3 }
        }],
        loadMetrics: { cpuUsage: 0.1, memoryUsage: 0.2, queueLength: 0, isAvailable: true },
        lastUpdated: new Date()
      });

      // 能力検索
      const payrollAgents = await collaborationManager.findCapableAgents('payroll_calculation');
      const complianceAgents = await collaborationManager.findCapableAgents('compliance_check');

      expect(payrollAgents).toHaveLength(1);
      expect(payrollAgents[0].agentId).toBe('payroll_agent');
      expect(payrollAgents[0].suitabilityScore).toBeGreaterThan(0.5);

      expect(complianceAgents).toHaveLength(1);
      expect(complianceAgents[0].agentId).toBe('compliance_agent');
    });
  });

  describe('協調ワークフロー実行', () => {
    it('マルチエージェント協調ワークフローを実行する', async () => {
      // エージェント登録
      await collaborationManager.registerAgent('agent_1', {
        agentId: 'agent_1',
        capabilities: [{ name: 'task_a', description: '', inputSchema: {}, outputSchema: {}, slaMetrics: { averageResponseTime: 1000, successRate: 99, maxConcurrency: 1 } }],
        loadMetrics: { cpuUsage: 0.1, memoryUsage: 0.1, queueLength: 0, isAvailable: true },
        lastUpdated: new Date()
      });

      await collaborationManager.registerAgent('agent_2', {
        agentId: 'agent_2',
        capabilities: [{ name: 'task_b', description: '', inputSchema: {}, outputSchema: {}, slaMetrics: { averageResponseTime: 1500, successRate: 98, maxConcurrency: 1 } }],
        loadMetrics: { cpuUsage: 0.2, memoryUsage: 0.2, queueLength: 0, isAvailable: true },
        lastUpdated: new Date()
      });

      const workflowDefinition = {
        name: 'テスト協調ワークフロー',
        description: '2つのエージェントが順次実行',
        initiatorAgentId: 'system',
        participantAgents: ['agent_1', 'agent_2'],
        steps: [
          {
            stepId: 'step_1',
            agentId: 'agent_1',
            action: 'task_a',
            dependencies: [],
            timeout: 30000,
            retryPolicy: { maxRetries: 3, backoffStrategy: 'exponential' as const, baseDelay: 1000 }
          },
          {
            stepId: 'step_2',
            agentId: 'agent_2',
            action: 'task_b',
            dependencies: ['step_1'],
            timeout: 30000,
            retryPolicy: { maxRetries: 3, backoffStrategy: 'exponential' as const, baseDelay: 1000 }
          }
        ]
      };

      const workflowId = await collaborationManager.executeCollaborativeWorkflow(workflowDefinition);

      expect(workflowId).toBeDefined();
      expect(workflowId).toMatch(/^WF_/);
    });

    it('エージェント障害時の自動フェイルオーバーを実行する', async () => {
      // 主エージェント
      await collaborationManager.registerAgent('primary_agent', {
        agentId: 'primary_agent',
        capabilities: [{ name: 'critical_task', description: '', inputSchema: {}, outputSchema: {}, slaMetrics: { averageResponseTime: 1000, successRate: 99, maxConcurrency: 1 } }],
        loadMetrics: { cpuUsage: 0.3, memoryUsage: 0.4, queueLength: 0, isAvailable: true },
        lastUpdated: new Date()
      });

      // バックアップエージェント
      await collaborationManager.registerAgent('backup_agent', {
        agentId: 'backup_agent',
        capabilities: [{ name: 'critical_task', description: '', inputSchema: {}, outputSchema: {}, slaMetrics: { averageResponseTime: 1200, successRate: 98, maxConcurrency: 1 } }],
        loadMetrics: { cpuUsage: 0.2, memoryUsage: 0.3, queueLength: 0, isAvailable: true },
        lastUpdated: new Date()
      });

      // エージェント障害シミュレーション
      collaborationManager.emit('agent_failure', 'primary_agent');

      // 代替エージェント検索
      const alternativeAgents = await collaborationManager.findCapableAgents('critical_task', {
        excludeAgents: ['primary_agent']
      });

      expect(alternativeAgents).toHaveLength(1);
      expect(alternativeAgents[0].agentId).toBe('backup_agent');
    });
  });

  describe('分散合意形成', () => {
    it('エージェント間で合意形成を実行する', async () => {
      // 複数エージェント登録
      const agentIds = ['agent_a', 'agent_b', 'agent_c'];
      for (const agentId of agentIds) {
        await collaborationManager.registerAgent(agentId, {
          agentId,
          capabilities: [],
          loadMetrics: { cpuUsage: 0.1, memoryUsage: 0.1, queueLength: 0, isAvailable: true },
          lastUpdated: new Date()
        });
      }

      const proposal = {
        proposalType: 'workflow_optimization' as const,
        description: 'ワークフロー最適化提案',
        proposedChanges: { optimization: 'parallel_execution' },
        votingDeadline: new Date(Date.now() + 60000), // 1分後
        requiredMajority: 67 // 67%
      };

      const proposalId = await collaborationManager.initiateConsensus('agent_a', proposal);

      expect(proposalId).toBeDefined();
      expect(proposalId).toMatch(/^PROP_/);
    });
  });

  describe('メッセージング・通信', () => {
    it('優先度ベースメッセージキューイングを行う', async () => {
      await collaborationManager.registerAgent('test_agent', {
        agentId: 'test_agent',
        capabilities: [],
        loadMetrics: { cpuUsage: 0.1, memoryUsage: 0.1, queueLength: 0, isAvailable: true },
        lastUpdated: new Date()
      });

      // 異なる優先度のメッセージ送信
      await collaborationManager.sendMessage({
        id: 'msg_low',
        senderId: 'sender',
        receiverId: 'test_agent',
        messageType: 'notification',
        payload: { priority_test: 'low' },
        timestamp: new Date(),
        priority: 'low'
      });

      await collaborationManager.sendMessage({
        id: 'msg_urgent',
        senderId: 'sender',
        receiverId: 'test_agent',
        messageType: 'notification',
        payload: { priority_test: 'urgent' },
        timestamp: new Date(),
        priority: 'urgent'
      });

      await collaborationManager.sendMessage({
        id: 'msg_medium',
        senderId: 'sender',
        receiverId: 'test_agent',
        messageType: 'notification',
        payload: { priority_test: 'medium' },
        timestamp: new Date(),
        priority: 'medium'
      });

      // メッセージ取得順序確認（urgent → medium → low）
      const firstMessage = await collaborationManager.receiveMessage('test_agent');
      const secondMessage = await collaborationManager.receiveMessage('test_agent');
      const thirdMessage = await collaborationManager.receiveMessage('test_agent');

      expect(firstMessage?.id).toBe('msg_urgent');
      expect(secondMessage?.id).toBe('msg_medium');
      expect(thirdMessage?.id).toBe('msg_low');
    });

    it('TTL（Time To Live）期限切れメッセージを処理する', async () => {
      const expiredMessage = {
        id: 'msg_expired',
        senderId: 'sender',
        receiverId: 'test_agent',
        messageType: 'notification' as const,
        payload: { test: 'expired' },
        timestamp: new Date(Date.now() - 10000), // 10秒前
        priority: 'medium' as const,
        ttl: 5000 // 5秒TTL
      };

      // 期限切れメッセージは送信されない
      await collaborationManager.sendMessage(expiredMessage);
      
      // メッセージがキューに入らないことを確認
      await collaborationManager.registerAgent('test_agent', {
        agentId: 'test_agent',
        capabilities: [],
        loadMetrics: { cpuUsage: 0.1, memoryUsage: 0.1, queueLength: 0, isAvailable: true },
        lastUpdated: new Date()
      });

      const receivedMessage = await collaborationManager.receiveMessage('test_agent');
      expect(receivedMessage).toBeNull();
    });
  });
});

describe('統合ワークフロー自動化エンジン v3.0.0', () => {
  let workflowEngine: IntegratedWorkflowAutomationEngine;
  let collaborationManager: AgentCollaborationManager;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getEmployee: vi.fn(),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn()
    };
    
    collaborationManager = new AgentCollaborationManager(mockDb);
    workflowEngine = new IntegratedWorkflowAutomationEngine(mockDb, collaborationManager);
  });

  describe('統合月次処理ワークフロー', () => {
    it('月次処理ワークフローを正常に実行する', async () => {
      const executionId = await workflowEngine.executeMonthlyProcessingWorkflow('2024-01');

      expect(executionId).toBeDefined();
      expect(executionId).toMatch(/^EXEC_/);

      const execution = workflowEngine.getExecutionStatus(executionId);
      expect(execution).toBeDefined();
      expect(execution?.workflowId).toBe('monthly_processing_v3');
      expect(execution?.status).toBe('pending');
    });

    it('実行状況を正しく追跡する', async () => {
      const executionId = await workflowEngine.executeMonthlyProcessingWorkflow('2024-01');

      // 少し待機してステータス確認
      await new Promise(resolve => setTimeout(resolve, 100));

      const execution = workflowEngine.getExecutionStatus(executionId);
      expect(execution?.executionContext.get('month')).toBe('2024-01');
      expect(execution?.triggeredBy.type).toBe('manual');
    });
  });

  describe('新入社員オンボーディングワークフロー', () => {
    it('オンボーディングワークフローを実行する', async () => {
      const employeeData = {
        id: 'emp001',
        name: '山田太郎',
        email: 'yamada@example.com',
        position: 'ソフトウェアエンジニア',
        department: '開発部',
        managerId: 'mgr001',
        startDate: new Date()
      };

      const executionId = await workflowEngine.executeEmployeeOnboardingWorkflow(employeeData);

      expect(executionId).toBeDefined();
      
      const execution = workflowEngine.getExecutionStatus(executionId);
      expect(execution?.workflowId).toBe('employee_onboarding_v3');
      expect(execution?.executionContext.get('employeeData')).toEqual(employeeData);
    });
  });

  describe('実行管理', () => {
    it('アクティブな実行一覧を取得する', async () => {
      const executionId1 = await workflowEngine.executeMonthlyProcessingWorkflow('2024-01');
      const executionId2 = await workflowEngine.executeMonthlyProcessingWorkflow('2024-02');

      const activeExecutions = workflowEngine.getActiveExecutions();

      expect(activeExecutions).toHaveLength(2);
      expect(activeExecutions.map(e => e.id)).toContain(executionId1);
      expect(activeExecutions.map(e => e.id)).toContain(executionId2);
    });

    it('実行をキャンセルする', async () => {
      const executionId = await workflowEngine.executeMonthlyProcessingWorkflow('2024-01');

      const cancelled = await workflowEngine.cancelExecution(executionId);
      expect(cancelled).toBe(true);

      const execution = workflowEngine.getExecutionStatus(executionId);
      expect(execution?.status).toBe('cancelled');
    });

    it('完了済み実行のキャンセルを拒否する', async () => {
      const executionId = await workflowEngine.executeMonthlyProcessingWorkflow('2024-01');
      
      // 実行を完了状態に変更
      const execution = workflowEngine.getExecutionStatus(executionId);
      if (execution) {
        execution.status = 'completed';
      }

      const cancelled = await workflowEngine.cancelExecution(executionId);
      expect(cancelled).toBe(false);
    });
  });

  describe('エラーハンドリング', () => {
    it('ステップ実行エラーを適切に処理する', async () => {
      // データベースエラーをシミュレーション
      mockDb.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const executionId = await workflowEngine.executeMonthlyProcessingWorkflow('2024-01');

      // エラーが発生してもexecutionIdは返される（非同期実行のため）
      expect(executionId).toBeDefined();
    });
  });
});