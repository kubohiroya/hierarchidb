import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeId, NodeType } from '@hierarchidb/common-type';
import { useWorkingCopy } from '../useWorkingCopy.js';

function createMockClient(options: {
  existingWorkingCopy?: { id: NodeId; name?: string; description?: string; data?: Record<string, unknown> };
}) {
  const { existingWorkingCopy } = options;

  const wcAPI = {
    getWorkingCopy: vi.fn(async (id: NodeId) => {
      if (existingWorkingCopy && existingWorkingCopy.id === id) {
        return existingWorkingCopy;
      }
      return null;
    }),
    createDraftWorkingCopy: vi.fn(async (_nodeType: NodeType, parentId: NodeId) => ({
      id: `draft-${parentId}`,
      name: '',
      description: '',
      data: {},
    })),
    updateWorkingCopy: vi.fn(async () => {}),
    commitWorkingCopy: vi.fn(async () => ({ success: true })),
    discardWorkingCopy: vi.fn(async () => {}),
  };

  const queryAPI = {
    getNode: vi.fn(async () => ({ id: 'holder', holderTargetId: existingWorkingCopy?.id })),
  };

  const client = {
    getWorkingCopyAPI: vi.fn(async () => wcAPI),
    getQueryAPI: vi.fn(async () => queryAPI),
  } as unknown as WorkerAPI;

  return { client, wcAPI, queryAPI };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWorkingCopy (create mode)', () => {
  it('reuses an existing working copy when nodeId already references one', async () => {
    const existing = { id: 'wc-existing' as NodeId, name: 'Existing', description: 'desc', data: { foo: 'bar' } };
    const { client, wcAPI } = createMockClient({ existingWorkingCopy: existing });

    const { result } = renderHook(() => useWorkingCopy({
      mode: 'create',
      nodeType: 'folder',
      nodeId: existing.id,
      parentId: 'parent-1' as NodeId,
      treeId: 'tree-1' as TreeId,
      workerAPI: client,
    }));

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.getWorkingCopy).toHaveBeenCalledWith(existing.id);
    expect(wcAPI.createDraftWorkingCopy).not.toHaveBeenCalled();
    expect(result.current.workingCopy?.treeNodeId).toBe(existing.id);
    expect(result.current.error).toBeNull();
  });

  it('creates a draft working copy when none exists yet', async () => {
    const { client, wcAPI } = createMockClient({ existingWorkingCopy: undefined });

    const { result } = renderHook(() => useWorkingCopy({
      mode: 'create',
      nodeType: 'folder',
      nodeId: 'wc-missing' as NodeId,
      parentId: 'parent-2' as NodeId,
      treeId: 'tree-1' as TreeId,
      workerAPI: client,
    }));

    await waitFor(() => result.current.loading === false);

    expect(wcAPI.getWorkingCopy).toHaveBeenCalledWith('wc-missing');
    expect(wcAPI.createDraftWorkingCopy).toHaveBeenCalledWith('folder', 'parent-2', { name: '' });
    expect(result.current.workingCopy?.treeNodeId).toBe('draft-parent-2');
    expect(result.current.error).toBeNull();
  });
});
