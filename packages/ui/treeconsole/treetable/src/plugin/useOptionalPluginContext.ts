/**
  * Optional Plugin Context Hook
   * null
  */

import { useContext } from 'react';
import { PluginContext } from './PluginProvider';
import type { PluginContext as IPluginContext } from './types';

/**
   * @returns null
  */
export function useOptionalPluginContext(): IPluginContext | null {
  try {
    return useContext(PluginContext);
  } catch {
    // Context not found - plugins are disabled
    return null;
  }
}

/**
    */
export function usePluginsEnabled(): boolean {
  const context = useOptionalPluginContext();
  return context !== null;
}

/**
    */
export function useSafePluginHook() {
  const context = useOptionalPluginContext();

  return <T extends keyof import('./types').TreeTableHooks>(
    hookName: T,
    ...args: Parameters<NonNullable<import('./types').TreeTableHooks[T]>>
  ) => {
    if (context) {
      return context.executeHook(hookName, ...args);
    }
    return [];
  };
}