import { DatabasePostgreSQL } from './database_postgresql.js';
import type { Employee, TimeRecord, PayrollCalculation, PayrollRules, AttendanceReport, ExpenseCategory, ExpenseRequest, ApprovalWorkflow, ReceiptImage, AccountingEntry, ExtractedReceiptData, LeaveBalance, LeaveType } from './types.js';

class Database extends DatabasePostgreSQL {
  constructor(connectionString?: string) {
    super();
  }

  async connect(): Promise<void> {
    return await super.connect();
  }

  async disconnect(): Promise<void> {
    return await super.disconnect();
  }

  // Explicitly expose inherited methods
  async initializeDatabase(): Promise<void> {
    return await super.initializeDatabase();
  }

  async addEmployee(employee: Omit<Employee, 'id'>): Promise<string> {
    return await super.addEmployee(employee);
  }

  async getEmployee(id: string): Promise<Employee | null> {
    return await super.getEmployee(id);
  }

  async getAllEmployees(): Promise<Employee[]> {
    return await super.getAllEmployees();
  }

  async clockIn(employeeId: string, clockInTime: Date, recordType: 'ic_card' | 'pc_log' | 'manual' = 'manual'): Promise<string> {
    return await super.clockIn(employeeId, clockInTime, recordType);
  }

  async clockOut(employeeId: string, clockOutTime: Date, breakMinutes: number = 0): Promise<boolean> {
    return await super.clockOut(employeeId, clockOutTime, breakMinutes);
  }

  async getTimeRecords(employeeId: string, startDate: Date, endDate: Date): Promise<TimeRecord[]> {
    return await super.getTimeRecords(employeeId, startDate, endDate);
  }

  async getPayrollRules(): Promise<PayrollRules> {
    return await super.getPayrollRules();
  }

  async savePayrollCalculation(calculation: PayrollCalculation): Promise<void> {
    return await super.savePayrollCalculation(calculation);
  }

  async getPayrollCalculation(employeeId: string, month: string): Promise<PayrollCalculation | null> {
    return await super.getPayrollCalculation(employeeId, month);
  }

  async isHoliday(date: Date): Promise<boolean> {
    return await super.isHoliday(date);
  }

  async close(): Promise<void> {
    return await super.close();
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    return await super.query(sql, params);
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    return await super.get(sql, params);
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    return await super.all(sql, params);
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    return await super.run(sql, params);
  }

  async getAttendanceReport(employeeId: string, startDate: Date, endDate: Date): Promise<AttendanceReport> {
    return await super.getAttendanceReport(employeeId, startDate, endDate);
  }

  // Additional methods for expense engine compatibility
  async getExpenseCategory(categoryId: string): Promise<any> {
    // Use mock categories until database table is available
    const mockCategories = {
      'EXP_CAT_001': {
        id: 'EXP_CAT_001',
        name: '交通費',
        code: 'TRANSPORT',
        description: '電車、バス、タクシー等の交通費',
        dailyLimit: 10000,
        monthlyLimit: 300000,
        requiresReceipt: true,
        taxDeductible: true,
        glAccountCode: '7110'
      },
      'EXP_CAT_002': {
        id: 'EXP_CAT_002',
        name: '宿泊費',
        code: 'ACCOMMODATION',
        description: 'ホテル、旅館等の宿泊費',
        dailyLimit: 15000,
        monthlyLimit: 200000,
        requiresReceipt: true,
        taxDeductible: true,
        glAccountCode: '7120'
      },
      'EXP_CAT_003': {
        id: 'EXP_CAT_003',
        name: '飲食費',
        code: 'MEALS',
        description: '業務に関連する飲食費',
        dailyLimit: 5000,
        monthlyLimit: 100000,
        requiresReceipt: true,
        taxDeductible: true,
        glAccountCode: '7130'
      },
      'EXP_CAT_008': {
        id: 'EXP_CAT_008',
        name: 'その他',
        code: 'OTHER',
        description: 'その他の経費',
        dailyLimit: 10000,
        monthlyLimit: 100000,
        requiresReceipt: true,
        taxDeductible: true,
        glAccountCode: '7190'
      }
    };
    
    return mockCategories[categoryId] || null;
  }

  async updateEmployee(employeeId: string, updates: any): Promise<boolean> {
    const result = await this.run('UPDATE employees SET name = $1, department = $2, position = $3 WHERE id = $4', 
      [updates.name, updates.department, updates.position, employeeId]);
    return result.rowCount > 0;
  }

  async exec(sql: string): Promise<void> {
    await this.run(sql);
  }

