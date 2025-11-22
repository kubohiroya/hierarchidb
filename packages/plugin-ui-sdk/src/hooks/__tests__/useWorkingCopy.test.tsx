import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { WorkerClientRef } from '@hierarchidb/runtime-client';
import type { NodeId, TreeId, NodeType } from '@hierarchidb/common-types';
import { useDialogWorkingCopy } from '../useDialogWorkingCopy.js';
import { useWorkingCopy } from '../useWorkingCopy.js';
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
  existingWorkingCopy?: { id: NodeId; name?: string; description?: string; data?: Record<string, unknown> } | null;
  canonicalNodeId?: NodeId;
}) {
  const { existingWorkingCopy = null, canonicalNodeId } = options;
  let currentWorkingCopy = existingWorkingCopy;

  const matchesCurrent = (id: NodeId) => {
    if (!currentWorkingCopy) return false;
    return currentWorkingCopy.id === id || (canonicalNodeId ? canonicalNodeId === id : false);
  };

  const wcAPI = {
    getWorkingCopy: vi.fn(async (id: NodeId) => {
      if (matchesCurrent(id)) {
        return currentWorkingCopy;
      }
      return null;
    }),
    createDraftWorkingCopy: vi.fn(async (_nodeType: NodeType, parentId: NodeId) => ({
      id: `draft-${parentId}`,
      name: '',
      description: '',
      data: {},
    })),
    createWorkingCopyFromNode: vi.fn(async (id: NodeId) => {
      currentWorkingCopy = {
        id: `wc-${id}` as NodeId,
        name: `Draft ${id}`,
        description: '',
        data: {},
      };
      return currentWorkingCopy;
    }),
    updateWorkingCopy: vi.fn(async () => {}),
    commitWorkingCopy: vi.fn(async () => ({ status: 'ok', nodeId: 'n:1' })),
    discardWorkingCopy: vi.fn(async () => {}),
  };

  const queryAPI = {
    getNode: vi.fn(async () => ({ id: 'holder', holderTargetId: existingWorkingCopy?.id })),
  };

  const client = {
    getWorkingCopyAPI: vi.fn(async () => wcAPI),
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

describe('useWorkingCopy (create mode)', () => {
  it('reuses an existing working copy when nodeId already references one', async () => {
    const existing = { id: 'wc-existing' as NodeId, name: 'Existing', description: 'desc', data: { foo: 'bar' } };
    const { workerClient, wcAPI } = createMockClient({ existingWorkingCopy: existing });

    const { result } = renderHook(() => useDialogWorkingCopy({
      mode: 'create',
      nodeType: 'folder',
      nodeId: existing.id,
      parentId: 'parent-1' as NodeId,
      treeId: 'console-1' as TreeId,
      workerClient,
    }));

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.getWorkingCopy).toHaveBeenCalledWith(existing.id);
    expect(wcAPI.createDraftWorkingCopy).not.toHaveBeenCalled();
    expect(result.current.workingCopy?.treeNodeId).toBe(existing.id);
    expect(result.current.error).toBeNull();
  });

  it('creates a draft working copy when none exists yet', async () => {
    const { workerClient, wcAPI } = createMockClient({ existingWorkingCopy: undefined });

    const { result } = renderHook(() => useDialogWorkingCopy({
      mode: 'create',
      nodeType: 'folder',
      nodeId: 'wc-missing' as NodeId,
      parentId: 'parent-2' as NodeId,
      treeId: 'console-1' as TreeId,
      workerClient,
    }));

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.getWorkingCopy).toHaveBeenCalledWith('wc-missing');
    expect(wcAPI.createDraftWorkingCopy).toHaveBeenCalledWith('folder', 'parent-2', {
      id: 'wc-missing',
      name: '',
    });
    expect(result.current.workingCopy?.treeNodeId).toBe('draft-parent-2');
    expect(result.current.error).toBeNull();
  });
});

describe('useDialogWorkingCopy (edit mode)', () => {
  it('reuses an existing working copy when nodeId already points to one', async () => {
    const existing = { id: 'wc-existing' as NodeId, name: 'Existing', description: 'desc', data: {} };
    const { workerClient, wcAPI } = createMockClient({ existingWorkingCopy: existing });

    const { result } = renderHook(() =>
      useDialogWorkingCopy({
        mode: 'edit',
        nodeType: 'folder',
        nodeId: existing.id,
        treeId: 'console-1' as TreeId,
        workerClient,
      })
    );

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.getWorkingCopy).toHaveBeenCalledWith(existing.id);
    expect(wcAPI.createWorkingCopyFromNode).not.toHaveBeenCalled();
    expect(result.current.workingCopy?.treeNodeId).toBe(existing.id);
  });

  it('creates a working copy when only canonical node id is provided', async () => {
    const canonicalId = 'node-canonical' as NodeId;
    const { workerClient, wcAPI } = createMockClient({ existingWorkingCopy: null, canonicalNodeId: canonicalId });

    const { result } = renderHook(() =>
      useDialogWorkingCopy({
        mode: 'edit',
        nodeType: 'folder',
        nodeId: canonicalId,
        treeId: 'console-1' as TreeId,
        workerClient,
      })
    );

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.getWorkingCopy).toHaveBeenCalledWith(canonicalId);
    expect(wcAPI.createWorkingCopyFromNode).toHaveBeenCalledWith(canonicalId);
    expect(result.current.workingCopy?.treeNodeId).toMatch(/^wc-node-canonical/);
  });
});

describe('legacy useWorkingCopy hook (create mode)', () => {
  it('reuses an existing working copy when nodeId is supplied', async () => {
    const existing = { id: 'wc-existing' as NodeId, name: 'Existing', description: 'desc', data: { alpha: 1 } };
    const { workerClient, wcAPI } = createMockClient({ existingWorkingCopy: existing });
    mockWorkerClientRef = workerClient;

    const { result } = renderHook(() => useWorkingCopy<Record<string, unknown>>({
      nodeType: 'folder',
      mode: 'create',
      nodeId: existing.id,
      parentId: 'parent-legacy' as NodeId,
    }));

    await act(async () => {
      await result.current.init();
    });

    expect(wcAPI.getWorkingCopy).toHaveBeenCalledWith(existing.id);
    expect(wcAPI.createDraftWorkingCopy).not.toHaveBeenCalled();
    expect(result.current.wcId).toBe(existing.id);
    expect(result.current.workingCopy?.name).toBe('Existing');
  });

  it('creates a draft working copy when none exists', async () => {
    const { workerClient, wcAPI } = createMockClient({ existingWorkingCopy: undefined });
    mockWorkerClientRef = workerClient;

    const { result } = renderHook(() => useWorkingCopy<Record<string, unknown>>({
      nodeType: 'folder',
      mode: 'create',
      nodeId: 'wc-missing' as NodeId,
      parentId: 'parent-legacy' as NodeId,
    }));

    await act(async () => {
      await result.current.init();
    });

    expect(wcAPI.getWorkingCopy).toHaveBeenCalledWith('wc-missing');
    expect(wcAPI.createDraftWorkingCopy).toHaveBeenCalledWith('folder', 'parent-legacy', {});
    expect(result.current.wcId).toMatch(/^draft-/);
    expect(result.current.workingCopy).not.toBeNull();
  });
});
