/**
  * TreeTable Utilities
  * TreeTable
  */

import { TreeNode } from '@hierarchidb/common-type';

// import type { TreeNode } from '../types';

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
export function getDescendantIds(nodeId: string, allNodes: TreeNode[]): Set<string> {
  const descendants = new Set<string>();

  function collectDescendants(currentId: string) {
    const children = allNodes.filter((node) => node.parentId === currentId);

    children.forEach((child) => {
      descendants.add(child.id);
      collectDescendants(child.id);
    });
  }

  collectDescendants(nodeId);
  return descendants;
}

/**
  * ID
  */
export function getAncestorIds(nodeId: string, allNodes: TreeNode[]): string[] {
  const ancestors: string[] = [];

  function collectAncestors(currentId: string) {
    const node = allNodes.find((n) => n.id === currentId);
    if (!node) return;

    const parentId = node.parentId;
    if (parentId) {
      ancestors.unshift(parentId);
      collectAncestors(parentId);
    }
  }

  collectAncestors(nodeId);
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
        matchingNodes.add(ancestorId);
      });

      getDescendantIds(node.id, nodes).forEach((descendantId) => {
        matchingNodes.add(descendantId);
      });
    }
  });

  return nodes.filter((node) => matchingNodes.has(node.id));
}

/**
    */
export function getNodePath(
  nodeId: string,
  allNodes: TreeNode[],
  separator: string = ' > ',
): string {
  const ancestors = getAncestorIds(nodeId, allNodes);
  const node = allNodes.find((n) => n.id === nodeId);

  if (!node) return '';

  const pathNodes = [
    ...ancestors.map((id) => allNodes.find((n) => n.id === id)).filter(Boolean),
    node,
  ];

  return pathNodes.map((n) => n!.name).join(separator);
}

/**
  * &
  */
export function canDropNode(
  draggingNodeId: string,
  targetNodeId: string,
  _position: 'before' | 'after' | 'into',
  allNodes: TreeNode[],
): boolean {
  if (draggingNodeId === targetNodeId) {
    return false;
  }

  const descendants = getDescendantIds(draggingNodeId, allNodes);
  if (descendants.has(targetNodeId)) {
    return false;
  }


  return true;
}
