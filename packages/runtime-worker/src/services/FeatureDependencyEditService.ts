import type {
  BuildDependencyAvailabilitySummary,
  DependencyEdgeStatus,
} from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type {
  ArtifactDependencyEdgeRecord,
  ArtifactDependencyLifecycleStore,
} from './artifactDependencyLifecycleStore.js';
import type {
  ArtifactDependencyRebuildPlanner,
  IncrementalRebuildPlan,
} from './artifactDependencyRebuildPlanner.js';

export type FeatureTableEntityType = 'shape' | 'location' | 'route';

export type FeatureCellDependencyStatus = DependencyEdgeStatus | 'pending-reference' | 'none';

export type FeatureTableEditOrigin =
  | 'preview-table'
  | 'map-feature-popover'
  | 'node-detail-dialog'
  | 'cli-overlay';

export type FeatureCellEditRequest = {
  readonly stagingRootNodeId: string;
  readonly featureNodeId: string;
  readonly entityType: FeatureTableEntityType;
  readonly entityId: string;
  readonly fieldPath: string;
  readonly previousValue: unknown;
  readonly nextValue: unknown;
  readonly dependencyStatus: FeatureCellDependencyStatus;
  readonly editOrigin: FeatureTableEditOrigin;
};

export type FeatureCellEditFailureCategory =
  | 'validation'
  | 'dependency-conflict'
  | 'dependency-diagnostics'
  | 'source-write'
  | 'rebuild-enqueue';

export type FeatureCellEditFailureCode =
  | 'missing-required-field'
  | 'invalid-entity-type'
  | 'invalid-dependency-status'
  | 'invalid-edit-origin'
  | 'rebuilding-dependency'
  | 'orphaned-dependency'
  | 'dependency-status-mismatch'
  | 'source-write-failed'
  | 'rebuild-enqueue-failed';

export type FeatureCellEditFailure = {
  readonly category: FeatureCellEditFailureCategory;
  readonly code: FeatureCellEditFailureCode;
  readonly message: string;
  readonly context: FeatureCellEditFailureContext;
};

export type FeatureCellEditFailureContext = {
  readonly stagingRootNodeId?: string;
  readonly featureNodeId?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly fieldPath?: string;
  readonly dependencyStatus?: string;
  readonly dependencyEdgeIds?: readonly string[];
  readonly rebuildTargetIds?: readonly NodeId[];
};

export type FeatureCellEditWarning = {
  readonly code: 'pending-reference';
  readonly message: string;
  readonly context: FeatureCellEditFailureContext;
};

export type FeatureDependencyEditImpact = {
  readonly dependencyStatus: FeatureCellDependencyStatus;
  readonly affectedDependencyEdgeIds: readonly string[];
  readonly rebuildRequired: boolean;
  readonly rebuildPlan?: IncrementalRebuildPlan;
  readonly dependencySummary: BuildDependencyAvailabilitySummary;
};

export type FeatureCellEditSuccess = {
  readonly ok: true;
  readonly sourceVersion?: string | number;
  readonly refreshHint?: FeatureCellEditRefreshHint;
  readonly impact: FeatureDependencyEditImpact;
  readonly warnings: readonly FeatureCellEditWarning[];
};

export type FeatureCellEditResult =
  | FeatureCellEditSuccess
  | {
      readonly ok: false;
      readonly error: FeatureCellEditFailure;
    };

export type FeatureCellEditRefreshHint = {
  readonly entityId: string;
  readonly fieldPath: string;
  readonly dependencyEdgeIds: readonly string[];
};

export type FeatureCellSourceUpdateResult = {
  readonly sourceVersion?: string | number;
  readonly refreshHint?: FeatureCellEditRefreshHint;
};

export interface FeatureCellSourceUpdater {
  applyFeatureCellEdit(
    request: ValidatedFeatureCellEditRequest
  ): Promise<FeatureCellSourceUpdateResult>;
}

export interface FeatureDependencyRebuildEnqueuer {
  enqueueIncrementalRebuild(plan: IncrementalRebuildPlan): Promise<void>;
}

export type ValidatedFeatureCellEditRequest = FeatureCellEditRequest & {
  readonly stagingRootNodeId: NodeId;
  readonly featureNodeId: NodeId;
};

