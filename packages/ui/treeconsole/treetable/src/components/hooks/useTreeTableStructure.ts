import { useCallback, useMemo } from 'react';
import type { TreeTableController } from '../../types.js';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { RowSelectionState } from '@tanstack/react-table';
import { computeDescendants, collectDescendantIdList } from '../../utils/descendants.js';
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
  tableData: TreeNode[];
  getSubRows: (node: TreeNode) => TreeNode[];
  nodesWithChildren: Set<string>;
  expandedRowIds: ReadonlySet<string>;
  visibleData: TreeNode[];
  rootNodeId?: string;
  expandedFlatData: TreeNode[];
}

export function useTreeTableStructure({ controller }: UseTreeTableStructureOptions): UseTreeTableStructureResult {
  const rowSelection = useMemo<RowSelectionState>(() => controller?.rowSelection || {}, [controller?.rowSelection]);
  const rootNodeId = controller?.rootNodeId ? String(controller.rootNodeId) : undefined;
  const nodeIndex = controller?.nodeIndex ?? null;

  const orderReference = useMemo(() => {
    const reference = new Map<string, number>();
    const source = (controller?.data as TreeNode[] | undefined) ?? [];
    source.forEach((node, index) => {
      const id = normalizeNodeKey(node.id);
      if (id != null) {
        reference.set(id, index);
      }
    });
    return reference;
  }, [controller?.data]);

  const orderedChildren = useMemo(() => {
    if (!nodeIndex) {
      return new Map<string, TreeNode[]>();
    }

    const map = new Map<string, TreeNode[]>();

    nodeIndex.forEach((value, primaryKey) => {
      const id = normalizeNodeKey(primaryKey);
      if (id == null) return;
      const secondary = nodeIndex.getSecondaryKey(primaryKey as NodeId);
      const parentKey = secondary != null ? normalizeNodeKey(secondary) ?? '' : '';
      const depth = typeof value.depth === 'number' && Number.isFinite(value.depth) ? value.depth : 1;
      const copy: TreeNode = {
        ...value,
        id: value.id ?? (primaryKey as NodeId),
        parentId: secondary ?? value.parentId ?? null,
        depth,
      };
      const bucket = map.get(parentKey) ?? [];
      bucket.push(copy);
      map.set(parentKey, bucket);
    });

    map.forEach((children) => {
      children.sort((a, b) => {
        const aId = normalizeNodeKey(a.id) ?? '';
        const bId = normalizeNodeKey(b.id) ?? '';
        const orderA = orderReference.get(aId) ?? Number.MAX_SAFE_INTEGER;
        const orderB = orderReference.get(bId) ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });
    });

    return map;
  }, [nodeIndex, orderReference]);

  const rawData = useMemo(() => {
    if (!nodeIndex) {
      return (controller?.data as TreeNode[] | undefined) ?? [];
    }
    const flattened: TreeNode[] = [];
    const seen = new Set<string>();
    orderedChildren.forEach((children) => {
      children.forEach((child) => {
        const id = normalizeNodeKey(child.id);
        if (id == null || seen.has(id)) return;
        seen.add(id);
        flattened.push(child);
      });
    });
    return flattened;
  }, [controller?.data, nodeIndex, orderedChildren]);

  const parentMap = useMemo(() => {
    const parent = new Map<string, string | null>();
    orderedChildren.forEach((children, parentKey) => {
      const parentValue = parentKey && parentKey.length ? parentKey : null;
      children.forEach((child) => {
        const id = normalizeNodeKey(child.id);
        if (id != null) {
          parent.set(id, parentValue);
        }
      });
    });
    return parent;
  }, [orderedChildren]);

  const nodesWithChildren = useMemo(() => {
    const set = new Set<string>();
    orderedChildren.forEach((children, parentKey) => {
      if (children.length > 0 && parentKey && parentKey.length) {
        set.add(parentKey);
      }
    });
    return set;
  }, [orderedChildren]);

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

  const data = rawData;

  const expandedRowIds: ReadonlySet<string> = useMemo(() => (
    (controller?.expandedRowIds as ReadonlySet<string> | undefined) ?? EMPTY_SET
  ), [controller?.expandedRowIds]);

  const rootKey = useMemo(() => normalizeNodeKey(rootNodeId ?? '') ?? '', [rootNodeId]);

  const tableData = useMemo(() => {
    if (!nodeIndex) {
      return (controller?.data as TreeNode[] | undefined) ?? [];
    }
    return orderedChildren.get(rootKey) ?? [];
  }, [controller?.data, nodeIndex, orderedChildren, rootKey]);

  const visibleData = useMemo(() => {
    if (!nodeIndex) {
      return (controller?.data as TreeNode[] | undefined) ?? [];
    }
    const expanded = new Set<string>(Array.from(expandedRowIds).map((id) => String(id)));
    const result: TreeNode[] = [];

    const visit = (parentKey: string, depth: number) => {
      const children = orderedChildren.get(parentKey);
      if (!children) return;
      children.forEach((child) => {
        const id = normalizeNodeKey(child.id);
        if (id == null) return;
        const nextDepth = Number.isFinite(child.depth) ? (child.depth as number) : depth;
        const copy: TreeNode = {
          ...child,
          depth: nextDepth,
        };
        result.push(copy);
        if (expanded.has(id)) {
          visit(id, nextDepth + 1);
        }
      });
    };

    visit(rootKey, 1);
    return result;
  }, [controller?.data, expandedRowIds, nodeIndex, orderedChildren, rootKey]);

  const getSubRows = useCallback((node: TreeNode): TreeNode[] => {
    if (!nodeIndex) return [];
    const id = normalizeNodeKey(node.id);
    if (id == null) return [];
    const depth = Number.isFinite(node.depth) ? (node.depth as number) : 1;
    const children = orderedChildren.get(id) ?? [];
    return children.map((child) => ({
      ...child,
      depth: Number.isFinite(child.depth) ? (child.depth as number) : depth + 1,
    }));
  }, [nodeIndex, orderedChildren]);

  return {
    rawData,
    rowSelection,
    parentMap,
    hasSelectedAncestor,
    getDescendants,
    collectDescendantIds,
    data,
    tableData,
    getSubRows,
    nodesWithChildren,
    expandedRowIds,
    visibleData,
    rootNodeId,
    expandedFlatData: visibleData,
  };
}
