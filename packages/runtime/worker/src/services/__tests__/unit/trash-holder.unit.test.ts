import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../../CommandProcessor.js';
import type { CoreDB } from '../../CoreDB.js';
// fulltext tables removed; test uses core stub only

type TreeNodeState = Record<string, TreeNode>;

interface CoreStubBase {
  state: TreeNodeState;
  getNode: (id: NodeId) => Promise<TreeNode | undefined>;
  updateNode: (node: Partial<TreeNode> & { id: NodeId }) => Promise<void>;
  deleteNode: (id: NodeId) => Promise<void>;
  createNode: (node: TreeNode) => Promise<NodeId>;
  listChildren: (parentId: NodeId) => Promise<TreeNode[]>;
  trees: { toArray: () => Promise<Array<{ rootId: NodeId; trashRootId: NodeId }>> };
}

type CoreStub = CoreStubBase;

describe('Trash direct trash storage flow', () => {
  let core: CoreStub;
  let state: TreeNodeState;
  const now = Date.now();
  const makeNode = (
    id: string,
    parentId: string,
    name: string,
    nodeType: NodeType = 'folder' as NodeType
  ): TreeNode => ({
    id: id as NodeId,
    parentId: parentId as NodeId,
    nodeType,
    name,
    data: {},
    draftData: null,
    depth: 1,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  beforeEach(async () => {
    state = {};
    state['r:superRoot'] = makeNode('r:superRoot', 'r:superRoot', 'super');
    state['r:root'] = makeNode('r:root', 'r:superRoot', 'root');
    state['r:trash'] = makeNode('r:trash', 'r:superRoot', 'Trash', 'trash' as NodeType);
    state.a = makeNode('a', 'r:root', 'A');
    state.a.depth = 1;
    state.b = makeNode('b', 'a', 'B');
    state.b.depth = 2;
    state.c = makeNode('c', 'b', 'C');
    state.c.depth = 3;
    state.d = makeNode('d', 'b', 'D');
    state.d.depth = 3;

    const baseCore: CoreStubBase = {
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
        Object.values(state).filter((node) => node.parentId === parentId)
      ),
      trees: {
        toArray: vi.fn(async () => [
          { rootId: 'r:root' as NodeId, trashRootId: 'r:trash' as NodeId },
        ]),
      },
    };

    core = baseCore as CoreStub;
  });

  afterEach(async () => {
    // nothing to destroy; no fulltext DB
  });

  const findTrashHolderByTarget = (target: NodeId): TreeNode | undefined =>
    Object.values(state).find((node) => {
      const meta = node as {
        holderType?: TreeNode['holderType'];
        holderTargetId?: NodeId;
      };
      if (node.id === ('r:trash' as NodeId)) {
        return false;
      }
      return (
        node.nodeType === ('trash' as NodeType) &&
        meta.holderType === 'trash' &&
        meta.holderTargetId === target
      );
    });

  it('moveToTrash moves node under trash root with metadata; restore restores original values', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    // move a to trash
    const mt = cp.createEnvelope('moveToTrash', { nodeIds: ['a' as NodeId] });
    const r1 = await cp.processCommand(mt);
    expect(r1.success).toBe(true);
    const nodeA = state.a;
    if (!nodeA) throw new Error('Node a missing after moveToTrash');
    const holderForA = findTrashHolderByTarget('a' as NodeId);
    expect(holderForA).toBeUndefined();
    expect(nodeA.parentId).toBe('r:trash');
    expect(nodeA.name).not.toBe('A');
    expect(typeof nodeA.name).toBe('string');
    expect(nodeA.originalName).toBe('A');
    expect(nodeA.originalParentId).toBe('r:root');
    expect(typeof nodeA.removedAt).toBe('number');
    expect(nodeA.holderType).toBe('trash');
    expect(nodeA.holderTargetId).toBe('a');
    expect(nodeA.holderMetaParentId).toBe('r:root');
    const trashChildren = Object.values(state).filter(
      (node) => node.parentId === ('r:trash' as NodeId)
    );
    expect(trashChildren.some((node) => node.id === ('a' as NodeId))).toBe(true);
    const extraTrashNodes = Object.values(state).filter(
      (node) => node.nodeType === ('trash' as NodeType) && node.id !== ('r:trash' as NodeId)
    );
    expect(extraTrashNodes).toHaveLength(0);

    // restore a
    const rc = cp.createEnvelope('restoreFromTrash', { nodeIds: ['a' as NodeId] });
    const r2 = await cp.processCommand(rc);
    expect(r2.success).toBe(true);
    // back under root and holder deleted
    const restoredA = state.a;
    if (!restoredA) throw new Error('Node a missing after restoreFromTrash');
    expect(restoredA.parentId).toBe('r:root');
    expect(restoredA.originalName).toBeUndefined();
    expect(restoredA.originalParentId).toBeUndefined();
    expect(restoredA.removedAt).toBeUndefined();
    expect(findTrashHolderByTarget('a' as NodeId)).toBeUndefined();
  });

  it('restores nested descendants back to their original parent when recovering from trash', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);

    const moveGrandchild = cp.createEnvelope('moveToTrash', { nodeIds: ['c' as NodeId] });
    const moveResult = await cp.processCommand(moveGrandchild);
    expect(moveResult.success).toBe(true);

    const nodeCInTrash = state.c;
    expect(nodeCInTrash).toBeDefined();
    const holderForC = findTrashHolderByTarget('c' as NodeId);
    expect(holderForC).toBeUndefined();
    expect(nodeCInTrash?.parentId).toBe('r:trash');
    expect(nodeCInTrash?.originalParentId).toBe('b');
    expect(nodeCInTrash?.originalName).toBe('C');
    expect(nodeCInTrash?.name).not.toBe('C');
    expect(nodeCInTrash?.holderType).toBe('trash');
    expect(nodeCInTrash?.holderMetaParentId).toBe('b');

    const restoreGrandchild = cp.createEnvelope('restoreFromTrash', { nodeIds: ['c' as NodeId] });
    const restoreResult = await cp.processCommand(restoreGrandchild);
    expect(restoreResult.success).toBe(true);

    const restoredC = state.c;
    expect(restoredC).toBeDefined();
    expect(restoredC?.parentId).toBe('b');

    const parentNode = state.b;
    expect(parentNode).toBeDefined();
    expect(parentNode?.parentId).toBe('a');
    expect(findTrashHolderByTarget('c' as NodeId)).toBeUndefined();
  });

  it('allows restoring a subset of nodes when multiple were trashed together', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);

    const moveBatch = cp.createEnvelope('moveToTrash', { nodeIds: ['c' as NodeId, 'd' as NodeId] });
    const moveBatchResult = await cp.processCommand(moveBatch);
    expect(moveBatchResult.success).toBe(true);

    const holderForC = findTrashHolderByTarget('c' as NodeId);
    const holderForD = findTrashHolderByTarget('d' as NodeId);
    expect(holderForC).toBeUndefined();
    expect(holderForD).toBeUndefined();
    expect(state.c?.parentId).toBe('r:trash');
    expect(state.c?.name).not.toBe('C');
    expect(state.c?.originalName).toBe('C');
    expect(state.d?.parentId).toBe('r:trash');
    expect(state.d?.name).not.toBe('D');
    expect(state.d?.originalName).toBe('D');

    const restoreOne = cp.createEnvelope('restoreFromTrash', { nodeIds: ['c' as NodeId] });
    const restoreOneResult = await cp.processCommand(restoreOne);
    expect(restoreOneResult.success).toBe(true);

    expect(state.c?.parentId).toBe('b');
    const remainingHolderForD = findTrashHolderByTarget('d' as NodeId);
    expect(remainingHolderForD).toBeUndefined();
    expect(state.d?.parentId).toBe('r:trash');
    expect(state.d?.holderType).toBe('trash');
  });
});
