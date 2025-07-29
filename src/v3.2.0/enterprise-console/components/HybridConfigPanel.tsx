/**
 * AI-OS v3.2.0 ハイブリッド設定パネル
 * Hybrid Configuration Panel
 * 
 * GUIとAI会話型設定の統合インターフェース
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Typography, 
  ToggleButton, 
  ToggleButtonGroup,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Divider,
  CircularProgress,
  Chip,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Chat as ChatIcon,
  Merge as MergeIcon,
  Send as SendIcon,
  History as HistoryIcon,
  SmartToy as AIIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { AIConfigurationService } from '../services/AIConfigurationService';
import { AuditLogService } from '../services/AuditLogService';

// ===== 型定義 =====

export interface HybridConfigPanelProps {
  initialMode?: 'gui' | 'conversational' | 'hybrid';
  onConfigChange?: (config: any) => void;
  currentConfig: any;
  userId: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  configChanges?: ConfigChange[];
  status?: 'pending' | 'success' | 'error';
}

interface ConfigChange {
  path: string;
  oldValue: any;
  newValue: any;
  description: string;
  applied: boolean;
}

interface ConversationContext {
  sessionId: string;
  messages: ConversationMessage[];
  pendingChanges: ConfigChange[];
  currentIntent?: string;
}

// ===== メインコンポーネント =====

export const HybridConfigPanel: React.FC<HybridConfigPanelProps> = ({
  initialMode = 'hybrid',
  onConfigChange,
  currentConfig,
  userId
}) => {
  const [mode, setMode] = useState<'gui' | 'conversational' | 'hybrid'>(initialMode);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<ConfigChange[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    changes: ConfigChange[];
  }>({ open: false, changes: [] });
  
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const aiService = useRef(new AIConfigurationService());
  const auditService = useRef(new AuditLogService());

  // 初期メッセージの設定
  useEffect(() => {
    const welcomeMessage: ConversationMessage = {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: 'こんにちは！設定の変更をお手伝いします。どのような設定を変更したいですか？\n\n例：\n- 「給与計算エージェントを有効にして」\n- 「承認権限の金額上限を100万円に設定」\n- 「毎日午前9時に自動バックアップを実行」',
      timestamp: new Date(),
      status: 'success'
    };
    setMessages([welcomeMessage]);
  }, []);

  // メッセージスクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * モード変更ハンドラー
   */
  const handleModeChange = (event: React.MouseEvent<HTMLElement>, newMode: string | null) => {
    if (newMode !== null) {
      setMode(newMode as any);
      
      // モード変更を監査ログに記録
      auditService.current.log({
        entityType: 'config_ui',
        entityId: 'hybrid_panel',
        action: 'mode_change',
        userId,
        changes: {
          before: { mode },
          after: { mode: newMode }
        },
        metadata: { timestamp: new Date() }
      });
    }
  };

  /**
   * メッセージ送信ハンドラー
   */
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: ConversationMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
      status: 'pending'
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // AIサービスを使用して意図を解析し、設定変更を生成
      const response = await aiService.current.processConfigurationIntent({
        message: inputValue,
        currentConfig,
        context: {
          previousMessages: messages.slice(-5), // 直近5メッセージをコンテキストとして送信
          userId,
          sessionId: `session_${Date.now()}`
        }
      });

      // AIの応答メッセージ
      const assistantMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        configChanges: response.configChanges,
        status: 'success'
      };

      setMessages(prev => [...prev, assistantMessage]);

      // 設定変更がある場合は確認ダイアログを表示
      if (response.configChanges && response.configChanges.length > 0) {
        setPendingChanges(response.configChanges);
        setConfirmDialog({
          open: true,
          changes: response.configChanges
        });
      }

    } catch (error) {
      const errorMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'すみません、リクエストの処理中にエラーが発生しました。もう一度お試しください。',
        timestamp: new Date(),
        status: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * 設定変更の適用
   */
  const applyConfigChanges = async (changes: ConfigChange[]) => {
    try {
      // 各変更を適用
      for (const change of changes) {
        await aiService.current.applyConfigChange({
          path: change.path,
          value: change.newValue,
          userId,
          reason: `AI会話による変更: ${change.description}`
        });

        // 監査ログに記録
        await auditService.current.log({
          entityType: 'configuration',
          entityId: change.path,
          action: 'update',
          userId,
          changes: {
            before: { value: change.oldValue },
            after: { value: change.newValue }
          },
          metadata: {
            method: 'conversational',
            description: change.description
          }
        });
      }

      // 成功通知
      const successMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        role: 'system',
        content: `✅ ${changes.length}件の設定変更が正常に適用されました。`,
        timestamp: new Date(),
        status: 'success'
      };
      setMessages(prev => [...prev, successMessage]);

      // 親コンポーネントに通知
      if (onConfigChange) {
        onConfigChange(currentConfig);
      }

    } catch (error) {
      const errorMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        role: 'system',
        content: '❌ 設定変更の適用中にエラーが発生しました。',
        timestamp: new Date(),
        status: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    }

    setConfirmDialog({ open: false, changes: [] });
    setPendingChanges([]);
  };

  /**
   * GUI操作を自然言語に変換
   */
  const convertGUIActionToNaturalLanguage = (action: string, params: any): string => {
    // GUI操作を自然言語の説明に変換
    const templates: Record<string, (p: any) => string> = {
      'enable_agent': (p) => `${p.agentName}エージェントを有効にしました`,
      'set_permission': (p) => `${p.role}の${p.resource}に対する${p.action}権限を設定しました`,
      'update_threshold': (p) => `${p.metric}の閾値を${p.value}に更新しました`,
      'schedule_task': (p) => `${p.taskName}を${p.schedule}に実行するようスケジュールしました`
    };

    return templates[action]?.(params) || `設定を更新しました: ${action}`;
  };

  /**
   * 会話履歴の表示
   */
  const ConversationHistory = () => (
    <Dialog
      open={showHistory}
      onClose={() => setShowHistory(false)}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <HistoryIcon />
          <Typography variant="h6">会話履歴</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <List>
          {messages.map((msg, index) => (
            <ListItem key={msg.id}>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Chip
                      label={msg.role === 'user' ? 'あなた' : msg.role === 'assistant' ? 'AI' : 'システム'}
                      size="small"
                      color={msg.role === 'user' ? 'primary' : msg.role === 'assistant' ? 'secondary' : 'default'}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(msg.timestamp).toLocaleString('ja-JP')}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box mt={1}>
                    <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </Typography>
                    {msg.configChanges && msg.configChanges.length > 0 && (
                      <Box mt={1}>
                        <Typography variant="caption" color="text.secondary">
                          提案された変更:
                        </Typography>
                        {msg.configChanges.map((change, idx) => (
                          <Chip
                            key={idx}
                            label={change.description}
                            size="small"
                            variant="outlined"
                            style={{ margin: '2px' }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                }
              />
              {index < messages.length - 1 && <Divider />}
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowHistory(false)}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );

  /**
   * 設定変更確認ダイアログ
   */
  const ConfirmChangesDialog = () => (
    <Dialog
      open={confirmDialog.open}
      onClose={() => setConfirmDialog({ open: false, changes: [] })}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>設定変更の確認</DialogTitle>
      <DialogContent>
        <Alert severity="info" style={{ marginBottom: 16 }}>
          以下の設定変更を適用しますか？
        </Alert>
        <List>
          {confirmDialog.changes.map((change, index) => (
            <ListItem key={index}>
              <ListItemText
                primary={change.description}
                secondary={
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      パス: {change.path}
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                      <Chip label={`変更前: ${JSON.stringify(change.oldValue)}`} size="small" />
                      <Typography variant="caption">→</Typography>
                      <Chip label={`変更後: ${JSON.stringify(change.newValue)}`} size="small" color="primary" />
                    </Box>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmDialog({ open: false, changes: [] })}>
          キャンセル
        </Button>
        <Button 
          onClick={() => applyConfigChanges(confirmDialog.changes)} 
          variant="contained" 
          color="primary"
        >
          適用する
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* モード切り替え */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          aria-label="設定モード"
        >
          <ToggleButton value="gui" aria-label="GUI モード">
            <SettingsIcon sx={{ mr: 1 }} />
            GUI
          </ToggleButton>
          <ToggleButton value="conversational" aria-label="会話モード">
            <ChatIcon sx={{ mr: 1 }} />
            会話型
          </ToggleButton>
          <ToggleButton value="hybrid" aria-label="ハイブリッドモード">
            <MergeIcon sx={{ mr: 1 }} />
            ハイブリッド
          </ToggleButton>
        </ToggleButtonGroup>

        <Tooltip title="会話履歴">
          <IconButton
            onClick={() => setShowHistory(true)}
            sx={{ float: 'right' }}
          >
            <HistoryIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* コンテンツエリア */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* GUI設定エリア（GUI/ハイブリッドモードで表示） */}
        {(mode === 'gui' || mode === 'hybrid') && (
          <Box 
            sx={{ 
              flex: mode === 'hybrid' ? '0 0 50%' : 1,
              p: 2,
              overflow: 'auto',
              borderRight: mode === 'hybrid' ? 1 : 0,
              borderColor: 'divider'
            }}
          >
            <Typography variant="h6" gutterBottom>
              GUI設定
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              設定項目をクリックして直接変更できます
            </Alert>
            {/* ここに既存のGUI設定コンポーネントを配置 */}
          </Box>
        )}

        {/* 会話エリア（会話型/ハイブリッドモードで表示） */}
        {(mode === 'conversational' || mode === 'hybrid') && (
          <Box 
            sx={{ 
              flex: mode === 'hybrid' ? '0 0 50%' : 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* メッセージ表示エリア */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              <List>
                {messages.map((message) => (
                  <ListItem
                    key={message.id}
                    sx={{
                      flexDirection: 'column',
                      alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                      mb: 2
                    }}
                  >
                    <Paper
                      elevation={1}
                      sx={{
                        p: 2,
                        maxWidth: '80%',
                        backgroundColor: 
                          message.role === 'user' ? 'primary.light' :
                          message.role === 'assistant' ? 'grey.100' :
                          'info.light',
                        color: message.role === 'user' ? 'primary.contrastText' : 'text.primary'
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        {message.role === 'assistant' && <AIIcon fontSize="small" />}
                        <Typography variant="caption">
                          {new Date(message.timestamp).toLocaleTimeString('ja-JP')}
                        </Typography>
                        {message.status === 'error' && <ErrorIcon color="error" fontSize="small" />}
                        {message.status === 'success' && <CheckIcon color="success" fontSize="small" />}
                      </Box>
                      <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                        {message.content}
                      </Typography>
                    </Paper>
                  </ListItem>
                ))}
                <div ref={messagesEndRef} />
              </List>
            </Box>

            {/* 入力エリア */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Box display="flex" gap={1}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="設定変更の内容を入力してください..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={isProcessing}
                  multiline
                  maxRows={3}
                />
                <Button
                  variant="contained"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isProcessing}
                  endIcon={isProcessing ? <CircularProgress size={20} /> : <SendIcon />}
                >
                  送信
                </Button>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* ダイアログ */}
      <ConversationHistory />
      <ConfirmChangesDialog />
    </Box>
  );
};