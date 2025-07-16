import Database from './database.js';
import { OCRService } from './ocr-service.js';
import { NLPService } from './nlp-service.js';
import type { 
  ExpenseRequest, 
  ExtractedReceiptData, 
  ParsedExpenseData,
  ApprovalRiskAssessment,
  AnomalyFlag,
  AccountingEntry,
  ExpenseCategory,
  ExpenseAnalytics
} from './types.js';

// v1.3.0 Intelligent Expense Management Engine
export class IntelligentExpenseEngine {
  constructor(
    private db: Database,
    private ocrService: OCRService,
    private nlpService: NLPService
  ) {}

  // Process receipt image and extract data
  async processReceiptImage(imageBuffer: Buffer, mimeType: string): Promise<ExtractedReceiptData> {
    try {
      // Step 1: OCR text extraction
      const ocrResult = await this.ocrService.extractText(imageBuffer);
      
      // Step 2: Structure the receipt data using NLP
      const structuredData = await this.nlpService.parseReceiptData(ocrResult.text);
      
      // Step 3: Return combined extracted data
      return {
        vendor: structuredData.vendor,
        date: structuredData.date,
        amount: structuredData.total,
        items: structuredData.items,
        taxAmount: structuredData.taxAmount,
        confidence: ocrResult.confidence,
        ocrText: ocrResult.text
      };
    } catch (error) {
      console.error('Error processing receipt image:', error);
      throw new Error('Failed to process receipt image');
    }
  }

