/**
 * @file usePluginRegistry.ts
 * @description React hook for accessing plugin registry information
 */

import { useEffect, useState } from 'react';
import { useWorker } from '../contexts/WorkerProvider.js';
import type { PluginInfo } from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-type';

/**
 * Hook for accessing plugin registry information
 *
 * @example
 * ```tsx
 * function PluginList() {
 *   const { plugins, loading, error } = usePluginRegistry();
 *
 *   if (loading) return <div>Loading plugins...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *
 *   return (
 *     <ul>
 *       {plugins.map(plugin => (
 *         <li key={plugin.nodeType}>
 *           {plugin.displayName} (v{plugin.version})
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function usePluginRegistry() {
  const worker = useWorker();
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlugins() {
      try {
        setLoading(true);
        setError(null);

        // Plugin registry is migrating; return empty list as safe default in Phase 2
        const pluginList: PluginInfo[] = [];
        setPlugins(pluginList);
      } catch (err) {
        console.error('Failed to load plugins:', err);
        setError(err instanceof Error ? err.message : 'Failed to load plugins');
      } finally {
        setLoading(false);
      }
    }

    loadPlugins();
  }, [worker]);

  return { plugins, loading, error };
}

/**
 * Hook for accessing information about a specific plugin
 *
 * @param nodeType - The node type of the plugin to query
 *
 * @example
 * ```tsx
 * function PluginDetails({ nodeType }: { nodeType: NodeType }) {
 *   const { plugin, loading, error } = usePluginInfo(nodeType);
 *
 *   if (loading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!plugin) return <div>Plugin not found</div>;
 *
 *   return (
 *     <div>
 *       <h2>{plugin.displayName}</h2>
 *       <p>Version: {plugin.version}</p>
 *       <p>Status: {plugin.status}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePluginInfo(nodeType: NodeType) {
  const worker = useWorker();
  const [plugin, setPlugin] = useState<PluginInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPluginInfo() {
      try {
        setLoading(true);
        setError(null);

        // Phase 2 fallback: no registry, return null
        const info = null;
        setPlugin(info);
      } catch (err) {
        console.error(`Failed to load plugin info for ${nodeType}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load plugin info');
      } finally {
        setLoading(false);
      }
    }

    loadPluginInfo();
  }, [worker, nodeType]);

  return { plugin, loading, error };
}

/**
 * Hook for checking plugin dependencies
 *
 * @param nodeType - The node type of the plugin to check dependencies for
 *
 * @example
 * ```tsx
 * function PluginDependencies({ nodeType }: { nodeType: NodeType }) {
 *   const { dependencies, loading } = usePluginDependencies(nodeType);
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h3>Dependencies:</h3>
 *       {dependencies.length === 0 ? (
 *         <p>No dependencies</p>
 *       ) : (
 *         <ul>
 *           {dependencies.map(dep => (
 *             <li key={dep}>{dep}</li>
 *           ))}
 *         </ul>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePluginDependencies(nodeType: NodeType) {
  const worker = useWorker();
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDependencies() {
      try {
        setLoading(true);
        // Phase 2 fallback: no registry
        const deps: string[] = [];
        setDependencies(deps);
      } catch (err) {
        console.error(`Failed to load dependencies for ${nodeType}:`, err);
        setDependencies([]);
      } finally {
        setLoading(false);
      }
    }

    loadDependencies();
  }, [worker, nodeType]);

  return { dependencies, loading };
}

/**
 * Hook for getting the plugin load order
 *
 * @example
 * ```tsx
 * function PluginLoadOrder() {
 *   const { loadOrder, loading } = usePluginLoadOrder();
 *
 *   if (loading) return <div>Loading...</div>;
 *
 *   return (
 *     <ol>
 *       {loadOrder.map((nodeType, index) => (
 *         <li key={nodeType}>
 *           {nodeType} (position: {index + 1})
 *         </li>
 *       ))}
 *     </ol>
 *   );
 * }
 * ```
 */
export function usePluginLoadOrder() {
  const worker = useWorker();
  const [loadOrder, setLoadOrder] = useState<NodeType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true);
        // Phase 2 fallback: no registry
        const order: NodeType[] = [];
        setLoadOrder(order);
      } catch (err) {
        console.error('Failed to load plugin order:', err);
        setLoadOrder([]);
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [worker]);

  return { loadOrder, loading };
}
