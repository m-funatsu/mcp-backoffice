/**
 * HR Module - Human Resources Management
 * HR モジュール - 人事管理機能
 * 
 * 勤怠管理、給与計算、人事評価、人材育成等の機能を統合
 */

import Database from '../database.js';
import PayrollCalculator from '../payroll.js';
import { LeaveManagement } from '../leave-management.js';
import { IntegratedPayrollEngine } from '../payroll-engine.js';
import TalentManagementEngine from '../talent-management-engine-v2.2.0.js';
import type { Employee, TimeRecord, PayrollCalculation, TalentSkill, EmployeeSkill, TrainingRecord, PerformanceEvaluationV2, GoalOKR, SkillMap, TalentDashboard } from '../types.js';
import type { PlatformModule } from '../platform-core.js';

export interface HRModuleConfig {
  payrollEnabled: boolean;
  leaveManagementEnabled: boolean;
  performanceEnabled: boolean;
  complianceLevel: 'basic' | 'standard' | 'advanced';
  laborLawRegion: 'japan' | 'global';
  // v2.2.0: タレントマネジメント設定
  talentManagementEnabled: boolean;
  skillManagementEnabled: boolean;
  trainingManagementEnabled: boolean;
  goalManagementEnabled: boolean;
  performanceEvaluationEnabled: boolean;
}

export class HRModule implements PlatformModule {
  name = 'HR-Module';
  version = '2.2.0';
  category = 'hr' as const;
  enabled = true;
  config?: HRModuleConfig;
  
  private db: Database;
  private moduleConfig: HRModuleConfig;
  private payrollCalculator: PayrollCalculator | null = null;
  private payrollEngine: IntegratedPayrollEngine;
  private leaveManagement: LeaveManagement;
  private talentManagementEngine: TalentManagementEngine;

  constructor(database: Database, config?: Partial<HRModuleConfig>) {
    this.db = database;
    this.moduleConfig = {
      payrollEnabled: true,
      leaveManagementEnabled: true,
      performanceEnabled: true,
      complianceLevel: 'advanced',
      laborLawRegion: 'japan',
      // v2.2.0: タレントマネジメント設定
      talentManagementEnabled: true,
      skillManagementEnabled: true,
      trainingManagementEnabled: true,
      goalManagementEnabled: true,
      performanceEvaluationEnabled: true,
      ...config
    };
    
    this.config = this.moduleConfig;
    
    this.payrollEngine = new IntegratedPayrollEngine(this.db);
    this.leaveManagement = new LeaveManagement(this.db);
    this.talentManagementEngine = new TalentManagementEngine(this.db);
  }

  /**
   * モジュール初期化
   */
  async initialize(): Promise<void> {
    console.log(`🏢 Initializing HR Module v${this.version}...`);
    
    if (this.moduleConfig.payrollEnabled) {
      await this.initializePayrollCalculator();
    }
    
    console.log('✅ HR Module initialized successfully');
  }

  /**
   * 従業員管理機能
   */
  async addEmployee(employee: Omit<Employee, 'id'>): Promise<string> {
    const employeeWithId = { ...employee, id: `emp_${Date.now()}` } as Employee;
    return await this.db.addEmployee(employeeWithId);
  }

  async getEmployee(id: string): Promise<Employee | null> {
    return await this.db.getEmployee(id);
  }

  async getAllEmployees(): Promise<Employee[]> {
    return await this.db.getAllEmployees();
  }

  async updateEmployee(id: string, updates: Partial<Employee>): Promise<void> {
    await this.db.updateEmployee(id, updates);
  }

  /**
   * 勤怠管理機能
   */
  async clockIn(employeeId: string, time?: Date, recordType: 'ic_card' | 'pc_log' | 'manual' = 'manual'): Promise<string> {
    await this.db.clockIn(employeeId, time || new Date(), recordType);
    return `record_${Date.now()}`;
  }

  async clockOut(employeeId: string, recordId: string, time?: Date): Promise<void> {
    await this.db.clockOut(employeeId, time || new Date());
  }

