import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

interface PayrollSettingsProps {
  onChangesSaved?: () => void;
}

export default function PayrollSettings({ onChangesSaved }: PayrollSettingsProps) {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        給与計算設定
      </Typography>
      <Alert severity="info">
        給与計算に関する設定機能は開発中です。
      </Alert>
    </Box>
  );
}