import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormControlLabel,
  Paper,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';

type AuthMode = 'login' | 'forgot';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await login({ username: username.trim(), password: password.trim(), remember_me: rememberMe });
      navigate(from, { replace: true });
    } catch {
      setError('Invalid username or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await authService.forgotPassword(identifier.trim());
      setSuccess(response.message);
      setResetToken('');
    } catch {
      setError('Could not start password reset. Check the username or email and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      await authService.resetPassword(resetToken.trim(), newPassword.trim());
      setSuccess('Password reset successfully. Sign in with your new password.');
      setPassword('');
      setNewPassword('');
      setResetToken('');
      setMode('login');
    } catch {
      setError('Could not reset password. The reset code may be expired or the password is invalid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${alpha(theme.palette.secondary.main, 0.8)} 100%)`,
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={24} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 3, backdropFilter: 'blur(8px)' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                width: 92,
                height: 72,
                borderRadius: 2,
                bgcolor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
                boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
                overflow: 'hidden',
              }}
            >
              <Box
                component="img"
                src="/Logo_Devgiri.jpg"
                alt="Devgiri Forgings"
                sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 0.75 }}
              />
            </Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Devgiri Forgings
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Secure Enterprise Document Management System
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

          {mode === 'login' ? (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                label="Username"
                fullWidth
                required
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={<Checkbox checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} color="primary" />}
                label="Remember me"
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isSubmitting}
                startIcon={<LockOutlinedIcon />}
                sx={{ py: 1.5, fontWeight: 600, textTransform: 'none', fontSize: '1rem' }}
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
              <Button
                type="button"
                fullWidth
                sx={{ mt: 1.5 }}
                onClick={() => {
                  setError(null);
                  setSuccess(null);
                  setIdentifier(username);
                  setMode('forgot');
                }}
              >
                Forgot password?
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleForgotPassword} noValidate>
              <TextField
                label="Username or email"
                fullWidth
                required
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button type="submit" variant="contained" fullWidth disabled={!identifier.trim() || isSubmitting}>
                Generate reset code
              </Button>
              <TextField
                label="Reset code"
                fullWidth
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                sx={{ mt: 2 }}
                multiline
                minRows={2}
              />
              <TextField
                label="New password"
                type="password"
                fullWidth
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                sx={{ mt: 2 }}
                helperText="Minimum 8 characters"
              />
              <Button
                type="button"
                variant="contained"
                fullWidth
                disabled={!resetToken.trim() || newPassword.trim().length < 8 || isSubmitting}
                onClick={() => void handleResetPassword()}
                sx={{ mt: 2 }}
              >
                Reset password
              </Button>
              <Button
                type="button"
                fullWidth
                sx={{ mt: 1.5 }}
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccess(null);
                }}
              >
                Back to sign in
              </Button>
            </Box>
          )}

        </Paper>
      </Container>
    </Box>
  );
}
