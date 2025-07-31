import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { DatabasePostgreSQL } from '../../src/database_postgresql';
import { IntegratedPayrollEngine } from '../../src/payroll-engine';
import { ComplianceEngine } from '../../src/compliance-engine';
import ExpenseManagementEngine from '../../src/expense-engine';
import HumanCapitalDisclosureEngine from '../../src/human-capital-disclosure-engine-v2.0.0';
import PredictiveAnalyticsEngine from '../../src/predictive-analytics-engine-v2.1.0';
import { TalentManagementEngine } from '../../src/talent-management-engine-v2.2.0';
import { SkillManagementEngine } from '../../src/skill-management-engine-v2.3.0';
import IntegratedAnomalyDetectionEngine from '../../src/integrated-anomaly-detection-v2.1.0';
import { EcosystemIntegrationManager } from '../../src/ecosystem-integration-v2.2.0';
import { AgentOrchestrator } from '../../src/agent-framework-v3.0.0';
import { GenerativeUIEngine } from '../../src/generative-ui-engine-v3.1.0';
import { SecurityValidator } from '../../src/security-validator';
import { PerformanceOptimizer } from '../../src/performance-optimizer';
import type { Employee, TimeRecord, ExpenseRequest, ObjectiveTimeRecord } from '../../src/types';

/**
 * AI-Native Enterprise Operating System (AI-OS)
 * 究極の網羅的テストスイート v1.0.0
 * 
 * すべての機能と実データシナリオの完全な統合テスト
 */
