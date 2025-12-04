/**
 * @file hooks/useTabularData.ts
 * @description Hook for managing Tabular table metadata
 */

import { useCallback, useEffect, useState } from 'react';
import { useTabularApi } from '../context/TabularContext.js';
import type {
  TabularProcessingConfig,
  TabularTableListResult,
  PaginationOptions,
} from '../types/index.js';
import { TabularTableMetadata, TabularTableMetadataLike } from '@hierarchidb/tabular-store';

/**
 * Options for useTabularData hook
 */
export interface UseTabularDataOptions {
  /** Table metadata ID to load */
  tableMetadataId?: string;
  /** Whether to automatically load data on mount */
  autoload?: boolean;
  /** Plugin ID for reference management */
  pluginId: string;
  /** Callback when upload succeeds */
  onUploadSuccess?: (metadata: TabularTableMetadata) => void;
  /** Callback when upload fails */
  onUploadError?: (error: string) => void;
}

/**
 * Result of useTabularData hook
 */
export interface UseTabularDataResult {
  /** Table metadata */
  tabularTableMetadata: TabularTableMetadata | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;

  /** Upload Tabular file */
  uploadTabularFile: (file: File, config?: TabularProcessingConfig) => Promise<TabularTableMetadata>;
  /** Download Tabular from URL */
  downloadTabularFromUrl: (url: string, config?: TabularProcessingConfig) => Promise<TabularTableMetadata>;
  /** Reload current metadata */
  reload: () => Promise<void>;
  /** Add reference to current table */
  addReference: () => Promise<void>;
  /** Remove reference from current table */
  removeReference: () => Promise<void>;
  /** Clear current data */
  clear: () => void;

  // Upload state management
  isUploading: boolean;
  uploadError: string | null;
}

/**
 * Hook for managing Tabular table metadata
 */
