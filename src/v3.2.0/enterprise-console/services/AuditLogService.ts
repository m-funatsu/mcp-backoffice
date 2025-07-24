/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * 監査ログサービス
 */

import { Pool } from 'pg';
import {
  AuditLog,
  AuditEntityType,
  AuditAction,
  AuditChanges,
} from '../types';

export class AuditLogService {
  constructor(private db: Pool) {}

  /**
   * 監査ログを記録
   */
  async log(params: {
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    changes: AuditChanges;
    userId: string;
    userIp?: string;
    userAgent?: string;
    sessionId?: string;
    reason?: string;
  }): Promise<AuditLog> {
    const query = `
      INSERT INTO audit_logs (
        entity_type, entity_id, action, changes, user_id,
        user_ip, user_agent, session_id, reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      params.entityType,
      params.entityId,
      params.action,
      JSON.stringify(params.changes),
      params.userId,
      params.userIp || null,
      params.userAgent || null,
      params.sessionId || null,
      params.reason || null,
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * 監査ログを検索
   */
  async search(filters: {
    entityType?: AuditEntityType;
    entityId?: string;
    userId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    const values: any[] = [];
    let paramCount = 1;

    if (filters.entityType) {
      whereClause += ` AND entity_type = $${paramCount}`;
      values.push(filters.entityType);
      paramCount++;
    }

    if (filters.entityId) {
      whereClause += ` AND entity_id = $${paramCount}`;
      values.push(filters.entityId);
      paramCount++;
    }

    if (filters.userId) {
      whereClause += ` AND user_id = $${paramCount}`;
      values.push(filters.userId);
      paramCount++;
    }

    if (filters.action) {
      whereClause += ` AND action = $${paramCount}`;
      values.push(filters.action);
      paramCount++;
    }

    if (filters.startDate) {
      whereClause += ` AND created_at >= $${paramCount}`;
      values.push(filters.startDate);
      paramCount++;
    }

    if (filters.endDate) {
      whereClause += ` AND created_at <= $${paramCount}`;
      values.push(filters.endDate);
      paramCount++;
    }

    // カウントクエリ
    const countQuery = `SELECT COUNT(*) FROM audit_logs ${whereClause}`;
    const countResult = await this.db.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // データ取得クエリ
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    
    const dataQuery = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN employees u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    
    values.push(limit, offset);
    const dataResult = await this.db.query(dataQuery, values);

    return {
      logs: dataResult.rows,
      total,
    };
  }

  /**
   * エンティティの変更履歴を取得
   */
  async getEntityHistory(
    entityType: AuditEntityType,
    entityId: string
  ): Promise<AuditLog[]> {
    const query = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN employees u ON al.user_id = u.id
      WHERE al.entity_type = $1 AND al.entity_id = $2
      ORDER BY al.created_at DESC
    `;

    const result = await this.db.query(query, [entityType, entityId]);
    return result.rows;
  }

  /**
   * ユーザーのアクティビティ履歴を取得
   */
  async getUserActivity(
    userId: string,
    limit: number = 100
  ): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * 統計情報を取得
   */
  async getStatistics(filters: {
    startDate: Date;
    endDate: Date;
    groupBy: 'entity_type' | 'action' | 'user' | 'day';
  }): Promise<Array<{ key: string; count: number }>> {
    let groupByClause: string;
    let selectClause: string;

    switch (filters.groupBy) {
      case 'entity_type':
        groupByClause = 'entity_type';
        selectClause = 'entity_type as key';
        break;
      case 'action':
        groupByClause = 'action';
        selectClause = 'action as key';
        break;
      case 'user':
        groupByClause = 'user_id';
        selectClause = 'u.name as key';
        break;
      case 'day':
        groupByClause = 'DATE(created_at)';
        selectClause = 'DATE(created_at)::text as key';
        break;
      default:
        throw new Error('Invalid groupBy parameter');
    }

    const query = filters.groupBy === 'user' ? `
      SELECT ${selectClause}, COUNT(*) as count
      FROM audit_logs al
      LEFT JOIN employees u ON al.user_id = u.id
      WHERE al.created_at >= $1 AND al.created_at <= $2
      GROUP BY ${groupByClause}, u.name
      ORDER BY count DESC
    ` : `
      SELECT ${selectClause}, COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY ${groupByClause}
      ORDER BY count DESC
    `;

    const result = await this.db.query(query, [filters.startDate, filters.endDate]);
    return result.rows;
  }

