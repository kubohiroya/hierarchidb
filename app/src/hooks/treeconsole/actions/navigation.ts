/**
 * Navigation helpers and actions for TreeConsole.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import type { TreeConsoleActionDeps } from '~/hooks/treeconsole/types';

export type NavigationHelpers = {
  pushToNode: (targetNodeId?: NodeId | null) => void;
  navigateTo: (targetId: NodeId | null | undefined) => void;
};

export const createNavigationHelpers = (deps: TreeConsoleActionDeps): NavigationHelpers => {
  const { pushPath, searchTerm, treeId } = deps;

  const pushToNode = (targetNodeId?: NodeId | null) => {
    if (!pushPath || !treeId) return;
    const qs = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : '';
    const basePath = `/t/${treeId}`;
    const nextPath = targetNodeId ? `${basePath}/${targetNodeId}${qs}` : `${basePath}${qs}`;
    pushPath(nextPath);
  };

  const navigateTo = (targetId: NodeId | null | undefined) => {
    if (!pushPath || !treeId) return;
    if (!targetId) {
      pushPath(`/t/${treeId}`);
    } else {
      pushPath(`/t/${treeId}/${targetId}`);
    }
  };

  return { pushToNode, navigateTo };
};

export const createNavigationActions = (
  deps: TreeConsoleActionDeps,
  helpers?: NavigationHelpers
) => {
  const { pushPath, treeId, searchTerm, pageTreeNode } = deps;
  const { pushToNode, navigateTo } = helpers ?? createNavigationHelpers(deps);

  return {
    pushToNode,
    navigateTo,
    handleNodeClick: (node: HierarchicalTreeNode) => {
      const targetId = node.id as NodeId;
      if (pushPath && treeId) {
        const isRootLike = pageTreeNode && pageTreeNode.id === targetId;
        const qs = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : '';
        pushPath(isRootLike ? `/t/${treeId}${qs}` : `/t/${treeId}/${targetId}${qs}`);
      }
    },

    handleBreadcrumbNavigate: (nodeId: string, node?: BreadcrumbNode) => {
      if (!nodeId || (node && node.isClickable === false)) return;
      const target = nodeId as NodeId;
      if (!target) return;
      if (pushPath && treeId) {
        const isRootLike = pageTreeNode && pageTreeNode.id === target;
        pushPath(isRootLike ? `/t/${treeId}` : `/t/${treeId}/${target}`);
      }
    },

    handleNavigateBack: () => {
      if (pushPath) pushPath(-1);
    },

    handleNavigateForward: () => {
      if (pushPath) pushPath(1);
    },
  };
};
