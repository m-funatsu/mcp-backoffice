/**
 * Human Capital Disclosure System Demo
 * 人的資本開示システム デモンストレーション
 * 
 * This demonstrates the complete human capital disclosure system
 * with real data and generates a comprehensive report.
 */

import Database from '../../src/database.js';
import { EmployeeLifecycleManagement } from '../../src/hr-lifecycle-management-v1.5.0.js';
import { TalentManagementSystem } from '../../src/talent-management-system-v1.5.0.js';
import { LearningTrainingManagement } from '../../src/learning-training-management-v1.5.0.js';
import { HumanCapitalDisclosureEngine } from '../../src/human-capital-disclosure-engine-v2.0.0.js';
import { promises as fs } from 'fs';

async function runDemo() {
  console.log('🚀 Human Capital Disclosure System v2.0.0 Demo');
  console.log('========================================');

  // Initialize database with demo data
  const db = new Database(':memory:');
  await db.initializeDatabase();

  // Initialize management systems
  const lifecycleManagement = new EmployeeLifecycleManagement(db);
  const talentManagement = new TalentManagementSystem(db);
  const learningManagement = new LearningTrainingManagement(db);
  const engine = new HumanCapitalDisclosureEngine(db, lifecycleManagement, talentManagement, learningManagement);

  // Add demo employees
  await insertDemoEmployees(db);

  console.log('✅ Demo data inserted successfully');

  // Generate comprehensive human capital report
  const reportingPeriod = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31')
  };

  console.log('\n📊 Generating Human Capital Report...');
  const report = await engine.generateHumanCapitalReport('デモ株式会社', reportingPeriod);

  console.log('\n📋 Human Capital Report Summary:');
  console.log(`Report ID: ${report.reportId}`);
  console.log(`Company: ${report.companyName}`);
  console.log(`Period: ${report.reportingPeriod.startDate.toISOString().split('T')[0]} - ${report.reportingPeriod.endDate.toISOString().split('T')[0]}`);
  console.log(`Generated: ${report.reportGeneratedAt.toLocaleString()}`);

  console.log('\n👥 Workforce Metrics:');
  console.log(`Total Workforce: ${report.metrics.workforce.totalWorkforce}`);
  console.log(`Average Age: ${report.metrics.workforce.averageAge.toFixed(1)} years`);
  console.log(`Average Tenure: ${report.metrics.workforce.averageTenure.toFixed(1)} years`);
  console.log(`Remote Work Participation: ${report.metrics.workforce.remoteWorkParticipation}%`);

  console.log('\n💰 Cost Metrics:');
  console.log(`Total Remuneration: ¥${report.metrics.costs.totalRemunerationCost.toLocaleString()}`);
  console.log(`Per Employee: ¥${report.metrics.costs.remunerationCostPerEmployee.toLocaleString()}`);
  console.log(`Training Cost Per Employee: ¥${report.metrics.costs.trainingCostPerEmployee.toLocaleString()}`);

  console.log('\n🌈 Diversity Metrics:');
  console.log(`Male/Female Ratio: ${report.metrics.diversity.genderDistribution.male}%/${report.metrics.diversity.genderDistribution.female}%`);
  console.log(`Foreign National Ratio: ${report.metrics.diversity.nationalityDistribution.foreign}%`);
  console.log(`Diversity Inclusion Score: ${report.metrics.diversity.diversityInclusionScore}/5`);

  console.log('\n📈 Performance Metrics:');
  console.log(`Employee Engagement: ${report.metrics.culture.employeeEngagementScore}/5`);
  console.log(`Turnover Rate: ${report.metrics.recruitment.turnoverRate}%`);
  console.log(`Training Completion Rate: ${report.metrics.skills.trainingCompletionRate}%`);
  console.log(`Productivity Index: ${report.metrics.productivity.employeeProductivityIndex}/5`);

  console.log('\n🇯🇵 Japanese Compliance:');
  console.log(`Overtime Compliance: ${report.metrics.japanese.overtimeComplianceRate}%`);
  console.log(`Paid Leave Utilization: ${report.metrics.japanese.paidLeaveUtilizationRate}%`);
  console.log(`Work Style Reform Compliance: ${report.metrics.japanese.workStyleReformCompliance}%`);

  console.log('\n📊 Compliance Status:');
  console.log(`ISO 30414 Compliance: ${report.compliance.iso30414Compliance}%`);
  console.log(`Japanese Labor Law Compliance: ${report.compliance.japoneseLaborLawCompliance}%`);
  console.log(`Securities Law Compliance: ${report.compliance.securitiesLawCompliance}%`);
  console.log(`Overall Compliance Score: ${report.compliance.overallComplianceScore}%`);

  console.log('\n🎯 Key Recommendations:');
  report.recommendations.slice(0, 3).forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.title} (Priority: ${rec.priority})`);
    console.log(`   ${rec.description}`);
    console.log(`   Expected Impact: ${rec.expectedImpact}`);
    console.log(`   Implementation Cost: ¥${rec.implementationCost.toLocaleString()}`);
  });

  console.log('\n📈 Real-time Dashboard:');
  const realTimeData = await engine.calculateRealTimeMetrics();
  console.log('Key Metrics:');
  Object.entries(realTimeData.keyMetrics).forEach(([metric, value]) => {
    console.log(`  ${metric}: ${value}`);
  });

  if (realTimeData.alerts.length > 0) {
    console.log('\n🚨 Active Alerts:');
    realTimeData.alerts.forEach(alert => {
      console.log(`  ${alert}`);
    });
  }

  console.log('\n📊 Trend Analysis:');
  Object.entries(realTimeData.trends).forEach(([metric, trend]) => {
    const arrow = trend === 'up' ? '↗️' : trend === 'down' ? '↘️' : '➡️';
    console.log(`  ${metric}: ${arrow} ${trend}`);
  });

  console.log('\n💡 Top Recommendations:');
  realTimeData.recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec}`);
  });

  console.log('\n🎯 Executive Summary:');
  console.log('Key Findings:');
  report.executiveSummary.keyFindings.forEach((finding, index) => {
    console.log(`  ${index + 1}. ${finding}`);
  });

  console.log('\nPerformance Highlights:');
  report.executiveSummary.performanceHighlights.forEach((highlight, index) => {
    console.log(`  ${index + 1}. ${highlight}`);
  });

  console.log('\nStrategic Recommendations:');
  report.executiveSummary.strategicRecommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec}`);
  });

  // Save report summary to file
  const reportSummary = {
    reportId: report.reportId,
    companyName: report.companyName,
    reportingPeriod: report.reportingPeriod,
    generatedAt: report.reportGeneratedAt,
    keyMetrics: {
      totalWorkforce: report.metrics.workforce.totalWorkforce,
      totalRemunerationCost: report.metrics.costs.totalRemunerationCost,
      employeeEngagementScore: report.metrics.culture.employeeEngagementScore,
      turnoverRate: report.metrics.recruitment.turnoverRate,
      diversityInclusionScore: report.metrics.diversity.diversityInclusionScore,
      overallComplianceScore: report.compliance.overallComplianceScore
    },
    recommendations: report.recommendations.slice(0, 5),
    executiveSummary: report.executiveSummary
  };

  await fs.writeFile(
    'human-capital-report-demo.json',
    JSON.stringify(reportSummary, null, 2),
    'utf8'
  );

  console.log('\n✅ Demo completed successfully!');
  console.log('📄 Report summary saved to: human-capital-report-demo.json');
  console.log('\n🎉 Human Capital Disclosure System v2.0.0 is fully operational!');

  await db.close();
}

async function insertDemoEmployees(db: Database): Promise<void> {
  const demoEmployees = [
    {
      name: '田中太郎',
      department: 'Engineering',
      position: 'Senior Software Engineer',
      hourlyRate: 3500,
      joinDate: new Date('2020-04-01'),
      isActive: true
    },
    {
      name: '佐藤花子',
      department: 'Marketing',
      position: 'Marketing Manager',
      hourlyRate: 3000,
      joinDate: new Date('2019-10-15'),
      isActive: true
    },
    {
      name: '山田次郎',
      department: 'Sales',
      position: 'Sales Representative',
      hourlyRate: 2500,
      joinDate: new Date('2021-07-01'),
      isActive: true
    },
    {
      name: 'Johnson Michael',
      department: 'Engineering',
      position: 'Technical Lead',
      hourlyRate: 4500,
      joinDate: new Date('2018-03-15'),
      isActive: true
    },
    {
      name: '鈴木美咲',
      department: 'HR',
      position: 'HR Specialist',
      hourlyRate: 2800,
      joinDate: new Date('2022-01-10'),
      isActive: true
    },
    {
      name: 'Smith Jennifer',
      department: 'Marketing',
      position: 'Digital Marketing Specialist',
      hourlyRate: 2600,
      joinDate: new Date('2021-03-20'),
      isActive: true
    },
    {
      name: '高橋健太',
      department: 'Sales',
      position: 'Sales Manager',
      hourlyRate: 3200,
      joinDate: new Date('2019-06-10'),
      isActive: true
    },
    {
      name: '渡辺真理',
      department: 'Engineering',
      position: 'Frontend Developer',
      hourlyRate: 2900,
      joinDate: new Date('2020-09-01'),
      isActive: true
    },
    {
      name: 'Brown Robert',
      department: 'HR',
      position: 'HR Manager',
      hourlyRate: 3800,
      joinDate: new Date('2018-01-15'),
      isActive: true
    },
    {
      name: '中村美穂',
      department: 'Finance',
      position: 'Financial Analyst',
      hourlyRate: 2700,
      joinDate: new Date('2020-11-05'),
      isActive: true
    },
    {
      name: '김민수',
      department: 'Engineering',
      position: 'Backend Developer',
      hourlyRate: 3100,
      joinDate: new Date('2021-05-12'),
      isActive: true
    },
    {
      name: '李小明',
      department: 'Design',
      position: 'UX Designer',
      hourlyRate: 2800,
      joinDate: new Date('2020-08-03'),
      isActive: true
    },
    {
      name: '吉田優子',
      department: 'Operations',
      position: 'Operations Manager',
      hourlyRate: 3300,
      joinDate: new Date('2019-02-14'),
      isActive: true
    },
    {
      name: 'Wilson David',
      department: 'Engineering',
      position: 'DevOps Engineer',
      hourlyRate: 3600,
      joinDate: new Date('2020-01-20'),
      isActive: true
    },
    {
      name: '小林和子',
      department: 'Customer Support',
      position: 'Support Manager',
      hourlyRate: 2900,
      joinDate: new Date('2021-09-15'),
      isActive: true
    }
  ];

  for (const employee of demoEmployees) {
    await db.addEmployee(employee);
  }
}

// Run the demo
if (process.argv[2] === '--run') {
  runDemo().catch(console.error);
}

export default runDemo;