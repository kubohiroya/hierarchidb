import { useEffect, useMemo, useState } from 'react';
import type { TreeNode } from '@hierarchidb/feature-core/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-shell/ui-treeconsole-base';

export type ViewMode = 'list' | 'grid';

export interface TreeConsoleSSOTEntry {
  pageNodeId: string;
  rawNodes: TreeNode[];
  treeData: TreeNodeData[];
  nodesById?: Map<string, TreeNode>;
  childrenByParent?: Map<string, Set<string>>;
  selectedIds: string[];
  expandedIds: string[];
  searchTerm: string;
  viewMode: ViewMode;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  filterBy?: string;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  loading: boolean;
  error: string | null;
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

let STORE: TreeConsoleSSOT = {};
const LISTENERS = new Set<() => void>();

function getStore(): TreeConsoleSSOT {
  return STORE;
}

function updateStore(mutator: (prev: TreeConsoleSSOT) => TreeConsoleSSOT) {
  STORE = mutator(STORE);
  for (const fn of Array.from(LISTENERS)) {
    try { fn(); } catch { /* noop */ }
  }
}

export function useTreeConsoleSSOT(pageNodeId: string | undefined) {
  const [, setTick] = useState(0);
  const store = getStore();
  useEffect(() => {
    const listener = () => setTick((prev) => prev + 1);
    LISTENERS.add(listener);
    return () => {
      LISTENERS.delete(listener);
    };
  }, []);

  const key = pageNodeId || '';
  const state = key ? (store[key] ?? defaults(key)) : defaults('');

  const api = useMemo(() => {
    if (!key) {
      const noop = () => {};
      const noopReplace = (_next: TreeConsoleSSOTEntry) => {};
      return {
        set: noop,
        replace: noopReplace,
        clear: noop,
        incRef: noop,
        decRef: noop,
      };
    }

    const set = (patch: Partial<TreeConsoleSSOTEntry>) => {
      updateStore((prev) => ({
        ...prev,
        [key]: {
          ...((prev[key] as TreeConsoleSSOTEntry) ?? defaults(key)),
          ...patch,
          pageNodeId: key,
        },
      }));
    };

    const replace = (next: TreeConsoleSSOTEntry) => {
      updateStore((prev) => ({ ...prev, [key]: next }));
    };

    const clear = () => {
      updateStore((prev) => {
        const copy = { ...prev } as TreeConsoleSSOT;
        delete copy[key];
        return copy;
      });
    };

    const incRef = () => {
      updateStore((prev) => {
        const prevEntry = (prev[key] as TreeConsoleSSOTEntry) ?? defaults(key);
        return {
          ...prev,
          [key]: {
            ...prevEntry,
            refCount: (prevEntry.refCount ?? 0) + 1,
          },
        };
      });
    };

    const decRef = () => {
      updateStore((prev) => {
        const prevEntry = (prev[key] as TreeConsoleSSOTEntry) ?? defaults(key);
        return {
          ...prev,
          [key]: {
            ...prevEntry,
            refCount: Math.max(0, (prevEntry.refCount ?? 0) - 1),
          },
        };
      });
    };

    return { set, replace, clear, incRef, decRef };
  }, [key]);

  return { state, ...api };
}
