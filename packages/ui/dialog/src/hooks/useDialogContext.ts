import { createContext, useContext } from 'react';
import type { HeadlessDialogContextValue } from '../headless/types.js';

const PluginDialogContext = createContext<HeadlessDialogContextValue<any> | null>(null);

export const PluginDialogProvider = PluginDialogContext.Provider;

export function useDialogContext<TData>() {
  const value = useContext(PluginDialogContext) as HeadlessDialogContextValue<TData> | null;
  if (!value) {
    throw new Error('useDialogContext must be used within a PluginDialog');
  }
  return value;
}
