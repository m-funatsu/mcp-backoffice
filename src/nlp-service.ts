import type { ParsedExpenseData, StructuredReceiptData, ReceiptItem } from './types.js';

// Natural Language Processing Service for expense management
// Future: Integration with OpenAI GPT, Claude API, etc.
export class NLPService {
  
  async parseExpenseRequest(input: string): Promise<ParsedExpenseData> {
    // Basic rule-based parsing implementation
    // Future: Use advanced NLP models like GPT-4, Claude, etc.
    
    const parsed: ParsedExpenseData = {
      confidence: 0.7
    };

    // Extract amount (Japanese yen patterns with various notations)
    const amountPatterns = [
      /(\d{1,3}(?:,\d{3})*)\s*円/,
      /¥\s*(\d+(?:,\d{3})*)/,
      /￥(\d+(?:,\d{3})*)/,
      /(\d{1,3}(?:,\d{3})*)\s*えん/,
      /(\d+(?:\.\d+)?)\s*万\s*(\d+)?\s*千?\s*円?/,  // 1万5千円 pattern
      /(\d+(?:\.\d+)?)\s*万(?:円)?/,
      /(\d+)\s*千(?:円)?/,
      /(\d+)\s*百(?:円)?/,
      /(\d+)円/
    ];

    for (const pattern of amountPatterns) {
      const match = input.match(pattern);
      if (match) {
        const amountStr = match[1].replace(/,/g, '');
        
        // Handle special cases like 万 and 千
        if (match[0].includes('万') && match[2]) {
          // Handle cases like "1万5千円"
          const man = parseFloat(amountStr) * 10000;
          const sen = parseFloat(match[2]) * 1000;
          parsed.amount = man + sen;
        } else if (match[0].includes('万')) {
          parsed.amount = parseFloat(amountStr) * 10000;
        } else if (match[0].includes('千')) {
          parsed.amount = parseFloat(amountStr) * 1000;
        } else if (match[0].includes('百')) {
          parsed.amount = parseFloat(amountStr) * 100;
        } else {
          parsed.amount = parseInt(amountStr);
        }
        break;
      }
    }

    // Extract date patterns
    parsed.date = this.parseComplexDate(input);

    // Extract category hints
    const categoryKeywords = {
      '交通費': ['電車', 'バス', 'タクシー', '新幹線', 'ガソリン', '駐車場', '高速', '交通'],
      '宿泊費': ['ホテル', '旅館', '宿泊', '泊', 'hotel'],
      '食事・接待費': ['食事', '飲食', 'レストラン', '居酒屋', 'ランチ', '接待', '会食'],
      '通信費': ['携帯', '電話', 'インターネット', 'wifi', '郵送', '宅配'],
      '事務用品': ['文房具', 'ペン', '紙', 'コピー', 'プリンター', '事務'],
      '研修・セミナー': ['研修', 'セミナー', '勉強会', '講習', '本', '書籍'],
      '会議費': ['会議', 'ミーティング', '打ち合わせ']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => input.includes(keyword))) {
        parsed.category = category;
        break;
      }
    }

    // Extract vendor/company name
    const vendorPatterns = [
      /([ァ-ヶ一-龯a-zA-Z0-9]+)(?:株式会社|会社|商店|ストア)/,
      /([ァ-ヶ一-龯a-zA-Z0-9]+)(?:で|から|にて)/
    ];

    for (const pattern of vendorPatterns) {
      const match = input.match(pattern);
      if (match) {
        parsed.vendor = match[1];
        break;
      }
    }

    // Extract description and purpose
    parsed.description = this.extractDescription(input);
    parsed.purpose = this.extractPurpose(input);

    return parsed;
  }

  async parseReceiptData(ocrText: string): Promise<StructuredReceiptData> {
    // Parse OCR text into structured receipt data
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let vendor = '';
    let date = new Date();
    let total = 0;
    const items: ReceiptItem[] = [];
    let taxAmount = 0;

    // Extract vendor (usually first few lines)
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i];
      // Skip lines with prices, dates, phone numbers, or common receipt headers
      if (line.length > 0 && 
          !line.match(/¥|\d+円/) && 
          !line.match(/\d{4}年|\d{4}[\/\-]/) && 
          !line.includes('TEL') &&
          !line.match(/^領収書$/) && // Skip "領収書" (receipt)
          !line.match(/^レシート$/)) { // Skip "レシート" (receipt)
        // Clean up OCR placeholder characters in vendor name
        vendor = line.replace(/□/g, '');
        break;
      }
    }

    // Extract date
    for (const line of lines) {
      // Try standard date formats
      const dateMatch = line.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (dateMatch) {
        const year = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const day = parseInt(dateMatch[3]);
        date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        break;
      }
      
      // Try Japanese date format (年月日)
      const jpDateMatch = line.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
      if (jpDateMatch) {
        const year = parseInt(jpDateMatch[1]);
        const month = parseInt(jpDateMatch[2]) - 1;
        const day = parseInt(jpDateMatch[3]);
        date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        break;
      }
    }

    // Extract items and amounts
    for (const line of lines) {
      // Handle OCR placeholder characters
      const cleanedLine = line.replace(/□/g, '0'); // Replace □ with 0
      
      // Look for price patterns
      const priceMatch = cleanedLine.match(/¥\s*(\d{1,3}(?:,\d{3})*)[-ー]?|(\d{1,3}(?:,\d{3})*)\s*円/);
      if (priceMatch) {
        const amount = parseInt((priceMatch[1] || priceMatch[2]).replace(/,/g, ''));
        
        if (line.includes('合計') || line.includes('総額') || line.includes('計')) {
          total = amount;
        } else if (line.includes('消費税') || line.includes('税')) {
          taxAmount = amount;
        } else {
          // Extract item name (text before the price)
          const itemName = line.replace(/¥\s*\d{1,3}(?:,\d{3})*|\d{1,3}(?:,\d{3})*\s*円/, '').trim();
          if (itemName && itemName.length > 0) {
            items.push({
              name: itemName,
              totalPrice: amount
            });
          }
        }
      }
    }

    // If total wasn't found, sum up items
    if (total === 0 && items.length > 0) {
      total = items.reduce((sum, item) => sum + item.totalPrice, 0);
    }

    // Extract description from "但" (purpose) line
    let description: string | undefined;
    for (const line of lines) {
      if (line.includes('但')) {
        description = line.replace('但', '').trim();
        break;
      }
    }

    return {
      vendor: vendor || 'Unknown',
      date,
      total,
      items,
      taxAmount,
      description
    };
  }

  private extractDescription(input: string): string {
    // Extract meaningful description from input
    // Remove common patterns and keep the core description
    let description = input;
    
    // Remove amount patterns
    description = description.replace(/(\d{1,3}(?:,\d{3})*)\s*円/g, '');
    description = description.replace(/¥\s*(\d{1,3}(?:,\d{3})*)/g, '');
    
    // Remove date patterns
    description = description.replace(/(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})[日]?/g, '');
    
    // Clean up and return first meaningful sentence
    description = description.trim();
    const sentences = description.split('。');
    return sentences[0] || input.substring(0, 50);
  }

  private parseComplexDate(input: string): Date | undefined {
    const now = new Date();
    
    // Simple date patterns
    const simplePatterns = [
      { pattern: /(今日|きょう)/, handler: () => new Date() },
      { pattern: /(昨日|きのう)/, handler: () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date;
      }},
      { pattern: /(明日|あした)/, handler: () => {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        return date;
      }},
      { pattern: /(\d+)\s*日前/, handler: (match: RegExpMatchArray) => {
        const days = parseInt(match[1]);
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date;
      }}
    ];
    
    // Check simple patterns first
    for (const { pattern, handler } of simplePatterns) {
      const match = input.match(pattern);
      if (match) {
        return handler(match);
      }
    }
    
    // Complex date patterns
    if (input.includes('先月末')) {
      const date = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
      return date;
    }
    
    if (input.includes('今月末')) {
      const date = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
      return date;
    }
    
    if (input.includes('今週月曜') || input.includes('今週の月曜')) {
      const date = new Date();
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
      date.setDate(diff);
      return date;
    }
    
    if (input.includes('先週')) {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      
      // Check for specific day of week
      const dayMatch = input.match(/(?:月|火|水|木|金|土|日)曜/);
      if (dayMatch) {
        const targetDay = this.getDayOfWeekNumber(dayMatch[0]);
        const currentDay = date.getDay();
        const diff = targetDay - currentDay;
        date.setDate(date.getDate() + diff);
      }
      return date;
    }
    
    // Standard date formats
    const datePatterns = [
      /(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})[日]?/,
      /(\d{1,2})[月\/\-](\d{1,2})[日]?/
    ];
    
    for (const pattern of datePatterns) {
      const match = input.match(pattern);
      if (match) {
        if (match[3]) {
          // Full date with year
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else if (match[1] && match[2]) {
          // Month and day only (assume current year)
          return new Date(now.getFullYear(), parseInt(match[1]) - 1, parseInt(match[2]));
        }
      }
    }
    
    return undefined;
  }
  
  private getDayOfWeekNumber(dayName: string): number {
    const days: { [key: string]: number } = {
      '日曜': 0, '月曜': 1, '火曜': 2, '水曜': 3,
      '木曜': 4, '金曜': 5, '土曜': 6
    };
    return days[dayName] || 0;
  }

  private extractPurpose(input: string): string {
    // Extract business purpose from input
    const purposeKeywords = [
      '出張', '営業', '会議', '打ち合わせ', 'ミーティング', '研修', 
      'セミナー', '接待', '会食', '業務', '仕事', '取引先'
    ];
    
    for (const keyword of purposeKeywords) {
      if (input.includes(keyword)) {
        // Extract context around the keyword
        const index = input.indexOf(keyword);
        const start = Math.max(0, index - 10);
        const end = Math.min(input.length, index + keyword.length + 20);
        return input.substring(start, end).trim();
      }
    }
    
    return '';
  }

  // Future implementation with OpenAI GPT API
  /*
  async parseExpenseRequestWithGPT(input: string): Promise<ParsedExpenseData> {
    const prompt = `
    以下の日本語テキストから経費申請の情報を抽出してください。
    抽出する項目：金額、日付、カテゴリー、説明、目的、会社名
    
    テキスト: "${input}"
    
    JSON形式で回答してください：
    {
      "amount": 数値または null,
      "date": "YYYY-MM-DD" または null,
      "category": "カテゴリー名" または null,
      "description": "説明文",
      "purpose": "目的" または null,
      "vendor": "会社名" または null,
      "confidence": 0.0-1.0の信頼度
    }
    `;
    
    // OpenAI API call would go here
    // const response = await openai.chat.completions.create({...});
    
    // Return parsed result
  }
  */
}

export default NLPService;