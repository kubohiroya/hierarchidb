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
  const { pushPath, searchTerm, treeId, ssot } = deps;

  /** Build query string preserving view/sort params from SSOT. */
  const buildQueryString = (extraParams?: Record<string, string>): string => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    const vm = ssot.viewMode;
    if (vm && vm !== 'list') params.set('view', vm);
    const sm = ssot.sortMode;
    if (sm && sm !== 'none') params.set('sort', sm);
    const zl = ssot.zoomLevel;
    if (typeof zl === 'number' && zl !== 50) params.set('zoom', String(zl));
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) params.set(k, v);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  const pushToNode = (targetNodeId?: NodeId | null) => {
    if (!pushPath || !treeId) return;
    const qs = buildQueryString();
    const basePath = `/t/${treeId}`;
    const nextPath = targetNodeId ? `${basePath}/${targetNodeId}${qs}` : `${basePath}${qs}`;
    pushPath(nextPath);
  };

  const navigateTo = (targetId: NodeId | null | undefined) => {
    if (!pushPath || !treeId) return;
    const qs = buildQueryString();
    if (!targetId) {
      pushPath(`/t/${treeId}${qs}`);
    } else {
      pushPath(`/t/${treeId}/${targetId}${qs}`);
    }
  };

  return { pushToNode, navigateTo };
};

export const createNavigationActions = (
  deps: TreeConsoleActionDeps,
  helpers?: NavigationHelpers
) => {
  const { pushPath, treeId, searchTerm, pageTreeNode, ssot } = deps;
  const { pushToNode, navigateTo } = helpers ?? createNavigationHelpers(deps);

  /** Build query string preserving view/sort params from SSOT. */
  const buildQueryString = (): string => {
    const params = new URLSearchParams();
    if (searchTerm) params.set('q', searchTerm);
    const vm = ssot.viewMode;
    if (vm && vm !== 'list') params.set('view', vm);
    const sm = ssot.sortMode;
    if (sm && sm !== 'none') params.set('sort', sm);
    const zl = ssot.zoomLevel;
    if (typeof zl === 'number' && zl !== 50) params.set('zoom', String(zl));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };

  return {
    pushToNode,
    navigateTo,
    handleNodeClick: (node: HierarchicalTreeNode) => {
      const targetId = node.id as NodeId;
      if (pushPath && treeId) {
        const isRootLike = pageTreeNode && pageTreeNode.id === targetId;
        const qs = buildQueryString();
        pushPath(isRootLike ? `/t/${treeId}${qs}` : `/t/${treeId}/${targetId}${qs}`);
      }
    },

    handleBreadcrumbNavigate: (nodeId: string, node?: BreadcrumbNode) => {
      if (!nodeId || (node && node.isClickable === false)) return;
      const target = nodeId as NodeId;
      if (!target) return;
      if (pushPath && treeId) {
        const isRootLike = pageTreeNode && pageTreeNode.id === target;
        const qs = buildQueryString();
        pushPath(isRootLike ? `/t/${treeId}${qs}` : `/t/${treeId}/${target}${qs}`);
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