  async createAccountingEntry(entry: any): Promise<string> {
    const id = `ACC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.run(`
      INSERT INTO accounting_entries (id, expense_request_id, entry_date, description, debit_account, credit_account, amount, tax_amount, reference, exported, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [id, entry.expenseRequestId, entry.entryDate, entry.description, entry.debitAccount, entry.creditAccount, entry.amount, entry.taxAmount, entry.reference, entry.exported, new Date().toISOString()]);
    return id;
  }

  async getExpenseRequestsByEmployee(employeeId: string): Promise<any[]> {
    const rows = await this.all('SELECT * FROM expense_requests WHERE employee_id = $1', [employeeId]);
    return rows;
  }

  // Expense operations
  async createExpenseCategory(category: ExpenseCategory): Promise<string> {
    const { id, name, description, isActive, accountingCode, approvalRequired } = category;
    
    await this.run(`
      INSERT INTO expense_categories (id, name, description, is_active, accounting_code, approval_required)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, name, description, isActive, accountingCode, approvalRequired]);
    
    return id;
  }

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    const rows = await this.all(`
      SELECT * FROM expense_categories 
      WHERE is_active = 1
      ORDER BY name
    `);
    
    return rows;
  }

  async createExpenseRequest(request: ExpenseRequest): Promise<string> {
    const { id, employeeId, categoryId, amount, description, expenseDate, receiptRequired, status } = request;
    
    await this.run(`
      INSERT INTO expense_requests (id, employee_id, category_id, amount, description, expense_date, receipt_required, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [id, employeeId, categoryId, amount, description, expenseDate, receiptRequired, status]);
    
    return id;
  }

  async getExpenseRequests(employeeId?: string, status?: string): Promise<ExpenseRequest[]> {
    let sql = 'SELECT * FROM expense_requests';
    const params: any[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;
    
    if (employeeId) {
      conditions.push(`employee_id = $${paramIndex++}`);
      params.push(employeeId);
    }
    
    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY expense_date DESC';
    
    const rows = await this.all(sql, params);
    return rows;
  }

  // Leave management operations
  async getLeaveBalance(employeeId: string, leaveType?: LeaveType): Promise<LeaveBalance | null> {
    let sql = `SELECT * FROM leave_balances WHERE employee_id = $1`;
    const params: any[] = [employeeId];
    
    if (leaveType) {
      sql += ` AND leave_type = $2`;
      params.push(leaveType);
    }
    
    const row = await this.get(sql, params);
    
    if (!row) {
      return null;
    }
    
    return {
      id: row.id,
      employeeId: row.employee_id,
      leaveType: row.leave_type as LeaveType,
      year: row.year,
      grantedDays: row.granted_days,
      usedDays: row.used_days,
      remainingDays: row.remaining_days,
      expiryDate: row.expiry_date ? new Date(row.expiry_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  async updateLeaveBalance(employeeId: string, leaveType: string, days: number): Promise<boolean> {
    const result = await this.run(`
      UPDATE leave_balances 
      SET ${leaveType}_balance = ${leaveType}_balance + $2
      WHERE employee_id = $1
    `, [employeeId, days]);
    
    return result.changes > 0;
  }

  async updateExpenseRequestStatus(requestId: string, status: string): Promise<boolean> {
    const result = await this.run(`
      UPDATE expense_requests 
      SET status = $2
      WHERE id = $1
    `, [requestId, status]);
    
    return result.changes > 0;
  }

  async getExpenseRequest(requestId: string): Promise<any> {
    const row = await this.get(`
      SELECT * FROM expense_requests WHERE id = $1
    `, [requestId]);
    
    return row || null;
  }

  // Compliance monitoring methods
  async monitor36Compliance(employeeId: string, period: any): Promise<any> {
    const rows = await this.all(`
      SELECT * FROM labor_hours_summary 
      WHERE employee_id = $1 AND period_start >= $2 AND period_end <= $3
    `, [employeeId, period.start, period.end]);
    
    return rows;
  }

  async generateComplianceAlert(alertData: any): Promise<string> {
    const alertId = `ALERT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.run(`
      INSERT INTO compliance_alerts (id, employee_id, alert_type, severity, current_value, threshold_value, period_start, period_end)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      alertId,
      alertData.employeeId,
      alertData.alertType,
      alertData.severity,
      alertData.currentValue,
      alertData.thresholdValue,
      alertData.periodStart,
      alertData.periodEnd
    ]);
    
    return alertId;
  }

  async saveObjectiveRecord(record: any): Promise<string> {
    const recordId = `OR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.run(`
      INSERT INTO objective_records (id, employee_id, record_date, ic_card_in, ic_card_out, self_reported_in, self_reported_out)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      recordId,
      record.employeeId,
      record.recordDate,
      record.icCardIn,
      record.icCardOut,
      record.selfReportedIn,
      record.selfReportedOut
    ]);
    
    return recordId;
  }

  async generateComplianceReport(period: any): Promise<any> {
    const rows = await this.all(`
      SELECT * FROM compliance_alerts 
      WHERE alert_date >= $1 AND alert_date <= $2
      ORDER BY alert_date DESC
    `, [period.start, period.end]);
    
    return {
      alerts: rows,
      summary: {
        totalAlerts: rows.length,
        criticalAlerts: rows.filter((a: any) => a.severity === 'critical').length,
        warningAlerts: rows.filter((a: any) => a.severity === 'warning').length
      }
    };
  }

  async recordHealthCheckMeasure(measure: any): Promise<string> {
    const measureId = `HM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.run(`
      INSERT INTO health_safety_records (id, employee_id, incident_type, incident_date, severity_level, description)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      measureId,
      measure.employeeId,
      'health_check',
      measure.date,
      'minor',
      measure.description
    ]);
    
