#!/usr/bin/env node

import Database from './database.js';
import { addHours, subDays, format, addDays, startOfMonth, endOfMonth, addMinutes } from 'date-fns';

/**
 * Comprehensive test data creation script for thorough testing
 * Creates multiple scenarios including edge cases, violations, and normal operations
 */

async function createComprehensiveTestData() {
  const db = new Database();
  
  console.log('🔄 Initializing database...');
  await db.initializeDatabase();
  
  console.log('👥 Adding comprehensive test employees...');
  
  // Comprehensive test employees with different scenarios
  const employees = [
    {
      name: '正常太郎',
      department: '開発部',
      position: 'エンジニア',
      hourlyRate: 3000,
      joinDate: new Date('2023-04-01'),
      isActive: true,
      scenario: 'normal', // 正常な勤務パターン
    },
    {
      name: '残業花子',
      department: '営業部',
      position: '営業マネージャー',
      hourlyRate: 3500,
      joinDate: new Date('2023-06-15'),
      isActive: true,
      scenario: 'overtime', // 残業が多い
    },
    {
      name: '深夜次郎',
      department: '運用部',
      position: 'システム管理者',
      hourlyRate: 3200,
      joinDate: new Date('2023-08-01'),
      isActive: true,
      scenario: 'night_shift', // 深夜勤務
    },
    {
      name: '違反三郎',
      department: 'プロジェクト部',
      position: 'プロジェクトマネージャー',
      hourlyRate: 4000,
      joinDate: new Date('2023-01-01'),
      isActive: true,
      scenario: 'violation', // 労働基準法違反
    },
    {
      name: '不規則四郎',
      department: '営業部',
      position: '営業',
      hourlyRate: 2800,
      joinDate: new Date('2023-10-01'),
      isActive: true,
      scenario: 'irregular', // 不規則勤務
    },
    {
      name: '短時間五郎',
      department: '事務部',
      position: '事務員',
      hourlyRate: 2500,
      joinDate: new Date('2024-01-01'),
      isActive: true,
      scenario: 'part_time', // 短時間勤務
    },
    {
      name: '新人六子',
      department: '開発部',
      position: 'ジュニアエンジニア',
      hourlyRate: 2200,
      joinDate: new Date('2024-04-01'),
      isActive: true,
      scenario: 'newcomer', // 新人（一部欠勤あり）
    },
    {
      name: '祝日七夫',
      department: '保守部',
      position: 'エンジニア',
      hourlyRate: 3300,
      joinDate: new Date('2023-07-01'),
      isActive: true,
      scenario: 'holiday_work', // 祝日勤務
    }
  ];

  const employeeData: Array<{id: string, info: any}> = [];
  
  for (const employee of employees) {
    const id = await db.addEmployee(employee);
    employeeData.push({id, info: employee});
    console.log(`✅ Added employee: ${employee.name} (ID: ${id}) - Scenario: ${employee.scenario}`);
  }
  
  console.log('⏰ Creating comprehensive time records...');
  
  // Create time records for the past 60 days to include multiple months
  const today = new Date();
  const startDate = subDays(today, 60);
  
  // Japanese holidays in the test period (approximate)
  const holidays = [
    new Date('2024-11-03'), // 文化の日
    new Date('2024-11-23'), // 勤労感謝の日
    new Date('2024-12-23'), // 天皇誕生日
    new Date('2024-12-29'), // 年末休暇
    new Date('2024-12-30'), // 年末休暇
    new Date('2024-12-31'), // 年末休暇
    new Date('2025-01-01'), // 元日
    new Date('2025-01-02'), // 年始休暇
    new Date('2025-01-03'), // 年始休暇
  ];
  
  for (let i = 0; i < 60; i++) {
    const date = addDays(startDate, i);
    const dayOfWeek = date.getDay();
    const isHoliday = holidays.some(h => h.toDateString() === date.toDateString());
    
    // Skip weekends for most scenarios (except special cases)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    for (const {id: employeeId, info: employee} of employeeData) {
      try {
        await createTimeRecordForScenario(db, employeeId, employee, date, isWeekend, isHoliday);
      } catch (error) {
        console.error(`❌ Error creating time record for ${employee.name} on ${format(date, 'yyyy-MM-dd')}:`, error);
      }
    }
  }
  
  console.log('🎯 Comprehensive test data creation completed!');
  console.log('\n📊 Summary:');
  console.log(`- ${employees.length} employees created with different scenarios`);
  console.log(`- Time records created for the past 60 days`);
  console.log('- Scenarios included:');
  console.log('  • Normal working patterns');
  console.log('  • Overtime workers');
  console.log('  • Night shift workers');
  console.log('  • Labor law violations');
  console.log('  • Irregular schedules');
  console.log('  • Part-time workers');
  console.log('  • New employees with absences');
  console.log('  • Holiday workers');
  
  console.log('\n🧪 Test scenarios you can verify:');
  console.log('  • Payroll calculations');
  console.log('  • Labor law compliance');
  console.log('  • Overtime calculations');
  console.log('  • Late night work premiums');
  console.log('  • Holiday work premiums');
  console.log('  • Missing clock-out handling');
  console.log('  • Break time violations');
  
  console.log('🔄 Database operations completed!');
}

