/**
 * TreeConsole sorting and filtering helpers.
 *
 * Provides pure utilities for ordering and narrowing console node lists.
 */

import type { NodeType } from '@hierarchidb/core-types';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import type { TreeConsoleState } from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export interface SortFilterConfig {
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterBy?: string;
  searchTerm: string;
}

export function applySortFilterSearch(
  nodes: HierarchicalTreeNode[],
  config: SortFilterConfig,
  overrideTerm?: string
): HierarchicalTreeNode[] {
  const sortBy = config.sortBy || 'name';
  const sortDir = config.sortDirection || 'asc';
  const filterBy = config.filterBy || '';
  const term = (overrideTerm ?? config.searchTerm).trim();

  let arr: HierarchicalTreeNode[] = [...nodes];

  if (filterBy) {
    arr = arr.filter((n) => (n.nodeType as NodeType | undefined) === (filterBy as NodeType));
  }

  if (term) {
    const lower = term.toLowerCase();
    arr = arr.filter((n) => {
      const name = n.metadata?.name ?? '';
      const desc = n.metadata?.description ?? '';
      return name.toLowerCase().includes(lower) || desc.toLowerCase().includes(lower);
    });
  }

  arr.sort((a, b) => {
    const key = sortBy || 'name';
    const resolve = (node: HierarchicalTreeNode): unknown => {
      if (key === 'name') return node.metadata?.name ?? '';
      if (key === 'description') return node.metadata?.description ?? '';
      if (isRecord(node) && key in node) {
        return node[key];
      }
      return undefined;
    };
    const va = resolve(a) ?? '';
    const vb = resolve(b) ?? '';
    const cmp = String(va).localeCompare(String(vb), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return arr;
}

export function deriveConfigFromState(
  state: TreeConsoleState,
  searchTerm: string
): SortFilterConfig {
  return {
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
    filterBy: state.filterBy,
    searchTerm,
  };
}
