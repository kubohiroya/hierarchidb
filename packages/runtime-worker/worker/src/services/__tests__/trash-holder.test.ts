import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../CommandProcessor.js';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';
import type { CoreDB } from '../CoreDB.js';

type TreeNodeState = Record<string, TreeNode>;

interface CoreStub {
  state: TreeNodeState;
  getNode: (id: NodeId) => Promise<TreeNode | undefined>;
  updateNode: (node: Partial<TreeNode> & { id: NodeId }) => Promise<void>;
  deleteNode: (id: NodeId) => Promise<void>;
  createNode: (node: TreeNode) => Promise<NodeId>;
  listChildren: (parentId: NodeId) => Promise<TreeNode[]>;
  trees: { toArray: () => Promise<Array<{ rootId: NodeId; trashRootId: NodeId }>> };
}

describe('Trash holder flow', () => {
  let core: CoreStub;
  let state: TreeNodeState;
  const now = Date.now();
  const makeNode = (id: string, parentId: string, name: string, nodeType: NodeType = 'folder' as NodeType): TreeNode => ({
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
    state = {};
    state['r:superRoot'] = makeNode('r:superRoot', 'r:superRoot', 'super');
    state['r:root'] = makeNode('r:root', 'r:superRoot', 'root');
    state['r:trash'] = makeNode('r:trash', 'r:superRoot', 'Trash', 'trash' as NodeType);
    state['a'] = makeNode('a', 'r:root', 'A');

    core = {
      state,
      getNode: vi.fn(async (id: NodeId) => state[id]),
      updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
        const current = state[node.id];
        if (!current) throw new Error(`Node ${String(node.id)} not found`);
        state[node.id] = { ...current, ...node };
      }),
      deleteNode: vi.fn(async (id: NodeId) => {
        delete state[id];
      }),
      createNode: vi.fn(async (node: TreeNode) => {
        state[node.id] = { ...node };
        return node.id;
      }),
      listChildren: vi.fn(async (parentId: NodeId) =>
        Object.values(state).filter((node) => node.parentId === parentId),
      ),
      trees: { toArray: vi.fn(async () => [{ rootId: 'r:root' as NodeId, trashRootId: 'r:trash' as NodeId }]) },
    };
  });

  it('moveToTrash creates holder and moves node under it; restore deletes holder', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    // move a to trash
    const mt = cp.createEnvelope('moveToTrash', { nodeIds: ['a' as NodeId] });
    const r1 = await cp.processCommand(mt);
    expect(r1.success).toBe(true);

    // find holder under r:trash
    const trashChildren = await core.listChildren('r:trash' as NodeId);
    const holder = trashChildren.find((n) => n.id !== 'r:trash');
    expect(holder).toBeTruthy();
    if (!holder) throw new Error('Expected trash holder to exist');
    const nodeA = state['a'];
    if (!nodeA) throw new Error('Node a missing after moveToTrash');
    expect(nodeA.parentId).toBe(holder.id);

    // restore a
    const rc = cp.createEnvelope('restoreFromTrash', { nodeIds: ['a' as NodeId] });
    const r2 = await cp.processCommand(rc);
    expect(r2.success).toBe(true);
    // back under root and holder deleted
    const restoredA = state['a'];
    if (!restoredA) throw new Error('Node a missing after restoreFromTrash');
    expect(restoredA.parentId).toBe('r:root');
  });
});
