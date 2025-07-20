import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComplianceEngine } from '../src/compliance-engine.js';
import '../src/compliance-engine-extensions.js';
import { TestDatabaseAdapter } from './helpers/database-adapter.js';

describe('Quick Alert Test', () => {
  it('should generate alerts when overtime exceeds limit', async () => {
    const mockDb = {
      query: vi.fn().mockImplementation((sql) => {
        console.log('Query SQL:', sql);
        if (sql.includes('labor_agreements')) {
          return { 
            rows: [{ 
              id: 'default',
              company_id: 'company001',
              agreement_type: '36_standard',
              effective_from: new Date('2024-01-01'),
              effective_to: new Date('2024-12-31'),
              monthly_overtime_limit: 45,
              yearly_overtime_limit: 360,
              special_monthly_limit: 100,
              special_yearly_limit: 720,
              special_2month_avg_limit: 80,
              special_6month_avg_limit: 80,
              special_monthly_count_limit: 6
            }] 
          };
        }
        if (sql.includes('SUM(overtime_hours)') && sql.includes('YYYY-MM')) {
          return { rows: [{ total: 50 }] };
        }
        if (sql.includes('SUM(overtime_hours)') && sql.includes('YYYY')) {
          return { rows: [{ total: 200 }] };
        }
        return { rows: [] };
      }),
      getTimeRecords: vi.fn().mockResolvedValue([]),
      getEmployee: vi.fn(),
      getPayrollRules: vi.fn().mockResolvedValue({
        regularHoursPerDay: 8,
        regularHoursPerWeek: 40
      })
    } as any;

    const dbAdapter = new TestDatabaseAdapter(mockDb);
    const engine = new ComplianceEngine(dbAdapter as any);

    const status = await engine.monitor36Agreement('emp001', new Date('2024-01-31'));

    console.log('Status:', JSON.stringify(status, null, 2));
    console.log('Alerts:', status.alerts);
    console.log('Monthly Overtime:', status.monthlyOvertimeHours);
    console.log('Monthly Limit:', status.monthlyLimit);

    expect(status.monthlyOvertimeHours).toBe(50);
    expect(status.alerts.length).toBeGreaterThan(0);
  });
});