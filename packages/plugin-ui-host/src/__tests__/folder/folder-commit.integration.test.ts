import 'fake-indexeddb/auto';
import type { NodeId, PeerEntity, TreeId } from '@hierarchidb/core-types';
import { useTreeNodeDialog } from '@hierarchidb/plugin-ui-sdk';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  teardownWorkerClientRef,
  workerClientRef,
} from '../plugin-dialog-mocks/setupPluginWorkerMock';

function useFolderDialogForTest(parentId: NodeId) {
  return useTreeNodeDialog<PeerEntity>({
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
      draftData: undefined,
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
    const nodes = (await query.listNodes?.()) as Array<{
      metadata?: { name?: string; description?: string; tags?: string[] };
      data?: unknown;
      draftData?: unknown;
      draftMetadata?: unknown;
    }>;
    const created = nodes.find((node) => node.metadata?.name === 'Folder Name');
    expect(created).toBeDefined();
    expect(created?.metadata).toEqual({ name: 'Folder Name', description: 'desc', tags: ['x'] });
    expect(created?.data).toBeNull();
    expect(created?.draftData).toBeUndefined();
    expect(created?.draftMetadata).toBeNull();
  });
});
