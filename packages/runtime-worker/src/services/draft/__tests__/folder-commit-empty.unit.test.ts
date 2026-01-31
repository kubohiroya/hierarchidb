import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertCommitOk } from '../../../test-utils/assertions.js';
import { CoreDB } from '../../CoreDB.js';
import { TreeNodeUpdaterService } from '../../TreeNodeUpdaterService.js';

describe('folder commit clears draft and keeps metadata (empty payload)', () => {
  const treeId = 'r' as TreeId;
  const rootId = `${treeId}:root` as NodeId;
  let core: CoreDB;
  let drafts: TreeNodeUpdaterService;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`${treeId}-folder-empty-unit`);
    drafts = new TreeNodeUpdaterService(core);
    const now = Date.now();
    await core.nodes.put({
      id: rootId,
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

  it('commits folder with empty data: data null, draft cleared, metadata from draftMetadata', async () => {
    const draft = await drafts.initTreeNode('folder' as NodeType, rootId, {
      metadata: { name: 'Draft Name', description: '', tags: [] },
    });

    // Simulate BasicInfo step updating draftMetadata; no draftData provided (empty/default).
    await drafts.updateTreeNodeDraftMetadata(draft.id as NodeId, {
      name: 'Final Name',
      description: 'desc',
      tags: ['a'],
    });

    const result = await drafts.commitDraft(draft.id as NodeId);
    assertCommitOk(result, 'commitDraft');
    const committedId = result.nodeId as NodeId;
    const stored = await core.nodes.get(committedId);
    expect(stored).toBeDefined();
    expect((stored as { data?: unknown }).data).toBeNull();
    expect((stored as { draftData?: unknown }).draftData).toBeNull();
    expect((stored as { draftMetadata?: unknown }).draftMetadata).toEqual({
      name: 'Final Name',
      description: 'desc',
      tags: ['a'],
    });
    expect((stored as { metadata?: unknown }).metadata).toEqual({
      name: 'Final Name',
      description: 'desc',
      tags: ['a'],
    });
  });
});
