import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/ui-worker-provider';
import type { NodeId, TreeId, NodeType } from '@hierarchidb/common-types';
import { useDialogDraft } from '../useDialogDraft.js';
import { Remote } from 'comlink';

let mockWorkerClientRef: WorkerClientRef | null = null;

vi.mock('@hierarchidb/ui-worker-provider', async () => {
  const actual = await vi.importActual<typeof import('@hierarchidb/ui-worker-provider')>('@hierarchidb/ui-worker-provider');
  return {
    ...actual,
    getWorkerClientHook: vi.fn(() => () => mockWorkerClientRef),
  };
});

function createMockClient(options: {
  existingDraft?: { id: NodeId; name?: string; description?: string; data?: Record<string, unknown> } | null;
  canonicalNodeId?: NodeId;
}) {
  const { existingDraft = null, canonicalNodeId } = options;
  let currentDraft = existingDraft;

  const matchesCurrent = (id: NodeId) => {
    if (!currentDraft) return false;
    return currentDraft.id === id || (canonicalNodeId ? canonicalNodeId === id : false);
  };

  const wcAPI = {
    getTreeNode: vi.fn(async (id: NodeId) => {
      if (matchesCurrent(id)) {
        return currentDraft ?? null;
      }
      return null;
    }),
    initTreeNode: vi.fn(async (_nodeType: NodeType, parentId: NodeId, initial?: any) => {
      const id = (initial as any)?.id ?? `draft-${parentId}`;
      currentDraft = {
        id,
        name: (initial as any)?.metadata?.name ?? '',
        description: (initial as any)?.metadata?.description ?? '',
        data: (initial as any)?.draftData ?? {},
      };
      return currentDraft;
    }),
    updateTreeNodeDraftMetadata: vi.fn(async (id: NodeId, updates: Record<string, unknown>) => {
      if (matchesCurrent(id) && currentDraft) {
        currentDraft = { ...currentDraft, ...updates };
      }
    }),
    updateTreeNodeDraftData: vi.fn(async (id: NodeId, updates: Record<string, unknown>) => {
      if (matchesCurrent(id) && currentDraft) {
        currentDraft = { ...currentDraft, data: { ...(currentDraft.data ?? {}), ...updates } };
      }
    }),
    commitDraft: vi.fn(async () => ({ status: 'ok', nodeId: 'n:1' })),
    discardDraft: vi.fn(async () => {}),
  };

  const queryAPI = {
    getNode: vi.fn(async () => ({ id: 'holder', holderTargetId: existingDraft?.id })),
  };

  const client = {
    getDraftAPI: vi.fn(async () => wcAPI),
    getQueryAPI: vi.fn(async () => queryAPI),
  } as unknown as Remote<WorkerAPI>;

  const workerClient: WorkerClientRef = {
    client,
    isInitialized: true,
    isConnected: true,
    initProgress: 100,
    initMessage: 'ready',
    error: null,
    initialize: async () => {},
    reset: () => {},
    getAPI: () => client,
  };

  return { client, wcAPI, queryAPI, workerClient };
}

afterEach(() => {
  mockWorkerClientRef = null;
  vi.clearAllMocks();
});

describe('useDraft (create mode)', () => {
  it('initializes a draft via initTreeNode when nodeId is supplied', async () => {
    const existing = { id: 'wc-existing' as NodeId, name: 'Existing', description: 'desc', data: { foo: 'bar' } };
    const { workerClient, wcAPI } = createMockClient({ existingDraft: existing });

    const { result } = renderHook(() => useDialogDraft({
      mode: 'create',
      nodeType: 'folder',
      nodeId: existing.id,
      parentId: 'parent-1' as NodeId,
      treeId: 'console-1' as TreeId,
      workerClient,
    }));

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.initTreeNode).toHaveBeenCalledWith('folder', 'parent-1', { id: existing.id });
    expect(wcAPI.getTreeNode).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('creates a draft when none exists yet', async () => {
    const { workerClient, wcAPI } = createMockClient({ existingDraft: undefined });

    const { result } = renderHook(() => useDialogDraft({
      mode: 'create',
      nodeType: 'folder',
      nodeId: 'wc-missing' as NodeId,
      parentId: 'parent-2' as NodeId,
      treeId: 'console-1' as TreeId,
      workerClient,
    }));

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.initTreeNode).toHaveBeenCalledWith('folder', 'parent-2', { id: 'wc-missing' });
    expect(result.current.error).toBeNull();
  });
});
