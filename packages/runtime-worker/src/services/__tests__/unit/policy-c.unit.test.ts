import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandProcessor } from '../../CommandProcessor.js';
import type { CoreDB } from '../../CoreDB.js';

// fulltext tables removed; stub without fulltext support
const encodeDraftHolderName = (parentId: NodeId, nodeId: NodeId) => `${parentId}::${nodeId}`;

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
    metadata: { name, description: undefined, tags: [] },
    draftMetadata: null,
    data: {},
    draftData: null,
    depth: 1,
    visible: true,
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

  beforeEach(async () => {
    state = new Map<NodeId, TreeNode>();
    state.set('root' as NodeId, makeNode('root', 'super', 'root'));
    state.set('a' as NodeId, makeNode('a', 'root', 'A'));
    state.set('r:draft' as NodeId, makeNode('r:draft', 'super', 'draft', 'draft' as NodeType));
    state.set('wcHolder' as NodeId, {
      id: 'wcHolder' as NodeId,
      parentId: 'r:draft' as NodeId,
      nodeType: 'draft' as NodeType,
      metadata: {
        name: encodeDraftHolderName('root' as NodeId, 'a' as NodeId),
        description: undefined,
        tags: [],
      },
      draftMetadata: null,
      data: {},
      draftData: null,
      depth: 0,
      visible: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
    state.set('wcChild' as NodeId, makeNode('wcChild', 'wcHolder', 'Draft'));

    const listChildren = async (parentId: NodeId): Promise<TreeNode[]> =>
      Array.from(state.values()).filter((node) => node.parentId === parentId);

    const baseCore: CoreStub = {
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

    core = baseCore as CoreStub;
  });

  afterEach(async () => {
    // nothing to destroy; no fulltext DB
  });

  it('blocks moveNodes when WC under subtree', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('moveNodes', {
      nodeIds: ['a' as NodeId],
      toParentId: 'root' as NodeId,
    });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
  });

  it('blocks remove when WC under subtree', async () => {
    const cp = new CommandProcessor(core as unknown as CoreDB);
    const env = cp.createEnvelope('remove', { nodeIds: ['a' as NodeId] });
    const r = await cp.processCommand(env);
    expect(r.success).toBe(true);
  });
});
