import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-types';
import type { ImportExportDBPort } from '@hierarchidb/import-export';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ImportExportLifecycleService importNodes bulk path', () => {
  beforeEach(() => vi.resetModules());

  it('bulk creates current level and recurses for children', async () => {
    const created: NodeId[] = [];
    const port: ImportExportDBPort = {
      bulkCreateNodes: vi.fn(async (nodes: TreeNode[]) => {
        for (const node of nodes) {
          created.push(node.id);
        }
      }),
      listChildren: vi.fn(async () => []),
      getNode: vi.fn(async () => undefined),
    };
    const { ImportExportLifecycleService } = await import('../../ImportExportLifecycleService.js');
    const svc = await ImportExportLifecycleService.getSingleton(port);
    const r = await svc.importNodes({
      data: {
        nodes: [{ name: 'A' }, { name: 'B', children: [{ name: 'B1' }] }],
      },
      format: 'json',
      treeId: 'r' as TreeId,
      targetParentId: 'p' as NodeId,
      validateFirst: false,
    });
    expect(r.success).toBe(true);
    expect(port.bulkCreateNodes).toHaveBeenCalled();
    // Two at top level + one child should be imported in total
    expect(r.importedCount).toBe(3);
  });
});
