import type { NodeId, TreeNode } from '@hierarchidb/common-types';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { getTrashDisplayName } from './getTrashDisplayName.js';

export interface BuildTrashBreadcrumbsParams {
  treeId: string;
  rootNode: TreeNode;
  targetNodeId: NodeId | null | undefined;
  nodeMap?: Map<string, TreeNode>;
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 32;

/**
 * Generate breadcrumb entries for the trash dialog.
 *
 * Trash data in the worker is organized by storing canonical nodes directly under
 * the trash root. Each node carries optional metadata (`originalName`,
 * `originalParentId`) describing its source location. The UI still needs to render
 * a logical breadcrumb path for the trashed node; this helper constructs the list
 * of breadcrumb entries the TreeConsole UI can consume, preferring the preserved
 * original name when available.
 *
 * Typical usage in the trash dialog:
 *
 * ```ts
 * const breadcrumbs = buildTrashBreadcrumbs({
 *   treeId,
 *   rootNode: trashRoot,
 *   targetNodeId: selectedNodeId,
 *   nodeMap,
 * });
 * // breadcrumbs is passed to the TreeConsole breadcrumb renderer to display
 * // "Trash / Node" (or deeper paths when children exist) while still using
 * // the original label when it is available.
 * ```
 *
 * @param params.treeId Current console identifier (e.g. "r" for resources console).
 * @param params.rootNode Trash root node supplied by the worker.
 * @param params.targetNodeId The trashed node we want to stage a path for.
 * @param params.nodeMap Optional map of node id to worker-provided TreeNode instances.
 * @param params.maxDepth Safety cap to avoid infinite loops on malformed data (defaults to 32).
 *
 * @returns Breadcrumb nodes ordered from root to target. The first element always
 *          represents the trash root.
 */
export function buildTrashBreadcrumbs({
  treeId,
  rootNode,
  targetNodeId,
  nodeMap,
  maxDepth = DEFAULT_MAX_DEPTH,
}: BuildTrashBreadcrumbsParams): BreadcrumbNode[] {
  const rootId = String(rootNode.id);
  const rootCrumb: BreadcrumbNode = {
    id: rootId,
    name: 'Trash',
    nodeType: rootNode.nodeType ?? 'trash',
    parentId: `${treeId}:root`,
    isClickable: true,
    depth: 0,
  };

  if (!targetNodeId || String(targetNodeId) === rootId) {
    return [rootCrumb];
  }

  const chain: BreadcrumbNode[] = [];
  const seen = new Set<string>();
  let currentId: string | null = String(targetNodeId);
  let depth = 0;

  while (currentId && currentId !== rootId && depth < maxDepth) {
    if (seen.has(currentId)) {
      break;
    }
    seen.add(currentId);
    depth += 1;

    const currentNode: TreeNode | undefined = nodeMap?.get(currentId);
    const parentRaw: NodeId | undefined = currentNode?.parentId;
    const parentId: string = parentRaw ? String(parentRaw) : rootId;

    const displayName = getTrashDisplayName(currentNode) || currentId;
    const originalParentId = (currentNode as { originalParentId?: NodeId } | undefined)
      ?.originalParentId;
    const metaParentId = originalParentId ? String(originalParentId) : parentId;

    chain.unshift({
      id: currentId,
      name: displayName,
      nodeType: currentNode?.nodeType ?? 'trash-item',
      parentId,
      isClickable: true,
    });

    if (!parentRaw) {
      break;
    }
    currentId = parentId;
  }

  if (chain.length) {
    const first = chain[0];
    const second = chain[1];
    const rest = chain.slice(2);
    let normalizedChain: BreadcrumbNode[] = chain;

    if (first && second && second.parentId && String(second.parentId) === String(first.id)) {
      const mergedActual: BreadcrumbNode = {
        ...second,
        parentId: first.parentId ?? rootCrumb.id,
      };
      normalizedChain = [mergedActual, ...rest];
    }

    if (normalizedChain.length > 0) {
      const last = normalizedChain[normalizedChain.length - 1];
      if (last) {
        const updatedLast: BreadcrumbNode = { ...last, isClickable: false };
        normalizedChain = [...normalizedChain.slice(0, -1), updatedLast];
      }
    }

    return [rootCrumb, ...normalizedChain];
  }

  return [rootCrumb];
}
