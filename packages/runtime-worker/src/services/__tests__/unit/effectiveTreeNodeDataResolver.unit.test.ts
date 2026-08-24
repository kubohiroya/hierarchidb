import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { NodePayload, TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it } from 'vitest';
import {
  EffectiveTreeNodeDataResolverError,
  resolveEffectiveTreeNodeData,
  type TreeNodeReader,
} from '../../resolveEffectiveTreeNodeData.js';

const nodeId = (value: string): NodeId => value as NodeId;
const timestamp = (value: number): Timestamp => value as Timestamp;

const makeNode = (
  id: NodeId,
  overrides: Partial<TreeNode<NodePayload | null>> = {}
): TreeNode<NodePayload | null> => ({
  id,
  parentId: nodeId('parent'),
  nodeType: 'folder' as NodeType,
  depth: 1,
  createdAt: timestamp(1),
  updatedAt: timestamp(2),
  version: 1,
  metadata: {
    name: String(id),
    description: '',
    tags: [],
  },
  draftMetadata: null,
  data: null,
  visible: true,
  ...overrides,
});

const makeReader = (nodes: TreeNode<NodePayload | null>[]): TreeNodeReader => {
  const map = new Map<NodeId, TreeNode<NodePayload | null>>();
  for (const node of nodes) {
    map.set(node.id, node);
  }
  return {
    async getNode(id) {
      return map.get(id);
    },
  };
};

