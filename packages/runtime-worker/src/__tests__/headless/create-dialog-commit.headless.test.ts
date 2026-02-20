import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoreDB } from '~/services/CoreDB';
import { TreeNodeUpdaterService } from '~/services/TreeNodeUpdaterService';

describe('Create dialog commit flow', () => {
  const treeId = 'r' as TreeId;
  const rootId = `${treeId}:root` as NodeId;
  let core: CoreDB;
  let drafts: TreeNodeUpdaterService;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`${treeId}-create-commit`);
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

  it('creates draft, commits, and keeps node when dialog closes after Create', async () => {
    const draft = await drafts.initTreeNode('folder' as NodeType, rootId, {
      metadata: { name: 'New Folder', description: '', tags: [] },
    });
    await drafts.updateTreeNodeDraftData(draft.id as NodeId, { foo: 'bar' });

    const result = await drafts.commitDraft(draft.id as NodeId);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('commit failed');
    const committedId = result.nodeId as NodeId;

    // Simulate dialog onClose path: discardDraft after commit should not delete committed node,
    // even if caller uses forceDelete (current UI uses create mode flag).
    await drafts.discardDraft(committedId, { forceDelete: true });

    const stored = await core.nodes.get(committedId);
    expect(stored).toBeDefined();
    expect((stored as { draftData?: unknown }).draftData).toBeUndefined();
    expect((stored as { data?: unknown }).data).toEqual({ foo: 'bar' });
  });
});
