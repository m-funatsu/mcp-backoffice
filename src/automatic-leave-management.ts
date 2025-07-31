/**
 * v1.3.0 Automatic Paid Leave Management System
 * 有給休暇自動管理システム - 日本労働基準法準拠
 * 
 * Features:
 * - Automatic leave allocation based on tenure
 * - Carryover calculation and expiry management
 * - AI-driven approval recommendations
 * - Real-time balance tracking
 * - Compliance monitoring
 */

import Database from './database.js';
import type { Employee, LeaveBalance, LeaveRequest, LeavePolicy, LeaveType, RequestStatus } from './types.js';

export interface AutomaticLeaveAllocation {
  id: string;
  employeeId: string;
  year: number;
  allocationDate: Date;
  grantedDays: number;
  carryoverDays: number;
  expiredDays: number;
  totalDays: number;
  calculationReason: string;
  automaticallyProcessed: boolean;
  verified: boolean;
  verifiedBy?: string;
  verificationDate?: Date;
}

export interface LeaveCarryover {
  id: string;
  employeeId: string;
  fromYear: number;
  toYear: number;
  availableDays: number;
  carriedDays: number;
  expiredDays: number;
  expiryDate: Date;
  processedAt: Date;
  automaticallyProcessed: boolean;
}

export interface LeaveExpiry {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  year: number;
  expiredDays: number;
  expiryDate: Date;
  notificationSent: boolean;
  notificationDate?: Date;
  automaticallyProcessed: boolean;
}

export interface LeaveUsageAnalysis {
  employeeId: string;
  period: string;
  totalGranted: number;
  totalUsed: number;
  totalRemaining: number;
  usageRate: number; // 0-1
  averageRequestDuration: number;
  mostCommonLeaveType: LeaveType;
  peakUsageMonths: string[];
  riskLevel: 'low' | 'medium' | 'high'; // High = risk of losing days due to expiry
  recommendations: string[];
}

export interface ApprovalRecommendation {
  requestId: string;
  recommendedAction: 'approve' | 'reject' | 'request_more_info';
  confidence: number; // 0-1
  reasons: string[];
  riskFactors: string[];
  complianceIssues: string[];
  alternativeDates?: Date[];
}

// 分析結果の型定義
interface LeaveBalanceAnalysis {
  currentBalance: number;
  requestedDays: number;
  remainingAfterApproval: number;
  percentageUsed: number;
  warningThreshold: boolean;
}

interface LeaveHistoryAnalysis {
  pastUsagePattern: 'low' | 'normal' | 'high';
  averageRequestDuration: number;
  frequentPeriods: string[];
  previousRejections: number;
}

interface TeamImpactAnalysis {
  impact: 'low' | 'medium' | 'high' | 'unknown';
  conflictingRequests: number;
  teamCoverage: number; // percentage
  criticalRoles?: string[];
}

interface ComplianceAnalysis {
  issues: string[];
  compliant: boolean;
  requiredNoticeDays: number;
  actualNoticeDays: number;
  maxConsecutiveDaysAllowed?: number;
}

interface BusinessImpactAnalysis {
  hasPeakPeriod: boolean;
  hasImportantEvents: boolean;
  impactLevel: 'low' | 'medium' | 'high';
  alternativeSuggestions?: Date[];
}

export class AutomaticLeaveManagement {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * 年次有給休暇自動付与処理
   * Annual paid leave automatic allocation
   */
  async processAnnualLeaveAllocation(targetDate: Date = new Date()): Promise<AutomaticLeaveAllocation[]> {
    const allEmployees = await this.db.getAllEmployees();
    const allocations: AutomaticLeaveAllocation[] = [];

    for (const employee of allEmployees) {
      if (!employee.isActive) continue;

      try {
        const allocation = await this.calculateLeaveAllocation(employee, targetDate);
        if (allocation) {
          await this.saveLeaveAllocation(allocation);
          await this.updateLeaveBalance(allocation);
          allocations.push(allocation);
        }
      } catch (error) {
        console.error(`Error processing leave allocation for employee ${employee.id}:`, error);
      }
    }

    return allocations;
  }

