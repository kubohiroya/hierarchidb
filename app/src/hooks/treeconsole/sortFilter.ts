/**
 * TreeConsole sorting and filtering helpers.
 *
 * Provides pure utilities for ordering and narrowing tree node lists.
 */

import type { NodeType } from '@hierarchidb/common-type';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';
import type { TreeConsoleState } from './types.js';

export interface SortFilterConfig {
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterBy?: string;
  searchTerm: string;
}

export function applySortFilterSearch(
  nodes: TreeNodeData[],
  config: SortFilterConfig,
  overrideTerm?: string,
): TreeNodeData[] {
  const sortBy = config.sortBy || 'name';
  const sortDir = config.sortDirection || 'asc';
  const filterBy = config.filterBy || '';
  const term = (overrideTerm ?? config.searchTerm).trim();

  let arr: TreeNodeData[] = [...nodes];

  if (filterBy) {
    arr = arr.filter((n) => (n.nodeType as NodeType | undefined) === (filterBy as NodeType));
  }

  if (term) {
    const lower = term.toLowerCase();
    arr = arr.filter((n) => (n.name || '').toLowerCase().includes(lower));
  }

  arr.sort((a, b) => {
    const key = sortBy || 'name';
    const va = (a as unknown as Record<string, unknown>)[key] ?? '';
    const vb = (b as unknown as Record<string, unknown>)[key] ?? '';
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return arr;
}

export function deriveConfigFromState(state: TreeConsoleState, searchTerm: string): SortFilterConfig {
  return {
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    filterBy: state.filterBy,
    searchTerm,
  };
}
