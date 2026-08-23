import {
  type CanonicalBuildInputEnvelope,
  CanonicalBuildInputError,
  type CanonicalBuildInputSource,
  isCanonicalBuildInputSource,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';

type ResolveCanonicalBuildStartInputArgs = {
  nodeType: NodeType;
  nodeId: NodeId;
  source: CanonicalBuildInputSource;
  treeNode: TreeNode | undefined;
};

const fieldForSource = (source: CanonicalBuildInputSource): 'data' | 'draftData' =>
  source === 'committed' ? 'data' : 'draftData';

const assertPlainPayload = (
  value: unknown,
  source: CanonicalBuildInputSource,
  field: 'data' | 'draftData',
  nodeId: NodeId,
  nodeType: NodeType
): Record<string, unknown> => {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    throw new CanonicalBuildInputError(
      `[worker bootstrap] canonical build ${field} payload must be a plain object for nodeType=${String(nodeType)}, nodeId=${String(nodeId)}`,
      {
        code:
          value === undefined
            ? 'CANONICAL_BUILD_INPUT_MISSING_SLOT'
            : 'CANONICAL_BUILD_INPUT_INCOMPLETE_PAYLOAD',
        field,
        nodeId: String(nodeId),
        nodeType: String(nodeType),
        source,
      }
    );
  }
  return value as Record<string, unknown>;
};

export const resolveCanonicalBuildStartInput = ({
  nodeType,
  nodeId,
  source,
  treeNode,
}: ResolveCanonicalBuildStartInputArgs): CanonicalBuildInputEnvelope => {
  if (!isCanonicalBuildInputSource(source)) {
    throw new CanonicalBuildInputError(
      `[worker bootstrap] unsupported canonical build input source: ${String(source)}`,
      {
        code: 'CANONICAL_BUILD_INPUT_UNSUPPORTED_SOURCE',
        nodeId: String(nodeId),
        nodeType: String(nodeType),
        source: String(source),
      }
    );
  }
  if (!treeNode) {
    throw new CanonicalBuildInputError(
      `[worker bootstrap] tree node is required to start build for nodeType=${String(nodeType)}, nodeId=${String(nodeId)}`,
      {
        code: 'CANONICAL_BUILD_INPUT_MISSING_SLOT',
        field: fieldForSource(source),
        nodeId: String(nodeId),
        nodeType: String(nodeType),
        source,
      }
    );
  }
  if (treeNode.id !== nodeId) {
    throw new CanonicalBuildInputError(
      `[worker bootstrap] canonical build nodeId mismatch: expected=${String(nodeId)}, actual=${String(treeNode.id)}`,
      {
        code: 'CANONICAL_BUILD_INPUT_NODE_ID_MISMATCH',
        nodeId: String(nodeId),
        nodeType: String(nodeType),
        source,
      }
    );
  }
  if (treeNode.nodeType !== nodeType) {
    throw new CanonicalBuildInputError(
      `[worker bootstrap] canonical build nodeType mismatch: expected=${String(nodeType)}, actual=${String(treeNode.nodeType)}`,
      {
        code: 'CANONICAL_BUILD_INPUT_NODE_TYPE_MISMATCH',
        nodeId: String(nodeId),
        nodeType: String(nodeType),
        source,
      }
    );
  }
  if (!Number.isInteger(treeNode.version) || treeNode.version < 0) {
    throw new CanonicalBuildInputError(
      `[worker bootstrap] canonical build tree node revision must be a non-negative integer for nodeType=${String(nodeType)}, nodeId=${String(nodeId)}`,
      {
        code: 'CANONICAL_BUILD_INPUT_INCOMPLETE_PAYLOAD',
        field: 'version',
        nodeId: String(nodeId),
        nodeType: String(nodeType),
        source,
      }
    );
  }

  const field = fieldForSource(source);
  const payload = assertPlainPayload(treeNode[field], source, field, nodeId, nodeType);
  return { source, payload };
};
