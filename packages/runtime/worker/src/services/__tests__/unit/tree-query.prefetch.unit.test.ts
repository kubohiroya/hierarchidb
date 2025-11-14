import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../CoreDB.js';
import type { FulltextIndexService } from '../../FulltextIndexService.js';
import { TreeQueryService } from '../../TreeQueryService.js';

const makeNode = (id: string, parentId: string | null, name: string): TreeNode => ({
  id: id as NodeId,
  parentId: parentId ? (parentId as NodeId) : undefined,
  nodeType: 'folder' as TreeNode['nodeType'],
  name,
  depth: parentId ? 1 : 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  version: 1,
});

describe('TreeQueryService listChildren prefetch', () => {
  let service: TreeQueryService;
  const tree: Record<string, TreeNode[]> = {};

  const stubCoreDB = {
    listChildren: vi.fn(async (parentId: NodeId) => tree[String(parentId)] || []),
  } as unknown as CoreDB;
  const stubFulltextService = {
    search: vi.fn(async () => []),
  } as unknown as FulltextIndexService;

  beforeEach(() => {
    for (const key of Object.keys(tree)) {
      delete tree[key];
    }
    tree.root = [makeNode('child-a', 'root', 'A'), makeNode('child-b', 'root', 'B')];
    tree['child-a'] = [makeNode('grand-a1', 'child-a', 'A1')];
    tree['child-b'] = [
      makeNode('grand-b1', 'child-b', 'B1'),
      makeNode('grand-b2', 'child-b', 'B2'),
    ];
    tree['grand-b1'] = [makeNode('great-b1', 'grand-b1', 'B1-1')];

    service = new TreeQueryService(stubCoreDB, stubFulltextService);
    (stubCoreDB.listChildren as ReturnType<typeof vi.fn>).mockClear();
  });

  it('returns direct children by default', async () => {
    const result = await service.listChildren('root' as NodeId);
    expect(result.map((node) => node.id)).toEqual(['child-a', 'child-b']);
  });

  it('prefetches descendants up to specified depth', async () => {
    const result = await service.listChildren('root' as NodeId, { prefetch: { depth: 3 } });
    expect(result.map((node) => node.id)).toEqual([
      'child-a',
      'child-b',
      'grand-a1',
      'grand-b1',
      'grand-b2',
      'great-b1',
    ]);
    expect(stubCoreDB.listChildren as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1 + 2 + 3);
  });
});
