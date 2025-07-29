/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * 会話型設定コンポーネント - 自然言語による設定変更
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
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as AIIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Preview as PreviewIcon,
  Undo as UndoIcon,
  Help as HelpIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { ConfigurationIntent, ConfigurationAction, ChatMessage } from '../types';
import { AIConfigurationService } from '../services/AIConfigurationService';
import { AuditLogService } from '../services/AuditLogService';

interface ConfigurationChange {
  id: string;
  timestamp: Date;
  description: string;
  status: 'pending' | 'applied' | 'reverted';
  affectedItems: string[];
  rollbackAvailable: boolean;
}

interface ConversationalConfigProps {
  onConfigurationChange?: (changes: ConfigurationAction[]) => void;
  expertMode?: boolean;
}

export const ConversationalConfig: React.FC<ConversationalConfigProps> = ({
  onConfigurationChange,
  expertMode = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentChanges, setRecentChanges] = useState<ConfigurationChange[]>([]);
  const [showChanges, setShowChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewActions, setPreviewActions] = useState<ConfigurationAction[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const aiConfigService = new AIConfigurationService();
  const auditLogService = new AuditLogService();

  // 初期化
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: '1',
      role: 'assistant',
      content: 'こんにちは！設定変更をお手伝いします。どのような変更をご希望ですか？\n\n例:\n• 「営業部門に経費承認権限を付与して」\n• 「AIエージェントの感度を高めに設定」\n• 「週次レポートの配信時刻を月曜9時に変更」',
      timestamp: new Date(),
      status: 'success',
    };
    setMessages([welcomeMessage]);
    loadRecentChanges();
  }, []);

  // チャット画面の自動スクロール
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 最近の変更履歴を読み込み
  const loadRecentChanges = async () => {
    try {
      const logs = await auditLogService.getRecentLogs(5);
      const changes: ConfigurationChange[] = logs.map(log => ({
        id: log.id,
        timestamp: new Date(log.timestamp),
        description: log.description,
        status: 'applied' as const,
        affectedItems: log.affectedResources || [],
        rollbackAvailable: true,
      }));
      setRecentChanges(changes);
    } catch (error) {
      console.error('Failed to load recent changes:', error);
    }
  };

  // メッセージ送信処理
  const handleSend = async () => {
    const userMessage = inputValue.trim();
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
      // 意図解析
      const intent = await aiConfigService.analyzeIntent(userMessage);
      
      // 理解度が低い場合は確認ステップを表示
      if (intent.confidence < 0.7) {
        await handleLowConfidenceIntent(intent);
      } else if (intent.riskLevel === 'high' || expertMode) {
        // 高リスクまたはエキスパートモードでは詳細確認
        await handleDetailedConfirmation(intent);
      } else {
        // 通常の確認と実行
        await handleNormalExecution(intent);
      }
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `申し訳ございません。エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 低信頼度の意図処理
  const handleLowConfidenceIntent = async (intent: ConfigurationIntent) => {
    const clarificationMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `理解度: ${Math.round(intent.confidence * 100)}%\n\nご要望を正しく理解できているか確認させてください。以下の解釈で正しいでしょうか？\n\n${generateIntentSummary(intent)}\n\n正しい場合は「はい」、違う場合は詳細を教えてください。`,
      timestamp: new Date(),
      status: 'info',
      requiresConfirmation: true,
      actions: intent.actions,
    };
    setMessages(prev => [...prev, clarificationMsg]);
  };

  // 詳細確認処理（エキスパートモード）
  const handleDetailedConfirmation = async (intent: ConfigurationIntent) => {
    setPreviewActions(intent.actions);
    setShowPreview(true);
    setActiveStep(0);
    
    const confirmMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '詳細な変更内容を確認画面で表示しています。各ステップを確認してから実行してください。',
      timestamp: new Date(),
      status: 'info',
    };
    setMessages(prev => [...prev, confirmMsg]);
  };

  // 通常の実行処理
  const handleNormalExecution = async (intent: ConfigurationIntent) => {
    const confirmMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `以下の変更を実行します：\n\n${generateActionSummary(intent.actions)}`,
      timestamp: new Date(),
      requiresConfirmation: intent.riskLevel === 'medium',
      actions: intent.actions,
    };
    setMessages(prev => [...prev, confirmMsg]);

    // 低リスクの場合は自動実行
    if (intent.riskLevel === 'low') {
      await executeActions(intent.actions);
    }
  };

  // 意図のサマリー生成
  const generateIntentSummary = (intent: ConfigurationIntent): string => {
    const categories = [...new Set(intent.actions.map(a => a.category))];
    const targets = [...new Set(intent.actions.map(a => a.target))];
    
    return `カテゴリ: ${categories.join(', ')}\n対象: ${targets.join(', ')}\n変更数: ${intent.actions.length}件`;
  };

  // アクションのサマリー生成
  const generateActionSummary = (actions: ConfigurationAction[]): string => {
    return actions.map((action, index) => {
      const icon = action.riskLevel === 'high' ? '⚠️' : 
                   action.riskLevel === 'medium' ? '⚡' : '✓';
      return `${icon} ${index + 1}. ${action.description || action.type}`;
    }).join('\n');
  };

  // アクション実行
  const executeActions = async (actions: ConfigurationAction[]) => {
    setIsProcessing(true);
    const executionMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '変更を適用しています...',
      timestamp: new Date(),
      status: 'info',
    };
    setMessages(prev => [...prev, executionMsg]);

    try {
      const results = await aiConfigService.executeActions(actions);
      const successCount = results.filter(r => r.success).length;
      
      // 実行結果メッセージ
      const resultMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: successCount === results.length
          ? `✅ すべての変更が正常に適用されました（${successCount}件）`
          : `⚠️ ${successCount}/${results.length}件の変更が適用されました`,
        timestamp: new Date(),
        status: successCount === results.length ? 'success' : 'warning',
      };
      setMessages(prev => [...prev, resultMsg]);

      // 変更履歴を更新
      const change: ConfigurationChange = {
        id: Date.now().toString(),
        timestamp: new Date(),
        description: actions.map(a => a.description).join(', '),
        status: 'applied',
        affectedItems: actions.map(a => a.target),
        rollbackAvailable: true,
      };
      setRecentChanges(prev => [change, ...prev].slice(0, 5));

      // コールバック呼び出し
      if (onConfigurationChange) {
        onConfigurationChange(actions);
      }
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `❌ エラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 変更のロールバック
  const handleRollback = async (changeId: string) => {
    const change = recentChanges.find(c => c.id === changeId);
    if (!change) return;

    setIsProcessing(true);
    try {
      // ロールバック処理（実際の実装では適切なAPIを呼び出す）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const rollbackMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ 変更をロールバックしました: ${change.description}`,
        timestamp: new Date(),
        status: 'success',
      };
      setMessages(prev => [...prev, rollbackMsg]);
      
      // 変更履歴を更新
      setRecentChanges(prev => 
        prev.map(c => c.id === changeId ? { ...c, status: 'reverted' as const } : c)
      );
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'ロールバックに失敗しました',
        timestamp: new Date(),
        status: 'error',
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // メッセージの確認処理
  const handleConfirmAction = async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message?.actions) {
      await executeActions(message.actions);
    }
  };

  // プレビューダイアログのステップ実行
  const handlePreviewExecute = async () => {
    setShowPreview(false);
    await executeActions(previewActions);
  };

  // メッセージのレンダリング
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
            maxWidth: '75%',
            bgcolor: isUser ? 'primary.main' : 'background.paper',
            color: isUser ? 'primary.contrastText' : 'text.primary',
          }}
          elevation={isUser ? 0 : 1}
        >
          <CardContent>
            <Box display="flex" alignItems="center" mb={1}>
              <Avatar
                sx={{
                  width: 28,
                  height: 28,
                  mr: 1,
                  bgcolor: isUser ? 'primary.dark' : 'secondary.main',
                }}
              >
                {isUser ? 'あ' : <AIIcon sx={{ fontSize: 18 }} />}
              </Avatar>
              <Typography variant="body2" fontWeight="bold">
                {isUser ? 'あなた' : 'AI設定アシスタント'}
              </Typography>
              <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.7 }}>
                {message.timestamp.toLocaleTimeString('ja-JP')}
              </Typography>
            </Box>
            
            <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
              {message.content}
            </Typography>

            {message.requiresConfirmation && message.actions && (
              <Box mt={2} display="flex" gap={1}>
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={() => handleConfirmAction(message.id)}
                >
                  実行する
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
                    message.status === 'warning' ? '一部完了' :
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
    <Box sx={{ height: '100%', display: 'flex' }}>
      {/* メインチャットエリア */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
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
              placeholder="設定変更の内容を自然な日本語で入力してください..."
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
              onClick={handleSend}
              disabled={!inputValue.trim() || isProcessing}
              sx={{ minWidth: 100 }}
              startIcon={<SendIcon />}
            >
              送信
            </Button>
          </Box>
          
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Tooltip title="ヘルプとサンプル">
              <IconButton size="small">
                <HelpIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="変更履歴">
              <IconButton 
                size="small" 
                onClick={() => setShowChanges(!showChanges)}
                color={showChanges ? 'primary' : 'default'}
              >
                <TimelineIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      </Box>

      {/* サイドパネル: 変更履歴 */}
      <Collapse in={showChanges} orientation="horizontal">
        <Paper sx={{ width: 300, height: '100%', borderLeft: 1, borderColor: 'divider' }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              最近の変更履歴
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <List dense>
              {recentChanges.map((change) => (
                <ListItem key={change.id}>
                  <ListItemIcon>
                    <Chip
                      size="small"
                      label={change.status === 'applied' ? '適用済' : '取消済'}
                      color={change.status === 'applied' ? 'success' : 'default'}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={change.description}
                    secondary={
                      <>
                        <Typography variant="caption" display="block">
                          {change.timestamp.toLocaleString('ja-JP')}
                        </Typography>
                        <Typography variant="caption" display="block">
                          影響: {change.affectedItems.join(', ')}
                        </Typography>
                      </>
                    }
                  />
                  {change.rollbackAvailable && change.status === 'applied' && (
                    <Tooltip title="ロールバック">
                      <IconButton
                        size="small"
                        onClick={() => handleRollback(change.id)}
                        disabled={isProcessing}
                      >
                        <UndoIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </ListItem>
              ))}
            </List>
          </Box>
        </Paper>
      </Collapse>

      {/* プレビューダイアログ */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <PreviewIcon />
            変更内容の詳細確認
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            以下の変更を順番に実行します。各ステップを確認してください。
          </Alert>
          
          <Stepper activeStep={activeStep} orientation="vertical">
            {previewActions.map((action, index) => (
              <Step key={index}>
                <StepLabel
                  optional={
                    <Typography variant="caption">
                      リスクレベル: {action.riskLevel || 'low'}
                    </Typography>
                  }
                >
                  {action.description || action.type}
                </StepLabel>
                <StepContent>
                  <Box>
                    <Typography variant="body2" paragraph>
                      カテゴリ: {action.category}<br />
                      対象: {action.target}<br />
                      {action.value && `値: ${JSON.stringify(action.value)}`}
                    </Typography>
                    {action.validation && (
                      <Alert severity="warning" sx={{ mb: 1 }}>
                        検証: {action.validation.message}
                      </Alert>
                    )}
                    <Box sx={{ mb: 2 }}>
                      <Button
                        variant="contained"
                        onClick={() => setActiveStep(activeStep + 1)}
                        sx={{ mt: 1, mr: 1 }}
                        size="small"
                      >
                        次へ
                      </Button>
                      {index > 0 && (
                        <Button
                          onClick={() => setActiveStep(activeStep - 1)}
                          sx={{ mt: 1, mr: 1 }}
                          size="small"
                        >
                          戻る
                        </Button>
                      )}
                    </Box>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
          
          {activeStep === previewActions.length && (
            <Alert severity="success" sx={{ mt: 2 }}>
              すべての変更内容を確認しました。実行ボタンをクリックして変更を適用してください。
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>キャンセル</Button>
          <Button
            onClick={handlePreviewExecute}
            variant="contained"
            color="primary"
            disabled={activeStep !== previewActions.length}
            startIcon={<CheckIcon />}
          >
            実行
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConversationalConfig;