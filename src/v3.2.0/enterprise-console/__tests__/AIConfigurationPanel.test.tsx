/**
 * AI会話型設定インターフェースのテスト
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIConfigurationPanel } from '../components/AIConfigurationPanel';
import { AIConfigurationService } from '../services/AIConfigurationService';

// モックの設定
jest.mock('../services/AIConfigurationService');
jest.mock('../services/ApiClient', () => ({
  default: {
    executeConfigurationAction: jest.fn(),
    getConfigurationHistory: jest.fn(),
  },
}));

describe('AIConfigurationPanel', () => {
  let mockService: jest.Mocked<AIConfigurationService>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockService = new AIConfigurationService() as jest.Mocked<AIConfigurationService>;
  });

  describe('基本的なUI要素', () => {
    it('初期メッセージが表示される', () => {
      render(<AIConfigurationPanel />);
      
      expect(screen.getByText(/AI設定アシスタントです/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/設定変更を日本語で入力/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument();
    });

    it('サジェスチョンチップが表示される', () => {
      render(<AIConfigurationPanel />);
      
      expect(screen.getByText('セキュリティ強化')).toBeInTheDocument();
      expect(screen.getByText('AIエージェントの最適化')).toBeInTheDocument();
      expect(screen.getByText('通知設定の見直し')).toBeInTheDocument();
    });

    it('エキスパートモードの切り替えができる', () => {
      render(<AIConfigurationPanel />);
      
      const expertSwitch = screen.getByRole('checkbox', { name: /エキスパートモード/ });
      expect(expertSwitch).not.toBeChecked();
      
      fireEvent.click(expertSwitch);
      expect(expertSwitch).toBeChecked();
      expect(screen.getByText(/エキスパートモード: 詳細な設定パラメータ/)).toBeInTheDocument();
    });
  });

  describe('メッセージ送信', () => {
    it('ユーザーメッセージが送信される', async () => {
      const mockIntent = {
        originalInput: '経費申請の承認しきい値を10万円に変更して',
        normalizedInput: '経費申請 承認しきい値 10万円 変更',
        detectedIntent: 'threshold_update',
        confidence: 0.9,
        parameters: { target: '経費申請', value: 100000 },
        actions: [{
          id: 'action_1',
          type: 'update_threshold' as const,
          target: 'expense_threshold',
          value: 100000,
          description: '経費申請の閾値を100000に変更',
          validationRules: [],
        }],
        riskLevel: 'medium' as const,
      };

      mockService.analyzeIntent = jest.fn().mockResolvedValue(mockIntent);
      
      render(<AIConfigurationPanel />);
      
      const input = screen.getByPlaceholderText(/設定変更を日本語で入力/);
      const sendButton = screen.getByRole('button', { name: '送信' });
      
      await userEvent.type(input, '経費申請の承認しきい値を10万円に変更して');
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(screen.getByText('経費申請の承認しきい値を10万円に変更して')).toBeInTheDocument();
      });
      
      expect(mockService.analyzeIntent).toHaveBeenCalledWith('経費申請の承認しきい値を10万円に変更して');
    });

    it('エンターキーでメッセージが送信される', async () => {
      render(<AIConfigurationPanel />);
      
      const input = screen.getByPlaceholderText(/設定変更を日本語で入力/);
      await userEvent.type(input, 'テストメッセージ{enter}');
      
      await waitFor(() => {
        expect(screen.getByText('テストメッセージ')).toBeInTheDocument();
      });
    });

    it('空のメッセージは送信されない', () => {
      render(<AIConfigurationPanel />);
      
      const sendButton = screen.getByRole('button', { name: '送信' });
      expect(sendButton).toBeDisabled();
    });
  });

  describe('意図解析と確認', () => {
    it('高信頼度・低リスクの場合は自動実行される', async () => {
      const mockIntent = {
        originalInput: '通知を重要なものだけに絞って',
        normalizedInput: '通知 重要 絞る',
        detectedIntent: 'notification_settings',
        confidence: 0.85,
        parameters: {},
        actions: [{
          id: 'action_1',
          type: 'update_policy' as const,
          target: 'notification_filter',
          value: 'important_only',
          validationRules: [],
        }],
        riskLevel: 'low' as const,
      };

      const mockResults = [{
        action: mockIntent.actions[0],
        success: true,
        timestamp: new Date(),
      }];

      mockService.analyzeIntent = jest.fn().mockResolvedValue(mockIntent);
      mockService.executeActions = jest.fn().mockResolvedValue(mockResults);
      
      render(<AIConfigurationPanel />);
      
      const input = screen.getByPlaceholderText(/設定変更を日本語で入力/);
      await userEvent.type(input, '通知を重要なものだけに絞って{enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/すべての変更が正常に適用されました/)).toBeInTheDocument();
      });
      
      expect(mockService.executeActions).toHaveBeenCalledWith(mockIntent.actions);
    });

    it('低信頼度の場合は確認が求められる', async () => {
      const mockIntent = {
        originalInput: 'なんか変更して',
        normalizedInput: 'なんか 変更',
        detectedIntent: 'unknown',
        confidence: 0.3,
        parameters: {},
        actions: [],
        riskLevel: 'low' as const,
        suggestedAlternatives: ['もう少し具体的に指定していただけますか？'],
      };

      mockService.analyzeIntent = jest.fn().mockResolvedValue(mockIntent);
      
      render(<AIConfigurationPanel />);
      
      const input = screen.getByPlaceholderText(/設定変更を日本語で入力/);
      await userEvent.type(input, 'なんか変更して{enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/理解度: 30%/)).toBeInTheDocument();
        expect(screen.getByText(/この理解で正しいですか？/)).toBeInTheDocument();
      });
    });

    it('高リスクの変更は確認が必要', async () => {
      const mockIntent = {
        originalInput: 'セキュリティポリシーを変更して',
        normalizedInput: 'セキュリティポリシー 変更',
        detectedIntent: 'security_policy',
        confidence: 0.9,
        parameters: {},
        actions: [{
          id: 'action_1',
          type: 'update_policy' as const,
          target: 'security_policy',
          value: { level: 'enhanced' },
          validationRules: [],
        }],
        riskLevel: 'high' as const,
      };

      mockService.analyzeIntent = jest.fn().mockResolvedValue(mockIntent);
      
      render(<AIConfigurationPanel />);
      
      const input = screen.getByPlaceholderText(/設定変更を日本語で入力/);
      await userEvent.type(input, 'セキュリティポリシーを変更して{enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/この変更は影響が大きいため、確認が必要です/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '実行' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
      });
    });
  });

  describe('サジェスチョン機能', () => {
    it('サジェスチョンクリックで入力される', async () => {
      const mockIntent = {
        originalInput: 'セキュリティを強化して、パスワードポリシーを厳しくして',
        normalizedInput: 'セキュリティ 強化 パスワードポリシー 厳しく',
        detectedIntent: 'security_policy',
        confidence: 0.9,
        parameters: {},
        actions: [{
          id: 'action_1',
          type: 'update_policy' as const,
          target: 'security_policy',
          value: { passwordPolicy: 'strict' },
          validationRules: [],
        }],
        riskLevel: 'high' as const,
      };

      mockService.analyzeIntent = jest.fn().mockResolvedValue(mockIntent);
      
      render(<AIConfigurationPanel />);
      
      const securityChip = screen.getByText('セキュリティ強化');
      fireEvent.click(securityChip);
      
      await waitFor(() => {
        expect(screen.getByText('セキュリティを強化して、パスワードポリシーを厳しくして')).toBeInTheDocument();
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('APIエラーが適切に表示される', async () => {
      mockService.analyzeIntent = jest.fn().mockRejectedValue(new Error('ネットワークエラー'));
      
      render(<AIConfigurationPanel />);
      
      const input = screen.getByPlaceholderText(/設定変更を日本語で入力/);
      await userEvent.type(input, 'エラーテスト{enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/エラーが発生しました: ネットワークエラー/)).toBeInTheDocument();
      });
    });

    it('アクション実行失敗が表示される', async () => {
      const mockIntent = {
        originalInput: 'テスト設定変更',
        normalizedInput: 'テスト 設定 変更',
        detectedIntent: 'test',
        confidence: 0.9,
        parameters: {},
        actions: [{
          id: 'action_1',
          type: 'update_threshold' as const,
          target: 'test_threshold',
          value: 1000,
          validationRules: [],
        }],
        riskLevel: 'low' as const,
      };

      const mockResults = [{
        action: mockIntent.actions[0],
        success: false,
        error: '権限が不足しています',
        timestamp: new Date(),
      }];

      mockService.analyzeIntent = jest.fn().mockResolvedValue(mockIntent);
      mockService.executeActions = jest.fn().mockResolvedValue(mockResults);
      
      render(<AIConfigurationPanel />);
      
      const input = screen.getByPlaceholderText(/設定変更を日本語で入力/);
      await userEvent.type(input, 'テスト設定変更{enter}');
      
      await waitFor(() => {
        expect(screen.getByText(/0\/1件の変更が適用されました/)).toBeInTheDocument();
        expect(screen.getByText(/権限が不足しています/)).toBeInTheDocument();
      });
    });
  });

  describe('処理中の状態', () => {
    it('処理中はローディングが表示される', async () => {
      let resolveAnalyze: (value: any) => void;
      const analyzePromise = new Promise(resolve => {
        resolveAnalyze = resolve;
      });
      
      mockService.analyzeIntent = jest.fn().mockReturnValue(analyzePromise);
      
      render(<AIConfigurationPanel />);
      
      const input = screen.getByPlaceholderText(/設定変更を日本語で入力/);
      await userEvent.type(input, 'テスト{enter}');
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '送信' })).toBeDisabled();
      
      resolveAnalyze!({
        originalInput: 'テスト',
        normalizedInput: 'テスト',
        detectedIntent: 'test',
        confidence: 0.9,
        parameters: {},
        actions: [],
        riskLevel: 'low' as const,
      });
      
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });
});