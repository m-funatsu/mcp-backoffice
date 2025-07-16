/**
 * 離職予測エンジン v2.1.0
 * Turnover Prediction Engine
 * 
 * 勤怠パターン分析による離職リスク予測
 */

import Database from './database.js';
import type { Employee, TimeRecord, LeaveBalance, TurnoverPrediction } from './types.js';

// 勤怠パターン分析結果
export interface AttendancePattern {
  employeeId: string;
  averageArrivalTime: number; // 平均到着時刻（分）
  averageDepartureTime: number; // 平均退社時刻（分）
  punctualityScore: number; // 時間遵守スコア（0-1）
  absenteeismRate: number; // 欠勤率
  overtimeFrequency: number; // 残業頻度
  weekendWorkFrequency: number; // 休日出勤頻度
  leaveUsagePattern: LeaveUsagePattern;
  trendAnalysis: TrendAnalysis;
}

export interface LeaveUsagePattern {
  annualLeaveUsage: number; // 年次有給使用率
  sickLeaveUsage: number; // 病気休暇使用率
  continuousLeaveFrequency: number; // 連続休暇頻度
  lastMinuteLeaveFrequency: number; // 直前申請頻度
  leaveClusteringScore: number; // 休暇の偏りスコア
}

export interface TrendAnalysis {
  punctualityTrend: 'improving' | 'stable' | 'declining';
  overtimeTrend: 'increasing' | 'stable' | 'decreasing';
  leaveUsageTrend: 'increasing' | 'stable' | 'decreasing';
  engagementTrend: 'improving' | 'stable' | 'declining';
}

// 離職リスク要因
export interface RiskFactors {
  attendance: {
    score: number;
    issues: string[];
    weight: number;
  };
  overtime: {
    score: number;
    issues: string[];
    weight: number;
  };
  leave: {
    score: number;
    issues: string[];
    weight: number;
  };
  engagement: {
    score: number;
    issues: string[];
    weight: number;
  };
  tenure: {
    score: number;
    issues: string[];
    weight: number;
  };
  performance: {
    score: number;
    issues: string[];
    weight: number;
  };
}

// 機械学習特徴量
export interface MLFeatures {
  attendanceRegularity: number;
  overtimeVariability: number;
  leavePatternAnomaly: number;
  workLifeBalance: number;
  jobSatisfactionProxy: number;
  careerProgressionRate: number;
  teamIntegrationScore: number;
  managerRelationshipScore: number;
  workloadSustainability: number;
  skillUtilizationRate: number;
}

// 離職予測結果
export interface TurnoverPredictionResult {
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  overallRiskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  predictedTimeframe: number; // 予測される離職までの日数
  riskFactors: RiskFactors;
  mlFeatures: MLFeatures;
  attendancePattern: AttendancePattern;
  warningSignals: string[];
  recommendedActions: RecommendedAction[];
  similarCases: SimilarCase[];
}

export interface RecommendedAction {
  category: 'immediate' | 'short_term' | 'long_term';
  action: string;
  priority: 'high' | 'medium' | 'low';
  assignedTo: 'manager' | 'hr' | 'employee';
  estimatedImpact: number; // 予想される効果（0-1）
  implementation: string;
}

export interface SimilarCase {
  employeeId: string;
  similarity: number;
  outcome: 'retained' | 'left';
  actions_taken: string[];
  effectiveness: number;
}

export class TurnoverPredictionEngine {
  private db: Database;
  private riskThresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  
  constructor(database: Database) {
    this.db = database;
    this.riskThresholds = {
      low: 25,
      medium: 50,
      high: 75,
      critical: 90
    };
  }

