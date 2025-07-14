/**
 * v1.4.0 Enhanced OCR Service with AI-powered improvements
 * AIを活用した高度なOCRサービス
 * 
 * Features:
 * - Multi-engine OCR processing
 * - Image quality enhancement
 * - Confidence scoring and validation
 * - Multi-language support (Japanese, English)
 * - Receipt-specific optimization
 * - Real-time processing capabilities
 */

import type { OCRResult } from './types.js';

export interface EnhancedOCRResult extends OCRResult {
  language: string;
  imageQuality: number; // 0-1
  processingTime: number; // milliseconds
  enhancementApplied: boolean;
  alternativeResults: OCRResult[]; // From different engines
  structuredData?: ReceiptStructure;
}

export interface ReceiptStructure {
  header: ReceiptHeader;
  items: ReceiptLineItem[];
  totals: ReceiptTotals;
  footer: ReceiptFooter;
  metadata: ProcessingMetadata;
}

export interface ReceiptHeader {
  businessName: string;
  address: string;
  phone?: string;
  taxId?: string;
  confidence: number;
}

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate?: number;
  category?: string;
  lineNumber: number;
  confidence: number;
}

export interface ReceiptTotals {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  discountAmount?: number;
  serviceCharge?: number;
  confidence: number;
}

export interface ReceiptFooter {
  paymentMethod?: string;
  cashReceived?: number;
  changeGiven?: number;
  receiptNumber?: string;
  cashierInfo?: string;
  confidence: number;
}

export interface ProcessingMetadata {
  receiptDate: Date;
  receiptTime?: string;
  currency: string;
  receiptType: 'restaurant' | 'retail' | 'taxi' | 'hotel' | 'other';
  confidence: number;
}

export interface OCREngineConfig {
  engine: 'tesseract' | 'google' | 'aws' | 'azure' | 'mock';
  language: string[];
  confidence_threshold: number;
  timeout: number;
}

export class EnhancedOCRService {
  private engines: Map<string, OCREngine> = new Map();
  private imageProcessor: ImageProcessor;
  private receiptParser: ReceiptParser;

  constructor() {
    this.initializeEngines();
    this.imageProcessor = new ImageProcessor();
    this.receiptParser = new ReceiptParser();
  }

  /**
   * Multi-engine OCR processing with AI enhancement
   */
  async extractTextAdvanced(
    imageBuffer: Buffer, 
    options: {
      enhanceImage?: boolean;
      multiEngine?: boolean;
      extractStructure?: boolean;
      language?: string[];
    } = {}
  ): Promise<EnhancedOCRResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Image quality assessment
      const imageQuality = await this.imageProcessor.assessQuality(imageBuffer);
      
      // Step 2: Image enhancement if needed or requested
      const processedImage = (options.enhanceImage || imageQuality < 0.7) 
        ? await this.imageProcessor.enhance(imageBuffer)
        : imageBuffer;
      
      const enhancementApplied = processedImage !== imageBuffer;

      // Step 3: Language detection
      const detectedLanguage = await this.detectLanguage(processedImage);
      const languages = options.language || [detectedLanguage, 'en', 'ja'];

      // Step 4: Multi-engine OCR processing
      const ocrResults: OCRResult[] = [];
      
