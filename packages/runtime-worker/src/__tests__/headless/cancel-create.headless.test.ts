import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/common-types';
import { CoreDB } from '../../services/CoreDB.js';
import { TreeNodeUpdaterService } from '../../services/TreeNodeUpdaterService.js';
import { discardTreeNodeDraft } from '../../services/draft/cleanupOperations.js';

describe('create dialog cancel discards draft nodes', () => {
  const treeId = 'r' as TreeId;
  const parentId = `${treeId}:root` as NodeId;
  let core: CoreDB;
  let draftService: TreeNodeUpdaterService;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`${treeId}-cancel-create`);
    draftService = new TreeNodeUpdaterService(core);
    const now = Date.now();
    await core.nodes.put({
      id: parentId,
      parentId: null,
      nodeType: 'root' as NodeType,
      metadata: { name: 'Root', description: undefined, tags: [] },
      draftMetadata: null,
      data: null,
      draftData: null,
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

  it('removes folder draft when create dialog is cancelled', async () => {
    const draft = await draftService.initTreeNode('folder' as NodeType, parentId);
    expect(await core.nodes.get(draft.id as NodeId)).toBeDefined();

    await draftService.discardDraft(draft.id as NodeId, { forceDelete: true });

    expect(await core.nodes.get(draft.id as NodeId)).toBeUndefined();
  });

  it('removes plugin draft with payload when create dialog is cancelled', async () => {
    const draft = await draftService.initTreeNode('shape' as NodeType, parentId, {
      data: { foo: 'bar' },
      draftData: { foo: 'bar' },
    });
    expect(await core.nodes.get(draft.id as NodeId)).toBeDefined();

    await draftService.discardDraft(draft.id as NodeId, { forceDelete: true });

    expect(await core.nodes.get(draft.id as NodeId)).toBeUndefined();
  });

  it('deletes create draft even if draftMetadata/draftData exist when cancel omits forceDelete (UI cancel)', async () => {
    const draft = await draftService.initTreeNode('folder' as NodeType, parentId);
    expect(await core.nodes.get(draft.id as NodeId)).toBeDefined();

    // Simulate dialog edits that populate draftMetadata/draftData before cancel.
    await draftService.updateTreeNodeDraftMetadata(draft.id as NodeId, { name: 'Edited Folder' });
    await draftService.updateTreeNodeDraftData(draft.id as NodeId, { foo: 'bar' });

    // Mirror UI cancel path that currently calls discard without forceDelete.
    await discardTreeNodeDraft(core, draft.id as NodeId);

    // Expectation: create-only drafts should be deleted on cancel.
    expect(await core.nodes.get(draft.id as NodeId)).toBeUndefined();
  });

  it('deletes create draft even if updatedAt changes during dialog (no committed data)', async () => {
    const draft = await draftService.initTreeNode('folder' as NodeType, parentId);
    expect(await core.nodes.get(draft.id as NodeId)).toBeDefined();

    const now = Date.now();
    await core.nodes.update(draft.id as NodeId, { updatedAt: now + 5000 });

    await discardTreeNodeDraft(core, draft.id as NodeId);

    expect(await core.nodes.get(draft.id as NodeId)).toBeUndefined();
  });
});
