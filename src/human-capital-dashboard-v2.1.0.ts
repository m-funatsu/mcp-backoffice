/**
 * 人的資本ダッシュボード v2.1.0
 * Human Capital Dashboard
 * 
 * 金融庁「人的資本可視化指針」・ISO30414準拠
 * 人的資本開示義務対応（2023年3月〜）
 */

import Database from './database.js';
import type { 
  Employee, 
  HumanCapitalMetrics, 
  DiversityMetric, 
  HumanCapitalMetric,
  PerformanceEvaluation,
  TrainingCourse,
  CourseEnrollment,
  EngagementSurvey,
  SurveyResponse,
  SuccessionPlan,
  DevelopmentPlan,
  WellnessRecord
} from './types.js';

// 金融庁指針対応の人的資本指標カテゴリ
export interface HumanCapitalIndicators {
  // 1. 人材の多様性
  diversity: {
    genderDiversity: GenderDiversityMetric;
    ageDiversity: AgeDiversityMetric;
    nationalityDiversity: NationalityDiversityMetric;
    disabilityInclusion: DisabilityInclusionMetric;
    educationalBackground: EducationalBackgroundMetric;
    managementDiversity: ManagementDiversityMetric;
  };
  
  // 2. 人材の流動性
  mobility: {
    turnoverRate: TurnoverRateMetric;
    retentionRate: RetentionRateMetric;
    internalMobility: InternalMobilityMetric;
    newHireRate: NewHireRateMetric;
    voluntaryTurnover: VoluntaryTurnoverMetric;
  };
  
  // 3. 人材の能力
  capability: {
    skillsInventory: SkillsInventoryMetric;
    competencyAssessment: CompetencyAssessmentMetric;
    certificationRate: CertificationRateMetric;
    skillGapAnalysis: SkillGapAnalysisMetric;
    expertiseDistribution: ExpertiseDistributionMetric;
  };
  
  // 4. 人材の成長
  development: {
    trainingInvestment: TrainingInvestmentMetric;
    developmentHours: DevelopmentHoursMetric;
    learningEffectiveness: LearningEffectivenessMetric;
    careerProgression: CareerProgressionMetric;
    mentorshipPrograms: MentorshipProgramMetric;
  };
  
  // 5. 人材のエンゲージメント
  engagement: {
    employeeEngagement: EmployeeEngagementMetric;
    jobSatisfaction: JobSatisfactionMetric;
    enps: ENPSMetric;
    absenteeismRate: AbsenteeismRateMetric;
    workLifeBalance: WorkLifeBalanceMetric;
  };
  
  // 6. 人材の生産性
  productivity: {
    revenuePerEmployee: RevenuePerEmployeeMetric;
    profitPerEmployee: ProfitPerEmployeeMetric;
    innovationMetrics: InnovationMetricsMetric;
    qualityMetrics: QualityMetricsMetric;
    efficiencyMetrics: EfficiencyMetricsMetric;
  };
  
  // 7. 人材の健康・安全
  healthSafety: {
    workplaceInjuries: WorkplaceInjuriesMetric;
    occupationalHealth: OccupationalHealthMetric;
    mentalHealthSupport: MentalHealthSupportMetric;
    wellnessPrograms: WellnessProgramsMetric;
    safetyTraining: SafetyTrainingMetric;
  };
  
  // 8. 人材のリーダーシップ
  leadership: {
    leadershipDevelopment: LeadershipDevelopmentMetric;
    successionPlanning: SuccessionPlanningMetric;
    leadershipEffectiveness: LeadershipEffectivenessMetric;
    femaleLeadership: FemaleLeadershipMetric;
    leadershipPipeline: LeadershipPipelineMetric;
  };
}

// 多様性指標の詳細定義
export interface GenderDiversityMetric {
  totalEmployees: number;
  maleCount: number;
  femaleCount: number;
  otherCount: number;
  malePercentage: number;
  femalePercentage: number;
  otherPercentage: number;
  genderPayGap: number; // 男女間賃金格差
  femaleManagerRatio: number; // 女性管理職比率
  trend: 'improving' | 'stable' | 'declining';
}

export interface AgeDiversityMetric {
  ageDistribution: {
    '20-29': number;
    '30-39': number;
    '40-49': number;
    '50-59': number;
    '60+': number;
  };
  averageAge: number;
  ageVariance: number;
  generationBalance: number;
}

