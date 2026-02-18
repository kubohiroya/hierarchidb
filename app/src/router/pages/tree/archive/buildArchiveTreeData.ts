import type { NodeId } from '@hierarchidb/core-types';
import type { NodePayload, TreeNode } from '@hierarchidb/tree-api';
import type { HierarchicalTreeNode } from '@hierarchidb/ui-treeconsole-base';
import { getArchiveDisplayName } from './getArchiveDisplayName.js';

export interface BuildArchiveTreeDataParams {
  treeId: string;
  rootNode: TreeNode;
  nodeMap?: Map<string, TreeNode>;
}

export interface BuildArchiveTreeDataResult {
  nodes: HierarchicalTreeNode[];
  rootId: string;
}

/**
 * Normalise archive nodes for the TreeConsole data model.
 *
 * Nodes are now stored directly under the archive root. Each archiveed node keeps
 * track of its original identity (`originalName`, `originalParentId`) so that
 * the UI can render user-friendly labels and deep links. This helper turns the
 * worker-provided node map into a flat array that the TreeTable understands.
 *
 * Typical usage in the archive dialog:
 *
 * ```ts
 * const { nodes, rootId } = buildArchiveTreeData({
 *   treeId,
 *   rootNode: archiveRoot,
 *   nodeMap,
 * });
 * ```
 *
 * @param params.treeId Current console identifier (e.g. "r"). Used for diagnostics only.
 * @param params.rootNode Archive root node returned by the worker.
 * @param params.nodeMap Optional lookup of node id -> TreeNode from IndexedDB snapshots.
 *
 * @returns Flat TreeConsole rows for every known archive node (excluding the root).
 */
export function buildArchiveTreeData({
  treeId: _treeId,
  rootNode,
  nodeMap,
}: BuildArchiveTreeDataParams): BuildArchiveTreeDataResult {
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

  const selectedNodes: HierarchicalTreeNode[] = [];
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

    const displayName = getArchiveDisplayName(node) || rawId;

    selectedNodes.push({
      id,
      parentId,
      nodeType: node.nodeType,
      depth: typeof node.depth === 'number' ? node.depth : 0,
      originalName,
      originalParentId,
      removedAt,
      hasChildren: Boolean(node.hasChildren),
      metadata: {
        name: displayName,
        description: (node as { metadata?: { description?: string } }).metadata?.description ?? '',
        tags: (node as { metadata?: { tags?: string[] } }).metadata?.tags ?? [],
      },
      draftMetadata: null,
      visible: true,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      version: node.version,
      data: ((node as { data?: NodePayload }).data ?? null) as NodePayload,
      draftData: (node as { draftData?: NodePayload }).draftData as NodePayload | undefined,
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
