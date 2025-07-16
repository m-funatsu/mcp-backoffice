/**
 * Database Viewer - 開発用データベース内容確認ツール
 * データベースの構造とデータを視覚的に確認するためのツール
 */

import Database from './database.js';
import { readFileSync } from 'fs';
import { join } from 'path';

class DatabaseViewer {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  /**
   * データベースの全体的な構造を表示
   */
  async showDatabaseStructure(): Promise<void> {
    console.log('🏗️  DATABASE STRUCTURE OVERVIEW');
    console.log('=====================================');
    
    try {
      await this.db.connect();
      
      // 全テーブル一覧を取得
      const tables = await this.getAllTables();
      console.log(`📊 Total Tables: ${tables.length}`);
      console.log('');
      
      // 各テーブルの詳細情報を表示
      for (const table of tables) {
        await this.showTableStructure(table.table_name);
      }
      
    } catch (error) {
      console.error('❌ Error showing database structure:', error);
    }
  }

  /**
   * 特定のテーブルの構造を表示
   */
  private async showTableStructure(tableName: string): Promise<void> {
    console.log(`📋 TABLE: ${tableName.toUpperCase()}`);
    console.log('─'.repeat(50));
    
    try {
      // カラム情報を取得
      const columns = await this.getTableColumns(tableName);
      const rowCount = await this.getTableRowCount(tableName);
      
      console.log(`📈 Row Count: ${rowCount}`);
      console.log('📝 Columns:');
      
      for (const col of columns) {
        const nullable = col.is_nullable === 'YES' ? '(NULL)' : '(NOT NULL)';
        const defaultValue = col.column_default ? `DEFAULT: ${col.column_default}` : '';
        console.log(`  • ${col.column_name}: ${col.data_type} ${nullable} ${defaultValue}`);
      }
      
      console.log('');
    } catch (error) {
      console.error(`❌ Error showing table structure for ${tableName}:`, error);
    }
  }

  /**
   * 主要テーブルのサンプルデータを表示
   */
  async showSampleData(): Promise<void> {
    console.log('📊 SAMPLE DATA');
    console.log('=====================================');
    
    try {
      await this.db.connect();
      
      // 従業員データ
      await this.showEmployeeData();
      
      // 勤怠データ
      await this.showTimeRecordsData();
      
      // 給与データ
      await this.showPayrollData();
      
      // 休暇データ
      await this.showLeaveData();
      
      // 経費データ
      await this.showExpenseData();
      
      // v2.2.0: タレントマネジメントデータ
      await this.showTalentManagementData();
      
    } catch (error) {
      console.error('❌ Error showing sample data:', error);
    }
  }

  /**
   * 従業員データ表示
   */
  private async showEmployeeData(): Promise<void> {
    console.log('👥 EMPLOYEES');
    console.log('─'.repeat(30));
    
    try {
      const employees = await this.db.query('SELECT * FROM employees ORDER BY created_at DESC LIMIT 10');
      
      if (employees.rows.length === 0) {
        console.log('  📝 No employee data found');
      } else {
        console.log(`  📈 Total employees: ${employees.rows.length}`);
        
        for (const emp of employees.rows) {
          console.log(`  • ${emp.id}: ${emp.name} (${emp.department}/${emp.position})`);
          console.log(`    時給: ¥${emp.hourly_rate} | 入社日: ${emp.start_date} | 有効: ${emp.is_active}`);
        }
      }
      
      console.log('');
    } catch (error) {
      console.error('❌ Error showing employee data:', error);
    }
  }

  /**
   * 勤怠データ表示
   */
  private async showTimeRecordsData(): Promise<void> {
    console.log('⏰ TIME RECORDS');
    console.log('─'.repeat(30));
    
    try {
      const timeRecords = await this.db.query(`
        SELECT tr.*, e.name as employee_name 
        FROM time_records tr 
        JOIN employees e ON tr.employee_id = e.id 
        ORDER BY tr.date DESC 
        LIMIT 10
      `);
      
      if (timeRecords.rows.length === 0) {
        console.log('  📝 No time records found');
      } else {
        console.log(`  📈 Recent time records: ${timeRecords.rows.length}`);
        
        for (const record of timeRecords.rows) {
          const clockOut = record.clock_out ? new Date(record.clock_out).toLocaleTimeString() : 'Not clocked out';
          console.log(`  • ${record.employee_name} (${record.date})`);
          console.log(`    出勤: ${new Date(record.clock_in).toLocaleTimeString()} | 退勤: ${clockOut}`);
          console.log(`    休憩: ${record.break_duration}分 | 記録種別: ${record.record_type}`);
        }
      }
      
      console.log('');
    } catch (error) {
      console.error('❌ Error showing time records:', error);
    }
  }

