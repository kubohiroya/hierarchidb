/**
 * usePluginsForTree Hook
 *
 * Fetches plugins available for a specific tree ID from the worker registry.
 * Provides dynamic plugin loading for SpeedDial menus.
 */

import { useState, useEffect } from 'react';
import { WorkerAPIClient } from '@hierarchidb/ui-client';
import type { TreeId, PluginDefinition } from '@hierarchidb/common-core';

export interface UsePluginsForTreeResult {
  plugins: PluginDefinition[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePluginsForTree(
  treeId: TreeId | undefined,
  workerClient: WorkerAPIClient | null
): UsePluginsForTreeResult {
  const [plugins, setPlugins] = useState<PluginDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = async () => {
    if (!treeId || !workerClient) {
      setPlugins([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const api = workerClient.getAPI();
      const pluginDefinitions = await api.getPluginsForTree(treeId);
      setPlugins(pluginDefinitions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plugins');
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, [treeId, workerClient]);

  return {
    plugins,
    loading,
    error,
    refetch: fetchPlugins,
  };
}