const dependencyStatuses: readonly FeatureCellDependencyStatus[] = [
  'active',
  'stale',
  'rebuilding',
  'resolved',
  'orphaned',
  'pending-reference',
  'none',
];

const entityTypes: readonly FeatureTableEntityType[] = ['shape', 'location', 'route'];

const editOrigins: readonly FeatureTableEditOrigin[] = [
  'preview-table',
  'map-feature-popover',
  'node-detail-dialog',
  'cli-overlay',
];

export class FeatureDependencyEditService {
  constructor(
    private readonly dependencyStore: ArtifactDependencyLifecycleStore,
    private readonly rebuildPlanner: ArtifactDependencyRebuildPlanner,
    private readonly sourceUpdater: FeatureCellSourceUpdater,
    private readonly rebuildEnqueuer?: FeatureDependencyRebuildEnqueuer
  ) {}

  async applyFeatureCellEdit(request: FeatureCellEditRequest): Promise<FeatureCellEditResult> {
    const validationFailure = validateFeatureCellEditRequest(request);
    if (validationFailure !== null) {
      return { ok: false, error: validationFailure };
    }
    const validatedRequest = request as ValidatedFeatureCellEditRequest;
    const matchingEdges = await this.listMatchingEdges(validatedRequest);
    const impact = createImpact(validatedRequest.dependencyStatus, matchingEdges);
    const blockingFailure = createBlockingFailure(validatedRequest, impact, matchingEdges);
    if (blockingFailure !== null) {
      return { ok: false, error: blockingFailure };
    }

    try {
      const updateResult = await this.sourceUpdater.applyFeatureCellEdit(validatedRequest);
      const finalImpact =
        impact.dependencyStatus === 'active'
          ? await this.markActiveEdgesStale(validatedRequest)
          : impact;
      const enqueueFailure = await this.enqueueRebuildPlan(validatedRequest, finalImpact);
      if (enqueueFailure !== null) return { ok: false, error: enqueueFailure };
      return {
        ok: true,
        ...updateResult,
        impact: finalImpact,
        warnings: createWarnings(validatedRequest, finalImpact),
      };
    } catch (error) {
      return {
        ok: false,
        error: createFailure(
          'source-write',
          'source-write-failed',
          error instanceof Error ? error.message : 'feature cell edit failed.',
          validatedRequest,
          matchingEdges
        ),
      };
    }
  }

  private async listMatchingEdges(
    request: ValidatedFeatureCellEditRequest
  ): Promise<ArtifactDependencyEdgeRecord[]> {
    const edges = await this.dependencyStore.listEdgesForTarget(request.featureNodeId);
    return edges
      .filter((edge) => isDependencyFieldAffected(edge.targetFieldPath, request.fieldPath))
      .sort(compareEdgesById);
  }

  private async markActiveEdgesStale(
    request: ValidatedFeatureCellEditRequest
  ): Promise<FeatureDependencyEditImpact> {
    await this.rebuildPlanner.markStaleByTarget({
      targetNodeId: request.featureNodeId,
      changedTargetFieldPaths: [request.fieldPath],
    });
    return createImpact('stale', await this.listMatchingEdges(request));
  }

  private async enqueueRebuildPlan(
    request: ValidatedFeatureCellEditRequest,
    impact: FeatureDependencyEditImpact
  ): Promise<FeatureCellEditFailure | null> {
    if (impact.rebuildPlan === undefined || this.rebuildEnqueuer === undefined) return null;
    try {
      await this.rebuildEnqueuer.enqueueIncrementalRebuild(impact.rebuildPlan);
      return null;
    } catch (error) {
      return createFailure(
        'rebuild-enqueue',
        'rebuild-enqueue-failed',
        error instanceof Error ? error.message : 'incremental rebuild enqueue failed.',
        request,
        []
      );
    }
  }
}

