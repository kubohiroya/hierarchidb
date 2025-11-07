import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { DualKeyMap } from '@hierarchidb/util';

type TreeNodeLike = {
  id?: string | number;
  treeNodeId?: string | number;
  parentId?: string | number | null;
};

const EMPTY_NODE_ID = '' as NodeId;

function toNodeId(value: unknown): NodeId {
  if (value === null || value === undefined) return EMPTY_NODE_ID;
  const str = String(value).trim();
  return (str.length > 0 ? str : EMPTY_NODE_ID) as NodeId;
}

function getNodeId(node: TreeNodeLike | null | undefined): NodeId | null {
  if (!node) return null;
  const id = toNodeId(node.id ?? node.treeNodeId);
  return id === EMPTY_NODE_ID ? null : id;
}

function removeSubtree(index: DualKeyMap<NodeId, NodeId, TreeNode>, nodeId: NodeId): void {
  const childIds = index.getPrimaryKeysBySecondary(nodeId);
  for (const childId of childIds) {
    removeSubtree(index, childId as NodeId);
  }
  index.delete(nodeId);
}

export function removeNodeAndDescendants(
  index: DualKeyMap<NodeId, NodeId, TreeNode>,
  nodeId: NodeId
): void {
  removeSubtree(index, nodeId);
}

export function syncNodeIndex(
  index: DualKeyMap<NodeId, NodeId, TreeNode>,
  parentId: NodeId,
  children: readonly TreeNodeLike[]
): void {
  const parentKey = toNodeId(parentId);
  const nextIds = new Set<NodeId>();

  for (const child of children ?? []) {
    const id = getNodeId(child);
    if (!id) continue;
    const secondary = toNodeId(child.parentId ?? parentId);
    index.set(id, child as TreeNode, secondary);
    nextIds.add(id);
  }

  const previousIds = index.getPrimaryKeysBySecondary(parentKey);
  previousIds.forEach((existingId) => {
    const asNodeId = existingId as NodeId;
    if (!nextIds.has(asNodeId)) {
      removeSubtree(index, asNodeId);
    }
  });
}

export function buildVisibleRows(
  rootId: NodeId,
  index: DualKeyMap<NodeId, NodeId, TreeNode>,
  expandedIds: readonly (NodeId | string | number | undefined)[]
): TreeNode[] {
  const expanded = new Set<NodeId>(
    (expandedIds ?? []).map((id) => toNodeId(id)).filter((id) => id !== EMPTY_NODE_ID)
  );

  const result: TreeNode[] = [];
  const visit = (parentKey: NodeId, depth: number) => {
    const childIds = index.getPrimaryKeysBySecondary(parentKey);
    for (const childId of childIds) {
      const node = index.get(childId as NodeId);
      if (!node) continue;
      const mapped: TreeNode = {
        ...node,
        depth: typeof node.depth === 'number' ? node.depth : depth,
      };
      result.push(mapped);
      if (expanded.has(childId as NodeId)) {
        visit(childId as NodeId, depth + 1);
      }
    }
  };

  visit(toNodeId(rootId), 1);
  return result;
}
