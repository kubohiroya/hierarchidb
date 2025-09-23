import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import type { CoreDB } from '../CoreDB.js';
import { CommandProcessor } from '../CommandProcessor.js';
import { storeRegistry } from '../../entity/store-registry.js';
import type { PeerEntity, PeerStore } from '../../entity/store.js';

const FOLDER_TYPE = 'folder' as NodeType;
const TRASH_TYPE = 'trash' as NodeType;

type TreeNodeState = Partial<Record<NodeId, TreeNode>>;

interface CoreStub {
  state: TreeNodeState;
  getNode: (id: NodeId) => Promise<TreeNode | undefined>;
  updateNode: (node: Partial<TreeNode> & { id: NodeId }) => Promise<void>;
  deleteNode: (id: NodeId) => Promise<void>;
  createNode: (node: TreeNode) => Promise<NodeId>;
  listChildren: (parentId: NodeId) => Promise<TreeNode[]>;
  trees: { toArray: () => Promise<Array<{ rootId: NodeId; trashRootId: NodeId }>> };
}

type FolderPeerData = { v: number };

describe('PeerEntity delete policy (trash vs permanent vs WC)', () => {
  let core: CoreStub;
  let state: TreeNodeState;
  let folderPeerStore: PeerStore<FolderPeerData>;

  const makeNode = (timestamp: number) =>
    (id: string, parentId: string, nodeType: NodeType, name: string): TreeNode => ({
      id: id as NodeId,
      parentId: parentId as NodeId,
      nodeType,
      name,
      depth: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    });

  beforeEach(() => {
    const now = Date.now();
    const buildNode = makeNode(now);
    state = {};
    state['r:superRoot' as NodeId] = buildNode('r:superRoot', 'r:superRoot', FOLDER_TYPE, 'super');
    state['r:root' as NodeId] = buildNode('r:root', 'r:superRoot', FOLDER_TYPE, 'root');
    state['r:trash' as NodeId] = {
      ...buildNode('r:trash', 'r:superRoot', TRASH_TYPE, 'Trash'),
      nodeType: TRASH_TYPE,
    };
    state['a' as NodeId] = buildNode('a', 'r:root', FOLDER_TYPE, 'A');

    core = {
      state,
      async getNode(id: NodeId) {
        return state[id];
      },
      async updateNode(node: Partial<TreeNode> & { id: NodeId }) {
        const current = state[node.id];
        if (!current) throw new Error(`Node ${String(node.id)} not found`);
        state[node.id] = { ...current, ...node };
      },
      async deleteNode(id: NodeId) {
        delete state[id];
      },
      async createNode(node: TreeNode) {
        state[node.id] = { ...node };
        return node.id;
      },
      async listChildren(parentId: NodeId) {
        return Object.values(state).filter((node): node is TreeNode => Boolean(node && node.parentId === parentId));
      },
      trees: {
        toArray: vi.fn(async () => [{ rootId: 'r:root' as NodeId, trashRootId: 'r:trash' as NodeId }]),
      },
    };

    const entries = new Map<NodeId, PeerEntity<FolderPeerData>>();
    folderPeerStore = {
      async get(id: NodeId) {
        return entries.get(id);
      },
      async put(entity: PeerEntity<FolderPeerData>) {
        entries.set(entity.nodeId, { ...entity });
      },
      async delete(id: NodeId) {
        entries.delete(id);
      },
    };
    storeRegistry.registerPeer<FolderPeerData>(FOLDER_TYPE, folderPeerStore);
  });

  function getFolderPeer(): PeerStore<FolderPeerData> {
    const store = storeRegistry.getPeer<FolderPeerData>(FOLDER_TYPE);
    if (!store) throw new Error('Expected folder peer store to be registered');
    return store;
  }

  it('moveToTrash keeps PeerEntity; restore keeps PeerEntity', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const folderPeer = getFolderPeer();

    await folderPeer.put({ nodeId: 'a' as NodeId, data: { v: 1 }, displayMode: 'normal' });

    const mt = cp.createEnvelope('moveToTrash', { nodeIds: ['a' as NodeId] });
    const r1 = await cp.processCommand(mt);
    expect(r1.success).toBe(true);
    const restoredAfterTrash = await folderPeer.get('a' as NodeId);
    expect(restoredAfterTrash?.data?.v).toBe(1);

    const rc = cp.createEnvelope('restoreFromTrash', { nodeIds: ['a' as NodeId] });
    const r2 = await cp.processCommand(rc);
    expect(r2.success).toBe(true);
    const restoredAfterRecover = await folderPeer.get('a' as NodeId);
    expect(restoredAfterRecover?.data?.v).toBe(1);
  });

  it('remove (permanent delete) deletes PeerEntity', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const folderPeer = getFolderPeer();
    await folderPeer.put({ nodeId: 'a' as NodeId, data: { v: 1 }, displayMode: 'maximize' });

    const rm = cp.createEnvelope('remove', { nodeIds: ['a' as NodeId] });
    const result = await cp.processCommand(rm);
    expect(result.success).toBe(true);
    await expect(folderPeer.get('a' as NodeId)).resolves.toBeUndefined();
  });
});
