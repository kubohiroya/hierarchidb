import type { NodeType } from '@hierarchidb/core-types';
import { useCallback, useEffect, useState } from 'react';
import { getInstalledPlugins } from '~/plugin-runtime/plugin-registry';
import type { DisplayPlugin } from './pluginsTypes.js';

type UsePluginsPageStateResult = {
  workerPlugins: DisplayPlugin[];
  uiPluginsList: DisplayPlugin[];
  pluginDependencies: Record<string, string[]>;
  loading: boolean;
  error: string | null;
  deleteDialogOpen: boolean;
  resetDialogOpen: boolean;
  selectedPlugin: string | null;
  affectedPlugins: string[];
  operationInProgress: boolean;
  isProduction: boolean;
  handleDeletePlugin: (pluginName: string) => void;
  handleResetPlugin: (pluginName: string) => void;
  confirmDelete: (clearDatabase: boolean) => Promise<void>;
  confirmReset: () => Promise<void>;
  closeDeleteDialog: () => void;
  closeResetDialog: () => void;
};

export const usePluginsPageState = (): UsePluginsPageStateResult => {
  const [workerPlugins, setWorkerPlugins] = useState<DisplayPlugin[]>([]);
  const [uiPluginsList, setUiPluginsList] = useState<DisplayPlugin[]>([]);
  const [pluginDependencies, setPluginDependencies] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [affectedPlugins, setAffectedPlugins] = useState<string[]>([]);
  const [operationInProgress, setOperationInProgress] = useState(false);

  const isProduction = import.meta.env.MODE === 'production';

  const calculateAffectedPlugins = useCallback(
    (pluginName: string): string[] => {
      const affected = new Set<string>([pluginName]);
      const queue = [pluginName];

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
          continue;
        }

        for (const [plugin, deps] of Object.entries(pluginDependencies)) {
          if (deps.includes(current) && !affected.has(plugin)) {
            affected.add(plugin);
            queue.push(plugin);
          }
        }
      }

      return Array.from(affected);
    },
    [pluginDependencies]
  );

  const loadPlugins = useCallback(() => {
    try {
      setLoading(true);
      const installed = getInstalledPlugins();
      const display: DisplayPlugin[] = installed.map((plugin) => ({
        nodeType: plugin.nodeType as NodeType,
        displayName: plugin.label,
        description: plugin.description,
        dependencies: plugin.dependencies,
        menuGroup: plugin.menuGroup,
        createOrder: plugin.createOrder,
        icon: plugin.icon,
        iconColor: plugin.iconColor,
        backgroundColor: plugin.backgroundColor,
        hasUI: plugin.hasUI,
        hasWorker: plugin.hasWorker,
        hasCommon: plugin.hasCommon,
        packageName: plugin.packageName,
        version: plugin.version,
      }));

      const dependencyMap: Record<string, string[]> = {};
      for (const plugin of display) {
        dependencyMap[plugin.nodeType] = plugin.dependencies;
      }

      setWorkerPlugins(display);
      setUiPluginsList(display);
      setPluginDependencies(dependencyMap);
      setError(null);
    } catch (err) {
      console.error('Failed to load plugins:', err);
      setError(err instanceof Error ? err.message : 'Failed to load plugin metadata');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleDeletePlugin = useCallback(
    (pluginName: string) => {
      setSelectedPlugin(pluginName);
      const affected = calculateAffectedPlugins(pluginName);
      setAffectedPlugins(affected);
      setDeleteDialogOpen(true);
    },
    [calculateAffectedPlugins]
  );

  const handleResetPlugin = useCallback(
    (pluginName: string) => {
      setSelectedPlugin(pluginName);
      const affected = calculateAffectedPlugins(pluginName);
      setAffectedPlugins(affected);
      setResetDialogOpen(true);
    },
    [calculateAffectedPlugins]
  );

  const confirmDelete = useCallback(
    async (clearDatabase: boolean) => {
      if (!selectedPlugin) return;

      setOperationInProgress(true);
      try {
        for (const plugin of affectedPlugins) {
          console.log(`Deleting plugin: ${plugin}, clearDatabase: ${clearDatabase}`);
        }

        await loadPlugins();
      } catch (err) {
        console.error('Failed to delete plugin:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete plugin');
      } finally {
        setOperationInProgress(false);
        setDeleteDialogOpen(false);
        setSelectedPlugin(null);
        setAffectedPlugins([]);
      }
    },
    [affectedPlugins, loadPlugins, selectedPlugin]
  );

  const confirmReset = useCallback(async () => {
    if (!selectedPlugin) return;

    setOperationInProgress(true);
    try {
      const affected = affectedPlugins;

      if (selectedPlugin === 'folder') {
        console.warn('⚠️ Performing complete system reset');
        console.log('System reset: Clearing ALL data and recreating initial atoms');
      } else {
        for (const plugin of affected) {
          console.log(`Resetting plugin: ${plugin} (GroupEntity and RelationalEntity only)`);
        }
      }

      await loadPlugins();
    } catch (err) {
      console.error('Failed to reset plugin:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset plugin');
    } finally {
      setOperationInProgress(false);
      setResetDialogOpen(false);
      setSelectedPlugin(null);
      setAffectedPlugins([]);
    }
  }, [affectedPlugins, loadPlugins, selectedPlugin]);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setSelectedPlugin(null);
    setAffectedPlugins([]);
  }, []);

  const closeResetDialog = useCallback(() => {
    setResetDialogOpen(false);
    setSelectedPlugin(null);
    setAffectedPlugins([]);
  }, []);

  return {
    workerPlugins,
    uiPluginsList,
    pluginDependencies,
    loading,
    error,
    deleteDialogOpen,
    resetDialogOpen,
    selectedPlugin,
    affectedPlugins,
    operationInProgress,
    isProduction,
    handleDeletePlugin,
    handleResetPlugin,
    confirmDelete,
    confirmReset,
    closeDeleteDialog,
    closeResetDialog,
  };
};
