import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from 'react-router';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { StyledEngineProvider } from '@mui/material/styles';
import { StrictMode, useMemo } from 'react';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { createAppTheme, ThemeProvider as CustomThemeProvider } from '@hierarchidb/ui-theme';
import { LanguageProvider } from '@hierarchidb/ui-i18n';
import { SimpleBFFAuthProvider } from '@hierarchidb/ui-auth';
import { WorkerProvider } from './contexts/WorkerProvider';
import { TitleLogo } from './components/TitleLogo';
import { InitInspector } from './dev/InitInspector';
import { NotificationSystem } from '@hierarchidb/ui-core';
import { APP_VERSION, BUILD_TIME } from './version';

// Log version and build time at startup (local time)
try {
  const localBuildTime = (() => {
    try { return new Date(BUILD_TIME).toLocaleString(); } catch { return String(BUILD_TIME); }
  })();
  // eslint-disable-next-line no-console
  console.log(`[App] Version: ${APP_VERSION} | Build Time (local): ${localBuildTime}`);
} catch {}

declare global {
  interface Window {
    __uiPluginsRegistered?: boolean;
  }
}

// Initialize worker URL configuration

// Initialize UI plugins
import { registerAllUIPlugins } from '@hierarchidb/ui-core';

// Register all UI plugins at startup (only once)
if (typeof window !== 'undefined' && !window.__uiPluginsRegistered) {
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
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        fontFamily: 'Roboto, sans-serif',
      }}
    >
      <TitleLogo showProgress={true} />

      {/* Version (top left) */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          fontSize: '12px',
          color: '#999999',
        }}
      >
        v1.0.0-05Sep1442PM
      </div>

      {/* Copyright (top right) */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          fontSize: '12px',
          color: '#999999',
        }}
      >
        © 2024 HierarchiDB Project
      </div>


    </div>
  );
}

export function ErrorBoundary() {
  let error: unknown;
  try {
    error = useRouteError();
  } catch (e) {
    error = e;
  }

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
      margin: '20px'
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
        overflow: 'auto'
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
            marginBottom: '20px'
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
            marginBottom: '20px'
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
              maxHeight: '400px'
            }}>
              {JSON.stringify(error, null, 2)}
            </pre>
          </details>
          
          <div style={{ 
            backgroundColor: '#fef9c3', 
            padding: '10px', 
            borderRadius: '4px',
            border: '1px solid #fcd34d',
            fontSize: '14px'
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
  return (
    <StrictMode>
      <Outlet />
      {/* Debug overlay to quickly classify issues: cache vs comms vs UI update. */}
      {typeof window !== 'undefined' && (import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === 'init') ? (
        <InitInspector />
      ) : null}
    </StrictMode>
  );
}

export default function App() {
  // Create theme inside component with useMemo to avoid hydration mismatch
  // Using a stable theme creation to prevent SSR/hydration mismatches
  const theme = useMemo(() => createAppTheme('light'), []);

  return (
    <AppConfigProvider>
      <SimpleBFFAuthProvider>
        <LanguageProvider>
          <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
              <CustomThemeProvider>
                <CssBaseline />
                {/* Global notifications */}
                <NotificationSystem />
                <WorkerProvider>
                  <AppContent />
                </WorkerProvider>
              </CustomThemeProvider>
            </ThemeProvider>
          </StyledEngineProvider>
        </LanguageProvider>
      </SimpleBFFAuthProvider>
    </AppConfigProvider>
  );
}
