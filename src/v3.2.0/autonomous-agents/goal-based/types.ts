/**
 * AI-OS v3.2.0 目標ベース行動計画システム
 * 型定義
 */

// ========================================
// 目標定義
// ========================================

export interface Goal {
  id: string;
  name: string;
  description: string;
  type: GoalType;
  priority: Priority;
  status: GoalStatus;
  targetMetrics: TargetMetrics;
  constraints: Constraints;
  deadline?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type GoalType = 
  | 'cost_reduction'      // コスト削減
  | 'efficiency_improvement' // 効率改善
  | 'compliance'          // コンプライアンス達成
  | 'risk_mitigation'     // リスク軽減
  | 'growth'              // 成長・拡大
  | 'quality_improvement' // 品質向上
  | 'employee_satisfaction'; // 従業員満足度

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type GoalStatus = 
  | 'draft'      // 下書き
  | 'planning'   // 計画中
  | 'active'     // 実行中
  | 'paused'     // 一時停止
  | 'completed'  // 完了
  | 'failed';    // 失敗

export interface TargetMetrics {
  kpi: string;                    // 主要業績指標
  currentValue: number;           // 現在値
  targetValue: number;            // 目標値
  unit: string;                   // 単位
  measurementMethod: string;      // 測定方法
  evaluationCriteria: EvaluationCriteria[];
}

export interface EvaluationCriteria {
  threshold: number;
  evaluation: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface Constraints {
  budget?: number;                // 予算制約
  timeframe?: number;             // 期間制約（日数）
  resources?: ResourceConstraint[]; // リソース制約
  compliance?: string[];          // 準拠すべき規制
  restrictions?: string[];        // その他の制限事項
}

export interface ResourceConstraint {
  type: 'human' | 'system' | 'data' | 'external';
  identifier: string;
  availability: number; // 0-1の利用可能率
}

// ========================================
// 行動計画
// ========================================

export interface ActionPlan {
  id: string;
  goalId: string;
  name: string;
  description: string;
  steps: ActionStep[];
  dependencies: Dependency[];
  estimatedDuration: number; // 分
  estimatedCost: number;
  riskAssessment: RiskAssessment;
  status: ActionPlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ActionPlanStatus = 
  | 'proposed'    // 提案
  | 'approved'    // 承認済み
  | 'executing'   // 実行中
  | 'completed'   // 完了
  | 'cancelled'   // キャンセル
  | 'failed';     // 失敗

export interface ActionStep {
  id: string;
  name: string;
  description: string;
  agentId: string;              // 実行するエージェント
  action: AgentAction;          // エージェントが実行するアクション
  parameters: Record<string, any>; // アクションのパラメータ
  expectedOutcome: string;      // 期待される結果
  successCriteria: string[];    // 成功基準
  order: number;                // 実行順序
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: StepResult;
}

export type StepStatus = 
  | 'pending'
  | 'ready'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface StepResult {
  success: boolean;
  output: any;
  metrics: Record<string, number>;
  errors?: string[];
  warnings?: string[];
}

export interface AgentAction {
  type: AgentActionType;
  target: string;
  method: string;
  validation?: ValidationRule[];
}

export type AgentActionType = 
  | 'analyze'     // 分析
  | 'optimize'    // 最適化
  | 'execute'     // 実行
  | 'monitor'     // 監視
  | 'report'      // レポート
  | 'alert'       // アラート
  | 'coordinate'; // 調整

export interface ValidationRule {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: any;
  errorMessage: string;
}

export interface Dependency {
  fromStepId: string;
  toStepId: string;
  type: DependencyType;
  condition?: string; // 条件式
}

export type DependencyType = 
  | 'finish_to_start'  // 前のステップが完了してから開始
  | 'start_to_start'   // 同時に開始
  | 'finish_to_finish' // 同時に終了
  | 'conditional';     // 条件付き

export interface RiskAssessment {
  overallRisk: RiskLevel;
  risks: Risk[];
  mitigationStrategies: MitigationStrategy[];
}

export type RiskLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export interface Risk {
  id: string;
  description: string;
  probability: number; // 0-1
  impact: number;      // 0-1
  category: RiskCategory;
}

export type RiskCategory = 
  | 'technical'
  | 'operational'
  | 'compliance'
  | 'financial'
  | 'reputational';

export interface MitigationStrategy {
  riskId: string;
  strategy: string;
  fallbackPlan?: ActionPlan;
}

// ========================================
// 実行管理
// ========================================

export interface ExecutionContext {
  planId: string;
  goalId: string;
  startedAt: Date;
  environment: ExecutionEnvironment;
  variables: Record<string, any>;
  checkpoints: Checkpoint[];
  currentStepId?: string;
}

export interface ExecutionEnvironment {
  mode: 'production' | 'simulation' | 'test';
  restrictions: string[];
  availableAgents: string[];
  resourceLimits: ResourceLimits;
}

export interface ResourceLimits {
  maxExecutionTime: number;  // ミリ秒
  maxMemory: number;         // MB
  maxConcurrency: number;    // 同時実行数
  maxRetries: number;        // リトライ回数
}

export interface Checkpoint {
  stepId: string;
  timestamp: Date;
  state: Record<string, any>;
  metrics: Record<string, number>;
}

// ========================================
// 学習と最適化
// ========================================

export interface ExecutionHistory {
  planId: string;
  goalId: string;
  executedAt: Date;
  duration: number;
  cost: number;
  outcome: ExecutionOutcome;
  learnings: Learning[];
}

export interface ExecutionOutcome {
  success: boolean;
  goalAchievement: number; // 0-1
  kpiImprovement: Record<string, number>;
  sideEffects: string[];
}

export interface Learning {
  type: LearningType;
  insight: string;
  confidence: number; // 0-1
  applicability: string[];
  evidence: Evidence[];
}

export type LearningType = 
  | 'success_pattern'
  | 'failure_pattern'
  | 'optimization_opportunity'
  | 'risk_factor'
  | 'best_practice';

export interface Evidence {
  source: string;
  data: any;
  timestamp: Date;
}

// ========================================
// 意思決定
// ========================================

export interface Decision {
  id: string;
  context: DecisionContext;
  options: DecisionOption[];
  selectedOption?: string;
  reasoning: string;
  confidence: number;
  decidedAt: Date;
  decidedBy: 'human' | 'ai' | 'hybrid';
}

export interface DecisionContext {
  goalId: string;
  planId: string;
  stepId?: string;
  situation: string;
  constraints: string[];
  urgency: 'immediate' | 'high' | 'medium' | 'low';
}

export interface DecisionOption {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
  estimatedOutcome: EstimatedOutcome;
  riskScore: number;
  recommendationScore: number;
}

export interface EstimatedOutcome {
  probability: number;
  impact: string;
  timeToEffect: number; // 分
  reversibility: 'full' | 'partial' | 'none';
}

// ========================================
// エージェント間協調
// ========================================

export interface CoordinationRequest {
  id: string;
  fromAgent: string;
  toAgent: string;
  type: CoordinationType;
  payload: any;
  priority: Priority;
  deadline?: Date;
  status: CoordinationStatus;
  response?: CoordinationResponse;
}

export type CoordinationType = 
  | 'resource_request'
  | 'information_request'
  | 'task_delegation'
  | 'approval_request'
  | 'conflict_resolution'
  | 'synchronization';

export type CoordinationStatus = 
  | 'pending'
  | 'acknowledged'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'timeout';

export interface CoordinationResponse {
  success: boolean;
  message: string;
  data?: any;
  alternativeProposal?: any;
  respondedAt: Date;
}

// ========================================
// パフォーマンス分析
// ========================================

export interface GoalPerformance {
  goalId: string;
  period: PerformancePeriod;
  metrics: PerformanceMetrics;
  trends: Trend[];
  insights: PerformanceInsight[];
  recommendations: Recommendation[];
}

export interface PerformancePeriod {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface PerformanceMetrics {
  progressRate: number;           // 進捗率
  efficiencyScore: number;        // 効率スコア
  resourceUtilization: number;    // リソース利用率
  costEffectiveness: number;      // 費用対効果
  qualityScore: number;           // 品質スコア
  complianceRate: number;         // コンプライアンス率
}

export interface Trend {
  metric: string;
  direction: 'improving' | 'stable' | 'declining';
  rate: number; // 変化率
  significance: 'high' | 'medium' | 'low';
}

export interface PerformanceInsight {
  type: InsightType;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  actionRequired: boolean;
  suggestedActions?: string[];
}

export type InsightType = 
  | 'bottleneck'
  | 'opportunity'
  | 'anomaly'
  | 'milestone'
  | 'risk_emergence';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  description: string;
  expectedBenefit: string;
  implementationEffort: 'low' | 'medium' | 'high';
  priority: Priority;
  actionPlan?: ActionPlan;
}

export type RecommendationType = 
  | 'process_optimization'
  | 'resource_reallocation'
  | 'goal_adjustment'
  | 'risk_mitigation'
  | 'automation_opportunity';