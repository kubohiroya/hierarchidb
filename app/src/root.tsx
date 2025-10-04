import type { ReactNode } from 'react';
import { StrictMode } from 'react';
import { AppProviders } from './router/context/AppProviders.js';
import { initializeBrowserGlobals } from './router/init/initializeBrowserGlobals.js';

initializeBrowserGlobals();

export function AppRoot({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <AppProviders>{children}</AppProviders>
    </StrictMode>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function HydrateFallback() {
  return (
    <div
      id="hdb-hydrate-fallback"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
      }}
    >
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
  return (
    <div
      style={{
        padding: '20px',
        color: 'red',
        fontFamily: 'monospace',
        backgroundColor: '#fff5f5',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        margin: '20px',
      }}
    >
      <h1 style={{ color: '#dc2626', marginBottom: '20px' }}>Application Error</h1>
      <p>Please check the console for additional details.</p>
    </div>
  );
}

export default AppRoot;
