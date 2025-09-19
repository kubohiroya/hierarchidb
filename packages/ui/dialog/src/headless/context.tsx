import { createContext, useContext } from 'react';
import type { HeadlessMultiStepDialogContextValue } from './types.js';

const MultiStepDialogContext = createContext<HeadlessMultiStepDialogContextValue<any> | null>(null);

export const MultiStepDialogProvider = MultiStepDialogContext.Provider;

export function useMultiStepDialogContext<TData>() {
  const value = useContext(MultiStepDialogContext) as HeadlessMultiStepDialogContextValue<TData> | null;
  if (!value) {
    throw new Error('useMultiStepDialogContext must be used within a MultiStepDialog');
  }
  return value;
}

export function useMultiStepDialogState<TData>() {
  return useMultiStepDialogContext<TData>();
}
