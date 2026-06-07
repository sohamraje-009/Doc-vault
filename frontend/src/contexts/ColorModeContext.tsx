import { createContext, useContext } from 'react';
import type { PaletteMode } from '@mui/material';

interface ColorModeContextValue {
  mode: PaletteMode;
  toggleMode: () => void;
}

export const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined);

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (!context) {
    throw new Error('useColorMode must be used within ColorModeContext');
  }
  return context;
}
