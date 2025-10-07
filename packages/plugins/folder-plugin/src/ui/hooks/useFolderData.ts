/**
 * Folder data management hook
 */

import { useCallback, useEffect, useState } from 'react';
import type { NodeId } from '@hierarchidb/common-types';
import { useFolderAPIGetter } from './useFolderAPI.js';
import type { FolderEntity } from '../../shared/index.js';
import type { CreateFolderData, FolderSettings, UpdateFolderData } from '../../shared/types.js';

/**
 * Hook for managing folder-plugin data and operations
 */
export function useFolderData(nodeId: NodeId) {
  const [entity, setEntity] = useState<FolderEntity | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const getFolderAPI = useFolderAPIGetter();

  // Load entity data
  const loadEntity = useCallback(async () => {
    if (!nodeId) return;

    setLoading(true);
    setError(undefined);

    try {
      const api = await getFolderAPI();
      if (!api) {
        console.warn('Folder API not available');
        return;
      }
      const entityData = await api.getEntity(nodeId);
      setEntity(entityData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load folder-plugin'));
    } finally {
      setLoading(false);
    }
  }, [nodeId, getFolderAPI]);

  // Load statistics
  const loadStatistics = useCallback(async () => {
    if (!nodeId) return;

    try {
      const api = await getFolderAPI();
      if (!api) return;
    } catch (err) {
      console.warn('Failed to load statistics:', err);
    }
  }, [nodeId, getFolderAPI]);

  // Create new folder-plugin
  const createFolder = useCallback(
    async (data: CreateFolderData): Promise<FolderEntity> => {
      setLoading(true);
      setError(undefined);

      try {
        const api = await getFolderAPI();
        if (!api) {
          throw new Error('Folder API not available');
        }
        const newFolder = await api.createEntity(nodeId, data);
        setEntity(newFolder);
        return newFolder;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create folder-plugin');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [nodeId, getFolderAPI],
  );

  // Update existing folder-plugin
  const updateFolder = useCallback(
    async (data: UpdateFolderData): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const api = await getFolderAPI();
        if (!api) {
          throw new Error('Folder API not available');
        }
        await api.updateEntity(nodeId, data);
        await loadEntity(); // Reload to get updated data
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update folder-plugin');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [nodeId, getFolderAPI, loadEntity],
  );

  // Delete folder-plugin
  const deleteFolder = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(undefined);

    try {
      const api = await getFolderAPI();
      if (!api) {
        throw new Error('Folder API not available');
      }
      await api.deleteEntity(nodeId);
      setEntity(undefined);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete folder-plugin');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [nodeId, getFolderAPI]);

  // Move folder-plugin
  const moveFolder = useCallback(
    async (newParentNodeId: NodeId): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const api = await getFolderAPI();
        if (!api) {
          throw new Error('Folder API not available');
        }
        await api.moveFolder(nodeId, newParentNodeId);
        await loadEntity(); // Reload to get updated data
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to move folder-plugin');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [nodeId, getFolderAPI, loadEntity],
  );

  // Copy folder-plugin
  const copyFolder = useCallback(
    async (targetParentNodeId: NodeId, newName?: string): Promise<FolderEntity> => {
      setLoading(true);
      setError(undefined);

      try {
        const api = await getFolderAPI();
        if (!api) {
          throw new Error('Folder API not available');
        }
        const copiedFolder = await api.copyFolder(nodeId, targetParentNodeId, newName);
        return copiedFolder;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to copy folder-plugin');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [nodeId, getFolderAPI],
  );

  // Update settings
  const updateSettings = useCallback(
    async (settings: FolderSettings): Promise<void> => {
      try {
        const api = await getFolderAPI();
        if (!api) return;
        await api.updateSettings(nodeId, settings);
        await loadEntity(); // Reload to get updated settings
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update settings');
        setError(error);
        throw error;
      }
    },
    [nodeId, getFolderAPI, loadEntity],
  );

  // Refresh statistics
  const refreshStatistics = useCallback(async (): Promise<void> => {
    try {
      const api = await getFolderAPI();
      if (!api) return;
    } catch (err) {
      console.warn('Failed to refresh statistics:', err);
    }
  }, [nodeId, getFolderAPI]);

  // Load data on mount and when nodeId changes
  useEffect(() => {
    loadEntity();
    loadStatistics();
  }, [loadEntity, loadStatistics]);

  return {
    // Data
    entity,
    loading,
    error,

    // Actions
    loadEntity,
    loadStatistics,
    createFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
    copyFolder,
    updateSettings,
    refreshStatistics,

    // Computed
    hasEntity: !!entity,
    isProcessing: loading,
  };
}