  // Create expense request from natural language input
  async createExpenseFromNLInput(input: string, employeeId: string): Promise<ExpenseRequest> {
    try {
      // Step 1: Parse natural language input
      const parsed = await this.nlpService.parseExpenseRequest(input);
      
      // Step 2: Infer expense category
      const category = await this.inferExpenseCategory(parsed);
      
      // Step 3: Create expense request
      const expenseRequest = {
        id: `EXP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId,
        categoryId: category.id,
        amount: parsed.amount || 0,
        currency: 'JPY',
        expenseDate: parsed.date || new Date(),
        description: parsed.description || input.substring(0, 100),
        purpose: parsed.purpose,
        status: 'draft' as const,
        taxDeductible: category.taxDeductible,
        aiConfidenceScore: parsed.confidence,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const requestId = await this.db.createExpenseRequest(expenseRequest);
      const savedRequest = await this.db.getExpenseRequest(requestId);
      
      if (!savedRequest) {
        throw new Error('Failed to save expense request');
      }

      return savedRequest;
    } catch (error) {
      console.error('Error creating expense from NL input:', error);
      throw new Error('Failed to create expense request');
    }
  }

  // Create expense request from receipt image
  async createExpenseFromReceipt(
    imageBuffer: Buffer, 
    mimeType: string, 
    employeeId: string,
    additionalNotes?: string
  ): Promise<ExpenseRequest> {
    try {
      // Step 1: Process receipt image
      const extractedData = await this.processReceiptImage(imageBuffer, mimeType);
      
      // Step 2: Infer category based on extracted data
      const category = await this.inferExpenseCategory({
        amount: extractedData.amount,
        vendor: extractedData.vendor,
        confidence: extractedData.confidence
      });
      
      // Step 3: Create expense request
      const expenseRequest = {
        id: `EXP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId,
        categoryId: category.id,
        amount: extractedData.amount || 0,
        currency: 'JPY',
        expenseDate: extractedData.date || new Date(),
        description: `${extractedData.vendor || 'Receipt'} - ${extractedData.amount}円`,
        purpose: additionalNotes,
        extractedData,
        status: 'draft' as const,
        taxDeductible: category.taxDeductible,
        aiConfidenceScore: extractedData.confidence,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const requestId = await this.db.createExpenseRequest(expenseRequest);
      const savedRequest = await this.db.getExpenseRequest(requestId);
      
      if (!savedRequest) {
        throw new Error('Failed to save expense request');
      }

      return savedRequest;
    } catch (error) {
      console.error('Error creating expense from receipt:', error);
      throw new Error('Failed to create expense request from receipt');
    }
  }

  // Smart approval risk assessment
  async evaluateApprovalRisk(request: ExpenseRequest): Promise<ApprovalRiskAssessment> {
    try {
      const employee = await this.db.getEmployee(request.employeeId);
      if (!employee) {
        throw new Error('Employee not found');
      }

      // Get historical data for analysis
      const historicalData = await this.getEmployeeExpenseHistory(request.employeeId);
      const category = await this.db.getExpenseCategory(request.categoryId);
      
      if (!category) {
        throw new Error('Category not found');
      }

      // Calculate risk factors
      const anomalyFlags = await this.detectAnomalies(request, historicalData, category);
      const riskLevel = this.calculateRiskLevel(request, historicalData, anomalyFlags);
      const approvalProbability = this.predictApprovalProbability(request, anomalyFlags);
      const recommendations = this.generateRecommendations(request, anomalyFlags);

      return {
        riskLevel,
        anomalyFlags,
        approvalProbability,
        recommendations
      };
    } catch (error) {
      console.error('Error evaluating approval risk:', error);
      throw new Error('Failed to evaluate approval risk');
    }
  }

  // Generate accounting entry from expense request
  async generateAccountingEntry(request: ExpenseRequest): Promise<AccountingEntry> {
    try {
      const category = await this.db.getExpenseCategory(request.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      // Map expense categories to accounting codes
      const accountingCodeMap: Record<string, string> = {
        'TRANSPORT': '6001', // 旅費交通費
        'ACCOMMODATION': '6002', // 宿泊費
        'MEALS': '6003', // 会議費
        'COMMUNICATION': '6004', // 通信費
        'OFFICE_SUPPLIES': '6005', // 事務用品費
        'TRAINING': '6006', // 研修費
        'MEETING': '6007', // 会議費
        'OTHER': '6999' // その他
      };

      const debitAccount = accountingCodeMap[category.code] || '6999';
      
      const entry = {
        expenseRequestId: request.id,
        entryDate: request.expenseDate,
        description: `${category.name}: ${request.description}`,
        debitAccount,
        creditAccount: '2001', // 未払金
        amount: request.amount,
        taxAmount: request.extractedData?.taxAmount || 0,
        reference: request.id,
        exported: false
      };

      const entryId = await this.db.createAccountingEntry(entry);
      
      return {
        id: entryId,
        ...entry,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('Error generating accounting entry:', error);
      throw new Error('Failed to generate accounting entry');
    }
  }

  // Generate expense analytics
  async generateExpenseAnalytics(
    employeeId?: string,
    department?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ExpenseAnalytics> {
    try {
      // Basic implementation - would be enhanced with more sophisticated analytics
      const period = {
        startDate: startDate || new Date(new Date().getFullYear(), 0, 1),
        endDate: endDate || new Date()
      };

      // Get expense requests for the period
      let requests: ExpenseRequest[] = [];
      if (employeeId) {
        requests = await this.db.getExpenseRequestsByEmployee(employeeId);
      } else {
        // Would need a method to get all expenses for department/company
        requests = [];
      }

      // Calculate basic metrics
      const totalAmount = requests.reduce((sum, req) => sum + req.amount, 0);
      const totalRequests = requests.length;
      const averageAmount = totalRequests > 0 ? totalAmount / totalRequests : 0;

      // Group by category
      const categoryMap = new Map<string, { amount: number; count: number; name: string }>();
      for (const request of requests) {
        const category = await this.db.getExpenseCategory(request.categoryId);
        const categoryName = category?.name || 'Unknown';
        const current = categoryMap.get(request.categoryId) || { amount: 0, count: 0, name: categoryName };
        current.amount += request.amount;
        current.count++;
        categoryMap.set(request.categoryId, current);
      }

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      }));

      // Basic approval stats
      const approvalStats = {
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length,
        pending: requests.filter(r => r.status === 'submitted').length,
        averageApprovalTime: 24 // Mock value - would calculate from actual data
      };

      return {
        employeeId,
        department,
        period,
        totalAmount,
        totalRequests,
        averageAmount,
        categoryBreakdown,
        monthlyTrend: [], // Would implement monthly grouping
        topVendors: [], // Would extract from receipt data
        approvalStats,
        complianceMetrics: {
          receiptComplianceRate: 85, // Mock value
          policyViolations: 2, // Mock value
          riskScore: 15 // Mock value
        }
      };
    } catch (error) {
      console.error('Error generating expense analytics:', error);
      throw new Error('Failed to generate expense analytics');
    }
  }

  // Private helper methods

  private async inferExpenseCategory(parsed: ParsedExpenseData): Promise<ExpenseCategory> {
    const categories = await this.db.getExpenseCategories();
    
    // Try to match by category hint from NLP
    if (parsed.category) {
      const matchedCategory = categories.find(cat => cat.name === parsed.category);
      if (matchedCategory) {
        return matchedCategory;
      }
    }
    
    // Try to match by vendor/amount patterns
    if (parsed.vendor) {
      // Simple vendor-based categorization
      const vendor = parsed.vendor.toLowerCase();
      if (vendor.includes('タクシー') || vendor.includes('電車')) {
        return categories.find(cat => cat.code === 'TRANSPORT') || categories[0];
      }
      if (vendor.includes('ホテル') || vendor.includes('宿')) {
        return categories.find(cat => cat.code === 'ACCOMMODATION') || categories[0];
      }
    }
    
    // Default to "その他" category
    return categories.find(cat => cat.code === 'OTHER') || categories[0];
  }

  private async getEmployeeExpenseHistory(employeeId: string): Promise<ExpenseRequest[]> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    return await this.db.getExpenseRequestsByEmployee(employeeId);
  }

