/**
 * Sample Data Generator - v2.2.0対応
 * 開発・デモ用のサンプルデータを生成
 */

import Database from './database.js';
import type { Employee, TalentSkill, TrainingRecord } from './types.js';

export class SampleDataGenerator {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  /**
   * 全てのサンプルデータを生成
   */
  async generateAllSampleData(): Promise<void> {
    console.log('🎯 Generating sample data for AI-Native Strategic Platform...');
    
    try {
      await this.db.connect();
      
      // 1. 従業員データ
      console.log('👥 Creating sample employees...');
      const employees = await this.createSampleEmployees();
      
      // 2. スキルデータ
      console.log('🎓 Creating sample skills...');
      const skills = await this.createSampleSkills();
      
      // 3. 従業員スキル割り当て
      console.log('🔗 Assigning skills to employees...');
      await this.assignSkillsToEmployees(employees, skills);
      
      // 4. 研修データ
      console.log('📚 Creating sample training records...');
      await this.createSampleTrainingRecords(employees);
      
      // 5. 勤怠データ
      console.log('⏰ Creating sample time records...');
      await this.createSampleTimeRecords(employees);
      
      // 6. 給与データ
      console.log('💰 Creating sample payroll data...');
      await this.createSamplePayrollData(employees);
      
      // 7. 休暇データ
      console.log('🏖️ Creating sample leave data...');
      await this.createSampleLeaveData(employees);
      
      // 8. 経費データ
      console.log('💳 Creating sample expense data...');
      await this.createSampleExpenseData(employees);
      
      // 9. パフォーマンス評価データ
      console.log('📊 Creating sample performance evaluations...');
      await this.createSamplePerformanceEvaluations(employees);
      
      // 10. 目標管理データ
      console.log('🎯 Creating sample goals and OKRs...');
      await this.createSampleGoalsOKRs(employees);
      
      console.log('✅ All sample data generated successfully!');
      
    } catch (error) {
      console.error('❌ Error generating sample data:', error);
      throw error;
    } finally {
      await this.db.close();
    }
  }

  /**
   * サンプル従業員を作成
   */
  private async createSampleEmployees(): Promise<Employee[]> {
    const employees: Employee[] = [
      {
        id: 'EMP_001',
        name: '田中太郎',
        email: 'tanaka@company.com',
        department: '開発部',
        position: 'シニアエンジニア',
        hourlyRate: 4000,
        startDate: new Date('2022-04-01'),
        managerId: 'EMP_005',
        isActive: true
      },
      {
        id: 'EMP_002',
        name: '佐藤花子',
        email: 'sato@company.com',
        department: '開発部',
        position: 'エンジニア',
        hourlyRate: 3000,
        startDate: new Date('2023-01-15'),
        managerId: 'EMP_005',
        isActive: true
      },
      {
        id: 'EMP_003',
        name: '鈴木一郎',
        email: 'suzuki@company.com',
        department: '営業部',
        position: '営業担当',
        hourlyRate: 2800,
        startDate: new Date('2023-03-01'),
        managerId: 'EMP_006',
        isActive: true
      },
      {
        id: 'EMP_004',
        name: '高橋美咲',
        email: 'takahashi@company.com',
        department: '人事部',
        position: '人事担当',
        hourlyRate: 3200,
        startDate: new Date('2022-09-01'),
        managerId: 'EMP_007',
        isActive: true
      },
      {
        id: 'EMP_005',
        name: '山田次郎',
        email: 'yamada@company.com',
        department: '開発部',
        position: 'テックリード',
        hourlyRate: 5000,
        startDate: new Date('2021-04-01'),
        managerId: undefined,
        isActive: true
      },
      {
        id: 'EMP_006',
        name: '渡辺和子',
        email: 'watanabe@company.com',
        department: '営業部',
        position: '営業マネージャー',
        hourlyRate: 4500,
        startDate: new Date('2021-07-01'),
        managerId: undefined,
        isActive: true
      },
      {
        id: 'EMP_007',
        name: '伊藤康夫',
        email: 'ito@company.com',
        department: '人事部',
        position: '人事マネージャー',
        hourlyRate: 4800,
        startDate: new Date('2020-10-01'),
        managerId: undefined,
        isActive: true
      },
      {
        id: 'EMP_008',
        name: '中村恵',
        email: 'nakamura@company.com',
        department: '開発部',
        position: 'ジュニアエンジニア',
        hourlyRate: 2500,
        startDate: new Date('2024-04-01'),
        managerId: 'EMP_005',
        isActive: true
      }
    ];

    for (const employee of employees) {
      await this.db.addEmployee(employee);
    }

    return employees;
  }

