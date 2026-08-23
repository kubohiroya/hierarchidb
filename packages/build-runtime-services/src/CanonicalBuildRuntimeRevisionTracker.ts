import { CanonicalBuildRuntimeError } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';

export class CanonicalBuildRuntimeRevisionTracker {
  private readonly revisions = new Map<string, number>();

  current(nodeType: NodeType, nodeId: NodeId): number {
    return this.revisions.get(createRevisionKey(nodeType, nodeId)) ?? 0;
  }

  next(nodeType: NodeType, nodeId: NodeId): number {
    const key = createRevisionKey(nodeType, nodeId);
    const nextRevision = (this.revisions.get(key) ?? 0) + 1;
    this.revisions.set(key, nextRevision);
    return nextRevision;
  }

  accept(nodeType: NodeType, nodeId: NodeId, revision: number): number {
    if (!Number.isInteger(revision) || revision < 0) {
      throw new CanonicalBuildRuntimeError(
        `Canonical build runtime revision must be a non-negative integer: ${String(revision)}`,
        {
          code: 'CANONICAL_BUILD_RUNTIME_RECORD_INVALID_REVISION',
          nodeType,
          nodeId,
          field: 'revision',
        }
      );
    }
    const currentRevision = this.current(nodeType, nodeId);
    if (revision < currentRevision) {
      throw new CanonicalBuildRuntimeError(
        `Canonical build runtime revision moved backwards for ${String(nodeType)}:${String(nodeId)}`,
        {
          code: 'CANONICAL_BUILD_RUNTIME_RECORD_INVALID_REVISION',
          nodeType,
          nodeId,
          field: 'revision',
        }
      );
    }
    this.revisions.set(createRevisionKey(nodeType, nodeId), revision);
    return revision;
  }

  clear(nodeType: NodeType, nodeId: NodeId): void {
    this.revisions.delete(createRevisionKey(nodeType, nodeId));
  }
}

const createRevisionKey = (nodeType: NodeType, nodeId: NodeId): string =>
  `${String(nodeType)}:${String(nodeId)}`;
