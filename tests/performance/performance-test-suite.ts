import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import { DatabasePostgreSQL } from '../../src/database_postgresql';
import { IntegratedPayrollEngine } from '../../src/payroll-engine';
import { ComplianceEngine } from '../../src/compliance-engine';
import ExpenseManagementEngine from '../../src/expense-engine';
import { TalentManagementEngine } from '../../src/talent-management-engine-v2.2.0';
import { SkillManagementEngine } from '../../src/skill-management-engine-v2.3.0';
import { GenerativeUIEngine } from '../../src/generative-ui-engine-v3.1.0';
import type { Employee, TimeRecord } from '../../src/types';

/**
 * パフォーマンステストスイート
 * 目標: 各主要機能が規定の応答時間内に完了することを確認
 */
describe('パフォーマンステストスイート', () => {
  let db: DatabasePostgreSQL;
  let payrollEngine: IntegratedPayrollEngine;
  let complianceEngine: ComplianceEngine;
  let expenseEngine: ExpenseManagementEngine;
  let talentEngine: TalentManagementEngine;
  let skillEngine: SkillManagementEngine;
  let uiEngine: GenerativeUIEngine;

  // テストデータ
  let testEmployees: Employee[];
  let testTimeRecords: TimeRecord[];

  beforeAll(async () => {
    // データベース接続（実際のDBを使用）
    db = new DatabasePostgreSQL({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'hrplatform_test',
      user: process.env.TEST_DB_USER || 'test_user',
      password: process.env.TEST_DB_PASSWORD || 'test_password'
    });

    // エンジン初期化
    payrollEngine = new IntegratedPayrollEngine(db);
    complianceEngine = new ComplianceEngine(db);
    expenseEngine = new ExpenseManagementEngine(db);
    talentEngine = new TalentManagementEngine(db);
    skillEngine = new SkillManagementEngine(db);
    uiEngine = new GenerativeUIEngine();

    // テストデータ生成
    testEmployees = generateLargeDataset(1000);
    testTimeRecords = generateTimeRecords(testEmployees, 30);
  });

  afterAll(async () => {
    await db.close();
  });

  describe('給与計算パフォーマンス', () => {
    it('50名の給与計算を10秒以内に完了する', async () => {
      const employees = testEmployees.slice(0, 50);
      const startTime = performance.now();

      const results = await Promise.all(
        employees.map(emp => 
          payrollEngine.calculatePayroll(emp.id, '2025-07')
        )
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(10000); // 10秒以内
      console.log(`50名給与計算時間: ${duration.toFixed(2)}ms`);
    });

    it('1000名の給与計算を60秒以内に完了する', async () => {
      const startTime = performance.now();
      const batchSize = 100;
      const results = [];

      // バッチ処理
      for (let i = 0; i < testEmployees.length; i += batchSize) {
        const batch = testEmployees.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(emp => 
            payrollEngine.calculatePayroll(emp.id, '2025-07')
          )
        );
        results.push(...batchResults);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(1000);
      expect(duration).toBeLessThan(60000); // 60秒以内
      console.log(`1000名給与計算時間: ${duration.toFixed(2)}ms`);
    });
  });

  describe('コンプライアンスチェックパフォーマンス', () => {
    it('100名の36協定チェックを5秒以内に完了する', async () => {
      const employees = testEmployees.slice(0, 100);
      const startTime = performance.now();

      const results = await Promise.all(
        employees.map(emp => 
          complianceEngine.monitor36Agreement(emp.id, new Date('2025-07-31'))
        )
      );

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // 5秒以内
      console.log(`100名コンプライアンスチェック時間: ${duration.toFixed(2)}ms`);
    });
  });

  describe('データベースクエリパフォーマンス', () => {
    it('複雑な集計クエリを1秒以内に実行する', async () => {
      const startTime = performance.now();

      const query = `
        WITH monthly_stats AS (
          SELECT 
            e.department,
            DATE_TRUNC('month', tr.date) as month,
            COUNT(DISTINCT e.id) as employee_count,
            SUM(EXTRACT(EPOCH FROM (tr.clock_out - tr.clock_in)) / 3600) as total_hours,
            AVG(EXTRACT(EPOCH FROM (tr.clock_out - tr.clock_in)) / 3600) as avg_hours
          FROM employees e
          JOIN time_records tr ON e.id = tr.employee_id
          WHERE tr.date >= CURRENT_DATE - INTERVAL '6 months'
          GROUP BY e.department, DATE_TRUNC('month', tr.date)
        )
        SELECT 
          department,
          month,
          employee_count,
          total_hours,
          avg_hours,
          LAG(total_hours) OVER (PARTITION BY department ORDER BY month) as prev_month_hours,
          (total_hours - LAG(total_hours) OVER (PARTITION BY department ORDER BY month)) / 
            NULLIF(LAG(total_hours) OVER (PARTITION BY department ORDER BY month), 0) * 100 as growth_rate
        FROM monthly_stats
        ORDER BY department, month DESC
      `;

      const result = await db.query(query);
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000); // 1秒以内
      console.log(`複雑集計クエリ実行時間: ${duration.toFixed(2)}ms`);
    });
  });

  describe('自然言語処理パフォーマンス', () => {
    it('自然言語クエリを500ms以内に処理する', async () => {
      const queries = [
        '開発チームの今月の残業状況を見せて',
        '女性管理職の比率と推移をグラフで表示',
        '営業部の離職リスクが高い従業員をリストアップ',
        'エンジニアのスキル分布を可視化して',
        '全社の有給取得率を部門別に比較'
      ];

      for (const query of queries) {
        const startTime = performance.now();
        
        const result = await uiEngine.generateUI(query, {
          userId: 'test_user',
          role: 'manager',
          permissions: ['view_all']
        });

        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(duration).toBeLessThan(500); // 500ms以内
        console.log(`NLUクエリ処理時間 "${query.substring(0, 20)}...": ${duration.toFixed(2)}ms`);
      }
    });
  });

  describe('同時実行性能', () => {
    it('100同時リクエストを適切に処理する', async () => {
      const concurrentRequests = 100;
      const requests = [];

      const startTime = performance.now();

      // 様々な種類のリクエストを同時実行
      for (let i = 0; i < concurrentRequests; i++) {
        const requestType = i % 4;
        switch (requestType) {
          case 0:
            requests.push(
              payrollEngine.calculatePayroll(
                testEmployees[i % testEmployees.length].id, 
                '2025-07'
              )
            );
            break;
          case 1:
            requests.push(
              complianceEngine.monitor36Agreement(
                testEmployees[i % testEmployees.length].id,
                new Date('2025-07-31')
              )
            );
            break;
          case 2:
            requests.push(
              talentEngine.assessTalent(
                testEmployees[i % testEmployees.length].id,
                {
                  performanceRating: 4.0,
                  potentialRating: 4.5,
                  assessedBy: 'mgr001'
                }
              )
            );
            break;
          case 3:
            requests.push(
              skillEngine.assessSkill(
                testEmployees[i % testEmployees.length].id,
                'programming',
                {
                  selfAssessment: 4,
                  managerAssessment: 4
                }
              )
            );
            break;
        }
      }

      const results = await Promise.allSettled(requests);
      const endTime = performance.now();
      const duration = endTime - startTime;

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const errorCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount).toBeGreaterThan(95); // 95%以上成功
      expect(duration).toBeLessThan(30000); // 30秒以内
      console.log(`100同時リクエスト処理時間: ${duration.toFixed(2)}ms (成功: ${successCount}, エラー: ${errorCount})`);
    });
  });

  describe('メモリ使用効率', () => {
    it('大量データ処理時のメモリ使用量が適切である', async () => {
      const initialMemory = process.memoryUsage();
      
      // 10000件の経費データを処理
      const largeExpenseData = generateLargeExpenseData(10000);
      
      const startTime = performance.now();
      const batchSize = 1000;
      
      for (let i = 0; i < largeExpenseData.length; i += batchSize) {
        const batch = largeExpenseData.slice(i, i + batchSize);
        await Promise.all(
          batch.map(expense => 
            expenseEngine.evaluateApprovalRisk(expense)
          )
        );
        
        // ガベージコレクションの機会を与える
        if (global.gc) {
          global.gc();
        }
      }
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      
      const memoryIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
      const duration = endTime - startTime;
      
      expect(memoryIncrease).toBeLessThan(500); // 500MB以下
      console.log(`大量データ処理メモリ増加: ${memoryIncrease.toFixed(2)}MB, 処理時間: ${duration.toFixed(2)}ms`);
    });
  });

  describe('キャッシュ効率', () => {
    it('キャッシュヒット率が80%以上である', async () => {
      const cacheStats = {
        hits: 0,
        misses: 0
      };

      // 同じデータに対して複数回アクセス
      const employeeId = testEmployees[0].id;
      
      // 初回アクセス（キャッシュミス）
      await db.getEmployee(employeeId);
      cacheStats.misses++;

      // 2回目以降（キャッシュヒット期待）
      for (let i = 0; i < 9; i++) {
        const startTime = performance.now();
        await db.getEmployee(employeeId);
        const duration = performance.now() - startTime;
        
        if (duration < 5) { // 5ms以下ならキャッシュヒットと判定
          cacheStats.hits++;
        } else {
          cacheStats.misses++;
        }
      }

      const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
      expect(hitRate).toBeGreaterThan(0.8); // 80%以上
      console.log(`キャッシュヒット率: ${(hitRate * 100).toFixed(2)}%`);
    });
  });
});

