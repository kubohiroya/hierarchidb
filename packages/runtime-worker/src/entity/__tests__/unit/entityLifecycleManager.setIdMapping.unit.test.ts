import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '~/services/CoreDB';
import { EntityLifecycleManager } from '~/entity/EntityLifecycleManager';

const makeCore = () => ({
  getNode: vi.fn(async (_id: NodeId) => undefined) as unknown as CoreDB['getNode'],
});

describe('EntityLifecycleManager.setIdMapping', () => {
  it('ignores mappings that cannot be normalized to NodeId pairs', async () => {
    const core = makeCore();
    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);

    const mapping = new Map<NodeId | number | string, NodeId | number | string>([
      [123, 'dest' as NodeId],
      ['valid' as NodeId, null],
    ]);

    EntityLifecycleManager.setIdMapping('cmd-empty', mapping);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-empty',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'parent' as NodeId },
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
      metadata: { name: 'node', description: undefined, tags: [] },
      draftMetadata: null,
      data: {},
      draftData: undefined,
      depth: 1,
      visible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    }));

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    const mapping: ReadonlyArray<readonly [NodeId, NodeId]> = [[source, target] as const];
    EntityLifecycleManager.setIdMapping('cmd', mapping);

    await mgr.onDuplicateNodes({
      commandId: 'cmd',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'parent' as NodeId },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledWith(source);
  });
});
