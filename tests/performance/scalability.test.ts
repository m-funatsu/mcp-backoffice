import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from '../../src/database.js';
import PayrollCalculator from '../../src/payroll.js';
import { defaultPayrollRules } from '../setup/test-db.js';

describe('Performance & Scalability Tests', () => {
  let db: Database;
  let payrollCalculator: PayrollCalculator;
  let performanceMetrics: any = {};

  beforeAll(async () => {
    db = new Database(':memory:');
    try {
      await db.initializeDatabase();
    } catch (error) {
      // Database might already be initialized
    }
    payrollCalculator = new PayrollCalculator(db as any, defaultPayrollRules);
  });

  describe('Large Dataset Performance', () => {
    it('should handle 100 employees efficiently', async () => {
      const employeeCount = 100;
      const timeRecordsPerEmployee = 30; // 1ヶ月分
      
      console.log(`\n🚀 Performance Test: ${employeeCount} employees, ${timeRecordsPerEmployee} records each`);
      
      // 従業員データ生成時間測定
      const employeeCreationStart = Date.now();
      const employeeIds: string[] = [];
      
      for (let i = 1; i <= employeeCount; i++) {
        const employeeId = await db.addEmployee({
          name: `テスト従業員${i.toString().padStart(3, '0')}`,
          department: `部署${Math.ceil(i / 10)}`,
          position: i % 2 === 0 ? 'エンジニア' : 'マネージャー',
          hourlyRate: 2500 + (i % 10) * 200, // 2500-4300円の範囲
          joinDate: new Date(`2024-0${Math.ceil(i / 20)}-01`),
          isActive: true
        });
        employeeIds.push(employeeId);
      }
      
      const employeeCreationTime = Date.now() - employeeCreationStart;
      performanceMetrics.employeeCreation = {
        count: employeeCount,
        timeMs: employeeCreationTime,
        avgPerEmployee: employeeCreationTime / employeeCount
      };
      
      console.log(`✅ Employee creation: ${employeeCreationTime}ms (${(employeeCreationTime / employeeCount).toFixed(2)}ms per employee)`);
      
      // 勤怠記録生成時間測定
      const timeRecordCreationStart = Date.now();
      let totalTimeRecords = 0;
      
      for (const employeeId of employeeIds) {
        for (let day = 1; day <= timeRecordsPerEmployee; day++) {
          const date = new Date(`2024-07-${day.toString().padStart(2, '0')}`);
          
          // 週末をスキップ
          if (date.getDay() === 0 || date.getDay() === 6) continue;
          
          const clockIn = new Date(date);
          clockIn.setHours(9 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60)); // 9-11時の間でランダム
          
          const workingHours = 8 + Math.random() * 4; // 8-12時間のランダム
          const clockOut = new Date(clockIn.getTime() + workingHours * 60 * 60 * 1000);
          
          await db.clockIn(employeeId, clockIn, 'ic_card');
          await db.clockOut(employeeId, clockOut, 60); // 1時間の休憩
          totalTimeRecords++;
        }
      }
      
      const timeRecordCreationTime = Date.now() - timeRecordCreationStart;
      performanceMetrics.timeRecordCreation = {
        count: totalTimeRecords,
        timeMs: timeRecordCreationTime,
        avgPerRecord: timeRecordCreationTime / totalTimeRecords
      };
      
      console.log(`✅ Time record creation: ${timeRecordCreationTime}ms (${totalTimeRecords} records, ${(timeRecordCreationTime / totalTimeRecords).toFixed(2)}ms per record)`);
      
      // 給与計算パフォーマンステスト
      const payrollCalculationStart = Date.now();
      const payrollResults = [];
      
      for (const employeeId of employeeIds) {
        const payroll = await payrollCalculator.calculateMonthlyPayroll(employeeId, '2024-07');
        payrollResults.push(payroll);
      }
      
      const payrollCalculationTime = Date.now() - payrollCalculationStart;
      performanceMetrics.payrollCalculation = {
        count: employeeCount,
        timeMs: payrollCalculationTime,
        avgPerEmployee: payrollCalculationTime / employeeCount
      };
      
      console.log(`✅ Payroll calculation: ${payrollCalculationTime}ms (${(payrollCalculationTime / employeeCount).toFixed(2)}ms per employee)`);
      
      // 月次サマリー生成パフォーマンステスト
      const summaryGenerationStart = Date.now();
      const summary = await payrollCalculator.generatePayrollSummary('2024-07');
      const summaryGenerationTime = Date.now() - summaryGenerationStart;
      
      performanceMetrics.summaryGeneration = {
        employeeCount: employeeCount,
        timeMs: summaryGenerationTime,
        totalPay: summary.totalPay
      };
      
      console.log(`✅ Summary generation: ${summaryGenerationTime}ms (total pay: ¥${summary.totalPay.toLocaleString()})`);
      
      // パフォーマンス基準の検証
      expect(employeeCreationTime).toBeLessThan(30000); // 30秒以内
      expect(timeRecordCreationTime).toBeLessThan(60000); // 60秒以内
      expect(payrollCalculationTime).toBeLessThan(30000); // 30秒以内
      expect(summaryGenerationTime).toBeLessThan(10000); // 10秒以内
      
      // 結果の妥当性確認
      expect(payrollResults).toHaveLength(employeeCount);
      expect(summary.totalEmployees).toBe(employeeCount);
      expect(summary.totalPay).toBeGreaterThan(0);
    });

    it('should handle 1000 employees with acceptable performance degradation', async () => {
      const employeeCount = 1000;
      const batchSize = 100; // バッチ処理でメモリ効率を改善
      
      console.log(`\n🚀 Stress Test: ${employeeCount} employees in batches of ${batchSize}`);
      
      const stressTestStart = Date.now();
      const employeeIds: string[] = [];
      
      // バッチ処理で従業員を作成
      for (let batch = 0; batch < employeeCount / batchSize; batch++) {
        const batchStart = Date.now();
        
        for (let i = 1; i <= batchSize; i++) {
          const employeeIndex = batch * batchSize + i;
          const employeeId = await db.addEmployee({
            name: `大規模テスト従業員${employeeIndex.toString().padStart(4, '0')}`,
            department: `部署${Math.ceil(employeeIndex / 50)}`,
            position: employeeIndex % 3 === 0 ? 'シニアエンジニア' : 
                     employeeIndex % 3 === 1 ? 'エンジニア' : 'マネージャー',
            hourlyRate: 2000 + (employeeIndex % 20) * 150,
            joinDate: new Date(`2024-0${Math.min(Math.ceil(employeeIndex / 200), 9)}-01`),
            isActive: true
          });
          employeeIds.push(employeeId);
        }
        
        const batchTime = Date.now() - batchStart;
        console.log(`  Batch ${batch + 1}/${employeeCount / batchSize}: ${batchTime}ms`);
        
        // バッチ間で少し待機してメモリプレッシャーを軽減
        if (batch % 5 === 4) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // サンプリングベースの給与計算（全員ではなく代表的な従業員のみ）
      const sampleSize = 50;
      const sampleIndices = Array.from({length: sampleSize}, (_, i) => 
        Math.floor(i * employeeCount / sampleSize)
      );
      
      const payrollSampleStart = Date.now();
      const samplePayrolls = [];
      
      for (const index of sampleIndices) {
        const employeeId = employeeIds[index];
        
        // 簡単な勤怠記録を1件だけ作成
        const clockIn = new Date('2024-07-15T09:00:00');
        const clockOut = new Date('2024-07-15T18:00:00');
        
        await db.clockIn(employeeId, clockIn, 'ic_card');
        await db.clockOut(employeeId, clockOut, 60);
        
        const payroll = await payrollCalculator.calculateMonthlyPayroll(employeeId, '2024-07');
        samplePayrolls.push(payroll);
      }
      
      const payrollSampleTime = Date.now() - payrollSampleStart;
      const totalStressTestTime = Date.now() - stressTestStart;
      
      performanceMetrics.stressTest = {
        totalEmployees: employeeCount,
        sampleSize: sampleSize,
        totalTimeMs: totalStressTestTime,
        payrollSampleTimeMs: payrollSampleTime,
        avgPayrollTimeMs: payrollSampleTime / sampleSize
      };
      
      console.log(`✅ Stress test completed: ${totalStressTestTime}ms total`);
      console.log(`✅ Sample payroll calculation: ${payrollSampleTime}ms for ${sampleSize} employees`);
      console.log(`✅ Estimated full payroll time: ${(payrollSampleTime * employeeCount / sampleSize / 1000).toFixed(1)}s`);
      
      // ストレステストの許容基準
      expect(totalStressTestTime).toBeLessThan(180000); // 3分以内
      expect(payrollSampleTime / sampleSize).toBeLessThan(1000); // 1秒/従業員以内
      expect(samplePayrolls).toHaveLength(sampleSize);
      
      // メモリ使用量の概算（V8の場合）
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
        const memoryUsage = process.memoryUsage();
        console.log(`📊 Memory usage: ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        
        performanceMetrics.memoryUsage = {
          heapUsedMB: memoryUsage.heapUsed / 1024 / 1024,
          heapTotalMB: memoryUsage.heapTotal / 1024 / 1024,
          externalMB: memoryUsage.external / 1024 / 1024
        };
      }
    });
  });

  describe('Query Performance Optimization', () => {
    it('should efficiently query time records with date ranges', async () => {
      const testEmployeeId = await db.addEmployee({
        name: 'クエリテスト従業員',
        department: 'テスト部',
        position: 'パフォーマンステスター',
        hourlyRate: 3000,
        joinDate: new Date('2024-01-01'),
        isActive: true
      });

      // 大量の時系列データを作成
      const recordCount = 1000;
      const dateStart = new Date('2024-01-01');
      
      const insertStart = Date.now();
      for (let i = 0; i < recordCount; i++) {
        const date = new Date(dateStart.getTime() + i * 24 * 60 * 60 * 1000);
        const clockIn = new Date(date);
        clockIn.setHours(9, 0, 0, 0);
        const clockOut = new Date(clockIn.getTime() + 8 * 60 * 60 * 1000);
        
        await db.clockIn(testEmployeeId, clockIn, 'ic_card');
        await db.clockOut(testEmployeeId, clockOut, 60);
      }
      const insertTime = Date.now() - insertStart;
      
      // 範囲クエリのパフォーマンステスト
      const queryStart = Date.now();
      const records = await db.getTimeRecords(
        testEmployeeId,
        new Date('2024-06-01'),
        new Date('2024-06-30')
      );
      const queryTime = Date.now() - queryStart;
      
      performanceMetrics.queryPerformance = {
        totalRecords: recordCount,
        insertTimeMs: insertTime,
        queryTimeMs: queryTime,
        resultCount: records.length,
        queryEfficiency: queryTime / records.length
      };
      
      console.log(`✅ Query performance: ${queryTime}ms for ${records.length} records out of ${recordCount} total`);
      console.log(`✅ Insert performance: ${insertTime}ms for ${recordCount} records (${(insertTime / recordCount).toFixed(2)}ms per record)`);
      
      // クエリが効率的であることを確認
      expect(queryTime).toBeLessThan(1000); // 1秒以内
      expect(records.length).toBeGreaterThan(0);
      expect(records.length).toBeLessThan(recordCount); // 範囲クエリなので全件より少ない
    });
  });

  afterAll(() => {
    console.log('\n📊 Performance Test Summary:');
    console.log(JSON.stringify(performanceMetrics, null, 2));
    
    // パフォーマンス基準の総合評価
    const overallPerformance = {
      employeeCreationEfficient: performanceMetrics.employeeCreation?.avgPerEmployee < 100,
      payrollCalculationEfficient: performanceMetrics.payrollCalculation?.avgPerEmployee < 300,
      queryEfficient: performanceMetrics.queryPerformance?.queryTimeMs < 1000,
      memoryEfficient: !performanceMetrics.memoryUsage || performanceMetrics.memoryUsage.heapUsedMB < 512
    };
    
    console.log('\n🎯 Performance Criteria:');
    Object.entries(overallPerformance).forEach(([criterion, passed]) => {
      console.log(`  ${passed ? '✅' : '❌'} ${criterion}: ${passed ? 'PASS' : 'FAIL'}`);
    });
    
    const allCriteriaMet = Object.values(overallPerformance).every(Boolean);
    expect(allCriteriaMet).toBe(true);
  });
});