/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * 型定義
 */

// ========================================
// 1. 役割と権限管理 (RBAC)
// ========================================

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  systemRole: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  resource: ResourceType;
  action: ActionType;
  scope: ScopeType;
  description?: string;
  createdAt: Date;
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
  conditions?: PermissionConditions;
  createdAt: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  departmentId?: string;
  effectiveFrom: Date;
  effectiveUntil?: Date;
  assignedBy: string;
  createdAt: Date;
}

// 権限関連の型
export type ResourceType = 
  | 'employee' 
  | 'payroll' 
  | 'expense' 
  | 'attendance' 
  | 'leave' 
  | 'analytics'
  | 'agent_config'
  | 'integration'
  | 'system_settings';

export type ActionType = 
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete' 
  | 'approve' 
  | 'execute'
  | 'configure';

export type ScopeType = 
  | 'own'        // 自分のデータのみ
  | 'department' // 部門内のデータ
  | 'company';   // 全社データ

export interface PermissionConditions {
  maxAmount?: number;         // 金額上限
  timeRestriction?: {         // 時間帯制限
    startTime: string;
    endTime: string;
    timezone: string;
  };
  departmentIds?: string[];   // 特定部門限定
  dataCategories?: string[];  // データカテゴリ制限
}

// ========================================
// 2. AIエージェント設定管理
// ========================================

