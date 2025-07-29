/**
 * AI-OS v3.2.0 条件付きRBAC テスト
 * Conditional RBAC Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConditionalRBACService } from '../services/ConditionalRBACService';

describe('ConditionalRBACService', () => {
  let service: ConditionalRBACService;

  beforeEach(() => {
    service = new ConditionalRBACService();
  });

  describe('条件付き権限の作成', () => {
    it('基本的な権限を作成できる', () => {
      const permission = service.createPermission(
        'manager',
        'expense',
        'approve',
        {},
        'admin'
      );

      expect(permission).toMatchObject({
        resource: 'expense',
        action: 'approve',
        enabled: true,
        createdBy: 'admin'
      });
      expect(permission.id).toBeDefined();
    });

    it('金額制限付き権限を作成できる', () => {
      const conditions = service.createConditionBuilder()
        .withAmountLimit(0, 1000000)
        .build();

      const permission = service.createPermission(
        'manager',
        'expense',
        'approve',
        conditions,
        'admin'
      );

      expect(permission.conditions.amountLimit).toEqual({
        min: 0,
        max: 1000000
      });
    });

    it('時間制限付き権限を作成できる', () => {
      const conditions = service.createConditionBuilder()
        .withTimeRestriction({
          allowedDays: [1, 2, 3, 4, 5], // 月〜金
          allowedHours: [{ start: '09:00', end: '18:00' }],
          excludeWeekends: true
        })
        .build();

      const permission = service.createPermission(
        'employee',
        'timecard',
        'edit',
        conditions,
        'admin'
      );

      expect(permission.conditions.timeRestriction).toBeDefined();
      expect(permission.conditions.timeRestriction!.excludeWeekends).toBe(true);
    });

    it('複合条件付き権限を作成できる', () => {
      const conditions = service.createConditionBuilder()
        .withAmountLimit(0, 500000)
        .withTimeRestriction({
          allowedDays: [1, 2, 3, 4, 5],
          allowedHours: [{ start: '09:00', end: '18:00' }]
        })
        .withDepartmentScope('include', ['sales', 'marketing'])
        .withCombinationLogic('AND')
        .build();

      const permission = service.createPermission(
        'manager',
        'expense',
        'approve',
        conditions,
        'admin'
      );

      expect(permission.conditions.amountLimit).toBeDefined();
      expect(permission.conditions.timeRestriction).toBeDefined();
      expect(permission.conditions.departmentScope).toBeDefined();
      expect(permission.conditions.combinationLogic).toBe('AND');
    });
  });

  describe('権限の評価', () => {
    describe('金額制限', () => {
      beforeEach(() => {
        const conditions = service.createConditionBuilder()
          .withAmountLimit(0, 100000)
          .build();

        service.createPermission(
          'manager',
          'expense',
          'approve',
          conditions,
          'admin'
        );
      });

      it('制限内の金額は許可される', async () => {
        const result = await service.evaluatePermission(
          'manager',
          'expense',
          'approve',
          {
            userId: 'user1',
            userRole: 'manager',
            userDepartment: 'sales',
            requestTime: new Date(),
            amount: 50000
          }
        );

        expect(result.allowed).toBe(true);
        expect(result.matchedConditions).toContain('Amount limit: Amount within limits');
      });

      it('制限を超える金額は拒否される', async () => {
        const result = await service.evaluatePermission(
          'manager',
          'expense',
          'approve',
          {
            userId: 'user1',
            userRole: 'manager',
            userDepartment: 'sales',
            requestTime: new Date(),
            amount: 150000
          }
        );

        expect(result.allowed).toBe(false);
        expect(result.failedConditions).toContain(
          'Amount limit: Amount 150000 exceeds maximum 100000'
        );
      });
    });

    describe('時間制限', () => {
      beforeEach(() => {
        const conditions = service.createConditionBuilder()
          .withTimeRestriction({
            allowedDays: [1, 2, 3, 4, 5], // 月〜金
            allowedHours: [{ start: '09:00', end: '18:00' }],
            excludeWeekends: true
          })
          .build();

        service.createPermission(
          'employee',
          'timecard',
          'edit',
          conditions,
          'admin'
        );
      });

      it('営業時間内のアクセスは許可される', async () => {
        const tuesday10am = new Date('2024-01-16T10:00:00');
        
        const result = await service.evaluatePermission(
          'employee',
          'timecard',
          'edit',
          {
            userId: 'user1',
            userRole: 'employee',
            userDepartment: 'hr',
            requestTime: tuesday10am
          }
        );

        expect(result.allowed).toBe(true);
      });

      it('週末のアクセスは拒否される', async () => {
        const saturday = new Date('2024-01-20T10:00:00');
        
        const result = await service.evaluatePermission(
          'employee',
          'timecard',
          'edit',
          {
            userId: 'user1',
            userRole: 'employee',
            userDepartment: 'hr',
            requestTime: saturday
          }
        );

        expect(result.allowed).toBe(false);
        expect(result.failedConditions).toContain(
          'Time restriction: Access not allowed on weekends'
        );
      });

      it('営業時間外のアクセスは拒否される', async () => {
        const tuesday8pm = new Date('2024-01-16T20:00:00');
        
        const result = await service.evaluatePermission(
          'employee',
          'timecard',
          'edit',
          {
            userId: 'user1',
            userRole: 'employee',
            userDepartment: 'hr',
            requestTime: tuesday8pm
          }
        );

        expect(result.allowed).toBe(false);
      });
    });

    describe('部門制限', () => {
      it('includeモードで許可された部門は許可される', async () => {
        const conditions = service.createConditionBuilder()
          .withDepartmentScope('include', ['sales', 'marketing'])
          .build();

        service.createPermission(
          'manager',
          'budget',
          'view',
          conditions,
          'admin'
        );

        const result = await service.evaluatePermission(
          'manager',
          'budget',
          'view',
          {
            userId: 'user1',
            userRole: 'manager',
            userDepartment: 'sales',
            requestTime: new Date()
          }
        );

        expect(result.allowed).toBe(true);
      });

      it('excludeモードで除外された部門は拒否される', async () => {
        const conditions = service.createConditionBuilder()
          .withDepartmentScope('exclude', ['hr', 'legal'])
          .build();

        service.createPermission(
          'employee',
          'salary',
          'view',
          conditions,
          'admin'
        );

        const result = await service.evaluatePermission(
          'employee',
          'salary',
          'view',
          {
            userId: 'user1',
            userRole: 'employee',
            userDepartment: 'hr',
            requestTime: new Date()
          }
        );

        expect(result.allowed).toBe(false);
      });
    });

    describe('地理的制限', () => {
      it('許可された国からのアクセスは許可される', async () => {
        const conditions = service.createConditionBuilder()
          .withGeoRestriction({
            allowedCountries: ['JP', 'US']
          })
          .build();

        service.createPermission(
          'admin',
          'system',
          'configure',
          conditions,
          'admin'
        );

        const result = await service.evaluatePermission(
          'admin',
          'system',
          'configure',
          {
            userId: 'user1',
            userRole: 'admin',
            userDepartment: 'it',
            requestTime: new Date(),
            requestLocation: {
              country: 'JP',
              region: 'Tokyo',
              city: 'Tokyo'
            }
          }
        );

        expect(result.allowed).toBe(true);
      });

      it('ブロックされたIPからのアクセスは拒否される', async () => {
        const conditions = service.createConditionBuilder()
          .withGeoRestriction({
            blockedIPs: ['192.168.1.100']
          })
          .build();

        service.createPermission(
          'user',
          'data',
          'access',
          conditions,
          'admin'
        );

        const result = await service.evaluatePermission(
          'user',
          'data',
          'access',
          {
            userId: 'user1',
            userRole: 'user',
            userDepartment: 'sales',
            requestTime: new Date(),
            requestIP: '192.168.1.100'
          }
        );

        expect(result.allowed).toBe(false);
      });
    });

    describe('カスタムルール', () => {
      it('カスタムルールが正しく評価される', async () => {
        const conditions = service.createConditionBuilder()
          .withCustomRule({
            id: 'rule1',
            name: 'Working Hours Check',
            expression: 'context.requestTime.getHours() >= 9 && context.requestTime.getHours() < 18',
            parameters: {}
          })
          .build();

        service.createPermission(
          'employee',
          'report',
          'submit',
          conditions,
          'admin'
        );

        const result = await service.evaluatePermission(
          'employee',
          'report',
          'submit',
          {
            userId: 'user1',
            userRole: 'employee',
            userDepartment: 'sales',
            requestTime: new Date('2024-01-16T14:00:00')
          }
        );

        expect(result.allowed).toBe(true);
      });
    });

    describe('複合条件', () => {
      it('AND条件ですべての条件を満たす場合のみ許可される', async () => {
        const conditions = service.createConditionBuilder()
          .withAmountLimit(0, 100000)
          .withTimeRestriction({
            allowedDays: [1, 2, 3, 4, 5],
            allowedHours: [{ start: '09:00', end: '18:00' }]
          })
          .withCombinationLogic('AND')
          .build();

        service.createPermission(
          'manager',
          'expense',
          'approve',
          conditions,
          'admin'
        );

        // すべての条件を満たす
        const allowedResult = await service.evaluatePermission(
          'manager',
          'expense',
          'approve',
          {
            userId: 'user1',
            userRole: 'manager',
            userDepartment: 'sales',
            requestTime: new Date('2024-01-16T10:00:00'),
            amount: 50000
          }
        );

        expect(allowedResult.allowed).toBe(true);

        // 金額条件を満たさない
        const deniedResult = await service.evaluatePermission(
          'manager',
          'expense',
          'approve',
          {
            userId: 'user1',
            userRole: 'manager',
            userDepartment: 'sales',
            requestTime: new Date('2024-01-16T10:00:00'),
            amount: 150000
          }
        );

        expect(deniedResult.allowed).toBe(false);
      });

      it('OR条件でいずれかの条件を満たせば許可される', async () => {
        const conditions = service.createConditionBuilder()
          .withAmountLimit(0, 50000)
          .withDepartmentScope('include', ['executives'])
          .withCombinationLogic('OR')
          .build();

        service.createPermission(
          'approver',
          'expense',
          'approve',
          conditions,
          'admin'
        );

        // 金額条件のみ満たす
        const amountOkResult = await service.evaluatePermission(
          'approver',
          'expense',
          'approve',
          {
            userId: 'user1',
            userRole: 'approver',
            userDepartment: 'sales',
            requestTime: new Date(),
            amount: 30000
          }
        );

        expect(amountOkResult.allowed).toBe(true);

        // 部門条件のみ満たす
        const deptOkResult = await service.evaluatePermission(
          'approver',
          'expense',
          'approve',
          {
            userId: 'user2',
            userRole: 'approver',
            userDepartment: 'executives',
            requestTime: new Date(),
            amount: 100000
          }
        );

        expect(deptOkResult.allowed).toBe(true);
      });
    });
  });

  describe('権限の管理', () => {
    it('権限を更新できる', () => {
      const permission = service.createPermission(
        'user',
        'resource',
        'action',
        {},
        'admin'
      );

      const updated = service.updatePermission(
        permission.id,
        { enabled: false },
        'admin'
      );

      expect(updated?.enabled).toBe(false);
      expect(updated?.updatedAt).toBeDefined();
    });

    it('権限を削除できる', () => {
      const permission = service.createPermission(
        'user',
        'resource',
        'action',
        {},
        'admin'
      );

      const deleted = service.deletePermission(permission.id, 'admin');
      expect(deleted).toBe(true);

      const rolePermissions = service.getRolePermissions('user');
      expect(rolePermissions).not.toContainEqual(
        expect.objectContaining({ id: permission.id })
      );
    });

    it('ロールのすべての権限を取得できる', () => {
      service.createPermission('role1', 'resource1', 'action1', {}, 'admin');
      service.createPermission('role1', 'resource2', 'action2', {}, 'admin');
      service.createPermission('role2', 'resource3', 'action3', {}, 'admin');

      const role1Permissions = service.getRolePermissions('role1');
      expect(role1Permissions).toHaveLength(2);
      expect(role1Permissions[0].resource).toBe('resource1');
      expect(role1Permissions[1].resource).toBe('resource2');
    });
  });

  describe('キャッシュ', () => {
    it('同じ権限評価がキャッシュされる', async () => {
      const conditions = service.createConditionBuilder()
        .withAmountLimit(0, 100000)
        .build();

      service.createPermission(
        'manager',
        'expense',
        'approve',
        conditions,
        'admin'
      );

      const context = {
        userId: 'user1',
        userRole: 'manager',
        userDepartment: 'sales',
        requestTime: new Date(),
        amount: 50000
      };

      // 1回目の評価
      const start1 = Date.now();
      const result1 = await service.evaluatePermission(
        'manager',
        'expense',
        'approve',
        context
      );
      const time1 = Date.now() - start1;

      // 2回目の評価（キャッシュから）
      const start2 = Date.now();
      const result2 = await service.evaluatePermission(
        'manager',
        'expense',
        'approve',
        context
      );
      const time2 = Date.now() - start2;

      expect(result1).toEqual(result2);
      // キャッシュからの取得は高速であることを期待
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });

  describe('優先度', () => {
    it('複雑な条件ほど高い優先度が設定される', () => {
      const simplePermission = service.createPermission(
        'role',
        'resource',
        'action',
        {},
        'admin'
      );

      const complexPermission = service.createPermission(
        'role',
        'resource',
        'action',
        service.createConditionBuilder()
          .withAmountLimit(0, 100000)
          .withTimeRestriction({ allowedDays: [1, 2, 3, 4, 5] })
          .withDepartmentScope('include', ['dept1'])
          .withCustomRule({
            id: 'rule1',
            name: 'test',
            expression: 'true'
          })
          .withCombinationLogic('AND')
          .build(),
        'admin'
      );

      expect(complexPermission.priority).toBeGreaterThan(simplePermission.priority);
    });
  });
});