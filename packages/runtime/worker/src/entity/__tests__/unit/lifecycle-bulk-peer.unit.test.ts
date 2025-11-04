import type {
  CommandResult,
  NodeId,
  PasteNodesPayload,
  Timestamp,
  TreeNode,
} from '@hierarchidb/common-types';
import { toNodeType } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandProcessor } from '../../../services/CommandProcessor.js';
import type { CoreDB } from '../../../services/CoreDB.js';
import type { CommandEnvelope } from '../../../services/command-types.js';
import type { PeerEntity, PeerStore } from '../../store.js';
import { storeRegistry } from '../../store-registry.js';

describe('Lifecycle uses bulkUpsert when available', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('paste: calls store.bulkUpsert once for same nodeType', async () => {
    const nodeMap = new Map<NodeId, TreeNode>();
    const core: Pick<CoreDB, 'listChildren' | 'createNode' | 'bulkCreateNodes' | 'getNode'> = {
      listChildren: vi.fn(async () => []),
      createNode: vi.fn(async (node: TreeNode) => {
        nodeMap.set(node.id, { ...node });
        return node.id;
      }),
      bulkCreateNodes: vi.fn(async (nodes: TreeNode[]) => {
        nodes.forEach((node) => {
          nodeMap.set(node.id, { ...node });
        });
      }),
      getNode: vi.fn(async (id: NodeId) => nodeMap.get(id)),
    };

    const processor: Pick<CommandProcessor, 'processCommand'> = {
      processCommand: vi.fn(async () => ({ success: true, seq: 1 }) as CommandResult),
    };

    const collected: PeerEntity[] = [];
    const store: PeerStore = {
      async get(id: NodeId) {
        return { nodeId: id, data: { from: id } };
      },
      async put() {
        throw new Error('put should not be called when bulkUpsert exists');
      },
      async delete() {},
      async bulkUpsert(entities: PeerEntity[]) {
        collected.push(...entities);
      },
    };
    const folderType = toNodeType('folder');
    storeRegistry.registerPeer(folderType, store);

    const { TreeMutationService } = await import('../../../services/TreeMutationService.js');
    const svc = new TreeMutationService(core as unknown as CoreDB, processor as CommandProcessor);

    const sourceNodeA: TreeNode = {
      id: 's1' as NodeId,
      parentId: 'x' as NodeId,
      nodeType: folderType,
      name: 'A',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    const sourceNodeB: TreeNode = {
      id: 's2' as NodeId,
      parentId: 'x' as NodeId,
      nodeType: folderType,
      name: 'B',
      depth: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    };
    const payload: PasteNodesPayload = {
      nodes: {
        [sourceNodeA.id]: sourceNodeA,
        [sourceNodeB.id]: sourceNodeB,
      },
      nodeIds: [sourceNodeA.id, sourceNodeB.id],
      toParentId: 'p' as NodeId,
    };
    const env: CommandEnvelope<'pasteNodes', PasteNodesPayload> = {
      commandId: 'c1',
      groupId: 'g1',
      kind: 'pasteNodes',
      payload,
      issuedAt: Date.now() as Timestamp,
    };

    const r = await svc.pasteNodes(env);
    expect(r.success).toBe(true);
    expect(collected).toHaveLength(2);
    for (const entity of collected) {
      expect(entity.data).toMatchObject({ from: expect.any(String) });
    }
  });
});
