import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/runtime-client';
import type { NodeId, TreeId, NodeType } from '@hierarchidb/common-types';
import { useDialogDraft } from '../useDialogDraft.js';
import { useDraft } from '../useDraft.js';
import { Remote } from 'comlink';

let mockWorkerClientRef: WorkerClientRef | null = null;

vi.mock('@hierarchidb/runtime-client', async () => {
  const actual = await vi.importActual<typeof import('@hierarchidb/runtime-client')>('@hierarchidb/runtime-client');
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
    getDraft: vi.fn(async (id: NodeId) => {
      if (matchesCurrent(id)) {
        return currentDraft;
      }
      return null;
    }),
    createDraftBase: vi.fn(async (_nodeType: NodeType, parentId: NodeId) => ({
      id: `draft-${parentId}`,
      name: '',
      description: '',
      data: {},
    })),
    createDraftFromNode: vi.fn(async (id: NodeId) => {
      currentDraft = {
        id: `wc-${id}` as NodeId,
        name: `Draft ${id}`,
        description: '',
        data: {},
      };
      return currentDraft;
    }),
    updateDraft: vi.fn(async () => {}),
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
  it('reuses an existing working copy when nodeId already references one', async () => {
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

    expect(wcAPI.getDraft).toHaveBeenCalledWith(existing.id);
    expect(wcAPI.createDraftBase).not.toHaveBeenCalled();
    expect(result.current.draft?.treeNodeId).toBe(existing.id);
    expect(result.current.error).toBeNull();
  });

  it('creates a draft working copy when none exists yet', async () => {
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

    expect(wcAPI.getDraft).toHaveBeenCalledWith('wc-missing');
    expect(wcAPI.createDraftBase).toHaveBeenCalledWith('folder', 'parent-2', {
      id: 'wc-missing',
      name: '',
    });
    expect(result.current.draft?.treeNodeId).toBe('draft-parent-2');
    expect(result.current.error).toBeNull();
  });
});

describe('useDialogDraft (edit mode)', () => {
  it('reuses an existing working copy when nodeId already points to one', async () => {
    const existing = { id: 'wc-existing' as NodeId, name: 'Existing', description: 'desc', data: {} };
    const { workerClient, wcAPI } = createMockClient({ existingDraft: existing });

    const { result } = renderHook(() =>
      useDialogDraft({
        mode: 'edit',
        nodeType: 'folder',
        nodeId: existing.id,
        treeId: 'console-1' as TreeId,
        workerClient,
      })
    );

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.getDraft).toHaveBeenCalledWith(existing.id);
    expect(wcAPI.createDraftFromNode).not.toHaveBeenCalled();
    expect(result.current.draft?.treeNodeId).toBe(existing.id);
  });

  it('creates a working copy when only canonical node id is provided', async () => {
    const canonicalId = 'node-canonical' as NodeId;
    const { workerClient, wcAPI } = createMockClient({ existingDraft: null, canonicalNodeId: canonicalId });

    const { result } = renderHook(() =>
      useDialogDraft({
        mode: 'edit',
        nodeType: 'folder',
        nodeId: canonicalId,
        treeId: 'console-1' as TreeId,
        workerClient,
      })
    );

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.getDraft).toHaveBeenCalledWith(canonicalId);
    expect(wcAPI.createDraftFromNode).toHaveBeenCalledWith(canonicalId);
    expect(result.current.draft?.treeNodeId).toMatch(/^wc-node-canonical/);
  });
});

describe('legacy useDraft hook (create mode)', () => {
  it('reuses an existing working copy when nodeId is supplied', async () => {
    const existing = { id: 'wc-existing' as NodeId, name: 'Existing', description: 'desc', data: { alpha: 1 } };
    const { workerClient, wcAPI } = createMockClient({ existingDraft: existing });
    mockWorkerClientRef = workerClient;

    const { result } = renderHook(() => useDraft<Record<string, unknown>>({
      nodeType: 'folder',
      mode: 'create',
      nodeId: existing.id,
      parentId: 'parent-legacy' as NodeId,
    }));

    await act(async () => {
      await result.current.init();
    });

    expect(wcAPI.getDraft).toHaveBeenCalledWith(existing.id);
    expect(wcAPI.createDraftBase).not.toHaveBeenCalled();
    expect(result.current.wcId).toBe(existing.id);
    expect(result.current.draft?.name).toBe('Existing');
  });

  it('creates a draft working copy when none exists', async () => {
    const { workerClient, wcAPI } = createMockClient({ existingDraft: undefined });
    mockWorkerClientRef = workerClient;

    const { result } = renderHook(() => useDraft<Record<string, unknown>>({
      nodeType: 'folder',
      mode: 'create',
      nodeId: 'wc-missing' as NodeId,
      parentId: 'parent-legacy' as NodeId,
    }));

    await act(async () => {
      await result.current.init();
    });

    expect(wcAPI.getDraft).toHaveBeenCalledWith('wc-missing');
    expect(wcAPI.createDraftBase).toHaveBeenCalledWith('folder', 'parent-legacy', {});
    expect(result.current.wcId).toMatch(/^draft-/);
    expect(result.current.draft).not.toBeNull();
  });
});