  /**
   * 離職予測実行
   */
  async predictTurnover(employeeId?: string): Promise<TurnoverPredictionResult[]> {
    const employees = employeeId 
      ? [await this.db.getEmployee(employeeId)]
      : await this.db.getAllEmployees();

    const predictions: TurnoverPredictionResult[] = [];

    for (const employee of employees) {
      if (!employee || !employee.isActive) continue;

      // 勤怠パターン分析
      const attendancePattern = await this.analyzeAttendancePattern(employee.id);
      
      // リスク要因分析
      const riskFactors = await this.analyzeRiskFactors(employee, attendancePattern);
      
      // 機械学習特徴量抽出
      const mlFeatures = await this.extractMLFeatures(employee, attendancePattern);
      
      // 総合リスクスコア計算
      const overallRiskScore = this.calculateOverallRiskScore(riskFactors, mlFeatures);
      
      // リスクレベル判定
      const riskLevel = this.determineRiskLevel(overallRiskScore);
      
      // 予測信頼度計算
      const confidence = this.calculateConfidence(mlFeatures, attendancePattern);
      
      // 予測タイムフレーム計算
      const predictedTimeframe = this.calculatePredictedTimeframe(overallRiskScore, riskFactors);
      
      // 警告シグナル検出
      const warningSignals = this.detectWarningSignals(riskFactors, attendancePattern);
      
      // 推奨アクション生成
      const recommendedActions = this.generateRecommendedActions(riskLevel, riskFactors);
      
      // 類似ケース検索
      const similarCases = await this.findSimilarCases(employee, mlFeatures);

      predictions.push({
        employeeId: employee.id,
        employeeName: employee.name,
        department: employee.department,
        position: employee.position,
        overallRiskScore,
        riskLevel,
        confidence,
        predictedTimeframe,
        riskFactors,
        mlFeatures,
        attendancePattern,
        warningSignals,
        recommendedActions,
        similarCases
      });
    }

    return predictions.sort((a, b) => b.overallRiskScore - a.overallRiskScore);
  }

  /**
   * 勤怠パターン分析
   */
  private async analyzeAttendancePattern(employeeId: string): Promise<AttendancePattern> {
    // 過去6ヶ月の勤怠データ取得
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    const endDate = new Date();
    
    const timeRecords = await this.db.getTimeRecords(employeeId, startDate.toISOString(), endDate.toISOString());
    
    // 平均到着・退社時刻計算
    const arrivalTimes = timeRecords.map(r => r.clockIn.getHours() * 60 + r.clockIn.getMinutes());
    const departureTimes = timeRecords.filter(r => r.clockOut).map(r => r.clockOut!.getHours() * 60 + r.clockOut!.getMinutes());
    
    const averageArrivalTime = arrivalTimes.reduce((sum, time) => sum + time, 0) / arrivalTimes.length;
    const averageDepartureTime = departureTimes.reduce((sum, time) => sum + time, 0) / departureTimes.length;
    
    // 時間遵守スコア計算
    const punctualityScore = this.calculatePunctualityScore(timeRecords);
    
    // 欠勤率計算
    const absenteeismRate = this.calculateAbsenteeismRate(timeRecords, startDate, endDate);
    
    // 残業頻度計算
    const overtimeFrequency = this.calculateOvertimeFrequency(timeRecords);
    
    // 休日出勤頻度計算
    const weekendWorkFrequency = this.calculateWeekendWorkFrequency(timeRecords);
    
    // 有給使用パターン分析
    const leaveUsagePattern = await this.analyzeLeaveUsagePattern(employeeId);
    
    // トレンド分析
    const trendAnalysis = this.analyzeTrends(timeRecords);

    return {
      employeeId,
      averageArrivalTime,
      averageDepartureTime,
      punctualityScore,
      absenteeismRate,
      overtimeFrequency,
      weekendWorkFrequency,
      leaveUsagePattern,
      trendAnalysis
    };
  }

