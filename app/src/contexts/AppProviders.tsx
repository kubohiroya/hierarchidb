import { setCorsProxyBaseURL } from '@hierarchidb/download';
import { NotificationSystem } from '@hierarchidb/ui-plugin-shell/components';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-plugin-shell/ui-auth';
import { LanguageProvider } from '@hierarchidb/ui-plugin-shell/ui-i18n';
import { ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-plugin-shell/ui-theme';
import { FloatingWindowPortalProvider } from '@hierarchidb/ui-floating-window';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { AppConfigProvider } from '../contexts/AppConfigContext.js';
import { BootProgressProvider } from '../contexts/BootProgressProvider.js';
import { WorkerProvider } from '../contexts/WorkerProvider.js';
import {
  AuthReadyReporter,
  ConfigReadyReporter,
  I18nReadyReporter,
  ThemeReadyReporter,
  UIReadyReporter,
  WorkerProgressReporter,
} from './AppReporters.js';
import { AppThemeProvider } from './AppThemeProvider.js';
import { AppIconRegistryProvider } from './IconRegistryProvider.js';
import { LanguageEventsBridge } from './LanguageEventsBridge.js';

// UI-thread default CORS proxy (worker側と同等に初期化しておく)
{
  const value = typeof import.meta.env?.VITE_CORS_PROXY_BASE_URL === 'string'
    ? import.meta.env.VITE_CORS_PROXY_BASE_URL.trim()
    : '';
  if (!value) {
    throw new Error('VITE_CORS_PROXY_BASE_URL is required for app startup.');
  }
  setCorsProxyBaseURL(value);
}

/**
 * Common providers wrapper for both React Router and TanStack Router
 * This component abstracts all the shared context providers needed by the application
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const workerFallback = (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: (theme) => theme.palette.background.default,
        zIndex: 1400,
      }}
    >
      <CircularProgress size={32} thickness={5} />
    </Box>
  );

  return (
    <BootProgressProvider>
      <AppConfigProvider>
        <SimpleBFFAuthProvider>
          <LanguageProvider>
            <StyledEngineProvider injectFirst>
              <CustomThemeProvider>
                <AppThemeProvider>
                  <CssBaseline />
                  <LanguageEventsBridge />
                  <NotificationSystem />
                  <ConfigReadyReporter />
                  <ThemeReadyReporter />
                  <UIReadyReporter />
                  <I18nReadyReporter />
                  <AuthReadyReporter />
                  <AppIconRegistryProvider>
                    <WorkerProvider renderOverlay={false} fallback={workerFallback}>
                      <WorkerProgressReporter />
                      <FloatingWindowPortalProvider>
                        {children}
                      </FloatingWindowPortalProvider>
                    </WorkerProvider>
                  </AppIconRegistryProvider>
                </AppThemeProvider>
              </CustomThemeProvider>
            </StyledEngineProvider>
          </LanguageProvider>
        </SimpleBFFAuthProvider>
      </AppConfigProvider>
    </BootProgressProvider>
  );
}
