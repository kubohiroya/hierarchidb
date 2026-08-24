import { CanonicalBuildInputError } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { describe, expect, it } from 'vitest';
import {
  resolveCanonicalBuildStartInput,
  resolveCanonicalBuildTreeNodeForStart,
} from '../../resolveCanonicalBuildStartInput.js';

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

  it('uses effective committed data for copy-on-write build input', () => {
    const effectiveData = { buildConfig: { dataSourceName: 'gadm' } };
    const treeNode = resolveCanonicalBuildTreeNodeForStart({
      nodeType: NODE_TYPE,
      nodeId: NODE_ID,
      source: 'committed',
      updaterTreeNode: createNode({
        copyOnWriteOf: 'source' as NodeId,
        patchData: { buildConfig: { dataSourceName: 'gadm' } },
        data: null,
      }),
      queryTreeNode: createNode({
        data: effectiveData,
      }),
    });

    const input = resolveCanonicalBuildStartInput({
      nodeType: NODE_TYPE,
      nodeId: NODE_ID,
      source: 'committed',
      treeNode,
    });

    expect(input).toEqual({ source: 'committed', payload: effectiveData });
  });

  it('does not use effective committed data for working-copy input', () => {
    const treeNode = resolveCanonicalBuildTreeNodeForStart({
      nodeType: NODE_TYPE,
      nodeId: NODE_ID,
      source: 'working-copy',
      updaterTreeNode: createNode({
        copyOnWriteOf: 'source' as NodeId,
        data: null,
        draftData: { buildConfig: { dataSourceName: 'naturalearth' } },
      }),
      queryTreeNode: createNode({
        data: { buildConfig: { dataSourceName: 'gadm' } },
      }),
    });

    const input = resolveCanonicalBuildStartInput({
      nodeType: NODE_TYPE,
      nodeId: NODE_ID,
      source: 'working-copy',
      treeNode,
    });

    expect(input).toEqual({
      source: 'working-copy',
      payload: { buildConfig: { dataSourceName: 'naturalearth' } },
    });
  });

  it('rejects committed copy-on-write input when effective data is unavailable', () => {
    expect(() =>
      resolveCanonicalBuildTreeNodeForStart({
        nodeType: NODE_TYPE,
        nodeId: NODE_ID,
        source: 'committed',
        updaterTreeNode: createNode({
          copyOnWriteOf: 'source' as NodeId,
          data: null,
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
