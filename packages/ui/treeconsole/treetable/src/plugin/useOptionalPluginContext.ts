/**
 * Optional Plugin Context Hook
 * 
 * プラグインコンテキストをオプショナルに取得するためのフック。
 * プラグインが無効の場合でもエラーを発生させず、nullを返します。
 */

import { useContext } from 'react';
import { PluginContext } from './PluginProvider';
import type { PluginContext as IPluginContext } from './types';

/**
 * プラグインコンテキストをオプショナルに取得
 * @returns プラグインコンテキスト（プラグインが無効の場合はnull）
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
 * プラグインが有効かどうかをチェック
 */
export function usePluginsEnabled(): boolean {
  const context = useOptionalPluginContext();
  return context !== null;
}

/**
 * プラグインフックを安全に実行するためのフック
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