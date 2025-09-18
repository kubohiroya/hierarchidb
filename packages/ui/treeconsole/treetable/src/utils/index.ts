/**
  * TreeTable Utilities
  * TreeTable
  */

import type { NodeId } from '@hierarchidb/common-type';
import { TreeNode } from '@hierarchidb/common-type';

// import type { TreeNode } from '../types.js';

/**
    */
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

/**
    */
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
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((child) => {
      const childWithDepth = { ...child, depth };
      result.push(childWithDepth);

      if (expandedIds.has(child.id)) {
        result.push(...flattenTree(nodes, expandedIds, child.id, depth + 1));
      }
    });

  return result;
}

/**
  * ID
  */
export function getDescendantIds(nodeId: string | NodeId, allNodes: TreeNode[]): Set<NodeId> {
  const descendants = new Set<NodeId>();

  function collectDescendants(currentId: NodeId) {
    const children = allNodes.filter((node) => (node.parentId as unknown as string) === (currentId as unknown as string));

    children.forEach((child) => {
      descendants.add(child.id as NodeId);
      collectDescendants(child.id as NodeId);
    });
  }

  collectDescendants(nodeId as NodeId);
  return descendants;
}

export { computeDescendants } from './descendants.js';

/**
  * ID
  */
export function getAncestorIds(nodeId: string | NodeId, allNodes: TreeNode[]): NodeId[] {
  const ancestors: NodeId[] = [];

  function collectAncestors(currentId: NodeId) {
    const node = allNodes.find((n) => (n.id as unknown as string) === (currentId as unknown as string));
    if (!node) return;

    const parentId = node.parentId as NodeId | undefined;
    if (parentId) {
      ancestors.unshift(parentId);
      collectAncestors(parentId);
    }
  }

  collectAncestors(nodeId as NodeId);
  return ancestors;
}

/**
    */
export function filterNodesBySearch(nodes: TreeNode[], searchText: string): TreeNode[] {
  if (!searchText.trim()) {
    return nodes;
  }

  const lowerSearchText = searchText.toLowerCase();
  const matchingNodes = new Set<string>();

  nodes.forEach((node) => {
    if (node.name.toLowerCase().includes(lowerSearchText)) {
      matchingNodes.add(node.id);

      getAncestorIds(node.id, nodes).forEach((ancestorId) => {
        matchingNodes.add(String(ancestorId));
      });

      getDescendantIds(node.id, nodes).forEach((descendantId) => {
        matchingNodes.add(String(descendantId));
      });
    }
  });

  return nodes.filter((node) => matchingNodes.has(node.id));
}

/**
    */
export function getNodePath(
  nodeId: string | NodeId,
  allNodes: TreeNode[],
  separator: string = ' > ',
): string {
  const ancestors = getAncestorIds(nodeId, allNodes);
  const node = allNodes.find((n) => (n.id as unknown as string) === (nodeId as unknown as string));

  if (!node) return '';

  const pathNodes = [
    ...ancestors.map((id) => allNodes.find((n) => (n.id as unknown as string) === (id as unknown as string))).filter(Boolean),
    node,
  ];

  return pathNodes.map((n) => n!.name).join(separator);
}

/**
  * &
  */
/**
 * Determine whether a drag source can be dropped relative to a target.
 * - Prevents self-drop and dropping into own descendants (cycles)。
 * - For 'into', only cycle/self rulesを適用（親種別の判定は呼び出し側に委ね）。
 * - For 'before'/'after', 同じく cycle/self のみをチェック（順序の正規化は上位で処理）。
 */
export function canDropNode(
  draggingNodeId: string | NodeId,
  targetNodeId: string | NodeId,
  position: 'before' | 'after' | 'into',
  allNodes: TreeNode[],
): boolean {
  if ((draggingNodeId as unknown as string) === (targetNodeId as unknown as string)) {
    return false;
  }

  const descendants = getDescendantIds(draggingNodeId, allNodes);
  if (Array.from(descendants).some((id) => (id as unknown as string) === (targetNodeId as unknown as string))) {
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
