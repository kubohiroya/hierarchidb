import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoreDB } from '../../services/CoreDB.js';
import { TreeNodeUpdaterService } from '../../services/TreeNodeUpdaterService.js';

type Mode = 'create' | 'edit';

describe('Edit dialog cancel behavior by node origin', () => {
  const treeId = 'r' as TreeId;
  const rootId = `${treeId}:root` as NodeId;
  let core: CoreDB;
  let draftService: TreeNodeUpdaterService;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`${treeId}-cancel-dialog`);
    draftService = new TreeNodeUpdaterService(core);
    const now = Date.now();
    await core.nodes.put({
      id: rootId,
      parentId: null,
      nodeType: 'root' as NodeType,
      metadata: { name: 'Root', description: undefined, tags: [] },
      draftMetadata: null,
      data: null,
      draftData: undefined,
      depth: 0,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });
  });

  afterEach(() => {
    CoreDB.resetInstance();
  });

  async function cancelDialog(mode: Mode, nodeId: NodeId) {
    const node = await core.nodes.get(nodeId);
    if (!node) return;
    const hasCommittedData =
      (node as { data?: unknown }).data !== null &&
      typeof (node as { data?: unknown }).data !== 'undefined';
    if (mode === 'create') {
      await draftService.discardDraft(nodeId, { forceDelete: true });
      return;
    }
    if (hasCommittedData) {
      await draftService.discardDraft(nodeId, { forceDelete: false });
    }
    // For edit mode without committed data, do nothing (keep draft)
  }

  it('create draft (init) is deleted on cancel', async () => {
    const draft = await draftService.initTreeNode('folder' as NodeType, rootId);
    await cancelDialog('create', draft.id as NodeId);
    expect(await core.nodes.get(draft.id as NodeId)).toBeUndefined();
  });

  it('create draft with version 0 is deleted on cancel', async () => {
    const now = Date.now();
    const nodeId = `${rootId}:version-0` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId: rootId,
      nodeType: 'spreadsheet' as NodeType,
      metadata: { name: 'Temp', description: undefined, tags: [] },
      draftMetadata: { name: 'Temp', description: undefined, tags: [] },
      data: null,
      draftData: { foo: 'draft' },
      depth: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 0,
      lastTouchedAt: now,
    });

    await cancelDialog('create', nodeId);

    expect(await core.nodes.get(nodeId)).toBeUndefined();
  });

  it('create draft imported from template (version > 0) is kept on cancel', async () => {
    const now = Date.now();
    const nodeId = `${rootId}:template-import` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId: rootId,
      nodeType: 'spreadsheet' as NodeType,
      metadata: { name: 'Template Sheet', description: undefined, tags: [] },
      draftMetadata: { name: 'Template Sheet', description: undefined, tags: [] },
      data: null,
      draftData: { dataSource: { type: 'url', source: 'https://example.com/data.csv' } },
      depth: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });

    await cancelDialog('create', nodeId);

    const stored = await core.nodes.get(nodeId);
    expect(stored).toBeDefined();
    expect((stored as { draftData?: unknown }).draftData).toEqual({
      dataSource: { type: 'url', source: 'https://example.com/data.csv' },
    });
  });

  it('import draft node is kept on cancel', async () => {
    const now = Date.now();
    const nodeId = `${rootId}:import-draft` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId: rootId,
      nodeType: 'spreadsheet' as NodeType,
      metadata: { name: 'Imported Draft', description: undefined, tags: [] },
      draftMetadata: { name: 'Imported Draft', description: undefined, tags: [] },
      data: null,
      draftData: { foo: 'bar' },
      depth: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });

    await cancelDialog('edit', nodeId);

    const stored = await core.nodes.get(nodeId);
    expect(stored).toBeDefined();
    expect((stored as { draftData?: unknown }).draftData).toEqual({ foo: 'bar' });
  });

  it('import valid node clears draft on cancel but keeps node', async () => {
    const now = Date.now();
    const nodeId = `${rootId}:import-valid` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId: rootId,
      nodeType: 'shape' as NodeType,
      metadata: { name: 'Imported Valid', description: undefined, tags: [] },
      draftMetadata: { name: 'Imported Valid', description: undefined, tags: [] },
      data: { foo: 'committed' },
      draftData: { foo: 'draft' },
      depth: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 2,
      lastTouchedAt: now,
    });

    await cancelDialog('edit', nodeId);

    const stored = await core.nodes.get(nodeId);
    expect(stored).toBeDefined();
    expect((stored as { draftData?: unknown }).draftData).toBeUndefined();
    expect((stored as { draftMetadata?: unknown }).draftMetadata).toBeNull();
    expect((stored as { data?: unknown }).data).toEqual({ foo: 'committed' });
  });

  it('edit draft node (saved/imported draft) is kept on cancel', async () => {
    const now = Date.now();
    const nodeId = `${rootId}:edit-draft` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId: rootId,
      nodeType: 'route' as NodeType,
      metadata: { name: 'Draft Edit', description: undefined, tags: [] },
      draftMetadata: { name: 'Draft Edit', description: undefined, tags: [] },
      data: null,
      draftData: { stage: 'drafted' },
      depth: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 1,
      lastTouchedAt: now,
    });

    await cancelDialog('edit', nodeId);

    const stored = await core.nodes.get(nodeId);
    expect(stored).toBeDefined();
    expect((stored as { draftData?: unknown }).draftData).toEqual({ stage: 'drafted' });
  });

  it('edit valid node clears draft on cancel and keeps node', async () => {
    const now = Date.now();
    const nodeId = `${rootId}:edit-valid` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId: rootId,
      nodeType: 'basemap' as NodeType,
      metadata: { name: 'Valid Edit', description: undefined, tags: [] },
      draftMetadata: { name: 'Valid Edit', description: undefined, tags: [] },
      data: { state: 'committed' },
      draftData: { state: 'draft' },
      depth: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 3,
      lastTouchedAt: now,
    });

    await cancelDialog('edit', nodeId);

    const stored = await core.nodes.get(nodeId);
    expect(stored).toBeDefined();
    expect((stored as { draftData?: unknown }).draftData).toBeUndefined();
    expect((stored as { draftMetadata?: unknown }).draftMetadata).toBeNull();
    expect((stored as { data?: unknown }).data).toEqual({ state: 'committed' });
  });
});
