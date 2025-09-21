import type { BreadcrumbNode } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';

export interface TrashHolderLookupEntry {
  holderId: NodeId;
  holderName?: string;
}

export interface BuildTrashBreadcrumbsParams {
  treeId: string;
  rootNode: TreeNode;
  targetNodeId: NodeId | null | undefined;
  holderLookup?: Record<string, TrashHolderLookupEntry>;
  nodeMap?: Map<string, TreeNode>;
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 32;

export function buildTrashBreadcrumbs({
  treeId,
  rootNode,
  targetNodeId,
  holderLookup,
  nodeMap,
  maxDepth = DEFAULT_MAX_DEPTH,
}: BuildTrashBreadcrumbsParams): BreadcrumbNode[] {
  const rootId = String(rootNode.id);
  const rootCrumb: BreadcrumbNode = {
    id: rootId,
    name: 'Trash',
    nodeType: rootNode.nodeType ?? 'trash',
    parentId: `${treeId}:root`,
    holderType: 'trash',
    holderTargetId: rootId,
    holderMetaParentId: `${treeId}:root`,
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
  const rootLabel = rootCrumb.name ?? 'Trash';

  while (currentId && currentId !== rootId && depth < maxDepth) {
    if (seen.has(currentId)) {
      break;
    }
    seen.add(currentId);
    depth += 1;

    const currentNode: TreeNode | undefined = nodeMap?.get(currentId);
    const parentRaw: NodeId | undefined = (currentNode as { holderMetaParentId?: NodeId } | undefined)?.holderMetaParentId;
    const parentId: string = parentRaw ? String(parentRaw) : rootId;

    const parentNode: TreeNode | undefined = parentId === rootId ? rootNode : nodeMap?.get(parentId);
    const holderEntry = holderLookup?.[currentId];

    const parentName = parentNode?.name ?? holderEntry?.holderName ?? (parentId === rootId ? rootLabel : parentId);
    const currentName = currentNode?.name ?? currentId;
    const combinedLabel = parentName === currentName ? currentName : `${parentName} / ${currentName}`;

    chain.unshift({
      id: currentId,
      name: combinedLabel,
      nodeType: currentNode?.nodeType ?? 'trash-item',
      parentId,
      holderType: 'trash',
      holderTargetId: currentId,
      holderMetaParentId: parentId,
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
