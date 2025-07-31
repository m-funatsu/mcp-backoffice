/**
 * 人的資本管理ドメイン型定義
 * @module domain/human-capital
 * @description 人的資本開示・管理に関する全てのドメイン型定義
 */

import type { Result } from '../core/result.js';
import type { Money } from '../core/money.js';
import type { DateTime } from '../core/datetime.js';
import type { ValidationError } from '../core/validation.js';
import type { EntityBase, AuditableEntity } from '../core/entity.js';
import type { Employee } from './employee.js';

// ================================
// ISO 30414準拠メトリクス
// ================================

/**
 * 人的資本メトリクス
 * @description ISO 30414準拠の人的資本指標
 */
export interface HumanCapitalMetrics {
  readonly compliance: ComplianceMetrics;
  readonly costs: CostMetrics;
  readonly diversity: DiversityMetrics;
  readonly leadership: LeadershipMetrics;
  readonly culture: CultureMetrics;
  readonly safety: SafetyMetrics;
  readonly productivity: ProductivityMetrics;
  readonly recruitment: RecruitmentMetrics;
  readonly skills: SkillsMetrics;
  readonly workforce: WorkforceMetrics;
  readonly japanese: JapaneseSpecificMetrics;
  readonly metadata: MetricsMetadata;
}

/**
 * メトリクスメタデータ
 * @description メトリクスの付加情報
 */
export interface MetricsMetadata {
  readonly calculatedAt: DateTime;
  readonly periodStart: DateTime;
  readonly periodEnd: DateTime;
  readonly dataCompleteness: number; // 0-1
  readonly certificationStatus?: CertificationStatus;
  readonly benchmarkComparison?: BenchmarkComparison;
}

/**
 * 認証ステータス
 * @description ISO認証等の状況
 */
export interface CertificationStatus {
  readonly iso30414Certified: boolean;
  readonly certificationDate?: DateTime;
  readonly certificationBody?: string;
  readonly validUntil?: DateTime;
}

/**
 * ベンチマーク比較
 * @description 業界平均との比較
 */
export interface BenchmarkComparison {
  readonly industryAverage: Partial<HumanCapitalMetrics>;
  readonly ranking?: number;
  readonly percentile?: number;
}

// ================================
// コンプライアンス＆倫理
// ================================

/**
 * コンプライアンスメトリクス
 * @description 11.1 - Compliance & Ethics
 */
export interface ComplianceMetrics {
  readonly ethicsTrainingCompletionRate: number;
  readonly whistleblowerCases: number;
  readonly legalViolations: number;
  readonly finesAndPenalties: Money;
  readonly complianceRating: number; // 1-5
  readonly harassmentIncidents: number;
  readonly harassmentResolutionRate: number;
  readonly ethicsHotlineCalls: number;
  readonly ethicsTrainingHours: number;
  readonly codeOfConductAcknowledgment: number;
  readonly complianceScore: number;
  readonly harassmentIncidentRate: number;
  readonly incidentTypes: Readonly<Record<string, number>>;
  readonly incidentsBySeverity: IncidentsBySeverity;
}

/**
 * 重大度別インシデント
 * @description インシデントの重大度別集計
 */