// テストデータ生成関数
function generateLargeDataset(count: number): Employee[] {
  const departments = ['営業部', '開発部', '人事部', '経理部', '製造部'];
  const positions = ['スタッフ', 'リーダー', 'マネージャー', '部長', '執行役員'];
  
  return Array(count).fill(null).map((_, i) => ({
    id: `emp${String(i + 1).padStart(5, '0')}`,
    name: `従業員 ${i + 1}`,
    email: `employee${i + 1}@example.com`,
    department: departments[i % departments.length],
    position: positions[Math.floor(i / 200) % positions.length],
    hourlyWage: 2000 + Math.floor(Math.random() * 3000),
    startDate: new Date(Date.now() - Math.random() * 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    isActive: true,
    managerId: i > 10 ? `emp${String(Math.floor(i / 10)).padStart(5, '0')}` : undefined
  }));
}

function generateTimeRecords(employees: Employee[], days: number): TimeRecord[] {
  const records: TimeRecord[] = [];
  const baseDate = new Date('2025-07-01');
  
  employees.forEach(emp => {
    for (let day = 0; day < days; day++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + day);
      
      if (date.getDay() === 0 || date.getDay() === 6) continue;
      
      records.push({
        id: `tr_${emp.id}_${day}`,
        employeeId: emp.id,
        date,
        clockIn: new Date(date.setHours(9, Math.floor(Math.random() * 30), 0, 0)),
        clockOut: new Date(date.setHours(18 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0)),
        breakMinutes: 60,
        recordType: 'ic_card'
      });
    }
  });
  
  return records;
}

function generateLargeExpenseData(count: number): any[] {
  const categories = ['交通費', '会議費', '接待交際費', '消耗品費', '通信費'];
  
  return Array(count).fill(null).map((_, i) => ({
    id: `exp${String(i + 1).padStart(6, '0')}`,
    employeeId: `emp${String((i % 1000) + 1).padStart(5, '0')}`,
    amount: Math.floor(Math.random() * 50000) + 1000,
    categoryId: categories[i % categories.length],
    description: `経費 ${i + 1}`,
    expenseDate: new Date(2025, 6, (i % 30) + 1),
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  }));
}