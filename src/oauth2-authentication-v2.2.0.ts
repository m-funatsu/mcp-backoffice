import crypto from 'crypto';

/**
 * OAuth2.0認証フロー実装
 * OAuth2.0 Authentication Flow Implementation
 * 
 * 対応サービス:
 * - freee会計
 * - マネーフォワード
 * - Slack
 * - Microsoft Teams
 * - Jira
 * - Asana
 */

export interface OAuth2Config {
  provider: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  state?: string;
  pkce?: boolean; // PKCE (Proof Key for Code Exchange) サポート
}

export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: Date;
  scope?: string;
}

export interface OAuth2Session {
  provider: string;
  userId: string;
  token: OAuth2Token;
  profile?: any;
  createdAt: Date;
  lastRefreshed: Date;
}

export class OAuth2Client {
  private config: OAuth2Config;
  private codeVerifier?: string;
  private codeChallenge?: string;

  constructor(config: OAuth2Config) {
    this.config = config;
    
    // PKCE対応の場合、コードチャレンジを生成
    if (config.pkce) {
      this.generatePKCE();
    }
  }

  /**
   * 認証URLの生成
   */
  getAuthorizationUrl(additionalParams?: Record<string, string>): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      state: this.config.state || this.generateState(),
      ...additionalParams
    });

    // PKCE対応
    if (this.config.pkce && this.codeChallenge) {
      params.append('code_challenge', this.codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    // プロバイダー別の追加パラメータ
    this.addProviderSpecificParams(params);

    return `${this.config.authorizationUrl}?${params.toString()}`;
  }

  /**
   * 認証コードからアクセストークンを取得
   */
  async exchangeCodeForToken(code: string): Promise<OAuth2Token> {
    const params: any = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    };

    // PKCE対応
    if (this.config.pkce && this.codeVerifier) {
      params.code_verifier = this.codeVerifier;
    }

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...this.getProviderHeaders()
        },
        body: new URLSearchParams(params).toString()
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new OAuth2Error('TOKEN_EXCHANGE_FAILED', errorData);
      }

      const tokenData = await response.json();
      return this.parseTokenResponse(tokenData);
    } catch (error) {
      console.error('Token exchange failed:', error);
      throw error;
    }
  }

  /**
   * リフレッシュトークンを使用してアクセストークンを更新
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuth2Token> {
    const params = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    };

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...this.getProviderHeaders()
        },
        body: new URLSearchParams(params).toString()
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new OAuth2Error('TOKEN_REFRESH_FAILED', errorData);
      }

      const tokenData = await response.json();
      return this.parseTokenResponse(tokenData);
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * アクセストークンの取り消し
   */
  async revokeToken(token: string, tokenType: 'access_token' | 'refresh_token' = 'access_token'): Promise<void> {
    const revokeUrl = this.getProviderRevokeUrl();
    if (!revokeUrl) {
      throw new Error(`Token revocation not supported for provider: ${this.config.provider}`);
    }

    const params = {
      token,
      token_type_hint: tokenType,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret
    };

    try {
      const response = await fetch(revokeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(params).toString()
      });

      if (!response.ok) {
        throw new OAuth2Error('TOKEN_REVOKE_FAILED', await response.text());
      }
    } catch (error) {
      console.error('Token revocation failed:', error);
      throw error;
    }
  }

  /**
   * ユーザープロファイルの取得
   */
  async getUserProfile(accessToken: string): Promise<any> {
    const profileUrl = this.getProviderProfileUrl();
    if (!profileUrl) {
      throw new Error(`User profile endpoint not configured for provider: ${this.config.provider}`);
    }

    try {
      const response = await fetch(profileUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          ...this.getProviderHeaders()
        }
      });

      if (!response.ok) {
        throw new OAuth2Error('PROFILE_FETCH_FAILED', await response.text());
      }

      return response.json();
    } catch (error) {
      console.error('Profile fetch failed:', error);
      throw error;
    }
  }

  // Private methods

  private generateState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generatePKCE(): void {
    // Code Verifier: 43-128文字のランダム文字列
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Code Challenge: Code VerifierのSHA256ハッシュ
    const hash = crypto.createHash('sha256');
    hash.update(this.codeVerifier);
    this.codeChallenge = hash.digest('base64url');
  }

  private addProviderSpecificParams(params: URLSearchParams): void {
    switch (this.config.provider) {
      case 'freee':
        // freee固有のパラメータ
        break;
      case 'moneyforward':
        // マネーフォワード固有のパラメータ
        params.append('prompt', 'consent');
        break;
      case 'slack':
        // Slack固有のパラメータ
        params.append('team', params.get('team') || '');
        break;
      case 'teams':
        // Teams固有のパラメータ
        params.append('response_mode', 'query');
        break;
    }
  }

  private getProviderHeaders(): Record<string, string> {
    switch (this.config.provider) {
      case 'freee':
        return { 'X-Api-Version': '2020-06-15' };
      case 'moneyforward':
        return { 'Accept': 'application/json' };
      default:
        return {};
    }
  }

  private parseTokenResponse(data: any): OAuth2Token {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenType: data.token_type || 'Bearer',
      expiresIn: data.expires_in || 3600,
      expiresAt,
      scope: data.scope
    };
  }

  private getProviderRevokeUrl(): string | null {
    const revokeUrls: Record<string, string> = {
      freee: 'https://api.freee.co.jp/oauth/revoke',
      slack: 'https://slack.com/api/auth.revoke',
      // 他のプロバイダーの取り消しURL
    };
    return revokeUrls[this.config.provider] || null;
  }

  private getProviderProfileUrl(): string | null {
    const profileUrls: Record<string, string> = {
      freee: 'https://api.freee.co.jp/api/1/users/me',
      moneyforward: 'https://api.moneyforward.com/api/v1/user',
      slack: 'https://slack.com/api/users.identity',
      teams: 'https://graph.microsoft.com/v1.0/me',
      // 他のプロバイダーのプロファイルURL
    };
    return profileUrls[this.config.provider] || null;
  }
}

