import type { NodeId, NodeType, TreeNode } from '@hierarchidb/common-types';
import type { TreeQueryAPI } from './TreeQueryAPI.js';

export type RelatedNodeSearchOptions = {
  nodeTypes: NodeType[];
  parentId?: NodeId;
  nodeId?: NodeId;
};

const isFolderNodeType = (nodeType?: string | null): boolean => {
  if (!nodeType) return false;
  const normalized = String(nodeType).trim();
  return normalized === 'folder' || /folder$/i.test(normalized);
};

const isNodeVisible = (node: TreeNode): boolean => {
  if (typeof node.visible === 'boolean') return node.visible;
  return true;
};

const isInvisibleFolder = (node: TreeNode): boolean =>
  !isNodeVisible(node) && isFolderNodeType(node.nodeType);

const getNodeName = (node: TreeNode): string => {
  const name = node.metadata?.name ?? node.draftMetadata?.name ?? '';
  return typeof name === 'string' ? name : String(name ?? '');
};

const compareByName = (a: TreeNode, b: TreeNode) =>
  getNodeName(a).localeCompare(getNodeName(b), 'en', { numeric: true, sensitivity: 'base' });

const pushUnique = (target: TreeNode[], seen: Set<NodeId>, nodes: TreeNode[]) => {
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    target.push(node);
  }
};

export const findRelatedNodesByPriority = async (
  query: TreeQueryAPI,
  options: RelatedNodeSearchOptions
): Promise<TreeNode[]> => {
  const targetTypes = new Set(options.nodeTypes);
  let resolvedParentId = options.parentId ?? null;

  if (!resolvedParentId && options.nodeId) {
    const node = await query.getNode(options.nodeId);
    resolvedParentId = node?.parentId ?? null;
  }

  if (!resolvedParentId) return [];
  const resolvedParent = await query.getNode(resolvedParentId);
  if (resolvedParent && isInvisibleFolder(resolvedParent)) {
    return [];
  }

  const results: TreeNode[] = [];
  const seen = new Set<NodeId>();

  const siblings = await query.listChildren(resolvedParentId);
  const siblingMatches = siblings
    .filter((node) => !isInvisibleFolder(node))
    .filter((node) => targetTypes.has(node.nodeType))
    .sort(compareByName);
  pushUnique(results, seen, siblingMatches);

  for (const sibling of siblings) {
    if (isInvisibleFolder(sibling)) {
      continue;
    }
    if (!isFolderNodeType(sibling.nodeType)) continue;
    const descendants = await query.listDescendants(sibling.id);
    const descendantIndex = new Map<NodeId, TreeNode>();
    for (const node of descendants) {
      descendantIndex.set(node.id, node);
    }
    const invisibleDescendantFolders = new Set<NodeId>(
      descendants.filter((node) => isInvisibleFolder(node)).map((node) => node.id)
    );
    const filteredDescendants = descendants.filter((node) => {
      if (isInvisibleFolder(node)) return false;
      let cursor = node.parentId as NodeId | null | undefined;
      while (cursor) {
        if (invisibleDescendantFolders.has(cursor)) return false;
        const parent = descendantIndex.get(cursor);
        if (!parent) break;
        cursor = parent.parentId as NodeId | null | undefined;
      }
      return true;
    });
    const matches = filteredDescendants
      .filter((node) => targetTypes.has(node.nodeType))
      .sort((a, b) => {
        const depthDelta = a.depth - sibling.depth - (b.depth - sibling.depth);
        return depthDelta !== 0 ? depthDelta : compareByName(a, b);
      });
    pushUnique(results, seen, matches);
  }

  let ancestor = await query.getNode(resolvedParentId);
  while (ancestor?.parentId) {
    if (isInvisibleFolder(ancestor)) break;
    const ancestorSiblings = await query.listChildren(ancestor.parentId);
    const matches = ancestorSiblings
      .filter((node) => !isInvisibleFolder(node))
      .filter((node) => node.id !== ancestor?.id && targetTypes.has(node.nodeType))
      .sort(compareByName);
    pushUnique(results, seen, matches);
    ancestor = await query.getNode(ancestor.parentId);
  }

  return results;
};
