// Quick test to verify the system works
import Database from './dist/database.js';

async function quickTest() {
  console.log('🔄 Starting quick test...');
  
  try {
    const db = new Database();
    
    // Initialize database
    console.log('📊 Initializing database...');
    await db.initializeDatabase();
    
    // Add a test employee
    console.log('👤 Adding test employee...');
    const employeeId = await db.addEmployee({
      name: 'テスト太郎',
      department: 'テスト部',
      position: 'テストエンジニア',
      hourlyRate: 3000,
      joinDate: new Date('2024-01-01'),
      isActive: true
    });
    
    console.log(`✅ Employee added with ID: ${employeeId}`);
    
    // Clock in
    console.log('⏰ Clocking in...');
    const clockInTime = new Date();
    clockInTime.setHours(9, 0, 0, 0);
    await db.clockIn(employeeId, clockInTime, 'manual');
    
    // Clock out
    console.log('🏃 Clocking out...');
    const clockOutTime = new Date();
    clockOutTime.setHours(18, 0, 0, 0);
    await db.clockOut(employeeId, clockOutTime, 60);
    
    console.log('✅ Test completed successfully!');
    console.log('📋 You can now use the CLI with: npm run cli');
    
    await db.close();
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

quickTest();