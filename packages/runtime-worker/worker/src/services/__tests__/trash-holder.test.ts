import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../CommandProcessor.js';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';

describe('Trash holder flow', () => {
  let core: any;
  let state: Record<string, any>;
  const now = Date.now();
  const makeNode = (id: string, parentId: string, name: string): TreeNode => ({
    id: id as NodeId,
    parentId: parentId as NodeId,
    nodeType: 'folder' as NodeType,
    name,
    depth: 1,
    createdAt: now,
    updatedAt: now,
    version: 1,
  });

  beforeEach(() => {
    state = {
      'r:superRoot': makeNode('r:superRoot', 'r:superRoot', 'super'),
      'r:root': makeNode('r:root', 'r:superRoot', 'root'),
      'r:trash': { ...makeNode('r:trash', 'r:superRoot', 'Trash'), nodeType: 'trash' as NodeType },
      a: makeNode('a', 'r:root', 'A'),
    } as any;

    core = {
      getNode: vi.fn(async (id: NodeId) => state[id]),
      updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
        state[node.id] = { ...(state[node.id] as any), ...node } as TreeNode;
      }),
      deleteNode: vi.fn(async (id: NodeId) => {
        delete state[id];
      }),
      createNode: vi.fn(async (node: TreeNode) => {
        state[node.id] = { ...node };
        return node.id;
      }),
      listChildren: vi.fn(async (parentId: NodeId) => Object.values(state).filter((n: any) => n.parentId === parentId)),
      trees: { toArray: vi.fn(async () => [{ rootId: 'r:root' as NodeId, trashRootId: 'r:trash' as NodeId }]) },
    };
  });

  it('moveToTrash creates holder and moves node under it; recover deletes holder', async () => {
    const cp = new CommandProcessor(core);
    // move a to trash
    const mt = cp.createEnvelope('moveToTrash', { nodeIds: ['a' as NodeId] } as any);
    const r1 = await cp.processCommand(mt as any);
    expect(r1.success).toBe(true);

    // find holder under r:trash
    const trashChildren = await core.listChildren('r:trash' as NodeId);
    const holder = trashChildren.find((n: any) => n.id !== 'r:trash');
    expect(holder).toBeTruthy();
    expect(state['a'].parentId).toBe(holder.id);

    // recover a
    const rc = cp.createEnvelope('recoverFromTrash', { nodeIds: ['a' as NodeId] } as any);
    const r2 = await cp.processCommand(rc as any);
    expect(r2.success).toBe(true);
    // back under root and holder deleted
    expect(state['a'].parentId).toBe('r:root');
  });
});
