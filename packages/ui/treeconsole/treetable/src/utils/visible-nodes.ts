/**
 * visible-nodes.ts
 * Utility helpers to derive the visible TreeTable rows based on expansion atoms.
 */

import type { NodeId, TreeNode } from '@hierarchidb/common-types';

export interface BuildVisibleNodesOptions {
  rootNodeId?: NodeId | string | null;
}

const toKey = (value: NodeId | string | number | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return String(value);
};

/**
 * Returns a flat array of nodes in the order they should appear in the table, filtering out
 * descendants of collapsed nodes and preserving the original sibling ordering.
 */
export function buildVisibleNodes<T extends TreeNode>(
  nodes: readonly T[],
  expandedRowIds: ReadonlySet<NodeId | string> | undefined,
  options: BuildVisibleNodesOptions = {},
): T[] {
  if (!nodes.length) {
    return [];
  }

  const idToNode = new Map<string, T>();
  const childrenByParent = new Map<string | null, T[]>();

  nodes.forEach((node) => {
    const id = toKey(node.id);
    if (id == null) {
      return;
    }
    idToNode.set(id, node);
    const parentValue = (node as TreeNode & { parentId?: NodeId | string | null }).parentId ?? null;
    const parentKey = toKey(parentValue);
    const siblings = childrenByParent.get(parentKey);
    if (siblings) {
      siblings.push(node);
    } else {
      childrenByParent.set(parentKey, [node]);
    }
  });

  const expandedKeys = new Set<string>();
  if (expandedRowIds) {
    expandedRowIds.forEach((rawId) => {
      const key = toKey(rawId);
      if (key != null) {
        expandedKeys.add(key);
      }
    });
  }

  const visited = new Set<string>();
  const result: T[] = [];

  const traverse = (node: T) => {
    const id = toKey(node.id);
    if (id == null || visited.has(id)) {
      return;
    }
    visited.add(id);
    result.push(node);

    if (!expandedKeys.has(id)) {
      return;
    }

    const children = childrenByParent.get(id);
    if (!children) {
      return;
    }

    for (const child of children) {
      traverse(child);
    }
  };

  const rootKey = toKey(options.rootNodeId ?? null);
  if (rootKey) {
    const rootNode = idToNode.get(rootKey);
    if (rootNode) {
      traverse(rootNode);
    } else {
      const rootChildren = childrenByParent.get(rootKey);
      if (rootChildren) {
        for (const child of rootChildren) {
          traverse(child);
        }
      }
    }
  }

  for (const node of nodes) {
    const id = toKey(node.id);
    if (id == null || visited.has(id)) {
      continue;
    }
    const parentValue = (node as TreeNode & { parentId?: NodeId | string | null }).parentId ?? null;
    const parentKey = toKey(parentValue);
    const hasKnownParent = parentKey != null && idToNode.has(parentKey);
    if (!hasKnownParent) {
      traverse(node);
    }
  }

  return result;
}
