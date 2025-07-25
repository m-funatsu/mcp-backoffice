/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * AI会話型設定インターフェース
 * 
 * 自然言語での設定変更指示を自動実行し、制御性と利便性を両立
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Avatar,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { ConfigurationIntent, ConfigurationAction, ChatMessage } from '../types';
import { AIConfigurationService } from '../services/AIConfigurationService';

interface ConfigurationSuggestion {
  id: string;
  title: string;
  description: string;
  category: 'security' | 'performance' | 'integration' | 'agent';
  action: () => void;
}

export const AIConfigurationPanel: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<ConfigurationSuggestion[]>([]);
  const [expertMode, setExpertMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const aiConfigService = new AIConfigurationService();

  // 初期メッセージとサジェスチョン
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: '1',
      role: 'assistant',
      content: 'AI設定アシスタントです。自然な日本語で設定変更をお伝えください。例：「経費申請の承認しきい値を10万円に変更して」「コンプライアンスアラートの感度を高くして」',
      timestamp: new Date(),
      status: 'success',
    };
    setMessages([welcomeMessage]);

    // サジェスチョンの設定
    setSuggestions([
      {
        id: '1',
        title: 'セキュリティ強化',
        description: 'パスワードポリシーを強化し、2要素認証を有効化',
        category: 'security',
        action: () => handleSuggestion('セキュリティを強化して、パスワードポリシーを厳しくして'),
      },
      {
        id: '2',
        title: 'AIエージェントの最適化',
        description: '各エージェントのパフォーマンスを分析し最適化',
        category: 'agent',
        action: () => handleSuggestion('AIエージェントのパフォーマンスを最適化して'),
      },
      {
        id: '3',
        title: '通知設定の見直し',
        description: '重要度に応じた通知頻度の自動調整',
        category: 'performance',
        action: () => handleSuggestion('通知が多すぎるので、重要なものだけに絞って'),
      },
    ]);
  }, []);

  // チャット画面の自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSuggestion = (suggestion: string) => {
    setInputValue(suggestion);
    handleSend(suggestion);
  };

  const handleSend = async (message?: string) => {
    const userMessage = message || inputValue.trim();
    if (!userMessage) return;

    // ユーザーメッセージを追加
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // AI設定サービスで意図を解析
      const intent = await aiConfigService.analyzeIntent(userMessage);
      
      // 意図の確認メッセージ
      const confirmMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateConfirmationMessage(intent),
        timestamp: new Date(),
        actions: intent.actions,
        requiresConfirmation: intent.confidence < 0.8 || intent.riskLevel === 'high',
      };
      setMessages(prev => [...prev, confirmMsg]);

      // 高信頼度・低リスクの場合は自動実行
      if (intent.confidence >= 0.8 && intent.riskLevel !== 'high') {
        await executeActions(intent.actions);
      }
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateConfirmationMessage = (intent: ConfigurationIntent): string => {
    const actionDescriptions = intent.actions.map(action => {
      switch (action.type) {
        case 'update_threshold':
          return `${action.target}の閾値を${action.value}に変更`;
        case 'toggle_feature':
          return `${action.target}を${action.value ? '有効化' : '無効化'}`;
        case 'update_schedule':
          return `${action.target}のスケジュールを${action.value}に変更`;
        case 'update_policy':
          return `${action.target}ポリシーを更新`;
        default:
          return action.description || '設定を変更';
      }
    });

    let message = `以下の変更を実行します：\n${actionDescriptions.join('\n')}`;
    
    if (intent.confidence < 0.8) {
      message = `理解度: ${Math.round(intent.confidence * 100)}%\n\n${message}\n\nこの理解で正しいですか？`;
    }
    
    if (intent.riskLevel === 'high') {
      message += '\n\n⚠️ この変更は影響が大きいため、確認が必要です。';
    }

    return message;
  };

  const executeActions = async (actions: ConfigurationAction[]) => {
    const resultsMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'success',
    };

    try {
      const results = await aiConfigService.executeActions(actions);
      const successCount = results.filter(r => r.success).length;
      
      if (successCount === results.length) {
        resultsMsg.content = `✅ すべての変更が正常に適用されました。（${successCount}件）`;
      } else {
        resultsMsg.content = `⚠️ ${successCount}/${results.length}件の変更が適用されました。`;
        resultsMsg.status = 'warning';
        
        const failures = results.filter(r => !r.success);
        if (failures.length > 0) {
          resultsMsg.content += '\n\n失敗した項目:\n' + 
            failures.map(f => `- ${f.action.target}: ${f.error}`).join('\n');
        }
      }
    } catch (error) {
      resultsMsg.content = `❌ 変更の適用中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`;
      resultsMsg.status = 'error';
    }

    setMessages(prev => [...prev, resultsMsg]);
  };

  const handleConfirmAction = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message?.actions) {
      await executeActions(message.actions);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    
    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          mb: 2,
        }}
      >
        <Card
          sx={{
            maxWidth: '70%',
            bgcolor: isUser ? 'primary.main' : 'background.paper',
            color: isUser ? 'primary.contrastText' : 'text.primary',
          }}
          elevation={isUser ? 0 : 1}
        >
          <CardContent>
            <Box display="flex" alignItems="center" mb={1}>
              <Avatar
                sx={{
                  width: 24,
                  height: 24,
                  mr: 1,
                  bgcolor: isUser ? 'primary.dark' : 'secondary.main',
                }}
              >
                {isUser ? 'U' : <AIIcon sx={{ fontSize: 16 }} />}
              </Avatar>
              <Typography variant="caption" color={isUser ? 'inherit' : 'text.secondary'}>
                {isUser ? 'あなた' : 'AI設定アシスタント'}
              </Typography>
              <Typography variant="caption" sx={{ ml: 'auto' }}>
                {message.timestamp.toLocaleTimeString()}
              </Typography>
            </Box>
            
            <Typography variant="body2" style={{ whiteSpace: 'pre-line' }}>
              {message.content}
            </Typography>

            {message.requiresConfirmation && message.actions && (
              <Box mt={2}>
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={() => handleConfirmAction(message.id)}
                  sx={{ mr: 1 }}
                >
                  実行
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  color="inherit"
                >
                  キャンセル
                </Button>
              </Box>
            )}

            {message.status && (
              <Box mt={1}>
                <Chip
                  size="small"
                  icon={
                    message.status === 'success' ? <CheckIcon /> :
                    message.status === 'warning' ? <WarningIcon /> :
                    message.status === 'error' ? <WarningIcon /> :
                    <InfoIcon />
                  }
                  label={
                    message.status === 'success' ? '完了' :
                    message.status === 'warning' ? '警告' :
                    message.status === 'error' ? 'エラー' :
                    '情報'
                  }
                  color={
                    message.status === 'success' ? 'success' :
                    message.status === 'warning' ? 'warning' :
                    message.status === 'error' ? 'error' :
                    'info'
                  }
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
          <AIIcon sx={{ mr: 1 }} />
          AI会話型設定インターフェース
        </Typography>
        <Typography variant="body2" color="text.secondary">
          自然な日本語で設定変更を指示できます
        </Typography>
        
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={expertMode}
                onChange={(e) => setExpertMode(e.target.checked)}
                size="small"
              />
            }
            label="エキスパートモード"
          />
          <Tooltip title="変更履歴">
            <IconButton size="small" onClick={() => setShowHistory(!showHistory)}>
              <HistoryIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="ヘルプ">
            <IconButton size="small">
              <HelpIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* サジェスチョン */}
      {messages.length === 1 && (
        <Paper sx={{ m: 2, p: 2 }} elevation={0}>
          <Typography variant="subtitle2" gutterBottom>
            よく使われる設定変更
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {suggestions.map(suggestion => (
              <Chip
                key={suggestion.id}
                label={suggestion.title}
                onClick={() => suggestion.action()}
                color="primary"
                variant="outlined"
                icon={
                  suggestion.category === 'security' ? <SecurityIcon /> :
                  suggestion.category === 'agent' ? <AIIcon /> :
                  <SettingsIcon />
                }
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* チャット履歴 */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {messages.map(renderMessage)}
        {isProcessing && <LinearProgress sx={{ mt: 2 }} />}
        <div ref={chatEndRef} />
      </Box>

      {/* 入力エリア */}
      <Paper sx={{ p: 2, borderTop: 1, borderColor: 'divider' }} elevation={3}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="設定変更を日本語で入力してください..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isProcessing}
            multiline
            maxRows={3}
            size="small"
          />
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isProcessing}
            sx={{ minWidth: 100 }}
            startIcon={<SendIcon />}
          >
            送信
          </Button>
        </Box>
        
        {expertMode && (
          <Alert severity="info" sx={{ mt: 1 }}>
            エキスパートモード: 詳細な設定パラメータを直接指定できます
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default AIConfigurationPanel;