describe('AI-OS 究極の網羅的テストスイート', () => {
  let db: DatabasePostgreSQL;
  let payrollEngine: IntegratedPayrollEngine;
  let complianceEngine: ComplianceEngine;
  let expenseEngine: ExpenseManagementEngine;
  let humanCapitalEngine: HumanCapitalDisclosureEngine;
  let predictiveEngine: PredictiveAnalyticsEngine;
  let talentEngine: TalentManagementEngine;
  let skillEngine: SkillManagementEngine;
  let anomalyEngine: IntegratedAnomalyDetectionEngine;
  let integrationManager: EcosystemIntegrationManager;
  let agentOrchestrator: AgentOrchestrator;
  let uiEngine: GenerativeUIEngine;
  let securityValidator: SecurityValidator;
  let performanceOptimizer: PerformanceOptimizer;

  // 実データに近いテストデータ
  let realEmployees: Employee[];
  let realTimeRecords: TimeRecord[];
  let realExpenses: ExpenseRequest[];
  let realObjectiveRecords: ObjectiveTimeRecord[];

  beforeAll(async () => {
    // 実際のデータベース接続に近いモック
    db = createRealisticMockDatabase();
    
    // 全エンジンの初期化
    payrollEngine = new IntegratedPayrollEngine(db);
    complianceEngine = new ComplianceEngine(db);
    expenseEngine = new ExpenseManagementEngine(db);
    humanCapitalEngine = new HumanCapitalDisclosureEngine(db);
    predictiveEngine = new PredictiveAnalyticsEngine(db);
    talentEngine = new TalentManagementEngine(db);
    skillEngine = new SkillManagementEngine(db);
    anomalyEngine = new IntegratedAnomalyDetectionEngine(db);
    integrationManager = new EcosystemIntegrationManager(db);
    agentOrchestrator = new AgentOrchestrator(db);
    uiEngine = new GenerativeUIEngine();
    securityValidator = new SecurityValidator();
    performanceOptimizer = new PerformanceOptimizer(
      { max: 10, min: 2, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000, statementTimeout: 10000 },
      'redis://localhost:6379',
      10
    );

    // 実データの生成
    realEmployees = generateRealisticEmployeeData();
    realTimeRecords = generateRealisticTimeRecords(realEmployees);
    realExpenses = generateRealisticExpenses(realEmployees);
    realObjectiveRecords = generateRealisticObjectiveRecords(realEmployees);
  });

  afterAll(async () => {
    await performanceOptimizer.close();
  });

  describe('1. 完全な月次処理サイクル', () => {
    it('月初から月末までの全処理を実行する', async () => {
      const targetMonth = '2025-07';
      const results = {
        attendance: [],
        compliance: [],
        payroll: [],
        expenses: [],
        reports: []
      };

      // 1日目～31日目の処理
      for (let day = 1; day <= 31; day++) {
        const currentDate = new Date(`2025-07-${String(day).padStart(2, '0')}`);
        
        // 日次勤怠処理
        for (const employee of realEmployees) {
          // 出勤記録
          const clockIn = new Date(currentDate);
          clockIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
          
          const clockOut = new Date(currentDate);
          clockOut.setHours(17 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));
          
          const timeRecord: TimeRecord = {
            id: `tr_${employee.id}_${day}`,
            employeeId: employee.id,
            date: currentDate,
            clockIn,
            clockOut,
            breakMinutes: 60,
            recordType: 'ic_card'
          };
          
          // 客観的記録との照合
          const objectiveRecord = realObjectiveRecords.find(
            r => r.employeeId === employee.id && 
            r.timestamp.toDateString() === currentDate.toDateString()
          );
          
          if (objectiveRecord) {
            const discrepancy = await complianceEngine.checkDiscrepancy(
              employee.id,
              currentDate
            );
            
            if (discrepancy?.hasDiscrepancy) {
              results.compliance.push({
                type: 'discrepancy',
                employeeId: employee.id,
                date: currentDate,
                details: discrepancy
              });
            }
          }
          
          results.attendance.push(timeRecord);
        }
        
        // 日次コンプライアンスチェック
        if (day % 5 === 0) { // 5日ごとに詳細チェック
          for (const employee of realEmployees) {
            const complianceStatus = await complianceEngine.monitor36Agreement(
              employee.id,
              currentDate
            );
            
            if (!complianceStatus.isCompliant || complianceStatus.alerts.length > 0) {
              results.compliance.push({
                type: '36agreement',
                employeeId: employee.id,
                date: currentDate,
                status: complianceStatus
              });
            }
          }
        }
      }

      // 月末給与計算
      for (const employee of realEmployees) {
        const payrollResult = await payrollEngine.calculatePayroll(
          employee.id,
          targetMonth
        );
        
        results.payroll.push(payrollResult);
        
        // 給与明細の生成
        const payslip = await payrollEngine.generatePayslip(payrollResult);
        expect(payslip).toContain(employee.name);
        expect(payslip).toContain('基本給');
        expect(payslip).toContain('控除');
      }

      // 月次経費処理
      const monthlyExpenses = realExpenses.filter(
        exp => exp.expenseDate.getMonth() === 6 // 7月
      );
      
      for (const expense of monthlyExpenses) {
        const processed = await expenseEngine.processExpense(expense);
        results.expenses.push(processed);
      }

      // 月次レポート生成
      const monthlyReport = await humanCapitalEngine.generateMonthlyReport(
        'Test Company',
        targetMonth
      );
      
      results.reports.push(monthlyReport);

      // 検証
      expect(results.attendance.length).toBe(31 * realEmployees.length);
      expect(results.payroll.length).toBe(realEmployees.length);
      expect(results.expenses.length).toBeGreaterThan(0);
      expect(results.compliance.length).toBeGreaterThan(0); // 何らかのアラートが発生するはず
    });
  });

  describe('2. 複雑な勤務パターンのテスト', () => {
    it('フレックスタイム制の勤怠を正確に処理する', async () => {
      const flexEmployee = {
        ...realEmployees[0],
        workSystem: 'flex',
        coreTimeStart: 10,
        coreTimeEnd: 15,
        monthlyTargetHours: 160
      };

      // 変則的な勤務パターン
      const flexPatterns = [
        { in: '07:00', out: '16:00' }, // 早朝型
        { in: '11:00', out: '20:00' }, // 遅め型
        { in: '08:30', out: '15:30' }, // 短時間
        { in: '09:00', out: '22:00' }  // 長時間
      ];

      const monthlyRecords = [];
      for (let day = 1; day <= 20; day++) {
        const pattern = flexPatterns[day % flexPatterns.length];
        const date = new Date(`2025-07-${String(day).padStart(2, '0')}`);
        
        const [inHour, inMin] = pattern.in.split(':').map(Number);
        const [outHour, outMin] = pattern.out.split(':').map(Number);
        
        const record: TimeRecord = {
          id: `flex_${day}`,
          employeeId: flexEmployee.id,
          date,
          clockIn: new Date(date.setHours(inHour, inMin)),
          clockOut: new Date(date.setHours(outHour, outMin)),
          breakMinutes: 60,
          recordType: 'ic_card'
        };
        
        monthlyRecords.push(record);
      }

      // コアタイム違反チェック
      const violations = monthlyRecords.filter(record => {
        const inHour = record.clockIn.getHours();
        const outHour = record.clockOut.getHours();
        return inHour > flexEmployee.coreTimeStart || outHour < flexEmployee.coreTimeEnd;
      });

      expect(violations.length).toBeGreaterThan(0);

      // 月間総労働時間の計算
      const totalHours = monthlyRecords.reduce((sum, record) => {
        const hours = (record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60 * 60);
        return sum + hours - record.breakMinutes / 60;
      }, 0);

      expect(totalHours).toBeGreaterThan(flexEmployee.monthlyTargetHours * 0.8);
      expect(totalHours).toBeLessThan(flexEmployee.monthlyTargetHours * 1.2);
    });

    it('変形労働時間制の36協定チェックを行う', async () => {
      const irregularEmployee = {
        ...realEmployees[1],
        workSystem: 'irregular',
        pattern: '1ヶ月単位'
      };

      // 週によって異なる労働時間
      const weeklyPatterns = [
        { days: 6, hoursPerDay: 7 },    // 週42時間
        { days: 5, hoursPerDay: 9 },    // 週45時間  
        { days: 4, hoursPerDay: 10 },   // 週40時間
        { days: 5, hoursPerDay: 8 }     // 週40時間
      ];

      const monthlyTotal = weeklyPatterns.reduce(
        (sum, week) => sum + week.days * week.hoursPerDay, 0
      );

      // 月平均が週40時間以内かチェック
      const averageWeeklyHours = (monthlyTotal / 4);
      expect(averageWeeklyHours).toBeLessThanOrEqual(40);

      // 特定の週で長時間労働があっても月単位で調整されていればOK
      const maxWeeklyHours = Math.max(...weeklyPatterns.map(w => w.days * w.hoursPerDay));
      expect(maxWeeklyHours).toBeLessThanOrEqual(48); // 週48時間が上限
    });

    it('裁量労働制の勤怠管理を行う', async () => {
      const discretionaryEmployee = {
        ...realEmployees[2],
        workSystem: 'discretionary',
        deemedHoursPerDay: 8
      };

      // 実際の勤務時間に関わらず、みなし労働時間で計算
      const actualRecords = [
        { hours: 6 },   // 短い日
        { hours: 10 },  // 長い日
        { hours: 12 },  // かなり長い日
        { hours: 7 }    // 普通の日
      ];

      const payrollData = actualRecords.map(record => ({
        actualHours: record.hours,
        payableHours: discretionaryEmployee.deemedHoursPerDay,
        overtime: 0 // 裁量労働制では基本的に残業なし
      }));

      // 健康管理の観点から実労働時間も記録
      const healthCheck = actualRecords.filter(r => r.hours > 11).length;
      expect(healthCheck).toBeGreaterThan(0); // 長時間労働の日がある

      // みなし労働時間での給与計算
      const totalPayableHours = payrollData.reduce(
        (sum, data) => sum + data.payableHours, 0
      );
      expect(totalPayableHours).toBe(discretionaryEmployee.deemedHoursPerDay * 4);
    });
  });

  describe('3. 高度な給与計算シナリオ', () => {
    it('複雑な手当と控除を含む給与計算を行う', async () => {
      const complexEmployee = {
        ...realEmployees[3],
        allowances: {
          housing: 50000,      // 住宅手当
          family: 20000,       // 家族手当
          commute: 15000,      // 通勤手当（非課税限度額内）
          skill: 30000,        // 技能手当
          position: 100000     // 役職手当
        },
        deductions: {
          housingLoan: 80000,  // 住宅ローン
          insurance: 5000,     // 生命保険
          pension401k: 23000   // 確定拠出年金
        }
      };

      const payrollResult = await payrollEngine.calculateComplexPayroll(
        complexEmployee,
        '2025-07'
      );

      // 総支給額の計算
      const totalAllowances = Object.values(complexEmployee.allowances).reduce(
        (sum, amount) => sum + amount, 0
      );
      
      expect(payrollResult.grossPay).toBe(
        payrollResult.basePay + totalAllowances + payrollResult.overtimePay
      );

      // 課税対象額の計算（通勤手当は非課税）
      const taxableIncome = payrollResult.grossPay - complexEmployee.allowances.commute;
      expect(payrollResult.taxableIncome).toBe(taxableIncome);

      // 社会保険料の計算
      const socialInsurance = {
        healthInsurance: Math.floor(taxableIncome * 0.0499),
        pension: Math.floor(taxableIncome * 0.0915),
        employmentInsurance: Math.floor(taxableIncome * 0.003),
        workersComp: 0 // 会社負担
      };

      expect(payrollResult.socialInsurance).toMatchObject(socialInsurance);

      // 所得税の計算（累進課税）
      const calculateIncomeTax = (income: number): number => {
        if (income <= 195000) return income * 0.05;
        if (income <= 330000) return 9750 + (income - 195000) * 0.1;
        if (income <= 695000) return 23250 + (income - 330000) * 0.2;
        return 90000 + (income - 695000) * 0.23;
      };

      const expectedTax = calculateIncomeTax(taxableIncome);
      expect(payrollResult.incomeTax).toBeCloseTo(expectedTax, -3);
    });

    it('賞与計算と年末調整を実行する', async () => {
      const employee = realEmployees[4];
      const annualData = {
        monthlyPayrolls: [],
        summerBonus: 0,
        winterBonus: 0,
        totalIncome: 0,
        totalTaxPaid: 0
      };

      // 1年分の給与データ
      for (let month = 1; month <= 12; month++) {
        const monthStr = `2025-${String(month).padStart(2, '0')}`;
        const payroll = await payrollEngine.calculatePayroll(employee.id, monthStr);
        annualData.monthlyPayrolls.push(payroll);
        annualData.totalIncome += payroll.grossPay;
        annualData.totalTaxPaid += payroll.deductions.incomeTax;
      }

      // 夏季賞与（6月）
      annualData.summerBonus = employee.hourlyWage * 160 * 2.5; // 2.5ヶ月分
      annualData.totalIncome += annualData.summerBonus;

      // 冬季賞与（12月）
      annualData.winterBonus = employee.hourlyWage * 160 * 3.0; // 3.0ヶ月分
      annualData.totalIncome += annualData.winterBonus;

      // 年末調整
      const yearEndAdjustment = await payrollEngine.calculateYearEndAdjustment({
        employeeId: employee.id,
        year: 2025,
        totalIncome: annualData.totalIncome,
        totalTaxPaid: annualData.totalTaxPaid,
        deductions: {
          basic: 480000,                    // 基礎控除
          spouse: 380000,                   // 配偶者控除
          dependents: 380000 * 2,           // 扶養控除（2人）
          socialInsurance: annualData.totalIncome * 0.142, // 社会保険料控除
          lifeInsurance: 40000,             // 生命保険料控除
          earthquakeInsurance: 50000        // 地震保険料控除
        }
      });

      expect(yearEndAdjustment.refundAmount).toBeGreaterThan(0); // 還付金があるはず
      expect(yearEndAdjustment.finalTaxAmount).toBeLessThan(annualData.totalTaxPaid);
    });

    it('退職金計算と源泉徴収票発行を行う', async () => {
      const retiringEmployee = {
        ...realEmployees[5],
        retirementDate: '2025-07-31',
        yearsOfService: 15.3,
        retirementReason: 'voluntary'
      };

      // 退職金の計算
      const retirementPay = await payrollEngine.calculateRetirementPay({
        employeeId: retiringEmployee.id,
        yearsOfService: retiringEmployee.yearsOfService,
        averageMonthlyPay: 450000,
        reason: retiringEmployee.retirementReason
      });

      // 退職所得控除の計算
      const retirementDeduction = (() => {
        if (retiringEmployee.yearsOfService <= 20) {
          return 400000 * retiringEmployee.yearsOfService;
        } else {
          return 8000000 + 700000 * (retiringEmployee.yearsOfService - 20);
        }
      })();

      expect(retirementPay.deduction).toBe(Math.floor(retirementDeduction));

      // 退職所得の計算
      const taxableRetirement = (retirementPay.grossAmount - retirementPay.deduction) / 2;
      expect(retirementPay.taxableAmount).toBe(Math.floor(taxableRetirement));

      // 源泉徴収票の生成
      const taxCertificate = await payrollEngine.generateTaxCertificate({
        employeeId: retiringEmployee.id,
        year: 2025,
        includeRetirement: true
      });

      expect(taxCertificate).toContain('退職所得の源泉徴収票');
      expect(taxCertificate).toContain(retiringEmployee.name);
      expect(taxCertificate).toContain('支払金額');
    });
  });

  describe('4. AIを活用した経費処理の全シナリオ', () => {
    it('複雑な出張精算を自動処理する', async () => {
      const businessTrip = {
        employeeId: realEmployees[6].id,
        tripId: 'trip_2025_07_001',
        destination: '大阪',
        period: {
          start: new Date('2025-07-10'),
          end: new Date('2025-07-12')
        },
        expenses: [
          {
            type: '新幹線',
            amount: 28900,
            receipt: 'shinkansen_receipt.pdf',
            date: '2025-07-10'
          },
          {
            type: '宿泊費',
            amount: 12000,
            receipt: 'hotel_receipt.pdf',
            date: '2025-07-10',
            nights: 2
          },
          {
            type: 'タクシー',
            amount: 3200,
            receipt: 'taxi_receipt_1.jpg',
            date: '2025-07-11'
          },
          {
            type: '会議費',
            amount: 8500,
            receipt: 'dinner_receipt.jpg',
            date: '2025-07-11',
            attendees: 4
          }
        ]
      };

      // 各経費の自動処理
      const processedExpenses = await Promise.all(
        businessTrip.expenses.map(async (expense) => {
          // OCR処理
          const ocrResult = await expenseEngine.processReceipt(expense.receipt);
          
          // 経費規定との照合
          const complianceCheck = await expenseEngine.checkExpenseCompliance({
            type: expense.type,
            amount: expense.amount,
            employeePosition: realEmployees[6].position
          });

          // リスク評価
          const riskAssessment = await expenseEngine.evaluateExpenseRisk({
            ...expense,
            employeeId: businessTrip.employeeId,
            ocrConfidence: ocrResult.confidence
          });

          return {
            ...expense,
            ocrResult,
            complianceCheck,
            riskAssessment,
            autoApproved: riskAssessment.score < 0.3 && complianceCheck.compliant
          };
        })
      );

      // 出張全体の検証
      const totalAmount = processedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      expect(totalAmount).toBe(52600);

      // 自動承認された経費
      const autoApproved = processedExpenses.filter(exp => exp.autoApproved);
      expect(autoApproved.length).toBeGreaterThan(0);

      // 会議費の妥当性チェック（1人あたり）
      const dinnerExpense = processedExpenses.find(exp => exp.type === '会議費');
      expect(dinnerExpense.amount / dinnerExpense.attendees).toBeLessThanOrEqual(3000);
    });

    it('不正な経費パターンを検出する', async () => {
      const suspiciousPatterns = [
        {
          pattern: '週末の連続タクシー利用',
          expenses: generateWeekendTaxiExpenses(realEmployees[7].id)
        },
        {
          pattern: '同一店舗での高頻度利用',
          expenses: generateFrequentSameVendorExpenses(realEmployees[8].id)
        },
        {
          pattern: '分割請求の疑い',
          expenses: generateSplitBillingExpenses(realEmployees[9].id)
        },
        {
          pattern: '個人利用の混入',
          expenses: generatePersonalExpenses(realEmployees[10].id)
        }
      ];

      for (const suspicious of suspiciousPatterns) {
        const detectionResult = await anomalyEngine.detectExpenseAnomalies({
          expenses: suspicious.expenses,
          detectionRules: [
            'weekend_pattern',
            'frequency_anomaly',
            'split_billing',
            'personal_use'
          ]
        });

        expect(detectionResult.anomalies.length).toBeGreaterThan(0);
        expect(detectionResult.anomalies[0].pattern).toBe(suspicious.pattern);
        expect(detectionResult.riskScore).toBeGreaterThan(0.7);

        // 自動的なアクション
        if (detectionResult.riskScore > 0.8) {
          const action = await expenseEngine.takeAutomatedAction({
            type: 'flag_for_review',
            expenses: suspicious.expenses,
            reason: detectionResult.anomalies[0].description
          });

          expect(action.status).toBe('flagged');
          expect(action.notificationSent).toBe(true);
        }
      }
    });

    it('経費の自動仕訳と会計連携を実行する', async () => {
      const approvedExpenses = realExpenses.filter(exp => exp.status === 'approved');
      
      // 勘定科目の自動判定
      const journalEntries = await Promise.all(
        approvedExpenses.map(async (expense) => {
          const accountCode = await expenseEngine.determineAccountCode({
            category: expense.categoryId,
            description: expense.description,
            amount: expense.amount
          });

          return {
            date: expense.expenseDate,
            debit: {
              account: accountCode,
              amount: expense.amount,
              department: realEmployees.find(e => e.id === expense.employeeId)?.department
            },
            credit: {
              account: '1110', // 現金
              amount: expense.amount
            },
            description: `${expense.categoryId}: ${expense.description}`,
            referenceId: expense.id
          };
        })
      );

      // 会計システムへの連携
      const integrationResult = await integrationManager.syncToAccounting({
        system: 'freee',
        entries: journalEntries,
        period: '2025-07'
      });

      expect(integrationResult.success).toBe(true);
      expect(integrationResult.syncedCount).toBe(journalEntries.length);
      expect(integrationResult.errors).toHaveLength(0);

      // 部門別集計
      const departmentSummary = journalEntries.reduce((summary, entry) => {
        const dept = entry.debit.department || 'その他';
        summary[dept] = (summary[dept] || 0) + entry.debit.amount;
        return summary;
      }, {} as Record<string, number>);

      expect(Object.keys(departmentSummary).length).toBeGreaterThan(3);
    });
  });

  describe('5. 人的資本の包括的な分析', () => {
    it('組織全体のダイバーシティを多角的に分析する', async () => {
      const diversityAnalysis = await humanCapitalEngine.analyzeDiversity({
        dimensions: [
          'gender',
          'age',
          'nationality',
          'disability',
          'employment_type',
          'career_level'
        ],
        includeIntersectionality: true
      });

      // 基本的な多様性指標
      expect(diversityAnalysis.genderBalance).toBeDefined();
      expect(diversityAnalysis.genderBalance.female).toBeGreaterThan(0.3);
      expect(diversityAnalysis.genderBalance.female).toBeLessThan(0.7);

      // 管理職の多様性
      const managerDiversity = await humanCapitalEngine.analyzeLeadershipDiversity();
      expect(managerDiversity.femaleManagerRatio).toBeGreaterThan(0.2);
      expect(managerDiversity.diversityIndex).toBeGreaterThan(0.5);

      // インターセクショナリティ分析
      expect(diversityAnalysis.intersectionalGroups).toBeDefined();
      const underrepresented = diversityAnalysis.intersectionalGroups.filter(
        group => group.representation < group.expectedRepresentation * 0.8
      );
      
      // アクションプランの生成
      if (underrepresented.length > 0) {
        const actionPlan = await humanCapitalEngine.generateDiversityActionPlan({
          targetGroups: underrepresented,
          timeframe: 12, // months
          budget: 10000000 // JPY
        });

        expect(actionPlan.initiatives.length).toBeGreaterThan(0);
        expect(actionPlan.expectedImpact).toBeDefined();
      }
    });

    it('スキルギャップと将来需要を予測する', async () => {
      // 現在のスキル分布
      const currentSkills = await skillEngine.analyzeOrganizationSkills();
      
      // 3年後の必要スキル予測
      const futureSkillDemand = await predictiveEngine.predictSkillDemand({
        horizon: 36, // months
        industryTrends: await fetchIndustryTrends(),
        businessStrategy: await fetchBusinessStrategy()
      });

      // ギャップ分析
      const skillGaps = await skillEngine.calculateSkillGaps(
        currentSkills,
        futureSkillDemand
      );

      expect(skillGaps.critical.length).toBeGreaterThan(0);
      expect(skillGaps.critical).toContainEqual(
        expect.objectContaining({
          skill: expect.any(String),
          currentSupply: expect.any(Number),
          futureeDemand: expect.any(Number),
          gap: expect.any(Number),
          criticalityScore: expect.any(Number)
        })
      );

      // 対策の立案
      const mitigationStrategy = await skillEngine.developMitigationStrategy({
        gaps: skillGaps,
        constraints: {
          budget: 50000000,
          timeframe: 36,
          hiringCap: 20
        }
      });

      expect(mitigationStrategy.actions).toContainEqual(
        expect.objectContaining({
          type: expect.stringMatching(/training|hiring|partnership/),
          targetSkill: expect.any(String),
          investment: expect.any(Number),
          expectedROI: expect.any(Number)
        })
      );
    });

    it('エンゲージメントの詳細分析と改善策を生成する', async () => {
      // パルスサーベイの実施
      const pulseResults = await humanCapitalEngine.conductPulseSurvey({
        participants: realEmployees,
        questions: [
          'overall_satisfaction',
          'manager_relationship',
          'career_development',
          'work_life_balance',
          'compensation_fairness',
          'company_direction'
        ]
      });

      // セグメント別分析
      const segmentAnalysis = await humanCapitalEngine.analyzeEngagementBySegment({
        results: pulseResults,
        segments: ['department', 'tenure', 'generation', 'performance_level']
      });

      // 低エンゲージメントセグメントの特定
      const lowEngagementSegments = segmentAnalysis.filter(
        segment => segment.averageScore < 3.5
      );

      expect(lowEngagementSegments.length).toBeGreaterThan(0);

      // ドライバー分析
      const engagementDrivers = await predictiveEngine.analyzeEngagementDrivers({
        surveyData: pulseResults,
        employeeData: realEmployees,
        historicalData: await fetchHistoricalEngagementData()
      });

      expect(engagementDrivers.topDrivers).toContainEqual(
        expect.objectContaining({
          factor: expect.any(String),
          impact: expect.any(Number),
          currentState: expect.any(String)
        })
      );

      // 改善アクションの推奨
      const improvementPlan = await humanCapitalEngine.generateEngagementImprovementPlan({
        targetSegments: lowEngagementSegments,
        drivers: engagementDrivers,
        budget: 20000000
      });

      expect(improvementPlan.initiatives.length).toBeGreaterThan(3);
      expect(improvementPlan.expectedImprovementRate).toBeGreaterThan(0.1);
    });
  });

  describe('6. 予測分析とWhat-ifシミュレーション', () => {
    it('複数シナリオでの人件費予測を実行する', async () => {
      const scenarios = [
        {
          name: 'ベースシナリオ',
          assumptions: {
            headcountGrowth: 0.05,
            salaryIncrease: 0.03,
            turnoverRate: 0.12,
            overtimeReduction: 0
          }
        },
        {
          name: '成長シナリオ',
          assumptions: {
            headcountGrowth: 0.15,
            salaryIncrease: 0.05,
            turnoverRate: 0.15,
            overtimeReduction: -0.1
          }
        },
        {
          name: '効率化シナリオ',
          assumptions: {
            headcountGrowth: -0.05,
            salaryIncrease: 0.02,
            turnoverRate: 0.08,
            overtimeReduction: 0.3
          }
        }
      ];

      const projections = await Promise.all(
        scenarios.map(async (scenario) => {
          const projection = await predictiveEngine.projectLaborCosts({
            baseYear: 2025,
            projectionYears: 3,
            currentEmployees: realEmployees,
            assumptions: scenario.assumptions
          });

          return {
            scenario: scenario.name,
            projection
          };
        })
      );

      // 各シナリオの検証
      const baseScenario = projections.find(p => p.scenario === 'ベースシナリオ');
      const growthScenario = projections.find(p => p.scenario === '成長シナリオ');
      const efficiencyScenario = projections.find(p => p.scenario === '効率化シナリオ');

      // 3年目の人件費比較
      expect(growthScenario.projection.year3.totalCost)
        .toBeGreaterThan(baseScenario.projection.year3.totalCost);
      expect(efficiencyScenario.projection.year3.totalCost)
        .toBeLessThan(baseScenario.projection.year3.totalCost);

      // 1人あたり人件費の変化
      expect(efficiencyScenario.projection.year3.costPerEmployee)
        .toBeGreaterThan(baseScenario.projection.year3.costPerEmployee);
    });

    it('離職予測と影響分析を実行する', async () => {
      // 全従業員の離職リスク評価
      const turnoverRisks = await Promise.all(
        realEmployees.map(async (employee) => {
          const risk = await predictiveEngine.assessTurnoverRisk(employee.id);
          return {
            employee,
            risk
          };
        })
      );

      // 高リスク従業員の特定
      const highRiskEmployees = turnoverRisks.filter(
        r => r.risk.probability > 0.7
      );

      expect(highRiskEmployees.length).toBeGreaterThan(0);

      // 離職影響分析
      for (const highRisk of highRiskEmployees.slice(0, 5)) {
        const impactAnalysis = await predictiveEngine.analyzeTurnoverImpact({
          employeeId: highRisk.employee.id,
          includeKnowledgeLoss: true,
          includeTeamDisruption: true,
          includeReplacementCost: true
        });

        expect(impactAnalysis.totalCost).toBeGreaterThan(
          highRisk.employee.hourlyWage * 160 * 6 // 6ヶ月分の給与以上
        );

        expect(impactAnalysis.knowledgeLoss).toMatchObject({
          criticalKnowledge: expect.any(Array),
          documentationLevel: expect.any(Number),
          transferTime: expect.any(Number)
        });

        // 予防策の生成
        if (impactAnalysis.totalCost > 5000000) {
          const retentionPlan = await talentEngine.generateRetentionPlan({
            employeeId: highRisk.employee.id,
            riskFactors: highRisk.risk.factors,
            maxBudget: impactAnalysis.totalCost * 0.3
          });

          expect(retentionPlan.actions.length).toBeGreaterThan(0);
          expect(retentionPlan.expectedRetentionProbability)
            .toBeGreaterThan(highRisk.risk.probability);
        }
      }
    });

    it('組織再編シミュレーションを実行する', async () => {
      const reorganizationScenarios = [
        {
          type: '事業部統合',
          affectedDepartments: ['営業1部', '営業2部'],
          newStructure: {
            name: '統合営業部',
            targetHeadcount: 50,
            costSavingTarget: 0.15
          }
        },
        {
          type: 'アウトソーシング',
          affectedDepartments: ['総務部'],
          outsourcingRatio: 0.7,
          retainedFunctions: ['戦略企画', '経営支援']
        },
        {
          type: '新規事業部設立',
          sourceDepartments: ['開発部', 'マーケティング部'],
          newDepartment: {
            name: 'デジタルイノベーション部',
            targetHeadcount: 30,
            skillRequirements: ['AI/ML', 'データ分析', 'UX設計']
          }
        }
      ];

      for (const scenario of reorganizationScenarios) {
        const simulation = await predictiveEngine.simulateReorganization(scenario);

        expect(simulation).toMatchObject({
          costImpact: {
            immediate: expect.any(Number),
            year1: expect.any(Number),
            year3: expect.any(Number)
          },
          headcountChanges: expect.any(Object),
          skillGapAnalysis: expect.any(Object),
          riskAssessment: {
            employeeMorale: expect.any(Number),
            knowledgeLoss: expect.any(Number),
            executionRisk: expect.any(Number)
          },
          timeline: expect.any(Array),
          successProbability: expect.any(Number)
        });

        // リスクが高い場合の緩和策
        if (simulation.riskAssessment.executionRisk > 0.6) {
          const mitigationPlan = await predictiveEngine.generateRiskMitigation({
            scenario,
            risks: simulation.riskAssessment
          });

          expect(mitigationPlan.strategies.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('7. エージェントによる自律的処理', () => {
    it('月次締め処理を完全自動化する', async () => {
      const monthEndDate = new Date('2025-07-31');
      
      // エージェントによる月次締めタスクの実行
      const monthEndResults = await agentOrchestrator.executeMonthEnd({
        targetMonth: '2025-07',
        tasks: [
          'attendance_finalization',
          'overtime_calculation',
          'leave_balance_update',
          'payroll_calculation',
          'expense_closing',
          'compliance_check',
          'report_generation'
        ]
      });

      // 各タスクの完了確認
      expect(monthEndResults.completedTasks).toHaveLength(7);
      expect(monthEndResults.failedTasks).toHaveLength(0);

      // 勤怠締め
      expect(monthEndResults.results.attendance_finalization).toMatchObject({
        processedEmployees: realEmployees.length,
        corrections: expect.any(Number),
        approvalsPending: 0
      });

      // 給与計算
      expect(monthEndResults.results.payroll_calculation).toMatchObject({
        calculatedPayrolls: realEmployees.length,
        totalGrossPay: expect.any(Number),
        totalDeductions: expect.any(Number),
        errors: []
      });

      // コンプライアンスチェック
      expect(monthEndResults.results.compliance_check).toMatchObject({
        violations: expect.any(Array),
        warnings: expect.any(Array),
        cleared: expect.any(Number)
      });

      // 自動生成されたレポート
      expect(monthEndResults.results.report_generation).toMatchObject({
        generatedReports: expect.arrayContaining([
          '月次勤怠サマリー',
          '給与支払明細',
          '36協定遵守状況',
          '経費分析レポート'
        ])
      });
    });

    it('異常検知から自動対応まで実行する', async () => {
      // 異常パターンの注入
      const anomalies = [
        {
          type: '急激な残業増加',
          employeeId: realEmployees[11].id,
          data: { overtimeHours: 100, previousAverage: 20 }
        },
        {
          type: '不審な経費パターン',
          employeeId: realEmployees[12].id,
          data: { weekendExpenses: 5, totalAmount: 150000 }
        },
        {
          type: '勤怠不整合',
          employeeId: realEmployees[13].id,
          data: { 
            icCardTime: '09:00',
            manualEntry: '08:00',
            discrepancy: 60
          }
        }
      ];

      for (const anomaly of anomalies) {
        // エージェントによる検知
        const detection = await agentOrchestrator.detectAnomaly(anomaly);
        
        expect(detection.detected).toBe(true);
        expect(detection.severity).toMatch(/low|medium|high|critical/);

        // 自動対応の実行
        const response = await agentOrchestrator.respondToAnomaly({
          anomaly: detection,
          autoResponse: true
        });

        expect(response.actions).toContainEqual(
          expect.objectContaining({
            type: expect.any(String),
            status: 'completed',
            result: expect.any(Object)
          })
        );

        // 特定の異常に対する対応を検証
        if (anomaly.type === '急激な残業増加') {
          expect(response.actions).toContainEqual(
            expect.objectContaining({
              type: 'notify_manager',
              recipient: expect.any(String)
            })
          );
          expect(response.actions).toContainEqual(
            expect.objectContaining({
              type: 'health_check_recommendation'
            })
          );
        }
      }
    });

    it('エージェント間の協調作業を実行する', async () => {
      // 新入社員の入社処理（複数エージェントの協調が必要）
      const newHire = {
        id: 'new_emp_001',
        name: '新入 花子',
        department: '開発部',
        position: 'エンジニア',
        startDate: '2025-08-01',
        salary: 4000000
      };

      const onboardingWorkflow = await agentOrchestrator.coordinateOnboarding(newHire);

      // HRエージェントのタスク
      expect(onboardingWorkflow.hrAgent).toMatchObject({
        employeeRegistration: 'completed',
        contractGeneration: 'completed',
        benefitsEnrollment: 'completed'
      });

      // ITエージェントのタスク
      expect(onboardingWorkflow.itAgent).toMatchObject({
        accountCreation: 'completed',
        equipmentAssignment: 'completed',
        accessProvisioning: 'completed'
      });

      // ファシリティエージェントのタスク  
      expect(onboardingWorkflow.facilityAgent).toMatchObject({
        deskAssignment: 'completed',
        badgeCreation: 'completed',
        parkingAllocation: 'completed'
      });

      // 学習エージェントのタスク
      expect(onboardingWorkflow.learningAgent).toMatchObject({
        trainingPlanCreation: 'completed',
        mentorAssignment: 'completed',
        onboardingSchedule: 'completed'
      });

      // 全体の完了確認
      expect(onboardingWorkflow.overallStatus).toBe('completed');
      expect(onboardingWorkflow.readyForFirstDay).toBe(true);
    });
  });

  describe('8. エンタープライズ統合とエコシステム', () => {
    it('複数の外部システムと双方向同期を行う', async () => {
      const integrationTargets = [
        {
          system: 'freee',
          type: 'accounting',
          syncItems: ['payroll', 'expenses', 'payments']
        },
        {
          system: 'Slack',
          type: 'communication',
          syncItems: ['notifications', 'approvals', 'alerts']
        },
        {
          system: 'Jira',
          type: 'project',
          syncItems: ['timeTracking', 'resource allocation']
        },
        {
          system: 'Salesforce',
          type: 'crm',
          syncItems: ['employee_data', 'performance_metrics']
        }
      ];

      const syncResults = await Promise.all(
        integrationTargets.map(async (target) => {
          const result = await integrationManager.performBidirectionalSync({
            system: target.system,
            items: target.syncItems,
            mode: 'full',
            conflictResolution: 'latest_wins'
          });

          return {
            system: target.system,
            result
          };
        })
      );

      // 各システムの同期成功を確認
      for (const sync of syncResults) {
        expect(sync.result.success).toBe(true);
        expect(sync.result.errors).toHaveLength(0);
        expect(sync.result.syncedRecords).toBeGreaterThan(0);

        // 双方向同期の確認
        expect(sync.result.uploaded).toBeGreaterThan(0);
        expect(sync.result.downloaded).toBeGreaterThan(0);
      }

      // データ整合性チェック
      const integrityCheck = await integrationManager.verifyDataIntegrity({
        systems: integrationTargets.map(t => t.system),
        sampleSize: 100
      });

      expect(integrityCheck.discrepancies).toHaveLength(0);
    });

    it('Webhook経由でリアルタイムイベント処理を行う', async () => {
      const webhookEvents = [
        {
          source: 'attendance_system',
          event: 'clock_in',
          data: {
            employeeId: realEmployees[14].id,
            timestamp: new Date(),
            location: 'main_office'
          }
        },
        {
          source: 'expense_app',
          event: 'expense_submitted',
          data: {
            employeeId: realEmployees[15].id,
            amount: 5000,
            category: '交通費',
            needsApproval: true
          }
        },
        {
          source: 'calendar_system',
          event: 'leave_requested',
          data: {
            employeeId: realEmployees[16].id,
            startDate: '2025-08-10',
            endDate: '2025-08-12',
            type: '有給休暇'
          }
        }
      ];

      for (const event of webhookEvents) {
        const processingResult = await integrationManager.processWebhook({
          source: event.source,
          event: event.event,
          data: event.data,
          signature: generateWebhookSignature(event)
        });

        expect(processingResult.processed).toBe(true);
        expect(processingResult.actions).toHaveLength(1);

        // イベント固有の処理確認
        if (event.event === 'expense_submitted' && event.data.needsApproval) {
          expect(processingResult.actions).toContainEqual(
            expect.objectContaining({
              type: 'create_approval_workflow',
              status: 'initiated'
            })
          );
        }

        if (event.event === 'leave_requested') {
          expect(processingResult.actions).toContainEqual(
            expect.objectContaining({
              type: 'check_leave_balance',
              status: 'completed'
            })
          );
        }
      }
    });
  });

  describe('9. セキュリティとコンプライアンスの包括的テスト', () => {
    it('個人情報の暗号化とアクセス制御を検証する', async () => {
      const sensitiveOperations = [
        {
          operation: 'view_salary',
          requester: 'hr_manager',
          targetEmployee: realEmployees[17].id,
          expectedResult: 'allowed'
        },
        {
          operation: 'view_salary',
          requester: 'regular_employee',
          targetEmployee: realEmployees[18].id,
          expectedResult: 'denied'
        },
        {
          operation: 'export_all_data',
          requester: 'system_admin',
          scope: 'company',
          expectedResult: 'allowed_with_audit'
        }
      ];

      for (const op of sensitiveOperations) {
        const accessResult = await securityValidator.checkAccess({
          user: op.requester,
          operation: op.operation,
          resource: op.targetEmployee || op.scope,
          context: {
            ip: '192.168.1.100',
            time: new Date(),
            device: 'corporate_laptop'
          }
        });

        if (op.expectedResult === 'allowed') {
          expect(accessResult.granted).toBe(true);
        } else if (op.expectedResult === 'denied') {
          expect(accessResult.granted).toBe(false);
          expect(accessResult.reason).toBeDefined();
        } else if (op.expectedResult === 'allowed_with_audit') {
          expect(accessResult.granted).toBe(true);
          expect(accessResult.auditLog).toBeDefined();
          expect(accessResult.auditLog.severity).toBe('high');
        }
      }

      // 暗号化の確認
      const encryptedData = await securityValidator.encryptSensitiveData({
        ssn: '123-45-6789',
        bankAccount: '1234567890',
        salary: 5000000
      });

      expect(encryptedData.ssn).not.toBe('123-45-6789');
      expect(encryptedData.bankAccount).not.toBe('1234567890');
      expect(encryptedData.salary).not.toBe(5000000);

      // 復号化の権限チェック
      const decryptAttempt = await securityValidator.decryptSensitiveData(
        encryptedData,
        'unauthorized_user'
      );
      expect(decryptAttempt.success).toBe(false);
    });

    it('監査ログの完全性と改ざん防止を確認する', async () => {
      // 重要な操作の実行
      const criticalOperations = [
        () => payrollEngine.modifySalary(realEmployees[19].id, 6000000),
        () => complianceEngine.overrideCompliance(realEmployees[20].id, '36agreement'),
        () => expenseEngine.approveHighValueExpense({ id: 'exp_001', amount: 1000000 }),
        () => humanCapitalEngine.deleteEmployeeData(realEmployees[21].id)
      ];

      const auditLogs = [];
      for (const operation of criticalOperations) {
        try {
          await operation();
        } catch (e) {
          // Some operations might fail due to permissions
        }
        
        const latestLog = await securityValidator.getLatestAuditLog();
        auditLogs.push(latestLog);
      }

      // 監査ログの完全性チェック
      for (const log of auditLogs) {
        expect(log).toMatchObject({
          id: expect.any(String),
          timestamp: expect.any(Date),
          user: expect.any(String),
          operation: expect.any(String),
          resource: expect.any(String),
          result: expect.any(String),
          hash: expect.any(String),
          previousHash: expect.any(String)
        });

        // ハッシュチェーンの検証
        const isValid = await securityValidator.verifyLogIntegrity(log);
        expect(isValid).toBe(true);
      }

      // 改ざん試行のテスト
      const tamperedLog = { ...auditLogs[0], result: 'success' };
      const tamperedValid = await securityValidator.verifyLogIntegrity(tamperedLog);
      expect(tamperedValid).toBe(false);
    });
  });

  describe('10. パフォーマンスと負荷テスト', () => {
    it('10万人規模の給与計算を実行する', async () => {
      const largeScaleEmployees = generateRealisticEmployeeData(100000);
      
      const startTime = performance.now();
      
      // バッチ処理による並列実行
      const batchSize = 1000;
      const batches = [];
      
      for (let i = 0; i < largeScaleEmployees.length; i += batchSize) {
        const batch = largeScaleEmployees.slice(i, i + batchSize);
        batches.push(batch);
      }

      const results = await performanceOptimizer.parallelBatchProcess(
        batches,
        async (batch) => {
          const batchResults = [];
          for (const emp of batch) {
            const payroll = await payrollEngine.calculatePayroll(emp.id, '2025-07');
            batchResults.push(payroll);
          }
          return batchResults;
        },
        10 // 並列度
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results.flat().length).toBe(100000);
      expect(totalTime).toBeLessThan(300000); // 5分以内
      
      // スループットの計算
      const throughput = 100000 / (totalTime / 1000); // 件/秒
      expect(throughput).toBeGreaterThan(300); // 300件/秒以上
    });

    it('同時接続1000ユーザーのシミュレーションを実行する', async () => {
      const concurrentUsers = 1000;
      const operations = [
        'view_dashboard',
        'submit_expense',
        'approve_leave',
        'generate_report',
        'update_profile'
      ];

      const userSessions = Array(concurrentUsers).fill(null).map((_, i) => ({
        userId: `user_${i}`,
        operations: Array(10).fill(null).map(() => 
          operations[Math.floor(Math.random() * operations.length)]
        )
      }));

      const startTime = performance.now();
      
      // 同時実行のシミュレーション
      const sessionResults = await Promise.all(
        userSessions.map(async (session) => {
          const results = [];
          for (const op of session.operations) {
            const opStart = performance.now();
            
            // 実際の操作をシミュレート
            await simulateUserOperation(op, session.userId);
            
            const opEnd = performance.now();
            results.push({
              operation: op,
              responseTime: opEnd - opStart
            });
          }
          return results;
        })
      );

      const endTime = performance.now();

      // レスポンスタイムの分析
      const allOperations = sessionResults.flat();
      const responseTimes = allOperations.map(op => op.responseTime);
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const percentile95 = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];

      expect(avgResponseTime).toBeLessThan(1000); // 平均1秒以内
      expect(percentile95).toBeLessThan(2000); // 95%が2秒以内
      expect(maxResponseTime).toBeLessThan(5000); // 最大5秒以内
    });
  });
});

// ヘルパー関数

function createRealisticMockDatabase(): any {
  const employees = new Map();
  const timeRecords = new Map();
  const expenses = new Map();
  const objectiveRecords = new Map();

  return {
    // 基本的なCRUD操作
    getEmployee: vi.fn().mockImplementation((id) => 
      Promise.resolve(employees.get(id))
    ),
    
    getAllEmployees: vi.fn().mockImplementation(() => 
      Promise.resolve(Array.from(employees.values()))
    ),
    
    createEmployee: vi.fn().mockImplementation((emp) => {
      employees.set(emp.id, emp);
      return Promise.resolve(emp);
    }),
    
    updateEmployee: vi.fn().mockImplementation((id, updates) => {
      const emp = employees.get(id);
      if (emp) {
        const updated = { ...emp, ...updates };
        employees.set(id, updated);
        return Promise.resolve(updated);
      }
      return Promise.resolve(null);
    }),

    // 勤怠関連
    getTimeRecords: vi.fn().mockImplementation((empId, startDate, endDate) => {
      const records = Array.from(timeRecords.values()).filter(r => 
        r.employeeId === empId &&
        r.date >= startDate &&
        r.date <= endDate
      );
      return Promise.resolve(records);
    }),

    createTimeRecord: vi.fn().mockImplementation((record) => {
      timeRecords.set(record.id, record);
      return Promise.resolve(record);
    }),

    // 経費関連
    getExpenseRequests: vi.fn().mockImplementation((filters) => {
      let results = Array.from(expenses.values());
      
      if (filters?.employeeId) {
        results = results.filter(e => e.employeeId === filters.employeeId);
      }
      if (filters?.status) {
        results = results.filter(e => e.status === filters.status);
      }
      if (filters?.startDate && filters?.endDate) {
        results = results.filter(e => 
          e.expenseDate >= filters.startDate &&
          e.expenseDate <= filters.endDate
        );
      }
      
      return Promise.resolve(results);
    }),

    createExpenseRequest: vi.fn().mockImplementation((expense) => {
      expenses.set(expense.id, expense);
      return Promise.resolve(expense);
    }),

    // 客観的記録
    getObjectiveTimeRecords: vi.fn().mockImplementation((empId, date) => {
      const records = Array.from(objectiveRecords.values()).filter(r =>
        r.employeeId === empId &&
        r.timestamp.toDateString() === date.toDateString()
      );
      return Promise.resolve(records);
    }),

    // クエリ実行
    query: vi.fn().mockImplementation((sql, params) => {
      // 36協定データ
      if (sql.includes('labor_agreements')) {
        return Promise.resolve({
          rows: [{
            id: 'agreement_001',
            monthly_overtime_limit: 45,
            yearly_overtime_limit: 360,
            special_monthly_limit: 100,
            special_yearly_limit: 720,
            special_monthly_count_limit: 6
          }]
        });
      }
      
      // 残業時間集計
      if (sql.includes('SUM(overtime_hours)')) {
        const mockHours = Math.floor(Math.random() * 50) + 10;
        return Promise.resolve({ rows: [{ total: mockHours }] });
      }
      
      // 人的資本指標
      if (sql.includes('COUNT(*)') && sql.includes('employees')) {
        return Promise.resolve({ rows: [{ count: employees.size }] });
      }
      
      return Promise.resolve({ rows: [] });
    }),

    // トランザクション
    beginTransaction: vi.fn().mockResolvedValue(true),
    commitTransaction: vi.fn().mockResolvedValue(true),
    rollbackTransaction: vi.fn().mockResolvedValue(true),

    // バッチ操作
    bulkInsertTimeRecords: vi.fn().mockImplementation((records) => {
      records.forEach(r => timeRecords.set(r.id, r));
      return Promise.resolve(true);
    })
  };
}

function generateRealisticEmployeeData(count: number = 500): Employee[] {
  const departments = [
    { name: '営業1部', ratio: 0.15 },
    { name: '営業2部', ratio: 0.10 },
    { name: '開発部', ratio: 0.25 },
    { name: '人事部', ratio: 0.08 },
    { name: '経理部', ratio: 0.08 },
    { name: '総務部', ratio: 0.06 },
    { name: 'マーケティング部', ratio: 0.10 },
    { name: '製造部', ratio: 0.10 },
    { name: '品質管理部', ratio: 0.08 }
  ];

  const positions = [
    { name: 'スタッフ', level: 1, ratio: 0.40 },
    { name: 'シニアスタッフ', level: 2, ratio: 0.25 },
    { name: 'リーダー', level: 3, ratio: 0.15 },
    { name: 'マネージャー', level: 4, ratio: 0.12 },
    { name: '部長', level: 5, ratio: 0.06 },
    { name: '執行役員', level: 6, ratio: 0.02 }
  ];

  const employees: Employee[] = [];
  let departmentIndex = 0;
  let positionIndex = 0;

  for (let i = 0; i < count; i++) {
    // 部門と職位の分布を現実的に
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const pos = positions[Math.min(
      Math.floor(Math.random() * positions.length * 1.5),
      positions.length - 1
    )];

    const age = 22 + Math.floor(Math.random() * 43); // 22-65歳
    const tenure = Math.min(age - 22, Math.floor(Math.random() * 20)); // 勤続年数

    employees.push({
      id: `emp${String(i + 1).padStart(5, '0')}`,
      name: generateJapaneseName(i),
      email: `employee${i + 1}@company.co.jp`,
      department: dept.name,
      position: pos.name,
      hourlyWage: 1500 + pos.level * 1000 + tenure * 100,
      startDate: new Date(
        Date.now() - tenure * 365 * 24 * 60 * 60 * 1000
      ).toISOString(),
      isActive: Math.random() > 0.02, // 98%がアクティブ
      
      // 拡張属性
      gender: Math.random() > 0.6 ? 'male' : 'female',
      age,
      nationality: Math.random() > 0.95 ? 'foreign' : 'japanese',
      employmentType: Math.random() > 0.85 ? 'contract' : 'regular',
      managerId: i > 20 ? `emp${String(Math.floor(i / 10)).padStart(5, '0')}` : undefined,
      
      // スキルと評価
      skills: generateRealisticSkills(pos.level),
      performanceRating: 2.5 + Math.random() * 2.5,
      potentialRating: 2.5 + Math.random() * 2.5,
      
      // 勤務形態
      workSystem: Math.random() > 0.9 ? 'flex' : 'regular',
      
      // 36協定タイプ
      agreementType: Math.random() > 0.7 ? 'special_clause' : 'standard'
    });
  }

  return employees;
}

function generateJapaneseName(index: number): string {
  const lastNames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
  const firstNamesMale = ['太郎', '次郎', '三郎', '健', '誠', '隆', '浩', '勇', '剛', '明'];
  const firstNamesFemale = ['花子', '美香', '愛', '恵', '由美', '直美', '陽子', '智子', '和子', '幸子'];
  
  const lastName = lastNames[index % lastNames.length];
  const isMale = Math.random() > 0.4;
  const firstName = isMale 
    ? firstNamesMale[index % firstNamesMale.length]
    : firstNamesFemale[index % firstNamesFemale.length];
    
  return `${lastName} ${firstName}`;
}

function generateRealisticSkills(level: number): string[] {
  const technicalSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'React', 'Vue.js',
    'Node.js', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'SQL', 'NoSQL'
  ];
  
  const businessSkills = [
    'プロジェクト管理', 'プレゼンテーション', '交渉', '分析力',
    'リーダーシップ', 'コミュニケーション', '問題解決', '戦略立案'
  ];
  
  const skillCount = Math.min(3 + level, 8);
  const skills = new Set<string>();
  
  // レベルに応じてスキルを選択
  const techRatio = level <= 3 ? 0.7 : 0.3;
  
  while (skills.size < skillCount) {
    if (Math.random() < techRatio) {
      skills.add(technicalSkills[Math.floor(Math.random() * technicalSkills.length)]);
    } else {
      skills.add(businessSkills[Math.floor(Math.random() * businessSkills.length)]);
    }
  }
  
  return Array.from(skills);
}

function generateRealisticTimeRecords(employees: Employee[]): TimeRecord[] {
  const records: TimeRecord[] = [];
  const currentMonth = new Date('2025-07-01');
  
  employees.forEach(emp => {
    // 月の各日について記録を生成
    for (let day = 1; day <= 31; day++) {
      const date = new Date(currentMonth);
      date.setDate(day);
      
      // 週末はスキップ（一部の人は休日出勤）
      if (date.getDay() === 0 || date.getDay() === 6) {
        if (Math.random() > 0.95) { // 5%の確率で休日出勤
          const record = generateHolidayWorkRecord(emp.id, date);
          records.push(record);
        }
        continue;
      }
      
      // 有給休暇（月に1-2日程度）
      if (Math.random() > 0.95) {
        continue;
      }
      
      // 通常の勤務記録
      const record = generateNormalWorkRecord(emp, date);
      records.push(record);
    }
  });
  
  return records;
}

function generateNormalWorkRecord(employee: Employee, date: Date): TimeRecord {
  const baseStartHour = 9;
  const variation = (Math.random() - 0.5) * 2; // -1 ~ +1時間
  
  const clockIn = new Date(date);
  clockIn.setHours(
    baseStartHour + Math.floor(variation),
    Math.floor(Math.random() * 60),
    0,
    0
  );
  
  // 勤務時間（基本8時間 + 残業）
  const workHours = 8 + (Math.random() > 0.7 ? Math.random() * 4 : 0);
  const clockOut = new Date(clockIn);
  clockOut.setHours(clockIn.getHours() + Math.floor(workHours));
  clockOut.setMinutes(clockIn.getMinutes() + Math.floor((workHours % 1) * 60));
  
  return {
    id: `tr_${employee.id}_${date.toISOString().split('T')[0]}`,
    employeeId: employee.id,
    date,
    clockIn,
    clockOut,
    breakMinutes: workHours > 6 ? 60 : 45,
    recordType: Math.random() > 0.05 ? 'ic_card' : 'manual'
  };
}

function generateHolidayWorkRecord(employeeId: string, date: Date): TimeRecord {
  const clockIn = new Date(date);
  clockIn.setHours(10, 0, 0, 0);
  
  const clockOut = new Date(date);
  clockOut.setHours(16, 0, 0, 0);
  
  return {
    id: `tr_${employeeId}_${date.toISOString().split('T')[0]}_holiday`,
    employeeId,
    date,
    clockIn,
    clockOut,
    breakMinutes: 60,
    recordType: 'manual',
    isHoliday: true
  };
}

function generateRealisticExpenses(employees: Employee[]): ExpenseRequest[] {
  const expenses: ExpenseRequest[] = [];
  const expenseTypes = [
    { category: '交通費', avgAmount: 2000, frequency: 0.8 },
    { category: '会議費', avgAmount: 5000, frequency: 0.3 },
    { category: '接待交際費', avgAmount: 15000, frequency: 0.1 },
    { category: '消耗品費', avgAmount: 3000, frequency: 0.4 },
    { category: '研修費', avgAmount: 30000, frequency: 0.05 },
    { category: '出張費', avgAmount: 50000, frequency: 0.1 }
  ];
  
  employees.forEach((emp, empIndex) => {
    expenseTypes.forEach(type => {
      if (Math.random() < type.frequency) {
        // 月に数回の経費申請
        const count = Math.ceil(Math.random() * 3);
        
        for (let i = 0; i < count; i++) {
          const amount = type.avgAmount * (0.5 + Math.random());
          const date = new Date('2025-07-01');
          date.setDate(Math.floor(Math.random() * 31) + 1);
          
          expenses.push({
            id: `exp_${empIndex}_${type.category}_${i}`,
            employeeId: emp.id,
            amount: Math.floor(amount),
            categoryId: type.category,
            description: generateExpenseDescription(type.category),
            expenseDate: date,
            status: Math.random() > 0.1 ? 'approved' : 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            currency: 'JPY',
            purpose: '業務遂行のため',
            receiptImageUrl: Math.random() > 0.2 ? `receipt_${Date.now()}.jpg` : undefined,
            
            // リスク評価用
            approvalRisk: calculateExpenseRisk(amount, type.category, emp.position)
          });
        }
      }
    });
  });
  
  return expenses;
}

function generateExpenseDescription(category: string): string {
  const descriptions = {
    '交通費': ['客先訪問', '会議出席', '研修会場への移動', '空港までの移動'],
    '会議費': ['チームランチミーティング', '部門会議', '顧客との打ち合わせ', 'プロジェクトキックオフ'],
    '接待交際費': ['顧客接待', 'パートナー企業との会食', '新規開拓営業', '契約更新協議'],
    '消耗品費': ['事務用品購入', 'プリンター用紙', '名刺作成', 'USBメモリ'],
    '研修費': ['技術研修受講', '資格取得講座', 'オンラインセミナー', 'カンファレンス参加'],
    '出張費': ['大阪支社出張', '工場視察', '海外展示会', '地方営業']
  };
  
  const options = descriptions[category] || ['業務関連支出'];
  return options[Math.floor(Math.random() * options.length)];
}

function calculateExpenseRisk(amount: number, category: string, position: string): number {
  let risk = 0;
  
  // 金額によるリスク
  if (amount > 50000) risk += 0.3;
  else if (amount > 20000) risk += 0.2;
  else if (amount > 10000) risk += 0.1;
  
  // カテゴリによるリスク
  if (category === '接待交際費') risk += 0.2;
  else if (category === '出張費') risk += 0.1;
  
  // 職位による調整
  if (position.includes('部長') || position.includes('執行役員')) risk -= 0.2;
  else if (position.includes('マネージャー')) risk -= 0.1;
  
  return Math.max(0, Math.min(1, risk));
}

function generateRealisticObjectiveRecords(employees: Employee[]): ObjectiveTimeRecord[] {
  const records: ObjectiveTimeRecord[] = [];
  const recordTypes = ['ic_card', 'pc_log', 'access_log'];
  
  employees.forEach(emp => {
    // 各従業員の月間記録を生成
    for (let day = 1; day <= 31; day++) {
      const date = new Date('2025-07-01');
      date.setDate(day);
      
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      // 各種客観的記録を生成
      recordTypes.forEach(type => {
        if (Math.random() > 0.1) { // 90%の確率で記録あり
          const timestamp = new Date(date);
          
          if (type === 'ic_card') {
            // 入退室の正確な時刻
            timestamp.setHours(8 + Math.floor(Math.random() * 2));
            timestamp.setMinutes(Math.floor(Math.random() * 60));
          } else if (type === 'pc_log') {
            // PCログは少し遅れることが多い
            timestamp.setHours(9 + Math.floor(Math.random() * 1));
            timestamp.setMinutes(Math.floor(Math.random() * 30));
          } else {
            // アクセスログは最も早い
            timestamp.setHours(8 + Math.floor(Math.random() * 1));
            timestamp.setMinutes(30 + Math.floor(Math.random() * 30));
          }
          
          records.push({
            id: `obj_${emp.id}_${date.toISOString().split('T')[0]}_${type}`,
            employeeId: emp.id,
            recordType: type as any,
            timestamp,
            eventType: 'clock_in',
            deviceId: `device_${type}_${Math.floor(Math.random() * 10)}`,
            location: 'main_office',
            metadata: JSON.stringify({
              ip: type === 'pc_log' ? '192.168.1.' + Math.floor(Math.random() * 255) : undefined,
              temperature: type === 'access_log' ? 36.5 + Math.random() * 0.5 : undefined
            })
          });
        }
      });
    }
  });
  
  return records;
}

// その他のヘルパー関数

function generateWeekendTaxiExpenses(employeeId: string): ExpenseRequest[] {
  const expenses: ExpenseRequest[] = [];
  
  for (let i = 0; i < 4; i++) {
    const date = new Date('2025-07-01');
    date.setDate(6 + i * 7); // 土曜日
    
    expenses.push({
      id: `suspicious_weekend_${i}`,
      employeeId,
      amount: 3000 + Math.floor(Math.random() * 2000),
      categoryId: '交通費',
      description: 'タクシー代',
      expenseDate: date,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      currency: 'JPY',
      purpose: '休日出勤',
      approvalRisk: 0.8
    });
  }
  
  return expenses;
}

function generateFrequentSameVendorExpenses(employeeId: string): ExpenseRequest[] {
  const expenses: ExpenseRequest[] = [];
  const vendor = 'カフェXYZ';
  
  for (let i = 0; i < 10; i++) {
    const date = new Date('2025-07-01');
    date.setDate(i + 1);
    
    expenses.push({
      id: `frequent_vendor_${i}`,
      employeeId,
      amount: 1500 + Math.floor(Math.random() * 500),
      categoryId: '会議費',
      description: `${vendor}での打ち合わせ`,
      expenseDate: date,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      currency: 'JPY',
      purpose: '顧客打ち合わせ',
      approvalRisk: 0.7
    });
  }
  
  return expenses;
}

function generateSplitBillingExpenses(employeeId: string): ExpenseRequest[] {
  const expenses: ExpenseRequest[] = [];
  const totalAmount = 49800; // Just under 50,000 limit
  const splits = [19900, 19900, 9900];
  
  splits.forEach((amount, i) => {
    const date = new Date('2025-07-15');
    date.setHours(date.getHours() + i);
    
    expenses.push({
      id: `split_billing_${i}`,
      employeeId,
      amount,
      categoryId: '接待交際費',
      description: '顧客接待（分割請求 ' + (i + 1) + '/3）',
      expenseDate: date,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      currency: 'JPY',
      purpose: '重要顧客との会食',
      approvalRisk: 0.9
    });
  });
  
  return expenses;
}

function generatePersonalExpenses(employeeId: string): ExpenseRequest[] {
  return [
    {
      id: 'personal_expense_1',
      employeeId,
      amount: 5000,
      categoryId: '会議費',
      description: 'スターバックス',
      expenseDate: new Date('2025-07-10T19:30:00'), // 夜遅い時間
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      currency: 'JPY',
      purpose: '資料作成',
      metadata: { location: '自宅付近' },
      approvalRisk: 0.8
    }
  ];
}

function generateWebhookSignature(event: any): string {
  // 簡易的な署名生成
  const data = JSON.stringify(event);
  return Buffer.from(data).toString('base64').substring(0, 32);
}

async function simulateUserOperation(operation: string, userId: string): Promise<void> {
  // 操作のシミュレーション（実際の処理時間を模倣）
  const delays = {
    view_dashboard: 100 + Math.random() * 400,
    submit_expense: 200 + Math.random() * 800,
    approve_leave: 150 + Math.random() * 350,
    generate_report: 500 + Math.random() * 1500,
    update_profile: 100 + Math.random() * 300
  };
  
  const delay = delays[operation] || 200;
  await new Promise(resolve => setTimeout(resolve, delay));
}

async function fetchIndustryTrends(): Promise<any> {
  return {
    emergingSkills: ['AI/ML', 'ブロックチェーン', 'IoT', 'サイバーセキュリティ'],
    decliningSkills: ['COBOL', 'Flash', 'Perl'],
    salaryTrends: { average_increase: 0.03, tech_premium: 0.15 }
  };
}

async function fetchBusinessStrategy(): Promise<any> {
  return {
    focusAreas: ['DX推進', 'グローバル展開', 'サステナビリティ'],
    headcountPlan: { growth_rate: 0.1, focus_departments: ['開発部', 'データサイエンス部'] },
    investmentPriorities: ['人材育成', 'システム投資', 'M&A']
  };
}

async function fetchHistoricalEngagementData(): Promise<any> {
  return {
    yearlyScores: [3.8, 3.9, 4.0, 4.1, 3.9],
    turnoverRates: [0.12, 0.11, 0.10, 0.09, 0.11],
    topIssues: ['キャリア開発', 'ワークライフバランス', '評価の公平性']
  };
}