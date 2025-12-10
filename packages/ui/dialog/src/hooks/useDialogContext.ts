import { createContext, useContext } from 'react';
import type { HeadlessDialogContextValue } from '../headless/types.js';

const MultiStepDialogContext = createContext<HeadlessDialogContextValue<any> | null>(null);

export const MultiStepDialogProvider = MultiStepDialogContext.Provider;

export function useDialogContext<TData>() {
  const value = useContext(MultiStepDialogContext) as HeadlessDialogContextValue<TData> | null;
  if (!value) {
    throw new Error('useDialogContext must be used within a MultiStepDialog');
  }
  return value;
}
