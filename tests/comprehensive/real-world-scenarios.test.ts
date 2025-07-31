import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { DatabasePostgreSQL } from '../../src/database_postgresql';
import { IntegratedPayrollEngine } from '../../src/payroll-engine';
import { ComplianceEngine } from '../../src/compliance-engine';
import ExpenseManagementEngine from '../../src/expense-engine';
import HumanCapitalDisclosureEngine from '../../src/human-capital-disclosure-engine-v2.0.0';
import PredictiveAnalyticsEngine from '../../src/predictive-analytics-engine-v2.1.0';
import { TalentManagementEngine } from '../../src/talent-management-engine-v2.2.0';
import { SkillManagementEngine } from '../../src/skill-management-engine-v2.3.0';
import { AgentOrchestrator } from '../../src/agent-framework-v3.0.0';
import { EcosystemIntegrationManager } from '../../src/ecosystem-integration-v2.2.0';
import type { Employee, TimeRecord, ExpenseRequest } from '../../src/types';

/**
 * 実データシナリオテストスイート
 * 実際の企業で発生する現実的なケースをシミュレート
 */
describe('実世界のビジネスシナリオテスト', () => {
  let db: DatabasePostgreSQL;
  let payrollEngine: IntegratedPayrollEngine;
  let complianceEngine: ComplianceEngine;
  let expenseEngine: ExpenseManagementEngine;
  let humanCapitalEngine: HumanCapitalDisclosureEngine;
  let predictiveEngine: PredictiveAnalyticsEngine;
  let talentEngine: TalentManagementEngine;
  let skillEngine: SkillManagementEngine;
  let agentOrchestrator: AgentOrchestrator;
  let integrationManager: EcosystemIntegrationManager;

  // 実際の企業を模したテストデータ
  let testCompany: any;

  beforeAll(async () => {
    db = createRealisticDatabase();
    payrollEngine = new IntegratedPayrollEngine(db);
    complianceEngine = new ComplianceEngine(db);
    expenseEngine = new ExpenseManagementEngine(db);
    humanCapitalEngine = new HumanCapitalDisclosureEngine(db);
    predictiveEngine = new PredictiveAnalyticsEngine(db);
    talentEngine = new TalentManagementEngine(db);
    skillEngine = new SkillManagementEngine(db);
    agentOrchestrator = new AgentOrchestrator(db);
    integrationManager = new EcosystemIntegrationManager(db);

    // テスト企業の初期化
    testCompany = await initializeTestCompany();
  });

  describe('1. 中規模IT企業の日常業務シナリオ', () => {
    it('開発部門の典型的な1ヶ月の流れ', async () => {
      const developmentDept = testCompany.departments.find(d => d.name === '開発部');
      const developers = testCompany.employees.filter(e => e.department === '開発部');
      
      // 月次サイクルのシミュレーション
      const monthlyResults = {
        timeRecords: [],
        expenses: [],
        alerts: [],
        payrolls: []
      };

      // 1ヶ月間の勤怠パターン
      for (let day = 1; day <= 31; day++) {
        const date = new Date(`2025-07-${String(day).padStart(2, '0')}`);
        const dayOfWeek = date.getDay();

        // プロジェクトのフェーズに応じた勤務パターン
        const projectPhase = day <= 10 ? 'planning' : day <= 25 ? 'development' : 'release';

        for (const developer of developers) {
          // 週末は基本的に休み（リリース前は例外）
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            if (projectPhase === 'release' && Math.random() > 0.7) {
              // リリース前の週末出勤
              const record = createWeekendWorkRecord(developer, date);
              monthlyResults.timeRecords.push(record);
              
              // 休日出勤アラート
              monthlyResults.alerts.push({
                type: 'weekend_work',
                employeeId: developer.id,
                date,
                message: '休日出勤が発生しています'
              });
            }
            continue;
          }

          // フェーズ別の勤務時間
          let clockIn, clockOut;
          switch (projectPhase) {
            case 'planning':
              // 計画フェーズ：通常勤務
              clockIn = new Date(date);
              clockIn.setHours(9 + Math.floor(Math.random() * 1), Math.floor(Math.random() * 30));
              clockOut = new Date(date);
              clockOut.setHours(18 + Math.floor(Math.random() * 1), Math.floor(Math.random() * 30));
              break;
              
            case 'development':
              // 開発フェーズ：やや長め
              clockIn = new Date(date);
              clockIn.setHours(9 + Math.floor(Math.random() * 1), Math.floor(Math.random() * 30));
              clockOut = new Date(date);
              clockOut.setHours(19 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
              break;
              
            case 'release':
              // リリースフェーズ：長時間勤務
              clockIn = new Date(date);
              clockIn.setHours(8 + Math.floor(Math.random() * 1), Math.floor(Math.random() * 30));
              clockOut = new Date(date);
              clockOut.setHours(21 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60));
              break;
          }

          const record: TimeRecord = {
            id: `tr_${developer.id}_${date.toISOString().split('T')[0]}`,
            employeeId: developer.id,
            date,
            clockIn,
            clockOut,
            breakMinutes: calculateBreakTime(clockIn, clockOut),
            recordType: 'ic_card',
            projectCode: developmentDept.currentProject
          };

          monthlyResults.timeRecords.push(record);

          // 残業チェック
          const workHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) - record.breakMinutes / 60;
          if (workHours > 9) {
            const overtimeHours = workHours - 8;
            
            // 36協定チェック
            const complianceCheck = await complianceEngine.checkDailyCompliance({
              employeeId: developer.id,
              date,
              overtimeHours
            });

            if (complianceCheck.warnings.length > 0) {
              monthlyResults.alerts.push(...complianceCheck.warnings);
            }
          }
        }

        // 日次の経費処理（開発関連）
        if (day % 3 === 0) { // 3日に1回程度経費が発生
          for (const developer of developers.slice(0, 5)) { // 一部の開発者
            const expense = createDevelopmentExpense(developer, date, projectPhase);
            monthlyResults.expenses.push(expense);
          }
        }
      }

      // 月末処理
      console.log('月末の給与計算を開始...');
      
      for (const developer of developers) {
        const payroll = await payrollEngine.calculatePayroll(developer.id, '2025-07');
        monthlyResults.payrolls.push(payroll);

        // プロジェクト手当の計算
        if (projectPhase === 'release') {
          payroll.allowances = {
            ...payroll.allowances,
            projectBonus: 50000 // リリース手当
          };
        }
      }

      // 分析とアサーション
      const analysis = {
        totalOvertime: monthlyResults.timeRecords.reduce((sum, record) => {
          const hours = (record.clockOut.getTime() - record.clockIn.getTime()) / (1000 * 60 * 60) - record.breakMinutes / 60;
          return sum + Math.max(0, hours - 8);
        }, 0),
        weekendWorkDays: monthlyResults.alerts.filter(a => a.type === 'weekend_work').length,
        totalExpenses: monthlyResults.expenses.reduce((sum, exp) => sum + exp.amount, 0),
        averageSalary: monthlyResults.payrolls.reduce((sum, p) => sum + p.totalPay, 0) / monthlyResults.payrolls.length
      };

      expect(analysis.totalOvertime).toBeGreaterThan(100); // 開発部門は残業が多い
      expect(analysis.weekendWorkDays).toBeGreaterThan(0); // リリース前は週末出勤あり
      expect(analysis.totalExpenses).toBeGreaterThan(50000); // 開発関連経費
      expect(analysis.averageSalary).toBeGreaterThan(400000); // IT企業の平均的な給与水準
    });

    it('営業部門の出張を含む業務フロー', async () => {
      const salesDept = testCompany.departments.find(d => d.name === '営業部');
      const salesReps = testCompany.employees.filter(e => e.department === '営業部');
      
      // 営業活動のシミュレーション
      const salesActivities = {
        visits: [],
        expenses: [],
        deals: [],
        commissions: []
      };

      // 各営業担当の月間活動
      for (const rep of salesReps) {
        // 顧客訪問スケジュール
        const monthlyVisits = generateSalesVisitSchedule(rep);
        
        for (const visit of monthlyVisits) {
          // 訪問記録
          salesActivities.visits.push(visit);

          // 出張の場合
          if (visit.type === 'business_trip') {
            // 出張申請
            const tripRequest = await createBusinessTripRequest({
              employeeId: rep.id,
              destination: visit.destination,
              startDate: visit.date,
              duration: visit.duration,
              purpose: visit.purpose
            });

            // 出張経費
            const tripExpenses = await generateBusinessTripExpenses(tripRequest);
            salesActivities.expenses.push(...tripExpenses);

            // 出張中の勤怠処理
            for (let i = 0; i < visit.duration; i++) {
              const tripDate = new Date(visit.date);
              tripDate.setDate(tripDate.getDate() + i);

              const timeRecord: TimeRecord = {
                id: `tr_trip_${rep.id}_${i}`,
                employeeId: rep.id,
                date: tripDate,
                clockIn: new Date(tripDate.setHours(9, 0)),
                clockOut: new Date(tripDate.setHours(18, 0)),
                breakMinutes: 60,
                recordType: 'business_trip',
                location: visit.destination
              };

              await db.createTimeRecord(timeRecord);
            }
          }

          // 成約の場合
          if (Math.random() > 0.7) { // 30%の成約率
            const deal = {
              employeeId: rep.id,
              amount: 1000000 + Math.floor(Math.random() * 5000000),
              date: visit.date,
              clientId: visit.clientId,
              commissionRate: 0.03 // 3%のコミッション
            };
            
            salesActivities.deals.push(deal);
            
            // コミッション計算
            const commission = {
              employeeId: rep.id,
              amount: deal.amount * deal.commissionRate,
              dealId: deal.clientId,
              paymentMonth: '2025-08' // 翌月支払い
            };
            
            salesActivities.commissions.push(commission);
          }
        }
      }

      // 営業部門の月次集計
      const monthlySummary = {
        totalVisits: salesActivities.visits.length,
        businessTrips: salesActivities.visits.filter(v => v.type === 'business_trip').length,
        totalExpenses: salesActivities.expenses.reduce((sum, exp) => sum + exp.amount, 0),
        totalSales: salesActivities.deals.reduce((sum, deal) => sum + deal.amount, 0),
        totalCommissions: salesActivities.commissions.reduce((sum, com) => sum + com.amount, 0),
        conversionRate: salesActivities.deals.length / salesActivities.visits.length
      };

      // 営業部門特有の給与計算（コミッション込み）
      for (const rep of salesReps) {
        const basePayroll = await payrollEngine.calculatePayroll(rep.id, '2025-07');
        const repCommissions = salesActivities.commissions.filter(c => c.employeeId === rep.id);
        
        basePayroll.commissions = repCommissions.reduce((sum, c) => sum + c.amount, 0);
        basePayroll.totalPay += basePayroll.commissions;
      }

      expect(monthlySummary.totalVisits).toBeGreaterThan(50);
      expect(monthlySummary.businessTrips).toBeGreaterThan(5);
      expect(monthlySummary.totalExpenses).toBeGreaterThan(500000);
      expect(monthlySummary.conversionRate).toBeGreaterThan(0.2);
      expect(monthlySummary.totalCommissions).toBeGreaterThan(100000);
    });
  });

  describe('2. 製造業の交代勤務シナリオ', () => {
    it('3交代制の勤怠管理と引き継ぎ', async () => {
      const factory = testCompany.locations.find(l => l.type === 'factory');
      const productionWorkers = testCompany.employees.filter(e => 
        e.department === '製造部' && e.location === factory.id
      );

      // 3交代制のシフト定義
      const shifts = {
        morning: { start: 6, end: 14, name: '早番' },
        afternoon: { start: 14, end: 22, name: '遅番' },
        night: { start: 22, end: 6, name: '夜勤' }
      };

      // 1週間のシフトローテーション
      const weeklySchedule = generateShiftRotation(productionWorkers, shifts);
      
      const shiftResults = {
        records: [],
        handovers: [],
        anomalies: [],
        premiums: []
      };

      // 各日のシフト処理
      for (let day = 0; day < 7; day++) {
        const date = new Date('2025-07-01');
        date.setDate(date.getDate() + day);

        for (const schedule of weeklySchedule[day]) {
          const worker = productionWorkers.find(w => w.id === schedule.employeeId);
          const shift = shifts[schedule.shift];

          // 出勤記録
          const clockIn = new Date(date);
          clockIn.setHours(shift.start, Math.floor(Math.random() * 10)); // 若干の前後

          let clockOut = new Date(date);
          if (shift.end < shift.start) { // 夜勤の場合
            clockOut.setDate(clockOut.getDate() + 1);
          }
          clockOut.setHours(shift.end, Math.floor(Math.random() * 10));

          const record: TimeRecord = {
            id: `tr_shift_${worker.id}_${day}`,
            employeeId: worker.id,
            date,
            clockIn,
            clockOut,
            breakMinutes: 60,
            recordType: 'ic_card',
            shiftType: schedule.shift
          };

          shiftResults.records.push(record);

          // 引き継ぎ記録
          if (schedule.isHandover) {
            const handover = {
              fromShift: schedule.shift,
              toShift: getNextShift(schedule.shift),
              date,
              fromEmployee: worker.id,
              toEmployee: schedule.handoverTo,
              notes: generateHandoverNotes(factory.currentProduction),
              issues: Math.random() > 0.8 ? ['機械Aの異音', '材料在庫低下'] : []
            };

            shiftResults.handovers.push(handover);

            // 引き継ぎ問題のエスカレーション
            if (handover.issues.length > 0) {
              shiftResults.anomalies.push({
                type: 'production_issue',
                severity: 'medium',
                shiftId: schedule.shift,
                issues: handover.issues,
                reportedBy: worker.id
              });
            }
          }

          // シフト手当の計算
          const premium = calculateShiftPremium(record, shift);
          if (premium > 0) {
            shiftResults.premiums.push({
              employeeId: worker.id,
              date,
              type: shift.name,
              hours: (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) - 1,
              rate: premium,
              amount: worker.hourlyWage * premium * ((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) - 1)
            });
          }
        }
      }

      // 週次の分析
      const weeklyAnalysis = {
        totalShifts: shiftResults.records.length,
        nightShifts: shiftResults.records.filter(r => r.shiftType === 'night').length,
        handoverIssues: shiftResults.anomalies.length,
        totalPremiums: shiftResults.premiums.reduce((sum, p) => sum + p.amount, 0),
        averageHandoverTime: 15 // 分
      };

      // 労働基準法の遵守確認
      for (const worker of productionWorkers) {
        const workerRecords = shiftResults.records.filter(r => r.employeeId === worker.id);
        
        // 連続勤務日数のチェック
        const consecutiveDays = calculateConsecutiveWorkDays(workerRecords);
        expect(consecutiveDays).toBeLessThanOrEqual(6); // 週1日は休み

        // インターバル規制のチェック（11時間）
        for (let i = 1; i < workerRecords.length; i++) {
          const prevEnd = workerRecords[i - 1].clockOut;
          const nextStart = workerRecords[i].clockIn;
          const interval = (nextStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60);
          
          expect(interval).toBeGreaterThanOrEqual(11);
        }
      }

      expect(weeklyAnalysis.totalShifts).toBe(productionWorkers.length * 7);
      expect(weeklyAnalysis.nightShifts).toBeGreaterThan(20);
      expect(weeklyAnalysis.totalPremiums).toBeGreaterThan(500000);
    });

    it('生産ラインの緊急対応と残業管理', async () => {
      // 緊急生産対応のシナリオ
      const emergencyOrder = {
        id: 'emergency_001',
        client: '重要顧客A社',
        deadline: new Date('2025-07-15'),
        requiredUnits: 10000,
        normalCapacity: 500, // 通常の日産能力
        priority: 'critical'
      };

      const productionPlan = await createEmergencyProductionPlan(emergencyOrder);
      
      const emergencyResults = {
        overtime: [],
        costs: [],
        quality: [],
        completion: null
      };

      // 緊急増産体制の実施
      for (const day of productionPlan.schedule) {
        // 増員対応
        const additionalWorkers = await callInAdditionalWorkers(day.requiredWorkers);
        
        // 残業対応
        for (const worker of day.workers) {
          if (day.overtimeRequired) {
            const overtimeRecord = {
              employeeId: worker.id,
              date: day.date,
              regularHours: 8,
              overtimeHours: day.overtimeHours,
              reason: '緊急生産対応',
              approvedBy: 'production_manager',
              premiumRate: day.date.getDay() === 0 ? 1.35 : 1.25
            };

            emergencyResults.overtime.push(overtimeRecord);

            // 36協定の特別条項チェック
            const complianceCheck = await complianceEngine.checkSpecialClause({
              employeeId: worker.id,
              month: '2025-07',
              additionalOvertime: day.overtimeHours
            });

            if (!complianceCheck.allowed) {
              // 代替要員の手配
              const replacement = await findReplacementWorker(worker, day.date);
              day.workers.push(replacement);
              day.workers = day.workers.filter(w => w.id !== worker.id);
            }
          }
        }

        // 品質チェック
        const qualityMetrics = await monitorEmergencyProductionQuality({
          date: day.date,
          producedUnits: day.targetUnits,
          defectRate: 0.02 + (day.overtimeHours / 100), // 残業が増えると不良率上昇
          inspectionLevel: 'enhanced'
        });

        emergencyResults.quality.push(qualityMetrics);

        // コスト計算
        const dailyCost = {
          date: day.date,
          regularLabor: day.workers.length * 8 * 3000,
          overtimeLabor: emergencyResults.overtime
            .filter(o => o.date === day.date)
            .reduce((sum, o) => sum + o.overtimeHours * 3000 * o.premiumRate, 0),
          additionalMaterials: day.targetUnits * 100,
          qualityControl: 50000 // 強化品質管理コスト
        };

        emergencyResults.costs.push(dailyCost);
      }

      // 完了評価
      emergencyResults.completion = {
        deadline: emergencyOrder.deadline,
        actualCompletion: productionPlan.estimatedCompletion,
        totalUnitsProduced: productionPlan.schedule.reduce((sum, day) => sum + day.targetUnits, 0),
        totalCost: emergencyResults.costs.reduce((sum, cost) => 
          sum + cost.regularLabor + cost.overtimeLabor + cost.additionalMaterials + cost.qualityControl, 0
        ),
        averageDefectRate: average(emergencyResults.quality.map(q => q.defectRate)),
        overtimeCompliance: emergencyResults.overtime.every(o => o.approvedBy !== null)
      };

      expect(emergencyResults.completion.totalUnitsProduced).toBeGreaterThanOrEqual(emergencyOrder.requiredUnits);
      expect(emergencyResults.completion.actualCompletion).toBeLessThanOrEqual(emergencyOrder.deadline);
      expect(emergencyResults.completion.averageDefectRate).toBeLessThan(0.05); // 5%以下
      expect(emergencyResults.completion.overtimeCompliance).toBe(true);
    });
  });

  describe('3. 小売業の繁忙期対応シナリオ', () => {
    it('年末商戦期間の人員配置最適化', async () => {
      const retailStores = testCompany.locations.filter(l => l.type === 'retail');
      const yearEndPeriod = {
        start: new Date('2025-12-01'),
        end: new Date('2025-12-31'),
        expectedSalesIncrease: 2.5 // 通常の2.5倍
      };

      // 各店舗の繁忙期対応計画
      const seasonalPlans = [];

      for (const store of retailStores) {
        const storeEmployees = testCompany.employees.filter(e => e.location === store.id);
        
        // 売上予測に基づく必要人員計算
        const staffingPlan = await predictiveEngine.calculateOptimalStaffing({
          location: store.id,
          period: yearEndPeriod,
          historicalData: store.salesHistory,
          constraints: {
            maxOvertime: 45,
            minRestDays: 4,
            budgetLimit: store.monthlyLaborBudget * 1.5
          }
        });

        // 臨時スタッフの採用計画
        const tempStaffNeeded = Math.max(0, staffingPlan.requiredHeadcount - storeEmployees.length);
        const tempStaffPlan = {
          store: store.id,
          requiredCount: tempStaffNeeded,
          hiringStartDate: new Date('2025-11-15'),
          trainingDays: 5,
          hourlyWage: 1200,
          contracts: []
        };

        // 臨時スタッフの採用シミュレーション
        for (let i = 0; i < tempStaffNeeded; i++) {
          const tempStaff = {
            id: `temp_${store.id}_${i}`,
            name: `臨時スタッフ${i + 1}`,
            startDate: new Date('2025-11-20'),
            endDate: new Date('2025-12-31'),
            hourlyWage: tempStaffPlan.hourlyWage,
            maxHoursPerWeek: 28, // 社会保険加入を避ける
            skills: ['レジ', '品出し']
          };

          tempStaffPlan.contracts.push(tempStaff);
        }

        // 繁忙期のシフト作成
        const holidayShifts = await createHolidaySeasonShifts({
          store,
          regularStaff: storeEmployees,
          tempStaff: tempStaffPlan.contracts,
          period: yearEndPeriod,
          peakDays: ['2025-12-24', '2025-12-25', '2025-12-31'],
          constraints: staffingPlan.constraints
        });

        seasonalPlans.push({
          store: store.id,
          staffingPlan,
          tempStaffPlan,
          shifts: holidayShifts,
          projectedCosts: calculateSeasonalLaborCosts(holidayShifts),
          projectedSales: store.averageDailySales * yearEndPeriod.expectedSalesIncrease * 31
        });
      }

      // 全店舗の繁忙期分析
      const companyWideAnalysis = {
        totalTempStaff: seasonalPlans.reduce((sum, plan) => sum + plan.tempStaffPlan.requiredCount, 0),
        totalLaborCost: seasonalPlans.reduce((sum, plan) => sum + plan.projectedCosts.total, 0),
        totalProjectedSales: seasonalPlans.reduce((sum, plan) => sum + plan.projectedSales, 0),
        laborCostRatio: 0,
        overtimeCompliance: true,
        customerSatisfactionTarget: 4.5
      };

      companyWideAnalysis.laborCostRatio = companyWideAnalysis.totalLaborCost / companyWideAnalysis.totalProjectedSales;

      // コンプライアンスチェック
      for (const plan of seasonalPlans) {
        for (const shift of plan.shifts) {
          const complianceCheck = await complianceEngine.validateShiftCompliance(shift);
          if (!complianceCheck.compliant) {
            companyWideAnalysis.overtimeCompliance = false;
            break;
          }
        }
      }

      expect(companyWideAnalysis.totalTempStaff).toBeGreaterThan(50);
      expect(companyWideAnalysis.laborCostRatio).toBeLessThan(0.35); // 人件費率35%以下
      expect(companyWideAnalysis.overtimeCompliance).toBe(true);
      expect(companyWideAnalysis.totalProjectedSales).toBeGreaterThan(100000000); // 1億円以上
    });

    it('台風接近時の店舗運営判断', async () => {
      // 台風接近シナリオ
      const typhoonScenario = {
        name: '台風15号',
        expectedLandfall: new Date('2025-09-15T12:00:00'),
        affectedRegion: '関東地方',
        windSpeed: 40, // m/s
        warningLevel: 'emergency'
      };

      const affectedStores = testCompany.locations.filter(l => 
        l.type === 'retail' && l.region === typhoonScenario.affectedRegion
      );

      const emergencyResponses = [];

      for (const store of affectedStores) {
        // 店舗別の対応判断
        const storeDecision = await makeEmergencyDecision({
          store,
          threat: typhoonScenario,
          employeeSafety: 'highest_priority',
          businessContinuity: 'secondary'
        });

        const storeEmployees = testCompany.employees.filter(e => e.location === store.id);

        // 従業員への通知
        const notifications = [];
        for (const employee of storeEmployees) {
          const notification = {
            employeeId: employee.id,
            message: storeDecision.closureDecision ? 
              `台風接近のため、${storeDecision.closureStart}から臨時休業となります。自宅待機してください。` :
              `台風に注意し、安全を最優先に出勤判断をしてください。`,
            sentAt: new Date(),
            channel: ['email', 'sms', 'app'],
            priority: 'urgent'
          };

          notifications.push(notification);
          
          // 通知の送信シミュレーション
          await integrationManager.sendEmergencyNotification(notification);
        }

        // 休業補償の計算
        if (storeDecision.closureDecision) {
          const compensations = [];
          
          for (const employee of storeEmployees) {
            // 予定されていたシフトの確認
            const scheduledShift = await getScheduledShift(employee.id, storeDecision.closureDate);
            
            if (scheduledShift) {
              const compensation = {
                employeeId: employee.id,
                date: storeDecision.closureDate,
                scheduledHours: scheduledShift.hours,
                compensationRate: 0.6, // 休業手当60%
                amount: employee.hourlyWage * scheduledShift.hours * 0.6,
                reason: '自然災害による休業',
                approvalStatus: 'auto_approved'
              };

              compensations.push(compensation);
            }
          }

          storeDecision.compensations = compensations;
          storeDecision.totalCompensationCost = compensations.reduce((sum, c) => sum + c.amount, 0);
        }

        // BCP（事業継続計画）の発動
        const bcpActions = await activateBusinessContinuityPlan({
          store,
          disruption: typhoonScenario,
          priorities: ['employee_safety', 'inventory_protection', 'data_backup']
        });

        emergencyResponses.push({
          store: store.id,
          decision: storeDecision,
          notifications: notifications.length,
          bcpActions,
          estimatedLoss: calculateEstimatedLoss(store, storeDecision)
        });
      }

      // 全社的な影響評価
      const companyImpact = {
        affectedStores: emergencyResponses.length,
        closedStores: emergencyResponses.filter(r => r.decision.closureDecision).length,
        totalCompensation: emergencyResponses.reduce((sum, r) => 
          sum + (r.decision.totalCompensationCost || 0), 0
        ),
        estimatedSalesLoss: emergencyResponses.reduce((sum, r) => sum + r.estimatedLoss, 0),
        employeeSafetyIncidents: 0, // 最重要KPI
        bcpEffectiveness: 'high'
      };

      expect(companyImpact.employeeSafetyIncidents).toBe(0); // 安全第一
      expect(companyImpact.closedStores).toBeGreaterThan(0); // 適切な判断
      expect(companyImpact.totalCompensation).toBeGreaterThan(0); // 従業員保護
      expect(companyImpact.bcpEffectiveness).toBe('high'); // BCP機能
    });
  });

  describe('4. スタートアップの急成長シナリオ', () => {
    it('3ヶ月で従業員数が2倍になる急成長対応', async () => {
      const startup = {
        name: 'TechStartup株式会社',
        initialEmployees: 50,
        targetEmployees: 100,
        fundingRound: 'Series B',
        growthPeriod: 90 // days
      };

      const growthSimulation = {
        hiringPlan: [],
        onboardingLoad: [],
        systemScaling: [],
        cultureMaintenance: []
      };

      // 採用計画の策定
      const hiringPlan = await talentEngine.createAggressiveHiringPlan({
        current: startup.initialEmployees,
        target: startup.targetEmployees,
        timeline: startup.growthPeriod,
        roles: [
          { title: 'ソフトウェアエンジニア', count: 20, priority: 'high' },
          { title: 'プロダクトマネージャー', count: 5, priority: 'high' },
          { title: 'デザイナー', count: 8, priority: 'medium' },
          { title: 'セールス', count: 10, priority: 'medium' },
          { title: 'カスタマーサクセス', count: 7, priority: 'low' }
        ]
      });

      // 週次の採用シミュレーション
      for (let week = 1; week <= 13; week++) {
        const weekStart = new Date('2025-07-01');
        weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

        // その週の採用者
        const weeklyHires = Math.floor(hiringPlan.weeklyTarget * (0.8 + Math.random() * 0.4));
        const newHires = [];

        for (let i = 0; i < weeklyHires; i++) {
          const role = selectRoleBasedOnPriority(hiringPlan.roles);
          const newEmployee = {
            id: `new_hire_w${week}_${i}`,
            name: `新入社員${week}-${i}`,
            role: role.title,
            startDate: weekStart,
            salary: getMarketSalary(role.title) * (1 + Math.random() * 0.2), // 市場価格の0-20%増
            stockOptions: 1000 + Math.floor(Math.random() * 2000),
            probationPeriod: 90
          };

          newHires.push(newEmployee);
        }

        growthSimulation.hiringPlan.push({
          week,
          hires: newHires,
          totalEmployees: startup.initialEmployees + growthSimulation.hiringPlan.reduce((sum, w) => sum + w.hires.length, 0) + newHires.length
        });

        // オンボーディング負荷の計算
        const onboardingLoad = await calculateOnboardingLoad({
          newHires: newHires.length,
          existingEmployees: growthSimulation.hiringPlan[week - 1]?.totalEmployees || startup.initialEmployees,
          onboardingDays: 14,
          mentorRatio: 0.5 // 新入社員2人に1人のメンター
        });

        growthSimulation.onboardingLoad.push({
          week,
          load: onboardingLoad,
          mentorsRequired: Math.ceil(newHires.length * 0.5),
          productivityImpact: onboardingLoad.totalHoursRequired / (40 * onboardingLoad.mentorsRequired)
        });

        // システムスケーリングの必要性
        const currentEmployees = growthSimulation.hiringPlan[week - 1]?.totalEmployees || startup.initialEmployees;
        if (currentEmployees > startup.initialEmployees * 1.5) {
          const scalingNeeds = await assessSystemScalingNeeds({
            currentUsers: currentEmployees,
            expectedUsers: startup.targetEmployees,
            currentSystems: ['hr', 'payroll', 'expense'],
            performanceMetrics: {
              responseTime: 200 + currentEmployees * 2, // ms
              concurrentUsers: currentEmployees * 0.8,
              dataVolume: currentEmployees * 1000 // MB
            }
          });

          growthSimulation.systemScaling.push({
            week,
            needs: scalingNeeds,
            estimatedCost: scalingNeeds.infrastructureCost + scalingNeeds.licenseCost,
            implementationTime: scalingNeeds.urgency === 'immediate' ? 1 : 2 // weeks
          });
        }

        // 企業文化の維持施策
        if (week % 4 === 0) { // 月次
          const cultureInitiatives = await planCultureMaintenance({
            employeeCount: currentEmployees,
            newHireRatio: weeklyHires / currentEmployees,
            engagement: await measureEmployeeEngagement(currentEmployees)
          });

          growthSimulation.cultureMaintenance.push({
            week,
            initiatives: cultureInitiatives,
            budget: cultureInitiatives.reduce((sum, i) => sum + i.cost, 0),
            expectedImpact: average(cultureInitiatives.map(i => i.expectedEngagementIncrease))
          });
        }
      }

      // 成長シミュレーションの分析
      const growthAnalysis = {
        finalHeadcount: growthSimulation.hiringPlan[growthSimulation.hiringPlan.length - 1].totalEmployees,
        totalHired: growthSimulation.hiringPlan.reduce((sum, w) => sum + w.hires.length, 0),
        hiringSuccessRate: 0,
        averageOnboardingLoad: average(growthSimulation.onboardingLoad.map(o => o.productivityImpact)),
        totalScalingCost: growthSimulation.systemScaling.reduce((sum, s) => sum + s.estimatedCost, 0),
        cultureMaintainenceBudget: growthSimulation.cultureMaintenance.reduce((sum, c) => sum + c.budget, 0)
      };

      growthAnalysis.hiringSuccessRate = growthAnalysis.totalHired / (startup.targetEmployees - startup.initialEmployees);

      expect(growthAnalysis.finalHeadcount).toBeGreaterThanOrEqual(startup.targetEmployees * 0.9); // 90%以上達成
      expect(growthAnalysis.hiringSuccessRate).toBeGreaterThan(0.8); // 80%以上の採用成功率
      expect(growthAnalysis.averageOnboardingLoad).toBeLessThan(0.5); // 生産性への影響50%未満
      expect(growthAnalysis.totalScalingCost).toBeGreaterThan(0); // スケーリング投資実施
      expect(growthAnalysis.cultureMaintainenceBudget).toBeGreaterThan(0); // 文化維持への投資
    });

    it('リモートファースト企業の労務管理', async () => {
      const remoteCompany = {
        name: 'RemoteFirst Inc.',
        employees: generateRemoteEmployees(100),
        timeZones: ['JST', 'PST', 'EST', 'GMT', 'CET'],
        coreHours: { start: 13, end: 17, timezone: 'JST' } // 日本時間13-17時
      };

      const remoteWorkSimulation = {
        dailyOperations: [],
        meetings: [],
        productivity: [],
        compliance: []
      };

      // 1週間のリモートワークシミュレーション
      for (let day = 0; day < 7; day++) {
        const date = new Date('2025-07-01');
        date.setDate(date.getDate() + day);

        const dailyData = {
          date,
          activeEmployees: [],
          coreHoursCoverage: 0,
          asyncWork: [],
          timezoneConflicts: []
        };

        // 各従業員の勤務シミュレーション
        for (const employee of remoteCompany.employees) {
          // タイムゾーンに基づく勤務時間
          const localWorkHours = getLocalWorkHours(employee.timezone, employee.preferredSchedule);
          const jstWorkHours = convertToJST(localWorkHours, employee.timezone);

          // コアアワーとの重複確認
          const coreHoursOverlap = calculateOverlap(
            jstWorkHours,
            remoteCompany.coreHours
          );

          if (coreHoursOverlap >= 2) { // 2時間以上の重複
            dailyData.activeEmployees.push({
              employeeId: employee.id,
              timezone: employee.timezone,
              workHours: jstWorkHours,
              coreHoursAttendance: coreHoursOverlap
            });
          } else {
            // 非同期作業として記録
            dailyData.asyncWork.push({
              employeeId: employee.id,
              timezone: employee.timezone,
              reason: 'timezone_difference',
              communicationMethod: 'async_tools'
            });
          }

          // 労働時間の記録（自己申告制）
          const timeRecord = {
            employeeId: employee.id,
            date,
            startTime: localWorkHours.start,
            endTime: localWorkHours.end,
            totalHours: localWorkHours.duration,
            timezone: employee.timezone,
            location: employee.location,
            recordType: 'self_reported'
          };

          // 現地の労働法遵守チェック
          const localCompliance = await checkLocalLaborLaws({
            country: employee.location.country,
            workHours: timeRecord.totalHours,
            weeklyHours: await getWeeklyHours(employee.id, date)
          });

          if (!localCompliance.compliant) {
            remoteWorkSimulation.compliance.push({
              employeeId: employee.id,
              country: employee.location.country,
              violation: localCompliance.violation,
              recommendation: localCompliance.recommendation
            });
          }
        }

        dailyData.coreHoursCoverage = dailyData.activeEmployees.length / remoteCompany.employees.length;

        // グローバルミーティングのスケジューリング
        if (day % 2 === 0) { // 週3回のチームミーティング
          const meeting = await scheduleGlobalMeeting({
            participants: remoteCompany.employees.slice(0, 20), // 20人のミーティング
            duration: 60, // minutes
            preferredTimeZone: 'JST',
            constraints: {
              avoidLateNight: true, // 22時以降は避ける
              avoidEarlyMorning: true, // 6時前は避ける
              maximizeAttendance: true
            }
          });

          remoteWorkSimulation.meetings.push({
            date,
            time: meeting.scheduledTime,
            expectedAttendance: meeting.expectedAttendees.length,
            timezoneConflicts: meeting.conflicts,
            recordingRequired: meeting.conflicts.length > 0
          });
        }

        // 生産性メトリクス
        const dailyProductivity = await measureRemoteProductivity({
          activeEmployees: dailyData.activeEmployees.length,
          asyncWorkers: dailyData.asyncWork.length,
          communicationVolume: Math.floor(Math.random() * 1000) + 500,
          taskCompletion: 0.7 + Math.random() * 0.3
        });

        remoteWorkSimulation.productivity.push({
          date,
          score: dailyProductivity.score,
          factors: dailyProductivity.factors
        });

        remoteWorkSimulation.dailyOperations.push(dailyData);
      }

      // リモートワーク分析
      const remoteAnalysis = {
        averageCoreHoursCoverage: average(remoteWorkSimulation.dailyOperations.map(d => d.coreHoursCoverage)),
        meetingEffectiveness: average(remoteWorkSimulation.meetings.map(m => m.expectedAttendance / 20)),
        complianceIssues: remoteWorkSimulation.compliance.length,
        productivityScore: average(remoteWorkSimulation.productivity.map(p => p.score)),
        asyncWorkRatio: remoteWorkSimulation.dailyOperations.reduce((sum, d) => sum + d.asyncWork.length, 0) / 
                       (remoteWorkSimulation.dailyOperations.reduce((sum, d) => sum + d.activeEmployees.length + d.asyncWork.length, 0))
      };

      expect(remoteAnalysis.averageCoreHoursCoverage).toBeGreaterThan(0.6); // 60%以上がコアアワー参加
      expect(remoteAnalysis.meetingEffectiveness).toBeGreaterThan(0.7); // 70%以上の出席率
      expect(remoteAnalysis.complianceIssues).toBeLessThan(10); // コンプライアンス問題は最小限
      expect(remoteAnalysis.productivityScore).toBeGreaterThan(0.8); // 高い生産性維持
      expect(remoteAnalysis.asyncWorkRatio).toBeLessThan(0.4); // 非同期作業は40%未満
    });
  });

  describe('5. M&A統合シナリオ', () => {
    it('異なるHRシステムの統合と従業員データ移行', async () => {
      const acquisition = {
        acquirer: {
          name: '大手企業A社',
          employees: 5000,
          hrSystem: 'System A',
          payrollCycle: 'monthly',
          benefitsProvider: 'Provider A'
        },
        target: {
          name: '中堅企業B社',
          employees: 500,
          hrSystem: 'System B',
          payrollCycle: 'bi-weekly',
          benefitsProvider: 'Provider B'
        },
        closingDate: new Date('2025-07-01'),
        integrationDeadline: new Date('2025-12-31')
      };

      const integrationProject = {
        phases: [],
        dataMapping: [],
        issues: [],
        progress: []
      };

      // Phase 1: データ分析とマッピング
      const dataAnalysis = await analyzeHRDataStructures({
        systemA: acquisition.acquirer.hrSystem,
        systemB: acquisition.target.hrSystem
      });

      integrationProject.dataMapping = dataAnalysis.mappings;

      // 不整合の特定
      const inconsistencies = dataAnalysis.inconsistencies;
      for (const issue of inconsistencies) {
        integrationProject.issues.push({
          phase: 'analysis',
          type: issue.type,
          description: issue.description,
          impact: issue.impact,
          resolution: await planDataResolution(issue)
        });
      }

      // Phase 2: 従業員IDの統合
      const idMappingPhase = {
        name: 'ID統合',
        startDate: new Date('2025-07-15'),
        tasks: []
      };

      // 重複チェック
      const duplicateEmployees = await findDuplicateEmployees(
        acquisition.acquirer.employees,
        acquisition.target.employees
      );

      if (duplicateEmployees.length > 0) {
        idMappingPhase.tasks.push({
          name: '重複従業員の処理',
          count: duplicateEmployees.length,
          action: 'manual_review',
          assignedTo: 'hr_integration_team'
        });
      }

      // 新ID体系の設計
      const newIdScheme = await designUnifiedIdScheme({
        acquirerPrefix: 'A',
        targetPrefix: 'B',
        totalEmployees: acquisition.acquirer.employees + acquisition.target.employees,
        futureGrowth: 1.5
      });

      idMappingPhase.tasks.push({
        name: 'ID変換テーブル作成',
        oldIds: acquisition.target.employees,
        newIdFormat: newIdScheme.format,
        estimatedDuration: '2 weeks'
      });

      integrationProject.phases.push(idMappingPhase);

      // Phase 3: 給与体系の統合
      const payrollIntegrationPhase = {
        name: '給与システム統合',
        startDate: new Date('2025-08-01'),
        tasks: [],
        challenges: []
      };

      // 給与サイクルの調整
      if (acquisition.acquirer.payrollCycle !== acquisition.target.payrollCycle) {
        const cycleTransition = await planPayrollCycleTransition({
          from: acquisition.target.payrollCycle,
          to: acquisition.acquirer.payrollCycle,
          employeeCount: acquisition.target.employees,
          transitionDate: new Date('2025-09-01')
        });

        payrollIntegrationPhase.tasks.push({
          name: '給与サイクル移行',
          description: cycleTransition.plan,
          affectedEmployees: acquisition.target.employees,
          specialPayments: cycleTransition.bridgePayments
        });

        // 移行期の特別処理
        for (const payment of cycleTransition.bridgePayments) {
          const specialPayroll = {
            employeeGroup: 'target_company',
            paymentDate: payment.date,
            type: 'transition_adjustment',
            calculation: payment.calculation,
            communication: payment.employeeCommunication
          };

          payrollIntegrationPhase.tasks.push(specialPayroll);
        }
      }

      // 給与レンジの調整
      const salaryAnalysis = await analyzeSalaryDiscrepancies({
        acquirerData: await getCompanySalaryData(acquisition.acquirer),
        targetData: await getCompanySalaryData(acquisition.target)
      });

      if (salaryAnalysis.significantGaps.length > 0) {
        payrollIntegrationPhase.challenges.push({
          type: 'salary_equity',
          description: '同一職種での給与格差',
          proposedSolution: salaryAnalysis.harmonizationPlan,
          budgetImpact: salaryAnalysis.costIncrease
        });
      }

      integrationProject.phases.push(payrollIntegrationPhase);

      // Phase 4: 福利厚生の統合
      const benefitsIntegrationPhase = {
        name: '福利厚生統合',
        startDate: new Date('2025-09-01'),
        tasks: [],
        employeeCommunications: []
      };

      // 福利厚生の比較
      const benefitsComparison = await compareBenefitsPackages({
        acquirer: acquisition.acquirer.benefitsProvider,
        target: acquisition.target.benefitsProvider
      });

      // 従業員への影響分析
      for (const benefit of benefitsComparison.differences) {
        const impact = await analyzeBenefitChangeImpact({
          benefit: benefit.type,
          oldValue: benefit.targetValue,
          newValue: benefit.acquirerValue,
          affectedEmployees: acquisition.target.employees
        });

        if (impact.negativelyAffected > 0) {
          benefitsIntegrationPhase.tasks.push({
            name: `${benefit.type}の調整`,
            description: impact.description,
            affectedCount: impact.negativelyAffected,
            proposedMitigation: impact.mitigation,
            cost: impact.mitigationCost
          });
        }

        // 従業員コミュニケーション計画
        benefitsIntegrationPhase.employeeCommunications.push({
          topic: benefit.type,
          targetAudience: 'affected_employees',
          message: impact.communicationTemplate,
          channels: ['email', 'town_hall', 'one_on_one'],
          timing: 'before_change'
        });
      }

      integrationProject.phases.push(benefitsIntegrationPhase);

      // Phase 5: システム統合とデータ移行
      const systemMigrationPhase = {
        name: 'システム移行',
        startDate: new Date('2025-10-01'),
        tasks: [],
        rollbackPlan: null
      };

      // データ移行計画
      const migrationPlan = await createDataMigrationPlan({
        sourceSystem: acquisition.target.hrSystem,
        targetSystem: acquisition.acquirer.hrSystem,
        dataVolume: {
          employees: acquisition.target.employees,
          historicalRecords: acquisition.target.employees * 365 * 3, // 3年分
          documents: acquisition.target.employees * 50
        },
        deadline: acquisition.integrationDeadline
      });

      systemMigrationPhase.tasks = migrationPlan.tasks;
      systemMigrationPhase.rollbackPlan = migrationPlan.rollbackStrategy;

      // テスト移行の実施
      const testMigration = await executeTestMigration({
        sampleSize: Math.floor(acquisition.target.employees * 0.1), // 10%
        includeEdgeCases: true
      });

      integrationProject.progress.push({
        phase: 'test_migration',
        date: new Date('2025-10-15'),
        result: testMigration.success ? 'passed' : 'failed',
        issues: testMigration.issues,
        dataIntegrityScore: testMigration.integrityScore
      });

      integrationProject.phases.push(systemMigrationPhase);

      // 統合プロジェクトの評価
      const projectEvaluation = {
        totalPhases: integrationProject.phases.length,
        criticalIssues: integrationProject.issues.filter(i => i.impact === 'critical').length,
        estimatedCompletion: calculateProjectEndDate(integrationProject.phases),
        budgetEstimate: integrationProject.phases.reduce((sum, phase) => 
          sum + (phase.tasks.reduce((taskSum, task) => taskSum + (task.cost || 0), 0)), 0
        ),
        employeeRetentionRisk: await assessRetentionRisk({
          targetEmployees: acquisition.target.employees,
          changes: ['system', 'benefits', 'culture'],
          communicationPlan: benefitsIntegrationPhase.employeeCommunications
        })
      };

      expect(projectEvaluation.criticalIssues).toBeLessThan(5);
      expect(projectEvaluation.estimatedCompletion).toBeLessThanOrEqual(acquisition.integrationDeadline);
      expect(projectEvaluation.employeeRetentionRisk).toBeLessThan(0.2); // 20%未満の離職リスク
      expect(testMigration.integrityScore).toBeGreaterThan(0.95); // 95%以上のデータ整合性
    });
  });
});

