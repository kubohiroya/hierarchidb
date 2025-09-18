import { startTransition, StrictMode, useMemo, useEffect } from 'react';
// Dev health overlay (dev only)
if (import.meta.env.DEV) import('./dev-health-client.js');
import { hydrateRoot } from 'react-dom/client';
import { initializeDefaultNodeDialogExtensions } from '@hierarchidb/folder-plugin';
// @ts-ignore
import { HydratedRouter } from 'react-router/dom';
import { BootProgressProvider, StageGate } from './contexts/BootProgressProvider.js';
import { AppConfigProvider } from './contexts/AppConfigContext.js';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-auth';
import { LanguageProvider } from '@hierarchidb/ui-i18n';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { createAppTheme, ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-theme';
import { NotificationSystem } from '@hierarchidb/ui-core';
import { WorkerProvider } from './contexts/WorkerProvider.js';
import { WorkerProgressReporter, ConfigReadyReporter, ThemeReadyReporter, UIReadyReporter, I18nReadyReporter, AuthReadyReporter } from './init/InitReporters.js';

// Do not wrap HydratedRouter with providers here; SSR markup must match exactly.

startTransition(() => {
  // Initialize node-type dialog extensions (shape/spreadsheet/basemap/styler) for SSR hydration path as well.
  // No DOM output; safe to run before hydration.
  void initializeDefaultNodeDialogExtensions();
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