  /**
   * サンプルスキルを作成
   */
  private async createSampleSkills(): Promise<TalentSkill[]> {
    const skills: Partial<TalentSkill>[] = [
      // 技術スキル
      { name: 'JavaScript', category: 'technical', description: 'フロントエンド・バックエンド開発', competencyLevels: 5 },
      { name: 'TypeScript', category: 'technical', description: '型安全なJavaScript開発', competencyLevels: 5 },
      { name: 'React', category: 'technical', description: 'フロントエンドフレームワーク', competencyLevels: 5 },
      { name: 'Node.js', category: 'technical', description: 'サーバーサイドJavaScript', competencyLevels: 5 },
      { name: 'PostgreSQL', category: 'technical', description: 'リレーショナルデータベース', competencyLevels: 5 },
      { name: 'AWS', category: 'technical', description: 'クラウドインフラ', competencyLevels: 5 },
      { name: 'Docker', category: 'technical', description: 'コンテナ技術', competencyLevels: 5 },
      
      // ソフトスキル
      { name: 'コミュニケーション', category: 'soft', description: 'チーム内外との効果的な意思疎通', competencyLevels: 5 },
      { name: '問題解決', category: 'soft', description: '複雑な問題の分析と解決', competencyLevels: 5 },
      { name: 'チームワーク', category: 'soft', description: 'チームでの協働能力', competencyLevels: 5 },
      { name: 'プレゼンテーション', category: 'soft', description: '効果的な発表・説明スキル', competencyLevels: 5 },
      { name: '時間管理', category: 'soft', description: '効率的な時間活用', competencyLevels: 5 },
      
      // リーダーシップスキル
      { name: 'チームマネジメント', category: 'leadership', description: 'チームの指導・管理', competencyLevels: 5 },
      { name: 'プロジェクト管理', category: 'leadership', description: 'プロジェクトの計画・実行・管理', competencyLevels: 5 },
      { name: 'メンタリング', category: 'leadership', description: '後輩・部下の指導・育成', competencyLevels: 5 },
      { name: '意思決定', category: 'leadership', description: '適切な判断・決定', competencyLevels: 5 },
      { name: '戦略思考', category: 'leadership', description: '長期的・戦略的な視点', competencyLevels: 5 },
      
      // 専門領域スキル
      { name: 'セールス', category: 'domain', description: '営業・販売スキル', competencyLevels: 5 },
      { name: 'マーケティング', category: 'domain', description: '市場分析・マーケティング戦略', competencyLevels: 5 },
      { name: '人事制度', category: 'domain', description: '人事制度設計・運用', competencyLevels: 5 },
      { name: '労務管理', category: 'domain', description: '労働法・勤怠管理', competencyLevels: 5 },
      { name: '財務分析', category: 'domain', description: '財務諸表分析・予算管理', competencyLevels: 5 }
    ];

    const createdSkills: TalentSkill[] = [];
    for (const skill of skills) {
      const skillId = await this.db.createSkill(skill);
      createdSkills.push({
        id: skillId,
        name: skill.name!,
        category: skill.category!,
        description: skill.description,
        competencyLevels: skill.competencyLevels || 5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return createdSkills;
  }

  /**
   * 従業員にスキルを割り当て
   */
  private async assignSkillsToEmployees(employees: Employee[], skills: TalentSkill[]): Promise<void> {
    const assignments = [
      // 田中太郎 (シニアエンジニア)
      { employeeId: 'EMP_001', skillName: 'JavaScript', level: 5 },
      { employeeId: 'EMP_001', skillName: 'TypeScript', level: 4 },
      { employeeId: 'EMP_001', skillName: 'React', level: 4 },
      { employeeId: 'EMP_001', skillName: 'Node.js', level: 5 },
      { employeeId: 'EMP_001', skillName: 'PostgreSQL', level: 3 },
      { employeeId: 'EMP_001', skillName: 'コミュニケーション', level: 4 },
      { employeeId: 'EMP_001', skillName: 'メンタリング', level: 3 },
      
      // 佐藤花子 (エンジニア)
      { employeeId: 'EMP_002', skillName: 'JavaScript', level: 3 },
      { employeeId: 'EMP_002', skillName: 'TypeScript', level: 3 },
      { employeeId: 'EMP_002', skillName: 'React', level: 4 },
      { employeeId: 'EMP_002', skillName: 'コミュニケーション', level: 4 },
      { employeeId: 'EMP_002', skillName: 'チームワーク', level: 5 },
      
      // 鈴木一郎 (営業担当)
      { employeeId: 'EMP_003', skillName: 'セールス', level: 4 },
      { employeeId: 'EMP_003', skillName: 'コミュニケーション', level: 5 },
      { employeeId: 'EMP_003', skillName: 'プレゼンテーション', level: 4 },
      { employeeId: 'EMP_003', skillName: 'マーケティング', level: 2 },
      
      // 高橋美咲 (人事担当)
      { employeeId: 'EMP_004', skillName: '人事制度', level: 4 },
      { employeeId: 'EMP_004', skillName: '労務管理', level: 3 },
      { employeeId: 'EMP_004', skillName: 'コミュニケーション', level: 4 },
      { employeeId: 'EMP_004', skillName: 'チームワーク', level: 4 },
      
      // 山田次郎 (テックリード)
      { employeeId: 'EMP_005', skillName: 'JavaScript', level: 5 },
      { employeeId: 'EMP_005', skillName: 'TypeScript', level: 5 },
      { employeeId: 'EMP_005', skillName: 'チームマネジメント', level: 4 },
      { employeeId: 'EMP_005', skillName: 'プロジェクト管理', level: 4 },
      { employeeId: 'EMP_005', skillName: 'メンタリング', level: 5 },
      { employeeId: 'EMP_005', skillName: '戦略思考', level: 4 }
    ];

    for (const assignment of assignments) {
      const skill = skills.find(s => s.name === assignment.skillName);
      if (skill) {
        await this.db.assignSkillToEmployee(assignment.employeeId, skill.id, assignment.level);
      }
    }
  }

  /**
   * サンプル研修記録を作成
   */
  private async createSampleTrainingRecords(employees: Employee[]): Promise<void> {
    const trainingRecords = [
      {
        employeeId: 'EMP_001',
        trainingName: 'TypeScript応用講座',
        trainingType: 'external',
        provider: 'TechAcademy',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-19'),
        durationHours: 40,
        cost: 80000,
        status: 'completed',
        evaluationScore: 4.5,
        kirkpatrickLevel: 3
      },
      {
        employeeId: 'EMP_002',
        trainingName: 'React基礎研修',
        trainingType: 'internal',
        provider: '社内研修',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-03'),
        durationHours: 24,
        cost: 0,
        status: 'completed',
        evaluationScore: 4.2,
        kirkpatrickLevel: 2
      },
      {
        employeeId: 'EMP_003',
        trainingName: '営業スキル向上セミナー',
        trainingType: 'external',
        provider: 'セールスアカデミー',
        startDate: new Date('2024-03-10'),
        endDate: new Date('2024-03-12'),
        durationHours: 18,
        cost: 50000,
        status: 'completed',
        evaluationScore: 4.0,
        kirkpatrickLevel: 3
      },
      {
        employeeId: 'EMP_004',
        trainingName: '労働法改正対応研修',
        trainingType: 'external',
        provider: 'HR研修センター',
        startDate: new Date('2024-04-01'),
        endDate: new Date('2024-04-02'),
        durationHours: 16,
        cost: 40000,
        status: 'completed',
        evaluationScore: 4.8,
        kirkpatrickLevel: 4
      },
      {
        employeeId: 'EMP_005',
        trainingName: 'リーダーシップ研修',
        trainingType: 'external',
        provider: 'マネジメント研修所',
        startDate: new Date('2024-05-01'),
        endDate: new Date('2024-05-03'),
        durationHours: 24,
        cost: 120000,
        status: 'scheduled',
        evaluationScore: null,
        kirkpatrickLevel: null
      }
    ];

    for (const record of trainingRecords) {
      await this.db.createTrainingRecord(record);
    }
  }

  /**
   * サンプル勤怠記録を作成
   */
  private async createSampleTimeRecords(employees: Employee[]): Promise<void> {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 30); // 過去30日分

    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      // 土日はスキップ
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      for (const employee of employees) {
        // 90%の確率で出勤
        if (Math.random() < 0.9) {
          const clockIn = new Date(date);
          clockIn.setHours(9, Math.floor(Math.random() * 30), 0, 0);
          
          const clockOut = new Date(clockIn);
          clockOut.setHours(clockIn.getHours() + 8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0);
          
          await this.db.query(`
            INSERT INTO time_records (id, employee_id, date, clock_in, clock_out, break_duration, record_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            `TR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            employee.id,
            date.toISOString().split('T')[0],
            clockIn,
            clockOut,
            60, // 60分休憩
            'ic_card'
          ]);
        }
      }
    }
  }

