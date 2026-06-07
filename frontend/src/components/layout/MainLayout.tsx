import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import BusinessIcon from '@mui/icons-material/Business';
import HistoryIcon from '@mui/icons-material/History';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import SecurityIcon from '@mui/icons-material/Security';
import LogoutIcon from '@mui/icons-material/Logout';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import PersonIcon from '@mui/icons-material/Person';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useColorMode } from '@/contexts/ColorModeContext';
import { docvaultService, formatDateTime } from '@/services/docvaultService';

const DRAWER_WIDTH = 260;

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, adminOnly: false },
  { label: 'Documents', path: '/documents', icon: <DescriptionIcon />, adminOnly: false },
  { label: 'Upload', path: '/upload', icon: <CloudUploadIcon />, adminOnly: false },
  { label: 'Departments', path: '/departments', icon: <BusinessIcon />, adminOnly: true },
  { label: 'Download History', path: '/history', icon: <HistoryIcon />, adminOnly: true },
  { label: 'Users', path: '/users', icon: <PeopleIcon />, adminOnly: true },
  { label: 'Activity Center', path: '/activity', icon: <ManageSearchIcon />, adminOnly: true },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon />, adminOnly: false },
];

export default function MainLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const [securityAnchor, setSecurityAnchor] = useState<null | HTMLElement>(null);
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);
  const { user, logout, isAdmin } = useAuth();
  const notificationReadKey = `docvault_notifications_read_at_${user?.id ?? 'anonymous'}`;
  const [notificationsReadAt, setNotificationsReadAt] = useState(() => localStorage.getItem(notificationReadKey) ?? '');
  const { mode, toggleMode } = useColorMode();
  const navigate = useNavigate();
  const visibleNav = navItems.filter((item) => !item.adminOnly || isAdmin);
  const { data: activity } = useQuery({
    queryKey: ['topbar-activity'],
    queryFn: () => docvaultService.activity({ page_size: 5 }),
    enabled: isAdmin,
  });
  const unreadNotifications =
    activity?.items.filter((item) => !notificationsReadAt || new Date(item.created_at) > new Date(notificationsReadAt)) ?? [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const markNotificationsRead = () => {
    const latestActivityTime = activity?.items[0]?.created_at;
    const readAt = latestActivityTime ? new Date(latestActivityTime).toISOString() : new Date().toISOString();
    localStorage.setItem(notificationReadKey, readAt);
    setNotificationsReadAt(readAt);
  };

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2.5 }}>
        <Box
          component="img"
          src="/Logo_Devgiri.jpg"
          alt="Devgiri Forgings"
          sx={{ width: 96, maxWidth: '100%', display: 'block', mb: 1 }}
        />
        <Typography variant="h6" fontWeight={800} color="primary.main">
          Devgiri Forgings
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Secure Enterprise Document Management System
        </Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1, px: 1, py: 1 }}>
        {visibleNav.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            onClick={() => isMobile && setMobileOpen(false)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              '&.active': {
                bgcolor: 'primary.main',
                color: 'white',
                '& .MuiListItemIcon-root': { color: 'white' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 500 }} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
          Copyright {new Date().getFullYear()} Devgiri Forgings. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
            Welcome, {user?.full_name}
          </Typography>
          <Tooltip title="Notifications">
            <IconButton onClick={(event) => setNotificationAnchor(event.currentTarget)}>
              <Badge color="error" badgeContent={unreadNotifications.length}>
                <NotificationsNoneIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title="Security">
            <IconButton onClick={(event) => setSecurityAnchor(event.currentTarget)}>
              <SecurityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Profile">
            <IconButton onClick={(event) => setProfileAnchor(event.currentTarget)} sx={{ ml: 1 }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14 }}>
                {user?.full_name?.charAt(0) ?? 'U'}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton onClick={() => void handleLogout()} sx={{ ml: 0.5 }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={() => setNotificationAnchor(null)}
        PaperProps={{ sx: { width: 360, maxWidth: 'calc(100vw - 32px)' } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography fontWeight={700}>Notifications</Typography>
              <Typography variant="caption" color="text.secondary">
                Unread system activity
              </Typography>
            </Box>
            <Button size="small" onClick={markNotificationsRead} disabled={!unreadNotifications.length}>
              Mark all read
            </Button>
          </Stack>
        </Box>
        <Divider />
        {isAdmin && unreadNotifications.length ? (
          unreadNotifications.map((item) => (
            <MenuItem key={item.id} onClick={() => setNotificationAnchor(null)} sx={{ alignItems: 'flex-start', py: 1.25 }}>
              <Stack spacing={0.25}>
                <Typography variant="body2" fontWeight={600}>
                  {item.action.replaceAll('_', ' ')}
                </Typography>
                <Typography variant="caption" color="text.secondary" whiteSpace="normal">
                  {item.details || 'System activity'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(item.created_at)}
                </Typography>
              </Stack>
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>No new notifications</MenuItem>
        )}
      </Menu>

      <Menu
        anchorEl={securityAnchor}
        open={Boolean(securityAnchor)}
        onClose={() => setSecurityAnchor(null)}
        PaperProps={{ sx: { width: 340, maxWidth: 'calc(100vw - 32px)' } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: 'success.main' }}>
              <VerifiedUserIcon />
            </Avatar>
            <Box>
              <Typography fontWeight={700}>Security Center</Typography>
              <Typography variant="caption" color="text.secondary">
                Signed in and protected by JWT
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Account status</Typography>
              <Typography variant="body2" fontWeight={700}>{user?.status}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Role</Typography>
              <Typography variant="body2" fontWeight={700}>{user?.role}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">Department</Typography>
              <Typography variant="body2" fontWeight={700}>{user?.department_name || 'Not assigned'}</Typography>
            </Stack>
          </Stack>
        </Box>
        <Divider />
        {isAdmin && (
          <MenuItem onClick={() => { setSecurityAnchor(null); navigate('/activity'); }}>
            <ListItemIcon><ManageSearchIcon fontSize="small" /></ListItemIcon>
            Activity Center
          </MenuItem>
        )}
        {isAdmin && (
          <MenuItem onClick={() => { setSecurityAnchor(null); navigate('/history'); }}>
            <ListItemIcon><HistoryIcon fontSize="small" /></ListItemIcon>
            Download History
          </MenuItem>
        )}
        <MenuItem onClick={() => { setSecurityAnchor(null); navigate('/settings'); }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          Security Settings
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={profileAnchor}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        PaperProps={{ sx: { width: 300 } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: 'primary.main' }}>{user?.full_name?.charAt(0) ?? 'U'}</Avatar>
            <Box>
              <Typography fontWeight={700}>{user?.full_name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.username} - {user?.role}
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setProfileAnchor(null); navigate('/settings?profile=1'); }}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          Profile Settings
        </MenuItem>
        <MenuItem onClick={toggleMode}>
          <ListItemIcon><DarkModeIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Dark mode" />
          <Switch checked={mode === 'dark'} size="small" />
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => void handleLogout()}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
