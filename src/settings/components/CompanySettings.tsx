/**
 * 会社情報設定コンポーネント
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
  Stack,
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

interface CompanySettingsProps {
  onChangesSaved?: () => void;
}

export default function CompanySettings({ onChangesSaved }: CompanySettingsProps) {
  const [formData, setFormData] = useState({
    companyName: '株式会社サンプル',
    companyNameKana: 'カブシキガイシャサンプル',
    postalCode: '100-0001',
    address: '東京都千代田区千代田1-1-1',
    phone: '03-1234-5678',
    fax: '03-1234-5679',
    email: 'info@sample.co.jp',
    ceoName: '山田太郎',
    establishedDate: '2000-04-01',
    fiscalYearStart: '04',
    closingDay: '25',
    paymentDay: '25',
    workWeek: ['mon', 'tue', 'wed', 'thu', 'fri'],
    businessHours: {
      start: '09:00',
      end: '18:00',
    },
    lunchBreak: {
      start: '12:00',
      end: '13:00',
    },
  });

  const [saved, setSaved] = useState(false);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    // API呼び出しをここに実装
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    if (onChangesSaved) {
      onChangesSaved();
    }
  };

  const weekDays = [
    { value: 'mon', label: '月' },
    { value: 'tue', label: '火' },
    { value: 'wed', label: '水' },
    { value: 'thu', label: '木' },
    { value: 'fri', label: '金' },
    { value: 'sat', label: '土' },
    { value: 'sun', label: '日' },
  ];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        会社情報設定
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        会社の基本情報を設定します。ここで設定した情報は各種帳票や通知に使用されます。
      </Typography>

      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          設定を保存しました
        </Alert>
      )}

      {/* 基本情報 */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        基本情報
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="会社名"
            value={formData.companyName}
            onChange={(e) => handleChange('companyName', e.target.value)}
            required
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="会社名（カナ）"
            value={formData.companyNameKana}
            onChange={(e) => handleChange('companyNameKana', e.target.value)}
            required
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="郵便番号"
            value={formData.postalCode}
            onChange={(e) => handleChange('postalCode', e.target.value)}
            placeholder="123-4567"
          />
        </Grid>
        <Grid item xs={12} md={8}>
          <TextField
            fullWidth
            label="住所"
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="電話番号"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="FAX番号"
            value={formData.fax}
            onChange={(e) => handleChange('fax', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="メールアドレス"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="代表者名"
            value={formData.ceoName}
            onChange={(e) => handleChange('ceoName', e.target.value)}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="設立年月日"
            type="date"
            value={formData.establishedDate}
            onChange={(e) => handleChange('establishedDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* 会計期間設定 */}
      <Typography variant="h6" gutterBottom>
        会計期間設定
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>会計年度開始月</InputLabel>
            <Select
              value={formData.fiscalYearStart}
              onChange={(e) => handleChange('fiscalYearStart', e.target.value)}
              label="会計年度開始月"
            >
              {[...Array(12)].map((_, i) => (
                <MenuItem key={i} value={String(i + 1).padStart(2, '0')}>
                  {i + 1}月
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>締め日</InputLabel>
            <Select
              value={formData.closingDay}
              onChange={(e) => handleChange('closingDay', e.target.value)}
              label="締め日"
            >
              <MenuItem value="10">10日</MenuItem>
              <MenuItem value="15">15日</MenuItem>
              <MenuItem value="20">20日</MenuItem>
              <MenuItem value="25">25日</MenuItem>
              <MenuItem value="末">月末</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={4}>
          <FormControl fullWidth>
            <InputLabel>支払日</InputLabel>
            <Select
              value={formData.paymentDay}
              onChange={(e) => handleChange('paymentDay', e.target.value)}
              label="支払日"
            >
              <MenuItem value="10">10日</MenuItem>
              <MenuItem value="15">15日</MenuItem>
              <MenuItem value="20">20日</MenuItem>
              <MenuItem value="25">25日</MenuItem>
              <MenuItem value="末">月末</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      {/* 営業日・勤務時間設定 */}
      <Typography variant="h6" gutterBottom>
        営業日・勤務時間設定
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          営業日
        </Typography>
        <Stack direction="row" spacing={1}>
          {weekDays.map((day) => (
            <Chip
              key={day.value}
              label={day.label}
              color={formData.workWeek.includes(day.value) ? 'primary' : 'default'}
              onClick={() => {
                const newWorkWeek = formData.workWeek.includes(day.value)
                  ? formData.workWeek.filter(d => d !== day.value)
                  : [...formData.workWeek, day.value];
                handleChange('workWeek', newWorkWeek);
              }}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Stack>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            標準勤務時間
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="開始時刻"
              type="time"
              value={formData.businessHours.start}
              onChange={(e) => handleChange('businessHours', {
                ...formData.businessHours,
                start: e.target.value,
              })}
              InputLabelProps={{ shrink: true }}
            />
            <Typography>〜</Typography>
            <TextField
              label="終了時刻"
              type="time"
              value={formData.businessHours.end}
              onChange={(e) => handleChange('businessHours', {
                ...formData.businessHours,
                end: e.target.value,
              })}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom>
            昼休憩時間
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="開始時刻"
              type="time"
              value={formData.lunchBreak.start}
              onChange={(e) => handleChange('lunchBreak', {
                ...formData.lunchBreak,
                start: e.target.value,
              })}
              InputLabelProps={{ shrink: true }}
            />
            <Typography>〜</Typography>
            <TextField
              label="終了時刻"
              type="time"
              value={formData.lunchBreak.end}
              onChange={(e) => handleChange('lunchBreak', {
                ...formData.lunchBreak,
                end: e.target.value,
              })}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </Grid>
      </Grid>

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