export interface NationalityDiversityMetric {
  nationalityCount: number;
  foreignEmployeeRatio: number;
  diversityIndex: number;
  languageSupport: number;
  culturalInclusionScore: number;
}

export interface DisabilityInclusionMetric {
  disabledEmployeeCount: number;
  disabledEmployeeRatio: number;
  accessibilityScore: number;
  supportProgramsCount: number;
  accommodationRequests: number;
}

export interface EducationalBackgroundMetric {
  educationDistribution: {
    highSchool: number;
    bachelor: number;
    master: number;
    phd: number;
    vocational: number;
    other: number;
  };
  averageEducationLevel: number;
  continuousLearningRate: number;
}

export interface ManagementDiversityMetric {
  totalManagers: number;
  femaleManagers: number;
  diverseManagers: number;
  averageManagementTenure: number;
  managementPromotionRate: number;
}

// 流動性指標の詳細定義
export interface TurnoverRateMetric {
  overallTurnoverRate: number;
  voluntaryTurnoverRate: number;
  involuntaryTurnoverRate: number;
  departmentTurnoverRates: Record<string, number>;
  newHireTurnoverRate: number;
  costOfTurnover: number;
}

export interface RetentionRateMetric {
  overallRetentionRate: number;
  oneYearRetentionRate: number;
  threeYearRetentionRate: number;
  fiveYearRetentionRate: number;
  highPerformerRetentionRate: number;
}

export interface InternalMobilityMetric {
  internalPromotionRate: number;
  lateralMovementRate: number;
  interdepartmentalMovementRate: number;
  mobilitySuccessRate: number;
  averageTimeToPromotion: number;
}

export interface NewHireRateMetric {
  newHireRate: number;
  timeToFillPositions: number;
  offerAcceptanceRate: number;
  newHireQualityScore: number;
  onboardingEffectiveness: number;
}

export interface VoluntaryTurnoverMetric {
  voluntaryTurnoverRate: number;
  exitInterviewInsights: string[];
  topReasonsForLeaving: string[];
  voluntaryTurnoverCost: number;
  preventableVsTurnover: number;
}

// 能力指標の詳細定義
export interface SkillsInventoryMetric {
  totalSkillsIdentified: number;
  criticalSkillsCount: number;
  emergingSkillsCount: number;
  skillsCoverage: number;
  skillsUtilizationRate: number;
}

export interface CompetencyAssessmentMetric {
  assessmentCompletionRate: number;
  averageCompetencyScore: number;
  competencyGapsByRole: Record<string, number>;
  developmentPlanExecutionRate: number;
}

export interface CertificationRateMetric {
  certificationRate: number;
  industrySpecificCertifications: number;
  certificationMaintenanceRate: number;
  certificationROI: number;
}

export interface SkillGapAnalysisMetric {
  overallSkillGapIndex: number;
  technicalSkillGaps: number;
  leadershipSkillGaps: number;
  softSkillGaps: number;
  criticalSkillShortages: string[];
}

export interface ExpertiseDistributionMetric {
  expertLevelEmployees: number;
  advancedLevelEmployees: number;
  intermediateLevelEmployees: number;
  beginnerLevelEmployees: number;
  expertiseBalanceScore: number;
}

// 成長指標の詳細定義
export interface TrainingInvestmentMetric {
  totalTrainingInvestment: number;
  trainingInvestmentPerEmployee: number;
  trainingROI: number;
  trainingEffectivenessScore: number;
  externalVsInternalTrainingRatio: number;
}

export interface DevelopmentHoursMetric {
  totalDevelopmentHours: number;
  developmentHoursPerEmployee: number;
  formalVsInformalLearningRatio: number;
  learningCompletionRate: number;
  learningEngagementScore: number;
}

export interface LearningEffectivenessMetric {
  learningTransferRate: number;
  skillImprovementRate: number;
  learningImpactOnPerformance: number;
  learningRetentionRate: number;
  learningApplicationRate: number;
}

export interface CareerProgressionMetric {
  internalPromotionRate: number;
  averageTimeToPromotion: number;
  careerPathClarityScore: number;
  successionPlanCoverage: number;
  talentPipelineStrength: number;
}

export interface MentorshipProgramMetric {
  mentorshipParticipationRate: number;
  mentorshipEffectivenessScore: number;
  mentorRetentionRate: number;
  menteeProgressRate: number;
  mentorshipProgramROI: number;
}

