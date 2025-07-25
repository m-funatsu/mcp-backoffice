/**
 * AI設定サービス
 * 自然言語の設定変更指示を解析し、実行可能なアクションに変換
 */

import { 
  ConfigurationIntent, 
  ConfigurationAction, 
  ActionResult,
  ConfigurationContext 
} from '../types';
import apiClient from './ApiClient';

export class AIConfigurationService {
  private intentPatterns: Map<string, RegExp[]>;
  private configurationContext: ConfigurationContext;

  constructor() {
    this.initializePatterns();
    this.configurationContext = this.loadContext();
  }

  /**
   * 意図解析パターンの初期化
   */
  private initializePatterns() {
    this.intentPatterns = new Map([
      ['threshold_update', [
        /(\S+)の(閾値|しきい値|threshold)を(\d+[万千億]?円?|\d+%)に/,
        /(\S+)を(\d+[万千億]?円?|\d+%)に(変更|設定)/,
        /(承認|アラート|通知).*?(\d+[万千億]?円?|\d+%)/,
      ]],
      ['feature_toggle', [
        /(\S+)を(有効|無効|オン|オフ)に/,
        /(\S+)を(有効化|無効化|活性化|非活性化)/,
        /(\S+)(機能)?を(使う|使わない|止める|停止)/,
      ]],
      ['sensitivity_adjustment', [
        /(感度|センシティビティ|敏感度)を(高く|低く|上げ|下げ)/,
        /(アラート|通知|警告).*?(増やし|減らし|多く|少なく)/,
        /(厳しく|緩く|きつく|ゆるく)して/,
      ]],
      ['schedule_update', [
        /(\S+)の(スケジュール|タイミング|頻度)を(\S+)に/,
        /(\S+)を(毎日|毎週|毎月|毎時)/,
        /(実行|処理|チェック).*?(時間|タイミング)/,
      ]],
      ['security_policy', [
        /(セキュリティ|パスワード|認証).*?(強化|変更|更新)/,
        /(2要素認証|2FA|MFA)を(有効|無効)/,
        /パスワード.*?(ポリシー|ルール|規則)/,
      ]],
      ['notification_settings', [
        /(通知|お知らせ|アラート).*?(設定|変更|調整)/,
        /(重要|緊急|全て).*?通知/,
        /通知.*?(多すぎ|少なすぎ|うるさい)/,
      ]],
    ]);
  }

  /**
   * 設定コンテキストの読み込み
   */
  private loadContext(): ConfigurationContext {
    // 実際の実装では、現在の設定状態をAPIから取得
    return {
      currentSettings: {
        expenseThreshold: 50000,
        overtimeAlertThreshold: 40,
        complianceSensitivity: 'medium',
        notificationFrequency: 'realtime',
        securityLevel: 'standard',
      },
      availableFeatures: [
        'expense_approval',
        'overtime_monitoring',
        'compliance_checking',
        'ai_agents',
        'two_factor_auth',
      ],
      userRole: 'admin',
      organizationSize: 'medium',
    };
  }

  /**
   * 自然言語の意図を解析
   */
  async analyzeIntent(input: string): Promise<ConfigurationIntent> {
    const normalizedInput = this.normalizeInput(input);
    const detectedIntents: Array<{type: string, confidence: number, params: any}> = [];

    // パターンマッチングで意図を検出
    for (const [intentType, patterns] of this.intentPatterns) {
      for (const pattern of patterns) {
        const match = normalizedInput.match(pattern);
        if (match) {
          const confidence = this.calculateConfidence(match, normalizedInput);
          const params = this.extractParameters(intentType, match);
          detectedIntents.push({ type: intentType, confidence, params });
        }
      }
    }

    // AIモデルによる補完（実際の実装では外部AIサービスを使用）
    const aiEnhancedIntent = await this.enhanceWithAI(normalizedInput, detectedIntents);

    // 最も信頼度の高い意図を選択
    const primaryIntent = this.selectPrimaryIntent(detectedIntents, aiEnhancedIntent);
    
    // アクションに変換
    const actions = this.convertToActions(primaryIntent);
    
    // リスク評価
    const riskLevel = this.assessRisk(actions);

    return {
      originalInput: input,
      normalizedInput,
      detectedIntent: primaryIntent.type,
      confidence: primaryIntent.confidence,
      parameters: primaryIntent.params,
      actions,
      riskLevel,
      suggestedAlternatives: this.generateAlternatives(primaryIntent),
    };
  }

