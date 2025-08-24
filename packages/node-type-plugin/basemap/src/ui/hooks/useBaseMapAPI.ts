/**
 * React hook for BaseMap API access via Comlink
 */

import { useMemo } from 'react';
import { useWorkerAPIClient } from '@hierarchidb/ui-client';
import type { BaseMapAPI } from '../../shared';

/**
 * Hook to get BaseMap API proxy for UI-Worker communication
 * Returns a Comlink proxy that automatically handles RPC calls
 */
export function useBaseMapAPI(): Promise<BaseMapAPI> {
  const client = useWorkerAPIClient();

  return useMemo(async () => {
    const workerAPI = client.getAPI();
    const pluginRegistry = await workerAPI.getPluginRegistryAPI();
    return await pluginRegistry.getExtension('basemap') as BaseMapAPI;
  }, [client]);
}

/**
 * Synchronous version that returns a function to get the API
 * Use this when you need the API in event handlers or effects
 */
export function useBaseMapAPIGetter(): () => Promise<BaseMapAPI> {
  const client = useWorkerAPIClient();

  return useMemo(() => {
    return async (): Promise<BaseMapAPI> => {
      const workerAPI = client.getAPI();
      const pluginRegistry = await workerAPI.getPluginRegistryAPI();
      return await pluginRegistry.getExtension('basemap') as BaseMapAPI;
    };
  }, [client]);
}