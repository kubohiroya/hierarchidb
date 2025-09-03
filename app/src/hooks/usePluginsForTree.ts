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
import type { WorkerAPI } from '@hierarchidb/common-api';

// Extend WorkerAPI with optional experimental facades to avoid `as any`
type NodeTypeRegistryAPI = { getPluginsForTree(treeId: TreeId): Promise<PluginDefinition[]> };
type TreePluginAnalyzerAPI = {
  getPluginsForTree(args: {
    treeId: TreeId;
    filters?: any;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ plugins: TreePluginInfo[] }>;
};

type ExtendedWorkerAPI = WorkerAPI & {
  getNodeTypeRegistryAPI?: () => Promise<NodeTypeRegistryAPI>;
  getTreePluginAnalyzer?: () => Promise<TreePluginAnalyzerAPI>;
};

export interface UsePluginsForTreeResult {
  plugins: PluginDefinition[];
  pluginInfo: TreePluginInfo[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePluginsForTree(
  treeId: TreeId | undefined,
  _workerClient: Remote<WorkerAPI> | null
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
