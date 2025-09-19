import { describe, expect, it, vi } from 'vitest';
import type { NodeId } from '@hierarchidb/common-type';
import { EntityLifecycleManager } from '../EntityLifecycleManager.js';

const makeCore = () => ({
  getNode: vi.fn(async () => undefined),
});

describe('EntityLifecycleManager.setIdMapping', () => {
  it('ignores mappings that cannot be normalized to NodeId pairs', async () => {
    const core = makeCore();
    const mgr = (EntityLifecycleManager as any).getSingleton(core);

    const mapping = new Map<any, any>([
      [123, 'dest'],
      ['valid' as NodeId, null],
    ]);

    (EntityLifecycleManager as any).setIdMapping('cmd-empty', mapping);

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
    const map = new Map<NodeId, NodeId>();
    const source = 'src-node' as NodeId;
    const target = 'dst-node' as NodeId;

    core.getNode = vi.fn(async (id: NodeId) => ({ id, nodeType: 'folder' }));

    const mgr = (EntityLifecycleManager as any).getSingleton(core);
    (EntityLifecycleManager as any).setIdMapping('cmd', [[source, target]]);

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
