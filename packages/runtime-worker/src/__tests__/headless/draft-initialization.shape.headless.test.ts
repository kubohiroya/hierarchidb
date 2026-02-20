import 'fake-indexeddb/auto';
import type { NodeId, NodeType, TreeId } from '@hierarchidb/core-types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '@hierarchidb/shape-api';
import { CoreDB } from '~/services/CoreDB';
import { TreeNodeUpdaterService } from '~/services/TreeNodeUpdaterService';

const TREE_ID = 'r' as TreeId;
const ROOT_ID = `${TREE_ID}:root` as NodeId;

const createRootNode = async (core: CoreDB) => {
  const now = Date.now();
  await core.nodes.put({
    id: ROOT_ID,
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
};

describe('TreeNodeUpdaterService draft initialization (shape)', () => {
  let core: CoreDB;
  let drafts: TreeNodeUpdaterService;

  beforeEach(async () => {
    CoreDB.resetInstance();
    core = await CoreDB.getSingleton(`${TREE_ID}-draft-init`);
    drafts = new TreeNodeUpdaterService(core);
    await createRootNode(core);
  });

  afterEach(() => {
    CoreDB.resetInstance();
  });

  it('seeds draftData from data when draftData is undefined', async () => {
    const now = Date.now();
    const nodeId = `${TREE_ID}:shape-1` as NodeId;
    const data = {
      buildConfig: {
        dataSourceName: 'gadm',
      },
      processingConfig: {
        fetch: {
          maxConcurrent: 2,
          retryAttempts: 2,
          retryDelay: 5000,
          retryLimit: 2,
          retryBackoff: 'linear',
        },
      },
    };
    await core.nodes.put({
      id: nodeId,
      parentId: ROOT_ID,
      nodeType: 'shape' as NodeType,
      metadata: { name: 'Shape', description: undefined, tags: [] },
      draftMetadata: null,
      data,
      draftData: undefined,
      depth: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 2,
      lastTouchedAt: now,
    });

    const node = await drafts.getTreeNode(nodeId);
    expect(node?.draftData).toEqual(data);

    const stored = await core.nodes.get(nodeId);
    expect((stored as { draftData?: unknown }).draftData).toEqual(data);
  });

  it('seeds draftData from defaults when data and draftData are undefined', async () => {
    const now = Date.now();
    const nodeId = `${TREE_ID}:shape-2` as NodeId;
    await core.nodes.put({
      id: nodeId,
      parentId: ROOT_ID,
      nodeType: 'shape' as NodeType,
      metadata: { name: 'Shape Default', description: undefined, tags: [] },
      draftMetadata: null,
      data: undefined,
      draftData: undefined,
      depth: 1,
      visible: true,
      createdAt: now,
      updatedAt: now,
      version: 3,
      lastTouchedAt: now,
    });

    const node = await drafts.getTreeNode(nodeId);
    expect((node?.draftData as { buildConfig?: unknown } | undefined)?.buildConfig).toEqual(
      DEFAULT_BUILD_CONFIG
    );
    expect((node?.draftData as { processingConfig?: unknown } | undefined)?.processingConfig).toEqual(
      DEFAULT_PROCESSING_CONFIG
    );

    const stored = await core.nodes.get(nodeId);
    expect((stored as { draftData?: { buildConfig?: unknown } }).draftData?.buildConfig).toEqual(
      DEFAULT_BUILD_CONFIG
    );
    expect((stored as { draftData?: { processingConfig?: unknown } }).draftData?.processingConfig).toEqual(
      DEFAULT_PROCESSING_CONFIG
    );
  });
});
