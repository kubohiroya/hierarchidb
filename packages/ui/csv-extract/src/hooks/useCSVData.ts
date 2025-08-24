/**
 * @file hooks/useCSVData.ts
 * @description Hook for managing CSV table metadata
 */

import { useState, useEffect, useCallback } from 'react';
import { useCSVApi } from '~/context/CSVContext';
import type { 
  CSVTableMetadata, 
  CSVProcessingConfig,
  PaginationOptions,
  CSVTableListResult 
} from '~/types';

/**
 * Options for useCSVData hook
 */
export interface UseCSVDataOptions {
  /** Table metadata ID to load */
  tableMetadataId?: string;
  /** Whether to automatically load data on mount */
  autoload?: boolean;
  /** Plugin ID for reference management */
  pluginId: string;
  /** Callback when upload succeeds */
  onUploadSuccess?: (metadata: CSVTableMetadata) => void;
  /** Callback when upload fails */
  onUploadError?: (error: string) => void;
}

/**
 * Result of useCSVData hook
 */
export interface UseCSVDataResult {
  /** Table metadata */
  metadata: CSVTableMetadata | null;
  /** Loading state */
  loading: boolean;
  /** Error message */
  error: string | null;
  
  /** Upload CSV file */
  uploadCSVFile: (file: File, config?: CSVProcessingConfig) => Promise<CSVTableMetadata>;
  /** Download CSV from URL */
  downloadCSVFromUrl: (url: string, config?: CSVProcessingConfig) => Promise<CSVTableMetadata>;
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
 * Hook for managing CSV table metadata
 */
export const useCSVData = (options: UseCSVDataOptions): UseCSVDataResult => {
  const { tableMetadataId, autoload = true, pluginId, onUploadSuccess, onUploadError } = options;
  const csvApi = useCSVApi();
  
  const [metadata, setMetadata] = useState<CSVTableMetadata | null>(null);
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
      
      const data = await csvApi.getTableMetadata(id);
      setMetadata(data);
      
      if (!data) {
        setError(`Table metadata not found: ${id}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load metadata';
      setError(message);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  }, [csvApi]);

  /**
   * Upload CSV file
   */
  const uploadCSVFile = useCallback(async (
    file: File, 
    config: CSVProcessingConfig = {}
  ): Promise<CSVTableMetadata> => {
    try {
      setIsUploading(true);
      setUploadError(null);
      
      const defaultConfig: CSVProcessingConfig = {
        delimiter: ',',
        encoding: 'utf-8',
        hasHeader: true,
        ...config,
      };
      
      const newMetadata = await csvApi.uploadCSVFile(file, defaultConfig);
      setMetadata(newMetadata);
      
      // Add reference for this plugin
      await csvApi.addTableReference(newMetadata.id, pluginId);
      
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
  }, [csvApi, pluginId]);

  /**
   * Download CSV from URL
   */
  const downloadCSVFromUrl = useCallback(async (
    url: string, 
    config: CSVProcessingConfig = {}
  ): Promise<CSVTableMetadata> => {
    try {
      setIsUploading(true);
      setUploadError(null);
      
      const defaultConfig: CSVProcessingConfig = {
        delimiter: ',',
        encoding: 'utf-8',
        hasHeader: true,
        ...config,
      };
      
      const newMetadata = await csvApi.downloadCSVFromUrl(url, defaultConfig);
      setMetadata(newMetadata);
      
      // Add reference for this plugin
      await csvApi.addTableReference(newMetadata.id, pluginId);
      
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
  }, [csvApi, pluginId]);

  /**
   * Reload current metadata
   */
  const reload = useCallback(async () => {
    if (metadata?.id) {
      await loadMetadata(metadata.id);
    }
  }, [loadMetadata, metadata?.id]);

  /**
   * Add reference to current table
   */
  const addReference = useCallback(async () => {
    if (metadata?.id) {
      try {
        await csvApi.addTableReference(metadata.id, pluginId);
        // Reload to get updated reference count
        await reload();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add reference';
        setError(message);
        throw err;
      }
    }
  }, [csvApi, metadata?.id, pluginId, reload]);

  /**
   * Remove reference from current table
   */
  const removeReference = useCallback(async () => {
    if (metadata?.id) {
      try {
        await csvApi.removeTableReference(metadata.id, pluginId);
        // Note: Table might be auto-deleted if reference count reaches zero
        // So we don't reload here, just clear local state
        setMetadata(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove reference';
        setError(message);
        throw err;
      }
    }
  }, [csvApi, metadata?.id, pluginId]);

  /**
   * Clear current data
   */
  const clear = useCallback(() => {
    setMetadata(null);
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
    metadata,
    loading,
    error,
    uploadCSVFile,
    downloadCSVFromUrl,
    reload,
    addReference,
    removeReference,
    clear,
    isUploading,
    uploadError,
  };
};

/**
 * Options for useCSVTableList hook
 */
export interface UseCSVTableListOptions {
  /** Plugin ID to filter tables */
  pluginId?: string;
  /** Pagination options */
  pagination?: PaginationOptions;
  /** Whether to automatically load on mount */
  autoload?: boolean;
}

/**
 * Result of useCSVTableList hook
 */
export interface UseCSVTableListResult {
  /** List of tables */
  tables: CSVTableMetadata[];
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
export const useCSVTableList = (options: UseCSVTableListOptions = {}): UseCSVTableListResult => {
  const { pluginId, pagination, autoload = true } = options;
  const csvApi = useCSVApi();
  
  const [result, setResult] = useState<CSVTableListResult>({ tables: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load table list
   */
  const loadTables = useCallback(async (paginationOptions?: PaginationOptions) => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await csvApi.listTables(pluginId, paginationOptions);
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load table list';
      setError(message);
      setResult({ tables: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [csvApi, pluginId]);

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