import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Button,
  Grid,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  History as HistoryIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
  Search as SearchIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ja from 'date-fns/locale/ja';
import { AuditLog, AuditLogFilter } from '../types';
import AuditLogService from '../services/AuditLogService';

export default function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // フィルター
  const [filters, setFilters] = useState<AuditLogFilter>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 過去7日間
    endDate: new Date(),
    action: '',
    resource: '',
    userId: '',
    severity: '',
  });
  
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [page, rowsPerPage, filters]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await AuditLogService.getLogs({
        ...filters,
        page,
        limit: rowsPerPage,
      });
      setLogs(result.logs);
      setTotalCount(result.total);
    } catch (error) {
      console.error('監査ログの読み込みに失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field: keyof AuditLogFilter, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleExport = async () => {
    try {
      await AuditLogService.exportLogs(filters);
      // 実際の実装では、ファイルダウンロードを処理
    } catch (error) {
      console.error('エクスポートに失敗しました:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  const getActionTypeColor = (action: string) => {
    if (action.includes('delete')) return 'error';
    if (action.includes('create')) return 'success';
    if (action.includes('update')) return 'primary';
    if (action.includes('login')) return 'info';
    return 'default';
  };

  const formatDetails = (details: any): string => {
    if (typeof details === 'string') return details;
    return JSON.stringify(details, null, 2);
  };

  return (
    <Card>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon />
            <span>監査ログ</span>
          </Box>
        }
        action={
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<FilterListIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              フィルター
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
            >
              エクスポート
            </Button>
          </Box>
        }
      />
      <CardContent>
        {/* フィルターセクション */}
        {showFilters && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ja}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <DateTimePicker
                    label="開始日時"
                    value={filters.startDate}
                    onChange={(value) => handleFilterChange('startDate', value)}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <DateTimePicker
                    label="終了日時"
                    value={filters.endDate}
                    onChange={(value) => handleFilterChange('endDate', value)}
                    slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>アクション</InputLabel>
                    <Select
                      value={filters.action}
                      onChange={(e) => handleFilterChange('action', e.target.value)}
                      label="アクション"
                    >
                      <MenuItem value="">すべて</MenuItem>
                      <MenuItem value="create">作成</MenuItem>
                      <MenuItem value="update">更新</MenuItem>
                      <MenuItem value="delete">削除</MenuItem>
                      <MenuItem value="login">ログイン</MenuItem>
                      <MenuItem value="logout">ログアウト</MenuItem>
                      <MenuItem value="export">エクスポート</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>リソース</InputLabel>
                    <Select
                      value={filters.resource}
                      onChange={(e) => handleFilterChange('resource', e.target.value)}
                      label="リソース"
                    >
                      <MenuItem value="">すべて</MenuItem>
                      <MenuItem value="user">ユーザー</MenuItem>
                      <MenuItem value="role">役割</MenuItem>
                      <MenuItem value="employee">従業員</MenuItem>
                      <MenuItem value="attendance">勤怠</MenuItem>
                      <MenuItem value="payroll">給与</MenuItem>
                      <MenuItem value="expense">経費</MenuItem>
                      <MenuItem value="settings">設定</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    label="ユーザーID"
                    value={filters.userId}
                    onChange={(e) => handleFilterChange('userId', e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Grid>
              </Grid>
            </LocalizationProvider>
          </Paper>
        )}

        {/* ログテーブル */}
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>日時</TableCell>
                <TableCell>ユーザー</TableCell>
                <TableCell>アクション</TableCell>
                <TableCell>リソース</TableCell>
                <TableCell>IPアドレス</TableCell>
                <TableCell>重要度</TableCell>
                <TableCell>詳細</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(log.timestamp).toLocaleString('ja-JP')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.userName || log.userId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.action}
                      size="small"
                      color={getActionTypeColor(log.action)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.resource}
                      {log.resourceId && ` (${log.resourceId})`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {log.ipAddress}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {log.severity && (
                      <Chip
                        label={log.severity}
                        size="small"
                        color={getSeverityColor(log.severity)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedLog(log);
                        setDetailDialogOpen(true);
                      }}
                    >
                      <InfoIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage="表示件数:"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}件`}
          />
        </TableContainer>

        {/* 詳細ダイアログ */}
        <Dialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>ログ詳細</DialogTitle>
          <DialogContent>
            {selectedLog && (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      日時
                    </Typography>
                    <Typography variant="body1">
                      {new Date(selectedLog.timestamp).toLocaleString('ja-JP')}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      ユーザー
                    </Typography>
                    <Typography variant="body1">
                      {selectedLog.userName || selectedLog.userId}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      アクション
                    </Typography>
                    <Typography variant="body1">
                      {selectedLog.action}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      リソース
                    </Typography>
                    <Typography variant="body1">
                      {selectedLog.resource}
                      {selectedLog.resourceId && ` (${selectedLog.resourceId})`}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      IPアドレス
                    </Typography>
                    <Typography variant="body1">
                      {selectedLog.ipAddress}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" color="text.secondary">
                      ユーザーエージェント
                    </Typography>
                    <Typography variant="body1">
                      {selectedLog.userAgent || '-'}
                    </Typography>
                  </Grid>
                  {selectedLog.details && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle2" color="text.secondary">
                        詳細情報
                      </Typography>
                      <Paper sx={{ p: 2, mt: 1, bgcolor: 'grey.50' }}>
                        <Typography
                          variant="body2"
                          component="pre"
                          sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
                        >
                          {formatDetails(selectedLog.details)}
                        </Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialogOpen(false)}>閉じる</Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}