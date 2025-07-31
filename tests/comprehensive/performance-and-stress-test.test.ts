import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DatabasePostgreSQL } from '../../src/database_postgresql';
import { IntegratedPayrollEngine } from '../../src/payroll-engine';
import { ComplianceEngine } from '../../src/compliance-engine';
import ExpenseManagementEngine from '../../src/expense-engine';
import HumanCapitalDisclosureEngine from '../../src/human-capital-disclosure-engine-v2.0.0';
import PredictiveAnalyticsEngine from '../../src/predictive-analytics-engine-v2.1.0';
import { AgentOrchestrator } from '../../src/agent-framework-v3.0.0';
import { PerformanceOptimizer } from '../../src/performance-optimizer';
import type { Employee, TimeRecord, ExpenseRequest } from '../../src/types';

/**
 * パフォーマンス・負荷テストスイート
 * 大規模データ、高負荷、並行処理のパフォーマンスを検証
 */
describe('パフォーマンス・負荷テストスイート', () => {
  let db: DatabasePostgreSQL;
  let payrollEngine: IntegratedPayrollEngine;
  let complianceEngine: ComplianceEngine;
  let expenseEngine: ExpenseManagementEngine;
  let humanCapitalEngine: HumanCapitalDisclosureEngine;
  let predictiveEngine: PredictiveAnalyticsEngine;
  let agentOrchestrator: AgentOrchestrator;
  let performanceOptimizer: PerformanceOptimizer;

  // パフォーマンス測定用
  const performanceMetrics = {
    operations: [],
    startTime: 0,
    endTime: 0
  };

  beforeAll(async () => {
    db = createHighPerformanceDatabase();
    payrollEngine = new IntegratedPayrollEngine(db);
    complianceEngine = new ComplianceEngine(db);
    expenseEngine = new ExpenseManagementEngine(db);
    humanCapitalEngine = new HumanCapitalDisclosureEngine(db);
    predictiveEngine = new PredictiveAnalyticsEngine(db);
    agentOrchestrator = new AgentOrchestrator(db);
    performanceOptimizer = new PerformanceOptimizer(
      { max: 100, min: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000, statementTimeout: 10000 },
      'redis://localhost:6379',
      50
    );
  });

  afterAll(async () => {
    await performanceOptimizer.close();
    
    // パフォーマンスレポートの生成
    const report = generatePerformanceReport(performanceMetrics);
    console.log('Performance Report:', report);
  });

  describe('1. 大規模データ処理のパフォーマンス', () => {
    it('100万件の勤怠記録を処理する', async () => {
      const employeeCount = 10000;
      const daysPerEmployee = 100;
      const totalRecords = employeeCount * daysPerEmployee;

      console.log(`Processing ${totalRecords.toLocaleString()} time records...`);

      const startTime = performance.now();

      // バッチ生成とストリーミング処理
      const batchSize = 10000;
      let processedCount = 0;

      for (let batch = 0; batch < totalRecords / batchSize; batch++) {
        const records = generateTimeRecordBatch(batch * batchSize, batchSize);
        
        // ストリーム処理
        await performanceOptimizer.streamProcess(
          records,
          async (record) => {
            // 軽量な処理をシミュレート
            const hours = calculateWorkHours(record);
            return { recordId: record.id, hours };
          },
          { concurrency: 100 }
        );

        processedCount += batchSize;
        
        // 進捗表示
        if (processedCount % 100000 === 0) {
          const elapsed = performance.now() - startTime;
          const rate = processedCount / (elapsed / 1000);
          console.log(`Processed: ${processedCount.toLocaleString()} | Rate: ${Math.round(rate).toLocaleString()} records/sec`);
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const throughput = totalRecords / (totalTime / 1000);

      performanceMetrics.operations.push({
        name: 'million_time_records',
        records: totalRecords,
        time: totalTime,
        throughput
      });

      expect(throughput).toBeGreaterThan(10000); // 10,000件/秒以上
      expect(totalTime).toBeLessThan(120000); // 2分以内
    });

    it('10万人の給与計算を並列実行する', async () => {
      const employees = generateLargeEmployeeDataset(100000);
      const month = '2025-07';

      const startTime = performance.now();

      // 並列度を調整しながらバッチ処理
      const optimalConcurrency = await performanceOptimizer.findOptimalConcurrency(
        async (concurrency) => {
          const testBatch = employees.slice(0, 1000);
          const testStart = performance.now();
          
          await performanceOptimizer.parallelBatchProcess(
            testBatch,
            (emp) => payrollEngine.calculatePayroll(emp.id, month),
            concurrency
          );
          
          return performance.now() - testStart;
        },
        { min: 10, max: 200, step: 10 }
      );

      console.log(`Optimal concurrency: ${optimalConcurrency}`);

      // 最適な並列度で全体を処理
      const results = await performanceOptimizer.parallelBatchProcess(
        employees,
        (emp) => payrollEngine.calculatePayroll(emp.id, month),
        optimalConcurrency
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / employees.length;

      performanceMetrics.operations.push({
        name: 'hundred_thousand_payrolls',
        records: employees.length,
        time: totalTime,
        averageTime,
        optimalConcurrency
      });

      expect(results.length).toBe(100000);
      expect(averageTime).toBeLessThan(10); // 1人あたり10ms以下
      expect(totalTime).toBeLessThan(600000); // 10分以内
    });

    it('1TBの経費データを分析する', async () => {
      // 実際には1TBのデータは扱えないので、シミュレーション
      const totalExpenses = 100000000; // 1億件（約1TB相当）
      const chunkSize = 1000000; // 100万件ずつ処理

      const startTime = performance.now();
      
      const analysisResults = {
        totalAmount: 0,
        categoryBreakdown: new Map(),
        anomalies: [],
        processingTime: []
      };

      // MapReduceパターンで処理
      for (let chunk = 0; chunk < totalExpenses / chunkSize; chunk++) {
        const chunkStart = performance.now();
        
        // Map phase
        const chunkResults = await performanceOptimizer.mapReduce({
          data: generateExpenseChunk(chunk, chunkSize),
          mapFn: (expense) => ({
            amount: expense.amount,
            category: expense.categoryId,
            isAnomaly: expense.amount > 100000
          }),
          reduceFn: (results) => ({
            totalAmount: results.reduce((sum, r) => sum + r.amount, 0),
            categories: results.reduce((acc, r) => {
              acc[r.category] = (acc[r.category] || 0) + r.amount;
              return acc;
            }, {}),
            anomalies: results.filter(r => r.isAnomaly).length
          }),
          parallelism: 50
        });

        // Reduce phase
        analysisResults.totalAmount += chunkResults.totalAmount;
        Object.entries(chunkResults.categories).forEach(([cat, amount]) => {
          analysisResults.categoryBreakdown.set(
            cat,
            (analysisResults.categoryBreakdown.get(cat) || 0) + amount
          );
        });
        analysisResults.anomalies.push(chunkResults.anomalies);

        const chunkTime = performance.now() - chunkStart;
        analysisResults.processingTime.push(chunkTime);

        // 進捗表示
        if ((chunk + 1) % 10 === 0) {
          const progress = ((chunk + 1) * chunkSize / totalExpenses * 100).toFixed(1);
          console.log(`Analysis progress: ${progress}% | Chunk time: ${chunkTime.toFixed(0)}ms`);
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const throughput = totalExpenses / (totalTime / 1000);

      performanceMetrics.operations.push({
        name: 'terabyte_expense_analysis',
        records: totalExpenses,
        time: totalTime,
        throughput,
        averageChunkTime: analysisResults.processingTime.reduce((a, b) => a + b) / analysisResults.processingTime.length
      });

      expect(throughput).toBeGreaterThan(100000); // 100,000件/秒以上
      expect(analysisResults.totalAmount).toBeGreaterThan(0);
      expect(analysisResults.categoryBreakdown.size).toBeGreaterThan(5);
    });
  });

  describe('2. 高並行性・負荷テスト', () => {
    it('10,000同時接続でのAPI応答性能', async () => {
      const concurrentUsers = 10000;
      const requestsPerUser = 10;
      
      const operations = [
        { name: 'getDashboard', weight: 30 },
        { name: 'submitExpense', weight: 20 },
        { name: 'viewPayslip', weight: 25 },
        { name: 'requestLeave', weight: 15 },
        { name: 'generateReport', weight: 10 }
      ];

      const startTime = performance.now();
      const responseTimes = [];
      const errors = [];

      // 接続プールのウォームアップ
      await performanceOptimizer.warmupConnectionPool(100);

      // 同時実行のシミュレーション
      const userPromises = Array(concurrentUsers).fill(null).map(async (_, userId) => {
        const userResults = [];
        
        for (let req = 0; req < requestsPerUser; req++) {
          const operation = selectWeightedOperation(operations);
          const reqStart = performance.now();
          
          try {
            await simulateApiCall(operation.name, userId);
            const reqTime = performance.now() - reqStart;
            userResults.push({ operation: operation.name, time: reqTime, success: true });
            responseTimes.push(reqTime);
          } catch (error) {
            errors.push({ operation: operation.name, error: error.message });
            userResults.push({ operation: operation.name, success: false });
          }
        }
        
        return userResults;
      });

      // バッチ実行で負荷を制御
      const batchSize = 1000;
      const allResults = [];
      
      for (let i = 0; i < userPromises.length; i += batchSize) {
        const batch = userPromises.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch);
        allResults.push(...batchResults);
        
        // サーバーの過負荷を防ぐため少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // レスポンスタイム分析
      responseTimes.sort((a, b) => a - b);
      const metrics = {
        min: responseTimes[0],
        max: responseTimes[responseTimes.length - 1],
        avg: responseTimes.reduce((a, b) => a + b) / responseTimes.length,
        p50: responseTimes[Math.floor(responseTimes.length * 0.5)],
        p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
        p99: responseTimes[Math.floor(responseTimes.length * 0.99)],
        errorRate: errors.length / (concurrentUsers * requestsPerUser)
      };

      performanceMetrics.operations.push({
        name: 'high_concurrency_api',
        concurrentUsers,
        totalRequests: concurrentUsers * requestsPerUser,
        time: totalTime,
        metrics
      });

      expect(metrics.p95).toBeLessThan(1000); // 95%が1秒以内
      expect(metrics.p99).toBeLessThan(2000); // 99%が2秒以内
      expect(metrics.errorRate).toBeLessThan(0.01); // エラー率1%未満
    });

    it('ピーク時（月末）の負荷シミュレーション', async () => {
      // 月末の典型的な負荷パターン
      const peakLoadScenario = {
        payrollCalculations: 5000,
        expenseSubmissions: 10000,
        reportGenerations: 500,
        complianceChecks: 5000,
        simultaneousUsers: 2000
      };

      const startTime = performance.now();
      const results = {
        completed: 0,
        failed: 0,
        queueDepth: [],
        cpuUsage: [],
        memoryUsage: []
      };

      // リソースモニタリングの開始
      const monitor = startResourceMonitoring();

      // 各種処理を同時実行
      const tasks = [
        // 給与計算バッチ
        ...Array(peakLoadScenario.payrollCalculations).fill(null).map((_, i) => 
          performanceOptimizer.enqueue(
            () => payrollEngine.calculatePayroll(`emp${i}`, '2025-07'),
            { priority: 'high' }
          )
        ),
        
        // 経費申請
        ...Array(peakLoadScenario.expenseSubmissions).fill(null).map((_, i) =>
          performanceOptimizer.enqueue(
            () => expenseEngine.processExpense(generateMockExpense(i)),
            { priority: 'medium' }
          )
        ),
        
        // レポート生成
        ...Array(peakLoadScenario.reportGenerations).fill(null).map((_, i) =>
          performanceOptimizer.enqueue(
            () => humanCapitalEngine.generateReport(`report${i}`),
            { priority: 'low' }
          )
        ),
        
        // コンプライアンスチェック
        ...Array(peakLoadScenario.complianceChecks).fill(null).map((_, i) =>
          performanceOptimizer.enqueue(
            () => complianceEngine.performCheck(`emp${i}`),
            { priority: 'high' }
          )
        )
      ];

      // 処理の実行と監視
      const processPromises = tasks.map(async (task) => {
        try {
          await task;
          results.completed++;
        } catch (error) {
          results.failed++;
        }
      });

      // 定期的なメトリクス収集
      const metricsInterval = setInterval(() => {
        const metrics = monitor.getMetrics();
        results.queueDepth.push(performanceOptimizer.getQueueDepth());
        results.cpuUsage.push(metrics.cpu);
        results.memoryUsage.push(metrics.memory);
      }, 1000);

      await Promise.all(processPromises);
      clearInterval(metricsInterval);
      monitor.stop();

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // パフォーマンス分析
      const analysis = {
        totalOperations: tasks.length,
        completionRate: results.completed / tasks.length,
        throughput: results.completed / (totalTime / 1000),
        maxQueueDepth: Math.max(...results.queueDepth),
        avgCpuUsage: results.cpuUsage.reduce((a, b) => a + b) / results.cpuUsage.length,
        peakMemoryUsage: Math.max(...results.memoryUsage)
      };

      performanceMetrics.operations.push({
        name: 'peak_load_simulation',
        ...analysis,
        time: totalTime
      });

      expect(analysis.completionRate).toBeGreaterThan(0.99); // 99%以上完了
      expect(analysis.throughput).toBeGreaterThan(100); // 100 ops/sec以上
      expect(analysis.avgCpuUsage).toBeLessThan(80); // CPU使用率80%未満
    });

    it('カスケード障害からの回復性能', async () => {
      // 障害シナリオ: データベース接続プールの枯渇
      const normalLoad = 100; // 通常の負荷
      const spikeLoad = 5000; // スパイク負荷

      const results = {
        beforeFailure: { success: 0, failed: 0, responseTime: [] },
        duringFailure: { success: 0, failed: 0, responseTime: [] },
        recovery: { success: 0, failed: 0, responseTime: [] }
      };

      // Phase 1: 通常負荷
      console.log('Phase 1: Normal load');
      for (let i = 0; i < normalLoad; i++) {
        const start = performance.now();
        try {
          await db.query('SELECT 1');
          results.beforeFailure.success++;
          results.beforeFailure.responseTime.push(performance.now() - start);
        } catch (error) {
          results.beforeFailure.failed++;
        }
      }

      // Phase 2: スパイク負荷（障害誘発）
      console.log('Phase 2: Spike load (inducing failure)');
      const spikePromises = Array(spikeLoad).fill(null).map(async () => {
        const start = performance.now();
        try {
          await db.query('SELECT 1', { timeout: 1000 });
          results.duringFailure.success++;
          results.duringFailure.responseTime.push(performance.now() - start);
        } catch (error) {
          results.duringFailure.failed++;
        }
      });

      await Promise.allSettled(spikePromises);

      // Phase 3: 回復測定
      console.log('Phase 3: Recovery');
      const recoveryStart = performance.now();
      
      // サーキットブレーカーとバックプレッシャーの適用
      await performanceOptimizer.activateCircuitBreaker();
      
      // 段階的な負荷増加
      for (let load = 10; load <= normalLoad; load += 10) {
        const batchPromises = Array(load).fill(null).map(async () => {
          const start = performance.now();
          try {
            await db.query('SELECT 1');
            results.recovery.success++;
            results.recovery.responseTime.push(performance.now() - start);
          } catch (error) {
            results.recovery.failed++;
          }
        });
        
        await Promise.all(batchPromises);
        await new Promise(resolve => setTimeout(resolve, 100)); // 段階的回復
      }

      const recoveryTime = performance.now() - recoveryStart;

      // 分析
      const analysis = {
        normalPerformance: {
          successRate: results.beforeFailure.success / normalLoad,
          avgResponseTime: average(results.beforeFailure.responseTime)
        },
        failureImpact: {
          successRate: results.duringFailure.success / spikeLoad,
          failedRequests: results.duringFailure.failed
        },
        recoveryMetrics: {
          time: recoveryTime,
          successRate: results.recovery.success / (results.recovery.success + results.recovery.failed),
          avgResponseTime: average(results.recovery.responseTime)
        }
      };

      performanceMetrics.operations.push({
        name: 'cascade_failure_recovery',
        ...analysis
      });

      expect(analysis.recoveryMetrics.time).toBeLessThan(30000); // 30秒以内に回復
      expect(analysis.recoveryMetrics.successRate).toBeGreaterThan(0.95); // 95%以上成功
    });
  });

  describe('3. メモリ効率とリソース最適化', () => {
    it('メモリリークの検出と防止', async () => {
      const iterations = 1000;
      const memorySnapshots = [];
      
      // 初期メモリ使用量
      if (global.gc) global.gc();
      const initialMemory = process.memoryUsage();
      memorySnapshots.push({ iteration: 0, memory: initialMemory });

      // 繰り返し処理でメモリリークをチェック
      for (let i = 0; i < iterations; i++) {
        // 大量のオブジェクトを作成・処理
        const employees = generateLargeEmployeeDataset(1000);
        const results = await Promise.all(
          employees.map(emp => payrollEngine.calculatePayroll(emp.id, '2025-07'))
        );

        // 明示的にクリーンアップ
        results.length = 0; // 配列をクリア
        
        // 定期的にメモリ使用量を記録
        if (i % 100 === 0) {
          if (global.gc) global.gc();
          const currentMemory = process.memoryUsage();
          memorySnapshots.push({ iteration: i, memory: currentMemory });
          
          console.log(`Iteration ${i}: Heap Used: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        }
      }

      // メモリ使用量の増加率を分析
      const heapGrowth = memorySnapshots.map((snapshot, index) => {
        if (index === 0) return 0;
        const prevHeap = memorySnapshots[index - 1].memory.heapUsed;
        return (snapshot.memory.heapUsed - prevHeap) / prevHeap;
      });

      const avgGrowthRate = average(heapGrowth.slice(1)); // 最初の値を除外

      performanceMetrics.operations.push({
        name: 'memory_leak_detection',
        iterations,
        initialHeapMB: initialMemory.heapUsed / 1024 / 1024,
        finalHeapMB: memorySnapshots[memorySnapshots.length - 1].memory.heapUsed / 1024 / 1024,
        avgGrowthRate
      });

      expect(avgGrowthRate).toBeLessThan(0.01); // 平均成長率1%未満
    });

    it('大規模データのストリーミング処理効率', async () => {
      const totalRecords = 10000000; // 1000万件
      const streamChunkSize = 1000;
      
      const streamMetrics = {
        processedChunks: 0,
        memoryPeaks: [],
        processingRates: []
      };

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      // ストリーム処理のシミュレーション
      const stream = createDataStream(totalRecords, streamChunkSize);
      
      await new Promise((resolve, reject) => {
        stream
          .on('data', async (chunk) => {
            const chunkStart = performance.now();
            
            // チャンクの処理
            const processed = await processChunk(chunk);
            
            streamMetrics.processedChunks++;
            streamMetrics.processingRates.push(
              chunk.length / ((performance.now() - chunkStart) / 1000)
            );
            
            // メモリ使用量の記録
            if (streamMetrics.processedChunks % 100 === 0) {
              streamMetrics.memoryPeaks.push(process.memoryUsage().heapUsed);
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      const analysis = {
        totalTime: endTime - startTime,
        avgProcessingRate: average(streamMetrics.processingRates),
        memoryEfficiency: {
          startMB: startMemory / 1024 / 1024,
          endMB: endMemory / 1024 / 1024,
          peakMB: Math.max(...streamMetrics.memoryPeaks) / 1024 / 1024,
          growthMB: (endMemory - startMemory) / 1024 / 1024
        }
      };

      performanceMetrics.operations.push({
        name: 'streaming_efficiency',
        records: totalRecords,
        ...analysis
      });

      expect(analysis.memoryEfficiency.growthMB).toBeLessThan(100); // メモリ増加100MB未満
      expect(analysis.avgProcessingRate).toBeGreaterThan(100000); // 100,000件/秒以上
    });

    it('キャッシュ効率の最適化', async () => {
      const cacheTests = [
        { size: 1000, hitRatio: 0.8 },
        { size: 10000, hitRatio: 0.9 },
        { size: 100000, hitRatio: 0.95 }
      ];

      const results = [];

      for (const test of cacheTests) {
        // キャッシュの初期化
        const cache = await performanceOptimizer.createCache({
          maxSize: test.size,
          ttl: 3600,
          algorithm: 'lru'
        });

        // アクセスパターンのシミュレーション（Zipfの法則）
        const accessPattern = generateZipfianDistribution(100000, 1.2);
        const metrics = {
          hits: 0,
          misses: 0,
          evictions: 0,
          responseTime: []
        };

        for (const key of accessPattern) {
          const start = performance.now();
          
          const cached = await cache.get(key);
          if (cached) {
            metrics.hits++;
          } else {
            metrics.misses++;
            // キャッシュミス時はデータを生成
            const data = await generateMockData(key);
            const evicted = await cache.set(key, data);
            if (evicted) metrics.evictions++;
          }
          
          metrics.responseTime.push(performance.now() - start);
        }

        const actualHitRatio = metrics.hits / (metrics.hits + metrics.misses);
        
        results.push({
          cacheSize: test.size,
          expectedHitRatio: test.hitRatio,
          actualHitRatio,
          avgResponseTime: average(metrics.responseTime),
          evictionRate: metrics.evictions / accessPattern.length
        });
      }

      performanceMetrics.operations.push({
        name: 'cache_efficiency',
        results
      });

      // キャッシュサイズに応じてヒット率が向上することを確認
      expect(results[2].actualHitRatio).toBeGreaterThan(results[0].actualHitRatio);
      expect(results[2].avgResponseTime).toBeLessThan(results[0].avgResponseTime);
    });
  });

  describe('4. データベース最適化', () => {
    it('インデックス効率の検証', async () => {
      const testQueries = [
        {
          name: 'employee_by_department',
          query: 'SELECT * FROM employees WHERE department = $1',
          withIndex: true,
          expectedSpeedup: 10
        },
        {
          name: 'time_records_by_date_range',
          query: 'SELECT * FROM time_records WHERE employee_id = $1 AND date BETWEEN $2 AND $3',
          withIndex: true,
          expectedSpeedup: 50
        },
        {
          name: 'complex_join',
          query: `
            SELECT e.*, t.*, p.*
            FROM employees e
            JOIN time_records t ON e.id = t.employee_id
            JOIN payroll p ON e.id = p.employee_id
            WHERE e.department = $1 AND t.date > $2
          `,
          withIndex: true,
          expectedSpeedup: 20
        }
      ];

      const results = [];

      for (const test of testQueries) {
        // インデックスなしでの実行
        await db.query('DROP INDEX IF EXISTS idx_test');
        const withoutIndexTimes = [];
        
        for (let i = 0; i < 100; i++) {
          const start = performance.now();
          await db.query(test.query, generateQueryParams(test.name));
          withoutIndexTimes.push(performance.now() - start);
        }

        // インデックスありでの実行
        if (test.withIndex) {
          await createOptimalIndexes(db, test.name);
        }
        
        const withIndexTimes = [];
        
        for (let i = 0; i < 100; i++) {
          const start = performance.now();
          await db.query(test.query, generateQueryParams(test.name));
          withIndexTimes.push(performance.now() - start);
        }

        const avgWithoutIndex = average(withoutIndexTimes);
        const avgWithIndex = average(withIndexTimes);
        const actualSpeedup = avgWithoutIndex / avgWithIndex;

        results.push({
          query: test.name,
          avgWithoutIndex,
          avgWithIndex,
          actualSpeedup,
          expectedSpeedup: test.expectedSpeedup,
          improvement: ((avgWithoutIndex - avgWithIndex) / avgWithoutIndex * 100).toFixed(1) + '%'
        });
      }

      performanceMetrics.operations.push({
        name: 'index_efficiency',
        results
      });

      // インデックスによる改善を確認
      results.forEach(result => {
        expect(result.actualSpeedup).toBeGreaterThan(1);
        expect(result.avgWithIndex).toBeLessThan(result.avgWithoutIndex);
      });
    });

    it('クエリ最適化の効果測定', async () => {
      const optimizationTests = [
        {
          name: 'n_plus_one_problem',
          bad: async () => {
            const employees = await db.query('SELECT id FROM employees LIMIT 100');
            const results = [];
            for (const emp of employees.rows) {
              const timeRecords = await db.query(
                'SELECT * FROM time_records WHERE employee_id = $1',
                [emp.id]
              );
              results.push({ employee: emp, records: timeRecords.rows });
            }
            return results;
          },
          good: async () => {
            const results = await db.query(`
              SELECT e.*, t.*
              FROM employees e
              LEFT JOIN time_records t ON e.id = t.employee_id
              WHERE e.id IN (SELECT id FROM employees LIMIT 100)
            `);
            return results.rows;
          }
        },
        {
          name: 'unnecessary_columns',
          bad: async () => {
            return await db.query('SELECT * FROM employees');
          },
          good: async () => {
            return await db.query('SELECT id, name, department FROM employees');
          }
        },
        {
          name: 'missing_pagination',
          bad: async () => {
            return await db.query('SELECT * FROM time_records ORDER BY date DESC');
          },
          good: async () => {
            return await db.query('SELECT * FROM time_records ORDER BY date DESC LIMIT 1000 OFFSET 0');
          }
        }
      ];

      const results = [];

      for (const test of optimizationTests) {
        // 悪いクエリの実行
        const badStart = performance.now();
        await test.bad();
        const badTime = performance.now() - badStart;

        // 良いクエリの実行
        const goodStart = performance.now();
        await test.good();
        const goodTime = performance.now() - goodStart;

        const improvement = ((badTime - goodTime) / badTime * 100).toFixed(1);

        results.push({
          optimization: test.name,
          badQueryTime: badTime,
          goodQueryTime: goodTime,
          improvement: improvement + '%',
          speedup: badTime / goodTime
        });
      }

      performanceMetrics.operations.push({
        name: 'query_optimization',
        results
      });

      // すべての最適化で改善があることを確認
      results.forEach(result => {
        expect(result.goodQueryTime).toBeLessThan(result.badQueryTime);
        expect(result.speedup).toBeGreaterThan(1);
      });
    });

    it('コネクションプーリングの効果', async () => {
      const scenarios = [
        { name: 'no_pooling', poolSize: 1, connections: 1000 },
        { name: 'small_pool', poolSize: 10, connections: 1000 },
        { name: 'optimal_pool', poolSize: 50, connections: 1000 },
        { name: 'large_pool', poolSize: 200, connections: 1000 }
      ];

      const results = [];

      for (const scenario of scenarios) {
        // プールの設定
        const pool = await createConnectionPool({
          max: scenario.poolSize,
          min: Math.floor(scenario.poolSize / 5),
          idleTimeoutMillis: 30000
        });

        const metrics = {
          totalTime: 0,
          waitTime: [],
          activeConnections: [],
          errors: 0
        };

        const startTime = performance.now();

        // 並行接続のシミュレーション
        const connectionPromises = Array(scenario.connections).fill(null).map(async (_, i) => {
          const waitStart = performance.now();
          
          try {
            const conn = await pool.acquire();
            metrics.waitTime.push(performance.now() - waitStart);
            metrics.activeConnections.push(pool.getActiveCount());
            
            // クエリ実行のシミュレーション
            await simulateQuery(conn, 10 + Math.random() * 90);
            
            await pool.release(conn);
          } catch (error) {
            metrics.errors++;
          }
        });

        await Promise.all(connectionPromises);
        metrics.totalTime = performance.now() - startTime;

        results.push({
          scenario: scenario.name,
          poolSize: scenario.poolSize,
          totalTime: metrics.totalTime,
          avgWaitTime: average(metrics.waitTime),
          maxActiveConnections: Math.max(...metrics.activeConnections),
          errorRate: metrics.errors / scenario.connections,
          throughput: scenario.connections / (metrics.totalTime / 1000)
        });

        await pool.destroy();
      }

      performanceMetrics.operations.push({
        name: 'connection_pooling',
        results
      });

      // 最適なプールサイズが最高のパフォーマンスを示すことを確認
      const optimalResult = results.find(r => r.scenario === 'optimal_pool');
      const noPollResult = results.find(r => r.scenario === 'no_pooling');
      
      expect(optimalResult.throughput).toBeGreaterThan(noPollResult.throughput);
      expect(optimalResult.avgWaitTime).toBeLessThan(noPollResult.avgWaitTime);
    });
  });

  describe('5. スケーラビリティテスト', () => {
    it('水平スケーリングの効果測定', async () => {
      const workload = generateRealisticWorkload(100000); // 10万タスク
      const nodeConfigurations = [
        { nodes: 1, workersPerNode: 10 },
        { nodes: 2, workersPerNode: 10 },
        { nodes: 4, workersPerNode: 10 },
        { nodes: 8, workersPerNode: 10 }
      ];

      const results = [];

      for (const config of nodeConfigurations) {
        const cluster = await createClusterSimulation(config);
        
        const startTime = performance.now();
        const clusterMetrics = {
          processedTasks: 0,
          failedTasks: 0,
          nodeUtilization: new Array(config.nodes).fill(0),
          taskDistribution: new Array(config.nodes).fill(0)
        };

        // ロードバランサーのシミュレーション
        const loadBalancer = createLoadBalancer(config.nodes, 'round-robin');
        
        // タスクの分散実行
        const taskPromises = workload.map(async (task, index) => {
          const nodeId = loadBalancer.getNextNode();
          clusterMetrics.taskDistribution[nodeId]++;
          
          try {
            await cluster.nodes[nodeId].process(task);
            clusterMetrics.processedTasks++;
            clusterMetrics.nodeUtilization[nodeId] += task.complexity;
          } catch (error) {
            clusterMetrics.failedTasks++;
          }
        });

        await Promise.all(taskPromises);
        const totalTime = performance.now() - startTime;

        // スケーリング効率の計算
        const baselineThroughput = results[0]?.throughput || (workload.length / (totalTime / 1000));
        const expectedThroughput = baselineThroughput * config.nodes;
        const actualThroughput = workload.length / (totalTime / 1000);
        const scalingEfficiency = actualThroughput / expectedThroughput;

        results.push({
          nodes: config.nodes,
          totalTime,
          throughput: actualThroughput,
          scalingEfficiency: results.length === 0 ? 1 : scalingEfficiency,
          loadBalance: calculateLoadBalance(clusterMetrics.taskDistribution),
          failureRate: clusterMetrics.failedTasks / workload.length
        });

        await cluster.shutdown();
      }

      performanceMetrics.operations.push({
        name: 'horizontal_scaling',
        results
      });

      // スケーリング効率が許容範囲内であることを確認
      results.slice(1).forEach(result => {
        expect(result.scalingEfficiency).toBeGreaterThan(0.7); // 70%以上の効率
        expect(result.loadBalance).toBeGreaterThan(0.8); // 80%以上の負荷分散
      });
    });

    it('自動スケーリングの応答性', async () => {
      const autoScaler = createAutoScaler({
        minNodes: 2,
        maxNodes: 10,
        targetCPU: 70,
        scaleUpThreshold: 80,
        scaleDownThreshold: 30,
        cooldownPeriod: 60000 // 1分
      });

      const testDuration = 300000; // 5分
      const loadPattern = [
        { time: 0, load: 20 },      // 低負荷
        { time: 60000, load: 80 },   // 急激な増加
        { time: 120000, load: 100 }, // ピーク
        { time: 180000, load: 90 },  // 高負荷継続
        { time: 240000, load: 30 }   // 急激な減少
      ];

      const metrics = {
        nodeCount: [],
        cpuUsage: [],
        responseTime: [],
        scalingEvents: []
      };

      const startTime = Date.now();
      let currentLoadIndex = 0;

      // 負荷パターンのシミュレーション
      const interval = setInterval(async () => {
        const elapsed = Date.now() - startTime;
        
        // 現在の負荷を決定
        while (currentLoadIndex < loadPattern.length - 1 && 
               elapsed >= loadPattern[currentLoadIndex + 1].time) {
          currentLoadIndex++;
        }
        
        const currentLoad = loadPattern[currentLoadIndex].load;
        
        // CPU使用率のシミュレーション
        const cpuUsage = currentLoad + (Math.random() - 0.5) * 10;
        metrics.cpuUsage.push(cpuUsage);
        
        // オートスケーリングの判定
        const scalingDecision = await autoScaler.evaluate({
          cpuUsage,
          currentNodes: autoScaler.getCurrentNodes(),
          timestamp: Date.now()
        });
        
        if (scalingDecision.action !== 'none') {
          metrics.scalingEvents.push({
            time: elapsed,
            action: scalingDecision.action,
            fromNodes: scalingDecision.fromNodes,
            toNodes: scalingDecision.toNodes
          });
        }
        
        metrics.nodeCount.push(autoScaler.getCurrentNodes());
        
        // レスポンスタイムは負荷とノード数に反比例
        const responseTime = (currentLoad / autoScaler.getCurrentNodes()) * 10;
        metrics.responseTime.push(responseTime);
        
        if (elapsed >= testDuration) {
          clearInterval(interval);
        }
      }, 1000);

      // テスト完了を待機
      await new Promise(resolve => setTimeout(resolve, testDuration + 1000));

      // 分析
      const analysis = {
        totalScalingEvents: metrics.scalingEvents.length,
        avgResponseTime: average(metrics.responseTime),
        maxResponseTime: Math.max(...metrics.responseTime),
        scaleUpLatency: calculateScalingLatency(metrics.scalingEvents, 'scale-up'),
        scaleDownLatency: calculateScalingLatency(metrics.scalingEvents, 'scale-down'),
        stabilityScore: calculateStabilityScore(metrics.nodeCount)
      };

      performanceMetrics.operations.push({
        name: 'auto_scaling_responsiveness',
        ...analysis
      });

      expect(analysis.scaleUpLatency).toBeLessThan(30000); // 30秒以内にスケールアップ
      expect(analysis.avgResponseTime).toBeLessThan(100); // 平均100ms以下
      expect(analysis.stabilityScore).toBeGreaterThan(0.7); // 安定性スコア70%以上
    });
  });
});

// ヘルパー関数

function createHighPerformanceDatabase(): any {
  const mockDb = {
    query: vi.fn().mockImplementation(async (sql, params) => {
      // クエリ実行のシミュレーション（軽量）
      await new Promise(resolve => setImmediate(resolve));
      return { rows: [], rowCount: 0 };
    }),
    
    getAllEmployees: vi.fn().mockResolvedValue([]),
    getEmployee: vi.fn().mockResolvedValue(null),
    getTimeRecords: vi.fn().mockResolvedValue([]),
    
    // バルク操作
    bulkInsert: vi.fn().mockImplementation(async (table, records) => {
      // バルクインサートのシミュレーション
      await new Promise(resolve => setTimeout(resolve, records.length * 0.01));
      return { inserted: records.length };
    }),
    
    // トランザクション
    beginTransaction: vi.fn().mockResolvedValue({ id: 'tx_' + Date.now() }),
    commitTransaction: vi.fn().mockResolvedValue(true),
    rollbackTransaction: vi.fn().mockResolvedValue(true)
  };
  
  return mockDb;
}

function generateTimeRecordBatch(startId: number, size: number): TimeRecord[] {
  return Array(size).fill(null).map((_, i) => ({
    id: `tr_${startId + i}`,
    employeeId: `emp_${Math.floor((startId + i) / 100)}`,
    date: new Date('2025-07-01'),
    clockIn: new Date('2025-07-01T09:00:00'),
    clockOut: new Date('2025-07-01T18:00:00'),
    breakMinutes: 60,
    recordType: 'ic_card'
  }));
}

function calculateWorkHours(record: TimeRecord): number {
  const ms = record.clockOut.getTime() - record.clockIn.getTime();
  return ms / (1000 * 60 * 60) - record.breakMinutes / 60;
}

function generateLargeEmployeeDataset(count: number): Employee[] {
  return Array(count).fill(null).map((_, i) => ({
    id: `emp_${i}`,
    name: `従業員${i}`,
    email: `emp${i}@example.com`,
    department: ['営業', '開発', '人事', '経理'][i % 4],
    position: ['スタッフ', 'リーダー', 'マネージャー'][i % 3],
    hourlyWage: 2000 + (i % 10) * 500,
    startDate: '2020-01-01',
    isActive: true
  }));
}

function generateExpenseChunk(chunkId: number, size: number): ExpenseRequest[] {
  return Array(size).fill(null).map((_, i) => ({
    id: `exp_${chunkId}_${i}`,
    employeeId: `emp_${i % 1000}`,
    amount: Math.floor(Math.random() * 50000) + 1000,
    categoryId: ['交通費', '会議費', '消耗品費'][i % 3],
    description: 'Mock expense',
    expenseDate: new Date('2025-07-15'),
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
    currency: 'JPY',
    purpose: 'Business'
  }));
}

function selectWeightedOperation(operations: any[]): any {
  const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const op of operations) {
    random -= op.weight;
    if (random <= 0) return op;
  }
  
  return operations[operations.length - 1];
}

async function simulateApiCall(operation: string, userId: number): Promise<void> {
  const delays = {
    getDashboard: 50 + Math.random() * 150,
    submitExpense: 100 + Math.random() * 400,
    viewPayslip: 30 + Math.random() * 70,
    requestLeave: 80 + Math.random() * 320,
    generateReport: 200 + Math.random() * 800
  };
  
  await new Promise(resolve => setTimeout(resolve, delays[operation] || 100));
  
  // エラーをランダムに発生させる（1%の確率）
  if (Math.random() < 0.01) {
    throw new Error(`API call failed: ${operation}`);
  }
}

function generateMockExpense(id: number): ExpenseRequest {
  return {
    id: `exp_mock_${id}`,
    employeeId: `emp_${id % 1000}`,
    amount: Math.floor(Math.random() * 10000) + 1000,
    categoryId: '交通費',
    description: 'Mock expense for testing',
    expenseDate: new Date(),
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    currency: 'JPY',
    purpose: 'Test'
  };
}

function startResourceMonitoring(): any {
  const metrics = {
    cpu: [],
    memory: [],
    active: true
  };
  
  const interval = setInterval(() => {
    if (!metrics.active) {
      clearInterval(interval);
      return;
    }
    
    // CPU使用率のシミュレーション
    metrics.cpu.push(30 + Math.random() * 50);
    
    // メモリ使用量のシミュレーション
    const memUsage = process.memoryUsage();
    metrics.memory.push(memUsage.heapUsed / 1024 / 1024); // MB
  }, 100);
  
  return {
    getMetrics: () => ({
      cpu: metrics.cpu[metrics.cpu.length - 1] || 0,
      memory: metrics.memory[metrics.memory.length - 1] || 0
    }),
    stop: () => { metrics.active = false; }
  };
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b) / arr.length;
}

function createDataStream(totalRecords: number, chunkSize: number): any {
  const { Readable } = require('stream');
  
  let sent = 0;
  
  return new Readable({
    objectMode: true,
    read() {
      if (sent >= totalRecords) {
        this.push(null);
        return;
      }
      
      const chunk = [];
      const size = Math.min(chunkSize, totalRecords - sent);
      
      for (let i = 0; i < size; i++) {
        chunk.push({
          id: sent + i,
          data: `Record ${sent + i}`
        });
      }
      
      sent += size;
      this.push(chunk);
    }
  });
}

async function processChunk(chunk: any[]): Promise<any[]> {
  // チャンク処理のシミュレーション
  await new Promise(resolve => setImmediate(resolve));
  return chunk.map(item => ({ ...item, processed: true }));
}

function generateZipfianDistribution(size: number, exponent: number): string[] {
  const keys = [];
  const probabilities = [];
  
  // Zipfの法則に基づく確率計算
  let sum = 0;
  for (let i = 1; i <= 1000; i++) {
    sum += 1 / Math.pow(i, exponent);
  }
  
  for (let i = 1; i <= 1000; i++) {
    probabilities.push((1 / Math.pow(i, exponent)) / sum);
  }
  
  // アクセスパターンの生成
  for (let i = 0; i < size; i++) {
    const random = Math.random();
    let cumulative = 0;
    
    for (let j = 0; j < probabilities.length; j++) {
      cumulative += probabilities[j];
      if (random <= cumulative) {
        keys.push(`key_${j}`);
        break;
      }
    }
  }
  
  return keys;
}

async function generateMockData(key: string): Promise<any> {
  // データ生成のシミュレーション
  await new Promise(resolve => setTimeout(resolve, 5));
  return {
    key,
    value: `Data for ${key}`,
    timestamp: Date.now()
  };
}

function generateQueryParams(queryName: string): any[] {
  switch (queryName) {
    case 'employee_by_department':
      return ['開発部'];
    case 'time_records_by_date_range':
      return ['emp_001', '2025-07-01', '2025-07-31'];
    case 'complex_join':
      return ['営業部', '2025-06-01'];
    default:
      return [];
  }
}

async function createOptimalIndexes(db: any, queryType: string): Promise<void> {
  switch (queryType) {
    case 'employee_by_department':
      await db.query('CREATE INDEX idx_emp_dept ON employees(department)');
      break;
    case 'time_records_by_date_range':
      await db.query('CREATE INDEX idx_tr_emp_date ON time_records(employee_id, date)');
      break;
    case 'complex_join':
      await db.query('CREATE INDEX idx_emp_dept ON employees(department)');
      await db.query('CREATE INDEX idx_tr_emp_date ON time_records(employee_id, date)');
      break;
  }
}

async function createConnectionPool(config: any): Promise<any> {
  const connections = [];
  let activeCount = 0;
  
  return {
    acquire: async () => {
      if (connections.length > 0) {
        activeCount++;
        return connections.pop();
      }
      
      if (activeCount < config.max) {
        activeCount++;
        return { id: `conn_${Date.now()}` };
      }
      
      // 待機
      await new Promise(resolve => setTimeout(resolve, 10));
      return this.acquire();
    },
    
    release: async (conn: any) => {
      activeCount--;
      connections.push(conn);
    },
    
    getActiveCount: () => activeCount,
    
    destroy: async () => {
      connections.length = 0;
      activeCount = 0;
    }
  };
}

async function simulateQuery(conn: any, delay: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delay));
}

function generateRealisticWorkload(size: number): any[] {
  return Array(size).fill(null).map((_, i) => ({
    id: `task_${i}`,
    type: ['compute', 'io', 'network'][i % 3],
    complexity: 0.5 + Math.random() * 1.5,
    priority: Math.floor(Math.random() * 3)
  }));
}

async function createClusterSimulation(config: any): Promise<any> {
  const nodes = Array(config.nodes).fill(null).map((_, i) => ({
    id: i,
    workers: config.workersPerNode,
    process: async (task: any) => {
      // タスク処理のシミュレーション
      const delay = task.complexity * 10;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }));
  
  return {
    nodes,
    shutdown: async () => {
      // クリーンアップ
    }
  };
}

function createLoadBalancer(nodeCount: number, algorithm: string): any {
  let currentNode = 0;
  
  return {
    getNextNode: () => {
      switch (algorithm) {
        case 'round-robin':
          const node = currentNode;
          currentNode = (currentNode + 1) % nodeCount;
          return node;
        case 'random':
          return Math.floor(Math.random() * nodeCount);
        default:
          return 0;
      }
    }
  };
}

function calculateLoadBalance(distribution: number[]): number {
  const total = distribution.reduce((a, b) => a + b);
  const avg = total / distribution.length;
  const variance = distribution.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / distribution.length;
  const stdDev = Math.sqrt(variance);
  
  // 完全な均等分散の場合1.0、偏りが大きいほど0に近づく
  return 1 - (stdDev / avg);
}

function createAutoScaler(config: any): any {
  let currentNodes = config.minNodes;
  let lastScaleTime = 0;
  
  return {
    getCurrentNodes: () => currentNodes,
    
    evaluate: async (metrics: any) => {
      const now = Date.now();
      
      // クールダウン期間中はスケーリングしない
      if (now - lastScaleTime < config.cooldownPeriod) {
        return { action: 'none' };
      }
      
      if (metrics.cpuUsage > config.scaleUpThreshold && currentNodes < config.maxNodes) {
        const newNodes = Math.min(currentNodes + 1, config.maxNodes);
        const decision = {
          action: 'scale-up',
          fromNodes: currentNodes,
          toNodes: newNodes
        };
        currentNodes = newNodes;
        lastScaleTime = now;
        return decision;
      }
      
      if (metrics.cpuUsage < config.scaleDownThreshold && currentNodes > config.minNodes) {
        const newNodes = Math.max(currentNodes - 1, config.minNodes);
        const decision = {
          action: 'scale-down',
          fromNodes: currentNodes,
          toNodes: newNodes
        };
        currentNodes = newNodes;
        lastScaleTime = now;
        return decision;
      }
      
      return { action: 'none' };
    }
  };
}

function calculateScalingLatency(events: any[], actionType: string): number {
  const relevantEvents = events.filter(e => e.action === actionType);
  if (relevantEvents.length === 0) return 0;
  
  // 各イベントでの反応時間を計算（簡略化）
  const latencies = relevantEvents.map(e => e.time);
  return average(latencies);
}

function calculateStabilityScore(nodeCountHistory: number[]): number {
  if (nodeCountHistory.length < 2) return 1;
  
  // 変更回数を数える
  let changes = 0;
  for (let i = 1; i < nodeCountHistory.length; i++) {
    if (nodeCountHistory[i] !== nodeCountHistory[i - 1]) {
      changes++;
    }
  }
  
  // 変更が少ないほど安定性が高い
  return 1 - (changes / nodeCountHistory.length);
}

function generatePerformanceReport(metrics: any): any {
  const report = {
    summary: {
      totalOperations: metrics.operations.length,
      totalDuration: metrics.endTime - metrics.startTime,
      averageThroughput: 0
    },
    operations: metrics.operations,
    recommendations: []
  };
  
  // 推奨事項の生成
  metrics.operations.forEach(op => {
    if (op.throughput && op.throughput < 1000) {
      report.recommendations.push(`Consider optimizing ${op.name} - current throughput is below target`);
    }
  });
  
  return report;
}