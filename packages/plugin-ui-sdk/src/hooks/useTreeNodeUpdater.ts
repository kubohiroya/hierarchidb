import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId, NodeType, PeerEntity, Timestamp, TreeId } from '@hierarchidb/core-types';
import type {
  CommitDraftMode,
  DialogUIState,
  DiscardDraftOptions,
  TreeNode,
  TreeNodeData,
  TreeNodeMetadata,
  TreeNodeUpdaterAPI,
} from '@hierarchidb/tree-api';
import type { TreeQueryAPI } from '@hierarchidb/tree-api';
import type { WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import { Remote } from 'comlink';

type WorkerApi = WorkerAPI<TreeNodeData>;

export interface TreeNodeUpdaterState<TPayload extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>> {
  treeNodeId: NodeId;
  draftMetadata: TreeNodeMetadata | null;
  draftData?: Partial<TPayload>;
  dialogUIState: DialogUIState;
  isTemporary?: boolean;
  version?: number;
  updatedAt?: Timestamp;
  hasRemoteDraft?: boolean;
}

export interface UseTreeNodeUpdaterOptions<
  TPayload extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>
> {
  mode: 'create' | 'edit';
  nodeType: string;
  nodeId?: NodeId;
  parentId?: NodeId;
  treeId?: TreeId;
  workerClient?: WorkerClientRef | null;
  initialDraftData?: Partial<TPayload>;
  initialDraftMetadata?: TreeNodeMetadata;
  /** If true, discard draft on pagehide/beforeunload (defaults to false to preserve edits). */
  autoDiscardOnUnload?: boolean;
}

export interface UseTreeNodeUpdaterResult<
  TPayload extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>
> {
  treeNodeUpdater: TreeNodeUpdaterState<TPayload> | null;
  hasUnsavedChanges: boolean;
  updateTreeNodeUpdater: (data: Partial<TreeNodeUpdaterState<TPayload>>) => void;
  commitTreeNodeUpdater: (mode: CommitDraftMode, data: TreeNodeUpdaterState<TPayload>) => Promise<NodeId>;
  discardDraft: (options?: DiscardDraftOptions) => Promise<void>;
  loading: boolean;
  error: Error | null;
  /** Deprecated aliases (for compatibility while migrating naming) */
  draft: TreeNodeUpdaterState<TPayload> | null;
  updateDraft: (data: Partial<TreeNodeUpdaterState<TPayload>>) => void;
  saveDraft: (data: TreeNodeUpdaterState<TPayload>) => Promise<NodeId>;
}

// Shared alias for dialog payloads; intentionally does not include metadata/version/timestamps.
export type PluginDialogData<
  TPayload extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>
> = TPayload;

const DEFAULT_DIALOG_UI_STATE: DialogUIState = {};

const normalizeComparableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeComparableValue(entry));
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    Object.keys(record)
      .sort()
      .forEach((key) => {
        next[key] = normalizeComparableValue(record[key]);
      });
    return next;
  }
  return value;
};

const stableStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[useTreeNodeUpdater] stableStringify failed', error);
    }
    return String(value);
  }
};

export const createTreeNodeUpdaterActions = <
  TPayload extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>
