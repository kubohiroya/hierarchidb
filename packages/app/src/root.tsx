import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router-dom';
import { createTheme, CssBaseline, LinearProgress, ThemeProvider } from '@mui/material';
import { StrictMode } from 'react';
import { AppConfigProvider, useAppConfig } from './contexts/AppConfigContext';

import * as pkg from 'react-helmet-async';
const { Helmet, HelmetProvider } = pkg;

//const appPrefix = import.meta.env.VITE_APP_PREFIX || '/';
//<meta name="viewport" content="width=device-width, initial-scale=1.0" />
//<base href={appPrefix} />
//

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function HydrateFallback() {
  return <LinearProgress color="inherit" />;
}

function AppContent() {
  const { appTitle, appDescription, appFavicon } = useAppConfig();

  return (
    <StrictMode>
      <HelmetProvider>
        <Helmet>
          <title>{appTitle}</title>
          {appDescription ? <meta name="description" content={appDescription} /> : null}
          <link rel="icon" href={appFavicon} type="image/svg+xml" />
        </Helmet>
        <Outlet />
      </HelmetProvider>
    </StrictMode>
  );
}

export default function App() {
  return (
    <AppConfigProvider>
      <ThemeProvider theme={createTheme()}>
        <CssBaseline />
        <AppContent />
      </ThemeProvider>
    </AppConfigProvider>
  );
}
