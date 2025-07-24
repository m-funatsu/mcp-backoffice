/**
 * AI-OS データ移行ツール
 * 既存システムからAI-OSへのデータ移行を支援するツール
 * @version 1.0.0
 */

const { Pool } = require('pg');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { Transform } = require('stream');
const crypto = require('crypto');
const chalk = require('chalk');
const ProgressBar = require('progress');

class DataMigrationTool {
  constructor(config) {
    this.sourceDb = config.sourceDb;
    this.targetDb = new Pool({
      host: config.targetDb.host,
      port: config.targetDb.port,
      database: config.targetDb.database,
      user: config.targetDb.user,
      password: config.targetDb.password,
      max: 10,
      idleTimeoutMillis: 30000
    });
    
    this.batchSize = config.batchSize || 1000;
    this.validateData = config.validateData !== false;
    this.dryRun = config.dryRun || false;
    this.logFile = config.logFile || `migration_${new Date().toISOString()}.log`;
    
    this.stats = {
      totalRecords: 0,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      validationErrors: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * マイグレーション実行
   */
  async migrate() {
    console.log(chalk.blue('=== AI-OS データ移行ツール ===\n'));
    
    this.stats.startTime = new Date();
    
    try {
      // 1. 事前チェック
      await this.preflightCheck();
      
      // 2. データ移行実行
      await this.migrateEmployees();
      await this.migrateTimeRecords();
      await this.migrateLeaveBalances();
      await this.migratePayrollData();
      await this.migrateDepartments();
      
      // 3. 事後検証
      await this.postMigrationValidation();
      
      // 4. レポート生成
      this.generateReport();
      
    } catch (error) {
      console.error(chalk.red('移行エラー:'), error);
      await this.rollback();
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 事前チェック
   */
  async preflightCheck() {
    console.log(chalk.yellow('事前チェックを実行中...'));
    
    // ターゲットDB接続確認
    try {
      await this.targetDb.query('SELECT 1');
      console.log(chalk.green('✓ ターゲットデータベース接続成功'));
    } catch (error) {
      throw new Error(`ターゲットDB接続エラー: ${error.message}`);
    }
    
    // 必要なテーブルの存在確認
    const requiredTables = [
      'employees', 'departments', 'time_records', 
      'leave_balances', 'payroll_records'
    ];
    
    for (const table of requiredTables) {
      const result = await this.targetDb.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      
      if (!result.rows[0].exists) {
        throw new Error(`必要なテーブルが存在しません: ${table}`);
      }
    }
    
    console.log(chalk.green('✓ 必要なテーブルの存在確認完了'));
    
    // 空のテーブルか確認（データの重複防止）
    if (!this.dryRun) {
      const counts = await this.getTableCounts();
      if (Object.values(counts).some(count => count > 0)) {
        console.log(chalk.yellow('警告: ターゲットテーブルにデータが存在します'));
        // ここで確認プロンプトを表示することも可能
      }
    }
  }

  /**
   * 従業員データ移行
   */
  async migrateEmployees() {
    console.log(chalk.blue('\n従業員データを移行中...'));
    
    const sourceData = await this.fetchSourceEmployees();
    const totalRecords = sourceData.length;
    
    const progressBar = new ProgressBar('処理中 [:bar] :percent :current/:total', {
      total: totalRecords,
      width: 40,
      complete: '█',
      incomplete: '░'
    });
    
    const batches = this.createBatches(sourceData, this.batchSize);
    
    for (const batch of batches) {
      const transformedBatch = await this.transformEmployeeBatch(batch);
      
      if (this.validateData) {
        const validationResults = await this.validateEmployeeBatch(transformedBatch);
        const validRecords = validationResults.filter(r => r.valid).map(r => r.data);
        
        if (validationResults.some(r => !r.valid)) {
          this.logValidationErrors(validationResults.filter(r => !r.valid));
        }
        
        if (!this.dryRun && validRecords.length > 0) {
          await this.insertEmployeeBatch(validRecords);
        }
        
        this.stats.successfulRecords += validRecords.length;
        this.stats.validationErrors += validationResults.filter(r => !r.valid).length;
      } else {
        if (!this.dryRun) {
          await this.insertEmployeeBatch(transformedBatch);
        }
        this.stats.successfulRecords += transformedBatch.length;
      }
      
      progressBar.update(this.stats.processedRecords += batch.length);
    }
    
    console.log(chalk.green(`\n✓ 従業員データ移行完了: ${this.stats.successfulRecords}件`));
  }

  /**
   * ソースから従業員データ取得
   */
  async fetchSourceEmployees() {
    // CSVファイルからの読み込み例
    if (this.sourceDb.type === 'csv') {
      return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(this.sourceDb.employeesFile)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    }
    
    // 既存DBからの読み込み例
    if (this.sourceDb.type === 'postgresql') {
      const client = new Pool(this.sourceDb.config);
      const result = await client.query('SELECT * FROM employees');
      await client.end();
      return result.rows;
    }
    
    throw new Error(`サポートされていないソースタイプ: ${this.sourceDb.type}`);
  }

  /**
   * 従業員データ変換
   */
  async transformEmployeeBatch(batch) {
    return batch.map(record => ({
      id: this.generateNewId(record.employee_code),
      employee_code: record.employee_code,
      name: this.normalizeName(record.name),
      name_kana: this.normalizeKana(record.name_kana),
      email: record.email.toLowerCase(),
      phone: this.normalizePhone(record.phone),
      department_id: this.mapDepartmentId(record.department),
      position: this.mapPosition(record.position),
      employment_type: this.mapEmploymentType(record.employment_type),
      hire_date: this.normalizeDate(record.hire_date),
      birth_date: this.normalizeDate(record.birth_date),
      gender: this.mapGender(record.gender),
      base_salary: parseFloat(record.base_salary) || 0,
      hourly_rate: this.calculateHourlyRate(record),
      account_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
      // マイグレーション固有のメタデータ
      migration_source_id: record.id || record.employee_code,
      migration_date: new Date(),
      migration_batch_id: this.generateBatchId()
    }));
  }

  /**
   * データ検証
   */
  async validateEmployeeBatch(batch) {
    return batch.map(record => {
      const errors = [];
      
      // 必須フィールドチェック
      if (!record.employee_code) errors.push('従業員コードが必要です');
      if (!record.name) errors.push('氏名が必要です');
      if (!record.email) errors.push('メールアドレスが必要です');
      
      // メールアドレス形式チェック
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (record.email && !emailRegex.test(record.email)) {
        errors.push('無効なメールアドレス形式');
      }
      
      // 日付形式チェック
      if (record.hire_date && isNaN(Date.parse(record.hire_date))) {
        errors.push('無効な入社日');
      }
      
      // 給与データチェック
      if (record.base_salary < 0) {
        errors.push('基本給は0以上である必要があります');
      }
      
      return {
        valid: errors.length === 0,
        data: record,
        errors: errors,
        sourceId: record.migration_source_id
      };
    });
  }

  /**
   * 従業員データ挿入
   */
  async insertEmployeeBatch(batch) {
    const client = await this.targetDb.connect();
    
    try {
      await client.query('BEGIN');
      
      const insertQuery = `
        INSERT INTO employees (
          id, employee_code, name, name_kana, email, phone,
          department_id, position, employment_type, hire_date,
          birth_date, gender, base_salary, hourly_rate,
          account_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (employee_code) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          updated_at = EXCLUDED.updated_at
      `;
      
      for (const record of batch) {
        await client.query(insertQuery, [
          record.id,
          record.employee_code,
          record.name,
          record.name_kana,
          record.email,
          record.phone,
          record.department_id,
          record.position,
          record.employment_type,
          record.hire_date,
          record.birth_date,
          record.gender,
          record.base_salary,
          record.hourly_rate,
          record.account_status,
          record.created_at,
          record.updated_at
        ]);
      }
      
      // 移行履歴を記録
      await this.recordMigrationHistory(client, 'employees', batch);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 勤怠データ移行
   */
  async migrateTimeRecords() {
    console.log(chalk.blue('\n勤怠データを移行中...'));
    
    // ストリーミング処理で大量データに対応
    const sourceStream = await this.createTimeRecordsStream();
    const transformStream = new Transform({
      objectMode: true,
      transform: async (chunk, encoding, callback) => {
        try {
          const transformed = await this.transformTimeRecord(chunk);
          callback(null, transformed);
        } catch (error) {
          callback(error);
        }
      }
    });
    
    let batch = [];
    let totalProcessed = 0;
    
    return new Promise((resolve, reject) => {
      sourceStream
        .pipe(transformStream)
        .on('data', async (record) => {
          batch.push(record);
          
          if (batch.length >= this.batchSize) {
            transformStream.pause();
            
            try {
              if (!this.dryRun) {
                await this.insertTimeRecordsBatch(batch);
              }
              totalProcessed += batch.length;
              console.log(chalk.gray(`処理済み: ${totalProcessed}件`));
              batch = [];
              transformStream.resume();
            } catch (error) {
              reject(error);
            }
          }
        })
        .on('end', async () => {
          // 残りのバッチを処理
          if (batch.length > 0 && !this.dryRun) {
            await this.insertTimeRecordsBatch(batch);
            totalProcessed += batch.length;
          }
          
          console.log(chalk.green(`✓ 勤怠データ移行完了: ${totalProcessed}件`));
          resolve();
        })
        .on('error', reject);
    });
  }

  /**
   * ユーティリティメソッド
   */
  generateNewId(seed) {
    return crypto.createHash('sha256')
      .update(`${seed}-${Date.now()}`)
      .digest('hex')
      .substring(0, 16);
  }

  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  normalizeName(name) {
    return name ? name.trim().replace(/\s+/g, ' ') : '';
  }

  normalizeKana(kana) {
    // 全角カタカナに統一
    return kana ? kana.trim().replace(/[\u3041-\u3096]/g, match => 
      String.fromCharCode(match.charCodeAt(0) + 0x60)
    ) : '';
  }

  normalizePhone(phone) {
    return phone ? phone.replace(/[^0-9-]/g, '') : '';
  }

  normalizeDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  mapDepartmentId(departmentName) {
    // 部門名からIDへのマッピング
    const departmentMap = {
      '営業部': 'dept_sales',
      '開発部': 'dept_dev',
      '人事部': 'dept_hr',
      '経理部': 'dept_acc'
    };
    return departmentMap[departmentName] || 'dept_other';
  }

  mapPosition(position) {
    // 役職のマッピング
    const positionMap = {
      '部長': 'manager',
      '課長': 'section_chief',
      '主任': 'supervisor',
      '一般': 'staff'
    };
    return positionMap[position] || 'staff';
  }

  mapEmploymentType(type) {
    const typeMap = {
      '正社員': 'full_time',
      '契約社員': 'contract',
      'パート': 'part_time',
      'アルバイト': 'part_time'
    };
    return typeMap[type] || 'full_time';
  }

  mapGender(gender) {
    const genderMap = {
      '男': 'male',
      '女': 'female',
      '男性': 'male',
      '女性': 'female'
    };
    return genderMap[gender] || 'other';
  }

  calculateHourlyRate(record) {
    if (record.hourly_rate) {
      return parseFloat(record.hourly_rate);
    }
    // 月給から時給を計算（月160時間想定）
    if (record.base_salary) {
      return Math.round(parseFloat(record.base_salary) / 160);
    }
    return 0;
  }

  createBatches(array, size) {
    const batches = [];
    for (let i = 0; i < array.length; i += size) {
      batches.push(array.slice(i, i + size));
    }
    return batches;
  }

  /**
   * 移行履歴記録
   */
  async recordMigrationHistory(client, tableName, batch) {
    const historyQuery = `
      INSERT INTO migration_history (
        table_name, batch_id, record_count, 
        source_system, migration_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await client.query(historyQuery, [
      tableName,
      this.generateBatchId(),
      batch.length,
      this.sourceDb.type,
      new Date(),
      'completed'
    ]);
  }

  /**
   * ロールバック処理
   */
  async rollback() {
    console.log(chalk.red('\nロールバック処理を実行中...'));
    
    if (this.dryRun) {
      console.log(chalk.yellow('ドライランモードのため、ロールバックは不要です'));
      return;
    }
    
    // 移行履歴から最新のバッチIDを取得
    const result = await this.targetDb.query(`
      SELECT DISTINCT batch_id FROM migration_history 
      WHERE migration_date > $1 
      ORDER BY migration_date DESC
    `, [this.stats.startTime]);
    
    // 各バッチをロールバック
    for (const row of result.rows) {
      await this.rollbackBatch(row.batch_id);
    }
    
    console.log(chalk.yellow('ロールバック完了'));
  }

  /**
   * クリーンアップ処理
   */
  async cleanup() {
    await this.targetDb.end();
    this.stats.endTime = new Date();
  }

  /**
   * レポート生成
   */
  generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000; // 秒
    
    console.log(chalk.blue('\n=== 移行レポート ==='));
    console.log(`開始時刻: ${this.stats.startTime.toLocaleString()}`);
    console.log(`終了時刻: ${this.stats.endTime.toLocaleString()}`);
    console.log(`処理時間: ${duration.toFixed(2)}秒`);
    console.log(`総レコード数: ${this.stats.totalRecords}`);
    console.log(`成功: ${this.stats.successfulRecords}`);
    console.log(`失敗: ${this.stats.failedRecords}`);
    console.log(`検証エラー: ${this.stats.validationErrors}`);
    
    // 詳細レポートをファイルに保存
    const report = {
      summary: this.stats,
      details: {
        // 詳細な統計情報
      }
    };
    
    fs.writeFileSync(
      `migration_report_${new Date().toISOString()}.json`,
      JSON.stringify(report, null, 2)
    );
  }
}

// 実行例
if (require.main === module) {
  const config = {
    sourceDb: {
      type: 'csv',
      employeesFile: './data/employees.csv',
      timeRecordsFile: './data/time_records.csv'
    },
    targetDb: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'aios_production',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD
    },
    batchSize: 1000,
    validateData: true,
    dryRun: process.argv.includes('--dry-run')
  };
  
  const migrator = new DataMigrationTool(config);
  migrator.migrate().catch(console.error);
}

module.exports = DataMigrationTool;