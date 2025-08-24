/**
 * Shape API hook - PluginRegistryAPIを使用してプラグインAPIにアクセス
 */

import { useMemo } from 'react';
import { useWorkerAPIClient } from '@hierarchidb/ui-client';
import type { ShapeAPI } from '../../shared';

/**
 * Shape APIにアクセスするためのhook
 * 既存のPluginRegistryAPIシステムを使用
 */
export function useShapeAPI(): Promise<ShapeAPI> {
  const client = useWorkerAPIClient();

  return useMemo(async () => {
    const workerAPI = client.getAPI();
    const pluginRegistry = await workerAPI.getPluginRegistryAPI();
    return await pluginRegistry.getExtension('shape') as ShapeAPI;
  }, [client]);
}

/**
 * Synchronous version that returns a function to get the API
 * Use this when you need the API in event handlers or effects
 */
export function useShapeAPIGetter(): () => Promise<ShapeAPI> {
  const client = useWorkerAPIClient();

  return useMemo(() => {
    return async (): Promise<ShapeAPI> => {
      const workerAPI = client.getAPI();
      const pluginRegistry = await workerAPI.getPluginRegistryAPI();
      return await pluginRegistry.getExtension('shape') as ShapeAPI;
    };
  }, [client]);
}