export interface AIAgent {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  agentType: AgentType;
  version: string;
  capabilities: AgentCapabilities;
  defaultConfig: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentType = 
  | 'payroll' 
  | 'compliance' 
  | 'expense' 
  | 'analytics'
  | 'talent'
  | 'integration';

export interface AgentCapabilities {
  autoExecution: boolean;
  manualTrigger: boolean;
  scheduledRun: boolean;
  realTimeProcessing: boolean;
  batchProcessing: boolean;
  aiDecisionMaking: boolean;
  humanApprovalRequired: boolean;
}

export interface AgentConfiguration {
  id: string;
  agentId: string;
  companyId: string;
  departmentId?: string;
  enabled: boolean;
  config: AgentSpecificConfig;
  sensitivitySettings: SensitivitySettings;
  notificationSettings: NotificationSettings;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentSpecificConfig {
  // 給与計算エージェント
  payroll?: {
    calculationDay: number;
    paymentDay: number;
    overtimeThreshold: number;
    includeAllowances: boolean;
    deductionRules: Record<string, any>;
  };
  
  // コンプライアンスエージェント
  compliance?: {
    monitoringInterval: number; // 秒
    alertThreshold: 'info' | 'warning' | 'critical';
    autoReporting: boolean;
    reportRecipients: string[];
    complianceRules: ComplianceRule[];
  };
  
  // 経費エージェント
  expense?: {
    autoApproveLimit: number;
    ocrConfidenceThreshold: number;
    fraudDetectionSensitivity: 'low' | 'medium' | 'high';
    approvalWorkflow: ApprovalWorkflow[];
  };
}

export interface SensitivitySettings {
  alertSensitivity: 'low' | 'medium' | 'high';
  anomalyDetectionThreshold: number;
  falsePositiveTolerance: number;
}

export interface NotificationSettings {
  channels: NotificationChannel[];
  recipients: NotificationRecipient[];
  schedule: NotificationSchedule;
  priority: NotificationPriority;
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'teams' | 'webhook';
  config: Record<string, any>;
  enabled: boolean;
}

export interface NotificationRecipient {
  type: 'user' | 'role' | 'email';
  value: string;
  conditions?: Record<string, any>;
}

export interface NotificationSchedule {
  immediate: boolean;
  batched: boolean;
  batchInterval?: number; // 分
  quietHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ComplianceRule {
  id: string;
  name: string;
  type: string;
  conditions: Record<string, any>;
  actions: string[];
}

export interface ApprovalWorkflow {
  threshold: number;
  approvers: string[];
  escalation: boolean;
  timeoutHours: number;
}

// ========================================
// 3. インテグレーション管理
// ========================================

export interface Integration {
  id: string;
  serviceName: IntegrationService;
  serviceType: IntegrationType;
  displayName: string;
  description?: string;
  authType: AuthType;
  configSchema: ConfigSchema;
  capabilities: IntegrationCapabilities;
  createdAt: Date;
  updatedAt: Date;
}

export type IntegrationService = 
  | 'freee'
  | 'moneyforward'
  | 'yayoi'
  | 'slack'
  | 'teams'
  | 'jira'
  | 'asana';

export type IntegrationType = 
  | 'accounting'
  | 'communication'
  | 'project_management'
  | 'hr_system'
  | 'analytics';

export type AuthType = 
  | 'oauth2'
  | 'api_key'
  | 'basic'
  | 'custom';

export interface ConfigSchema {
  required: string[];
  properties: Record<string, any>;
}

export interface IntegrationCapabilities {
  dataSync: boolean;
  realTimeUpdates: boolean;
  webhooks: boolean;
  bulkOperations: boolean;
  customFields: boolean;
}

export interface IntegrationConfig {
  id: string;
  integrationId: string;
  companyId: string;
  enabled: boolean;
  authCredentials: EncryptedData;
  config: Record<string, any>;
  syncSettings: SyncSettings;
  lastSyncAt?: Date;
  syncStatus: SyncStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EncryptedData {
  encrypted: string;
  algorithm: string;
  keyId: string;
}

export interface SyncSettings {
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
  syncDirection: 'push' | 'pull' | 'bidirectional';
  dataTypes: string[];
  filters?: Record<string, any>;
  mappings?: DataMapping[];
}

export interface DataMapping {
  source: string;
  target: string;
  transform?: string;
}

export type SyncStatus = 
  | 'active'
  | 'syncing'
  | 'error'
  | 'paused'
  | 'disabled';

// ========================================
// 4. 監査ログ
// ========================================

export interface AuditLog {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  changes: AuditChanges;
  userId: string;
  userIp?: string;
  userAgent?: string;
  sessionId?: string;
  reason?: string;
  createdAt: Date;
}

export type AuditEntityType = 
  | 'role'
  | 'permission'
  | 'user_role'
  | 'agent_config'
  | 'integration'
  | 'data_policy';

export type AuditAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'enable'
  | 'disable'
  | 'execute';

export interface AuditChanges {
  before?: Record<string, any>;
  after?: Record<string, any>;
  deleted?: Record<string, any>;
}

// ========================================
// 5. データガバナンス
// ========================================

export interface DataRetentionPolicy {
  id: string;
  companyId: string;
  dataType: DataType;
  retentionDays: number;
  deletionStrategy: DeletionStrategy;
  legalBasis?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DataType = 
  | 'employee_data'
  | 'time_records'
  | 'payroll'
  | 'expenses'
  | 'performance'
  | 'audit_logs';

export type DeletionStrategy = 
  | 'hard_delete'
  | 'soft_delete'
  | 'anonymize'
  | 'archive';

export interface DataAccessControl {
  id: string;
  companyId: string;
  dataCategory: DataCategory;
  accessRules: AccessRule[];
  encryptionRequired: boolean;
  auditRequired: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export type DataCategory = 
  | 'personal_info'
  | 'salary'
  | 'performance'
  | 'health'
  | 'disciplinary';

export interface AccessRule {
  roleId: string;
  permissions: string[];
  conditions?: Record<string, any>;
  requiresApproval: boolean;
  approvers?: string[];
}

// ========================================
// 6. API レスポンス型
// ========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
}

// ========================================
// 7. UI状態管理型
// ========================================

export interface ConsoleState {
  user: AuthenticatedUser;
  permissions: UserPermission[];
  agents: AgentState[];
  integrations: IntegrationState[];
  notifications: Notification[];
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  currentRole: Role;
  preferences: UserPreferences;
}

export interface UserPermission {
  resource: ResourceType;
  actions: ActionType[];
  scope: ScopeType;
  conditions?: PermissionConditions;
}

export interface AgentState {
  agent: AIAgent;
  config?: AgentConfiguration;
  status: 'running' | 'stopped' | 'error' | 'configuring';
  lastExecution?: Date;
  metrics?: AgentMetrics;
}

export interface IntegrationState {
  integration: Integration;
  config?: IntegrationConfig;
  connectionStatus: 'connected' | 'disconnected' | 'error' | 'authenticating';
  lastSync?: Date;
  syncProgress?: number;
}

export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionRequired: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: string;
  params?: Record<string, any>;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: 'ja' | 'en';
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
  };
}

export interface AgentMetrics {
  executionCount: number;
  successRate: number;
  averageExecutionTime: number;
  lastError?: string;
  resourceUsage: {
    cpu: number;
    memory: number;
  };
}