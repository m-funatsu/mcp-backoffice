import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('attendance.db');

// テーブル構造を確認
db.all("PRAGMA table_info(survey_responses)", (err, rows) => {
  if (err) {
    console.error('Error getting table info:', err);
  } else {
    console.log('survey_responses table structure:');
    rows.forEach(row => {
      console.log(`  ${row.name} (${row.type}) - ${row.pk ? 'PRIMARY KEY' : 'NOT NULL: ' + row.notnull}`);
    });
  }
  
  // テーブル一覧も確認
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
      console.error('Error getting tables:', err);
    } else {
      console.log('\nAll tables in database:');
      tables.forEach(table => {
        console.log(`  ${table.name}`);
      });
    }
    db.close();
  });
});