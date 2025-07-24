/**
 * AI-OS TypeScript SDK
 * @version 1.0.0
 * @description AI-OSプラットフォームとの統合を簡単にするためのTypeScript SDK
 */

export interface AIOSConfig {
  apiKey: string;
  baseUrl?: string;
  version?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  department: string;
  position: string;
  hireDate: string;
  accountStatus: 'active' | 'inactive' | 'suspended';
  metadata?: Record<string, any>;
}

export interface TimeRecord {
  id: string;
  employeeId: string;
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  timestamp: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  device?: string;
}

export interface PayrollResult {
  batchId: string;
  yearMonth: string;
  employeeCount: number;
  totalAmount: number;
  status: 'processing' | 'completed' | 'approved' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface Payslip {
  id: string;
  employeeId: string;
  yearMonth: string;
  baseSalary: number;
  overtimePay: number;
  allowances: number;
  grossPay: number;
  socialInsurance: number;
  incomeTax: number;
  totalDeductions: number;
  netPay: number;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: 'paid' | 'sick' | 'special' | 'unpaid';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvedAt?: string;
}

export interface LeaveBalance {
  employeeId: string;
  paidLeave: {
    total: number;
    used: number;
    remaining: number;
    expiringWithin90Days: number;
    nextGrantDate: string;
  };
  sickLeave: {
    remaining: number;
  };
}

export interface Expense {
  id: string;
  employeeId: string;
  amount: number;
  category: string;
  date: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  receiptId?: string;
  projectCode?: string;
  aiRecommendation?: 'approve' | 'review' | 'reject';
}

export interface HumanCapitalMetrics {
  employeeCount: number;
  averageTenure: number;
  turnoverRate: number;
  engagementScore: number;
  productivityIndex: number;
  departments: Array<{
    id: string;
    name: string;
    turnoverRisk: number;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ErrorResponse {
  message: string;
  code?: string;
  details?: any;
}

export class AIOSError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: ErrorResponse
  ) {
    super(message);
    this.name = 'AIOSError';
  }
}

export class AIOSClient {
  private apiKey: string;
  private baseUrl: string;
  private version: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: AIOSConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.ai-os.com';
    this.version = config.version || 'v1';
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;

    if (!this.apiKey) {
      throw new Error('APIキーが必要です。configで設定してください。');
    }
  }

  /**
   * HTTPリクエストを実行
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/${this.version}${endpoint}`;
    const headers: HeadersInit = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-SDK-Version': '1.0.0',
      'X-SDK-Language': 'TypeScript',
      ...options.headers
    };

    const config: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
      ...options
    };

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      config.body = JSON.stringify(data);
    }

    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const error: ErrorResponse = await response.json();
          throw new AIOSError(
            error.message || 'APIエラー',
            response.status,
            error
          );
        }
        
        return await response.json();
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.retryAttempts - 1) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * スリープユーティリティ
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 従業員管理API
   */
  public readonly employees = {
    list: async (params?: {
      limit?: number;
      offset?: number;
      department?: string;
      status?: string;
    }): Promise<PaginatedResponse<Employee>> => {
      const queryString = params ? new URLSearchParams(params as any).toString() : '';
      return this.request<PaginatedResponse<Employee>>(
        'GET',
        `/employees${queryString ? '?' + queryString : ''}`
      );
    },

    get: async (employeeId: string): Promise<Employee> => {
      return this.request<Employee>('GET', `/employees/${employeeId}`);
    },

    create: async (data: Omit<Employee, 'id'>): Promise<Employee> => {
      return this.request<Employee>('POST', '/employees', data);
    },

    update: async (
      employeeId: string,
      data: Partial<Employee>
    ): Promise<Employee> => {
      return this.request<Employee>('PUT', `/employees/${employeeId}`, data);
    },

    delete: async (employeeId: string): Promise<void> => {
      return this.request<void>('DELETE', `/employees/${employeeId}`);
    }
  };

  /**
   * 勤怠管理API
   */
  public readonly timeRecords = {
    clock: async (data: {
      employeeId: string;
      type: TimeRecord['type'];
      timestamp?: string;
      location?: TimeRecord['location'];
    }): Promise<TimeRecord> => {
      return this.request<TimeRecord>('POST', '/time-records/clock', data);
    },

    clockIn: async (employeeId: string): Promise<TimeRecord> => {
      return this.request<TimeRecord>('POST', '/time-records/clock-in', { employeeId });
    },

    clockOut: async (employeeId: string): Promise<TimeRecord> => {
      return this.request<TimeRecord>('POST', '/time-records/clock-out', { employeeId });
    },

    list: async (params?: {
      employeeId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }): Promise<PaginatedResponse<TimeRecord>> => {
      const queryString = params ? new URLSearchParams(params as any).toString() : '';
      return this.request<PaginatedResponse<TimeRecord>>(
        'GET',
        `/time-records${queryString ? '?' + queryString : ''}`
      );
    },

    getMonthlySummary: async (
      employeeId: string,
      yearMonth: string
    ): Promise<{
      totalHours: number;
      overtimeHours: number;
      holidayWork: number;
      nightWork: number;
      absences: number;
    }> => {
      return this.request(
        'GET',
        `/time-records/summary/${employeeId}/${yearMonth}`
      );
    }
  };

