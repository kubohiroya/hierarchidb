import 'fake-indexeddb/auto';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoreDB } from '../../CoreDB.js';
import { createStagedFolderActionCoreRunnerDependencies } from '../../createStagedFolderActionCoreRunnerDependencies.js';
import { resolveEffectiveTreeNodeData } from '../../resolveEffectiveTreeNodeData.js';
import { runStagedFolderAction } from '../../runStagedFolderAction.js';
import { StagedFolderActionProgressStore } from '../../stagedFolderActionProgressStore.js';

describe('createStagedFolderActionCoreRunnerDependencies', () => {
  let coreDB: CoreDB;
  let store: StagedFolderActionProgressStore;
  let nowValue: number;

  beforeEach(async () => {
    CoreDB.resetInstance();
    coreDB = CoreDB.createForTest(`staged-action-core-runner-${crypto.randomUUID()}`);
    await coreDB.open();
    await coreDB.initialize();
    store = new StagedFolderActionProgressStore(
      `staged-action-core-progress-${crypto.randomUUID()}`
    );
    await store.open();
    nowValue = 100;
  });

  afterEach(async () => {
    await store.delete();
    await coreDB.delete();
    CoreDB.resetInstance();
  });

  it('prepares a temporary copy, applies overlays, and keeps retained staging roots', async () => {
    const source = await createNode({
      id: 'source',
      parentId: 'r:root' as NodeId,
      name: 'Source',
      data: { value: 'source' },
    });

    const dependencies = createStagedFolderActionCoreRunnerDependencies({
      coreDB,
      progressStore: store,
      now: () => nowValue++,
      runBuildAction: vi.fn(async ({ stagingRootNodeId }) => ({
        nodeType: 'shape' as NodeType,
        nodeId: stagingRootNodeId,
        status: 'completed',
      })),
    });

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-core' as NodeId,
      sourceNodeId: source.id as NodeId,
      config: {
        version: 1,
        staging: {
          mode: 'temporary-copy',
          name: 'Staged Source',
          cleanup: 'retain',
        },
        overlay: {
          nodes: [{ match: { path: '.' }, data: { value: 'patched' } }],
        },
        actions: [],
      },
    });
    const stagingRootNodeId = result.stagingRootNodeId;
    if (stagingRootNodeId === undefined) {
      throw new Error('test-staging-root-missing');
    }
    const stagingRoot = await coreDB.getNode(stagingRootNodeId);

    expect(stagingRoot).toMatchObject({
      metadata: { name: 'Staged Source' },
      copyOnWriteOf: source.id,
      patchData: { value: 'patched' },
    });
    await expect(
      resolveEffectiveTreeNodeData({
        reader: coreDB,
        nodeId: stagingRootNodeId,
        slot: 'effective-staged',
      })
    ).resolves.toMatchObject({
      data: { value: 'patched' },
    });
  });

  it('passes the injected reference resolver through the core runner dependencies', async () => {
    const source = await createNode({
      id: 'source-reference-resolver',
      parentId: 'r:root' as NodeId,
      name: 'Source Reference Resolver',
      data: { value: 'source' },
    });
    const resolveReferences = vi.fn(async () => ({
      warnings: [
        {
          category: 'reference' as const,
          code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
          message: 'lazy reference is unresolved',
          referencePath: 'imports/shape-a',
        },
      ],
      pendingReferences: [
        {
          status: 'pending' as const,
          code: 'STAGED_FOLDER_ACTION_REFERENCE_PENDING',
          referencePath: 'imports/shape-a',
        },
      ],
    }));
    const dependencies = createStagedFolderActionCoreRunnerDependencies({
      coreDB,
      progressStore: store,
      now: () => nowValue++,
      runBuildAction: vi.fn(async ({ stagingRootNodeId }) => ({
        nodeType: 'shape' as NodeType,
        nodeId: stagingRootNodeId,
        status: 'completed',
      })),
      resolveReferences,
    });

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-core-reference-resolver' as NodeId,
      sourceNodeId: source.id as NodeId,
      config: {
        version: 1,
        staging: {
          mode: 'temporary-copy',
          cleanup: 'retain',
        },
        overlay: {
          nodes: [],
        },
        actions: [],
      },
    });

    expect(resolveReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'after-overlay',
        runId: 'run-core-reference-resolver',
        pendingReferences: [],
      })
    );
    expect(result).toMatchObject({
      warnings: [
        {
          category: 'reference',
          referencePath: 'imports/shape-a',
        },
      ],
      pendingReferences: [
        {
          status: 'pending',
          referencePath: 'imports/shape-a',
        },
      ],
    });
  });

  it('passes the injected export file runner through the core runner dependencies', async () => {
    const source = await createNode({
      id: 'source-export-file-runner',
      parentId: 'r:root' as NodeId,
      name: 'Source Export File Runner',
      data: { value: 'source' },
    });
    const runExportFileAction = vi.fn(async () => ({
      type: 'export-csv' as const,
      status: 'completed' as const,
      outputPath: '/tmp/staged-action/locations.csv',
      entityType: 'location' as const,
      rowCount: 1,
    }));
    const dependencies = createStagedFolderActionCoreRunnerDependencies({
      coreDB,
      progressStore: store,
      now: () => nowValue++,
      runBuildAction: vi.fn(async ({ stagingRootNodeId }) => ({
        nodeType: 'shape' as NodeType,
        nodeId: stagingRootNodeId,
        status: 'completed',
      })),
      runExportFileAction,
    });

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-core-export-file-runner' as NodeId,
      sourceNodeId: source.id as NodeId,
      config: {
        version: 1,
        staging: {
          mode: 'temporary-copy',
          cleanup: 'retain',
        },
        overlay: {
          nodes: [],
        },
        actions: [
          {
            type: 'export-csv',
            entityType: 'location',
            source: { path: '.' },
            output: { path: 'locations.csv' },
          },
        ],
      },
    });

    expect(runExportFileAction).toHaveBeenCalledWith({
      action: {
        type: 'export-csv',
        entityType: 'location',
        source: { path: '.' },
        output: { path: 'locations.csv' },
      },
      actionIndex: 0,
      config: expect.any(Object),
      stagingRootNodeId: expect.any(String),
      runId: 'run-core-export-file-runner',
    });
    expect(result.actionResults).toEqual([
      {
        type: 'export-csv',
        status: 'completed',
        outputPath: '/tmp/staged-action/locations.csv',
        entityType: 'location',
        rowCount: 1,
      },
    ]);
  });

  it('deletes temporary staging roots when cleanup is delete-on-success', async () => {
    const source = await createNode({
      id: 'source-cleanup',
      parentId: 'r:root' as NodeId,
      name: 'Source Cleanup',
      data: { value: 'source' },
    });
    const dependencies = createStagedFolderActionCoreRunnerDependencies({
      coreDB,
      progressStore: store,
      now: () => nowValue++,
      runBuildAction: vi.fn(async ({ stagingRootNodeId }) => ({
        nodeType: 'shape' as NodeType,
        nodeId: stagingRootNodeId,
        status: 'completed',
      })),
    });

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-core-cleanup' as NodeId,
      sourceNodeId: source.id as NodeId,
      config: {
        version: 1,
        staging: {
          mode: 'temporary-copy',
          cleanup: 'delete-on-success',
        },
        overlay: {
          nodes: [],
        },
        actions: [],
      },
    });

    expect(result.stagingRootNodeId).toBeDefined();
    await expect(coreDB.getNode(result.stagingRootNodeId as NodeId)).resolves.toBeUndefined();
  });

  it('prepares a permanent copy under the requested output parent', async () => {
    const source = await createNode({
      id: 'source-permanent',
      parentId: 'r:root' as NodeId,
      name: 'Source Permanent',
      data: { nested: { keep: true } },
    });
    const outputParent = await createNode({
      id: 'output-parent',
      parentId: 'r:root' as NodeId,
      name: 'Output Parent',
      data: {},
    });
    const dependencies = createStagedFolderActionCoreRunnerDependencies({
      coreDB,
      progressStore: store,
      now: () => nowValue++,
      runBuildAction: vi.fn(async ({ stagingRootNodeId }) => ({
        nodeType: 'shape' as NodeType,
        nodeId: stagingRootNodeId,
        status: 'completed',
      })),
    });

    const result = await runStagedFolderAction(dependencies, {
      runId: 'run-core-permanent' as NodeId,
      sourceNodeId: source.id as NodeId,
      outputParentNodeId: outputParent.id as NodeId,
      config: {
        version: 1,
        staging: {
          mode: 'permanent-copy',
          name: 'Permanent Staged',
          cleanup: 'retain',
        },
        overlay: {
          nodes: [{ match: { path: '.' }, data: { nested: { value: 'patched' } } }],
        },
        actions: [],
      },
    });
    const stagingRootNodeId = result.stagingRootNodeId;
    if (stagingRootNodeId === undefined) {
      throw new Error('test-permanent-staging-root-missing');
    }
    const stagingRoot = await coreDB.getNode(stagingRootNodeId);

    expect(stagingRoot).toMatchObject({
      parentId: outputParent.id,
      metadata: { name: 'Permanent Staged' },
      copyOnWriteOf: source.id,
      patchData: { nested: { value: 'patched' } },
    });
    expect(stagingRoot?.isTemporary).toBeUndefined();
    await expect(
      resolveEffectiveTreeNodeData({
        reader: coreDB,
        nodeId: stagingRootNodeId,
        slot: 'effective-staged',
      })
    ).resolves.toMatchObject({
      data: { nested: { keep: true, value: 'patched' } },
    });
  });

  it('fails permanent-copy staging when outputParentNodeId is missing', async () => {
    const source = await createNode({
      id: 'source-permanent-missing-parent',
      parentId: 'r:root' as NodeId,
      name: 'Source Permanent Missing Parent',
      data: {},
    });
    const dependencies = createStagedFolderActionCoreRunnerDependencies({
      coreDB,
      progressStore: store,
      now: () => nowValue++,
      runBuildAction: vi.fn(async ({ stagingRootNodeId }) => ({
        nodeType: 'shape' as NodeType,
        nodeId: stagingRootNodeId,
        status: 'completed',
      })),
    });

    await expect(
      runStagedFolderAction(dependencies, {
        runId: 'run-core-permanent-missing-parent' as NodeId,
        sourceNodeId: source.id as NodeId,
        config: {
          version: 1,
          staging: {
            mode: 'permanent-copy',
            cleanup: 'retain',
          },
          overlay: {
            nodes: [],
          },
          actions: [],
        },
      })
    ).rejects.toThrow(/outputParentNodeId/);
  });

  async function createNode(input: {
    id: string;
    parentId: NodeId;
    name: string;
    data: Record<string, unknown>;
  }): Promise<TreeNode> {
    const now = Date.now();
    const node: TreeNode = {
      id: input.id as NodeId,
      parentId: input.parentId,
      nodeType: 'folder' as NodeType,
      depth: 1,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: {
        name: input.name,
        description: '',
        tags: [],
      },
      draftMetadata: null,
      data: input.data,
      draftData: undefined,
      visible: true,
    };
    await coreDB.createNode(node);
    return node;
  }
});