  /**
   * 入力の正規化
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .replace(/[。、]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 信頼度の計算
   */
  private calculateConfidence(match: RegExpMatchArray, input: string): number {
    // マッチの長さと入力全体の比率
    const coverage = match[0].length / input.length;
    
    // キーワードの明確さ
    const clarity = match.filter(m => m).length / match.length;
    
    // コンテキストとの整合性
    const contextScore = this.evaluateContext(match);
    
    return (coverage * 0.3 + clarity * 0.4 + contextScore * 0.3);
  }

  /**
   * パラメータの抽出
   */
  private extractParameters(intentType: string, match: RegExpMatchArray): any {
    const params: any = {};
    
    switch (intentType) {
      case 'threshold_update':
        params.target = match[1];
        params.value = this.parseValue(match[3] || match[2]);
        break;
      case 'feature_toggle':
        params.feature = match[1];
        params.enabled = ['有効', '有効化', 'オン', '使う'].includes(match[2]);
        break;
      case 'sensitivity_adjustment':
        params.target = match[1] || 'global';
        params.direction = ['高く', '上げ', '増やし', '多く', '厳しく', 'きつく'].includes(match[2]) ? 'increase' : 'decrease';
        break;
      case 'schedule_update':
        params.target = match[1];
        params.schedule = match[3] || match[2];
        break;
    }
    
    return params;
  }

  /**
   * 値のパース
   */
  private parseValue(value: string): number | string {
    // 金額の変換
    const amountMatch = value.match(/(\d+)(万|千|億)?円?/);
    if (amountMatch) {
      let amount = parseInt(amountMatch[1]);
      if (amountMatch[2] === '万') amount *= 10000;
      if (amountMatch[2] === '千') amount *= 1000;
      if (amountMatch[2] === '億') amount *= 100000000;
      return amount;
    }
    
    // パーセンテージ
    const percentMatch = value.match(/(\d+)%/);
    if (percentMatch) {
      return parseInt(percentMatch[1]);
    }
    
    return value;
  }

  /**
   * コンテキスト評価
   */
  private evaluateContext(match: RegExpMatchArray): number {
    // 現在の設定と照らし合わせて妥当性を評価
    // 実装簡略化のため、固定値を返す
    return 0.8;
  }

  /**
   * AIによる意図の補完
   */
  private async enhanceWithAI(
    input: string, 
    detectedIntents: Array<{type: string, confidence: number, params: any}>
  ): Promise<any> {
    // 実際の実装では、外部AIサービス（GPT-4など）を使用
    // ここではモックとして、検出された意図を強化
    if (detectedIntents.length > 0) {
      detectedIntents[0].confidence = Math.min(detectedIntents[0].confidence * 1.2, 1.0);
    }
    return detectedIntents[0] || { type: 'unknown', confidence: 0.3, params: {} };
  }

  /**
   * 主要な意図の選択
   */
  private selectPrimaryIntent(
    detectedIntents: Array<{type: string, confidence: number, params: any}>,
    aiEnhancedIntent: any
  ): {type: string, confidence: number, params: any} {
    const allIntents = [...detectedIntents];
    if (aiEnhancedIntent && aiEnhancedIntent.confidence > 0.5) {
      allIntents.push(aiEnhancedIntent);
    }
    
    // 信頼度でソート
    allIntents.sort((a, b) => b.confidence - a.confidence);
    
    return allIntents[0] || { type: 'unknown', confidence: 0, params: {} };
  }

  /**
   * アクションへの変換
   */
  private convertToActions(intent: {type: string, confidence: number, params: any}): ConfigurationAction[] {
    const actions: ConfigurationAction[] = [];
    
    switch (intent.type) {
      case 'threshold_update':
        actions.push({
          id: this.generateActionId(),
          type: 'update_threshold',
          target: this.mapTargetToConfigKey(intent.params.target),
          value: intent.params.value,
          description: `${intent.params.target}の閾値を${intent.params.value}に変更`,
          validationRules: this.getValidationRules('threshold', intent.params.target),
        });
        break;
        
      case 'feature_toggle':
        actions.push({
          id: this.generateActionId(),
          type: 'toggle_feature',
          target: intent.params.feature,
          value: intent.params.enabled,
          description: `${intent.params.feature}を${intent.params.enabled ? '有効化' : '無効化'}`,
          validationRules: this.getValidationRules('feature', intent.params.feature),
        });
        break;
        
      case 'sensitivity_adjustment':
        const currentLevel = this.configurationContext.currentSettings.complianceSensitivity;
        const newLevel = this.adjustSensitivityLevel(currentLevel, intent.params.direction);
        actions.push({
          id: this.generateActionId(),
          type: 'update_policy',
          target: 'compliance_sensitivity',
          value: newLevel,
          description: `コンプライアンス感度を${newLevel}に変更`,
          validationRules: [],
        });
        break;
        
      case 'security_policy':
        actions.push({
          id: this.generateActionId(),
          type: 'update_policy',
          target: 'security_policy',
          value: { level: 'enhanced', twoFactorAuth: true },
          description: 'セキュリティポリシーを強化',
          validationRules: this.getValidationRules('security', 'policy'),
        });
        break;
    }
    
    return actions;
  }

