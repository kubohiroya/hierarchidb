import { useEffect, useMemo, useState } from 'react';
import type { TreeNode } from '@hierarchidb/common-type';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';

export type ViewMode = 'list' | 'grid';

export interface TreeConsoleSSOTEntry {
  pageNodeId: string;
  // data
  rawNodes: TreeNode[];
  treeData: TreeNodeData[];
  // normalized graph indices
  nodesById?: Map<string, TreeNode>;
  childrenByParent?: Map<string, Set<string>>;
  // ui state
  selectedIds: string[];
  expandedIds: string[];
  searchTerm: string;
  viewMode: ViewMode;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterBy?: string;
  // toolbar/enable flags
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  // loading/error
  loading: boolean;
  error: string | null;
  // subscription ref management (optional)
  refCount: number;
}

export type TreeConsoleSSOT = Record<string, TreeConsoleSSOTEntry>;

function defaults(pageNodeId: string): TreeConsoleSSOTEntry {
  return {
    pageNodeId,
    rawNodes: [],
    treeData: [],
    nodesById: new Map<string, TreeNode>(),
    childrenByParent: new Map<string, Set<string>>(),
    selectedIds: [],
    expandedIds: [],
    searchTerm: '',
    viewMode: 'list',
    sortBy: 'name',
    sortDirection: 'asc',
    filterBy: '',
    canUndo: false,
    canRedo: false,
    canPaste: false,
    loading: false,
    error: null,
    refCount: 0,
  };
}

// Single Source of Truth for TreeConsole state across the app (keyed by pageNodeId)
let __TREECONSOLE_SSOT__: TreeConsoleSSOT = {};
const __LISTENERS__ = new Set<() => void>();

function getStore(): TreeConsoleSSOT {
  return __TREECONSOLE_SSOT__;
}

function updateStore(mutator: (prev: TreeConsoleSSOT) => TreeConsoleSSOT) {
  __TREECONSOLE_SSOT__ = mutator(__TREECONSOLE_SSOT__);
  for (const fn of Array.from(__LISTENERS__)) {
    try { fn(); } catch { /* noop */ }
  }
}

export function useTreeConsoleSSOT(pageNodeId: string | undefined) {
  const [, setTick] = useState(0);
  const store = useMemo(() => getStore(), []);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    __LISTENERS__.add(l);
    return () => { __LISTENERS__.delete(l); };
  }, []);
  const key = pageNodeId || '';
  const state = key ? (store[key] ?? defaults(key)) : defaults('');

  const set = (patch: Partial<TreeConsoleSSOTEntry>) => {
    if (!key) return;
    updateStore((prev) => ({
      ...prev,
      [key]: { ...((prev[key] as TreeConsoleSSOTEntry) ?? defaults(key)), ...patch, pageNodeId: key },
    }));
  };

  const replace = (next: TreeConsoleSSOTEntry) => {
    if (!key) return;
    updateStore((prev) => ({ ...prev, [key]: next }));
  };

  const clear = () => {
    if (!key) return;
    updateStore((prev) => {
      const cp = { ...prev } as TreeConsoleSSOT;
      delete cp[key];
      return cp;
    });
  };

  const incRef = () => set({ refCount: (state.refCount || 0) + 1 });
  const decRef = () => set({ refCount: Math.max(0, (state.refCount || 0) - 1) });

  return { state, set, replace, clear, incRef, decRef };
}