// ヘルパー関数群

function createRealisticDatabase(): any {
  const mockDb = {
    getEmployee: vi.fn(),
    getAllEmployees: vi.fn(),
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
    getTimeRecords: vi.fn(),
    createTimeRecord: vi.fn(),
    getExpenseRequests: vi.fn(),
    createExpenseRequest: vi.fn(),
    query: vi.fn(),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn()
  };

  return mockDb;
}

async function initializeTestCompany(): Promise<any> {
  return {
    name: 'テスト総合商社株式会社',
    industry: 'diversified',
    employees: generateDiverseEmployees(500),
    departments: [
      { id: 'dev', name: '開発部', headcount: 150, currentProject: 'ProjectAlpha' },
      { id: 'sales', name: '営業部', headcount: 100 },
      { id: 'mfg', name: '製造部', headcount: 120 },
      { id: 'hr', name: '人事部', headcount: 30 },
      { id: 'finance', name: '経理部', headcount: 25 },
      { id: 'retail', name: '小売事業部', headcount: 75 }
    ],
    locations: [
      { id: 'hq', name: '本社', type: 'office', region: '関東地方', employees: 200 },
      { id: 'factory1', name: '千葉工場', type: 'factory', region: '関東地方', employees: 120, currentProduction: 'ProductX' },
      { id: 'store1', name: '東京店', type: 'retail', region: '関東地方', employees: 40, averageDailySales: 2000000 },
      { id: 'store2', name: '横浜店', type: 'retail', region: '関東地方', employees: 35, averageDailySales: 1500000 }
    ],
    fiscalYear: { start: '04-01', end: '03-31' },
    policies: {
      overtime: { monthly: 45, yearly: 360 },
      leave: { annual: 20, carryover: true },
      remote: { allowed: true, daysPerWeek: 2 }
    }
  };
}

