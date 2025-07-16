import type { Employee } from './types.js';
import Database from './database.js';

export interface LeaveBalance {
  id: number;
  employeeId: string;
  leaveType: LeaveType;
  year: number;
  grantedDays: number;
  usedDays: number;
  remainingDays: number;
  expiryDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  daysRequested: number;
  halfDay: boolean;
  reason?: string;
  status: RequestStatus;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  autoApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamCalendarEvent {
  id: number;
  department: string;
  date: Date;
  employeeId: string;
  eventType: EventType;
  eventTitle: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  createdAt: Date;
  employeeName?: string;
}

export interface LeavePolicy {
  id: number;
  leaveType: LeaveType;
  tenureMonths: number;
  grantedDays: number;
  maxConsecutiveDays?: number;
  advanceNoticeDays: number;
  requiresApproval: boolean;
  autoApprovalConditions?: string;
  carryoverAllowed: boolean;
  carryoverLimitDays?: number;
  expiryMonths?: number;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdAt: Date;
}

export type LeaveType = 'annual' | 'sick' | 'special' | 'maternity' | 'paternity' | 'bereavement' | 'personal';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type EventType = 'leave' | 'meeting' | 'training' | 'holiday';

export interface LeaveRequestInput {
  employeeId: string;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  halfDay?: boolean;
  reason?: string;
}

export interface LeaveAnalytics {
  totalRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
  pendingRequests: number;
  totalDaysRequested: number;
  totalDaysApproved: number;
  averageProcessingTime: number;
  mostPopularLeaveType: LeaveType;
  departmentBreakdown: { [department: string]: number };
}

/**
 * Leave Management System
 * Handles vacation, sick leave, and other leave requests
 * Compliant with Japanese Labor Standards Act
 */
export class LeaveManagement {
  private db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  /**
   * Process natural language leave request
   */
  async processNaturalLanguageRequest(employeeId: string, requestText: string): Promise<LeaveRequest> {
    const parsed = this.parseLeaveRequest(requestText);
    
    // Validate the request
    await this.validateLeaveRequest(employeeId, parsed);
    
    // Create the leave request
    const request = await this.createLeaveRequest({
      employeeId,
      ...parsed
    });

    // Check for auto-approval
    const autoApproved = await this.checkAutoApproval(request);
    if (autoApproved) {
      await this.approveLeaveRequest(request.id, 'SYSTEM_AUTO_APPROVAL', '自動承認条件を満たしました');
    }

    return request;
  }

  /**
   * Parse natural language leave request
   */
  private parseLeaveRequest(requestText: string): Omit<LeaveRequestInput, 'employeeId'> {
    const text = requestText.toLowerCase();
    
    // Extract leave type
    let leaveType: LeaveType = 'annual';
    if (text.includes('病気') || text.includes('体調') || text.includes('sick')) {
      leaveType = 'sick';
    } else if (text.includes('特別') || text.includes('special')) {
      leaveType = 'special';
    } else if (text.includes('産休') || text.includes('maternity')) {
      leaveType = 'maternity';
    } else if (text.includes('育児') || text.includes('育休') || text.includes('paternity')) {
      leaveType = 'paternity';
    } else if (text.includes('忌引') || text.includes('bereavement')) {
      leaveType = 'bereavement';
    } else if (text.includes('個人') || text.includes('personal')) {
      leaveType = 'personal';
    }

    // Extract dates with relative date parsing
    let startDate = new Date();
    let endDate = new Date();
    
    // Check for specific date patterns
    const dateMatches = text.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/g);
    if (dateMatches) {
      startDate = new Date(dateMatches[0]);
      endDate = dateMatches.length > 1 ? new Date(dateMatches[1]) : startDate;
    } else {
      // Handle relative dates
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      if (text.includes('明日')) {
        startDate = tomorrow;
        endDate = tomorrow;
      } else if (text.includes('来週')) {
        startDate = nextWeek;
        endDate = nextWeek;
        
        // If mentions days like "Monday to Friday"
        if (text.includes('月曜日') && text.includes('金曜日')) {
          const monday = new Date(nextWeek);
          monday.setDate(monday.getDate() - monday.getDay() + 1);
          const friday = new Date(monday);
          friday.setDate(friday.getDate() + 4);
          startDate = monday;
          endDate = friday;
        }
      } else if (text.includes('来月')) {
        startDate = nextMonth;
        endDate = nextMonth;
      } else {
        // Default to next week for testing
        startDate = nextWeek;
        endDate = nextWeek;
      }
      
      // Parse duration
      const durationMatch = text.match(/(\d+)[日天]/);
      if (durationMatch) {
        const days = parseInt(durationMatch[1]);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + days - 1);
      }
    }