async function createTimeRecordForScenario(
  db: Database, 
  employeeId: string, 
  employee: any, 
  date: Date, 
  isWeekend: boolean, 
  isHoliday: boolean
) {
  const scenario = employee.scenario;
  
  // Skip weekends for most scenarios
  if (isWeekend && !['night_shift', 'holiday_work'].includes(scenario)) {
    return;
  }
  
  // Skip holidays for most scenarios
  if (isHoliday && scenario !== 'holiday_work') {
    return;
  }
  
  switch (scenario) {
    case 'normal':
      await createNormalWorkDay(db, employeeId, employee, date);
      break;
      
    case 'overtime':
      await createOvertimeWorkDay(db, employeeId, employee, date);
      break;
      
    case 'night_shift':
      await createNightShiftWorkDay(db, employeeId, employee, date, isWeekend);
      break;
      
    case 'violation':
      await createViolationWorkDay(db, employeeId, employee, date);
      break;
      
    case 'irregular':
      await createIrregularWorkDay(db, employeeId, employee, date);
      break;
      
    case 'part_time':
      await createPartTimeWorkDay(db, employeeId, employee, date);
      break;
      
    case 'newcomer':
      await createNewcomerWorkDay(db, employeeId, employee, date);
      break;
      
    case 'holiday_work':
      await createHolidayWorkDay(db, employeeId, employee, date, isHoliday);
      break;
  }
}

async function createNormalWorkDay(db: Database, employeeId: string, employee: any, date: Date) {
  const clockIn = new Date(date);
  clockIn.setHours(9, Math.floor(Math.random() * 30), 0, 0); // 9:00-9:30
  
  const clockOut = new Date(clockIn);
  clockOut.setHours(18, Math.floor(Math.random() * 30), 0, 0); // 18:00-18:30
  
  const breakMinutes = 60;
  
  await db.clockIn(employeeId, clockIn, 'ic_card');
  await db.clockOut(employeeId, clockOut, breakMinutes);
  
  console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Normal) - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')}`);
}

async function createOvertimeWorkDay(db: Database, employeeId: string, employee: any, date: Date) {
  const clockIn = new Date(date);
  clockIn.setHours(9, 0, 0, 0);
  
  // 残業時間を多めに設定
  const overtimeHours = Math.random() * 4 + 2; // 2-6時間の残業
  const clockOut = new Date(clockIn);
  clockOut.setHours(18 + overtimeHours, Math.floor(Math.random() * 30), 0, 0);
  
  const breakMinutes = overtimeHours > 3 ? 90 : 60; // 長時間なら休憩延長
  
  await db.clockIn(employeeId, clockIn, 'ic_card');
  await db.clockOut(employeeId, clockOut, breakMinutes);
  
  console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Overtime) - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')} (+${overtimeHours.toFixed(1)}h)`);
}

async function createNightShiftWorkDay(db: Database, employeeId: string, employee: any, date: Date, isWeekend: boolean) {
  // 深夜勤務は週末も含む
  const clockIn = new Date(date);
  clockIn.setHours(22, 0, 0, 0); // 22:00開始
  
  const clockOut = new Date(clockIn);
  clockOut.setDate(clockOut.getDate() + 1);
  clockOut.setHours(6, 0, 0, 0); // 翌日6:00終了
  
  const breakMinutes = 60;
  
  await db.clockIn(employeeId, clockIn, 'ic_card');
  await db.clockOut(employeeId, clockOut, breakMinutes);
  
  console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Night) - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')} (次日)`);
}