  /**
   * リスク要因分析
   */
  private async analyzeRiskFactors(employee: Employee, pattern: AttendancePattern): Promise<RiskFactors> {
    return {
      attendance: {
        score: this.calculateAttendanceRiskScore(pattern),
        issues: this.identifyAttendanceIssues(pattern),
        weight: 0.25
      },
      overtime: {
        score: this.calculateOvertimeRiskScore(pattern),
        issues: this.identifyOvertimeIssues(pattern),
        weight: 0.2
      },
      leave: {
        score: this.calculateLeaveRiskScore(pattern),
        issues: this.identifyLeaveIssues(pattern),
        weight: 0.15
      },
      engagement: {
        score: this.calculateEngagementRiskScore(pattern),
        issues: this.identifyEngagementIssues(pattern),
        weight: 0.2
      },
      tenure: {
        score: this.calculateTenureRiskScore(employee),
        issues: this.identifyTenureIssues(employee),
        weight: 0.1
      },
      performance: {
        score: this.calculatePerformanceRiskScore(employee),
        issues: this.identifyPerformanceIssues(employee),
        weight: 0.1
      }
    };
  }

  /**
   * 機械学習特徴量抽出
   */
  private async extractMLFeatures(employee: Employee, pattern: AttendancePattern): Promise<MLFeatures> {
    return {
      attendanceRegularity: this.calculateAttendanceRegularity(pattern),
      overtimeVariability: this.calculateOvertimeVariability(pattern),
      leavePatternAnomaly: this.calculateLeavePatternAnomaly(pattern),
      workLifeBalance: this.calculateWorkLifeBalance(pattern),
      jobSatisfactionProxy: this.calculateJobSatisfactionProxy(pattern),
      careerProgressionRate: this.calculateCareerProgressionRate(employee),
      teamIntegrationScore: this.calculateTeamIntegrationScore(employee),
      managerRelationshipScore: this.calculateManagerRelationshipScore(employee),
      workloadSustainability: this.calculateWorkloadSustainability(pattern),
      skillUtilizationRate: this.calculateSkillUtilizationRate(employee)
    };
  }

  /**
   * 総合リスクスコア計算
   */
  private calculateOverallRiskScore(riskFactors: RiskFactors, mlFeatures: MLFeatures): number {
    // 重み付きリスクスコア計算
    const weightedScore = Object.values(riskFactors).reduce((sum, factor) => {
      return sum + (factor.score * factor.weight);
    }, 0);
    
    // 機械学習特徴量による調整
    const mlAdjustment = this.calculateMLAdjustment(mlFeatures);
    
    // 最終スコア計算（0-100）
    const finalScore = Math.max(0, Math.min(100, weightedScore + mlAdjustment));
    
    return Math.round(finalScore);
  }

  /**
   * リスクレベル判定
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.riskThresholds.critical) return 'critical';
    if (score >= this.riskThresholds.high) return 'high';
    if (score >= this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * 予測信頼度計算
   */
  private calculateConfidence(mlFeatures: MLFeatures, pattern: AttendancePattern): number {
    // データの品質と完全性に基づく信頼度計算
    const dataQuality = this.assessDataQuality(pattern);
    const featureConsistency = this.assessFeatureConsistency(mlFeatures);
    const modelReliability = 0.85; // モデルの基本信頼度
    
    return Math.round((dataQuality * featureConsistency * modelReliability) * 100) / 100;
  }

  /**
   * 予測タイムフレーム計算
   */
  private calculatePredictedTimeframe(riskScore: number, riskFactors: RiskFactors): number {
    // リスクスコアに基づく基本タイムフレーム
    const baseTimeframe = Math.max(30, 365 - (riskScore * 3));
    
    // 要因別調整
    const adjustments = this.calculateTimeframeAdjustments(riskFactors);
    
    return Math.max(7, Math.round(baseTimeframe + adjustments));
  }

