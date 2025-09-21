import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router-dom';
import { useRouteError } from 'react-router';
import { CssBaseline } from '@mui/material';
// Note: When using Emotion Cache with insertion point, do not also use StyledEngineProvider injectFirst
import { StrictMode, type ComponentType } from 'react';
import { bootLog } from './utils/bootLog.js';
import { AppConfigProvider } from './contexts/AppConfigContext.js';
import { ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-theme';
import { LanguageProvider } from '@hierarchidb/ui-i18n';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-auth';
import { WorkerProvider } from './contexts/WorkerProvider.js';
import { InitInspector } from './dev/InitInspector.js';
// Initialize UI plugins
import { NotificationSystem, registerAllUIPlugins } from '@hierarchidb/ui-core';
import { APP_VERSION, BUILD_TIME } from './version.js';
// Bridge: provide app's Worker client hook to shape-plugin UI hooks
import { registerWorkerClientHook, getWorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';
import { useWorkerAPIClient } from './hooks/useWorkerAPIClient.js';
import { BootProgressProvider } from './contexts/BootProgressProvider.js';
import { AppThemeProvider } from './components/AppThemeProvider.js';
import { TreeConsolePanel } from '@hierarchidb/ui-treeconsole-base';
import { ServicesReadySnackbar } from './components/ServicesReadySnackbar.js';
import { LanguageEventsBridge } from './components/LanguageEventsBridge.js';
import { AuthReadyReporter, ConfigReadyReporter, I18nReadyReporter, ThemeReadyReporter, UIReadyReporter, WorkerProgressReporter } from './init/InitReporters.js';
import { setGlobalMuiIconMap } from '@hierarchidb/ui-icon';
import { autoLoadPlugins } from './plugins/auto-load.js';

/**
 * Global link descriptors shared across all routes (favicons, etc.)
 */
export function links() {
  return [] as const;
}

const logRootWarning = (message: string, error?: unknown): void => {
  if (typeof console === 'undefined') return;
  if (typeof error === 'undefined') {
    console.warn('[root]', message);
  } else {
    console.warn('[root]', message, error);
  }
};

// Log version and build time at startup (local time)
const localBuildTime = (() => {
  try {
    return new Date(BUILD_TIME).toLocaleString();
  } catch (error) {
    logRootWarning('Failed to format BUILD_TIME', error);
    return String(BUILD_TIME);
  }
})();
// eslint-disable-next-line no-console
console.log(`[App] Version: ${APP_VERSION} | Build Time (local): ${localBuildTime}`);

// Register the app-provided hook once at module load
registerWorkerClientHook(useWorkerAPIClient);
// Also expose the hook getter on window for plugin UIs that avoid static imports to keep bundling lean
if (typeof window !== 'undefined') {
  (window as Window & { __HDB_GET_WORKER_CLIENT_HOOK?: typeof getWorkerClientHook }).__HDB_GET_WORKER_CLIENT_HOOK = getWorkerClientHook;
}

// No runtime globals for base; SSOT is Vite's BASE_URL consumed directly where needed.

declare global {
  interface Window {
    __uiPluginsRegistered?: boolean;
  }
}

// Initialize worker URL configuration

// Register all UI plugins at startup (only once)
if (typeof window !== 'undefined' && !window.__uiPluginsRegistered) {
  (async () => {
    // Load plugins discovered by virtual modules unless explicitly skipped
    if (import.meta.env.VITE_SKIP_PLUGIN_AUTOLOAD !== '1') {
      try { await autoLoadPlugins(); } catch (e) { console.warn('[root] autoLoadPlugins failed', e); }
    } else {
      console.warn('[root] autoLoadPlugins skipped by VITE_SKIP_PLUGIN_AUTOLOAD=1');
    }
    // Keep legacy/stub registration as a fallback (no-ops when already registered)
    registerAllUIPlugins();
    window.__uiPluginsRegistered = true;
  })();
}

// Pre-load WorkerAPIClient module to ensure it's available when WorkerSingletonProvider needs it
// This doesn't initialize the worker, just ensures the module is loaded
if (typeof window !== 'undefined') {
  import('./WorkerAPIClient.js').then(({ WorkerAPIClient }) => {

  }).catch(error => {
    console.error('[root.tsx] Failed to load WorkerAPIClient module:', error);
  });

  // Warm-load menu builders in all modes so DynamicSpeedDial can build items
  import('./plugins/menu-builders.js')
    .then(async (mod) => {
      // @eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as Window & { __HDB_MENU_BUILDERS__?: unknown }).__HDB_MENU_BUILDERS__ = mod;
      // prefetch remains available from original module; keep best-effort call
      try {
        await (mod as { prefetchIconsForAllContexts?: () => Promise<void> }).prefetchIconsForAllContexts?.();
      } catch (error) {
        logRootWarning('Prefetching icon contexts failed', error);
      }
    })
    .catch((err) => {
      console.warn('[root.tsx] menu-builders preload failed (will fallback to worker plugins):', err);
    });

  // Provide plugin definitions to runtime-ui packages that rely on global injection
  // @ts-ignore virtual module provided by package-reader
  import('virtual:plugin-definitions')
    .then((mod: { default?: unknown[] }) => {
      (window as Window & { __HDB_PLUGIN_DEFS__?: unknown[] }).__HDB_PLUGIN_DEFS__ = mod?.default || [];
    })
    .catch((error) => {
      logRootWarning('Failed to load virtual:plugin-definitions', error);
    });

  // Expose TreeConsolePanel for plugin UIs that avoid static imports
  (window as Window & { __HDB_TreeConsolePanel?: typeof TreeConsolePanel }).__HDB_TreeConsolePanel = TreeConsolePanel;


  // Inject app-generated static MUI icon map for ui-icon to use globally
  import('virtual:mui-icon-map')
    .then((mod: { default?: Record<string, ComponentType<any>>; iconMap?: Record<string, ComponentType<any>> }) => {
      const map = (mod.default || mod.iconMap || {}) as Record<string, ComponentType<any>>;
      setGlobalMuiIconMap(map);
    })
    .catch((error) => {
      logRootWarning('Failed to load virtual:mui-icon-map', error);
    });

  // Optional: prewarm plugin services (DB/Shared/Services) in dev when enabled
  if (import.meta.env.VITE_PREWARM_SERVICES === '1') {
    import('~/services/databases.js').then(async (db) => {
      const safeOpen = async (
        label: string,
        database: { open?: () => Promise<unknown> } | undefined,
      ): Promise<string> => {
        try {
          await database?.open?.();
        } catch (error) {
          logRootWarning(`Prewarm database open failed for ${label}`, error);
        }
        return label;
      };

      const results = await Promise.allSettled([
        db.getBaseMapDatabase().then(async (d) => safeOpen('basemap', d)),
        db.getResolverDB().then(async (d) => safeOpen('resolver', d)),
        db.getSpreadsheetDatabase().then(async (d) => safeOpen('spreadsheet', d)),
        db.getRouteDatabase().then(async (d) => safeOpen('route', d)),
        db.getShapeDatabase().then(async (d) => safeOpen('shape', d)),
        db.getLocationEphemeralDB().then(async (d) => safeOpen('location', d)),
      ]);
      const ok = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map(r => r.value);

        window.dispatchEvent(new CustomEvent('hdb-services-ready', { detail: { source: 'ui', at: Date.now(), nodeTypes: ok } }));

    }).catch((error) => {
      logRootWarning('Failed to prewarm plugin services', error);
    });
  }
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
    {/* Snackbars */}
    <ServicesReadySnackbar />
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
          </LanguageProvider>
        </SimpleBFFAuthProvider>
      </AppConfigProvider>
    </BootProgressProvider>
  );
}
