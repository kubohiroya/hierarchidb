import { useCallback, useMemo } from 'react';
import type { TreeTableController } from '../../types.js';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { RowSelectionState } from '@tanstack/react-table';
import { computeDescendants, collectDescendantIdList } from '../../utils/descendants.js';
import { buildVisibleNodes } from '../../utils/visible-nodes.js';
import { EMPTY_SET, normalizeNodeKey } from '../../utils/treeTableHelpers.js';

export interface UseTreeTableStructureOptions {
  controller: TreeTableController | null;
}

export interface UseTreeTableStructureResult {
  rawData: TreeNode[];
  rowSelection: RowSelectionState;
  parentMap: Map<string, string | null>;
  hasSelectedAncestor: (nodeId: NodeId) => boolean;
  getDescendants: (nodeId: NodeId) => Set<NodeId>;
  collectDescendantIds: (nodeId: NodeId) => string[];
  data: TreeNode[];
  nodesWithChildren: Set<string>;
  expandedRowIds: ReadonlySet<string>;
  visibleData: TreeNode[];
  rootNodeId?: string;
}

export function useTreeTableStructure({ controller }: UseTreeTableStructureOptions): UseTreeTableStructureResult {
  const rawData: TreeNode[] = useMemo(() => controller?.data || [], [controller?.data]);
  const rowSelection = useMemo<RowSelectionState>(() => controller?.rowSelection || {}, [controller?.rowSelection]);
  const rootNodeId = controller?.rootNodeId ? String(controller.rootNodeId) : undefined;

  const parentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const node of rawData) {
      const id = normalizeNodeKey(node.id);
      if (id == null) continue;
      map.set(id, normalizeNodeKey(node.parentId ?? null));
    }
    return map;
  }, [rawData]);

  const hasSelectedAncestor = useCallback((nodeId: NodeId): boolean => {
    const normalized = normalizeNodeKey(nodeId);
    if (normalized == null) return false;
    let current = parentMap.get(normalized) ?? null;
    while (current) {
      if (rowSelection[current]) return true;
      current = parentMap.get(current) ?? null;
    }
    return false;
  }, [parentMap, rowSelection]);

  const getDescendants = useCallback((nodeId: NodeId): Set<NodeId> => {
    return computeDescendants(rawData, nodeId) as Set<NodeId>;
  }, [rawData]);

  const collectDescendantIds = useCallback((nodeId: NodeId): string[] => {
    const list = collectDescendantIdList(rawData, nodeId);
    return list.length === 0 ? [String(nodeId)] : list;
  }, [rawData]);

  const data = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>();
    const depthMap = new Map<string, number>();

    rawData.forEach((node) => nodeMap.set(node.id, node));

    const computeDepth = (nodeId: string): number => {
      if (depthMap.has(nodeId)) return depthMap.get(nodeId)!;
      const node = nodeMap.get(nodeId);
      if (!node) {
        depthMap.set(nodeId, 0);
        return 0;
      }
      if (typeof node.depth === 'number') {
        depthMap.set(nodeId, node.depth);
        return node.depth as number;
      }
      if (!node.parentId) {
        const depth = rootNodeId && node.id !== rootNodeId ? 1 : 0;
        depthMap.set(nodeId, depth);
        return depth;
      }
      const parentId = String(node.parentId);
      const depth = computeDepth(parentId) + 1;
      depthMap.set(nodeId, depth);
      return depth;
    };

    return rawData.map((node) => ({
      ...node,
      depth: computeDepth(String(node.id)),
    }));
  }, [rawData, rootNodeId]);

  const nodesWithChildren = useMemo(() => {
    const set = new Set<string>();
    for (const node of rawData) {
      const parentId = normalizeNodeKey(node.parentId ?? null);
      if (parentId != null) set.add(parentId);
    }
    return set;
  }, [rawData]);

  const expandedRowIds: ReadonlySet<string> = useMemo(() => (
    (controller?.expandedRowIds as ReadonlySet<string> | undefined) ?? EMPTY_SET
  ), [controller?.expandedRowIds]);

  const visibleData = useMemo(() => buildVisibleNodes(data, expandedRowIds, { rootNodeId }), [data, expandedRowIds, rootNodeId]);

  return {
    rawData,
    rowSelection,
    parentMap,
    hasSelectedAncestor,
    getDescendants,
    collectDescendantIds,
    data,
    nodesWithChildren,
    expandedRowIds,
    visibleData,
    rootNodeId,
  };
}