  /**
   * 警告シグナル検出
   */
  private detectWarningSignals(riskFactors: RiskFactors, pattern: AttendancePattern): string[] {
    const signals: string[] = [];
    
    // 勤怠パターン警告
    if (pattern.punctualityScore < 0.7) {
      signals.push('遅刻・早退の増加');
    }
    
    if (pattern.absenteeismRate > 0.05) {
      signals.push('欠勤率の上昇');
    }
    
    if (pattern.overtimeFrequency > 0.6) {
      signals.push('継続的な長時間労働');
    }
    
    // 有給使用パターン警告
    if (pattern.leaveUsagePattern.annualLeaveUsage < 0.3) {
      signals.push('有給休暇の未使用');
    }
    
    if (pattern.leaveUsagePattern.sickLeaveUsage > 0.1) {
      signals.push('病気休暇の増加');
    }
    
    // トレンド警告
    if (pattern.trendAnalysis.punctualityTrend === 'declining') {
      signals.push('勤務態度の悪化傾向');
    }
    
    if (pattern.trendAnalysis.engagementTrend === 'declining') {
      signals.push('エンゲージメントの低下');
    }
    
    return signals;
  }

  /**
   * 推奨アクション生成
   */
  private generateRecommendedActions(riskLevel: string, riskFactors: RiskFactors): RecommendedAction[] {
    const actions: RecommendedAction[] = [];
    
    if (riskLevel === 'critical') {
      actions.push({
        category: 'immediate',
        action: '人事面談の緊急実施',
        priority: 'high',
        assignedTo: 'hr',
        estimatedImpact: 0.8,
        implementation: '48時間以内に面談を設定し、問題の詳細を把握する'
      });
    }
    
    if (riskFactors.overtime.score > 70) {
      actions.push({
        category: 'immediate',
        action: '業務負荷の見直し',
        priority: 'high',
        assignedTo: 'manager',
        estimatedImpact: 0.7,
        implementation: '業務配分の調整と優先順位の見直しを実施'
      });
    }
    
    if (riskFactors.engagement.score > 60) {
      actions.push({
        category: 'short_term',
        action: 'キャリア相談の実施',
        priority: 'medium',
        assignedTo: 'hr',
        estimatedImpact: 0.6,
        implementation: 'キャリア開発計画の策定と目標設定の支援'
      });
    }
    
    return actions;
  }