>(
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

export function useTreeNodeUpdater<
  TPayload extends PeerEntity<TreeNodeData> = PeerEntity<TreeNodeData>
>({
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

  const isRecord = useCallback((value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null;
  }, []);

  const toUpdater = useCallback((node: TreeNode): TreeNodeUpdaterState<TPayload> => {
    const hasRemoteDraft = node.draftData !== undefined || node.draftMetadata != null;
    const draftMetadata = (node as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata ?? null;
    if (draftMetadata === null) {
      throw new Error('Draft metadata must not be null');
    }
    const draftData =
      node.draftData && isRecord(node.draftData) ? (node.draftData as Partial<TPayload>) : undefined;
    const dialogUIState =
      (node as { dialogUIState?: DialogUIState | null }).dialogUIState ?? DEFAULT_DIALOG_UI_STATE;
    const isTemporary = (node as { isTemporary?: boolean }).isTemporary;
    return {
      treeNodeId: node.id as NodeId,
      draftMetadata,
      draftData,
      dialogUIState,
      isTemporary,
      version: node.version,
      updatedAt: node.updatedAt,
      hasRemoteDraft,
    };
  }, [isRecord]);

  const getClient = useCallback(async (): Promise<{
    wc: TreeNodeUpdaterAPI<TreeNodeData>;
    query: TreeQueryAPI;
    remote: Remote<WorkerApi>;
  }> => {
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

          // If drafts are empty or malformed, seed them from committed values so the dialog edits a draft copy.
          const existingDraftMetadata = (existing as {
            draftMetadata?: TreeNodeMetadata | null;
          }).draftMetadata;
          const existingMetadata = (existing as { metadata?: TreeNodeMetadata }).metadata;
          const needsDraftMeta =
            existingMetadata !== undefined &&
            (existingDraftMetadata === null ||
              !existingDraftMetadata ||
              typeof existingDraftMetadata.name !== 'string' ||
              typeof existingDraftMetadata.description !== 'string' ||
              !Array.isArray(existingDraftMetadata.tags));
          const existingDraftData = (existing as { draftData?: Partial<PeerEntity<TreeNodeData>> }).draftData;
          const hasEmptyDraftData =
            existingDraftData
            && isRecord(existingDraftData)
            && Object.keys(existingDraftData).length === 0;
          const needsDraftData =
            (existingDraftData === undefined || hasEmptyDraftData) &&
            // Skip seeding when committed data is null (template-driven nodes often have draftData prefilled)
            existing.data !== null &&
            (existing.data ? Object.keys(existing.data as Record<string, unknown>).length > 0 : false);
          if (needsDraftMeta) {
            const fallbackMetadata = {
              ...(existingMetadata ?? { name: '', description: '', tags: [] }),
            };
            const existingDraftMetadataRecord = existingDraftMetadata ?? {};
            const mergedMetadata = {
              ...fallbackMetadata,
              ...existingDraftMetadataRecord,
              name:
                typeof existingDraftMetadataRecord.name === 'string'
                  ? existingDraftMetadataRecord.name
                  : fallbackMetadata.name,
              description:
                typeof existingDraftMetadataRecord.description === 'string'
                  ? existingDraftMetadataRecord.description
                  : fallbackMetadata.description,
              tags: Array.isArray(existingDraftMetadataRecord.tags)
                ? existingDraftMetadataRecord.tags
                : fallbackMetadata.tags,
            } as TreeNodeMetadata;
            await wcAPI.updateTreeNodeDraftMetadata(nodeId, mergedMetadata);
            (existing as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata = mergedMetadata;
          }
          if (needsDraftData) {
            await wcAPI.updateTreeNodeDraftData(
              nodeId,
              (existing.data ?? {}) as Partial<PeerEntity<TreeNodeData>>
            );
            (existing as { draftData?: Partial<PeerEntity<TreeNodeData>> }).draftData = {
              ...(existing.data as Record<string, unknown>),
            };
          }

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
          const shouldMarkTemporary = !nodeId;
          const initialPayload: Partial<TreeNode> = {
            ...(nodeId ? { id: nodeId } : {}),
            ...(initialDraftMetadata ? { draftMetadata: initialDraftMetadata } : {}),
            ...(initialDraftData
              ? { draftData: initialDraftData as Partial<PeerEntity<TreeNodeData>> }
              : {}),
            ...(shouldMarkTemporary ? { isTemporary: true } : {}),
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

  const buildComparableDraft = useCallback(
    (state: TreeNodeUpdaterState<TPayload> | null) => {
      if (!state) return { draftMetadata: null, draftData: undefined };
      return {
        draftMetadata: normalizeComparableValue(state.draftMetadata ?? null),
        draftData: normalizeComparableValue(state.draftData),
      };
    },
    []
  );

  const computeUnsaved = useCallback(() => {
    if (!draft || !originalCopy) return false;
    const current = buildComparableDraft(draft);
    const initial = buildComparableDraft(originalCopy);
    return stableStringify(current) !== stableStringify(initial);
  }, [buildComparableDraft, draft, originalCopy]);

  useEffect(() => {
    setHasUnsaved(computeUnsaved());
  }, [computeUnsaved, draft, originalCopy]);

  const updateTreeNodeUpdater = useCallback(
    (data: Partial<TreeNodeUpdaterState<TPayload>>) => {
      setDraft((prev) => {
        if (!prev) return null;

        const nextDraftMetadata = data.draftMetadata !== undefined ? data.draftMetadata : prev.draftMetadata ?? null;
        const nextDraftData =
          data.draftData !== undefined ? data.draftData : prev.draftData;
        const nextDialogUIState =
          data.dialogUIState !== undefined
            ? data.dialogUIState ?? DEFAULT_DIALOG_UI_STATE
            : prev.dialogUIState ?? DEFAULT_DIALOG_UI_STATE;

        const merged: TreeNodeUpdaterState<TPayload> = {
          treeNodeId: prev.treeNodeId,
          draftMetadata: nextDraftMetadata ?? null,
          draftData: nextDraftData,
          dialogUIState: nextDialogUIState,
          isTemporary: data.isTemporary ?? prev.isTemporary,
          version: data.version ?? prev.version,
          updatedAt: data.updatedAt ?? prev.updatedAt,
          hasRemoteDraft: data.hasRemoteDraft ?? prev.hasRemoteDraft,
        };
        return merged;
      });
    },
    []
  );

  const commitTreeNodeUpdater = useCallback(async (mode: CommitDraftMode, data: TreeNodeUpdaterState<TPayload>): Promise<NodeId> => {
    if (!data) throw new Error('No draft to save');
    const targetId = data.treeNodeId ?? workingNodeId;
    if (!targetId) throw new Error('nodeId is required to save draft');

    const finalData: TreeNodeUpdaterState<TPayload> = {
      ...data,
      treeNodeId: targetId,
      draftData: data.draftData,
      draftMetadata: (data.draftMetadata as TreeNodeMetadata | null) ?? null,
      dialogUIState: data.dialogUIState ?? ({} as DialogUIState),
      version: data.version,
      updatedAt: data.updatedAt,
      hasRemoteDraft: data.hasRemoteDraft,
    };

    try {
      setLoading(true);
      persistDisableUntilRef.current = Date.now() + 300;
      const { wc: wcAPI } = await getClient();

      const res = await wcAPI.updateTreeNode(targetId, {
        mode,
        draftMetadata: finalData.draftMetadata ?? null,
        draftData: finalData.draftData,
        dialogUIState: finalData.dialogUIState ?? null,
      });

      if (res.status === 'ok') {
        const committedNodeId = (res.node?.id as NodeId | undefined) ?? res.nodeId ?? targetId;

        const latestNode = res.node;

        let refreshedCopy: TreeNodeUpdaterState<TPayload>;
        if (latestNode) {
          // Ensure draftMetadata exists for toUpdater even if commit cleared drafts
          if ((latestNode as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata === null) {
            (latestNode as { draftMetadata?: TreeNodeMetadata | null }).draftMetadata =
              (latestNode as { metadata?: TreeNodeMetadata | null }).metadata ?? {
                name: '',
                description: '',
                tags: [],
              };
          }
          refreshedCopy = toUpdater(latestNode as TreeNode);
          refreshedCopy = {
            ...refreshedCopy,
            dialogUIState: finalData.dialogUIState ?? refreshedCopy.dialogUIState ?? null,
          };
        } else {
          refreshedCopy = {
            ...finalData,
            treeNodeId: committedNodeId,
            version: typeof finalData.version === 'number' ? finalData.version + 1 : 1,
            updatedAt: Date.now() as Timestamp,
          };
        }

        const shouldClearDraft = mode !== 'save-draft';
        refreshedCopy = {
          ...refreshedCopy,
          draftMetadata: shouldClearDraft ? null : refreshedCopy.draftMetadata ?? finalData.draftMetadata ?? null,
          draftData: shouldClearDraft ? undefined : refreshedCopy.draftData ?? finalData.draftData,
          hasRemoteDraft: !shouldClearDraft,
        };

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

  const saveDraft = useCallback(
    (data: TreeNodeUpdaterState<TPayload>) => commitTreeNodeUpdater('save-draft', data),
    [commitTreeNodeUpdater]
  );

  return {
    treeNodeUpdater: draft,
    hasUnsavedChanges: hasUnsaved,
    updateTreeNodeUpdater,
    commitTreeNodeUpdater,
    discardDraft,
    loading,
    error,
    draft,
    updateDraft: updateTreeNodeUpdater,
    saveDraft,
  };
}