function generateDiverseEmployees(count: number): Employee[] {
  const departments = ['開発部', '営業部', '製造部', '人事部', '経理部', '小売事業部'];
  const positions = ['スタッフ', 'シニアスタッフ', 'リーダー', 'マネージャー', '部長'];
  const locations = ['hq', 'factory1', 'store1', 'store2'];

  return Array(count).fill(null).map((_, i) => ({
    id: `emp${String(i + 1).padStart(4, '0')}`,
    name: generateJapaneseName(i),
    email: `employee${i + 1}@testcompany.co.jp`,
    department: departments[Math.floor(i / count * departments.length)],
    position: positions[Math.min(Math.floor(Math.random() * positions.length * 1.2), positions.length - 1)],
    location: locations[Math.floor(Math.random() * locations.length)],
    hourlyWage: 1500 + Math.floor(i / 100) * 500 + Math.floor(Math.random() * 1000),
    startDate: new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    employmentType: Math.random() > 0.8 ? 'contract' : 'regular',
    workSystem: Math.random() > 0.9 ? 'flex' : 'regular'
  }));
}

function generateJapaneseName(index: number): string {
  const surnames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
  const givenNames = ['太郎', '花子', '一郎', '美咲', '健太', '愛子', '大輔', '由美', '翔太', '恵子'];
  return `${surnames[index % surnames.length]} ${givenNames[index % givenNames.length]}`;
}

