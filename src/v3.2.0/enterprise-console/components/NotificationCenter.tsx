import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Badge,
  Typography,
  Button,
  Chip,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Divider,
  Menu,
  MenuItem,
  Paper,
  FormGroup,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Grid,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Chat as ChatIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  DoneAll as DoneAllIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  channel: 'system' | 'email' | 'slack' | 'teams';
}

interface NotificationPreference {
  type: string;
  label: string;
  email: boolean;
  inApp: boolean;
  slack: boolean;
  teams: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`notification-tabpanel-${index}`}
      aria-labelledby={`notification-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function NotificationCenter() {
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedNotification, setSelectedNotification] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'warning',
      title: '残業時間警告',
      message: '開発部の山田太郎さんが月間残業時間上限に近づいています（75時間/80時間）',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      read: false,
      channel: 'system',
    },
    {
      id: '2',
      type: 'error',
      title: '給与計算エラー',
      message: '3名の従業員の給与計算でエラーが発生しました。確認が必要です。',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      read: false,
      channel: 'email',
    },
    {
      id: '3',
      type: 'success',
      title: '経費精算承認完了',
      message: '営業部の経費精算（15件）が承認されました。',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
      read: true,
      channel: 'slack',
    },
    {
      id: '4',
      type: 'info',
      title: 'システムメンテナンス予定',
      message: '1月30日 02:00-04:00にシステムメンテナンスを実施します。',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
      read: true,
      channel: 'system',
    },
  ]);

  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    { type: 'compliance', label: 'コンプライアンス警告', email: true, inApp: true, slack: true, teams: false },
    { type: 'payroll', label: '給与計算', email: true, inApp: true, slack: false, teams: false },
    { type: 'expense', label: '経費精算', email: false, inApp: true, slack: true, teams: false },
    { type: 'attendance', label: '勤怠アラート', email: true, inApp: true, slack: false, teams: false },
    { type: 'system', label: 'システム通知', email: false, inApp: true, slack: false, teams: false },
    { type: 'agent', label: 'AIエージェント', email: false, inApp: true, slack: true, teams: true },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    handleMenuClose();
  };

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleDeleteAll = () => {
    setNotifications([]);
    handleMenuClose();
  };

  const handlePreferenceChange = (
    type: string,
    channel: 'email' | 'inApp' | 'slack' | 'teams',
    value: boolean
  ) => {
    setPreferences(prev =>
      prev.map(p =>
        p.type === type ? { ...p, [channel]: value } : p
      )
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'info':
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <EmailIcon fontSize="small" />;
      case 'slack':
      case 'teams':
        return <ChatIcon fontSize="small" />;
      case 'system':
      default:
        return <NotificationsIcon fontSize="small" />;
    }
  };

  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    return `${days}日前`;
  };

  return (
    <Card>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
            <span>通知センター</span>
          </Box>
        }
        action={
          <>
            <IconButton onClick={handleMenuClick}>
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleMarkAllAsRead}>
                <ListItemIcon>
                  <DoneAllIcon fontSize="small" />
                </ListItemIcon>
                すべて既読にする
              </MenuItem>
              <MenuItem onClick={handleDeleteAll}>
                <ListItemIcon>
                  <DeleteIcon fontSize="small" />
                </ListItemIcon>
                すべて削除
              </MenuItem>
            </Menu>
          </>
        }
      />
      <CardContent>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label={`通知 (${notifications.length})`} />
          <Tab label="通知設定" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          {notifications.length === 0 ? (
            <Box textAlign="center" py={4}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography variant="body1" color="text.secondary" mt={2}>
                新しい通知はありません
              </Typography>
            </Box>
          ) : (
            <List>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      bgcolor: notification.read ? 'transparent' : 'action.hover',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography
                            variant="body1"
                            fontWeight={notification.read ? 'normal' : 'bold'}
                          >
                            {notification.title}
                          </Typography>
                          <Chip
                            icon={getChannelIcon(notification.channel)}
                            label={notification.channel}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="text.secondary">
                            {notification.message}
                          </Typography>
                          {' - '}
                          <Typography component="span" variant="caption" color="text.secondary">
                            {formatTimestamp(notification.timestamp)}
                          </Typography>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      {!notification.read && (
                        <IconButton
                          edge="end"
                          onClick={() => handleMarkAsRead(notification.id)}
                          size="small"
                        >
                          <DoneAllIcon />
                        </IconButton>
                      )}
                      <IconButton
                        edge="end"
                        onClick={() => handleDelete(notification.id)}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            通知チャンネル設定
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            各種通知の受信方法を設定します
          </Typography>

          <Paper sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" mb={2}>
              <Typography variant="subtitle2" sx={{ width: '30%' }}>
                通知タイプ
              </Typography>
              <Box display="flex" gap={4} sx={{ width: '70%' }}>
                <Typography variant="subtitle2" sx={{ width: 80, textAlign: 'center' }}>
                  メール
                </Typography>
                <Typography variant="subtitle2" sx={{ width: 80, textAlign: 'center' }}>
                  アプリ内
                </Typography>
                <Typography variant="subtitle2" sx={{ width: 80, textAlign: 'center' }}>
                  Slack
                </Typography>
                <Typography variant="subtitle2" sx={{ width: 80, textAlign: 'center' }}>
                  Teams
                </Typography>
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {preferences.map((pref, index) => (
              <Box key={pref.type}>
                <Box display="flex" justifyContent="space-between" alignItems="center" py={1}>
                  <Typography variant="body2" sx={{ width: '30%' }}>
                    {pref.label}
                  </Typography>
                  <Box display="flex" gap={4} sx={{ width: '70%' }}>
                    <Switch
                      checked={pref.email}
                      onChange={(e) => handlePreferenceChange(pref.type, 'email', e.target.checked)}
                      sx={{ width: 80 }}
                    />
                    <Switch
                      checked={pref.inApp}
                      onChange={(e) => handlePreferenceChange(pref.type, 'inApp', e.target.checked)}
                      sx={{ width: 80 }}
                    />
                    <Switch
                      checked={pref.slack}
                      onChange={(e) => handlePreferenceChange(pref.type, 'slack', e.target.checked)}
                      sx={{ width: 80 }}
                    />
                    <Switch
                      checked={pref.teams}
                      onChange={(e) => handlePreferenceChange(pref.type, 'teams', e.target.checked)}
                      sx={{ width: 80 }}
                    />
                  </Box>
                </Box>
                {index < preferences.length - 1 && <Divider />}
              </Box>
            ))}
          </Paper>

          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            通知頻度設定
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>ダイジェストメール頻度</InputLabel>
                <Select
                  value="daily"
                  label="ダイジェストメール頻度"
                >
                  <MenuItem value="realtime">リアルタイム</MenuItem>
                  <MenuItem value="hourly">1時間ごと</MenuItem>
                  <MenuItem value="daily">毎日</MenuItem>
                  <MenuItem value="weekly">週次</MenuItem>
                  <MenuItem value="never">送信しない</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>緊急通知の扱い</InputLabel>
                <Select
                  value="always"
                  label="緊急通知の扱い"
                >
                  <MenuItem value="always">常に即座に通知</MenuItem>
                  <MenuItem value="business">営業時間内のみ</MenuItem>
                  <MenuItem value="never">通常通知と同じ</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Box mt={3} display="flex" justifyContent="flex-end">
            <Button variant="contained">
              設定を保存
            </Button>
          </Box>
        </TabPanel>
      </CardContent>
    </Card>
  );
}