/**
 * AI-OS v3.3.0 強化学習による最適化エンジン
 * エージェントの行動パターンを継続的に学習し、最適化する
 */

import { EventEmitter } from 'events';

/**
 * 強化学習の状態定義
 */
export interface RLState {
  // 環境の状態
  workload: number;           // 現在のワークロード (0-1)
  errorRate: number;          // エラー率 (0-1)
  responseTime: number;       // 平均応答時間 (ms)
  resourceUsage: {
    cpu: number;              // CPU使用率 (0-1)
    memory: number;           // メモリ使用率 (0-1)
    database: number;         // DB接続使用率 (0-1)
  };
  userSatisfaction: number;   // ユーザー満足度 (0-1)
  costEfficiency: number;     // コスト効率 (0-1)
}

/**
 * 強化学習のアクション定義
 */
export interface RLAction {
  type: 'scale' | 'optimize' | 'cache' | 'route' | 'throttle';
  parameters: Record<string, any>;
}

/**
 * 学習エピソード
 */
export interface Episode {
  id: string;
  states: RLState[];
  actions: RLAction[];
  rewards: number[];
  totalReward: number;
  timestamp: Date;
}

/**
 * Q学習のパラメータ
 */
export interface QLearningParams {
  learningRate: number;       // 学習率 (α)
  discountFactor: number;     // 割引率 (γ)
  explorationRate: number;    // 探索率 (ε)
  explorationDecay: number;   // 探索率の減衰
  minExploration: number;     // 最小探索率
}

/**
 * 強化学習最適化エンジン
 */
export class ReinforcementLearningOptimizer extends EventEmitter {
  private qTable: Map<string, Map<string, number>> = new Map();
  private episodes: Episode[] = [];
  private currentEpisode: Episode | null = null;
  private params: QLearningParams;
  private actionSpace: RLAction[] = [];
  
  constructor(params?: Partial<QLearningParams>) {
    super();
    
    this.params = {
      learningRate: params?.learningRate || 0.1,
      discountFactor: params?.discountFactor || 0.95,
      explorationRate: params?.explorationRate || 1.0,
      explorationDecay: params?.explorationDecay || 0.995,
      minExploration: params?.minExploration || 0.01,
    };
    
    this.initializeActionSpace();
  }
  
  /**
   * アクション空間の初期化
   */
  private initializeActionSpace(): void {
    this.actionSpace = [
      // スケーリングアクション
      { type: 'scale', parameters: { direction: 'up', factor: 1.2 } },
      { type: 'scale', parameters: { direction: 'down', factor: 0.8 } },
      { type: 'scale', parameters: { direction: 'maintain', factor: 1.0 } },
      
      // 最適化アクション
      { type: 'optimize', parameters: { target: 'query', level: 'aggressive' } },
      { type: 'optimize', parameters: { target: 'cache', level: 'moderate' } },
      { type: 'optimize', parameters: { target: 'index', level: 'conservative' } },
      
      // キャッシュアクション
      { type: 'cache', parameters: { strategy: 'increase', ttl: 3600 } },
      { type: 'cache', parameters: { strategy: 'decrease', ttl: 300 } },
      { type: 'cache', parameters: { strategy: 'invalidate', pattern: 'stale' } },
      
      // ルーティングアクション
      { type: 'route', parameters: { strategy: 'loadbalance', algorithm: 'roundrobin' } },
      { type: 'route', parameters: { strategy: 'priority', algorithm: 'weighted' } },
      { type: 'route', parameters: { strategy: 'failover', algorithm: 'health' } },
      
      // スロットリングアクション
      { type: 'throttle', parameters: { limit: 'increase', factor: 1.5 } },
      { type: 'throttle', parameters: { limit: 'decrease', factor: 0.7 } },
      { type: 'throttle', parameters: { limit: 'adaptive', target: 'auto' } },
    ];
  }
  
  /**
   * 状態を文字列キーに変換
   */
  private stateToKey(state: RLState): string {
    // 状態を離散化して文字列キーに変換
    const discretize = (value: number, bins: number = 10): number => {
      return Math.floor(value * bins) / bins;
    };
    
    return JSON.stringify({
      workload: discretize(state.workload),
      errorRate: discretize(state.errorRate),
      responseTime: Math.floor(state.responseTime / 100) * 100,
      cpu: discretize(state.resourceUsage.cpu),
      memory: discretize(state.resourceUsage.memory),
      satisfaction: discretize(state.userSatisfaction),
    });
  }
  
  /**
   * アクションを文字列キーに変換
   */
  private actionToKey(action: RLAction): string {
    return `${action.type}:${JSON.stringify(action.parameters)}`;
  }
  
  /**
   * Q値の取得
   */
  private getQValue(state: string, action: string): number {
    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }
    
