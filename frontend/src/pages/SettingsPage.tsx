import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
  LinearProgress,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { AxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { docvaultService, formatBytes, formatDateTime } from '@/services/docvaultService';

function getApiError(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ detail?: string | Array<{ msg: string }> }>;
  const detail = axiosError.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join(', ');
  return fallback;
}

function SettingValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={700} textAlign="right">{value}</Typography>
    </Stack>
  );
}

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name ?? '',
    email: user?.email ?? '',
    phone_number: user?.phone_number ?? '',
    profile_picture: user?.profile_picture ?? '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [preferences, setPreferences] = useState(() => {
    const saved = localStorage.getItem('docvault_notification_preferences');
    return saved
      ? JSON.parse(saved)
      : { login: true, upload: true, download: true, security: true };
  });

  const { data: overview, isLoading } = useQuery({
    queryKey: ['settings-overview'],
    queryFn: docvaultService.settingsOverview,
  });

  useEffect(() => {
    setProfileForm({
      full_name: user?.full_name ?? '',
      email: user?.email ?? '',
      phone_number: user?.phone_number ?? '',
      profile_picture: user?.profile_picture ?? '',
    });
  }, [user]);

  useEffect(() => {
    if (searchParams.get('profile') === '1') {
      setProfileOpen(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const profileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: async () => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['settings-overview'] });
      setProfileOpen(false);
      setNotice('Profile settings saved.');
    },
  });

  const passwordMutation = useMutation({
    mutationFn: authService.changePassword,
    onSuccess: () => {
      setPasswordOpen(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      setNotice('Password changed successfully.');
    },
  });

  const passwordError = useMemo(() => {
    if (!passwordForm.new_password && !passwordForm.confirm_password) return '';
    if (passwordForm.new_password.length < 8) return 'New password must be at least 8 characters.';
    if (passwordForm.new_password !== passwordForm.confirm_password) return 'New password and confirmation do not match.';
    return '';
  }, [passwordForm]);

  const updatePreference = (key: keyof typeof preferences, value: boolean) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    localStorage.setItem('docvault_notification_preferences', JSON.stringify(next));
  };

  const handleProfilePicture = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProfileForm((current) => ({ ...current, profile_picture: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) return <LinearProgress />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Settings</Typography>
      {notice && <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert>}
      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6">Application</Typography>
            <Typography color="text.secondary">Devgiri Forgings - Secure Enterprise Document Management System</Typography>
            <Typography sx={{ mt: 2 }}>Signed in as {user?.full_name} ({user?.role}).</Typography>
          </Box>

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" onClick={() => setProfileOpen(true)}>Profile Settings</Button>
            <Button variant="outlined" onClick={() => setPasswordOpen(true)}>Change Password</Button>
          </Stack>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Security Information</Typography>
                <Stack spacing={1}>
                  <SettingValue label="Account Status" value={overview?.security.account_status ?? user?.status} />
                  <SettingValue label="Role" value={overview?.security.role ?? user?.role} />
                  <SettingValue
                    label="Last Login Time"
                    value={overview?.security.last_login_time ? formatDateTime(overview.security.last_login_time) : 'Not available'}
                  />
                  <SettingValue label="Authentication Method" value={overview?.security.authentication_method ?? 'JWT'} />
                  <SettingValue label="Active Session Count" value={overview?.security.active_session_count ?? 1} />
                </Stack>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>System Information</Typography>
                <Stack spacing={1}>
                  <SettingValue label="Application Version" value={overview?.system.application_version ?? '1.0.0'} />
                  <SettingValue label="FastAPI Version" value={overview?.system.fastapi_version ?? 'Unknown'} />
                  <SettingValue label="Database Type" value={overview?.system.database_type ?? 'Unknown'} />
                  <SettingValue label="Environment" value={overview?.system.environment ?? 'development'} />
                  <SettingValue label="Docker Status" value={overview?.system.docker_status ?? 'Not detected'} />
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>Session Management</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Device</TableCell>
                  <TableCell>Browser</TableCell>
                  <TableCell>Last Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(overview?.sessions ?? []).map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{session.device}</TableCell>
                    <TableCell>{session.browser}</TableCell>
                    <TableCell>{session.last_active ? formatDateTime(session.last_active) : 'Current session'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => void logout()}>Logout Session</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button color="error" sx={{ mt: 1 }} onClick={() => void logout().then(() => navigate('/login'))}>
              Logout All Devices
            </Button>
          </Paper>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Notification Preferences</Typography>
                <Stack>
                  <FormControlLabel control={<Switch checked={preferences.login} onChange={(e) => updatePreference('login', e.target.checked)} />} label="Login Alerts" />
                  <FormControlLabel control={<Switch checked={preferences.upload} onChange={(e) => updatePreference('upload', e.target.checked)} />} label="Document Upload Alerts" />
                  <FormControlLabel control={<Switch checked={preferences.download} onChange={(e) => updatePreference('download', e.target.checked)} />} label="Download Alerts" />
                  <FormControlLabel control={<Switch checked={preferences.security} onChange={(e) => updatePreference('security', e.target.checked)} />} label="Security Alerts" />
                </Stack>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Storage Statistics</Typography>
                <Stack spacing={1}>
                  <SettingValue label="Total Documents" value={overview?.storage.total_documents ?? 0} />
                  <SettingValue label="Total Downloads" value={overview?.storage.total_downloads ?? 0} />
                  <SettingValue label="Total Users" value={overview?.storage.total_users ?? 0} />
                  <SettingValue label="Storage Usage" value={formatBytes(overview?.storage.storage_usage ?? 0)} />
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="h6" gutterBottom>Activity Summary</Typography>
            <Stack spacing={1}>
              {overview?.activity.length ? overview.activity.map((activity) => (
                <Stack key={activity.id} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                  <Typography variant="body2">{activity.details || activity.action.replaceAll('_', ' ')}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatDateTime(activity.created_at)}</Typography>
                </Stack>
              )) : <Typography color="text.secondary">No activity yet.</Typography>}
            </Stack>
          </Paper>
        </Stack>
      </Paper>

      <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Profile Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {profileMutation.isError && (
              <Alert severity="error">
                {getApiError(profileMutation.error, 'Could not save profile settings.')}
              </Alert>
            )}
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={profileForm.profile_picture || undefined} sx={{ width: 64, height: 64 }}>
                {profileForm.full_name.charAt(0) || 'U'}
              </Avatar>
              <Button variant="outlined" component="label">
                Upload profile picture
                <input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => handleProfilePicture(event.target.files?.[0])} />
              </Button>
            </Stack>
            <TextField label="Full name" value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} fullWidth required />
            <TextField label="Email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} fullWidth required />
            <TextField label="Phone number" value={profileForm.phone_number} onChange={(e) => setProfileForm({ ...profileForm, phone_number: e.target.value })} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={profileMutation.isPending || !profileForm.full_name.trim() || !profileForm.email.trim()}
            onClick={() => profileMutation.mutate({
              full_name: profileForm.full_name.trim(),
              email: profileForm.email.trim(),
              phone_number: profileForm.phone_number.trim() || null,
              profile_picture: profileForm.profile_picture || null,
            })}
          >
            Save changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {passwordMutation.isError && (
              <Alert severity="error">
                {getApiError(passwordMutation.error, 'Could not change password.')}
              </Alert>
            )}
            {passwordError && <Alert severity="warning">{passwordError}</Alert>}
            <TextField label="Current password" type="password" value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} fullWidth required />
            <TextField label="New password" type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} fullWidth required helperText="Minimum 8 characters" />
            <TextField label="Confirm password" type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} fullWidth required />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={passwordMutation.isPending || Boolean(passwordError) || !passwordForm.current_password}
            onClick={() => passwordMutation.mutate(passwordForm)}
          >
            Change password
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