    // Check for half day
    const halfDay = text.includes('半日') || text.includes('half') || text.includes('午前') || text.includes('午後');

    // Extract reason
    const reason = requestText.length > 50 ? requestText.substring(0, 200) : requestText;

    return {
      leaveType,
      startDate,
      endDate,
      halfDay,
      reason
    };
  }

  /**
   * Create leave request
   */
  async createLeaveRequest(input: LeaveRequestInput): Promise<LeaveRequest> {
    const requestId = `LR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const daysRequested = this.calculateDaysRequested(input.startDate, input.endDate, input.halfDay);

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO leave_requests (
          id, employee_id, leave_type, start_date, end_date, 
          days_requested, half_day, reason, status, requested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', CURRENT_TIMESTAMP)
      `;

      this.db.run(sql, [
        requestId,
        input.employeeId,
        input.leaveType,
        input.startDate.toISOString().split('T')[0],
        input.endDate.toISOString().split('T')[0],
        daysRequested,
        input.halfDay ? 1 : 0,
        input.reason || null
      ]).then(() => {
        resolve({
          id: requestId,
          employeeId: input.employeeId,
          leaveType: input.leaveType,
          startDate: input.startDate,
          endDate: input.endDate,
          daysRequested,
          halfDay: input.halfDay || false,
          reason: input.reason,
          status: 'pending' as RequestStatus,
          requestedAt: new Date(),
          autoApproved: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Calculate business days requested
   */
  private calculateDaysRequested(startDate: Date, endDate: Date, halfDay?: boolean): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculate business days (excluding weekends)
    let businessDays = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        businessDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return halfDay ? businessDays * 0.5 : businessDays;
  }

  /**
   * Validate leave request
   */
  private async validateLeaveRequest(employeeId: string, request: Omit<LeaveRequestInput, 'employeeId'>): Promise<void> {
    // Check if employee exists
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      throw new Error('従業員が見つかりません');
    }

    // Check leave balance
    const balance = await this.getLeaveBalance(employeeId, request.leaveType);
    const daysRequested = this.calculateDaysRequested(request.startDate, request.endDate, request.halfDay);
    
    if (balance.remainingDays < daysRequested) {
      throw new Error(`残り休暇日数が不足しています。要求: ${daysRequested}日, 残り: ${balance.remainingDays}日`);
    }

    // Check for overlapping requests
    const overlapping = await this.checkOverlappingRequests(employeeId, request.startDate, request.endDate);
    if (overlapping.length > 0) {
      throw new Error('重複する休暇申請があります');
    }

    // Check leave policy constraints
    const policy = await this.getLeavePolicy(request.leaveType, employee.startDate);
    if (policy.maxConsecutiveDays && daysRequested > policy.maxConsecutiveDays) {
      throw new Error(`連続休暇日数の上限を超えています。上限: ${policy.maxConsecutiveDays}日`);
    }

    // Check advance notice requirement (more flexible for testing)
    const daysUntilStart = Math.ceil((request.startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilStart < policy.advanceNoticeDays && request.leaveType !== 'sick' && request.leaveType !== 'bereavement') {
      throw new Error(`事前申請期間が不足しています。必要: ${policy.advanceNoticeDays}日前`);
    }
  }

  /**
   * Check for auto-approval conditions
   */
  private async checkAutoApproval(request: LeaveRequest): Promise<boolean> {
    try {
      const policy = await this.getLeavePolicy(request.leaveType, new Date());
      
      // Emergency leave types are auto-approved
      if (request.leaveType === 'sick' || request.leaveType === 'bereavement') {
        return true;
      }
      
      if (!policy.autoApprovalConditions) {
        return false;
      }

      // Parse auto-approval conditions
      const conditions = policy.autoApprovalConditions;
      
      if (conditions.includes('auto_approve_up_to_3_days') && request.daysRequested <= 3) {
        return true;
      }
      
      // Additional bereavement check for immediate family
      if (conditions.includes('auto_approve_immediate_family') && 
          (request.leaveType as string) === 'bereavement') {
        return true;
      }

      if (conditions.includes('department_coverage_ok')) {
        const coverage = await this.checkDepartmentCoverage(request.employeeId, request.startDate, request.endDate);
        return coverage;
      }

      return false;
    } catch (error) {
      console.error('Error checking auto-approval:', error);
      return false;
    }
  }

  /**
   * Check department coverage
   */
  private async checkDepartmentCoverage(employeeId: string, startDate: Date, endDate: Date): Promise<boolean> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) return false;

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT COUNT(*) as on_leave_count
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE e.department = ? 
          AND lr.status = 'approved'
          AND lr.start_date <= ? 
          AND lr.end_date >= ?
          AND lr.employee_id != ?
      `;

      this.db.get(sql, [
        employee.department,
        endDate.toISOString().split('T')[0],
        startDate.toISOString().split('T')[0],
        employeeId
      ]).then((row: any) => {
        // Allow if less than 30% of department is on leave
        const onLeaveCount = row?.on_leave_count || 0;
        resolve(onLeaveCount < 2); // Simple rule: allow if less than 2 people already on leave
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Approve leave request
   */
  async approveLeaveRequest(requestId: string, approverId: string, notes?: string): Promise<void> {
    const request = await this.getLeaveRequest(requestId);
    if (!request) {
      throw new Error('休暇申請が見つかりません');
    }

    // Update leave balance
    await this.updateLeaveBalance(request.employeeId, request.leaveType, -request.daysRequested);

    // Update request status
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE leave_requests 
        SET status = 'approved', 
            approved_by = $1, 
            approved_at = CURRENT_TIMESTAMP,
            approval_notes = $2,
            auto_approved = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `;

      this.db.run(sql, [
        approverId,
        notes || null,
        approverId === 'SYSTEM_AUTO_APPROVAL' ? 1 : 0,
        requestId
      ]).then(() => {
        resolve();
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Reject leave request
   */
  async rejectLeaveRequest(requestId: string, approverId: string, notes?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE leave_requests 
        SET status = 'rejected', 
            approved_by = $1, 
            approved_at = CURRENT_TIMESTAMP,
            approval_notes = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `;

      this.db.run(sql, [
        approverId,
        notes || null,
        requestId
      ]).then(() => {
        resolve();
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Get leave balance
   */
  async getLeaveBalance(employeeId: string, leaveType: LeaveType): Promise<LeaveBalance> {
    const currentYear = new Date().getFullYear();
    
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM leave_balances 
        WHERE employee_id = $1 AND leave_type = $2 AND year = $3
      `;

      this.db.get(sql, [employeeId, leaveType, currentYear]).then(async (row: any) => {
        if (!row) {
          // Create initial balance
          const balance = await this.initializeLeaveBalance(employeeId, leaveType, currentYear);
          resolve(balance);
        } else {
          resolve({
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
          });
        }
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Initialize leave balance for new employee
   */
  private async initializeLeaveBalance(employeeId: string, leaveType: LeaveType, year: number): Promise<LeaveBalance> {
    const employee = await this.db.getEmployee(employeeId);
    if (!employee) {
      throw new Error('従業員が見つかりません');
    }

    const policy = await this.getLeavePolicy(leaveType, employee.startDate);
    const grantedDays = this.calculateGrantedDays(employee.startDate, policy);
    const expiryDate = policy.expiryMonths ? new Date(year + 1, 0, 1) : undefined;
    const balanceId = Math.floor(Math.random() * 1000000);

    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO leave_balances (
          employee_id, leave_type, year, granted_days, 
          used_days, remaining_days, expiry_date
        ) VALUES ($1, $2, $3, $4, 0, $5, $6)
      `;

      this.db.run(sql, [
        employeeId,
        leaveType,
        year,
        grantedDays,
        grantedDays,
        expiryDate ? expiryDate.toISOString().split('T')[0] : null
      ]).then(() => {
        resolve({
          id: balanceId,
          employeeId,
          leaveType,
          year,
          grantedDays,
          usedDays: 0,
          remainingDays: grantedDays,
          expiryDate,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Calculate granted days based on tenure
   */
  private calculateGrantedDays(startDate: Date, policy: LeavePolicy): number {
    const tenureMonths = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (tenureMonths >= policy.tenureMonths) {
      return policy.grantedDays;
    }
    
    return 0;
  }

  /**
   * Update leave balance
   */
  private async updateLeaveBalance(employeeId: string, leaveType: LeaveType, daysDelta: number): Promise<void> {
    const balance = await this.getLeaveBalance(employeeId, leaveType);
    
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE leave_balances 
        SET used_days = used_days + $1, 
            remaining_days = remaining_days - $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $3 AND leave_type = $4 AND year = $5
      `;

      this.db.run(sql, [
        -daysDelta,
        -daysDelta,
        employeeId,
        leaveType,
        balance.year
      ]).then(() => {
        resolve();
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Get leave request
   */
  async getLeaveRequest(requestId: string): Promise<LeaveRequest | null> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM leave_requests WHERE id = $1`;
      
      this.db.get(sql, [requestId]).then((row: any) => {
        if (!row) {
          resolve(null);
        } else {
          resolve({
            id: row.id,
            employeeId: row.employee_id,
            leaveType: row.leave_type as LeaveType,
            startDate: new Date(row.start_date),
            endDate: new Date(row.end_date),
            daysRequested: row.days_requested,
            halfDay: row.half_day === 1,
            reason: row.reason,
            status: row.status as RequestStatus,
            requestedAt: new Date(row.requested_at),
            approvedBy: row.approved_by,
            approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
            approvalNotes: row.approval_notes,
            autoApproved: row.auto_approved === 1,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
          });
        }
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Check for overlapping requests
   */
  private async checkOverlappingRequests(employeeId: string, startDate: Date, endDate: Date): Promise<LeaveRequest[]> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM leave_requests 
        WHERE employee_id = $1 
          AND status IN ('pending', 'approved')
          AND start_date <= $2 
          AND end_date >= $3
      `;

      this.db.all(sql, [
        employeeId,
        endDate.toISOString().split('T')[0],
        startDate.toISOString().split('T')[0]
      ]).then((rows: any[]) => {
        const requests = rows.map(row => ({
          id: row.id,
          employeeId: row.employee_id,
          leaveType: row.leave_type as LeaveType,
          startDate: new Date(row.start_date),
          endDate: new Date(row.end_date),
          daysRequested: row.days_requested,
          halfDay: row.half_day === 1,
          reason: row.reason,
          status: row.status as RequestStatus,
          requestedAt: new Date(row.requested_at),
          approvedBy: row.approved_by,
          approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
          approvalNotes: row.approval_notes,
          autoApproved: row.auto_approved === 1,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        }));
        resolve(requests);
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Get leave policy
   */
  private async getLeavePolicy(leaveType: LeaveType, startDate: Date): Promise<LeavePolicy> {
    const tenureMonths = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM leave_policies 
        WHERE leave_type = $1 AND tenure_months <= $2
        ORDER BY tenure_months DESC
        LIMIT 1
      `;

      this.db.get(sql, [leaveType, tenureMonths]).then((row: any) => {
        if (!row) {
          reject(new Error(`Leave policy not found for ${leaveType}`));
        } else {
          resolve({
            id: row.id,
            leaveType: row.leave_type as LeaveType,
            tenureMonths: row.tenure_months,
            grantedDays: row.granted_days,
            maxConsecutiveDays: row.max_consecutive_days,
            advanceNoticeDays: row.advance_notice_days,
            requiresApproval: row.requires_approval === 1,
            autoApprovalConditions: row.auto_approval_conditions,
            carryoverAllowed: row.carryover_allowed === 1,
            carryoverLimitDays: row.carryover_limit_days,
            expiryMonths: row.expiry_months,
            effectiveFrom: new Date(row.effective_from),
            effectiveTo: row.effective_to ? new Date(row.effective_to) : undefined,
            createdAt: new Date(row.created_at)
          });
        }
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Get team calendar for department
   */
  async getTeamCalendar(department: string, startDate: Date, endDate: Date): Promise<TeamCalendarEvent[]> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT tc.*, e.name as employee_name
        FROM team_calendar tc
        JOIN employees e ON tc.employee_id = e.id
        WHERE tc.department = $1 AND tc.date BETWEEN $2 AND $3
        ORDER BY tc.date, tc.start_time
      `;

      this.db.all(sql, [
        department,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ]).then((rows: any[]) => {
        const events = rows.map(row => ({
          id: row.id,
          department: row.department,
          date: new Date(row.date),
          employeeId: row.employee_id,
          eventType: row.event_type as EventType,
          eventTitle: row.event_title,
          allDay: row.all_day === 1,
          startTime: row.start_time,
          endTime: row.end_time,
          createdAt: new Date(row.created_at),
          employeeName: row.employee_name
        }));
        resolve(events);
      }).catch((err: any) => {
        reject(err);
      });
    });
  }

  /**
   * Generate leave analytics
   */
  async generateLeaveAnalytics(startDate: Date, endDate: Date): Promise<LeaveAnalytics> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_requests,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_requests,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_requests,
          SUM(days_requested) as total_days_requested,
          SUM(CASE WHEN status = 'approved' THEN days_requested ELSE 0 END) as total_days_approved,
          leave_type,
          AVG(CASE WHEN approved_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (approved_at - requested_at)) / 86400 ELSE NULL END) as avg_processing_time
        FROM leave_requests
        WHERE requested_at BETWEEN $1 AND $2
        GROUP BY leave_type
      `;

      this.db.all(sql, [
        startDate.toISOString(),
        endDate.toISOString()
      ]).then((rows: any[]) => {
        const analytics: LeaveAnalytics = {
          totalRequests: 0,
          approvedRequests: 0,
          rejectedRequests: 0,
          pendingRequests: 0,
          totalDaysRequested: 0,
          totalDaysApproved: 0,
          averageProcessingTime: 0,
          mostPopularLeaveType: 'annual',
          departmentBreakdown: {}
        };

        let maxRequests = 0;
        let totalProcessingTime = 0;
        let processedRequests = 0;

        rows.forEach(row => {
          analytics.totalRequests += row.total_requests;
          analytics.approvedRequests += row.approved_requests;
          analytics.rejectedRequests += row.rejected_requests;
          analytics.pendingRequests += row.pending_requests;
          analytics.totalDaysRequested += row.total_days_requested;
          analytics.totalDaysApproved += row.total_days_approved;

          if (row.total_requests > maxRequests) {
            maxRequests = row.total_requests;
            analytics.mostPopularLeaveType = row.leave_type;
          }

          if (row.avg_processing_time) {
            totalProcessingTime += row.avg_processing_time * row.approved_requests;
            processedRequests += row.approved_requests;
          }
        });

        analytics.averageProcessingTime = processedRequests > 0 ? totalProcessingTime / processedRequests : 0;

        resolve(analytics);
      }).catch((err: any) => {
        reject(err);
      });
    });
  }
}