  /**
   * 給与データ表示
   */
  private async showPayrollData(): Promise<void> {
    console.log('💰 PAYROLL CALCULATIONS');
    console.log('─'.repeat(30));
    
    try {
      const payrolls = await this.db.query(`
        SELECT pc.*, e.name as employee_name 
        FROM payroll_calculations pc 
        JOIN employees e ON pc.employee_id = e.id 
        ORDER BY pc.month DESC 
        LIMIT 10
      `);
      
      if (payrolls.rows.length === 0) {
        console.log('  📝 No payroll calculations found');
      } else {
        console.log(`  📈 Recent payroll calculations: ${payrolls.rows.length}`);
        
        for (const payroll of payrolls.rows) {
          console.log(`  • ${payroll.employee_name} (${payroll.month})`);
          console.log(`    通常: ${payroll.regular_hours}h | 残業: ${payroll.overtime_hours}h | 深夜: ${payroll.late_night_hours}h`);
          console.log(`    総支給額: ¥${payroll.total_pay.toLocaleString()}`);
        }
      }
      
      console.log('');
    } catch (error) {
      console.error('❌ Error showing payroll data:', error);
    }
  }

  /**
   * 休暇データ表示
   */
  private async showLeaveData(): Promise<void> {
    console.log('🏖️ LEAVE MANAGEMENT');
    console.log('─'.repeat(30));
    
    try {
      const leaveBalances = await this.db.query(`
        SELECT lb.*, e.name as employee_name 
        FROM leave_balances lb 
        JOIN employees e ON lb.employee_id = e.id 
        ORDER BY lb.updated_at DESC 
        LIMIT 10
      `);
      
      if (leaveBalances.rows.length === 0) {
        console.log('  📝 No leave balances found');
      } else {
        console.log(`  📈 Leave balances: ${leaveBalances.rows.length}`);
        
        for (const balance of leaveBalances.rows) {
          console.log(`  • ${balance.employee_name} (${balance.leave_type} ${balance.year})`);
          console.log(`    付与: ${balance.granted_days}日 | 消化: ${balance.used_days}日 | 残り: ${balance.remaining_days}日`);
        }
      }
      
      console.log('');
    } catch (error) {
      console.error('❌ Error showing leave data:', error);
    }
  }

  /**
   * 経費データ表示
   */
  private async showExpenseData(): Promise<void> {
    console.log('💳 EXPENSE MANAGEMENT');
    console.log('─'.repeat(30));
    
    try {
      const expenses = await this.db.query(`
        SELECT er.*, e.name as employee_name, ec.name as category_name 
        FROM expense_requests er 
        JOIN employees e ON er.employee_id = e.id 
        JOIN expense_categories ec ON er.category_id = ec.id 
        ORDER BY er.expense_date DESC 
        LIMIT 10
      `);
      
      if (expenses.rows.length === 0) {
        console.log('  📝 No expense requests found');
      } else {
        console.log(`  📈 Recent expense requests: ${expenses.rows.length}`);
        
        for (const expense of expenses.rows) {
          console.log(`  • ${expense.employee_name} (${expense.expense_date})`);
          console.log(`    カテゴリ: ${expense.category_name} | 金額: ¥${expense.amount.toLocaleString()}`);
          console.log(`    内容: ${expense.description} | 状態: ${expense.status}`);
        }
      }
      
      console.log('');
    } catch (error) {
      console.error('❌ Error showing expense data:', error);
    }
  }

