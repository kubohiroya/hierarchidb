import { FloatingWindowPortalProvider } from '@hierarchidb/components';
import { setCorsProxyBaseURL } from '@hierarchidb/download';
import { NotificationSystem } from '@hierarchidb/ui-plugin-shell/components';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-plugin-shell/ui-auth';
import { LanguageProvider } from '@hierarchidb/ui-plugin-shell/ui-i18n';
import { ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-plugin-shell/ui-theme';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { resolveRequiredCorsProxyBaseURL } from '~/config/resolveRequiredCorsProxyBaseURL';
import { AppConfigProvider } from '~/contexts/AppConfigContext';
import { BootProgressProvider } from '~/contexts/BootProgressProvider';
import { WorkerProvider } from '~/contexts/WorkerProvider';
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

// Configure the UI-thread CORS proxy before providers initialize.
{
  const value = resolveRequiredCorsProxyBaseURL(import.meta.env?.VITE_CORS_PROXY_BASE_URL, 'app');
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
                      <FloatingWindowPortalProvider>{children}</FloatingWindowPortalProvider>
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