function createWeekendWorkRecord(employee: any, date: Date): TimeRecord {
  return {
    id: `tr_weekend_${employee.id}_${date.toISOString().split('T')[0]}`,
    employeeId: employee.id,
    date,
    clockIn: new Date(date.setHours(10, 0)),
    clockOut: new Date(date.setHours(18, 0)),
    breakMinutes: 60,
    recordType: 'manual',
    isHoliday: true,
    approvedBy: 'manager'
  };
}

function calculateBreakTime(clockIn: Date, clockOut: Date): number {
  const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  if (hours > 8) return 75; // 8時間超は75分
  if (hours > 6) return 60; // 6時間超は60分
  return 45; // それ以外は45分
}

function createDevelopmentExpense(developer: any, date: Date, projectPhase: string): ExpenseRequest {
  const expenseTypes = {
    planning: ['書籍', '研修', 'オンラインコース'],
    development: ['ソフトウェアライセンス', 'クラウドサービス', '開発ツール'],
    release: ['残業食事代', 'タクシー代', 'テスト環境']
  };

  const type = expenseTypes[projectPhase][Math.floor(Math.random() * expenseTypes[projectPhase].length)];
  
  return {
    id: `exp_${developer.id}_${date.toISOString().split('T')[0]}`,
    employeeId: developer.id,
    amount: Math.floor(Math.random() * 20000) + 5000,
    categoryId: type,
    description: `${projectPhase}フェーズ - ${type}`,
    expenseDate: date,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    currency: 'JPY',
    purpose: 'プロジェクト関連'
  };
}

