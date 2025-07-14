/**
 * Simplified Unit Tests for Human Capital Disclosure Engine v2.0.0
 * 人的資本開示エンジン v2.0.0 簡易単体テスト
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Database from '../../src/database.js';
import { EmployeeLifecycleManagement } from '../../src/hr-lifecycle-management-v1.5.0.js';
import { TalentManagementSystem } from '../../src/talent-management-system-v1.5.0.js';
import { LearningTrainingManagement } from '../../src/learning-training-management-v1.5.0.js';
import { HumanCapitalDisclosureEngine } from '../../src/human-capital-disclosure-engine-v2.0.0.js';
import type { Employee } from '../../src/types.js';

describe('HumanCapitalDisclosureEngine - Basic Tests', () => {
  let engine: HumanCapitalDisclosureEngine;
  let db: Database;
  let lifecycleManagement: EmployeeLifecycleManagement;
  let talentManagement: TalentManagementSystem;
  let learningManagement: LearningTrainingManagement;

  beforeEach(async () => {
    db = new Database(':memory:');
    await db.initializeDatabase();
    
    lifecycleManagement = new EmployeeLifecycleManagement(db);
    talentManagement = new TalentManagementSystem(db);
    learningManagement = new LearningTrainingManagement(db);
    
    engine = new HumanCapitalDisclosureEngine(
      db,
      lifecycleManagement,
      talentManagement,
      learningManagement
    );

    // Add some test employees
    await addTestEmployees(db);
  });

  describe('calculateHumanCapitalMetrics', () => {
    it('should calculate metrics for empty employee list', async () => {
      // Start with empty database
      const emptyDb = new Database(':memory:');
      await emptyDb.initializeDatabase();
      
      const emptyEngine = new HumanCapitalDisclosureEngine(
        emptyDb,
        new EmployeeLifecycleManagement(emptyDb),
        new TalentManagementSystem(emptyDb),
        new LearningTrainingManagement(emptyDb)
      );

      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await emptyEngine.calculateHumanCapitalMetrics(reportingPeriod);

      expect(metrics).toBeDefined();
      expect(metrics.workforce.totalWorkforce).toBe(0);
      expect(metrics.costs.totalRemunerationCost).toBe(0);
      expect(metrics.compliance).toBeDefined();
      expect(metrics.diversity).toBeDefined();
      expect(metrics.leadership).toBeDefined();
      expect(metrics.culture).toBeDefined();
      expect(metrics.safety).toBeDefined();
      expect(metrics.productivity).toBeDefined();
      expect(metrics.recruitment).toBeDefined();
      expect(metrics.skills).toBeDefined();
      expect(metrics.japanese).toBeDefined();
      
      await emptyDb.close();
    });

    it('should calculate metrics with test employees', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      expect(metrics).toBeDefined();
      expect(metrics.workforce.totalWorkforce).toBeGreaterThan(0);
      expect(metrics.costs.totalRemunerationCost).toBeGreaterThan(0);
      
      // Check that all metric categories are present
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

    it('should validate metric value ranges', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      // Check percentage values are in valid range
      expect(metrics.compliance.ethicsTrainingCompletionRate).toBeGreaterThanOrEqual(0);
      expect(metrics.compliance.ethicsTrainingCompletionRate).toBeLessThanOrEqual(100);
      expect(metrics.recruitment.turnoverRate).toBeGreaterThanOrEqual(0);
      expect(metrics.recruitment.turnoverRate).toBeLessThan(100);

      // Check rating values are in valid range
      expect(metrics.compliance.complianceRating).toBeGreaterThanOrEqual(1);
      expect(metrics.compliance.complianceRating).toBeLessThanOrEqual(5);
      expect(metrics.culture.employeeEngagementScore).toBeGreaterThanOrEqual(1);
      expect(metrics.culture.employeeEngagementScore).toBeLessThanOrEqual(5);

      // Check count values are non-negative
      expect(metrics.compliance.legalViolations).toBeGreaterThanOrEqual(0);
      expect(metrics.compliance.finesAndPenalties).toBeGreaterThanOrEqual(0);
      expect(metrics.workforce.totalWorkforce).toBeGreaterThanOrEqual(0);
    });

    it('should handle different reporting periods', async () => {
      const periods = [
        {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-03-31')
        },
        {
          startDate: new Date('2024-04-01'),
          endDate: new Date('2024-06-30')
        },
        {
          startDate: new Date('2024-07-01'),
          endDate: new Date('2024-09-30')
        }
      ];

      for (const period of periods) {
        const metrics = await engine.calculateHumanCapitalMetrics(period);
        expect(metrics).toBeDefined();
        expect(metrics.workforce.totalWorkforce).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('generateHumanCapitalReport', () => {
    it('should generate a complete report', async () => {
      const companyName = 'テスト株式会社';
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const report = await engine.generateHumanCapitalReport(companyName, reportingPeriod);

      expect(report).toBeDefined();
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

    it('should include proper executive summary', async () => {
      const companyName = 'テスト株式会社';
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const report = await engine.generateHumanCapitalReport(companyName, reportingPeriod);

      expect(report.executiveSummary.keyFindings).toBeDefined();
      expect(Array.isArray(report.executiveSummary.keyFindings)).toBe(true);
      expect(report.executiveSummary.performanceHighlights).toBeDefined();
      expect(Array.isArray(report.executiveSummary.performanceHighlights)).toBe(true);
      expect(report.executiveSummary.majorConcerns).toBeDefined();
      expect(Array.isArray(report.executiveSummary.majorConcerns)).toBe(true);
      expect(report.executiveSummary.strategicRecommendations).toBeDefined();
      expect(Array.isArray(report.executiveSummary.strategicRecommendations)).toBe(true);
    });

    it('should validate compliance scores', async () => {
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

      expect(realTimeData).toBeDefined();
      expect(realTimeData.keyMetrics).toBeDefined();
      expect(realTimeData.alerts).toBeDefined();
      expect(realTimeData.trends).toBeDefined();
      expect(realTimeData.recommendations).toBeDefined();

      // Check key metrics
      expect(realTimeData.keyMetrics['Employee Engagement']).toBeDefined();
      expect(realTimeData.keyMetrics['Turnover Rate']).toBeDefined();
      expect(realTimeData.keyMetrics['Training Completion']).toBeDefined();
      expect(realTimeData.keyMetrics['Diversity Score']).toBeDefined();
      expect(realTimeData.keyMetrics['Productivity Index']).toBeDefined();
      expect(realTimeData.keyMetrics['Safety Score']).toBeDefined();

      // Check value ranges
      expect(realTimeData.keyMetrics['Employee Engagement']).toBeGreaterThan(0);
      expect(realTimeData.keyMetrics['Employee Engagement']).toBeLessThanOrEqual(5);
      expect(realTimeData.keyMetrics['Turnover Rate']).toBeGreaterThan(0);
      expect(realTimeData.keyMetrics['Turnover Rate']).toBeLessThan(100);

      // Check arrays
      expect(Array.isArray(realTimeData.alerts)).toBe(true);
      expect(Array.isArray(realTimeData.recommendations)).toBe(true);
      expect(realTimeData.recommendations.length).toBeLessThanOrEqual(5);
    });

    it('should provide trend indicators', async () => {
      const realTimeData = await engine.calculateRealTimeMetrics();

      Object.values(realTimeData.trends).forEach(trend => {
        expect(['up', 'down', 'stable']).toContain(trend);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should complete calculations within reasonable time', async () => {
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

    it('should handle concurrent operations', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const promises = [
        engine.calculateHumanCapitalMetrics(reportingPeriod),
        engine.calculateRealTimeMetrics(),
        engine.generateHumanCapitalReport('テスト会社', reportingPeriod)
      ];

      const results = await Promise.all(promises);
      
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[2]).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid date ranges gracefully', async () => {
      const invalidPeriod = {
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(invalidPeriod);
      expect(metrics).toBeDefined();
    });

    it('should handle null/undefined values gracefully', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);
      expect(metrics).toBeDefined();
    });
  });
});

async function addTestEmployees(db: Database): Promise<void> {
  const testEmployees = [
    {
      name: '田中太郎',
      department: 'Engineering',
      position: 'Senior Engineer',
      hourlyRate: 3000,
      joinDate: new Date('2020-04-01'),
      isActive: true
    },
    {
      name: '佐藤花子',
      department: 'Marketing',
      position: 'Marketing Manager',
      hourlyRate: 2500,
      joinDate: new Date('2019-10-15'),
      isActive: true
    },
    {
      name: '山田次郎',
      department: 'Sales',
      position: 'Sales Representative',
      hourlyRate: 2000,
      joinDate: new Date('2021-07-01'),
      isActive: true
    },
    {
      name: 'Johnson Michael',
      department: 'Engineering',
      position: 'Tech Lead',
      hourlyRate: 4000,
      joinDate: new Date('2018-03-15'),
      isActive: true
    },
    {
      name: '鈴木美咲',
      department: 'HR',
      position: 'HR Specialist',
      hourlyRate: 2200,
      joinDate: new Date('2022-01-10'),
      isActive: true
    }
  ];

  for (const employee of testEmployees) {
    await db.addEmployee(employee);
  }
}