    const stateActions = this.qTable.get(state)!;
    return stateActions.get(action) || 0;
  }
  
  /**
   * Q値の更新
   */
  private updateQValue(state: string, action: string, value: number): void {
    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }
    
    this.qTable.get(state)!.set(action, value);
  }
  
  /**
   * 最適なアクションの選択（ε-greedy方策）
   */
  public selectAction(state: RLState): RLAction {
    const stateKey = this.stateToKey(state);
    
    // 探索 vs 活用
    if (Math.random() < this.params.explorationRate) {
      // 探索: ランダムなアクションを選択
      const randomIndex = Math.floor(Math.random() * this.actionSpace.length);
      return this.actionSpace[randomIndex];
    } else {
      // 活用: 最高のQ値を持つアクションを選択
      let bestAction = this.actionSpace[0];
      let bestQValue = -Infinity;
      
      for (const action of this.actionSpace) {
        const actionKey = this.actionToKey(action);
        const qValue = this.getQValue(stateKey, actionKey);
        
        if (qValue > bestQValue) {
          bestQValue = qValue;
          bestAction = action;
        }
      }
      
      return bestAction;
    }
  }
  
  /**
   * 報酬の計算
   */
  public calculateReward(
    previousState: RLState,
    action: RLAction,
    currentState: RLState
  ): number {
    let reward = 0;
    
    // パフォーマンス改善に対する報酬
    const responseTimeImprovement = 
      (previousState.responseTime - currentState.responseTime) / previousState.responseTime;
    reward += responseTimeImprovement * 10;
    
    // エラー率減少に対する報酬
    const errorRateImprovement = previousState.errorRate - currentState.errorRate;
    reward += errorRateImprovement * 20;
    
    // リソース効率に対する報酬
    const resourceEfficiency = 1 - (
      (currentState.resourceUsage.cpu + 
       currentState.resourceUsage.memory + 
       currentState.resourceUsage.database) / 3
    );
    reward += resourceEfficiency * 5;
    
    // ユーザー満足度に対する報酬
    const satisfactionImprovement = 
      currentState.userSatisfaction - previousState.userSatisfaction;
    reward += satisfactionImprovement * 15;
    
    // コスト効率に対する報酬
    const costImprovement = currentState.costEfficiency - previousState.costEfficiency;
    reward += costImprovement * 10;
    
    // アクションのコストに対するペナルティ
    if (action.type === 'scale' && action.parameters.direction === 'up') {
      reward -= 2; // スケールアップのコスト
    }
    
    return reward;
  }
  
  /**
   * Q学習のステップ実行
   */
  public learn(
    state: RLState,
    action: RLAction,
    reward: number,
    nextState: RLState
  ): void {
    const stateKey = this.stateToKey(state);
    const actionKey = this.actionToKey(action);
    const nextStateKey = this.stateToKey(nextState);
    
    // 次の状態での最大Q値を取得
    let maxNextQValue = -Infinity;
    for (const nextAction of this.actionSpace) {
      const nextActionKey = this.actionToKey(nextAction);
      const nextQValue = this.getQValue(nextStateKey, nextActionKey);
      if (nextQValue > maxNextQValue) {
        maxNextQValue = nextQValue;
      }
    }
    
    // Q値の更新（Q学習の更新式）
    const currentQValue = this.getQValue(stateKey, actionKey);
    const newQValue = currentQValue + this.params.learningRate * (
      reward + this.params.discountFactor * maxNextQValue - currentQValue
    );
    
    this.updateQValue(stateKey, actionKey, newQValue);
    
    // 探索率の減衰
    this.params.explorationRate = Math.max(
      this.params.minExploration,
      this.params.explorationRate * this.params.explorationDecay
    );
    
    // エピソードの記録
    if (this.currentEpisode) {
      this.currentEpisode.states.push(state);
      this.currentEpisode.actions.push(action);
      this.currentEpisode.rewards.push(reward);
      this.currentEpisode.totalReward += reward;
    }
    
    this.emit('learn', {
      state,
      action,
      reward,
      nextState,
      qValue: newQValue,
      explorationRate: this.params.explorationRate,
    });
  }
  
  /**
   * 新しいエピソードの開始
   */
  public startEpisode(): void {
    this.currentEpisode = {
      id: `episode-${Date.now()}`,
      states: [],
      actions: [],
      rewards: [],
      totalReward: 0,
      timestamp: new Date(),
    };
  }
  
  /**
   * エピソードの終了
   */
  public endEpisode(): Episode | null {
    if (!this.currentEpisode) {
      return null;
    }
    
    const episode = this.currentEpisode;
    this.episodes.push(episode);
    this.currentEpisode = null;
    
    this.emit('episodeEnd', episode);
    
    // 学習の進捗をログ
    if (this.episodes.length % 10 === 0) {
      this.logProgress();
    }
    
    return episode;
  }
  
  /**
   * 学習進捗のログ出力
   */
  private logProgress(): void {
    const recentEpisodes = this.episodes.slice(-100);
    const avgReward = recentEpisodes.reduce((sum, ep) => sum + ep.totalReward, 0) / recentEpisodes.length;
    
    console.log(`
      強化学習進捗レポート:
      - 総エピソード数: ${this.episodes.length}
      - 直近100エピソードの平均報酬: ${avgReward.toFixed(2)}
      - 現在の探索率: ${(this.params.explorationRate * 100).toFixed(2)}%
      - Q表のサイズ: ${this.qTable.size} 状態
    `);
  }
  
  /**
   * 学習済みポリシーの保存
   */
  public exportPolicy(): string {
    const policy = {
      qTable: Array.from(this.qTable.entries()).map(([state, actions]) => ({
        state,
        actions: Array.from(actions.entries()),
      })),
      params: this.params,
      episodes: this.episodes.length,
      timestamp: new Date().toISOString(),
    };
    
    return JSON.stringify(policy, null, 2);
  }
  
  /**
   * 学習済みポリシーの読み込み
   */
  public importPolicy(policyJson: string): void {
    try {
      const policy = JSON.parse(policyJson);
      
      // Q表の復元
      this.qTable.clear();
      for (const { state, actions } of policy.qTable) {
        const actionMap = new Map(actions);
        this.qTable.set(state, actionMap);
      }
      
      // パラメータの復元
      this.params = { ...this.params, ...policy.params };
      
      console.log(`ポリシーを読み込みました: ${policy.episodes} エピソードの学習結果`);
    } catch (error) {
      console.error('ポリシーの読み込みに失敗しました:', error);
      throw error;
    }
  }
  
  /**
   * パフォーマンス統計の取得
   */
  public getStatistics() {
    const recentEpisodes = this.episodes.slice(-100);
    
    return {
      totalEpisodes: this.episodes.length,
      qTableSize: this.qTable.size,
      explorationRate: this.params.explorationRate,
      averageReward: recentEpisodes.length > 0
        ? recentEpisodes.reduce((sum, ep) => sum + ep.totalReward, 0) / recentEpisodes.length
        : 0,
      bestEpisode: this.episodes.reduce((best, ep) => 
        ep.totalReward > (best?.totalReward || -Infinity) ? ep : best
      , null as Episode | null),
      convergenceMetric: this.calculateConvergence(),
    };
  }
  
  /**
   * 収束度の計算
   */
  private calculateConvergence(): number {
    if (this.episodes.length < 20) {
      return 0;
    }
    
    const recent = this.episodes.slice(-10);
    const previous = this.episodes.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, ep) => sum + ep.totalReward, 0) / recent.length;
    const previousAvg = previous.reduce((sum, ep) => sum + ep.totalReward, 0) / previous.length;
    
    // 変化率が小さいほど収束に近い
    const changeRate = Math.abs(recentAvg - previousAvg) / (Math.abs(previousAvg) + 1);
    return Math.max(0, 1 - changeRate);
  }
}

