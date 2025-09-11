import { startTransition, StrictMode, useMemo, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
// @ts-ignore
import { HydratedRouter } from 'react-router/dom';
import { BootProgressProvider, StageGate } from './contexts/BootProgressProvider';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-auth';
import { LanguageProvider } from '@hierarchidb/ui-i18n';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { createAppTheme, ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-theme';
import { NotificationSystem } from '@hierarchidb/ui-core';
import { WorkerProvider } from './contexts/WorkerProvider';
import { WorkerProgressReporter, ConfigReadyReporter, ThemeReadyReporter, UIReadyReporter, I18nReadyReporter, AuthReadyReporter } from './init/InitReporters';

// Do not wrap HydratedRouter with providers here; SSR markup must match exactly.

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
