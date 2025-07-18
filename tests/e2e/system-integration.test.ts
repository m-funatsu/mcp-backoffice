import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IntegratedPayrollEngine } from '../../src/payroll-engine.js';
import { ComplianceEngine } from '../../src/compliance-engine.js';
import { createMockDatabase } from '../setup/test-db.js';
import type { Employee, TimeRecord } from '../../src/types.js';

/**
 * システム統合 E2E テスト
 * 
 * 外部システムとの連携、データフロー、パフォーマンスを検証
 * 実際の本番環境での動作を模倣
 */

describe('E2E: システム統合テスト', () => {
  let payrollEngine: IntegratedPayrollEngine;
  let complianceEngine: ComplianceEngine;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = createMockDatabase();
    payrollEngine = new IntegratedPayrollEngine(mockDb);
    complianceEngine = new ComplianceEngine(mockDb);
  });

  afterEach(async () => {
    // クリーンアップ
  });

  describe('会計システム統合', () => {
    it('freee会計システムとの給与データ連携', async () => {
      // 会計連携用の従業員データ
      const accountingEmployees: Employee[] = [
        {
          id: 'EMP_ACCOUNTING_001',
          name: '経理部長',
          department: '経理部',
          position: '部長',
          hourlyRate: 5000,
          startDate: new Date('2020-04-01'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly',
          bankAccount: {
            bankName: '三菱UFJ銀行',
            branchName: '丸の内支店',
            accountType: 'checking',
            accountNumber: '1234567',
            accountHolderName: '経理部長'
          }
        },
        {
          id: 'EMP_ACCOUNTING_002',
          name: '経理担当',
          department: '経理部',
          position: '主任',
          hourlyRate: 3500,
          startDate: new Date('2021-04-01'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly',
          bankAccount: {
            bankName: 'みずほ銀行',
            branchName: '新宿支店',
            accountType: 'checking',
            accountNumber: '7654321',
            accountHolderName: '経理担当'
          }
        }
      ];

      // 従業員登録
      accountingEmployees.forEach(emp => mockDb.addEmployee(emp));

      // 標準的な勤務記録
      accountingEmployees.forEach(emp => {
        const timeRecords: TimeRecord[] = [];
        for (let day = 1; day <= 22; day++) {
          const date = new Date(`2024-07-${day.toString().padStart(2, '0')}`);
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          
          timeRecords.push({
            id: `TR_ACC_${emp.id}_${day}`,
            employeeId: emp.id,
            date,
            clockIn: new Date(`2024-07-${day.toString().padStart(2, '0')}T09:00:00`),
            clockOut: new Date(`2024-07-${day.toString().padStart(2, '0')}T18:00:00`),
            breakMinutes: 60,
            recordType: 'ic_card'
          });
        }
        mockDb.addTimeRecords(emp.id, timeRecords);
      });

      // 給与計算実行
      const payslips = await Promise.all(
        accountingEmployees.map(emp => payrollEngine.generatePayslip(emp.id, '2024-07'))
      );

      // freee会計システム連携データ形式
      const freeePayrollData = {
        companyId: 'COMPANY_001',
        payrollPeriod: '2024-07',
        employees: payslips.map(payslip => {
          const employee = accountingEmployees.find(e => e.id === payslip.employeeId)!;
          return {
            employeeId: payslip.employeeId,
            name: employee.name,
            department: employee.department,
            bankAccount: employee.bankAccount,
            salary: {
              baseSalary: payslip.baseSalary,
              overtimePay: payslip.overtimePay,
              allowances: payslip.allowances,
              deductions: {
                incomeTax: payslip.taxCalculation.incomeTax,
                residentTax: payslip.taxCalculation.residentTax,
                socialInsurance: payslip.socialInsurance.total
              },
              netPay: payslip.netPay
            }
          };
        }),
        summary: {
          totalEmployees: payslips.length,
          totalBaseSalary: payslips.reduce((sum, p) => sum + p.baseSalary, 0),
          totalDeductions: payslips.reduce((sum, p) => sum + p.totalDeductions, 0),
          totalNetPay: payslips.reduce((sum, p) => sum + p.netPay, 0)
        }
      };

      // 会計仕訳データ生成
      const journalEntries = [
        {
          date: '2024-07-31',
          description: '7月分給与支払',
          entries: [
            {
              account: '給与手当',
              debit: freeePayrollData.summary.totalBaseSalary,
              credit: 0
            },
            {
              account: '預り金（所得税）',
              debit: 0,
              credit: payslips.reduce((sum, p) => sum + p.taxCalculation.incomeTax, 0)
            },
            {
              account: '預り金（住民税）',
              debit: 0,
              credit: payslips.reduce((sum, p) => sum + p.taxCalculation.residentTax, 0)
            },
            {
              account: '預り金（社会保険）',
              debit: 0,
              credit: payslips.reduce((sum, p) => sum + p.socialInsurance.total, 0)
            },
            {
              account: '普通預金',
              debit: 0,
              credit: freeePayrollData.summary.totalNetPay
            }
          ]
        }
      ];

      // 検証
      expect(freeePayrollData.employees).toHaveLength(2);
      expect(freeePayrollData.summary.totalNetPay).toBeGreaterThan(0);
      expect(journalEntries[0].entries).toHaveLength(5);
      
      // 仕訳のバランスチェック
      const totalDebit = journalEntries[0].entries.reduce((sum, e) => sum + e.debit, 0);
      const totalCredit = journalEntries[0].entries.reduce((sum, e) => sum + e.credit, 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 0);

      console.log('freee会計連携データ検証完了');
    });

    it('銀行振込データ生成', async () => {
      // 銀行振込用従業員データ
      const bankTransferEmployees: Employee[] = [];
      
      // 様々な銀行の従業員を作成
      const banks = [
        { name: '三菱UFJ銀行', branch: '本店', code: '0005' },
        { name: 'みずほ銀行', branch: '新宿支店', code: '0001' },
        { name: '三井住友銀行', branch: '渋谷支店', code: '0009' },
        { name: 'りそな銀行', branch: '大阪支店', code: '0010' }
      ];

      banks.forEach((bank, index) => {
        bankTransferEmployees.push({
          id: `EMP_BANK_${index + 1}`,
          name: `銀行振込${index + 1}`,
          department: '総務部',
          position: 'スタッフ',
          hourlyRate: 2500,
          startDate: new Date('2023-04-01'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly',
          bankAccount: {
            bankName: bank.name,
            branchName: bank.branch,
            accountType: 'checking',
            accountNumber: `${1000000 + index}`,
            accountHolderName: `銀行振込${index + 1}`
          }
        });
      });

      // 従業員登録
      bankTransferEmployees.forEach(emp => mockDb.addEmployee(emp));

      // 勤怠データ作成
      bankTransferEmployees.forEach(emp => {
        const timeRecords: TimeRecord[] = [{
          id: `TR_BANK_${emp.id}`,
          employeeId: emp.id,
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        }];
        mockDb.addTimeRecords(emp.id, timeRecords);
      });

      // 給与計算
      const payslips = await Promise.all(
        bankTransferEmployees.map(emp => payrollEngine.generatePayslip(emp.id, '2024-07'))
      );

      // 銀行振込データ（全銀協フォーマット）
      const bankTransferData = {
        header: {
          dataType: '21', // 給与振込
          serviceCode: '1234',
          companyCode: 'COMPANY001',
          companyName: 'テスト会社',
          transferDate: '20240731',
          sequenceNumber: '001'
        },
        transfers: bankTransferEmployees.map((emp, index) => {
          const payslip = payslips[index];
          return {
            recordType: '2',
            bankCode: ['0005', '0001', '0009', '0010'][index],
            bankName: emp.bankAccount!.bankName,
            branchCode: '001',
            branchName: emp.bankAccount!.branchName,
            accountType: '1', // 普通預金
            accountNumber: emp.bankAccount!.accountNumber.padStart(7, '0'),
            accountHolder: emp.bankAccount!.accountHolderName,
            transferAmount: payslip.netPay,
            clientCode: emp.id
          };
        }),
        trailer: {
          recordType: '8',
          totalCount: bankTransferEmployees.length,
          totalAmount: payslips.reduce((sum, p) => sum + p.netPay, 0)
        }
      };

      // 銀行別集計
      const bankSummary = new Map<string, { count: number, amount: number }>();
      bankTransferData.transfers.forEach(transfer => {
        const current = bankSummary.get(transfer.bankName) || { count: 0, amount: 0 };
        bankSummary.set(transfer.bankName, {
          count: current.count + 1,
          amount: current.amount + transfer.transferAmount
        });
      });

      // 検証
      expect(bankTransferData.transfers).toHaveLength(4);
      expect(bankTransferData.trailer.totalAmount).toBeGreaterThan(0);
      expect(bankSummary.size).toBe(4);

      // 全銀協フォーマットの妥当性チェック
      bankTransferData.transfers.forEach(transfer => {
        expect(transfer.bankCode).toMatch(/^\d{4}$/);
        expect(transfer.accountNumber).toMatch(/^\d{7}$/);
        expect(transfer.transferAmount).toBeGreaterThan(0);
      });

      console.log('銀行振込データ生成完了');
    });
  });

  describe('人事システム統合', () => {
    it('人事マスタとの従業員情報同期', async () => {
      // 人事システムからの従業員データ（模擬）
      const hrMasterData = [
        {
          employeeId: 'EMP_HR_001',
          personalInfo: {
            name: '人事太郎',
            nameKana: 'ジンジタロウ',
            birthDate: '1985-04-01',
            gender: 'male',
            address: '東京都渋谷区...',
            phone: '03-1234-5678',
            email: 'hr.taro@company.com'
          },
          employment: {
            hireDate: '2020-04-01',
            department: '人事部',
            position: '人事担当',
            employmentType: 'full_time',
            contractType: 'permanent'
          },
          compensation: {
            baseSalary: 350000,
            hourlyRate: 2187,
            grade: 'G3',
            payrollCategory: 'monthly'
          },
          benefits: {
            healthInsurance: true,
            pensionInsurance: true,
            unemploymentInsurance: true,
            workersCompensation: true,
            commutingAllowance: 15000
          }
        },
        {
          employeeId: 'EMP_HR_002',
          personalInfo: {
            name: '人事花子',
            nameKana: 'ジンジハナコ',
            birthDate: '1990-07-15',
            gender: 'female',
            address: '神奈川県横浜市...',
            phone: '045-9876-5432',
            email: 'hr.hanako@company.com'
          },
          employment: {
            hireDate: '2022-04-01',
            department: '人事部',
            position: '人事アシスタント',
            employmentType: 'full_time',
            contractType: 'permanent'
          },
          compensation: {
            baseSalary: 280000,
            hourlyRate: 1750,
            grade: 'G2',
            payrollCategory: 'monthly'
          },
          benefits: {
            healthInsurance: true,
            pensionInsurance: true,
            unemploymentInsurance: true,
            workersCompensation: true,
            commutingAllowance: 12000
          }
        }
      ];

      // 人事マスタデータから従業員オブジェクトを作成
      const employees: Employee[] = hrMasterData.map(hr => ({
        id: hr.employeeId,
        name: hr.personalInfo.name,
        department: hr.employment.department,
        position: hr.employment.position,
        hourlyRate: hr.compensation.hourlyRate,
        startDate: new Date(hr.employment.hireDate),
        birthDate: new Date(hr.personalInfo.birthDate),
        isActive: true,
        contractType: hr.employment.employmentType as 'full_time',
        salaryType: 'hourly',
        allowances: [
          {
            type: 'commuting',
            description: '通勤手当',
            amount: hr.benefits.commutingAllowance,
            isFixed: true,
            effectiveFrom: new Date(hr.employment.hireDate)
          }
        ]
      }));

      // 従業員登録
      employees.forEach(emp => mockDb.addEmployee(emp));

      // 勤怠データ作成
      employees.forEach(emp => {
        const timeRecords: TimeRecord[] = [{
          id: `TR_HR_${emp.id}`,
          employeeId: emp.id,
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        }];
        mockDb.addTimeRecords(emp.id, timeRecords);
      });

      // 給与計算
      const payslips = await Promise.all(
        employees.map(emp => payrollEngine.generatePayslip(emp.id, '2024-07'))
      );

      // 人事システムへのフィードバックデータ
      const hrFeedback = {
        period: '2024-07',
        employees: payslips.map(payslip => {
          const employee = employees.find(e => e.id === payslip.employeeId)!;
          const hrData = hrMasterData.find(hr => hr.employeeId === payslip.employeeId)!;
          
          return {
            employeeId: payslip.employeeId,
            name: employee.name,
            department: employee.department,
            grade: hrData.compensation.grade,
            attendance: {
              workingDays: payslip.workingSummary.totalWorkingDays,
              workingHours: payslip.workingSummary.regularHours,
              overtimeHours: payslip.workingSummary.overtimeHours
            },
            payroll: {
              baseSalary: payslip.baseSalary,
              allowances: payslip.allowances,
              deductions: payslip.totalDeductions,
              netPay: payslip.netPay
            },
            performance: {
              punctuality: 100, // 模擬データ
              attendanceRate: 100,
              overtimeRate: payslip.workingSummary.overtimeHours / payslip.workingSummary.regularHours * 100
            }
          };
        })
      };

      // 人事評価データとの統合
      const performanceReview = hrFeedback.employees.map(emp => ({
        employeeId: emp.employeeId,
        quarter: '2024-Q2',
        metrics: {
          attendance: emp.performance.attendanceRate >= 95 ? 'excellent' : 'good',
          punctuality: emp.performance.punctuality >= 95 ? 'excellent' : 'good',
          workLifeBalance: emp.performance.overtimeRate <= 25 ? 'excellent' : 'needs_improvement'
        },
        recommendation: 
          emp.performance.attendanceRate >= 95 && 
          emp.performance.punctuality >= 95 && 
          emp.performance.overtimeRate <= 25 ? 'promotion_candidate' : 'standard'
      }));

      // 検証
      expect(hrFeedback.employees).toHaveLength(2);
      expect(performanceReview).toHaveLength(2);
      
      hrFeedback.employees.forEach(emp => {
        expect(emp.attendance.workingDays).toBeGreaterThan(0);
        expect(emp.payroll.netPay).toBeGreaterThan(0);
      });

      performanceReview.forEach(review => {
        expect(review.metrics.attendance).toMatch(/^(excellent|good|needs_improvement)$/);
        expect(review.recommendation).toMatch(/^(promotion_candidate|standard|needs_improvement)$/);
      });

      console.log('人事システム統合データ同期完了');
    });
  });

  describe('外部API統合', () => {
    it('税務システムとの連携', async () => {
      // 税務計算用従業員データ
      const taxEmployees: Employee[] = [
        {
          id: 'EMP_TAX_001',
          name: '高所得者',
          department: '役員',
          position: '取締役',
          hourlyRate: 8000,
          startDate: new Date('2018-04-01'),
          birthDate: new Date('1970-01-01'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly',
          taxInfo: {
            dependents: 3,
            taxRate: 0.33, // 高税率
            isDisabled: false,
            isSingleParent: false,
            hasSpouseDeduction: true
          }
        },
        {
          id: 'EMP_TAX_002',
          name: '一般社員',
          department: '営業部',
          position: '営業',
          hourlyRate: 2500,
          startDate: new Date('2021-04-01'),
          birthDate: new Date('1985-05-15'),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly',
          taxInfo: {
            dependents: 0,
            taxRate: 0.10,
            isDisabled: false,
            isSingleParent: false,
            hasSpouseDeduction: false
          }
        }
      ];

      // 従業員登録
      taxEmployees.forEach(emp => mockDb.addEmployee(emp));

      // 勤怠データ作成
      taxEmployees.forEach(emp => {
        const timeRecords: TimeRecord[] = [{
          id: `TR_TAX_${emp.id}`,
          employeeId: emp.id,
          date: new Date('2024-07-01'),
          clockIn: new Date('2024-07-01T09:00:00'),
          clockOut: new Date('2024-07-01T18:00:00'),
          breakMinutes: 60,
          recordType: 'ic_card'
        }];
        mockDb.addTimeRecords(emp.id, timeRecords);
      });

      // 給与計算
      const payslips = await Promise.all(
        taxEmployees.map(emp => payrollEngine.generatePayslip(emp.id, '2024-07'))
      );

      // 税務システム連携データ
      const taxSystemData = {
        companyTaxId: 'T1234567890123',
        period: '2024-07',
        employees: payslips.map(payslip => {
          const employee = taxEmployees.find(e => e.id === payslip.employeeId)!;
          return {
            employeeId: payslip.employeeId,
            name: employee.name,
            taxInfo: employee.taxInfo,
            income: {
              salary: payslip.baseSalary,
              overtime: payslip.overtimePay,
              allowances: payslip.allowances.reduce((sum, a) => sum + a.amount, 0),
              totalIncome: payslip.totalPay
            },
            deductions: {
              incomeTax: payslip.taxCalculation.incomeTax,
              residentTax: payslip.taxCalculation.residentTax,
              socialInsurance: payslip.socialInsurance.total,
              totalDeductions: payslip.totalDeductions
            },
            taxCalculation: {
              taxableIncome: payslip.totalPay - payslip.socialInsurance.total,
              dependentDeductions: employee.taxInfo?.dependents || 0,
              spouseDeduction: employee.taxInfo?.hasSpouseDeduction || false,
              effectiveTaxRate: payslip.taxCalculation.incomeTax / payslip.totalPay
            }
          };
        }),
        summary: {
          totalEmployees: payslips.length,
          totalIncome: payslips.reduce((sum, p) => sum + p.totalPay, 0),
          totalTaxWithheld: payslips.reduce((sum, p) => sum + p.taxCalculation.incomeTax, 0),
          totalSocialInsurance: payslips.reduce((sum, p) => sum + p.socialInsurance.total, 0)
        }
      };

      // 源泉徴収データ生成
      const withholdingData = taxSystemData.employees.map(emp => ({
        employeeId: emp.employeeId,
        name: emp.name,
        period: '2024-07',
        withholdingTax: emp.deductions.incomeTax,
        socialInsurance: emp.deductions.socialInsurance,
        totalWithheld: emp.deductions.incomeTax + emp.deductions.socialInsurance,
        netPayment: emp.income.totalIncome - emp.deductions.totalDeductions,
        taxBracket: emp.taxCalculation.effectiveTaxRate > 0.2 ? 'high' : 'standard'
      }));

      // 検証
      expect(taxSystemData.employees).toHaveLength(2);
      expect(taxSystemData.summary.totalTaxWithheld).toBeGreaterThan(0);
      expect(withholdingData).toHaveLength(2);

      // 高所得者の税率確認
      const highIncomeEmployee = taxSystemData.employees.find(e => e.employeeId === 'EMP_TAX_001')!;
      const standardEmployee = taxSystemData.employees.find(e => e.employeeId === 'EMP_TAX_002')!;
      
      expect(highIncomeEmployee.taxCalculation.effectiveTaxRate).toBeGreaterThan(
        standardEmployee.taxCalculation.effectiveTaxRate
      );

      console.log('税務システム連携データ生成完了');
    });
  });

  describe('レポーティング統合', () => {
    it('経営ダッシュボード用データ集計', async () => {
      // 経営ダッシュボード用の多様な従業員データ
      const dashboardEmployees: Employee[] = [];
      
      // 部署別従業員作成
      const departments = [
        { name: '開発部', count: 15, avgRate: 3500 },
        { name: '営業部', count: 10, avgRate: 3000 },
        { name: '経理部', count: 5, avgRate: 2800 },
        { name: '人事部', count: 8, avgRate: 3200 },
        { name: '総務部', count: 7, avgRate: 2600 }
      ];

      let employeeCounter = 1;
      departments.forEach(dept => {
        for (let i = 0; i < dept.count; i++) {
          dashboardEmployees.push({
            id: `EMP_DASH_${employeeCounter.toString().padStart(3, '0')}`,
            name: `${dept.name}社員${i + 1}`,
            department: dept.name,
            position: i === 0 ? '管理職' : 'スタッフ',
            hourlyRate: dept.avgRate + (Math.random() - 0.5) * 1000,
            startDate: new Date('2022-04-01'),
            birthDate: new Date(1980 + Math.floor(Math.random() * 20), 4, 1),
            isActive: true,
            contractType: 'full_time',
            salaryType: 'hourly'
          });
          employeeCounter++;
        }
      });

      // 従業員登録
      dashboardEmployees.forEach(emp => mockDb.addEmployee(emp));

      // 勤怠データ作成（部署による残業パターンの差異）
      dashboardEmployees.forEach(emp => {
        const timeRecords: TimeRecord[] = [];
        const overtimePattern = emp.department === '開発部' ? 2 : 
                               emp.department === '営業部' ? 1.5 : 1;
        
        for (let day = 1; day <= 22; day++) {
          const date = new Date(`2024-07-${day.toString().padStart(2, '0')}`);
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          
          const baseEndTime = 18;
          const overtime = Math.random() < 0.7 ? overtimePattern : 0;
          
          timeRecords.push({
            id: `TR_DASH_${emp.id}_${day}`,
            employeeId: emp.id,
            date,
            clockIn: new Date(`2024-07-${day.toString().padStart(2, '0')}T09:00:00`),
            clockOut: new Date(`2024-07-${day.toString().padStart(2, '0')}T${baseEndTime + overtime}:00:00`),
            breakMinutes: 60,
            recordType: 'ic_card'
          });
        }
        mockDb.addTimeRecords(emp.id, timeRecords);
      });

      // 全従業員の給与計算
      const startTime = Date.now();
      const payslips = await Promise.all(
        dashboardEmployees.map(emp => payrollEngine.generatePayslip(emp.id, '2024-07'))
      );
      const processingTime = Date.now() - startTime;

      // 経営ダッシュボードデータ集計
      const dashboardData = {
        company: {
          name: 'テスト会社',
          period: '2024-07',
          processingTime: processingTime,
          lastUpdated: new Date().toISOString()
        },
        overview: {
          totalEmployees: dashboardEmployees.length,
          totalPayroll: payslips.reduce((sum, p) => sum + p.totalPay, 0),
          totalNetPay: payslips.reduce((sum, p) => sum + p.netPay, 0),
          totalTaxes: payslips.reduce((sum, p) => sum + p.taxCalculation.incomeTax + p.taxCalculation.residentTax, 0),
          totalSocialInsurance: payslips.reduce((sum, p) => sum + p.socialInsurance.total, 0),
          averageSalary: payslips.reduce((sum, p) => sum + p.totalPay, 0) / payslips.length
        },
        departments: departments.map(dept => {
          const deptPayslips = payslips.filter(p => 
            dashboardEmployees.find(e => e.id === p.employeeId)?.department === dept.name
          );
          
          return {
            name: dept.name,
            employeeCount: deptPayslips.length,
            totalPayroll: deptPayslips.reduce((sum, p) => sum + p.totalPay, 0),
            averageSalary: deptPayslips.reduce((sum, p) => sum + p.totalPay, 0) / deptPayslips.length,
            totalOvertimeHours: deptPayslips.reduce((sum, p) => sum + p.workingSummary.overtimeHours, 0),
            averageOvertimeHours: deptPayslips.reduce((sum, p) => sum + p.workingSummary.overtimeHours, 0) / deptPayslips.length
          };
        }),
        trends: {
          payrollGrowth: 0, // 前月比（実装による）
          headcountGrowth: 0, // 前月比（実装による）
          overtimeTrend: 'stable', // 残業トレンド（実装による）
          costPerEmployee: payslips.reduce((sum, p) => sum + p.totalPay, 0) / dashboardEmployees.length
        },
        compliance: {
          overtimeCompliance: payslips.filter(p => p.workingSummary.overtimeHours <= 45).length / payslips.length,
          payrollAccuracy: 99.9, // 実装による
          onTimeProcessing: processingTime < 30000 ? 'excellent' : 'needs_improvement'
        }
      };

      // KPIメトリクス
      const kpiMetrics = {
        financial: {
          totalLaborCost: dashboardData.overview.totalPayroll,
          laborCostRatio: dashboardData.overview.totalPayroll / 50000000, // 仮の売上高
          costPerEmployee: dashboardData.trends.costPerEmployee,
          payrollEfficiency: dashboardData.overview.totalNetPay / dashboardData.overview.totalPayroll
        },
        operational: {
          payrollProcessingTime: processingTime,
          dataAccuracy: dashboardData.compliance.payrollAccuracy,
          complianceRate: dashboardData.compliance.overtimeCompliance,
          systemUptime: 99.9
        },
        workforce: {
          totalHeadcount: dashboardData.overview.totalEmployees,
          departmentDistribution: dashboardData.departments.map(d => ({
            department: d.name,
            percentage: d.employeeCount / dashboardData.overview.totalEmployees * 100
          })),
          averageWorkingHours: payslips.reduce((sum, p) => sum + p.workingSummary.regularHours, 0) / payslips.length,
          overtimeUtilization: dashboardData.compliance.overtimeCompliance
        }
      };

      // 検証
      expect(dashboardData.overview.totalEmployees).toBe(45);
      expect(dashboardData.overview.totalPayroll).toBeGreaterThan(0);
      expect(dashboardData.departments).toHaveLength(5);
      expect(processingTime).toBeLessThan(30000); // 30秒以内

      // 部署別データの検証
      dashboardData.departments.forEach(dept => {
        expect(dept.employeeCount).toBeGreaterThan(0);
        expect(dept.totalPayroll).toBeGreaterThan(0);
        expect(dept.averageSalary).toBeGreaterThan(0);
      });

      // KPIの検証
      expect(kpiMetrics.financial.totalLaborCost).toBeGreaterThan(0);
      expect(kpiMetrics.operational.payrollProcessingTime).toBeLessThan(30000);
      expect(kpiMetrics.workforce.totalHeadcount).toBe(45);

      console.log(`経営ダッシュボードデータ生成完了: ${dashboardEmployees.length}名の処理時間 ${processingTime}ms`);
    });
  });

  describe('パフォーマンス統合テスト', () => {
    it('大量データでの統合処理性能', async () => {
      // 大量データ処理用の従業員作成
      const performanceEmployees: Employee[] = [];
      
      for (let i = 1; i <= 200; i++) {
        performanceEmployees.push({
          id: `EMP_PERF_${i.toString().padStart(3, '0')}`,
          name: `パフォーマンステスト${i}`,
          department: `部署${i % 10}`,
          position: 'スタッフ',
          hourlyRate: 2000 + (i % 2000),
          startDate: new Date('2023-04-01'),
          birthDate: new Date(1980 + (i % 20), 4, 1),
          isActive: true,
          contractType: 'full_time',
          salaryType: 'hourly'
        });
      }

      // 従業員登録
      const employeeRegistrationStart = Date.now();
      performanceEmployees.forEach(emp => mockDb.addEmployee(emp));
      const employeeRegistrationTime = Date.now() - employeeRegistrationStart;

      // 勤怠データ作成
      const timeRecordCreationStart = Date.now();
      performanceEmployees.forEach(emp => {
        const timeRecords: TimeRecord[] = [];
        for (let day = 1; day <= 22; day++) {
          const date = new Date(`2024-07-${day.toString().padStart(2, '0')}`);
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          
          timeRecords.push({
            id: `TR_PERF_${emp.id}_${day}`,
            employeeId: emp.id,
            date,
            clockIn: new Date(`2024-07-${day.toString().padStart(2, '0')}T09:00:00`),
            clockOut: new Date(`2024-07-${day.toString().padStart(2, '0')}T18:00:00`),
            breakMinutes: 60,
            recordType: 'ic_card'
          });
        }
        mockDb.addTimeRecords(emp.id, timeRecords);
      });
      const timeRecordCreationTime = Date.now() - timeRecordCreationStart;

      // 給与計算処理
      const payrollProcessingStart = Date.now();
      const payslips = await Promise.all(
        performanceEmployees.slice(0, 50).map(emp => // 最初の50名のみ処理
          payrollEngine.generatePayslip(emp.id, '2024-07')
        )
      );
      const payrollProcessingTime = Date.now() - payrollProcessingStart;

      // パフォーマンスメトリクス
      const performanceMetrics = {
        dataVolume: {
          employees: performanceEmployees.length,
          timeRecords: performanceEmployees.length * 22,
          payslips: payslips.length
        },
        processingTime: {
          employeeRegistration: employeeRegistrationTime,
          timeRecordCreation: timeRecordCreationTime,
          payrollProcessing: payrollProcessingTime,
          total: employeeRegistrationTime + timeRecordCreationTime + payrollProcessingTime
        },
        throughput: {
          employeesPerSecond: performanceEmployees.length / (employeeRegistrationTime / 1000),
          timeRecordsPerSecond: (performanceEmployees.length * 22) / (timeRecordCreationTime / 1000),
          payslipsPerSecond: payslips.length / (payrollProcessingTime / 1000)
        },
        accuracy: {
          processedEmployees: payslips.length,
          successRate: payslips.filter(p => p.netPay > 0).length / payslips.length,
          averageProcessingTime: payrollProcessingTime / payslips.length
        }
      };

      // パフォーマンス検証
      expect(performanceMetrics.dataVolume.employees).toBe(200);
      expect(performanceMetrics.dataVolume.payslips).toBe(50);
      expect(performanceMetrics.processingTime.total).toBeLessThan(60000); // 60秒以内
      expect(performanceMetrics.accuracy.successRate).toBeGreaterThan(0.99); // 99%以上成功
      expect(performanceMetrics.throughput.payslipsPerSecond).toBeGreaterThan(1); // 1件/秒以上

      payslips.forEach(payslip => {
        expect(payslip.netPay).toBeGreaterThan(0);
        expect(payslip.totalPay).toBeGreaterThan(0);
      });

      console.log(`パフォーマンステスト完了:`);
      console.log(`- 従業員登録: ${performanceMetrics.dataVolume.employees}名 (${employeeRegistrationTime}ms)`);
      console.log(`- 勤怠データ: ${performanceMetrics.dataVolume.timeRecords}件 (${timeRecordCreationTime}ms)`);
      console.log(`- 給与計算: ${performanceMetrics.dataVolume.payslips}件 (${payrollProcessingTime}ms)`);
      console.log(`- 処理効率: ${performanceMetrics.throughput.payslipsPerSecond.toFixed(2)}件/秒`);
    });
  });
});