/**
 * エージェント固有の強化学習最適化
 */
export class AgentSpecificOptimizer extends ReinforcementLearningOptimizer {
  private agentType: string;
  
  constructor(agentType: string, params?: Partial<QLearningParams>) {
    super(params);
    this.agentType = agentType;
    this.customizeForAgent();
  }
  
  /**
   * エージェントタイプに応じたカスタマイズ
   */
  private customizeForAgent(): void {
    switch (this.agentType) {
      case 'payroll':
        // 給与計算エージェント向けの最適化
        this.params.learningRate = 0.05; // より慎重な学習
        this.params.discountFactor = 0.99; // 長期的な最適化を重視
        break;
        
      case 'compliance':
        // コンプライアンスエージェント向けの最適化
        this.params.learningRate = 0.02; // 非常に慎重
        this.params.minExploration = 0.001; // 探索を最小限に
        break;
        
      case 'expense':
        // 経費処理エージェント向けの最適化
        this.params.learningRate = 0.1; // 標準的な学習率
        this.params.explorationDecay = 0.99; // ゆっくりと探索を減少
        break;
        
      default:
        // デフォルト設定を使用
        break;
    }
  }
  
  /**
   * エージェント固有の報酬計算
   */
  public calculateReward(
    previousState: RLState,
    action: RLAction,
    currentState: RLState
  ): number {
    let baseReward = super.calculateReward(previousState, action, currentState);
    
    // エージェント固有の報酬調整
    switch (this.agentType) {
      case 'payroll':
        // 正確性を最重視
        if (currentState.errorRate > 0.001) {
          baseReward -= 50; // エラーに対する大きなペナルティ
        }
        break;
        
      case 'compliance':
        // コンプライアンス違反に対する厳しいペナルティ
        if (currentState.errorRate > 0) {
          baseReward -= 100;
        }
        break;
        
      case 'expense':
        // 処理速度とコストのバランス
        const speedBonus = previousState.responseTime > 1000 && currentState.responseTime < 500 ? 10 : 0;
        baseReward += speedBonus;
        break;
    }
    
    return baseReward;
  }
}