import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Storage as StorageIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Group as GroupIcon,
  Assignment as AssignmentIcon,
  AttachMoney as AttachMoneyIcon,
  Receipt as ReceiptIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  CloudQueue as CloudQueueIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

interface SystemMetric {
  label: string;
  value: number;
  max: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

interface ServiceStatus {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  uptime: number;
  lastChecked: Date;
}

export default function SystemOverview() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([
    { label: 'CPU使用率', value: 45, max: 100, unit: '%', status: 'good' },
    { label: 'メモリ使用率', value: 72, max: 100, unit: '%', status: 'warning' },
    { label: 'ストレージ使用率', value: 35, max: 100, unit: '%', status: 'good' },
    { label: 'API応答時間', value: 120, max: 500, unit: 'ms', status: 'good' },
  ]);

  const [services, setServices] = useState<ServiceStatus[]>([
    { name: '勤怠管理サービス', status: 'online', uptime: 99.99, lastChecked: new Date() },
    { name: '給与計算エンジン', status: 'online', uptime: 99.95, lastChecked: new Date() },
    { name: '経費管理システム', status: 'online', uptime: 99.98, lastChecked: new Date() },
    { name: 'AIエージェント', status: 'online', uptime: 99.90, lastChecked: new Date() },
    { name: '外部連携API', status: 'degraded', uptime: 98.50, lastChecked: new Date() },
    { name: 'バックアップサービス', status: 'online', uptime: 100, lastChecked: new Date() },
  ]);

  const [stats] = useState({
    totalUsers: 15420,
    activeUsers: 12350,
    totalTransactions: 458920,
    monthlyGrowth: 15.3,
    dataProcessed: '2.4TB',
    apiCalls: '1.2M',
  });

  const [refreshing, setRefreshing] = useState(false);

  const performanceData = {
    labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
    datasets: [
      {
        label: 'CPU使用率',
        data: [30, 25, 35, 65, 55, 45, 40],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
      {
        label: 'メモリ使用率',
        data: [60, 58, 62, 75, 73, 72, 68],
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1,
      },
    ],
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // 実際の実装では、ここでAPIを呼び出してデータを更新
    await new Promise(resolve => setTimeout(resolve, 2000));
    setRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'good':
        return <CheckCircleIcon color="success" />;
      case 'degraded':
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'offline':
      case 'critical':
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'success.main';
      case 'warning':
        return 'warning.main';
      case 'critical':
        return 'error.main';
      default:
        return 'text.secondary';
    }
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" display="flex" alignItems="center" gap={1}>
          <DashboardIcon />
          システム概要
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          更新
        </Button>
      </Box>

      {/* システムメトリクス */}
      <Grid container spacing={2} mb={3}>
        {metrics.map((metric, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  {metric.label}
                </Typography>
                <Box display="flex" alignItems="baseline" gap={0.5} mb={1}>
                  <Typography variant="h4">
                    {metric.value}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {metric.unit}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(metric.value / metric.max) * 100}
                  sx={{
                    height: 8,
                    borderRadius: 1,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: getStatusColor(metric.status),
                    },
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* 利用統計 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                利用統計
              </Typography>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <GroupIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="総ユーザー数"
                    secondary={stats.totalUsers.toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <TrendingUpIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="アクティブユーザー"
                    secondary={stats.activeUsers.toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AssignmentIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="月間トランザクション"
                    secondary={stats.totalTransactions.toLocaleString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CloudQueueIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="処理データ量"
                    secondary={stats.dataProcessed}
                  />
                </ListItem>
              </List>
              <Box display="flex" alignItems="center" gap={1} mt={2}>
                <TrendingUpIcon color="success" />
                <Typography variant="body2" color="success.main">
                  前月比 +{stats.monthlyGrowth}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* サービス状態 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                サービス状態
              </Typography>
              <List dense>
                {services.map((service, index) => (
                  <ListItem key={index}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getStatusIcon(service.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={service.name}
                      secondary={`稼働率: ${service.uptime}%`}
                    />
                    <Chip
                      label={service.status}
                      size="small"
                      color={
                        service.status === 'online' ? 'success' :
                        service.status === 'degraded' ? 'warning' : 'error'
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* 最近のアクティビティ */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                最近のアクティビティ
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <SecurityIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="セキュリティパッチ適用"
                    secondary="2時間前"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <StorageIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="データベース最適化完了"
                    secondary="5時間前"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <AttachMoneyIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="月次給与計算完了"
                    secondary="1日前"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="システムバックアップ成功"
                    secondary="2日前"
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <ReceiptIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="経費精算バッチ処理完了"
                    secondary="3日前"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* パフォーマンスグラフ */}
        <Grid size={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                システムパフォーマンス（24時間）
              </Typography>
              <Box sx={{ height: 300 }}>
                <Line
                  data={performanceData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top' as const,
                      },
                      title: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                          callback: function(value) {
                            return value + '%';
                          },
                        },
                      },
                    },
                  }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}