import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router-dom';
import {useRouteError} from 'react-router';
import { CssBaseline } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { bootLog } from './utils/bootLog';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-theme';
import { LanguageProvider } from '@hierarchidb/ui-i18n';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-auth';
import { WorkerProvider } from './contexts/WorkerProvider';
import { InitInspector } from './dev/InitInspector';
// Initialize UI plugins
import { NotificationSystem, registerAllUIPlugins } from '@hierarchidb/ui-core';
import { APP_VERSION, BUILD_TIME } from './version';
// Bridge: provide app's Worker client hook to shape-plugin UI hooks
import { registerWorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';
import { useWorkerAPIClient } from './hooks/useWorkerAPIClient';
import { BootProgressProvider } from './contexts/BootProgressProvider';
import { AppThemeProvider } from './components/AppThemeProvider';
import { LanguageEventsBridge } from './components/LanguageEventsBridge';
import { AuthReadyReporter, ConfigReadyReporter, I18nReadyReporter, ThemeReadyReporter, UIReadyReporter, WorkerProgressReporter } from './init/InitReporters';
import { setGlobalMuiIconMap } from '@hierarchidb/ui-icon';
import { autoLoadPlugins } from './plugins/auto-load';

// Log version and build time at startup (local time)
try {
  const localBuildTime = (() => {
    try {
      return new Date(BUILD_TIME).toLocaleString();
    } catch {
      return String(BUILD_TIME);
    }
  })();
  // eslint-disable-next-line no-console
  console.log(`[App] Version: ${APP_VERSION} | Build Time (local): ${localBuildTime}`);
} catch {
  throw new Error('Failed to log app version/build time');
}

// Register the app-provided hook once at module load
try {
  registerWorkerClientHook(useWorkerAPIClient);
} catch {
  throw new Error('Failed to register worker client hook');
}

declare global {
  interface Window {
    __uiPluginsRegistered?: boolean;
  }
}

// Initialize worker URL configuration

// Register all UI plugins at startup (only once)
if (typeof window !== 'undefined' && !window.__uiPluginsRegistered) {
  // Load plugins discovered by virtual modules (data-driven, no switch-case)
  try { await autoLoadPlugins(); } catch (e) { console.warn('[root] autoLoadPlugins failed', e); }
  // Keep legacy/stub registration as a fallback (no-ops when already registered)
  registerAllUIPlugins();
  window.__uiPluginsRegistered = true;
}

// Pre-load WorkerAPIClient module to ensure it's available when WorkerSingletonProvider needs it
// This doesn't initialize the worker, just ensures the module is loaded
if (typeof window !== 'undefined') {
  import('./WorkerAPIClient').then(({ WorkerAPIClient }) => {

  }).catch(error => {
    console.error('[root.tsx] Failed to load WorkerAPIClient module:', error);
  });

  // Warm-load menu builders in all modes so DynamicSpeedDial can build items
  try {
    import('./plugins/menu-builders')
      .then(async (mod) => {
        // @eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__HDB_MENU_BUILDERS__ = mod;
        // Warm icon chunks for both contexts
        try { await (mod as any).prefetchIconsForAllContexts?.(); } catch {
          throw new Error('Failed to prefetch icons for all contexts');
        }
      })
      .catch((err) => {
        console.warn('[root.tsx] menu-builders preload failed (will fallback to worker plugins):', err);
      });
  } catch {
    throw new Error('Failed to preload menu builders');
  }

  // Inject app-generated static MUI icon map for ui-icon to use globally
  import('virtual:mui-icon-map')
    .then((mod: any) => {
      try { setGlobalMuiIconMap(mod.default || mod.iconMap || {}); } catch {}
    })
    .catch(() => {
      // ignore; ui-icon will fallback to its internal static map/dynamic import
    });
}

//const appPrefix = import.meta.env.VITE_APP_PREFIX || '/';
//<meta name="viewport" content="width=device-width, initial-scale=1.0" />
//<base href={appPrefix} />
//

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
    <head>
      <Meta />
      <Links />
    </head>
    <body suppressHydrationWarning>
    {children}
    <ScrollRestoration />
    <Scripts />
    </body>
    </html>
  );
}

