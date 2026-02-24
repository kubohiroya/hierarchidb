import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDB } from '../../CoreDB';
import { CommandProcessor } from '../../CommandProcessor';

const asNodeId = (value: string): NodeId => value as NodeId;
const asNodeType = (value: string): NodeType => value as NodeType;
const asTimestamp = (value: number): Timestamp => value as Timestamp;

const createNode = (id: string, parentId: string, depth: number): TreeNode => {
  const now = asTimestamp(Date.now());
  return {
    id: asNodeId(id),
    parentId: asNodeId(parentId),
    nodeType: asNodeType('folder'),
    metadata: { name: id, description: undefined, tags: [] },
    draftMetadata: null,
    data: {},
    draftData: undefined,
    depth,
    visible: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
  } satisfies TreeNode;
};

const cloneNode = (node: TreeNode): TreeNode => ({ ...node }) satisfies TreeNode;
const cloneOptional = (node: TreeNode | undefined): TreeNode | undefined =>
  node ? cloneNode(node) : undefined;

const createCoreMock = (nodes: Map<NodeId, TreeNode>) => {
  const getNode = vi.fn(async (id: NodeId) => cloneOptional(nodes.get(id)));
  const listChildren = vi.fn(async (parentId: NodeId) =>
    Array.from(nodes.values())
      .filter((node) => node.parentId === parentId)
      .map((node) => cloneNode(node))
  );
  const updateNode = vi.fn(async (node: TreeNode) => {
    const existing = nodes.get(node.id);
    nodes.set(node.id, { ...(existing ?? {}), ...node } as TreeNode);
  });
  const bulkUpdateNodes = vi.fn(async (batch: TreeNode[]) => {
    for (const node of batch) {
      const existing = nodes.get(node.id);
      nodes.set(node.id, { ...(existing ?? {}), ...node } as TreeNode);
    }
  });
  const deleteNode = vi.fn(async (id: NodeId) => {
    nodes.delete(id);
  });
  const bulkDeleteNodes = vi.fn(async (ids: NodeId[]) => {
    for (const id of ids) {
      nodes.delete(id);
    }
  });
  const listDescendants = vi.fn(async () => [] as TreeNode[]);
  return {
    getNode,
    listChildren,
    updateNode,
    bulkUpdateNodes,
    deleteNode,
    bulkDeleteNodes,
    listDescendants,
  } satisfies Partial<CoreDB>;
};

const createProcessorMock = (coreDB: CoreDB): CommandProcessor => {
  const processor = new CommandProcessor(coreDB);
  vi.spyOn(processor, 'processCommand').mockResolvedValue({ success: true, seq: 1 });
  return processor;
};

describe('TreeMutationService command processor routing', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('routes moveNodes via CommandProcessor regardless of env overrides', async () => {
    const nodes = new Map<NodeId, TreeNode>([
      [asNodeId('parentA'), createNode('parentA', 'root', 0)],
      [asNodeId('parentB'), createNode('parentB', 'root', 0)],
      [asNodeId('child-1'), createNode('child-1', 'parentA', 1)],
    ]);
    const core = createCoreMock(nodes) as Partial<CoreDB> as CoreDB;
    const processor = createProcessorMock(core);

    const { TreeMutationService } = await import('../../TreeMutationService');
    const svc = new TreeMutationService(
      core,
      processor
    );

    const outcome = await svc.moveNodes({
      nodeIds: [asNodeId('child-1')],
      toParentId: asNodeId('parentB'),
      onNameConflict: 'auto-rename',
    });

    expect(outcome.success).toBe(true);
    expect(processor.processCommand).toHaveBeenCalledTimes(1);
  });

  it('routes removeNodes via CommandProcessor regardless of env overrides', async () => {
    const nodes = new Map<NodeId, TreeNode>([
      [asNodeId('parentA'), createNode('parentA', 'root', 0)],
      [asNodeId('child-1'), createNode('child-1', 'parentA', 1)],
      [asNodeId('child-2'), createNode('child-2', 'child-1', 2)],
    ]);
    const core = createCoreMock(nodes) as Partial<CoreDB> as CoreDB;
    const processor = createProcessorMock(core);

    const { TreeMutationService } = await import('../../TreeMutationService');
    const svc = new TreeMutationService(
      core,
      processor
    );

    const result = await svc.removeNodes([asNodeId('child-1')]);

    expect(result.success).toBe(true);
    expect(processor.processCommand).toHaveBeenCalledTimes(1);
    expect(core.bulkDeleteNodes).not.toHaveBeenCalled();
  });
});