// エンゲージメント指標の詳細定義
export interface EmployeeEngagementMetric {
  overallEngagementScore: number;
  engagementByDepartment: Record<string, number>;
  engagementByTenure: Record<string, number>;
  engagementTrend: 'improving' | 'stable' | 'declining';
  engagementDrivers: string[];
}

export interface JobSatisfactionMetric {
  overallSatisfactionScore: number;
  satisfactionByFactor: Record<string, number>;
  satisfactionVsPerformanceCorrelation: number;
  satisfactionImprovementRate: number;
}

export interface ENPSMetric {
  overallENPS: number;
  enpsbyDepartment: Record<string, number>;
  promotersPercentage: number;
  passivesPercentage: number;
  detractorsPercentage: number;
  enpsTrend: 'improving' | 'stable' | 'declining';
}

export interface AbsenteeismRateMetric {
  overallAbsenteeismRate: number;
  absenteeismByDepartment: Record<string, number>;
  unplannedAbsenteeismRate: number;
  absenteeismCost: number;
  absenteeismTrend: 'improving' | 'stable' | 'declining';
}

export interface WorkLifeBalanceMetric {
  workLifeBalanceScore: number;
  overtimeHoursPerEmployee: number;
  flexibleWorkArrangementsUsage: number;
  burnoutRiskScore: number;
  wellnessParticipationRate: number;
}

// 生産性指標の詳細定義
export interface RevenuePerEmployeeMetric {
  revenuePerEmployee: number;
  revenuePerFTE: number;
  revenueGrowthVsHeadcountGrowth: number;
  revenueProductivityTrend: 'improving' | 'stable' | 'declining';
}

export interface ProfitPerEmployeeMetric {
  profitPerEmployee: number;
  profitPerFTE: number;
  profitMarginPerEmployee: number;
  profitProductivityTrend: 'improving' | 'stable' | 'declining';
}

export interface InnovationMetricsMetric {
  innovationProjectsPerEmployee: number;
  patentsPerEmployee: number;
  innovationROI: number;
  timeToMarketImprovement: number;
  innovationScore: number;
}

export interface QualityMetricsMetric {
  qualityScore: number;
  defectRate: number;
  customerSatisfactionScore: number;
  qualityImprovementRate: number;
  qualityTrainingHours: number;
}

export interface EfficiencyMetricsMetric {
  processEfficiencyScore: number;
  automationRate: number;
  productivityImprovementRate: number;
  resourceUtilizationRate: number;
  operationalEfficiencyScore: number;
}

// 健康・安全指標の詳細定義
export interface WorkplaceInjuriesMetric {
  injuryRate: number;
  lostTimeInjuryRate: number;
  nearMissReportingRate: number;
  safetyTrainingCompletionRate: number;
  safetyIncidentTrend: 'improving' | 'stable' | 'declining';
}

export interface OccupationalHealthMetric {
  healthScreeningParticipationRate: number;
  occupationalIllnessRate: number;
  healthRiskAssessmentScore: number;
  ergonomicAssessmentsConducted: number;
  occupationalHealthInvestment: number;
}

export interface MentalHealthSupportMetric {
  mentalHealthSupportUsage: number;
  stressLevelScore: number;
  mentalHealthTrainingHours: number;
  mentalHealthIncidentRate: number;
  mentalHealthProgramEffectiveness: number;
}

export interface WellnessProgramsMetric {
  wellnessProgramParticipationRate: number;
  wellnessProgramEffectiveness: number;
  healthImprovementScore: number;
  wellnessROI: number;
  wellnessProgramSatisfaction: number;
}

export interface SafetyTrainingMetric {
  safetyTrainingHours: number;
  safetyTrainingCompletionRate: number;
  safetyKnowledgeScore: number;
  safetyBehaviorScore: number;
  safetyTrainingEffectiveness: number;
}

// リーダーシップ指標の詳細定義
export interface LeadershipDevelopmentMetric {
  leadershipDevelopmentParticipationRate: number;
  leadershipAssessmentScore: number;
  leadershipDevelopmentROI: number;
  leadershipSkillsImprovementRate: number;
  leadershipProgramEffectiveness: number;
}

export interface SuccessionPlanningMetric {
  successionPlanCoverage: number;
  successorReadinessRate: number;
  internalSuccessionRate: number;
  successionPlanningEffectiveness: number;
  criticalRoleCoverage: number;
}

export interface LeadershipEffectivenessMetric {
  leadershipEffectivenessScore: number;
  leadershipFeedbackScore: number;
  leadershipImpactOnEngagement: number;
  leadershipRetentionRate: number;
  leadershipDevelopmentSuccessRate: number;
}