  /**
   * v2.2.0: タレントマネジメントデータ表示
   */
  private async showTalentManagementData(): Promise<void> {
    console.log('🎯 TALENT MANAGEMENT (v2.2.0)');
    console.log('─'.repeat(30));
    
    try {
      // スキルデータ
      const skills = await this.db.query(`
        SELECT * FROM skills 
        WHERE is_active = true 
        ORDER BY category, name 
        LIMIT 10
      `);
      
      console.log(`📚 Skills: ${skills.rows.length}`);
      for (const skill of skills.rows) {
        console.log(`  • ${skill.name} (${skill.category}) - ${skill.competency_levels}段階評価`);
      }
      
      // 従業員スキル
      const employeeSkills = await this.db.query(`
        SELECT es.*, e.name as employee_name, s.name as skill_name 
        FROM employee_skills es 
        JOIN employees e ON es.employee_id = e.id 
        JOIN skills s ON es.skill_id = s.id 
        ORDER BY es.updated_at DESC 
        LIMIT 10
      `);
      
      console.log(`👤 Employee Skills: ${employeeSkills.rows.length}`);
      for (const empSkill of employeeSkills.rows) {
        console.log(`  • ${empSkill.employee_name}: ${empSkill.skill_name} (Level ${empSkill.proficiency_level})`);
      }
      
      // 研修履歴
      const trainings = await this.db.query(`
        SELECT th.*, e.name as employee_name 
        FROM training_history th 
        JOIN employees e ON th.employee_id = e.id 
        ORDER BY th.start_date DESC 
        LIMIT 10
      `);
      
      console.log(`🎓 Training History: ${trainings.rows.length}`);
      for (const training of trainings.rows) {
        console.log(`  • ${training.employee_name}: ${training.training_name} (${training.training_type})`);
        console.log(`    期間: ${training.start_date} | 時間: ${training.duration_hours}h | 状態: ${training.status}`);
      }
      
      // 目標管理
      const goals = await this.db.query(`
        SELECT g.*, e.name as employee_name 
        FROM goals_okrs g 
        JOIN employees e ON g.employee_id = e.id 
        ORDER BY g.start_date DESC 
        LIMIT 10
      `);
      
      console.log(`🎯 Goals & OKRs: ${goals.rows.length}`);
      for (const goal of goals.rows) {
        console.log(`  • ${goal.employee_name}: ${goal.title} (${goal.goal_type})`);
        console.log(`    進捗: ${goal.achievement_rate}% | 期限: ${goal.due_date} | 状態: ${goal.status}`);
      }
      
      console.log('');
    } catch (error) {
      console.error('❌ Error showing talent management data:', error);
    }
  }

  /**
   * データベースの統計情報を表示
   */
  async showDatabaseStatistics(): Promise<void> {
    console.log('📊 DATABASE STATISTICS');
    console.log('=====================================');
    
    try {
      await this.db.connect();
      
      const stats = await this.calculateDatabaseStatistics();
      
      console.log('📈 Table Row Counts:');
      for (const [tableName, count] of Object.entries(stats.tableCounts)) {
        console.log(`  • ${tableName}: ${count} rows`);
      }
      
      console.log('');
      console.log('📊 Business Metrics:');
      console.log(`  • Active Employees: ${stats.activeEmployees}`);
      console.log(`  • This Month Payrolls: ${stats.thisMonthPayrolls}`);
      console.log(`  • Pending Expenses: ${stats.pendingExpenses}`);
      console.log(`  • Active Skills: ${stats.activeSkills}`);
      console.log(`  • Ongoing Goals: ${stats.ongoingGoals}`);
      console.log(`  • Scheduled Trainings: ${stats.scheduledTrainings}`);
      
      console.log('');
    } catch (error) {
      console.error('❌ Error showing database statistics:', error);
    }
  }

  /**
   * ヘルパーメソッド群
   */
  private async getAllTables(): Promise<Array<{table_name: string}>> {
    const result = await this.db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    return result.rows;
  }

