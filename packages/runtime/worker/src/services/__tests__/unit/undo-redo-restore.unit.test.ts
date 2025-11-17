import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../../CommandProcessor.js';
import type { CoreDB } from '../../CoreDB.js';
import {
  attachFulltextTables,
  createFulltextTestDB,
  destroyFulltextTestDB,
  type FulltextTables,
} from '../../test-helpers/fulltextTestDB.js';

describe('Undo/Redo for restoreFromTrash', () => {
  type TrashedNode = TreeNode & {
    removedAt?: number;
    originalParentId?: NodeId;
    originalName?: string;
  };

  type CoreStubBase = Pick<
    CoreDB,
    'getNode' | 'updateNode' | 'listChildren' | 'deleteNode' | 'createNode'
  > & {
    state: Map<NodeId, TrashedNode>;
  };

  type CoreStub = CoreStubBase & FulltextTables;

  let core: CoreStub;
  let fulltextDb: Awaited<ReturnType<typeof createFulltextTestDB>>;
  let state: Map<NodeId, TrashedNode>;
  const makeNode = (id: string, parentId: string, name: string): TrashedNode => ({
    id: id as NodeId,
    parentId: parentId as NodeId,
    nodeType: 'folder' as NodeType,
    name,
    depth: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    removedAt: Date.now(),
    originalParentId: parentId as NodeId,
    originalName: name,
  });

  beforeEach(async () => {
    fulltextDb = await createFulltextTestDB('undo-redo-restore');
    state = new Map<NodeId, TrashedNode>();
    state.set('t_trash' as NodeId, makeNode('t_trash', 'r_root', 'Trash'));
    state.set('x' as NodeId, makeNode('x', 't_trash', 'X'));

    const listChildren = async (parentId: NodeId): Promise<TreeNode[]> =>
      Array.from(state.values()).filter((node) => node.parentId === parentId);

    const baseCore: CoreStubBase = {
      state,
      getNode: vi.fn(async (id: NodeId) => state.get(id)),
      updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
        const current = state.get(node.id);
        if (!current) throw new Error(`Node ${String(node.id)} not found`);
        state.set(node.id, { ...current, ...node });
      }),
      listChildren: vi.fn(listChildren),
      deleteNode: vi.fn(async (id: NodeId) => {
        state.delete(id);
      }),
      createNode: vi.fn(async (node: TreeNode) => {
        const extended: TrashedNode = {
          ...node,
          removedAt: undefined,
          originalParentId: node.parentId,
          originalName: node.name,
        };
        state.set(node.id, extended);
        return node.id;
      }),
    };

    core = attachFulltextTables(baseCore, fulltextDb);
  });

  afterEach(async () => {
    await destroyFulltextTestDB(fulltextDb);
  });

  it('undo/redo restoreFromTrash', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('restoreFromTrash', {
      nodeIds: ['x' as NodeId],
      toParentId: 'r_root' as NodeId,
    });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    const restored = state.get('x' as NodeId);
    expect(restored?.parentId).toBe('r_root');
    expect(restored?.removedAt).toBeUndefined();

    // undo -> back to trash state
    const u = await cp.undo();
    expect(u.success).toBe(true);
    expect(state.get('x' as NodeId)?.parentId).toBe('t_trash');

    // redo -> restored again
    const re = await cp.redo();
    expect(re.success).toBe(true);
    expect(state.get('x' as NodeId)?.parentId).toBe('r_root');
  });
});
