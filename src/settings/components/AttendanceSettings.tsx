/**
 * 勤怠設定コンポーネント
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
  Tabs,
  Tab,
  Slider,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

interface AttendanceSettingsProps {
  onChangesSaved?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AttendanceSettings({ onChangesSaved }: AttendanceSettingsProps) {
  const [tabValue, setTabValue] = useState(0);
  const [saved, setSaved] = useState(false);
  
  const [basicSettings, setBasicSettings] = useState({
    // 打刻設定
    allowMobileClockIn: true,
    allowWebClockIn: true,
    allowICCardClockIn: true,
    requireGPSLocation: true,
    gpsRadius: 100, // メートル
    
    // 打刻時刻の丸め設定
    roundingUnit: 15, // 分単位
    roundingRule: 'nearest', // nearest, up, down
    
    // 遅刻・早退設定
    lateThreshold: 1, // 分
    earlyLeaveThreshold: 1, // 分
    
    // 自動打刻設定
    autoClockOutEnabled: true,
    autoClockOutTime: '00:00',
    
    // 打刻修正
    allowSelfCorrection: false,
    correctionDeadlineDays: 3,
    requireCorrectionReason: true,
  });

  const [overtimeSettings, setOvertimeSettings] = useState({
    // 残業申請
    requireOvertimeRequest: true,
    overtimeRequestTiming: 'before', // before, after
    minOvertimeMinutes: 30,
    
    // 36協定設定
    monthlyOvertimeLimit: 45,
    yearlyOvertimeLimit: 360,
    specialClauseMonthlyLimit: 100,
    specialClauseYearlyLimit: 720,
    specialClauseMonthsLimit: 6,
    
    // 残業単価設定
    normalOvertimeRate: 1.25,
    lateNightRate: 1.5,
    holidayWorkRate: 1.35,
    holidayLateNightRate: 1.6,
  });

  const [breakSettings, setBreakSettings] = useState({
    // 休憩時間設定
    autoBreakDeduction: true,
    breakRules: [
      { workHours: 6, breakMinutes: 45 },
      { workHours: 8, breakMinutes: 60 },
    ],
    
    // 休憩取得管理
    requireBreakTimeInput: false,
    flexibleBreakTime: true,
    minBreakDuration: 30,
  });

  const [alertSettings, setAlertSettings] = useState({
    // アラート設定
    overtimeAlert: true,
    overtimeAlertThreshold: 40,
    
    missingClockInAlert: true,
    missingClockInAlertTime: '10:00',
    
    longWorkAlert: true,
    longWorkAlertHours: 10,
    
    // 通知先
    alertToEmployee: true,
    alertToManager: true,
    alertToHR: true,
  });

  const handleSave = () => {
    // API呼び出しをここに実装
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    if (onChangesSaved) {
      onChangesSaved();
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        勤怠設定
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        出退勤の打刻方法、勤務時間の計算ルール、残業管理などを設定します。
      </Typography>

      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          設定を保存しました
        </Alert>
      )}

      <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
        <Tab label="基本設定" />
        <Tab label="残業管理" />
        <Tab label="休憩設定" />
        <Tab label="アラート設定" />
      </Tabs>

      {/* 基本設定タブ */}
      <TabPanel value={tabValue} index={0}>
        <Typography variant="h6" gutterBottom>
          打刻方法
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={basicSettings.allowMobileClockIn}
                onChange={(e) => setBasicSettings({
                  ...basicSettings,
                  allowMobileClockIn: e.target.checked,
                })}
              />
            }
            label="モバイルアプリからの打刻を許可"
          />
          <FormControlLabel
            control={
              <Switch
                checked={basicSettings.allowWebClockIn}
                onChange={(e) => setBasicSettings({
                  ...basicSettings,
                  allowWebClockIn: e.target.checked,
                })}
              />
            }
            label="Webブラウザからの打刻を許可"
          />
          <FormControlLabel
            control={
              <Switch
                checked={basicSettings.allowICCardClockIn}
                onChange={(e) => setBasicSettings({
                  ...basicSettings,
                  allowICCardClockIn: e.target.checked,
                })}
              />
            }
            label="ICカードでの打刻を許可"
          />
        </FormGroup>

        {basicSettings.allowMobileClockIn && (
          <Card sx={{ mt: 2, mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                GPS位置情報設定
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={basicSettings.requireGPSLocation}
                    onChange={(e) => setBasicSettings({
                      ...basicSettings,
                      requireGPSLocation: e.target.checked,
                    })}
                  />
                }
                label="打刻時にGPS位置情報を必須にする"
              />
              {basicSettings.requireGPSLocation && (
                <TextField
                  fullWidth
                  label="許可範囲（半径）"
                  type="number"
                  value={basicSettings.gpsRadius}
                  onChange={(e) => setBasicSettings({
                    ...basicSettings,
                    gpsRadius: parseInt(e.target.value),
                  })}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">メートル</InputAdornment>,
                  }}
                  sx={{ mt: 2 }}
                />
              )}
            </CardContent>
          </Card>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          打刻時刻の丸め設定
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>丸め単位</InputLabel>
              <Select
                value={basicSettings.roundingUnit}
                onChange={(e) => setBasicSettings({
                  ...basicSettings,
                  roundingUnit: e.target.value as number,
                })}
                label="丸め単位"
              >
                <MenuItem value={1}>1分単位</MenuItem>
                <MenuItem value={5}>5分単位</MenuItem>
                <MenuItem value={10}>10分単位</MenuItem>
                <MenuItem value={15}>15分単位</MenuItem>
                <MenuItem value={30}>30分単位</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>丸め方法</InputLabel>
              <Select
                value={basicSettings.roundingRule}
                onChange={(e) => setBasicSettings({
                  ...basicSettings,
                  roundingRule: e.target.value,
                })}
                label="丸め方法"
              >
                <MenuItem value="nearest">最も近い時刻</MenuItem>
                <MenuItem value="up">切り上げ</MenuItem>
                <MenuItem value="down">切り捨て</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          打刻修正
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={basicSettings.allowSelfCorrection}
                onChange={(e) => setBasicSettings({
                  ...basicSettings,
                  allowSelfCorrection: e.target.checked,
                })}
              />
            }
            label="従業員本人による打刻修正を許可"
          />
          {basicSettings.allowSelfCorrection && (
            <>
              <TextField
                label="修正可能期限"
                type="number"
                value={basicSettings.correctionDeadlineDays}
                onChange={(e) => setBasicSettings({
                  ...basicSettings,
                  correctionDeadlineDays: parseInt(e.target.value),
                })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">日以内</InputAdornment>,
                }}
                sx={{ mt: 2, maxWidth: 300 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={basicSettings.requireCorrectionReason}
                    onChange={(e) => setBasicSettings({
                      ...basicSettings,
                      requireCorrectionReason: e.target.checked,
                    })}
                  />
                }
                label="修正理由の入力を必須にする"
                sx={{ mt: 1 }}
              />
            </>
          )}
        </FormGroup>
      </TabPanel>

      {/* 残業管理タブ */}
      <TabPanel value={tabValue} index={1}>
        <Typography variant="h6" gutterBottom>
          残業申請設定
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={overtimeSettings.requireOvertimeRequest}
              onChange={(e) => setOvertimeSettings({
                ...overtimeSettings,
                requireOvertimeRequest: e.target.checked,
              })}
            />
          }
          label="残業申請を必須にする"
        />
        {overtimeSettings.requireOvertimeRequest && (
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>申請タイミング</InputLabel>
                <Select
                  value={overtimeSettings.overtimeRequestTiming}
                  onChange={(e) => setOvertimeSettings({
                    ...overtimeSettings,
                    overtimeRequestTiming: e.target.value,
                  })}
                  label="申請タイミング"
                >
                  <MenuItem value="before">事前申請のみ</MenuItem>
                  <MenuItem value="after">事後申請も可</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="最小残業時間"
                type="number"
                value={overtimeSettings.minOvertimeMinutes}
                onChange={(e) => setOvertimeSettings({
                  ...overtimeSettings,
                  minOvertimeMinutes: parseInt(e.target.value),
                })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">分</InputAdornment>,
                }}
              />
            </Grid>
          </Grid>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          36協定設定
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          労働基準法に基づく時間外労働の上限を設定します
        </Alert>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="月間残業時間上限"
              type="number"
              value={overtimeSettings.monthlyOvertimeLimit}
              onChange={(e) => setOvertimeSettings({
                ...overtimeSettings,
                monthlyOvertimeLimit: parseInt(e.target.value),
              })}
              InputProps={{
                endAdornment: <InputAdornment position="end">時間</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="年間残業時間上限"
              type="number"
              value={overtimeSettings.yearlyOvertimeLimit}
              onChange={(e) => setOvertimeSettings({
                ...overtimeSettings,
                yearlyOvertimeLimit: parseInt(e.target.value),
              })}
              InputProps={{
                endAdornment: <InputAdornment position="end">時間</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              特別条項
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="特別条項月間上限"
              type="number"
              value={overtimeSettings.specialClauseMonthlyLimit}
              onChange={(e) => setOvertimeSettings({
                ...overtimeSettings,
                specialClauseMonthlyLimit: parseInt(e.target.value),
              })}
              InputProps={{
                endAdornment: <InputAdornment position="end">時間</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="特別条項年間上限"
              type="number"
              value={overtimeSettings.specialClauseYearlyLimit}
              onChange={(e) => setOvertimeSettings({
                ...overtimeSettings,
                specialClauseYearlyLimit: parseInt(e.target.value),
              })}
              InputProps={{
                endAdornment: <InputAdornment position="end">時間</InputAdornment>,
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="特別条項適用月数上限"
              type="number"
              value={overtimeSettings.specialClauseMonthsLimit}
              onChange={(e) => setOvertimeSettings({
                ...overtimeSettings,
                specialClauseMonthsLimit: parseInt(e.target.value),
              })}
              InputProps={{
                endAdornment: <InputAdornment position="end">ヶ月</InputAdornment>,
              }}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          割増賃金率
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>
              通常残業: {overtimeSettings.normalOvertimeRate}倍
            </Typography>
            <Slider
              value={overtimeSettings.normalOvertimeRate}
              onChange={(e, value) => setOvertimeSettings({
                ...overtimeSettings,
                normalOvertimeRate: value as number,
              })}
              min={1.0}
              max={2.0}
              step={0.05}
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>
              深夜労働: {overtimeSettings.lateNightRate}倍
            </Typography>
            <Slider
              value={overtimeSettings.lateNightRate}
              onChange={(e, value) => setOvertimeSettings({
                ...overtimeSettings,
                lateNightRate: value as number,
              })}
              min={1.0}
              max={2.0}
              step={0.05}
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>
              休日労働: {overtimeSettings.holidayWorkRate}倍
            </Typography>
            <Slider
              value={overtimeSettings.holidayWorkRate}
              onChange={(e, value) => setOvertimeSettings({
                ...overtimeSettings,
                holidayWorkRate: value as number,
              })}
              min={1.0}
              max={2.0}
              step={0.05}
              valueLabelDisplay="auto"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography gutterBottom>
              休日深夜: {overtimeSettings.holidayLateNightRate}倍
            </Typography>
            <Slider
              value={overtimeSettings.holidayLateNightRate}
              onChange={(e, value) => setOvertimeSettings({
                ...overtimeSettings,
                holidayLateNightRate: value as number,
              })}
              min={1.0}
              max={2.0}
              step={0.05}
              valueLabelDisplay="auto"
            />
          </Grid>
        </Grid>
      </TabPanel>

      {/* 休憩設定タブ */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h6" gutterBottom>
          休憩時間の自動控除
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={breakSettings.autoBreakDeduction}
              onChange={(e) => setBreakSettings({
                ...breakSettings,
                autoBreakDeduction: e.target.checked,
              })}
            />
          }
          label="勤務時間に応じて休憩時間を自動控除する"
        />

        {breakSettings.autoBreakDeduction && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              休憩時間ルール
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              労働基準法: 6時間超で45分以上、8時間超で60分以上の休憩が必要です
            </Alert>
            {breakSettings.breakRules.map((rule, index) => (
              <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="勤務時間"
                    type="number"
                    value={rule.workHours}
                    onChange={(e) => {
                      const newRules = [...breakSettings.breakRules];
                      newRules[index].workHours = parseInt(e.target.value);
                      setBreakSettings({
                        ...breakSettings,
                        breakRules: newRules,
                      });
                    }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">時間超</InputAdornment>,
                    }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="休憩時間"
                    type="number"
                    value={rule.breakMinutes}
                    onChange={(e) => {
                      const newRules = [...breakSettings.breakRules];
                      newRules[index].breakMinutes = parseInt(e.target.value);
                      setBreakSettings({
                        ...breakSettings,
                        breakRules: newRules,
                      });
                    }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">分</InputAdornment>,
                    }}
                  />
                </Grid>
              </Grid>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          休憩取得管理
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={breakSettings.requireBreakTimeInput}
                onChange={(e) => setBreakSettings({
                  ...breakSettings,
                  requireBreakTimeInput: e.target.checked,
                })}
              />
            }
            label="休憩開始・終了時刻の入力を必須にする"
          />
          <FormControlLabel
            control={
              <Switch
                checked={breakSettings.flexibleBreakTime}
                onChange={(e) => setBreakSettings({
                  ...breakSettings,
                  flexibleBreakTime: e.target.checked,
                })}
              />
            }
            label="休憩時間の分割取得を許可する"
          />
        </FormGroup>
        <TextField
          label="最小休憩時間"
          type="number"
          value={breakSettings.minBreakDuration}
          onChange={(e) => setBreakSettings({
            ...breakSettings,
            minBreakDuration: parseInt(e.target.value),
          })}
          InputProps={{
            endAdornment: <InputAdornment position="end">分</InputAdornment>,
          }}
          sx={{ mt: 2, maxWidth: 300 }}
        />
      </TabPanel>

      {/* アラート設定タブ */}
      <TabPanel value={tabValue} index={3}>
        <Typography variant="h6" gutterBottom>
          残業アラート
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={alertSettings.overtimeAlert}
              onChange={(e) => setAlertSettings({
                ...alertSettings,
                overtimeAlert: e.target.checked,
              })}
            />
          }
          label="月間残業時間のアラートを有効にする"
        />
        {alertSettings.overtimeAlert && (
          <TextField
            label="アラート閾値"
            type="number"
            value={alertSettings.overtimeAlertThreshold}
            onChange={(e) => setAlertSettings({
              ...alertSettings,
              overtimeAlertThreshold: parseInt(e.target.value),
            })}
            InputProps={{
              endAdornment: <InputAdornment position="end">時間</InputAdornment>,
            }}
            sx={{ mt: 2, display: 'block', maxWidth: 300 }}
          />
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          打刻忘れアラート
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={alertSettings.missingClockInAlert}
              onChange={(e) => setAlertSettings({
                ...alertSettings,
                missingClockInAlert: e.target.checked,
              })}
            />
          }
          label="出勤打刻忘れのアラートを有効にする"
        />
        {alertSettings.missingClockInAlert && (
          <TextField
            label="アラート時刻"
            type="time"
            value={alertSettings.missingClockInAlertTime}
            onChange={(e) => setAlertSettings({
              ...alertSettings,
              missingClockInAlertTime: e.target.value,
            })}
            InputLabelProps={{ shrink: true }}
            sx={{ mt: 2, display: 'block', maxWidth: 300 }}
          />
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          長時間労働アラート
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={alertSettings.longWorkAlert}
              onChange={(e) => setAlertSettings({
                ...alertSettings,
                longWorkAlert: e.target.checked,
              })}
            />
          }
          label="連続勤務時間のアラートを有効にする"
        />
        {alertSettings.longWorkAlert && (
          <TextField
            label="アラート時間"
            type="number"
            value={alertSettings.longWorkAlertHours}
            onChange={(e) => setAlertSettings({
              ...alertSettings,
              longWorkAlertHours: parseInt(e.target.value),
            })}
            InputProps={{
              endAdornment: <InputAdornment position="end">時間</InputAdornment>,
            }}
            sx={{ mt: 2, display: 'block', maxWidth: 300 }}
          />
        )}

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" gutterBottom>
          通知先設定
        </Typography>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={alertSettings.alertToEmployee}
                onChange={(e) => setAlertSettings({
                  ...alertSettings,
                  alertToEmployee: e.target.checked,
                })}
              />
            }
            label="本人に通知"
          />
          <FormControlLabel
            control={
              <Switch
                checked={alertSettings.alertToManager}
                onChange={(e) => setAlertSettings({
                  ...alertSettings,
                  alertToManager: e.target.checked,
                })}
              />
            }
            label="上長に通知"
          />
          <FormControlLabel
            control={
              <Switch
                checked={alertSettings.alertToHR}
                onChange={(e) => setAlertSettings({
                  ...alertSettings,
                  alertToHR: e.target.checked,
                })}
              />
            }
            label="人事部門に通知"
          />
        </FormGroup>
      </TabPanel>

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