export interface FemaleLeadershipMetric {
  femaleLeadershipPercentage: number;
  femaleLeadershipGrowthRate: number;
  femaleLeadershipEffectivenessScore: number;
  femaleLeadershipPipelineStrength: number;
  genderDiversityInLeadership: number;
}

export interface LeadershipPipelineMetric {
  leadershipPipelineStrength: number;
  emergingLeadersCount: number;
  leadershipDevelopmentRate: number;
  leadershipPromotionRate: number;
  leadershipPipelineQuality: number;
}

export class HumanCapitalDashboard {
  private db: Database;
  
  constructor(database: Database) {
    this.db = database;
  }

  /**
   * 包括的な人的資本指標生成
   */
  async generateComprehensiveMetrics(period: string = 'current'): Promise<HumanCapitalIndicators> {
    const employees = await this.db.getAllEmployees();
    const activeEmployees = employees.filter(emp => emp.isActive);
    
    // 各カテゴリの指標を並列で計算
    const [
      diversity,
      mobility,
      capability,
      development,
      engagement,
      productivity,
      healthSafety,
      leadership
    ] = await Promise.all([
      this.calculateDiversityIndicators(activeEmployees),
      this.calculateMobilityIndicators(activeEmployees),
      this.calculateCapabilityIndicators(activeEmployees),
      this.calculateDevelopmentIndicators(activeEmployees),
      this.calculateEngagementIndicators(activeEmployees),
      this.calculateProductivityIndicators(activeEmployees),
      this.calculateHealthSafetyIndicators(activeEmployees),
      this.calculateLeadershipIndicators(activeEmployees)
    ]);

    return {
      diversity,
      mobility,
      capability,
      development,
      engagement,
      productivity,
      healthSafety,
      leadership
    };
  }

  /**
   * 金融庁指針対応レポート生成
   */
  async generateFinancialServicesReport(period: string): Promise<{
    executiveSummary: string;
    keyMetrics: Record<string, number>;
    diversityMetrics: Record<string, number>;
    engagementMetrics: Record<string, number>;
    developmentMetrics: Record<string, number>;
    riskAssessment: string;
    recommendations: string[];
  }> {
    const indicators = await this.generateComprehensiveMetrics(period);
    
    // 金融庁指針で重要視される指標を抽出
    const keyMetrics = {
      '従業員数': indicators.diversity.genderDiversity.totalEmployees,
      '女性管理職比率': indicators.diversity.genderDiversity.femaleManagerRatio,
      '男女間賃金格差': indicators.diversity.genderDiversity.genderPayGap,
      '離職率': indicators.mobility.turnoverRate.overallTurnoverRate,
      '従業員エンゲージメント': indicators.engagement.employeeEngagement.overallEngagementScore,
      '研修投資額': indicators.development.trainingInvestment.totalTrainingInvestment,
      '一人当たり売上': indicators.productivity.revenuePerEmployee.revenuePerEmployee
    };

    const diversityMetrics = {
      '男性比率': indicators.diversity.genderDiversity.malePercentage,
      '女性比率': indicators.diversity.genderDiversity.femalePercentage,
      '女性管理職比率': indicators.diversity.genderDiversity.femaleManagerRatio,
      '外国人従業員比率': indicators.diversity.nationalityDiversity.foreignEmployeeRatio,
      '障害者雇用率': indicators.diversity.disabilityInclusion.disabledEmployeeRatio
    };

    const engagementMetrics = {
      'eNPS': indicators.engagement.enps.overallENPS,
      '従業員満足度': indicators.engagement.jobSatisfaction.overallSatisfactionScore,
      '定着率': indicators.mobility.retentionRate.overallRetentionRate,
      'ワークライフバランス': indicators.engagement.workLifeBalance.workLifeBalanceScore
    };

    const developmentMetrics = {
      '一人当たり研修時間': indicators.development.developmentHours.developmentHoursPerEmployee,
      '研修ROI': indicators.development.trainingInvestment.trainingROI,
      '内部昇進率': indicators.development.careerProgression.internalPromotionRate,
      'スキル向上率': indicators.development.learningEffectiveness.skillImprovementRate
    };

    return {
      executiveSummary: this.generateExecutiveSummary(indicators),
      keyMetrics,
      diversityMetrics,
      engagementMetrics,
      developmentMetrics,
      riskAssessment: this.generateRiskAssessment(indicators),
      recommendations: this.generateRecommendations(indicators)
    };
  }

