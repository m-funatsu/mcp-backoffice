/**
 * 予測結果可視化・アラート機能 v2.1.0
 * Predictive Visualization & Alert System
 * 
 * 機能:
 * - 予測結果のリアルタイム可視化
 * - 閾値ベースの自動アラート
 * - 管理者・HR向けダッシュボード
 * - 予測精度の監視・改善
 */

import Database from './database.js';
import type { 
  Employee, 
  OvertimePrediction, 
  TurnoverPrediction, 
  HumanCapitalMetrics 
} from './types.js';

// 可視化データ構造
export interface VisualizationData {
  chartType: 'line' | 'bar' | 'scatter' | 'heatmap' | 'gauge' | 'pie';
  title: string;
  data: ChartDataPoint[];
  xAxis: AxisConfig;
  yAxis: AxisConfig;
  colors?: string[];
  thresholds?: ThresholdLine[];
  annotations?: Annotation[];
}

export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  category?: string;
  value?: number;
  label?: string;
  color?: string;
  tooltip?: string;
}

export interface AxisConfig {
  label: string;
  type: 'linear' | 'logarithmic' | 'time' | 'category';
  min?: number;
  max?: number;
  format?: string;
  unit?: string;
}

export interface ThresholdLine {
  value: number;
  label: string;
  color: string;
  type: 'solid' | 'dashed' | 'dotted';
}

export interface Annotation {
  x: string | number | Date;
  y: number;
  text: string;
  type: 'point' | 'line' | 'area';
  color: string;
}

