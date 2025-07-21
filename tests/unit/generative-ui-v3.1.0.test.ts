import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GenerativeUIEngine } from '../../src/generative-ui-engine-v3.1.0.js';
import type { UserContext, DeviceInfo, UserFeedback } from '../../src/generative-ui-engine-v3.1.0.js';

describe('ジェネレーティブUIエンジン v3.1.0', () => {
  let uiEngine: GenerativeUIEngine;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn()
    };
    
    uiEngine = new GenerativeUIEngine(mockDb);
  });

  afterEach(() => {
    // クリーンアップ
    uiEngine.removeAllListeners();
  });

  describe('自然言語理解・UI生成', () => {
    const mockUserContext: UserContext = {
      userId: 'user001',
      role: 'manager',
      permissions: ['view_payroll', 'create_reports'],
      preferences: {
        language: 'ja',
        theme: 'light',
        chartPreferences: {
          defaultType: 'bar',
          colorScheme: 'blue'
        },
        layoutPreferences: {
          density: 'comfortable',
          sidebarPosition: 'left'
        },
        accessibilitySettings: {
          fontSize: 'medium',
          highContrast: false,
          reducedMotion: false,
          screenReader: false
        }
      }
    };

    it('給与データ表示の自然言語リクエストを正しく処理する', async () => {
      const userInput = '先月の給与データを表示して';
      
      const generatedUI = await uiEngine.generateUI(userInput, mockUserContext);

      expect(generatedUI).toBeDefined();
      expect(generatedUI.intent.primary).toBe('view_payroll');
      expect(generatedUI.intent.confidence).toBeGreaterThan(0.5);
      expect(generatedUI.components).toHaveLength(1);
      expect(generatedUI.components[0].type).toBe('kpi');
      expect(generatedUI.layout.structure).toBe('grid');
      expect(generatedUI.metadata.generationTime).toBeGreaterThan(0);
    });

    it('トレンド分析リクエストで適切なチャートコンポーネントを生成する', async () => {
      const userInput = '残業時間のトレンドを分析したい';
      
      const generatedUI = await uiEngine.generateUI(userInput, mockUserContext);

      expect(generatedUI.intent.primary).toBe('analyze_trends');
      expect(generatedUI.components).toHaveLength(1);
      expect(generatedUI.components[0].type).toBe('chart');
      expect(generatedUI.components[0].configuration.chart?.type).toBe('bar');
      expect(generatedUI.components[0].title).toBe('トレンド分析');
    });

    it('レポート作成リクエストでフォームコンポーネントを生成する', async () => {
      const userInput = '月次レポートを作成して';
      
      const generatedUI = await uiEngine.generateUI(userInput, mockUserContext);

      expect(generatedUI.intent.primary).toBe('create_report');
      expect(generatedUI.components).toHaveLength(1);
      expect(generatedUI.components[0].type).toBe('form');
      expect(generatedUI.components[0].configuration.form?.fields).toBeDefined();
      expect(generatedUI.components[0].configuration.form?.submitAction).toBe('generate_report');
    });

    it('曖昧なリクエストで適切なクラリフィケーションを返す', async () => {
      const userInput = 'データを見たい';
      
      const generatedUI = await uiEngine.generateUI(userInput, mockUserContext);

      expect(generatedUI.metadata.requiresClarification).toBe(true);
      expect(generatedUI.layout.regions).toHaveLength(1);
      expect(generatedUI.layout.regions[0].components[0].type).toBe('form');
    });
  });

  describe('レスポンシブ・アクセシビリティ対応', () => {
    const mockUserContext: UserContext = {
      userId: 'user002',
      role: 'employee',
      permissions: ['view_payroll'],
      preferences: {
        language: 'ja',
        theme: 'dark',
        chartPreferences: {
          defaultType: 'line',
          colorScheme: 'green'
        },
        layoutPreferences: {
          density: 'compact',
          sidebarPosition: 'right'
        },
        accessibilitySettings: {
          fontSize: 'large',
          highContrast: true,
          reducedMotion: true,
          screenReader: true
        }
      }
    };

    it('モバイルデバイスで適切なレイアウトを生成する', async () => {
      const userInput = '給与明細を確認したい';
      const deviceInfo: DeviceInfo = {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0)',
        screenWidth: 375,
        screenHeight: 812,
        deviceType: 'mobile',
        touchCapable: true
      };

      const generatedUI = await uiEngine.generateUI(userInput, mockUserContext, deviceInfo);

      expect(generatedUI.layout.structure).toBe('flex');
      expect(generatedUI.layout.regions[0].constraints.minWidth).toBe(320);
      expect(generatedUI.metadata.deviceInfo).toEqual(deviceInfo);
    });

    it('アクセシビリティ設定を適切に適用する', async () => {
      const userInput = '給与データを表示';

      const generatedUI = await uiEngine.generateUI(userInput, mockUserContext);

      // ハイコントラスト対応
      expect(generatedUI.components[0].styling.theme).toBe('high-contrast');
      
      // モーション減少対応
      expect(generatedUI.layout.animations[0].duration).toBe(0);
      expect(generatedUI.layout.animations[0].enabled).toBe(false);
      
      // スクリーンリーダー対応
      expect(generatedUI.layout.accessibility.screenReader).toBe(true);
      expect(generatedUI.components[0].accessibility.enabled).toBe(true);
    });

    it('ユーザーの チャート設定を反映する', async () => {
      const userInput = 'エンゲージメントの推移を見せて';

      const generatedUI = await uiEngine.generateUI(userInput, mockUserContext);

      expect(generatedUI.components).toHaveLength(1);
      if (generatedUI.components[0].configuration.chart) {
        expect(generatedUI.components[0].configuration.chart.type).toBe('line');
      }
      expect(generatedUI.components[0].styling.theme).toBe('high-contrast');
    });
  });

  describe('対話型クラリフィケーション', () => {
    const mockUserContext: UserContext = {
      userId: 'user003',
      role: 'admin',
      permissions: ['view_all', 'create_reports', 'manage_users'],
      preferences: {
        language: 'ja',
        theme: 'light',
        chartPreferences: {
          defaultType: 'bar',
          colorScheme: 'blue'
        },
        layoutPreferences: {
          density: 'comfortable',
          sidebarPosition: 'left'
        },
        accessibilitySettings: {
          fontSize: 'medium',
          highContrast: false,
          reducedMotion: false,
          screenReader: false
        }
      }
    };

    it('クラリフィケーション後の詳細UI生成を処理する', async () => {
      const originalInput = 'データを表示して';
      const userResponse = '給与データです 2024年1月';

      const generatedUI = await uiEngine.clarifyIntent(originalInput, userResponse, mockUserContext);

      expect(generatedUI.intent.primary).toBe('view_payroll');
      expect(generatedUI.components).toHaveLength(1);
      expect(generatedUI.components[0].type).toBe('kpi');
    });
  });

  describe('コンポーネント動的更新', () => {
    it('データソース更新を正しく処理する', async () => {
      const updatedComponent = await uiEngine.updateComponent(
        'ui_123',
        'component_456',
        'data',
        { newDataSource: 'updated_payroll_data' }
      );

      expect(updatedComponent).toBeDefined();
      expect(updatedComponent.id).toBe('component_456');
      expect(updatedComponent.type).toBe('chart');
      expect(updatedComponent.title).toBe('Updated Component');
    });

    it('スタイル更新を正しく処理する', async () => {
      const updatedComponent = await uiEngine.updateComponent(
        'ui_123',
        'component_456',
        'style',
        { theme: 'dark', color: 'red' }
      );

      expect(updatedComponent).toBeDefined();
      expect(updatedComponent.configuration).toEqual({ theme: 'dark', color: 'red' });
    });
  });

  describe('ユーザーフィードバック学習', () => {
    it('ユーザーフィードバックを正しく記録する', async () => {
      const feedback: UserFeedback = {
        userId: 'user001',
        rating: 4,
        feedbackType: 'helpful',
        comments: 'とても使いやすいUIでした'
      };

      await uiEngine.recordUserFeedback('ui_123', feedback);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ui_feedback'),
        expect.arrayContaining([
          'ui_123',
          'user001',
          4,
          'helpful',
          'とても使いやすいUIでした'
        ])
      );
    });
  });

  describe('エラーハンドリング・フォールバック', () => {
    it('システムエラー時にフォールバックUIを生成する', async () => {
      const mockUserContext: UserContext = {
        userId: 'test_error_user', // エラーをトリガーする特別なユーザーID
        role: 'manager',
        permissions: [],
        preferences: {
          language: 'ja',
          theme: 'light',
          chartPreferences: { defaultType: 'bar', colorScheme: 'blue' },
          layoutPreferences: { density: 'comfortable', sidebarPosition: 'left' },
          accessibilitySettings: {
            fontSize: 'medium',
            highContrast: false,
            reducedMotion: false,
            screenReader: false
          }
        }
      };

      const generatedUI = await uiEngine.generateUI('給与データを表示', mockUserContext);

      expect(generatedUI.intent.primary).toBe('error_fallback');
      expect(generatedUI.metadata.error).toBeDefined();
      expect(generatedUI.interactionCapabilities.clarificationMode).toBe(true);
      expect(generatedUI.layout.regions[0].components[0].type).toBe('alert');
    });

    it('低信頼度の意図に対してクラリフィケーションを要求する', async () => {
      // 非常に曖昧な入力
      const userInput = 'あれ';
      const mockUserContext: UserContext = {
        userId: 'user001',
        role: 'manager',
        permissions: [],
        preferences: {
          language: 'ja',
          theme: 'light',
          chartPreferences: { defaultType: 'bar', colorScheme: 'blue' },
          layoutPreferences: { density: 'comfortable', sidebarPosition: 'left' },
          accessibilitySettings: {
            fontSize: 'medium',
            highContrast: false,
            reducedMotion: false,
            screenReader: false
          }
        }
      };

      const generatedUI = await uiEngine.generateUI(userInput, mockUserContext);

      expect(generatedUI.metadata.requiresClarification).toBe(true);
      expect(generatedUI.interactionCapabilities.clarificationMode).toBe(true);
      expect(generatedUI.interactionCapabilities.originalInput).toBe(userInput);
    });
  });

  describe('パフォーマンス・キャッシング', () => {
    it('生成時間が許容範囲内である', async () => {
      const mockUserContext: UserContext = {
        userId: 'user001',
        role: 'manager',
        permissions: ['view_payroll'],
        preferences: {
          language: 'ja',
          theme: 'light',
          chartPreferences: { defaultType: 'bar', colorScheme: 'blue' },
          layoutPreferences: { density: 'comfortable', sidebarPosition: 'left' },
          accessibilitySettings: {
            fontSize: 'medium',
            highContrast: false,
            reducedMotion: false,
            screenReader: false
          }
        }
      };

      const startTime = Date.now();
      const generatedUI = await uiEngine.generateUI('給与データを表示', mockUserContext);
      const endTime = Date.now();

      expect(generatedUI.metadata.generationTime).toBeLessThan(500); // 500ms以内
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
    });

    it('データソースでキャッシング設定が適用される', async () => {
      const mockUserContext: UserContext = {
        userId: 'user001',
        role: 'manager',
        permissions: ['view_payroll'],
        preferences: {
          language: 'ja',
          theme: 'light',
          chartPreferences: { defaultType: 'bar', colorScheme: 'blue' },
          layoutPreferences: { density: 'comfortable', sidebarPosition: 'left' },
          accessibilitySettings: {
            fontSize: 'medium',
            highContrast: false,
            reducedMotion: false,
            screenReader: false
          }
        }
      };

      const generatedUI = await uiEngine.generateUI('給与データを表示', mockUserContext);

      expect(generatedUI.components[0].dataSource.caching.enabled).toBe(true);
      expect(generatedUI.components[0].dataSource.caching.ttl).toBeGreaterThan(0);
      expect(['memory', 'redis', 'database']).toContain(generatedUI.components[0].dataSource.caching.strategy);
    });
  });

  describe('インタラクション機能', () => {
    it('意図に応じた音声コマンドを生成する', async () => {
      const mockUserContext: UserContext = {
        userId: 'user001',
        role: 'manager',
        permissions: ['view_payroll'],
        preferences: {
          language: 'ja',
          theme: 'light',
          chartPreferences: { defaultType: 'bar', colorScheme: 'blue' },
          layoutPreferences: { density: 'comfortable', sidebarPosition: 'left' },
          accessibilitySettings: {
            fontSize: 'medium',
            highContrast: false,
            reducedMotion: false,
            screenReader: false
          }
        }
      };

      const generatedUI = await uiEngine.generateUI('給与計算を実行', mockUserContext);

      expect(generatedUI.interactionCapabilities.voiceCommands).toContain('更新');
      expect(generatedUI.interactionCapabilities.voiceCommands).toContain('給与計算');
      expect(generatedUI.interactionCapabilities.keyboardShortcuts).toHaveProperty('Ctrl+R');
      expect(generatedUI.interactionCapabilities.gestureSupport).toContain('swipe');
    });
  });

  describe('多言語・国際化対応', () => {
    it('英語ユーザーに対して適切に処理する', async () => {
      const mockUserContext: UserContext = {
        userId: 'user_en',
        role: 'manager',
        permissions: ['view_payroll'],
        preferences: {
          language: 'en',
          theme: 'light',
          chartPreferences: { defaultType: 'bar', colorScheme: 'blue' },
          layoutPreferences: { density: 'comfortable', sidebarPosition: 'left' },
          accessibilitySettings: {
            fontSize: 'medium',
            highContrast: false,
            reducedMotion: false,
            screenReader: false
          }
        }
      };

      const generatedUI = await uiEngine.generateUI('show payroll data', mockUserContext);

      expect(generatedUI).toBeDefined();
      expect(generatedUI.intent.context.preferences.language).toBe('en');
    });
  });
});