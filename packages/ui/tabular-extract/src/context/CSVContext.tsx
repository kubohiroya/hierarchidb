/**
 * @file context/CSVContext.tsx
 * @description React Context for CSV API dependency injection
 */

import { createContext, useContext } from 'react';
import type { TabularDataApi } from '../types/index.js';

/**
 * CSV API Context
 */
const CSVApiContext = createContext<TabularDataApi | null>(null);

/**
 * CSV Provider Props
 */
export interface CSVProviderProps {
  children: React.ReactNode;
  csvApi: TabularDataApi;
}

/**
 * CSV Provider Component
 * Injects CSV API implementation into the component console
 */
export const CSVProvider: React.FC<CSVProviderProps> = ({
                                                          children,
                                                          csvApi,
                                                        }) => {
  return (
    <CSVApiContext.Provider value={csvApi}>
      {children}
    </CSVApiContext.Provider>
  );
};

/**
 * Hook to access CSV API
 * Must be used within CSVProvider
 */
export const useCSVApi = (): TabularDataApi => {
  const api = useContext(CSVApiContext);
  if (!api) {
    throw new Error(
      'useCSVApi must be used within CSVProvider. ' +
      'Ensure your component is wrapped with <CSVProvider csvApi={yourApiImplementation}>',
    );
  }
  return api;
};

/**
 * Hook to check if CSV API is available
 */
export const useCSVApiAvailable = (): boolean => {
  const api = useContext(CSVApiContext);
  return api !== null;
};