const validateFeatureCellEditRequest = (
  request: FeatureCellEditRequest
): FeatureCellEditFailure | null => {
  for (const field of ['stagingRootNodeId', 'featureNodeId', 'entityId', 'fieldPath'] as const) {
    const value = request[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return createFailure(
        'validation',
        'missing-required-field',
        `${field} must be a non-empty string.`,
        request
      );
    }
  }
  if (!entityTypes.includes(request.entityType)) {
    return createFailure(
      'validation',
      'invalid-entity-type',
      'entityType is not supported.',
      request
    );
  }
  if (!dependencyStatuses.includes(request.dependencyStatus)) {
    return createFailure(
      'validation',
      'invalid-dependency-status',
      'dependencyStatus is not supported.',
      request
    );
  }
  if (!editOrigins.includes(request.editOrigin)) {
    return createFailure(
      'validation',
      'invalid-edit-origin',
      'editOrigin is not supported.',
      request
    );
  }
  return null;
};

const createBlockingFailure = (
  request: ValidatedFeatureCellEditRequest,
  impact: FeatureDependencyEditImpact,
  matchingEdges: readonly ArtifactDependencyEdgeRecord[]
): FeatureCellEditFailure | null => {
  if (impact.dependencyStatus === 'rebuilding') {
    return createFailure(
      'dependency-conflict',
      'rebuilding-dependency',
      'feature cell edit is blocked while dependent artifact rebuild is active.',
      request,
      matchingEdges
    );
  }
  if (impact.dependencyStatus === 'orphaned') {
    return createFailure(
      'dependency-diagnostics',
      'orphaned-dependency',
      'feature cell edit requires dependency diagnostics before source data can be changed.',
      request,
      matchingEdges
    );
  }
  if (request.dependencyStatus === 'none' && impact.affectedDependencyEdgeIds.length > 0) {
    return createFailure(
      'dependency-diagnostics',
      'dependency-status-mismatch',
      'request dependencyStatus=none conflicts with dependency edges for the feature field.',
      request,
      matchingEdges
    );
  }
  if (
    isDependencyEdgeStatus(request.dependencyStatus) &&
    !matchingEdges.some((edge) => edge.status === request.dependencyStatus)
  ) {
    return createFailure(
      'dependency-diagnostics',
      'dependency-status-mismatch',
      'request dependencyStatus does not match any dependency edge for the feature field.',
      request,
      matchingEdges
    );
  }
  return null;
};

const isDependencyEdgeStatus = (
  status: FeatureCellDependencyStatus
): status is DependencyEdgeStatus =>
  status === 'active' ||
  status === 'stale' ||
  status === 'rebuilding' ||
  status === 'resolved' ||
  status === 'orphaned';

const createImpact = (
  dependencyStatus: FeatureCellDependencyStatus,
  edges: readonly ArtifactDependencyEdgeRecord[],
  rebuildPlan?: IncrementalRebuildPlan
): FeatureDependencyEditImpact => {
  const affectedDependencyEdgeIds = edges.map((edge) => edge.edgeId);
  const staleEdges = edges.filter((edge) => edge.status === 'stale');
  const rebuildingEdges = edges.filter((edge) => edge.status === 'rebuilding');
  const createdRebuildPlan =
    rebuildPlan ??
    createExistingStaleRebuildPlan(
      staleEdges.map((edge) => edge.edgeId),
      staleEdges
    );
  return {
    dependencyStatus,
    affectedDependencyEdgeIds,
    rebuildRequired: staleEdges.length > 0 || dependencyStatus === 'active',
    ...(createdRebuildPlan === undefined ? {} : { rebuildPlan: createdRebuildPlan }),
    dependencySummary: {
      edgeCounts: createEdgeCounts(edges, dependencyStatus),
      rebuildRequiredTargetIds: [
        ...new Set(staleEdges.map((edge) => edge.buildTargetNodeId)),
      ].sort(),
      rebuildingTargetIds: [
        ...new Set(rebuildingEdges.map((edge) => edge.buildTargetNodeId)),
      ].sort(),
    },
  };
};

const createExistingStaleRebuildPlan = (
  staleEdgeIds: readonly string[],
  staleEdges: readonly ArtifactDependencyEdgeRecord[]
): IncrementalRebuildPlan | undefined => {
  if (staleEdgeIds.length === 0) return undefined;
  return {
    planId: `rebuild-plan:${[...staleEdgeIds].sort().join('+')}`,
    rebuildTargetIds: [...new Set(staleEdges.map((edge) => edge.buildTargetNodeId))].sort(),
    staleEdgeIds: [...staleEdgeIds].sort(),
  };
};

