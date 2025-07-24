/**
 * AI-OS v3.2.0 APIエンドポイント
 * エンタープライズコンソール、自律エージェント、統合機能のREST API
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { RBACService } from '../../enterprise-console/services/RBACService';
import { AuditLogService } from '../../enterprise-console/services/AuditLogService';
import { GoalBasedPlanningEngine } from '../../autonomous-agents/goal-based/GoalBasedPlanningEngine';
import { MultiAgentNegotiationSystem } from '../../autonomous-agents/multi-agent/MultiAgentNegotiationSystem';
import { ManagementSimulationAgent } from '../../autonomous-agents/simulation/ManagementSimulationAgent';
import { EnterpriseIntegrationService } from '../../enterprise-integration/EnterpriseIntegrationService';

const router = Router();

// サービスインスタンス
let db: Pool;
let rbacService: RBACService;
let auditLogService: AuditLogService;
let planningEngine: GoalBasedPlanningEngine;
let negotiationSystem: MultiAgentNegotiationSystem;
let simulationAgent: ManagementSimulationAgent;
let integrationService: EnterpriseIntegrationService;

// 初期化
export function initializeV3_2_0_API(database: Pool) {
  db = database;
  rbacService = new RBACService(db);
  auditLogService = new AuditLogService(db);
  planningEngine = new GoalBasedPlanningEngine();
  negotiationSystem = new MultiAgentNegotiationSystem();
  simulationAgent = new ManagementSimulationAgent();
  integrationService = new EnterpriseIntegrationService();
}

// ========================================
// 認証・認可ミドルウェア
// ========================================

async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // JWTトークンの検証（実装は省略）
  const userId = 'user123'; // トークンから取得
  req.user = { id: userId };
  next();
}

async function authorize(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const hasPermission = await rbacService.checkPermission(
      req.user.id,
      resource as any,
      action as any,
      req.body
    );
    
    if (!hasPermission) {
      await auditLogService.log({
        entityType: 'permission',
        entityId: `${resource}:${action}`,
        action: 'denied',
        changes: { attempted: true },
        userId: req.user.id,
        userIp: req.ip,
        userAgent: req.headers['user-agent'],
      });
      
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    next();
  };
}

// ========================================
// エンタープライズコンソール API
// ========================================

// コンソール状態を取得
router.get('/console/state', authenticate, async (req, res) => {
  try {
    const user = await db.query('SELECT * FROM employees WHERE id = $1', [req.user.id]);
    const permissions = await rbacService.getUserPermissions(req.user.id);
    
    // その他の状態情報を取得
    const state = {
      user: user.rows[0],
      permissions,
      agents: [], // エージェント状態
      integrations: [], // 統合状態
      notifications: [], // 通知
    };
    
    res.json(state);
  } catch (error) {
    console.error('Error fetching console state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 役割管理
router.post('/roles', authenticate, authorize('system_settings', 'create'), async (req, res) => {
  try {
    const role = await rbacService.createRole(req.body);
    
    await auditLogService.log({
      entityType: 'role',
      entityId: role.id,
      action: 'create',
      changes: { after: role },
      userId: req.user.id,
      userIp: req.ip,
    });
    
    res.status(201).json(role);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/roles/:id', authenticate, authorize('system_settings', 'update'), async (req, res) => {
  try {
    const oldRole = await db.query('SELECT * FROM roles WHERE id = $1', [req.params.id]);
    const updatedRole = await rbacService.updateRole(req.params.id, req.body);
    
    await auditLogService.log({
      entityType: 'role',
      entityId: req.params.id,
      action: 'update',
      changes: {
        before: oldRole.rows[0],
        after: updatedRole,
      },
      userId: req.user.id,
      userIp: req.ip,
    });
    
    res.json(updatedRole);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ユーザー役割割り当て
router.post('/users/:userId/roles', authenticate, authorize('system_settings', 'update'), async (req, res) => {
  try {
    const { roleId, departmentId, effectiveFrom, effectiveUntil } = req.body;
    
    const userRole = await rbacService.assignRoleToUser(
      req.params.userId,
      roleId,
      req.user.id,
      { departmentId, effectiveFrom, effectiveUntil }
    );
    
    await auditLogService.log({
      entityType: 'user_role',
      entityId: `${req.params.userId}:${roleId}`,
      action: 'create',
      changes: { after: userRole },
      userId: req.user.id,
      userIp: req.ip,
    });
    
    res.status(201).json(userRole);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 監査ログ検索
router.get('/audit-logs', authenticate, authorize('system_settings', 'read'), async (req, res) => {
  try {
    const filters = {
      entityType: req.query.entityType as any,
      entityId: req.query.entityId as string,
      userId: req.query.userId as string,
      action: req.query.action as any,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    };
    
    const result = await auditLogService.search(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 監査ログの異常検知
router.get('/audit-logs/anomalies', authenticate, authorize('system_settings', 'read'), async (req, res) => {
  try {
    const anomalies = await auditLogService.checkForAnomalies();
    res.json(anomalies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// AIエージェント設定 API
// ========================================

router.post('/agents/:id/toggle', authenticate, authorize('agent_config', 'update'), async (req, res) => {
  try {
    const { enabled } = req.body;
    
    // エージェント設定を更新（実装は省略）
    const result = { agentId: req.params.id, enabled };
    
    await auditLogService.log({
      entityType: 'agent_config',
      entityId: req.params.id,
      action: enabled ? 'enable' : 'disable',
      changes: { enabled },
      userId: req.user.id,
      userIp: req.ip,
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/agents/:id/config', authenticate, authorize('agent_config', 'update'), async (req, res) => {
  try {
    // エージェント設定を更新（実装は省略）
    const config = req.body;
    
    await auditLogService.log({
      entityType: 'agent_config',
      entityId: req.params.id,
      action: 'update',
      changes: { after: config },
      userId: req.user.id,
      userIp: req.ip,
    });
    
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/agents/:id/execute', authenticate, authorize('agent_config', 'execute'), async (req, res) => {
  try {
    // エージェントを手動実行（実装は省略）
    const executionId = `exec_${Date.now()}`;
    
    await auditLogService.log({
      entityType: 'agent_config',
      entityId: req.params.id,
      action: 'execute',
      changes: { executionId },
      userId: req.user.id,
      userIp: req.ip,
    });
    
    res.json({ success: true, executionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 目標ベース行動計画 API
// ========================================

router.post('/goals', authenticate, authorize('analytics', 'create'), async (req, res) => {
  try {
    const goal = await planningEngine.setGoal(req.body);
    
    await auditLogService.log({
      entityType: 'goal',
      entityId: goal.id,
      action: 'create',
      changes: { after: goal },
      userId: req.user.id,
      userIp: req.ip,
    });
    
    res.status(201).json(goal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/goals/:id/plan', authenticate, authorize('analytics', 'execute'), async (req, res) => {
  try {
    const plan = await planningEngine.generateActionPlan({
      id: req.params.id,
      ...req.body,
    } as any);
    
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/plans/:id/execute', authenticate, authorize('analytics', 'execute'), async (req, res) => {
  try {
    const outcome = await planningEngine.executePlan(req.params.id);
    res.json(outcome);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// マルチエージェント交渉 API
// ========================================

router.post('/negotiations', authenticate, async (req, res) => {
  try {
    const request = {
      ...req.body,
      fromAgent: req.user.id, // ユーザーをエージェントとして扱う
    };
    
    const response = await negotiationSystem.initiateNegotiation(request);
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// 経営シミュレーション API
// ========================================

router.post('/simulations/scenarios', authenticate, authorize('analytics', 'create'), async (req, res) => {
  try {
    const scenario = await simulationAgent.createScenario(req.body);
    res.status(201).json(scenario);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/simulations/scenarios/:id/run', authenticate, authorize('analytics', 'execute'), async (req, res) => {
  try {
    const result = await simulationAgent.runSimulation(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/simulations/optimize-roi', authenticate, authorize('analytics', 'execute'), async (req, res) => {
  try {
    const { budget, objectives, constraints } = req.body;
    const result = await simulationAgent.optimizeROI(budget, objectives, constraints);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// エンタープライズ統合 API
// ========================================

router.post('/integrations/systems', authenticate, authorize('integration', 'create'), async (req, res) => {
  try {
    await integrationService.registerLegacySystem(req.body);
    
    await auditLogService.log({
      entityType: 'integration',
      entityId: req.body.id,
      action: 'create',
      changes: { after: req.body },
      userId: req.user.id,
      userIp: req.ip,
    });
    
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/integrations/workflows', authenticate, authorize('integration', 'create'), async (req, res) => {
  try {
    await integrationService.defineWorkflow(req.body);
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/integrations/workflows/:id/execute', authenticate, authorize('integration', 'execute'), async (req, res) => {
  try {
    const result = await integrationService.executeWorkflow(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/integrations/optimization', authenticate, authorize('integration', 'read'), async (req, res) => {
  try {
    const report = await integrationService.analyzeOrganizationalOptimization();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================================
// WebSocket対応（リアルタイム通信）
// ========================================

export function setupWebSocketHandlers(io: any) {
  io.on('connection', (socket: any) => {
    console.log('WebSocket client connected');
    
    // エージェント状態の監視
    socket.on('subscribe:agent-status', (agentId: string) => {
      socket.join(`agent:${agentId}`);
    });
    
    // ワークフロー実行の監視
    socket.on('subscribe:workflow-execution', (executionId: string) => {
      socket.join(`execution:${executionId}`);
    });
    
    // 異常検知アラート
    socket.on('subscribe:anomalies', () => {
      socket.join('anomalies');
    });
    
    socket.on('disconnect', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // 定期的な異常チェック
  setInterval(async () => {
    try {
      const anomalies = await auditLogService.checkForAnomalies();
      if (anomalies.length > 0) {
        io.to('anomalies').emit('anomaly-detected', anomalies);
      }
    } catch (error) {
      console.error('Error checking anomalies:', error);
    }
  }, 60000); // 1分ごと
}

// ========================================
// エラーハンドリング
// ========================================

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', error);
  
  // エラーログを記録
  if (req.user) {
    auditLogService.log({
      entityType: 'api_error',
      entityId: req.path,
      action: 'error',
      changes: {
        error: error.message,
        stack: error.stack,
      },
      userId: req.user.id,
      userIp: req.ip,
    }).catch(console.error);
  }
  
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    code: error.code,
  });
});

export default router;

// TypeScriptの型拡張
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        [key: string]: any;
      };
    }
  }
}