import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

interface ShiftSettingsProps {
  onChangesSaved?: () => void;
}

export default function ShiftSettings({ onChangesSaved }: ShiftSettingsProps) {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        シフト管理設定
      </Typography>
      <Alert severity="info">
        シフトパターン、勤務体系の設定機能は開発中です。
      </Alert>
    </Box>
  );
}