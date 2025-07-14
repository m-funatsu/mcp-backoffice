/**
 * v1.5.0 Employee Lifecycle Management System
 * 従業員ライフサイクル管理システム
 * 
 * Features:
 * - Employee onboarding workflows
 * - Career progression tracking
 * - Performance management integration
 * - Offboarding processes
 * - Organizational change management
 * - Compliance with Japanese labor laws
 */

import Database from './database.js';
import type { Employee } from './types.js';
import { format, addDays, differenceInDays } from 'date-fns';
import { ja } from 'date-fns/locale';

export interface EmployeeLifecycleStage {
  id: string;
  employeeId: string;
  stage: LifecycleStage;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'pending' | 'cancelled';
  milestones: LifecycleMilestone[];
  assignedToHR: string;
  assignedToManager: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type LifecycleStage = 
  | 'pre_onboarding'
  | 'onboarding'
  | 'probation'
  | 'regular_employee'
  | 'performance_improvement'
  | 'promotion'
  | 'lateral_move'
  | 'pre_retirement'
  | 'offboarding'
  | 'alumni';

export interface LifecycleMilestone {
  id: string;
  name: string;
  description: string;
  dueDate: Date;
  completedDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  assignedTo: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  checklist: ChecklistItem[];
  documents: DocumentRequirement[];
  approvals: ApprovalRequirement[];
}

export interface ChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: Date;
  notes?: string;
}

export interface DocumentRequirement {
  id: string;
  documentType: string;
  description: string;
  required: boolean;
  submitted: boolean;
  submittedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  filePath?: string;
}

export interface ApprovalRequirement {
  id: string;
  approverRole: string;
  approverEmployeeId: string;
  approved: boolean;
  approvedAt?: Date;
  notes?: string;
}

export interface OnboardingPlan {
  employeeId: string;
  departmentSpecific: boolean;
  roleSpecific: boolean;
  mentorAssigned: string;
  buddyAssigned: string;
  trainingPlan: TrainingModule[];
  equipmentRequests: EquipmentRequest[];
  systemAccess: SystemAccessRequest[];
  introductionSchedule: IntroductionMeeting[];
  goalSetting: OnboardingGoal[];
}

export interface TrainingModule {
  id: string;
  name: string;
  description: string;
  type: 'mandatory' | 'recommended' | 'optional';
  duration: number; // in hours
  format: 'online' | 'in_person' | 'hybrid';
  completionDeadline: Date;
  completed: boolean;
  completedAt?: Date;
  certificateIssued: boolean;
}

export interface EquipmentRequest {
  id: string;
  itemType: string;
  description: string;
  quantity: number;
  urgency: 'low' | 'medium' | 'high';
  requestedDate: Date;
  approvedBy?: string;
  approvedAt?: Date;
  deliveredAt?: Date;
  returnRequired: boolean;
  returnDate?: Date;
}

export interface SystemAccessRequest {
  id: string;
  system: string;
  accessLevel: string;
  justification: string;
  approvedBy?: string;
  approvedAt?: Date;
  provisionedAt?: Date;
  accountId?: string;
}

export interface IntroductionMeeting {
  id: string;
  meetingType: 'team' | 'department' | 'leadership' | 'client';
  participants: string[];
  scheduledDate: Date;
  duration: number; // in minutes
  completed: boolean;
  notes?: string;
}

export interface OnboardingGoal {
  id: string;
  description: string;
  targetDate: Date;
  category: '30_day' | '60_day' | '90_day' | '180_day';
  priority: 'low' | 'medium' | 'high';
  measurable: boolean;
  achieved: boolean;
  achievedDate?: Date;
  feedback?: string;
}

export interface OffboardingProcess {
  employeeId: string;
  lastWorkingDate: Date;
  reason: 'resignation' | 'retirement' | 'termination' | 'end_of_contract';
  exitInterviewScheduled: boolean;
  exitInterviewDate?: Date;
  assetReturns: AssetReturn[];
  accessRevocations: AccessRevocation[];
  knowledgeTransfer: KnowledgeTransferItem[];
  finalPay: FinalPayCalculation;
  referenceRequests: ReferenceRequest[];
  alumni: boolean;
}

export interface AssetReturn {
  id: string;
  assetType: string;
  description: string;
  serialNumber?: string;
  condition: 'good' | 'fair' | 'poor' | 'damaged';
  returned: boolean;
  returnedDate?: Date;
  notes?: string;
}

