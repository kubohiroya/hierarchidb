/**
 * @file hooks/useCSVFilter.ts
 * @description Hook for managing CSV filtering and preview
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCSVApi } from '~/context/CSVContext';
import type { 
  CSVFilterRule, 
  CSVDataResult,
  CSVSelectionConfig 
} from '~/types';

/**
 * Options for useCSVFilter hook
 */
export interface UseCSVFilterOptions {
  /** Table ID */
  tableId: string;
  /** Plugin ID for reference */
  pluginId: string;
  /** Initial filter rules */
  initialRules?: CSVFilterRule[];
  /** Number of preview rows to fetch */
  maxPreviewRows?: number;
  /** Debounce time for preview updates (ms) */
  debounceMs?: number;
  /** Whether to auto-refresh preview when rules change */
  autoRefresh?: boolean;
}

/**
 * Result of useCSVFilter hook
 */
export interface UseCSVFilterResult {
  /** Current filter rules */
  filterRules: CSVFilterRule[];
  /** Preview data */
  previewData: CSVDataResult | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  
  /** Get filtered preview */
  getFilteredPreview: (rules: CSVFilterRule[]) => Promise<void>;
  /** Validate filter rules */
  validateFilters: (rules: CSVFilterRule[]) => { isValid: boolean; errors: string[] };
  /** Add new filter rule */
  addRule: (rule: Omit<CSVFilterRule, 'id'>) => void;
  /** Update existing filter rule */
  updateRule: (id: string, updates: Partial<CSVFilterRule>) => void;
  /** Remove filter rule */
  removeRule: (id: string) => void;
  /** Clear all filter rules */
  clearRules: () => void;
  /** Toggle rule enabled state */
  toggleRule: (id: string) => void;
  /** Manually refresh preview */
  refreshPreview: () => Promise<void>;
  /** Set all rules at once */
  setRules: (rules: CSVFilterRule[]) => void;
}

/**
 * Generate unique ID for filter rule
 */
