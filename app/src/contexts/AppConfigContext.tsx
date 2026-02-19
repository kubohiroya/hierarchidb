import { createContext, type ReactNode, useContext } from 'react';
import type { LoadAppConfigReturn } from '~/loadAppConfig';
import { loadAppConfig } from '~/loadAppConfig';

export type AppConfig = LoadAppConfigReturn;

const resolveAppConfig = (): AppConfig => loadAppConfig();

const AppConfigContext = createContext<AppConfig | undefined>(undefined);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const config = resolveAppConfig();

  return <AppConfigContext.Provider value={config}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig(): AppConfig {
  const context = useContext(AppConfigContext);
  if (!context) {
    // If context is not available, return config directly from env vars
    return resolveAppConfig();
  }
  return context;
}