async function createViolationWorkDay(db: Database, employeeId: string, employee: any, date: Date) {
  const clockIn = new Date(date);
  clockIn.setHours(8, 0, 0, 0);
  
  // 労働基準法違反レベルの長時間労働
  const workHours = Math.random() * 6 + 12; // 12-18時間
  const clockOut = new Date(clockIn);
  clockOut.setHours(8 + workHours, 0, 0, 0);
  
  // 休憩時間も不足
  const breakMinutes = workHours > 14 ? 60 : 45; // 不十分な休憩
  
  await db.clockIn(employeeId, clockIn, 'ic_card');
  await db.clockOut(employeeId, clockOut, breakMinutes);
  
  console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Violation) - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')} (${workHours.toFixed(1)}h 違反)`);
}

async function createIrregularWorkDay(db: Database, employeeId: string, employee: any, date: Date) {
  // 不規則勤務（時々欠勤）
  if (Math.random() < 0.2) {
    console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Irregular) - 欠勤`);
    return;
  }
  
  const startHour = Math.floor(Math.random() * 4) + 8; // 8-12時開始
  const clockIn = new Date(date);
  clockIn.setHours(startHour, Math.floor(Math.random() * 60), 0, 0);
  
  const workHours = Math.random() * 4 + 6; // 6-10時間
  const clockOut = new Date(clockIn);
  clockOut.setHours(startHour + workHours + 1, Math.floor(Math.random() * 60), 0, 0);
  
  const breakMinutes = workHours > 8 ? 60 : 45;
  
  await db.clockIn(employeeId, clockIn, 'manual');
  await db.clockOut(employeeId, clockOut, breakMinutes);
  
  console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Irregular) - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')}`);
}

async function createPartTimeWorkDay(db: Database, employeeId: string, employee: any, date: Date) {
  // 週3日勤務
  if (Math.random() < 0.6) {
    return;
  }
  
  const clockIn = new Date(date);
  clockIn.setHours(10, 0, 0, 0);
  
  const clockOut = new Date(clockIn);
  clockOut.setHours(15, 0, 0, 0); // 5時間勤務
  
  const breakMinutes = 0; // 短時間なので休憩なし
  
  await db.clockIn(employeeId, clockIn, 'ic_card');
  await db.clockOut(employeeId, clockOut, breakMinutes);
  
  console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Part-time) - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')}`);
}

async function createNewcomerWorkDay(db: Database, employeeId: string, employee: any, date: Date) {
  // 新人は時々打刻忘れや早退
  const random = Math.random();
  
  if (random < 0.1) {
    // 10%の確率で欠勤
    console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Newcomer) - 欠勤`);
    return;
  }
  
  const clockIn = new Date(date);
  clockIn.setHours(9, Math.floor(Math.random() * 15), 0, 0); // 9:00-9:15
  
  if (random < 0.15) {
    // 5%の確率で打刻忘れ（退勤なし）
    await db.clockIn(employeeId, clockIn, 'ic_card');
    console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Newcomer) - ${format(clockIn, 'HH:mm')} to ??? (打刻忘れ)`);
    return;
  }
  
  const clockOut = new Date(clockIn);
  if (random < 0.25) {
    // 早退
    clockOut.setHours(16, Math.floor(Math.random() * 30), 0, 0);
    console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Newcomer) - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')} (早退)`);
  } else {
    // 通常勤務
    clockOut.setHours(18, Math.floor(Math.random() * 30), 0, 0);
    console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Newcomer) - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')}`);
  }
  
  const breakMinutes = 60;
  
  await db.clockIn(employeeId, clockIn, 'ic_card');
  await db.clockOut(employeeId, clockOut, breakMinutes);
}

async function createHolidayWorkDay(db: Database, employeeId: string, employee: any, date: Date, isHoliday: boolean) {
  // 祝日のみ勤務
  if (!isHoliday) {
    return;
  }
  
  const clockIn = new Date(date);
  clockIn.setHours(10, 0, 0, 0);
  
  const clockOut = new Date(clockIn);
  clockOut.setHours(16, 0, 0, 0); // 6時間勤務
  
  const breakMinutes = 60;
  
  await db.clockIn(employeeId, clockIn, 'manual');
  await db.clockOut(employeeId, clockOut, breakMinutes);
  
  console.log(`📝 ${format(date, 'yyyy-MM-dd')}: ${employee.name} (Holiday) - ${format(clockIn, 'HH:mm')} to ${format(clockOut, 'HH:mm')} (祝日勤務)`);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  createComprehensiveTestData().catch(console.error);
}

export default createComprehensiveTestData;