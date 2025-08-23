/**
 * Folder data management hook
 */

import { useState, useEffect, useCallback } from 'react';
import { NodeId } from '@hierarchidb/00-core';
import { useFolderAPIGetter } from './useFolderAPI';
import type {
  FolderEntity,
  CreateFolderData,
  UpdateFolderData,
  FolderStatistics,
  FolderBookmark,
  FolderTemplate
} from '../../shared';

/**
 * Hook for managing folder data and operations
 */
export function useFolderData(nodeId: NodeId) {
  const [entity, setEntity] = useState<FolderEntity | undefined>(undefined);
  const [statistics, setStatistics] = useState<FolderStatistics | undefined>(undefined);
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
      setError(err instanceof Error ? err : new Error('Failed to load folder'));
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
      const stats = await api.getStatistics(nodeId);
      setStatistics(stats);
    } catch (err) {
      console.warn('Failed to load statistics:', err);
    }
  }, [nodeId, getFolderAPI]);

  // Create new folder
  const createFolder = useCallback(async (data: CreateFolderData): Promise<FolderEntity> => {
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
      const error = err instanceof Error ? err : new Error('Failed to create folder');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [nodeId, getFolderAPI]);

  // Update existing folder
  const updateFolder = useCallback(async (data: UpdateFolderData): Promise<void> => {
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
      const error = err instanceof Error ? err : new Error('Failed to update folder');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [nodeId, getFolderAPI, loadEntity]);

  // Delete folder
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
      setStatistics(undefined);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete folder');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [nodeId, getFolderAPI]);

  // Move folder
  const moveFolder = useCallback(async (newParentNodeId: NodeId): Promise<void> => {
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
      const error = err instanceof Error ? err : new Error('Failed to move folder');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [nodeId, getFolderAPI, loadEntity]);

  // Copy folder
  const copyFolder = useCallback(async (targetParentNodeId: NodeId, newName?: string): Promise<FolderEntity> => {
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
      const error = err instanceof Error ? err : new Error('Failed to copy folder');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [nodeId, getFolderAPI]);

  // Update settings
  const updateSettings = useCallback(async (settings: FolderEntity['settings']): Promise<void> => {
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
  }, [nodeId, getFolderAPI, loadEntity]);

  // Refresh statistics
  const refreshStatistics = useCallback(async (): Promise<void> => {
    try {
      const api = await getFolderAPI();
      if (!api) return;
      const stats = await api.refreshStatistics(nodeId);
      setStatistics(stats);
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
    statistics,
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
    isProcessing: loading
  };
}

/**
 * Hook for managing folder bookmarks
 */
export function useFolderBookmarks(userNodeId: NodeId) {
  const [bookmarks, setBookmarks] = useState<FolderBookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const getFolderAPI = useFolderAPIGetter();

  const loadBookmarks = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const api = await getFolderAPI();
      if (!api) return;
      const userBookmarks = await api.getBookmarks(userNodeId);
      setBookmarks(userBookmarks);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load bookmarks'));
    } finally {
      setLoading(false);
    }
  }, [userNodeId, getFolderAPI]);

  const createBookmark = useCallback(async (targetFolderId: NodeId, label: string): Promise<void> => {
    try {
      const api = await getFolderAPI();
      if (!api) return;
      await api.createBookmark(userNodeId, targetFolderId, label);
      await loadBookmarks();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create bookmark');
      setError(error);
      throw error;
    }
  }, [userNodeId, getFolderAPI, loadBookmarks]);

  const deleteBookmark = useCallback(async (bookmarkId: string): Promise<void> => {
    try {
      const api = await getFolderAPI();
      if (!api) return;
      await api.deleteBookmark(bookmarkId);
      await loadBookmarks();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete bookmark');
      setError(error);
      throw error;
    }
  }, [getFolderAPI, loadBookmarks]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  return {
    bookmarks,
    loading,
    error,
    loadBookmarks,
    createBookmark,
    deleteBookmark
  };
}

/**
 * Hook for managing folder templates
 */
export function useFolderTemplates(nodeId: NodeId) {
  const [templates, setTemplates] = useState<FolderTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const getFolderAPI = useFolderAPIGetter();

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      const api = await getFolderAPI();
      if (!api) return;
      const folderTemplates = await api.getTemplates(nodeId);
      setTemplates(folderTemplates);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load templates'));
    } finally {
      setLoading(false);
    }
  }, [nodeId, getFolderAPI]);

  const createTemplate = useCallback(async (name: string, description?: string): Promise<void> => {
    try {
      const api = await getFolderAPI();
      if (!api) return;
      await api.createTemplate(nodeId, name, description);
      await loadTemplates();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create template');
      setError(error);
      throw error;
    }
  }, [nodeId, getFolderAPI, loadTemplates]);

  const applyTemplate = useCallback(async (templateId: string, targetParentNodeId: NodeId): Promise<void> => {
    try {
      const api = await getFolderAPI();
      if (!api) return;
      await api.applyTemplate(templateId, targetParentNodeId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to apply template');
      setError(error);
      throw error;
    }
  }, [getFolderAPI]);

  const deleteTemplate = useCallback(async (templateId: string): Promise<void> => {
    try {
      const api = await getFolderAPI();
      if (!api) return;
      await api.deleteTemplate(templateId);
      await loadTemplates();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete template');
      setError(error);
      throw error;
    }
  }, [getFolderAPI, loadTemplates]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  return {
    templates,
    loading,
    error,
    loadTemplates,
    createTemplate,
    applyTemplate,
    deleteTemplate
  };
}