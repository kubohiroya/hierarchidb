import 'fake-indexeddb/auto';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CoreDB } from '~/services/CoreDB';

function legacyListChildrenProjection(children: TreeNode[]) {
  return children.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    nodeType: node.nodeType,
    name: node.metadata.name,
    depth: node.depth,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    version: node.version,
    ...(node.references && { references: node.references }),
  }));
}

describe('CoreDB.listChildren hasChildren propagation', () => {
  let core: CoreDB;
  const parentId = 'r:root' as NodeId;
  const childId = 'r:root:child-hasChildren' as NodeId;

  beforeAll(async () => {
    core = await CoreDB.getSingleton('hasChildren-test');
    const node: TreeNode = {
      id: childId,
      parentId,
      nodeType: 'folder' as NodeType,
      metadata: { name: 'Has children node', description: undefined, tags: [] },
      draftMetadata: null,
      data: {},
      draftData: undefined,
      depth: 1,
      visible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      hasChildren: true,
    };
    await core.nodes.put(node);
  });

  afterAll(async () => {
    await core.nodes.delete(childId);
  });

  it('red: legacy projection dropped hasChildren', async () => {
    const rawChildren = await core.nodes.where('parentId').equals(parentId).toArray();
    const projected = legacyListChildrenProjection(rawChildren);
    const target = projected.find((n) => n.id === childId);
    expect(target).toBeDefined();
    expect(Object.hasOwn(target ?? {}, 'hasChildren')).toBe(false);
  });

  it('green: listChildren preserves hasChildren flag', async () => {
    const children = await core.listChildren(parentId);
    const target = children.find((n) => n.id === childId);
    expect(target).toBeDefined();
    expect(target?.hasChildren).toBe(true);
  });
});