export function HydrateFallback() {

  // Simple splash screen without complex theme providers to avoid hydration issues
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Minimal, framework-agnostic spinner to avoid hydration/style issues */}
      <div
        aria-label="Loading"
        role="status"
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid #e0e0e0',
          borderTopColor: '#1976d2',
          borderRadius: '50%',
          animation: 'hdb-spin 0.8s linear infinite',
        }}
      />
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes hdb-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `,
      }} />
    </div>
  );
}

export function ErrorBoundary() {
  let error: unknown = useRouteError();

  const isDevelopment = import.meta.env.MODE === 'development';

  // In development, log the full error to console for better debugging
  if (isDevelopment) {
    console.error('ErrorBoundary caught error:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
      console.error('Error cause:', error.cause);
    }
  }

  return (
    <div style={{
      padding: '20px',
      color: 'red',
      fontFamily: 'monospace',
      backgroundColor: '#fff5f5',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      margin: '20px',
    }}>
      <h1 style={{ color: '#dc2626', marginBottom: '20px' }}>
        {isDevelopment ? 'Development Error' : 'Application Error'}
      </h1>

      <h3 style={{ color: '#991b1b', marginBottom: '10px' }}>Message:</h3>
      <pre style={{
        backgroundColor: '#fef2f2',
        padding: '10px',
        borderRadius: '4px',
        marginBottom: '20px',
        overflow: 'auto',
      }}>
        {error instanceof Error ? error.message : JSON.stringify(error, null, 2)}
      </pre>

      {error instanceof Error && error.stack && (
        <>
          <h3 style={{ color: '#991b1b', marginBottom: '10px' }}>Stack Trace:</h3>
          <pre style={{
            fontSize: '12px',
            backgroundColor: '#fef2f2',
            padding: '10px',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '300px',
            marginBottom: '20px',
          }}>
            {error.stack}
          </pre>
        </>
      )}

      {isDevelopment && error instanceof Error && error.cause ? (
        <>
          <h3 style={{ color: '#991b1b', marginBottom: '10px' }}>Cause:</h3>
          <pre style={{
            fontSize: '12px',
            backgroundColor: '#fef2f2',
            padding: '10px',
            borderRadius: '4px',
            overflow: 'auto',
            marginBottom: '20px',
          }}>
            {JSON.stringify(error.cause, null, 2)}
          </pre>
        </>
      ) : null}

      {isDevelopment && (
        <>
          <h3 style={{ color: '#991b1b', marginBottom: '10px' }}>Error Object:</h3>
          <details style={{ marginBottom: '20px' }}>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
              Click to expand full error object
            </summary>
            <pre style={{
              fontSize: '11px',
              backgroundColor: '#fef2f2',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '400px',
            }}>
              {JSON.stringify(error, null, 2)}
            </pre>
          </details>

          <div style={{
            backgroundColor: '#fef9c3',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #fcd34d',
            fontSize: '14px',
          }}>
            <strong>💡 Development Tips:</strong>
            <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
              <li>Check the browser console for additional error details</li>
              <li>Look at the stack trace above to identify the exact file and line number</li>
              <li>This detailed error display is only shown in development mode</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function AppContent() {
  try { bootLog('AppContent mount'); } catch {
    throw new Error('Failed to log boot step');
  }
  return (
    <StrictMode>
      <Outlet />
      {/* Debug overlay is disabled by default; enable only via ?debug=init */}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'init' ? (
        <InitInspector />
      ) : null}
    </StrictMode>
  );
}

export default function App() {

  return (
    <BootProgressProvider>
      <AppConfigProvider>
        {/* Config step becomes done as soon as provider mounts */}
        <ConfigReadyReporter />

        <SimpleBFFAuthProvider>
          {/* Auth step marks done when initial load finishes */}
          <AuthReadyReporter />

          <LanguageProvider>
            {/* I18n readiness */}
            <I18nReadyReporter />

            <StyledEngineProvider injectFirst>
              <CustomThemeProvider>
                <AppThemeProvider>
                  {/* Theme step can be considered ready now */}
                  <ThemeReadyReporter />

                  <CssBaseline />
                  <LanguageEventsBridge />
                  {/* Global notifications */}
                  <NotificationSystem />
                  {/* UI plugins were registered at module load, confirm step */}
                  <UIReadyReporter />

                  {/* Mount WorkerProvider early, but suppress its own overlay. */}
                  <WorkerProvider renderOverlay={false}>
                    <WorkerProgressReporter />
                    {/* Render app content; gating is handled by BootOverlay removal on Worker done */}
                    <AppContent />
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
