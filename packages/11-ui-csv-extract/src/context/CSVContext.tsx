/**
 * @file context/CSVContext.tsx
 * @description React Context for CSV API dependency injection
 */

import React, { createContext, useContext } from 'react';
import type { ICSVDataApi } from '~/types';

/**
 * CSV API Context
 */
const CSVApiContext = createContext<ICSVDataApi | null>(null);

/**
 * CSV Provider Props
 */
export interface CSVProviderProps {
  children: React.ReactNode;
  csvApi: ICSVDataApi;
}

/**
 * CSV Provider Component
 * Injects CSV API implementation into the component tree
 */
export const CSVProvider: React.FC<CSVProviderProps> = ({ 
  children, 
  csvApi 
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
export const useCSVApi = (): ICSVDataApi => {
  const api = useContext(CSVApiContext);
  if (!api) {
    throw new Error(
      'useCSVApi must be used within CSVProvider. ' +
      'Ensure your component is wrapped with <CSVProvider csvApi={yourApiImplementation}>'
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