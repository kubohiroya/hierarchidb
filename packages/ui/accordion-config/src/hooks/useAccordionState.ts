import { useState, useCallback, useMemo } from 'react';

export interface AccordionState {
  /** Set of expanded accordion keys */
  expanded: Set<string>;
  /** Check if a specific accordion is expanded */
  isExpanded: (key: string) => boolean;
  /** Toggle a specific accordion */
  toggle: (key: string) => void;
  /** Expand a specific accordion */
  expand: (key: string) => void;
  /** Collapse a specific accordion */
  collapse: (key: string) => void;
  /** Expand all accordions */
  expandAll: () => void;
  /** Collapse all accordions */
  collapseAll: () => void;
  /** Set multiple accordions expanded state */
  setExpanded: (keys: string[]) => void;
  /** Get array of expanded keys */
  getExpandedKeys: () => string[];
}

export interface UseAccordionStateOptions {
  /** Initial expanded accordion keys */
  defaultExpanded?: string[];
  /** Whether only one accordion can be expanded at a time */
  exclusive?: boolean;
  /** Callback when expansion state changes */
  onChange?: (expandedKeys: string[]) => void;
  /** All available accordion keys (for expandAll) */
  allKeys?: string[];
}

/**
 * Hook to manage accordion expansion state
 */
export function useAccordionState(options: UseAccordionStateOptions = {}): AccordionState {
  const {
    defaultExpanded = [],
    exclusive = false,
    onChange,
    allKeys = [],
  } = options;

  const [expanded, setExpandedInternal] = useState<Set<string>>(
    new Set(defaultExpanded)
  );

  const updateExpanded = useCallback((newExpanded: Set<string>) => {
    setExpandedInternal(newExpanded);
    onChange?.(Array.from(newExpanded));
  }, [onChange]);

  const isExpanded = useCallback((key: string) => {
    return expanded.has(key);
  }, [expanded]);

  const toggle = useCallback((key: string) => {
    const newExpanded = new Set(expanded);
    
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      if (exclusive) {
        newExpanded.clear();
      }
      newExpanded.add(key);
    }
    
    updateExpanded(newExpanded);
  }, [expanded, exclusive, updateExpanded]);

  const expand = useCallback((key: string) => {
    const newExpanded = new Set(expanded);
    
    if (exclusive) {
      newExpanded.clear();
    }
    newExpanded.add(key);
    
    updateExpanded(newExpanded);
  }, [expanded, exclusive, updateExpanded]);

  const collapse = useCallback((key: string) => {
    const newExpanded = new Set(expanded);
    newExpanded.delete(key);
    updateExpanded(newExpanded);
  }, [expanded, updateExpanded]);

  const expandAll = useCallback(() => {
    if (exclusive) {
      // In exclusive mode, can only expand the first one
      if (allKeys.length > 0 && allKeys[0]) {
        updateExpanded(new Set([allKeys[0]]));
      }
    } else {
      updateExpanded(new Set(allKeys));
    }
  }, [allKeys, exclusive, updateExpanded]);

  const collapseAll = useCallback(() => {
    updateExpanded(new Set());
  }, [updateExpanded]);

  const setExpanded = useCallback((keys: string[]) => {
    if (exclusive && keys.length > 1) {
      // In exclusive mode, only keep the last key
      const lastKey = keys[keys.length - 1];
      if (lastKey) {
        updateExpanded(new Set([lastKey]));
      }
    } else {
      updateExpanded(new Set(keys));
    }
  }, [exclusive, updateExpanded]);

  const getExpandedKeys = useCallback(() => {
    return Array.from(expanded);
  }, [expanded]);

  return useMemo(() => ({
    expanded,
    isExpanded,
    toggle,
    expand,
    collapse,
    expandAll,
    collapseAll,
    setExpanded,
    getExpandedKeys,
  }), [
    expanded,
    isExpanded,
    toggle,
    expand,
    collapse,
    expandAll,
    collapseAll,
    setExpanded,
    getExpandedKeys,
  ]);
}