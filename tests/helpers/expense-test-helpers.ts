import { vi } from 'vitest';
import type { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import type { ExpenseRequest, ExpenseCategory } from '../../src/types.js';

export function createMockDatabase(): DatabasePostgreSQL {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    getEmployee: vi.fn(),
    getAllEmployees: vi.fn().mockResolvedValue([]),
    getExpenseRequests: vi.fn().mockResolvedValue([]),
    getAllExpenseRequests: vi.fn().mockResolvedValue([]),
    createExpenseRequest: vi.fn().mockImplementation((request) => Promise.resolve(request.id)),
    getExpenseRequest: vi.fn().mockImplementation((id) => Promise.resolve({
      id,
      status: 'draft',
      amount: 15000,
      categoryId: '交通費',
      description: '新幹線代',
      expenseDate: new Date()
    })),
    getExpenseCategory: vi.fn().mockImplementation((categoryId: string) => {
      const categories: Record<string, ExpenseCategory> = {
        '交通費': { id: '交通費', name: '交通費', requiresReceipt: true, autoApprovalLimit: 10000 },
        '会議費': { id: '会議費', name: '会議費', requiresReceipt: true, autoApprovalLimit: 10000 },
        '接待交際費': { id: '接待交際費', name: '接待交際費', requiresReceipt: true, autoApprovalLimit: 10000 },
        '消耗品費': { id: '消耗品費', name: '消耗品費', requiresReceipt: true, autoApprovalLimit: 10000 },
        '出張費': { id: '出張費', name: '出張費', requiresReceipt: true, autoApprovalLimit: 10000 },
        '海外出張費': { id: '海外出張費', name: '海外出張費', requiresReceipt: true, autoApprovalLimit: 10000 },
        '保険料': { id: '保険料', name: '保険料', requiresReceipt: true, autoApprovalLimit: 10000 },
        '研修費': { id: '研修費', name: '研修費', requiresReceipt: true, autoApprovalLimit: 10000 }
      };
      return Promise.resolve(categories[categoryId] || {
        id: categoryId,
        name: categoryId,
        requiresReceipt: true,
        autoApprovalLimit: 10000
      });
    }),
    createAccountingEntry: vi.fn().mockResolvedValue('entry_001'),
    getExpenseRequestsByEmployee: vi.fn().mockResolvedValue([]),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn()
  } as any;
}

export function createMockExpenseRequest(overrides?: Partial<ExpenseRequest>): ExpenseRequest {
  return {
    id: 'exp001',
    employeeId: 'emp001',
    amount: 10000,
    categoryId: '交通費',
    description: 'テスト経費',
    expenseDate: new Date(),
    status: 'pending',
    createdAt: new Date(),
    ...overrides
  };
}

export function mockOCRResponse(text: string, confidence: number = 0.9) {
  return {
    ok: true,
    json: async () => ({
      text,
      confidence,
      blocks: text.split('\n').map(line => ({ text: line, confidence }))
    })
  };
}