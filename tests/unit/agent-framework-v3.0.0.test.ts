import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  BaseAgent,
  AgentOrchestrator,
  AgentMCPServer,
  type AgentCapability,
  type AgentContext,
  type AgentGoal,
  type AgentAction,
  type AgentPlan,
  type AgentResult,
  type AgentState
} from '../../src/agent-framework-v3.0.0.js';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import ComplianceAgent from '../../src/agents/compliance-agent-v3.0.0.js';
// import ExpenseAgent from '../../src/agents/expense-agent-v3.0.0.js';
// import PayrollAgent from '../../src/agents/payroll-agent-v3.0.0.js';

// テスト用のモックエージェント
class TestAgent extends BaseAgent {
  protected async validateGoal(goal: AgentGoal): Promise<void> {
    if (!goal.successCriteria || goal.successCriteria.length === 0) {
      throw new Error('Goal must have success criteria');
    }
  }

  protected async createPlan(goal: AgentGoal): Promise<AgentPlan> {
    const actions: AgentAction[] = [
      {
        id: `action_${goal.id}_1`,
        type: 'test',
        description: 'Test action 1',
        parameters: { test: true },
        requiredCapabilities: ['test'],
        estimatedDuration: 1000,
        retryable: true
      },
      {
        id: `action_${goal.id}_2`,
        type: 'test',
        description: 'Test action 2',
        parameters: { test: true },
        requiredCapabilities: ['test'],
        estimatedDuration: 2000,
        retryable: false
      }
    ];

    const dependencies = new Map<string, string[]>();
    dependencies.set(actions[1].id, [actions[0].id]); // action2 depends on action1

    return {
      goalId: goal.id,
      actions,
      dependencies,
      estimatedTotalDuration: 3000,
      parallelizable: false
    };
  }

  protected async executeAction(action: AgentAction): Promise<AgentResult> {
    // シミュレートされた実行
    await new Promise(resolve => setTimeout(resolve, 100));

    if (action.parameters.shouldFail) {
      throw new Error('Action failed');
    }

    return {
      actionId: action.id,
      status: 'success',
      output: { result: 'completed' },
      duration: 100,
      timestamp: new Date()
    };
  }
}