  /**
   * 有給休暇付与日数計算（労働基準法準拠）
   */
  private async calculateLeaveAllocation(employee: Employee, targetDate: Date): Promise<AutomaticLeaveAllocation | null> {
    const tenureMonths = this.calculateTenureMonths(employee.startDate, targetDate);
    const currentYear = targetDate.getFullYear();
    
    // 労働基準法第39条に基づく有給休暇付与日数
    const grantedDays = this.calculateGrantedDaysByTenure(tenureMonths);
    
    if (grantedDays === 0) {
      return null; // 勤続6ヶ月未満は付与なし
    }

    // 前年度繰越計算
    const carryoverDays = await this.calculateCarryoverDays(employee.id, currentYear);

    const allocationId = `ALA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: allocationId,
      employeeId: employee.id,
      year: currentYear,
      allocationDate: targetDate,
      grantedDays,
      carryoverDays,
      expiredDays: 0,
      totalDays: grantedDays + carryoverDays,
      calculationReason: this.generateCalculationReason(tenureMonths, grantedDays, carryoverDays),
      automaticallyProcessed: true,
      verified: false
    };
  }

  /**
   * 労働基準法第39条に基づく付与日数計算
   */
  private calculateGrantedDaysByTenure(tenureMonths: number): number {
    if (tenureMonths < 6) return 0;
    if (tenureMonths < 18) return 10;
    if (tenureMonths < 30) return 11;
    if (tenureMonths < 42) return 12;
    if (tenureMonths < 54) return 14;
    if (tenureMonths < 66) return 16;
    if (tenureMonths < 78) return 18;
    return 20; // 6.5年以上
  }

  /**
   * 繰越日数計算
   */
  private async calculateCarryoverDays(employeeId: string, currentYear: number): Promise<number> {
    const previousYear = currentYear - 1;
    const previousBalance = await this.getLeaveBalanceByYear(employeeId, 'annual', previousYear);
    
    if (!previousBalance) return 0;

    // 最大20日まで繰越可能（労働基準法）
    const maxCarryover = 20;
    const carryoverDays = Math.min(previousBalance.remainingDays, maxCarryover);
    
    return carryoverDays;
  }

  /**
   * 有給休暇繰越処理
   */
  async processLeaveCarryover(targetDate: Date = new Date()): Promise<LeaveCarryover[]> {
    const currentYear = targetDate.getFullYear();
    const previousYear = currentYear - 1;
    
    const allEmployees = await this.db.getAllEmployees();
    const carryovers: LeaveCarryover[] = [];

    for (const employee of allEmployees) {
      if (!employee.isActive) continue;

      try {
        const carryover = await this.calculateLeaveCarryover(employee.id, previousYear, currentYear);
        if (carryover) {
          await this.saveLeaveCarryover(carryover);
          carryovers.push(carryover);
        }
      } catch (error) {
        console.error(`Error processing carryover for employee ${employee.id}:`, error);
      }
    }

    return carryovers;
  }

  /**
   * 有給休暇失効処理
   */
  async processLeaveExpiry(targetDate: Date = new Date()): Promise<LeaveExpiry[]> {
    const currentYear = targetDate.getFullYear();
    const expiredYear = currentYear - 2; // 2年前の有給が失効
    
    const allEmployees = await this.db.getAllEmployees();
    const expiries: LeaveExpiry[] = [];

    for (const employee of allEmployees) {
      try {
        const expiry = await this.calculateLeaveExpiry(employee.id, expiredYear, targetDate);
        if (expiry) {
          await this.saveLeaveExpiry(expiry);
          await this.notifyLeaveExpiry(expiry);
          expiries.push(expiry);
        }
      } catch (error) {
        console.error(`Error processing expiry for employee ${employee.id}:`, error);
      }
    }

    return expiries;
  }

  /**
   * AI駆動承認推奨システム
   */
  async generateApprovalRecommendation(requestId: string): Promise<ApprovalRecommendation> {
    const request = await this.getLeaveRequest(requestId);
    if (!request) {
      throw new Error('Leave request not found');
    }

    const employee = await this.db.getEmployee(request.employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    // 複数要素の分析
    const balanceAnalysis = await this.analyzeLeaveBalance(request);
    const historyAnalysis = await this.analyzeLeaveHistory(request.employeeId);
    const teamImpactAnalysis = await this.analyzeTeamImpact(request);
    const complianceAnalysis = await this.analyzeCompliance(request);
    const businessImpactAnalysis = await this.analyzeBusinessImpact(request);

    // AI判定ロジック
    const recommendation = this.calculateRecommendation(
      balanceAnalysis,
      historyAnalysis,
      teamImpactAnalysis,
      complianceAnalysis,
      businessImpactAnalysis
    );

    return recommendation;
  }

  /**
   * 有給使用状況分析
   */
  async analyzeLeaveUsage(employeeId: string, startDate: Date, endDate: Date): Promise<LeaveUsageAnalysis> {
    const requests = await this.getLeaveRequestsByPeriod(employeeId, startDate, endDate);
    const balance = await this.db.getLeaveBalance(employeeId, 'annual');
    
    if (!balance) {
      throw new Error(`No leave balance found for employee ${employeeId}`);
    }
    
    const totalUsed = requests
      .filter(r => r.status === 'approved')
      .reduce((sum, r) => sum + r.daysRequested, 0);
    
    const usageRate = balance.grantedDays > 0 ? totalUsed / balance.grantedDays : 0;
    
    const avgDuration = requests.length > 0 
      ? requests.reduce((sum, r) => sum + r.daysRequested, 0) / requests.length
      : 0;

    // 月別使用傾向分析
    const monthlyUsage = this.analyzeMonthlyUsage(requests);
    const peakMonths = Object.entries(monthlyUsage)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([month]) => month);

    // リスクレベル判定
    const riskLevel = this.calculateRiskLevel(balance, usageRate, endDate);
    
    // 推奨事項生成
    const recommendations = this.generateUsageRecommendations(usageRate, riskLevel, balance);

    return {
      employeeId,
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      totalGranted: balance.grantedDays,
      totalUsed,
      totalRemaining: balance.remainingDays,
      usageRate,
      averageRequestDuration: avgDuration,
      mostCommonLeaveType: this.findMostCommonLeaveType(requests),
      peakUsageMonths: peakMonths,
      riskLevel,
      recommendations
    };
  }

  /**
   * リアルタイム残高追跡
   */
  async trackLeaveBalanceRealTime(employeeId: string): Promise<LeaveBalance[]> {
    const currentDate = new Date();
    const leaveTypes: LeaveType[] = ['annual', 'sick', 'special', 'maternity', 'paternity', 'bereavement', 'personal'];
    
    const balances: LeaveBalance[] = [];
    
    for (const leaveType of leaveTypes) {
      try {
        const balance = await this.db.getLeaveBalance(employeeId, leaveType);
        
        if (!balance) {
          continue;
        }
        
        // リアルタイム計算: 承認待ちの申請も考慮
        const pendingRequests = await this.getPendingRequests(employeeId, leaveType);
        const pendingDays = pendingRequests.reduce((sum, req) => sum + req.daysRequested, 0);
        
        const realTimeBalance = {
          ...balance,
          pendingDays,
          effectiveRemaining: balance.remainingDays - pendingDays
        };
        
        balances.push(realTimeBalance);
      } catch (error) {
        console.error(`Error tracking balance for ${leaveType}:`, error);
      }
    }
    
    return balances;
  }

  // プライベートヘルパーメソッド

  private calculateTenureMonths(joinDate: Date, currentDate: Date): number {
    const diffTime = currentDate.getTime() - joinDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // 平均月日数
  }

  private generateCalculationReason(tenureMonths: number, grantedDays: number, carryoverDays: number): string {
    const tenureYears = Math.floor(tenureMonths / 12);
    const tenureMonthsRemainder = tenureMonths % 12;
    
    let reason = `勤続${tenureYears}年${tenureMonthsRemainder}ヶ月により${grantedDays}日付与`;
    
    if (carryoverDays > 0) {
      reason += `、前年度繰越${carryoverDays}日`;
    }
    
    return reason + '（労働基準法第39条準拠）';
  }

  private async analyzeLeaveBalance(request: LeaveRequest): Promise<LeaveBalanceAnalysis> {
    const balance = await this.db.getLeaveBalance(request.employeeId, request.leaveType);
    if (!balance) {
      return {
        sufficient: false,
        utilizationRate: 0,
        remainingAfterRequest: 0
      };
    }
    return {
      sufficient: balance.remainingDays >= request.daysRequested,
      utilizationRate: balance.usedDays / balance.grantedDays,
      remainingAfterRequest: balance.remainingDays - request.daysRequested
    };
  }

  private async analyzeLeaveHistory(employeeId: string): Promise<LeaveHistoryAnalysis> {
    // 過去の休暇使用パターン分析
    const pastYear = new Date();
    pastYear.setFullYear(pastYear.getFullYear() - 1);
    
    const requests = await this.getLeaveRequestsByPeriod(employeeId, pastYear, new Date());
    
    return {
      averageRequestsPerMonth: requests.length / 12,
      averageDuration: requests.reduce((sum, r) => sum + r.daysRequested, 0) / requests.length || 0,
      cancellationRate: requests.filter(r => r.status === 'cancelled').length / requests.length || 0,
      reliability: 1 - (requests.filter(r => r.status === 'cancelled').length / requests.length || 0)
    };
  }

  private async analyzeTeamImpact(request: LeaveRequest): Promise<TeamImpactAnalysis> {
    const employee = await this.db.getEmployee(request.employeeId);
    if (!employee) return { impact: 'unknown' };

    // 同じ期間の他の休暇申請をチェック
    const overlappingRequests = await this.getOverlappingRequests(
      employee.department, 
      request.startDate, 
      request.endDate
    );

    const teamSize = await this.getDepartmentSize(employee.department);
    const impactRatio = overlappingRequests.length / teamSize;

    return {
      overlappingRequests: overlappingRequests.length,
      teamSize,
      impactRatio,
      riskLevel: impactRatio > 0.3 ? 'high' : impactRatio > 0.15 ? 'medium' : 'low'
    };
  }

  private async analyzeCompliance(request: LeaveRequest): Promise<ComplianceAnalysis> {
    const policy = await this.getLeavePolicy(request.leaveType);
    const issues: string[] = [];

    // 事前申請期間チェック
    const daysUntilStart = Math.ceil((request.startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilStart < policy.advanceNoticeDays) {
      issues.push(`事前申請期間不足（必要: ${policy.advanceNoticeDays}日前, 実際: ${daysUntilStart}日前）`);
    }

    // 連続休暇日数チェック
    if (policy.maxConsecutiveDays && request.daysRequested > policy.maxConsecutiveDays) {
      issues.push(`連続休暇日数上限超過（上限: ${policy.maxConsecutiveDays}日, 申請: ${request.daysRequested}日）`);
    }

    return {
      compliant: issues.length === 0,
      issues
    };
  }

  private async analyzeBusinessImpact(request: LeaveRequest): Promise<BusinessImpactAnalysis> {
    // ビジネスカレンダーとの照合（繁忙期、重要会議等）
    // 実装は簡略化
    return {
      criticalPeriod: false,
      businessRisk: 'low',
      alternatives: []
    };
  }

  private calculateRecommendation(
    balance: LeaveBalanceAnalysis,
    history: LeaveHistoryAnalysis,
    team: TeamImpactAnalysis,
    compliance: ComplianceAnalysis,
    business: BusinessImpactAnalysis
  ): ApprovalRecommendation {
    // AI判定ロジック（簡略化）
    
    let confidence = 0.5;
    const reasons: string[] = [];
    const riskFactors: string[] = [];
    const complianceIssues: string[] = [];

    // 残高分析
    if (balance.sufficient) {
      confidence += 0.2;
      reasons.push('十分な残高あり');
    } else {
      confidence -= 0.3;
      riskFactors.push('残高不足');
    }

    // 履歴分析
    if (history.reliability > 0.8) {
      confidence += 0.1;
      reasons.push('過去の利用実績良好');
    }

    // チーム影響分析
    if (team.riskLevel === 'high') {
      confidence -= 0.2;
      riskFactors.push('チームへの影響大');
    }

    // コンプライアンス分析
    if (!compliance.compliant) {
      confidence -= 0.4;
      complianceIssues.push(...compliance.issues);
    }

    let recommendedAction: 'approve' | 'reject' | 'request_more_info' = 'approve';
    
    if (confidence < 0.3 || complianceIssues.length > 0) {
      recommendedAction = 'reject';
    } else if (confidence < 0.6) {
      recommendedAction = 'request_more_info';
    }

    return {
      requestId: '', // 呼び出し元で設定
      recommendedAction,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasons,
      riskFactors,
      complianceIssues,
      alternativeDates: []
    };
  }

  private calculateRiskLevel(balance: LeaveBalance, usageRate: number, currentDate: Date): 'low' | 'medium' | 'high' {
    if (balance.expiryDate) {
      const daysUntilExpiry = Math.ceil((balance.expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 90 && balance.remainingDays > 5) {
        return 'high';
      } else if (daysUntilExpiry < 180 && balance.remainingDays > 10) {
        return 'medium';
      }
    }
    
    if (usageRate < 0.3) {
      return 'medium';
    }
    
    return 'low';
  }

  private generateUsageRecommendations(usageRate: number, riskLevel: string, balance: LeaveBalance): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'high') {
      recommendations.push('有給休暇の失効リスクがあります。早めの取得をお勧めします。');
    }
    
    if (usageRate < 0.5) {
      recommendations.push('年間を通して計画的な有給取得をお勧めします。');
    }
    
    if (balance.remainingDays > 15) {
      recommendations.push('長期休暇の取得を検討してみてください。');
    }
    
    return recommendations;
  }

  private analyzeMonthlyUsage(requests: LeaveRequest[]): { [month: string]: number } {
    const monthlyUsage: { [month: string]: number } = {};
    
    requests.forEach(request => {
      const month = request.startDate.toISOString().substring(0, 7); // YYYY-MM
      monthlyUsage[month] = (monthlyUsage[month] || 0) + request.daysRequested;
    });
    
    return monthlyUsage;
  }

  private findMostCommonLeaveType(requests: LeaveRequest[]): LeaveType {
    const typeCount: { [key in LeaveType]?: number } = {};
    
    requests.forEach(request => {
      typeCount[request.leaveType] = (typeCount[request.leaveType] || 0) + 1;
    });
    
    return Object.entries(typeCount)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] as LeaveType || 'annual';
  }

  // データベースアクセスメソッド（実装簡略化）
  private async saveLeaveAllocation(allocation: AutomaticLeaveAllocation): Promise<void> {
    // 実装省略
  }

  private async updateLeaveBalance(allocation: AutomaticLeaveAllocation): Promise<void> {
    // 実装省略
  }

  private async getLeaveBalanceByYear(employeeId: string, leaveType: LeaveType, year: number): Promise<LeaveBalance | null> {
    // 実装省略
    return null;
  }

  private async calculateLeaveCarryover(employeeId: string, fromYear: number, toYear: number): Promise<LeaveCarryover | null> {
    // 実装省略
    return null;
  }

  private async saveLeaveCarryover(carryover: LeaveCarryover): Promise<void> {
    // 実装省略
  }

  private async calculateLeaveExpiry(employeeId: string, year: number, currentDate: Date): Promise<LeaveExpiry | null> {
    // 実装省略
    return null;
  }

  private async saveLeaveExpiry(expiry: LeaveExpiry): Promise<void> {
    // 実装省略
  }

  private async notifyLeaveExpiry(expiry: LeaveExpiry): Promise<void> {
    // 実装省略
  }

  private async getLeaveRequest(requestId: string): Promise<LeaveRequest | null> {
    // 実装省略
    return null;
  }

  private async getLeaveRequestsByPeriod(employeeId: string, startDate: Date, endDate: Date): Promise<LeaveRequest[]> {
    // 実装省略
    return [];
  }

  private async getPendingRequests(employeeId: string, leaveType: LeaveType): Promise<LeaveRequest[]> {
    // 実装省略
    return [];
  }

  private async getOverlappingRequests(department: string, startDate: Date, endDate: Date): Promise<LeaveRequest[]> {
    // 実装省略
    return [];
  }

  private async getDepartmentSize(department: string): Promise<number> {
    // 実装省略
    return 10;
  }

  private async getLeavePolicy(leaveType: LeaveType): Promise<LeavePolicy> {
    // 実装省略
    return {} as LeavePolicy;
  }
}

export default AutomaticLeaveManagement;