describe('resolveEffectiveTreeNodeData', () => {
  it('returns committed node data without copy-on-write overlays', async () => {
    const id = nodeId('node-1');
    const reader = makeReader([makeNode(id, { data: { name: 'source', count: 1 } })]);

    const result = await resolveEffectiveTreeNodeData({
      reader,
      nodeId: id,
      slot: 'committed',
    });

    expect(result.data).toEqual({ name: 'source', count: 1 });
    expect(result.metadata.sourceNodeIds).toEqual([id]);
    expect(result.metadata.versions).toEqual([{ nodeId: id, version: 1 }]);
  });

  it('merges copy-on-write source data with patchData using object recursion and array replacement', async () => {
    const sourceId = nodeId('source');
    const stagedId = nodeId('staged');
    const reader = makeReader([
      makeNode(sourceId, {
        version: 2,
        data: {
          label: 'original',
          nested: { keep: true, replace: 'old' },
          list: [1, 2],
        },
      }),
      makeNode(stagedId, {
        version: 3,
        copyOnWriteOf: sourceId,
        patchData: {
          label: 'patched',
          nested: { replace: 'new' },
          list: [3],
        },
      }),
    ]);

    const result = await resolveEffectiveTreeNodeData({
      reader,
      nodeId: stagedId,
      slot: 'committed',
    });

    expect(result.data).toEqual({
      label: 'patched',
      nested: { keep: true, replace: 'new' },
      list: [3],
    });
    expect(result.metadata.sourceNodeIds).toEqual([sourceId, stagedId]);
    expect(result.metadata.versions).toEqual([
      { nodeId: sourceId, version: 2 },
      { nodeId: stagedId, version: 3 },
    ]);
  });

  it('overlays draftData only for the draft slot', async () => {
    const id = nodeId('drafted');
    const reader = makeReader([
      makeNode(id, {
        data: { nested: { committed: true, value: 'old' } },
        draftData: { nested: { value: 'draft' } },
      }),
    ]);

    await expect(
      resolveEffectiveTreeNodeData({ reader, nodeId: id, slot: 'committed' })
    ).resolves.toMatchObject({
      data: { nested: { committed: true, value: 'old' } },
    });

    await expect(
      resolveEffectiveTreeNodeData({ reader, nodeId: id, slot: 'draft' })
    ).resolves.toMatchObject({
      data: { nested: { committed: true, value: 'draft' } },
    });
  });

  it('uses copy-on-write and patchData for effective-staged without local caller fallback', async () => {
    const sourceId = nodeId('source');
    const stagedId = nodeId('staged');
    const reader = makeReader([
      makeNode(sourceId, { data: { value: 1 } }),
      makeNode(stagedId, { copyOnWriteOf: sourceId, patchData: { value: 2 } }),
    ]);

    const result = await resolveEffectiveTreeNodeData({
      reader,
      nodeId: stagedId,
      slot: 'effective-staged',
    });

    expect(result.data).toEqual({ value: 2 });
  });

  it('reflects source committed data updates on future resolver calls', async () => {
    const sourceId = nodeId('source');
    const stagedId = nodeId('staged');
    const sourceNode = makeNode(sourceId, { data: { value: 1 } });
    const reader = makeReader([
      sourceNode,
      makeNode(stagedId, { copyOnWriteOf: sourceId, patchData: { extra: true } }),
    ]);

    await expect(
      resolveEffectiveTreeNodeData({ reader, nodeId: stagedId, slot: 'effective-staged' })
    ).resolves.toMatchObject({
      data: { value: 1, extra: true },
    });

    sourceNode.data = { value: 2 };
    sourceNode.version = 2;

    const result = await resolveEffectiveTreeNodeData({
      reader,
      nodeId: stagedId,
      slot: 'effective-staged',
    });

    expect(result.data).toEqual({ value: 2, extra: true });
    expect(result.metadata.versions[0]).toEqual({ nodeId: sourceId, version: 2 });
  });

  it('throws a typed error when patchData is set without copyOnWriteOf', async () => {
    const id = nodeId('invalid');
    const reader = makeReader([makeNode(id, { patchData: { value: 1 } })]);

    await expect(
      resolveEffectiveTreeNodeData({ reader, nodeId: id, slot: 'committed' })
    ).rejects.toMatchObject({
      code: 'EFFECTIVE_TREE_NODE_DATA_PATCH_WITHOUT_COW',
    });
  });

  it.each([
    ['patchData', { patchData: ['invalid'] }],
    ['draftData', { draftData: ['invalid'] }],
  ] as const)('throws a typed error when %s is not an object payload', async (_name, overrides) => {
    const id = nodeId('invalid');
    const sourceId = nodeId('source');
    const reader = makeReader([
      makeNode(sourceId, { data: { value: 1 } }),
      makeNode(id, {
        copyOnWriteOf: 'patchData' in overrides ? sourceId : undefined,
        ...(overrides as unknown as Partial<TreeNode<NodePayload | null>>),
      }),
    ]);

    await expect(
      resolveEffectiveTreeNodeData({ reader, nodeId: id, slot: 'draft' })
    ).rejects.toMatchObject({
      code:
        'patchData' in overrides
          ? 'EFFECTIVE_TREE_NODE_DATA_PATCH_NOT_OBJECT'
          : 'EFFECTIVE_TREE_NODE_DATA_DRAFT_NOT_OBJECT',
    });
  });

  it('throws a typed error when copy-on-write source is missing', async () => {
    const id = nodeId('staged');
    const reader = makeReader([makeNode(id, { copyOnWriteOf: nodeId('missing') })]);

    await expect(
      resolveEffectiveTreeNodeData({ reader, nodeId: id, slot: 'committed' })
    ).rejects.toMatchObject({
      code: 'EFFECTIVE_TREE_NODE_DATA_COW_SOURCE_NOT_FOUND',
    });
  });

  it('throws a typed error for circular copy-on-write references', async () => {
    const firstId = nodeId('first');
    const secondId = nodeId('second');
    const reader = makeReader([
      makeNode(firstId, { copyOnWriteOf: secondId }),
      makeNode(secondId, { copyOnWriteOf: firstId }),
    ]);

    await expect(
      resolveEffectiveTreeNodeData({ reader, nodeId: firstId, slot: 'committed' })
    ).rejects.toBeInstanceOf(EffectiveTreeNodeDataResolverError);
    await expect(
      resolveEffectiveTreeNodeData({ reader, nodeId: firstId, slot: 'committed' })
    ).rejects.toMatchObject({
      code: 'EFFECTIVE_TREE_NODE_DATA_COW_CYCLE',
    });
  });
});
