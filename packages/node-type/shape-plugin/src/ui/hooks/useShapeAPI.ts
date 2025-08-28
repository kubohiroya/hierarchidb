/**
 * Shape API hook - PluginRegistryAPIを使用してプラグインAPIにアクセス
 * NOTE: This hook should be provided by the host application context
 * or replaced with a proper plugin API pattern
 */

import { useMemo } from 'react';
import type { ShapeAPI } from '../../shared';

/**
 * Shape APIにアクセスするためのhook
 * 既存のPluginRegistryAPIシステムを使用
 */
export function useShapeAPI(): Promise<ShapeAPI> {
  // TODO: This should be provided by the application context
  // For now, returning a mock implementation
  return useMemo(async () => {
    throw new Error('useShapeAPI requires application context - not yet implemented');
  }, []);
}

/**
 * Synchronous version that returns a function to get the API
 * Use this when you need the API in event handlers or effects
 */
export function useShapeAPIGetter(): () => Promise<ShapeAPI> {
  // TODO: This should be provided by the application context
  return useMemo(() => {
    return async (): Promise<ShapeAPI> => {
      throw new Error('useShapeAPIGetter requires application context - not yet implemented');
    };
  }, []);
}