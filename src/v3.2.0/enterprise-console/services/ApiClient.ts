/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * APIクライアントサービス
 */

export interface ApiConfig {
  baseURL: string;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: ApiConfig) {
    this.baseURL = config.baseURL || 'http://localhost:3001/api/v3.2.0';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * 認証トークンを設定
   */
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * 認証トークンを削除
   */
  clearAuthToken(): void {
    delete this.defaultHeaders['Authorization'];
  }

  /**
   * HTTPリクエストを実行
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        method,
        headers: this.defaultHeaders,
        body: data ? JSON.stringify(data) : undefined,
        ...options,
      });

      const responseData = await response.json();

      if (!response.ok) {
        return {
          error: responseData.error || 'リクエストエラーが発生しました',
          message: responseData.message,
        };
      }

      return {
        data: responseData,
      };
    } catch (error) {
      console.error('API Request Error:', error);
      return {
        error: 'ネットワークエラーが発生しました',
      };
    }
  }

  /**
   * GETリクエスト
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      url += `?${queryString}`;
    }
    return this.request<T>('GET', url);
  }

  /**
   * POSTリクエスト
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, data);
  }

  /**
   * PUTリクエスト
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, data);
  }

  /**
   * DELETEリクエスト
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint);
  }

  // ========================================
  // コンソール状態API
  // ========================================

  /**
   * コンソール状態を取得
   */
  async getConsoleState() {
    return this.get('/console/state');
  }

  // ========================================
  // RBAC API
  // ========================================

  /**
   * 役割一覧を取得
   */
  async getRoles() {
    return this.get('/roles');
  }

  /**
   * 役割を作成
   */
  async createRole(role: any) {
    return this.post('/roles', role);
  }

  /**
   * 役割を更新
   */
  async updateRole(roleId: string, updates: any) {
    return this.put(`/roles/${roleId}`, updates);
  }

  /**
   * 役割を削除
   */
  async deleteRole(roleId: string) {
    return this.delete(`/roles/${roleId}`);
  }

  /**
   * ユーザーに役割を割り当て
   */
  async assignRoleToUser(userId: string, roleData: any) {
    return this.post(`/users/${userId}/roles`, roleData);
  }

  /**
   * 権限一覧を取得
   */
  async getPermissions() {
    return this.get('/permissions');
  }

  // ========================================
  // 監査ログAPI
  // ========================================

  /**
   * 監査ログを検索
   */
  async searchAuditLogs(filters: any) {
    return this.get('/audit-logs', filters);
  }

  /**
   * 監査ログの異常を検知
   */
  async checkAuditAnomalies() {
    return this.get('/audit-logs/anomalies');
  }

  // ========================================
  // AIエージェントAPI
  // ========================================

  /**
   * エージェントの有効/無効を切り替え
   */
  async toggleAgent(agentId: string, enabled: boolean) {
    return this.post(`/agents/${agentId}/toggle`, { enabled });
  }

  /**
   * エージェントの設定を更新
   */
  async updateAgentConfig(agentId: string, config: any) {
    return this.put(`/agents/${agentId}/config`, config);
  }

  /**
   * エージェントを手動実行
   */
  async executeAgent(agentId: string) {
    return this.post(`/agents/${agentId}/execute`);
  }

  // ========================================
  // 目標ベース計画API
  // ========================================

  /**
   * 目標を作成
   */
  async createGoal(goal: any) {
    return this.post('/goals', goal);
  }

  /**
   * 行動計画を生成
   */
  async generateActionPlan(goalId: string, params: any) {
    return this.post(`/goals/${goalId}/plan`, params);
  }

  /**
   * 計画を実行
   */
  async executePlan(planId: string) {
    return this.post(`/plans/${planId}/execute`);
  }

  // ========================================
  // シミュレーションAPI
  // ========================================

  /**
   * シナリオを作成
   */
  async createScenario(scenario: any) {
    return this.post('/simulations/scenarios', scenario);
  }

  /**
   * シミュレーションを実行
   */
  async runSimulation(scenarioId: string) {
    return this.post(`/simulations/scenarios/${scenarioId}/run`);
  }

  /**
   * ROI最適化
   */
  async optimizeROI(params: any) {
    return this.post('/simulations/optimize-roi', params);
  }

  // ========================================
  // 統合API
  // ========================================

  /**
   * レガシーシステムを登録
   */
  async registerLegacySystem(system: any) {
    return this.post('/integrations/systems', system);
  }

  /**
   * ワークフローを定義
   */
  async defineWorkflow(workflow: any) {
    return this.post('/integrations/workflows', workflow);
  }

  /**
   * ワークフローを実行
   */
  async executeWorkflow(workflowId: string, params: any) {
    return this.post(`/integrations/workflows/${workflowId}/execute`, params);
  }

  /**
   * 組織最適化レポートを取得
   */
  async getOrganizationOptimization() {
    return this.get('/integrations/optimization');
  }

  // ========================================
  // AI設定API
  // ========================================

  /**
   * 設定アクションを実行
   */
  async executeConfigurationAction(action: any) {
    return this.post('/configuration/execute', action);
  }

  /**
   * 設定履歴を取得
   */
  async getConfigurationHistory(params?: any) {
    return this.get('/configuration/history', params);
  }
}

// デフォルトのAPIクライアントインスタンス
const apiClient = new ApiClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v3.2.0',
});

export default apiClient;