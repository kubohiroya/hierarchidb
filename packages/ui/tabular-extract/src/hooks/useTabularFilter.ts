/**
 * @file hooks/useTabularFilter.ts
 * @description Hook for managing Tabular filtering and preview
 */

import { useCallback, useEffect, useState } from 'react';
import { useTabularApi } from '../context/TabularContext';
import type { TabularDataResult, TabularFilterRule } from '../types/index';

/**
 * Options for useTabularFilter hook
 */
export interface UseTabularFilterOptions {
  /** Table ID */
  tableId: string;
  /** Plugin ID for reference */
  pluginId: string;
  /** Initial filter rules */
  initialRules?: TabularFilterRule[];
  /** Number of preview rows to fetch */
  maxPreviewRows?: number;
  /** Debounce time for preview updates (ms) */
  debounceMs?: number;
  /** Whether to auto-refresh preview when rules change */
  autoRefresh?: boolean;
}

/**
 * Result of useTabularFilter hook
 */
export interface UseTabularFilterResult {
  /** Current filter rules */
  filterRules: TabularFilterRule[];
  /** Preview data */
  previewData: TabularDataResult | null;
  /** Loading atoms */
  isLoading: boolean;
  /** Error message */
  error: string | null;

  /** Get filtered preview */
  getFilteredPreview: (rules: TabularFilterRule[]) => Promise<void>;
  /** Validate filter rules */
  validateFilters: (rules: TabularFilterRule[]) => { isValid: boolean; errors: string[] };
  /** Add new filter rule */
  addRule: (rule: Omit<TabularFilterRule, 'id'>) => void;
  /** Update existing filter rule */
  updateRule: (id: string, updates: Partial<TabularFilterRule>) => void;
  /** Remove filter rule */
  removeRule: (id: string) => void;
  /** Clear all filter rules */
  clearRules: () => void;
  /** Toggle rule enabled atoms */
  toggleRule: (id: string) => void;
  /** Manually refresh preview */
  refreshPreview: () => Promise<void>;
  /** Set all rules at once */
  setRules: (rules: TabularFilterRule[]) => void;
}

/**
 * Generate unique ID for filter rule
 */
const generateRuleId = (): string => {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

const rulesEqual = (a: TabularFilterRule[], b: TabularFilterRule[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (
      !left ||
      !right ||
      left.id !== right.id ||
      left.column !== right.column ||
      left.operator !== right.operator ||
      left.value !== right.value ||
      left.enabled !== right.enabled
    ) {
      return false;
    }
  }
  return true;
};

/**
 * Hook for managing Tabular filtering and preview
 */
export const useTabularFilter = (options: UseTabularFilterOptions): UseTabularFilterResult => {
  const {
    tableId,
    initialRules = [],
    maxPreviewRows = 10,
    debounceMs = 300,
    autoRefresh = true,
  } = options;

  const tabularApi = useTabularApi();

  const [filterRules, setFilterRules] = useState<TabularFilterRule[]>(initialRules);
  const [previewData, setPreviewData] = useState<TabularDataResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  /**
   * Get enabled filter rules
   const enabledRules = useMemo(() => {
   return filterRules.filter(rule => rule.enabled);
   }, [filterRules]);
   */

  /**
   * Fetch preview data
   */
  const fetchPreview = useCallback(
    async (rules: TabularFilterRule[]) => {
      if (!tableId) return;

      try {
        setIsLoading(true);
        setError(null);

        const data = await tabularApi.getFilteredPreview(
          tableId,
          rules.filter((rule) => rule.enabled !== false),
          maxPreviewRows,
        );

        setPreviewData(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch preview';
        setError(message);
        setPreviewData(null);
      } finally {
        setIsLoading(false);
      }
    },
    [tabularApi, tableId, maxPreviewRows],
  );

  /**
   * Get filtered preview with specific rules
   */
  const getFilteredPreview = useCallback(
    async (rules: TabularFilterRule[]) => {
      await fetchPreview(rules);
    },
    [fetchPreview],
  );

  /**
   * Validate filter rules
   */
  const validateFilters = useCallback((rules: TabularFilterRule[]) => {
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
  const addRule = useCallback((rule: Omit<TabularFilterRule, 'id'>) => {
    const newRule: TabularFilterRule = {
      ...rule,
      id: generateRuleId(),
    };

    setFilterRules((prev) => {
      const next = [...prev, newRule];
      return rulesEqual(prev, next) ? prev : next;
    });
  }, []);

  /**
   * Update existing filter rule
   */
  const updateRule = useCallback((id: string, updates: Partial<TabularFilterRule>) => {
    setFilterRules((prev) => {
      const next = prev.map((rule) => (rule.id === id ? { ...rule, ...updates } : rule));
      return rulesEqual(prev, next) ? prev : next;
    });
  }, []);

  /**
   * Remove filter rule
   */
  const removeRule = useCallback((id: string) => {
    setFilterRules((prev) => {
      const next = prev.filter((rule) => rule.id !== id);
      return rulesEqual(prev, next) ? prev : next;
    });
  }, []);

  /**
   * Clear all filter rules
   */
  const clearRules = useCallback(() => {
    setFilterRules((prev) => (prev.length === 0 ? prev : []));
  }, []);

  /**
   * Toggle rule enabled atoms
   */
  const toggleRule = useCallback(
    (id: string) => {
      updateRule(id, { enabled: undefined }); // Will be inverted by the update logic
      setFilterRules((prev) => {
        const next = prev.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule));
        return rulesEqual(prev, next) ? prev : next;
      });
    },
    [updateRule],
  );

  /**
   * Manually refresh preview
   */
  const refreshPreview = useCallback(async () => {
    await fetchPreview(filterRules);
  }, [fetchPreview, filterRules]);

  /**
   * Set all rules at once
   */
  const setRules = useCallback((rules: TabularFilterRule[]) => {
    setFilterRules((prev) => (rulesEqual(prev, rules) ? prev : rules));
  }, []);

  // Initial preview load
  useEffect(() => {
    if (tableId && autoRefresh) {
      setRefreshCounter((prev) => prev + 1);
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
