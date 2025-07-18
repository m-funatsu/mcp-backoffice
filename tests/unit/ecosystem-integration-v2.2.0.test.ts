import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  FreeeIntegration,
  SlackIntegration,
  TeamsIntegration,
  JiraIntegration,
  AsanaIntegration,
  EcosystemIntegrationManager
} from '../../src/ecosystem-integration-v2.2.0.js';
import { DatabasePostgreSQL } from '../../src/database_postgresql.js';
import type { Employee, PayrollCalculation, ExpenseRequest } from '../../src/types.js';

// グローバルfetchのモック
global.fetch = vi.fn();

describe('エコシステム統合エンジン v2.2.0', () => {
  let mockDb: DatabasePostgreSQL;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {} as DatabasePostgreSQL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('freee会計統合', () => {
    let freeeIntegration: FreeeIntegration;
    const mockConfig = {
      provider: 'freee' as const,
      credentials: {
        accessToken: 'test-token'
      },
      options: {
        autoSync: true,
        retryAttempts: 3,
        timeout: 30000
      }
    };

    beforeEach(() => {
      freeeIntegration = new FreeeIntegration(mockConfig);
    });

    it('仕訳エントリを作成できる', async () => {
      const journalEntry = {
        date: new Date('2024-01-15'),
        description: '給与支払い',
        entries: [
          {
            accountCode: '5001',
            accountName: '給与',
            debit: 1000000,
            credit: 0
          },
          {
            accountCode: '1002',
            accountName: '普通預金',
            debit: 0,
            credit: 1000000
          }
        ],
        reference: 'PAYROLL_202401'
      };

      const mockResponse = {
        ok: true,
        json: async () => ({ deal: { id: 'DEAL123' } })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const dealId = await freeeIntegration.createJournalEntry(journalEntry);
      
      expect(dealId).toBe('DEAL123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/1/deals'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('従業員マスタを同期できる', async () => {
      const employees: Employee[] = [
        {
          id: 'EMP001',
          name: '山田太郎',
          department: '開発部',
          position: 'エンジニア',
          hourlyRate: 3000,
          startDate: new Date('2022-04-01'),
          isActive: true
        }
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await freeeIntegration.syncEmployeeMaster(employees);
      
      expect(result.status).toBe('success');
      expect(result.itemsProcessed).toBe(1);
      expect(result.itemsFailed).toBe(0);
    });

    it('給与データを同期できる', async () => {
      const payrollData: PayrollCalculation[] = [
        {
          employeeId: 'EMP001',
          month: '2024-01',
          basePay: 300000,
          overtimePay: 50000,
          allowances: [],
          deductions: [],
          totalPay: 350000,
          netPay: 280000,
          taxDetails: {
            incomeTax: 30000,
            residentTax: 20000,
            socialInsurance: 20000
          }
        }
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ deal: { id: 'DEAL456' } })
      });

      const result = await freeeIntegration.syncPayrollData(payrollData);
      
      expect(result.status).toBe('success');
      expect(result.itemsProcessed).toBe(1);
    });

    it('APIエラーを適切に処理する', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(freeeIntegration.validateConnection()).resolves.toBe(false);
    });
  });

  describe('Slack統合', () => {
    let slackIntegration: SlackIntegration;
    const mockConfig = {
      provider: 'slack' as const,
      credentials: {
        accessToken: 'xoxb-test-token'
      },
      options: {
        autoSync: true,
        retryAttempts: 3,
        timeout: 30000
      }
    };

    beforeEach(() => {
      slackIntegration = new SlackIntegration(mockConfig);
    });

    it('通知を送信できる', async () => {
      const notification = {
        channel: '#hr-notifications',
        message: '新しい経費申請が承認待ちです',
        attachments: [{
          title: '経費申請',
          text: '山田太郎: 交通費 ¥5,000',
          color: 'warning',
          fields: [
            { title: '申請者', value: '山田太郎', short: true },
            { title: '金額', value: '¥5,000', short: true }
          ]
        }],
        priority: 'normal' as const
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' })
      });

      const messageId = await slackIntegration.sendNotification(notification);
      
      expect(messageId).toBe('1234567890.123456');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('chat.postMessage'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('hr-notifications')
        })
      );
    });

    it('承認リクエストを作成できる', async () => {
      const approvalRequest = {
        id: 'REQ001',
        type: 'expense' as const,
        requester: '山田太郎',
        approver: 'U12345678',
        details: {
          amount: 5000,
          description: '交通費'
        },
        actions: [
          { label: '承認', value: 'approve', style: 'primary' as const },
          { label: '却下', value: 'reject', style: 'danger' as const }
        ]
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, ts: '1234567890.123456' })
      });

      const messageId = await slackIntegration.createApprovalRequest(approvalRequest);
      
      expect(messageId).toBe('1234567890.123456');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('chat.postMessage'),
        expect.objectContaining({
          body: expect.stringContaining('承認依頼')
        })
      );
    });
  });

  describe('Microsoft Teams統合', () => {
    let teamsIntegration: TeamsIntegration;
    const mockConfig = {
      provider: 'teams' as const,
      credentials: {
        accessToken: 'teams-test-token'
      },
      options: {
        autoSync: true,
        retryAttempts: 3,
        timeout: 30000
      }
    };

    beforeEach(() => {
      teamsIntegration = new TeamsIntegration(mockConfig);
    });

    it('アダプティブカードで通知を送信できる', async () => {
      const notification = {
        channel: 'team123/channel456',
        message: '重要なお知らせがあります',
        attachments: [{
          title: '緊急通知',
          text: 'システムメンテナンスのお知らせ'
        }],
        priority: 'urgent' as const
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'MSG123' })
      });

      const messageId = await teamsIntegration.sendNotification(notification);
      
      expect(messageId).toBe('MSG123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.microsoft.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer teams-test-token'
          })
        })
      );
    });

    it('プレゼンス状態を更新できる', async () => {
      const status = {
        channel: 'general',
        status: 'busy',
        emoji: ':calendar:',
        expiration: new Date(Date.now() + 60 * 60 * 1000) // 1時間後
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await teamsIntegration.updateChannelStatus(status);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/me/presence/setPresence'),
        expect.objectContaining({
          body: expect.stringContaining('Busy')
        })
      );
    });
  });

  describe('Jira統合', () => {
    let jiraIntegration: JiraIntegration;
    const mockConfig = {
      provider: 'jira' as const,
      credentials: {
        accessToken: 'jira-test-token'
      },
      options: {
        autoSync: true,
        retryAttempts: 3,
        timeout: 30000,
        projectKey: 'HR'
      }
    };

    beforeEach(() => {
      jiraIntegration = new JiraIntegration(mockConfig, 'cloud123');
    });

    it('タスクを作成できる', async () => {
      const task = {
        title: '新入社員オンボーディング',
        description: '田中花子さんのオンボーディングタスク',
        assignee: 'tanaka@example.com',
        dueDate: new Date('2024-02-01'),
        priority: 'high' as const,
        labels: ['onboarding', 'hr']
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ([{ accountId: 'ACC123' }])
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ key: 'HR-123' })
        });

      const taskId = await jiraIntegration.createTask(task);
      
      expect(taskId).toBe('HR-123');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('HRイベントとタスクをリンクできる', async () => {
      const hrEvent = {
        type: 'onboarding' as const,
        employeeId: 'EMP002',
        date: new Date('2024-02-01'),
        details: {
          department: '営業部',
          mentor: '佐藤次郎'
        }
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await jiraIntegration.linkToHREvent('HR-123', hrEvent);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/issue/HR-123/comment'),
        expect.objectContaining({
          body: expect.stringContaining('onboarding')
        })
      );
    });
  });

  describe('Asana統合', () => {
    let asanaIntegration: AsanaIntegration;
    const mockConfig = {
      provider: 'asana' as const,
      credentials: {
        accessToken: 'asana-test-token'
      },
      options: {
        autoSync: true,
        retryAttempts: 3,
        timeout: 30000,
        projectGid: 'project123'
      }
    };

    beforeEach(() => {
      asanaIntegration = new AsanaIntegration(mockConfig, 'workspace123');
    });

    it('タスクを作成してタグを付けられる', async () => {
      const task = {
        title: '四半期レビュー準備',
        description: 'Q1レビューの資料準備',
        assignee: 'reviewer@example.com',
        dueDate: new Date('2024-03-31'),
        priority: 'medium' as const,
        labels: ['review', 'quarterly']
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ email: 'reviewer@example.com', gid: 'USER123' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ name: 'review', gid: 'TAG123' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { gid: 'TAG456' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { gid: 'TASK123' } })
        });

      const taskId = await asanaIntegration.createTask(task);
      
      expect(taskId).toBe('TASK123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tasks'),
        expect.objectContaining({
          body: expect.stringContaining('四半期レビュー準備')
        })
      );
    });

    it('プロジェクトを同期できる', async () => {
      const projects = [{
        id: 'PROJ001',
        name: '2024年度採用プロジェクト',
        members: ['hr@example.com', 'manager@example.com'],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      }];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { gid: 'PROJ123' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ email: 'hr@example.com', gid: 'USER1' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ email: 'manager@example.com', gid: 'USER2' }] })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true })
        });

      const result = await asanaIntegration.syncProjects(projects);
      
      expect(result.status).toBe('success');
      expect(result.itemsProcessed).toBe(1);
    });
  });

  describe('統合マネージャー', () => {
    let manager: EcosystemIntegrationManager;

    beforeEach(() => {
      manager = new EcosystemIntegrationManager(mockDb);
    });

    it('複数の統合を登録・管理できる', () => {
      const freeeConfig = {
        provider: 'freee' as const,
        credentials: { accessToken: 'freee-token' },
        options: { autoSync: true, retryAttempts: 3, timeout: 30000 }
      };
      
      const slackConfig = {
        provider: 'slack' as const,
        credentials: { accessToken: 'slack-token' },
        options: { autoSync: true, retryAttempts: 3, timeout: 30000 }
      };

      const freeeIntegration = new FreeeIntegration(freeeConfig);
      const slackIntegration = new SlackIntegration(slackConfig);

      manager.registerIntegration('freee', freeeIntegration);
      manager.registerIntegration('slack', slackIntegration);

      const retrievedFreee = manager.getIntegration<FreeeIntegration>('freee');
      const retrievedSlack = manager.getIntegration<SlackIntegration>('slack');

      expect(retrievedFreee).toBe(freeeIntegration);
      expect(retrievedSlack).toBe(slackIntegration);
    });

    it('Webhookイベントを適切なハンドラーにルーティングする', async () => {
      const mockIntegration = {
        handleWebhook: vi.fn().mockResolvedValue(undefined)
      };

      manager.registerIntegration('test', mockIntegration);

      const webhookEvent = {
        provider: 'test',
        eventType: 'test.event',
        payload: { data: 'test' },
        receivedAt: new Date()
      };

      await manager.handleWebhook('test', webhookEvent);

      expect(mockIntegration.handleWebhook).toHaveBeenCalledWith(webhookEvent);
    });

    it('存在しない統合へのWebhookはエラーを投げる', async () => {
      const webhookEvent = {
        provider: 'unknown',
        eventType: 'test.event',
        payload: { data: 'test' },
        receivedAt: new Date()
      };

      await expect(
        manager.handleWebhook('unknown', webhookEvent)
      ).rejects.toThrow('No webhook handler registered for provider: unknown');
    });
  });
});