  async getTimeRecords(employeeId: string, startDate?: string, endDate?: string): Promise<TimeRecord[]> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();
    return await this.db.getTimeRecords(employeeId, start, end);
  }

  /**
   * 給与計算機能
   */
  async calculatePayroll(employeeId: string, month: string): Promise<PayrollCalculation> {
    if (!this.moduleConfig.payrollEnabled) {
      throw new Error('Payroll functionality is disabled');
    }
    
    // 給与計算処理 - 実装時に追加
    return {
      id: `payroll_${Date.now()}`,
      employeeId,
      month,
      regularHours: 160,
      overtimeHours: 20,
      lateNightHours: 0,
      holidayHours: 0,
      regularPay: 300000,
      overtimePay: 50000,
      lateNightPay: 0,
      holidayPay: 0,
      totalPay: 350000,
      totalSalary: 350000,
      calculatedAt: new Date()
    } as PayrollCalculation;
  }

  async generatePayslip(employeeId: string, month: string): Promise<any> {
    if (!this.moduleConfig.payrollEnabled) {
      throw new Error('Payroll functionality is disabled');
    }
    
    // 給与明細生成 - 実装時に追加
    return {
      employeeId,
      month,
      payslipData: 'Generated payslip data'
    };
  }

  /**
   * 休暇管理機能
   */
  async requestLeave(request: any): Promise<string> {
    if (!this.moduleConfig.leaveManagementEnabled) {
      throw new Error('Leave management functionality is disabled');
    }
    
    // 休暇申請処理 - 実装時に追加
    console.log('Processing leave request:', request);
    return `leave_request_${Date.now()}`;
  }

  async approveLeave(requestId: string, approverId: string, notes?: string): Promise<void> {
    if (!this.moduleConfig.leaveManagementEnabled) {
      throw new Error('Leave management functionality is disabled');
    }
    
    // 休暇承認処理 - 実装時に追加
    console.log(`Approving leave request ${requestId} by ${approverId}`);
  }

  async getLeaveBalance(employeeId: string, year?: number): Promise<any> {
    if (!this.moduleConfig.leaveManagementEnabled) {
      throw new Error('Leave management functionality is disabled');
    }
    
    return await this.db.getLeaveBalance(employeeId);
  }

  /**
   * コンプライアンス機能
   */
  async validateLaborCompliance(employeeId: string, month: string): Promise<any> {
    if (this.moduleConfig.complianceLevel === 'basic') {
      return { compliant: true, issues: [] };
    }
    
    // 36協定違反チェック
    const violations = await this.checkOvertimeViolations(employeeId, month);
    
    return {
      compliant: violations.length === 0,
      issues: violations,
      recommendations: this.generateComplianceRecommendations(violations)
    };
  }

  async monitor36Compliance(employeeId: string, month: string): Promise<any> {
    // 36協定監視 - 実装時に追加
    console.log(`Monitoring 36 compliance for ${employeeId} in ${month}`);
    return { compliant: true, issues: [] };
  }

  /**
   * レポート生成
   */
  async generateAttendanceReport(employeeId: string, month: string): Promise<any> {
    const timeRecords = await this.getTimeRecords(employeeId);
    const payrollData = await this.calculatePayroll(employeeId, month);
    
    return {
      employeeId,
      month,
      timeRecords: timeRecords.length,
      totalWorkingHours: payrollData.regularHours + payrollData.overtimeHours,
      overtimeHours: payrollData.overtimeHours,
      violations: await this.checkOvertimeViolations(employeeId, month)
    };
  }

  /**
   * v2.2.0: タレントマネジメント機能
   */

  /**
   * スキル管理
   */
  async createSkill(skill: Partial<TalentSkill>): Promise<string> {
    if (!this.moduleConfig.skillManagementEnabled) {
      throw new Error('Skill management functionality is disabled');
    }
    
    return await this.db.createSkill(skill);
  }

  async assignSkillToEmployee(employeeId: string, skillId: string, proficiencyLevel: number): Promise<string> {
    if (!this.moduleConfig.skillManagementEnabled) {
      throw new Error('Skill management functionality is disabled');
    }
    
    return await this.db.assignSkillToEmployee(employeeId, skillId, proficiencyLevel);
  }

  async getEmployeeSkills(employeeId: string): Promise<EmployeeSkill[]> {
    if (!this.moduleConfig.skillManagementEnabled) {
      throw new Error('Skill management functionality is disabled');
    }
    
    const skills = await this.db.getEmployeeSkills(employeeId);
    return skills.map(skill => ({
      id: skill.id,
      employeeId: skill.employee_id,
      skillId: skill.skill_id,
      proficiencyLevel: skill.proficiency_level,
      selfAssessedLevel: skill.self_assessed_level,
      managerAssessedLevel: skill.manager_assessed_level,
      assessmentDate: skill.assessment_date,
      lastUpdated: skill.last_updated,
      notes: skill.notes,
      createdAt: skill.created_at,
      updatedAt: skill.updated_at
    }));
  }

  async generateSkillMap(employeeId: string): Promise<SkillMap> {
    if (!this.moduleConfig.skillManagementEnabled) {
      throw new Error('Skill management functionality is disabled');
    }
    
    return await this.talentManagementEngine.generateSkillMap(employeeId);
  }

  async getSkillsByCategory(category?: string): Promise<TalentSkill[]> {
    if (!this.moduleConfig.skillManagementEnabled) {
      throw new Error('Skill management functionality is disabled');
    }
    
    const skills = await this.db.getSkillsByCategory(category);
    return skills.map(skill => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      description: skill.description,
      competencyLevels: skill.competency_levels,
      isActive: skill.is_active,
      createdAt: skill.created_at,
      updatedAt: skill.updated_at
    }));
  }

  /**
   * 研修管理
   */
  async createTrainingRecord(training: Partial<TrainingRecord>): Promise<string> {
    if (!this.moduleConfig.trainingManagementEnabled) {
      throw new Error('Training management functionality is disabled');
    }
    
    return await this.db.createTrainingRecord(training);
  }

  async getTrainingHistory(employeeId: string, startDate?: Date, endDate?: Date): Promise<TrainingRecord[]> {
    if (!this.moduleConfig.trainingManagementEnabled) {
      throw new Error('Training management functionality is disabled');
    }
    
    const trainings = await this.db.getTrainingHistory(employeeId, startDate, endDate);
    return trainings.map(training => ({
      id: training.id,
      employeeId: training.employee_id,
      trainingName: training.training_name,
      trainingType: training.training_type,
      provider: training.provider,
      startDate: training.start_date,
      endDate: training.end_date,
      durationHours: training.duration_hours,
      cost: training.cost,
      status: training.status,
      completionRate: training.completion_rate,
      evaluationScore: training.evaluation_score,
      kirkpatrickLevel: training.kirkpatrick_level,
      relatedSkills: training.related_skills,
      notes: training.notes,
      createdAt: training.created_at,
      updatedAt: training.updated_at
    }));
  }

  async evaluateTrainingEffectiveness(trainingId: string, employeeId: string): Promise<any> {
    if (!this.moduleConfig.trainingManagementEnabled) {
      throw new Error('Training management functionality is disabled');
    }
    
    return await this.talentManagementEngine.evaluateTrainingEffectiveness(trainingId, employeeId);
  }

  /**
   * パフォーマンス評価
   */
  async createPerformanceEvaluation(evaluation: Partial<PerformanceEvaluationV2>): Promise<string> {
    if (!this.moduleConfig.performanceEvaluationEnabled) {
      throw new Error('Performance evaluation functionality is disabled');
    }
    
    return await this.db.createPerformanceEvaluation(evaluation);
  }

  async getPerformanceEvaluations(employeeId: string, period?: string): Promise<PerformanceEvaluationV2[]> {
    if (!this.moduleConfig.performanceEvaluationEnabled) {
      throw new Error('Performance evaluation functionality is disabled');
    }
    
    const evaluations = await this.db.getPerformanceEvaluations(employeeId, period);
    return evaluations.map(evaluation => ({
      id: evaluation.id,
      employeeId: evaluation.employee_id,
      evaluatorId: evaluation.evaluator_id,
      evaluationPeriod: evaluation.evaluation_period,
      evaluationDate: evaluation.evaluation_date,
      overallRating: evaluation.overall_rating,
      competencyRatings: evaluation.competency_ratings,
      goalsAchievement: evaluation.goals_achievement,
      strengths: evaluation.strengths,
      areasForImprovement: evaluation.areas_for_improvement,
      developmentPlans: evaluation.development_plans,
      promotionReadiness: evaluation.promotion_readiness,
      successionPotential: evaluation.succession_potential,
      retentionRisk: evaluation.retention_risk,
      feedback360: evaluation.feedback_360,
      comments: evaluation.comments,
      status: evaluation.status,
      createdAt: evaluation.created_at,
      updatedAt: evaluation.updated_at
    }));
  }

  async collect360Feedback(employeeId: string, feedbackProviders: string[]): Promise<Record<string, any>> {
    if (!this.moduleConfig.performanceEvaluationEnabled) {
      throw new Error('Performance evaluation functionality is disabled');
    }
    
    return await this.talentManagementEngine.collect360Feedback(employeeId, feedbackProviders);
  }

  /**
   * 目標管理（MBO & OKR）
   */
  async createMBOGoals(employeeId: string, goals: Partial<GoalOKR>[]): Promise<string[]> {
    if (!this.moduleConfig.goalManagementEnabled) {
      throw new Error('Goal management functionality is disabled');
    }
    
    return await this.talentManagementEngine.createMBOGoals(employeeId, goals);
  }

  async createOKRGoals(employeeId: string, objectives: Partial<GoalOKR>[]): Promise<string[]> {
    if (!this.moduleConfig.goalManagementEnabled) {
      throw new Error('Goal management functionality is disabled');
    }
    
    return await this.talentManagementEngine.createOKRGoals(employeeId, objectives);
  }

  async getGoals(employeeId: string, goalType?: string): Promise<GoalOKR[]> {
    if (!this.moduleConfig.goalManagementEnabled) {
      throw new Error('Goal management functionality is disabled');
    }
    
    const goals = await this.db.getGoals(employeeId, goalType);
    return goals.map(goal => ({
      id: goal.id,
      employeeId: goal.employee_id,
      goalType: goal.goal_type,
      title: goal.title,
      description: goal.description,
      category: goal.category,
      targetValue: goal.target_value,
      currentValue: goal.current_value,
      unit: goal.unit,
      weight: goal.weight,
      priority: goal.priority,
      startDate: goal.start_date,
      dueDate: goal.due_date,
      status: goal.status,
      achievementRate: goal.achievement_rate,
      evaluationRating: goal.evaluation_rating,
      keyResults: goal.key_results,
      milestones: goal.milestones,
      parentGoalId: goal.parent_goal_id,
      relatedSkills: goal.related_skills,
      notes: goal.notes,
      createdAt: goal.created_at,
      updatedAt: goal.updated_at
    }));
  }

  async updateGoalProgress(goalId: string, currentValue: number, achievementRate: number): Promise<boolean> {
    if (!this.moduleConfig.goalManagementEnabled) {
      throw new Error('Goal management functionality is disabled');
    }
    
    return await this.db.updateGoalProgress(goalId, currentValue, achievementRate);
  }

  /**
   * タレントダッシュボード
   */
  async generateTalentDashboard(employeeId: string): Promise<TalentDashboard> {
    if (!this.moduleConfig.talentManagementEnabled) {
      throw new Error('Talent management functionality is disabled');
    }
    
    return await this.talentManagementEngine.generateTalentDashboard(employeeId);
  }

  /**
   * ISO30414指標算出
   */
  async calculateTalentMetrics(startDate: Date, endDate: Date): Promise<any> {
    if (!this.moduleConfig.talentManagementEnabled) {
      throw new Error('Talent management functionality is disabled');
    }
    
    return await this.talentManagementEngine.calculateISO30414Metrics(startDate, endDate);
  }

  /**
   * モジュール状態取得
   */
  getModuleStatus(): {
    name: string;
    version: string;
    enabled: boolean;
    features: Record<string, boolean>;
    statistics: any;
  } {
    return {
      name: this.name,
      version: this.version,
      enabled: this.enabled,
      features: {
        payroll: this.moduleConfig.payrollEnabled,
        leaveManagement: this.moduleConfig.leaveManagementEnabled,
        performance: this.moduleConfig.performanceEnabled,
        compliance: this.moduleConfig.complianceLevel !== 'basic',
        // v2.2.0: タレントマネジメント機能
        talentManagement: this.moduleConfig.talentManagementEnabled,
        skillManagement: this.moduleConfig.skillManagementEnabled,
        trainingManagement: this.moduleConfig.trainingManagementEnabled,
        goalManagement: this.moduleConfig.goalManagementEnabled,
        performanceEvaluation: this.moduleConfig.performanceEvaluationEnabled
      },
      statistics: {
        // 実装時に追加
      }
    };
  }

  // プライベートメソッド
  private async initializePayrollCalculator(): Promise<void> {
    if (!this.payrollCalculator) {
      const rules = await this.db.getPayrollRules();
      this.payrollCalculator = new PayrollCalculator(this.db as any, rules);
    }
  }

  private async checkOvertimeViolations(employeeId: string, month: string): Promise<string[]> {
    const violations: string[] = [];
    
    // 36協定違反チェック
    const timeRecords = await this.getTimeRecords(employeeId);
    const monthlyOvertime = this.calculateMonthlyOvertime(timeRecords);
    
    if (monthlyOvertime > 45) {
      violations.push(`月間残業時間が45時間を超過: ${monthlyOvertime.toFixed(1)}時間`);
    }
    
    if (monthlyOvertime > 100) {
      violations.push(`月間残業時間が100時間を超過: ${monthlyOvertime.toFixed(1)}時間（重大違反）`);
    }
    
    return violations;
  }

  private calculateMonthlyOvertime(timeRecords: TimeRecord[]): number {
    return timeRecords.reduce((total, record) => {
      if (record.clockOut) {
        const workMinutes = (record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60);
        const workHours = (workMinutes - record.breakDuration) / 60;
        return total + Math.max(0, workHours - 8);
      }
      return total;
    }, 0);
  }

  private generateComplianceRecommendations(violations: string[]): string[] {
    const recommendations: string[] = [];
    
    if (violations.some(v => v.includes('45時間を超過'))) {
      recommendations.push('業務量の見直しと効率化を検討してください');
      recommendations.push('労働時間の管理体制を強化してください');
    }
    
    if (violations.some(v => v.includes('100時間を超過'))) {
      recommendations.push('即座に業務負荷を軽減し、医師の面接指導を実施してください');
      recommendations.push('36協定の見直しが必要です');
    }
    
    return recommendations;
  }
}

export default HRModule;