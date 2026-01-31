import 'fake-indexeddb/auto';
import type { TreeQueryAPI } from '@hierarchidb/tree-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TreeTableExpandedService } from '../../TreeTableExpandedService.js';
import { UIStateDB } from '../../UIStateDB.js';

describe('TreeTableExpandedService', () => {
  let db: UIStateDB;
  let service: TreeTableExpandedService;
  const listDescendants = vi.fn<TreeQueryAPI['listDescendants']>(async () => []);

  beforeEach(async () => {
    db = new UIStateDB(`ui-state-test-${Date.now()}-${Math.random()}`);
    await db.open();
    const queryService: TreeQueryAPI = {
      getTree: vi.fn(async () => undefined),
      listTrees: vi.fn(async () => []),
      getNode: vi.fn(async () => undefined),
      listChildren: vi.fn(async () => []),
      listDescendants,
      listAncestors: vi.fn(async () => []),
      searchNodes: vi.fn(async () => []),
      searchNodesByType: vi.fn(async () => []),
      searchNodesFulltext: vi.fn(async () => []),
      getNodePath: vi.fn(async () => []),
      queryNodes: vi.fn(async () => []),
    };
    service = new TreeTableExpandedService(db, queryService);
    listDescendants.mockReset();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('opens and returns expanded nodes per page', async () => {
    await service.openNodes('pageA' as NodeId, ['a', 'b'] as NodeId[]);
    await service.openNodes('pageB' as NodeId, ['c'] as NodeId[]);

    const pageA = await service.getExpandedNodes('pageA' as NodeId);
    const pageB = await service.getExpandedNodes('pageB' as NodeId);

    expect(new Set(pageA)).toEqual(new Set(['a', 'b']));
    expect(pageB).toEqual(['c']);
  });

  it('closes nodes for a specific page', async () => {
    await service.openNodes('pageA' as NodeId, ['a', 'b'] as NodeId[]);
    await service.closeNodes('pageA' as NodeId, ['a']);

    const pageA = await service.getExpandedNodes('pageA' as NodeId);
    expect(pageA).toEqual(['b']);
  });

  it('clears expanded nodes for a page only', async () => {
    await service.openNodes('pageA' as NodeId, ['a', 'b'] as NodeId[]);
    await service.openNodes('pageB' as NodeId, ['a'] as NodeId[]);

    const removed = await service.clearExpandedForPage('pageA' as NodeId);
    expect(removed).toBeGreaterThan(0);

    const pageA = await service.getExpandedNodes('pageA' as NodeId);
    const pageB = await service.getExpandedNodes('pageB' as NodeId);
    expect(pageA).toEqual([]);
    expect(pageB).toEqual(['a']);
  });

  it('clears subtree nodes across all pages', async () => {
    listDescendants.mockImplementation(async (root: NodeId) => {
      if (root === ('root' as NodeId)) {
        return [
          { id: 'child-1', parentId: root, metadata: { name: '' } } as unknown as TreeNode,
          { id: 'child-2', parentId: root, metadata: { name: '' } } as unknown as TreeNode,
        ];
      }
      if (root === ('child-1' as NodeId)) {
        return [{ id: 'grand-1', parentId: root, metadata: { name: '' } } as unknown as TreeNode];
      }
      return [];
    });

    await service.openNodes('pageA' as NodeId, ['root', 'child-1', 'other'] as NodeId[]);
    await service.openNodes('pageB' as NodeId, ['grand-1', 'child-2'] as NodeId[]);

    await service.clearExpandedForSubtree(['root', 'child-1'] as NodeId[]);

    const pageA = await service.getExpandedNodes('pageA' as NodeId);
    const pageB = await service.getExpandedNodes('pageB' as NodeId);
    expect(new Set(pageA)).toEqual(new Set(['other']));
    expect(pageB).toEqual([]);
  });
});
