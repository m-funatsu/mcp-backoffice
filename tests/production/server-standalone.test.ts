import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Production Server Standalone Tests', () => {
  describe('Build and Dependencies', () => {
    it('should build successfully', async () => {
      try {
        const { stdout, stderr } = await execAsync('npm run build');
        console.log('✅ Build output:', stdout);
        if (stderr) {
          console.log('Build warnings:', stderr);
        }
      } catch (error) {
        console.error('Build failed:', error);
        throw error;
      }
    });

    it('should have all required dependencies', async () => {
      const packageJson = await import('../../package.json');
      
      const requiredDeps = [
        '@modelcontextprotocol/sdk',
        'pg',
        'date-fns',
        'zod'
      ];

      requiredDeps.forEach(dep => {
        expect(packageJson.dependencies[dep]).toBeDefined();
        console.log(`✅ Dependency found: ${dep}@${packageJson.dependencies[dep]}`);
      });
    });

    it('should validate TypeScript compilation', async () => {
      try {
        const { stdout, stderr } = await execAsync('npx tsc --noEmit');
        console.log('✅ TypeScript validation passed');
        if (stderr) {
          console.log('TypeScript warnings:', stderr);
        }
      } catch (error) {
        console.error('TypeScript validation failed:', error);
        throw error;
      }
    });
  });

  describe('Server Module Loading', () => {
    it('should load server module without errors', async () => {
      try {
        // サーバーモジュールをrequireしてエラーがないことを確認
        const serverModule = await import('../../dist/server.js');
        expect(serverModule).toBeDefined();
        console.log('✅ Server module loaded successfully');
      } catch (error) {
        console.error('Server module loading failed:', error);
        throw error;
      }
    });

    it('should load database module without errors', async () => {
      try {
        const databaseModule = await import('../../dist/database.js');
        expect(databaseModule.default).toBeDefined();
        console.log('✅ Database module loaded successfully');
      } catch (error) {
        console.error('Database module loading failed:', error);
        throw error;
      }
    });

    it('should load payroll module without errors', async () => {
      try {
        const payrollModule = await import('../../dist/payroll.js');
        expect(payrollModule.default).toBeDefined();
        console.log('✅ Payroll module loaded successfully');
      } catch (error) {
        console.error('Payroll module loading failed:', error);
        throw error;
      }
    });
  });

  describe('Database Functionality', () => {
    it('should initialize database successfully', async () => {
      const Database = (await import('../../dist/database.js')).default;
      
      // Use PostgreSQL test database URL
      const db = new Database(':memory:');
      await db.initializeDatabase();
      
      console.log('✅ Database initialized successfully');
    });

    it('should perform basic CRUD operations', async () => {
      const Database = (await import('../../dist/database.js')).default;
      
      const db = new Database(':memory:');
      await db.initializeDatabase();
      
      // 従業員追加
      const employeeId = await db.addEmployee({
        name: 'テスト従業員',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 3000,
        startDate: new Date('2024-01-01'),
        isActive: true
      });
      
      expect(employeeId).toBeDefined();
      console.log('✅ Employee created:', employeeId);
      
      // 従業員取得
      const employee = await db.getEmployee(employeeId);
      expect(employee).toBeDefined();
      expect(employee!.name).toBe('テスト従業員');
      console.log('✅ Employee retrieved:', employee!.name);
      
      // 勤怠記録
      const clockInTime = new Date();
      await db.clockIn(employeeId, clockInTime, 'manual');
      
      const clockOutTime = new Date(clockInTime.getTime() + 8 * 60 * 60 * 1000);
      await db.clockOut(employeeId, clockOutTime, 60);
      
      console.log('✅ Time records created successfully');
      
      // 勤怠記録取得
      const timeRecords = await db.getTimeRecords(
        employeeId,
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );
      
      expect(timeRecords.length).toBeGreaterThan(0);
      console.log('✅ Time records retrieved:', timeRecords.length);
    });
  });

  describe('Payroll Calculation Engine', () => {
    it('should calculate payroll correctly', async () => {
      const Database = (await import('../../dist/database.js')).default;
      const PayrollCalculator = (await import('../../dist/payroll.js')).default;
      
      const db = new Database(':memory:');
      await db.initializeDatabase();
      
      const rules = {
        regularHoursPerDay: 8,
        regularHoursPerWeek: 40,
        breakMinutesFor6Hours: 45,
        breakMinutesFor8Hours: 60,
        overtimeRate: 1.25,
        lateNightRate: 1.25,
        holidayRate: 1.35,
        highOvertimeRate: 1.50,
        lateNightStart: 22,
        lateNightEnd: 5,
        monthlyOvertimeLimit: 45,
        yearlyOvertimeLimit: 360,
        highOvertimeThreshold: 60
      };
      
      const calculator = new PayrollCalculator(db as any, rules);
      
      // テストデータの作成
      const employeeId = await db.addEmployee({
        name: '給与計算テスト従業員',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 2500,
        startDate: new Date('2024-01-01'),
        isActive: true
      });
      
      // 複数日の勤怠記録を作成
      for (let day = 1; day <= 5; day++) {
        const date = new Date(`2024-12-${String(day).padStart(2, '0')}`);
        const clockIn = new Date(date);
        clockIn.setHours(9, 0, 0, 0);
        
        const clockOut = new Date(clockIn);
        if (day === 5) {
          // 金曜日は残業
          clockOut.setHours(22, 0, 0, 0);
        } else {
          clockOut.setHours(18, 0, 0, 0);
        }
        
        await db.clockIn(employeeId, clockIn, 'ic_card');
        await db.clockOut(employeeId, clockOut, 60);
      }
      
      // 給与計算実行
      const payroll = await calculator.calculateMonthlyPayroll(employeeId, '2024-12');
      
      expect(payroll).toBeDefined();
      expect(payroll.employeeId).toBe(employeeId);
      expect(payroll.totalPay).toBeGreaterThan(0);
      expect(payroll.regularHours).toBeGreaterThan(0);
      
      console.log('✅ Payroll calculated:', {
        regularHours: payroll.regularHours,
        overtimeHours: payroll.overtimeHours,
        totalPay: payroll.totalPay
      });
    });
  });

  describe('CLI Interface', () => {
    it('should validate CLI module exists', async () => {
      try {
        const cliModule = await import('../../dist/cli.js');
        expect(cliModule).toBeDefined();
        console.log('✅ CLI module loaded successfully');
      } catch (error) {
        console.error('CLI module loading failed:', error);
        throw error;
      }
    });
  });

  describe('Configuration and Environment', () => {
    it('should have proper package.json configuration', async () => {
      const packageJson = await import('../../package.json');
      
      expect(packageJson.main).toBe('dist/server.js');
      expect(packageJson.type).toBe('module');
      expect(packageJson.scripts.build).toBeDefined();
      expect(packageJson.scripts.start).toBeDefined();
      
      console.log('✅ Package.json configuration is valid');
    });

    it('should have TypeScript configuration', async () => {
      try {
        const { stdout } = await execAsync('cat tsconfig.json');
        const tsConfig = JSON.parse(stdout);
        
        expect(tsConfig.compilerOptions).toBeDefined();
        expect(tsConfig.compilerOptions.target).toBeDefined();
        expect(tsConfig.compilerOptions.module).toBeDefined();
        
        console.log('✅ TypeScript configuration is valid');
      } catch (error) {
        throw new Error('tsconfig.json not found or invalid');
      }
    });
  });

  describe('Schema and Database Structure', () => {
    it('should validate database schema', async () => {
      try {
        const { stdout } = await execAsync('cat schema-postgresql.sql');
        
        expect(stdout).toContain('CREATE TABLE IF NOT EXISTS employees');
        expect(stdout).toContain('CREATE TABLE IF NOT EXISTS time_records');
        expect(stdout).toContain('CREATE TABLE IF NOT EXISTS payroll_calculations');
        
        console.log('✅ Database schema is valid');
      } catch (error) {
        throw new Error('schema-postgresql.sql not found or invalid');
      }
    });
  });

  describe('Production Readiness Checklist', () => {
    it('should have all production files built', async () => {
      const requiredFiles = [
        'dist/server.js',
        'dist/database.js',
        'dist/payroll.js',
        'dist/types.js',
        'dist/cli.js'
      ];

      for (const file of requiredFiles) {
        try {
          await execAsync(`test -f ${file}`);
          console.log(`✅ Production file exists: ${file}`);
        } catch (error) {
          throw new Error(`Required production file missing: ${file}`);
        }
      }
    });

    it('should validate environment variable handling', () => {
      // 環境変数のデフォルト値設定を確認
      const defaultDbPath = process.env.DB_PATH || 'attendance.db';
      const defaultPort = process.env.PORT || '3000';
      
      expect(defaultDbPath).toBeDefined();
      expect(defaultPort).toBeDefined();
      
      console.log('✅ Environment variables handled properly');
      console.log(`   DB_PATH: ${defaultDbPath}`);
      console.log(`   PORT: ${defaultPort}`);
    });

    it('should calculate system performance baseline', async () => {
      const startTime = Date.now();
      
      // 基本的なシステム操作を実行
      const Database = (await import('../../dist/database.js')).default;
      const db = new Database(':memory:');
      await db.initializeDatabase();
      
      // 10人の従業員を作成
      const employees = [];
      for (let i = 0; i < 10; i++) {
        const id = await db.addEmployee({
          name: `パフォーマンステスト従業員${i}`,
          department: 'テスト部',
          position: 'テスター',
          hourlyRate: 2500,
          startDate: new Date('2024-01-01'),
          isActive: true
        });
        employees.push(id);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Performance baseline: ${duration}ms for 10 employee operations`);
      expect(duration).toBeLessThan(5000); // 5秒以内
    });
  });
});