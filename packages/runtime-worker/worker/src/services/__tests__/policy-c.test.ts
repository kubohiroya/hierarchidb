import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../CommandProcessor.js';
import { encodeWorkingCopyHolderName } from '../utils/holder-encoding.js';
import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-type';

describe('Policy C: block move/remove when WC exists', () => {
  const makeNode = (id: string, parentId: string, name: string): TreeNode => ({
    id: id as NodeId,
    parentId: parentId as NodeId,
    nodeType: 'folder' as NodeType,
    name,
    depth: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  });

  let core: any;
  let state: Record<string, any>;

  beforeEach(() => {
    state = {
      root: makeNode('root', 'super', 'root'),
      a: makeNode('a', 'root', 'A'),
      // working copy holder under r:workingCopy, name encodes parentId\tchildId
      'r:workingCopy': makeNode('r:workingCopy', 'super', 'workingCopy') as any,
      wcHolder: {
        id: 'wcHolder' as NodeId,
        parentId: 'r:workingCopy' as NodeId,
        nodeType: 'workingCopy' as NodeType,
        name: encodeWorkingCopyHolderName('root' as NodeId, 'a' as NodeId),
        depth: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      },
      wcChild: makeNode('wcChild', 'wcHolder', 'Draft'),
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
      nodes: { toArray: vi.fn(async () => Object.values(state)) },
    };
  });

   it('blocks moveNodes when WC under subtree', async () => {
    const cp = new CommandProcessor(core);
    const env = cp.createEnvelope('moveNodes', { nodeIds: ['a' as NodeId], toParentId: 'root' as NodeId });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(false);
  });

  it('blocks remove when WC under subtree', async () => {
    const cp = new CommandProcessor(core);
    const env = cp.createEnvelope('remove', { nodeIds: ['a' as NodeId] });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(false);
  });
});
