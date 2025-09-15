import { startTransition, StrictMode, useEffect } from 'react';
// Dev health overlay (dev only)
if (import.meta.env.DEV) import('./dev-health-client');
import { createRoot } from 'react-dom/client';
import type { RouteObject } from 'react-router-dom';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import routes from './routes';
import { initializeDefaultNodeDialogExtensions } from '@hierarchidb/folder-plugin';
import { BootProgressProvider, StageGate } from './contexts/BootProgressProvider';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-auth';
import { LanguageProvider } from '@hierarchidb/ui-i18n';
import { CssBaseline } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-theme';
import { AppThemeProvider } from './components/AppThemeProvider';
import { registerTableStateCleanupEvents } from './shared/table-state';
import { LanguageEventsBridge } from './components/LanguageEventsBridge';
import { NotificationSystem } from '@hierarchidb/ui-core';
import { WorkerProvider } from './contexts/WorkerProvider';
import { WorkerProgressReporter, ConfigReadyReporter, ThemeReadyReporter, UIReadyReporter, I18nReadyReporter, AuthReadyReporter } from './init/InitReporters';

//  HashRouter
//  GitHub Pages

async function createApp() {
  const resolvedRoutes = await routes;
  // Initialize node-type folder dialog extensions (shape/spreadsheet/basemap/styler) if available
  await initializeDefaultNodeDialogExtensions();
  // flatRoutes() provides RouteConfig entries; cast to RouteObject[] for client router
  return createHashRouter(resolvedRoutes as unknown as RouteObject[]);
}

createApp().then((router) => {
  startTransition(() => {
    const root = document.getElementById('root');
    if (!root) throw new Error('Root element not found');
    const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/');
    const b = typeof base === 'string' ? base : '/';
    if (b && b !== '/' && location.pathname.startsWith(b) && !location.hash) {
      const rest = location.pathname.slice(b.length - (b.endsWith('/') ? 1 : 0));
      const normalized = `/${rest}`.replace(/\/+/, '/');
      location.replace(`${b}#${normalized}${location.search}`);
      return;
    }

    function Providers({ children }: { children: React.ReactNode }) {
      
      useEffect(() => { registerTableStateCleanupEvents(); }, []);
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
                      {/* Mark non-worker steps as ready */}
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

    createRoot(root).render(
      <StrictMode>
        <Providers>
          <div style={{position:'fixed',top:4,left:4,zIndex:9999,background:'#eef',padding:'2px 6px',borderRadius:4,fontSize:12}}>AppFrame</div>
          <RouterProvider router={router} />
        </Providers>
      </StrictMode>,
    );
  });
});
