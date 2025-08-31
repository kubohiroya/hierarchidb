/**
 * usePluginsForTree Hook
 *
 * Fetches plugins available for a specific tree ID from the worker registry.
 * Provides dynamic plugin loading for SpeedDial menus.
 */

import { useState, useEffect } from 'react';
import { WorkerAPIClient } from '../WorkerAPIClient';
import type { TreeId, PluginDefinition } from '@hierarchidb/common-type';
import type { TreePluginInfo } from '@hierarchidb/common-api';
import type { Remote } from 'comlink';
import type WorkerModule from '~/worker';

export interface UsePluginsForTreeResult {
  plugins: PluginDefinition[];
  pluginInfo: TreePluginInfo[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePluginsForTree(
  treeId: TreeId | undefined,
  workerClient: Remote<typeof WorkerModule> | null
): UsePluginsForTreeResult {
  const [plugins, setPlugins] = useState<PluginDefinition[]>([]);
  const [pluginInfo, setPluginInfo] = useState<TreePluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = async () => {
    if (!treeId || !workerClient) {
      setPlugins([]);
      setPluginInfo([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use both old registry API and new facade API
      // Use new NodeTypeRegistryAPI instead of deprecated PluginRegistryAPI
      const nodeTypeRegistryAPI = await workerClient.getNodeTypeRegistryAPI();
      const pluginDefinitions = await nodeTypeRegistryAPI.getPluginsForTree(treeId);
      setPlugins(pluginDefinitions);
      
      // Also get structured plugin info via new facade
      // Use new TreePluginAnalyzer instead of deprecated PluginTreeAPI
      const treePluginAnalyzer = await workerClient.getTreePluginAnalyzer();
      const response = await treePluginAnalyzer.getPluginsForTree({
        treeId,
        filters: { capabilities: ['create'] },
        sortBy: 'createOrder',
        sortOrder: 'asc'
      });
      setPluginInfo(response.plugins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plugins');
      setPlugins([]);
      setPluginInfo([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, [treeId, workerClient]);

  return {
    plugins,
    pluginInfo,
    loading,
    error,
    refetch: fetchPlugins,
  };
}