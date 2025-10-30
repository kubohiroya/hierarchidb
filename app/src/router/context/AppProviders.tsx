import { type ReactNode } from 'react';
import { BootProgressProvider } from '../../contexts/BootProgressProvider.js';
import { AppConfigProvider } from '../../contexts/AppConfigContext.js';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-shell/ui-auth';
import { LanguageProvider } from '@hierarchidb/ui-shell/ui-i18n';
import { Box, CssBaseline, CircularProgress } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-shell/ui-theme';
import { AppThemeProvider } from '../../components/AppThemeProvider.js';
import { LanguageEventsBridge } from '../../components/LanguageEventsBridge.js';
import { NotificationSystem } from '@hierarchidb/ui-shell/components';
import { WorkerProvider } from '../../contexts/WorkerProvider.js';
import {
  WorkerProgressReporter,
  ConfigReadyReporter,
  ThemeReadyReporter,
  UIReadyReporter,
  I18nReadyReporter,
  AuthReadyReporter,
} from '../../init/InitReporters.js';

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
                  <WorkerProvider renderOverlay={false} fallback={workerFallback}>
                    <WorkerProgressReporter />
                    {children}
                  </WorkerProvider>
                </AppThemeProvider>
              </CustomThemeProvider>
            </StyledEngineProvider>
          </LanguageProvider>
        </SimpleBFFAuthProvider>
      </AppConfigProvider>
    </BootProgressProvider>
  );
}
