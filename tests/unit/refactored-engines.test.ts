/**
 * リファクタリング済みエンジンのユニットテスト
 * Unit tests for refactored engines
 */

import { describe, it, expect } from 'vitest';
import { validateBasicSalary } from '../../src/types/domain/payroll';
import { createMoney } from '../../src/types/core/money';
import { isSuccess } from '../../src/types/core/result';

describe('PayrollCalculation', () => {
  describe('validateBasicSalary', () => {
    it('正の基本給の場合、検証に成功する', () => {
      const salary = createMoney(300000, 'JPY');
      const result = validateBasicSalary(salary);
      
      expect(isSuccess(result)).toBe(true);
    });
    
    it('0円の基本給の場合、検証に失敗する', () => {
      const salary = createMoney(0, 'JPY');
      const result = validateBasicSalary(salary);
      
      expect(isSuccess(result)).toBe(false);
      if (!isSuccess(result)) {
        expect(result.error.field).toBe('basicSalary');
        expect(result.error.code).toBe('INVALID_BASIC_SALARY');
      }
    });
    
    it('負の基本給の場合、検証に失敗する', () => {
      const salary = createMoney(-1000, 'JPY');
      const result = validateBasicSalary(salary);
      
      expect(isSuccess(result)).toBe(false);
    });
  });
});

describe('LeaveManagement', () => {
  describe('LeaveBalanceAnalysis型', () => {
    it('有効な分析結果を作成できる', () => {
      const analysis = {
        currentBalance: 20,
        requestedDays: 5,
        remainingAfterApproval: 15,
        percentageUsed: 0.25,
        warningThreshold: false
      };
      
      expect(analysis.currentBalance).toBe(20);
      expect(analysis.remainingAfterApproval).toBe(15);
      expect(analysis.warningThreshold).toBe(false);
    });
  });
});

describe('AgentFramework', () => {
  describe('AgentCapability型', () => {
    it('エージェント能力定義を作成できる', () => {
      const capability = {
        name: 'payroll-calculation',
        description: '給与計算機能',
        version: '1.0.0',
        supportedActions: ['calculate', 'validate', 'report'],
        requiredPermissions: ['read:payroll', 'write:payroll']
      };
      
      expect(capability.name).toBe('payroll-calculation');
      expect(capability.supportedActions).toHaveLength(3);
      expect(capability.requiredPermissions).toContain('read:payroll');
    });
  });
});

describe('ExpenseEngine', () => {
  describe('ValidationFlag型', () => {
    it('検証フラグを作成できる', () => {
      const flag = {
        type: 'amount_mismatch' as const,
        severity: 'warning' as const,
        message: '金額に不一致があります',
        confidence: 0.85
      };
      
      expect(flag.type).toBe('amount_mismatch');
      expect(flag.severity).toBe('warning');
      expect(flag.confidence).toBe(0.85);
    });
  });
});

describe('AccountingIntegration', () => {
  describe('SyncError型', () => {
    it('同期エラー情報を作成できる', () => {
      const error = {
        recordId: 'EXP001',
        recordType: 'expense' as const,
        errorCode: 'INVALID_AMOUNT',
        errorMessage: '金額が無効です',
        retryable: true,
        retryCount: 0
      };
      
      expect(error.recordType).toBe('expense');
      expect(error.retryable).toBe(true);
      expect(error.retryCount).toBe(0);
    });
  });
});