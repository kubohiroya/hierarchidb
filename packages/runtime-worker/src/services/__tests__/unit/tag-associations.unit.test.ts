import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { TagService } from '@hierarchidb/tag';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EntityLifecycleManager } from '../../../entity/EntityLifecycleManager';
import { assertCommitOk } from '../../../test-utils/assertions';
import { TagDBPortCoreDBAdapter } from '../../adapters/TagDBPortCoreDBAdapter';
import { CommandProcessor } from '../../CommandProcessor';
import { CoreDB } from '../../CoreDB';
import { TreeNodeUpdaterService } from '../../TreeNodeUpdaterService';

describe('tag association lifecycle (draft/archive/remove)', () => {
  const treeId = 'r' as TreeId;
  const rootId = `${treeId}:root` as NodeId;
  let core: CoreDB;
  let drafts: TreeNodeUpdaterService;
  let tagService: TagService;
  let dbName: string;

  beforeEach(async () => {
    CoreDB.resetInstance();
    dbName = `tag-associations-unit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    core = await CoreDB.getSingleton(dbName);
    const tagPort = new TagDBPortCoreDBAdapter(core);
    tagService = new TagService(tagPort);
    const commandProcessor = await CommandProcessor.getSingleton(core);
    drafts = new TreeNodeUpdaterService(core, commandProcessor, tagService);
  });

  afterEach(async () => {
    await core.delete();
    CoreDB.resetInstance();
  });

  it('creates draft associations on save-draft and published on commit', async () => {
    const draft = await drafts.initTreeNode('folder' as NodeType, rootId, {
      metadata: { name: 'Draft', description: '', tags: [] },
    });

    await drafts.updateTreeNode(draft.id as NodeId, {
      mode: 'save-draft',
      draftMetadata: { name: 'Draft', description: '', tags: ['alpha'] },
    });

    expect(await core.tags.count()).toBe(1);
    const draftAssocs = await core.tagAssociations.toArray();
    expect(draftAssocs).toHaveLength(1);
    expect(draftAssocs[0]?.scope).toBe('draft');

    const result = await drafts.commitDraft(draft.id as NodeId, {
      draftMetadata: { name: 'Final', description: '', tags: ['alpha'] },
    });
    assertCommitOk(result, 'commitDraft');

    const publishedAssocs = await core.tagAssociations.toArray();
    expect(publishedAssocs).toHaveLength(1);
    expect(publishedAssocs[0]?.scope).toBe('published');
  });

  it('keeps tag associations on archive and restore', async () => {
    const draft = await drafts.initTreeNode('folder' as NodeType, rootId, {
      metadata: { name: 'Tagged', description: '', tags: [] },
    });

    await drafts.updateTreeNodeDraftMetadata(draft.id as NodeId, {
      name: 'Tagged',
      description: '',
      tags: ['alpha'],
    });

    const result = await drafts.commitDraft(draft.id as NodeId);
    assertCommitOk(result, 'commitDraft');
    const nodeId = result.nodeId as NodeId;

    expect(await core.tagAssociations.count()).toBe(1);

    const tree = await core.trees.get(treeId);
    const archiveRootId = tree?.archiveRootId as NodeId;
    await core.nodes.update(nodeId, {
      parentId: archiveRootId,
      removedAt: Date.now(),
    });
    expect(await core.tagAssociations.count()).toBe(1);

    await core.nodes.update(nodeId, {
      parentId: rootId,
      removedAt: null,
      originalParentId: null,
    });
    expect(await core.tagAssociations.count()).toBe(1);
  });

  it('removes tag associations when nodes are permanently deleted', async () => {
    const draft = await drafts.initTreeNode('folder' as NodeType, rootId, {
      metadata: { name: 'DeleteMe', description: '', tags: [] },
    });

    await drafts.updateTreeNodeDraftMetadata(draft.id as NodeId, {
      name: 'DeleteMe',
      description: '',
      tags: ['alpha'],
    });

    const result = await drafts.commitDraft(draft.id as NodeId);
    assertCommitOk(result, 'commitDraft');
    const nodeId = result.nodeId as NodeId;

    expect(await core.tagAssociations.count()).toBe(1);

    const node = await core.nodes.get(nodeId);
    if (node) {
      const lifecycle = EntityLifecycleManager.getSingleton(core);
      await lifecycle.handleRemovedNodes([node]);
    }
    await core.nodes.delete(nodeId);
    expect(await core.tagAssociations.count()).toBe(0);
  });

  it('removes draft associations on discard', async () => {
    const draft = await drafts.initTreeNode('folder' as NodeType, rootId, {
      metadata: { name: 'DiscardMe', description: '', tags: [] },
    });

    await drafts.updateTreeNode(draft.id as NodeId, {
      mode: 'save-draft',
      draftMetadata: { name: 'DiscardMe', description: '', tags: ['alpha'] },
    });

    expect(await core.tagAssociations.count()).toBe(1);
    await drafts.discardDraft(draft.id as NodeId);
    expect(await core.tagAssociations.count()).toBe(0);
  });

  it('prefers draft associations when both draft and published exist', async () => {
    const draft = await drafts.initTreeNode('folder' as NodeType, rootId, {
      metadata: { name: 'Mixed', description: '', tags: [] },
    });

    await drafts.updateTreeNodeDraftMetadata(draft.id as NodeId, {
      name: 'Mixed',
      description: '',
      tags: ['alpha'],
    });

    const result = await drafts.commitDraft(draft.id as NodeId);
    assertCommitOk(result, 'commitDraft');

    await drafts.updateTreeNode(result.nodeId as NodeId, {
      mode: 'save-draft',
      draftMetadata: { name: 'Mixed', description: '', tags: ['beta'] },
    });

    const tags = await tagService.getTagsForNode(result.nodeId as NodeId);
    const names = tags.map((tag) => tag.name).sort();
    expect(names).toEqual(['beta']);
  });
});
