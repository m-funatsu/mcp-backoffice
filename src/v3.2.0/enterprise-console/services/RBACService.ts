/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * RBAC（役割ベースアクセス制御）サービス
 */

import { Pool } from 'pg';
import {
  Role,
  Permission,
  UserRole,
  RolePermission,
  ResourceType,
  ActionType,
  ScopeType,
  PermissionConditions,
  ApiResponse,
} from '../types';

export class RBACService {
  constructor(private db: Pool) {}

  /**
   * ユーザーの権限を検証
   */
  async checkPermission(
    userId: string,
    resource: ResourceType,
    action: ActionType,
    targetData?: {
      departmentId?: string;
      amount?: number;
      ownerId?: string;
    }
  ): Promise<boolean> {
    try {
      // ユーザーの有効な権限を取得
      const permissions = await this.getUserPermissions(userId);
      
      // リソースとアクションに一致する権限を検索
      const relevantPermissions = permissions.filter(
        p => p.resource === resource && p.action === action
      );

      if (relevantPermissions.length === 0) {
        return false;
      }

      // 各権限のスコープと条件をチェック
      for (const permission of relevantPermissions) {
        if (await this.validatePermissionScope(permission, userId, targetData)) {
          if (await this.validatePermissionConditions(permission, targetData)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * ユーザーの全権限を取得
   */
  async getUserPermissions(userId: string): Promise<(Permission & { conditions?: PermissionConditions })[]> {
    const query = `
      SELECT DISTINCT
        p.id,
        p.resource,
        p.action,
        p.scope,
        p.description,
        rp.conditions,
        ur.department_id
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = $1
        AND ur.effective_from <= CURRENT_DATE
        AND (ur.effective_until IS NULL OR ur.effective_until >= CURRENT_DATE)
      ORDER BY r.priority ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows;
  }

  /**
   * 権限のスコープを検証
   */
  private async validatePermissionScope(
    permission: Permission & { department_id?: string },
    userId: string,
    targetData?: { departmentId?: string; ownerId?: string }
  ): Promise<boolean> {
    switch (permission.scope) {
      case 'own':
        // 自分のデータのみアクセス可能
        return targetData?.ownerId === userId;
      
      case 'department':
        // 部門内のデータにアクセス可能
        if (!permission.department_id || !targetData?.departmentId) {
          return false;
        }
        return permission.department_id === targetData.departmentId;
      
      case 'company':
        // 全社データにアクセス可能
        return true;
      
      default:
        return false;
    }
  }

  /**
   * 権限の条件を検証
   */
  private async validatePermissionConditions(
    permission: Permission & { conditions?: PermissionConditions },
    targetData?: { amount?: number }
  ): Promise<boolean> {
    if (!permission.conditions) {
      return true;
    }

    // 金額上限チェック
    if (permission.conditions.maxAmount && targetData?.amount) {
      if (targetData.amount > permission.conditions.maxAmount) {
        return false;
      }
    }

    // 時間帯制限チェック
    if (permission.conditions.timeRestriction) {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM形式
      const { startTime, endTime } = permission.conditions.timeRestriction;
      
      if (currentTime < startTime || currentTime > endTime) {
        return false;
      }
    }

    return true;
  }

  /**
   * 役割の一覧を取得
   */
  async getRoles(includeSystem: boolean = true): Promise<Role[]> {
    const query = includeSystem
      ? 'SELECT * FROM roles ORDER BY priority ASC'
      : 'SELECT * FROM roles WHERE system_role = false ORDER BY priority ASC';
    
    const result = await this.db.query(query);
    return result.rows;
  }

  /**
   * 役割を作成
   */
  async createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const query = `
      INSERT INTO roles (name, display_name, description, system_role, priority)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      role.name,
      role.displayName,
      role.description,
      role.systemRole || false,
      role.priority || 1000,
    ];
    
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * 役割を更新
   */
  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role> {
    const allowedFields = ['display_name', 'description', 'priority'];
    const updateClauses: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateClauses.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updateClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(roleId);
    const query = `
      UPDATE roles
      SET ${updateClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.db.query(query, values);
    if (result.rows.length === 0) {
      throw new Error('Role not found');
    }
    
    return result.rows[0];
  }

  /**
   * 役割を削除
   */
  async deleteRole(roleId: string): Promise<void> {
    // システム役割は削除不可
    const checkQuery = 'SELECT system_role FROM roles WHERE id = $1';
    const checkResult = await this.db.query(checkQuery, [roleId]);
    
    if (checkResult.rows.length === 0) {
      throw new Error('Role not found');
    }
    
    if (checkResult.rows[0].system_role) {
      throw new Error('System roles cannot be deleted');
    }

    const deleteQuery = 'DELETE FROM roles WHERE id = $1';
    await this.db.query(deleteQuery, [roleId]);
  }

  /**
   * 役割に権限を付与
   */
  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
    conditions?: PermissionConditions
  ): Promise<void> {
    const query = `
      INSERT INTO role_permissions (role_id, permission_id, conditions)
      VALUES ($1, $2, $3)
      ON CONFLICT (role_id, permission_id) DO UPDATE
      SET conditions = $3
    `;
    
    await this.db.query(query, [roleId, permissionId, conditions || null]);
  }

  /**
   * 役割から権限を削除
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    const query = 'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2';
    await this.db.query(query, [roleId, permissionId]);
  }

  /**
   * ユーザーに役割を割り当て
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string,
    options?: {
      departmentId?: string;
      effectiveFrom?: Date;
      effectiveUntil?: Date;
    }
  ): Promise<UserRole> {
    const query = `
      INSERT INTO user_roles (user_id, role_id, department_id, effective_from, effective_until, assigned_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      userId,
      roleId,
      options?.departmentId || null,
      options?.effectiveFrom || new Date(),
      options?.effectiveUntil || null,
      assignedBy,
    ];
    
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * ユーザーから役割を削除
   */
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const query = 'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2';
    await this.db.query(query, [userId, roleId]);
  }

  /**
   * ユーザーの役割一覧を取得
   */
  async getUserRoles(userId: string): Promise<(UserRole & { role: Role })[]> {
    const query = `
      SELECT 
        ur.*,
        r.id as role_id,
        r.name as role_name,
        r.display_name as role_display_name,
        r.description as role_description,
        r.system_role as role_system_role,
        r.priority as role_priority
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
        AND ur.effective_from <= CURRENT_DATE
        AND (ur.effective_until IS NULL OR ur.effective_until >= CURRENT_DATE)
      ORDER BY r.priority ASC
    `;
    
    const result = await this.db.query(query, [userId]);
    
    return result.rows.map(row => ({
      userId: row.user_id,
      roleId: row.role_id,
      departmentId: row.department_id,
      effectiveFrom: row.effective_from,
      effectiveUntil: row.effective_until,
      assignedBy: row.assigned_by,
      createdAt: row.created_at,
      role: {
        id: row.role_id,
        name: row.role_name,
        displayName: row.role_display_name,
        description: row.role_description,
        systemRole: row.role_system_role,
        priority: row.role_priority,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    }));
  }

  /**
   * 権限の一覧を取得
   */
  async getPermissions(filters?: {
    resource?: ResourceType;
    action?: ActionType;
    scope?: ScopeType;
  }): Promise<Permission[]> {
    let query = 'SELECT * FROM permissions WHERE 1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (filters?.resource) {
      query += ` AND resource = $${paramCount}`;
      values.push(filters.resource);
      paramCount++;
    }

    if (filters?.action) {
      query += ` AND action = $${paramCount}`;
      values.push(filters.action);
      paramCount++;
    }

    if (filters?.scope) {
      query += ` AND scope = $${paramCount}`;
      values.push(filters.scope);
      paramCount++;
    }

    query += ' ORDER BY resource, action, scope';
    
    const result = await this.db.query(query, values);
    return result.rows;
  }

  /**
   * 権限を作成
   */
  async createPermission(permission: Omit<Permission, 'id' | 'createdAt'>): Promise<Permission> {
    const query = `
      INSERT INTO permissions (resource, action, scope, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const values = [
      permission.resource,
      permission.action,
      permission.scope,
      permission.description,
    ];
    
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * バルク権限チェック
   */
  async checkMultiplePermissions(
    userId: string,
    permissions: Array<{
      resource: ResourceType;
      action: ActionType;
      targetData?: any;
    }>
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    // 一度にユーザーの全権限を取得
    const userPermissions = await this.getUserPermissions(userId);
    
    for (const perm of permissions) {
      const key = `${perm.resource}:${perm.action}`;
      const hasPermission = await this.checkPermissionWithCache(
        userPermissions,
        userId,
        perm.resource,
        perm.action,
        perm.targetData
      );
      results.set(key, hasPermission);
    }
    
    return results;
  }

  /**
   * キャッシュされた権限でチェック
   */
  private async checkPermissionWithCache(
    userPermissions: (Permission & { conditions?: PermissionConditions })[],
    userId: string,
    resource: ResourceType,
    action: ActionType,
    targetData?: any
  ): Promise<boolean> {
    const relevantPermissions = userPermissions.filter(
      p => p.resource === resource && p.action === action
    );

    for (const permission of relevantPermissions) {
      if (await this.validatePermissionScope(permission, userId, targetData)) {
        if (await this.validatePermissionConditions(permission, targetData)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 権限の階層的チェック（上位権限が下位権限を包含）
   */
  async hasHierarchicalPermission(
    userId: string,
    resource: ResourceType,
    action: ActionType,
    scope: ScopeType
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    // スコープの階層: company > department > own
    const scopeHierarchy = ['company', 'department', 'own'];
    const requiredScopeIndex = scopeHierarchy.indexOf(scope);
    
    for (const permission of permissions) {
      if (permission.resource === resource && permission.action === action) {
        const permissionScopeIndex = scopeHierarchy.indexOf(permission.scope);
        // より広いスコープを持っていれば許可
        if (permissionScopeIndex <= requiredScopeIndex) {
          return true;
        }
      }
    }
    
    return false;
  }
}