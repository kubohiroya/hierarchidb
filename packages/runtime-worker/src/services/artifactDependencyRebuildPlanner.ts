import type { BuildDependencyAvailabilitySummary } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type {
  ArtifactDependencyEdgeRecord,
  ArtifactDependencyLifecycleStore,
} from './artifactDependencyLifecycleStore.js';

export type ArtifactDependencyChange = {
  readonly edgeId: string;
  readonly previousStatus: ArtifactDependencyEdgeRecord['status'];
  readonly nextStatus: ArtifactDependencyEdgeRecord['status'];
  readonly artifactId?: string;
  readonly buildTargetId?: NodeId;
  readonly sourceNodeId?: NodeId;
  readonly targetNodeId?: NodeId;
  readonly targetFieldPath?: string;
  readonly rebuildPlanId?: string;
};

export type IncrementalRebuildPlan = {
  readonly planId: string;
  readonly rebuildTargetIds: readonly NodeId[];
  readonly staleEdgeIds: readonly string[];
};

export type PostEditStalePropagationResult = {
  readonly changedTargetFieldPaths: readonly string[];
  readonly staleEdges: readonly ArtifactDependencyEdgeRecord[];
  readonly rebuildPlan?: IncrementalRebuildPlan;
  readonly dependencySummary: BuildDependencyAvailabilitySummary;
  readonly dependencyChanges: readonly ArtifactDependencyChange[];
};

export type MarkPostEditStaleByTargetInput = {
  readonly targetNodeId: NodeId;
  readonly changedTargetFieldPaths: readonly string[];
  readonly now?: number;
};

export type MarkPostEditStaleForCommittedNodeInput = {
  readonly previousNode: TreeNode;
  readonly currentNode: TreeNode;
  readonly now?: number;
};

export class ArtifactDependencyRebuildPlanner {
  constructor(
    private readonly store: ArtifactDependencyLifecycleStore,
    private readonly now: () => number = Date.now
  ) {}

  async markStaleForCommittedNodeEdit(
    input: MarkPostEditStaleForCommittedNodeInput
  ): Promise<PostEditStalePropagationResult> {
    assertSameNode(input.previousNode.id as NodeId, input.currentNode.id as NodeId);
    const changedTargetFieldPaths = collectCommittedNodeChangedFieldPaths(
      input.previousNode,
      input.currentNode
    );
    return await this.markStaleByTarget({
      targetNodeId: input.currentNode.id as NodeId,
      changedTargetFieldPaths,
      now: input.now,
    });
  }

  async markStaleByTarget(
    input: MarkPostEditStaleByTargetInput
  ): Promise<PostEditStalePropagationResult> {
    assertNodeId(input.targetNodeId, 'targetNodeId');
    const changedTargetFieldPaths = normalizeFieldPaths(input.changedTargetFieldPaths);
    const timestamp = input.now ?? this.now();
    assertTimestamp(timestamp, 'now');

    if (changedTargetFieldPaths.length === 0) {
      return emptyPostEditResult();
    }

    const activeEdges = (await this.store.listEdgesForTarget(input.targetNodeId)).filter(
      (edge) => edge.status === 'active'
    );
    const affectedTargetFieldPaths = [
      ...new Set(
        activeEdges
          .filter((edge) =>
            changedTargetFieldPaths.some((changedPath) =>
              isDependencyFieldAffected(edge.targetFieldPath, changedPath)
            )
          )
          .map((edge) => edge.targetFieldPath)
          .sort()
      ),
    ];

    const staleEdges = (
      await Promise.all(
        affectedTargetFieldPaths.map((targetFieldPath) =>
          this.store.markStaleByTarget({
            targetNodeId: input.targetNodeId,
            targetFieldPath,
            now: timestamp,
          })
        )
      )
    )
      .flat()
      .sort(compareEdgesById);

    return createPostEditResult(changedTargetFieldPaths, staleEdges);
  }
}

export const collectCommittedNodeChangedFieldPaths = (
  previousNode: TreeNode,
  currentNode: TreeNode
): string[] => {
  assertSameNode(previousNode.id as NodeId, currentNode.id as NodeId);
  return [
    ...collectChangedFieldPaths('metadata', previousNode.metadata, currentNode.metadata),
    ...collectChangedFieldPaths('data', previousNode.data, currentNode.data),
  ].sort();
};

const createPostEditResult = (
  changedTargetFieldPaths: readonly string[],
  staleEdges: readonly ArtifactDependencyEdgeRecord[]
): PostEditStalePropagationResult => {
  staleEdges.forEach(assertStaleEdgeHasRebuildTarget);
  const rebuildTargetIds = [...new Set(staleEdges.map((edge) => edge.buildTargetNodeId))].sort();
  const staleEdgeIds = staleEdges.map((edge) => edge.edgeId).sort();
  const rebuildPlan =
    staleEdges.length === 0
      ? undefined
      : {
          planId: createDeterministicRebuildPlanId(staleEdgeIds),
          rebuildTargetIds,
          staleEdgeIds,
        };
  const dependencyChanges = staleEdges.map((edge) => ({
    edgeId: edge.edgeId,
    previousStatus: 'active' as const,
    nextStatus: edge.status,
    artifactId: edge.artifactId,
    buildTargetId: edge.buildTargetNodeId,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    targetFieldPath: edge.targetFieldPath,
    ...(rebuildPlan === undefined ? {} : { rebuildPlanId: rebuildPlan.planId }),
  }));

  return {
    changedTargetFieldPaths,
    staleEdges,
    ...(rebuildPlan === undefined ? {} : { rebuildPlan }),
    dependencySummary: createDependencySummary(staleEdges),
    dependencyChanges,
  };
};

