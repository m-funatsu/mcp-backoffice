/**
 * 休暇管理設定コンポーネント
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Switch,
  FormControlLabel,
  FormGroup,
  Card,
  CardContent,
  InputAdornment,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

interface LeaveSettingsProps {
  onChangesSaved?: () => void;
}

interface LeaveType {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
  requiresApproval: boolean;
  maxDaysPerYear?: number;
  carryOverAllowed: boolean;
  maxCarryOverDays?: number;
  advanceNoticeRequired?: number;
  attachmentRequired: boolean;
  minUnit: number; // 最小取得単位（時間）
}

export default function LeaveSettings({ onChangesSaved }: LeaveSettingsProps) {
  const [saved, setSaved] = useState(false);
  const [leaveTypeDialogOpen, setLeaveTypeDialogOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);

  // 有給休暇設定
  const [paidLeaveSettings, setPaidLeaveSettings] = useState({
    // 基本設定
    grantTiming: 'hire_date', // hire_date, fiscal_year_start
    initialGrantDays: 10,
    initialGrantAfterMonths: 6,
    
    // 付与ルール
    grantRules: [
      { yearsOfService: 0.5, days: 10 },
      { yearsOfService: 1.5, days: 11 },
      { yearsOfService: 2.5, days: 12 },
      { yearsOfService: 3.5, days: 14 },
      { yearsOfService: 4.5, days: 16 },
      { yearsOfService: 5.5, days: 18 },
      { yearsOfService: 6.5, days: 20 },
    ],
    
    // 繰越設定
    carryOverEnabled: true,
    maxCarryOverDays: 20,
    expirationYears: 2,
    
    // 計画年休
    plannedLeaveEnabled: true,
    plannedLeaveDays: 5,
    
    // 時間単位年休
    hourlyLeaveEnabled: true,
    maxHourlyLeaveDaysPerYear: 5,
    
    // 半日単位年休
    halfDayLeaveEnabled: true,
    morningHours: { start: '09:00', end: '13:00' },
    afternoonHours: { start: '13:00', end: '18:00' },
  });

  // 特別休暇設定
  const [specialLeaveTypes, setSpecialLeaveTypes] = useState<LeaveType[]>([
    {
      id: '1',
      name: '慶弔休暇',
      code: 'CONDOLENCE',
      isPaid: true,
      requiresApproval: true,
      maxDaysPerYear: 5,
      carryOverAllowed: false,
      advanceNoticeRequired: 0,
      attachmentRequired: true,
      minUnit: 8,
    },
    {
      id: '2',
      name: '夏季休暇',
      code: 'SUMMER',
      isPaid: true,
      requiresApproval: true,
      maxDaysPerYear: 3,
      carryOverAllowed: false,
      advanceNoticeRequired: 7,
      attachmentRequired: false,
      minUnit: 8,
    },
    {
      id: '3',
      name: '病気休暇',
      code: 'SICK',
      isPaid: false,
      requiresApproval: true,
      carryOverAllowed: false,
      advanceNoticeRequired: 0,
      attachmentRequired: true,
      minUnit: 4,
    },
  ]);

  // 休暇取得ルール
  const [leaveRules, setLeaveRules] = useState({
    // 申請期限
    advanceNoticeDefault: 3, // 日前まで
    cancellationDeadline: 1, // 日前まで
    
    // 取得制限
    consecutiveDaysLimit: 14,
    blackoutDatesEnabled: true,
    minStaffRequirement: 0.7, // 70%の出勤率
    
    // 承認設定
    autoApproveEnabled: false,
    autoApproveDays: 1,
    multiLevelApproval: false,
    
    // 通知設定
    expirationWarningDays: 30,
    lowBalanceWarningDays: 5,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    if (onChangesSaved) {
      onChangesSaved();
    }
  };

  const handleAddLeaveType = () => {
    setEditingLeaveType({
      id: '',
      name: '',
      code: '',
      isPaid: true,
      requiresApproval: true,
      carryOverAllowed: false,
      attachmentRequired: false,
      minUnit: 8,
    });
    setLeaveTypeDialogOpen(true);
  };

  const handleEditLeaveType = (leaveType: LeaveType) => {
    setEditingLeaveType(leaveType);
    setLeaveTypeDialogOpen(true);
  };

  const handleSaveLeaveType = () => {
    if (editingLeaveType) {
      if (editingLeaveType.id) {
        // 更新
        setSpecialLeaveTypes(prev =>
          prev.map(lt => lt.id === editingLeaveType.id ? editingLeaveType : lt)
        );
      } else {
        // 新規追加
        setSpecialLeaveTypes(prev => [...prev, {
          ...editingLeaveType,
          id: Date.now().toString(),
        }]);
      }
    }
    setLeaveTypeDialogOpen(false);
    setEditingLeaveType(null);
  };

  const handleDeleteLeaveType = (id: string) => {
    if (window.confirm('この休暇種別を削除してもよろしいですか？')) {
      setSpecialLeaveTypes(prev => prev.filter(lt => lt.id !== id));
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        休暇管理設定
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        有給休暇の付与ルール、特別休暇の種類、休暇取得に関する各種設定を行います。
      </Typography>

      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          設定を保存しました
        </Alert>
      )}

      {/* 有給休暇設定 */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        有給休暇設定
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            基本設定
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>付与タイミング</InputLabel>
                <Select
                  value={paidLeaveSettings.grantTiming}
                  onChange={(e) => setPaidLeaveSettings({
                    ...paidLeaveSettings,
                    grantTiming: e.target.value,
                  })}
                  label="付与タイミング"
                >
                  <MenuItem value="hire_date">入社日基準</MenuItem>
                  <MenuItem value="fiscal_year_start">年度初め一斉付与</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="初回付与までの月数"
                type="number"
                value={paidLeaveSettings.initialGrantAfterMonths}
                onChange={(e) => setPaidLeaveSettings({
                  ...paidLeaveSettings,
                  initialGrantAfterMonths: parseInt(e.target.value),
                })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">ヶ月</InputAdornment>,
                }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            付与日数テーブル
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>勤続年数</TableCell>
                  <TableCell align="right">付与日数</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paidLeaveSettings.grantRules.map((rule, index) => (
                  <TableRow key={index}>
                    <TableCell>{rule.yearsOfService}年</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={rule.days}
                        onChange={(e) => {
                          const newRules = [...paidLeaveSettings.grantRules];
                          newRules[index].days = parseInt(e.target.value);
                          setPaidLeaveSettings({
                            ...paidLeaveSettings,
                            grantRules: newRules,
                          });
                        }}
                        InputProps={{
                          endAdornment: <InputAdornment position="end">日</InputAdornment>,
                        }}
                        sx={{ width: 120 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            繰越・失効設定
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={paidLeaveSettings.carryOverEnabled}
                  onChange={(e) => setPaidLeaveSettings({
                    ...paidLeaveSettings,
                    carryOverEnabled: e.target.checked,
                  })}
                />
              }
              label="翌年度への繰越を許可"
            />
          </FormGroup>
          {paidLeaveSettings.carryOverEnabled && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="最大繰越日数"
                  type="number"
                  value={paidLeaveSettings.maxCarryOverDays}
                  onChange={(e) => setPaidLeaveSettings({
                    ...paidLeaveSettings,
                    maxCarryOverDays: parseInt(e.target.value),
                  })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">日</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="失効期限"
                  type="number"
                  value={paidLeaveSettings.expirationYears}
                  onChange={(e) => setPaidLeaveSettings({
                    ...paidLeaveSettings,
                    expirationYears: parseInt(e.target.value),
                  })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">年</InputAdornment>,
                  }}
                />
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            取得単位設定
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={paidLeaveSettings.halfDayLeaveEnabled}
                  onChange={(e) => setPaidLeaveSettings({
                    ...paidLeaveSettings,
                    halfDayLeaveEnabled: e.target.checked,
                  })}
                />
              }
              label="半日単位での取得を許可"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={paidLeaveSettings.hourlyLeaveEnabled}
                  onChange={(e) => setPaidLeaveSettings({
                    ...paidLeaveSettings,
                    hourlyLeaveEnabled: e.target.checked,
                  })}
                />
              }
              label="時間単位での取得を許可"
            />
          </FormGroup>
          {paidLeaveSettings.hourlyLeaveEnabled && (
            <TextField
              label="時間単位年休の年間上限"
              type="number"
              value={paidLeaveSettings.maxHourlyLeaveDaysPerYear}
              onChange={(e) => setPaidLeaveSettings({
                ...paidLeaveSettings,
                maxHourlyLeaveDaysPerYear: parseInt(e.target.value),
              })}
              InputProps={{
                endAdornment: <InputAdornment position="end">日分</InputAdornment>,
              }}
              sx={{ mt: 2, maxWidth: 300 }}
            />
          )}
        </CardContent>
      </Card>

      <Divider sx={{ my: 4 }} />

      {/* 特別休暇設定 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          特別休暇設定
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddLeaveType}
        >
          休暇種別を追加
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>休暇名称</TableCell>
              <TableCell>コード</TableCell>
              <TableCell>有給/無給</TableCell>
              <TableCell>年間上限</TableCell>
              <TableCell>承認</TableCell>
              <TableCell>繰越</TableCell>
              <TableCell align="center">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {specialLeaveTypes.map((leaveType) => (
              <TableRow key={leaveType.id}>
                <TableCell>{leaveType.name}</TableCell>
                <TableCell>{leaveType.code}</TableCell>
                <TableCell>
                  <Chip
                    label={leaveType.isPaid ? '有給' : '無給'}
                    color={leaveType.isPaid ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {leaveType.maxDaysPerYear ? `${leaveType.maxDaysPerYear}日` : '無制限'}
                </TableCell>
                <TableCell>
                  {leaveType.requiresApproval ? '必要' : '不要'}
                </TableCell>
                <TableCell>
                  {leaveType.carryOverAllowed ? '可' : '不可'}
                </TableCell>
                <TableCell align="center">
                  <IconButton
                    size="small"
                    onClick={() => handleEditLeaveType(leaveType)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteLeaveType(leaveType.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Divider sx={{ my: 4 }} />

      {/* 休暇取得ルール */}
      <Typography variant="h6" gutterBottom>
        休暇取得ルール
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="申請期限（デフォルト）"
            type="number"
            value={leaveRules.advanceNoticeDefault}
            onChange={(e) => setLeaveRules({
              ...leaveRules,
              advanceNoticeDefault: parseInt(e.target.value),
            })}
            InputProps={{
              endAdornment: <InputAdornment position="end">日前まで</InputAdornment>,
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="取消期限"
            type="number"
            value={leaveRules.cancellationDeadline}
            onChange={(e) => setLeaveRules({
              ...leaveRules,
              cancellationDeadline: parseInt(e.target.value),
            })}
            InputProps={{
              endAdornment: <InputAdornment position="end">日前まで</InputAdornment>,
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="連続取得上限"
            type="number"
            value={leaveRules.consecutiveDaysLimit}
            onChange={(e) => setLeaveRules({
              ...leaveRules,
              consecutiveDaysLimit: parseInt(e.target.value),
            })}
            InputProps={{
              endAdornment: <InputAdornment position="end">日</InputAdornment>,
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="最低出勤率要件"
            type="number"
            value={leaveRules.minStaffRequirement * 100}
            onChange={(e) => setLeaveRules({
              ...leaveRules,
              minStaffRequirement: parseInt(e.target.value) / 100,
            })}
            InputProps={{
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            }}
          />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={leaveRules.blackoutDatesEnabled}
                onChange={(e) => setLeaveRules({
                  ...leaveRules,
                  blackoutDatesEnabled: e.target.checked,
                })}
              />
            }
            label="繁忙期の取得制限を有効にする"
          />
          <FormControlLabel
            control={
              <Switch
                checked={leaveRules.autoApproveEnabled}
                onChange={(e) => setLeaveRules({
                  ...leaveRules,
                  autoApproveEnabled: e.target.checked,
                })}
              />
            }
            label="条件を満たす申請を自動承認する"
          />
          <FormControlLabel
            control={
              <Switch
                checked={leaveRules.multiLevelApproval}
                onChange={(e) => setLeaveRules({
                  ...leaveRules,
                  multiLevelApproval: e.target.checked,
                })}
              />
            }
            label="複数段階承認を有効にする"
          />
        </FormGroup>
      </Box>

      {/* 特別休暇編集ダイアログ */}
      <Dialog
        open={leaveTypeDialogOpen}
        onClose={() => setLeaveTypeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingLeaveType?.id ? '休暇種別を編集' : '休暇種別を追加'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="休暇名称"
                value={editingLeaveType?.name || ''}
                onChange={(e) => setEditingLeaveType(prev => ({
                  ...prev!,
                  name: e.target.value,
                }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="コード"
                value={editingLeaveType?.code || ''}
                onChange={(e) => setEditingLeaveType(prev => ({
                  ...prev!,
                  code: e.target.value,
                }))}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editingLeaveType?.isPaid || false}
                    onChange={(e) => setEditingLeaveType(prev => ({
                      ...prev!,
                      isPaid: e.target.checked,
                    }))}
                  />
                }
                label="有給休暇として扱う"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editingLeaveType?.requiresApproval || false}
                    onChange={(e) => setEditingLeaveType(prev => ({
                      ...prev!,
                      requiresApproval: e.target.checked,
                    }))}
                  />
                }
                label="承認を必要とする"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="年間上限日数"
                type="number"
                value={editingLeaveType?.maxDaysPerYear || ''}
                onChange={(e) => setEditingLeaveType(prev => ({
                  ...prev!,
                  maxDaysPerYear: e.target.value ? parseInt(e.target.value) : undefined,
                }))}
                helperText="空欄の場合は無制限"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editingLeaveType?.carryOverAllowed || false}
                    onChange={(e) => setEditingLeaveType(prev => ({
                      ...prev!,
                      carryOverAllowed: e.target.checked,
                    }))}
                  />
                }
                label="翌年度への繰越を許可"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editingLeaveType?.attachmentRequired || false}
                    onChange={(e) => setEditingLeaveType(prev => ({
                      ...prev!,
                      attachmentRequired: e.target.checked,
                    }))}
                  />
                }
                label="証明書類の添付を必須にする"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveTypeDialogOpen(false)}>
            キャンセル
          </Button>
          <Button onClick={handleSaveLeaveType} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          size="large"
        >
          設定を保存
        </Button>
      </Box>
    </Box>
  );
}