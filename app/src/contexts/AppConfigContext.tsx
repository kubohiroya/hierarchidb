import { createContext, type ReactNode, useContext } from 'react';

import { loadAppConfig } from '~/loadAppConfig.js';
import type { LoadAppConfigReturn } from '~/loadAppConfig.js';

export type AppConfig = LoadAppConfigReturn;

const resolveAppConfig = (): AppConfig => loadAppConfig();

const AppConfigContext = createContext<AppConfig | undefined>(undefined);

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const config = resolveAppConfig();

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
    return resolveAppConfig();
  }
  return context;
}