  /**
   * 類似ケース検索
   */
  private async findSimilarCases(employee: Employee, mlFeatures: MLFeatures): Promise<SimilarCase[]> {
    // 類似従業員の検索（機械学習特徴量による類似度計算）
    const allEmployees = await this.db.getAllEmployees();
    const similarCases: SimilarCase[] = [];
    
    for (const otherEmployee of allEmployees) {
      if (otherEmployee.id === employee.id) continue;
      
      // 類似度計算（コサイン類似度など）
      const similarity = this.calculateSimilarity(employee, otherEmployee, mlFeatures);
      
      if (similarity > 0.7) {
        similarCases.push({
          employeeId: otherEmployee.id,
          similarity,
          outcome: otherEmployee.isActive ? 'retained' : 'left',
          actions_taken: [], // 実際の案件では履歴データから取得
          effectiveness: 0.75 // 実際の案件では効果測定結果から取得
        });
      }
    }
    
    return similarCases.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  // ヘルパーメソッド（各種計算）
  private calculatePunctualityScore(timeRecords: TimeRecord[]): number {
    const standardStartTime = 9 * 60; // 9:00を基準
    const onTimeCount = timeRecords.filter(record => {
      const arrivalTime = record.clockIn.getHours() * 60 + record.clockIn.getMinutes();
      return arrivalTime <= standardStartTime + 15; // 15分以内は許容
    }).length;
    
    return onTimeCount / timeRecords.length;
  }

  private calculateAbsenteeismRate(timeRecords: TimeRecord[], startDate: Date, endDate: Date): number {
    const workingDays = this.calculateWorkingDays(startDate, endDate);
    const attendedDays = timeRecords.length;
    
    return Math.max(0, (workingDays - attendedDays) / workingDays);
  }

  private calculateOvertimeFrequency(timeRecords: TimeRecord[]): number {
    const overtimeRecords = timeRecords.filter(record => {
      if (!record.clockOut) return false;
      const workHours = (record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60 * 60);
      return workHours > 8;
    });
    
    return overtimeRecords.length / timeRecords.length;
  }

  private calculateWeekendWorkFrequency(timeRecords: TimeRecord[]): number {
    const weekendRecords = timeRecords.filter(record => {
      const day = record.clockIn.getDay();
      return day === 0 || day === 6; // 日曜日または土曜日
    });
    
    return weekendRecords.length / timeRecords.length;
  }

  private async analyzeLeaveUsagePattern(employeeId: string): Promise<LeaveUsagePattern> {
    // 有給残高データ取得
    const leaveBalances = await this.db.getLeaveBalance(employeeId);
    
    // 簡易実装（実際はより詳細な分析）
    return {
      annualLeaveUsage: 0.6,
      sickLeaveUsage: 0.05,
      continuousLeaveFrequency: 0.2,
      lastMinuteLeaveFrequency: 0.3,
      leaveClusteringScore: 0.4
    };
  }

  private analyzeTrends(timeRecords: TimeRecord[]): TrendAnalysis {
    // トレンド分析の簡易実装
    return {
      punctualityTrend: 'stable',
      overtimeTrend: 'stable',
      leaveUsageTrend: 'stable',
      engagementTrend: 'stable'
    };
  }

  private calculateAttendanceRiskScore(pattern: AttendancePattern): number {
    const punctualityRisk = (1 - pattern.punctualityScore) * 40;
    const absenteeismRisk = pattern.absenteeismRate * 60;
    
    return Math.min(100, punctualityRisk + absenteeismRisk);
  }

  private calculateOvertimeRiskScore(pattern: AttendancePattern): number {
    return Math.min(100, pattern.overtimeFrequency * 80);
  }

  private calculateLeaveRiskScore(pattern: AttendancePattern): number {
    const underUsage = pattern.leaveUsagePattern.annualLeaveUsage < 0.3 ? 50 : 0;
    const overUsage = pattern.leaveUsagePattern.sickLeaveUsage > 0.1 ? 50 : 0;
    
    return Math.min(100, underUsage + overUsage);
  }

  private calculateEngagementRiskScore(pattern: AttendancePattern): number {
    // エンゲージメントリスクの簡易計算
    const baseScore = pattern.overtimeFrequency * 30 + (1 - pattern.punctualityScore) * 30;
    const trendAdjustment = pattern.trendAnalysis.engagementTrend === 'declining' ? 40 : 0;
    
    return Math.min(100, baseScore + trendAdjustment);
  }

  private calculateTenureRiskScore(employee: Employee): number {
    const tenureMonths = this.calculateTenureMonths(employee);
    
    // 新人（2年未満）と中堅（2-5年）は離職リスクが高い
    if (tenureMonths < 24) return 70;
    if (tenureMonths < 60) return 50;
    return 20;
  }

  private calculatePerformanceRiskScore(employee: Employee): number {
    // パフォーマンスリスクの簡易計算（実際は評価データを使用）
    return 40; // 仮値
  }

  private identifyAttendanceIssues(pattern: AttendancePattern): string[] {
    const issues: string[] = [];
    
    if (pattern.punctualityScore < 0.8) {
      issues.push('遅刻・早退が多い');
    }
    
    if (pattern.absenteeismRate > 0.05) {
      issues.push('欠勤率が高い');
    }
    
    return issues;
  }

  private identifyOvertimeIssues(pattern: AttendancePattern): string[] {
    const issues: string[] = [];
    
    if (pattern.overtimeFrequency > 0.6) {
      issues.push('継続的な長時間労働');
    }
    
    if (pattern.weekendWorkFrequency > 0.2) {
      issues.push('休日出勤が多い');
    }
    
    return issues;
  }

  private identifyLeaveIssues(pattern: AttendancePattern): string[] {
    const issues: string[] = [];
    
    if (pattern.leaveUsagePattern.annualLeaveUsage < 0.3) {
      issues.push('有給休暇を取得していない');
    }
    
    if (pattern.leaveUsagePattern.sickLeaveUsage > 0.1) {
      issues.push('病気休暇が多い');
    }
    
    return issues;
  }

  private identifyEngagementIssues(pattern: AttendancePattern): string[] {
    const issues: string[] = [];
    
    if (pattern.trendAnalysis.engagementTrend === 'declining') {
      issues.push('エンゲージメントが低下傾向');
    }
    
    return issues;
  }

  private identifyTenureIssues(employee: Employee): string[] {
    const issues: string[] = [];
    const tenureMonths = this.calculateTenureMonths(employee);
    
    if (tenureMonths < 24) {
      issues.push('入社2年未満の早期離職リスク');
    }
    
    return issues;
  }

  private identifyPerformanceIssues(employee: Employee): string[] {
    // パフォーマンス問題の識別（実際は評価データを使用）
    return [];
  }

  private calculateAttendanceRegularity(pattern: AttendancePattern): number {
    return pattern.punctualityScore;
  }

  private calculateOvertimeVariability(pattern: AttendancePattern): number {
    return pattern.overtimeFrequency;
  }

  private calculateLeavePatternAnomaly(pattern: AttendancePattern): number {
    return pattern.leaveUsagePattern.leaveClusteringScore;
  }

  private calculateWorkLifeBalance(pattern: AttendancePattern): number {
    return 1 - (pattern.overtimeFrequency * 0.6 + pattern.weekendWorkFrequency * 0.4);
  }

  private calculateJobSatisfactionProxy(pattern: AttendancePattern): number {
    return (pattern.punctualityScore + (1 - pattern.absenteeismRate)) / 2;
  }

  private calculateCareerProgressionRate(employee: Employee): number {
    // キャリア進歩率の簡易計算
    return 0.6; // 仮値
  }

  private calculateTeamIntegrationScore(employee: Employee): number {
    // チーム統合スコアの簡易計算
    return 0.7; // 仮値
  }

  private calculateManagerRelationshipScore(employee: Employee): number {
    // マネージャー関係スコアの簡易計算
    return 0.8; // 仮値
  }

  private calculateWorkloadSustainability(pattern: AttendancePattern): number {
    return 1 - pattern.overtimeFrequency;
  }

  private calculateSkillUtilizationRate(employee: Employee): number {
    // スキル活用率の簡易計算
    return 0.75; // 仮値
  }

  private calculateMLAdjustment(mlFeatures: MLFeatures): number {
    // 機械学習特徴量による調整計算
    const weights = {
      attendanceRegularity: -10,
      overtimeVariability: 15,
      leavePatternAnomaly: 10,
      workLifeBalance: -12,
      jobSatisfactionProxy: -15
    };
    
    return Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (mlFeatures[key as keyof MLFeatures] * weight);
    }, 0);
  }

  private assessDataQuality(pattern: AttendancePattern): number {
    // データ品質評価の簡易実装
    return 0.9;
  }

  private assessFeatureConsistency(mlFeatures: MLFeatures): number {
    // 特徴量一貫性評価の簡易実装
    return 0.85;
  }

  private calculateTimeframeAdjustments(riskFactors: RiskFactors): number {
    // タイムフレーム調整の簡易実装
    return 0;
  }

  private calculateSimilarity(emp1: Employee, emp2: Employee, mlFeatures: MLFeatures): number {
    // 類似度計算の簡易実装
    return 0.8; // 仮値
  }

  private calculateWorkingDays(startDate: Date, endDate: Date): number {
    // 営業日数計算の簡易実装
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.floor(days * 5 / 7); // 週5日勤務を想定
  }

  private calculateTenureMonths(employee: Employee): number {
    const now = new Date();
    const startDate = new Date(employee.startDate);
    return Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }
}

export default TurnoverPredictionEngine;