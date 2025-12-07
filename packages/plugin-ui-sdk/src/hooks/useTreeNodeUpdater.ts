import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NodeId,
  TreeId,
  TreeNode,
  NodeType,
  TreeNodeMetadata,
  TreeNodeUpdaterPayload,
  Timestamp,
} from '@hierarchidb/common-types';
import type { DiscardDraftOptions, TreeNodeUpdaterAPI, TreeQueryAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { Remote } from 'comlink';

const debounce = <T extends (...args: any[]) => void>(fn: T, wait: number) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
};

export interface TreeNodeUpdaterState<TPayload extends object = Record<string, unknown>>
  extends TreeNodeUpdaterPayload<TPayload> {
  treeNodeId: NodeId;
  metadata?: TreeNodeMetadata;
  data?: Record<string, unknown>;
  draftMetadata: TreeNodeMetadata | null;
  draftData: TPayload | null;
  version?: number;
  updatedAt?: Timestamp;
  hasRemoteDraft?: boolean;
}

export interface UseTreeNodeUpdaterOptions<TPayload extends object = Record<string, unknown>> {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  workerClient?: WorkerClientRef | null;
  initialDraftData?: TPayload;
  initialDraftMetadata?: TreeNodeMetadata;
  /** If true, discard draft on pagehide/beforeunload (defaults to false to preserve edits). */
  autoDiscardOnUnload?: boolean;
}

export interface UseTreeNodeUpdaterResult<TPayload extends object = Record<string, unknown>> {
  treeNodeUpdater: TreeNodeUpdaterState<TPayload> | null;
  hasUnsavedChanges: boolean;
  updateTreeNodeUpdater: (data: Partial<TreeNodeUpdaterState<TPayload>>) => void;
  commitTreeNodeUpdater: (data?: Partial<TreeNodeUpdaterState<TPayload>>) => Promise<NodeId>;
  saveDraftTreeNodeUpdater: (data?: Partial<TreeNodeUpdaterState<TPayload>>) => Promise<void>;
  discardDraft: (options?: DiscardDraftOptions) => Promise<void>;
  loading: boolean;
  error: Error | null;
  /** Deprecated aliases (for compatibility while migrating naming) */
  draft: TreeNodeUpdaterState<TPayload> | null;
  updateDraft: (data: Partial<TreeNodeUpdaterState<TPayload>>) => void;
  saveDraft: (data?: Partial<TreeNodeUpdaterState<TPayload>>) => Promise<NodeId>;
}

// Shared alias for dialog payloads; intentionally does not include metadata/version/timestamps.
export type PluginDialogData<TPayload extends object = Record<string, unknown>> = TPayload;

export const createTreeNodeUpdaterActions = <TPayload extends object = Record<string, unknown>>(
  updateDraft: (data: Partial<TreeNodeUpdaterState<TPayload>>) => void
) => {
  const updatePayload = (patch: Partial<TPayload>, base?: TPayload) => {
    const next = { ...(base ?? ({} as TPayload)), ...patch } as TPayload;
    updateDraft({ draftData: next });
  };
  const updateMetadata = (patch: Partial<TreeNodeMetadata>, base?: TreeNodeMetadata) => {
    const fallback: TreeNodeMetadata = { name: '', description: '', tags: [] };
    updateDraft({ draftMetadata: { ...(base ?? fallback), ...patch } });
  };
  const updatePayloadAndMetadata = (
    payloadPatch: Partial<TPayload>,
    metadataPatch: Partial<TreeNodeMetadata>,
    base?: { payload?: TPayload; metadata?: TreeNodeMetadata }
  ) => {
    updatePayload(payloadPatch, base?.payload);
    updateMetadata(metadataPatch, base?.metadata);
  };

  return { updatePayload, updateMetadata, updatePayloadAndMetadata };
};

