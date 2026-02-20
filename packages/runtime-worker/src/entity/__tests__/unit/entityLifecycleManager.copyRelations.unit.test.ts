import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '~/services/CoreDB';
import { EntityLifecycleManager } from '~/entity/EntityLifecycleManager';

describe('EntityLifecycleManager.copyRelationsByMapping', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('does not attempt relation copy without store registry', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const makeNode = (id: NodeId, nodeType: NodeType): TreeNode => ({
      id,
      parentId: 'root' as NodeId,
      nodeType,
      metadata: { name: String(id), description: undefined, tags: [] },
      draftMetadata: null,
      data: {},
      draftData: undefined,
      depth: 1,
      visible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    const a1 = 'a1' as NodeId;
    const b1 = 'b1' as NodeId;
    const a2 = 'a2' as NodeId;
    const b2 = 'b2' as NodeId;
    nodeMap.set(a1, makeNode(a1, 'folder' as NodeType));
    nodeMap.set(a2, makeNode(a2, 'folder' as NodeType));

    const core: Pick<CoreDB, 'getNode'> = {
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const mgr = EntityLifecycleManager.getSingleton(core as unknown as CoreDB);
    EntityLifecycleManager.setIdMapping('cmd-rel', [
      [a1, b1],
      [a2, b2],
    ]);

    await mgr.onDuplicateNodes({
      commandId: 'cmd-rel',
      groupId: 'g',
      kind: 'duplicateNodes',
      payload: { nodeIds: [], toParentId: 'parent' as NodeId },
      issuedAt: Date.now(),
      type: 'duplicateNodes',
    });

    expect(core.getNode).toHaveBeenCalledTimes(2);
  });
});
