import { CanonicalBuildInputError } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it } from 'vitest';
import { resolveCanonicalBuildStartInput } from '../../resolveCanonicalBuildStartInput.js';

const NODE_ID = 'node-1' as NodeId;
const NODE_TYPE = 'shape' as NodeType;

const createNode = (overrides: Partial<TreeNode> = {}): TreeNode =>
  ({
    id: NODE_ID,
    parentId: 'parent' as NodeId,
    nodeType: NODE_TYPE,
    depth: 1,
    createdAt: 1,
    updatedAt: 2,
    version: 3,
    metadata: { name: 'node', description: '', tags: [] },
    draftMetadata: null,
    data: { buildConfig: { dataSourceName: 'naturalearth' } },
    visible: true,
    ...overrides,
  }) as TreeNode;

describe('resolveCanonicalBuildStartInput', () => {
  it('reads committed payload only from TreeNode.data', () => {
    const payload = { buildConfig: { dataSourceName: 'naturalearth' } };
    const input = resolveCanonicalBuildStartInput({
      nodeType: NODE_TYPE,
      nodeId: NODE_ID,
      source: 'committed',
      treeNode: createNode({
        data: payload,
        draftData: { buildConfig: { dataSourceName: 'gadm' } },
      }),
    });

    expect(input).toEqual({ source: 'committed', payload });
  });

  it('reads working-copy payload only from TreeNode.draftData', () => {
    const payload = { buildConfig: { dataSourceName: 'gadm' } };
    const input = resolveCanonicalBuildStartInput({
      nodeType: NODE_TYPE,
      nodeId: NODE_ID,
      source: 'working-copy',
      treeNode: createNode({
        data: { buildConfig: { dataSourceName: 'naturalearth' } },
        draftData: payload,
      }),
    });

    expect(input).toEqual({ source: 'working-copy', payload });
  });

  it('does not fall back to draftData when committed data is missing', () => {
    expect(() =>
      resolveCanonicalBuildStartInput({
        nodeType: NODE_TYPE,
        nodeId: NODE_ID,
        source: 'committed',
        treeNode: createNode({
          data: null,
          draftData: { buildConfig: { dataSourceName: 'gadm' } },
        }),
      })
    ).toThrow(CanonicalBuildInputError);
  });

  it('does not fall back to data when working-copy draftData is missing', () => {
    expect(() =>
      resolveCanonicalBuildStartInput({
        nodeType: NODE_TYPE,
        nodeId: NODE_ID,
        source: 'working-copy',
        treeNode: createNode({
          draftData: undefined,
        }),
      })
    ).toThrow(CanonicalBuildInputError);
  });

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'payload'],
  ])('rejects non-object %s payloads', (_label, data) => {
    expect(() =>
      resolveCanonicalBuildStartInput({
        nodeType: NODE_TYPE,
        nodeId: NODE_ID,
        source: 'committed',
        treeNode: createNode({ data: data as TreeNode['data'] }),
      })
    ).toThrow(CanonicalBuildInputError);
  });

  it('rejects nodeId mismatch before reading payload', () => {
    expect(() =>
      resolveCanonicalBuildStartInput({
        nodeType: NODE_TYPE,
        nodeId: NODE_ID,
        source: 'committed',
        treeNode: createNode({ id: 'other' as NodeId }),
      })
    ).toThrow('canonical build nodeId mismatch');
  });

  it('rejects nodeType mismatch before reading payload', () => {
    expect(() =>
      resolveCanonicalBuildStartInput({
        nodeType: NODE_TYPE,
        nodeId: NODE_ID,
        source: 'committed',
        treeNode: createNode({ nodeType: 'route' as NodeType }),
      })
    ).toThrow('canonical build nodeType mismatch');
  });
});