// OAuth2セッションマネージャー
export class OAuth2SessionManager {
  private sessions: Map<string, OAuth2Session> = new Map();
  private tokenRefreshCallbacks: Map<string, (token: OAuth2Token) => Promise<void>> = new Map();

  /**
   * セッションの保存
   */
  async saveSession(userId: string, provider: string, token: OAuth2Token, profile?: any): Promise<void> {
    const session: OAuth2Session = {
      provider,
      userId,
      token,
      profile,
      createdAt: new Date(),
      lastRefreshed: new Date()
    };

    const sessionKey = `${provider}:${userId}`;
    this.sessions.set(sessionKey, session);
  }

  /**
   * セッションの取得
   */
  getSession(userId: string, provider: string): OAuth2Session | null {
    const sessionKey = `${provider}:${userId}`;
    return this.sessions.get(sessionKey) || null;
  }

  /**
   * 有効なアクセストークンの取得（必要に応じて自動更新）
   */
  async getValidAccessToken(
    userId: string,
    provider: string,
    oauth2Client: OAuth2Client
  ): Promise<string> {
    const session = this.getSession(userId, provider);
    if (!session) {
      throw new Error(`No session found for user: ${userId}, provider: ${provider}`);
    }

    // トークンの有効期限をチェック
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5分のバッファ
    
    if (session.token.expiresAt.getTime() - now.getTime() > bufferTime) {
      return session.token.accessToken;
    }

    // トークンの更新が必要
    if (!session.token.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const newToken = await oauth2Client.refreshAccessToken(session.token.refreshToken);
      
      // セッションを更新
      session.token = newToken;
      session.lastRefreshed = new Date();
      
      // コールバックを実行
      const callback = this.tokenRefreshCallbacks.get(`${provider}:${userId}`);
      if (callback) {
        await callback(newToken);
      }
      
      return newToken.accessToken;
    } catch (error) {
      // リフレッシュに失敗した場合、セッションを削除
      this.removeSession(userId, provider);
      throw error;
    }
  }

  /**
   * トークン更新時のコールバックを登録
   */
  onTokenRefresh(
    userId: string,
    provider: string,
    callback: (token: OAuth2Token) => Promise<void>
  ): void {
    this.tokenRefreshCallbacks.set(`${provider}:${userId}`, callback);
  }

  /**
   * セッションの削除
   */
  removeSession(userId: string, provider: string): void {
    const sessionKey = `${provider}:${userId}`;
    this.sessions.delete(sessionKey);
    this.tokenRefreshCallbacks.delete(sessionKey);
  }

  /**
   * 全セッションの取得
   */
  getAllSessions(): OAuth2Session[] {
    return Array.from(this.sessions.values());
  }
}

// OAuth2エラークラス
export class OAuth2Error extends Error {
  code: string;
  details: any;

  constructor(code: string, details: any) {
    super(`OAuth2 error: ${code}`);
    this.code = code;
    this.details = details;
  }
}

// プロバイダー設定プリセット
export const OAuth2Providers = {
  freee: {
    authorizationUrl: 'https://accounts.secure.freee.co.jp/public_api/authorize',
    tokenUrl: 'https://accounts.secure.freee.co.jp/public_api/token',
    scopes: ['read', 'write']
  },
  moneyforward: {
    authorizationUrl: 'https://auth.moneyforward.com/oauth/authorize',
    tokenUrl: 'https://auth.moneyforward.com/oauth/token',
    scopes: ['manage_account', 'manage_transaction']
  },
  slack: {
    authorizationUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    scopes: ['chat:write', 'channels:read', 'users:read', 'users.profile:write']
  },
  teams: {
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: ['User.Read', 'Chat.ReadWrite', 'ChannelMessage.Send']
  },
  jira: {
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:jira-work', 'write:jira-work'],
    pkce: true // JiraはPKCE必須
  },
  asana: {
    authorizationUrl: 'https://app.asana.com/-/oauth_authorize',
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    scopes: ['default']
  }
};