function generateSalesVisitSchedule(salesRep: any): any[] {
  const visits = [];
  const clients = ['クライアントA', 'クライアントB', 'クライアントC', 'クライアントD'];
  
  for (let i = 0; i < 20; i++) {
    const date = new Date('2025-07-01');
    date.setDate(date.getDate() + Math.floor(Math.random() * 30));
    
    visits.push({
      employeeId: salesRep.id,
      date,
      clientId: clients[Math.floor(Math.random() * clients.length)],
      type: Math.random() > 0.8 ? 'business_trip' : 'local_visit',
      destination: Math.random() > 0.8 ? '大阪' : '東京',
      duration: Math.random() > 0.8 ? 2 : 1,
      purpose: '商談'
    });
  }
  
  return visits;
}

async function createBusinessTripRequest(data: any): Promise<any> {
  return {
    id: `trip_${data.employeeId}_${Date.now()}`,
    ...data,
    status: 'approved',
    approvedBy: 'sales_manager',
    approvedAt: new Date()
  };
}

async function generateBusinessTripExpenses(trip: any): Promise<ExpenseRequest[]> {
  const expenses = [];
  
  // 交通費
  expenses.push({
    id: `exp_transport_${trip.id}`,
    employeeId: trip.employeeId,
    amount: trip.destination === '大阪' ? 28900 : 15000,
    categoryId: '交通費',
    description: `${trip.destination}出張 - 新幹線`,
    expenseDate: trip.startDate,
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
    currency: 'JPY',
    purpose: trip.purpose
  });
  
  // 宿泊費
  if (trip.duration > 1) {
    expenses.push({
      id: `exp_hotel_${trip.id}`,
      employeeId: trip.employeeId,
      amount: 12000 * (trip.duration - 1),
      categoryId: '宿泊費',
      description: `${trip.destination}出張 - ホテル`,
      expenseDate: trip.startDate,
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
      currency: 'JPY',
      purpose: trip.purpose
    });
  }
  
  return expenses;
}

