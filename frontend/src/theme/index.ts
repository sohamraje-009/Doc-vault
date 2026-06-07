import { createTheme, type PaletteMode } from '@mui/material/styles';

const getTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: '#2563EB',
        dark: '#1E40AF',
        light: '#3B82F6',
      },
      secondary: {
        main: '#0F766E',
      },
      background: {
        default: mode === 'light' ? '#F8FAFC' : '#0F172A',
        paper: mode === 'light' ? '#FFFFFF' : '#111827',
      },
      text: {
        primary: mode === 'light' ? '#0F172A' : '#E5E7EB',
        secondary: mode === 'light' ? '#64748B' : '#94A3B8',
      },
      divider: mode === 'light' ? '#E2E8F0' : '#1F2937',
    },
    typography: {
      fontFamily: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: {
      borderRadius: 10,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            backgroundColor: mode === 'light' ? '#F1F5F9' : '#1F2937',
          },
        },
      },
    },
  });

export default getTheme;