  /**
   * ターゲット名を設定キーにマッピング
   */
  private mapTargetToConfigKey(target: string): string {
    const mappings: Record<string, string> = {
      '経費': 'expense_threshold',
      '経費申請': 'expense_threshold',
      '残業': 'overtime_alert_threshold',
      '残業時間': 'overtime_alert_threshold',
      'コンプライアンス': 'compliance_sensitivity',
      '承認': 'approval_threshold',
    };
    
    return mappings[target] || target;
  }

  /**
   * 検証ルールの取得
   */
  private getValidationRules(type: string, target: string): any[] {
    // 実装簡略化のため、基本的なルールのみ
    if (type === 'threshold') {
      return [
        { type: 'min', value: 0 },
        { type: 'max', value: 10000000 },
      ];
    }
    return [];
  }

  /**
   * 感度レベルの調整
   */
  private adjustSensitivityLevel(current: string, direction: string): string {
    const levels = ['low', 'medium', 'high', 'very_high'];
    const currentIndex = levels.indexOf(current);
    
    if (direction === 'increase') {
      return levels[Math.min(currentIndex + 1, levels.length - 1)];
    } else {
      return levels[Math.max(currentIndex - 1, 0)];
    }
  }

  /**
   * リスク評価
   */
  private assessRisk(actions: ConfigurationAction[]): 'low' | 'medium' | 'high' {
    for (const action of actions) {
      // セキュリティ関連の変更は高リスク
      if (action.target.includes('security') || action.target.includes('auth')) {
        return 'high';
      }
      
      // 大きな閾値変更は中リスク
      if (action.type === 'update_threshold' && typeof action.value === 'number') {
        const currentValue = (this.configurationContext.currentSettings as any)[action.target];
        if (currentValue && Math.abs(action.value - currentValue) / currentValue > 0.5) {
          return 'medium';
        }
      }
    }
    
    return 'low';
  }

  /**
   * 代替案の生成
   */
  private generateAlternatives(intent: any): string[] {
    const alternatives: string[] = [];
    
    if (intent.confidence < 0.7) {
      alternatives.push('もう少し具体的に指定していただけますか？');
      
      if (intent.type === 'threshold_update') {
        alternatives.push('例：「経費申請の承認しきい値を10万円に変更して」');
      }
    }
    
    return alternatives;
  }

  /**
   * アクションIDの生成
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * アクションの実行
   */
  async executeActions(actions: ConfigurationAction[]): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    
    for (const action of actions) {
      try {
        // 検証
        const validationResult = await this.validateAction(action);
        if (!validationResult.valid) {
          results.push({
            action,
            success: false,
            error: validationResult.error,
            timestamp: new Date(),
          });
          continue;
        }
        
        // 実行（実際の実装ではAPIを呼び出す）
        const response = await apiClient.executeConfigurationAction(action);
        
        results.push({
          action,
          success: true,
          result: response.data,
          timestamp: new Date(),
        });
        
        // コンテキストを更新
        this.updateContext(action);
        
      } catch (error) {
        results.push({
          action,
          success: false,
          error: error instanceof Error ? error.message : '不明なエラー',
          timestamp: new Date(),
        });
      }
    }
    
    return results;
  }

  /**
   * アクションの検証
   */
  private async validateAction(action: ConfigurationAction): Promise<{valid: boolean, error?: string}> {
    // 権限チェック
    if (!this.hasPermission(action)) {
      return { valid: false, error: 'この操作を実行する権限がありません' };
    }
    
    // 値の検証
    for (const rule of action.validationRules) {
      if (rule.type === 'min' && action.value < rule.value) {
        return { valid: false, error: `値は${rule.value}以上である必要があります` };
      }
      if (rule.type === 'max' && action.value > rule.value) {
        return { valid: false, error: `値は${rule.value}以下である必要があります` };
      }
    }
    
    return { valid: true };
  }

  /**
   * 権限チェック
   */
  private hasPermission(action: ConfigurationAction): boolean {
    // 実装簡略化のため、adminロールは全権限を持つ
    return this.configurationContext.userRole === 'admin';
  }

  /**
   * コンテキストの更新
   */
  private updateContext(action: ConfigurationAction): void {
    if (action.type === 'update_threshold' || action.type === 'update_policy') {
      (this.configurationContext.currentSettings as any)[action.target] = action.value;
    }
  }
}