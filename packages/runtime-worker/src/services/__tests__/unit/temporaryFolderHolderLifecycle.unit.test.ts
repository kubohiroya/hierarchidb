import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyStagedFolderActionOverlays } from '../../applyStagedFolderActionOverlays';
import { CoreDB } from '../../CoreDB';
import { initTreeNode } from '../../draft/initTreeNode';
import { resolveEffectiveTreeNodeData } from '../../resolveEffectiveTreeNodeData';
import { TreeNodeUpdaterService } from '../../TreeNodeUpdaterService';
import {
  cleanupTemporaryStagingRoot,
  createTemporaryCopyStagingRoot,
  ensureTemporaryFolderHolder,
  getTemporaryFolderNodeId,
} from '../../temporaryFolderHolderLifecycleUtils';

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
    expect(stagingRoot.data).toBeNull();
    expect(stagingRoot.copyOnWriteOf).toBe(source.id);
    expect(visibleHolder?.visible).toBe(true);
  });

  it('creates an implicit temporary-copy holder in the same tree as the source node', async () => {
    const source = await createSourceNode({
      parentId: 'p:root' as NodeId,
      name: 'Project Source',
    });

    const stagingRoot = await createTemporaryCopyStagingRoot(coreDB, {
      sourceNodeId: source.id as NodeId,
    });

    expect(stagingRoot.parentId).toBe('p:temporary-folder' as NodeId);
    expect(await coreDB.getNode('r:temporary-folder' as NodeId)).toBeUndefined();
    await expect(coreDB.getNode('p:temporary-folder' as NodeId)).resolves.toMatchObject({
      nodeType: 'temporary-folder',
      parentId: 'p:superRoot',
      visible: true,
    });
  });

  it('fails implicit temporary-copy staging when the source node is not attached to a known tree', async () => {
    const source = await createSourceNode({
      parentId: 'detached-parent' as NodeId,
      name: 'Detached Source',
    });

    await expect(
      createTemporaryCopyStagingRoot(coreDB, {
        sourceNodeId: source.id as NodeId,
      })
    ).rejects.toThrow('temporary-folder-source-tree-not-found');
  });

  it('fails implicit temporary-copy staging with a source-not-found error when the source is missing', async () => {
    await expect(
      createTemporaryCopyStagingRoot(coreDB, {
        sourceNodeId: 'missing-source' as NodeId,
      })
    ).rejects.toThrow('temporary-copy-source-node-not-found');
  });

  it('creates a recursive copy-on-write staging hierarchy without copying committed data', async () => {
    const source = await createSourceNode({
      buildRequired: true,
    });
    const child = await createSourceNode({
      parentId: source.id as NodeId,
      name: 'Child',
      data: { nested: { value: 'source' } },
      buildRequired: true,
    });

    const stagingRoot = await createTemporaryCopyStagingRoot(coreDB, {
      treeId,
      sourceNodeId: source.id as NodeId,
      name: 'Staged Source',
    });
    const stagingChildren = await coreDB.listChildren(stagingRoot.id as NodeId);
    const stagingChild = stagingChildren[0];

    expect(stagingRoot.metadata.name).toBe('Staged Source');
    expect(stagingRoot.data).toBeNull();
    expect(stagingRoot.copyOnWriteOf).toBe(source.id);
    expect(stagingRoot.metadata.buildMetadata?.buildRequired).toBe(true);
    expect(stagingChild).toBeDefined();
    expect(stagingChild?.metadata.name).toBe('Child');
    expect(stagingChild?.data).toBeNull();
    expect(stagingChild?.copyOnWriteOf).toBe(child.id);
    expect(stagingChild?.metadata.buildMetadata?.buildRequired).toBe(true);
    expect(stagingChild?.depth).toBe(stagingRoot.depth + 1);
  });

  it('applies overlays to temporary-copy descendants and resolves effective data', async () => {
    const source = await createSourceNode({ data: { label: 'source' } });
    await createSourceNode({
      parentId: source.id as NodeId,
      name: 'Layer A',
      data: { nested: { keep: true, value: 'old' } },
    });
    const stagingRoot = await createTemporaryCopyStagingRoot(coreDB, {
      treeId,
      sourceNodeId: source.id as NodeId,
    });
    const stagingChild = (await coreDB.listChildren(stagingRoot.id as NodeId))[0];
    if (stagingChild === undefined) {
      throw new Error('test-staging-child-missing');
    }

    await applyStagedFolderActionOverlays(coreDB, {
      stagingMode: 'temporary-copy',
      stagingRootNodeId: stagingRoot.id as NodeId,
      nodes: [{ match: { path: 'Layer A' }, data: { nested: { value: 'new' } } }],
    });

    expect((await coreDB.getNode(stagingChild.id as NodeId))?.patchData).toEqual({
      nested: { value: 'new' },
    });
    await expect(
      resolveEffectiveTreeNodeData({
        reader: coreDB,
        nodeId: stagingChild.id as NodeId,
        slot: 'effective-staged',
      })
    ).resolves.toMatchObject({
      data: { nested: { keep: true, value: 'new' } },
    });
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

  async function createSourceNode(
    overrides: {
      parentId?: NodeId;
      name?: string;
      data?: Record<string, unknown>;
      buildRequired?: boolean;
    } = {}
  ): Promise<TreeNode> {
    const now = Date.now();
    const node: TreeNode = {
      id: `source-${crypto.randomUUID()}` as NodeId,
      parentId: overrides.parentId ?? ('r:root' as NodeId),
      nodeType: 'folder' as NodeType,
      depth: overrides.parentId === undefined ? 1 : 2,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: {
        name: overrides.name ?? `Source ${crypto.randomUUID()}`,
        description: '',
        tags: [],
        ...(overrides.buildRequired === undefined
          ? {}
          : { buildMetadata: { buildRequired: overrides.buildRequired } }),
      },
      draftMetadata: null,
      data: overrides.data ?? { value: 1 },
      draftData: undefined,
      visible: true,
    };
    await coreDB.createNode(node);
    return node;
  }
});