  private async detectAnomalies(
    request: ExpenseRequest, 
    historicalData: ExpenseRequest[], 
    category: ExpenseCategory
  ): Promise<AnomalyFlag[]> {
    const flags: AnomalyFlag[] = [];
    
    // Check amount against category limits
    if (category.dailyLimit && request.amount > category.dailyLimit) {
      flags.push({
        type: 'amount_unusual',
        severity: 'high',
        description: `Amount (${request.amount}) exceeds daily limit (${category.dailyLimit})`,
        value: request.amount
      });
    }
    
    // Check frequency
    const sameDayRequests = historicalData.filter(h => 
      h.expenseDate.toDateString() === request.expenseDate.toDateString()
    );
    if (sameDayRequests.length > 3) {
      flags.push({
        type: 'frequency_high',
        severity: 'medium',
        description: `High frequency of expenses on the same day (${sameDayRequests.length + 1})`,
        value: sameDayRequests.length + 1
      });
    }
    
    // Check amount against historical average
    if (historicalData.length > 0) {
      const avgAmount = historicalData.reduce((sum, h) => sum + h.amount, 0) / historicalData.length;
      if (request.amount > avgAmount * 3) {
        flags.push({
          type: 'amount_unusual',
          severity: 'medium',
          description: `Amount is 3x higher than historical average (${Math.round(avgAmount)})`,
          value: request.amount / avgAmount
        });
      }
    }
    
    return flags;
  }

  private calculateRiskLevel(
    request: ExpenseRequest, 
    historicalData: ExpenseRequest[], 
    anomalyFlags: AnomalyFlag[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const highSeverityFlags = anomalyFlags.filter(f => f.severity === 'high').length;
    const mediumSeverityFlags = anomalyFlags.filter(f => f.severity === 'medium').length;
    
    if (highSeverityFlags > 0) {
      return 'critical';
    } else if (mediumSeverityFlags > 1) {
      return 'high';
    } else if (anomalyFlags.length > 0) {
      return 'medium';
    }
    
    return 'low';
  }

  private predictApprovalProbability(request: ExpenseRequest, anomalyFlags: AnomalyFlag[]): number {
    let baseProbability = 0.85; // 85% base approval rate
    
    // Reduce probability based on anomaly flags
    for (const flag of anomalyFlags) {
      switch (flag.severity) {
        case 'high':
          baseProbability -= 0.3;
          break;
        case 'medium':
          baseProbability -= 0.15;
          break;
        case 'low':
          baseProbability -= 0.05;
          break;
      }
    }
    
    return Math.max(0.1, Math.min(0.95, baseProbability));
  }

  private generateRecommendations(request: ExpenseRequest, anomalyFlags: AnomalyFlag[]): string[] {
    const recommendations: string[] = [];
    
    for (const flag of anomalyFlags) {
      switch (flag.type) {
        case 'amount_unusual':
          recommendations.push('領収書の添付と詳細な説明を確認してください');
          break;
        case 'frequency_high':
          recommendations.push('同日の複数申請について業務上の必要性を確認してください');
          break;
        case 'category_inconsistent':
          recommendations.push('経費カテゴリーの分類が適切か確認してください');
          break;
        case 'vendor_new':
          recommendations.push('新規取引先との取引について承認者に確認してください');
          break;
        case 'timing_suspicious':
          recommendations.push('申請のタイミングについて業務上の必要性を確認してください');
          break;
      }
    }
    
    if (recommendations.length === 0) {
      recommendations.push('特に問題は検出されませんでした');
    }
    
    return recommendations;
  }
}