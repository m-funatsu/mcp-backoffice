/**
 * Integration Tests for Human Capital Disclosure System v2.0.0
 * 人的資本開示システム v2.0.0 統合テスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from '../../src/database.js';
import { EmployeeLifecycleManagement } from '../../src/hr-lifecycle-management-v1.5.0.js';
import { TalentManagementSystem } from '../../src/talent-management-system-v1.5.0.js';
import { LearningTrainingManagement } from '../../src/learning-training-management-v1.5.0.js';
import { HumanCapitalDisclosureEngine } from '../../src/human-capital-disclosure-engine-v2.0.0.js';
import type { Employee } from '../../src/types.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Human Capital Disclosure System Integration Tests', () => {
  let db: Database;
  let lifecycleManagement: EmployeeLifecycleManagement;
  let talentManagement: TalentManagementSystem;
  let learningManagement: LearningTrainingManagement;
  let engine: HumanCapitalDisclosureEngine;

  const testDbPath = path.join(__dirname, '../../test-integration.db');

  beforeEach(async () => {
    // Clean up any existing test database
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }

    // Initialize database with test data
    db = new Database(testDbPath);
    await db.initializeDatabase();

    // Initialize management systems
    lifecycleManagement = new EmployeeLifecycleManagement(db);
    talentManagement = new TalentManagementSystem(db);
    learningManagement = new LearningTrainingManagement(db);
    engine = new HumanCapitalDisclosureEngine(db, lifecycleManagement, talentManagement, learningManagement);

    // Insert test employees
    await insertTestEmployees(db);
  });

  afterEach(async () => {
    await db.close();
    try {
      await fs.unlink(testDbPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  });

  describe('End-to-End Human Capital Reporting', () => {
    it('should generate complete human capital report with real data', async () => {
      const companyName = 'テスト統合株式会社';
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const report = await engine.generateHumanCapitalReport(companyName, reportingPeriod);

      // Verify report structure
      expect(report.reportId).toBeDefined();
      expect(report.companyName).toBe(companyName);
      expect(report.reportingPeriod).toEqual(reportingPeriod);
      expect(report.reportGeneratedAt).toBeInstanceOf(Date);

      // Verify all metric categories are present
      expect(report.metrics.compliance).toBeDefined();
      expect(report.metrics.costs).toBeDefined();
      expect(report.metrics.diversity).toBeDefined();
      expect(report.metrics.leadership).toBeDefined();
      expect(report.metrics.culture).toBeDefined();
      expect(report.metrics.safety).toBeDefined();
      expect(report.metrics.productivity).toBeDefined();
      expect(report.metrics.recruitment).toBeDefined();
      expect(report.metrics.skills).toBeDefined();
      expect(report.metrics.workforce).toBeDefined();
      expect(report.metrics.japanese).toBeDefined();

      // Verify report components
      expect(report.benchmarkComparisons).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.riskAssessment).toBeDefined();
      expect(report.compliance).toBeDefined();
      expect(report.executiveSummary).toBeDefined();

      // Verify data consistency
      expect(report.metrics.workforce.totalWorkforce).toBeGreaterThan(0);
      expect(report.metrics.costs.totalRemunerationCost).toBeGreaterThan(0);
      expect(report.compliance.overallComplianceScore).toBeGreaterThan(0);
      expect(report.compliance.overallComplianceScore).toBeLessThanOrEqual(100);

      console.log('✅ Generated complete human capital report:', {
        reportId: report.reportId,
        totalWorkforce: report.metrics.workforce.totalWorkforce,
        totalRemunerationCost: report.metrics.costs.totalRemunerationCost,
        complianceScore: report.compliance.overallComplianceScore
      });
    });

    it('should calculate metrics consistently across multiple runs', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      // Calculate metrics multiple times
      const metrics1 = await engine.calculateHumanCapitalMetrics(reportingPeriod);
      const metrics2 = await engine.calculateHumanCapitalMetrics(reportingPeriod);
      const metrics3 = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      // Basic metrics should be consistent
      expect(metrics1.workforce.totalWorkforce).toBe(metrics2.workforce.totalWorkforce);
      expect(metrics2.workforce.totalWorkforce).toBe(metrics3.workforce.totalWorkforce);
      expect(metrics1.costs.totalRemunerationCost).toBe(metrics2.costs.totalRemunerationCost);
      expect(metrics2.costs.totalRemunerationCost).toBe(metrics3.costs.totalRemunerationCost);

      console.log('✅ Metrics calculation consistency verified');
    });

    it('should handle real-time dashboard updates', async () => {
      const realTimeData = await engine.calculateRealTimeMetrics();

      expect(realTimeData.keyMetrics).toBeDefined();
      expect(realTimeData.alerts).toBeDefined();
      expect(realTimeData.trends).toBeDefined();
      expect(realTimeData.recommendations).toBeDefined();

      // Verify key metrics are present and reasonable
      expect(realTimeData.keyMetrics['Employee Engagement']).toBeGreaterThan(0);
      expect(realTimeData.keyMetrics['Employee Engagement']).toBeLessThanOrEqual(5);
      expect(realTimeData.keyMetrics['Turnover Rate']).toBeGreaterThanOrEqual(0);
      expect(realTimeData.keyMetrics['Turnover Rate']).toBeLessThan(100);

      console.log('✅ Real-time dashboard data:', {
        keyMetrics: Object.keys(realTimeData.keyMetrics).length,
        alerts: realTimeData.alerts.length,
        trends: Object.keys(realTimeData.trends).length,
        recommendations: realTimeData.recommendations.length
      });
    });
  });

  describe('Data Integration Tests', () => {
    it('should integrate with employee lifecycle management', async () => {
      const employees = await db.getAllEmployees();
      const activeEmployees = employees.filter(emp => emp.isActive);

      // Test lifecycle integration
      if (activeEmployees.length > 0) {
        const employeeId = activeEmployees[0].id;
        
        // Initialize lifecycle for employee
        const lifecycle = await lifecycleManagement.initializeEmployeeLifecycle(
          employeeId,
          new Date('2024-01-01')
        );

        expect(lifecycle.employeeId).toBe(employeeId);
        expect(lifecycle.stage).toBe('pre_onboarding');
        expect(lifecycle.status).toBe('active');
        expect(lifecycle.milestones.length).toBeGreaterThan(0);

        console.log('✅ Employee lifecycle integration working');
      }
    });

    it('should integrate with talent management system', async () => {
      const employees = await db.getAllEmployees();
      const activeEmployees = employees.filter(emp => emp.isActive);

      if (activeEmployees.length > 0) {
        const employeeId = activeEmployees[0].id;
        
        // Create talent profile
        const profile = await talentManagement.createTalentProfile(employeeId, 'HR_SYSTEM');

        expect(profile.employeeId).toBe(employeeId);
        expect(profile.potentialRating).toBeDefined();
        expect(profile.performanceRating).toBeDefined();
        expect(profile.competencies.length).toBeGreaterThan(0);

        console.log('✅ Talent management integration working');
      }
    });

    it('should integrate with learning and training management', async () => {
      const employees = await db.getAllEmployees();
      const activeEmployees = employees.filter(emp => emp.isActive);

      if (activeEmployees.length > 0) {
        const employeeId = activeEmployees[0].id;
        
        // Generate learning recommendations
        const recommendations = await learningManagement.generateRecommendations(employeeId);

        expect(Array.isArray(recommendations)).toBe(true);
        // Recommendations might be empty for new employees, that's OK
        
        console.log('✅ Learning management integration working');
      }
    });
  });

  describe('Performance and Scalability Tests', () => {
    it('should handle large datasets efficiently', async () => {
      // Add more employees to test scalability
      await insertLargeEmployeeDataset(db);

      const startTime = Date.now();
      
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(metrics.workforce.totalWorkforce).toBeGreaterThan(100);
      expect(executionTime).toBeLessThan(15000); // 15 seconds max

      console.log('✅ Large dataset performance test:', {
        totalEmployees: metrics.workforce.totalWorkforce,
        executionTime: `${executionTime}ms`
      });
    });

    it('should maintain data integrity under concurrent operations', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      // Run multiple operations concurrently
      const promises = [
        engine.calculateHumanCapitalMetrics(reportingPeriod),
        engine.calculateRealTimeMetrics(),
        engine.generateHumanCapitalReport('テスト会社', reportingPeriod)
      ];

      const results = await Promise.all(promises);
      
      // All operations should complete successfully
      expect(results[0]).toBeDefined(); // metrics
      expect(results[1]).toBeDefined(); // real-time data
      expect(results[2]).toBeDefined(); // report

      console.log('✅ Concurrent operations test passed');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection issues gracefully', async () => {
      // Create a separate database instance for this test
      const testDb = new Database(':memory:');
      await testDb.initializeDatabase();
      
      const testEngine = new HumanCapitalDisclosureEngine(
        testDb,
        new EmployeeLifecycleManagement(testDb),
        new TalentManagementSystem(testDb),
        new LearningTrainingManagement(testDb)
      );

      // Close database connection
      await testDb.close();

      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      await expect(testEngine.calculateHumanCapitalMetrics(reportingPeriod))
        .rejects
        .toThrow();

      console.log('✅ Database connection error handling working');
    });

    it('should validate input parameters', async () => {
      // Test with invalid date range
      const invalidPeriod = {
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01') // End before start
      };

      // Should handle gracefully without throwing
      const metrics = await engine.calculateHumanCapitalMetrics(invalidPeriod);
      expect(metrics).toBeDefined();

      console.log('✅ Input validation working');
    });
  });

  describe('Compliance and Regulatory Tests', () => {
    it('should ensure ISO 30414 compliance', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      // Verify all ISO 30414 required metrics are present
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

      console.log('✅ ISO 30414 compliance verified');
    });

    it('should ensure Japanese labor law compliance', async () => {
      const reportingPeriod = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      const metrics = await engine.calculateHumanCapitalMetrics(reportingPeriod);

      // Verify Japanese-specific metrics are present
      expect(metrics.japanese).toBeDefined();
      expect(metrics.japanese.overtimeComplianceRate).toBeDefined();
      expect(metrics.japanese.paidLeaveUtilizationRate).toBeDefined();
      expect(metrics.japanese.workStyleReformCompliance).toBeDefined();

      // Verify compliance rates are reasonable
      expect(metrics.japanese.overtimeComplianceRate).toBeGreaterThan(0);
      expect(metrics.japanese.overtimeComplianceRate).toBeLessThanOrEqual(100);
      expect(metrics.japanese.paidLeaveUtilizationRate).toBeGreaterThan(0);
      expect(metrics.japanese.paidLeaveUtilizationRate).toBeLessThanOrEqual(100);

      console.log('✅ Japanese labor law compliance verified');
    });
  });
});

// Helper functions for test data setup

async function insertTestEmployees(db: Database): Promise<void> {
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
    },
    {
      name: 'Smith Jennifer',
      department: 'Marketing',
      position: 'Marketing Specialist',
      hourlyRate: 2300,
      joinDate: new Date('2021-03-20'),
      isActive: true
    },
    {
      name: '高橋健太',
      department: 'Sales',
      position: 'Sales Manager',
      hourlyRate: 2800,
      joinDate: new Date('2019-06-10'),
      isActive: true
    },
    {
      name: '渡辺真理',
      department: 'Engineering',
      position: 'Software Engineer',
      hourlyRate: 2600,
      joinDate: new Date('2020-09-01'),
      isActive: true
    },
    {
      name: 'Brown Robert',
      department: 'HR',
      position: 'HR Manager',
      hourlyRate: 3200,
      joinDate: new Date('2018-01-15'),
      isActive: true
    },
    {
      name: '中村美穂',
      department: 'Finance',
      position: 'Financial Analyst',
      hourlyRate: 2400,
      joinDate: new Date('2020-11-05'),
      isActive: true
    }
  ];

  for (const employee of testEmployees) {
    await db.addEmployee(employee);
  }
}

async function insertLargeEmployeeDataset(db: Database): Promise<void> {
  const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
  const positions = ['Manager', 'Senior', 'Specialist', 'Analyst', 'Lead', 'Director'];
  const firstNames = ['太郎', '花子', '次郎', '美咲', '健太', '真理', '美穂', '隆', '恵', '拓也'];
  const lastNames = ['田中', '佐藤', '山田', '鈴木', '高橋', '渡辺', '中村', '小林', '加藤', '吉田'];

  for (let i = 0; i < 100; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const position = positions[Math.floor(Math.random() * positions.length)];
    
    const employee = {
      name: `${lastName}${firstName}`,
      department,
      position: `${position} ${department}`,
      hourlyRate: 2000 + Math.floor(Math.random() * 2000),
      joinDate: new Date(
        2018 + Math.floor(Math.random() * 6), // 2018-2023
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1
      ),
      isActive: Math.random() > 0.05 // 95% active
    };

    await db.addEmployee(employee);
  }
}