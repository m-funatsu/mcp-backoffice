/**
 * Unit Tests for Human Capital Disclosure Engine v2.0.0
 * 人的資本開示エンジン v2.0.0 単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from '../../src/database.js';
import { EmployeeLifecycleManagement } from '../../src/hr-lifecycle-management-v1.5.0.js';
import { TalentManagementSystem } from '../../src/talent-management-system-v1.5.0.js';
import { LearningTrainingManagement } from '../../src/learning-training-management-v1.5.0.js';
import { HumanCapitalDisclosureEngine } from '../../src/human-capital-disclosure-engine-v2.0.0.js';
import type { Employee } from '../../src/types.js';

// Mock dependencies
vi.mock('../../src/database.js');
vi.mock('../../src/hr-lifecycle-management-v1.5.0.js');
vi.mock('../../src/talent-management-system-v1.5.0.js');
vi.mock('../../src/learning-training-management-v1.5.0.js');

describe('HumanCapitalDisclosureEngine', () => {
  let engine: HumanCapitalDisclosureEngine;
  let mockDb: any;
  let mockLifecycleManagement: any;
  let mockTalentManagement: any;
  let mockLearningManagement: any;

  const mockEmployees: Employee[] = [
    {
      id: 'EMP001',
      name: '田中太郎',
      department: 'Engineering',
      position: 'Senior Engineer',
      hourlyRate: 3000,
      startDate: new Date('2020-04-01'),
      isActive: true,
      baseSalary: 6000000,
      contractType: 'full_time',
      salaryType: 'annual'
    },
    {
      id: 'EMP002',
      name: '佐藤花子',
      department: 'Marketing',
      position: 'Marketing Manager',
      hourlyRate: 2500,
      startDate: new Date('2019-10-15'),
      isActive: true,
      baseSalary: 5000000,
      contractType: 'full_time',
      salaryType: 'annual'
    },
    {
      id: 'EMP003',
      name: '山田次郎',
      department: 'Sales',
      position: 'Sales Representative',
      hourlyRate: 2000,
      startDate: new Date('2021-07-01'),
      isActive: true,
      baseSalary: 4000000,
      contractType: 'full_time',
      salaryType: 'annual'
    },
    {
      id: 'EMP004',
      name: 'Johnson Michael',
      department: 'Engineering',
      position: 'Tech Lead',
      hourlyRate: 4000,
      startDate: new Date('2018-03-15'),
      isActive: true,
      baseSalary: 8000000,
      contractType: 'full_time',
      salaryType: 'annual'
    },
    {
      id: 'EMP005',
      name: '鈴木美咲',
      department: 'HR',
      position: 'HR Specialist',
      hourlyRate: 2200,
      startDate: new Date('2022-01-10'),
      isActive: false, // Inactive employee
      baseSalary: 4400000,
      contractType: 'full_time',
      salaryType: 'annual'
    }
  ];

  beforeEach(() => {
    mockDb = {
      getAllEmployees: vi.fn(),
      getEmployee: vi.fn(),
      close: vi.fn()
    };
    mockLifecycleManagement = {};
    mockTalentManagement = {};
    mockLearningManagement = {};

    engine = new HumanCapitalDisclosureEngine(
      mockDb,
      mockLifecycleManagement,
      mockTalentManagement,
      mockLearningManagement
    );

    // Setup mock data
    mockDb.getAllEmployees.mockResolvedValue(mockEmployees);
  });

  describe('calculateHumanCapitalMetrics', () => {
    it('should calculate comprehensive human capital metrics', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      expect(metrics).toBeDefined();
      expect(metrics.compliance).toBeDefined();
      expect(metrics.costs).toBeDefined();
      expect(metrics.diversity).toBeDefined();
      expect(metrics.leadership).toBeDefined();
      expect(metrics.culture).toBeDefined();
      expect(metrics.safety).toBeDefined();
      expect(metrics.productivity).toBeDefined();
      expect(metrics.recruitment).toBeDefined();
      expect(metrics.skills).toBeDefined();
      expect(metrics.workforce).toBeDefined();
      expect(metrics.japanese).toBeDefined();
    });

    it('should calculate compliance metrics correctly', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      expect(metrics.compliance.ethicsTrainingCompletionRate).toBeGreaterThan(0);
      expect(metrics.compliance.ethicsTrainingCompletionRate).toBeLessThanOrEqual(100);
      expect(metrics.compliance.complianceRating).toBeGreaterThan(0);
      expect(metrics.compliance.complianceRating).toBeLessThanOrEqual(5);
      expect(metrics.compliance.legalViolations).toBeGreaterThanOrEqual(0);
      expect(metrics.compliance.finesAndPenalties).toBeGreaterThanOrEqual(0);
    });

    it('should calculate cost metrics based on employee data', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      expect(metrics.costs.totalRemunerationCost).toBeGreaterThan(0);
      expect(metrics.costs.remunerationCostPerEmployee).toBeGreaterThan(0);
      expect(metrics.costs.recruitmentCostPerHire).toBeGreaterThan(0);
      expect(metrics.costs.trainingCostPerEmployee).toBeGreaterThan(0);
      expect(typeof metrics.costs.totalRemunerationCost).toBe('number');
    });

    it('should calculate diversity metrics with proper distribution', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      const ageDistribution = metrics.diversity.ageGroupDistribution;
      const totalAgePercentage = ageDistribution.under25 + ageDistribution.age25to34 + 
                                ageDistribution.age35to44 + ageDistribution.age45to54 + 
                                ageDistribution.age55to64 + ageDistribution.over65;

      expect(totalAgePercentage).toBeCloseTo(100, 1);

      const genderDistribution = metrics.diversity.genderDistribution;
      const totalGenderPercentage = genderDistribution.male + genderDistribution.female + 
                                   genderDistribution.other + genderDistribution.preferNotToSay;

      expect(totalGenderPercentage).toBeCloseTo(100, 1);
      expect(metrics.diversity.diversityInclusionScore).toBeGreaterThan(0);
      expect(metrics.diversity.diversityInclusionScore).toBeLessThanOrEqual(5);
    });

    it('should calculate workforce metrics correctly', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      // Active employees should be 4 (EMP005 is inactive)
      expect(metrics.workforce.totalWorkforce).toBe(4);
      expect(metrics.workforce.fullTimeEquivalent).toBeGreaterThan(0);
      expect(metrics.workforce.averageAge).toBeGreaterThan(0);
      expect(metrics.workforce.averageTenure).toBeGreaterThan(0);
      expect(metrics.workforce.capacityUtilization).toBeGreaterThan(0);
      expect(metrics.workforce.capacityUtilization).toBeLessThanOrEqual(100);
    });

    it('should calculate Japanese-specific metrics for compliance', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      expect(metrics.japanese.overtimeComplianceRate).toBeGreaterThan(0);
      expect(metrics.japanese.overtimeComplianceRate).toBeLessThanOrEqual(100);
      expect(metrics.japanese.paidLeaveUtilizationRate).toBeGreaterThan(0);
      expect(metrics.japanese.paidLeaveUtilizationRate).toBeLessThanOrEqual(100);
      expect(metrics.japanese.workStyleReformCompliance).toBeGreaterThan(0);
      expect(metrics.japanese.workStyleReformCompliance).toBeLessThanOrEqual(100);
    });
  });

  describe('generateHumanCapitalReport', () => {
    it('should generate a comprehensive human capital report', async () => {
      const companyName = 'テスト株式会社';
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const report = await engine.generateHumanCapitalReport(companyName, reportingPeriod);

      expect(report.reportId).toBeDefined();
      expect(report.companyName).toBe(companyName);
      expect(report.reportingPeriod).toEqual(reportingPeriod);
      expect(report.reportGeneratedAt).toBeInstanceOf(Date);
      expect(report.metrics).toBeDefined();
      expect(report.benchmarkComparisons).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.riskAssessment).toBeDefined();
      expect(report.compliance).toBeDefined();
      expect(report.executiveSummary).toBeDefined();
    });

    it('should include proper benchmark comparisons', async () => {
      const companyName = 'テスト株式会社';
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const report = await engine.generateHumanCapitalReport(companyName, reportingPeriod);

      expect(report.benchmarkComparisons.industryBenchmarks).toBeDefined();
      expect(report.benchmarkComparisons.regionBenchmarks).toBeDefined();
      expect(report.benchmarkComparisons.sizeBenchmarks).toBeDefined();
      expect(report.benchmarkComparisons.performanceRanking).toBeDefined();

      // Check that benchmark values are reasonable
      expect(report.benchmarkComparisons.industryBenchmarks.turnoverRate).toBeGreaterThan(0);
      expect(report.benchmarkComparisons.industryBenchmarks.turnoverRate).toBeLessThan(100);
    });

    it('should include trend analysis with proper structure', async () => {
      const companyName = 'テスト株式会社';
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const report = await engine.generateHumanCapitalReport(companyName, reportingPeriod);

      expect(report.trends.yearOverYear).toBeDefined();
      expect(report.trends.quarterOverQuarter).toBeDefined();
      expect(report.trends.forecast).toBeDefined();
      expect(report.trends.seasonalPatterns).toBeDefined();

      // Check that trend values are reasonable percentages
      expect(Math.abs(report.trends.yearOverYear.turnoverRate)).toBeLessThan(100);
      expect(Math.abs(report.trends.quarterOverQuarter.turnoverRate)).toBeLessThan(50);
    });

    it('should generate actionable recommendations', async () => {
      const companyName = 'テスト株式会社';
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const report = await engine.generateHumanCapitalReport(companyName, reportingPeriod);

      expect(Array.isArray(report.recommendations)).toBe(true);
      
      report.recommendations.forEach(rec => {
        expect(rec.id).toBeDefined();
        expect(rec.category).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(rec.priority);
        expect(rec.title).toBeDefined();
        expect(rec.description).toBeDefined();
        expect(rec.expectedImpact).toBeDefined();
        expect(rec.implementationCost).toBeGreaterThanOrEqual(0);
        expect(rec.timeToImplement).toBeGreaterThan(0);
        expect(Array.isArray(rec.requiredResources)).toBe(true);
        expect(rec.kpiTarget).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(rec.riskLevel);
      });
    });

    it('should include comprehensive risk assessment', async () => {
      const companyName = 'テスト株式会社';
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const report = await engine.generateHumanCapitalReport(companyName, reportingPeriod);

      expect(report.riskAssessment.overallRiskScore).toBeGreaterThan(0);
      expect(report.riskAssessment.overallRiskScore).toBeLessThanOrEqual(5);
      expect(Array.isArray(report.riskAssessment.riskAreas)).toBe(true);
      expect(Array.isArray(report.riskAssessment.mitigationStrategies)).toBe(true);
      expect(report.riskAssessment.monitoringPlan).toBeDefined();

      report.riskAssessment.riskAreas.forEach(area => {
        expect(area.area).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(area.riskLevel);
        expect(area.description).toBeDefined();
        expect(area.impact).toBeDefined();
        expect(area.probability).toBeGreaterThanOrEqual(0);
        expect(area.probability).toBeLessThanOrEqual(100);
      });
    });

    it('should assess compliance status correctly', async () => {
      const companyName = 'テスト株式会社';
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const report = await engine.generateHumanCapitalReport(companyName, reportingPeriod);

      expect(report.compliance.iso30414Compliance).toBeGreaterThan(0);
      expect(report.compliance.iso30414Compliance).toBeLessThanOrEqual(100);
      expect(report.compliance.japoneseLaborLawCompliance).toBeGreaterThan(0);
      expect(report.compliance.japoneseLaborLawCompliance).toBeLessThanOrEqual(100);
      expect(report.compliance.securitiesLawCompliance).toBeGreaterThan(0);
      expect(report.compliance.securitiesLawCompliance).toBeLessThanOrEqual(100);
      expect(report.compliance.overallComplianceScore).toBeGreaterThan(0);
      expect(report.compliance.overallComplianceScore).toBeLessThanOrEqual(100);
    });
  });

  describe('calculateRealTimeMetrics', () => {
    it('should calculate real-time dashboard metrics', async () => {
      const realTimeData = await engine.calculateRealTimeMetrics();

      expect(realTimeData.keyMetrics).toBeDefined();
      expect(realTimeData.alerts).toBeDefined();
      expect(realTimeData.trends).toBeDefined();
      expect(realTimeData.recommendations).toBeDefined();

      // Check key metrics structure
      expect(realTimeData.keyMetrics['Employee Engagement']).toBeDefined();
      expect(realTimeData.keyMetrics['Turnover Rate']).toBeDefined();
      expect(realTimeData.keyMetrics['Training Completion']).toBeDefined();
      expect(realTimeData.keyMetrics['Diversity Score']).toBeDefined();
      expect(realTimeData.keyMetrics['Productivity Index']).toBeDefined();
      expect(realTimeData.keyMetrics['Safety Score']).toBeDefined();

      // Check that values are in reasonable ranges
      expect(realTimeData.keyMetrics['Employee Engagement']).toBeGreaterThan(0);
      expect(realTimeData.keyMetrics['Employee Engagement']).toBeLessThanOrEqual(5);
      expect(realTimeData.keyMetrics['Turnover Rate']).toBeGreaterThan(0);
      expect(realTimeData.keyMetrics['Turnover Rate']).toBeLessThan(100);
    });

    it('should generate appropriate alerts for concerning metrics', async () => {
      const realTimeData = await engine.calculateRealTimeMetrics();

      expect(Array.isArray(realTimeData.alerts)).toBe(true);
      
      realTimeData.alerts.forEach(alert => {
        expect(typeof alert).toBe('string');
        expect(alert.length).toBeGreaterThan(0);
      });
    });

    it('should provide trend indicators', async () => {
      const realTimeData = await engine.calculateRealTimeMetrics();

      expect(realTimeData.trends).toBeDefined();
      
      Object.values(realTimeData.trends).forEach(trend => {
        expect(['up', 'down', 'stable']).toContain(trend);
      });
    });

    it('should provide actionable recommendations', async () => {
      const realTimeData = await engine.calculateRealTimeMetrics();

      expect(Array.isArray(realTimeData.recommendations)).toBe(true);
      expect(realTimeData.recommendations.length).toBeLessThanOrEqual(5);
      
      realTimeData.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle empty employee data gracefully', async () => {
      mockDb.getAllEmployees.mockResolvedValue([]);

      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);
      
      expect(metrics.workforce.totalWorkforce).toBe(0);
      expect(metrics.costs.totalRemunerationCost).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.getAllEmployees.mockRejectedValue(new Error('Database connection failed'));

      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      await expect(engine.calculateHumanCapitalMetrics(reportingPeriod)).rejects.toThrow('Database connection failed');
    });

    it('should handle invalid date ranges', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01') // End date before start date
      };

      // Should not throw error but handle gracefully
      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);
      expect(metrics).toBeDefined();
    });
  });

  describe('Data Validation', () => {
    it('should validate metric ranges and types', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      // Validate percentage metrics are between 0 and 100
      expect(metrics.compliance.ethicsTrainingCompletionRate).toBeGreaterThanOrEqual(0);
      expect(metrics.compliance.ethicsTrainingCompletionRate).toBeLessThanOrEqual(100);
      expect(metrics.recruitment.turnoverRate).toBeGreaterThanOrEqual(0);
      expect(metrics.recruitment.turnoverRate).toBeLessThan(100);

      // Validate rating metrics are between 1 and 5
      expect(metrics.compliance.complianceRating).toBeGreaterThanOrEqual(1);
      expect(metrics.compliance.complianceRating).toBeLessThanOrEqual(5);
      expect(metrics.culture.employeeEngagementScore).toBeGreaterThanOrEqual(1);
      expect(metrics.culture.employeeEngagementScore).toBeLessThanOrEqual(5);

      // Validate count metrics are non-negative
      expect(metrics.compliance.legalViolations).toBeGreaterThanOrEqual(0);
      expect(metrics.compliance.finesAndPenalties).toBeGreaterThanOrEqual(0);
      expect(metrics.workforce.totalWorkforce).toBeGreaterThanOrEqual(0);
    });

    it('should ensure cost metrics are reasonable', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      // All cost metrics should be non-negative
      expect(metrics.costs.totalRemunerationCost).toBeGreaterThanOrEqual(0);
      expect(metrics.costs.totalRecruitmentCost).toBeGreaterThanOrEqual(0);
      expect(metrics.costs.totalTrainingCost).toBeGreaterThanOrEqual(0);
      expect(metrics.costs.remunerationCostPerEmployee).toBeGreaterThanOrEqual(0);
      expect(metrics.costs.recruitmentCostPerHire).toBeGreaterThanOrEqual(0);
      expect(metrics.costs.trainingCostPerEmployee).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance Tests', () => {
    it('should complete metrics calculation within reasonable time', async () => {
      const startTime = Date.now();
      
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      await engine.calculateHumanCapitalMetrics(reportingPeriod);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within 5 seconds
      expect(executionTime).toBeLessThan(5000);
    });

    it('should handle large employee datasets efficiently', async () => {
      // Create larger mock dataset
      const largeEmployeeDataset: Employee[] = [];
      for (let i = 0; i < 1000; i++) {
        largeEmployeeDataset.push({
          id: `EMP${i.toString().padStart(4, '0')}`,
          name: `Employee ${i}`,
          department: ['Engineering', 'Marketing', 'Sales', 'HR'][i % 4],
          position: 'Employee',
          hourlyRate: 2000 + Math.floor(Math.random() * 2000),
          joinDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          isActive: Math.random() > 0.1, // 90% active
          baseSalary: 4000000 + Math.floor(Math.random() * 4000000),
          contractType: 'full_time',
          salaryType: 'annual'
        });
      }

      mockDb.getAllEmployees.mockResolvedValue(largeEmployeeDataset);

      const startTime = Date.now();
      
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within 10 seconds even with large dataset
      expect(executionTime).toBeLessThan(10000);
      expect(metrics.workforce.totalWorkforce).toBeGreaterThan(800); // About 90% of 1000
    });
  });
});