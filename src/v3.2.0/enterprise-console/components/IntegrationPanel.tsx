import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Paper,
  Typography,
  Button,
  Switch,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  Extension as ExtensionIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Settings as SettingsIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import { Integration, IntegrationConfig } from '../types';

interface IntegrationCardProps {
  integration: Integration;
  onToggle: (id: string, enabled: boolean) => void;
  onConfigure: (integration: Integration) => void;
  onTest: (id: string) => void;
}

function IntegrationCard({ integration, onToggle, onConfigure, onTest }: IntegrationCardProps) {
  const getStatusIcon = () => {
    switch (integration.status) {
      case 'connected':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return null;
    }
  };

  const getStatusColor = () => {
    switch (integration.status) {
      case 'connected':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            {integration.icon && <Box component="img" src={integration.icon} width={32} height={32} />}
            <Typography variant="h6">{integration.name}</Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={integration.enabled}
                onChange={(e) => onToggle(integration.id, e.target.checked)}
                disabled={integration.status === 'error'}
              />
            }
            label={integration.enabled ? '有効' : '無効'}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" mb={2}>
          {integration.description}
        </Typography>

        <Box display="flex" alignItems="center" gap={1} mb={2}>
          {getStatusIcon()}
          <Chip
            label={integration.statusMessage || '未接続'}
            size="small"
            color={getStatusColor()}
          />
        </Box>

        {integration.lastSync && (
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>
            最終同期: {new Date(integration.lastSync).toLocaleString('ja-JP')}
          </Typography>
        )}

        <Box display="flex" gap={1}>
          <Button
            size="small"
            startIcon={<SettingsIcon />}
            onClick={() => onConfigure(integration)}
            disabled={!integration.enabled}
          >
            設定
          </Button>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => onTest(integration.id)}
            disabled={!integration.enabled}
          >
            接続テスト
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function IntegrationPanel() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [configDialog, setConfigDialog] = useState<{
    open: boolean;
    integration: Integration | null;
  }>({ open: false, integration: null });
  const [config, setConfig] = useState<IntegrationConfig>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    // サンプルデータ（実際はAPIから取得）
    const sampleIntegrations: Integration[] = [
      {
        id: 'freee',
        name: 'freee会計',
        type: 'accounting',
        description: '給与・経費データを自動的にfreee会計に連携します',
        enabled: true,
        status: 'connected',
        statusMessage: '正常に接続されています',
        lastSync: new Date().toISOString(),
        icon: '/icons/freee.png',
        configFields: [
          { key: 'api_key', label: 'APIキー', type: 'password', required: true },
          { key: 'company_id', label: '事業所ID', type: 'text', required: true },
        ],
      },
      {
        id: 'slack',
        name: 'Slack',
        type: 'communication',
        description: '承認通知や重要なアラートをSlackに送信します',
        enabled: true,
        status: 'connected',
        statusMessage: '正常に接続されています',
        lastSync: new Date().toISOString(),
        icon: '/icons/slack.png',
        configFields: [
          { key: 'webhook_url', label: 'Webhook URL', type: 'text', required: true },
          { key: 'channel', label: '通知チャンネル', type: 'text', required: true },
        ],
      },
      {
        id: 'teams',
        name: 'Microsoft Teams',
        type: 'communication',
        description: '承認通知や重要なアラートをTeamsに送信します',
        enabled: false,
        status: 'disconnected',
        statusMessage: '未設定',
        icon: '/icons/teams.png',
        configFields: [
          { key: 'webhook_url', label: 'Webhook URL', type: 'text', required: true },
        ],
      },
      {
        id: 'moneyforward',
        name: 'マネーフォワード',
        type: 'accounting',
        description: '給与・経費データを自動的にマネーフォワードに連携します',
        enabled: false,
        status: 'disconnected',
        statusMessage: '未設定',
        icon: '/icons/moneyforward.png',
        configFields: [
          { key: 'api_key', label: 'APIキー', type: 'password', required: true },
          { key: 'office_id', label: '事業所ID', type: 'text', required: true },
        ],
      },
      {
        id: 'jira',
        name: 'Jira',
        type: 'project',
        description: 'タスクと工数管理をJiraと同期します',
        enabled: true,
        status: 'warning',
        statusMessage: '認証の更新が必要です',
        lastSync: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        icon: '/icons/jira.png',
        configFields: [
          { key: 'domain', label: 'Jiraドメイン', type: 'text', required: true },
          { key: 'email', label: 'メールアドレス', type: 'email', required: true },
          { key: 'api_token', label: 'APIトークン', type: 'password', required: true },
        ],
      },
      {
        id: 'google_workspace',
        name: 'Google Workspace',
        type: 'identity',
        description: 'Google Workspaceと従業員データを同期します',
        enabled: false,
        status: 'disconnected',
        statusMessage: '未設定',
        icon: '/icons/google.png',
        configFields: [
          { key: 'client_id', label: 'クライアントID', type: 'text', required: true },
          { key: 'client_secret', label: 'クライアントシークレット', type: 'password', required: true },
          { key: 'domain', label: 'ドメイン', type: 'text', required: true },
        ],
      },
    ];
    setIntegrations(sampleIntegrations);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setLoading(id);
    try {
      // API呼び出し（実装時）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIntegrations(prev =>
        prev.map(i =>
          i.id === id
            ? { ...i, enabled, status: enabled ? 'connected' : 'disconnected' }
            : i
        )
      );
      setSuccess(`${enabled ? '有効化' : '無効化'}しました`);
    } catch (err) {
      setError('設定の変更に失敗しました');
    } finally {
      setLoading(null);
    }
  };

  const handleConfigure = (integration: Integration) => {
    setConfigDialog({ open: true, integration });
    // 既存の設定を読み込む（実装時）
    setConfig({});
  };

  const handleTest = async (id: string) => {
    setLoading(id);
    try {
      // 接続テストAPI呼び出し（実装時）
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSuccess('接続テストに成功しました');
    } catch (err) {
      setError('接続テストに失敗しました');
    } finally {
      setLoading(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!configDialog.integration) return;

    setLoading(configDialog.integration.id);
    try {
      // 設定保存API呼び出し（実装時）
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setIntegrations(prev =>
        prev.map(i =>
          i.id === configDialog.integration?.id
            ? { ...i, status: 'connected', statusMessage: '正常に接続されています' }
            : i
        )
      );
      
      setSuccess('設定を保存しました');
      setConfigDialog({ open: false, integration: null });
    } catch (err) {
      setError('設定の保存に失敗しました');
    } finally {
      setLoading(null);
    }
  };

  const groupedIntegrations = integrations.reduce((acc, integration) => {
    if (!acc[integration.type]) {
      acc[integration.type] = [];
    }
    acc[integration.type].push(integration);
    return acc;
  }, {} as Record<string, Integration[]>);

  const typeLabels: Record<string, string> = {
    accounting: '会計システム',
    communication: 'コミュニケーション',
    project: 'プロジェクト管理',
    identity: 'ID管理',
  };

  return (
    <Card>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <ExtensionIcon />
            <span>外部サービス連携</span>
          </Box>
        }
        subheader="外部サービスとの連携を管理します"
      />
      <CardContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

        {Object.entries(groupedIntegrations).map(([type, items]) => (
          <Box key={type} mb={4}>
            <Typography variant="h6" gutterBottom>
              {typeLabels[type] || type}
            </Typography>
            <Grid container spacing={2}>
              {items.map(integration => (
                <Grid item xs={12} md={6} lg={4} key={integration.id}>
                  {loading === integration.id && <LinearProgress />}
                  <IntegrationCard
                    integration={integration}
                    onToggle={handleToggle}
                    onConfigure={handleConfigure}
                    onTest={handleTest}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}

        {/* 設定ダイアログ */}
        <Dialog
          open={configDialog.open}
          onClose={() => setConfigDialog({ open: false, integration: null })}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {configDialog.integration?.name}の設定
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {configDialog.integration?.configFields?.map(field => (
                <TextField
                  key={field.key}
                  label={field.label}
                  type={field.type || 'text'}
                  value={config[field.key] || ''}
                  onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                  required={field.required}
                  fullWidth
                  autoComplete="off"
                />
              ))}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfigDialog({ open: false, integration: null })}>
              キャンセル
            </Button>
            <Button onClick={handleSaveConfig} variant="contained">
              保存
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}