export interface AccessRevocation {
  id: string;
  system: string;
  accountId: string;
  revoked: boolean;
  revokedDate?: Date;
  revokedBy?: string;
}

export interface KnowledgeTransferItem {
  id: string;
  topic: string;
  description: string;
  transferTo: string;
  format: 'document' | 'meeting' | 'training' | 'shadowing';
  completed: boolean;
  completedDate?: Date;
  notes?: string;
}

export interface FinalPayCalculation {
  baseSalary: number;
  unpaidLeave: number;
  overtime: number;
  bonuses: number;
  deductions: number;
  totalPay: number;
  paymentDate: Date;
  processed: boolean;
}

export interface ReferenceRequest {
  id: string;
  requestedBy: string;
  requestDate: Date;
  approvedBy?: string;
  approvedAt?: Date;
  completed: boolean;
  notes?: string;
}

export interface LifecycleAnalytics {
  averageOnboardingTime: number; // in days
  onboardingCompletionRate: number; // percentage
  probationSuccessRate: number; // percentage
  averageTenure: number; // in years
  turnoverRate: number; // percentage
  exitReasons: { [reason: string]: number };
  departmentTurnover: { [department: string]: number };
  managerEffectiveness: { [managerId: string]: number };
  onboardingFeedback: OnboardingFeedback[];
}

export interface OnboardingFeedback {
  employeeId: string;
  rating: number; // 1-5
  feedback: string;
  improvements: string[];
  submittedAt: Date;
}

export class EmployeeLifecycleManagement {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Initialize employee lifecycle - typically called when employee is hired
   */
  async initializeEmployeeLifecycle(employeeId: string, startDate: Date): Promise<EmployeeLifecycleStage> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const lifecycleStage: EmployeeLifecycleStage = {
      id: `LC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId,
      stage: 'pre_onboarding',
      startDate,
      status: 'active',
      milestones: this.generateOnboardingMilestones(employeeId, startDate),
      assignedToHR: 'HR_TEAM', // TODO: Get from configuration
      assignedToManager: employee.managerId || 'DEFAULT_MANAGER',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.saveLifecycleStage(lifecycleStage);
    return lifecycleStage;
  }

  /**
   * Generate comprehensive onboarding plan
   */
  async generateOnboardingPlan(employeeId: string, department: string, role: string): Promise<OnboardingPlan> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const plan: OnboardingPlan = {
      employeeId,
      departmentSpecific: true,
      roleSpecific: true,
      mentorAssigned: await this.assignMentor(employeeId, department),
      buddyAssigned: await this.assignBuddy(employeeId, department),
      trainingPlan: this.generateTrainingPlan(role, department),
      equipmentRequests: this.generateEquipmentRequests(role),
      systemAccess: this.generateSystemAccessRequests(role, department),
      introductionSchedule: this.generateIntroductionSchedule(employeeId, department),
      goalSetting: this.generateOnboardingGoals(role)
    };

    await this.saveOnboardingPlan(plan);
    return plan;
  }

  /**
   * Progress employee through lifecycle stages
   */
  async progressToNextStage(employeeId: string, newStage: LifecycleStage, reason?: string): Promise<void> {
    const currentStage = await this.getCurrentLifecycleStage(employeeId);
    if (!currentStage) {
      throw new Error('No current lifecycle stage found');
    }

    // Complete current stage
    currentStage.endDate = new Date();
    currentStage.status = 'completed';
    currentStage.updatedAt = new Date();
    await this.saveLifecycleStage(currentStage);

    // Create new stage
    const newStageRecord: EmployeeLifecycleStage = {
      id: `LC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId,
      stage: newStage,
      startDate: new Date(),
      status: 'active',
      milestones: this.generateMilestonesForStage(newStage, employeeId),
      assignedToHR: currentStage.assignedToHR,
      assignedToManager: currentStage.assignedToManager,
      notes: reason,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.saveLifecycleStage(newStageRecord);

    // Send notifications
    await this.sendStageTransitionNotification(employeeId, currentStage.stage, newStage);
  }

