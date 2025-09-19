import 'fake-indexeddb/auto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import { CoreDB } from '../CoreDB.js';

function legacyListChildrenProjection(children: TreeNode[]) {
  return children.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    nodeType: node.nodeType,
    name: node.name,
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
      name: 'Has children node',
      depth: 1,
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
    expect(target?.hasChildren).toBeUndefined();
  });

  it('green: listChildren preserves hasChildren flag', async () => {
    const children = await core.listChildren(parentId);
    const target = children.find((n) => n.id === childId);
    expect(target).toBeDefined();
    expect(target?.hasChildren).toBe(true);
  });
});
