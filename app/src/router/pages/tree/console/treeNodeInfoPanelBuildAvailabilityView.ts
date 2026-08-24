import { resolveBuildAvailability, resolveSubtreeBuildAvailability } from '@hierarchidb/build-api';
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
};

export const canBuildInfoPanelNodeType = (nodeType: NodeType | string): boolean =>
  buildActionNodeTypes.has(String(nodeType).trim().toLowerCase());

export const resolveTreeNodeInfoPanelBuildAvailabilityView = ({
  currentNode,
  folderDescendantNodes,
  buildTargetLoading,
  activeNodeIds,
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
      })
    );
  }

  if (!canBuildInfoPanelNodeType(currentNode.nodeType)) return undefined;

  return formatBuildAvailabilityView(
    resolveBuildAvailability({
      candidates: [currentNode],
      activeNodeIds,
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