  /**
   * サンプル給与データを作成
   */
  private async createSamplePayrollData(employees: Employee[]): Promise<void> {
    const months = ['2024-01', '2024-02', '2024-03', '2024-04'];
    
    for (const month of months) {
      for (const employee of employees) {
        const regularHours = 160 + Math.floor(Math.random() * 20);
        const overtimeHours = Math.floor(Math.random() * 30);
        const regularPay = regularHours * employee.hourlyRate;
        const overtimePay = overtimeHours * employee.hourlyRate * 1.25;
        
        await this.db.query(`
          INSERT INTO payroll_calculations (id, employee_id, month, regular_hours, overtime_hours, late_night_hours, holiday_hours, regular_pay, overtime_pay, late_night_pay, holiday_pay, total_pay)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          employee.id,
          month,
          regularHours,
          overtimeHours,
          0,
          0,
          regularPay,
          overtimePay,
          0,
          0,
          regularPay + overtimePay
        ]);
      }
    }
  }

  /**
   * サンプル休暇データを作成
   */
  private async createSampleLeaveData(employees: Employee[]): Promise<void> {
    for (const employee of employees) {
      // 有給残高
      await this.db.query(`
        INSERT INTO leave_balances (employee_id, leave_type, year, granted_days, used_days, remaining_days)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        employee.id,
        'annual',
        2024,
        20,
        Math.floor(Math.random() * 10),
        20 - Math.floor(Math.random() * 10)
      ]);
    }
  }

