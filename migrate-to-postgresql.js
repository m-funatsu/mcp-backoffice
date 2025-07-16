/**
 * データベース移行スクリプト（レガシー版）
 * 注意: このスクリプトは参考用です。現在はPostgreSQLのみサポート
 */
import sqlite3 from 'sqlite3';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// データベース接続設定
const sqliteDb = new sqlite3.Database('attendance.db');
const pgClient = new Client({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'password',
});

async function migrateToPostgreSQL() {
  try {
    console.log('🚀 データベース移行を開始します（レガシー版）...');
    
    // PostgreSQLに接続
    await pgClient.connect();
    console.log('✅ PostgreSQL接続成功');
    
    // データベースの作成
    try {
      await pgClient.query('CREATE DATABASE attendance_db');
      console.log('📊 データベース作成成功');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('📊 データベースは既に存在します');
      } else {
        throw error;
      }
    }
    
    // attendance_dbに接続し直す
    await pgClient.end();
    const attendanceClient = new Client({
      host: 'localhost',
      port: 5432,
      database: 'attendance_db',
      user: 'postgres',
      password: 'password',
    });
    
    await attendanceClient.connect();
    console.log('✅ attendance_db接続成功');
    
    // PostgreSQLスキーマの実行
    const schemaPath = path.join(__dirname, 'schema-postgresql.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await attendanceClient.query(schema);
    console.log('📋 PostgreSQLスキーマ作成完了');
    
    // データ移行
    await migrateData(attendanceClient);
    
    await attendanceClient.end();
    console.log('🎉 移行完了！');
    
  } catch (error) {
    console.error('❌ 移行エラー:', error);
    
    // PostgreSQL接続ができない場合の代替案
    console.log('📝 PostgreSQL接続に失敗しました。代替案を実行します:');
    console.log('1. 設定ファイルの確認');
    console.log('2. アプリケーションでの接続確認');
    
    // 設定ファイルの確認
    await checkConfiguration();
    
  } finally {
    sqliteDb.close();
  }
}

async function migrateData(pgClient) {
  console.log('📊 データ移行を開始します（レガシー版）...');
  
  // 従業員データの移行（レガシー版）
  await new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM employees', async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`👥 ${rows.length}名の従業員データを移行中...`);
      
      for (const row of rows) {
        try {
          await pgClient.query(`
            INSERT INTO employees (id, name, email, department, position, hourly_rate, start_date, manager_id, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              email = EXCLUDED.email,
              department = EXCLUDED.department,
              position = EXCLUDED.position,
              hourly_rate = EXCLUDED.hourly_rate,
              start_date = EXCLUDED.start_date,
              manager_id = EXCLUDED.manager_id,
              is_active = EXCLUDED.is_active
          `, [
            row.id,
            row.name,
            row.email,
            row.department,
            row.position,
            row.hourly_rate,
            row.join_date || row.start_date,
            row.manager_id,
            row.is_active
          ]);
        } catch (error) {
          console.error(`❌ 従業員データ移行エラー (${row.id}):`, error.message);
        }
      }
      
      resolve();
    });
  });
  
  // 勤怠記録の移行
  await new Promise((resolve, reject) => {
    sqliteDb.all('SELECT * FROM time_records LIMIT 100', async (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log(`⏰ ${rows.length}件の勤怠記録を移行中...`);
      
      for (const row of rows) {
        try {
          await pgClient.query(`
            INSERT INTO time_records (id, employee_id, date, clock_in, clock_out, break_duration, record_type, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO UPDATE SET
              employee_id = EXCLUDED.employee_id,
              date = EXCLUDED.date,
              clock_in = EXCLUDED.clock_in,
              clock_out = EXCLUDED.clock_out,
              break_duration = EXCLUDED.break_duration,
              record_type = EXCLUDED.record_type,
              notes = EXCLUDED.notes
          `, [
            row.id,
            row.employee_id,
            row.date,
            row.clock_in,
            row.clock_out,
            row.break_minutes || 0,
            row.record_type || 'manual',
            row.notes
          ]);
        } catch (error) {
          console.error(`❌ 勤怠記録移行エラー (${row.id}):`, error.message);
        }
      }
      
      resolve();
    });
  });
  
  console.log('✅ データ移行完了');
}

async function checkConfiguration() {
  console.log('🔍 設定ファイルの確認:');
  
  // .envファイルの確認
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    console.log('📄 .env設定:');
    console.log(envContent);
  } catch (error) {
    console.log('❌ .envファイルが見つかりません');
  }
  
  // claude_desktop_config.jsonの確認
  try {
    const configContent = fs.readFileSync('claude_desktop_config.json', 'utf8');
    const config = JSON.parse(configContent);
    console.log('📄 Claude Desktop設定:');
    console.log(JSON.stringify(config, null, 2));
  } catch (error) {
    console.log('❌ claude_desktop_config.jsonファイルが見つかりません');
  }
}

// スクリプト実行
migrateToPostgreSQL();