export const useTabularData = (options: UseTabularDataOptions): UseTabularDataResult => {
  const { tableMetadataId, autoload = true, pluginId, onUploadSuccess, onUploadError } = options;
  const tabularApi = useTabularApi();

  const [tabularTableMetadata, setTabularTableMetadata] = useState<TabularTableMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /**
   * Load table metadata by ID
   */
  const loadMetadata = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      const data = await tabularApi.getTableMetadata(id);
      setTabularTableMetadata(data);

      if (!data) {
        setError(`Table metadata not found: ${id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load metadata';
      setError(message);
      setTabularTableMetadata(null);
    } finally {
      setLoading(false);
    }
  }, [tabularApi]);

  /**
   * Upload Tabular file
   */
  const uploadTabularFile = useCallback(async (
    file: File,
    config: TabularProcessingConfig = {},
  ): Promise<TabularTableMetadata> => {
    try {
      setIsUploading(true);
      setUploadError(null);

      const defaultConfig: TabularProcessingConfig = {
        delimiter: ',',
        encoding: 'utf-8',
        hasHeader: true,
        ...config,
      };

      const newMetadata = await tabularApi.uploadTabularFile(file, defaultConfig);
      setTabularTableMetadata(newMetadata);

      // Add reference for this plugin
      await tabularApi.addTableReference(newMetadata.id, pluginId);

      // Call success callback
      onUploadSuccess?.(newMetadata);

      return newMetadata;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file';
      setUploadError(message);
      onUploadError?.(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [tabularApi, pluginId]);

  /**
   * Download CSV from URL
   */
  const downloadTabularFromUrl = useCallback(async (
    url: string,
    config: TabularProcessingConfig = {},
  ): Promise<TabularTableMetadata> => {
    try {
      setIsUploading(true);
      setUploadError(null);

      const defaultConfig: TabularProcessingConfig = {
        delimiter: ',',
        encoding: 'utf-8',
        hasHeader: true,
        ...config,
      };

      const newMetadata = await tabularApi.downloadTabularFromUrl(url, defaultConfig);
      setTabularTableMetadata(newMetadata);

      // Add reference for this plugin
      await tabularApi.addTableReference(newMetadata.id, pluginId);

      // Call success callback
      onUploadSuccess?.(newMetadata);

      return newMetadata;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download from URL';
      setUploadError(message);
      onUploadError?.(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [tabularApi, pluginId]);

  /**
   * Reload current metadata
   */
  const reload = useCallback(async () => {
    if (tabularTableMetadata?.id) {
      await loadMetadata(tabularTableMetadata.id);
    }
  }, [loadMetadata, tabularTableMetadata?.id]);

  /**
   * Add reference to current table
   */
  const addReference = useCallback(async () => {
    if (tabularTableMetadata?.id) {
      try {
        await tabularApi.addTableReference(tabularTableMetadata.id, pluginId);
        // Reload to get updated reference count
        await reload();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add reference';
        setError(message);
        throw err;
      }
    }
  }, [tabularApi, tabularTableMetadata?.id, pluginId, reload]);

  /**
   * Remove reference from current table
   */
  const removeReference = useCallback(async () => {
    if (tabularTableMetadata?.id) {
      try {
        await tabularApi.removeTableReference(tabularTableMetadata.id, pluginId);
        // Note: Table might be auto-deleted if reference count reaches zero
        // So we don't reload here, just clear local state
        setTabularTableMetadata(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove reference';
        setError(message);
        throw err;
      }
    }
  }, [tabularApi, tabularTableMetadata?.id, pluginId]);

  /**
   * Clear current data
   */
  const clear = useCallback(() => {
    setTabularTableMetadata(null);
    setError(null);
    setLoading(false);
  }, []);

  // Auto-load on mount or when tableMetadataId changes
  useEffect(() => {
    if (autoload && tableMetadataId) {
      loadMetadata(tableMetadataId);
    }
  }, [autoload, tableMetadataId, loadMetadata]);

  return {
    tabularTableMetadata,
    loading,
    error,
    uploadTabularFile,
    downloadTabularFromUrl,
    reload,
    addReference,
    removeReference,
    clear,
    isUploading,
    uploadError,
  };
};

/**
 * Options for useTabularTableList hook
 */
export interface UseTabularTableListOptions {
  /** Plugin ID to filter tables */
  pluginId?: string;
  /** Pagination options */
  pagination?: PaginationOptions;
  /** Whether to automatically load on mount */
  autoload?: boolean;
}

/**
 * Result of useTabularTableList hook
 */
export interface UseTabularTableListResult {
  /** List of tables */
  tables: TabularTableMetadataLike[];
  /** Total number of tables */
  total: number;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;

  /** Reload table list */
  reload: () => Promise<void>;
  /** Load with new pagination */
  loadPage: (pagination: PaginationOptions) => Promise<void>;
}

/**
 * Hook for managing CSV table list
 */
export const useTabularTableList = (options: UseTabularTableListOptions = {}): UseTabularTableListResult => {
  const { pluginId, pagination, autoload = true } = options;
  const tabularApi = useTabularApi();

  const [result, setResult] = useState<TabularTableListResult>({ tables: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load table list
   */
  const loadTables = useCallback(async (paginationOptions?: PaginationOptions) => {
    try {
      setLoading(true);
      setError(null);

      const data = await tabularApi.listTables(pluginId, paginationOptions);
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load table list';
      setError(message);
      setResult({ tables: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [tabularApi, pluginId]);

  /**
   * Reload with current options
   */
  const reload = useCallback(async () => {
    await loadTables(pagination);
  }, [loadTables, pagination]);

  /**
   * Load specific page
   */
  const loadPage = useCallback(async (paginationOptions: PaginationOptions) => {
    await loadTables(paginationOptions);
  }, [loadTables]);

  // Auto-load on mount
  useEffect(() => {
    if (autoload) {
      loadTables(pagination);
    }
  }, [autoload, loadTables, pagination]);

  return {
    tables: result.tables,
    total: result.total,
    loading,
    error,
    reload,
    loadPage,
  };
};
