import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PrimitiveAtom } from 'jotai';
import { atom } from 'jotai';
import { createStore } from 'jotai/vanilla';
import type { NodeId, TreeNodeMetadata, TreeNodeData } from '@hierarchidb/common-types';
import type { UseTreeNodeUpdaterOptions } from './useTreeNodeUpdater.js';
import { useTreeNodeUpdater } from './useTreeNodeUpdater.js';

type DraftShape<TPayload extends Record<string, unknown>> = Partial<TPayload>;

const isRecord = (value: unknown): value is TreeNodeData =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const shallowEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  if (!isRecord(a) || !isRecord(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

export interface SingleSourceDialogAtomResult<TEntity extends Record<string, unknown>> {
  store: ReturnType<typeof createStore>;
  draftAtom: PrimitiveAtom<DraftShape<TEntity>>;
  metadataAtom: PrimitiveAtom<TreeNodeMetadata>;
  treeNodeUpdater: ReturnType<typeof useTreeNodeUpdater<TEntity>>['treeNodeUpdater'];
  updateTreeNodeUpdater: ReturnType<typeof useTreeNodeUpdater<TEntity>>['updateTreeNodeUpdater'];
  hasUnsavedChanges: boolean;
  loading: boolean;
  error: Error | null;
  treeNodeId?: NodeId;
  commit: () => Promise<NodeId | undefined>;
  discard: () => Promise<void>;
  setDraft: (updater: (prev: DraftShape<TEntity>) => DraftShape<TEntity>) => void;
  setMetadata: (updater: (prev: TreeNodeMetadata) => TreeNodeMetadata) => void;
}

export type UseSingleSourceDialogAtomOptions<TEntity extends Record<string, unknown>> =
  UseTreeNodeUpdaterOptions<TEntity>;

/**
 * Single-source dialog state hook backed by TreeNodeUpdater.
 * Exposes jotai atoms for draftData/draftMetadata with equality guards
 * to avoid redundant updates and render loops.
 */
export function useSingleSourceDialogAtom<TEntity extends Record<string, unknown> = Record<string, unknown>>(
  options: UseSingleSourceDialogAtomOptions<TEntity>
): SingleSourceDialogAtomResult<TEntity> {
  const {
    treeNodeUpdater,
    hasUnsavedChanges,
    updateTreeNodeUpdater,
    commitTreeNodeUpdater,
    discardDraft,
    loading,
    error,
  } = useTreeNodeUpdater<TEntity>(options);

  const storeRef = useRef<ReturnType<typeof createStore>>();
  if (!storeRef.current) {
    storeRef.current = createStore();
  }
  const store = storeRef.current;

  const draftAtomRef = useRef<PrimitiveAtom<DraftShape<TEntity>>>();
  const metadataAtomRef = useRef<PrimitiveAtom<TreeNodeMetadata>>();

  const draftAtom = useMemo(() => {
    const initial = (treeNodeUpdater?.draftData ??
      ({} as DraftShape<TEntity>)) as DraftShape<TEntity>;
    const created = atom<DraftShape<TEntity>>(initial);
    draftAtomRef.current = created;
    return created;
    // regenerate only when the treenode changes
  }, [treeNodeUpdater?.treeNodeId]);

  const metadataAtom = useMemo(() => {
    const initial = (treeNodeUpdater?.draftMetadata ??
      ({ name: '', description: '', tags: [] } as TreeNodeMetadata)) as TreeNodeMetadata;
    const created = atom<TreeNodeMetadata>(initial);
    metadataAtomRef.current = created;
    return created;
  }, [treeNodeUpdater?.treeNodeId]);

  // Sync atoms from TreeNodeUpdater when the backend state changes
  useEffect(() => {
    if (!treeNodeUpdater) return;
    if (draftAtomRef.current) {
      const prev = store.get(draftAtomRef.current);
      const next = (treeNodeUpdater.draftData ?? ({} as DraftShape<TEntity>)) as DraftShape<TEntity>;
      if (!shallowEqual(prev, next)) {
        store.set(draftAtomRef.current, next);
      }
    }
    if (metadataAtomRef.current) {
      const prev = store.get(metadataAtomRef.current);
      const next =
        (treeNodeUpdater.draftMetadata ??
          ({ name: '', description: '', tags: [] } as TreeNodeMetadata)) as TreeNodeMetadata;
      if (!shallowEqual(prev, next)) {
        store.set(metadataAtomRef.current, next);
      }
    }
  }, [store, treeNodeUpdater?.draftData, treeNodeUpdater?.draftMetadata, treeNodeUpdater?.treeNodeId]);

  const setDraft = useCallback(
    (updater: (prev: DraftShape<TEntity>) => DraftShape<TEntity>) => {
      if (!draftAtomRef.current) return;
      const prev = store.get(draftAtomRef.current);
      const next = updater(prev);
      if (shallowEqual(prev, next)) {
        return;
      }
      store.set(draftAtomRef.current, next);
      updateTreeNodeUpdater({ draftData: next as TEntity });
    },
    [store, updateTreeNodeUpdater]
  );

  const setMetadata = useCallback(
    (updater: (prev: TreeNodeMetadata) => TreeNodeMetadata) => {
      if (!metadataAtomRef.current) return;
      const prev = store.get(metadataAtomRef.current);
      const next = updater(prev);
      if (shallowEqual(prev, next)) {
        return;
      }
      store.set(metadataAtomRef.current, next);
      updateTreeNodeUpdater({ draftMetadata: next });
    },
    [store, updateTreeNodeUpdater]
  );

  const commit = useCallback(async () => {
    if (!treeNodeUpdater) throw new Error('No draft to save');
    return commitTreeNodeUpdater('save', treeNodeUpdater);
  }, [commitTreeNodeUpdater, treeNodeUpdater]);

  const discard = useCallback(async () => {
    await discardDraft();
  }, [discardDraft]);

  return {
    store,
    draftAtom,
    metadataAtom,
    hasUnsavedChanges,
    treeNodeUpdater,
    updateTreeNodeUpdater,
    loading,
    error,
    treeNodeId: treeNodeUpdater?.treeNodeId,
    commit,
    discard,
    setDraft,
    setMetadata,
  };
}
