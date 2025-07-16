#!/usr/bin/env node

import DatabasePostgreSQL from './database_postgresql.js';
import { addHours, subDays, format } from 'date-fns';

/**
 * Test data creation script for attendance management system
 */

async function createTestData() {
  const db = new DatabasePostgreSQL();
  
  console.log('🔄 Connecting to database...');
  await db.connect();
  
  console.log('🔄 Initializing database...');
  await db.initializeDatabase();
  
  console.log('👥 Adding test employees...');
  
  // Add test employees
  const employees = [
    {
      name: '田中太郎',
      department: '開発部',
      position: 'シニアエンジニア',
      hourlyRate: 3500,
      startDate: new Date('2023-04-01'),
      isActive: true,
    },
    {
      name: '佐藤花子',
      department: '営業部',
      position: '営業マネージャー',
      hourlyRate: 3200,
      startDate: new Date('2023-06-15'),
      isActive: true,
    },
    {
      name: '鈴木一郎',
      department: '開発部',
      position: 'エンジニア',
      hourlyRate: 2800,
      startDate: new Date('2024-01-10'),
      isActive: true,
    },
    {
      name: '高橋美咲',
      department: '人事部',
      position: 'HR スペシャリスト',
      hourlyRate: 2900,
      startDate: new Date('2023-09-01'),
      isActive: true,
    },
    {
      name: '山田健太',
      department: '開発部',
      position: 'ジュニアエンジニア',
      hourlyRate: 2300,
      startDate: new Date('2024-03-01'),
      isActive: true,
    },
  ];

  const employeeIds: string[] = [];
  
  for (const employee of employees) {
    const id = await db.addEmployee(employee);
    employeeIds.push(id);
    console.log(`✅ Added employee: ${employee.name} (ID: ${id})`);
  }
  
  console.log('⏰ Creating test time records...');
  
  // Create time records for the past 30 days
  const today = new Date();
  const startDate = subDays(today, 30);
  
  for (let i = 0; i < 30; i++) {
    const date = addHours(startDate, i * 24);
    const dayOfWeek = date.getDay();
    
    // Skip weekends for most employees
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }
    
    for (const [index, employeeId] of employeeIds.entries()) {
      // Create varied working patterns
      const baseClockIn = new Date(date);
      baseClockIn.setHours(9, 0, 0, 0); // 9:00 AM
      
      // Add some variation (±30 minutes)
      const clockInVariation = (Math.random() - 0.5) * 60; // -30 to +30 minutes
      const clockIn = new Date(baseClockIn.getTime() + clockInVariation * 60 * 1000);
      
      // Different working patterns for different employees
      let workingHours = 8; // Base 8 hours
      let breakMinutes = 60; // 1 hour break
      
      if (index === 0) {
        // Tanaka-san works overtime frequently
        workingHours = 8 + Math.random() * 4; // 8-12 hours
        breakMinutes = workingHours > 10 ? 90 : 60; // Longer break for overtime
      } else if (index === 1) {
        // Sato-san has regular hours
        workingHours = 8 + Math.random() * 1; // 8-9 hours
      } else if (index === 4) {
        // Yamada-san occasionally works late
        workingHours = 8 + (Math.random() > 0.7 ? Math.random() * 2 : 0); // Usually 8h, sometimes 8-10h
      }
      
      const clockOut = new Date(clockIn.getTime() + (workingHours + breakMinutes / 60) * 60 * 60 * 1000);
      
      try {
        // Clock in
        await db.clockIn(employeeId, clockIn, 'ic_card');
        
        // Clock out
        await db.clockOut(employeeId, clockOut, breakMinutes);
        
        console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employees[index].name} - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')} (${workingHours.toFixed(1)}h)`);
      } catch (error) {
        console.error(`❌ Error creating time record for ${employees[index].name} on ${format(date, 'yyyy-MM-dd')}:`, error);
      }
    }
  }
  
  console.log('🎯 Test data creation completed!');
  console.log('\n📊 Summary:');
  console.log(`- ${employees.length} employees created`);
  console.log(`- Time records created for the past 30 days (weekdays only)`);
  console.log('\n🚀 You can now test the system using:');
  console.log('  npm run cli');
  console.log('  npm run start (for MCP server)');
  
  await db.close();
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  createTestData().catch(console.error);
}

export default createTestData;