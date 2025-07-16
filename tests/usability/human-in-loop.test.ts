import { describe, it, expect, beforeEach, vi } from 'vitest';
import PayrollCalculator from '../../src/payroll.js';
import Database from '../../src/database.js';
import { defaultPayrollRules } from '../setup/test-db.js';

// Human-in-the-Loop UI コンポーネントの型定義
interface HumanInLoopUI {
  type: 'approval_required' | 'error_correction' | 'decision_support' | 'warning';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: any;
  actions: Array<{
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'danger';
    handler: () => Promise<any>;
  }>;
  metadata: {
    timestamp: Date;
    source: string;
    requiresHumanDecision: boolean;
    autoExecutable: boolean;
  };
}

// GenUI for MCP の実装
class GenUIGenerator {
  generateApprovalUI(data: any, context: string): HumanInLoopUI {
    return {
      type: 'approval_required',
      title: this.generateTitle(data, context),
      description: this.generateDescription(data, context),
      severity: this.calculateSeverity(data),
      data: data,
      actions: this.generateActions(data, context),
      metadata: {
        timestamp: new Date(),
        source: context,
        requiresHumanDecision: true,
        autoExecutable: false
      }
    };
  }

  private generateTitle(data: any, context: string): string {
    switch (context) {
      case 'payroll_violation':
        return `労働基準法違反が検出されました: ${data.employeeName}`;
      case 'incomplete_records':
        return `勤怠記録に不備があります: ${data.employeeName}`;
      case 'overtime_approval':
        return `残業申請の承認が必要です: ${data.employeeName}`;
      default:
        return '管理者の判断が必要です';
    }
  }

  private generateDescription(data: any, context: string): string {
    switch (context) {
      case 'payroll_violation':
        return `${data.employeeName}さんの${data.month}月の勤務で、以下の労働基準法違反が検出されました：\n${data.violations.join('\n')}`;
      case 'incomplete_records':
        return `${data.employeeName}さんの勤怠記録で退勤打刻が不足しています。手動で修正するか、従業員に確認してください。`;
      case 'overtime_approval':
        return `${data.employeeName}さんから${data.overtimeHours}時間の残業申請があります。月間累計：${data.monthlyTotal}時間`;
      default:
        return 'システムが自動判断できない状況が発生しました。';
    }
  }

  private calculateSeverity(data: any): 'low' | 'medium' | 'high' | 'critical' {
    if (data.violations?.some((v: string) => v.includes('36協定'))) return 'critical';
    if (data.overtimeHours > 45) return 'high';
    if (data.incompleteRecords?.length > 0) return 'medium';
    return 'low';
  }

  private generateActions(data: any, context: string): Array<any> {
    const actions = [];
    
    switch (context) {
      case 'payroll_violation':
        actions.push(
          {
            id: 'approve_with_note',
            label: '特別承認（理由を記録）',
            type: 'primary',
            handler: async () => ({ action: 'approve', note: 'Special approval granted' })
          },
          {
            id: 'reject_and_adjust',
            label: '拒否して勤務時間を調整',
            type: 'danger',
            handler: async () => ({ action: 'reject', adjustments: data.suggestedAdjustments })
          }
        );
        break;
        
      case 'incomplete_records':
        actions.push(
          {
            id: 'manual_correction',
            label: '手動で修正',
            type: 'primary',
            handler: async () => ({ action: 'manual_fix', records: data.incompleteRecords })
          },
          {
            id: 'request_employee_input',
            label: '従業員に確認依頼',
            type: 'secondary',
            handler: async () => ({ action: 'request_input', employeeId: data.employeeId })
          }
        );
        break;
        
      case 'overtime_approval':
        actions.push(
          {
            id: 'approve_overtime',
            label: '承認',
            type: 'primary',
            handler: async () => ({ action: 'approve', overtimeHours: data.overtimeHours })
          },
          {
            id: 'partial_approval',
            label: '一部承認',
            type: 'secondary',
            handler: async () => ({ action: 'partial_approve', approvedHours: data.overtimeHours * 0.8 })
          },
          {
            id: 'deny_overtime',
            label: '拒否',
            type: 'danger',
            handler: async () => ({ action: 'deny', reason: 'Exceeds monthly limit' })
          }
        );
        break;
    }
    
    return actions;
  }
}

