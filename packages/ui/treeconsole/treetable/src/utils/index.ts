/**
  * TreeTable Utilities
  * TreeTable
  */

import type { NodeId } from '@hierarchidb/core-types';
import { getTreeNodeName, type TreeNode } from '@hierarchidb/tree-api';

export function calculateNodeDepth(node: TreeNode, allNodes: TreeNode[]): number {
  if (!node.parentId) {
    return 0;
  }

  const parentId = node.parentId;
  if (!parentId) {
    return 0;
  }

  const parent = allNodes.find((n) => n.id === parentId || n.id === parentId);

  if (!parent) {
    return 0;
  }

  return 1 + calculateNodeDepth(parent, allNodes);
}

export function flattenTree(
  nodes: TreeNode[],
  expandedIds: Set<string>,
  parentId: string | null = null,
  depth: number = 0,
): TreeNode[] {
  const result: TreeNode[] = [];

  const children = nodes.filter((node) => {
    const nodeParentId = node.parentId;
    return nodeParentId === parentId;
  });

  children
    .sort((a, b) => a.metadata.name.localeCompare(b.metadata.name))
    .forEach((child) => {
      const childWithDepth = { ...child, depth };
      result.push(childWithDepth);

      if (expandedIds.has(child.id)) {
        result.push(...flattenTree(nodes, expandedIds, child.id, depth + 1));
      }
    });

  return result;
}

export function getDescendantIds(nodeId: NodeId, allNodes: TreeNode[]): Set<NodeId> {
  const descendants = new Set<NodeId>();
  const targetKey = String(nodeId);

  const collectDescendants = (currentId: NodeId) => {
    const currentKey = String(currentId);
    allNodes.forEach((node) => {
      const parentKey = node.parentId == null ? null : String(node.parentId);
      if (parentKey === currentKey) {
        const childId = node.id as NodeId;
        if (!descendants.has(childId)) {
          descendants.add(childId);
          collectDescendants(childId);
        }
      }
    });
  };

  collectDescendants(nodeId);
  // Include the direct children of the root node when select-all is staged
  // even if the nodeId itself does not exist within allNodes (safety guard)
  if (descendants.size === 0) {
    allNodes
      .filter((node) => String(node.parentId ?? '') === targetKey)
      .forEach((node) => {
        descendants.add(node.id as NodeId);
      });
  }

  return descendants;
}

export { computeDescendants } from './descendants.js';

/**
  * ID
  */
export function getAncestorIds(nodeId: NodeId, allNodes: TreeNode[]): NodeId[] {
  const ancestors: NodeId[] = [];

  const nodeMap = new Map<string, TreeNode>();
  allNodes.forEach((node) => {nodeMap.set(String(node.id), node)});

  const collectAncestors = (currentKey: string) => {
    const node = nodeMap.get(currentKey);
    if (!node || node.parentId == null) {
      return;
    }

    const parentId = node.parentId as NodeId;
    collectAncestors(String(parentId));
    ancestors.push(parentId);
  };

  collectAncestors(String(nodeId));
  return ancestors;
}

export function filterNodesBySearch(nodes: TreeNode[], searchText: string): TreeNode[] {
  if (!searchText.trim()) {
    return nodes;
  }

  const lowerSearchText = searchText.toLowerCase();
  const matchingNodes = new Set<string>();

  nodes.forEach((node) => {
    if (node.metadata.name.toLowerCase().includes(lowerSearchText)) {
      matchingNodes.add(node.id);

      getAncestorIds(node.id as NodeId, nodes).forEach((ancestorId) => {
        matchingNodes.add(String(ancestorId));
      });

      getDescendantIds(node.id as NodeId, nodes).forEach((descendantId) => {
        matchingNodes.add(String(descendantId));
      });
    }
  });

  return nodes.filter((node) => matchingNodes.has(node.id));
}

/**
    */
export function getNodePath(
  nodeId: NodeId,
  allNodes: TreeNode[],
  separator: string = ' > ',
): string {
  const ancestors = getAncestorIds(nodeId, allNodes);
  const node = allNodes.find((n) => String(n.id) === String(nodeId));

  if (!node) return '';

  const pathNodes = [
    ...ancestors
      .map((id) => allNodes.find((n) => String(n.id) === String(id)))
      .filter(Boolean),
    node,
  ];

  return pathNodes.map((n) => (n ? getTreeNodeName(n) : '')).join(separator);
}

/**
 * Determine whether a drag source can be dropped relative to a target.
 * - Prevents self-drop and dropping into own descendants (cycles)。
 * - For 'into', only cycle/self rulesを適用（親種別の判定は呼び出し側に委ね）。
 * - For 'before'/'after', 同じく cycle/self のみをチェック（順序の正規化は上位で処理）。
 */
export function canDropNode(
  draggingNodeId: NodeId,
  targetNodeId: NodeId,
  position: 'before' | 'after' | 'into',
  allNodes: TreeNode[],
): boolean {
  const draggingKey = String(draggingNodeId);
  const targetKey = String(targetNodeId);

  if (draggingKey === targetKey) {
    return false;
  }

  const descendants = getDescendantIds(draggingNodeId, allNodes);
  if (Array.from(descendants).some((id) => String(id) === targetKey)) {
    return false;
  }

  // position-specific checks can be extended here if必要
  switch (position) {
    case 'into':
    case 'before':
    case 'after':
    default:
      return true;
  }
}
