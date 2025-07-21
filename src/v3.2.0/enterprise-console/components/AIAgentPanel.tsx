/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * AIエージェント設定管理パネル
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  Switch,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  FormControlLabel,
  Checkbox,
  Alert,
  Tooltip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
  Divider,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Schedule as ScheduleIcon,
  Speed as SpeedIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Insights as InsightsIcon,
} from '@mui/icons-material';
import {
  AgentState,
  AgentConfiguration,
  AIAgent,
  SensitivitySettings,
  NotificationSettings,
} from '../types';

interface AIAgentPanelProps {
  agents: AgentState[];
  onSuccess: (message: string) => void;
  onRefresh: () => void;
}

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({
  agents,
  onSuccess,
  onRefresh,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentState | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<Partial<AgentConfiguration>>({});

  const handleAgentToggle = async (agentId: string, enabled: boolean) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v3.2.0/agents/${agentId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) throw new Error('エージェントの切り替えに失敗しました');

      onSuccess(`エージェントを${enabled ? '有効' : '無効'}にしました`);
      onRefresh();
    } catch (error) {
      console.error('Error toggling agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigOpen = (agent: AgentState) => {
    setSelectedAgent(agent);
    setConfig(agent.config || {});
    setConfigDialogOpen(true);
  };

  const handleConfigSave = async () => {
    if (!selectedAgent) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/v3.2.0/agents/${selectedAgent.agent.id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error('設定の保存に失敗しました');

      onSuccess('エージェント設定を更新しました');
      setConfigDialogOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Error saving config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAgent = async (agentId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v3.2.0/agents/${agentId}/execute`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('エージェントの実行に失敗しました');

      onSuccess('エージェントを手動実行しました');
      onRefresh();
    } catch (error) {
      console.error('Error executing agent:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: AgentState['status']) => {
    switch (status) {
      case 'running':
        return <CheckIcon color="success" />;
      case 'stopped':
        return <StopIcon color="disabled" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'configuring':
        return <SettingsIcon color="primary" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: AgentState['status']) => {
    switch (status) {
      case 'running':
        return 'success';
      case 'stopped':
        return 'default';
      case 'error':
        return 'error';
      case 'configuring':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        AIエージェント管理
      </Typography>

      <Grid container spacing={3}>
        {agents.map((agentState) => (
          <Grid item xs={12} md={6} lg={4} key={agentState.agent.id}>
            <Card 
              sx={{ 
                height: '100%',
                position: 'relative',
                borderTop: 3,
                borderColor: `${getStatusColor(agentState.status)}.main`,
              }}
            >
              {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />}
              
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  <AIIcon sx={{ mr: 1, fontSize: 40 }} />
                  <Box flexGrow={1}>
                    <Typography variant="h6">
                      {agentState.agent.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      v{agentState.agent.version}
                    </Typography>
                  </Box>
                  <Chip
                    icon={getStatusIcon(agentState.status)}
                    label={agentState.status}
                    color={getStatusColor(agentState.status)}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" paragraph>
                  {agentState.agent.description}
                </Typography>

                {/* エージェントの能力表示 */}
                <Box mb={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    機能:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {agentState.agent.capabilities.autoExecution && (
                      <Chip label="自動実行" size="small" variant="outlined" />
                    )}
                    {agentState.agent.capabilities.realTimeProcessing && (
                      <Chip label="リアルタイム処理" size="small" variant="outlined" />
                    )}
                    {agentState.agent.capabilities.aiDecisionMaking && (
                      <Chip label="AI意思決定" size="small" variant="outlined" />
                    )}
                  </Box>
                </Box>

                {/* メトリクス表示 */}
                {agentState.metrics && (
                  <Box>
                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          成功率
                        </Typography>
                        <Typography variant="body2">
                          {(agentState.metrics.successRate * 100).toFixed(1)}%
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          実行回数
                        </Typography>
                        <Typography variant="body2">
                          {agentState.metrics.executionCount}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                {/* 有効/無効スイッチ */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={agentState.config?.enabled ?? false}
                      onChange={(e) => handleAgentToggle(agentState.agent.id, e.target.checked)}
                      disabled={loading}
                    />
                  }
                  label="エージェントを有効化"
                  sx={{ mt: 2 }}
                />
              </CardContent>

              <CardActions>
                <Tooltip title="設定">
                  <IconButton
                    onClick={() => handleConfigOpen(agentState)}
                    disabled={loading}
                    size="small"
                  >
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="手動実行">
                  <IconButton
                    onClick={() => handleExecuteAgent(agentState.agent.id)}
                    disabled={loading || !agentState.config?.enabled}
                    size="small"
                  >
                    <PlayIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="実行履歴">
                  <IconButton
                    onClick={() => {
                      setSelectedAgent(agentState);
                      setHistoryDialogOpen(true);
                    }}
                    size="small"
                  >
                    <HistoryIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="メトリクス">
                  <IconButton
                    onClick={() => {
                      setSelectedAgent(agentState);
                      setMetricsDialogOpen(true);
                    }}
                    size="small"
                  >
                    <InsightsIcon />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 設定ダイアログ */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedAgent?.agent.displayName} の設定
        </DialogTitle>
        <DialogContent>
          {selectedAgent && (
            <Box sx={{ pt: 2 }}>
              {/* エージェントタイプ別の設定 */}
              {selectedAgent.agent.agentType === 'payroll' && (
                <PayrollAgentConfig
                  config={config}
                  onChange={setConfig}
                />
              )}
              {selectedAgent.agent.agentType === 'compliance' && (
                <ComplianceAgentConfig
                  config={config}
                  onChange={setConfig}
                />
              )}
              {selectedAgent.agent.agentType === 'expense' && (
                <ExpenseAgentConfig
                  config={config}
                  onChange={setConfig}
                />
              )}

              {/* 共通設定 */}
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" gutterBottom>
                感度設定
              </Typography>
              <SensitivityConfig
                settings={config.sensitivitySettings || {}}
                onChange={(settings) => setConfig({
                  ...config,
                  sensitivitySettings: settings,
                })}
              />

              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" gutterBottom>
                通知設定
              </Typography>
              <NotificationConfig
                settings={config.notificationSettings || {}}
                onChange={(settings) => setConfig({
                  ...config,
                  notificationSettings: settings,
                })}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleConfigSave}
            variant="contained"
            disabled={loading}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// 給与計算エージェント設定コンポーネント
const PayrollAgentConfig: React.FC<{
  config: Partial<AgentConfiguration>;
  onChange: (config: Partial<AgentConfiguration>) => void;
}> = ({ config, onChange }) => {
  const payrollConfig = config.config?.payroll || {};

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="計算実行日"
            type="number"
            value={payrollConfig.calculationDay || 25}
            onChange={(e) => onChange({
              ...config,
              config: {
                ...config.config,
                payroll: {
                  ...payrollConfig,
                  calculationDay: parseInt(e.target.value),
                },
              },
            })}
            InputProps={{ inputProps: { min: 1, max: 31 } }}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="支払日"
            type="number"
            value={payrollConfig.paymentDay || 25}
            onChange={(e) => onChange({
              ...config,
              config: {
                ...config.config,
                payroll: {
                  ...payrollConfig,
                  paymentDay: parseInt(e.target.value),
                },
              },
            })}
            InputProps={{ inputProps: { min: 1, max: 31 } }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="残業時間閾値（時間）"
            type="number"
            value={payrollConfig.overtimeThreshold || 45}
            onChange={(e) => onChange({
              ...config,
              config: {
                ...config.config,
                payroll: {
                  ...payrollConfig,
                  overtimeThreshold: parseInt(e.target.value),
                },
              },
            })}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={payrollConfig.includeAllowances || false}
                onChange={(e) => onChange({
                  ...config,
                  config: {
                    ...config.config,
                    payroll: {
                      ...payrollConfig,
                      includeAllowances: e.target.checked,
                    },
                  },
                })}
              />
            }
            label="各種手当を自動計算に含める"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

// コンプライアンスエージェント設定コンポーネント
const ComplianceAgentConfig: React.FC<{
  config: Partial<AgentConfiguration>;
  onChange: (config: Partial<AgentConfiguration>) => void;
}> = ({ config, onChange }) => {
  const complianceConfig = config.config?.compliance || {};

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="監視間隔（秒）"
            type="number"
            value={complianceConfig.monitoringInterval || 300}
            onChange={(e) => onChange({
              ...config,
              config: {
                ...config.config,
                compliance: {
                  ...complianceConfig,
                  monitoringInterval: parseInt(e.target.value),
                },
              },
            })}
            InputProps={{ inputProps: { min: 60 } }}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>アラート閾値</InputLabel>
            <Select
              value={complianceConfig.alertThreshold || 'warning'}
              onChange={(e) => onChange({
                ...config,
                config: {
                  ...config.config,
                  compliance: {
                    ...complianceConfig,
                    alertThreshold: e.target.value as 'info' | 'warning' | 'critical',
                  },
                },
              })}
            >
              <MenuItem value="info">情報</MenuItem>
              <MenuItem value="warning">警告</MenuItem>
              <MenuItem value="critical">重大</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Checkbox
                checked={complianceConfig.autoReporting || false}
                onChange={(e) => onChange({
                  ...config,
                  config: {
                    ...config.config,
                    compliance: {
                      ...complianceConfig,
                      autoReporting: e.target.checked,
                    },
                  },
                })}
              />
            }
            label="コンプライアンスレポートの自動生成"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

// 経費エージェント設定コンポーネント
const ExpenseAgentConfig: React.FC<{
  config: Partial<AgentConfiguration>;
  onChange: (config: Partial<AgentConfiguration>) => void;
}> = ({ config, onChange }) => {
  const expenseConfig = config.config?.expense || {};

  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="自動承認上限金額（円）"
            type="number"
            value={expenseConfig.autoApproveLimit || 10000}
            onChange={(e) => onChange({
              ...config,
              config: {
                ...config.config,
                expense: {
                  ...expenseConfig,
                  autoApproveLimit: parseInt(e.target.value),
                },
              },
            })}
          />
        </Grid>
        <Grid item xs={12}>
          <Typography gutterBottom>
            OCR信頼度閾値: {((expenseConfig.ocrConfidenceThreshold || 0.9) * 100).toFixed(0)}%
          </Typography>
          <Slider
            value={expenseConfig.ocrConfidenceThreshold || 0.9}
            onChange={(_, value) => onChange({
              ...config,
              config: {
                ...config.config,
                expense: {
                  ...expenseConfig,
                  ocrConfidenceThreshold: value as number,
                },
              },
            })}
            min={0}
            max={1}
            step={0.05}
            marks
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </Grid>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>不正検知感度</InputLabel>
            <Select
              value={expenseConfig.fraudDetectionSensitivity || 'medium'}
              onChange={(e) => onChange({
                ...config,
                config: {
                  ...config.config,
                  expense: {
                    ...expenseConfig,
                    fraudDetectionSensitivity: e.target.value as 'low' | 'medium' | 'high',
                  },
                },
              })}
            >
              <MenuItem value="low">低</MenuItem>
              <MenuItem value="medium">中</MenuItem>
              <MenuItem value="high">高</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
};

// 感度設定コンポーネント
const SensitivityConfig: React.FC<{
  settings: Partial<SensitivitySettings>;
  onChange: (settings: SensitivitySettings) => void;
}> = ({ settings, onChange }) => {
  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel>アラート感度</InputLabel>
            <Select
              value={settings.alertSensitivity || 'medium'}
              onChange={(e) => onChange({
                ...settings,
                alertSensitivity: e.target.value as 'low' | 'medium' | 'high',
              } as SensitivitySettings)}
            >
              <MenuItem value="low">低（重要なアラートのみ）</MenuItem>
              <MenuItem value="medium">中（標準）</MenuItem>
              <MenuItem value="high">高（全てのアラート）</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <Typography gutterBottom>
            異常検知閾値: {((settings.anomalyDetectionThreshold || 0.8) * 100).toFixed(0)}%
          </Typography>
          <Slider
            value={settings.anomalyDetectionThreshold || 0.8}
            onChange={(_, value) => onChange({
              ...settings,
              anomalyDetectionThreshold: value as number,
            } as SensitivitySettings)}
            min={0}
            max={1}
            step={0.05}
            marks
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

// 通知設定コンポーネント
const NotificationConfig: React.FC<{
  settings: Partial<NotificationSettings>;
  onChange: (settings: NotificationSettings) => void;
}> = ({ settings, onChange }) => {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" paragraph>
        エージェントからの通知方法と条件を設定します
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        詳細な通知設定は、インテグレーション設定から行ってください
      </Alert>
    </Box>
  );
};