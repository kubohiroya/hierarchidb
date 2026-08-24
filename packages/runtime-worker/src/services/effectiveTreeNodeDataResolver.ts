import type { NodeId } from '@hierarchidb/core-types';
import type { NodePayload, TreeNode } from '@hierarchidb/tree-api';

export type EffectiveTreeNodeDataSlot = 'committed' | 'draft' | 'effective-staged';

export interface TreeNodeReader {
  getNode(nodeId: NodeId): Promise<TreeNode<NodePayload | null> | undefined>;
}

export type EffectiveTreeNodeDataResolverErrorCode =
  | 'EFFECTIVE_TREE_NODE_DATA_NODE_NOT_FOUND'
  | 'EFFECTIVE_TREE_NODE_DATA_COW_SOURCE_NOT_FOUND'
  | 'EFFECTIVE_TREE_NODE_DATA_COW_CYCLE'
  | 'EFFECTIVE_TREE_NODE_DATA_PATCH_NOT_OBJECT'
  | 'EFFECTIVE_TREE_NODE_DATA_PATCH_WITHOUT_COW'
  | 'EFFECTIVE_TREE_NODE_DATA_DRAFT_NOT_OBJECT';

export class EffectiveTreeNodeDataResolverError extends Error {
  readonly code: EffectiveTreeNodeDataResolverErrorCode;
  readonly nodeId: NodeId;
  readonly sourceNodeId?: NodeId;

  constructor(
    code: EffectiveTreeNodeDataResolverErrorCode,
    message: string,
    context: { nodeId: NodeId; sourceNodeId?: NodeId }
  ) {
    super(message);
    this.name = 'EffectiveTreeNodeDataResolverError';
    this.code = code;
    this.nodeId = context.nodeId;
    this.sourceNodeId = context.sourceNodeId;
  }
}

export interface EffectiveTreeNodeDataResolverInput {
  reader: TreeNodeReader;
  nodeId: NodeId;
  slot: EffectiveTreeNodeDataSlot;
}

export interface EffectiveTreeNodeDataResolverMetadata {
  nodeId: NodeId;
  slot: EffectiveTreeNodeDataSlot;
  sourceNodeIds: NodeId[];
  versions: Array<{ nodeId: NodeId; version: number }>;
  mountedContentApplied: boolean;
}

export interface EffectiveTreeNodeDataResolverResult {
  data: NodePayload | null;
  metadata: EffectiveTreeNodeDataResolverMetadata;
}

interface ResolvedCommittedData {
  data: NodePayload | null;
  sourceNodeIds: NodeId[];
  versions: Array<{ nodeId: NodeId; version: number }>;
}

export async function resolveEffectiveTreeNodeData(
  input: EffectiveTreeNodeDataResolverInput
): Promise<EffectiveTreeNodeDataResolverResult> {
  const node = await readNode(input.reader, input.nodeId);
  const committed = await resolveCommittedData(input.reader, node, new Set<NodeId>());
  const data =
    input.slot === 'draft' && node.draftData !== undefined
      ? mergePayload(
          committed.data,
          assertPayloadObject(node.draftData, 'EFFECTIVE_TREE_NODE_DATA_DRAFT_NOT_OBJECT', node.id)
        )
      : committed.data;

  return {
    data,
    metadata: {
      nodeId: input.nodeId,
      slot: input.slot,
      sourceNodeIds: committed.sourceNodeIds,
      versions: committed.versions,
      mountedContentApplied: false,
    },
  };
}