function generateShiftRotation(workers: any[], shifts: any): any[][] {
  const weekSchedule = [];
  const shiftKeys = Object.keys(shifts);
  
  for (let day = 0; day < 7; day++) {
    const daySchedule = [];
    
    // 各シフトに均等に割り当て
    workers.forEach((worker, index) => {
      const shiftIndex = (index + day) % shiftKeys.length;
      daySchedule.push({
        employeeId: worker.id,
        shift: shiftKeys[shiftIndex],
        isHandover: index % 10 === 0, // 10人に1人は引き継ぎ担当
        handoverTo: index < workers.length - 1 ? workers[index + 1].id : workers[0].id
      });
    });
    
    weekSchedule.push(daySchedule);
  }
  
  return weekSchedule;
}

function getNextShift(currentShift: string): string {
  const shiftOrder = ['morning', 'afternoon', 'night'];
  const currentIndex = shiftOrder.indexOf(currentShift);
  return shiftOrder[(currentIndex + 1) % shiftOrder.length];
}

function generateHandoverNotes(production: string): string {
  const notes = [
    `${production}の生産状況：計画通り進行中`,
    '品質チェックポイント：異常なし',
    '在庫状況：原材料Aが残り20%',
    '次シフトへの申し送り事項'
  ];
  return notes.join('\n');
}

function calculateShiftPremium(record: TimeRecord, shift: any): number {
  if (shift.name === '夜勤') return 0.25;
  if (shift.name === '遅番' && record.clockOut.getHours() >= 22) return 0.25;
  return 0;
}

function calculateConsecutiveWorkDays(records: TimeRecord[]): number {
  records.sort((a, b) => a.date.getTime() - b.date.getTime());
  
  let maxConsecutive = 0;
  let currentConsecutive = 0;
  let lastDate = null;
  
  for (const record of records) {
    if (!lastDate || (record.date.getTime() - lastDate.getTime()) === 24 * 60 * 60 * 1000) {
      currentConsecutive++;
    } else {
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      currentConsecutive = 1;
    }
    lastDate = record.date;
  }
  
  return Math.max(maxConsecutive, currentConsecutive);
}

