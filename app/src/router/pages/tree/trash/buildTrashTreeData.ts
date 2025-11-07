import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { TreeNodeData } from '@hierarchidb/ui-shell/ui-treeconsole-base';
import { getTrashDisplayName } from './getTrashDisplayName.js';

export interface BuildTrashTreeDataParams {
  treeId: string;
  rootNode: TreeNode;
  nodeMap?: Map<string, TreeNode>;
}

export interface BuildTrashTreeDataResult {
  nodes: TreeNodeData[];
  rootId: string;
}

/**
 * Normalise trash nodes for the TreeConsole data model.
 *
 * Nodes are now stored directly under the trash root. Each trashed node keeps
 * track of its original identity (`originalName`, `originalParentId`) so that
 * the UI can render user-friendly labels and deep links. This helper turns the
 * worker-provided node map into a flat array that the TreeTable understands.
 *
 * Typical usage in the trash dialog:
 *
 * ```ts
 * const { nodes, rootId } = buildTrashTreeData({
 *   treeId,
 *   rootNode: trashRoot,
 *   nodeMap,
 * });
 * ```
 *
 * @param params.treeId Current console identifier (e.g. "r"). Used for diagnostics only.
 * @param params.rootNode Trash root node returned by the worker.
 * @param params.nodeMap Optional lookup of node id -> TreeNode from IndexedDB snapshots.
 *
 * @returns Flat TreeConsole rows for every known trash node (excluding the root).
 */
export function buildTrashTreeData({
  treeId: _treeId,
  rootNode,
  nodeMap,
}: BuildTrashTreeDataParams): BuildTrashTreeDataResult {
  const rootId = String(rootNode.id);
  const sourceMap = new Map<string, TreeNode>();

  if (nodeMap) {
    nodeMap.forEach((node, key) => {
      sourceMap.set(String(key), node);
    });
  }

  // Fallback: ensure root node is present even if nodeMap is empty.
  if (!sourceMap.has(rootId)) {
    sourceMap.set(rootId, rootNode);
  }

  const selectedNodes: TreeNodeData[] = [];
  const seen = new Set<string>();

  sourceMap.forEach((node) => {
    const rawId = String(node.id);
    if (rawId === rootId) {
      return;
    }
    if (seen.has(rawId)) {
      return;
    }
    seen.add(rawId);

    const id = rawId as NodeId;
    const parentId: NodeId = node.parentId ? (String(node.parentId) as NodeId) : (rootId as NodeId);
    const originalName = (node as { originalName?: string }).originalName;
    const originalParentId = (node as { originalParentId?: NodeId }).originalParentId;
    const removedAt = (node as { removedAt?: number }).removedAt;

    const displayName = getTrashDisplayName(node) || rawId;

    selectedNodes.push({
      id,
      parentId,
      nodeType: node.nodeType,
      name: displayName,
      depth: typeof node.depth === 'number' ? node.depth : 0,
      originalName,
      originalParentId,
      removedAt,
      holderType: 'trash',
      holderTargetId: id,
      holderMetaParentId: originalParentId ? (String(originalParentId) as NodeId) : undefined,
      hasChildren: Boolean(node.hasChildren),
      description: node.description,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      version: node.version,
    });
  });

  // Compute hasChildren based on selected nodes themselves if the flag is missing
  const parentCount = new Map<string, number>();
  selectedNodes.forEach((node) => {
    const parentId = node.parentId ? String(node.parentId) : undefined;
    if (parentId) {
      parentCount.set(parentId, (parentCount.get(parentId) ?? 0) + 1);
    }
  });
  selectedNodes.forEach((node) => {
    const count = parentCount.get(String(node.id)) ?? 0;
    node.hasChildren = count > 0 || Boolean(node.hasChildren);
  });

  return {
    nodes: selectedNodes,
    rootId,
  };
}
