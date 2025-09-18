import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import { CommandProcessor } from '../CommandProcessor.js';
import { storeRegistry } from '../../entity/store-registry.js';
import type { PeerStore } from '../../entity/store.js';

describe('PeerEntity delete policy (trash vs permanent vs WC)', () => {
  let core: any;
  let state: Record<string, TreeNode>;
  const now = Date.now();
  const makeNode = (id: string, parentId: string, nodeType: NodeType, name: string): TreeNode => ({
    id: id as NodeId,
    parentId: parentId as NodeId,
    nodeType,
    name,
    depth: 1,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  beforeEach(() => {
    state = {
      'r:superRoot': makeNode('r:superRoot', 'r:superRoot', 'folder' as any, 'super'),
      'r:root': makeNode('r:root', 'r:superRoot', 'folder' as any, 'root'),
      'r:trash': { ...makeNode('r:trash', 'r:superRoot', 'trash' as any, 'Trash'), nodeType: 'trash' as any },
      a: makeNode('a', 'r:root', 'folder' as any, 'A'),
    } as any;

    core = {
      getNode: vi.fn(async (id: NodeId) => state[id as unknown as string]),
      updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
        state[node.id as unknown as string] = { ...(state[node.id as unknown as string] as any), ...node } as TreeNode;
      }),
      deleteNode: vi.fn(async (id: NodeId) => {
        delete state[id as unknown as string];
      }),
      createNode: vi.fn(async (node: TreeNode) => {
        state[node.id as unknown as string] = { ...node };
        return node.id;
      }),
      listChildren: vi.fn(async (parentId: NodeId) => Object.values(state).filter((n: any) => n.parentId === parentId)),
      trees: { toArray: vi.fn(async () => [{ rootId: 'r:root' as NodeId, trashRootId: 'r:trash' as NodeId }]) },
    };

    // Minimal PeerStore for 'folder'
    const peer = new Map<string, any>();
    const store: PeerStore<any> = {
      async get(id: NodeId) { return peer.get(id as unknown as string); },
      async put(e: any) { peer.set(e.nodeId as unknown as string, e); },
      async delete(id: NodeId) { peer.delete(id as unknown as string); },
    };
    storeRegistry.registerPeer('folder', store);
  });

  it('moveToTrash keeps PeerEntity; recover keeps PeerEntity', async () => {
    const cp = new CommandProcessor(core);
    // seed peer entity for a
    await (storeRegistry.getPeer('folder') as any).put({ nodeId: 'a' as NodeId, data: { v: 1 }, displayMode: 'standard' });

    // move to trash
    const mt = cp.createEnvelope('moveToTrash', { nodeIds: ['a' as NodeId] } as any);
    const r1 = await cp.processCommand(mt as any);
    expect(r1.success).toBe(true);
    expect((await (storeRegistry.getPeer('folder') as any).get('a' as any))?.data?.v).toBe(1);

    // recover from trash
    const rc = cp.createEnvelope('recoverFromTrash', { nodeIds: ['a' as NodeId] } as any);
    const r2 = await cp.processCommand(rc as any);
    expect(r2.success).toBe(true);
    expect((await (storeRegistry.getPeer('folder') as any).get('a' as any))?.data?.v).toBe(1);
  });

  it('remove (permanent delete) deletes PeerEntity', async () => {
    const cp = new CommandProcessor(core);
    await (storeRegistry.getPeer('folder') as any).put({ nodeId: 'a' as NodeId, data: { v: 1 }, displayMode: 'maximized' });

    const rm = cp.createEnvelope('remove', { nodeIds: ['a' as NodeId] } as any);
    const r = await cp.processCommand(rm as any);
    expect(r.success).toBe(true);
    expect(await (storeRegistry.getPeer('folder') as any).get('a' as any)).toBeUndefined();
  });
});

