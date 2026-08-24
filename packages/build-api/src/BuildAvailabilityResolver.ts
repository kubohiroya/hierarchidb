import type { NodeId, NodeType } from '@hierarchidb/core-types';

export type BuildAvailabilityStatus =
  | 'not-buildable'
  | 'build-not-required'
  | 'build-required'
  | 'build-blocked-by-active-session';

export type BuildAvailabilityReason =
  | 'no-build-candidate'
  | 'no-build-required-target'
  | 'build-required-target'
  | 'active-build-session'
  | 'stale-artifact'
  | 'dependency-rebuilding'
  | 'plugin-prerequisite-failed'
  | 'dependency-error'
  | 'orphaned-dependency-edge'
  | 'schema-error'
  | 'unsupported-plugin-participant';

export type DependencyEdgeStatus = 'active' | 'stale' | 'rebuilding' | 'resolved' | 'orphaned';

export type BuildAvailabilityDetailKind =
  | 'metadata-build-required'
  | 'stale-artifact'
  | 'dependency-rebuilding'
  | 'active-build-session'
  | 'no-build-candidate'
  | 'no-build-required-target'
  | 'plugin-prerequisite-failed'
  | 'dependency-error'
  | 'orphaned-dependency-edge'
  | 'schema-error'
  | 'unsupported-plugin-participant';

export type BuildAvailabilityDetailSeverity = 'info' | 'warning' | 'error';

export type BuildAvailabilityDiagnostic = {
  code: string;
  message: string;
  nodeId?: NodeId;
  targetNodeId?: NodeId;
  artifactId?: string;
  fieldPath?: string;
  pluginId?: string;
};

export type DependencyEdgeStatusCounts = Partial<Record<DependencyEdgeStatus, number>>;

export type BuildDependencyAvailabilitySummary = {
  edgeCounts?: DependencyEdgeStatusCounts;
  rebuildRequiredTargetIds?: readonly NodeId[];
  rebuildingTargetIds?: readonly NodeId[];
  dependencyErrors?: readonly BuildAvailabilityDiagnostic[];
  schemaErrors?: readonly BuildAvailabilityDiagnostic[];
  unsupportedPluginParticipants?: readonly BuildAvailabilityDiagnostic[];
};

export type BuildPluginPrerequisiteFailure = BuildAvailabilityDiagnostic;

export type BuildAvailabilityDetail = BuildAvailabilityDiagnostic & {
  kind: BuildAvailabilityDetailKind;
  severity: BuildAvailabilityDetailSeverity;
  status?: DependencyEdgeStatus;
};

export type BuildAvailabilityNode = {
  id: NodeId;
  nodeType: NodeType;
  metadata?: {
    buildMetadata?: {
      buildRequired?: boolean;
    };
  } | null;
  draftMetadata?: {
    buildMetadata?: {
      buildRequired?: boolean;
    };
  } | null;
};

export type ResolveBuildAvailabilityInput<TNode extends BuildAvailabilityNode> = {
  candidates: readonly TNode[];
  activeNodeIds?: ReadonlySet<NodeId>;
  dependencySummary?: BuildDependencyAvailabilitySummary;
  pluginPrerequisiteFailures?: readonly BuildPluginPrerequisiteFailure[];
};

export type BuildAvailability<TNode extends BuildAvailabilityNode = BuildAvailabilityNode> = {
  status: BuildAvailabilityStatus;
  reason: BuildAvailabilityReason;
  canStartBuild: boolean;
  candidates: readonly TNode[];
  requiredTargets: readonly TNode[];
  blockedTargets: readonly TNode[];
  details: readonly BuildAvailabilityDetail[];
};

export type ResolveSubtreeBuildAvailabilityInput<TNode extends BuildAvailabilityNode> = {
  root: TNode;
  descendants: readonly TNode[];
  canBuildNodeType(nodeType: NodeType): boolean;
  activeNodeIds?: ReadonlySet<NodeId>;
  dependencySummary?: BuildDependencyAvailabilitySummary;
  pluginPrerequisiteFailures?: readonly BuildPluginPrerequisiteFailure[];
};

