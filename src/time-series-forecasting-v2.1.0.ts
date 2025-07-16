/**
 * 時系列予測エンジン v2.1.0
 * Time Series Forecasting Engine
 * 
 * ARIMA/Prophet モデルによる残業時間予測
 */

import type { TimeRecord } from './types.js';

// 時系列データポイント
export interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  seasonality?: number;
  trend?: number;
  residual?: number;
}

// 予測結果
export interface ForecastResult {
  predictions: TimeSeriesDataPoint[];
  confidence_intervals: {
    lower: number[];
    upper: number[];
  };
  model_metrics: {
    mae: number; // Mean Absolute Error
    mse: number; // Mean Squared Error
    rmse: number; // Root Mean Squared Error
    r2: number; // R-squared
  };
  seasonality_components: {
    weekly: number[];
    monthly: number[];
    yearly: number[];
  };
}

// ARIMAモデル設定
export interface ARIMAConfig {
  p: number; // 自己回帰項の次数
  d: number; // 差分の次数
  q: number; // 移動平均項の次数
  seasonal_p: number; // 季節性自己回帰項
  seasonal_d: number; // 季節性差分
  seasonal_q: number; // 季節性移動平均項
  seasonal_period: number; // 季節性周期
}

// Prophetモデル設定
export interface ProphetConfig {
  growth: 'linear' | 'logistic';
  changepoints: Date[];
  n_changepoints: number;
  changepoint_range: number;
  yearly_seasonality: boolean;
  weekly_seasonality: boolean;
  daily_seasonality: boolean;
  holidays: HolidayEffect[];
  seasonality_mode: 'additive' | 'multiplicative';
  seasonality_prior_scale: number;
  holidays_prior_scale: number;
}

export interface HolidayEffect {
  holiday: string;
  ds: Date;
  lower_window: number;
  upper_window: number;
}

export class TimeSeriesForecasting {
  private config: ARIMAConfig | ProphetConfig;
  private model_type: 'arima' | 'prophet';
  
  constructor(model_type: 'arima' | 'prophet', config?: ARIMAConfig | ProphetConfig) {
    this.model_type = model_type;
    
    if (model_type === 'arima') {
      this.config = {
        p: 1,
        d: 1,
        q: 1,
        seasonal_p: 1,
        seasonal_d: 1,
        seasonal_q: 1,
        seasonal_period: 7, // 週次季節性
        ...config
      } as ARIMAConfig;
    } else {
      this.config = {
        growth: 'linear',
        changepoints: [],
        n_changepoints: 25,
        changepoint_range: 0.8,
        yearly_seasonality: true,
        weekly_seasonality: true,
        daily_seasonality: false,
        holidays: [],
        seasonality_mode: 'additive',
        seasonality_prior_scale: 10.0,
        holidays_prior_scale: 10.0,
        ...config
      } as ProphetConfig;
    }
  }

  /**
   * 残業時間予測実行
   */
  async forecastOvertime(
    employeeId: string,
    historicalData: TimeRecord[],
    horizon: number = 30
  ): Promise<ForecastResult> {
    // 時系列データ準備
    const timeSeriesData = this.prepareTimeSeriesData(historicalData);
    
    // データ前処理
    const preprocessedData = this.preprocessData(timeSeriesData);
    
    // 予測実行
    if (this.model_type === 'arima') {
      return this.runARIMAForecast(preprocessedData, horizon);
    } else {
      return this.runProphetForecast(preprocessedData, horizon);
    }
  }

  /**
   * 時系列データ準備
   */
  private prepareTimeSeriesData(timeRecords: TimeRecord[]): TimeSeriesDataPoint[] {
    const dataPoints: TimeSeriesDataPoint[] = [];
    
    // 日別残業時間集計
    const dailyOvertime = new Map<string, number>();
    
    timeRecords.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0];
      const overtime = this.calculateOvertimeHours(record);
      
