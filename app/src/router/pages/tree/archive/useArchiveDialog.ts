import type { NodeId } from '@hierarchidb/core-types';
import type {
  DialogDisplayMode,
  DialogPosition,
  DialogSize,
  TreeNode,
} from '@hierarchidb/tree-api';
import {
  FRAME_CONSTANTS,
  getViewportSize,
  initialPosition,
  normalizeDialogState,
} from '@hierarchidb/ui-plugin-shell/ui-dialog';
import type { HierarchicalTreeNode, TreeTableColumn } from '@hierarchidb/ui-treeconsole-base';
import { DualKeyMap } from '@hierarchidb/util';
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { WorkerAPIClient } from '~/worker-runtime/WorkerAPIClient';
import { buildArchiveBreadcrumbs } from './buildArchiveBreadcrumbs.js';
import { buildArchiveTreeData } from './buildArchiveTreeData.js';
import { emptyArchiveBranch } from './emptyArchiveBranch.js';
import { getArchiveDisplayName } from './getArchiveDisplayName.js';
import type { ArchiveDialogData, ArchiveDialogRouteParams } from './ArchiveDialog.js';

const DEFAULT_SIZE: DialogSize = { width: 960, height: 640 };

export function useArchiveFrameState(initialMode: DialogDisplayMode = 'normal') {
  const [displayMode, setDisplayMode] = useState<DialogDisplayMode>(initialMode);
  const [dialogSize, setDialogSize] = useState<DialogSize>(DEFAULT_SIZE);
  const [dialogPosition, setDialogPosition] = useState<DialogPosition>(
    initialPosition(DEFAULT_SIZE, getViewportSize())
  );

  const isSameSize = useCallback(
    (next: DialogSize) => next.width === dialogSize.width && next.height === dialogSize.height,
    [dialogSize.height, dialogSize.width]
  );

  const isSamePosition = useCallback(
    (next: DialogPosition) => next.x === dialogPosition.x && next.y === dialogPosition.y,
    [dialogPosition.x, dialogPosition.y]
  );

  const applyNormalizedState = useCallback(
    (size: DialogSize, position: DialogPosition) => {
      if (!isSameSize(size)) {
        setDialogSize(size);
      }
      if (!isSamePosition(position)) {
        setDialogPosition(position);
      }
    },
    [isSamePosition, isSameSize]
  );

  const normalizeFromState = useCallback(
    (mode: DialogDisplayMode, nextSize?: DialogSize, nextPosition?: DialogPosition) => {
      const viewport = getViewportSize();
      const baseSize = nextSize ?? dialogSize;
      const basePosition = nextPosition ?? dialogPosition;
      const options = {
        enforceTopLeftMargin: mode === 'normal',
        minPosition: 0,
        clampSizeToViewport: true,
      } as const;
      return normalizeDialogState(baseSize, basePosition, viewport, options);
    },
    [dialogPosition, dialogSize]
  );

  const ensureFitsViewport = useCallback(
    (mode: DialogDisplayMode) => {
      const normalized = normalizeFromState(mode);
      applyNormalizedState(normalized.size, normalized.position);
    },
    [applyNormalizedState, normalizeFromState]
  );

  useEffect(() => {
    ensureFitsViewport(displayMode);
  }, [displayMode, ensureFitsViewport]);

  useEffect(() => {
    const handleResize = () => {
      ensureFitsViewport(displayMode);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, [displayMode, ensureFitsViewport]);

  const transitionDisplayMode = useCallback(
    (mode: DialogDisplayMode) => {
      const viewport = getViewportSize();
      if (mode === 'full-screen') {
        const size: DialogSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        applyNormalizedState(size, { x: 0, y: 0 });
      } else if (mode === 'maximize') {
        const preset = {
          width: Math.max(
            viewport.width - FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2,
            FRAME_CONSTANTS.MIN_DIALOG_WIDTH
          ),
          height: Math.max(
            viewport.height - FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2,
            FRAME_CONSTANTS.MIN_DIALOG_HEIGHT
          ),
        };
        const centered = initialPosition(preset, viewport);
        const normalized = normalizeDialogState(preset, centered, viewport, {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: true,
        });
        applyNormalizedState(normalized.size, normalized.position);
      } else {
        const preset = normalizeDialogState(
          DEFAULT_SIZE,
          initialPosition(DEFAULT_SIZE, viewport),
          viewport,
          { enforceTopLeftMargin: true }
        );
        applyNormalizedState(preset.size, preset.position);
      }
      setDisplayMode(mode);
    },
    [applyNormalizedState]
  );

  const handleSizeChange = useCallback(
    (size?: DialogSize) => {
      if (!size) return;
      const normalized = normalizeDialogState(size, dialogPosition, getViewportSize(), {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: 0,
        clampSizeToViewport: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    },
    [applyNormalizedState, dialogPosition, displayMode]
  );

  const handlePositionChange = useCallback(
    (position?: DialogPosition) => {
      if (!position) return;
      const normalized = normalizeDialogState(dialogSize, position, getViewportSize(), {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: 0,
        clampSizeToViewport: true,
      });
      applyNormalizedState(normalized.size, normalized.position);
    },
    [applyNormalizedState, dialogSize, displayMode]
  );

  return {
    displayMode,
    dialogSize,
    dialogPosition,
    setDisplayMode: transitionDisplayMode,
    setSize: handleSizeChange,
    setPosition: handlePositionChange,
  } as const;
}

function createTreeNodeMap(nodes: TreeNode[] | undefined): Map<string, TreeNode> {
  const map = new Map<string, TreeNode>();
  nodes?.forEach((node) => {
    if (node?.id) {
      map.set(String(node.id), node);
    }
  });
  return map;
}

export function useArchiveDialog(data: ArchiveDialogData, params: ArchiveDialogRouteParams) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const treeId = data.tree?.id;
  const pageNodeIdParam = params.pageNodeId as NodeId | undefined;
  const targetNodeId = params.targetNodeId as NodeId | undefined;
  const action = params.action;
  const mode: 'restore' | 'empty' = action === 'empty' ? 'empty' : 'restore';
  const pageNodeId = (pageNodeIdParam ??
    (data.tree?.rootId as NodeId | undefined) ??
    null) as NodeId | null;
  const archiveViewRootId = (data.activeArchiveNodeId ??
    targetNodeId ??
    data.archiveRootNode?.id ??
    null) as NodeId | null;

  const [selectedIds, setSelectedIds] = useState<NodeId[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasDraftsInView, setHasDraftsInView] = useState(false);

  const nodeMap = useMemo(() => {
    const map = createTreeNodeMap(data.archiveItems);
    if (data.archiveRootNode?.id) {
      map.set(String(data.archiveRootNode.id), data.archiveRootNode);
    }
    if (data.activeArchiveNode?.id) {
      map.set(String(data.activeArchiveNode.id), data.activeArchiveNode);
    }
    return map;
  }, [data.activeArchiveNode, data.archiveItems, data.archiveRootNode]);

  const treeData = useMemo(() => {
    const viewRoot = data.activeArchiveNode ?? data.archiveRootNode;
    if (!viewRoot) return [] as HierarchicalTreeNode[];

    const { nodes } = buildArchiveTreeData({ treeId: treeId ?? '', rootNode: viewRoot, nodeMap });
    return nodes;
  }, [data.activeArchiveNode, data.archiveRootNode, nodeMap, treeId]);

  useEffect(() => {
    const hasDrafts = treeData.some((node) => (node as TreeNode).draftData);
    setHasDraftsInView(hasDrafts);
  }, [treeData]);

  useEffect(() => {
    if (mode !== 'empty') {
      return;
    }
    setSelectedIds((prev) => {
      const next = treeData.map((node) => node.id as NodeId);
      const nextSet = new Set(next);
      const filtered = prev.filter((id) => nextSet.has(id));
      if (filtered.length > 0) {
        return filtered;
      }
      return next;
    });
  }, [mode, treeData]);

  const nodeIndex = useMemo(() => {
    const index = new DualKeyMap<NodeId, NodeId, TreeNode>();
    const fallbackParent = (archiveViewRootId ??
      (data.archiveRootNode?.id as NodeId | undefined) ??
      'archive-root') as NodeId;
    const decorateForIndex = (node: HierarchicalTreeNode): TreeNode => {
      const source = nodeMap.get(String(node.id)) ?? (node as TreeNode);
      const fromTreeData = node as { originalName?: string; originalParentId?: NodeId };
      const decorated: TreeNode = {
        ...source,
        metadata: {
          ...(source as { metadata?: TreeNode['metadata'] }).metadata,
          name: getArchiveDisplayName(node),
          description:
            (
              (source as { metadata?: TreeNode['metadata'] }).metadata as
                | TreeNode['metadata']
                | undefined
            )?.description ?? '',
          tags:
            (
              (source as { metadata?: TreeNode['metadata'] }).metadata as
                | TreeNode['metadata']
                | undefined
            )?.tags ?? [],
        },
        originalName:
          fromTreeData.originalName ??
          (source as { originalName?: string | undefined }).originalName,
        originalParentId:
          fromTreeData.originalParentId ??
          (source as { originalParentId?: NodeId | undefined }).originalParentId,
      };
      return decorated;
    };

    if (archiveViewRootId) {
      const branchNode = nodeMap.get(String(archiveViewRootId)) ?? data.archiveRootNode;
      if (branchNode) {
        const parentForRoot = (branchNode.parentId ?? archiveViewRootId) as NodeId;
        index.set(archiveViewRootId, branchNode, parentForRoot);
      }
    }

    treeData.forEach((node) => {
      const primary = node.id as NodeId;
      const parent = (node.parentId ?? fallbackParent) as NodeId;
      const decoratedNode = decorateForIndex(node);
      index.set(primary, decoratedNode, parent);
    });
    return index;
  }, [data.archiveRootNode, nodeMap, archiveViewRootId, treeData]);

  const breadcrumbItems = useMemo(() => {
    const breadcrumbRoot = data.archiveRootNode ?? data.activeArchiveNode;
    if (!breadcrumbRoot || !treeId) return [];
    return buildArchiveBreadcrumbs({
      treeId,
      rootNode: breadcrumbRoot,
      targetNodeId: archiveViewRootId,
      nodeMap,
    });
  }, [data.activeArchiveNode, data.archiveRootNode, nodeMap, archiveViewRootId, treeId]);

  const locale = useMemo(
    () => i18n.resolvedLanguage ?? i18n.language ?? 'en',
    [i18n.language, i18n.resolvedLanguage]
  );

  const formatArchiveTimestamp = useCallback(
    (input?: unknown): string => {
      const numeric =
        typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : undefined;
      if (!numeric || Number.isNaN(numeric)) {
        return '-';
      }

      const target = new Date(numeric);
      if (Number.isNaN(target.getTime())) {
        return '-';
      }

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
      const diffMs = startOfToday.getTime() - startOfTarget.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      const diffDays = Math.floor(diffMs / dayMs);

      const timeFormatter = new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: locale.startsWith('ja') ? false : undefined,
      });
      const time = timeFormatter.format(target);

      if (diffDays === 0) {
        return t('archive.timestamps.today', { time });
      }
      if (diffDays === 1) {
        return t('archive.timestamps.yesterday', { time });
      }
      if (diffDays === 2) {
        return t('archive.timestamps.twoDaysAgo', { time });
      }

      const dateFormatter = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: locale.startsWith('ja') ? 'numeric' : 'long',
        day: 'numeric',
      });
      const date = dateFormatter.format(target);
      return t('archive.timestamps.dateTime', { date, time });
    },
    [locale, t]
  );

  const columns: TreeTableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('archive.columns.name'),
        sortable: true,
        width: 300,
        render: (_value: unknown, node: HierarchicalTreeNode) => getArchiveDisplayName(node),
      },
      {
        id: 'nodeType',
        label: t('archive.columns.type'),
        sortable: true,
        width: 160,
        render: (_value: unknown, node: HierarchicalTreeNode) => node.nodeType,
      },
      {
        id: 'removedAt',
        label: t('archive.columns.removedAt'),
        sortable: true,
        width: 200,
        render: (_value: unknown, node: HierarchicalTreeNode) => {
          const typed = node as HierarchicalTreeNode & {
            removedAt?: number | string;
            deletedAt?: number | string;
          };
          return formatArchiveTimestamp(typed.removedAt ?? typed.deletedAt);
        },
      },
    ],
    [formatArchiveTimestamp, t]
  );

  const closeDialog = useCallback(
    (options?: { reload?: boolean }) => {
      const shouldReload = Boolean(options?.reload);
      const rootNodeId = treeId ? (`${treeId}:root` as NodeId) : null;
      const normalizedPageId =
        treeId && pageNodeId && rootNodeId && pageNodeId !== rootNodeId ? pageNodeId : null;
      if (treeId) {
        const destination = normalizedPageId ? `/t/${treeId}/${normalizedPageId}` : `/t/${treeId}`;
        navigate({ to: destination, replace: true });
        if (shouldReload) {
          window.setTimeout(() => window.location.reload(), 0);
        }
        return;
      }
      window.history.back();
      if (shouldReload) {
        window.setTimeout(() => window.location.reload(), 0);
      }
    },
    [navigate, pageNodeId, treeId]
  );

  const handleRestore = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const client = WorkerAPIClient.getSingleton();
      const mutationAPI = await client.getMutationAPI();
      const result = await mutationAPI.restoreNodesFromArchive({ nodeIds: selectedIds });
      if (!result.success) {
        console.error('Restore failed:', result.error);
        return;
      }
      closeDialog();
    } catch (error) {
      console.error('Error restoring archive nodes:', error);
    } finally {
      setLoading(false);
    }
  }, [closeDialog, selectedIds]);

  const removalNodeIds = useMemo(() => {
    if (mode !== 'empty') {
      return selectedIds;
    }
    return selectedIds;
  }, [mode, selectedIds]);

  const handleEmptyAll = useCallback(async () => {
    if (removalNodeIds.length === 0) {
      return;
    }
    setLoading(true);
    try {
      const result = await emptyArchiveBranch({
        nodeIds: removalNodeIds,
        getMutationAPI: async () => {
          const client = WorkerAPIClient.getSingleton();
          return client.getMutationAPI();
        },
      });
      if (result.success) {
        try {
          const client = WorkerAPIClient.getSingleton();
          const expandedApi = await client.getTreeTableExpandedAPI?.();
          await expandedApi?.clearExpandedForSubtree(removalNodeIds);
        } catch (error) {
          console.warn('Failed to clear expanded atoms after empty archive', error);
        }
        closeDialog();
      }
    } finally {
      setLoading(false);
    }
  }, [closeDialog, removalNodeIds]);

  const onToggleExpand = useCallback((nodeId: string, expanded: boolean) => {
    setExpandedIds((prev) => {
      const set = new Set(prev);
      if (expanded) {
        set.add(nodeId);
      } else {
        set.delete(nodeId);
      }
      return Array.from(set);
    });
  }, []);

  const frameState = useArchiveFrameState('normal');

  const frameSx = useMemo(
    () => ({
      borderRadius: frameState.displayMode === 'full-screen' ? 0 : 4,
      boxShadow:
        frameState.displayMode === 'full-screen' ? 'none' : '0 22px 80px rgba(10, 14, 36, 0.38)',
      maxWidth:
        frameState.displayMode === 'full-screen' ? '100%' : 'min(calc(100vw - 48px), 1280px)',
    }),
    [frameState.displayMode]
  );

  return {
    t,
    treeId,
    pageNodeId,
    archiveViewRootId,
    selectedIds,
    setSelectedIds,
    searchTerm,
    setSearchTerm,
    expandedIds,
    onToggleExpand,
    loading,
    hasDraftsInView,
    treeData,
    columns,
    breadcrumbItems,
    nodeIndex,
    mode,
    removalTargetCount: removalNodeIds.length,
    handleRestore,
    handleEmptyAll,
    closeDialog,
    frameState,
    frameSx,
  } as const;
}
