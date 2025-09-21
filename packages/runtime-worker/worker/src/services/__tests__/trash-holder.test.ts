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
    state['a'].depth = 1;
    state['b'] = makeNode('b', 'a', 'B');
    state['b'].depth = 2;
    state['c'] = makeNode('c', 'b', 'C');
    state['c'].depth = 3;
    state['d'] = makeNode('d', 'b', 'D');
    state['d'].depth = 3;

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

  it('restores nested descendants back to their original parent when recovering from trash', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);

    const moveGrandchild = cp.createEnvelope('moveToTrash', { nodeIds: ['c' as NodeId] });
    const moveResult = await cp.processCommand(moveGrandchild);
    expect(moveResult.success).toBe(true);

    const trashChildrenAfterMove = await core.listChildren('r:trash' as NodeId);
    const holder = trashChildrenAfterMove.find((node) => node.id !== ('r:trash' as NodeId));
    expect(holder).toBeTruthy();
    if (!holder) throw new Error('Expected trash holder for nested node');

    const nodeCInTrash = state['c'];
    expect(nodeCInTrash).toBeDefined();
    expect(nodeCInTrash?.parentId).toBe(holder.id);

    const restoreGrandchild = cp.createEnvelope('restoreFromTrash', { nodeIds: ['c' as NodeId] });
    const restoreResult = await cp.processCommand(restoreGrandchild);
    expect(restoreResult.success).toBe(true);

    const restoredC = state['c'];
    expect(restoredC).toBeDefined();
    expect(restoredC?.parentId).toBe('b');

    const parentNode = state['b'];
    expect(parentNode).toBeDefined();
    expect(parentNode?.parentId).toBe('a');

    const holderChildrenAfterRestore = await core.listChildren(holder.id as NodeId);
    expect(holderChildrenAfterRestore.some((node) => node.id === 'c')).toBe(false);
  });

  it('allows restoring a subset of nodes when multiple were trashed together', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);

    const moveBatch = cp.createEnvelope('moveToTrash', { nodeIds: ['c' as NodeId, 'd' as NodeId] });
    const moveBatchResult = await cp.processCommand(moveBatch);
    expect(moveBatchResult.success).toBe(true);

    const trashChildren = await core.listChildren('r:trash' as NodeId);
    expect(trashChildren.length).toBeGreaterThanOrEqual(2);

    const holderByTarget = new Map<NodeId, TreeNode>();
    for (const holder of trashChildren) {
      if (holder.holderTargetId) {
        holderByTarget.set(holder.holderTargetId as NodeId, holder);
      }
    }

    const holderForC = holderByTarget.get('c' as NodeId);
    const holderForD = holderByTarget.get('d' as NodeId);
    expect(holderForC).toBeDefined();
    expect(holderForD).toBeDefined();
    if (!holderForC || !holderForD) throw new Error('Expected holders for trashed nodes');

    expect(state['c']?.parentId).toBe(holderForC.id);
    expect(state['d']?.parentId).toBe(holderForD.id);

    const restoreOne = cp.createEnvelope('restoreFromTrash', { nodeIds: ['c' as NodeId] });
    const restoreOneResult = await cp.processCommand(restoreOne);
    expect(restoreOneResult.success).toBe(true);

    expect(state['c']?.parentId).toBe('b');
    expect(state['d']?.parentId).toBe(holderForD.id);

    const holderForDChildren = await core.listChildren(holderForD.id as NodeId);
    expect(holderForDChildren.some((node) => node.id === ('d' as NodeId))).toBe(true);

    const holderForCNode = await core.getNode(holderForC.id as NodeId);
    if (holderForCNode) {
      const holderForCChildren = await core.listChildren(holderForC.id as NodeId);
      expect(holderForCChildren.length).toBe(0);
    }
  });
});