const generateRuleId = (): string => {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Hook for managing CSV filtering and preview
 */
export const useCSVFilter = (options: UseCSVFilterOptions): UseCSVFilterResult => {
  const {
    tableId,
    pluginId,
    initialRules = [],
    maxPreviewRows = 10,
    debounceMs = 300,
    autoRefresh = true,
  } = options;
  
  const csvApi = useCSVApi();
  
  const [filterRules, setFilterRules] = useState<CSVFilterRule[]>(initialRules);
  const [previewData, setPreviewData] = useState<CSVDataResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  /**
   * Get enabled filter rules
   */
  const enabledRules = useMemo(() => {
    return filterRules.filter(rule => rule.enabled);
  }, [filterRules]);

  /**
   * Fetch preview data
   */
  const fetchPreview = useCallback(async (rules: CSVFilterRule[]) => {
    if (!tableId) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const data = await csvApi.getFilteredPreview(
        tableId,
        rules.filter(rule => rule.enabled),
        maxPreviewRows
      );
      
      setPreviewData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch preview';
      setError(message);
      setPreviewData(null);
    } finally {
      setIsLoading(false);
    }
  }, [csvApi, tableId, maxPreviewRows]);

  /**
   * Get filtered preview with specific rules
   */
  const getFilteredPreview = useCallback(async (rules: CSVFilterRule[]) => {
    await fetchPreview(rules);
  }, [fetchPreview]);

  /**
   * Validate filter rules
   */
  const validateFilters = useCallback((rules: CSVFilterRule[]) => {
    const errors: string[] = [];
    
    for (const rule of rules) {
      if (!rule.column) {
        errors.push(`Filter rule ${rule.id}: Column is required`);
      }
      if (!rule.operator) {
        errors.push(`Filter rule ${rule.id}: Operator is required`);
      }
      if (['is_null', 'is_not_null'].includes(rule.operator)) {
        // These operators don't need a value
      } else if (!rule.value && rule.value !== 0) {
        errors.push(`Filter rule ${rule.id}: Value is required for operator ${rule.operator}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  /**
   * Debounced preview refresh
   */
  useEffect(() => {
    if (!autoRefresh) return;

    const timeoutId = setTimeout(() => {
      fetchPreview(filterRules);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [fetchPreview, filterRules, debounceMs, autoRefresh, refreshCounter]);

  /**
   * Add new filter rule
   */
  const addRule = useCallback((rule: Omit<CSVFilterRule, 'id'>) => {
    const newRule: CSVFilterRule = {
      ...rule,
      id: generateRuleId(),
    };
    
    setFilterRules(prev => [...prev, newRule]);
  }, []);

  /**
   * Update existing filter rule
   */
  const updateRule = useCallback((id: string, updates: Partial<CSVFilterRule>) => {
    setFilterRules(prev => prev.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
    ));
  }, []);

  /**
   * Remove filter rule
   */
  const removeRule = useCallback((id: string) => {
    setFilterRules(prev => prev.filter(rule => rule.id !== id));
  }, []);

  /**
   * Clear all filter rules
   */
  const clearRules = useCallback(() => {
    setFilterRules([]);
  }, []);

  /**
   * Toggle rule enabled state
   */
  const toggleRule = useCallback((id: string) => {
    updateRule(id, { enabled: undefined }); // Will be inverted by the update logic
    setFilterRules(prev => prev.map(rule => 
      rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
    ));
  }, [updateRule]);

  /**
   * Manually refresh preview
   */
  const refreshPreview = useCallback(async () => {
    await fetchPreview(filterRules);
  }, [fetchPreview, filterRules]);

  /**
   * Set all rules at once
   */
  const setRules = useCallback((rules: CSVFilterRule[]) => {
    setFilterRules(rules);
  }, []);

  // Initial preview load
  useEffect(() => {
    if (tableId && autoRefresh) {
      setRefreshCounter(prev => prev + 1);
    }
  }, [tableId, autoRefresh]);

  return {
    filterRules,
    previewData,
    isLoading,
    error,
    getFilteredPreview,
    validateFilters,
    addRule,
    updateRule,
    removeRule,
    clearRules,
    toggleRule,
    refreshPreview,
    setRules,
  };
};

/**
 * Options for useCSVSelection hook
 */
export interface UseCSVSelectionOptions {
  /** Table metadata ID */
  tableMetadataId: string;
  /** Filter rules to apply */
  filterRules: CSVFilterRule[];
  /** Initial selection configuration */
  initialSelection?: Partial<CSVSelectionConfig>;
  /** Number of preview rows */
  previewRowCount?: number;
}

/**
 * Result of useCSVSelection hook
 */
export interface UseCSVSelectionResult {
  /** Current selection configuration */
  selection: CSVSelectionConfig;
  /** Preview data with current selection */
  previewData: CSVDataResult | null;
  /** Loading state */
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
  setCustomMappings: (mappings: CSVSelectionConfig['customMappings']) => void;
  /** Update entire selection */
  updateSelection: (updates: Partial<CSVSelectionConfig>) => void;
  /** Refresh preview */
  refreshPreview: () => Promise<void>;
}

/**
 * Hook for managing CSV column selection
 */
export const useCSVSelection = (options: UseCSVSelectionOptions): UseCSVSelectionResult => {
  const {
    tableMetadataId,
    filterRules,
    initialSelection = {},
    previewRowCount = 10,
  } = options;
  
  const csvApi = useCSVApi();
  
  const [selection, setSelection] = useState<CSVSelectionConfig>({
    keyColumn: undefined,
    valueColumns: [],
    filterRules,
    customMappings: [],
    ...initialSelection,
  });
  
  const [previewData, setPreviewData] = useState<CSVDataResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch preview with current selection
   */
  const fetchPreview = useCallback(async () => {
    if (!tableMetadataId) return;

    try {
      setLoading(true);
      setError(null);
      
      const data = await csvApi.getFilteredPreview(
        tableMetadataId,
        filterRules.filter(rule => rule.enabled),
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
  }, [csvApi, tableMetadataId, filterRules, previewRowCount]);

  /**
   * Set key column
   */
  const setKeyColumn = useCallback((column: string | undefined) => {
    setSelection(prev => ({ ...prev, keyColumn: column }));
  }, []);

  /**
   * Set value columns
   */
  const setValueColumns = useCallback((columns: string[]) => {
    setSelection(prev => ({ ...prev, valueColumns: columns }));
  }, []);

  /**
   * Add value column
   */
  const addValueColumn = useCallback((column: string) => {
    setSelection(prev => ({
      ...prev,
      valueColumns: [...prev.valueColumns, column],
    }));
  }, []);

  /**
   * Remove value column
   */
  const removeValueColumn = useCallback((column: string) => {
    setSelection(prev => ({
      ...prev,
      valueColumns: prev.valueColumns.filter(col => col !== column),
    }));
  }, []);

  /**
   * Set custom mappings
   */
  const setCustomMappings = useCallback((mappings: CSVSelectionConfig['customMappings']) => {
    setSelection(prev => ({ ...prev, customMappings: mappings }));
  }, []);

  /**
   * Update entire selection
   */
  const updateSelection = useCallback((updates: Partial<CSVSelectionConfig>) => {
    setSelection(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Refresh preview
   */
  const refreshPreview = useCallback(async () => {
    await fetchPreview();
  }, [fetchPreview]);

  // Update filter rules in selection when they change
  useEffect(() => {
    setSelection(prev => ({ ...prev, filterRules }));
  }, [filterRules]);

  // Auto-refresh preview when selection changes
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