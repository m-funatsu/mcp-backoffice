import Database from '../src/database.js';

async function initializeDatabase() {
  console.log('🗄️  データベース初期化開始...');
  
  try {
    // 本番データベース初期化
    console.log('📊 本番データベース接続...');
    const prodDb = new Database(process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/attendance');
    await prodDb.initializeDatabase();
    console.log('✅ 本番データベース初期化完了');
    
    // テストデータベース初期化
    console.log('🧪 テストデータベース接続...');
    const testDb = new Database(process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5433/attendance_test');
    await testDb.initializeDatabase();
    console.log('✅ テストデータベース初期化完了');
    
    // 基本データ投入
    console.log('📋 基本データ投入...');
    await insertBasicData(prodDb);
    await insertBasicData(testDb);
    console.log('✅ 基本データ投入完了');
    
    console.log('🎉 データベース初期化すべて完了！');
    
  } catch (error) {
    console.error('❌ データベース初期化エラー:', error);
    process.exit(1);
  }
}

async function insertBasicData(db: Database) {
  try {
    // サンプル従業員データ
    const employees = [
      {
        name: '田中太郎',
        email: 'tanaka@example.com',
        department: '開発部',
        position: 'エンジニア',
        hourlyRate: 3000,
        startDate: new Date('2024-01-01'),
        isActive: true
      },
      {
        name: '佐藤花子',
        email: 'sato@example.com',
        department: '人事部',
        position: 'HRマネージャー',
        hourlyRate: 3500,
        startDate: new Date('2024-01-01'),
        isActive: true
      },
      {
        name: '鈴木一郎',
        email: 'suzuki@example.com',
        department: '営業部',
        position: '営業',
        hourlyRate: 2800,
        startDate: new Date('2024-01-01'),
        isActive: true
      }
    ];
    
    for (const employee of employees) {
      try {
        await db.addEmployee(employee);
        console.log(`  ✅ 従業員追加: ${employee.name}`);
      } catch (error) {
        // 重複エラーは無視
        if (!error.message.includes('duplicate')) {
          console.warn(`  ⚠️  従業員追加スキップ: ${employee.name} - ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('基本データ投入エラー:', error);
  }
}

// スクリプト実行
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().catch(console.error);
}