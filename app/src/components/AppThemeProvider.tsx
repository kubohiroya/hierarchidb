import {
  createAppTheme,
  getStoredThemeMode,
  type ThemeMode,
  useThemeMode,
} from '@hierarchidb/ui-shell/ui-theme';
import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material';
import { type PropsWithChildren, useEffect, useMemo } from 'react';

export function AppThemeProvider({ children }: PropsWithChildren<unknown>) {
  const { actualTheme, setMode } = useThemeMode();

  // Bridge custom events from UI to theme context
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { mode?: ThemeMode } | undefined;
      if (!detail?.mode) return;
      setMode(detail.mode);
    };
    window.addEventListener('hierarchidb-theme-change', handler as EventListener);
    return () => window.removeEventListener('hierarchidb-theme-change', handler as EventListener);
  }, [setMode]);

  // Sync initial mode from storage if present (supports both ui-theme and legacy keys)
  useEffect(() => {
    const mode = getStoredThemeMode();
    if (mode) setMode(mode);
    // Back-compat fallback
    const legacy = localStorage.getItem('app.theme');
    if (legacy === 'light' || legacy === 'dark' || legacy === 'system') setMode(legacy);
  }, [setMode]);

  const muiTheme = useMemo(() => createAppTheme(actualTheme), [actualTheme]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