describe('AI エージェントフレームワーク v3.0.0', () => {
  let mockDb: DatabasePostgreSQL;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      getAllEmployees: vi.fn().mockResolvedValue([]),
      getAllTimeRecords: vi.fn().mockResolvedValue([]),
      getTimeRecords: vi.fn().mockResolvedValue([])
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('BaseAgent', () => {
    let agent: TestAgent;

    beforeEach(() => {
      const capability: AgentCapability = {
        name: 'test-agent',
        description: 'Test agent for unit testing',
        version: '1.0.0',
        supportedActions: ['test', 'validate'],
        requiredPermissions: ['read', 'write']
      };

      agent = new TestAgent('test-agent', capability, mockDb);
    });

    describe('初期化', () => {
      it('エージェントを正しく初期化できる', async () => {
        const context: AgentContext = {
          sessionId: 'session123',
          userId: 'user123',
          permissions: ['read', 'write'],
          metadata: { test: true },
          startTime: new Date()
        };

        await agent.initialize(context);

        const state = agent.getStateSnapshot();
        expect(state.agentId).toContain('AGENT_TEST-AGENT');
        expect(state.status).toBe('idle');
        expect(state.memory.get('context')).toEqual(context);
      });

      it('必要な権限がない場合エラーを投げる', async () => {
        const context: AgentContext = {
          sessionId: 'session123',
          userId: 'user123',
          permissions: ['read'], // writeが不足
          metadata: {},
          startTime: new Date()
        };

        await expect(agent.initialize(context))
          .rejects.toThrow('Missing required permissions: write');
      });
    });

    describe('ゴール処理', () => {
      it('有効なゴールを受信して計画を作成できる', async () => {
        const goal: AgentGoal = {
          id: 'goal123',
          type: 'process',
          description: 'Test goal',
          priority: 'medium',
          successCriteria: ['Criteria 1', 'Criteria 2']
        };

        const plan = await agent.receiveGoal(goal);

        expect(plan.goalId).toBe(goal.id);
        expect(plan.actions).toHaveLength(2);
        expect(plan.estimatedTotalDuration).toBe(3000);
        expect(plan.dependencies.size).toBe(1);
      });

      it('無効なゴールを拒否する', async () => {
        const invalidGoal: AgentGoal = {
          id: 'goal456',
          type: 'process',
          description: 'Invalid goal',
          priority: 'high',
          successCriteria: [] // 空の成功基準
        };

        await expect(agent.receiveGoal(invalidGoal))
          .rejects.toThrow('Goal must have success criteria');
      });

      it('期限付きゴールを処理できる', async () => {
        const timedGoal: AgentGoal = {
          id: 'goal789',
          type: 'monitor',
          description: 'Time-bound goal',
          priority: 'critical',
          deadline: new Date(Date.now() + 60000),
          successCriteria: ['Complete within deadline']
        };

        const plan = await agent.receiveGoal(timedGoal);
        expect(plan).toBeDefined();
        expect(plan.estimatedTotalDuration).toBeLessThan(60000);
      });
    });

    describe('計画実行', () => {
      it('計画を順次実行できる', async () => {
        const goal: AgentGoal = {
          id: 'exec_goal',
          type: 'process',
          description: 'Execution test',
          priority: 'medium',
          successCriteria: ['Execute all actions']
        };

        await agent.receiveGoal(goal);
        const results = await agent.executePlan();

        expect(results).toHaveLength(2);
        expect(results[0].status).toBe('success');
        expect(results[1].status).toBe('success');

        const state = agent.getStateSnapshot();
        expect(state.status).toBe('completed');
        expect(state.executionProgress.completedActions).toHaveLength(2);
      });

      it('失敗したアクションを適切に処理する', async () => {
        // 失敗するアクションを含む計画を作成
        const failingAgent = new TestAgent('failing-agent', {
          name: 'failing-agent',
          description: 'Agent that fails',
          version: '1.0.0',
          supportedActions: ['test'],
          requiredPermissions: []
        }, mockDb);

        // executeActionをモックして失敗させる
        failingAgent['executeAction'] = vi.fn().mockRejectedValueOnce(new Error('Action failed'));

        const goal: AgentGoal = {
          id: 'fail_goal',
          type: 'process',
          description: 'Failing test',
          priority: 'low',
          successCriteria: ['Handle failure']
        };

        await failingAgent.receiveGoal(goal);
        const results = await failingAgent.executePlan();

        expect(results.some(r => r.status === 'failure')).toBe(true);
      });

      it('並列実行可能なアクションを並列で実行する', async () => {
        // 並列実行可能な計画を作成するエージェント
        class ParallelAgent extends TestAgent {
          protected async createPlan(goal: AgentGoal): Promise<AgentPlan> {
            const actions: AgentAction[] = Array.from({ length: 5 }, (_, i) => ({
              id: `parallel_action_${i}`,
              type: 'test',
              description: `Parallel action ${i}`,
              parameters: { index: i },
              requiredCapabilities: ['test'],
              estimatedDuration: 100,
              retryable: true
            }));

            // 依存関係なし（すべて並列実行可能）
            return {
              goalId: goal.id,
              actions,
              dependencies: new Map(),
              estimatedTotalDuration: 100,
              parallelizable: true
            };
          }
        }

        const parallelAgent = new ParallelAgent('parallel-agent', {
          name: 'parallel-agent',
          description: 'Parallel execution agent',
          version: '1.0.0',
          supportedActions: ['test'],
          requiredPermissions: []
        }, mockDb);

        const goal: AgentGoal = {
          id: 'parallel_goal',
          type: 'process',
          description: 'Parallel execution test',
          priority: 'medium',
          successCriteria: ['Execute in parallel']
        };

        const startTime = Date.now();
        await parallelAgent.receiveGoal(goal);
        const results = await parallelAgent.executePlan();
        const endTime = Date.now();

        expect(results).toHaveLength(5);
        expect(results.every(r => r.status === 'success')).toBe(true);
        // 並列実行のため、総実行時間は個々のアクション時間より短い
        expect(endTime - startTime).toBeLessThan(500);
      });
    });

    describe('状態管理', () => {
      it('エージェントを一時停止・再開できる', async () => {
        const goal: AgentGoal = {
          id: 'pause_goal',
          type: 'process',
          description: 'Pausable goal',
          priority: 'low',
          successCriteria: ['Can be paused']
        };

        await agent.receiveGoal(goal);

        // 実行を開始してすぐに一時停止
        const executionPromise = agent.executePlan();
        await agent.pause();

        const pausedState = agent.getStateSnapshot();
        expect(pausedState.status).toBe('paused');

        // 再開
        await agent.resume();
        const results = await executionPromise;

        expect(results).toHaveLength(2);
        const finalState = agent.getStateSnapshot();
        expect(finalState.status).toBe('completed');
      });

      it('エージェントの状態スナップショットを取得できる', () => {
        const state = agent.getStateSnapshot();

        expect(state).toMatchObject({
          agentId: expect.stringContaining('AGENT_TEST-AGENT'),
          status: 'idle',
          executionProgress: {
            completedActions: [],
            pendingActions: [],
            results: []
          }
        });
      });
    });

    describe('エラーハンドリング', () => {
      it('循環依存を検出する', async () => {
        class CircularDependencyAgent extends TestAgent {
          protected async createPlan(goal: AgentGoal): Promise<AgentPlan> {
            const actions: AgentAction[] = [
              {
                id: 'action1',
                type: 'test',
                description: 'Action 1',
                parameters: {},
                requiredCapabilities: ['test'],
                estimatedDuration: 100,
                retryable: true
              },
              {
                id: 'action2',
                type: 'test',
                description: 'Action 2',
                parameters: {},
                requiredCapabilities: ['test'],
                estimatedDuration: 100,
                retryable: true
              }
            ];

            // 循環依存を作成
            const dependencies = new Map<string, string[]>();
            dependencies.set('action1', ['action2']);
            dependencies.set('action2', ['action1']);

            return {
              goalId: goal.id,
              actions,
              dependencies,
              estimatedTotalDuration: 200,
              parallelizable: false
            };
          }
        }

        const circularAgent = new CircularDependencyAgent('circular-agent', {
          name: 'circular-agent',
          description: 'Agent with circular deps',
          version: '1.0.0',
          supportedActions: ['test'],
          requiredPermissions: []
        }, mockDb);

        const goal: AgentGoal = {
          id: 'circular_goal',
          type: 'process',
          description: 'Circular dependency test',
          priority: 'medium',
          successCriteria: ['Should fail']
        };

        await circularAgent.receiveGoal(goal);
        await expect(circularAgent.executePlan())
          .rejects.toThrow('Circular dependency detected');
      });

      it('リトライ可能なアクションを再試行する', async () => {
        let attemptCount = 0;
        
        class RetryAgent extends TestAgent {
          protected async executeAction(action: AgentAction): Promise<AgentResult> {
            attemptCount++;
            
            if (attemptCount < 3) {
              throw new Error('Temporary failure');
            }
            
            return {
              actionId: action.id,
              status: 'success',
              output: { attempts: attemptCount },
              duration: 100,
              timestamp: new Date()
            };
          }
        }

        const retryAgent = new RetryAgent('retry-agent', {
          name: 'retry-agent',
          description: 'Agent that retries',
          version: '1.0.0',
          supportedActions: ['test'],
          requiredPermissions: []
        }, mockDb);

        const goal: AgentGoal = {
          id: 'retry_goal',
          type: 'process',
          description: 'Retry test',
          priority: 'medium',
          successCriteria: ['Retry on failure']
        };

        await retryAgent.receiveGoal(goal);
        const results = await retryAgent.executePlan();

        expect(attemptCount).toBe(3); // 2回失敗、3回目で成功
        expect(results[0].status).toBe('success');
      });
    });
  });

  describe('AgentOrchestrator', () => {
    let orchestrator: AgentOrchestrator;

    beforeEach(() => {
      orchestrator = new AgentOrchestrator(mockDb);
    });

    it('エージェントを登録・取得できる', () => {
      const agent = new TestAgent('test', {
        name: 'test',
        description: 'Test agent',
        version: '1.0.0',
        supportedActions: ['test'],
        requiredPermissions: []
      }, mockDb);

      orchestrator.registerAgent(agent);

      const status = orchestrator.getAgentsStatus();
      expect(status.size).toBe(1);
      expect(Array.from(status.values())[0].agentId).toContain('AGENT_TEST');
    });

    it('ゴールをエージェントに割り当てて実行できる', async () => {
      const agent = new TestAgent('executor', {
        name: 'executor',
        description: 'Executor agent',
        version: '1.0.0',
        supportedActions: ['test'],
        requiredPermissions: []
      }, mockDb);

      orchestrator.registerAgent(agent);

      const goal: AgentGoal = {
        id: 'orchestrated_goal',
        type: 'process',
        description: 'Orchestrated execution',
        priority: 'high',
        successCriteria: ['Complete via orchestrator']
      };

      const results = await orchestrator.assignGoal(goal, 'executor');

      expect(results).toHaveLength(2);
      expect(results.every(r => r.status === 'success')).toBe(true);
    });

    it('存在しないエージェントへの割り当てでエラーを投げる', async () => {
      const goal: AgentGoal = {
        id: 'invalid_agent_goal',
        type: 'process',
        description: 'Invalid agent test',
        priority: 'medium',
        successCriteria: ['Should fail']
      };

      await expect(orchestrator.assignGoal(goal, 'non-existent'))
        .rejects.toThrow('Agent not found: non-existent');
    });

    it('複数エージェントを協調実行できる', async () => {
      const agent1 = new TestAgent('agent1', {
        name: 'agent1',
        description: 'First agent',
        version: '1.0.0',
        supportedActions: ['test'],
        requiredPermissions: []
      }, mockDb);

      const agent2 = new TestAgent('agent2', {
        name: 'agent2',
        description: 'Second agent',
        version: '1.0.0',
        supportedActions: ['test'],
        requiredPermissions: []
      }, mockDb);

      orchestrator.registerAgent(agent1);
      orchestrator.registerAgent(agent2);

      const goals: AgentGoal[] = [
        {
          id: 'coord_goal1',
          type: 'process',
          description: 'Goal for agent1',
          priority: 'high',
          successCriteria: ['Agent1 completes']
        },
        {
          id: 'coord_goal2',
          type: 'process',
          description: 'Goal for agent2',
          priority: 'medium',
          successCriteria: ['Agent2 completes']
        }
      ];

      const assignments = new Map([
        ['coord_goal1', 'agent1'],
        ['coord_goal2', 'agent2']
      ]);

      const results = await orchestrator.coordinateAgents(goals, assignments);

      expect(results.size).toBe(2);
      expect(results.get('coord_goal1')).toHaveLength(2);
      expect(results.get('coord_goal2')).toHaveLength(2);
    });
  });

  describe('ComplianceAgent', () => {
    let complianceAgent: ComplianceAgent;
    const mockConfig = {
      database: {
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test'
      }
    };

    beforeEach(() => {
      complianceAgent = new ComplianceAgent(mockConfig);
      
      // データベースモックの設定
      mockDb.getAllEmployees = vi.fn().mockResolvedValue([
        {
          id: 'emp1',
          name: '山田太郎',
          department: '開発部',
          isActive: true
        }
      ]);
      
      mockDb.getTimeRecords = vi.fn().mockResolvedValue([
        {
          id: 'rec1',
          employeeId: 'emp1',
          date: new Date(),
          clockIn: new Date('2024-01-15T09:00:00'),
          clockOut: new Date('2024-01-15T22:00:00'),
          breakMinutes: 60
        }
      ]);
      
      mockDb.query = vi.fn().mockResolvedValue({ rows: [] });
    });

    it('コンプライアンスゴールを処理できる', async () => {
      const complianceGoal = {
        id: 'compliance_goal_001',
        type: 'monitor' as const,
        description: 'コンプライアンス監視',
        priority: 'high' as const,
        successCriteria: ['違反を検出して是正'],
        targetPeriod: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31')
        },
        complianceAreas: ['overtime' as const, 'breaks' as const],
        violationThreshold: 0.05,
        autoRemediate: true
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await complianceAgent.processGoal(complianceGoal);
      
      // レポート生成と配信が呼ばれたことを確認
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending compliance report')
      );
      
      consoleSpy.mockRestore();
    });

    it('緊急違反を即座に処理する', async () => {
      // 緊急違反のモックデータ
      mockDb.query = vi.fn().mockResolvedValueOnce({
        rows: [{
          id: 'violation1',
          type: 'overtime_excess',
          severity: 'critical',
          employeeId: 'emp1',
          detected_at: new Date(),
          resolved: false
        }]
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // プライベートメソッドを直接テストはできないので、
      // publicメソッド経由で間接的にテスト
      const goal = {
        id: 'emergency_goal',
        type: 'monitor' as const,
        description: '緊急対応',
        priority: 'critical' as const,
        successCriteria: ['緊急違反対応'],
        targetPeriod: {
          start: new Date(),
          end: new Date()
        },
        complianceAreas: ['all' as const],
        violationThreshold: 0,
        autoRemediate: true
      };

      await complianceAgent.processGoal(goal);
      
      consoleSpy.mockRestore();
    });
  });

  describe('AgentMCPServer', () => {
    let mcpServer: AgentMCPServer;

    beforeEach(() => {
      mcpServer = new AgentMCPServer(mockDb);
    });

    it('MCPサーバーを初期化できる', () => {
      expect(mcpServer).toBeDefined();
      // サーバーの初期化確認
    });

    // MCPサーバーのテストは統合テストで詳細に実施
  });

  describe('エッジケースとパフォーマンス', () => {
    it('大量のアクションを含む計画を効率的に処理する', async () => {
      class LargeScaleAgent extends TestAgent {
        protected async createPlan(goal: AgentGoal): Promise<AgentPlan> {
          const actions: AgentAction[] = Array.from({ length: 100 }, (_, i) => ({
            id: `large_action_${i}`,
            type: 'test',
            description: `Large scale action ${i}`,
            parameters: { index: i },
            requiredCapabilities: ['test'],
            estimatedDuration: 10,
            retryable: true
          }));

          // 一部に依存関係を追加
          const dependencies = new Map<string, string[]>();
          for (let i = 1; i < 10; i++) {
            dependencies.set(actions[i].id, [actions[i - 1].id]);
          }

          return {
            goalId: goal.id,
            actions,
            dependencies,
            estimatedTotalDuration: 1000,
            parallelizable: true
          };
        }

        protected async executeAction(action: AgentAction): Promise<AgentResult> {
          // 高速実行をシミュレート
          return {
            actionId: action.id,
            status: 'success',
            output: { index: action.parameters.index },
            duration: 10,
            timestamp: new Date()
          };
        }
      }

      const largeAgent = new LargeScaleAgent('large-agent', {
        name: 'large-agent',
        description: 'Large scale agent',
        version: '1.0.0',
        supportedActions: ['test'],
        requiredPermissions: []
      }, mockDb);

      const goal: AgentGoal = {
        id: 'large_goal',
        type: 'process',
        description: 'Large scale execution',
        priority: 'medium',
        successCriteria: ['Process 100 actions efficiently']
      };

      const startTime = Date.now();
      await largeAgent.receiveGoal(goal);
      const results = await largeAgent.executePlan();
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(results.every(r => r.status === 'success')).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // 5秒以内
    });

    it('メモリリークを防ぐ', async () => {
      const agent = new TestAgent('memory-test', {
        name: 'memory-test',
        description: 'Memory leak test',
        version: '1.0.0',
        supportedActions: ['test'],
        requiredPermissions: []
      }, mockDb);

      // 複数回の実行でメモリ使用量が増加しないことを確認
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10; i++) {
        const goal: AgentGoal = {
          id: `memory_goal_${i}`,
          type: 'process',
          description: `Memory test ${i}`,
          priority: 'low',
          successCriteria: ['No memory leak']
        };

        await agent.receiveGoal(goal);
        await agent.executePlan();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // メモリ増加が妥当な範囲内であることを確認
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB以下
    });

    it('同時実行制限を守る', async () => {
      let concurrentExecutions = 0;
      let maxConcurrent = 0;

      class ConcurrencyTestAgent extends TestAgent {
        protected async executeAction(action: AgentAction): Promise<AgentResult> {
          concurrentExecutions++;
          maxConcurrent = Math.max(maxConcurrent, concurrentExecutions);
          
          await new Promise(resolve => setTimeout(resolve, 50));
          
          concurrentExecutions--;
          
          return {
            actionId: action.id,
            status: 'success',
            output: {},
            duration: 50,
            timestamp: new Date()
          };
        }
      }

      const concAgent = new ConcurrencyTestAgent('conc-agent', {
        name: 'conc-agent',
        description: 'Concurrency test agent',
        version: '1.0.0',
        supportedActions: ['test'],
        requiredPermissions: []
      }, mockDb);

      const goal: AgentGoal = {
        id: 'conc_goal',
        type: 'process',
        description: 'Concurrency test',
        priority: 'medium',
        successCriteria: ['Test concurrency limits']
      };

      await concAgent.receiveGoal(goal);
      await concAgent.executePlan();

      // 同時実行数が妥当な範囲内であることを確認
      expect(maxConcurrent).toBeLessThanOrEqual(10);
    });
  });
});