export function useTreeNodeUpdater<TPayload extends object = Record<string, unknown>>({
  mode,
  nodeType,
  nodeId,
  parentId,
  treeId,
  workerClient,
  initialDraftData,
  initialDraftMetadata,
  autoDiscardOnUnload = false,
}: UseTreeNodeUpdaterOptions<TPayload>): UseTreeNodeUpdaterResult<TPayload> {
  const [draft, setDraft] = useState<TreeNodeUpdaterState<TPayload> | null>(null);
  const [originalCopy, setOriginalCopy] = useState<TreeNodeUpdaterState<TPayload> | null>(null);
  const [workingNodeId, setWorkingNodeId] = useState<NodeId | null>(nodeId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const draftIdRef = useRef<NodeId | null>(nodeId ?? null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const persistDisableUntilRef = useRef<number>(0);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const toUpdater = useCallback((node: TreeNode): TreeNodeUpdaterState<TPayload> => {
    const hasRemoteDraft = node.draftData != null || node.draftMetadata != null;
    const draftMetadata = (node as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ?? null;
    const draftData =
      node.draftData && isRecord(node.draftData) ? (node.draftData as TPayload) : null;
    return {
      treeNodeId: node.id as NodeId,
      draftMetadata,
      metadata: node.metadata,
      data: node.data as Record<string, unknown> | undefined,
      draftData,
      version: node.version,
      updatedAt: node.updatedAt,
      hasRemoteDraft,
    };
  }, []);

  const getClient = useCallback(async (): Promise<{ wc: TreeNodeUpdaterAPI; query: TreeQueryAPI; remote: Remote<WorkerAPI> }> => {
    if (!workerClient) throw new Error('Worker client not initialized');
    const api = workerClient.getAPI();
    const wc = await api.getTreeNodeUpdaterAPI();
    const query = await api.getQueryAPI();
    return { wc, query, remote: api };
  }, [workerClient]);

  useEffect(() => {
    async function initializeDraft() {
      if (!workerClient) return;
      setLoading(true);
      setError(null);

      try {
        const { wc: wcAPI } = await getClient();

        if (mode === 'edit' && nodeId) {
          const existing = await wcAPI.getTreeNode(nodeId);
          if (!existing) throw new Error('Working copy not found for edit');
          const copy = toUpdater(existing);
          setDraft(copy);
          setOriginalCopy(copy);
          setWorkingNodeId(copy.treeNodeId);
          draftIdRef.current = copy.treeNodeId;
          return;
        }

        if (mode === 'create') {
          if (!parentId) {
            console.warn('[useTreeNodeUpdater] Missing parentId for create mode; draft not initialized');
            return;
          }
          const initialPayload: Partial<TreeNode> = {
            ...(nodeId ? { id: nodeId } : {}),
            ...(initialDraftMetadata ? { draftMetadata: initialDraftMetadata } : {}),
            ...(initialDraftData
              ? { draftData: initialDraftData as unknown as Record<string, unknown> }
              : {}),
          };
          const wcNode = await wcAPI.initTreeNode(
            nodeType as NodeType,
            parentId,
            initialPayload
          );
          const copy = toUpdater(wcNode);
          setDraft(copy);
          setOriginalCopy(copy);
          setWorkingNodeId(copy.treeNodeId);
          draftIdRef.current = copy.treeNodeId;
          return;
        }
      } catch (err) {
        console.error('Failed to initialize draft:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    initializeDraft();
  }, [workerClient, mode, nodeId, parentId, nodeType, treeId, toUpdater, getClient]);

  const computeUnsaved = useCallback(() => {
    if (!draft || !originalCopy) return false;
    return JSON.stringify(draft) !== JSON.stringify(originalCopy);
  }, [draft, originalCopy]);

  useEffect(() => {
    setHasUnsaved(computeUnsaved());
  }, [computeUnsaved, draft, originalCopy]);

  const persistTreeNodeUpdater = useMemo(
    () =>
      debounce(async (next: TreeNodeUpdaterState<TPayload>) => {
        const targetId = next.treeNodeId ?? workingNodeId;
        if (!targetId) return;
        if (persistDisableUntilRef.current > Date.now()) return;
        try {
          const { wc: wcAPI } = await getClient();
          await wcAPI.updateTreeNodeDraftMetadata(
            targetId,
            (next.draftMetadata === null ? null : (next.draftMetadata ?? {})) as any
          );
          await wcAPI.updateTreeNodeDraftData(
            targetId,
            (next.draftData === null ? null : (next.draftData ?? {})) as any
          );
        } catch (err) {
          console.warn('[useTreeNodeUpdater] persist update failed', err);
        }
      }, 150),
    [getClient, workingNodeId]
  );

  const updateTreeNodeUpdater = useCallback(
    (data: Partial<TreeNodeUpdaterState<TPayload>>) => {
      setDraft((prev) => {
        if (!prev) return null;

        const nextDraftMetadata =
          data.draftMetadata !== undefined
            ? data.draftMetadata
            : data.metadata
              ? { ...(prev.draftMetadata ?? null), ...data.metadata }
              : prev.draftMetadata ?? null;

        const nextDraftData =
          data.draftData !== undefined
            ? data.draftData
            : data.draftData === null
              ? null
              : prev.draftData ?? null;

        const merged: TreeNodeUpdaterState<TPayload> = {
          treeNodeId: prev.treeNodeId,
          draftMetadata: nextDraftMetadata ?? null,
          draftData: nextDraftData ?? null,
          metadata: data.metadata ?? prev.metadata,
          data: prev.data,
          version: data.version ?? prev.version,
          updatedAt: data.updatedAt ?? prev.updatedAt,
          hasRemoteDraft: data.hasRemoteDraft ?? prev.hasRemoteDraft,
        };
        persistTreeNodeUpdater(merged);
        return merged;
      });
    },
    [persistTreeNodeUpdater]
  );

  const commitTreeNodeUpdater = useCallback(async (data?: Partial<TreeNodeUpdaterState<TPayload>>): Promise<NodeId> => {
    if (!draft) throw new Error('No draft to save');
    const targetId = (data?.treeNodeId ?? draft.treeNodeId ?? workingNodeId) as NodeId | null;
    if (!targetId) throw new Error('nodeId is required to save draft');

    // Final payload is explicitly constructed so caller can pass latest step data/metadata
    // and so we can clear drafts synchronously before commit.
    const finalData: TreeNodeUpdaterState<TPayload> = {
      ...draft,
      ...data,
      treeNodeId: targetId,
      draftData: data?.draftData ?? draft.draftData ?? null,
      draftMetadata: data?.draftMetadata ?? draft.draftMetadata ?? null,
      metadata: data?.metadata ?? draft.metadata,
      data: data?.data ?? draft.data,
    };

    try {
      setLoading(true);
      persistDisableUntilRef.current = Date.now() + 300;
      const { wc: wcAPI, query } = await getClient();

      // Push the latest values synchronously (no debounce) before commit.
      await wcAPI.updateTreeNodeDraftMetadata(
        targetId,
        (finalData.draftMetadata === null ? null : (finalData.draftMetadata ?? {})) as any
      );
      await wcAPI.updateTreeNodeDraftData(
        targetId,
        (finalData.draftData === null ? null : (finalData.draftData ?? {})) as any
      );

      const res = await wcAPI.commitDraft(targetId, {
        onNameConflict: 'auto-rename',
      });

      if (res.status === 'ok') {
        const committedNodeId = (res.node?.id as NodeId | undefined) ?? res.nodeId ?? targetId;

        const latestNode = (await query.getNode(committedNodeId)) ?? res.node;

        let refreshedCopy: TreeNodeUpdaterState<TPayload>;
        if (latestNode) {
          refreshedCopy = toUpdater(latestNode as TreeNode);
        } else {
          refreshedCopy = {
            ...finalData,
            treeNodeId: committedNodeId,
            data: (finalData.draftData ?? finalData.data) as Record<string, unknown>,
            version: typeof finalData.version === 'number' ? finalData.version + 1 : 1,
            updatedAt: Date.now() as Timestamp,
          };
        }

        // After commit, move any draft payload/metadata into committed fields and clear draft.
        const committedPayload =
          (refreshedCopy.data as Record<string, unknown> | undefined) ??
          ((refreshedCopy.draftData ?? {}) as Record<string, unknown>);
        const committedMetadata: TreeNodeMetadata = {
          ...(refreshedCopy.metadata ?? { name: '', description: '', tags: [] }),
          ...(refreshedCopy.draftMetadata ?? {}),
        };
        refreshedCopy = {
          ...refreshedCopy,
          metadata: committedMetadata,
          data: committedPayload,
          draftMetadata: null as any,
          draftData: null as any,
          hasRemoteDraft: false,
        };

        // Explicitly clear draft on the server so subsequent fetches do not return draftData/draftMetadata.
        try {
          await wcAPI.updateTreeNodeDraftMetadata(committedNodeId, null as any);
          await wcAPI.updateTreeNodeDraftData(committedNodeId, null as any);
        } catch (clearErr) {
          console.warn('[useTreeNodeUpdater] failed to clear server draft after commit', clearErr);
        }

        setDraft(refreshedCopy);
        setOriginalCopy(refreshedCopy);
        setWorkingNodeId(committedNodeId);
        draftIdRef.current = committedNodeId;
        return committedNodeId;
      }

      throw new Error(`Working copy commit failed: ${res.status}`);
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      persistDisableUntilRef.current = 0;
      setLoading(false);
    }
  }, [draft, getClient, toUpdater, workingNodeId]);

  const saveDraftTreeNodeUpdater = useCallback(async (data?: Partial<TreeNodeUpdaterState<TPayload>>): Promise<void> => {
    if (!draft) throw new Error('No draft to save');
    const targetId = (data?.treeNodeId ?? draft.treeNodeId ?? workingNodeId) as NodeId | null;
    if (!targetId) throw new Error('nodeId is required to save draft');

    const next: TreeNodeUpdaterState<TPayload> = {
      ...draft,
      ...data,
      treeNodeId: targetId,
      draftData: data?.draftData ?? draft.draftData ?? null,
      draftMetadata: data?.draftMetadata ?? draft.draftMetadata ?? null,
      // metadata/data are intentionally left as-is (per Save Draft semantics)
    };

    const { wc: wcAPI } = await getClient();
    persistDisableUntilRef.current = Date.now() + 300;
    await wcAPI.updateTreeNodeDraftMetadata(
      targetId,
      (next.draftMetadata === null ? null : (next.draftMetadata ?? {})) as any
    );
    await wcAPI.updateTreeNodeDraftData(
      targetId,
      (next.draftData === null ? null : (next.draftData ?? {})) as any
    );
    persistDisableUntilRef.current = 0;
    setDraft((prev) => (prev?.treeNodeId === targetId ? { ...prev, ...next } : prev));
  }, [draft, getClient, workingNodeId]);

  const discardDraft = useCallback(async (options?: DiscardDraftOptions) => {
    const targetId = draft?.treeNodeId ?? workingNodeId;
    if (!targetId) return;
    const { wc: wcAPI } = await getClient();
    await wcAPI.discardDraft(targetId, options);
    setDraft(null);
    setOriginalCopy(null);
    setWorkingNodeId(null);
    draftIdRef.current = null;
  }, [draft?.treeNodeId, getClient, workingNodeId]);

  useEffect(() => {
    draftIdRef.current = workingNodeId ?? nodeId ?? null;
  }, [nodeId, workingNodeId]);

  useEffect(() => {
    if (!autoDiscardOnUnload || !workerClient || !nodeId) {
      return undefined;
    }

    let hasRequestedAutoDiscard = false;

    const requestAutoDiscard = () => {
      if (hasRequestedAutoDiscard) return;
      const currentId = draftIdRef.current;
      if (!currentId) return;
      hasRequestedAutoDiscard = true;
      queueMicrotask(() => {
        getClient()
          .then(({ wc: wcAPI }) => wcAPI.discardDraft(currentId));
      });
    };

    const handlePageHide = (event: Event) => {
      const maybePageTransition = event as PageTransitionEvent | undefined;
      if (maybePageTransition?.persisted) return;
      requestAutoDiscard();
    };

    const handleBeforeUnload = () => {
      requestAutoDiscard();
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [autoDiscardOnUnload, getClient, workerClient, nodeId]);

  return {
    treeNodeUpdater: draft,
    hasUnsavedChanges: hasUnsaved,
    updateTreeNodeUpdater,
    commitTreeNodeUpdater,
    saveDraftTreeNodeUpdater,
    discardDraft,
    loading,
    error,
    draft,
    updateDraft: updateTreeNodeUpdater,
    saveDraft: commitTreeNodeUpdater,
  };
}
