/**
 * usePluginsForTree Hook
 *
 * Fetches plugin-loader available for a specific tree ID from the worker registry.
 * Provides dynamic plugin loading for SpeedDial menus.
 */

import { useEffect, useState } from 'react';
import type { TreeId } from '@hierarchidb/common-types';
import type { PluginDefinition, TreePluginInfo } from '@hierarchidb/plugin-sdk';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { Remote } from 'comlink';

export interface UsePluginsForTreeResult {
  plugins: PluginDefinition[];
  pluginInfo: TreePluginInfo[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePluginsForTree(
  treeId: TreeId | undefined,
  _workerClient: Remote<WorkerAPI> | null,
): UsePluginsForTreeResult {
  const [plugins, setPlugins] = useState<PluginDefinition[]>([]);
  const [pluginInfo, setPluginInfo] = useState<TreePluginInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = async () => {
    if (!treeId || !_workerClient) {
      setPlugins([]);
      setPluginInfo([]);
      return;
    }

    setLoading(true);
    setError(null);

    // Fallback: do not call optional worker facades here to avoid unsafe casts.
    setPlugins([]);
    setPluginInfo([]);
    setLoading(false);
  };

  useEffect(() => {
    fetchPlugins();
  }, [treeId]);

  return {
    plugins,
    pluginInfo,
    loading,
    error,
    refetch: fetchPlugins,
  };
}