  private async getTableColumns(tableName: string): Promise<Array<{column_name: string, data_type: string, is_nullable: string, column_default: string}>> {
    const result = await this.db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [tableName]);
    return result.rows;
  }

  private async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  }

  private async calculateDatabaseStatistics(): Promise<any> {
    const tables = ['employees', 'time_records', 'payroll_calculations', 'leave_balances', 'expense_requests', 'skills', 'employee_skills', 'training_history', 'goals_okrs'];
    const tableCounts: Record<string, number> = {};
    
    for (const table of tables) {
      try {
        tableCounts[table] = await this.getTableRowCount(table);
      } catch (error) {
        tableCounts[table] = 0;
      }
    }
    
    // ビジネス指標の計算
    const activeEmployees = await this.db.query('SELECT COUNT(*) as count FROM employees WHERE is_active = true');
    const thisMonthPayrolls = await this.db.query(`SELECT COUNT(*) as count FROM payroll_calculations WHERE month = to_char(CURRENT_DATE, 'YYYY-MM')`);
    const pendingExpenses = await this.db.query(`SELECT COUNT(*) as count FROM expense_requests WHERE status = 'submitted'`);
    const activeSkills = await this.db.query('SELECT COUNT(*) as count FROM skills WHERE is_active = true');
    const ongoingGoals = await this.db.query(`SELECT COUNT(*) as count FROM goals_okrs WHERE status = 'in_progress'`);
    const scheduledTrainings = await this.db.query(`SELECT COUNT(*) as count FROM training_history WHERE status = 'scheduled'`);
    
    return {
      tableCounts,
      activeEmployees: activeEmployees.rows[0]?.count || 0,
      thisMonthPayrolls: thisMonthPayrolls.rows[0]?.count || 0,
      pendingExpenses: pendingExpenses.rows[0]?.count || 0,
      activeSkills: activeSkills.rows[0]?.count || 0,
      ongoingGoals: ongoingGoals.rows[0]?.count || 0,
      scheduledTrainings: scheduledTrainings.rows[0]?.count || 0
    };
  }

  /**
   * 指定されたテーブルの全データを表示
   */
  async showTableData(tableName: string, limit: number = 20): Promise<void> {
    console.log(`📋 TABLE DATA: ${tableName.toUpperCase()}`);
    console.log('='.repeat(50));
    
    try {
      await this.db.connect();
      
      const result = await this.db.query(`SELECT * FROM ${tableName} LIMIT ${limit}`);
      
      if (result.rows.length === 0) {
        console.log('  📝 No data found in this table');
        return;
      }
      
      console.log(`  📊 Showing ${result.rows.length} rows (limit: ${limit})`);
      console.log('');
      
      // テーブルヘッダーを表示
      if (result.rows.length > 0) {
        const columns = Object.keys(result.rows[0]);
        console.log('  ' + columns.join(' | '));
        console.log('  ' + '─'.repeat(columns.join(' | ').length));
        
        // データ行を表示
        for (const row of result.rows) {
          const values = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
          });
          console.log('  ' + values.join(' | '));
        }
      }
      
      console.log('');
    } catch (error) {
      console.error(`❌ Error showing table data for ${tableName}:`, error);
    }
  }

  /**
   * データベース接続を閉じる
   */
  async close(): Promise<void> {
    await this.db.close();
  }
}

// CLI実行用のメイン関数
async function main() {
  const viewer = new DatabaseViewer();
  
  try {
    console.log('🚀 AI-Native Strategic Platform Database Viewer');
    console.log('================================================');
    console.log('');
    
    // コマンドライン引数を確認
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
      case 'structure':
        await viewer.showDatabaseStructure();
        break;
      case 'data':
        await viewer.showSampleData();
        break;
      case 'stats':
        await viewer.showDatabaseStatistics();
        break;
      case 'table':
        if (args[1]) {
          const limit = args[2] ? parseInt(args[2]) : 20;
          await viewer.showTableData(args[1], limit);
        } else {
          console.log('❌ Table name required. Usage: npm run db-view table <table_name> [limit]');
        }
        break;
      case 'all':
        await viewer.showDatabaseStructure();
        await viewer.showSampleData();
        await viewer.showDatabaseStatistics();
        break;
      default:
        console.log('📖 Available commands:');
        console.log('  structure  - Show database structure');
        console.log('  data       - Show sample data from all tables');
        console.log('  stats      - Show database statistics');
        console.log('  table <name> [limit] - Show specific table data');
        console.log('  all        - Show everything');
        console.log('');
        console.log('💡 Examples:');
        console.log('  npm run db-view structure');
        console.log('  npm run db-view data');
        console.log('  npm run db-view table employees 10');
        console.log('  npm run db-view all');
    }
    
  } catch (error) {
    console.error('❌ Database viewer error:', error);
    process.exit(1);
  } finally {
    await viewer.close();
  }
}

// CLI実行時のエントリーポイント
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default DatabaseViewer;