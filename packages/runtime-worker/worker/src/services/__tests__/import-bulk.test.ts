import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-type';
import type { ImportExportDBPort } from '@hierarchidb/import-export';

describe('ImportExportService importNodes bulk path', () => {
  beforeEach(() => vi.resetModules());

  it('bulk creates current level and recurses for children', async () => {
    const created: NodeId[] = [];
    const port: ImportExportDBPort = {
      bulkCreateNodes: vi.fn(async (nodes: TreeNode[]) => {
        nodes.forEach((node) => created.push(node.id));
      }),
      listChildren: vi.fn(async () => []),
      getNode: vi.fn(async () => undefined),
    };
    const { ImportExportService } = await import('~/services/ImportExportService');
    const svc = await ImportExportService.getSingleton(port);
    const r = await svc.importNodes({
      data: {
        nodes: [
          { name: 'A' },
          { name: 'B', children: [{ name: 'B1' }] },
        ],
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
