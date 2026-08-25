import {
  type BuildDependencyAvailabilitySummary,
  type BuildPluginPrerequisiteFailure,
  resolveBuildAvailability,
  resolveSubtreeBuildAvailability,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import {
  type BuildAvailabilityView,
  formatBuildAvailabilityView,
  isFolderNodeType,
} from '@hierarchidb/ui-treeconsole-breadcrumb';

const buildActionNodeTypes = new Set(['shape', 'route', 'styler']);

export type TreeNodeInfoPanelBuildAvailabilityViewInput = {
  readonly currentNode?: TreeNode;
  readonly folderDescendantNodes?: readonly TreeNode[];
  readonly buildTargetLoading: boolean;
  readonly activeNodeIds?: ReadonlySet<NodeId>;
  readonly dependencySummary?: BuildDependencyAvailabilitySummary;
  readonly pluginPrerequisiteFailures?: readonly BuildPluginPrerequisiteFailure[];
};

export const canBuildInfoPanelNodeType = (nodeType: NodeType | string): boolean =>
  buildActionNodeTypes.has(String(nodeType).trim().toLowerCase());

export const resolveTreeNodeInfoPanelBuildAvailabilityView = ({
  currentNode,
  folderDescendantNodes,
  buildTargetLoading,
  activeNodeIds,
  dependencySummary,
  pluginPrerequisiteFailures,
}: TreeNodeInfoPanelBuildAvailabilityViewInput): BuildAvailabilityView | undefined => {
  if (!currentNode || buildTargetLoading) return undefined;

  if (isFolderNodeType(currentNode.nodeType)) {
    if (folderDescendantNodes === undefined) return undefined;
    return formatBuildAvailabilityView(
      resolveSubtreeBuildAvailability({
        root: currentNode,
        descendants: folderDescendantNodes,
        canBuildNodeType: canBuildInfoPanelNodeType,
        activeNodeIds,
        dependencySummary,
        pluginPrerequisiteFailures,
      })
    );
  }

  if (!canBuildInfoPanelNodeType(currentNode.nodeType)) return undefined;

  return formatBuildAvailabilityView(
    resolveBuildAvailability({
      candidates: [currentNode],
      activeNodeIds,
      dependencySummary,
      pluginPrerequisiteFailures,
    })
  );
};

export const shouldShowTreeNodeInfoPanelBuildButton = ({
  currentNode,
  isBuildable,
  buildAvailabilityView,
}: {
  readonly currentNode?: TreeNode;
  readonly isBuildable: boolean;
  readonly buildAvailabilityView?: BuildAvailabilityView;
}): boolean =>
  Boolean(
    currentNode &&
      currentNode.nodeType !== 'location' &&
      (isBuildable || buildAvailabilityView !== undefined)
  );
