import { type ReactNode } from 'react';
import { BootProgressProvider } from '../../contexts/BootProgressProvider.js';
import { AppConfigProvider } from '../../contexts/AppConfigContext.js';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-auth';
import { LanguageProvider } from '@hierarchidb/ui-i18n';
import { CssBaseline } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-theme';
import { AppThemeProvider } from '../../components/AppThemeProvider.js';
import { LanguageEventsBridge } from '../../components/LanguageEventsBridge.js';
import { NotificationSystem } from '@hierarchidb/components';
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
                  <WorkerProvider renderOverlay={false}>
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
