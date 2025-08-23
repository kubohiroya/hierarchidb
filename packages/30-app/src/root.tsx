import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { CssBaseline, LinearProgress, ThemeProvider } from "@mui/material";
import { StyledEngineProvider } from "@mui/material/styles";
import { StrictMode, useMemo } from "react";
import { AppConfigProvider, useAppConfig } from "./contexts/AppConfigContext";
import {
  createAppTheme,
  ThemeProvider as CustomThemeProvider,
} from "@hierarchidb/10-ui-theme";
import { LanguageProvider } from "@hierarchidb/10-ui-i18n";
import { SimpleBFFAuthProvider } from "@hierarchidb/10-ui-auth";

// Initialize worker URL configuration
import "./worker-setup";

// Initialize UI plugins (temporarily disabled until plugins are properly exported)
// import { registerAllUIPlugins } from "@hierarchidb/10-ui-core";
// registerAllUIPlugins();

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
  return <LinearProgress color="inherit" />;
}

function AppContent() {
  const { appTitle, appDescription, appFavicon } = useAppConfig();

  return (
    <StrictMode>
      <title>{appTitle}</title>
      {appDescription ? (
        <meta name="description" content={appDescription} />
      ) : null}
      <link rel="icon" href={appFavicon} type="image/svg+xml" />
      <Outlet />
    </StrictMode>
  );
}

export default function App() {
  // Create theme inside component with useMemo to avoid hydration mismatch
  // Using a stable theme creation to prevent SSR/hydration mismatches
  const theme = useMemo(() => createAppTheme("light"), []);

  return (
    <AppConfigProvider>
      <SimpleBFFAuthProvider>
        <LanguageProvider>
          <StyledEngineProvider injectFirst>
            <ThemeProvider theme={theme}>
              <CustomThemeProvider>
                <CssBaseline />
                <AppContent />
              </CustomThemeProvider>
            </ThemeProvider>
          </StyledEngineProvider>
        </LanguageProvider>
      </SimpleBFFAuthProvider>
    </AppConfigProvider>
  );
}
