import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';

export interface BuildTrashTreeDataParams {
  treeId: string;
  rootNode: TreeNode;
  targetNodeIds: readonly NodeId[];
  nodeMap?: Map<string, TreeNode>;
  activeNodeId?: NodeId | null;
  pageNodeId?: NodeId | null;
}

export interface BuildTrashTreeDataResult {
  nodes: TreeNodeData[];
  rootId: string;
}

export function buildTrashTreeData({
  treeId: _treeId,
  rootNode,
  targetNodeIds,
  nodeMap,
  activeNodeId,
  pageNodeId,
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

  const placeholderIds = new Set<string>();
  sourceMap.forEach((node) => {
    const parentKey = node.parentId ? String(node.parentId) : null;
    if (parentKey && parentKey === rootId) {
      placeholderIds.add(String(node.id));
    }
  });

  // Filter nodes: use only those with depth >= 1 (depth 0 is placeholder)
  const selectedNodes: TreeNodeData[] = [];
  const seen = new Set<string>();
  const activeId = activeNodeId ? String(activeNodeId) : null;

  const normalizedPageNodeId: NodeId = pageNodeId
    ? (String(pageNodeId) as NodeId)
    : (rootNode.parentId ? (String(rootNode.parentId) as NodeId) : (rootId as NodeId));
  const isActiveTrashRoot = activeId != null && String(activeId) === rootId;

  const includeNode = (node: TreeNode) => {
    const depth = typeof node.depth === 'number' ? node.depth : 0;
    if (depth < 1) {
      return;
    }
    const id = String(node.id) as NodeId;
    if (activeId && String(id) === activeId) {
      return;
    }
    if (seen.has(id)) {
      return;
    }
    if (placeholderIds.has(String(node.id))) {
      return;
    }
    seen.add(id);
    const parentIdValue = node.parentId ? String(node.parentId) : null;
    let parentId = parentIdValue ? (String(node.parentId) as NodeId) : normalizedPageNodeId;
    let metaParentId = node.holderMetaParentId ? (String(node.holderMetaParentId) as NodeId) : undefined;
    if (isActiveTrashRoot && parentIdValue && placeholderIds.has(parentIdValue)) {
      parentId = normalizedPageNodeId;
      metaParentId = normalizedPageNodeId;
    }
    selectedNodes.push({
      id,
      parentId,
      nodeType: node.nodeType,
      name: node.name,
      depth,
      holderType: node.holderType,
      holderTargetId: node.holderTargetId,
      holderMetaParentId: metaParentId,
      hasChildren: Boolean(node.hasChildren),
      description: node.description,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      version: node.version,
    });
  };

  const filteredTargetIds = targetNodeIds.filter((id) => {
      const node = sourceMap.get(String(id));
      if (!node) return false;
      if (placeholderIds.has(String(id))) {
        return false;
      }
      return true;
    });

  if (filteredTargetIds.length > 0) {
    filteredTargetIds.forEach((id) => {
      const node = sourceMap.get(String(id));
      if (node) {
        includeNode(node);
      }
    });
  } else {
    sourceMap.forEach((node) => includeNode(node));
  }

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
