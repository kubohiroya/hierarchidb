/**
 * @file context/TabularContext.tsx
 * @description React Context for Tabular API dependency injection
 */

import { createContext, useContext } from 'react';
import type { TabularDataApi } from '../types/index.js';

/**
 * Tabular API Context
 */
const TabularApiContext = createContext<TabularDataApi | null>(null);

/**
 * Tabular Provider Props
 */
export interface TabularProviderProps {
  children: React.ReactNode;
  tabularApi: TabularDataApi;
}

/**
 * Tabular Provider Component
 * Injects Tabular API implementation into the component console
 */
export const TabularProvider: React.FC<TabularProviderProps> = ({
                                                          children,
                                                          tabularApi,
                                                        }) => {
  return (
    <TabularApiContext.Provider value={tabularApi}>
      {children}
    </TabularApiContext.Provider>
  );
};

/**
 * Hook to access Tabular API
 * Must be used within TabularProvider
 */
export const useTabularApi = (): TabularDataApi => {
  const api = useContext(TabularApiContext);
  if (!api) {
    throw new Error(
      'useTabularApi must be used within TabularProvider. ' +
      'Ensure your component is wrapped with <TabularProvider tabularApi={yourApiImplementation}>',
    );
  }
  return api;
};
