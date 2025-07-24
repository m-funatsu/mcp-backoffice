import React from 'react';
import { Box, Typography, Alert } from '@mui/material';

interface WorkflowSettingsProps {
  onChangesSaved?: () => void;
}

export default function WorkflowSettings({ onChangesSaved }: WorkflowSettingsProps) {
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        承認ワークフロー設定
      </Typography>
      <Alert severity="info">
        申請・承認フローの設定機能は開発中です。
      </Alert>
    </Box>
  );
}