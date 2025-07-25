/**
 * AI-OS v3.2.0 エンタープライズ設定管理コンソール
 * 統合管理ダッシュボード
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Tab,
  Tabs,
  IconButton,
  Badge,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Security as SecurityIcon,
  SmartToy as AIIcon,
  IntegrationInstructions as IntegrationIcon,
  Assessment as AnalyticsIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  SmartToy,
} from '@mui/icons-material';
import { ConsoleState, Notification } from '../types';
import RoleManagementPanel from './RoleManagementPanel';
import { AIAgentPanel } from './AIAgentPanel';
import IntegrationPanel from './IntegrationPanel';
import AuditLogPanel from './AuditLogPanel';
import DataGovernancePanel from './DataGovernancePanel';
import SystemOverview from './SystemOverview';
import NotificationCenter from './NotificationCenter';
import AIConfigurationPanel from './AIConfigurationPanel';
import apiClient from '../services/ApiClient';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`console-tabpanel-${index}`}
      aria-labelledby={`console-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [consoleState, setConsoleState] = useState<ConsoleState | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 初期データ読み込み
  useEffect(() => {
    loadConsoleState();
  }, []);

  const loadConsoleState = async () => {
    try {
      setLoading(true);
      
      // APIから実際のデータを取得しようとする
      const apiResponse = await apiClient.getConsoleState();
      
      if (apiResponse.data) {
        setConsoleState(apiResponse.data);
        setLoading(false);
        return;
      }
      
      // APIが利用できない場合はモックデータを使用
      const mockData: ConsoleState = {
        systemHealth: {
          status: 'healthy',
          uptime: 99.99,
          lastChecked: new Date(),
        },
        activeAgents: [
          {
            id: '1',
            name: '給与計算エージェント',
            type: 'payroll',
            status: 'active',
            lastActivity: new Date(),
          },
          {
            id: '2',
            name: 'コンプライアンス監視エージェント',
            type: 'compliance',
            status: 'active',
            lastActivity: new Date(),
          },
        ],
        recentActivities: [
          {
            id: '1',
            action: '給与計算完了',
            timestamp: new Date(),
            user: 'システム',
            details: '150名分の給与計算を完了しました',
          },
        ],
        statistics: {
          totalUsers: 150,
          activeUsers: 142,
          totalTransactions: 1250,
          processingTime: 2.5,
        },
      };
      
      const mockNotifications: Notification[] = [
        {
          id: '1',
          type: 'warning',
          title: '残業時間警告',
          message: '5名の従業員が月間残業時間の上限に近づいています',
          timestamp: new Date(),
          read: false,
        },
        {
          id: '2',
          type: 'success',
          title: '経費精算完了',
          message: '営業部の経費精算が完了しました',
          timestamp: new Date(Date.now() - 3600000),
          read: true,
        },
      ];
      
      setConsoleState(mockData);
      setNotifications(mockNotifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleNotificationClick = () => {
    setNotificationOpen(!notificationOpen);
  };

  const handleSuccessMessage = (message: string) => {
    setSuccessMessage(message);
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ヘッダー */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Grid container alignItems="center" spacing={2}>
          <Grid size="grow">
            <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center' }}>
              <DashboardIcon sx={{ mr: 1 }} />
              AI-OS エンタープライズ設定管理コンソール
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              v3.2.0 - 企業全体のAIエージェントと統合を一元管理
            </Typography>
          </Grid>
          <Grid size="auto">
            <Tooltip title="通知">
              <IconButton onClick={handleNotificationClick} color="inherit">
                <Badge badgeContent={unreadNotifications} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="ヘルプ">
              <IconButton color="inherit">
                <HelpIcon />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      </Paper>

      {/* メインコンテンツ */}
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        <Paper sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* タブナビゲーション */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="console navigation tabs"
            >
              <Tab
                icon={<DashboardIcon />}
                label="概要"
                iconPosition="start"
                id="console-tab-0"
                aria-controls="console-tabpanel-0"
              />
              <Tab
                icon={<SecurityIcon />}
                label="役割と権限"
                iconPosition="start"
                id="console-tab-1"
                aria-controls="console-tabpanel-1"
              />
              <Tab
                icon={<AIIcon />}
                label="AIエージェント"
                iconPosition="start"
                id="console-tab-2"
                aria-controls="console-tabpanel-2"
              />
              <Tab
                icon={<IntegrationIcon />}
                label="インテグレーション"
                iconPosition="start"
                id="console-tab-3"
                aria-controls="console-tabpanel-3"
              />
              <Tab
                icon={<AnalyticsIcon />}
                label="監査ログ"
                iconPosition="start"
                id="console-tab-4"
                aria-controls="console-tabpanel-4"
              />
              <Tab
                icon={<SettingsIcon />}
                label="データガバナンス"
                iconPosition="start"
                id="console-tab-5"
                aria-controls="console-tabpanel-5"
              />
              <Tab
                icon={<SmartToy />}
                label="AI設定"
                iconPosition="start"
                id="console-tab-6"
                aria-controls="console-tabpanel-6"
              />
            </Tabs>
          </Box>

          {/* タブコンテンツ */}
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            <TabPanel value={activeTab} index={0}>
              <SystemOverview
                consoleState={consoleState!}
                onRefresh={loadConsoleState}
              />
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              <RoleManagementPanel />
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              <AIAgentPanel />
            </TabPanel>

            <TabPanel value={activeTab} index={3}>
              <IntegrationPanel />
            </TabPanel>

            <TabPanel value={activeTab} index={4}>
              <AuditLogPanel />
            </TabPanel>

            <TabPanel value={activeTab} index={5}>
              <DataGovernancePanel />
            </TabPanel>

            <TabPanel value={activeTab} index={6}>
              <AIConfigurationPanel />
            </TabPanel>
          </Box>
        </Paper>
      </Box>

      {/* 通知センター */}
      <NotificationCenter
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
        notifications={notifications}
        onNotificationRead={(id) => {
          setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
          );
        }}
      />

      {/* 成功メッセージ */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSuccessMessage(null)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Dashboard;