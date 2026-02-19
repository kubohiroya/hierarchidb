import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { ResourcesGuidedTour } from '~/router/pages/tree/tour/ResourcesGuidedTour';

type ContextMenuHandler = (
  action: string,
  node: HierarchicalTreeNode,
  options?: {
    navigateToParent?: boolean;
    expandTarget?: boolean;
    source?: 'breadcrumb' | 'treetable' | 'speedDial';
    nextVisible?: boolean;
    openInNewTab?: boolean;
  }
) => void;

export type UseTreeConsoleSpeedDialArgs = {
  treeId?: string;
  pageNodeId?: NodeId;
  pageTreeNode?: TreeNode;
  onContextMenuAction?: ContextMenuHandler;
  canCreate: boolean;
  isDialogRoute: boolean;
  speedDialSuppressed: boolean;
  setSpeedDialSuppressed: (value: boolean) => void;
};

export type UseTreeConsoleSpeedDialResult = {
  guidedTour: JSX.Element | null;
  onContextMenuAction: ContextMenuHandler;
  speedDialContextNode: HierarchicalTreeNode;
  hideSpeedDial: boolean;
  suppressSpeedDial: () => void;
};

export function useTreeConsoleSpeedDial({
  treeId,
  pageNodeId,
  pageTreeNode,
  onContextMenuAction,
  canCreate,
  isDialogRoute,
  speedDialSuppressed,
  setSpeedDialSuppressed,
}: UseTreeConsoleSpeedDialArgs): UseTreeConsoleSpeedDialResult {
  const [tourRun, setTourRun] = useState(false);

  const handleTourFinish = useCallback(() => {
    setTourRun(false);
  }, []);

  useEffect(() => {
    if (isDialogRoute) {
      setSpeedDialSuppressed(true);
    } else {
      setSpeedDialSuppressed(false);
    }
  }, [isDialogRoute, setSpeedDialSuppressed]);

  const guidedTour = useMemo(() => {
    if (treeId === 'r') {
      return createElement(ResourcesGuidedTour, { run: tourRun, onFinish: handleTourFinish });
    }
    return null;
  }, [handleTourFinish, tourRun, treeId]);

  const rawContextAction = useMemo(
    () => onContextMenuAction ?? (() => {}),
    [onContextMenuAction]
  );

  const resolvedContextAction = useCallback<ContextMenuHandler>(
    (action, node, options) => {
      if (action?.startsWith('create:')) {
        setSpeedDialSuppressed(true);
      }
      rawContextAction(action, node, options);
    },
    [rawContextAction, setSpeedDialSuppressed]
  );

  const parentForSpeedDial = (pageTreeNode?.parentId ??
    pageNodeId ??
    (treeId ? `${treeId}:root` : 'root')) as string;

  const speedDialContextNode: HierarchicalTreeNode = {
    id: (pageNodeId ?? (treeId ? `${treeId}:root` : 'root')) as NodeId,
    nodeType: (pageTreeNode?.nodeType ?? 'folder') as NodeType,
    metadata: {
      name: pageTreeNode?.metadata?.name ?? '',
      description: pageTreeNode?.metadata?.description,
      tags: pageTreeNode?.metadata?.tags,
    },
    draftMetadata: null,
    data: null,
    draftData: undefined,
    parentId: parentForSpeedDial as NodeId,
    depth: pageTreeNode?.depth ?? 1,
    createdAt: pageTreeNode?.createdAt ?? Date.now(),
    updatedAt: pageTreeNode?.updatedAt ?? Date.now(),
    version: pageTreeNode?.version ?? 1,
  } as HierarchicalTreeNode;

  const hideSpeedDial = !canCreate || isDialogRoute || speedDialSuppressed;
  const suppressSpeedDial = useCallback(() => setSpeedDialSuppressed(true), [setSpeedDialSuppressed]);

  return {
    guidedTour,
    onContextMenuAction: resolvedContextAction,
    speedDialContextNode,
    hideSpeedDial,
    suppressSpeedDial,
  };
}
