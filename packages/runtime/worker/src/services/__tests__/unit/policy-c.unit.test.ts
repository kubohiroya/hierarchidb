import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../../CommandProcessor.js';
import type { CoreDB } from '../../CoreDB.js';
import { encodeWorkingCopyHolderName } from '../../utils/holder-encoding.js';

describe('Policy C: block move/remove when WC exists', () => {
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
    depth: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  });

  type CoreStub = Pick<
    CoreDB,
    'getNode' | 'updateNode' | 'deleteNode' | 'createNode' | 'listChildren'
  > & {
    nodes: { toArray: () => Promise<TreeNode[]> };
    state: Map<NodeId, TreeNode>;
  };

  let core: CoreStub;
  let state: Map<NodeId, TreeNode>;

  beforeEach(() => {
    state = new Map<NodeId, TreeNode>();
    state.set('root' as NodeId, makeNode('root', 'super', 'root'));
    state.set('a' as NodeId, makeNode('a', 'root', 'A'));
    state.set(
      'r:workingCopy' as NodeId,
      makeNode('r:workingCopy', 'super', 'workingCopy', 'workingCopy' as NodeType)
    );
    state.set('wcHolder' as NodeId, {
      id: 'wcHolder' as NodeId,
      parentId: 'r:workingCopy' as NodeId,
      nodeType: 'workingCopy' as NodeType,
      name: encodeWorkingCopyHolderName('root' as NodeId, 'a' as NodeId),
      depth: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    state.set('wcChild' as NodeId, makeNode('wcChild', 'wcHolder', 'Draft'));

    const listChildren = async (parentId: NodeId): Promise<TreeNode[]> =>
      Array.from(state.values()).filter((node) => node.parentId === parentId);

    core = {
      state,
      getNode: vi.fn(async (id: NodeId) => state.get(id)),
      updateNode: vi.fn(async (node: Partial<TreeNode> & { id: NodeId }) => {
        const current = state.get(node.id);
        if (!current) throw new Error(`Node ${String(node.id)} not found`);
        state.set(node.id, { ...current, ...node });
      }),
      deleteNode: vi.fn(async (id: NodeId) => {
        state.delete(id);
      }),
      createNode: vi.fn(async (node: TreeNode) => {
        state.set(node.id, { ...node });
        return node.id;
      }),
      listChildren: vi.fn(listChildren),
      nodes: {
        toArray: vi.fn(async () => Array.from(state.values())),
      },
    };
  });

  it('blocks moveNodes when WC under subtree', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('moveNodes', {
      nodeIds: ['a' as NodeId],
      toParentId: 'root' as NodeId,
    });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(false);
  });

  it('blocks remove when WC under subtree', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('remove', { nodeIds: ['a' as NodeId] });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(false);
  });
});