export const isNodeBuildRequired = (node: BuildAvailabilityNode): boolean =>
  Boolean(node.draftMetadata?.buildMetadata?.buildRequired) ||
  Boolean(node.metadata?.buildMetadata?.buildRequired);

const dependencyEdgeStatuses: readonly DependencyEdgeStatus[] = [
  'active',
  'stale',
  'rebuilding',
  'resolved',
  'orphaned',
];

const assertNonNegativeInteger = (value: number, path: string): void => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${path} must be a non-negative integer.`);
  }
};

const assertDiagnostic = (diagnostic: BuildAvailabilityDiagnostic, path: string): void => {
  if (typeof diagnostic.code !== 'string') {
    throw new Error(`${path}.code must be a string.`);
  }
  if (diagnostic.code.trim() === '') {
    throw new Error(`${path}.code must be a non-empty string.`);
  }
  if (typeof diagnostic.message !== 'string') {
    throw new Error(`${path}.message must be a string.`);
  }
  if (diagnostic.message.trim() === '') {
    throw new Error(`${path}.message must be a non-empty string.`);
  }
};

const dependencyStatusCount = (
  dependencySummary: BuildDependencyAvailabilitySummary | undefined,
  status: DependencyEdgeStatus
): number => dependencySummary?.edgeCounts?.[status] ?? 0;

const assertDependencySummary = (
  dependencySummary: BuildDependencyAvailabilitySummary | undefined
): void => {
  if (dependencySummary === undefined) return;

  for (const status of dependencyEdgeStatuses) {
    const count = dependencySummary.edgeCounts?.[status];
    if (count !== undefined) {
      assertNonNegativeInteger(count, `dependencySummary.edgeCounts.${status}`);
    }
  }

  dependencySummary.dependencyErrors?.forEach((diagnostic, index) => {
    assertDiagnostic(diagnostic, `dependencySummary.dependencyErrors[${index}]`);
  });
  dependencySummary.schemaErrors?.forEach((diagnostic, index) => {
    assertDiagnostic(diagnostic, `dependencySummary.schemaErrors[${index}]`);
  });
  dependencySummary.unsupportedPluginParticipants?.forEach((diagnostic, index) => {
    assertDiagnostic(diagnostic, `dependencySummary.unsupportedPluginParticipants[${index}]`);
  });

  if (
    dependencyStatusCount(dependencySummary, 'stale') > 0 &&
    (dependencySummary.rebuildRequiredTargetIds?.length ?? 0) === 0
  ) {
    throw new Error(
      'dependencySummary.rebuildRequiredTargetIds must include at least one target when stale edges are reported.'
    );
  }
  if (
    (dependencySummary.rebuildRequiredTargetIds?.length ?? 0) > 0 &&
    dependencyStatusCount(dependencySummary, 'stale') === 0
  ) {
    throw new Error(
      'dependencySummary.edgeCounts.stale must be greater than zero when rebuildRequiredTargetIds are reported.'
    );
  }
  if (
    dependencyStatusCount(dependencySummary, 'rebuilding') > 0 &&
    (dependencySummary.rebuildingTargetIds?.length ?? 0) === 0
  ) {
    throw new Error(
      'dependencySummary.rebuildingTargetIds must include at least one target when rebuilding edges are reported.'
    );
  }
  if (
    (dependencySummary.rebuildingTargetIds?.length ?? 0) > 0 &&
    dependencyStatusCount(dependencySummary, 'rebuilding') === 0
  ) {
    throw new Error(
      'dependencySummary.edgeCounts.rebuilding must be greater than zero when rebuildingTargetIds are reported.'
    );
  }
};

const assertPluginPrerequisiteFailures = (
  pluginPrerequisiteFailures: readonly BuildPluginPrerequisiteFailure[] | undefined
): void => {
  pluginPrerequisiteFailures?.forEach((failure, index) => {
    assertDiagnostic(failure, `pluginPrerequisiteFailures[${index}]`);
  });
};

const requireCandidateById = <TNode extends BuildAvailabilityNode>(
  candidatesById: ReadonlyMap<NodeId, TNode>,
  targetId: NodeId,
  path: string
): TNode => {
  const candidate = candidatesById.get(targetId);
  if (candidate === undefined) {
    throw new Error(`${path} contains a node id that is not in candidates: ${targetId}`);
  }
  return candidate;
};

const pushDiagnosticDetails = (
  details: BuildAvailabilityDetail[],
  kind: BuildAvailabilityDetailKind,
  severity: BuildAvailabilityDetailSeverity,
  diagnostics: readonly BuildAvailabilityDiagnostic[] | undefined
): void => {
  diagnostics?.forEach((diagnostic) => {
    details.push({ ...diagnostic, kind, severity });
  });
};

const buildNotBuildableDetails = (
  dependencySummary: BuildDependencyAvailabilitySummary | undefined,
  pluginPrerequisiteFailures: readonly BuildPluginPrerequisiteFailure[] | undefined
): BuildAvailabilityDetail[] => {
  const details: BuildAvailabilityDetail[] = [];
  pushDiagnosticDetails(details, 'plugin-prerequisite-failed', 'error', pluginPrerequisiteFailures);
  pushDiagnosticDetails(details, 'dependency-error', 'error', dependencySummary?.dependencyErrors);
  if (dependencyStatusCount(dependencySummary, 'orphaned') > 0) {
    details.push({
      kind: 'orphaned-dependency-edge',
      severity: 'error',
      status: 'orphaned',
      code: 'ORPHANED_DEPENDENCY_EDGE',
      message: 'One or more dependency edges are orphaned and require diagnostics.',
    });
  }
  pushDiagnosticDetails(details, 'schema-error', 'error', dependencySummary?.schemaErrors);
  pushDiagnosticDetails(
    details,
    'unsupported-plugin-participant',
    'error',
    dependencySummary?.unsupportedPluginParticipants
  );
  return details;
};

const toReason = (kind: BuildAvailabilityDetailKind): BuildAvailabilityReason => {
  switch (kind) {
    case 'metadata-build-required':
      return 'build-required-target';
    case 'no-build-candidate':
    case 'no-build-required-target':
    case 'stale-artifact':
    case 'dependency-rebuilding':
    case 'active-build-session':
    case 'plugin-prerequisite-failed':
    case 'dependency-error':
    case 'orphaned-dependency-edge':
    case 'schema-error':
    case 'unsupported-plugin-participant':
      return kind;
  }
};

export const resolveBuildAvailability = <TNode extends BuildAvailabilityNode>({
  candidates,
  activeNodeIds,
  dependencySummary,
  pluginPrerequisiteFailures,
}: ResolveBuildAvailabilityInput<TNode>): BuildAvailability<TNode> => {
  assertDependencySummary(dependencySummary);
  assertPluginPrerequisiteFailures(pluginPrerequisiteFailures);

  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const notBuildableDetails = buildNotBuildableDetails(
    dependencySummary,
    pluginPrerequisiteFailures
  );

  const firstNotBuildableDetail = notBuildableDetails[0];
  if (firstNotBuildableDetail !== undefined) {
    return {
      status: 'not-buildable',
      reason: toReason(firstNotBuildableDetail.kind),
      canStartBuild: false,
      candidates,
      requiredTargets: [],
      blockedTargets: [],
      details: notBuildableDetails,
    };
  }

  if (candidates.length === 0) {
    return {
      status: 'not-buildable',
      reason: 'no-build-candidate',
      canStartBuild: false,
      candidates,
      requiredTargets: [],
      blockedTargets: [],
      details: [
        {
          kind: 'no-build-candidate',
          severity: 'error',
          code: 'NO_BUILD_CANDIDATE',
          message: 'No candidate node exposes a canonical build API.',
        },
      ],
    };
  }

  const requiredTargetIds = new Set<NodeId>();
  const details: BuildAvailabilityDetail[] = [];

  for (const candidate of candidates) {
    if (!isNodeBuildRequired(candidate)) continue;
    requiredTargetIds.add(candidate.id);
    details.push({
      kind: 'metadata-build-required',
      severity: 'info',
      code: 'BUILD_REQUIRED_METADATA',
      message: 'The node metadata marks this build target as requiring a build.',
      nodeId: candidate.id,
    });
  }

  dependencySummary?.rebuildRequiredTargetIds?.forEach((targetId, index) => {
    const target = requireCandidateById(
      candidatesById,
      targetId,
      `dependencySummary.rebuildRequiredTargetIds[${index}]`
    );
    requiredTargetIds.add(target.id);
    details.push({
      kind: 'stale-artifact',
      severity: 'warning',
      status: 'stale',
      code: 'STALE_ARTIFACT_REBUILD_REQUIRED',
      message: 'A stale artifact dependency edge requires this build target to be rebuilt.',
      nodeId: target.id,
    });
  });

  dependencySummary?.rebuildingTargetIds?.forEach((targetId, index) => {
    const target = requireCandidateById(
      candidatesById,
      targetId,
      `dependencySummary.rebuildingTargetIds[${index}]`
    );
    requiredTargetIds.add(target.id);
    details.push({
      kind: 'dependency-rebuilding',
      severity: 'info',
      status: 'rebuilding',
      code: 'DEPENDENCY_REBUILDING',
      message: 'A dependency rebuild is already reserved or running for this build target.',
      nodeId: target.id,
    });
  });

  const requiredTargets = candidates.filter((candidate) => requiredTargetIds.has(candidate.id));
  if (requiredTargets.length === 0) {
    return {
      status: 'build-not-required',
      reason: 'no-build-required-target',
      canStartBuild: false,
      candidates,
      requiredTargets,
      blockedTargets: [],
      details: [
        {
          kind: 'no-build-required-target',
          severity: 'info',
          code: 'NO_BUILD_REQUIRED_TARGET',
          message: 'Build candidates exist, but none requires a build.',
        },
      ],
    };
  }

  const blockedTargetIds = new Set<NodeId>();
  if (activeNodeIds !== undefined) {
    requiredTargets.forEach((target) => {
      if (!activeNodeIds.has(target.id)) return;
      blockedTargetIds.add(target.id);
      details.push({
        kind: 'active-build-session',
        severity: 'info',
        code: 'ACTIVE_BUILD_SESSION',
        message: 'A build session is already queued or running for this target.',
        nodeId: target.id,
      });
    });
  }
  dependencySummary?.rebuildingTargetIds?.forEach((targetId) => {
    blockedTargetIds.add(targetId);
  });

  const blockedTargets = requiredTargets.filter((target) => blockedTargetIds.has(target.id));
  if (blockedTargets.length > 0) {
    const hasActiveSession = details.some((detail) => detail.kind === 'active-build-session');
    return {
      status: 'build-blocked-by-active-session',
      reason: hasActiveSession ? 'active-build-session' : 'dependency-rebuilding',
      canStartBuild: false,
      candidates,
      requiredTargets,
      blockedTargets,
      details,
    };
  }

  const hasStaleArtifact = details.some((detail) => detail.kind === 'stale-artifact');
  return {
    status: 'build-required',
    reason: hasStaleArtifact ? 'stale-artifact' : 'build-required-target',
    canStartBuild: true,
    candidates,
    requiredTargets,
    blockedTargets,
    details,
  };
};

export const resolveSubtreeBuildAvailability = <TNode extends BuildAvailabilityNode>({
  root,
  descendants,
  canBuildNodeType,
  activeNodeIds,
  dependencySummary,
  pluginPrerequisiteFailures,
}: ResolveSubtreeBuildAvailabilityInput<TNode>): BuildAvailability<TNode> => {
  const candidates = canBuildNodeType(root.nodeType)
    ? [root]
    : descendants.filter((node) => canBuildNodeType(node.nodeType));
  return resolveBuildAvailability({
    candidates,
    activeNodeIds,
    dependencySummary,
    pluginPrerequisiteFailures,
  });
};
