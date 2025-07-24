import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

interface NotificationSettingsProps {
  onChangesSaved?: () => void;
}

export default function NotificationSettings({ onChangesSaved }: NotificationSettingsProps) {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        通知設定
      </Typography>
      <Alert severity="info">
        メール通知、アラートの設定機能は開発中です。
      </Alert>
    </Box>
  );
}