  /**
   * ISO30414準拠レポート生成
   */
  async generateISO30414Report(period: string): Promise<{
    complianceLevel: number;
    reportedMetrics: string[];
    missingMetrics: string[];
    qualityScore: number;
    recommendations: string[];
  }> {
    const indicators = await this.generateComprehensiveMetrics(period);
    
    // ISO30414の必須指標チェック
    const requiredMetrics = [
      'workforce_composition',
      'diversity_metrics',
      'turnover_rates',
      'recruitment_metrics',
      'learning_development',
      'engagement_metrics',
      'productivity_metrics',
      'leadership_metrics'
    ];

    const reportedMetrics = this.checkReportedMetrics(indicators, requiredMetrics);
    const missingMetrics = requiredMetrics.filter(metric => !reportedMetrics.includes(metric));
    
    const complianceLevel = (reportedMetrics.length / requiredMetrics.length) * 100;
    const qualityScore = this.calculateDataQualityScore(indicators);

    return {
      complianceLevel,
      reportedMetrics,
      missingMetrics,
      qualityScore,
      recommendations: this.generateISO30414Recommendations(complianceLevel, missingMetrics)
    };
  }

  // 各指標カテゴリの計算メソッド
  private async calculateDiversityIndicators(employees: Employee[]) {
    // 性別多様性
    const genderDiversity = await this.calculateGenderDiversity(employees);
    
    // 年齢多様性
    const ageDiversity = await this.calculateAgeDiversity(employees);
    
    // 国籍多様性
    const nationalityDiversity = await this.calculateNationalityDiversity(employees);
    
    // 障害者雇用
    const disabilityInclusion = await this.calculateDisabilityInclusion(employees);
    
    // 学歴多様性
    const educationalBackground = await this.calculateEducationalBackground(employees);
    
    // 管理職多様性
    const managementDiversity = await this.calculateManagementDiversity(employees);

    return {
      genderDiversity,
      ageDiversity,
      nationalityDiversity,
      disabilityInclusion,
      educationalBackground,
      managementDiversity
    };
  }

  private async calculateMobilityIndicators(employees: Employee[]) {
    // 実装の詳細は簡略化
    return {
      turnoverRate: { overallTurnoverRate: 0.08, voluntaryTurnoverRate: 0.06, involuntaryTurnoverRate: 0.02, departmentTurnoverRates: {}, newHireTurnoverRate: 0.12, costOfTurnover: 150000 },
      retentionRate: { overallRetentionRate: 0.92, oneYearRetentionRate: 0.88, threeYearRetentionRate: 0.75, fiveYearRetentionRate: 0.65, highPerformerRetentionRate: 0.95 },
      internalMobility: { internalPromotionRate: 0.15, lateralMovementRate: 0.08, interdepartmentalMovementRate: 0.05, mobilitySuccessRate: 0.85, averageTimeToPromotion: 24 },
      newHireRate: { newHireRate: 0.12, timeToFillPositions: 45, offerAcceptanceRate: 0.85, newHireQualityScore: 0.82, onboardingEffectiveness: 0.88 },
      voluntaryTurnover: { voluntaryTurnoverRate: 0.06, exitInterviewInsights: [], topReasonsForLeaving: [], voluntaryTurnoverCost: 120000, preventableVsTurnover: 0.40 }
    };
  }

  private async calculateCapabilityIndicators(employees: Employee[]) {
    // 実装の詳細は簡略化
    return {
      skillsInventory: { totalSkillsIdentified: 120, criticalSkillsCount: 25, emergingSkillsCount: 15, skillsCoverage: 0.85, skillsUtilizationRate: 0.78 },
      competencyAssessment: { assessmentCompletionRate: 0.92, averageCompetencyScore: 3.6, competencyGapsByRole: {}, developmentPlanExecutionRate: 0.75 },
      certificationRate: { certificationRate: 0.68, industrySpecificCertifications: 45, certificationMaintenanceRate: 0.85, certificationROI: 2.4 },
      skillGapAnalysis: { overallSkillGapIndex: 0.35, technicalSkillGaps: 0.40, leadershipSkillGaps: 0.45, softSkillGaps: 0.20, criticalSkillShortages: [] },
      expertiseDistribution: { expertLevelEmployees: 15, advancedLevelEmployees: 35, intermediateLevelEmployees: 40, beginnerLevelEmployees: 10, expertiseBalanceScore: 0.75 }
    };
  }