  /**
   * サンプル経費データを作成
   */
  private async createSampleExpenseData(employees: Employee[]): Promise<void> {
    const categories = ['EXP_CAT_001', 'EXP_CAT_002', 'EXP_CAT_003', 'EXP_CAT_004'];
    
    for (const employee of employees) {
      for (let i = 0; i < 5; i++) {
        const expenseDate = new Date();
        expenseDate.setDate(expenseDate.getDate() - Math.floor(Math.random() * 30));
        
        await this.db.query(`
          INSERT INTO expense_requests (id, employee_id, category_id, amount, expense_date, description, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          `EXP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          employee.id,
          categories[Math.floor(Math.random() * categories.length)],
          Math.floor(Math.random() * 10000) + 1000,
          expenseDate.toISOString().split('T')[0],
          `業務関連費用 ${i + 1}`,
          ['submitted', 'approved', 'rejected'][Math.floor(Math.random() * 3)]
        ]);
      }
    }
  }

  /**
   * サンプルパフォーマンス評価を作成
   */
  private async createSamplePerformanceEvaluations(employees: Employee[]): Promise<void> {
    for (const employee of employees) {
      const evaluation = {
        employeeId: employee.id,
        evaluatorId: employee.managerId || 'EMP_005',
        evaluationPeriod: 'annual',
        evaluationDate: new Date('2024-03-31'),
        overallRating: 3.0 + Math.random() * 2,
        competencyRatings: {
          technical: 3.0 + Math.random() * 2,
          communication: 3.0 + Math.random() * 2,
          teamwork: 3.0 + Math.random() * 2,
          leadership: 2.0 + Math.random() * 2
        },
        goalsAchievement: 70 + Math.random() * 30,
        strengths: '優れた技術力と協調性',
        areasForImprovement: 'リーダーシップスキルの向上',
        developmentPlans: 'マネジメント研修の受講',
        promotionReadiness: ['ready', 'developing', 'not_ready'][Math.floor(Math.random() * 3)],
        successionPotential: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
        retentionRisk: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        status: 'final'
      };

      await this.db.createPerformanceEvaluation(evaluation);
    }
  }

  /**
   * サンプル目標・OKRを作成
   */
  private async createSampleGoalsOKRs(employees: Employee[]): Promise<void> {
    for (const employee of employees) {
      // MBO目標
      const mboGoal = {
        employeeId: employee.id,
        goalType: 'mbo',
        title: 'チーム生産性向上',
        description: 'チーム全体の開発効率を20%向上させる',
        category: 'performance',
        targetValue: 120,
        currentValue: 85,
        unit: '%',
        weight: 100,
        priority: 'high',
        startDate: new Date('2024-01-01'),
        dueDate: new Date('2024-12-31'),
        status: 'in_progress',
        achievementRate: 70
      };

      await this.db.createGoal(mboGoal);

      // OKR目標
      const okrGoal = {
        employeeId: employee.id,
        goalType: 'okr',
        title: '新機能リリース',
        description: '第1四半期に新機能を3つリリースする',
        category: 'strategic',
        targetValue: 3,
        currentValue: 2,
        unit: '機能',
        weight: 100,
        priority: 'high',
        startDate: new Date('2024-01-01'),
        dueDate: new Date('2024-03-31'),
        status: 'in_progress',
        achievementRate: 67
      };

      await this.db.createGoal(okrGoal);
    }
  }
}

// CLI実行用のメイン関数
async function main() {
  const generator = new SampleDataGenerator();
  
  try {
    await generator.generateAllSampleData();
    console.log('');
    console.log('🎉 Sample data generation completed!');
    console.log('');
    console.log('💡 You can now view the data using:');
    console.log('  npm run db-view:all');
    console.log('  npm run db-view:data');
    console.log('  npm run db-view:stats');
    
  } catch (error) {
    console.error('❌ Sample data generation failed:', error);
    process.exit(1);
  }
}

// CLI実行時のエントリーポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default SampleDataGenerator;