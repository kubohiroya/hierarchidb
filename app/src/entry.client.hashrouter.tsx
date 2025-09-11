import { startTransition, StrictMode, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { RouteObject } from 'react-router-dom';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import routes from './routes';
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

//  HashRouter
//  GitHub Pages

async function createApp() {
  const resolvedRoutes = await routes;
  // flatRoutes() provides RouteConfig entries; cast to RouteObject[] for client router
  return createHashRouter(resolvedRoutes as unknown as RouteObject[]);
}

createApp().then((router) => {
  startTransition(() => {
    const root = document.getElementById('root');
    if (!root) throw new Error('Root element not found');
    try {
      const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/');
      const b = typeof base === 'string' ? base : '/';
      if (b && b !== '/' && location.pathname.startsWith(b) && !location.hash) {
        const rest = location.pathname.slice(b.length - (b.endsWith('/') ? 1 : 0));
        location.replace(`${b}#${rest}${location.search}`);
        return;
      }
    } catch {}

    function Providers({ children }: { children: React.ReactNode }) {
      const theme = useMemo(() => createAppTheme('light'), []);
      useEffect(() => { try { console.log('[HDB-BOOT] AppShell mount'); } catch {} }, []);
      return (
        <BootProgressProvider>
          <AppConfigProvider>
            <SimpleBFFAuthProvider>
              <LanguageProvider>
                <StyledEngineProvider injectFirst>
                  <ThemeProvider theme={theme}>
                    <CustomThemeProvider>
                      <CssBaseline />
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
                    </CustomThemeProvider>
                  </ThemeProvider>
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
