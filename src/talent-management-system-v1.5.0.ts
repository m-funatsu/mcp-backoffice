/**
 * v1.5.0 Talent Management System
 * タレントマネジメントシステム
 * 
 * Features:
 * - Competency mapping and assessment
 * - Career development planning
 * - Succession planning
 * - Performance tracking
 * - Talent analytics and insights
 * - Skills gap analysis
 * - Leadership development programs
 */

import Database from './database.js';
import type { Employee } from './types.js';
import { format, addMonths, addYears, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';

export interface TalentProfile {
  employeeId: string;
  currentRole: string;
  level: string;
  potentialRating: PotentialRating;
  performanceRating: PerformanceRating;
  competencies: CompetencyAssessment[];
  careerAspiration: CareerAspiration;
  developmentPlan: DevelopmentPlan;
  successorCandidates: SuccessorCandidate[];
  flightRisk: FlightRisk;
  lastUpdated: Date;
}

export type PotentialRating = 'high' | 'medium' | 'low';
export type PerformanceRating = 'exceeds' | 'meets' | 'below' | 'unsatisfactory';

export interface CompetencyAssessment {
  competencyId: string;
  competencyName: string;
  category: CompetencyCategory;
  currentLevel: number; // 1-5
  targetLevel: number; // 1-5
  assessmentDate: Date;
  assessorId: string;
  developmentPriority: 'high' | 'medium' | 'low';
  evidenceNotes: string;
  improvementActions: string[];
}

export type CompetencyCategory = 
  | 'technical'
  | 'leadership'
  | 'communication'
  | 'problem_solving'
  | 'teamwork'
  | 'customer_focus'
  | 'strategic_thinking'
  | 'adaptability';

export interface CareerAspiration {
  shortTermGoals: CareerGoal[];
  longTermGoals: CareerGoal[];
  interestedRoles: string[];
  interestedDepartments: string[];
  geographicPreferences: string[];
  workStylePreferences: WorkStylePreference[];
  learningPreferences: LearningPreference[];
}

export interface CareerGoal {
  id: string;
  description: string;
  timeframe: '6_months' | '1_year' | '2_years' | '5_years';
  priority: 'high' | 'medium' | 'low';
  currentStatus: 'not_started' | 'in_progress' | 'completed' | 'postponed';
  milestones: GoalMilestone[];
  supportRequired: string[];
}

export interface GoalMilestone {
  id: string;
  description: string;
  targetDate: Date;
  completed: boolean;
  completedDate?: Date;
  notes?: string;
}

export type WorkStylePreference = 
  | 'remote'
  | 'hybrid'
  | 'office'
  | 'flexible_hours'
  | 'fixed_schedule'
  | 'travel_required'
  | 'no_travel';

export type LearningPreference = 
  | 'online'
  | 'classroom'
  | 'on_job'
  | 'mentoring'
  | 'self_study'
  | 'conference'
  | 'certification';

export interface DevelopmentPlan {
  id: string;
  employeeId: string;
  planPeriod: {
    startDate: Date;
    endDate: Date;
  };
  developmentObjectives: DevelopmentObjective[];
  learningActivities: LearningActivity[];
  mentorshipAssignments: MentorshipAssignment[];
  experienceAssignments: ExperienceAssignment[];
  progressReviews: ProgressReview[];
  budget: DevelopmentBudget;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  createdBy: string;
  lastUpdated: Date;
}

export interface DevelopmentObjective {
  id: string;
  description: string;
  linkedCompetencies: string[];
  successMetrics: SuccessMetric[];
  priority: 'high' | 'medium' | 'low';
  targetCompletionDate: Date;
  currentStatus: 'not_started' | 'in_progress' | 'completed' | 'at_risk';
  progressPercentage: number;
}

export interface SuccessMetric {
  id: string;
  description: string;
  measurementMethod: string;
  targetValue: number;
  currentValue: number;
  unit: string;
}

export interface LearningActivity {
  id: string;
  type: 'training' | 'workshop' | 'certification' | 'conference' | 'reading' | 'project';
  title: string;
  description: string;
  provider: string;
  format: 'online' | 'in_person' | 'hybrid';
  duration: number; // in hours
  cost: number;
  scheduledDate: Date;
  completionDate?: Date;
  competenciesAddressed: string[];
  feedback?: ActivityFeedback;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface ActivityFeedback {
  rating: number; // 1-5
  comments: string;
  learningOutcomes: string[];
  recommendations: string[];
  submittedAt: Date;
}

export interface MentorshipAssignment {
  id: string;
  mentorId: string;
  menteeId: string;
  focusAreas: string[];
  startDate: Date;
  endDate: Date;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  duration: number; // in minutes per session
  objectives: string[];
  progressNotes: MentorshipNote[];
  status: 'active' | 'completed' | 'paused' | 'cancelled';
}

export interface MentorshipNote {
  id: string;
  date: Date;
  summary: string;
  keyDiscussions: string[];
  actionItems: string[];
  nextSteps: string[];
  mentorFeedback: string;
  menteeFeedback: string;
}

export interface ExperienceAssignment {
  id: string;
  type: 'stretch_assignment' | 'cross_functional' | 'international' | 'leadership_role' | 'project_lead';
  title: string;
  description: string;
  department: string;
  supervisor: string;
  startDate: Date;
  endDate: Date;
  objectives: string[];
  skillsToGain: string[];
  successCriteria: string[];
  feedback?: ExperienceFeedback;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
}

export interface ExperienceFeedback {
  employeeFeedback: string;
  supervisorFeedback: string;
  skillsGained: string[];
  areasForImprovement: string[];
  overallRating: number; // 1-5
  wouldRecommend: boolean;
  submittedAt: Date;
}

export interface ProgressReview {
  id: string;
  reviewDate: Date;
  reviewerId: string;
  progressSummary: string;
  achievedObjectives: string[];
  challengesFaced: string[];
  supportNeeded: string[];
  adjustmentsMade: string[];
  nextPeriodFocus: string[];
  overallProgress: number; // 0-100 percentage
}

export interface DevelopmentBudget {
  totalAllocated: number;
  spentToDate: number;
  remainingBudget: number;
  budgetBreakdown: BudgetItem[];
}

export interface BudgetItem {
  category: 'training' | 'certification' | 'conference' | 'materials' | 'mentoring' | 'other';
  allocated: number;
  spent: number;
  remaining: number;
}

export interface SuccessorCandidate {
  candidateId: string;
  candidateName: string;
  currentRole: string;
  readinessLevel: 'ready_now' | 'ready_1_year' | 'ready_2_years' | 'longer_term';
  strengthsForRole: string[];
  developmentNeeds: string[];
  developmentPlan: string;
  probability: number; // 0-100
  lastAssessed: Date;
  assessorId: string;
}

export interface FlightRisk {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  retentionActions: RetentionAction[];
  lastAssessed: Date;
  assessorId: string;
}

export interface RiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  evidenceDate: Date;
}

export interface RetentionAction {
  id: string;
  action: string;
  description: string;
  targetDate: Date;
  responsible: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  effectivenessRating?: number; // 1-5
}

export interface TalentAnalytics {
  totalEmployees: number;
  highPotentialCount: number;
  successorCoverage: number; // percentage of key roles with successors
  developmentPlanParticipation: number; // percentage
  competencyGapAnalysis: CompetencyGap[];
  flightRiskDistribution: { [level: string]: number };
  developmentROI: DevelopmentROI;
  talentMetrics: TalentMetric[];
  benchmarkComparisons: BenchmarkComparison[];
}

export interface CompetencyGap {
  competencyId: string;
  competencyName: string;
  category: CompetencyCategory;
  averageCurrentLevel: number;
  averageTargetLevel: number;
  gap: number;
  employeesAffected: number;
  priorityLevel: 'high' | 'medium' | 'low';
  recommendedActions: string[];
}

export interface DevelopmentROI {
  totalInvestment: number;
  measuredBenefits: number;
  roiPercentage: number;
  performanceImprovement: number;
  retentionImprovement: number;
  promotionFromWithin: number;
}

export interface TalentMetric {
  metricName: string;
  currentValue: number;
  targetValue: number;
  trend: 'improving' | 'stable' | 'declining';
  benchmarkValue?: number;
  unit: string;
}

export interface BenchmarkComparison {
  metric: string;
  companyValue: number;
  industryAverage: number;
  bestInClass: number;
  percentileRank: number;
}

export class TalentManagementSystem {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Create or update talent profile
   */
  async createTalentProfile(employeeId: string, assessorId: string): Promise<TalentProfile> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const profile: TalentProfile = {
      employeeId,
      currentRole: employee.position,
      level: this.determineEmployeeLevel(employee),
      potentialRating: 'medium', // Default, to be assessed
      performanceRating: 'meets', // Default, to be assessed
      competencies: await this.initializeCompetencyAssessments(employee.position),
      careerAspiration: await this.initializeCareerAspiration(employeeId),
      developmentPlan: await this.createInitialDevelopmentPlan(employeeId),
      successorCandidates: [],
      flightRisk: {
        riskLevel: 'low',
        riskFactors: [],
        retentionActions: [],
        lastAssessed: new Date(),
        assessorId
      },
      lastUpdated: new Date()
    };

    await this.saveTalentProfile(profile);
    return profile;
  }

  /**
   * Assess employee competencies
   */
  async assessCompetencies(
    employeeId: string, 
    competencyAssessments: CompetencyAssessment[], 
    assessorId: string
  ): Promise<void> {
    const profile = await this.getTalentProfile(employeeId);
    if (!profile) {
      throw new Error('Talent profile not found');
    }

    profile.competencies = competencyAssessments.map(assessment => ({
      ...assessment,
      assessmentDate: new Date(),
      assessorId
    }));

    profile.lastUpdated = new Date();
    await this.saveTalentProfile(profile);
  }

  /**
   * Create development plan
   */
  async createDevelopmentPlan(employeeId: string): Promise<DevelopmentPlan> {
    const profile = await this.getTalentProfile(employeeId);
    if (!profile) {
      throw new Error('Talent profile not found');
    }

    return this.createDevelopmentPlanFromProfile(profile);
  }

  /**
   * Create initial development plan during profile creation
   */
  private async createInitialDevelopmentPlan(employeeId: string): Promise<DevelopmentPlan> {
    // Use default competencies for initial development plan
    const defaultCompetencies = await this.initializeCompetencyAssessments('default');
    
    const plan: DevelopmentPlan = {
      id: `DP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId,
      planPeriod: {
        startDate: new Date(),
        endDate: addYears(new Date(), 1)
      },
      developmentObjectives: this.generateDevelopmentObjectives(defaultCompetencies),
      learningActivities: this.recommendLearningActivities(defaultCompetencies),
      mentorshipAssignments: [],
      experienceAssignments: [],
      progressReviews: [],
      budget: {
        totalAllocated: 200000,
        spentToDate: 0,
        remainingBudget: 200000,
        budgetBreakdown: [
          { category: 'training', allocated: 100000, spent: 0, remaining: 100000 },
          { category: 'certification', allocated: 50000, spent: 0, remaining: 50000 },
          { category: 'conference', allocated: 30000, spent: 0, remaining: 30000 },
          { category: 'materials', allocated: 20000, spent: 0, remaining: 20000 }
        ]
      },
      status: 'draft',
      createdBy: 'SYSTEM',
      lastUpdated: new Date()
    };

    await this.saveDevelopmentPlan(plan);
    return plan;
  }

  /**
   * Create development plan from existing profile
   */
  private async createDevelopmentPlanFromProfile(profile: TalentProfile): Promise<DevelopmentPlan> {
    const plan: DevelopmentPlan = {
      id: `DP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId: profile.employeeId,
      planPeriod: {
        startDate: new Date(),
        endDate: addYears(new Date(), 1)
      },
      developmentObjectives: this.generateDevelopmentObjectives(profile.competencies),
      learningActivities: this.recommendLearningActivities(profile.competencies),
      mentorshipAssignments: [],
      experienceAssignments: [],
      progressReviews: [],
      budget: {
        totalAllocated: 200000, // ¥200,000 per year
        spentToDate: 0,
        remainingBudget: 200000,
        budgetBreakdown: [
          { category: 'training', allocated: 100000, spent: 0, remaining: 100000 },
          { category: 'certification', allocated: 50000, spent: 0, remaining: 50000 },
          { category: 'conference', allocated: 30000, spent: 0, remaining: 30000 },
          { category: 'materials', allocated: 20000, spent: 0, remaining: 20000 }
        ]
      },
      status: 'draft',
      createdBy: 'SYSTEM',
      lastUpdated: new Date()
    };

    await this.saveDevelopmentPlan(plan);
    return plan;
  }

  /**
   * Identify succession candidates
   */
  async identifySuccessionCandidates(roleId: string, departmentId: string): Promise<SuccessorCandidate[]> {
    const allProfiles = await this.getAllTalentProfiles();
    const candidates: SuccessorCandidate[] = [];

    for (const profile of allProfiles) {
      if (profile.potentialRating === 'high' && profile.performanceRating === 'exceeds') {
        const readiness = this.assessSuccessionReadiness(profile, roleId);
        if (readiness.probability > 60) {
          candidates.push({
            candidateId: profile.employeeId,
            candidateName: await this.getEmployeeName(profile.employeeId),
            currentRole: profile.currentRole,
            readinessLevel: readiness.readinessLevel,
            strengthsForRole: readiness.strengths,
            developmentNeeds: readiness.developmentNeeds,
            developmentPlan: readiness.developmentPlan,
            probability: readiness.probability,
            lastAssessed: new Date(),
            assessorId: 'SYSTEM'
          });
        }
      }
    }

    return candidates.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Assess flight risk
   */
  async assessFlightRisk(employeeId: string, assessorId: string): Promise<FlightRisk> {
    const profile = await this.getTalentProfile(employeeId);
    if (!profile) {
      throw new Error('Talent profile not found');
    }

    const riskFactors = await this.identifyRiskFactors(employeeId);
    const riskLevel = this.calculateRiskLevel(riskFactors);
    const retentionActions = this.generateRetentionActions(riskFactors);

    const flightRisk: FlightRisk = {
      riskLevel,
      riskFactors,
      retentionActions,
      lastAssessed: new Date(),
      assessorId
    };

    profile.flightRisk = flightRisk;
    profile.lastUpdated = new Date();
    await this.saveTalentProfile(profile);

    return flightRisk;
  }

  /**
   * Generate talent analytics
   */
  async generateTalentAnalytics(departmentId?: string): Promise<TalentAnalytics> {
    const allProfiles = await this.getAllTalentProfiles();
    const filteredProfiles = departmentId 
      ? allProfiles.filter(p => p.currentRole.includes(departmentId))
      : allProfiles;

    const analytics: TalentAnalytics = {
      totalEmployees: filteredProfiles.length,
      highPotentialCount: filteredProfiles.filter(p => p.potentialRating === 'high').length,
      successorCoverage: this.calculateSuccessorCoverage(filteredProfiles),
      developmentPlanParticipation: this.calculateDevelopmentPlanParticipation(filteredProfiles),
      competencyGapAnalysis: this.analyzeCompetencyGaps(filteredProfiles),
      flightRiskDistribution: this.analyzeFlightRiskDistribution(filteredProfiles),
      developmentROI: await this.calculateDevelopmentROI(filteredProfiles),
      talentMetrics: this.calculateTalentMetrics(filteredProfiles),
      benchmarkComparisons: this.getBenchmarkComparisons()
    };

    return analytics;
  }

  /**
   * Get talent dashboard data
   */
  async getTalentDashboard(managerId: string): Promise<{
    teamOverview: TalentOverview;
    developmentActivities: LearningActivity[];
    upcomingReviews: ProgressReview[];
    riskAlerts: FlightRisk[];
    successorGaps: string[];
  }> {
    const teamMembers = await this.getTeamMembers(managerId);
    const teamProfiles = await Promise.all(
      teamMembers.map(member => this.getTalentProfile(member.id))
    );

    return {
      teamOverview: this.generateTeamOverview(teamProfiles.filter(p => p !== null) as TalentProfile[]),
      developmentActivities: await this.getUpcomingDevelopmentActivities(teamMembers.map(m => m.id)),
      upcomingReviews: await this.getUpcomingReviews(teamMembers.map(m => m.id)),
      riskAlerts: teamProfiles
        .filter(p => p && p.flightRisk.riskLevel === 'high')
        .map(p => p!.flightRisk),
      successorGaps: await this.identifySuccessorGaps(teamMembers.map(m => m.id))
    };
  }

  // Private helper methods

  private determineEmployeeLevel(employee: Employee): string {
    // Logic to determine employee level based on role, experience, etc.
    return 'Mid-level';
  }

  private async initializeCompetencyAssessments(position: string): Promise<CompetencyAssessment[]> {
    // Generate role-specific competency assessments
    const baseCompetencies = [
      'technical', 'communication', 'problem_solving', 'teamwork'
    ];

    return baseCompetencies.map(comp => ({
      competencyId: `COMP_${comp.toUpperCase()}`,
      competencyName: comp,
      category: comp as CompetencyCategory,
      currentLevel: 3,
      targetLevel: 4,
      assessmentDate: new Date(),
      assessorId: 'SYSTEM',
      developmentPriority: 'medium' as const,
      evidenceNotes: '',
      improvementActions: []
    }));
  }

  private async initializeCareerAspiration(employeeId: string): Promise<CareerAspiration> {
    return {
      shortTermGoals: [],
      longTermGoals: [],
      interestedRoles: [],
      interestedDepartments: [],
      geographicPreferences: ['Tokyo'],
      workStylePreferences: ['hybrid'],
      learningPreferences: ['online', 'mentoring']
    };
  }

  private generateDevelopmentObjectives(competencies: CompetencyAssessment[]): DevelopmentObjective[] {
    return competencies
      .filter(comp => comp.currentLevel < comp.targetLevel)
      .map(comp => ({
        id: `OBJ_${comp.competencyId}`,
        description: `Improve ${comp.competencyName} from level ${comp.currentLevel} to ${comp.targetLevel}`,
        linkedCompetencies: [comp.competencyId],
        successMetrics: [{
          id: `SM_${comp.competencyId}`,
          description: `Competency level`,
          measurementMethod: 'Assessment',
          targetValue: comp.targetLevel,
          currentValue: comp.currentLevel,
          unit: 'level'
        }],
        priority: comp.developmentPriority,
        targetCompletionDate: addMonths(new Date(), 6),
        currentStatus: 'not_started',
        progressPercentage: 0
      }));
  }

  private recommendLearningActivities(competencies: CompetencyAssessment[]): LearningActivity[] {
    return competencies
      .filter(comp => comp.developmentPriority === 'high')
      .map(comp => ({
        id: `LA_${comp.competencyId}`,
        type: 'training' as const,
        title: `${comp.competencyName} Development Training`,
        description: `Focused training to improve ${comp.competencyName} skills`,
        provider: 'Internal Training',
        format: 'online' as const,
        duration: 16,
        cost: 50000,
        scheduledDate: addMonths(new Date(), 1),
        competenciesAddressed: [comp.competencyId],
        status: 'scheduled' as const
      }));
  }

  private assessSuccessionReadiness(profile: TalentProfile, roleId: string): {
    readinessLevel: SuccessorCandidate['readinessLevel'];
    strengths: string[];
    developmentNeeds: string[];
    developmentPlan: string;
    probability: number;
  } {
    // Mock assessment logic
    return {
      readinessLevel: 'ready_1_year',
      strengths: ['Strong technical skills', 'Good leadership potential'],
      developmentNeeds: ['Strategic thinking', 'Financial acumen'],
      developmentPlan: 'Focus on strategic thinking and financial skills',
      probability: 75
    };
  }

  private async identifyRiskFactors(employeeId: string): Promise<RiskFactor[]> {
    // Mock risk factor identification
    return [];
  }

  private calculateRiskLevel(riskFactors: RiskFactor[]): FlightRisk['riskLevel'] {
    const highRiskFactors = riskFactors.filter(rf => rf.impact === 'high').length;
    if (highRiskFactors >= 2) return 'high';
    if (highRiskFactors >= 1) return 'medium';
    return 'low';
  }

  private generateRetentionActions(riskFactors: RiskFactor[]): RetentionAction[] {
    return riskFactors.map(rf => ({
      id: `RA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      action: `Address ${rf.factor}`,
      description: `Action to mitigate ${rf.description}`,
      targetDate: addMonths(new Date(), 1),
      responsible: 'HR_TEAM',
      status: 'planned' as const
    }));
  }

  private calculateSuccessorCoverage(profiles: TalentProfile[]): number {
    // Mock calculation
    return 65; // 65% coverage
  }

  private calculateDevelopmentPlanParticipation(profiles: TalentProfile[]): number {
    // Mock calculation
    return 78; // 78% participation
  }

  private analyzeCompetencyGaps(profiles: TalentProfile[]): CompetencyGap[] {
    // Mock gap analysis
    return [];
  }

  private analyzeFlightRiskDistribution(profiles: TalentProfile[]): { [level: string]: number } {
    return {
      'low': 70,
      'medium': 20,
      'high': 8,
      'critical': 2
    };
  }

  private async calculateDevelopmentROI(profiles: TalentProfile[]): Promise<DevelopmentROI> {
    return {
      totalInvestment: 5000000,
      measuredBenefits: 7500000,
      roiPercentage: 150,
      performanceImprovement: 25,
      retentionImprovement: 18,
      promotionFromWithin: 82
    };
  }

  private calculateTalentMetrics(profiles: TalentProfile[]): TalentMetric[] {
    return [
      {
        metricName: 'High Potential Rate',
        currentValue: 25,
        targetValue: 30,
        trend: 'improving',
        unit: '%'
      },
      {
        metricName: 'Internal Mobility Rate',
        currentValue: 15,
        targetValue: 20,
        trend: 'stable',
        unit: '%'
      }
    ];
  }

  private getBenchmarkComparisons(): BenchmarkComparison[] {
    return [
      {
        metric: 'Development Investment per Employee',
        companyValue: 180000,
        industryAverage: 150000,
        bestInClass: 250000,
        percentileRank: 75
      }
    ];
  }

  private generateTeamOverview(profiles: TalentProfile[]): TalentOverview {
    return {
      totalMembers: profiles.length,
      highPotential: profiles.filter(p => p.potentialRating === 'high').length,
      atRisk: profiles.filter(p => p.flightRisk.riskLevel === 'high').length,
      developmentActive: profiles.filter(p => p.developmentPlan.status === 'active').length
    };
  }

  // Mock database methods
  private async getTalentProfile(employeeId: string): Promise<TalentProfile | null> {
    // Mock implementation
    return null;
  }

  private async saveTalentProfile(profile: TalentProfile): Promise<void> {
    // Mock implementation
    // タレントプロファイル保存処理（ログ出力を削除）
  }

  private async saveDevelopmentPlan(plan: DevelopmentPlan): Promise<void> {
    // Mock implementation
    // 開発計画保存処理（ログ出力を削除）
  }

  private async getAllTalentProfiles(): Promise<TalentProfile[]> {
    // Mock implementation
    return [];
  }

  private async getEmployeeName(employeeId: string): Promise<string> {
    const employee = await this.db.getEmployee(employeeId);
    return employee ? employee.name : 'Unknown';
  }

  private async getTeamMembers(managerId: string): Promise<{ id: string; name: string }[]> {
    // Mock implementation
    return [];
  }

  private async getUpcomingDevelopmentActivities(employeeIds: string[]): Promise<LearningActivity[]> {
    // Mock implementation
    return [];
  }

  private async getUpcomingReviews(employeeIds: string[]): Promise<ProgressReview[]> {
    // Mock implementation
    return [];
  }

  private async identifySuccessorGaps(employeeIds: string[]): Promise<string[]> {
    // Mock implementation
    return [];
  }
}

interface TalentOverview {
  totalMembers: number;
  highPotential: number;
  atRisk: number;
  developmentActive: number;
}

export default TalentManagementSystem;