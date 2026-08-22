import { useCallback, useEffect, useState } from 'react';
import { useTabularApi } from '../context/TabularContext';
import type { TabularDataResult, TabularFilterRule, TabularSelectionConfig } from '../types/index';

/**
 * Options for useCSVSelection hook
 */
export interface UseTabularSelectionOptions {
  /** Table metadata ID */
  tableMetadataId: string;
  /** Filter rules to apply */
  filterRules: TabularFilterRule[];
  /** Initial selection configuration */
  initialSelection?: Partial<TabularSelectionConfig>;
  /** Number of preview rows */
  previewRowCount?: number;
}

/**
 * Result of useCSVSelection hook
 */
export interface UseTabularSelectionResult {
  /** Current selection configuration */
  selection: TabularSelectionConfig;
  /** Preview data with current selection */
  previewData: TabularDataResult | null;
  /** Loading atoms */
  loading: boolean;
  /** Error message */
  error: string | null;

  /** Set key column */
  setKeyColumn: (column: string | undefined) => void;
  /** Set value columns */
  setValueColumns: (columns: string[]) => void;
  /** Add value column */
  addValueColumn: (column: string) => void;
  /** Remove value column */
  removeValueColumn: (column: string) => void;
  /** Set custom mappings */
  setCustomMappings: (mappings: TabularSelectionConfig['customMappings']) => void;
  /** Update entire selection */
  updateSelection: (updates: Partial<TabularSelectionConfig>) => void;
  /** Refresh preview */
  refreshPreview: () => Promise<void>;
}

/**
 * Hook for managing CSV column selection
 */
export const useTabularSelection = (
  options: UseTabularSelectionOptions
): UseTabularSelectionResult => {
  const { tableMetadataId, filterRules, initialSelection = {}, previewRowCount = 10 } = options;

  const tabularApi = useTabularApi();

  const [selection, setSelection] = useState<TabularSelectionConfig>({
    keyColumn: undefined,
    valueColumns: [],
    filterRules,
    customMappings: [],
    ...initialSelection,
  });

  const [previewData, setPreviewData] = useState<TabularDataResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    if (!tableMetadataId) return;

    try {
      setLoading(true);
      setError(null);

      const data = await tabularApi.getFilteredPreview(
        tableMetadataId,
        filterRules.filter((rule) => rule.enabled !== false),
        previewRowCount
      );

      setPreviewData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch preview';
      setError(message);
      setPreviewData(null);
    } finally {
      setLoading(false);
    }
  }, [tabularApi, tableMetadataId, filterRules, previewRowCount]);

  const setKeyColumn = useCallback((column: string | undefined) => {
    setSelection((prev) => ({ ...prev, keyColumn: column }));
  }, []);

  const setValueColumns = useCallback((columns: string[]) => {
    setSelection((prev) => ({ ...prev, valueColumns: columns }));
  }, []);

  const addValueColumn = useCallback((column: string) => {
    setSelection((prev) => ({
      ...prev,
      valueColumns: [...prev.valueColumns, column],
    }));
  }, []);

  const removeValueColumn = useCallback((column: string) => {
    setSelection((prev) => ({
      ...prev,
      valueColumns: prev.valueColumns.filter((col) => col !== column),
    }));
  }, []);

  const setCustomMappings = useCallback((mappings: TabularSelectionConfig['customMappings']) => {
    setSelection((prev) => ({ ...prev, customMappings: mappings }));
  }, []);

  const updateSelection = useCallback((updates: Partial<TabularSelectionConfig>) => {
    setSelection((prev) => ({ ...prev, ...updates }));
  }, []);

  const refreshPreview = useCallback(async () => {
    await fetchPreview();
  }, [fetchPreview]);

  useEffect(() => {
    setSelection((prev) => ({ ...prev, filterRules }));
  }, [filterRules]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  return {
    selection,
    previewData,
    loading,
    error,
    setKeyColumn,
    setValueColumns,
    addValueColumn,
    removeValueColumn,
    setCustomMappings,
    updateSelection,
    refreshPreview,
  };
};