const createEdgeCounts = (
  edges: readonly ArtifactDependencyEdgeRecord[],
  dependencyStatus: FeatureCellDependencyStatus
): BuildDependencyAvailabilitySummary['edgeCounts'] => {
  if (edges.length === 0) return {};
  const counts: Record<DependencyEdgeStatus, number> = {
    active: 0,
    stale: 0,
    rebuilding: 0,
    resolved: 0,
    orphaned: 0,
  };
  edges.forEach((edge) => {
    counts[edge.status] += 1;
  });
  if (dependencyStatus === 'active' && counts.active > 0) {
    return { active: counts.active };
  }
  return Object.fromEntries(
    Object.entries(counts).filter(([, count]) => count > 0)
  ) as BuildDependencyAvailabilitySummary['edgeCounts'];
};

const createWarnings = (
  request: ValidatedFeatureCellEditRequest,
  impact: FeatureDependencyEditImpact
): FeatureCellEditWarning[] => {
  if (request.dependencyStatus !== 'pending-reference') return [];
  return [
    {
      code: 'pending-reference',
      message: 'feature cell edit completed while a referenced dependency is pending.',
      context: createFailureContext(
        request,
        impact.affectedDependencyEdgeIds,
        impact.rebuildPlan?.rebuildTargetIds
      ),
    },
  ];
};

const createFailure = (
  category: FeatureCellEditFailureCategory,
  code: FeatureCellEditFailureCode,
  message: string,
  request: Partial<FeatureCellEditRequest>,
  edges: readonly ArtifactDependencyEdgeRecord[] = []
): FeatureCellEditFailure => ({
  category,
  code,
  message,
  context: createFailureContext(
    request,
    edges.map((edge) => edge.edgeId),
    [...new Set(edges.map((edge) => edge.buildTargetNodeId))]
  ),
});

const createFailureContext = (
  request: Partial<FeatureCellEditRequest>,
  dependencyEdgeIds: readonly string[] = [],
  rebuildTargetIds: readonly NodeId[] = []
): FeatureCellEditFailureContext => ({
  ...(typeof request.stagingRootNodeId === 'string'
    ? { stagingRootNodeId: request.stagingRootNodeId }
    : {}),
  ...(typeof request.featureNodeId === 'string' ? { featureNodeId: request.featureNodeId } : {}),
  ...(typeof request.entityType === 'string' ? { entityType: request.entityType } : {}),
  ...(typeof request.entityId === 'string' ? { entityId: request.entityId } : {}),
  ...(typeof request.fieldPath === 'string' ? { fieldPath: request.fieldPath } : {}),
  ...(typeof request.dependencyStatus === 'string'
    ? { dependencyStatus: request.dependencyStatus }
    : {}),
  ...(dependencyEdgeIds.length === 0 ? {} : { dependencyEdgeIds: [...dependencyEdgeIds].sort() }),
  ...(rebuildTargetIds.length === 0 ? {} : { rebuildTargetIds: [...rebuildTargetIds].sort() }),
});

const isDependencyFieldAffected = (targetFieldPath: string, changedFieldPath: string): boolean => {
  assertFieldPath(targetFieldPath, 'targetFieldPath');
  assertFieldPath(changedFieldPath, 'changedFieldPath');
  return (
    targetFieldPath === changedFieldPath ||
    targetFieldPath.startsWith(`${changedFieldPath}.`) ||
    changedFieldPath.startsWith(`${targetFieldPath}.`)
  );
};

const assertFieldPath = (fieldPath: string, path: string): void => {
  if (typeof fieldPath !== 'string' || fieldPath.trim() === '') {
    throw new Error(`${path} must be a non-empty string.`);
  }
  if (fieldPath.includes('..')) {
    throw new Error(`${path} must not contain parent traversal.`);
  }
};

const compareEdgesById = (
  left: ArtifactDependencyEdgeRecord,
  right: ArtifactDependencyEdgeRecord
) => left.edgeId.localeCompare(right.edgeId);
