/**
 * Project API hook - PluginRegistryAPIを使用してプラグインAPIにアクセス
 */

import { useMemo } from 'react';
import { useWorkerAPIClient } from '@hierarchidb/10-ui-client';
import type { ProjectAPI } from '../../shared';

/**
 * Project APIにアクセスするためのhook
 * 既存のPluginRegistryAPIシステムを使用
 */
export function useProjectAPI(): Promise<ProjectAPI> {
  const client = useWorkerAPIClient();

  return useMemo(async () => {
    const workerAPI = client.getAPI();
    const pluginRegistry = await workerAPI.getPluginRegistryAPI();
    return await pluginRegistry.getExtension('project') as ProjectAPI;
  }, [client]);
}

/**
 * Synchronous version that returns a function to get the API
 * Use this when you need the API in event handlers or effects
 */
export function useProjectAPIGetter(): () => Promise<ProjectAPI> {
  const client = useWorkerAPIClient();

  return useMemo(() => {
    return async (): Promise<ProjectAPI> => {
      const workerAPI = client.getAPI();
      const pluginRegistry = await workerAPI.getPluginRegistryAPI();
      return await pluginRegistry.getExtension('project') as ProjectAPI;
    };
  }, [client]);
}