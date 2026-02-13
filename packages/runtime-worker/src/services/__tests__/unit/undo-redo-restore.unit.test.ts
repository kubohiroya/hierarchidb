import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeChangeEvent } from '@hierarchidb/tree-api';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { CommandProcessor } from '../../CommandProcessor.js';
import type { CoreDB } from '../../CoreDB.js';

// fulltext tables removed; stub without fulltext support

describe('Undo/Redo for restoreFromArchive', () => {
  type ArchivedNode = TreeNode & {
    removedAt?: number;
    originalParentId?: NodeId;
    originalName?: string;
  };

  type CoreStubBase = Pick<
    CoreDB,
    'getNode' | 'updateNode' | 'listChildren' | 'deleteNode' | 'createNode'
  > & {
    state: Map<NodeId, ArchivedNode>;
    changeSubject: Subject<TreeChangeEvent>;
  };

  type CoreStub = CoreStubBase;

  let core: CoreStub;
  let state: Map<NodeId, ArchivedNode>;
  const makeNode = (id: string, parentId: string, name: string): ArchivedNode => ({
    id: id as NodeId,
    parentId: parentId as NodeId,
    nodeType: 'folder' as NodeType,
    metadata: { name, description: '', tags: [] },
    draftMetadata: null,
    data: {},
    draftData: undefined,
    depth: 1,
    visible: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    removedAt: Date.now(),
    originalParentId: parentId as NodeId,
    originalName: name,
  });

  beforeEach(async () => {
    state = new Map<NodeId, ArchivedNode>();
    state.set('t_trash' as NodeId, makeNode('t_trash', 'r_root', 'Archive'));
    state.set('x' as NodeId, makeNode('x', 't_trash', 'X'));

    const listChildren = async (parentId: NodeId): Promise<TreeNode[]> =>
      Array.from(state.values()).filter((node) => node.parentId === parentId);

    const baseCore: CoreStubBase = {
      state,
      changeSubject: new Subject<TreeChangeEvent>(),
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
        const extended: ArchivedNode = {
          ...node,
          removedAt: undefined,
          originalParentId: node.parentId,
          originalName: node.metadata.name,
        };
        state.set(node.id, extended);
        return node.id;
      }),
    };

    core = baseCore as CoreStub;
  });

  afterEach(async () => {
    // nothing to destroy; no fulltext DB
  });

  it('undo/redo restoreFromArchive', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('restoreFromArchive', {
      nodeIds: ['x' as NodeId],
      toParentId: 'r_root' as NodeId,
    });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
    const restored = state.get('x' as NodeId);
    expect(restored?.parentId).toBe('r_root');
    expect(restored?.removedAt).toBeUndefined();

    // undo -> back to trash atoms
    const u = await cp.undo();
    expect(u.success).toBe(true);
    expect(state.get('x' as NodeId)?.parentId).toBe('t_trash');

    // redo -> restored again
    const re = await cp.redo();
    expect(re.success).toBe(true);
    expect(state.get('x' as NodeId)?.parentId).toBe('r_root');
  });
});