  /**
   * 重要な変更を検出
   */
  async detectCriticalChanges(
    timeWindow: number = 3600000 // 1時間
  ): Promise<Array<{
    userId: string;
    userName: string;
    criticalActions: AuditLog[];
    riskScore: number;
  }>> {
    const criticalActions: AuditAction[] = ['delete', 'disable'];
    const criticalEntities: AuditEntityType[] = ['role', 'permission', 'agent_config'];

    const query = `
      SELECT 
        al.*,
        u.name as user_name
      FROM audit_logs al
      JOIN employees u ON al.user_id = u.id
      WHERE al.created_at >= NOW() - INTERVAL '${timeWindow} milliseconds'
        AND (
          al.action = ANY($1::text[])
          OR al.entity_type = ANY($2::text[])
        )
      ORDER BY al.user_id, al.created_at DESC
    `;

    const result = await this.db.query(query, [criticalActions, criticalEntities]);
    
    // ユーザーごとにグループ化
    const userActions = new Map<string, AuditLog[]>();
    const userNames = new Map<string, string>();

    for (const log of result.rows) {
      if (!userActions.has(log.user_id)) {
        userActions.set(log.user_id, []);
        userNames.set(log.user_id, log.user_name);
      }
      userActions.get(log.user_id)!.push(log);
    }

    // リスクスコアを計算
    const criticalChanges: Array<{
      userId: string;
      userName: string;
      criticalActions: AuditLog[];
      riskScore: number;
    }> = [];

    for (const [userId, actions] of userActions) {
      let riskScore = 0;
      
      // アクション数に基づくスコア
      riskScore += actions.length * 10;
      
      // 削除アクションに高いスコア
      riskScore += actions.filter(a => a.action === 'delete').length * 20;
      
      // 権限関連の変更に高いスコア
      riskScore += actions.filter(a => 
        a.entityType === 'role' || a.entityType === 'permission'
      ).length * 15;

      if (riskScore > 30) { // 閾値を超えた場合のみ返す
        criticalChanges.push({
          userId,
          userName: userNames.get(userId) || 'Unknown',
          criticalActions: actions,
          riskScore,
        });
      }
    }

    // リスクスコアの降順でソート
    return criticalChanges.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * 監査ログのエクスポート
   */
  async exportLogs(filters: {
    startDate: Date;
    endDate: Date;
    format: 'json' | 'csv';
  }): Promise<string> {
    const query = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN employees u ON al.user_id = u.id
      WHERE al.created_at >= $1 AND al.created_at <= $2
      ORDER BY al.created_at DESC
    `;

    const result = await this.db.query(query, [filters.startDate, filters.endDate]);

    if (filters.format === 'json') {
      return JSON.stringify(result.rows, null, 2);
    } else {
      // CSV形式
      const headers = [
        'ID', 'Entity Type', 'Entity ID', 'Action', 'User ID', 'User Name',
        'User Email', 'IP Address', 'Session ID', 'Reason', 'Created At'
      ];
      
      const rows = result.rows.map(log => [
        log.id,
        log.entity_type,
        log.entity_id,
        log.action,
        log.user_id,
        log.user_name || '',
        log.user_email || '',
        log.user_ip || '',
        log.session_id || '',
        log.reason || '',
        log.created_at.toISOString(),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      return csv;
    }
  }

  /**
   * 監査ログの自動クリーンアップ
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const query = `
      DELETE FROM audit_logs
      WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
      RETURNING id
    `;

    const result = await this.db.query(query);
    return result.rowCount;
  }

  /**
   * リアルタイムアラート用の監視
   */
  async checkForAnomalies(): Promise<Array<{
    type: 'unusual_activity' | 'permission_escalation' | 'mass_deletion';
    description: string;
    severity: 'low' | 'medium' | 'high';
    details: any;
  }>> {
    const anomalies: Array<{
      type: 'unusual_activity' | 'permission_escalation' | 'mass_deletion';
      description: string;
      severity: 'low' | 'medium' | 'high';
      details: any;
    }> = [];

    // 1. 異常なアクティビティパターン（深夜の大量操作など）
    const unusualActivityQuery = `
      SELECT 
        user_id,
        COUNT(*) as action_count,
        EXTRACT(HOUR FROM created_at) as hour
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY user_id, EXTRACT(HOUR FROM created_at)
      HAVING COUNT(*) > 20
    `;

    const unusualActivity = await this.db.query(unusualActivityQuery);
    for (const activity of unusualActivity.rows) {
      if (activity.hour >= 0 && activity.hour <= 6) {
        anomalies.push({
          type: 'unusual_activity',
          description: `深夜の異常なアクティビティを検出（${activity.action_count}件の操作）`,
          severity: 'high',
          details: activity,
        });
      }
    }

    // 2. 権限エスカレーション（通常ユーザーが管理者権限を取得）
    const permissionEscalationQuery = `
      SELECT 
        al.*,
        r.name as role_name
      FROM audit_logs al
      JOIN roles r ON al.entity_id = r.id
      WHERE al.entity_type = 'user_role'
        AND al.action = 'create'
        AND al.created_at >= NOW() - INTERVAL '24 hours'
        AND r.name IN ('super_admin', 'company_admin')
    `;

    const permissionEscalations = await this.db.query(permissionEscalationQuery);
    for (const escalation of permissionEscalations.rows) {
      anomalies.push({
        type: 'permission_escalation',
        description: `権限エスカレーションを検出（${escalation.role_name}役割の付与）`,
        severity: 'high',
        details: escalation,
      });
    }

    // 3. 大量削除の検出
    const massDeletionQuery = `
      SELECT 
        user_id,
        entity_type,
        COUNT(*) as deletion_count
      FROM audit_logs
      WHERE action = 'delete'
        AND created_at >= NOW() - INTERVAL '1 hour'
      GROUP BY user_id, entity_type
      HAVING COUNT(*) > 10
    `;

    const massDeletions = await this.db.query(massDeletionQuery);
    for (const deletion of massDeletions.rows) {
      anomalies.push({
        type: 'mass_deletion',
        description: `大量削除を検出（${deletion.entity_type}を${deletion.deletion_count}件削除）`,
        severity: 'high',
        details: deletion,
      });
    }

    return anomalies;
  }
}

// サンプル実装用のモック
const mockService = {
  async getLogs(params: any) {
    return {
      logs: [],
      total: 0
    };
  },
  async exportLogs(filters: any) {
    return 'exported data';
  }
};

export default mockService;