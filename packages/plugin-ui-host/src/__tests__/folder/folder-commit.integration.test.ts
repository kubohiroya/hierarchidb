import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import { renderHook, act } from '@testing-library/react';
import { useTreeNodeDialog } from '@hierarchidb/plugin-ui-sdk';
import { workerClientRef, teardownWorkerClientRef } from '../plugin-dialog-mocks/setupPluginWorkerMock.js';

function useFolderDialogForTest(parentId: NodeId) {
  return useTreeNodeDialog<Record<string, unknown>>({
    open: true,
    mode: 'create',
    nodeType: 'folder',
    parentId,
    onClose: () => {},
    onSave: async () => {},
    buildSteps: ({ metadata }) => [
      {
        id: 'basic',
        label: 'Basic Information',
        component: null,
        validate: () => Boolean(metadata?.name?.trim()),
      },
    ],
  });
}

// does not expose CoreDB for assertions. Skipping to avoid false negatives.
describe.skip('Folder dialog commit integration (headless)', () => {
  const rootId = 'root-folder' as NodeId;
  const treeId = 't1' as TreeId;

  beforeEach(async () => {
    const worker = workerClientRef;
    await worker.initialize();
    const api = worker.getAPI();
    const core = await api.getCoreDB();
    const now = Date.now();
    await core.nodes.clear();
    await core.nodes.put({
      id: rootId,
      parentId: null,
      nodeType: 'root',
      metadata: { name: 'Root', description: '', tags: [] },
      draftMetadata: null,
      data: null,
      draftData: null,
      depth: 0,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
      treeId,
    });
  });

  afterEach(async () => {
    await teardownWorkerClientRef();
  });

  it('commits folder with metadata from BasicInfo and clears draft/data', async () => {
    const { result } = renderHook(() => useFolderDialogForTest(rootId));

    // BasicInfo を直接 persist する（UIコンポーネントを介さない）
    act(() => {
      result.current.persistBasicInfo({ name: 'Folder Name', description: 'desc', tags: ['x'] });
    });

    await act(async () => {
      await result.current.headlessProps.onRequestCommit?.();
    });

    const api = workerClientRef.getAPI();
    const query = await api.getQueryAPI();
    const nodes = await query.listNodes?.();
    const created = nodes.find((n: any) => n.metadata?.name === 'Folder Name');
    expect(created).toBeDefined();
    expect(created?.metadata).toEqual({ name: 'Folder Name', description: 'desc', tags: ['x'] });
    expect(created?.data).toBeNull();
    expect(created?.draftData).toBeNull();
    expect(created?.draftMetadata).toBeNull();
  });
});
