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
  | 'active-build-session';

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
};

export type BuildAvailability<TNode extends BuildAvailabilityNode = BuildAvailabilityNode> = {
  status: BuildAvailabilityStatus;
  reason: BuildAvailabilityReason;
  canStartBuild: boolean;
  candidates: readonly TNode[];
  requiredTargets: readonly TNode[];
  blockedTargets: readonly TNode[];
};

export type ResolveSubtreeBuildAvailabilityInput<TNode extends BuildAvailabilityNode> = {
  root: TNode;
  descendants: readonly TNode[];
  canBuildNodeType(nodeType: NodeType): boolean;
  activeNodeIds?: ReadonlySet<NodeId>;
};

export const isNodeBuildRequired = (node: BuildAvailabilityNode): boolean =>
  Boolean(node.draftMetadata?.buildMetadata?.buildRequired) ||
  Boolean(node.metadata?.buildMetadata?.buildRequired);

export const resolveBuildAvailability = <TNode extends BuildAvailabilityNode>({
  candidates,
  activeNodeIds,
}: ResolveBuildAvailabilityInput<TNode>): BuildAvailability<TNode> => {
  if (candidates.length === 0) {
    return {
      status: 'not-buildable',
      reason: 'no-build-candidate',
      canStartBuild: false,
      candidates,
      requiredTargets: [],
      blockedTargets: [],
    };
  }

  const requiredTargets = candidates.filter(isNodeBuildRequired);
  if (requiredTargets.length === 0) {
    return {
      status: 'build-not-required',
      reason: 'no-build-required-target',
      canStartBuild: false,
      candidates,
      requiredTargets,
      blockedTargets: [],
    };
  }

  const blockedTargets =
    activeNodeIds === undefined
      ? []
      : requiredTargets.filter((target) => activeNodeIds.has(target.id));
  if (blockedTargets.length > 0) {
    return {
      status: 'build-blocked-by-active-session',
      reason: 'active-build-session',
      canStartBuild: false,
      candidates,
      requiredTargets,
      blockedTargets,
    };
  }

  return {
    status: 'build-required',
    reason: 'build-required-target',
    canStartBuild: true,
    candidates,
    requiredTargets,
    blockedTargets,
  };
};

export const resolveSubtreeBuildAvailability = <TNode extends BuildAvailabilityNode>({
  root,
  descendants,
  canBuildNodeType,
  activeNodeIds,
}: ResolveSubtreeBuildAvailabilityInput<TNode>): BuildAvailability<TNode> => {
  const candidates = canBuildNodeType(root.nodeType)
    ? [root]
    : descendants.filter((node) => canBuildNodeType(node.nodeType));
  return resolveBuildAvailability({
    candidates,
    activeNodeIds,
  });
};
