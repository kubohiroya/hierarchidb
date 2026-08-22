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

/**
 * Build a folder view URL path.
 * Pattern: /f/:treeId/:pageNodeId/:targetNodeId/folder/:viewMode/:sortMode
 */
export function buildFolderPath(
  treeId: string,
  pageNodeId: string | undefined,
  viewMode: string,
  sortMode: string,
  targetNodeId?: string
): string {
  const target = targetNodeId ?? '-';
  const page = pageNodeId ?? `${treeId}:root`;
  const segments = [
    `/f/${encodeURIComponent(treeId)}/${encodeURIComponent(page)}/${encodeURIComponent(target)}/folder/${encodeURIComponent(viewMode)}`,
  ];
  if (sortMode && sortMode !== 'name') {
    segments.push(sortMode);
  }
  return segments.join('/');
}

export const createNavigationHelpers = (deps: TreeConsoleActionDeps): NavigationHelpers => {
  const { pushPath, treeId, ssot } = deps;

  const resolveViewMode = () => ssot.viewMode || 'list';
  const resolveSortMode = () => ssot.sortMode || 'name';

  const pushToNode = (targetNodeId?: NodeId | null) => {
    if (!pushPath || !treeId) return;
    const vm = resolveViewMode();
    const sm = resolveSortMode();
    const pageId = targetNodeId ? String(targetNodeId) : undefined;
    pushPath(buildFolderPath(treeId, pageId, vm, sm));
  };

  const navigateTo = (targetId: NodeId | null | undefined) => {
    if (!pushPath || !treeId) return;
    const vm = resolveViewMode();
    const sm = resolveSortMode();
    pushPath(buildFolderPath(treeId, targetId ? String(targetId) : undefined, vm, sm));
  };

  return { pushToNode, navigateTo };
};

export const createNavigationActions = (
  deps: TreeConsoleActionDeps,
  helpers?: NavigationHelpers
) => {
  const { pushPath, treeId, pageTreeNode, ssot } = deps;
  const { pushToNode, navigateTo } = helpers ?? createNavigationHelpers(deps);

  const resolveViewMode = () => ssot.viewMode || 'list';
  const resolveSortMode = () => ssot.sortMode || 'name';

  return {
    pushToNode,
    navigateTo,
    handleNodeClick: (node: HierarchicalTreeNode) => {
      const targetId = node.id as NodeId;
      if (pushPath && treeId) {
        const vm = resolveViewMode();
        const sm = resolveSortMode();
        pushPath(buildFolderPath(treeId, String(targetId), vm, sm));
      }
    },

    handleBreadcrumbNavigate: (nodeId: string, node?: BreadcrumbNode) => {
      if (!nodeId || (node && node.isClickable === false)) return;
      if (pushPath && treeId) {
        const vm = resolveViewMode();
        const sm = resolveSortMode();
        pushPath(buildFolderPath(treeId, nodeId, vm, sm));
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
