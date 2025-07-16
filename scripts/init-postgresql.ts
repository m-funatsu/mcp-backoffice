import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function initializePostgreSQL() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/attendance';
  
  console.log('Initializing PostgreSQL database...');
  console.log('Connection string:', connectionString);
  
  const client = new Client({
    connectionString: connectionString
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Read and execute schema
    const schemaPath = join(__dirname, '..', 'schema-postgresql.sql');
    const schema = readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Executing database schema...');
    await client.query(schema);
    
    console.log('✅ Database schema created successfully');
    
    // Test basic functionality
    const result = await client.query('SELECT COUNT(*) FROM employees');
    console.log(`📊 Employee table initialized with ${result.rows[0].count} records`);
    
    // Check if all required tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📝 Created tables:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    console.log('🎉 PostgreSQL database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing PostgreSQL database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run initialization
initializePostgreSQL().catch(console.error);