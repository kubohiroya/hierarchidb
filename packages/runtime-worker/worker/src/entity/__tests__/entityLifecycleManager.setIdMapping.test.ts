import { describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import type { CoreDB } from '../../services/CoreDB.js';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';

const makeCore = () => ({
  getNode: vi.fn(async (): Promise<TreeNode | undefined> => undefined),
});

describe('EntityLifecycleManager.setIdMapping', () => {
  it('ignores mappings that cannot be normalized to NodeId pairs', async () => {
    const core = makeCore();
    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);

    const mapping = new Map<unknown, unknown>([
      [123, 'dest'],
      ['valid' as NodeId, null],
    ]);

    EntityLifecycleManager.setIdMapping('cmd-empty', mapping);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-empty',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [] },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).not.toHaveBeenCalled();
  });

  it('uses normalized NodeId pairs from iterable inputs', async () => {
    const core = makeCore();
    const source = 'src-node' as NodeId;
    const target = 'dst-node' as NodeId;

    core.getNode = vi.fn(async (id: NodeId) => ({
      id,
      nodeType: 'folder' as NodeType,
      parentId: 'root' as NodeId,
      name: 'node',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    }));

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    EntityLifecycleManager.setIdMapping('cmd', [[source, target]]);

    await mgr.onDuplicateNodes({
      commandId: 'cmd',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [] },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledWith(source);
  });
});
