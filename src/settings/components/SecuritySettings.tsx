import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

interface SecuritySettingsProps {
  onChangesSaved?: () => void;
}

export default function SecuritySettings({ onChangesSaved }: SecuritySettingsProps) {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        セキュリティ設定
      </Typography>
      <Alert severity="info">
        アクセス権限、セキュリティポリシーの設定機能は開発中です。
      </Alert>
    </Box>
  );
}