      if (dailyOvertime.has(dateKey)) {
        dailyOvertime.set(dateKey, dailyOvertime.get(dateKey)! + overtime);
      } else {
        dailyOvertime.set(dateKey, overtime);
      }
    });
    
    // TimeSeriesDataPoint配列に変換
    for (const [dateStr, overtimeHours] of dailyOvertime) {
      dataPoints.push({
        timestamp: new Date(dateStr),
        value: overtimeHours
      });
    }
    
    // 日付順にソート
    dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return dataPoints;
  }

  /**
   * データ前処理
   */
  private preprocessData(data: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
    // 欠損値補完
    const filledData = this.fillMissingValues(data);
    
    // 外れ値処理
    const cleanedData = this.removeOutliers(filledData);
    
    // 平滑化
    const smoothedData = this.applyMovingAverage(cleanedData, 7);
    
    return smoothedData;
  }

  /**
   * ARIMA予測実行
   */
  private async runARIMAForecast(data: TimeSeriesDataPoint[], horizon: number): Promise<ForecastResult> {
    const config = this.config as ARIMAConfig;
    
    // 差分系列作成
    const differenceData = this.createDifferenceData(data, config.d);
    
    // 季節性差分
    const seasonalDifferenceData = this.createSeasonalDifferenceData(differenceData, config.seasonal_d, config.seasonal_period);
    
    // ARIMAモデル適用
    const predictions = this.applyARIMAModel(seasonalDifferenceData, config, horizon);
    
    // 予測結果を元スケールに復元
    const forecastData = this.restoreOriginalScale(predictions, data);
    
    // 信頼区間計算
    const confidenceIntervals = this.calculateConfidenceIntervals(forecastData, 0.95);
    
    // モデル評価
    const metrics = this.evaluateModel(data, forecastData.slice(0, data.length));
    
    // 季節性成分分析
    const seasonalityComponents = this.analyzeSeasonality(data);
    
    return {
      predictions: forecastData,
      confidence_intervals: confidenceIntervals,
      model_metrics: metrics,
      seasonality_components: seasonalityComponents
    };
  }

  /**
   * Prophet予測実行
   */
  private async runProphetForecast(data: TimeSeriesDataPoint[], horizon: number): Promise<ForecastResult> {
    const config = this.config as ProphetConfig;
    
    // Prophetデータ形式に変換
    const prophetData = this.convertToProphetFormat(data);
    
    // 季節性成分分解
    const decomposition = this.decomposeSeasonality(prophetData, config);
    
    // 傾向成分抽出
    const trendComponent = this.extractTrendComponent(prophetData, config);
    
    // 予測実行
    const predictions = this.generateProphetPredictions(prophetData, config, horizon);
    
    // 信頼区間計算
    const confidenceIntervals = this.calculateProphetConfidenceIntervals(predictions, config);
    
    // モデル評価
    const metrics = this.evaluateProphetModel(data, predictions);
    
    // 季節性成分分析
    const seasonalityComponents = this.analyzeProphetSeasonality(decomposition);
    
    return {
      predictions: predictions,
      confidence_intervals: confidenceIntervals,
      model_metrics: metrics,
      seasonality_components: seasonalityComponents
    };
  }

  /**
   * 残業時間計算
   */
  private calculateOvertimeHours(record: TimeRecord): number {
    if (!record.clockOut) return 0;
    
    const workMinutes = (record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60);
    const workHours = (workMinutes - (record.breakDuration || 0)) / 60;
    
    return Math.max(0, workHours - 8); // 8時間超過分を残業とする
  }

  /**
   * 欠損値補完
   */
  private fillMissingValues(data: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
    const filledData = [...data];
    
    for (let i = 1; i < filledData.length - 1; i++) {
      if (filledData[i].value === null || filledData[i].value === undefined) {
        // 線形補間
        const prevValue = filledData[i-1].value;
        const nextValue = filledData[i+1].value;
        filledData[i].value = (prevValue + nextValue) / 2;
      }
    }
    
    return filledData;
  }

  /**
   * 外れ値除去
   */
  private removeOutliers(data: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
    const values = data.map(d => d.value);
    const q1 = this.quantile(values, 0.25);
    const q3 = this.quantile(values, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return data.map(d => ({
      ...d,
      value: Math.max(lowerBound, Math.min(upperBound, d.value))
    }));
  }

  /**
   * 移動平均適用
   */
  private applyMovingAverage(data: TimeSeriesDataPoint[], window: number): TimeSeriesDataPoint[] {
    const smoothedData = [...data];
    
    for (let i = window; i < smoothedData.length; i++) {
      const windowData = smoothedData.slice(i - window, i);
      const average = windowData.reduce((sum, d) => sum + d.value, 0) / window;
      smoothedData[i].value = average;
    }
    
    return smoothedData;
  }

  /**
   * 差分系列作成
   */
  private createDifferenceData(data: TimeSeriesDataPoint[], order: number): TimeSeriesDataPoint[] {
    let result = [...data];
    
    for (let d = 0; d < order; d++) {
      const diffData: TimeSeriesDataPoint[] = [];
      
      for (let i = 1; i < result.length; i++) {
        diffData.push({
          timestamp: result[i].timestamp,
          value: result[i].value - result[i-1].value
        });
      }
      
      result = diffData;
    }
    
    return result;
  }

  /**
   * 季節性差分作成
   */
  private createSeasonalDifferenceData(data: TimeSeriesDataPoint[], order: number, period: number): TimeSeriesDataPoint[] {
    let result = [...data];
    
    for (let d = 0; d < order; d++) {
      const diffData: TimeSeriesDataPoint[] = [];
      
      for (let i = period; i < result.length; i++) {
        diffData.push({
          timestamp: result[i].timestamp,
          value: result[i].value - result[i-period].value
        });
      }
      
      result = diffData;
    }
    
    return result;
  }

  /**
   * ARIMAモデル適用（簡易実装）
   */
  private applyARIMAModel(data: TimeSeriesDataPoint[], config: ARIMAConfig, horizon: number): TimeSeriesDataPoint[] {
    const predictions: TimeSeriesDataPoint[] = [];
    
    // 簡易ARIMA実装（実際のプロダクションではライブラリを使用）
    for (let i = 0; i < horizon; i++) {
      const futureDate = new Date(data[data.length - 1].timestamp);
      futureDate.setDate(futureDate.getDate() + i + 1);
      
      // 単純な線形予測（実際はARIMAアルゴリズムを実装）
      const recentValues = data.slice(-config.p).map(d => d.value);
      const trend = this.calculateTrend(recentValues);
      const seasonality = this.calculateSeasonality(data, i, config.seasonal_period);
      
      predictions.push({
        timestamp: futureDate,
        value: trend + seasonality
      });
    }
    
    return predictions;
  }

  /**
   * 信頼区間計算
   */
  private calculateConfidenceIntervals(data: TimeSeriesDataPoint[], confidence: number): { lower: number[], upper: number[] } {
    const residuals = this.calculateResiduals(data);
    const std = this.calculateStandardDeviation(residuals);
    const z = this.getZScore(confidence);
    
    const lower = data.map(d => d.value - z * std);
    const upper = data.map(d => d.value + z * std);
    
    return { lower, upper };
  }

  /**
   * モデル評価
   */
  private evaluateModel(actual: TimeSeriesDataPoint[], predicted: TimeSeriesDataPoint[]): {
    mae: number;
    mse: number;
    rmse: number;
    r2: number;
  } {
    const n = Math.min(actual.length, predicted.length);
    const actualValues = actual.slice(-n).map(d => d.value);
    const predictedValues = predicted.slice(-n).map(d => d.value);
    
    const mae = actualValues.reduce((sum, val, i) => sum + Math.abs(val - predictedValues[i]), 0) / n;
    const mse = actualValues.reduce((sum, val, i) => sum + Math.pow(val - predictedValues[i], 2), 0) / n;
    const rmse = Math.sqrt(mse);
    
    const actualMean = actualValues.reduce((sum, val) => sum + val, 0) / n;
    const ssTotal = actualValues.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
    const ssResidual = actualValues.reduce((sum, val, i) => sum + Math.pow(val - predictedValues[i], 2), 0);
    const r2 = 1 - (ssResidual / ssTotal);
    
    return { mae, mse, rmse, r2 };
  }

  /**
   * 季節性分析
   */
  private analyzeSeasonality(data: TimeSeriesDataPoint[]): {
    weekly: number[];
    monthly: number[];
    yearly: number[];
  } {
    return {
      weekly: this.extractWeeklySeasonality(data),
      monthly: this.extractMonthlySeasonality(data),
      yearly: this.extractYearlySeasonality(data)
    };
  }

  // ヘルパーメソッド
  private quantile(values: number[], q: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = q * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    const sumX = n * (n - 1) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6;
    
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  }

  private calculateSeasonality(data: TimeSeriesDataPoint[], offset: number, period: number): number {
    const seasonalIndex = offset % period;
    const seasonalValues = data.filter((_, i) => i % period === seasonalIndex);
    const average = seasonalValues.reduce((sum, d) => sum + d.value, 0) / seasonalValues.length;
    const overall = data.reduce((sum, d) => sum + d.value, 0) / data.length;
    
    return average - overall;
  }

  private calculateResiduals(data: TimeSeriesDataPoint[]): number[] {
    // 実際の残差計算（簡略化）
    return data.map(d => d.residual || 0);
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private getZScore(confidence: number): number {
    // 信頼区間に対応するZスコア
    const zScores: { [key: number]: number } = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    
    return zScores[confidence] || 1.96;
  }

  private extractWeeklySeasonality(data: TimeSeriesDataPoint[]): number[] {
    const weekly: number[] = new Array(7).fill(0);
    const counts: number[] = new Array(7).fill(0);
    
    data.forEach(d => {
      const dayOfWeek = d.timestamp.getDay();
      weekly[dayOfWeek] += d.value;
      counts[dayOfWeek]++;
    });
    
    return weekly.map((sum, i) => counts[i] > 0 ? sum / counts[i] : 0);
  }

  private extractMonthlySeasonality(data: TimeSeriesDataPoint[]): number[] {
    const monthly: number[] = new Array(12).fill(0);
    const counts: number[] = new Array(12).fill(0);
    
    data.forEach(d => {
      const month = d.timestamp.getMonth();
      monthly[month] += d.value;
      counts[month]++;
    });
    
    return monthly.map((sum, i) => counts[i] > 0 ? sum / counts[i] : 0);
  }

  private extractYearlySeasonality(data: TimeSeriesDataPoint[]): number[] {
    // 年次季節性の簡易実装
    return [0]; // 実際はより複雑な年次パターンを抽出
  }

  // Prophet関連メソッド（簡易実装）
  private convertToProphetFormat(data: TimeSeriesDataPoint[]): any[] {
    return data.map(d => ({ ds: d.timestamp, y: d.value }));
  }

  private decomposeSeasonality(data: any[], config: ProphetConfig): any {
    return { weekly: [], monthly: [], yearly: [] };
  }

  private extractTrendComponent(data: any[], config: ProphetConfig): any {
    return { trend: [] };
  }

  private generateProphetPredictions(data: any[], config: ProphetConfig, horizon: number): TimeSeriesDataPoint[] {
    const predictions: TimeSeriesDataPoint[] = [];
    
    for (let i = 0; i < horizon; i++) {
      const futureDate = new Date(data[data.length - 1].ds);
      futureDate.setDate(futureDate.getDate() + i + 1);
      
      predictions.push({
        timestamp: futureDate,
        value: this.calculateProphetPrediction(data, i, config)
      });
    }
    
    return predictions;
  }

  private calculateProphetPrediction(data: any[], offset: number, config: ProphetConfig): number {
    // 簡易Prophet予測実装
    const recentValues = data.slice(-7).map(d => d.y);
    const average = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const trend = (recentValues[recentValues.length - 1] - recentValues[0]) / recentValues.length;
    
    return average + trend * offset;
  }

  private calculateProphetConfidenceIntervals(predictions: TimeSeriesDataPoint[], config: ProphetConfig): { lower: number[], upper: number[] } {
    const uncertainty = 0.1; // 不確実性係数
    
    const lower = predictions.map(p => p.value * (1 - uncertainty));
    const upper = predictions.map(p => p.value * (1 + uncertainty));
    
    return { lower, upper };
  }

  private evaluateProphetModel(actual: TimeSeriesDataPoint[], predicted: TimeSeriesDataPoint[]): any {
    return this.evaluateModel(actual, predicted);
  }

  private analyzeProphetSeasonality(decomposition: any): any {
    return {
      weekly: decomposition.weekly || [],
      monthly: decomposition.monthly || [],
      yearly: decomposition.yearly || []
    };
  }

  private restoreOriginalScale(predictions: TimeSeriesDataPoint[], originalData: TimeSeriesDataPoint[]): TimeSeriesDataPoint[] {
    // 差分・変換を元に戻す処理
    return predictions;
  }
}

export default TimeSeriesForecasting;