  /**
   * Start offboarding process
   */
  async initiateOffboarding(employeeId: string, lastWorkingDate: Date, reason: string): Promise<OffboardingProcess> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }

    const offboardingProcess: OffboardingProcess = {
      employeeId,
      lastWorkingDate,
      reason: reason as any,
      exitInterviewScheduled: false,
      assetReturns: await this.getEmployeeAssets(employeeId),
      accessRevocations: await this.getEmployeeSystemAccess(employeeId),
      knowledgeTransfer: await this.generateKnowledgeTransferPlan(employeeId),
      finalPay: await this.calculateFinalPay(employeeId, lastWorkingDate),
      referenceRequests: [],
      alumni: false
    };

    await this.saveOffboardingProcess(offboardingProcess);
    
    // Progress to offboarding stage
    await this.progressToNextStage(employeeId, 'offboarding', reason);

    return offboardingProcess;
  }

  /**
   * Get employee's current lifecycle stage
   */
  async getCurrentLifecycleStage(employeeId: string): Promise<EmployeeLifecycleStage | null> {
    // Mock implementation - in real scenario, query database
    return null;
  }

  /**
   * Generate lifecycle analytics
   */
  async generateLifecycleAnalytics(department?: string, dateRange?: { start: Date; end: Date }): Promise<LifecycleAnalytics> {
    // Mock implementation - in real scenario, analyze historical data
    return {
      averageOnboardingTime: 45,
      onboardingCompletionRate: 92.5,
      probationSuccessRate: 88.3,
      averageTenure: 3.2,
      turnoverRate: 12.8,
      exitReasons: {
        'resignation': 65,
        'retirement': 15,
        'termination': 10,
        'end_of_contract': 10
      },
      departmentTurnover: {
        'Engineering': 8.5,
        'Sales': 18.2,
        'Marketing': 15.1,
        'HR': 6.3
      },
      managerEffectiveness: {
        'MGR_001': 4.2,
        'MGR_002': 3.8,
        'MGR_003': 4.5
      },
      onboardingFeedback: []
    };
  }

  // Private helper methods

  private generateOnboardingMilestones(employeeId: string, startDate: Date): LifecycleMilestone[] {
    const milestones: LifecycleMilestone[] = [
      {
        id: `M_${Date.now()}_1`,
        name: 'Documentation Collection',
        description: '必要書類の収集と確認',
        dueDate: addDays(startDate, -7),
        status: 'pending',
        assignedTo: 'HR_TEAM',
        priority: 'high',
        checklist: [
          { id: 'C1', description: '履歴書', completed: false },
          { id: 'C2', description: '職務経歴書', completed: false },
          { id: 'C3', description: '身元保証書', completed: false }
        ],
        documents: [
          { id: 'D1', documentType: 'resume', description: '履歴書', required: true, submitted: false },
          { id: 'D2', documentType: 'guarantee', description: '身元保証書', required: true, submitted: false }
        ],
        approvals: [
          { id: 'A1', approverRole: 'HR_MANAGER', approverEmployeeId: 'HR_001', approved: false }
        ]
      },
      {
        id: `M_${Date.now()}_2`,
        name: 'First Day Setup',
        description: '初日のセットアップ',
        dueDate: startDate,
        status: 'pending',
        assignedTo: 'HR_TEAM',
        priority: 'critical',
        checklist: [
          { id: 'C3', description: 'IDカード発行', completed: false },
          { id: 'C4', description: 'PCセットアップ', completed: false },
          { id: 'C5', description: '座席案内', completed: false }
        ],
        documents: [],
        approvals: []
      }
    ];

    return milestones;
  }

  private generateMilestonesForStage(stage: LifecycleStage, employeeId: string): LifecycleMilestone[] {
    // Generate stage-specific milestones
    switch (stage) {
      case 'probation':
        return [
          {
            id: `M_${Date.now()}_PROB`,
            name: 'Probation Review',
            description: '試用期間評価',
            dueDate: addDays(new Date(), 90),
            status: 'pending',
            assignedTo: 'MANAGER',
            priority: 'high',
            checklist: [],
            documents: [],
            approvals: []
          }
        ];
      default:
        return [];
    }
  }

  private async assignMentor(employeeId: string, department: string): Promise<string> {
    // Logic to assign mentor based on department and availability
    return 'MENTOR_001';
  }

  private async assignBuddy(employeeId: string, department: string): Promise<string> {
    // Logic to assign buddy based on department and seniority
    return 'BUDDY_001';
  }

  private generateTrainingPlan(role: string, department: string): TrainingModule[] {
    return [
      {
        id: 'T_ORIENTATION',
        name: 'Company Orientation',
        description: '会社概要・文化・規則の説明',
        type: 'mandatory',
        duration: 4,
        format: 'in_person',
        completionDeadline: addDays(new Date(), 3),
        completed: false,
        certificateIssued: false
      },
      {
        id: 'T_COMPLIANCE',
        name: 'Compliance Training',
        description: '法令遵守・ハラスメント防止研修',
        type: 'mandatory',
        duration: 2,
        format: 'online',
        completionDeadline: addDays(new Date(), 7),
        completed: false,
        certificateIssued: false
      }
    ];
  }

  private generateEquipmentRequests(role: string): EquipmentRequest[] {
    return [
      {
        id: 'E_LAPTOP',
        itemType: 'laptop',
        description: 'ノートPC',
        quantity: 1,
        urgency: 'high',
        requestedDate: new Date(),
        returnRequired: true
      },
      {
        id: 'E_MONITOR',
        itemType: 'monitor',
        description: '外部モニター',
        quantity: 1,
        urgency: 'medium',
        requestedDate: new Date(),
        returnRequired: true
      }
    ];
  }

  private generateSystemAccessRequests(role: string, department: string): SystemAccessRequest[] {
    return [
      {
        id: 'S_EMAIL',
        system: 'Email System',
        accessLevel: 'user',
        justification: 'Business communication'
      },
      {
        id: 'S_SLACK',
        system: 'Slack',
        accessLevel: 'user',
        justification: 'Team collaboration'
      }
    ];
  }

  private generateIntroductionSchedule(employeeId: string, department: string): IntroductionMeeting[] {
    return [
      {
        id: 'I_TEAM',
        meetingType: 'team',
        participants: ['TEAM_LEAD', 'TEAM_MEMBER_1', 'TEAM_MEMBER_2'],
        scheduledDate: addDays(new Date(), 1),
        duration: 60,
        completed: false
      }
    ];
  }

  private generateOnboardingGoals(role: string): OnboardingGoal[] {
    return [
      {
        id: 'G_30_SYSTEM',
        description: '基本システムの使用方法を習得',
        targetDate: addDays(new Date(), 30),
        category: '30_day',
        priority: 'high',
        measurable: true,
        achieved: false
      },
      {
        id: 'G_90_PERFORMANCE',
        description: '独立して業務を遂行できるレベルに到達',
        targetDate: addDays(new Date(), 90),
        category: '90_day',
        priority: 'high',
        measurable: true,
        achieved: false
      }
    ];
  }

  private async getEmployeeAssets(employeeId: string): Promise<AssetReturn[]> {
    // Mock implementation - get from asset management system
    return [
      {
        id: 'A_LAPTOP_001',
        assetType: 'laptop',
        description: 'Dell Latitude 7420',
        serialNumber: 'DL7420001',
        condition: 'good',
        returned: false
      }
    ];
  }

  private async getEmployeeSystemAccess(employeeId: string): Promise<AccessRevocation[]> {
    // Mock implementation - get from access management system
    return [
      {
        id: 'ACC_EMAIL_001',
        system: 'Email System',
        accountId: 'user@company.com',
        revoked: false
      }
    ];
  }

  private async generateKnowledgeTransferPlan(employeeId: string): Promise<KnowledgeTransferItem[]> {
    // Mock implementation - identify key knowledge areas
    return [
      {
        id: 'KT_PROJECT_001',
        topic: 'Project Alpha Documentation',
        description: 'プロジェクトAlphaの技術文書と進捗状況',
        transferTo: 'COLLEAGUE_001',
        format: 'document',
        completed: false
      }
    ];
  }

  private async calculateFinalPay(employeeId: string, lastWorkingDate: Date): Promise<FinalPayCalculation> {
    // Mock implementation - calculate final pay
    return {
      baseSalary: 300000,
      unpaidLeave: 50000,
      overtime: 25000,
      bonuses: 100000,
      deductions: 30000,
      totalPay: 395000,
      paymentDate: addDays(lastWorkingDate, 7),
      processed: false
    };
  }

  private async saveLifecycleStage(stage: EmployeeLifecycleStage): Promise<void> {
    // Mock implementation - save to database
    console.log('Saving lifecycle stage:', stage);
  }

  private async saveOnboardingPlan(plan: OnboardingPlan): Promise<void> {
    // Mock implementation - save to database
    console.log('Saving onboarding plan:', plan);
  }

  private async saveOffboardingProcess(process: OffboardingProcess): Promise<void> {
    // Mock implementation - save to database
    console.log('Saving offboarding process:', process);
  }

  private async sendStageTransitionNotification(employeeId: string, fromStage: LifecycleStage, toStage: LifecycleStage): Promise<void> {
    // Mock implementation - send notifications
    console.log(`Employee ${employeeId} transitioned from ${fromStage} to ${toStage}`);
  }
}

export default EmployeeLifecycleManagement;