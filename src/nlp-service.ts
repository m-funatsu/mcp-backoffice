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

    // Extract amount (Japanese yen patterns)
    const amountPatterns = [
      /(\d{1,3}(?:,\d{3})*)\s*円/,
      /¥\s*(\d{1,3}(?:,\d{3})*)/,
      /(\d{1,3}(?:,\d{3})*)\s*えん/,
      /(\d+)\s*円/
    ];

    for (const pattern of amountPatterns) {
      const match = input.match(pattern);
      if (match) {
        parsed.amount = parseInt(match[1].replace(/,/g, ''));
        break;
      }
    }

    // Extract date patterns
    const datePatterns = [
      /(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})[日]?/,
      /(\d{1,2})[月\/\-](\d{1,2})[日]?/,
      /(今日|きょう)/,
      /(昨日|きのう)/,
      /(明日|あした)/
    ];

    for (const pattern of datePatterns) {
      const match = input.match(pattern);
      if (match) {
        if (match[0].includes('今日') || match[0].includes('きょう')) {
          parsed.date = new Date();
        } else if (match[0].includes('昨日') || match[0].includes('きのう')) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          parsed.date = yesterday;
        } else if (match[0].includes('明日') || match[0].includes('あした')) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          parsed.date = tomorrow;
        } else if (match[3]) {
          // Full date with year
          parsed.date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        } else if (match[1] && match[2]) {
          // Month and day only (assume current year)
          const currentYear = new Date().getFullYear();
          parsed.date = new Date(currentYear, parseInt(match[1]) - 1, parseInt(match[2]));
        }
        break;
      }
    }

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
      if (line.length > 2 && !line.match(/\d/) && !line.includes('TEL')) {
        vendor = line;
        break;
      }
    }

    // Extract date
    for (const line of lines) {
      const dateMatch = line.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (dateMatch) {
        date = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
        break;
      }
    }

    // Extract items and amounts
    for (const line of lines) {
      // Look for price patterns
      const priceMatch = line.match(/¥\s*(\d{1,3}(?:,\d{3})*)|(\d{1,3}(?:,\d{3})*)\s*円/);
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

    return {
      vendor: vendor || 'Unknown',
      date,
      total,
      items,
      taxAmount
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