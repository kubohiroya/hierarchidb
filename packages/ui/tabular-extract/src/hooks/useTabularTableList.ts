import { useCallback, useEffect, useState } from 'react';
import { useTabularApi } from '../context/TabularContext';
import type { PaginationOptions, TabularTableListResult } from '../types/index';
import type { TabularTableMetadataLike } from '@hierarchidb/tabular-store';

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
  /** Loading atoms */
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

  const reload = useCallback(async () => {
    await loadTables(pagination);
  }, [loadTables, pagination]);

  const loadPage = useCallback(async (paginationOptions: PaginationOptions) => {
    await loadTables(paginationOptions);
  }, [loadTables]);

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