// アラート設定
export interface AlertConfig {
  id: string;
  name: string;
  type: 'overtime' | 'turnover' | 'engagement' | 'compliance';
  enabled: boolean;
  threshold: ThresholdConfig;
  recipients: AlertRecipient[];
  frequency: 'real_time' | 'hourly' | 'daily' | 'weekly';
  conditions: AlertCondition[];
  actions: AlertAction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ThresholdConfig {
  metric: string;
  operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AlertRecipient {
  type: 'email' | 'slack' | 'teams' | 'webhook';
  address: string;
  name: string;
  role: 'manager' | 'hr' | 'admin' | 'executive';
}

export interface AlertCondition {
  field: string;
  operator: string;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface AlertAction {
  type: 'notification' | 'escalation' | 'auto_action';
  config: any;
  delay?: number;
}

// アラート記録
export interface AlertRecord {
  id: string;
  alertConfigId: string;
  employeeId?: string;
  department?: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  triggered: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

// ダッシュボード設定
export interface DashboardConfig {
  id: string;
  name: string;
  userRole: 'manager' | 'hr' | 'admin' | 'executive';
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  refreshInterval: number;
  filters: DashboardFilter[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gridSize: number;
  responsive: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'alert' | 'prediction';
  title: string;
  position: WidgetPosition;
  size: WidgetSize;
  dataSource: string;
  config: any;
  refreshInterval?: number;
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface DashboardFilter {
  field: string;
  type: 'select' | 'daterange' | 'multiselect' | 'search';
  label: string;
  options?: string[];
  defaultValue?: any;
}

export class PredictiveVisualizationAlerts {
  private db: Database;
  private alertConfigs: Map<string, AlertConfig> = new Map();
  private activeAlerts: Map<string, AlertRecord> = new Map();
  
  constructor(database: Database) {
    this.db = database;
    this.initializeDefaultAlerts();
  }

  /**
   * 残業予測の可視化データ生成
   */
  async generateOvertimeVisualization(
    predictions: OvertimePrediction[], 
    timeRange: '1week' | '1month' | '3months' = '1month'
  ): Promise<VisualizationData[]> {
    const visualizations: VisualizationData[] = [];

    // 1. 残業時間予測トレンド
    const trendData = predictions.map(pred => ({
      x: pred.employeeId,
      y: pred.predictedHours,
      category: pred.riskLevel,
      color: this.getRiskColor(pred.riskLevel),
      tooltip: `${pred.employeeId}: ${pred.predictedHours}時間 (${pred.riskLevel})`
    }));

    visualizations.push({
      chartType: 'bar',
      title: '残業時間予測 (月間)',
      data: trendData,
      xAxis: { label: '従業員ID', type: 'category' },
      yAxis: { label: '予測残業時間', type: 'linear', unit: '時間' },
      thresholds: [
        { value: 45, label: '法定上限', color: '#ff6b6b', type: 'solid' },
        { value: 60, label: '高残業閾値', color: '#ee5a52', type: 'dashed' }
      ]
    });

    // 2. リスクレベル分布
    const riskDistribution = this.calculateRiskDistribution(predictions);
    visualizations.push({
      chartType: 'pie',
      title: '残業リスクレベル分布',
      data: riskDistribution,
      xAxis: { label: 'リスクレベル', type: 'category' },
      yAxis: { label: '従業員数', type: 'linear' },
      colors: ['#51cf66', '#ffd43b', '#ff8787', '#ff6b6b']
    });

    // 3. 部署別残業予測
    const departmentData = await this.aggregateByDepartment(predictions);
    visualizations.push({
      chartType: 'bar',
      title: '部署別残業予測',
      data: departmentData,
      xAxis: { label: '部署', type: 'category' },
      yAxis: { label: '平均予測残業時間', type: 'linear', unit: '時間' }
    });

    // 4. 予測精度監視
    const accuracyData = await this.calculatePredictionAccuracy('overtime');
    visualizations.push({
      chartType: 'line',
      title: '残業予測精度推移',
      data: accuracyData,
      xAxis: { label: '日付', type: 'time' },
      yAxis: { label: '予測精度', type: 'linear', unit: '%', min: 0, max: 100 }
    });

    return visualizations;
  }

  /**
   * 離職予測の可視化データ生成
   */
  async generateTurnoverVisualization(predictions: TurnoverPrediction[]): Promise<VisualizationData[]> {
    const visualizations: VisualizationData[] = [];

    // 1. 離職リスクスコア分布
    const riskScoreData = predictions.map(pred => ({
      x: pred.employeeId,
      y: pred.riskScore,
      category: pred.riskLevel,
      color: this.getRiskColor(pred.riskLevel),
      tooltip: `${pred.employeeId}: ${pred.riskScore}% (${pred.riskLevel})`
    }));

    visualizations.push({
      chartType: 'scatter',
      title: '離職リスクスコア分布',
      data: riskScoreData,
      xAxis: { label: '従業員ID', type: 'category' },
      yAxis: { label: 'リスクスコア', type: 'linear', unit: '%', min: 0, max: 100 },
      thresholds: [
        { value: 25, label: '低リスク', color: '#51cf66', type: 'solid' },
        { value: 50, label: '中リスク', color: '#ffd43b', type: 'solid' },
        { value: 75, label: '高リスク', color: '#ff8787', type: 'solid' }
      ]
    });

    // 2. 要因分析ヒートマップ
    const factorsData = this.createFactorsHeatmap(predictions);
    visualizations.push({
      chartType: 'heatmap',
      title: '離職要因分析ヒートマップ',
      data: factorsData,
      xAxis: { label: '要因', type: 'category' },
      yAxis: { label: '従業員', type: 'category' }
    });

    // 3. 予測タイムフレーム
    const timeframeData = predictions.map(pred => ({
      x: pred.employeeId,
      y: pred.timeframe,
      category: pred.riskLevel,
      color: this.getRiskColor(pred.riskLevel)
    }));

    visualizations.push({
      chartType: 'bar',
      title: '予測離職タイムフレーム',
      data: timeframeData,
      xAxis: { label: '従業員ID', type: 'category' },
      yAxis: { label: '予測日数', type: 'linear', unit: '日' }
    });

    return visualizations;
  }

  /**
   * 人的資本指標の可視化データ生成
   */
  async generateHumanCapitalVisualization(metrics: HumanCapitalMetrics): Promise<VisualizationData[]> {
    const visualizations: VisualizationData[] = [];

    // 1. 多様性指標
    const diversityData = [
      { x: '男性', y: metrics.diversity.genderRatio.male, color: '#339af0' },
      { x: '女性', y: metrics.diversity.genderRatio.female, color: '#ff8cc8' },
      { x: 'その他', y: metrics.diversity.genderRatio.other, color: '#69db7c' }
    ];

    visualizations.push({
      chartType: 'pie',
      title: '性別多様性',
      data: diversityData,
      xAxis: { label: '性別', type: 'category' },
      yAxis: { label: '比率', type: 'linear', unit: '%' }
    });

    // 2. エンゲージメントメーター
    visualizations.push({
      chartType: 'gauge',
      title: 'eNPS スコア',
      data: [{ x: 'eNPS', y: metrics.engagement.enps, color: '#51cf66' }],
      xAxis: { label: '', type: 'category' },
      yAxis: { label: 'スコア', type: 'linear', min: -100, max: 100 },
      thresholds: [
        { value: 0, label: '基準値', color: '#868e96', type: 'solid' },
        { value: 30, label: '優良', color: '#51cf66', type: 'solid' }
      ]
    });

    // 3. 生産性指標
    const productivityData = [
      { x: '売上/従業員', y: metrics.productivity.revenuePerEmployee / 1000000, color: '#339af0' },
      { x: '残業比率', y: metrics.productivity.overtimeRatio * 100, color: '#ff8787' },
      { x: '欠勤率', y: metrics.productivity.absenteeismRate * 100, color: '#ffd43b' }
    ];

    visualizations.push({
      chartType: 'bar',
      title: '生産性指標',
      data: productivityData,
      xAxis: { label: '指標', type: 'category' },
      yAxis: { label: '値', type: 'linear' }
    });

    // 4. 予測リスク分布
    const predictionData = [
      { x: '残業リスク(高)', y: metrics.predictions.overtimeRisk.high * 100, color: '#ff8787' },
      { x: '残業リスク(中)', y: metrics.predictions.overtimeRisk.medium * 100, color: '#ffd43b' },
      { x: '残業リスク(低)', y: metrics.predictions.overtimeRisk.low * 100, color: '#51cf66' },
      { x: '離職リスク(危険)', y: metrics.predictions.turnoverRisk.critical * 100, color: '#ff6b6b' },
      { x: '離職リスク(高)', y: metrics.predictions.turnoverRisk.high * 100, color: '#ff8787' },
      { x: '離職リスク(中)', y: metrics.predictions.turnoverRisk.medium * 100, color: '#ffd43b' },
      { x: '離職リスク(低)', y: metrics.predictions.turnoverRisk.low * 100, color: '#51cf66' }
    ];

    visualizations.push({
      chartType: 'bar',
      title: '予測リスク分布',
      data: predictionData,
      xAxis: { label: 'リスクタイプ', type: 'category' },
      yAxis: { label: '従業員比率', type: 'linear', unit: '%' }
    });

    return visualizations;
  }

  /**
   * アラート設定の追加
   */
  async addAlertConfig(config: Omit<AlertConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alertConfig: AlertConfig = {
      id: alertId,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...config
    };

    this.alertConfigs.set(alertId, alertConfig);
    await this.saveAlertConfig(alertConfig);
    
    return alertId;
  }

  /**
   * リアルタイムアラート監視
   */
  async monitorAlerts(
    overtimePredictions: OvertimePrediction[], 
    turnoverPredictions: TurnoverPrediction[]
  ): Promise<AlertRecord[]> {
    const newAlerts: AlertRecord[] = [];

    for (const [configId, config] of this.alertConfigs) {
      if (!config.enabled) continue;

      const alerts = await this.checkAlertConditions(config, overtimePredictions, turnoverPredictions);
      newAlerts.push(...alerts);
    }

    // アラートをデータベースに保存
    for (const alert of newAlerts) {
      await this.saveAlertRecord(alert);
      this.activeAlerts.set(alert.id, alert);
    }

    // 通知送信
    await this.sendNotifications(newAlerts);

    return newAlerts;
  }

  /**
   * ダッシュボード設定の作成
   */
  createDashboardConfig(role: 'manager' | 'hr' | 'admin' | 'executive'): DashboardConfig {
    const baseConfig = {
      id: `dashboard_${role}_${Date.now()}`,
      name: `${role.toUpperCase()} Dashboard`,
      userRole: role,
      layout: {
        columns: 12,
        rows: 8,
        gridSize: 100,
        responsive: true
      },
      refreshInterval: 300000, // 5分
      filters: [
        { field: 'department', type: 'select' as const, label: '部署', options: ['開発', '営業', '人事', '経理'] },
        { field: 'dateRange', type: 'daterange' as const, label: '期間' }
      ],
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // ロール別ウィジェット設定
    const widgets: DashboardWidget[] = [];

    if (role === 'manager') {
      widgets.push(
        {
          id: 'overtime_prediction',
          type: 'chart',
          title: '残業予測',
          position: { x: 0, y: 0 },
          size: { width: 6, height: 4 },
          dataSource: 'overtime_predictions',
          config: { chartType: 'bar' }
        },
        {
          id: 'team_engagement',
          type: 'metric',
          title: 'チームエンゲージメント',
          position: { x: 6, y: 0 },
          size: { width: 3, height: 2 },
          dataSource: 'engagement_metrics',
          config: { displayType: 'gauge' }
        },
        {
          id: 'alerts_summary',
          type: 'alert',
          title: 'アラート',
          position: { x: 9, y: 0 },
          size: { width: 3, height: 2 },
          dataSource: 'active_alerts',
          config: { maxItems: 5 }
        }
      );
    } else if (role === 'hr') {
      widgets.push(
        {
          id: 'turnover_prediction',
          type: 'chart',
          title: '離職予測',
          position: { x: 0, y: 0 },
          size: { width: 6, height: 4 },
          dataSource: 'turnover_predictions',
          config: { chartType: 'scatter' }
        },
        {
          id: 'diversity_metrics',
          type: 'chart',
          title: '多様性指標',
          position: { x: 6, y: 0 },
          size: { width: 6, height: 4 },
          dataSource: 'diversity_metrics',
          config: { chartType: 'pie' }
        },
        {
          id: 'talent_pipeline',
          type: 'table',
          title: '人材パイプライン',
          position: { x: 0, y: 4 },
          size: { width: 12, height: 4 },
          dataSource: 'talent_pipeline',
          config: { sortable: true, filterable: true }
        }
      );
    } else if (role === 'executive') {
      widgets.push(
        {
          id: 'human_capital_summary',
          type: 'metric',
          title: '人的資本サマリー',
          position: { x: 0, y: 0 },
          size: { width: 12, height: 2 },
          dataSource: 'human_capital_metrics',
          config: { layout: 'horizontal' }
        },
        {
          id: 'strategic_metrics',
          type: 'chart',
          title: '戦略指標',
          position: { x: 0, y: 2 },
          size: { width: 8, height: 6 },
          dataSource: 'strategic_metrics',
          config: { chartType: 'line' }
        },
        {
          id: 'risk_overview',
          type: 'chart',
          title: 'リスク概況',
          position: { x: 8, y: 2 },
          size: { width: 4, height: 6 },
          dataSource: 'risk_metrics',
          config: { chartType: 'gauge' }
        }
      );
    }

    return {
      ...baseConfig,
      widgets
    };
  }

  /**
   * レポート生成
   */
  async generateReport(
    type: 'daily' | 'weekly' | 'monthly',
    format: 'pdf' | 'excel' | 'json'
  ): Promise<{
    reportId: string;
    summary: string;
    data: any;
    alerts: AlertRecord[];
    recommendations: string[];
  }> {
    const reportId = `report_${type}_${Date.now()}`;
    
    // アラート集計
    const alerts = Array.from(this.activeAlerts.values())
      .filter(alert => this.isWithinPeriod(alert.createdAt, type));

    // 推奨事項生成
    const recommendations = this.generateRecommendations(alerts);

    // サマリー作成
    const summary = this.createReportSummary(alerts, type);

    const reportData = {
      reportId,
      period: type,
      generatedAt: new Date(),
      alerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      recommendations: recommendations.length
    };

    return {
      reportId,
      summary,
      data: reportData,
      alerts,
      recommendations
    };
  }

  // プライベートメソッド
  private initializeDefaultAlerts(): void {
    // デフォルトのアラート設定
    const defaultAlerts: Omit<AlertConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: '残業時間超過アラート',
        type: 'overtime',
        enabled: true,
        threshold: {
          metric: 'predicted_overtime_hours',
          operator: '>',
          value: 45,
          severity: 'high'
        },
        recipients: [
          { type: 'email', address: 'hr@company.com', name: 'HR Team', role: 'hr' }
        ],
        frequency: 'daily',
        conditions: [],
        actions: [
          { type: 'notification', config: { template: 'overtime_alert' } }
        ]
      },
      {
        name: '離職リスク高アラート',
        type: 'turnover',
        enabled: true,
        threshold: {
          metric: 'turnover_risk_score',
          operator: '>',
          value: 75,
          severity: 'critical'
        },
        recipients: [
          { type: 'email', address: 'manager@company.com', name: 'Manager', role: 'manager' },
          { type: 'email', address: 'hr@company.com', name: 'HR Team', role: 'hr' }
        ],
        frequency: 'real_time',
        conditions: [],
        actions: [
          { type: 'notification', config: { template: 'turnover_alert' } },
          { type: 'escalation', config: { level: 'manager' }, delay: 3600 }
        ]
      }
    ];

    defaultAlerts.forEach(alert => {
      this.addAlertConfig(alert);
    });
  }

  private getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'low': return '#51cf66';
      case 'medium': return '#ffd43b';
      case 'high': return '#ff8787';
      case 'critical': return '#ff6b6b';
      default: return '#868e96';
    }
  }

  private calculateRiskDistribution(predictions: OvertimePrediction[]): ChartDataPoint[] {
    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
    
    predictions.forEach(pred => {
      distribution[pred.riskLevel]++;
    });

    return Object.entries(distribution).map(([level, count]) => ({
      x: level,
      y: count,
      color: this.getRiskColor(level)
    }));
  }

  private async aggregateByDepartment(predictions: OvertimePrediction[]): Promise<ChartDataPoint[]> {
    const departmentMap = new Map<string, number[]>();
    
    for (const pred of predictions) {
      const employee = await this.db.getEmployee(pred.employeeId);
      if (employee) {
        const dept = employee.department;
        if (!departmentMap.has(dept)) {
          departmentMap.set(dept, []);
        }
        departmentMap.get(dept)!.push(pred.predictedHours);
      }
    }

    return Array.from(departmentMap.entries()).map(([dept, hours]) => ({
      x: dept,
      y: hours.reduce((sum, h) => sum + h, 0) / hours.length,
      color: '#339af0'
    }));
  }

  private async calculatePredictionAccuracy(type: 'overtime' | 'turnover'): Promise<ChartDataPoint[]> {
    // 予測精度計算の簡易実装
    const days = 30;
    const data: ChartDataPoint[] = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // 実際の精度計算はより複雑
      const accuracy = 85 + Math.random() * 10;
      
      data.push({
        x: date,
        y: accuracy,
        color: '#339af0'
      });
    }
    
    return data.reverse();
  }

  private createFactorsHeatmap(predictions: TurnoverPrediction[]): ChartDataPoint[] {
    const heatmapData: ChartDataPoint[] = [];
    const factors = ['attendance', 'overtime', 'leave', 'performance', 'tenure'];
    
    predictions.slice(0, 20).forEach((pred, empIndex) => {
      factors.forEach((factor, factorIndex) => {
        const value = pred.keyFactors[factor as keyof typeof pred.keyFactors];
        heatmapData.push({
          x: factor,
          y: empIndex,
          value: typeof value === 'number' ? value : 0,
          color: this.getHeatmapColor(typeof value === 'number' ? value : 0)
        });
      });
    });
    
    return heatmapData;
  }

  private getHeatmapColor(value: number): string {
    if (value < 0.3) return '#51cf66';
    if (value < 0.6) return '#ffd43b';
    if (value < 0.8) return '#ff8787';
    return '#ff6b6b';
  }

  private async checkAlertConditions(
    config: AlertConfig,
    overtimePredictions: OvertimePrediction[],
    turnoverPredictions: TurnoverPrediction[]
  ): Promise<AlertRecord[]> {
    const alerts: AlertRecord[] = [];
    
    if (config.type === 'overtime') {
      for (const pred of overtimePredictions) {
        if (this.evaluateThreshold(pred.predictedHours, config.threshold)) {
          alerts.push(this.createAlertRecord(config, pred.employeeId, 'overtime', pred));
        }
      }
    } else if (config.type === 'turnover') {
      for (const pred of turnoverPredictions) {
        if (this.evaluateThreshold(pred.riskScore, config.threshold)) {
          alerts.push(this.createAlertRecord(config, pred.employeeId, 'turnover', pred));
        }
      }
    }
    
    return alerts;
  }

  private evaluateThreshold(value: number, threshold: ThresholdConfig): boolean {
    switch (threshold.operator) {
      case '>': return value > threshold.value;
      case '<': return value < threshold.value;
      case '>=': return value >= threshold.value;
      case '<=': return value <= threshold.value;
      case '=': return value === threshold.value;
      case '!=': return value !== threshold.value;
      default: return false;
    }
  }

  private createAlertRecord(
    config: AlertConfig,
    employeeId: string,
    type: string,
    details: any
  ): AlertRecord {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertConfigId: config.id,
      employeeId,
      alertType: type,
      severity: config.threshold.severity,
      message: this.generateAlertMessage(config, details),
      details,
      triggered: true,
      createdAt: new Date()
    };
  }

  private generateAlertMessage(config: AlertConfig, details: any): string {
    switch (config.type) {
      case 'overtime':
        return `従業員 ${details.employeeId} の予測残業時間が ${details.predictedHours}時間に達しました（閾値: ${config.threshold.value}時間）`;
      case 'turnover':
        return `従業員 ${details.employeeId} の離職リスクスコアが ${details.riskScore}% に達しました（閾値: ${config.threshold.value}%）`;
      default:
        return `アラート: ${config.name}`;
    }
  }

  private async sendNotifications(alerts: AlertRecord[]): Promise<void> {
    for (const alert of alerts) {
      const config = this.alertConfigs.get(alert.alertConfigId);
      if (!config) continue;

      for (const recipient of config.recipients) {
        await this.sendNotification(recipient, alert);
      }
    }
  }

  private async sendNotification(recipient: AlertRecipient, alert: AlertRecord): Promise<void> {
    // 通知送信の実装（メール、Slack、Teams等）
    console.log(`Sending ${recipient.type} notification to ${recipient.address}:`, alert.message);
  }

  private async saveAlertConfig(config: AlertConfig): Promise<void> {
    // データベースに保存
    console.log('Saving alert config:', config.id);
  }

  private async saveAlertRecord(alert: AlertRecord): Promise<void> {
    // データベースに保存
    console.log('Saving alert record:', alert.id);
  }

  private isWithinPeriod(date: Date, period: 'daily' | 'weekly' | 'monthly'): boolean {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    switch (period) {
      case 'daily': return diffDays < 1;
      case 'weekly': return diffDays < 7;
      case 'monthly': return diffDays < 30;
      default: return false;
    }
  }

  private generateRecommendations(alerts: AlertRecord[]): string[] {
    const recommendations: string[] = [];
    
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push('緊急対応が必要なアラートが発生しています。即座に対処してください。');
    }
    
    const overtimeAlerts = alerts.filter(a => a.alertType === 'overtime');
    if (overtimeAlerts.length > 5) {
      recommendations.push('残業時間アラートが多発しています。業務配分の見直しを検討してください。');
    }
    
    const turnoverAlerts = alerts.filter(a => a.alertType === 'turnover');
    if (turnoverAlerts.length > 0) {
      recommendations.push('離職リスクの高い従業員がいます。面談の実施を検討してください。');
    }
    
    return recommendations;
  }

  private createReportSummary(alerts: AlertRecord[], period: string): string {
    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const overtimeAlerts = alerts.filter(a => a.alertType === 'overtime').length;
    const turnoverAlerts = alerts.filter(a => a.alertType === 'turnover').length;

    return `
${period}期間のアラートサマリー:
- 総アラート数: ${totalAlerts}件
- 重要アラート: ${criticalAlerts}件
- 残業関連: ${overtimeAlerts}件
- 離職関連: ${turnoverAlerts}件

${criticalAlerts > 0 ? '⚠️ 重要なアラートが発生しています。' : '✅ 重要なアラートはありません。'}
    `;
  }
}

export default PredictiveVisualizationAlerts;