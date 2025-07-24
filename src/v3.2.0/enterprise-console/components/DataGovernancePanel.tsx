import React, { useState } from 'react';
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
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Shield as ShieldIcon,
  Lock as LockIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  CloudDownload as CloudDownloadIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { DataRetentionPolicy, PrivacySetting, ExportRequest } from '../types';

interface DataCategoryCardProps {
  category: {
    id: string;
    name: string;
    description: string;
    retentionDays: number;
    encrypted: boolean;
    anonymizationEnabled: boolean;
    accessLevel: string;
  };
  onUpdate: (id: string, updates: any) => void;
}

function DataCategoryCard({ category, onUpdate }: DataCategoryCardProps) {
  const [editMode, setEditMode] = useState(false);
  const [localCategory, setLocalCategory] = useState(category);

  const handleSave = () => {
    onUpdate(category.id, localCategory);
    setEditMode(false);
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
          <Typography variant="h6">{category.name}</Typography>
          <Button
            size="small"
            onClick={() => editMode ? handleSave() : setEditMode(true)}
          >
            {editMode ? '保存' : '編集'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={2}>
          {category.description}
        </Typography>

        {editMode ? (
          <Box display="flex" flexDirection="column" gap={2}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                保持期間（日数）
              </Typography>
              <Slider
                value={localCategory.retentionDays}
                onChange={(e, value) => setLocalCategory({ ...localCategory, retentionDays: value as number })}
                min={30}
                max={3650}
                step={30}
                marks={[
                  { value: 365, label: '1年' },
                  { value: 1095, label: '3年' },
                  { value: 1825, label: '5年' },
                  { value: 3650, label: '10年' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={localCategory.encrypted}
                  onChange={(e) => setLocalCategory({ ...localCategory, encrypted: e.target.checked })}
                />
              }
              label="暗号化"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={localCategory.anonymizationEnabled}
                  onChange={(e) => setLocalCategory({ ...localCategory, anonymizationEnabled: e.target.checked })}
                />
              }
              label="匿名化"
            />

            <FormControl size="small">
              <InputLabel>アクセスレベル</InputLabel>
              <Select
                value={localCategory.accessLevel}
                onChange={(e) => setLocalCategory({ ...localCategory, accessLevel: e.target.value })}
                label="アクセスレベル"
              >
                <MenuItem value="public">公開</MenuItem>
                <MenuItem value="internal">社内限定</MenuItem>
                <MenuItem value="restricted">制限付き</MenuItem>
                <MenuItem value="confidential">機密</MenuItem>
              </Select>
            </FormControl>
          </Box>
        ) : (
          <Box>
            <Box display="flex" gap={1} mb={1}>
              <Chip
                label={`${category.retentionDays}日間保持`}
                size="small"
                icon={<ScheduleIcon />}
              />
              {category.encrypted && (
                <Chip
                  label="暗号化"
                  size="small"
                  color="primary"
                  icon={<LockIcon />}
                />
              )}
              {category.anonymizationEnabled && (
                <Chip
                  label="匿名化"
                  size="small"
                  color="secondary"
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              アクセスレベル: {category.accessLevel}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function DataGovernancePanel() {
  const [activeTab, setActiveTab] = useState(0);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  // サンプルデータ
  const [dataCategories, setDataCategories] = useState([
    {
      id: 'personal',
      name: '個人情報',
      description: '氏名、住所、連絡先などの基本的な個人情報',
      retentionDays: 2555, // 7年
      encrypted: true,
      anonymizationEnabled: false,
      accessLevel: 'restricted',
    },
    {
      id: 'attendance',
      name: '勤怠データ',
      description: '出退勤時刻、休暇取得履歴など',
      retentionDays: 1095, // 3年
      encrypted: true,
      anonymizationEnabled: false,
      accessLevel: 'internal',
    },
    {
      id: 'payroll',
      name: '給与データ',
      description: '給与、賞与、各種手当の支給履歴',
      retentionDays: 2555, // 7年
      encrypted: true,
      anonymizationEnabled: false,
      accessLevel: 'confidential',
    },
    {
      id: 'performance',
      name: '評価データ',
      description: '人事評価、360度フィードバック',
      retentionDays: 1825, // 5年
      encrypted: true,
      anonymizationEnabled: true,
      accessLevel: 'restricted',
    },
  ]);

  const [privacySettings, setPrivacySettings] = useState({
    dataMinimization: true,
    purposeLimitation: true,
    consentManagement: true,
    rightToAccess: true,
    rightToErasure: true,
    dataPortability: true,
  });

  const [exportRequests] = useState<ExportRequest[]>([
    {
      id: '1',
      employeeId: 'EMP001',
      employeeName: '山田太郎',
      requestDate: '2024-01-15',
      status: 'completed',
      completedDate: '2024-01-16',
    },
    {
      id: '2',
      employeeId: 'EMP002',
      employeeName: '佐藤花子',
      requestDate: '2024-01-20',
      status: 'processing',
    },
    {
      id: '3',
      employeeId: 'EMP003',
      employeeName: '鈴木一郎',
      requestDate: '2024-01-22',
      status: 'pending',
    },
  ]);

  const handleCategoryUpdate = (id: string, updates: any) => {
    setDataCategories(prev =>
      prev.map(cat => cat.id === id ? { ...cat, ...updates } : cat)
    );
  };

  const handlePrivacySettingChange = (setting: string, value: boolean) => {
    setPrivacySettings(prev => ({ ...prev, [setting]: value }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'processing':
        return <ScheduleIcon color="primary" />;
      case 'pending':
        return <InfoIcon color="action" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <ShieldIcon />
            <span>データガバナンス</span>
          </Box>
        }
        subheader="個人情報保護とデータ管理ポリシーを設定します"
      />
      <CardContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Box display="flex" gap={2}>
            <Button
              onClick={() => setActiveTab(0)}
              sx={{ borderBottom: activeTab === 0 ? 2 : 0, borderRadius: 0 }}
            >
              データ保持ポリシー
            </Button>
            <Button
              onClick={() => setActiveTab(1)}
              sx={{ borderBottom: activeTab === 1 ? 2 : 0, borderRadius: 0 }}
            >
              プライバシー設定
            </Button>
            <Button
              onClick={() => setActiveTab(2)}
              sx={{ borderBottom: activeTab === 2 ? 2 : 0, borderRadius: 0 }}
            >
              データ要求管理
            </Button>
          </Box>
        </Box>

        {/* データ保持ポリシー */}
        {activeTab === 0 && (
          <Grid container spacing={2}>
            {dataCategories.map(category => (
              <Grid item xs={12} md={6} key={category.id}>
                <DataCategoryCard
                  category={category}
                  onUpdate={handleCategoryUpdate}
                />
              </Grid>
            ))}
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mt: 2 }}>
                労働基準法により、賃金台帳は5年間、その他の労働関係書類は3年間の保存が義務付けられています。
              </Alert>
            </Grid>
          </Grid>
        )}

        {/* プライバシー設定 */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              GDPR/個人情報保護法準拠設定
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="データ最小化"
                  secondary="必要最小限のデータのみを収集・保持する"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={privacySettings.dataMinimization}
                    onChange={(e) => handlePrivacySettingChange('dataMinimization', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="目的制限"
                  secondary="収集目的を明確にし、目的外利用を制限する"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={privacySettings.purposeLimitation}
                    onChange={(e) => handlePrivacySettingChange('purposeLimitation', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="同意管理"
                  secondary="データ収集・処理に対する明示的な同意を管理する"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={privacySettings.consentManagement}
                    onChange={(e) => handlePrivacySettingChange('consentManagement', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="アクセス権"
                  secondary="従業員が自身のデータにアクセスできる権利"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={privacySettings.rightToAccess}
                    onChange={(e) => handlePrivacySettingChange('rightToAccess', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="削除権"
                  secondary="従業員がデータの削除を要求できる権利"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={privacySettings.rightToErasure}
                    onChange={(e) => handlePrivacySettingChange('rightToErasure', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="データポータビリティ"
                  secondary="従業員がデータを他のサービスに移行できる権利"
                />
                <ListItemSecondaryAction>
                  <Switch
                    checked={privacySettings.dataPortability}
                    onChange={(e) => handlePrivacySettingChange('dataPortability', e.target.checked)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Box>
        )}

        {/* データ要求管理 */}
        {activeTab === 2 && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">データアクセス・削除要求</Typography>
              <Box display="flex" gap={1}>
                <Button
                  startIcon={<CloudDownloadIcon />}
                  variant="outlined"
                  onClick={() => setExportDialogOpen(true)}
                >
                  データエクスポート
                </Button>
                <Button
                  startIcon={<DeleteIcon />}
                  variant="outlined"
                  color="error"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  データ削除
                </Button>
              </Box>
            </Box>

            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>従業員</TableCell>
                    <TableCell>要求日</TableCell>
                    <TableCell>種類</TableCell>
                    <TableCell>ステータス</TableCell>
                    <TableCell>完了日</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {exportRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{request.employeeName}</TableCell>
                      <TableCell>{request.requestDate}</TableCell>
                      <TableCell>
                        <Chip label="データエクスポート" size="small" />
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          {getStatusIcon(request.status)}
                          <Typography variant="body2">
                            {request.status === 'completed' && '完了'}
                            {request.status === 'processing' && '処理中'}
                            {request.status === 'pending' && '保留中'}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>{request.completedDate || '-'}</TableCell>
                      <TableCell>
                        <Button size="small">詳細</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* データエクスポートダイアログ */}
        <Dialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>データエクスポート</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <TextField
                label="従業員ID"
                fullWidth
                value={selectedEmployee || ''}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" color="text.secondary">
                指定された従業員のすべての個人データをエクスポートします。
                処理完了後、ダウンロードリンクがメールで送信されます。
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>キャンセル</Button>
            <Button variant="contained" onClick={() => setExportDialogOpen(false)}>
              エクスポート実行
            </Button>
          </DialogActions>
        </Dialog>

        {/* データ削除ダイアログ */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>データ削除</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              この操作は取り消せません。法的要件により保持が必要なデータは削除されません。
            </Alert>
            <TextField
              label="従業員ID"
              fullWidth
              value={selectedEmployee || ''}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>キャンセル</Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => setDeleteDialogOpen(false)}
            >
              削除実行
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}