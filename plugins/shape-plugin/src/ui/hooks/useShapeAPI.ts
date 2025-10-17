/**
  * Shape API hook - PluginRegistryAPIAPI
 * WorkerAPIClient
 * PluginRegistryAPIShapeAPI
  */

import { useMemo } from 'react';
import type { ShapeAPI } from '../../common/shared/index.js';
import { getWorkerClientHook, type WorkerClientRef } from '@hierarchidb/runtime-client';

/**
  * Shape APIhook
 * WorkerAPIClientPluginRegistryAPIShapeAPI
  */
export function useShapeAPI(): Promise<ShapeAPI> {
  return useMemo(async () => {
    const useWorkerAPIClientHook = getWorkerClientHook<WorkerClientRef>();
    if (!useWorkerAPIClientHook) {
      throw new Error('useShapeAPI requires application context - WorkerAPIClient not available');
    }

    const client = useWorkerAPIClientHook();
    if (!client) {
      throw new Error('WorkerAPIClient not initialized');
    }

    try {
      const workerAPI = client.getAPI();
      const pluginRegistry = await workerAPI.getPluginRegistryAPI();
      const shapeAPI = await pluginRegistry.getExtension('shape');

      if (!shapeAPI) {
        throw new Error('Shape plugin API extension not found');
      }

      return shapeAPI as ShapeAPI;
    } catch (error) {
      console.error('Failed to get Shape API:', error);
      throw new Error(`Shape API initialization failed: ${error}`);
    }
  }, []);
}

/**
 * Synchronous version that returns a function to get the API
 * Use this when you need the API in event handlers or effects
 */
export function useShapeAPIGetter(): () => Promise<ShapeAPI> {
  return useMemo(() => {
    const useWorkerAPIClientHook = getWorkerClientHook<WorkerClientRef>();
    return async (): Promise<ShapeAPI> => {
      if (!useWorkerAPIClientHook) {
        throw new Error('useShapeAPIGetter requires application context - WorkerAPIClient not available');
      }

      const client = useWorkerAPIClientHook();
      if (!client) {
        throw new Error('WorkerAPIClient not initialized');
      }

      try {
        const workerAPI = client.getAPI();
        const pluginRegistry = await workerAPI.getPluginRegistryAPI();
        const shapeAPI = await pluginRegistry.getExtension('shape');

        if (!shapeAPI) {
          throw new Error('Shape plugin API extension not found');
        }

        return shapeAPI as ShapeAPI;
      } catch (error) {
        console.error('Failed to get Shape API:', error);
        throw new Error(`Shape API initialization failed: ${error}`);
      }
    };
  }, []);
}