  /**
   * 給与管理API
   */
  public readonly payroll = {
    calculate: async (data: {
      yearMonth: string;
      departmentIds?: string[];
      employeeIds?: string[];
      includeBonus?: boolean;
      calculateTax?: boolean;
      calculateInsurance?: boolean;
    }): Promise<PayrollResult> => {
      return this.request<PayrollResult>('POST', '/payroll/calculate', data);
    },

    getPayslip: async (
      employeeId: string,
      yearMonth: string
    ): Promise<Payslip> => {
      return this.request<Payslip>(
        'GET',
        `/payroll/payslips/${employeeId}/${yearMonth}`
      );
    },

    listPayslips: async (params?: {
      yearMonth?: string;
      departmentId?: string;
      limit?: number;
      offset?: number;
    }): Promise<PaginatedResponse<Payslip>> => {
      const queryString = params ? new URLSearchParams(params as any).toString() : '';
      return this.request<PaginatedResponse<Payslip>>(
        'GET',
        `/payroll/payslips${queryString ? '?' + queryString : ''}`
      );
    },

    approve: async (batchId: string): Promise<{
      status: string;
      approvedAt: string;
      approvedBy: string;
    }> => {
      return this.request('POST', `/payroll/batches/${batchId}/approve`);
    }
  };

  /**
   * 休暇管理API
   */
  public readonly leaves = {
    request: async (data: {
      employeeId: string;
      type: LeaveRequest['type'];
      startDate: string;
      endDate: string;
      reason: string;
    }): Promise<LeaveRequest> => {
      return this.request<LeaveRequest>('POST', '/leaves/requests', data);
    },

    listRequests: async (params?: {
      employeeId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }): Promise<PaginatedResponse<LeaveRequest>> => {
      const queryString = params ? new URLSearchParams(params as any).toString() : '';
      return this.request<PaginatedResponse<LeaveRequest>>(
        'GET',
        `/leaves/requests${queryString ? '?' + queryString : ''}`
      );
    },

    getBalance: async (employeeId: string): Promise<LeaveBalance> => {
      return this.request<LeaveBalance>('GET', `/leaves/balance/${employeeId}`);
    },

    approve: async (requestId: string): Promise<LeaveRequest> => {
      return this.request<LeaveRequest>(
        'POST',
        `/leaves/requests/${requestId}/approve`
      );
    },

    reject: async (
      requestId: string,
      reason: string
    ): Promise<LeaveRequest> => {
      return this.request<LeaveRequest>(
        'POST',
        `/leaves/requests/${requestId}/reject`,
        { reason }
      );
    }
  };

  /**
   * 経費管理API
   */
  public readonly expenses = {
    submit: async (data: {
      employeeId: string;
      amount: number;
      category: string;
      date: string;
      description: string;
      receiptId?: string;
      projectCode?: string;
    }): Promise<Expense> => {
      return this.request<Expense>('POST', '/expenses', data);
    },

    uploadReceipt: async (
      file: File,
      metadata?: Record<string, string>
    ): Promise<{
      receiptId: string;
      merchantName: string;
      amount: number;
      date: string;
      confidence: number;
    }> => {
      const formData = new FormData();
      formData.append('receipt', file);
      
      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          formData.append(key, value);
        });
      }

      return this.request('POST', '/expenses/receipts', null, {
        headers: { 'Content-Type': undefined as any },
        body: formData
      });
    },

    list: async (params?: {
      employeeId?: string;
      status?: string;
      category?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }): Promise<PaginatedResponse<Expense>> => {
      const queryString = params ? new URLSearchParams(params as any).toString() : '';
      return this.request<PaginatedResponse<Expense>>(
        'GET',
        `/expenses${queryString ? '?' + queryString : ''}`
      );
    },

    approve: async (expenseId: string): Promise<Expense> => {
      return this.request<Expense>('POST', `/expenses/${expenseId}/approve`);
    }
  };

  /**
   * レポート・分析API
   */
  public readonly reports = {
    generate: async (
      reportType: string,
      params?: Record<string, any>
    ): Promise<{
      reportId: string;
      status: string;
      downloadUrl?: string;
    }> => {
      return this.request('POST', `/reports/${reportType}`, params);
    },

    getDashboard: async (dashboardId: string): Promise<{
      currentlyWorking: number;
      overtimePrediction: number;
      laborCostProgress: number;
      alerts: Array<{
        type: string;
        severity: string;
        message: string;
      }>;
    }> => {
      return this.request('GET', `/reports/dashboards/${dashboardId}`);
    },

    getHumanCapitalMetrics: async (params?: {
      startDate?: string;
      endDate?: string;
      groupBy?: string;
    }): Promise<HumanCapitalMetrics> => {
      const queryString = params ? new URLSearchParams(params as any).toString() : '';
      return this.request<HumanCapitalMetrics>(
        'GET',
        `/reports/human-capital${queryString ? '?' + queryString : ''}`
      );
    }
  };
}