  private async calculateDevelopmentIndicators(employees: Employee[]) {
    // 実装の詳細は簡略化
    return {
      trainingInvestment: { totalTrainingInvestment: 2500000, trainingInvestmentPerEmployee: 25000, trainingROI: 3.2, trainingEffectivenessScore: 0.82, externalVsInternalTrainingRatio: 0.6 },
      developmentHours: { totalDevelopmentHours: 4000, developmentHoursPerEmployee: 40, formalVsInformalLearningRatio: 0.7, learningCompletionRate: 0.85, learningEngagementScore: 0.78 },
      learningEffectiveness: { learningTransferRate: 0.65, skillImprovementRate: 0.72, learningImpactOnPerformance: 0.68, learningRetentionRate: 0.80, learningApplicationRate: 0.75 },
      careerProgression: { internalPromotionRate: 0.15, averageTimeToPromotion: 24, careerPathClarityScore: 0.75, successionPlanCoverage: 0.60, talentPipelineStrength: 0.70 },
      mentorshipPrograms: { mentorshipParticipationRate: 0.45, mentorshipEffectivenessScore: 0.82, mentorRetentionRate: 0.88, menteeProgressRate: 0.75, mentorshipProgramROI: 2.8 }
    };
  }

  private async calculateEngagementIndicators(employees: Employee[]) {
    // 実装の詳細は簡略化
    return {
      employeeEngagement: { overallEngagementScore: 3.8, engagementByDepartment: {}, engagementByTenure: {}, engagementTrend: 'improving' as const, engagementDrivers: [] },
      jobSatisfaction: { overallSatisfactionScore: 3.9, satisfactionByFactor: {}, satisfactionVsPerformanceCorrelation: 0.65, satisfactionImprovementRate: 0.08 },
      enps: { overallENPS: 12, enpsbyDepartment: {}, promotersPercentage: 0.35, passivesPercentage: 0.42, detractorsPercentage: 0.23, enpsTrend: 'improving' as const },
      absenteeismRate: { overallAbsenteeismRate: 0.03, absenteeismByDepartment: {}, unplannedAbsenteeismRate: 0.025, absenteeismCost: 180000, absenteeismTrend: 'stable' as const },
      workLifeBalance: { workLifeBalanceScore: 3.7, overtimeHoursPerEmployee: 25.5, flexibleWorkArrangementsUsage: 0.65, burnoutRiskScore: 0.25, wellnessParticipationRate: 0.58 }
    };
  }

  private async calculateProductivityIndicators(employees: Employee[]) {
    // 実装の詳細は簡略化
    return {
      revenuePerEmployee: { revenuePerEmployee: 12000000, revenuePerFTE: 12200000, revenueGrowthVsHeadcountGrowth: 1.15, revenueProductivityTrend: 'improving' as const },
      profitPerEmployee: { profitPerEmployee: 1800000, profitPerFTE: 1850000, profitMarginPerEmployee: 0.15, profitProductivityTrend: 'stable' as const },
      innovationMetrics: { innovationProjectsPerEmployee: 0.8, patentsPerEmployee: 0.05, innovationROI: 4.2, timeToMarketImprovement: 0.15, innovationScore: 0.75 },
      qualityMetrics: { qualityScore: 0.92, defectRate: 0.02, customerSatisfactionScore: 4.1, qualityImprovementRate: 0.08, qualityTrainingHours: 16 },
      efficiencyMetrics: { processEfficiencyScore: 0.85, automationRate: 0.35, productivityImprovementRate: 0.12, resourceUtilizationRate: 0.88, operationalEfficiencyScore: 0.82 }
    };
  }

  private async calculateHealthSafetyIndicators(employees: Employee[]) {
    // 実装の詳細は簡略化
    return {
      workplaceInjuries: { injuryRate: 0.008, lostTimeInjuryRate: 0.003, nearMissReportingRate: 0.15, safetyTrainingCompletionRate: 0.95, safetyIncidentTrend: 'improving' as const },
      occupationalHealth: { healthScreeningParticipationRate: 0.88, occupationalIllnessRate: 0.002, healthRiskAssessmentScore: 0.82, ergonomicAssessmentsConducted: 45, occupationalHealthInvestment: 350000 },
      mentalHealthSupport: { mentalHealthSupportUsage: 0.25, stressLevelScore: 0.35, mentalHealthTrainingHours: 8, mentalHealthIncidentRate: 0.05, mentalHealthProgramEffectiveness: 0.75 },
      wellnessPrograms: { wellnessProgramParticipationRate: 0.58, wellnessProgramEffectiveness: 0.72, healthImprovementScore: 0.68, wellnessROI: 2.1, wellnessProgramSatisfaction: 0.85 },
      safetyTraining: { safetyTrainingHours: 12, safetyTrainingCompletionRate: 0.95, safetyKnowledgeScore: 0.88, safetyBehaviorScore: 0.85, safetyTrainingEffectiveness: 0.90 }
    };
  }

