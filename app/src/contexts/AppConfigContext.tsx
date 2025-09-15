import { createContext, ReactNode, useContext } from 'react';

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
  appPrefix: ((import.meta as any)?.env?.VITE_APP_PREFIX as string) || 'hierarchidb',
  appName: ((import.meta as any)?.env?.VITE_APP_NAME as string) || 'HierarchiDB',
  appTitle: ((import.meta as any)?.env?.VITE_APP_TITLE as string) || 'HierarchiDB',
  appDescription:
    ((import.meta as any)?.env?.VITE_APP_DESCRIPTION as string) ||
    'High-performance tree-structured data management framework for browser environments',
  appDetails:
    ((import.meta as any)?.env?.VITE_APP_DETAILS as string) ||
    'A powerful framework for managing hierarchical data in browser environments',
  appHomepage:
    ((import.meta as any)?.env?.VITE_APP_HOMEPAGE as string) || 'https://github.com/kubohiroya/hierarchidb',
  appLogo: ((import.meta as any)?.env?.VITE_APP_LOGO as string) || 'logo.png',
  appFavicon: ((import.meta as any)?.env?.VITE_APP_FAVICON as string) || 'favicon.svg',
  appTheme: ((import.meta as any)?.env?.VITE_APP_THEME as string) || 'light',
  appLocale: ((import.meta as any)?.env?.VITE_APP_LOCALE as string) || 'en-US',
  appDefaultLocale: 'en-US',
  appDefaultLanguage: 'en',
  appAttribution: ((import.meta as any)?.env?.VITE_APP_ATTRIBUTION as string) || '',
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
