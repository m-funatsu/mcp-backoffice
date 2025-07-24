/**
 * 勤怠管理システム設定画面
 * 各種設定を管理するメインページ
 */

import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  IconButton,
  Breadcrumbs,
  Link,
  Stack,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  BeachAccess as VacationIcon,
  CalendarMonth as CalendarIcon,
  AccountTree as WorkflowIcon,
  Notifications as NotificationIcon,
  Settings as SystemIcon,
  Security as SecurityIcon,
  Payment as PaymentIcon,
  Business as CompanyIcon,
  ChevronRight as ChevronRightIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

// 設定コンポーネント
import AttendanceSettings from './components/AttendanceSettings';
import LeaveSettings from './components/LeaveSettings';
import ShiftSettings from './components/ShiftSettings';
import WorkflowSettings from './components/WorkflowSettings';
import NotificationSettings from './components/NotificationSettings';
import SystemSettings from './components/SystemSettings';
import CompanySettings from './components/CompanySettings';
import PayrollSettings from './components/PayrollSettings';
import SecuritySettings from './components/SecuritySettings';

interface SettingCategory {
  id: string;
  label: string;
  icon: React.ReactElement;
  component: React.ComponentType;
  description: string;
}

const settingCategories: SettingCategory[] = [
  {
    id: 'company',
    label: '会社情報',
    icon: <CompanyIcon />,
    component: CompanySettings,
    description: '会社の基本情報や営業日カレンダーの設定',
  },
  {
    id: 'attendance',
    label: '勤怠設定',
    icon: <TimeIcon />,
    component: AttendanceSettings,
    description: '出退勤、勤務時間、打刻に関する設定',
  },
  {
    id: 'leave',
    label: '休暇管理',
    icon: <VacationIcon />,
    component: LeaveSettings,
    description: '有給休暇、特別休暇の付与ルールと管理',
  },
  {
    id: 'shift',
    label: 'シフト管理',
    icon: <CalendarIcon />,
    component: ShiftSettings,
    description: 'シフトパターン、勤務体系の設定',
  },
  {
    id: 'workflow',
    label: '承認ワークフロー',
    icon: <WorkflowIcon />,
    component: WorkflowSettings,
    description: '申請・承認フローの設定と承認者管理',
  },
  {
    id: 'payroll',
    label: '給与計算',
    icon: <PaymentIcon />,
    component: PayrollSettings,
    description: '給与計算に関する各種設定',
  },
  {
    id: 'notification',
    label: '通知設定',
    icon: <NotificationIcon />,
    component: NotificationSettings,
    description: 'メール通知、アラートの設定',
  },
  {
    id: 'security',
    label: 'セキュリティ',
    icon: <SecurityIcon />,
    component: SecuritySettings,
    description: 'アクセス権限、セキュリティポリシーの設定',
  },
  {
    id: 'system',
    label: 'システム設定',
    icon: <SystemIcon />,
    component: SystemSettings,
    description: 'システム全般の設定とメンテナンス',
  },
];

export default function SettingsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('company');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const currentCategory = settingCategories.find(cat => cat.id === selectedCategory);
  const SelectedComponent = currentCategory?.component || CompanySettings;

  const handleCategoryChange = (categoryId: string) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('保存されていない変更があります。移動してもよろしいですか？')) {
        return;
      }
    }
    setSelectedCategory(categoryId);
    setHasUnsavedChanges(false);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* ヘッダー */}
      <Box mb={3}>
        <Breadcrumbs separator={<ChevronRightIcon fontSize="small" />}>
          <Link 
            color="inherit" 
            href="/" 
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            ホーム
          </Link>
          <Typography color="text.primary">設定</Typography>
          {currentCategory && (
            <Typography color="text.primary">{currentCategory.label}</Typography>
          )}
        </Breadcrumbs>
        <Typography variant="h4" component="h1" sx={{ mt: 2 }}>
          設定
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* サイドバー */}
        <Paper sx={{ width: 280, flexShrink: 0 }}>
          <List>
            {settingCategories.map((category, index) => (
              <React.Fragment key={category.id}>
                {index === 3 && <Divider />}
                {index === 6 && <Divider />}
                <ListItem disablePadding>
                  <ListItemButton
                    selected={selectedCategory === category.id}
                    onClick={() => handleCategoryChange(category.id)}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {category.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={category.label}
                      secondary={category.description}
                      secondaryTypographyProps={{
                        variant: 'caption',
                        sx: { 
                          display: selectedCategory === category.id ? 'block' : 'none',
                          mt: 0.5,
                        }
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        </Paper>

        {/* メインコンテンツ */}
        <Paper sx={{ flex: 1, p: 3 }}>
          <SelectedComponent onChangesSaved={() => setHasUnsavedChanges(false)} />
        </Paper>
      </Box>
    </Container>
  );
}