    return measureId;
  }

  // Talent Management Operations
  async createSkill(skill: any): Promise<string> {
    const skillId = skill.id || `SKILL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.run(`
      INSERT INTO skills (id, name, category, description, competency_levels, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [skillId, skill.name, skill.category, skill.description, skill.competencyLevels || 5, skill.isActive !== false]);
    
    return skillId;
  }

  async getSkillsByCategory(category?: string): Promise<any[]> {
    let sql = 'SELECT * FROM skills WHERE is_active = 1';
    const params: any[] = [];
    
    if (category) {
      sql += ' AND category = $1';
      params.push(category);
    }
    
    sql += ' ORDER BY category, name';
    
    const rows = await this.all(sql, params);
    return rows;
  }

  async assignSkillToEmployee(employeeId: string, skillId: string, proficiencyLevel: number): Promise<string> {
    const id = `ES_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.run(`
      INSERT INTO employee_skills (id, employee_id, skill_id, proficiency_level, assessment_date)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (employee_id, skill_id) DO UPDATE SET
        proficiency_level = EXCLUDED.proficiency_level,
        assessment_date = EXCLUDED.assessment_date
    `, [id, employeeId, skillId, proficiencyLevel, new Date().toISOString()]);
    
    return id;
  }

  async getEmployeeSkills(employeeId: string): Promise<any[]> {
    const rows = await this.all(`
      SELECT es.*, s.name as skill_name, s.category as skill_category
      FROM employee_skills es
      JOIN skills s ON es.skill_id = s.id
      WHERE es.employee_id = $1
      ORDER BY s.category, s.name
    `, [employeeId]);
    
    return rows;
  }

  // Training management
  async createTrainingRecord(training: any): Promise<string> {
    const trainingId = training.id || `TR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.run(`
      INSERT INTO training_history (id, employee_id, training_name, training_type, provider, start_date, end_date, duration_hours, cost, status, related_skills, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      trainingId,
      training.employeeId,
      training.trainingName,
      training.trainingType,
      training.provider,
      training.startDate,
      training.endDate,
      training.durationHours,
      training.cost || 0,
      training.status || 'scheduled',
      training.relatedSkills ? JSON.stringify(training.relatedSkills) : null,
      training.notes
    ]);
    
    return trainingId;
  }

  async getTrainingHistory(employeeId: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    let sql = 'SELECT * FROM training_history WHERE employee_id = $1';
    const params: any[] = [employeeId];
    
    if (startDate) {
      sql += ' AND start_date >= $2';
      params.push(startDate.toISOString().split('T')[0]);
    }
    
    if (endDate) {
      sql += ' AND start_date <= $' + (startDate ? '3' : '2');
      params.push(endDate.toISOString().split('T')[0]);
    }
    
    sql += ' ORDER BY start_date DESC';
    
    const rows = await this.all(sql, params);
    return rows;
  }

  // Performance evaluation
  async createPerformanceEvaluation(evaluation: any): Promise<string> {
    const evaluationId = evaluation.id || `PE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.run(`
      INSERT INTO performance_evaluations (id, employee_id, evaluator_id, evaluation_period, evaluation_date, overall_rating, competency_ratings, goals_achievement, strengths, areas_for_improvement, development_plans, promotion_readiness, succession_potential, retention_risk, feedback_360, comments, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [
      evaluationId,
      evaluation.employeeId,
      evaluation.evaluatorId,
      evaluation.evaluationPeriod,
      evaluation.evaluationDate,
      evaluation.overallRating,
      JSON.stringify(evaluation.competencyRatings || {}),
      evaluation.goalsAchievement,
      evaluation.strengths,
      evaluation.areasForImprovement,
      evaluation.developmentPlans,
      evaluation.promotionReadiness,
      evaluation.successionPotential,
      evaluation.retentionRisk,
      JSON.stringify(evaluation.feedback360 || {}),
      evaluation.comments,
      evaluation.status || 'draft'
    ]);
    
    return evaluationId;
  }

  async getPerformanceEvaluations(employeeId: string, period?: string): Promise<any[]> {
    let sql = 'SELECT * FROM performance_evaluations WHERE employee_id = $1';
    const params: any[] = [employeeId];
    
    if (period) {
      sql += ' AND evaluation_period = $2';
      params.push(period);
    }
    
    sql += ' ORDER BY evaluation_date DESC';
    
    const rows = await this.all(sql, params);
    return rows;
  }

  // Goal management (MBO & OKR)
  async createGoal(goal: any): Promise<string> {
    const goalId = goal.id || `GOAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.run(`
      INSERT INTO goals_okrs (id, employee_id, goal_type, title, description, category, target_value, current_value, unit, weight, priority, start_date, due_date, status, achievement_rate, key_results, milestones, parent_goal_id, related_skills, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `, [
      goalId,
      goal.employeeId,
      goal.goalType,
      goal.title,
      goal.description,
      goal.category,
      goal.targetValue,
      goal.currentValue || 0,
      goal.unit,
      goal.weight || 100,
      goal.priority || 'medium',
      goal.startDate,
      goal.dueDate,
      goal.status || 'in_progress',
      goal.achievementRate || 0,
      JSON.stringify(goal.keyResults || []),
      JSON.stringify(goal.milestones || []),
      goal.parentGoalId,
      goal.relatedSkills ? JSON.stringify(goal.relatedSkills) : null,
      goal.notes
    ]);
    
    return goalId;
  }

  async getGoals(employeeId: string, goalType?: string): Promise<any[]> {
    let sql = 'SELECT * FROM goals_okrs WHERE employee_id = $1';
    const params: any[] = [employeeId];
    
    if (goalType) {
      sql += ' AND goal_type = $2';
      params.push(goalType);
    }
    
    sql += ' ORDER BY start_date DESC';
    
    const rows = await this.all(sql, params);
    return rows;
  }

  async updateGoalProgress(goalId: string, currentValue: number, achievementRate: number): Promise<boolean> {
    const result = await this.run(`
      UPDATE goals_okrs 
      SET current_value = $2, achievement_rate = $3
      WHERE id = $1
    `, [goalId, currentValue, achievementRate]);
    
    return result.changes > 0;
  }

  // ISO30414 metrics calculation (training related)
  async calculateTrainingMetrics(startDate: Date, endDate: Date): Promise<any> {
    const trainingHoursResult = await this.all(`
      SELECT 
        COUNT(DISTINCT employee_id) as total_employees,
        SUM(duration_hours) as total_training_hours,
        AVG(duration_hours) as avg_training_hours_per_employee,
        SUM(cost) as total_training_cost,
        COUNT(*) as total_training_sessions
      FROM training_history 
      WHERE start_date >= $1 AND start_date <= $2 AND status = 'completed'
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);
    
    const trainingByTypeResult = await this.all(`
      SELECT 
        training_type,
        COUNT(*) as sessions_count,
        SUM(duration_hours) as total_hours,
        SUM(cost) as total_cost
      FROM training_history 
      WHERE start_date >= $1 AND start_date <= $2 AND status = 'completed'
      GROUP BY training_type
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);
    
    return {
      totalEmployees: trainingHoursResult[0]?.total_employees || 0,
      totalTrainingHours: trainingHoursResult[0]?.total_training_hours || 0,
      avgTrainingHoursPerEmployee: trainingHoursResult[0]?.avg_training_hours_per_employee || 0,
      totalTrainingCost: trainingHoursResult[0]?.total_training_cost || 0,
      totalTrainingSessions: trainingHoursResult[0]?.total_training_sessions || 0,
      trainingByType: trainingByTypeResult
    };
  }
}

// Singleton instance
let database: Database | null = null;

export function getDatabase(): Database {
  if (!database) {
    database = new Database();
  }
  return database;
}

export default Database;
export { Database };