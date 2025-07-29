/**
 * AI-OS v3.2.0 ハイブリッド設定パネル テスト
 * Hybrid Configuration Panel Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HybridConfigPanel } from '../components/HybridConfigPanel';
import { ConversationalAIService } from '../services/ConversationalAIService';
import { AuditLogService } from '../services/AuditLogService';

// モックの設定
vi.mock('../services/ConversationalAIService');
vi.mock('../services/AuditLogService');
vi.mock('../services/AIConfigurationService');

describe('HybridConfigPanel', () => {
  let mockAIService: any;
  let mockAuditService: any;
  let mockOnConfigChange: any;

  beforeEach(() => {
    mockAIService = {
      processConfigurationIntent: vi.fn(),
      applyConfigChange: vi.fn()
    };
    
    mockAuditService = {
      log: vi.fn()
    };
    
    mockOnConfigChange = vi.fn();

    // モックをコンストラクタに設定
    (ConversationalAIService as any).mockImplementation(() => mockAIService);
    (AuditLogService as any).mockImplementation(() => mockAuditService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('モード切り替え', () => {
    it('初期モードが正しく設定される', () => {
      render(
        <HybridConfigPanel
          initialMode="hybrid"
          currentConfig={{}}
          userId="user123"
        />
      );

      expect(screen.getByLabelText('ハイブリッドモード')).toHaveAttribute('aria-pressed', 'true');
    });

    it('モード切り替えが正常に動作する', async () => {
      render(
        <HybridConfigPanel
          initialMode="gui"
          currentConfig={{}}
          userId="user123"
        />
      );

      const conversationalButton = screen.getByLabelText('会話モード');
      await userEvent.click(conversationalButton);

      expect(conversationalButton).toHaveAttribute('aria-pressed', 'true');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'mode_change',
          changes: {
            before: { mode: 'gui' },
            after: { mode: 'conversational' }
          }
        })
      );
    });
  });

  describe('会話型インターフェース', () => {
    it('メッセージ送信が正常に動作する', async () => {
      mockAIService.processConfigurationIntent.mockResolvedValue({
        message: 'エージェントを有効にしました',
        configChanges: [{
          path: 'agents.payroll.enabled',
          oldValue: false,
          newValue: true,
          description: '給与計算エージェントを有効化'
        }]
      });

      render(
        <HybridConfigPanel
          initialMode="conversational"
          currentConfig={{}}
          userId="user123"
        />
      );

      const input = screen.getByPlaceholderText('設定変更の内容を入力してください...');
      await userEvent.type(input, '給与計算エージェントを有効にして');
      
      const sendButton = screen.getByText('送信');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(mockAIService.processConfigurationIntent).toHaveBeenCalledWith({
          message: '給与計算エージェントを有効にして',
          currentConfig: {},
          context: expect.any(Object)
        });
      });
    });

    it('設定変更の確認ダイアログが表示される', async () => {
      mockAIService.processConfigurationIntent.mockResolvedValue({
        message: '以下の設定変更を行います',
        configChanges: [{
          path: 'agents.payroll.enabled',
          oldValue: false,
          newValue: true,
          description: '給与計算エージェントを有効化'
        }]
      });

      render(
        <HybridConfigPanel
          initialMode="conversational"
          currentConfig={{}}
          userId="user123"
        />
      );

      const input = screen.getByPlaceholderText('設定変更の内容を入力してください...');
      await userEvent.type(input, '給与計算エージェントを有効にして');
      
      const sendButton = screen.getByText('送信');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('設定変更の確認')).toBeInTheDocument();
        expect(screen.getByText('給与計算エージェントを有効化')).toBeInTheDocument();
      });
    });

    it('エラーメッセージが適切に表示される', async () => {
      mockAIService.processConfigurationIntent.mockRejectedValue(
        new Error('処理エラー')
      );

      render(
        <HybridConfigPanel
          initialMode="conversational"
          currentConfig={{}}
          userId="user123"
        />
      );

      const input = screen.getByPlaceholderText('設定変更の内容を入力してください...');
      await userEvent.type(input, '無効なコマンド');
      
      const sendButton = screen.getByText('送信');
      await userEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument();
      });
    });
  });

  describe('設定変更の適用', () => {
    it('設定変更が正常に適用される', async () => {
      const configChanges = [{
        path: 'agents.payroll.enabled',
        oldValue: false,
        newValue: true,
        description: '給与計算エージェントを有効化'
      }];

      mockAIService.processConfigurationIntent.mockResolvedValue({
        message: '設定変更を確認してください',
        configChanges
      });

      mockAIService.applyConfigChange.mockResolvedValue(undefined);

      render(
        <HybridConfigPanel
          initialMode="conversational"
          currentConfig={{}}
          userId="user123"
          onConfigChange={mockOnConfigChange}
        />
      );

      // メッセージ送信
      const input = screen.getByPlaceholderText('設定変更の内容を入力してください...');
      await userEvent.type(input, '給与計算エージェントを有効にして');
      await userEvent.click(screen.getByText('送信'));

      // 確認ダイアログで適用
      await waitFor(() => {
        expect(screen.getByText('設定変更の確認')).toBeInTheDocument();
      });
      
      const applyButton = screen.getByText('適用する');
      await userEvent.click(applyButton);

      await waitFor(() => {
        expect(mockAIService.applyConfigChange).toHaveBeenCalledWith({
          path: 'agents.payroll.enabled',
          value: true,
          userId: 'user123',
          reason: expect.stringContaining('AI会話による変更')
        });

        expect(mockAuditService.log).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: 'configuration',
            action: 'update',
            userId: 'user123'
          })
        );

        expect(mockOnConfigChange).toHaveBeenCalled();
      });
    });
  });

  describe('会話履歴', () => {
    it('会話履歴ダイアログが正常に表示される', async () => {
      render(
        <HybridConfigPanel
          initialMode="conversational"
          currentConfig={{}}
          userId="user123"
        />
      );

      const historyButton = screen.getByLabelText('会話履歴');
      await userEvent.click(historyButton);

      expect(screen.getByText('会話履歴')).toBeInTheDocument();
      expect(screen.getByText(/設定の変更をお手伝いします/)).toBeInTheDocument();
    });
  });

  describe('ハイブリッドモード', () => {
    it('GUI と会話型の両方が表示される', () => {
      render(
        <HybridConfigPanel
          initialMode="hybrid"
          currentConfig={{}}
          userId="user123"
        />
      );

      expect(screen.getByText('GUI設定')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('設定変更の内容を入力してください...')).toBeInTheDocument();
    });
  });

  describe('パフォーマンス', () => {
    it('大量のメッセージでも適切にスクロールする', async () => {
      render(
        <HybridConfigPanel
          initialMode="conversational"
          currentConfig={{}}
          userId="user123"
        />
      );

      // 複数のメッセージを送信
      for (let i = 0; i < 10; i++) {
        mockAIService.processConfigurationIntent.mockResolvedValue({
          message: `応答 ${i}`,
          configChanges: []
        });

        const input = screen.getByPlaceholderText('設定変更の内容を入力してください...');
        await userEvent.type(input, `メッセージ ${i}`);
        await userEvent.click(screen.getByText('送信'));

        await waitFor(() => {
          expect(screen.getByText(`応答 ${i}`)).toBeInTheDocument();
        });
      }

      // スクロール位置の確認（実装では実際のスクロール位置をチェック）
      const messages = screen.getAllByRole('listitem');
      expect(messages.length).toBeGreaterThan(10);
    });
  });
});

describe('ConversationalAIService', () => {
  let service: ConversationalAIService;

  beforeEach(() => {
    service = new ConversationalAIService();
  });

  describe('意図解析', () => {
    it('有効化の意図を正しく認識する', async () => {
      const testCases = [
        '給与計算エージェントを有効にして',
        'payrollエージェントをオンにする',
        '経費処理を使えるようにして'
      ];

      for (const message of testCases) {
        const result = await service.processMessage(message, {
          currentConfig: {},
          userRole: 'admin',
          permissions: ['all'],
          previousActions: []
        });

        expect(result.success).toBe(true);
        expect(result.configChanges).toBeDefined();
        expect(result.configChanges!.length).toBeGreaterThan(0);
      }
    });

    it('スケジュール設定の意図を正しく認識する', async () => {
      const result = await service.processMessage(
        '毎日午前9時にバックアップを実行して',
        {
          currentConfig: {},
          userRole: 'admin',
          permissions: ['all'],
          previousActions: []
        }
      );

      expect(result.success).toBe(true);
      expect(result.configChanges).toBeDefined();
      expect(result.configChanges![0].path).toContain('schedules');
    });

    it('不明な意図の場合は適切なメッセージを返す', async () => {
      const result = await service.processMessage(
        'これは意味不明なメッセージです',
        {
          currentConfig: {},
          userRole: 'admin',
          permissions: ['all'],
          previousActions: []
        }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('理解できませんでした');
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.length).toBeGreaterThan(0);
    });
  });

  describe('エンティティ抽出', () => {
    it('エージェント名を正しく抽出・正規化する', async () => {
      const testCases = [
        { input: '給与計算エージェント', expected: 'payroll' },
        { input: '勤怠', expected: 'attendance' },
        { input: 'expense agent', expected: 'expense' }
      ];

      for (const testCase of testCases) {
        const result = await service.processMessage(
          `${testCase.input}を有効にして`,
          {
            currentConfig: {},
            userRole: 'admin',
            permissions: ['all'],
            previousActions: []
          }
        );

        expect(result.configChanges![0].path).toContain(testCase.expected);
      }
    });
  });

  describe('設定変更の生成', () => {
    it('適切な設定変更オブジェクトを生成する', async () => {
      const result = await service.processMessage(
        '給与計算エージェントを有効にして',
        {
          currentConfig: {
            agents: {
              payroll: { enabled: false }
            }
          },
          userRole: 'admin',
          permissions: ['all'],
          previousActions: []
        }
      );

      const change = result.configChanges![0];
      expect(change).toEqual({
        path: 'agents.payroll.enabled',
        oldValue: false,
        newValue: true,
        description: expect.stringContaining('給与計算')
      });
    });
  });

  describe('会話履歴分析', () => {
    it('会話履歴から統計情報を生成する', () => {
      const messages = [
        { role: 'user', content: 'エージェントを有効にして', timestamp: new Date() },
        { role: 'assistant', content: '完了しました', timestamp: new Date(), status: 'success' },
        { role: 'user', content: 'スケジュール設定', timestamp: new Date() },
        { role: 'assistant', content: 'エラー', timestamp: new Date(), status: 'error' }
      ];

      const analysis = service.analyzeConversationHistory(messages);

      expect(analysis.successRate).toBe(0.5);
      expect(analysis.commonIntents).toBeDefined();
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });
  });
});