export interface IncidentsBySeverity {
  readonly critical: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

// ================================
// コスト
// ================================

/**
 * コストメトリクス
 * @description 11.2 - Costs
 */
export interface CostMetrics {
  readonly totalRemunerationCost: Money;
  readonly totalRecruitmentCost: Money;
  readonly totalTrainingCost: Money;
  readonly totalHealthAndSafetyCost: Money;
  readonly externalWorkforceCost: Money;
  readonly remunerationCostPerEmployee: Money;
  readonly recruitmentCostPerHire: Money;
  readonly trainingCostPerEmployee: Money;
  readonly totalCompensationRatio: number;
  readonly benefitsCostPerEmployee: Money;
  readonly overtimeCostPerEmployee: Money;
  readonly absenteeismCost: Money;
  readonly turnoverCost: Money;
  readonly workforceProductivityValue: Money;
}

// ================================
// ダイバーシティ
// ================================

/**
 * ダイバーシティメトリクス
 * @description 11.3 - Diversity
 */
export interface DiversityMetrics {
  readonly ageGroupDistribution: AgeGroupDistribution;
  readonly genderDistribution: GenderDistribution;
  readonly nationalityDistribution: NationalityDistribution;
  readonly disabilityRate: number;
  readonly diversityInLeadership: DiversityInLeadership;
  readonly payGapByGender: PayGapByGender;
  readonly diversityTrainingParticipation: number;
  readonly diversityIndex: number;
  readonly inclusionScore: number;
  readonly equalOpportunityRate: number;
  readonly minorityRepresentation: number;
}

/**
 * 年齢層分布
 * @description 年齢層別の従業員分布
 */
export interface AgeGroupDistribution {
  readonly under25: number;
  readonly age25to34: number;
  readonly age35to44: number;
  readonly age45to54: number;
  readonly age55to64: number;
  readonly over65: number;
  readonly averageAge: number;
  readonly medianAge: number;
}

/**
 * 性別分布
 * @description 性別による従業員分布
 */
export interface GenderDistribution {
  readonly male: number;
  readonly female: number;
  readonly other: number;
  readonly notDisclosed: number;
  readonly femaleRatio: number;
  readonly maleRatio: number;
}

/**
 * 国籍分布
 * @description 国籍別の従業員分布
 */
export interface NationalityDistribution {
  readonly japanese: number;
  readonly foreign: number;
  readonly byCountry: Readonly<Record<string, number>>;
  readonly diversityRatio: number;
}

/**
 * リーダーシップにおけるダイバーシティ
 * @description 管理職層のダイバーシティ指標
 */
export interface DiversityInLeadership {
  readonly femaleLeadershipRatio: number;
  readonly foreignLeadershipRatio: number;
  readonly disabilityLeadershipRatio: number;
  readonly ageDistribution: AgeGroupDistribution;
}

/**
 * 性別賃金格差
 * @description 性別による賃金格差指標
 */
export interface PayGapByGender {
  readonly meanGap: number;
  readonly medianGap: number;
  readonly byJobLevel: Readonly<Record<string, number>>;
  readonly byDepartment: Readonly<Record<string, number>>;
}

// ================================
// リーダーシップ
// ================================

/**
 * リーダーシップメトリクス
 * @description 11.4 - Leadership
 */
export interface LeadershipMetrics {
  readonly leadershipDevelopmentParticipation: number;
  readonly leadershipRatio: number;
  readonly leadershipSuccessionRate: number;
  readonly leadershipEffectivenessScore: number;
  readonly averageLeadershipTenure: number;
  readonly leadershipPipelineStrength: number;
  readonly internalPromotionRate: number;
  readonly leadershipDiversityScore: number;
  readonly managementSpanOfControl: number;
  readonly leadershipEngagementScore: number;
  readonly executiveTurnoverRate: number;
  readonly highPotentialIdentification: number;
  readonly leadershipReadinessRate: number;
}

// ================================
// 組織文化
// ================================

/**
 * 組織文化メトリクス
 * @description 11.5 - Organizational Culture
 */
export interface CultureMetrics {
  readonly employeeEngagementScore: number;
  readonly cultureSurveyParticipation: number;
  readonly eNPS: number; // Employee Net Promoter Score
  readonly workLifeBalanceScore: number;
  readonly innovationIndex: number;
  readonly collaborationScore: number;
  readonly recognitionRate: number;
  readonly psychologicalSafetyScore: number;
  readonly organizationalTrustIndex: number;
  readonly changeReadinessScore: number;
  readonly valueAlignmentScore: number;
  readonly cultureHealthIndex: number;
  readonly employeeSatisfactionRate: number;
  readonly wellbeingScore: number;
}

// ================================
// 健康と安全
// ================================

/**
 * 安全メトリクス
 * @description 11.6 - Organizational Health & Safety
 */
export interface SafetyMetrics {
  readonly lostTimeInjuryFrequency: number;
  readonly totalRecordableIncidentRate: number;
  readonly workplaceFatalities: number;
  readonly nearMissReporting: number;
  readonly safetyTrainingCompletionRate: number;
  readonly safetyAuditScore: number;
  readonly ergonomicAssessmentCoverage: number;
  readonly mentalHealthSupportUtilization: number;
  readonly stressLevelIndex: number;
  readonly healthCheckParticipation: number;
  readonly occupationalDiseaseRate: number;
  readonly returnToWorkRate: number;
  readonly preventiveMeasureEffectiveness: number;
}

// ================================
// 生産性
// ================================

/**
 * 生産性メトリクス
 * @description 11.7 - Productivity
 */
export interface ProductivityMetrics {
  readonly revenuePerEmployee: Money;
  readonly profitPerEmployee: Money;
  readonly humanCapitalROI: number;
  readonly valueAddedPerEmployee: Money;
  readonly outputPerHour: Money;
  readonly utilizationRate: number;
  readonly efficiencyRatio: number;
  readonly innovationOutputRate: number;
  readonly processImprovementRate: number;
  readonly automationImpact: number;
  readonly collaborationEffectiveness: number;
  readonly knowledgeSharingIndex: number;
}

// ================================
// 採用と離職
// ================================

/**
 * 採用メトリクス
 * @description 11.8 - Recruitment & Turnover
 */
export interface RecruitmentMetrics {
  readonly timeToFill: number; // days
  readonly timeToHire: number; // days
  readonly costPerHire: Money;
  readonly qualityOfHire: number;
  readonly applicationConversionRate: number;
  readonly offerAcceptanceRate: number;
  readonly sourceEffectiveness: Readonly<Record<string, number>>;
  readonly candidateExperienceScore: number;
  readonly diversityHiringRate: number;
  readonly internalMobilityRate: number;
  readonly turnoverRate: number;
  readonly voluntaryTurnoverRate: number;
  readonly involuntaryTurnoverRate: number;
  readonly regrettedTurnoverRate: number;
  readonly retentionRate: number;
  readonly firstYearTurnoverRate: number;
  readonly averageTenure: number;
}

// ================================
// スキルと能力
// ================================

/**
 * スキルメトリクス
 * @description 11.9 - Skills & Capabilities
 */
export interface SkillsMetrics {
  readonly trainingHoursPerEmployee: number;
  readonly trainingROI: number;
  readonly skillGapIndex: number;
  readonly competencyAchievementRate: number;
  readonly criticalSkillCoverage: number;
  readonly crossSkillRatio: number;
  readonly certificationRate: number;
  readonly digitalSkillsIndex: number;
  readonly leadershipCapabilityIndex: number;
  readonly technicalExpertiseRatio: number;
  readonly learningEngagementRate: number;
  readonly skillDevelopmentVelocity: number;
  readonly futureSkillReadiness: number;
  readonly knowledgeRetentionRate: number;
}

// ================================
// 労働力可用性
// ================================

/**
 * 労働力メトリクス
 * @description 11.10 - Workforce Availability
 */
export interface WorkforceMetrics {
  readonly totalHeadcount: number;
  readonly FTE: number; // Full-Time Equivalent
  readonly contractorRatio: number;
  readonly temporaryWorkerRatio: number;
  readonly absenteeismRate: number;
  readonly overtimeRate: number;
  readonly scheduledWorkingHours: number;
  readonly actualWorkingHours: number;
  readonly vacancyRate: number;
  readonly workforceFlexibility: number;
  readonly contingentWorkforceRatio: number;
  readonly remoteWorkRatio: number;
  readonly workloadDistribution: WorkloadDistribution;
  readonly capacityUtilization: number;
}

/**
 * 作業負荷分布
 * @description 部門・チーム別の作業負荷
 */
export interface WorkloadDistribution {
  readonly byDepartment: Readonly<Record<string, number>>;
  readonly byTeam: Readonly<Record<string, number>>;
  readonly balanceScore: number;
}

// ================================
// 日本固有メトリクス
// ================================

/**
 * 日本固有メトリクス
 * @description 日本の労働法・慣行に基づく指標
 */
export interface JapaneseSpecificMetrics {
  readonly regularEmployeeRatio: number;
  readonly nonRegularEmployeeRatio: number;
  readonly midCareerHiringRatio: number;
  readonly newGraduateHiringRatio: number;
  readonly monthlyOvertimeAverage: number;
  readonly paidLeaveUtilizationRate: number;
  readonly childcareLeaveUtilizationRate: number;
  readonly eldercareLeaveUtilizationRate: number;
  readonly karoshiRiskIndex: number;
  readonly workStyleReformIndex: number;
  readonly healthManagementScore: number;
  readonly lifetimeEmploymentRate: number;
  readonly bonusToSalaryRatio: number;
  readonly springNegotiationIncrease: number;
}

// ================================
// レポート関連型定義
// ================================

/**
 * 人的資本レポート
 * @description 人的資本開示レポート
 */
export interface HumanCapitalReport extends AuditableEntity {
  readonly reportType: ReportType;
  readonly period: ReportPeriod;
  readonly metrics: HumanCapitalMetrics;
  readonly narrative: ReportNarrative;
  readonly visualizations: ReadonlyArray<DataVisualization>;
  readonly certifications: ReadonlyArray<ReportCertification>;
  readonly status: ReportStatus;
  readonly publishedAt?: DateTime;
  readonly externalUrl?: string;
}

/** レポートタイプ */
export type ReportType = 
  | 'annual' 
  | 'quarterly' 
  | 'monthly' 
  | 'securities_filing' 
  | 'sustainability' 
  | 'integrated';

/**
 * レポート期間
 * @description レポートの対象期間
 */
export interface ReportPeriod {
  readonly startDate: DateTime;
  readonly endDate: DateTime;
  readonly fiscalYear: number;
  readonly quarter?: number;
}

/**
 * レポート記述
 * @description 定性的な説明文
 */
export interface ReportNarrative {
  readonly executiveSummary: string;
  readonly keyHighlights: ReadonlyArray<string>;
  readonly challenges: ReadonlyArray<string>;
  readonly futureOutlook: string;
  readonly strategicInitiatives: ReadonlyArray<StrategicInitiative>;
}

/**
 * 戦略的イニシアチブ
 * @description 人的資本に関する戦略的取り組み
 */
export interface StrategicInitiative {
  readonly name: string;
  readonly description: string;
  readonly targetMetrics: ReadonlyArray<string>;
  readonly timeline: string;
  readonly expectedImpact: string;
}

/**
 * データ可視化
 * @description グラフ・チャート情報
 */
export interface DataVisualization {
  readonly type: VisualizationType;
  readonly title: string;
  readonly data: unknown;
  readonly description?: string;
}

/** 可視化タイプ */
export type VisualizationType = 
  | 'line_chart' 
  | 'bar_chart' 
  | 'pie_chart' 
  | 'heat_map' 
  | 'scatter_plot' 
  | 'dashboard';

/**
 * レポート認証
 * @description 第三者認証・監査
 */
export interface ReportCertification {
  readonly type: CertificationType;
  readonly certifier: string;
  readonly date: DateTime;
  readonly scope: string;
  readonly opinion?: string;
}

/** 認証タイプ */
export type CertificationType = 
  | 'audit' 
  | 'assurance' 
  | 'verification' 
  | 'certification';

/** レポートステータス */
export type ReportStatus = 
  | 'draft' 
  | 'review' 
  | 'approved' 
  | 'published' 
  | 'archived';

// ================================
// 計算エンジン関連
// ================================

/**
 * メトリクス計算オプション
 * @description メトリクス計算時のオプション
 */
export interface MetricsCalculationOptions {
  readonly includeContractors?: boolean;
  readonly includePartTime?: boolean;
  readonly excludeDepartments?: ReadonlyArray<string>;
  readonly customFilters?: ReadonlyArray<MetricsFilter>;
  readonly benchmarkData?: BenchmarkData;
}

/**
 * メトリクスフィルタ
 * @description カスタムフィルタ条件
 */
export interface MetricsFilter {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: unknown;
}

/** フィルタ演算子 */
export type FilterOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'greater_than' 
  | 'less_than' 
  | 'in' 
  | 'not_in';

/**
 * ベンチマークデータ
 * @description 比較用ベンチマークデータ
 */
export interface BenchmarkData {
  readonly source: string;
  readonly industry: string;
  readonly companySize: string;
  readonly year: number;
  readonly metrics: Partial<HumanCapitalMetrics>;
}

// ================================
// 分析・インサイト
// ================================

/**
 * 人的資本インサイト
 * @description 分析から得られた洞察
 */
export interface HumanCapitalInsights {
  readonly trends: ReadonlyArray<TrendInsight>;
  readonly correlations: ReadonlyArray<CorrelationInsight>;
  readonly predictions: ReadonlyArray<PredictionInsight>;
  readonly recommendations: ReadonlyArray<Recommendation>;
  readonly risks: ReadonlyArray<RiskInsight>;
}

/**
 * トレンドインサイト
 * @description 時系列トレンド分析
 */
export interface TrendInsight {
  readonly metric: string;
  readonly trend: 'improving' | 'stable' | 'declining';
  readonly changeRate: number;
  readonly significance: number;
  readonly explanation: string;
}

/**
 * 相関インサイト
 * @description メトリクス間の相関分析
 */
export interface CorrelationInsight {
  readonly metric1: string;
  readonly metric2: string;
  readonly correlation: number;
  readonly significance: number;
  readonly interpretation: string;
}

/**
 * 予測インサイト
 * @description 将来予測
 */
export interface PredictionInsight {
  readonly metric: string;
  readonly prediction: number;
  readonly confidence: number;
  readonly timeframe: string;
  readonly assumptions: ReadonlyArray<string>;
}

/**
 * 推奨事項
 * @description 改善のための推奨事項
 */
export interface Recommendation {
  readonly area: string;
  readonly priority: 'high' | 'medium' | 'low';
  readonly action: string;
  readonly expectedImpact: string;
  readonly effort: 'low' | 'medium' | 'high';
  readonly timeline: string;
}

/**
 * リスクインサイト
 * @description 識別されたリスク
 */
export interface RiskInsight {
  readonly area: string;
  readonly risk: string;
  readonly likelihood: 'low' | 'medium' | 'high';
  readonly impact: 'low' | 'medium' | 'high';
  readonly mitigation: string;
}

// ================================
// エクスポート
// ================================

export type {
  // Re-export commonly used types
  Result,
  Money,
  DateTime,
  ValidationError,
  Employee
};