/**
  * Optional Plugin Context Hook
   * null
  */

import { useContext } from 'react';
import { PluginContext } from './PluginProvider.js';
import type { PluginContext as IPluginContext } from './types.js';

/**
   * @returns null
  */
export function useOptionalPluginContext(): IPluginContext | null {
  // PluginContext is created with a default `null` value, so this is safe even
  // when no Provider is mounted.
  return useContext(PluginContext);
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

  return <T extends keyof import('./types.js').TreeTableHooks>(
    hookName: T,
    ...args: Parameters<NonNullable<import('./types.js').TreeTableHooks[T]>>
  ): Array<Awaited<ReturnType<NonNullable<import('./types.js').TreeTableHooks[T]>>>> => {
    if (context) {
      return context.executeHook(hookName, ...args);
    }
    return [];
  };
}
