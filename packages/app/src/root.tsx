import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router-dom';
import { createTheme, CssBaseline, LinearProgress, ThemeProvider } from '@mui/material';
import { StrictMode } from 'react';

import { loadAppConfig } from './loader';
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

const appConfig = await loadAppConfig();

export default function App() {
  return (
    <ThemeProvider theme={createTheme()}>
      <CssBaseline />
      <StrictMode>
        <HelmetProvider>
          <Helmet>
            <title>{appConfig.appTitle}</title>
            {appConfig.appDescription ? (
              <meta name="description" content={appConfig.appDescription} />
            ) : null}
            <link rel="icon" href={appConfig.appFavicon} type="image/svg+xml" />
          </Helmet>
          <Outlet />
        </HelmetProvider>
      </StrictMode>
    </ThemeProvider>
  );
  /*
    const theme = createTheme();
  return (
    <ThemeProvider theme={theme}>
      <StrictMode>
        <CssBaseline />
        <Outlet />;
      </StrictMode>
    </ThemeProvider>
  );
   */
}