const createDependencySummary = (
  staleEdges: readonly ArtifactDependencyEdgeRecord[]
): BuildDependencyAvailabilitySummary => {
  if (staleEdges.length === 0) {
    return {
      edgeCounts: {},
      rebuildRequiredTargetIds: [],
      rebuildingTargetIds: [],
    };
  }
  return {
    edgeCounts: {
      stale: staleEdges.length,
    },
    rebuildRequiredTargetIds: [...new Set(staleEdges.map((edge) => edge.buildTargetNodeId))].sort(),
    rebuildingTargetIds: [],
  };
};

const emptyPostEditResult = (): PostEditStalePropagationResult => ({
  changedTargetFieldPaths: [],
  staleEdges: [],
  dependencySummary: {
    edgeCounts: {},
    rebuildRequiredTargetIds: [],
    rebuildingTargetIds: [],
  },
  dependencyChanges: [],
});

const collectChangedFieldPaths = (
  prefix: string,
  previousValue: unknown,
  currentValue: unknown
): string[] => {
  assertFieldPath(prefix, 'prefix');
  if (Object.is(previousValue, currentValue)) return [];
  if (Array.isArray(previousValue) || Array.isArray(currentValue)) {
    return areJsonLikeValuesEqual(previousValue, currentValue) ? [] : [prefix];
  }
  if (isPlainRecord(previousValue) && isPlainRecord(currentValue)) {
    const keys = [...new Set([...Object.keys(previousValue), ...Object.keys(currentValue)])].sort();
    return keys.flatMap((key) =>
      collectChangedFieldPaths(`${prefix}.${key}`, previousValue[key], currentValue[key])
    );
  }
  return [prefix];
};

const isDependencyFieldAffected = (targetFieldPath: string, changedFieldPath: string): boolean => {
  assertFieldPath(targetFieldPath, 'targetFieldPath');
  assertFieldPath(changedFieldPath, 'changedFieldPath');
  return (
    targetFieldPath === changedFieldPath ||
    targetFieldPath.startsWith(`${changedFieldPath}.`) ||
    changedFieldPath.startsWith(`${targetFieldPath}.`)
  );
};

const normalizeFieldPaths = (fieldPaths: readonly string[]): string[] => {
  const normalized = fieldPaths.map((fieldPath, index) =>
    normalizeFieldPath(fieldPath, `changedTargetFieldPaths[${index}]`)
  );
  return [...new Set(normalized)].sort();
};

const normalizeFieldPath = (fieldPath: string, path: string): string => {
  assertFieldPath(fieldPath, path);
  return fieldPath.trim();
};

const isPlainRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const areJsonLikeValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => areJsonLikeValuesEqual(value, right[index]));
  }
  if (isPlainRecord(left) || isPlainRecord(right)) {
    if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    return keys.every((key) => areJsonLikeValuesEqual(left[key], right[key]));
  }
  return false;
};

const compareEdgesById = (
  left: ArtifactDependencyEdgeRecord,
  right: ArtifactDependencyEdgeRecord
) => left.edgeId.localeCompare(right.edgeId);

const createDeterministicRebuildPlanId = (staleEdgeIds: readonly string[]): string => {
  if (staleEdgeIds.length === 0) {
    throw new Error('staleEdgeIds must include at least one edge id.');
  }
  staleEdgeIds.forEach((edgeId, index) => {
    assertNonEmptyString(edgeId, `staleEdgeIds[${index}]`);
  });
  return `rebuild-plan:${staleEdgeIds.join('+')}`;
};

const assertStaleEdgeHasRebuildTarget = (edge: ArtifactDependencyEdgeRecord): void => {
  assertNonEmptyString(edge.edgeId, 'edge.edgeId');
  assertNodeId(edge.buildTargetNodeId, 'edge.buildTargetNodeId');
  assertNodeId(edge.targetNodeId, 'edge.targetNodeId');
  assertFieldPath(edge.targetFieldPath, 'edge.targetFieldPath');
  if (edge.status !== 'stale') {
    throw new Error(`edge ${edge.edgeId} must be stale before creating a rebuild plan.`);
  }
};

const assertSameNode = (previousNodeId: NodeId, currentNodeId: NodeId): void => {
  assertNodeId(previousNodeId, 'previousNode.id');
  assertNodeId(currentNodeId, 'currentNode.id');
  if (previousNodeId !== currentNodeId) {
    throw new Error('previousNode.id and currentNode.id must match.');
  }
};

const assertFieldPath = (fieldPath: string, path: string): void => {
  assertNonEmptyString(fieldPath, path);
  if (fieldPath.includes('..')) {
    throw new Error(`${path} must not contain parent traversal.`);
  }
};

const assertNodeId = (nodeId: NodeId, path: string): void => {
  assertNonEmptyString(nodeId, path);
};

const assertTimestamp = (value: number, path: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`${path} must be a finite timestamp.`);
  }
};

const assertNonEmptyString = (value: string, path: string): void => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path} must be a non-empty string.`);
  }
};
