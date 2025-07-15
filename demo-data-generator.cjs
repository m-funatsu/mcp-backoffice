/**
 * 人的資本開示システム検証用 大規模デモデータ生成器
 * Human Capital Disclosure System - Large Scale Demo Data Generator
 * 
 * 目的: 60名以上の従業員と包括的な人事データを生成し、
 * 人的資本指標の算出・検証・レポート生成を可能にする
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 日本の会社らしい部署・役職・スキルデータ
const DEPARTMENTS = [
  '経営企画', '人事部', '総務部', '経理部', '法務部', '営業部', '営業企画', 
  '開発部', 'エンジニアリング', 'デザイン', 'マーケティング', 'カスタマーサクセス',
  '品質保証', 'セキュリティ', 'インフラ', 'データサイエンス', 'プロダクト企画'
];

const POSITIONS = [
  '代表取締役', '取締役', '執行役員', '部長', '課長', '主任', '係長', 
  'シニアマネージャー', 'マネージャー', 'チームリーダー', 'リーダー',
  'シニアスペシャリスト', 'スペシャリスト', 'シニア', 'スタッフ', '一般職'
];

const JAPANESE_NAMES = [
  '田中太郎', '佐藤花子', '鈴木一郎', '高橋美咲', '渡辺健太', '伊藤真理',
  '山田直樹', '中村さくら', '小林誠', '加藤恵', '吉田雅人', '山本理沙',
  '佐々木拓海', '松本彩', '井上光一', '木村美穂', '清水達也', '山崎桜子',
  '森田健', '池田由美', '橋本雄太', '石川優子', '前田大輔', '藤田麻衣',
  '田村慎一', '原田千春', '岡田圭太', '長谷川真奈', '安田浩二', '藤原絵美',
  '上田翔', '武田美和', '村上賢', '岸本愛', '竹内剛', '今井香織',
  '西村亮', '福田純子', '山口大樹', '中島華', '服部洋平', '井口真由',
  '金子敦', '大野恵理', '飯田康平', '松田裕美', '水野修', '永田明日香',
  '小川隆', '高野文恵', '三浦正人', '岩田彩乃', '宮本健志', '菊池美咲',
  '酒井大', '杉山麻里', '坂本拓', '新井優', '内田裕', '野口恵',
  '斎藤剛', '浜田真希', '東海林太', '阿部綾', '堀内勇', '平野香',
  '大島健', '須藤美穂', '横山達', '片山由紀', '滝沢誠', '宮崎晴香'
];

const SKILLS_DATA = [
  // テクニカルスキル
  { name: 'JavaScript', category: 'テクニカル', type: 'technical' },
  { name: 'TypeScript', category: 'テクニカル', type: 'technical' },
  { name: 'Python', category: 'テクニカル', type: 'technical' },
  { name: 'React', category: 'テクニカル', type: 'technical' },
  { name: 'Node.js', category: 'テクニカル', type: 'technical' },
  { name: 'SQL', category: 'テクニカル', type: 'technical' },
  { name: 'クラウドアーキテクチャ', category: 'テクニカル', type: 'technical' },
  { name: 'DevOps', category: 'テクニカル', type: 'technical' },
  { name: 'UI/UXデザイン', category: 'テクニカル', type: 'technical' },
  { name: 'データ分析', category: 'テクニカル', type: 'technical' },
  { name: '機械学習', category: 'テクニカル', type: 'technical' },
  { name: 'セキュリティ', category: 'テクニカル', type: 'technical' },
  
  // リーダーシップスキル
  { name: 'チームマネジメント', category: 'リーダーシップ', type: 'leadership' },
  { name: 'プロジェクト管理', category: 'リーダーシップ', type: 'leadership' },
  { name: '戦略企画', category: 'リーダーシップ', type: 'leadership' },
  { name: '人材育成', category: 'リーダーシップ', type: 'leadership' },
  { name: 'ビジョン策定', category: 'リーダーシップ', type: 'leadership' },
  { name: '組織変革', category: 'リーダーシップ', type: 'leadership' },
  { name: '意思決定', category: 'リーダーシップ', type: 'leadership' },
  { name: 'コーチング', category: 'リーダーシップ', type: 'leadership' },
  
  // ソフトスキル
  { name: 'コミュニケーション', category: 'ソフトスキル', type: 'soft' },
  { name: 'プレゼンテーション', category: 'ソフトスキル', type: 'soft' },
  { name: '交渉力', category: 'ソフトスキル', type: 'soft' },
  { name: '問題解決', category: 'ソフトスキル', type: 'soft' },
  { name: 'クリティカルシンキング', category: 'ソフトスキル', type: 'soft' },
  { name: 'チームワーク', category: 'ソフトスキル', type: 'soft' },
  { name: '適応力', category: 'ソフトスキル', type: 'soft' },
  { name: '創造性', category: 'ソフトスキル', type: 'soft' },
  
  // 専門スキル
  { name: '財務分析', category: '専門スキル', type: 'domain_expertise' },
  { name: '法務知識', category: '専門スキル', type: 'domain_expertise' },
  { name: 'マーケティング', category: '専門スキル', type: 'domain_expertise' },
  { name: '営業戦略', category: '専門スキル', type: 'domain_expertise' },
  { name: '顧客対応', category: '専門スキル', type: 'domain_expertise' },
  { name: '品質管理', category: '専門スキル', type: 'domain_expertise' },
  { name: 'リスク管理', category: '専門スキル', type: 'domain_expertise' },
  { name: '業務改善', category: '専門スキル', type: 'domain_expertise' }
];

const TRAINING_COURSES = [
  { name: '新入社員研修', category: 'オンボーディング', type: 'internal', duration: 40 },
  { name: 'リーダーシップ基礎', category: 'リーダーシップ', type: 'internal', duration: 16 },
  { name: '管理職研修', category: 'マネジメント', type: 'internal', duration: 24 },
  { name: 'プロジェクト管理（PMP）', category: 'マネジメント', type: 'external', duration: 35 },
  { name: 'アジャイル開発', category: 'テクニカル', type: 'internal', duration: 16 },
  { name: 'クラウド技術（AWS）', category: 'テクニカル', type: 'external', duration: 24 },
  { name: 'データサイエンス入門', category: 'テクニカル', type: 'e_learning', duration: 20 },
  { name: 'デザイン思考', category: 'ソフトスキル', type: 'internal', duration: 8 },
  { name: '英語ビジネス', category: 'ソフトスキル', type: 'e_learning', duration: 60 },
  { name: 'セキュリティ意識研修', category: 'コンプライアンス', type: 'internal', duration: 4 },
  { name: 'ハラスメント防止', category: 'コンプライアンス', type: 'internal', duration: 2 },
  { name: 'メンタルヘルス', category: 'ウェルビーイング', type: 'internal', duration: 4 },
  { name: '財務分析スキル', category: '専門スキル', type: 'external', duration: 16 },
  { name: 'マーケティング戦略', category: '専門スキル', type: 'external', duration: 20 },
  { name: 'コーチング技術', category: 'リーダーシップ', type: 'external', duration: 12 }
];

// ユーティリティ関数
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// メインデータ生成クラス
class DemoDataGenerator {
  constructor(dbPath = 'attendance.db') {
    this.db = new sqlite3.Database(dbPath);
    this.employees = [];
    this.skills = [];
    this.courses = [];
  }

  async initializeDatabase() {
    console.log('🗄️  データベース初期化中...');
    
    // 基本テーブル作成
    await this.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        department TEXT,
        position TEXT,
        gender TEXT,
        age INTEGER,
        nationality TEXT,
        education_level TEXT,
        employment_type TEXT,
        disability_status TEXT,
        hourly_rate REAL,
        join_date DATE,
        manager_id TEXT,
        is_active BOOLEAN DEFAULT 1
      )
    `);
    
    // スキルマスタテーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS skills (
        skill_id TEXT PRIMARY KEY,
        skill_name VARCHAR(100) NOT NULL,
        skill_category VARCHAR(50) NOT NULL,
        skill_type VARCHAR(50) CHECK (skill_type IN ('technical', 'soft', 'leadership', 'domain_expertise')),
        description TEXT,
        industry_standard BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 研修コースマスタテーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS training_courses (
        course_id TEXT PRIMARY KEY,
        course_name VARCHAR(255) NOT NULL,
        course_category VARCHAR(100) NOT NULL,
        course_type VARCHAR(50) CHECK (course_type IN ('internal', 'external', 'e_learning', 'on_the_job', 'mentoring')),
        provider VARCHAR(200),
        duration_hours INTEGER,
        cost_per_person DECIMAL(10, 2),
        target_audience TEXT,
        learning_objectives TEXT,
        prerequisites TEXT,
        certification_available BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 従業員スキルテーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS employee_skills (
        employee_skill_id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        skill_level INTEGER CHECK (skill_level BETWEEN 1 AND 5),
        assessment_date DATE,
        assessment_method TEXT,
        assessed_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 研修受講履歴テーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS training_history (
        training_record_id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        enrollment_date DATE NOT NULL,
        start_date DATE,
        completion_date DATE,
        status VARCHAR(50) DEFAULT 'enrolled',
        attendance_rate DECIMAL(5, 2),
        final_score DECIMAL(5, 2),
        certification_earned BOOLEAN DEFAULT FALSE,
        cost_invested DECIMAL(10, 2),
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // パフォーマンス評価テーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS performance_reviews (
        review_id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        review_period_start DATE NOT NULL,
        review_period_end DATE NOT NULL,
        review_type VARCHAR(50) DEFAULT 'annual',
        overall_rating DECIMAL(3, 2),
        goals_achieved INTEGER,
        goals_total INTEGER,
        competency_ratings TEXT,
        strengths TEXT,
        areas_for_improvement TEXT,
        career_development_plan TEXT,
        promotion_readiness VARCHAR(50),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 勤怠記録テーブル
    await this.run(`
      CREATE TABLE IF NOT EXISTS time_records (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        date DATE NOT NULL,
        start_time TEXT,
        end_time TEXT,
        break_duration INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // パフォーマンス評価テーブル（別バージョン）
    await this.run(`
      CREATE TABLE IF NOT EXISTS performance_evaluations (
        id TEXT PRIMARY KEY,
        employee_id TEXT NOT NULL,
        evaluator_id TEXT,
        evaluation_period TEXT,
        evaluation_type TEXT,
        overall_rating DECIMAL(3, 2),
        performance_metrics TEXT,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ データベース初期化完了');
  }

  async generateData() {
    console.log('🚀 大規模デモデータ生成開始...');
    
    try {
      // 0. データベース初期化
      await this.initializeDatabase();
      
      // 1. 基本マスタデータ
      await this.insertSkills();
      await this.insertTrainingCourses();
      
      // 2. 従業員マスタデータ（60名）
      await this.insertEmployees(60);
      
      // 3. スキルデータ
      await this.insertEmployeeSkills();
      
      // 4. 研修データ
      await this.insertTrainingHistory();
      
      // 5. パフォーマンス評価データ
      await this.insertPerformanceEvaluations();
      
      // 6. エンゲージメント調査データ
      await this.insertEngagementSurveys();
      
      // 7. 健康・安全データ
      await this.insertHealthSafetyData();
      
      // 8. コンプライアンス事案データ
      await this.insertComplianceIncidents();
      
      // 9. 勤怠データ（時間外労働含む）
      await this.insertTimeRecords();
      
      console.log('✅ 大規模デモデータ生成完了！');
      console.log(`📊 生成データ統計:`);
      console.log(`   - 従業員: ${this.employees.length}名`);
      console.log(`   - スキル: ${this.skills.length}種類`);
      console.log(`   - 研修コース: ${this.courses.length}コース`);
      console.log(`   - 人的資本データ: 包括的に生成済み`);
      
    } catch (error) {
      console.error('❌ デモデータ生成エラー:', error);
      throw error;
    }
  }

  // スキルマスタデータ挿入
  async insertSkills() {
    console.log('💡 スキルマスタデータ挿入中...');
    
    for (const skill of SKILLS_DATA) {
      const skillId = generateId('SKILL');
      await this.run(`
        INSERT OR REPLACE INTO skills (skill_id, skill_name, skill_category, skill_type, description, industry_standard)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [skillId, skill.name, skill.category, skill.type, `${skill.name}に関する専門知識・技術`, true]);
      
      this.skills.push({ id: skillId, ...skill });
    }
    
    console.log(`✅ スキルマスタ ${this.skills.length}件 挿入完了`);
  }

  // 研修コースマスタデータ挿入
  async insertTrainingCourses() {
    console.log('📚 研修コースマスタデータ挿入中...');
    
    for (const course of TRAINING_COURSES) {
      const courseId = generateId('COURSE');
      await this.run(`
        INSERT OR REPLACE INTO training_courses (course_id, course_name, course_category, course_type, duration_hours, target_audience, learning_objectives, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [courseId, course.name, '技術研修', course.type, course.duration, '全従業員', `${course.name}に関する知識・スキル習得`, true]);
      
      this.courses.push({ id: courseId, ...course });
    }
    
    console.log(`✅ 研修コース ${this.courses.length}件 挿入完了`);
  }

  // 従業員マスタデータ挿入
  async insertEmployees(count) {
    console.log(`👥 従業員マスタデータ ${count}名 挿入中...`);
    
    const genders = ['male', 'female', 'other'];
    const nationalities = ['日本', '韓国', '中国', 'アメリカ', 'インド', 'フィリピン', 'ベトナム', 'イギリス'];
    const educationLevels = ['高校卒業', '専門学校卒業', '短大卒業', '大学卒業', '大学院修士', '大学院博士'];
    const employmentTypes = ['full_time', 'part_time', 'contract'];
    const disabilityStatuses = ['none', 'physical', 'mental', 'visual', 'hearing'];
    
    for (let i = 0; i < count; i++) {
      const employeeId = generateId('EMP');
      const name = randomChoice(JAPANESE_NAMES);
      const department = randomChoice(DEPARTMENTS);
      const position = randomChoice(POSITIONS);
      const gender = randomChoice(genders);
      const age = randomInt(22, 65);
      const nationality = randomChoice(nationalities);
      const educationLevel = randomChoice(educationLevels);
      const employmentType = randomChoice(employmentTypes);
      const disabilityStatus = Math.random() < 0.05 ? randomChoice(disabilityStatuses.slice(1)) : 'none';
      const hourlyRate = randomInt(1500, 5000);
      const joinDate = randomDate(new Date('2020-01-01'), new Date('2024-12-31'));
      const managerId = i > 0 && Math.random() < 0.7 ? this.employees[randomInt(0, Math.min(i-1, 10))].id : null;
      
      await this.run(`
        INSERT INTO employees (id, name, department, position, gender, age, nationality, education_level, employment_type, disability_status, hourly_rate, join_date, manager_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [employeeId, name, department, position, gender, age, nationality, educationLevel, employmentType, disabilityStatus, hourlyRate, joinDate.toISOString().split('T')[0], managerId, true]);
      
      this.employees.push({
        id: employeeId,
        name,
        department,
        position,
        gender,
        age,
        nationality,
        educationLevel,
        employmentType,
        disabilityStatus,
        hourlyRate,
        joinDate,
        managerId
      });
    }
    
    console.log(`✅ 従業員 ${count}名 挿入完了`);
  }

  // 従業員スキルデータ挿入
  async insertEmployeeSkills() {
    console.log('🎯 従業員スキルデータ挿入中...');
    
    let totalSkills = 0;
    
    for (const employee of this.employees) {
      // 各従業員に3-8個のスキルを割り当て
      const skillCount = randomInt(3, 8);
      const selectedSkills = [];
      
      // 部署・役職に応じてスキルを選択
      const departmentSkills = this.getRelevantSkills(employee.department, employee.position);
      
      for (let i = 0; i < skillCount; i++) {
        const skill = randomChoice(departmentSkills);
        if (!selectedSkills.find(s => s.id === skill.id)) {
          selectedSkills.push(skill);
        }
      }
      
      for (const skill of selectedSkills) {
        const skillId = generateId('EMPSKILL');
        const skillLevel = randomInt(1, 5);
        const assessmentDate = randomDate(new Date('2024-01-01'), new Date('2024-12-31'));
        const assessmentMethod = randomChoice(['self_assessment', 'manager_assessment', 'peer_review', 'certification']);
        const assessedBy = employee.managerId || employee.id;
        
        await this.run(`
          INSERT INTO employee_skills (employee_skill_id, employee_id, skill_id, skill_level, assessment_date, assessment_method, assessed_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [skillId, employee.id, skill.id, skillLevel, assessmentDate.toISOString().split('T')[0], assessmentMethod, assessedBy]);
        
        totalSkills++;
      }
    }
    
    console.log(`✅ 従業員スキル ${totalSkills}件 挿入完了`);
  }

  // 研修履歴データ挿入
  async insertTrainingHistory() {
    console.log('📖 研修履歴データ挿入中...');
    
    let totalTrainings = 0;
    
    for (const employee of this.employees) {
      // 各従業員に1-5個の研修を割り当て
      const trainingCount = randomInt(1, 5);
      
      for (let i = 0; i < trainingCount; i++) {
        const course = randomChoice(this.courses);
        const recordId = generateId('TRAINING');
        const enrollmentDate = randomDate(new Date('2024-01-01'), new Date('2024-12-31'));
        const startDate = new Date(enrollmentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const completionDate = Math.random() < 0.8 ? new Date(startDate.getTime() + course.duration * 24 * 60 * 60 * 1000) : null;
        const status = completionDate ? 'completed' : randomChoice(['enrolled', 'in_progress', 'cancelled']);
        const finalScore = completionDate ? randomFloat(60, 100) : null;
        const certificationEarned = completionDate && finalScore >= 80;
        
        await this.run(`
          INSERT INTO training_history (training_record_id, employee_id, course_id, enrollment_date, start_date, completion_date, status, final_score, certification_earned)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [recordId, employee.id, course.id, enrollmentDate.toISOString().split('T')[0], startDate.toISOString().split('T')[0], completionDate?.toISOString().split('T')[0], status, finalScore, certificationEarned]);
        
        totalTrainings++;
      }
    }
    
    console.log(`✅ 研修履歴 ${totalTrainings}件 挿入完了`);
  }

  // パフォーマンス評価データ挿入
  async insertPerformanceEvaluations() {
    console.log('⭐ パフォーマンス評価データ挿入中...');
    
    let totalEvaluations = 0;
    
    for (const employee of this.employees) {
      // 2024年の年次評価・半期評価
      const evaluationPeriods = ['2024年上期', '2024年下期', '2024年度'];
      
      for (const period of evaluationPeriods) {
        const evaluationId = generateId('EVAL');
        const evaluatorId = employee.managerId || employee.id;
        const evaluationType = period.includes('年度') ? 'annual' : 'semi_annual';
        const evaluationDate = randomDate(new Date('2024-01-01'), new Date('2024-12-31'));
        const overallRating = randomFloat(2.5, 5.0);
        const performanceScore = Math.round(overallRating);
        const retentionRisk = overallRating < 3.0 ? 'high' : overallRating < 4.0 ? 'medium' : 'low';
        const promotionReadiness = overallRating >= 4.5 ? 'ready' : overallRating >= 4.0 ? 'ready_soon' : 'not_ready';
        
        await this.run(`
          INSERT INTO performance_evaluations (id, employee_id, evaluator_id, evaluation_period, evaluation_type, overall_rating, performance_metrics, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [evaluationId, employee.id, evaluatorId, period, evaluationType, overallRating, JSON.stringify({
          performance_score: performanceScore,
          retention_risk_level: retentionRisk,
          promotion_readiness: promotionReadiness
        }), 'finalized']);
        
        totalEvaluations++;
      }
    }
    
    console.log(`✅ パフォーマンス評価 ${totalEvaluations}件 挿入完了`);
  }

  // エンゲージメント調査データ挿入
  async insertEngagementSurveys() {
    console.log('🤝 エンゲージメント調査データ挿入中...');
    
    // 年次エンゲージメントサーベイ
    const surveyId = generateId('SURVEY');
    await this.run(`
      INSERT INTO employee_engagement_surveys (id, survey_name, survey_type, survey_period, questions, launch_date, close_date, participation_rate, response_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [surveyId, '2024年度従業員エンゲージメント調査', 'annual', '2024年度', JSON.stringify([
      '仕事にやりがいを感じますか？',
      '会社の方向性に共感できますか？',
      '上司・同僚との関係は良好ですか？',
      '仕事とプライベートのバランスは取れていますか？',
      '会社を友人に勧めたいですか？'
    ]), '2024-10-01', '2024-10-31', 85.5, 78.2]);
    
    // 各従業員の回答データ
    let totalResponses = 0;
    
    for (const employee of this.employees) {
      if (Math.random() < 0.78) { // 78%の回答率
        const responseId = generateId('RESPONSE');
        const responseDate = randomDate(new Date('2024-10-01'), new Date('2024-10-31'));
        const overallSatisfaction = randomFloat(2.0, 5.0);
        const enpsScore = Math.round(overallSatisfaction * 2);
        const engagementScore = randomFloat(2.5, 5.0);
        const wellbeingScore = randomFloat(2.0, 5.0);
        
        await this.run(`
          INSERT INTO survey_responses (id, survey_id, employee_id, responses, response_date, overall_satisfaction)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [responseId, surveyId, employee.id, JSON.stringify({
          q1: Math.round(randomFloat(1, 5)),
          q2: Math.round(randomFloat(1, 5)),
          q3: Math.round(randomFloat(1, 5)),
          q4: Math.round(randomFloat(1, 5)),
          q5: Math.round(randomFloat(1, 5)),
          enps_score: enpsScore,
          engagement_score: engagementScore,
          wellbeing_score: wellbeingScore
        }), responseDate.toISOString().split('T')[0], overallSatisfaction]);
        
        totalResponses++;
      }
    }
    
    console.log(`✅ エンゲージメント調査 ${totalResponses}件 挿入完了`);
  }

  // 健康・安全データ挿入
  async insertHealthSafetyData() {
    console.log('🛡️ 健康・安全データ挿入中...');
    
    let totalIncidents = 0;
    
    // 一部の従業員に健康・安全事案を割り当て
    const incidentCount = randomInt(3, 8);
    
    for (let i = 0; i < incidentCount; i++) {
      const employee = randomChoice(this.employees);
      const incidentId = generateId('INCIDENT');
      const incidentDate = randomDate(new Date('2024-01-01'), new Date('2024-12-31'));
      const incidentType = randomChoice(['workplace_injury', 'near_miss', 'safety_violation']);
      const severityLevel = randomChoice(['minor', 'moderate', 'major']);
      const lostTimeHours = severityLevel === 'major' ? randomInt(8, 40) : severityLevel === 'moderate' ? randomInt(1, 8) : 0;
      
      await this.run(`
        INSERT INTO health_safety_incidents (incident_id, employee_id, incident_date, incident_type, severity_level, description, lost_time_hours, medical_treatment_required, investigation_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [incidentId, employee.id, incidentDate.toISOString().split('T')[0], incidentType, severityLevel, `${incidentType}が発生しました`, lostTimeHours, severityLevel !== 'minor', 'completed']);
      
      totalIncidents++;
    }
    
    console.log(`✅ 健康・安全事案 ${totalIncidents}件 挿入完了`);
  }

  // コンプライアンス事案データ挿入
  async insertComplianceIncidents() {
    console.log('📋 コンプライアンス事案データ挿入中...');
    
    let totalIncidents = 0;
    
    // 少数のコンプライアンス事案を生成
    const incidentCount = randomInt(1, 3);
    
    for (let i = 0; i < incidentCount; i++) {
      const incidentId = generateId('COMPLIANCE');
      const reportDate = randomDate(new Date('2024-01-01'), new Date('2024-12-31'));
      const incidentType = randomChoice(['harassment', 'discrimination', 'ethics_violation']);
      const affectedEmployee = randomChoice(this.employees);
      const department = affectedEmployee.department;
      
      await this.run(`
        INSERT INTO compliance_incidents (incident_id, incident_type, report_date, affected_employee_id, department, description, status, confidentiality_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [incidentId, incidentType, reportDate.toISOString().split('T')[0], affectedEmployee.id, department, `${incidentType}に関する事案`, 'resolved', 'confidential']);
      
      totalIncidents++;
    }
    
    console.log(`✅ コンプライアンス事案 ${totalIncidents}件 挿入完了`);
  }

  // 勤怠データ挿入（時間外労働含む）
  async insertTimeRecords() {
    console.log('⏰ 勤怠データ挿入中...');
    
    let totalRecords = 0;
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');
    
    for (const employee of this.employees) {
      // 各従業員に月平均18日の勤怠データを生成
      const monthlyWorkDays = 18;
      const totalWorkDays = monthlyWorkDays * 12;
      
      for (let i = 0; i < totalWorkDays; i++) {
        const workDate = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000 * 365 / totalWorkDays));
        
        // 週末をスキップ
        if (workDate.getDay() === 0 || workDate.getDay() === 6) continue;
        
        const recordId = generateId('TIME');
        const clockIn = new Date(workDate);
        clockIn.setHours(9, randomInt(0, 30), 0, 0);
        
        const clockOut = new Date(clockIn);
        const workHours = randomFloat(8, 12); // 8-12時間の労働時間
        clockOut.setHours(clockIn.getHours() + Math.floor(workHours), (workHours % 1) * 60, 0, 0);
        
        const breakMinutes = workHours > 8 ? 60 : 45;
        
        await this.run(`
          INSERT INTO time_records (id, employee_id, date, clock_in, clock_out, break_minutes, record_type)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [recordId, employee.id, workDate.toISOString().split('T')[0], clockIn.toISOString(), clockOut.toISOString(), breakMinutes, 'ic_card']);
        
        totalRecords++;
      }
    }
    
    console.log(`✅ 勤怠データ ${totalRecords}件 挿入完了`);
  }

  // 部署・役職に応じた関連スキルを取得
  getRelevantSkills(department, position) {
    let relevantSkills = [...this.skills];
    
    // 部署に応じてスキルを重み付け
    if (department.includes('開発') || department.includes('エンジニア')) {
      relevantSkills = relevantSkills.filter(s => s.type === 'technical').concat(
        relevantSkills.filter(s => s.type === 'soft')
      );
    } else if (department.includes('営業')) {
      relevantSkills = relevantSkills.filter(s => s.type === 'domain_specific' || s.type === 'soft');
    } else if (department.includes('人事') || department.includes('経営')) {
      relevantSkills = relevantSkills.filter(s => s.type === 'leadership' || s.type === 'soft');
    }
    
    // 役職に応じてリーダーシップスキルを追加
    if (position.includes('部長') || position.includes('マネージャー') || position.includes('リーダー')) {
      relevantSkills = relevantSkills.concat(
        this.skills.filter(s => s.type === 'leadership')
      );
    }
    
    return relevantSkills.length > 0 ? relevantSkills : this.skills;
  }

  // データベース実行ヘルパー
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  // データベース接続を閉じる
  close() {
    return new Promise((resolve) => {
      this.db.close(resolve);
    });
  }
}

// メイン実行
async function main() {
  const generator = new DemoDataGenerator();
  
  try {
    await generator.generateData();
    console.log('\n🎉 大規模デモデータ生成が完了しました！');
    console.log('📊 人的資本開示システムの検証が可能です。');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await generator.close();
  }
}

// スクリプトが直接実行された場合
if (require.main === module) {
  main();
}

module.exports = DemoDataGenerator;