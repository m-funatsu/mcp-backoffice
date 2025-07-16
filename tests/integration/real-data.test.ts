import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '../../src/database.js';
import PayrollCalculator from '../../src/payroll.js';
import { defaultPayrollRules } from '../setup/test-db.js';

describe.skip('Real Database Integration Tests', () => {
  let db: Database;
  let payrollCalculator: PayrollCalculator;
  let employees: any[] = [];

  beforeAll(async () => {
    db = new Database();
    try {
      await db.initializeDatabase();
    } catch (error) {
      // Database might already be initialized, continue
      console.log('Database already initialized, continuing...');
    }
    payrollCalculator = new PayrollCalculator(db as any, defaultPayrollRules);
    
    // Get all employees from the database
    employees = await db.getAllEmployees();
    console.log(`Found ${employees.length} employees in database`);
  });

  describe.skip('Payroll Calculation with Real Data', () => {
    it('should calculate monthly payroll for all employees', async () => {
      const month = '2025-07';
      const results = [];
      
      for (const employee of employees) {
        try {
          const payroll = await payrollCalculator.calculateMonthlyPayroll(employee.id, month);
          results.push({
            employee: employee.name,
            scenario: employee.name.includes('正常') ? 'normal' : 
                     employee.name.includes('残業') ? 'overtime' :
                     employee.name.includes('深夜') ? 'night_shift' :
                     employee.name.includes('違反') ? 'violation' :
                     employee.name.includes('不規則') ? 'irregular' :
                     employee.name.includes('短時間') ? 'part_time' :
                     employee.name.includes('新人') ? 'newcomer' : 'holiday_work',
            payroll
          });
        } catch (error) {
          console.error(`Error calculating payroll for ${employee.name}:`, error);
        }
      }
      
      expect(results.length).toBeGreaterThan(0);
      
      // Verify different scenarios produce different results
      const normalEmployee = results.find(r => r.scenario === 'normal');
      const overtimeEmployee = results.find(r => r.scenario === 'overtime');
      const nightShiftEmployee = results.find(r => r.scenario === 'night_shift');
      const violationEmployee = results.find(r => r.scenario === 'violation');
      
      console.log('📊 Payroll Analysis Results:');
      results.forEach(result => {
        console.log(`\n${result.employee} (${result.scenario}):`, {
          regularHours: result.payroll.regularHours,
          overtimeHours: result.payroll.overtimeHours,
          lateNightHours: result.payroll.lateNightHours,
          holidayHours: result.payroll.holidayHours,
          totalPay: result.payroll.totalPay
        });
      });
      
      // Verify overtime worker has more overtime hours than normal worker
      if (normalEmployee && overtimeEmployee) {
        expect(overtimeEmployee.payroll.overtimeHours).toBeGreaterThan(normalEmployee.payroll.overtimeHours);
        expect(overtimeEmployee.payroll.totalPay).toBeGreaterThan(normalEmployee.payroll.totalPay);
      }
      
      // Verify night shift worker has late night hours
      if (nightShiftEmployee) {
        expect(nightShiftEmployee.payroll.lateNightHours).toBeGreaterThan(0);
      }
      
      // Verify violation worker has excessive overtime
      if (violationEmployee) {
        expect(violationEmployee.payroll.overtimeHours).toBeGreaterThan(defaultPayrollRules.monthlyOvertimeLimit);
      }
    });
  });

  describe.skip('Labor Law Compliance Analysis', () => {
    it('should detect labor law violations in real data', async () => {
      const month = '2025-07';
      const violationReports = [];
      
      for (const employee of employees) {
        try {
          const report = await payrollCalculator.generateAttendanceReport(employee.id, month);
          if (report.violations.length > 0) {
            violationReports.push({
              employee: employee.name,
              violations: report.violations,
              overtimeHours: report.totalOvertimeHours
            });
          }
        } catch (error) {
          console.error(`Error generating report for ${employee.name}:`, error);
        }
      }
      
      console.log('\n⚠️  Labor Law Violations Detected:');
      violationReports.forEach(report => {
        console.log(`\n${report.employee}:`);
        console.log(`  - Overtime hours: ${report.overtimeHours}`);
        console.log(`  - Violations: ${report.violations.length}`);
        report.violations.slice(0, 3).forEach((violation, index) => {
          console.log(`    ${index + 1}. ${violation}`);
        });
        if (report.violations.length > 3) {
          console.log(`    ... and ${report.violations.length - 3} more violations`);
        }
      });
      
      // Verify that violation scenarios are detected
      const violationEmployee = violationReports.find(r => r.employee.includes('違反'));
      expect(violationEmployee).toBeDefined();
      expect(violationEmployee!.violations.length).toBeGreaterThan(0);
      expect(violationEmployee!.overtimeHours).toBeGreaterThan(defaultPayrollRules.monthlyOvertimeLimit);
    });
  });

  describe.skip('Time Record Analysis', () => {
    it('should analyze time records for completeness and accuracy', async () => {
      const month = '2025-07';
      const analysisResults = [];
      
      for (const employee of employees) {
        try {
          const startDate = new Date('2025-07-01');
          const endDate = new Date('2025-07-31');
          const timeRecords = await db.getTimeRecords(employee.id, startDate, endDate);
          
          const analysis = {
            employee: employee.name,
            totalRecords: timeRecords.length,
            completeRecords: timeRecords.filter(r => r.clockOut).length,
            incompleteRecords: timeRecords.filter(r => !r.clockOut).length,
            manualRecords: timeRecords.filter(r => r.recordType === 'manual').length,
            icCardRecords: timeRecords.filter(r => r.recordType === 'ic_card').length,
            averageWorkingHours: 0
          };
          
          const completeRecords = timeRecords.filter(r => r.clockOut);
          if (completeRecords.length > 0) {
            const totalHours = completeRecords.reduce((sum, record) => {
              const workingMinutes = (record.clockOut!.getTime() - record.clockIn.getTime()) / (1000 * 60) - record.breakMinutes;
              return sum + (workingMinutes / 60);
            }, 0);
            analysis.averageWorkingHours = totalHours / completeRecords.length;
          }
          
          analysisResults.push(analysis);
        } catch (error) {
          console.error(`Error analyzing time records for ${employee.name}:`, error);
        }
      }
      
      console.log('\n📈 Time Record Analysis:');
      analysisResults.forEach(analysis => {
        console.log(`\n${analysis.employee}:`);
        console.log(`  - Total records: ${analysis.totalRecords}`);
        console.log(`  - Complete records: ${analysis.completeRecords}`);
        console.log(`  - Incomplete records: ${analysis.incompleteRecords}`);
        console.log(`  - Manual records: ${analysis.manualRecords}`);
        console.log(`  - IC Card records: ${analysis.icCardRecords}`);
        console.log(`  - Average working hours: ${analysis.averageWorkingHours.toFixed(2)}`);
      });
      
      // Verify we have time records for all employees
      expect(analysisResults.length).toBe(employees.length);
      
      // Verify that violation employee has high average working hours
      const violationEmployee = analysisResults.find(r => r.employee.includes('違反'));
      expect(violationEmployee).toBeDefined();
      expect(violationEmployee!.averageWorkingHours).toBeGreaterThan(12);
      
      // Verify that newcomer has some incomplete records
      const newcomerEmployee = analysisResults.find(r => r.employee.includes('新人'));
      expect(newcomerEmployee).toBeDefined();
      expect(newcomerEmployee!.incompleteRecords).toBeGreaterThan(0);
    });
  });

  describe.skip('Payroll Summary Analysis', () => {
    it('should generate comprehensive payroll summary', async () => {
      const month = '2025-07';
      
      try {
        const summary = await payrollCalculator.generatePayrollSummary(month);
        
        console.log('\n💰 Payroll Summary for', month, ':');
        console.log('  - Total employees:', summary.totalEmployees);
        console.log('  - Total regular pay:', summary.totalRegularPay.toLocaleString());
        console.log('  - Total overtime pay:', summary.totalOvertimePay.toLocaleString());
        console.log('  - Total late night pay:', summary.totalLateNightPay.toLocaleString());
        console.log('  - Total holiday pay:', summary.totalHolidayPay.toLocaleString());
        console.log('  - Total pay:', summary.totalPay.toLocaleString());
        console.log('  - Total violations:', summary.violations.length);
        
        // Verify summary calculations
        expect(summary.totalEmployees).toBe(employees.length);
        expect(summary.totalPay).toBeGreaterThan(0);
        expect(summary.totalOvertimePay).toBeGreaterThan(0);
        expect(summary.totalLateNightPay).toBeGreaterThan(0);
        expect(summary.violations.length).toBeGreaterThan(0);
        
        // Verify total pay is sum of all components
        const calculatedTotal = summary.totalRegularPay + summary.totalOvertimePay + summary.totalLateNightPay + summary.totalHolidayPay;
        expect(Math.abs(summary.totalPay - calculatedTotal)).toBeLessThan(1);
        
        console.log('\n⚠️  Summary of Violations:');
        const violationsByEmployee = summary.violations.reduce((acc, violation) => {
          const employee = employees.find(e => e.id === violation.employeeId);
          const employeeName = employee ? employee.name : violation.employeeId;
          if (!acc[employeeName]) {
            acc[employeeName] = 0;
          }
          acc[employeeName]++;
          return acc;
        }, {} as Record<string, number>);
        
        Object.entries(violationsByEmployee).forEach(([name, count]) => {
          console.log(`  - ${name}: ${count} violations`);
        });
        
      } catch (error) {
        console.error('Error generating payroll summary:', error);
        throw error;
      }
    });
  });

  describe.skip('Edge Cases and Error Handling', () => {
    it('should handle employees with no time records', async () => {
      // Create a new employee with no time records
      const newEmployee = await db.addEmployee({
        name: 'テスト従業員',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 2000,
        joinDate: new Date('2025-07-01'),
        isActive: true
      });
      
      const month = '2025-07';
      const payroll = await payrollCalculator.calculateMonthlyPayroll(newEmployee, month);
      
      expect(payroll.regularHours).toBe(0);
      expect(payroll.overtimeHours).toBe(0);
      expect(payroll.lateNightHours).toBe(0);
      expect(payroll.holidayHours).toBe(0);
      expect(payroll.totalPay).toBe(0);
      
      console.log('\n🔍 Edge Case - No Time Records:', payroll);
    });
    
    it('should handle future months with no data', async () => {
      const futureMonth = '2025-12';
      const employee = employees[0];
      
      const payroll = await payrollCalculator.calculateMonthlyPayroll(employee.id, futureMonth);
      
      expect(payroll.regularHours).toBe(0);
      expect(payroll.overtimeHours).toBe(0);
      expect(payroll.totalPay).toBe(0);
      
      console.log('\n🔍 Edge Case - Future Month:', payroll);
    });
  });
});