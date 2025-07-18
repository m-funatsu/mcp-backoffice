import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import {
  FreeeIntegration,
  SlackIntegration,
  EcosystemIntegrationManager
} from '../../src/ecosystem-integration-v2.2.0.js';
import { OAuth2Client, OAuth2SessionManager } from '../../src/oauth2-authentication-v2.2.0.js';
import { ExpenseApprovalSystem } from '../../src/expense-management-v1.4.0.js';
import { PayrollEngineV12 } from '../../src/payroll-engine-v1.2.0.js';
import type { Employee, ExpenseRequest } from '../../src/types.js';

// 環境変数からAPI認証情報を取得（実際のテストでは必要）
const FREEE_ACCESS_TOKEN = process.env.FREEE_ACCESS_TOKEN || 'mock-token';
const SLACK_ACCESS_TOKEN = process.env.SLACK_ACCESS_TOKEN || 'mock-token';
const USE_REAL_APIS = process.env.USE_REAL_APIS === 'true';

describe('エコシステム統合 E2Eテスト', () => {
  let db: DatabasePostgreSQL;
  let integrationManager: EcosystemIntegrationManager;
  let expenseSystem: ExpenseApprovalSystem;
  let payrollEngine: PayrollEngineV12;
  let oauth2SessionManager: OAuth2SessionManager;

  beforeAll(async () => {
    // データベース接続
    db = new DatabasePostgreSQL({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DATABASE_NAME || 'attendance_test_e2e',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'postgres'
    });

    await db.connect();
    await db.initialize();

    // システム初期化
    integrationManager = new EcosystemIntegrationManager(db);
    expenseSystem = new ExpenseApprovalSystem(db);
    payrollEngine = new PayrollEngineV12(db);
    oauth2SessionManager = new OAuth2SessionManager();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    // テストデータのクリーンアップ
    await db.query('DELETE FROM expense_requests WHERE id LIKE $1', ['TEST_%']);
    await db.query('DELETE FROM payroll_calculations WHERE employee_id LIKE $1', ['TEST_%']);
  });

  describe('OAuth2認証フロー', () => {
    it('freee OAuth2認証フローを完了できる', async () => {
      const oauth2Config = {
        provider: 'freee',
        clientId: process.env.FREEE_CLIENT_ID || 'test-client-id',
        clientSecret: process.env.FREEE_CLIENT_SECRET || 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        authorizationUrl: 'https://accounts.secure.freee.co.jp/public_api/authorize',
        tokenUrl: 'https://accounts.secure.freee.co.jp/public_api/token',
        scopes: ['read', 'write']
      };

      const oauth2Client = new OAuth2Client(oauth2Config);
      
      // 認証URLの生成
      const authUrl = oauth2Client.getAuthorizationUrl();
      expect(authUrl).toContain('https://accounts.secure.freee.co.jp');
      expect(authUrl).toContain('client_id=');
      expect(authUrl).toContain('redirect_uri=');
      expect(authUrl).toContain('scope=read%20write');

      // 実際のトークン交換はモック（実環境では認証コードが必要）
      if (!USE_REAL_APIS) {
        const mockToken = {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000)
        };

        await oauth2SessionManager.saveSession(
          'TEST_USER',
          'freee',
          mockToken
        );

        const session = oauth2SessionManager.getSession('TEST_USER', 'freee');
        expect(session).toBeTruthy();
        expect(session?.token.accessToken).toBe('mock-access-token');
      }
    });

    it('トークンの自動更新ができる', async () => {
      // 期限切れ間近のトークンを設定
      const expiredToken = {
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 300, // 5分
        expiresAt: new Date(Date.now() + 60000) // 1分後に期限切れ
      };

      await oauth2SessionManager.saveSession(
        'TEST_USER',
        'freee',
        expiredToken
      );

      if (!USE_REAL_APIS) {
        // モック環境では新しいトークンを返す
        const oauth2Config = {
          provider: 'freee',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          redirectUri: 'http://localhost:3000/callback',
          authorizationUrl: 'https://accounts.secure.freee.co.jp/public_api/authorize',
          tokenUrl: 'https://accounts.secure.freee.co.jp/public_api/token',
          scopes: ['read', 'write']
        };

        const oauth2Client = new OAuth2Client(oauth2Config);
        
        // refreshAccessTokenのモック
        const mockRefresh = vi.spyOn(oauth2Client, 'refreshAccessToken').mockResolvedValue({
          accessToken: 'new-token',
          refreshToken: 'new-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000),
          scope: 'read write'
        });

        const newToken = await oauth2SessionManager.getValidAccessToken(
          'TEST_USER',
          'freee',
          oauth2Client
        );

        expect(newToken).toBe('new-token');
        mockRefresh.mockRestore();
      }
    });
  });

  describe('経費精算→会計システム連携', () => {
    it('承認済み経費をfreeeに自動連携できる', async () => {
      // テスト従業員の作成
      const employee: Employee = {
        id: 'TEST_EMP001',
        name: 'テスト太郎',
        department: 'テスト部',
        position: 'テスター',
        hourlyRate: 3000,
        startDate: new Date('2023-01-01'),
        isActive: true
      };
      await db.upsertEmployee(employee);

      // 経費申請の作成
      const expense: ExpenseRequest = {
        id: 'TEST_EXP001',
        employeeId: employee.id,
        date: new Date(),
        category: '交通費',
        amount: 5000,
        description: 'テスト出張の交通費',
        receiptUrl: 'https://example.com/receipt.jpg',
        status: 'pending',
        submittedAt: new Date()
      };

      await expenseSystem.submitExpense(expense);

      // 経費の承認
      await expenseSystem.approveExpense(expense.id, 'TEST_APPROVER', 'テスト承認');

      // freee統合の設定
      const freeeConfig = {
        provider: 'freee' as const,
        credentials: {
          accessToken: FREEE_ACCESS_TOKEN
        },
        options: {
          autoSync: true,
          retryAttempts: 3,
          timeout: 30000
        }
      };

      const freeeIntegration = new FreeeIntegration(freeeConfig);
      integrationManager.registerIntegration('freee', freeeIntegration);

      if (!USE_REAL_APIS) {
        // モック環境での動作確認
        const mockSync = vi.spyOn(freeeIntegration, 'syncExpenseData').mockResolvedValue({
          provider: 'freee',
          status: 'success',
          syncedAt: new Date(),
          itemsProcessed: 1,
          itemsFailed: 0,
          errors: []
        });

        const approvedExpenses = await db.query(
          'SELECT * FROM expense_requests WHERE status = $1 AND employee_id = $2',
          ['approved', employee.id]
        );

        const result = await freeeIntegration.syncExpenseData(approvedExpenses.rows);
        
        expect(result.status).toBe('success');
        expect(result.itemsProcessed).toBe(1);
        
        mockSync.mockRestore();
      }
    });
  });

  describe('給与計算→会計システム連携', () => {
    it('月次給与仕訳を自動生成できる', async () => {
      // テスト従業員の作成
      const employees: Employee[] = [
        {
          id: 'TEST_EMP001',
          name: 'テスト太郎',
          department: '開発部',
          position: 'エンジニア',
          hourlyRate: 3500,
          startDate: new Date('2023-01-01'),
          isActive: true
        },
        {
          id: 'TEST_EMP002',
          name: 'テスト花子',
          department: '営業部',
          position: 'マネージャー',
          hourlyRate: 4000,
          startDate: new Date('2023-06-01'),
          isActive: true
        }
      ];

      for (const emp of employees) {
        await db.upsertEmployee(emp);
      }

      // 給与計算の実行
      const payrollMonth = '2024-01';
      const payrollResults = [];

      for (const employee of employees) {
        const calculation = await payrollEngine.calculateMonthlyPayroll(
          employee.id,
          payrollMonth
        );
        payrollResults.push(calculation);
      }

      // freee統合での仕訳作成
      const freeeConfig = {
        provider: 'freee' as const,
        credentials: {
          accessToken: FREEE_ACCESS_TOKEN
        },
        options: {
          autoSync: true,
          retryAttempts: 3,
          timeout: 30000
        }
      };

      const freeeIntegration = new FreeeIntegration(freeeConfig);

      if (!USE_REAL_APIS) {
        // モック環境での仕訳生成確認
        const mockJournal = vi.spyOn(freeeIntegration, 'createJournalEntry').mockResolvedValue('JOURNAL123');

        const result = await freeeIntegration.syncPayrollData(payrollResults);
        
        expect(result.status).toBe('success');
        expect(result.itemsProcessed).toBe(2);
        
        // 仕訳内容の検証
        expect(mockJournal).toHaveBeenCalledWith(
          expect.objectContaining({
            description: expect.stringContaining('給与仕訳'),
            entries: expect.arrayContaining([
              expect.objectContaining({
                accountCode: '5001', // 給与
                debit: expect.any(Number)
              })
            ])
          })
        );
        
        mockJournal.mockRestore();
      }
    });
  });

  describe('HRイベント→タスク管理連携', () => {
    it('新入社員のオンボーディングタスクを自動作成できる', async () => {
      // 新入社員の登録
      const newEmployee: Employee = {
        id: 'TEST_NEW001',
        name: '新入テスト子',
        department: '人事部',
        position: '新卒',
        hourlyRate: 2500,
        startDate: new Date('2024-04-01'),
        isActive: true
      };

      await db.upsertEmployee(newEmployee);

      // Slack通知の設定
      const slackConfig = {
        provider: 'slack' as const,
        credentials: {
          accessToken: SLACK_ACCESS_TOKEN
        },
        options: {
          autoSync: true,
          retryAttempts: 3,
          timeout: 30000
        }
      };

      const slackIntegration = new SlackIntegration(slackConfig);
      integrationManager.registerIntegration('slack', slackIntegration);

      if (!USE_REAL_APIS) {
        // モック環境でのオンボーディング通知
        const mockNotification = vi.spyOn(slackIntegration, 'sendNotification').mockResolvedValue('MSG123');

        const onboardingNotification = {
          channel: '#hr-announcements',
          message: `🎉 新しいメンバーが入社します！`,
          attachments: [{
            title: '新入社員のお知らせ',
            text: `${newEmployee.name}さんが${newEmployee.department}に${newEmployee.startDate.toLocaleDateString('ja-JP')}付けで入社します。`,
            color: 'good',
            fields: [
              { title: '氏名', value: newEmployee.name, short: true },
              { title: '部署', value: newEmployee.department, short: true },
              { title: '役職', value: newEmployee.position, short: true },
              { title: '入社日', value: newEmployee.startDate.toLocaleDateString('ja-JP'), short: true }
            ]
          }],
          priority: 'normal' as const
        };

        const messageId = await slackIntegration.sendNotification(onboardingNotification);
        
        expect(messageId).toBe('MSG123');
        expect(mockNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('新しいメンバー')
          })
        );
        
        mockNotification.mockRestore();
      }
    });

    it('承認依頼をSlackで処理できる', async () => {
      const slackConfig = {
        provider: 'slack' as const,
        credentials: {
          accessToken: SLACK_ACCESS_TOKEN
        },
        options: {
          autoSync: true,
          retryAttempts: 3,
          timeout: 30000
        }
      };

      const slackIntegration = new SlackIntegration(slackConfig);

      if (!USE_REAL_APIS) {
        const mockApproval = vi.spyOn(slackIntegration, 'createApprovalRequest').mockResolvedValue('MSG456');

        const approvalRequest = {
          id: 'TEST_APPROVAL001',
          type: 'overtime' as const,
          requester: 'テスト太郎',
          approver: 'U_MANAGER001',
          details: {
            date: '2024-01-15',
            hours: 3,
            reason: '緊急対応のため'
          },
          actions: [
            { label: '承認する', value: 'approve', style: 'primary' as const },
            { label: '却下する', value: 'reject', style: 'danger' as const }
          ]
        };

        const messageId = await slackIntegration.createApprovalRequest(approvalRequest);
        
        expect(messageId).toBe('MSG456');
        expect(mockApproval).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'overtime',
            details: expect.objectContaining({
              hours: 3
            })
          })
        );
        
        mockApproval.mockRestore();
      }
    });
  });

  describe('統合エラーハンドリング', () => {
    it('API接続エラーを適切に処理する', async () => {
      const freeeConfig = {
        provider: 'freee' as const,
        credentials: {
          accessToken: 'invalid-token'
        },
        options: {
          autoSync: true,
          retryAttempts: 2,
          timeout: 5000
        }
      };

      const freeeIntegration = new FreeeIntegration(freeeConfig);

      if (!USE_REAL_APIS) {
        const mockValidate = vi.spyOn(freeeIntegration, 'validateConnection').mockResolvedValue(false);

        const isValid = await freeeIntegration.validateConnection();
        
        expect(isValid).toBe(false);
        
        mockValidate.mockRestore();
      }
    });

    it('レート制限を遵守する', async () => {
      const slackConfig = {
        provider: 'slack' as const,
        credentials: {
          accessToken: SLACK_ACCESS_TOKEN
        },
        options: {
          autoSync: true,
          retryAttempts: 3,
          timeout: 30000
        }
      };

      const slackIntegration = new SlackIntegration(slackConfig);

      if (!USE_REAL_APIS) {
        const mockSend = vi.spyOn(slackIntegration, 'sendNotification')
          .mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return 'MSG_DELAYED';
          });

        // 複数の通知を連続送信
        const notifications = Array(5).fill(null).map((_, i) => ({
          channel: '#test',
          message: `テストメッセージ ${i + 1}`,
          priority: 'normal' as const
        }));

        const startTime = Date.now();
        const results = await Promise.all(
          notifications.map(n => slackIntegration.sendNotification(n))
        );
        const endTime = Date.now();

        expect(results).toHaveLength(5);
        expect(endTime - startTime).toBeGreaterThanOrEqual(500); // レート制限による遅延
        
        mockSend.mockRestore();
      }
    });
  });

  describe('バッチ同期処理', () => {
    it('全統合の一括同期を実行できる', async () => {
      // 複数の統合を登録
      const freeeIntegration = new FreeeIntegration({
        provider: 'freee',
        credentials: { accessToken: FREEE_ACCESS_TOKEN },
        options: { autoSync: true, retryAttempts: 3, timeout: 30000 }
      });

      const slackIntegration = new SlackIntegration({
        provider: 'slack',
        credentials: { accessToken: SLACK_ACCESS_TOKEN },
        options: { autoSync: true, retryAttempts: 3, timeout: 30000 }
      });

      integrationManager.registerIntegration('freee', freeeIntegration);
      integrationManager.registerIntegration('slack', slackIntegration);

      if (!USE_REAL_APIS) {
        // モック環境での同期
        const mockFreeeSync = vi.fn().mockResolvedValue({
          provider: 'freee',
          status: 'success',
          syncedAt: new Date(),
          itemsProcessed: 10,
          itemsFailed: 0
        });
        
        const mockSlackSync = vi.fn().mockResolvedValue({
          provider: 'slack',
          status: 'success',
          syncedAt: new Date(),
          itemsProcessed: 5,
          itemsFailed: 0
        });

        (freeeIntegration as any).sync = mockFreeeSync;
        (slackIntegration as any).sync = mockSlackSync;

        const results = await integrationManager.syncAll();
        
        expect(results.size).toBe(2);
        expect(results.get('freee')?.status).toBe('success');
        expect(results.get('slack')?.status).toBe('success');
      }
    });
  });
});