async function resolveCommittedData(
  reader: TreeNodeReader,
  node: TreeNode<NodePayload | null>,
  visited: Set<NodeId>
): Promise<ResolvedCommittedData> {
  if (visited.has(node.id)) {
    throw new EffectiveTreeNodeDataResolverError(
      'EFFECTIVE_TREE_NODE_DATA_COW_CYCLE',
      `Circular copy-on-write reference detected at node ${node.id}`,
      { nodeId: node.id }
    );
  }

  visited.add(node.id);
  try {
    if (node.copyOnWriteOf !== undefined) {
      const sourceNode = await reader.getNode(node.copyOnWriteOf);
      if (!sourceNode) {
        throw new EffectiveTreeNodeDataResolverError(
          'EFFECTIVE_TREE_NODE_DATA_COW_SOURCE_NOT_FOUND',
          `Copy-on-write source node ${node.copyOnWriteOf} was not found`,
          { nodeId: node.id, sourceNodeId: node.copyOnWriteOf }
        );
      }

      const source = await resolveCommittedData(reader, sourceNode, visited);
      const data =
        node.patchData !== undefined
          ? mergePayload(
              source.data,
              assertPayloadObject(
                node.patchData,
                'EFFECTIVE_TREE_NODE_DATA_PATCH_NOT_OBJECT',
                node.id
              )
            )
          : source.data;

      return {
        data,
        sourceNodeIds: [...source.sourceNodeIds, node.id],
        versions: [...source.versions, { nodeId: node.id, version: node.version }],
      };
    }

    if (node.patchData !== undefined) {
      throw new EffectiveTreeNodeDataResolverError(
        'EFFECTIVE_TREE_NODE_DATA_PATCH_WITHOUT_COW',
        `patchData requires copyOnWriteOf on node ${node.id}`,
        { nodeId: node.id }
      );
    }

    return {
      data: normalizeCommittedData(node.data),
      sourceNodeIds: [node.id],
      versions: [{ nodeId: node.id, version: node.version }],
    };
  } finally {
    visited.delete(node.id);
  }
}

async function readNode(
  reader: TreeNodeReader,
  nodeId: NodeId
): Promise<TreeNode<NodePayload | null>> {
  const node = await reader.getNode(nodeId);
  if (!node) {
    throw new EffectiveTreeNodeDataResolverError(
      'EFFECTIVE_TREE_NODE_DATA_NODE_NOT_FOUND',
      `Node ${nodeId} was not found`,
      { nodeId }
    );
  }
  return node;
}

function normalizeCommittedData(data: NodePayload | null): NodePayload | null {
  if (data === null) {
    return null;
  }
  return assertPayloadObject(data, 'EFFECTIVE_TREE_NODE_DATA_PATCH_NOT_OBJECT', '' as NodeId);
}

function assertPayloadObject(
  value: unknown,
  code: Extract<
    EffectiveTreeNodeDataResolverErrorCode,
    'EFFECTIVE_TREE_NODE_DATA_PATCH_NOT_OBJECT' | 'EFFECTIVE_TREE_NODE_DATA_DRAFT_NOT_OBJECT'
  >,
  nodeId: NodeId
): NodePayload {
  if (!isPlainRecord(value)) {
    throw new EffectiveTreeNodeDataResolverError(code, `${code} at node ${nodeId}`, { nodeId });
  }
  return value;
}

export function strictMergeNodePayload(base: NodePayload | null, patch: NodePayload): NodePayload {
  return mergePayload(base, patch);
}

function mergePayload(base: NodePayload | null, patch: NodePayload): NodePayload {
  if (base === null) {
    return clonePayload(patch);
  }

  const merged: NodePayload = { ...base };
  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = merged[key];
    if (isPlainRecord(baseValue) && isPlainRecord(patchValue)) {
      merged[key] = mergePayload(baseValue, patchValue);
    } else if (isPlainRecord(patchValue)) {
      merged[key] = clonePayload(patchValue);
    } else if (Array.isArray(patchValue)) {
      merged[key] = [...patchValue];
    } else {
      merged[key] = patchValue;
    }
  }
  return merged;
}

function clonePayload(payload: NodePayload): NodePayload {
  const cloned: NodePayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (isPlainRecord(value)) {
      cloned[key] = clonePayload(value);
    } else if (Array.isArray(value)) {
      cloned[key] = [...value];
    } else {
      cloned[key] = value;
    }
  }
  return cloned;
}

function isPlainRecord(value: unknown): value is NodePayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
