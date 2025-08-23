/**
 * usePluginsForTree Hook
 *
 * Fetches plugins available for a specific tree ID from the worker registry.
 * Provides dynamic plugin loading for SpeedDial menus.
 */

import { useState, useEffect } from 'react';
import { WorkerAPIClient } from '@hierarchidb/10-ui-client';
import type { TreeId } from '@hierarchidb/00-core';
// Plugin definition type (matches WorkerAPI interface)
interface PluginDefinitionAPI {
  readonly nodeType: string;
  readonly name: string;
  readonly displayName?: string;
  readonly icon?: {
    readonly muiIconName?: string;
    readonly emoji?: string;
    readonly color?: string;
    readonly description?: string;
  };
  readonly category: {
    readonly treeId: string | '*';
    readonly menuGroup?: 'basic' | 'container' | 'document' | 'advanced';
    readonly createOrder?: number;
  };
  readonly metadata?: {
    readonly description?: string;
    readonly tags?: readonly string[];
  };
}

export interface UsePluginsForTreeResult {
  plugins: PluginDefinitionAPI[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePluginsForTree(
  treeId: TreeId | undefined,
  workerClient: WorkerAPIClient | null
): UsePluginsForTreeResult {
  const [plugins, setPlugins] = useState<PluginDefinitionAPI[]>([]);
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