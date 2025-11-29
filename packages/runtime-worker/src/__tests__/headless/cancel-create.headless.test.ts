import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/common-types';
import { CoreDB } from '../../services/CoreDB.js';
import { DraftService } from '../../services/DraftService.js';

describe('create dialog cancel discards draft nodes', () => {
  const treeId = 'r' as TreeId;
  const parentId = `${treeId}:root` as NodeId;
  let core: CoreDB;
  let draftService: DraftService;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`${treeId}-cancel-create`);
    draftService = new DraftService(core);
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
});
