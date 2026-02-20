import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertCommitOk } from '../../../test-utils/assertions';
import { CoreDB } from '../../CoreDB';
import { TreeNodeUpdaterService } from '../../TreeNodeUpdaterService';

describe('create dialog commit (draft survives discard)', () => {
  const treeId = 'r' as TreeId;
  const rootId = `${treeId}:root` as NodeId;
  let core: CoreDB;
  let drafts: TreeNodeUpdaterService;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`${treeId}-create-dialog-unit`);
    drafts = new TreeNodeUpdaterService(core);
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

  it('keeps committed node even if discardDraft is called with forceDelete after Create', async () => {
    const draft = await drafts.initTreeNode('folder' as NodeType, rootId, {
      metadata: { name: 'New Folder', description: '', tags: [] },
    });
    await drafts.updateTreeNodeDraftData(draft.id as NodeId, { foo: 'bar' });

    const result = await drafts.commitDraft(draft.id as NodeId);
    assertCommitOk(result, 'commitDraft');
    const committedId = result.nodeId as NodeId;

    await drafts.discardDraft(committedId, { forceDelete: true });

    const stored = await core.nodes.get(committedId);
    expect(stored).toBeDefined();
    expect((stored as { draftData?: unknown }).draftData).toBeUndefined();
    expect((stored as { data?: unknown }).data).toEqual({ foo: 'bar' });
  });
});
