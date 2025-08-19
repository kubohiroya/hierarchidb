import { createContext, useContext, ReactNode } from "react";

export interface AppConfig {
  appPrefix: string;
  appName: string;
  appTitle: string;
  appDescription: string;
  appDetails: string;
  appHomepage: string;
  appLogo: string;
  appFavicon: string;
  appTheme: string;
  appLocale: string;
  appDefaultLocale: string;
  appDefaultLanguage: string;
  appAttribution: string;
}

// Get configuration from environment variables
const getAppConfig = (): AppConfig => ({
  appPrefix: import.meta.env.VITE_APP_PREFIX || "hierarchidb",
  appName: import.meta.env.VITE_APP_NAME || "HierarchiDB",
  appTitle: import.meta.env.VITE_APP_TITLE || "HierarchiDB",
  appDescription:
    import.meta.env.VITE_APP_DESCRIPTION ||
    "High-performance tree-structured data management framework for browser environments",
  appDetails:
    import.meta.env.VITE_APP_DETAILS ||
    "A powerful framework for managing hierarchical data in browser environments",
  appHomepage:
    import.meta.env.APP_HOMEPAGE || "https://github.com/kubohiroya/hierarchidb",
  appLogo: import.meta.env.VITE_APP_LOGO || "logo.png",
  appFavicon: import.meta.env.VITE_APP_FAVICON || "favicon.svg",
  appTheme: import.meta.env.VITE_APP_THEME || "light",
  appLocale: import.meta.env.VITE_APP_LOCALE || "en-US",
  appDefaultLocale: "en-US",
  appDefaultLanguage: "en",
  appAttribution: import.meta.env.VITE_APP_ATTRIBUTION || "",
});

const AppConfigContext = createContext<AppConfig | undefined>(undefined);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const config = getAppConfig();

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig(): AppConfig {
  const context = useContext(AppConfigContext);
  if (!context) {
    // If context is not available, return config directly from env vars
    return getAppConfig();
  }
  return context;
}
