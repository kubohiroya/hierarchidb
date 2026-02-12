import type { NodeId, NodeType, Timestamp } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandProcessor } from '../../CommandProcessor.js';
import type { CoreDB } from '../../CoreDB.js';

const sessionsGetMock = vi.hoisted(() => vi.fn());
const sessionsOpenMock = vi.hoisted(() => vi.fn(async () => undefined));
const hasRouteReferencesToLocationsMock = vi.hoisted(() => vi.fn(async () => false));
const hasLocationReferencesToShapesMock = vi.hoisted(() => vi.fn(async () => false));

vi.mock('@hierarchidb/gis-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hierarchidb/gis-sdk')>();
  return {
    ...actual,
    ephemeralShapeDB: {
      ...actual.ephemeralShapeDB,
      open: sessionsOpenMock,
      sessions: {
        get: sessionsGetMock,
      },
    },
  };
});

vi.mock('@hierarchidb/route-store', () => ({
  hasRouteReferencesToLocations: hasRouteReferencesToLocationsMock,
}));

vi.mock('@hierarchidb/location-store', () => ({
  hasLocationReferencesToShapes: hasLocationReferencesToShapesMock,
}));

const asNodeId = (value: string): NodeId => value as NodeId;
const asNodeType = (value: string): NodeType => value as NodeType;
const asTimestamp = (value: number): Timestamp => value as Timestamp;

const createNode = (params: {
  id: string;
  parentId: string;
  nodeType: string;
  depth: number;
}): TreeNode => {
  const now = asTimestamp(Date.now());
  return {
    id: asNodeId(params.id),
    parentId: asNodeId(params.parentId),
    nodeType: asNodeType(params.nodeType),
    metadata: { name: params.id, description: undefined, tags: [] },
    draftMetadata: null,
    data: {},
    draftData: undefined,
    depth: params.depth,
    visible: true,
    createdAt: now,
    updatedAt: now,
    version: 1,
  } satisfies TreeNode;
};

const createCoreMock = (nodes: Map<NodeId, TreeNode>) => {
  const getNode = vi.fn(async (id: NodeId) => {
    const node = nodes.get(id);
    return node ? { ...node } : undefined;
  });
  const listChildren = vi.fn(async (parentId: NodeId) =>
    Array.from(nodes.values())
      .filter((node) => node.parentId === parentId)
      .map((node) => ({ ...node }))
  );
  const updateNode = vi.fn(async (node: TreeNode) => {
    const existing = nodes.get(node.id);
    nodes.set(node.id, { ...(existing ?? {}), ...node } as TreeNode);
  });
  return {
    getNode,
    listChildren,
    updateNode,
  } satisfies Partial<CoreDB>;
};

const createCommandProcessorMock = () => ({
  createEnvelope: vi.fn((kind: string, payload: unknown) => ({ kind, payload })),
  processCommand: vi.fn(async () => ({ success: true, seq: 1 })),
});

describe('TreeMutationService moveNodesToTrash running session guard', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sessionsOpenMock.mockResolvedValue(undefined);
    hasRouteReferencesToLocationsMock.mockResolvedValue(false);
    hasLocationReferencesToShapesMock.mockResolvedValue(false);
  });

  it('returns API error when target shape node has a running build session', async () => {
    const nodes = new Map<NodeId, TreeNode>([
      [asNodeId('r:root'), createNode({ id: 'r:root', parentId: 'r:root', nodeType: 'folder', depth: 0 })],
      [asNodeId('shape-1'), createNode({ id: 'shape-1', parentId: 'r:root', nodeType: 'shape', depth: 1 })],
    ]);
    const core = createCoreMock(nodes);
    const processor = createCommandProcessorMock();
    sessionsGetMock.mockResolvedValue({ nodeId: 'shape-1', status: 'running' });

    const { TreeMutationService } = await import('../../TreeMutationService.js');
    const service = new TreeMutationService(
      core as unknown as CoreDB,
      processor as unknown as CommandProcessor
    );

    const result = await service.moveNodesToTrash([asNodeId('shape-1')]);

    expect(result).toEqual({ success: false, error: 'TRASH_BUILD_SESSION_RUNNING' });
    expect(processor.processCommand).not.toHaveBeenCalled();
  });

  it('keeps existing trash flow when running build session does not exist', async () => {
    const nodes = new Map<NodeId, TreeNode>([
      [asNodeId('r:root'), createNode({ id: 'r:root', parentId: 'r:root', nodeType: 'folder', depth: 0 })],
      [asNodeId('shape-1'), createNode({ id: 'shape-1', parentId: 'r:root', nodeType: 'shape', depth: 1 })],
    ]);
    const core = createCoreMock(nodes);
    const processor = createCommandProcessorMock();
    sessionsGetMock.mockResolvedValue({ nodeId: 'shape-1', status: 'completed' });

    const { TreeMutationService } = await import('../../TreeMutationService.js');
    const service = new TreeMutationService(
      core as unknown as CoreDB,
      processor as unknown as CommandProcessor
    );

    const result = await service.moveNodesToTrash([asNodeId('shape-1')]);

    expect(result).toEqual({ success: true });
    expect(processor.processCommand).toHaveBeenCalledTimes(1);
  });
});
