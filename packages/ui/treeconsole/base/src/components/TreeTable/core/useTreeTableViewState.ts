import type { TreeNode } from '@hierarchidb/tree-api';
import { rainbowColors } from '@hierarchidb/ui-theme';
import { getPluginIconColor, isFolderNodeType } from '@hierarchidb/ui-treeconsole-breadcrumb';
import { type MouseEvent as ReactMouseEvent, useCallback, useMemo } from 'react';
import type { HierarchicalTreeNode } from '~/types/index';
import type { TreeTableViewProps } from './TreeTableView.js';

interface UseTreeTableViewStateParams {
  data: TreeTableViewProps['data'];
  selectedIds: TreeTableViewProps['selectedIds'];
  expandedIds: TreeTableViewProps['expandedIds'];
  onNodeClick: TreeTableViewProps['onNodeClick'];
  onNodeSelect: TreeTableViewProps['onNodeSelect'];
}

export interface UseTreeTableViewStateResult {
  baseDepth: number;
  visibleNodes: readonly HierarchicalTreeNode[];
  allSelected: boolean;
  someSelected: boolean;
  isSelected: (nodeId: string) => boolean;
  isExpanded: (nodeId: string) => boolean;
  getNodeLevel: (node: HierarchicalTreeNode) => number;
  getNodeIconColor: (node: HierarchicalTreeNode, hasChildren: boolean) => string;
  handleRowClick: (event: ReactMouseEvent, node: HierarchicalTreeNode) => void;
  handleSelectAll: (checked: boolean) => void;
}

export function useTreeTableViewState({
  data,
  selectedIds,
  expandedIds,
  onNodeClick,
  onNodeSelect,
}: UseTreeTableViewStateParams): UseTreeTableViewStateResult {
  const expandedSet = useMemo(() => new Set(expandedIds.map(String)), [expandedIds]);

  const parentMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    data.forEach((node) => {
      const parent = (node as TreeNode).parentId;
      if (parent !== null && parent !== undefined) {
        map.set(node.id, String(parent));
      } else {
        map.set(node.id, undefined);
      }
    });
    return map;
  }, [data]);

  const baseDepth = useMemo(() => {
    const depths = data
      .map((node) => (typeof node.depth === 'number' ? node.depth : undefined))
      .filter((value): value is number => typeof value === 'number');

    if (depths.length === 0) {
      return 0;
    }

    return Math.min(...depths);
  }, [data]);

  const isSelected = useCallback((nodeId: string) => selectedIds.includes(nodeId), [selectedIds]);

  const isExpanded = useCallback(
    (nodeId: string) => expandedSet.has(String(nodeId)),
    [expandedSet]
  );

  const isVisible = useCallback(
    (nodeId: string): boolean => {
      let current = parentMap.get(nodeId);
      const seen = new Set<string>();
      while (current) {
        if (seen.has(current)) break;
        seen.add(current);
        if (!expandedSet.has(current) && parentMap.has(current)) {
          return false;
        }
        current = parentMap.get(current);
      }
      return true;
    },
    [parentMap, expandedSet]
  );

  const visibleNodes = useMemo(() => data.filter((node) => isVisible(node.id)), [data, isVisible]);

  const allSelected = visibleNodes.length > 0 && visibleNodes.every((node) => isSelected(node.id));
  const someSelected = visibleNodes.some((node) => isSelected(node.id));

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (!onNodeSelect) return;

      const targets = data
        .filter((node) => isVisible(node.id) && isSelected(node.id) !== checked)
        .map((node) => node.id);

      if (targets.length > 0) {
        onNodeSelect(targets, checked);
      }
    },
    [data, isSelected, isVisible, onNodeSelect]
  );

  const getAbsoluteDepth = useCallback((node: HierarchicalTreeNode): number => {
    const nodeWithAbsolute = node as HierarchicalTreeNode & { absoluteDepth?: number };
    if (typeof nodeWithAbsolute.absoluteDepth === 'number') {
      return nodeWithAbsolute.absoluteDepth;
    }

    if (typeof node.depth === 'number') {
      return node.depth;
    }

    return 0;
  }, []);

  const getNodeLevel = useCallback(
    (node: HierarchicalTreeNode): number => Math.max(0, getAbsoluteDepth(node) - baseDepth),
    [baseDepth, getAbsoluteDepth]
  );

  const getNodeIconColor = useCallback(
    (node: HierarchicalTreeNode, hasChildren: boolean): string => {
      const absoluteDepth = getAbsoluteDepth(node);
      const baseIconColor =
        rainbowColors[Math.max(0, Math.round(absoluteDepth)) % rainbowColors.length] ??
        rainbowColors[0] ??
        '#1976d2';
      const nodeType = String(node.nodeType ?? (hasChildren ? 'folder' : 'file'));
      const manifestIconColor = getPluginIconColor(nodeType);
      return isFolderNodeType(nodeType) ? baseIconColor : (manifestIconColor ?? baseIconColor);
    },
    [getAbsoluteDepth]
  );

  const handleRowClick = useCallback(
    (event: ReactMouseEvent, node: HierarchicalTreeNode) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-no-row-click]')) {
        return;
      }
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  return {
    baseDepth,
    visibleNodes,
    allSelected,
    someSelected,
    isSelected,
    isExpanded,
    getNodeLevel,
    getNodeIconColor,
    handleRowClick,
    handleSelectAll,
  };
}
