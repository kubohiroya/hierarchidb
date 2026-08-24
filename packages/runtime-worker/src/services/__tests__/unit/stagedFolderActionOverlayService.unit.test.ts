import 'fake-indexeddb/auto';
import type { NodeId, NodeType, Timestamp, TreeId } from '@hierarchidb/core-types';
import type { NodePayload, TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CoreDB } from '../../CoreDB';
import { resolveEffectiveTreeNodeData } from '../../effectiveTreeNodeDataResolver';
import {
  applyStagedFolderActionOverlays,
  StagedFolderActionOverlayApplicationError,
} from '../../stagedFolderActionOverlayService';
import { ensureTemporaryFolderHolder } from '../../temporaryFolderHolderLifecycle';

type TestTreeNodeOverrides = Omit<Partial<TreeNode<NodePayload | null>>, 'metadata'> & {
  metadata?: Partial<TreeNode<NodePayload | null>['metadata']>;
};

describe('applyStagedFolderActionOverlays', () => {
  const treeId = 'r' as TreeId;
  let coreDB: CoreDB;

  beforeEach(async () => {
    CoreDB.resetInstance();
    coreDB = CoreDB.createForTest(`staged-overlay-${crypto.randomUUID()}`);
    await coreDB.open();
    await coreDB.initialize();
  });

  afterEach(async () => {
    await coreDB.delete();
    CoreDB.resetInstance();
  });

  it('resolves staging-root-relative paths using sibling display names', async () => {
    const source = await createNode('source', 'r:root' as NodeId, { label: 'source' });
    const stagingRoot = await createNode('staging', 'r:root' as NodeId, null, {
      copyOnWriteOf: source.id as NodeId,
      metadata: { name: 'Staging' },
    });
    const childSource = await createNode('child-source', source.id as NodeId, {
      nested: { old: true },
    });
    const child = await createNode('child', stagingRoot.id as NodeId, null, {
      copyOnWriteOf: childSource.id as NodeId,
      metadata: { name: 'Layer A' },
    });

    await applyStagedFolderActionOverlays(coreDB, {
      stagingMode: 'temporary-copy',
      stagingRootNodeId: stagingRoot.id as NodeId,
      nodes: [{ match: { path: 'Layer A' }, data: { nested: { added: true } } }],
    });

    expect((await coreDB.getNode(child.id as NodeId))?.patchData).toEqual({
      nested: { added: true },
    });
    await expect(
      resolveEffectiveTreeNodeData({
        reader: coreDB,
        nodeId: child.id as NodeId,
        slot: 'effective-staged',
      })
    ).resolves.toMatchObject({
      data: { nested: { old: true, added: true } },
    });
  });

  it('returns typed errors for missing paths and unsafe paths', async () => {
    const stagingRoot = await createNode('staging', 'r:root' as NodeId, {});

    await expect(
      applyStagedFolderActionOverlays(coreDB, {
        stagingMode: 'temporary-copy',
        stagingRootNodeId: stagingRoot.id as NodeId,
        nodes: [{ match: { path: 'Missing' }, data: {} }],
      })
    ).rejects.toMatchObject({
      code: 'STAGED_FOLDER_ACTION_OVERLAY_PATH_NOT_FOUND',
    });

    await expect(
      applyStagedFolderActionOverlays(coreDB, {
        stagingMode: 'temporary-copy',
        stagingRootNodeId: stagingRoot.id as NodeId,
        nodes: [{ match: { path: '../escape' }, data: {} }],
      })
    ).rejects.toMatchObject({
      code: 'STAGED_FOLDER_ACTION_OVERLAY_INVALID_PATH',
    });
  });

  it('treats bare paths as ./ child paths, not as root display-name aliases', async () => {
    const source = await createNode('source', 'r:root' as NodeId, {});
    const stagingRoot = await createNode('staging', 'r:root' as NodeId, null, {
      copyOnWriteOf: source.id as NodeId,
      metadata: { name: 'My Folder' },
    });
    const childSource = await createNode('child-source', source.id as NodeId, {});
    const child = await createNode('child', stagingRoot.id as NodeId, null, {
      copyOnWriteOf: childSource.id as NodeId,
      metadata: { name: 'My Folder' },
    });

    await applyStagedFolderActionOverlays(coreDB, {
      stagingMode: 'temporary-copy',
      stagingRootNodeId: stagingRoot.id as NodeId,
      nodes: [{ match: { path: 'My Folder' }, data: { label: 'child' } }],
    });

    expect((await coreDB.getNode(child.id as NodeId))?.patchData).toEqual({ label: 'child' });
    expect((await coreDB.getNode(stagingRoot.id as NodeId))?.patchData).toBeUndefined();
  });

  it('returns a missing-path error when the root display name has no matching child', async () => {
    const source = await createNode('source', 'r:root' as NodeId, {});
    const stagingRoot = await createNode('staging', 'r:root' as NodeId, null, {
      copyOnWriteOf: source.id as NodeId,
      metadata: { name: 'My Folder' },
    });

    await expect(
      applyStagedFolderActionOverlays(coreDB, {
        stagingMode: 'temporary-copy',
        stagingRootNodeId: stagingRoot.id as NodeId,
        nodes: [{ match: { path: 'My Folder' }, data: { label: 'wrong-root-alias' } }],
      })
    ).rejects.toMatchObject({
      code: 'STAGED_FOLDER_ACTION_OVERLAY_PATH_NOT_FOUND',
    });
    expect((await coreDB.getNode(stagingRoot.id as NodeId))?.patchData).toBeUndefined();
  });

  it('accepts explicit ./ paths as staging-root-relative child paths', async () => {
    const source = await createNode('source', 'r:root' as NodeId, {});
    const stagingRoot = await createNode('staging', 'r:root' as NodeId, null, {
      copyOnWriteOf: source.id as NodeId,
      metadata: { name: 'Staging' },
    });
    const childSource = await createNode('child-source', source.id as NodeId, {});
    const child = await createNode('child', stagingRoot.id as NodeId, null, {
      copyOnWriteOf: childSource.id as NodeId,
      metadata: { name: 'My Folder' },
    });

    await applyStagedFolderActionOverlays(coreDB, {
      stagingMode: 'temporary-copy',
      stagingRootNodeId: stagingRoot.id as NodeId,
      nodes: [{ match: { path: './My Folder' }, data: { label: 'child' } }],
    });

    expect((await coreDB.getNode(child.id as NodeId))?.patchData).toEqual({ label: 'child' });
    expect((await coreDB.getNode(stagingRoot.id as NodeId))?.patchData).toBeUndefined();
  });

  it('detects duplicate sibling names when resolving a corrupted hierarchy', async () => {
    const stagingRoot = makeNode('staging-root' as NodeId, 'r:root' as NodeId, {});
    const duplicatedFirst = makeNode('first' as NodeId, stagingRoot.id as NodeId, {});
    const duplicatedSecond = makeNode('second' as NodeId, stagingRoot.id as NodeId, {});
    const corruptedDB = {
      async getNode(id: NodeId) {
        return id === stagingRoot.id ? stagingRoot : undefined;
      },
      async listChildren(parentId: NodeId) {
        return parentId === stagingRoot.id ? [duplicatedFirst, duplicatedSecond] : [];
      },
      async updateNode() {
        throw new Error('unexpected-update');
      },
    } as unknown as CoreDB;

    await expect(
      applyStagedFolderActionOverlays(corruptedDB, {
        stagingMode: 'temporary-copy',
        stagingRootNodeId: stagingRoot.id as NodeId,
        nodes: [{ match: { path: 'Duplicate' }, data: {} }],
      })
    ).rejects.toMatchObject({
      code: 'STAGED_FOLDER_ACTION_OVERLAY_DUPLICATE_SIBLING_NAME',
    });
  });

  it('rejects duplicate overlay paths after explicit-root normalization', async () => {
    const stagingRoot = await createNode('staging', 'r:root' as NodeId, {});

    await expect(
      applyStagedFolderActionOverlays(coreDB, {
        stagingMode: 'temporary-copy',
        stagingRootNodeId: stagingRoot.id as NodeId,
        nodes: [
          { match: { path: 'Layer' }, data: {} },
          { match: { path: './Layer' }, data: {} },
        ],
      })
    ).rejects.toMatchObject({
      code: 'STAGED_FOLDER_ACTION_OVERLAY_DUPLICATE_PATH',
    });
  });

  it('does not partially apply overlays when a later target is invalid', async () => {
    const source = await createNode('source', 'r:root' as NodeId, {});
    const stagingRoot = await createNode('staging', 'r:root' as NodeId, null, {
      copyOnWriteOf: source.id as NodeId,
      metadata: { name: 'Staging' },
    });
    const cowSource = await createNode('cow-source', source.id as NodeId, {});
    const cowChild = await createNode('cow-child', stagingRoot.id as NodeId, null, {
      copyOnWriteOf: cowSource.id as NodeId,
      metadata: { name: 'Cow Child' },
    });
    const plainChild = await createNode(
      'plain-child',
      stagingRoot.id as NodeId,
      {},
      {
        metadata: { name: 'Plain Child' },
      }
    );

    await expect(
      applyStagedFolderActionOverlays(coreDB, {
        stagingMode: 'temporary-copy',
        stagingRootNodeId: stagingRoot.id as NodeId,
        nodes: [
          { match: { path: 'Cow Child' }, data: { updated: true } },
          { match: { path: 'Plain Child' }, data: { invalid: true } },
        ],
      })
    ).rejects.toMatchObject({
      code: 'STAGED_FOLDER_ACTION_OVERLAY_TARGET_NOT_COPY_ON_WRITE',
    });

    expect((await coreDB.getNode(cowChild.id as NodeId))?.patchData).toBeUndefined();
    expect((await coreDB.getNode(plainChild.id as NodeId))?.data).toEqual({});
  });

  it('updates patchData for copy-on-write nodes without mutating source data', async () => {
    const source = await createNode(
      'source',
      'r:root' as NodeId,
      {
        name: 'original',
        nested: { keep: true, value: 'old' },
        list: [1, 2],
      },
      {
        metadata: { name: 'Source' },
      }
    );
    const stagingRoot = await createNode('staging', 'r:root' as NodeId, null, {
      copyOnWriteOf: source.id as NodeId,
      patchData: { nested: { value: 'staged' } },
      metadata: { name: 'Staging' },
    });

    await applyStagedFolderActionOverlays(coreDB, {
      stagingMode: 'permanent-copy',
      stagingRootNodeId: stagingRoot.id as NodeId,
      nodes: [
        {
          match: { path: '.' },
          data: { name: 'patched', nested: { added: true }, list: [3] },
        },
      ],
    });

    expect((await coreDB.getNode(source.id as NodeId))?.data).toEqual({
      name: 'original',
      nested: { keep: true, value: 'old' },
      list: [1, 2],
    });
    expect((await coreDB.getNode(stagingRoot.id as NodeId))?.patchData).toEqual({
      name: 'patched',
      nested: { value: 'staged', added: true },
      list: [3],
    });
  });

  it('updates committed data directly for patch-source mode', async () => {
    const source = await createNode('source', 'r:root' as NodeId, {
      nested: { keep: true, value: 'old' },
      list: [1, 2],
    });

    await applyStagedFolderActionOverlays(coreDB, {
      stagingMode: 'patch-source',
      stagingRootNodeId: source.id as NodeId,
      nodes: [{ match: { path: '.' }, data: { nested: { value: 'new' }, list: [3] } }],
    });

    expect((await coreDB.getNode(source.id as NodeId))?.data).toEqual({
      nested: { keep: true, value: 'new' },
      list: [3],
    });
  });

  it('rejects holder-level overlay and accepts $-prefixed JSON data keys', async () => {
    const holder = await ensureTemporaryFolderHolder(coreDB, treeId);

    await expect(
      applyStagedFolderActionOverlays(coreDB, {
        stagingMode: 'temporary-copy',
        stagingRootNodeId: holder.id as NodeId,
        nodes: [{ match: { path: '.' }, data: {} }],
      })
    ).rejects.toMatchObject({
      code: 'STAGED_FOLDER_ACTION_OVERLAY_TARGET_IS_TEMPORARY_HOLDER',
    });

    const source = await createNode('source', 'r:root' as NodeId, {});
    await applyStagedFolderActionOverlays(coreDB, {
      stagingMode: 'patch-source',
      stagingRootNodeId: source.id as NodeId,
      nodes: [{ match: { path: '.' }, data: { $schema: 'https://example.test/schema.json' } }],
    });

    expect((await coreDB.getNode(source.id as NodeId))?.data).toEqual({
      $schema: 'https://example.test/schema.json',
    });
  });

  it('rejects invalid staging modes at the service boundary', async () => {
    const source = await createNode('source', 'r:root' as NodeId, {});

    await expect(
      applyStagedFolderActionOverlays(coreDB, {
        stagingMode: 'unknown-mode' as never,
        stagingRootNodeId: source.id as NodeId,
        nodes: [{ match: { path: '.' }, data: {} }],
      })
    ).rejects.toBeInstanceOf(StagedFolderActionOverlayApplicationError);
    await expect(
      applyStagedFolderActionOverlays(coreDB, {
        stagingMode: 'unknown-mode' as never,
        stagingRootNodeId: source.id as NodeId,
        nodes: [{ match: { path: '.' }, data: {} }],
      })
    ).rejects.toMatchObject({
      code: 'STAGED_FOLDER_ACTION_OVERLAY_INVALID_STAGING_MODE',
    });
  });

  async function createNode(
    idSeed: string,
    parentId: NodeId,
    data: NodePayload | null,
    overrides: TestTreeNodeOverrides = {}
  ): Promise<TreeNode<NodePayload | null>> {
    const now = Date.now() as Timestamp;
    const id = `${idSeed}-${crypto.randomUUID()}` as NodeId;
    const { metadata, ...nodeOverrides } = overrides;
    const node: TreeNode<NodePayload | null> = {
      id,
      parentId,
      nodeType: 'folder' as NodeType,
      depth: 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: {
        name: metadata?.name ?? 'Root Patch',
        description: metadata?.description ?? '',
        tags: metadata?.tags ?? [],
      },
      draftMetadata: null,
      data,
      draftData: undefined,
      visible: true,
      ...nodeOverrides,
    };
    await coreDB.createNode(node);
    return node;
  }

  function makeNode(
    id: NodeId,
    parentId: NodeId,
    data: NodePayload | null
  ): TreeNode<NodePayload | null> {
    const now = Date.now() as Timestamp;
    return {
      id,
      parentId,
      nodeType: 'folder' as NodeType,
      depth: 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: {
        name: 'Duplicate',
        description: '',
        tags: [],
      },
      draftMetadata: null,
      data,
      draftData: undefined,
      visible: true,
    };
  }
});
