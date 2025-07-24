import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

interface SystemSettingsProps {
  onChangesSaved?: () => void;
}

export default function SystemSettings({ onChangesSaved }: SystemSettingsProps) {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        システム設定
      </Typography>
      <Alert severity="info">
        システム全般の設定とメンテナンス機能は開発中です。
      </Alert>
    </Box>
  );
}