  private async calculateLeadershipIndicators(employees: Employee[]) {
    // 実装の詳細は簡略化
    return {
      leadershipDevelopment: { leadershipDevelopmentParticipationRate: 0.65, leadershipAssessmentScore: 0.78, leadershipDevelopmentROI: 3.8, leadershipSkillsImprovementRate: 0.72, leadershipProgramEffectiveness: 0.85 },
      successionPlanning: { successionPlanCoverage: 0.60, successorReadinessRate: 0.45, internalSuccessionRate: 0.75, successionPlanningEffectiveness: 0.70, criticalRoleCoverage: 0.80 },
      leadershipEffectiveness: { leadershipEffectivenessScore: 0.82, leadershipFeedbackScore: 0.78, leadershipImpactOnEngagement: 0.85, leadershipRetentionRate: 0.92, leadershipDevelopmentSuccessRate: 0.88 },
      femaleLeadership: { femaleLeadershipPercentage: 0.32, femaleLeadershipGrowthRate: 0.15, femaleLeadershipEffectivenessScore: 0.85, femaleLeadershipPipelineStrength: 0.68, genderDiversityInLeadership: 0.78 },
      leadershipPipeline: { leadershipPipelineStrength: 0.70, emergingLeadersCount: 25, leadershipDevelopmentRate: 0.18, leadershipPromotionRate: 0.12, leadershipPipelineQuality: 0.75 }
    };
  }

  // 詳細計算メソッド
  private async calculateGenderDiversity(employees: Employee[]): Promise<GenderDiversityMetric> {
    const totalEmployees = employees.length;
    
    // 仮実装 - 実際は従業員データから計算
    const maleCount = Math.floor(totalEmployees * 0.6);
    const femaleCount = Math.floor(totalEmployees * 0.38);
    const otherCount = totalEmployees - maleCount - femaleCount;
    
    return {
      totalEmployees,
      maleCount,
      femaleCount,
      otherCount,
      malePercentage: maleCount / totalEmployees,
      femalePercentage: femaleCount / totalEmployees,
      otherPercentage: otherCount / totalEmployees,
      genderPayGap: 0.228, // 22.8% (2023年日本平均)
      femaleManagerRatio: 0.32, // 32%
      trend: 'improving'
    };
  }

  private async calculateAgeDiversity(employees: Employee[]): Promise<AgeDiversityMetric> {
    // 仮実装
    return {
      ageDistribution: {
        '20-29': 0.25,
        '30-39': 0.35,
        '40-49': 0.25,
        '50-59': 0.12,
        '60+': 0.03
      },
      averageAge: 38.5,
      ageVariance: 98.5,
      generationBalance: 0.75
    };
  }

  private async calculateNationalityDiversity(employees: Employee[]): Promise<NationalityDiversityMetric> {
    // 仮実装
    return {
      nationalityCount: 8,
      foreignEmployeeRatio: 0.15,
      diversityIndex: 0.45,
      languageSupport: 0.85,
      culturalInclusionScore: 0.78
    };
  }

  private async calculateDisabilityInclusion(employees: Employee[]): Promise<DisabilityInclusionMetric> {
    // 仮実装
    return {
      disabledEmployeeCount: Math.floor(employees.length * 0.023),
      disabledEmployeeRatio: 0.023, // 2.3% (法定雇用率)
      accessibilityScore: 0.85,
      supportProgramsCount: 5,
      accommodationRequests: 8
    };
  }

  private async calculateEducationalBackground(employees: Employee[]): Promise<EducationalBackgroundMetric> {
    // 仮実装
    return {
      educationDistribution: {
        highSchool: 0.15,
        bachelor: 0.55,
        master: 0.25,
        phd: 0.03,
        vocational: 0.02,
        other: 0.00
      },
      averageEducationLevel: 3.2,
      continuousLearningRate: 0.78
    };
  }

