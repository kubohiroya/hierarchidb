import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoreDB } from '../../CoreDB';
import { initTreeNode } from '../../draft/initTreeNode';
import { TreeNodeUpdaterService } from '../../TreeNodeUpdaterService';
import {
  cleanupTemporaryStagingRoot,
  createTemporaryCopyStagingRoot,
  ensureTemporaryFolderHolder,
  getTemporaryFolderNodeId,
} from '../../temporaryFolderHolderLifecycle';

describe('temporary-folder system holder lifecycle', () => {
  const treeId = 'r' as TreeId;
  let coreDB: CoreDB;

  beforeEach(async () => {
    CoreDB.resetInstance();
    coreDB = CoreDB.createForTest(`temporary-folder-${crypto.randomUUID()}`);
    await coreDB.open();
    await coreDB.initialize();
  });

  afterEach(async () => {
    await coreDB.delete();
    CoreDB.resetInstance();
  });

  it('creates or returns a temporary-folder holder distinct from the draft holder', async () => {
    const holder = await ensureTemporaryFolderHolder(coreDB, treeId);
    const sameHolder = await ensureTemporaryFolderHolder(coreDB, treeId);

    expect(holder.id).toBe(getTemporaryFolderNodeId(treeId));
    expect(sameHolder.id).toBe(holder.id);
    expect(holder.id).not.toBe('r:draft' as NodeId);
    expect(holder.nodeType).toBe('temporary-folder');
    expect(holder.parentId).toBe('r:superRoot' as NodeId);
    expect(holder.visible).toBe(false);
  });

  it('keeps temporary-folder hidden until a temporary-copy staging root exists', async () => {
    const source = await createSourceNode();
    const holder = await ensureTemporaryFolderHolder(coreDB, treeId);

    expect(holder.visible).toBe(false);

    const stagingRoot = await createTemporaryCopyStagingRoot(coreDB, {
      treeId,
      sourceNodeId: source.id as NodeId,
    });

    const visibleHolder = await coreDB.getNode(holder.id as NodeId);
    expect(stagingRoot.parentId).toBe(holder.id);
    expect(stagingRoot.draftData).toBeUndefined();
    expect(visibleHolder?.visible).toBe(true);
  });

  it('does not expose temporary-copy staging roots through draft enumeration', async () => {
    const source = await createSourceNode();
    const draftId = await initTreeNode(
      coreDB,
      treeId,
      'r:root' as NodeId,
      'folder' as NodeType,
      'Draft Folder'
    );
    const stagingRoot = await createTemporaryCopyStagingRoot(coreDB, {
      treeId,
      sourceNodeId: source.id as NodeId,
    });
    const updater = new TreeNodeUpdaterService(coreDB);

    const drafts = await updater.listDrafts();

    expect(drafts.map((draft) => draft.id)).toContain(draftId);
    expect(drafts.map((draft) => draft.id)).not.toContain(stagingRoot.id);
  });

  it('rejects draft commit and discard APIs for temporary-copy staging roots', async () => {
    const source = await createSourceNode();
    const stagingRoot = await createTemporaryCopyStagingRoot(coreDB, {
      treeId,
      sourceNodeId: source.id as NodeId,
    });
    const updater = new TreeNodeUpdaterService(coreDB);

    await expect(updater.commitDraft(stagingRoot.id as NodeId)).rejects.toThrow(
      'temporary-staging-node-is-not-draft'
    );
    await expect(updater.discardDraft(stagingRoot.id as NodeId)).rejects.toThrow(
      'temporary-staging-node-is-not-draft'
    );
    await expect(coreDB.getNode(stagingRoot.id as NodeId)).resolves.toBeDefined();
  });

  it('cleans only the selected temporary staging root and keeps draft holder state', async () => {
    const source = await createSourceNode();
    const draftId = await initTreeNode(
      coreDB,
      treeId,
      'r:root' as NodeId,
      'folder' as NodeType,
      'Draft Folder'
    );
    const stagingRoot = await createTemporaryCopyStagingRoot(coreDB, {
      treeId,
      sourceNodeId: source.id as NodeId,
    });
    const holderId = getTemporaryFolderNodeId(treeId);

    await cleanupTemporaryStagingRoot(coreDB, stagingRoot.id as NodeId);

    expect(await coreDB.getNode(stagingRoot.id as NodeId)).toBeUndefined();
    expect(await coreDB.getNode(draftId)).toBeDefined();
    expect((await coreDB.getNode(holderId))?.visible).toBe(false);
  });

  async function createSourceNode(): Promise<TreeNode> {
    const now = Date.now();
    const node: TreeNode = {
      id: `source-${crypto.randomUUID()}` as NodeId,
      parentId: 'r:root' as NodeId,
      nodeType: 'folder' as NodeType,
      depth: 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: {
        name: `Source ${crypto.randomUUID()}`,
        description: '',
        tags: [],
      },
      draftMetadata: null,
      data: { value: 1 },
      draftData: undefined,
      visible: true,
    };
    await coreDB.createNode(node);
    return node;
  }
});
