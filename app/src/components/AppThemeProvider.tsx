import React, { PropsWithChildren, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme, useThemeMode, type ThemeMode } from '@hierarchidb/ui-theme';

export function AppThemeProvider({ children }: PropsWithChildren<{}>) {
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

  // Sync initial mode from toolbar storage key if present
  useEffect(() => {
    try {
      const stored = localStorage.getItem('app.theme');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setMode(stored as any);
      }
    } catch {}
  }, [setMode]);

  const muiTheme = useMemo(() => createAppTheme(actualTheme), [actualTheme]);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}
