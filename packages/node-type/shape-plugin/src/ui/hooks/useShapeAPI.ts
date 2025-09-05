/**
 * Shape API hook - PluginRegistryAPIを使用してプラグインAPIにアクセス
 * アプリケーションコンテキスト経由でWorkerAPIClientにアクセスし、
 * PluginRegistryAPIからShapeプラグインのAPI拡張を取得
 */

import { useMemo } from 'react';
import type { ShapeAPI } from '../../shared';

// WorkerAPIClientへの条件付きインポート（アプリケーション実行時のみ利用可能）
// Resolve from app context (aliased to a test stub in vitest)
import { useWorkerAPIClient as appUseWorkerAPIClient } from '@hierarchidb/app/src/hooks/useWorkerAPIClient';
const useWorkerAPIClientHook: (() => any) | null = appUseWorkerAPIClient ?? null;

/**
 * Shape APIにアクセスするためのhook
 * WorkerAPIClient経由でPluginRegistryAPIからShapeプラグインのAPI拡張を取得
 */
export function useShapeAPI(): Promise<ShapeAPI> {
  return useMemo(async () => {
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
