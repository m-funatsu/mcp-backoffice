import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { RateLimiter } from 'rate-limiter-flexible';
import * as validator from 'validator';
import DOMPurify from 'isomorphic-dompurify';

/**
 * セキュリティ検証・保護機能を提供するユーティリティクラス
 */
export class SecurityValidator {
  private encryptionKey: Buffer;
  private jwtSecret: string;
  private rateLimiters: Map<string, RateLimiter>;
  private csrfTokens: Map<string, string>;

  constructor() {
    this.encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY || crypto.randomBytes(32));
    this.jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
    this.rateLimiters = new Map();
    this.csrfTokens = new Map();

    // レート制限の初期化
    this.initializeRateLimiters();
  }

  /**
   * 認証検証
   */
  async validateAuthentication(request: any): Promise<{ isValid: boolean; error?: string; user?: any }> {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return { isValid: false, error: 'Authentication required' };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { isValid: false, error: 'Invalid authentication format' };
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // トークンの有効期限確認
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        return { isValid: false, error: 'Token expired' };
      }

      // トークンの発行者確認
      if (decoded.iss !== 'ai-hr-platform') {
        return { isValid: false, error: 'Invalid token issuer' };
      }

      return { isValid: true, user: decoded };
    } catch (error) {
      return { isValid: false, error: 'Invalid token' };
    }
  }

  /**
   * 認可検証
   */
  validateAuthorization(request: any): { isAuthorized: boolean; reason?: string } {
    const { user, action, resource } = request;

    // 権限マトリクス
    const permissions = {
      employee: ['view:self', 'edit:self'],
      manager: ['view:self', 'edit:self', 'view:subordinates', 'approve:subordinates'],
      hr_admin: ['view:all', 'edit:all', 'approve:all'],
      admin: ['*']
    };

    const userPermissions = permissions[user.role] || [];

    // 管理者は全権限
    if (userPermissions.includes('*')) {
      return { isAuthorized: true };
    }

    // 特定のアクションが許可されているか
    if (userPermissions.includes(action)) {
      return { isAuthorized: true };
    }

    // リソース別の権限チェック
    if (userPermissions.includes(`${action}:${resource}`)) {
      return { isAuthorized: true };
    }

    return { isAuthorized: false, reason: 'Insufficient permissions' };
  }

  /**
   * データアクセス制御
   */
  validateDataAccess(request: any): { allowed: boolean; reason?: string } {
    const { user, targetEmployeeId, action } = request;

    // 自分のデータへのアクセス
    if (user.id === targetEmployeeId) {
      return { allowed: true };
    }

    // 役割別のアクセス制御
    switch (user.role) {
      case 'employee':
        return { allowed: false, reason: 'Access denied to other employee data' };
        
      case 'manager':
        // 部下のデータのみアクセス可能
        if (this.isSubordinate(user.id, targetEmployeeId)) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Access denied to non-subordinate data' };
        
      case 'hr_admin':
      case 'admin':
        return { allowed: true };
        
      default:
        return { allowed: false, reason: 'Unknown role' };
    }
  }

  /**
   * 入力値のサニタイゼーション
   */
  sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      // XSS対策
      input = DOMPurify.sanitize(input);
      
      // SQLインジェクション対策（基本的なエスケープ）
      input = input.replace(/['";\\]/g, '');
      
      // パストラバーサル対策
      input = input.replace(/\.\./g, '');
      input = input.replace(/[\/\\]/g, '');
      
      return input;
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        // 危険なキーを除外
        if (!key.startsWith('$') && !key.startsWith('__')) {
          sanitized[this.sanitizeInput(key)] = this.sanitizeInput(value);
        }
      }
      return sanitized;
    }

    return input;
  }

  /**
   * SQLクエリの安全な構築
   */
  buildSecureQuery(query: string, params: any[]): { text: string; values: any[] } {
    // プレースホルダーの置換
    let paramIndex = 1;
    const text = query.replace(/\?/g, () => `$${paramIndex++}`);
    
    return { text, values: params };
  }

  /**
   * パスワード強度検証
   */
  validatePasswordStrength(password: string): { isStrong: boolean; reasons: string[] } {
    const reasons = [];

    // 最小長
    if (password.length < 12) {
      reasons.push('Too short');
    }

    // 複雑性
    if (!/[a-z]/.test(password)) {
      reasons.push('Must contain lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
      reasons.push('Must contain uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      reasons.push('Must contain number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      reasons.push('Must contain special character');
    }

    // 一般的なパスワード
    const commonPasswords = [
      'password', '12345678', 'qwerty', 'admin', 'letmein',
      'welcome', 'monkey', '1234567890', 'password123'
    ];
    
    if (commonPasswords.some(common => password.toLowerCase().includes(common))) {
      reasons.push('Too common');
    }

    // 連続する文字
    if (/(.)\1{2,}/.test(password)) {
      reasons.push('Contains repeated characters');
    }

    return {
      isStrong: reasons.length === 0,
      reasons
    };
  }

  /**
   * レート制限チェック
   */
  async checkRateLimit(identifier: string, action: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const limiter = this.rateLimiters.get(action);
    
    if (!limiter) {
      return { allowed: true };
    }

    try {
      await limiter.consume(identifier);
      return { allowed: true };
    } catch (rateLimiterRes) {
      return {
        allowed: false,
        retryAfter: Math.round(rateLimiterRes.msBeforeNext / 1000) || 60
      };
    }
  }

  /**
   * CSRFトークン生成
   */
  generateCSRFToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.csrfTokens.set(sessionId, token);
    return token;
  }

  /**
   * CSRFトークン検証
   */
  validateCSRFToken(sessionId: string, token: string): boolean {
    const expectedToken = this.csrfTokens.get(sessionId);
    
    if (!expectedToken || !token) {
      return false;
    }

    // タイミング攻撃対策
    return crypto.timingSafeEqual(
      Buffer.from(expectedToken),
      Buffer.from(token)
    );
  }

  /**
   * ファイルアップロード検証
   */
  async validateFileUpload(file: any): Promise<{ isValid: boolean; reason?: string }> {
    // ファイルタイプ検証
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { isValid: false, reason: 'Invalid file type' };
    }

    // ファイルサイズ検証（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return { isValid: false, reason: 'File too large' };
    }

    // ファイル名検証
    const sanitizedName = this.sanitizeFilename(file.originalname);
    if (sanitizedName !== file.originalname) {
      return { isValid: false, reason: 'Invalid filename' };
    }

    // マジックナンバー検証
    const buffer = file.buffer;
    const magicNumbers = {
      'jpeg': [0xFF, 0xD8, 0xFF],
      'png': [0x89, 0x50, 0x4E, 0x47],
      'gif': [0x47, 0x49, 0x46],
      'pdf': [0x25, 0x50, 0x44, 0x46]
    };

    let isValidMagicNumber = false;
    for (const [type, magic] of Object.entries(magicNumbers)) {
      if (this.checkMagicNumber(buffer, magic)) {
        isValidMagicNumber = true;
        break;
      }
    }

    if (!isValidMagicNumber) {
      return { isValid: false, reason: 'File content does not match type' };
    }

    return { isValid: true };
  }

  /**
   * 機密データの暗号化
   */
  encryptSensitiveData(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * 機密データの復号
   */
  decryptSensitiveData(encryptedData: string): string {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * セキュリティヘッダーの設定
   */
  getSecurityHeaders(): { [key: string]: string } {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-${this.generateNonce()}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), accelerometer=()',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin'
    };
  }

  /**
   * エラーメッセージのサニタイゼーション
   */
  sanitizeErrorMessage(error: Error): string {
    // 機密情報を含む可能性のあるパターン
    const sensitivePatterns = [
      /password[s]?\s*[:=]\s*["']?[^"'\s]+/gi,
      /api[_-]?key\s*[:=]\s*["']?[^"'\s]+/gi,
      /secret\s*[:=]\s*["']?[^"'\s]+/gi,
      /token\s*[:=]\s*["']?[^"'\s]+/gi,
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/g,
      /postgresql:\/\/[^@]+@[^/]+/gi,
      /mysql:\/\/[^@]+@[^/]+/gi
    ];

    let message = error.message;
    
    for (const pattern of sensitivePatterns) {
      message = message.replace(pattern, '[REDACTED]');
    }

    // スタックトレースを除去
    return message.split('\n')[0];
  }

  /**
   * URLバリデーション（SSRF対策）
   */
  async validateExternalUrl(url: string): Promise<{ isValid: boolean; reason?: string }> {
    try {
      const parsed = new URL(url);
      
      // プロトコルチェック
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { isValid: false, reason: 'Invalid protocol' };
      }

      // 内部ネットワークアドレスのブロック
      const blockedHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '169.254.169.254', // AWS metadata
        '::1',
        '[::1]'
      ];

      if (blockedHosts.includes(parsed.hostname)) {
        return { isValid: false, reason: 'Forbidden host' };
      }

      // プライベートIPアドレスのブロック
      const ipRegex = /^(?:10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.|192\.168\.)/;
      if (ipRegex.test(parsed.hostname)) {
        return { isValid: false, reason: 'Private IP address forbidden' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, reason: 'Invalid URL format' };
    }
  }

  // プライベートメソッド

  private initializeRateLimiters(): void {
    // API呼び出し制限
    this.rateLimiters.set('api_call', new RateLimiter({
      storeClient: new Map(),
      points: 100,
      duration: 60, // 1分
      blockDuration: 60 // 1分ブロック
    }));

    // ログイン試行制限
    this.rateLimiters.set('login', new RateLimiter({
      storeClient: new Map(),
      points: 5,
      duration: 900, // 15分
      blockDuration: 900 // 15分ブロック
    }));

    // パスワードリセット制限
    this.rateLimiters.set('password_reset', new RateLimiter({
      storeClient: new Map(),
      points: 3,
      duration: 3600, // 1時間
      blockDuration: 3600 // 1時間ブロック
    }));
  }

  private isSubordinate(managerId: string, employeeId: string): boolean {
    // 実際の実装では組織階層をチェック
    return true; // プレースホルダー
  }

  private sanitizeFilename(filename: string): string {
    // ファイル名から危険な文字を除去
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .replace(/\.\./g, '')
      .substring(0, 255);
  }

  private checkMagicNumber(buffer: Buffer, magic: number[]): boolean {
    if (buffer.length < magic.length) {
      return false;
    }

    for (let i = 0; i < magic.length; i++) {
      if (buffer[i] !== magic[i]) {
        return false;
      }
    }

    return true;
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * セキュリティログ記録
   */
  async logSecurityEvent(event: {
    type: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: any;
  }): Promise<void> {
    const logEntry = {
      ...event,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID()
    };

    // 実際の実装ではデータベースやSIEMに送信
    console.log('[SECURITY]', JSON.stringify(logEntry));
  }

  /**
   * 異常検知
   */
  async detectAnomalies(activities: any[]): Promise<any[]> {
    const alerts = [];

    for (const activity of activities) {
      // 大量データアクセス
      if (activity.action === 'export' && activity.count > 100) {
        alerts.push({
          type: 'mass_export',
          severity: 'high',
          userId: activity.userId,
          details: `Exported ${activity.count} records`
        });
      }

      // 地理的異常
      if (activity.locations && activity.locations.length > 2) {
        alerts.push({
          type: 'geographic_anomaly',
          severity: 'medium',
          userId: activity.userId,
          details: `Login from ${activity.locations.length} different locations`
        });
      }

      // 時間的異常
      if (activity.time && this.isUnusualTime(activity.time)) {
        alerts.push({
          type: 'temporal_anomaly',
          severity: 'low',
          userId: activity.userId,
          details: `Activity at unusual time: ${activity.time}`
        });
      }
    }

    return alerts;
  }

  private isUnusualTime(time: string): boolean {
    const hour = new Date(`2025-01-01 ${time}`).getHours();
    return hour < 6 || hour > 22;
  }
}