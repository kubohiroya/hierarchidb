import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';

describe('ImportExportService importNodes bulk path', () => {
  beforeEach(() => vi.resetModules());

  it('bulk creates current level and recurses for children', async () => {
    const created: NodeId[] = [];
    const core: any = {
      bulkCreateNodes: vi.fn(async (nodes: TreeNode[]) => {
        nodes.forEach((n) => created.push(n.id));
      }),
      createNode: vi.fn(),
      getNode: vi.fn(),
    };
    const { ImportExportService } = await import('~/services/ImportExportService');
    const svc = await ImportExportService.getSingleton(core as any);
    const r = await svc.importNodes({
      data: { nodes: [{ name: 'A' }, { name: 'B', children: [{ name: 'B1' }] }] as any },
      format: 'json',
      treeId: 'r' as any,
      targetParentId: 'p' as any,
      validateFirst: false,
    });
    expect(r.success).toBe(true);
    expect(core.bulkCreateNodes).toHaveBeenCalled();
    // Two at top level + one child should be imported in total
    expect(r.importedCount).toBe(3);
  });
});