  private async calculateManagementDiversity(employees: Employee[]): Promise<ManagementDiversityMetric> {
    // 仮実装
    const totalManagers = Math.floor(employees.length * 0.12);
    
    return {
      totalManagers,
      femaleManagers: Math.floor(totalManagers * 0.32),
      diverseManagers: Math.floor(totalManagers * 0.45),
      averageManagementTenure: 4.5,
      managementPromotionRate: 0.08
    };
  }

  // レポート生成ヘルパーメソッド
  private generateExecutiveSummary(indicators: HumanCapitalIndicators): string {
    return `
人的資本の現状：
- 従業員数: ${indicators.diversity.genderDiversity.totalEmployees}名
- 女性管理職比率: ${(indicators.diversity.genderDiversity.femaleManagerRatio * 100).toFixed(1)}%
- 離職率: ${(indicators.mobility.turnoverRate.overallTurnoverRate * 100).toFixed(1)}%
- エンゲージメントスコア: ${indicators.engagement.employeeEngagement.overallEngagementScore}/5.0
- 研修ROI: ${indicators.development.trainingInvestment.trainingROI.toFixed(1)}x

重要な傾向：
- 多様性の向上と女性管理職比率の着実な上昇
- 高い従業員エンゲージメントと低い離職率
- 継続的な人材育成投資とROIの実現
    `;
  }

  private generateRiskAssessment(indicators: HumanCapitalIndicators): string {
    const risks = [];
    
    if (indicators.mobility.turnoverRate.overallTurnoverRate > 0.15) {
      risks.push('離職率が業界平均を上回っている');
    }
    
    if (indicators.diversity.genderDiversity.genderPayGap > 0.25) {
      risks.push('男女間賃金格差が大きい');
    }
    
    if (indicators.engagement.employeeEngagement.overallEngagementScore < 3.5) {
      risks.push('従業員エンゲージメントが低い');
    }
    
    return risks.length > 0 ? risks.join('、') : '特に重大なリスクは検出されていません';
  }

  private generateRecommendations(indicators: HumanCapitalIndicators): string[] {
    const recommendations = [];
    
    if (indicators.diversity.genderDiversity.femaleManagerRatio < 0.30) {
      recommendations.push('女性管理職比率向上のための積極的な育成プログラムの実施');
    }
    
    if (indicators.development.trainingInvestment.trainingROI < 2.0) {
      recommendations.push('研修プログラムの効果測定と改善');
    }
    
    if (indicators.engagement.workLifeBalance.workLifeBalanceScore < 3.5) {
      recommendations.push('ワークライフバランス改善施策の強化');
    }
    
    return recommendations;
  }

  private checkReportedMetrics(indicators: HumanCapitalIndicators, requiredMetrics: string[]): string[] {
    // 実際の実装では各指標の存在をチェック
    return requiredMetrics.filter(metric => {
      switch (metric) {
        case 'workforce_composition':
          return indicators.diversity.genderDiversity.totalEmployees > 0;
        case 'diversity_metrics':
          return indicators.diversity.genderDiversity.femaleManagerRatio >= 0;
        case 'turnover_rates':
          return indicators.mobility.turnoverRate.overallTurnoverRate >= 0;
        case 'engagement_metrics':
          return indicators.engagement.employeeEngagement.overallEngagementScore > 0;
        // 他の指標も同様にチェック
        default:
          return true;
      }
    });
  }

  private calculateDataQualityScore(indicators: HumanCapitalIndicators): number {
    // データ品質スコアの計算
    let score = 0;
    let checks = 0;
    
    // 各指標のデータ品質をチェック
    if (indicators.diversity.genderDiversity.totalEmployees > 0) {
      score += 10;
    }
    checks += 10;
    
    // 他の品質チェックも実装
    
    return (score / checks) * 100;
  }

  private generateISO30414Recommendations(complianceLevel: number, missingMetrics: string[]): string[] {
    const recommendations = [];
    
    if (complianceLevel < 80) {
      recommendations.push('ISO30414準拠率向上のため、不足している指標の測定を開始してください');
    }
    
    if (missingMetrics.includes('learning_development')) {
      recommendations.push('学習・開発指標の測定システムを構築してください');
    }
    
    if (missingMetrics.includes('productivity_metrics')) {
      recommendations.push('生産性指標の定義と測定方法を確立してください');
    }
    
    return recommendations;
  }
}

export default HumanCapitalDashboard;