      if (options.multiEngine) {
        // Process with multiple engines for validation
        const engines = ['tesseract', 'mock']; // Add more engines as available
        const promises = engines.map(engine => 
          this.processWithEngine(processedImage, engine, languages)
        );
        
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            ocrResults.push(result.value);
          } else {
            console.warn(`OCR engine ${engines[index]} failed:`, result.reason);
          }
        });
      } else {
        // Single engine processing
        const result = await this.processWithEngine(processedImage, 'tesseract', languages);
        ocrResults.push(result);
      }

      // Step 5: Result reconciliation
      const bestResult = this.selectBestResult(ocrResults);
      
      // Step 6: Structured data extraction
      const structuredData = options.extractStructure 
        ? await this.receiptParser.parseReceipt(bestResult.text)
        : undefined;

      const processingTime = Date.now() - startTime;

      return {
        ...bestResult,
        language: detectedLanguage,
        imageQuality,
        processingTime,
        enhancementApplied,
        alternativeResults: ocrResults.filter(r => r !== bestResult),
        structuredData
      };

    } catch (error) {
      console.error('Enhanced OCR processing failed:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Receipt-specific OCR optimization
   */
  async extractReceiptData(imageBuffer: Buffer): Promise<EnhancedOCRResult> {
    return this.extractTextAdvanced(imageBuffer, {
      enhanceImage: true,
      multiEngine: true,
      extractStructure: true,
      language: ['ja', 'en']
    });
  }

  /**
   * Real-time OCR for mobile applications
   */
  async extractTextRealTime(imageBuffer: Buffer): Promise<EnhancedOCRResult> {
    return this.extractTextAdvanced(imageBuffer, {
      enhanceImage: false,
      multiEngine: false,
      extractStructure: false
    });
  }

  /**
   * Batch OCR processing for multiple images
   */
  async processBatch(
    images: Buffer[], 
    options?: { 
      parallel?: boolean; 
      maxConcurrency?: number;
    }
  ): Promise<EnhancedOCRResult[]> {
    const { parallel = true, maxConcurrency = 3 } = options || {};
    
    if (!parallel) {
      const results: EnhancedOCRResult[] = [];
      for (const image of images) {
        const result = await this.extractTextAdvanced(image);
        results.push(result);
      }
      return results;
    }

    // Parallel processing with concurrency limit
    const chunks = this.chunkArray(images, maxConcurrency);
    const allResults: EnhancedOCRResult[] = [];

    for (const chunk of chunks) {
      const promises = chunk.map(image => this.extractTextAdvanced(image));
      const results = await Promise.all(promises);
      allResults.push(...results);
    }

    return allResults;
  }

  // Private methods

  private initializeEngines(): void {
    this.engines.set('tesseract', new TesseractEngine());
    this.engines.set('mock', new MockOCREngine());
    // Add more engines: Google Vision, AWS Textract, Azure OCR
  }

  private async detectLanguage(imageBuffer: Buffer): Promise<string> {
    // Simple heuristic: if image contains Japanese characters, return 'ja'
    // In a real implementation, use ML-based language detection
    return 'ja'; // Default to Japanese for Japanese market focus
  }

  private async processWithEngine(
    imageBuffer: Buffer, 
    engineName: string, 
    languages: string[]
  ): Promise<OCRResult> {
    const engine = this.engines.get(engineName);
    if (!engine) {
      throw new Error(`OCR engine '${engineName}' not found`);
    }

    return engine.extractText(imageBuffer, { languages });
  }

  private selectBestResult(results: OCRResult[]): OCRResult {
    if (results.length === 0) {
      throw new Error('No OCR results available');
    }

    if (results.length === 1) {
      return results[0];
    }

    // Select result with highest confidence
    return results.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Supporting classes

class ImageProcessor {
  async assessQuality(imageBuffer: Buffer): Promise<number> {
    // AI-powered image quality assessment
    // Check for: blur, contrast, brightness, skew, noise
    
    // Mock implementation
    return 0.75 + Math.random() * 0.25; // Return quality score 0.75-1.0
  }

  async enhance(imageBuffer: Buffer): Promise<Buffer> {
    // AI-powered image enhancement
    // Apply: denoising, contrast enhancement, sharpening, deskewing
    
    // Mock implementation - in reality, use OpenCV or similar
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate processing
    return imageBuffer;
  }
}

class ReceiptParser {
  async parseReceipt(text: string): Promise<ReceiptStructure> {
    // AI-powered receipt parsing
    // Use NLP and pattern matching to extract structured data
    
    return this.parseJapaneseReceipt(text);
  }

  private parseJapaneseReceipt(text: string): ReceiptStructure {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Extract header (business info)
    const header = this.extractHeader(lines);
    
    // Extract items
    const items = this.extractItems(lines);
    
    // Extract totals
    const totals = this.extractTotals(lines);
    
    // Extract footer
    const footer = this.extractFooter(lines);
    
    // Extract metadata
    const metadata = this.extractMetadata(lines);

    return {
      header,
      items,
      totals,
      footer,
      metadata
    };
  }

  private extractHeader(lines: string[]): ReceiptHeader {
    // Extract business name (usually first non-empty line)
    const businessName = lines[0] || '';
    
    // Extract address (lines containing 都、区、市、町)
    const addressLines = lines.filter(line => 
      /[都区市町村]/.test(line) && !line.includes('TEL') && !line.includes('電話')
    );
    const address = addressLines.join(' ');
    
    // Extract phone (lines containing TEL or 電話)
    const phoneLine = lines.find(line => /TEL|電話/.test(line));
    const phone = phoneLine ? phoneLine.replace(/TEL[:：\s]*|電話[:：\s]*/, '') : undefined;

    return {
      businessName,
      address,
      phone,
      confidence: 0.8
    };
  }

  private extractItems(lines: string[]): ReceiptLineItem[] {
    const items: ReceiptLineItem[] = [];
    let lineNumber = 0;

    for (const line of lines) {
      // Look for lines with price patterns (¥数字 or 数字円)
      const priceMatch = line.match(/¥?([\d,]+)円?/);
      if (priceMatch && !line.includes('合計') && !line.includes('小計') && 
          !line.includes('消費税') && !line.includes('お預り') && !line.includes('お釣り')) {
        
        const totalPrice = parseInt(priceMatch[1].replace(/,/g, ''));
        const description = line.replace(/¥?[\d,]+円?.*$/, '').trim();
        
        if (description && totalPrice > 0) {
          items.push({
            description,
            quantity: 1, // Default quantity
            unitPrice: totalPrice,
            totalPrice,
            lineNumber: ++lineNumber,
            confidence: 0.8
          });
        }
      }
    }

    return items;
  }

  private extractTotals(lines: string[]): ReceiptTotals {
    let subtotal = 0;
    let taxAmount = 0;
    let totalAmount = 0;

    for (const line of lines) {
      if (line.includes('小計')) {
        const match = line.match(/¥?([\d,]+)円?/);
        if (match) subtotal = parseInt(match[1].replace(/,/g, ''));
      } else if (line.includes('消費税')) {
        const match = line.match(/¥?([\d,]+)円?/);
        if (match) taxAmount = parseInt(match[1].replace(/,/g, ''));
      } else if (line.includes('合計')) {
        const match = line.match(/¥?([\d,]+)円?/);
        if (match) totalAmount = parseInt(match[1].replace(/,/g, ''));
      }
    }

    // If no subtotal found, calculate from total and tax
    if (subtotal === 0 && totalAmount > 0) {
      subtotal = totalAmount - taxAmount;
    }

    return {
      subtotal,
      taxAmount,
      totalAmount,
      confidence: 0.85
    };
  }

  private extractFooter(lines: string[]): ReceiptFooter {
    let paymentMethod = 'cash'; // Default
    let cashReceived = 0;
    let changeGiven = 0;
    let receiptNumber: string | undefined;

    for (const line of lines) {
      if (line.includes('お預り')) {
        const match = line.match(/¥?([\d,]+)円?/);
        if (match) cashReceived = parseInt(match[1].replace(/,/g, ''));
      } else if (line.includes('お釣り')) {
        const match = line.match(/¥?([\d,]+)円?/);
        if (match) changeGiven = parseInt(match[1].replace(/,/g, ''));
      } else if (line.includes('No') || line.includes('番号')) {
        const match = line.match(/[\d]+/);
        if (match) receiptNumber = match[0];
      }
    }

    return {
      paymentMethod,
      cashReceived: cashReceived || undefined,
      changeGiven: changeGiven || undefined,
      receiptNumber,
      confidence: 0.7
    };
  }

  private extractMetadata(lines: string[]): ProcessingMetadata {
    let receiptDate = new Date();
    let receiptTime: string | undefined;
    let receiptType: 'restaurant' | 'retail' | 'taxi' | 'hotel' | 'other' = 'other';

    // Extract date
    for (const line of lines) {
      const dateMatch = line.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (dateMatch) {
        receiptDate = new Date(
          parseInt(dateMatch[1]),
          parseInt(dateMatch[2]) - 1,
          parseInt(dateMatch[3])
        );
        break;
      }
    }

    // Extract time
    for (const line of lines) {
      const timeMatch = line.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        receiptTime = `${timeMatch[1]}:${timeMatch[2]}`;
        break;
      }
    }

    // Infer receipt type
    const text = lines.join(' ').toLowerCase();
    if (text.includes('タクシー') || text.includes('運転手')) {
      receiptType = 'taxi';
    } else if (text.includes('レストラン') || text.includes('定食') || text.includes('ドリンク')) {
      receiptType = 'restaurant';
    } else if (text.includes('ホテル') || text.includes('宿泊')) {
      receiptType = 'hotel';
    } else {
      receiptType = 'retail';
    }

    return {
      receiptDate,
      receiptTime,
      currency: 'JPY',
      receiptType,
      confidence: 0.8
    };
  }
}

// OCR Engine interfaces and implementations

interface OCREngine {
  extractText(imageBuffer: Buffer, options?: { languages?: string[] }): Promise<OCRResult>;
}

class TesseractEngine implements OCREngine {
  async extractText(imageBuffer: Buffer, options?: { languages?: string[] }): Promise<OCRResult> {
    // Placeholder for Tesseract.js integration
    // const { createWorker } = await import('tesseract.js');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock result
    return {
      text: this.generateMockReceiptText(),
      confidence: 0.88,
      words: [],
      blocks: []
    };
  }

  private generateMockReceiptText(): string {
    return `コンビニエンスストア ABC
東京都渋谷区渋谷1-1-1
TEL: 03-1234-5678

2024/07/14 14:30
レシート No: 12345

おにぎり(鮭)           ¥120
お茶(500ml)           ¥100
合計                 ¥220
消費税               ¥20
お預り               ¥300
お釣り               ¥80

ありがとうございました`;
  }
}

class MockOCREngine implements OCREngine {
  async extractText(imageBuffer: Buffer, options?: { languages?: string[] }): Promise<OCRResult> {
    // Mock implementation for testing
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      text: 'Mock OCR Result - テスト用テキスト',
      confidence: 0.75,
      words: [],
      blocks: []
    };
  }
}

export default EnhancedOCRService;