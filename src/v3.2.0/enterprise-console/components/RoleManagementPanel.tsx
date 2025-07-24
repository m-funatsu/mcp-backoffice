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
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
  IconButton,
  Typography,
  Tabs,
  Tab,
  FormGroup,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { Role, Permission, User } from '../types';
import RBACService from '../services/RBACService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`role-tabpanel-${index}`}
      aria-labelledby={`role-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function RoleManagementPanel() {
  const [tabValue, setTabValue] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Partial<Role>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesData, permissionsData, usersData] = await Promise.all([
        RBACService.getRoles(),
        RBACService.getPermissions(),
        RBACService.getUsers(),
      ]);
      setRoles(rolesData);
      setPermissions(permissionsData);
      setUsers(usersData);
    } catch (err) {
      setError('データの読み込みに失敗しました');
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setIsEditDialogOpen(true);
  };

  const handleDeleteRole = (role: Role) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveRole = async () => {
    try {
      if (editingRole.id) {
        await RBACService.updateRole(editingRole.id, editingRole as Role);
        setSuccess('役割を更新しました');
      } else {
        await RBACService.createRole(editingRole as Omit<Role, 'id'>);
        setSuccess('役割を作成しました');
      }
      setIsEditDialogOpen(false);
      loadData();
    } catch (err) {
      setError('保存に失敗しました');
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedRole) {
      try {
        await RBACService.deleteRole(selectedRole.id);
        setSuccess('役割を削除しました');
        setIsDeleteDialogOpen(false);
        loadData();
      } catch (err) {
        setError('削除に失敗しました');
      }
    }
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    const currentPermissions = editingRole.permissions || [];
    if (checked) {
      setEditingRole({
        ...editingRole,
        permissions: [...currentPermissions, permissionId],
      });
    } else {
      setEditingRole({
        ...editingRole,
        permissions: currentPermissions.filter(p => p !== permissionId),
      });
    }
  };

  const getUserCountByRole = (roleId: string): number => {
    return users.filter(user => user.roles?.includes(roleId)).length;
  };

  return (
    <Card>
      <CardHeader
        title={
          <Box display="flex" alignItems="center" gap={1}>
            <SecurityIcon />
            <span>役割と権限管理</span>
          </Box>
        }
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingRole({ name: '', description: '', permissions: [] });
              setIsEditDialogOpen(true);
            }}
          >
            新規作成
          </Button>
        }
      />
      <CardContent>
        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="役割一覧" />
          <Tab label="権限一覧" />
          <Tab label="ユーザー割り当て" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>役割名</TableCell>
                  <TableCell>説明</TableCell>
                  <TableCell>権限数</TableCell>
                  <TableCell>ユーザー数</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <Typography variant="body1" fontWeight="bold">
                        {role.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{role.description}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${role.permissions?.length || 0}個`}
                        size="small"
                        color="primary"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${getUserCountByRole(role.id)}人`}
                        size="small"
                        color="secondary"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleEditRole(role)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteRole(role)}
                        color="error"
                        disabled={role.isSystem}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>権限名</TableCell>
                  <TableCell>リソース</TableCell>
                  <TableCell>アクション</TableCell>
                  <TableCell>説明</TableCell>
                  <TableCell>使用中の役割</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {permissions.map((permission) => (
                  <TableRow key={permission.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {permission.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={permission.resource} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={permission.action}
                        size="small"
                        color={permission.action === 'write' ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{permission.description}</TableCell>
                    <TableCell>
                      {roles
                        .filter(role => role.permissions?.includes(permission.id))
                        .map(role => (
                          <Chip
                            key={role.id}
                            label={role.name}
                            size="small"
                            sx={{ mr: 0.5 }}
                          />
                        ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ユーザー名</TableCell>
                  <TableCell>メールアドレス</TableCell>
                  <TableCell>割り当て済み役割</TableCell>
                  <TableCell>最終ログイン</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Typography variant="body1">
                        {user.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.roles?.map(roleId => {
                        const role = roles.find(r => r.id === roleId);
                        return role ? (
                          <Chip
                            key={roleId}
                            label={role.name}
                            size="small"
                            sx={{ mr: 0.5 }}
                            color="primary"
                          />
                        ) : null;
                      })}
                    </TableCell>
                    <TableCell>
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleString('ja-JP')
                        : '未ログイン'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* 役割編集ダイアログ */}
        <Dialog
          open={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editingRole.id ? '役割を編集' : '新規役割を作成'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="役割名"
                value={editingRole.name || ''}
                onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="説明"
                value={editingRole.description || ''}
                onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />
              <Typography variant="subtitle1" sx={{ mt: 2 }}>
                権限の割り当て
              </Typography>
              <FormGroup>
                {permissions.map((permission) => (
                  <FormControlLabel
                    key={permission.id}
                    control={
                      <Checkbox
                        checked={editingRole.permissions?.includes(permission.id) || false}
                        onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">{permission.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {permission.resource} - {permission.action}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsEditDialogOpen(false)}>キャンセル</Button>
            <Button
              onClick={handleSaveRole}
              variant="contained"
              disabled={!editingRole.name}
            >
              保存
            </Button>
          </DialogActions>
        </Dialog>

        {/* 削除確認ダイアログ */}
        <Dialog
          open={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
        >
          <DialogTitle>役割を削除</DialogTitle>
          <DialogContent>
            <Typography>
              「{selectedRole?.name}」を削除してもよろしいですか？
              この操作は取り消せません。
            </Typography>
            {selectedRole && getUserCountByRole(selectedRole.id) > 0 && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                この役割は{getUserCountByRole(selectedRole.id)}人のユーザーに割り当てられています。
                削除すると、これらのユーザーの権限が失われます。
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsDeleteDialogOpen(false)}>キャンセル</Button>
            <Button
              onClick={handleConfirmDelete}
              color="error"
              variant="contained"
            >
              削除
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}