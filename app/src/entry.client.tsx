import { startTransition, StrictMode, useEffect } from 'react';
if (import.meta.env.DEV) import('./dev-health-client.js');
import { createRoot } from 'react-dom/client';
import type { RouteObject } from 'react-router-dom';
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from 'react-router-dom';
import routes from './routes.js';
import { initializeDefaultNodeDialogExtensions } from '@hierarchidb/plugins-folder-plugin';
import { BootProgressProvider } from './contexts/BootProgressProvider.js';
import { AppConfigProvider } from './contexts/AppConfigContext.js';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-auth';
import { LanguageProvider } from '@hierarchidb/ui-i18n';
import { CssBaseline } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-theme';
import { AppThemeProvider } from './components/AppThemeProvider.js';
import { registerTableStateCleanupEvents } from './shared/table-state.js';
import { LanguageEventsBridge } from './components/LanguageEventsBridge.js';
import { NotificationSystem } from '@hierarchidb/ui-core';
import { WorkerProvider } from './contexts/WorkerProvider.js';
import {
  WorkerProgressReporter,
  ConfigReadyReporter,
  ThemeReadyReporter,
  UIReadyReporter,
  I18nReadyReporter,
  AuthReadyReporter,
} from './init/InitReporters.js';

type RouterMode = 'browser' | 'hash';

const ROUTER_MODE: RouterMode =
  (import.meta.env.VITE_ROUTER_MODE?.toLowerCase() as RouterMode | undefined) ?? 'browser';

function getBasePath(): string {
  const base = import.meta?.env?.BASE_URL ?? '/';
  if (typeof base !== 'string') return '/';
  return base.endsWith('/') ? base.slice(0, -1) || '/' : base;
}

async function createAppRouter() {
  const resolvedRoutes = (await routes) as unknown as RouteObject[];
  await initializeDefaultNodeDialogExtensions();
  const basePath = getBasePath();

  if (ROUTER_MODE === 'hash') {
    if (
      basePath !== '/' &&
      location.pathname.startsWith(basePath) &&
      !location.hash
    ) {
      const rest = location.pathname.slice(basePath.length);
      const normalized = `/${rest}`.replace(/\/+/, '/');
      location.replace(`${basePath}#${normalized}${location.search}`);
    }
    return createHashRouter(resolvedRoutes);
  }

  return createBrowserRouter(resolvedRoutes, {
    basename: basePath === '/' ? undefined : basePath,
  });
}

function removeHydrateFallback(): void {
  document.getElementById('hdb-hydrate-fallback')?.remove();
}

createAppRouter().then((router) => {
  startTransition(() => {
    let rootElement = document.getElementById('root');
    if (!rootElement) {
      rootElement = document.createElement('div');
      rootElement.id = 'root';
      document.body.appendChild(rootElement);
    }

    removeHydrateFallback();

    function Providers({ children }: { children: React.ReactNode }) {
      useEffect(() => {
        registerTableStateCleanupEvents();
      }, []);

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

    createRoot(rootElement).render(
      <StrictMode>
        <Providers>
          <RouterProvider router={router} />
        </Providers>
      </StrictMode>,
    );
  });
});