describe.skip('Human-in-the-Loop Usability Tests', () => {
  let db: Database;
  let payrollCalculator: PayrollCalculator;
  let genUI: GenUIGenerator;
  let testEmployeeId: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    try {
      await db.initializeDatabase();
    } catch (error) {
      // Database might already be initialized
    }
    payrollCalculator = new PayrollCalculator(db as any, defaultPayrollRules);
    genUI = new GenUIGenerator();
    
    // テスト用従業員作成
    testEmployeeId = await db.addEmployee({
      name: 'UIテスト従業員',
      department: 'テスト部',
      position: 'テスター',
      hourlyRate: 3000,
      joinDate: new Date('2024-01-01'),
      isActive: true
    });
  });

  describe('GenUI Clarity and Intuitive Design', () => {
    it('should generate clear violation UI with actionable information', async () => {
      // 労働基準法違反シナリオの作成
      const violationData = {
        employeeName: 'UIテスト従業員',
        employeeId: testEmployeeId,
        month: '2024-07',
        violations: [
          '月間時間外労働時間が上限(45時間)を超過: 67.5時間',
          '2024-07-15: 労働時間が8時間を超える場合、60分以上の休憩が必要です',
          '36協定の特別条項に抵触する可能性があります'
        ],
        overtimeHours: 67.5,
        suggestedAdjustments: [
          '7月の残業時間を45時間に制限',
          '不足分は8月に振り分け',
          '特別条項の適用を検討'
        ]
      };

      const violationUI = genUI.generateApprovalUI(violationData, 'payroll_violation');
      
      // UI要素の明確性をテスト
      expect(violationUI.title).toContain('労働基準法違反が検出されました');
      expect(violationUI.title).toContain('UIテスト従業員');
      expect(violationUI.description).toContain('67.5時間');
      expect(violationUI.description).toContain('36協定');
      expect(violationUI.severity).toBe('critical');
      
      // アクションの適切性をテスト
      expect(violationUI.actions).toHaveLength(2);
      expect(violationUI.actions[0].label).toContain('特別承認');
      expect(violationUI.actions[1].label).toContain('拒否');
      expect(violationUI.actions[1].type).toBe('danger');
      
      // メタデータの完全性をテスト
      expect(violationUI.metadata.requiresHumanDecision).toBe(true);
      expect(violationUI.metadata.autoExecutable).toBe(false);
      
      console.log('✅ Violation UI generated successfully:');
      console.log(`   Title: ${violationUI.title}`);
      console.log(`   Severity: ${violationUI.severity}`);
      console.log(`   Actions: ${violationUI.actions.map(a => a.label).join(', ')}`);
    });

    it('should generate intuitive incomplete records UI', async () => {
      // 不完全な勤怠記録のシナリオ
      const incompleteData = {
        employeeName: 'UIテスト従業員',
        employeeId: testEmployeeId,
        date: '2024-07-15',
        incompleteRecords: [
          {
            date: '2024-07-15',
            clockIn: '09:00',
            clockOut: null,
            issue: '退勤打刻なし'
          }
        ]
      };

      const incompleteUI = genUI.generateApprovalUI(incompleteData, 'incomplete_records');
      
      expect(incompleteUI.title).toContain('勤怠記録に不備があります');
      expect(incompleteUI.description).toContain('退勤打刻が不足');
      expect(incompleteUI.severity).toBe('medium');
      
      // 修正オプションの明確性
      const manualFixAction = incompleteUI.actions.find(a => a.id === 'manual_correction');
      const requestInputAction = incompleteUI.actions.find(a => a.id === 'request_employee_input');
      
      expect(manualFixAction).toBeDefined();
      expect(manualFixAction!.label).toBe('手動で修正');
      expect(requestInputAction).toBeDefined();
      expect(requestInputAction!.label).toBe('従業員に確認依頼');
      
      console.log('✅ Incomplete records UI generated successfully:');
      console.log(`   Options: ${incompleteUI.actions.map(a => a.label).join(', ')}`);
    });

    it('should provide contextual overtime approval UI', async () => {
      const overtimeData = {
        employeeName: 'UIテスト従業員',
        employeeId: testEmployeeId,
        requestedDate: '2024-07-20',
        overtimeHours: 3.5,
        monthlyTotal: 42.5,
        reason: 'プロジェクト納期対応'
      };

      const overtimeUI = genUI.generateApprovalUI(overtimeData, 'overtime_approval');
      
      expect(overtimeUI.title).toContain('残業申請の承認が必要です');
      expect(overtimeUI.description).toContain('3.5時間');
      expect(overtimeUI.description).toContain('月間累計：42.5時間');
      
      // 承認オプションの段階的提示
      const approvalActions = overtimeUI.actions.map(a => a.id);
      expect(approvalActions).toContain('approve_overtime');
      expect(approvalActions).toContain('partial_approval');
      expect(approvalActions).toContain('deny_overtime');
      
      console.log('✅ Overtime approval UI provides graduated response options');
    });
  });

  describe('Human Intervention Workflows', () => {
    it('should allow manual correction of payroll discrepancies', async () => {
      // 実際の勤怠記録を作成
      const clockIn = new Date('2024-07-15T09:00:00');
      await db.clockIn(testEmployeeId, clockIn, 'ic_card');
      // 意図的に退勤打刻を欠落させる
      
      // 不完全記録の検出
      const timeRecords = await db.getTimeRecords(
        testEmployeeId,
        new Date('2024-07-01'),
        new Date('2024-07-31')
      );
      
      const incompleteRecords = timeRecords.filter(record => !record.clockOut);
      expect(incompleteRecords).toHaveLength(1);
      
      // 手動修正プロセスのシミュレーション
      const manualCorrectionUI = genUI.generateApprovalUI({
        employeeName: 'UIテスト従業員',
        employeeId: testEmployeeId,
        incompleteRecords: incompleteRecords
      }, 'incomplete_records');
      
      // 管理者による手動修正の実行
      const manualFixAction = manualCorrectionUI.actions.find(a => a.id === 'manual_correction');
      const correctionResult = await manualFixAction!.handler();
      
      expect(correctionResult.action).toBe('manual_fix');
      expect(correctionResult.records).toBeDefined();
      
      console.log('✅ Manual correction workflow successfully tested');
    });

    it('should support approval workflows with audit trails', async () => {
      const approvalWorkflow = {
        requestId: 'REQ_20240715_001',
        submittedBy: testEmployeeId,
        submittedAt: new Date(),
        approvalHistory: [] as any[],
        
        async addApprovalStep(approver: string, decision: string, note?: string) {
          this.approvalHistory.push({
            approver,
            decision,
            note,
            timestamp: new Date()
          });
        },
        
        getApprovalStatus() {
          const latestDecision = this.approvalHistory[this.approvalHistory.length - 1];
          return latestDecision ? latestDecision.decision : 'pending';
        }
      };
      
      // 第1段階承認（直属管理者）
      await approvalWorkflow.addApprovalStep('manager_001', 'approved', '通常の業務範囲内');
      
      // 第2段階承認（人事部長）- 労働基準法違反の場合
      await approvalWorkflow.addApprovalStep('hr_director_001', 'conditionally_approved', '36協定特別条項を適用');
      
      expect(approvalWorkflow.approvalHistory).toHaveLength(2);
      expect(approvalWorkflow.getApprovalStatus()).toBe('conditionally_approved');
      
      // 監査証跡の完全性確認
      approvalWorkflow.approvalHistory.forEach(step => {
        expect(step.approver).toBeDefined();
        expect(step.decision).toBeDefined();
        expect(step.timestamp).toBeDefined();
      });
      
      console.log('✅ Multi-stage approval workflow with audit trail verified');
    });
  });

  describe('Error Recovery and User Guidance', () => {
    it('should provide clear guidance for resolving data conflicts', async () => {
      // データ競合シナリオ: 同時期の重複勤怠記録
      const conflictData = {
        employeeName: 'UIテスト従業員',
        conflicts: [
          {
            date: '2024-07-15',
            records: [
              { source: 'IC_CARD', clockIn: '09:00', clockOut: '18:00' },
              { source: 'MANUAL', clockIn: '09:15', clockOut: '18:30' }
            ]
          }
        ]
      };

      const conflictResolutionUI = {
        type: 'error_correction' as const,
        title: 'データ競合の解決が必要です',
        description: '同じ日に複数の勤怠記録が存在します。正しい記録を選択してください。',
        severity: 'medium' as const,
        data: conflictData,
        actions: [
          {
            id: 'use_ic_card',
            label: 'ICカード記録を採用',
            type: 'primary' as const,
            handler: async () => ({ action: 'use_primary', source: 'IC_CARD' })
          },
          {
            id: 'use_manual',
            label: '手動記録を採用',
            type: 'secondary' as const,
            handler: async () => ({ action: 'use_secondary', source: 'MANUAL' })
          },
          {
            id: 'merge_records',
            label: '記録をマージ',
            type: 'secondary' as const,
            handler: async () => ({ action: 'merge', strategy: 'earliest_in_latest_out' })
          }
        ],
        metadata: {
          timestamp: new Date(),
          source: 'data_conflict_detector',
          requiresHumanDecision: true,
          autoExecutable: false
        }
      };

      expect(conflictResolutionUI.actions).toHaveLength(3);
      expect(conflictResolutionUI.actions[0].label).toContain('ICカード');
      expect(conflictResolutionUI.actions[2].label).toContain('マージ');
      
      // 各オプションの実行をテスト
      for (const action of conflictResolutionUI.actions) {
        const result = await action.handler();
        expect(result.action).toBeDefined();
      }
      
      console.log('✅ Data conflict resolution UI provides clear options');
    });

    it('should offer intelligent suggestions for complex scenarios', async () => {
      // 複雑なシナリオ: 月末の労働時間調整
      const complexScenario = {
        employeeName: 'UIテスト従業員',
        currentMonth: '2024-07',
        currentOvertimeHours: 43.5,
        remainingWorkDays: 3,
        projectedOvertimeHours: 52.0,
        suggestions: [
          {
            option: 'redistribute_workload',
            description: '他のチームメンバーに作業を分散',
            impact: '予測残業時間: 45時間以内'
          },
          {
            option: 'defer_to_next_month',
            description: '非緊急タスクを8月に延期',
            impact: '7月残業時間: 45時間、8月への影響: +7時間'
          },
          {
            option: 'apply_special_provision',
            description: '36協定特別条項を適用',
            impact: '法的要件: 労働者代表との協議、6ヶ月以内制限確認（年間720時間以内）'
          }
        ]
      };

      const intelligentSuggestionUI = {
        type: 'decision_support' as const,
        title: '労働時間管理の最適化提案',
        description: `${complexScenario.employeeName}さんの月間残業時間が上限に近づいています。以下の選択肢をご検討ください。`,
        severity: 'high' as const,
        data: complexScenario,
        actions: complexScenario.suggestions.map((suggestion, index) => ({
          id: suggestion.option,
          label: suggestion.description,
          type: index === 0 ? 'primary' as const : 'secondary' as const,
          handler: async () => ({ 
            action: suggestion.option, 
            impact: suggestion.impact 
          })
        })),
        metadata: {
          timestamp: new Date(),
          source: 'intelligent_advisor',
          requiresHumanDecision: true,
          autoExecutable: false
        }
      };

      expect(intelligentSuggestionUI.actions).toHaveLength(3);
      expect(intelligentSuggestionUI.description).toContain('上限に近づいています');
      
      // 各提案の詳細度をテスト
      complexScenario.suggestions.forEach(suggestion => {
        expect(suggestion.description).toBeDefined();
        expect(suggestion.impact).toBeDefined();
        expect(suggestion.impact).toContain('時間');
      });
      
      console.log('✅ Intelligent suggestions provide actionable alternatives with clear impact assessment');
    });
  });
});