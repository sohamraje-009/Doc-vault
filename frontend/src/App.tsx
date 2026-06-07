import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import type { PaletteMode } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ColorModeContext } from '@/contexts/ColorModeContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import MainLayout from '@/components/layout/MainLayout';
import LoginPage from '@/pages/LoginPage';
import ActivityPage from '@/pages/ActivityPage';
import DashboardPage from '@/pages/DashboardPage';
import DepartmentsPage from '@/pages/DepartmentsPage';
import DocumentsPage from '@/pages/DocumentsPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import UploadPage from '@/pages/UploadPage';
import UsersPage from '@/pages/UsersPage';
import getTheme from '@/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  const [mode, setMode] = useState<PaletteMode>(() => {
    const savedMode = localStorage.getItem('docvault_color_mode');
    return savedMode === 'dark' ? 'dark' : 'light';
  });
  const theme = useMemo(() => getTheme(mode), [mode]);
  const colorMode = useMemo(
    () => ({
      mode,
      toggleMode: () =>
        setMode((current) => {
          const next = current === 'light' ? 'dark' : 'light';
          localStorage.setItem('docvault_color_mode', next);
          return next;
        }),
    }),
    [mode],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                  <Route element={<MainLayout />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/documents" element={<DocumentsPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/activity" element={<ActivityPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/upload" element={<UploadPage />} />
                  </Route>
                </Route>
                <Route element={<ProtectedRoute adminOnly />}>
                  <Route element={<MainLayout />}>
                    <Route path="/departments" element={<DepartmentsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </ColorModeContext.Provider>
    </QueryClientProvider>
  );
}