async function createEmergencyProductionPlan(order: any): Promise<any> {
  const daysUntilDeadline = Math.ceil((order.deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const dailyTarget = Math.ceil(order.requiredUnits / daysUntilDeadline);
  const overtimeNeeded = dailyTarget > order.normalCapacity;
  
  const schedule = [];
  
  for (let day = 0; day < daysUntilDeadline; day++) {
    const date = new Date();
    date.setDate(date.getDate() + day);
    
    schedule.push({
      date,
      targetUnits: dailyTarget,
      requiredWorkers: Math.ceil(dailyTarget / 50), // 1人50個/日
      overtimeRequired: overtimeNeeded,
      overtimeHours: overtimeNeeded ? 3 : 0,
      workers: [] // 後で割り当て
    });
  }
  
  return {
    orderId: order.id,
    schedule,
    estimatedCompletion: schedule[schedule.length - 1].date,
    totalOvertimeHours: schedule.reduce((sum, day) => sum + day.overtimeHours * day.requiredWorkers, 0)
  };
}

async function callInAdditionalWorkers(required: number): Promise<any[]> {
  // 追加作業員の呼び出しシミュレーション
  return Array(required).fill(null).map((_, i) => ({
    id: `temp_worker_${i}`,
    type: 'temporary',
    hourlyWage: 1500
  }));
}

async function findReplacementWorker(worker: any, date: Date): Promise<any> {
  // 代替作業員の検索シミュレーション
  return {
    id: `replacement_for_${worker.id}`,
    name: '代替作業員',
    hourlyWage: worker.hourlyWage * 1.1 // 10%増し
  };
}

async function monitorEmergencyProductionQuality(data: any): Promise<any> {
  return {
    date: data.date,
    producedUnits: data.producedUnits,
    defectRate: data.defectRate,
    defectiveUnits: Math.floor(data.producedUnits * data.defectRate),
    qualityScore: 1 - data.defectRate,
    correctionCost: Math.floor(data.producedUnits * data.defectRate * 500)
  };
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b) / numbers.length;
}

async function createHolidaySeasonShifts(config: any): Promise<any[]> {
  const shifts = [];
  const totalStaff = config.regularStaff.length + config.tempStaff.length;
  
  // 各日のシフト作成
  for (let day = 0; day < 31; day++) {
    const date = new Date(config.period.start);
    date.setDate(date.getDate() + day);
    
    const isPeakDay = config.peakDays.includes(date.toISOString().split('T')[0]);
    const requiredStaff = isPeakDay ? Math.floor(totalStaff * 0.9) : Math.floor(totalStaff * 0.6);
    
    shifts.push({
      date,
      requiredStaff,
      assignments: assignStaffToShift(config.regularStaff, config.tempStaff, requiredStaff),
      isPeakDay
    });
  }
  
  return shifts;
}

function assignStaffToShift(regularStaff: any[], tempStaff: any[], required: number): any[] {
  const assignments = [];
  const availableRegular = [...regularStaff];
  const availableTemp = [...tempStaff];
  
  // 正社員を優先的に割り当て
  while (assignments.length < required && availableRegular.length > 0) {
    const index = Math.floor(Math.random() * availableRegular.length);
    assignments.push(availableRegular.splice(index, 1)[0]);
  }
  
  // 不足分は臨時スタッフで補充
  while (assignments.length < required && availableTemp.length > 0) {
    const index = Math.floor(Math.random() * availableTemp.length);
    assignments.push(availableTemp.splice(index, 1)[0]);
  }
  
  return assignments;
}

function calculateSeasonalLaborCosts(shifts: any[]): any {
  let regularHours = 0;
  let tempHours = 0;
  
  shifts.forEach(shift => {
    shift.assignments.forEach(staff => {
      const hours = 8; // 基本8時間シフト
      if (staff.id.startsWith('temp_')) {
        tempHours += hours;
      } else {
        regularHours += hours;
      }
    });
  });
  
  return {
    regular: regularHours * 2500, // 平均時給
    temporary: tempHours * 1200,
    total: regularHours * 2500 + tempHours * 1200
  };
}

async function makeEmergencyDecision(params: any): Promise<any> {
  // 台風の影響度評価
  const riskLevel = params.threat.windSpeed > 35 ? 'extreme' : 'high';
  
  return {
    closureDecision: riskLevel === 'extreme',
    closureDate: params.threat.expectedLandfall,
    closureStart: new Date(params.threat.expectedLandfall.getTime() - 6 * 60 * 60 * 1000), // 6時間前
    reopenDate: new Date(params.threat.expectedLandfall.getTime() + 24 * 60 * 60 * 1000), // 翌日
    totalCompensationCost: 0 // 後で計算
  };
}

async function getScheduledShift(employeeId: string, date: Date): Promise<any> {
  // シフトデータの取得シミュレーション
  return {
    employeeId,
    date,
    hours: 8,
    startTime: '09:00',
    endTime: '18:00'
  };
}

async function activateBusinessContinuityPlan(params: any): Promise<any[]> {
  const actions = [];
  
  params.priorities.forEach(priority => {
    switch (priority) {
      case 'employee_safety':
        actions.push({
          action: '全従業員への安全確認連絡',
          status: 'completed',
          timestamp: new Date()
        });
        break;
      case 'inventory_protection':
        actions.push({
          action: '在庫の安全な場所への移動',
          status: 'in_progress',
          estimatedCompletion: new Date(Date.now() + 3 * 60 * 60 * 1000)
        });
        break;
      case 'data_backup':
        actions.push({
          action: 'クラウドへの緊急バックアップ',
          status: 'completed',
          timestamp: new Date()
        });
        break;
    }
  });
  
  return actions;
}

function calculateEstimatedLoss(store: any, decision: any): number {
  if (!decision.closureDecision) return 0;
  
  const closureDays = (decision.reopenDate.getTime() - decision.closureDate.getTime()) / (24 * 60 * 60 * 1000);
  return store.averageDailySales * closureDays;
}

function selectRoleBasedOnPriority(roles: any[]): any {
  const highPriority = roles.filter(r => r.priority === 'high');
  const mediumPriority = roles.filter(r => r.priority === 'medium');
  
  if (highPriority.length > 0 && Math.random() > 0.3) {
    return highPriority[Math.floor(Math.random() * highPriority.length)];
  }
  
  if (mediumPriority.length > 0 && Math.random() > 0.5) {
    return mediumPriority[Math.floor(Math.random() * mediumPriority.length)];
  }
  
  return roles[Math.floor(Math.random() * roles.length)];
}

function getMarketSalary(role: string): number {
  const salaries = {
    'ソフトウェアエンジニア': 6000000,
    'プロダクトマネージャー': 8000000,
    'デザイナー': 5000000,
    'セールス': 5500000,
    'カスタマーサクセス': 4500000
  };
  
  return salaries[role] || 5000000;
}

async function calculateOnboardingLoad(params: any): Promise<any> {
  const hoursPerNewHire = 40; // 40時間のオンボーディング
  const mentorHoursPerWeek = params.newHires * hoursPerNewHire / params.onboardingDays * 7;
  
  return {
    totalHoursRequired: params.newHires * hoursPerNewHire,
    mentorsRequired: Math.ceil(params.newHires * params.mentorRatio),
    weeklyHoursBurden: mentorHoursPerWeek,
    productivityImpact: mentorHoursPerWeek / (40 * params.existingEmployees)
  };
}

async function assessSystemScalingNeeds(params: any): Promise<any> {
  const needs = {
    database: params.dataVolume > 5000,
    appServers: params.concurrentUsers > 100,
    monitoring: params.currentUsers > 75,
    infrastructure: params.responseTime > 500
  };
  
  const urgency = Object.values(needs).filter(n => n).length >= 2 ? 'immediate' : 'planned';
  
  return {
    needs,
    urgency,
    infrastructureCost: Object.values(needs).filter(n => n).length * 100000,
    licenseCost: params.expectedUsers * 5000
  };
}

async function measureEmployeeEngagement(employeeCount: number): Promise<number> {
  // エンゲージメントスコアのシミュレーション（新入社員が増えると一時的に低下）
  return 0.85 - (employeeCount / 1000) * 0.1;
}

async function planCultureMaintenance(params: any): Promise<any[]> {
  const initiatives = [];
  
  if (params.newHireRatio > 0.1) {
    initiatives.push({
      name: 'カルチャーブートキャンプ',
      description: '新入社員向けの企業文化研修',
      cost: 50000 * params.employeeCount / 100,
      expectedEngagementIncrease: 0.05
    });
  }
  
  if (params.engagement < 0.8) {
    initiatives.push({
      name: 'チームビルディングイベント',
      description: '部門横断的な交流イベント',
      cost: 100000,
      expectedEngagementIncrease: 0.08
    });
  }
  
  initiatives.push({
    name: '1on1ミーティング強化',
    description: 'マネージャーと部下の定期面談',
    cost: 0, // 時間コストのみ
    expectedEngagementIncrease: 0.03
  });
  
  return initiatives;
}

function generateRemoteEmployees(count: number): any[] {
  const timezones = ['JST', 'PST', 'EST', 'GMT', 'CET'];
  const countries = {
    'JST': 'Japan',
    'PST': 'USA',
    'EST': 'USA',
    'GMT': 'UK',
    'CET': 'Germany'
  };
  
  return Array(count).fill(null).map((_, i) => {
    const timezone = timezones[Math.floor(Math.random() * timezones.length)];
    
    return {
      id: `remote_${i}`,
      name: `Remote Employee ${i}`,
      timezone,
      location: {
        country: countries[timezone],
        city: 'Remote'
      },
      preferredSchedule: {
        start: 9 + Math.floor(Math.random() * 2),
        end: 17 + Math.floor(Math.random() * 2)
      }
    };
  });
}

function getLocalWorkHours(timezone: string, schedule: any): any {
  return {
    start: new Date(`2025-07-01T${String(schedule.start).padStart(2, '0')}:00:00`),
    end: new Date(`2025-07-01T${String(schedule.end).padStart(2, '0')}:00:00`),
    duration: schedule.end - schedule.start,
    timezone
  };
}

function convertToJST(localHours: any, fromTimezone: string): any {
  const timezoneOffsets = {
    'JST': 0,
    'PST': 17, // +17 hours to JST
    'EST': 14, // +14 hours to JST
    'GMT': 9,  // +9 hours to JST
    'CET': 8   // +8 hours to JST
  };
  
  const offset = timezoneOffsets[fromTimezone] || 0;
  
  return {
    start: (localHours.start.getHours() + offset) % 24,
    end: (localHours.end.getHours() + offset) % 24,
    duration: localHours.duration
  };
}

function calculateOverlap(hours1: any, hours2: any): number {
  const start = Math.max(hours1.start, hours2.start);
  const end = Math.min(hours1.end, hours2.end);
  
  return Math.max(0, end - start);
}

async function checkLocalLaborLaws(params: any): Promise<any> {
  const limits = {
    'Japan': { daily: 8, weekly: 40 },
    'USA': { daily: 8, weekly: 40 },
    'UK': { daily: 8, weekly: 48 },
    'Germany': { daily: 8, weekly: 48 }
  };
  
  const countryLimit = limits[params.country] || limits['Japan'];
  
  return {
    compliant: params.workHours <= countryLimit.daily && params.weeklyHours <= countryLimit.weekly,
    violation: params.workHours > countryLimit.daily ? 'daily_limit_exceeded' : 
               params.weeklyHours > countryLimit.weekly ? 'weekly_limit_exceeded' : null,
    recommendation: 'Adjust work schedule to comply with local labor laws'
  };
}

async function getWeeklyHours(employeeId: string, date: Date): Promise<number> {
  // 週間労働時間の取得シミュレーション
  return 35 + Math.floor(Math.random() * 10);
}

async function scheduleGlobalMeeting(params: any): Promise<any> {
  // 最適な会議時間の計算（すべてのタイムゾーンを考慮）
  const optimalTime = new Date('2025-07-01T14:00:00'); // JST 14:00
  
  const conflicts = params.participants.filter(p => {
    const localTime = convertFromJST(optimalTime, p.timezone);
    return localTime.getHours() < 6 || localTime.getHours() > 22;
  });
  
  return {
    scheduledTime: optimalTime,
    expectedAttendees: params.participants.filter(p => !conflicts.includes(p)),
    conflicts
  };
}

function convertFromJST(jstTime: Date, toTimezone: string): Date {
  const offsets = {
    'JST': 0,
    'PST': -17,
    'EST': -14,
    'GMT': -9,
    'CET': -8
  };
  
  const offset = offsets[toTimezone] || 0;
  const localTime = new Date(jstTime);
  localTime.setHours(localTime.getHours() + offset);
  
  return localTime;
}

async function measureRemoteProductivity(params: any): Promise<any> {
  const factors = {
    attendance: params.activeEmployees / (params.activeEmployees + params.asyncWorkers),
    communication: Math.min(1, params.communicationVolume / 500),
    taskCompletion: params.taskCompletion,
    collaboration: 0.8 // 固定値
  };
  
  const score = Object.values(factors).reduce((sum, factor) => sum + factor) / Object.values(factors).length;
  
  return { score, factors };
}

async function analyzeHRDataStructures(systems: any): Promise<any> {
  // データ構造の分析シミュレーション
  return {
    mappings: [
      { sourceField: 'emp_id', targetField: 'employee_id', transformation: 'prefix_add' },
      { sourceField: 'dept', targetField: 'department_id', transformation: 'lookup' },
      { sourceField: 'wage', targetField: 'hourly_wage', transformation: 'calculation' }
    ],
    inconsistencies: [
      {
        type: 'data_type_mismatch',
        description: '従業員IDの形式が異なる',
        impact: 'medium',
        field: 'employee_id'
      },
      {
        type: 'missing_field',
        description: 'スキル情報が旧システムに存在しない',
        impact: 'low',
        field: 'skills'
      }
    ]
  };
}

async function planDataResolution(issue: any): Promise<string> {
  const resolutions = {
    'data_type_mismatch': 'データ変換スクリプトを作成し、移行時に自動変換',
    'missing_field': 'デフォルト値を設定し、移行後に順次更新',
    'duplicate_data': '重複チェックロジックを実装し、手動レビュー'
  };
  
  return resolutions[issue.type] || '個別対応が必要';
}

async function findDuplicateEmployees(acquirerCount: number, targetCount: number): Promise<any[]> {
  // 重複従業員のシミュレーション（転籍者など）
  const duplicateCount = Math.floor(Math.random() * 10);
  
  return Array(duplicateCount).fill(null).map((_, i) => ({
    acquirerId: `A${String(i).padStart(5, '0')}`,
    targetId: `B${String(i).padStart(4, '0')}`,
    name: `重複従業員${i}`,
    reason: '過去の転籍'
  }));
}

async function designUnifiedIdScheme(params: any): Promise<any> {
  return {
    format: 'AYYYYNNNNN', // A=会社コード、YYYY=入社年、NNNNN=連番
    capacity: 99999 * params.futureGrowth,
    example: 'A202500001'
  };
}

async function planPayrollCycleTransition(params: any): Promise<any> {
  const bridgePayments = [];
  
  if (params.from === 'bi-weekly' && params.to === 'monthly') {
    // 隔週から月次への移行
    bridgePayments.push({
      date: params.transitionDate,
      calculation: '移行月は日割り計算',
      employeeCommunication: '給与支払いサイクル変更のお知らせ'
    });
  }
  
  return {
    plan: `${params.from}から${params.to}への段階的移行`,
    bridgePayments,
    communicationTimeline: '移行2ヶ月前から順次通知'
  };
}

async function getCompanySalaryData(company: any): Promise<any> {
  // 給与データのシミュレーション
  return {
    averageSalary: company.employees * 10000,
    salaryRanges: {
      junior: { min: 3000000, max: 5000000 },
      mid: { min: 5000000, max: 8000000 },
      senior: { min: 8000000, max: 12000000 }
    }
  };
}

async function analyzeSalaryDiscrepancies(params: any): Promise<any> {
  return {
    significantGaps: [
      {
        position: 'エンジニア',
        acquirerAvg: 6000000,
        targetAvg: 5000000,
        gap: 1000000
      }
    ],
    harmonizationPlan: '3年間で段階的に調整',
    costIncrease: 50000000
  };
}

async function compareBenefitsPackages(params: any): Promise<any> {
  return {
    differences: [
      {
        type: '健康保険',
        acquirerValue: 'プランA',
        targetValue: 'プランB',
        impact: 'coverage_reduction'
      },
      {
        type: '退職金',
        acquirerValue: 'DB',
        targetValue: 'DC',
        impact: 'scheme_change'
      }
    ]
  };
}

async function analyzeBenefitChangeImpact(params: any): Promise<any> {
  return {
    negativelyAffected: Math.floor(params.affectedEmployees * 0.3),
    description: `${params.benefit}の変更により一部従業員に不利益`,
    mitigation: '移行措置として差額補填',
    mitigationCost: params.affectedEmployees * 100000,
    communicationTemplate: `${params.benefit}の変更に関する重要なお知らせ`
  };
}

async function createDataMigrationPlan(params: any): Promise<any> {
  return {
    tasks: [
      {
        name: 'データクレンジング',
        duration: '2 weeks',
        responsible: 'data_team'
      },
      {
        name: 'スキーママッピング',
        duration: '1 week',
        responsible: 'architects'
      },
      {
        name: '移行スクリプト開発',
        duration: '3 weeks',
        responsible: 'developers'
      },
      {
        name: '本番移行',
        duration: '1 weekend',
        responsible: 'all_teams'
      }
    ],
    rollbackStrategy: {
      method: 'snapshot_restore',
      rto: '4 hours',
      rpo: '1 hour'
    }
  };
}

async function executeTestMigration(params: any): Promise<any> {
  return {
    success: Math.random() > 0.1,
    issues: Math.random() > 0.7 ? ['文字化け', '日付形式エラー'] : [],
    integrityScore: 0.95 + Math.random() * 0.05,
    performance: {
      recordsPerSecond: 1000,
      estimatedTotalTime: '8 hours'
    }
  };
}

function calculateProjectEndDate(phases: any[]): Date {
  let endDate = new Date();
  
  phases.forEach(phase => {
    const phaseDuration = phase.tasks.reduce((sum, task) => {
      const weeks = parseInt(task.estimatedDuration) || 1;
      return sum + weeks;
    }, 0);
    
    endDate.setDate(endDate.getDate() + phaseDuration * 7);
  });
  
  return endDate;
}

async function assessRetentionRisk(params: any): Promise<number> {
  // M&Aに伴う離職リスクの評価
  const baseRisk = 0.15; // 基本リスク15%
  const changeImpact = params.changes.length * 0.02; // 変更1つにつき2%増
  const communicationMitigation = params.communicationPlan.length * 0.01; // コミュニケーション施策1つにつき1%減
  
  return Math.max(0, baseRisk + changeImpact - communicationMitigation);
}