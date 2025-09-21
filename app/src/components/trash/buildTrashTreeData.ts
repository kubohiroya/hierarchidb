import type { BreadcrumbNode } from '@hierarchidb/ui-treeconsole-breadcrumb';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import { buildTrashBreadcrumbs, type BuildTrashBreadcrumbsParams } from './buildTrashBreadcrumbs.js';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';

export interface BuildTrashTreeDataParams {
  treeId: string;
  rootNode: TreeNode;
  targetNodeIds: readonly NodeId[];
  holderLookup?: BuildTrashBreadcrumbsParams['holderLookup'];
  nodeMap?: BuildTrashBreadcrumbsParams['nodeMap'];
}

export interface BuildTrashTreeDataResult {
  nodes: TreeNodeData[];
  rootId: string;
}

export function buildTrashTreeData({
  treeId,
  rootNode,
  targetNodeIds,
  holderLookup,
  nodeMap,
}: BuildTrashTreeDataParams): BuildTrashTreeDataResult {
  const rootId = String(rootNode.id);
  const aggregated = new Map<string, TreeNodeData>();

  const ensureNode = (crumb: BreadcrumbNode) => {
    const id = String(crumb.id);
    if (!aggregated.has(id)) {
      const holderTargetId = crumb.holderTargetId ? (String(crumb.holderTargetId) as NodeId) : undefined;
      const holderMetaParentId = crumb.holderMetaParentId ? (String(crumb.holderMetaParentId) as NodeId) : undefined;
      const parentIdValue = crumb.parentId ? (String(crumb.parentId) as NodeId) : (rootId as NodeId);
      aggregated.set(id, {
        id: id as NodeId,
        parentId: parentIdValue,
        nodeType: crumb.nodeType as any,
        name: crumb.name,
        depth: typeof crumb.depth === 'number' ? crumb.depth : undefined,
        holderType: crumb.holderType as any,
        holderTargetId,
        holderMetaParentId,
      } as TreeNodeData);
    }
    return aggregated.get(id)!;
  };

  const addPath = (targetId: NodeId) => {
    const crumbs = buildTrashBreadcrumbs({
      treeId,
      rootNode,
      targetNodeId: targetId,
      holderLookup,
      nodeMap,
    });

    crumbs.forEach((crumb, index) => {
      if (index === 0) {
        // root node
        ensureNode(crumb);
        return;
      }
      const current = ensureNode(crumb);
      current.parentId = crumb.parentId ? (String(crumb.parentId) as NodeId) : (rootId as NodeId);
      current.depth = index;
    });
  };

  targetNodeIds.forEach((id) => addPath(id));

  // Update hasChildren flags
  const parentCount = new Map<string, number>();
  aggregated.forEach((node) => {
    const parentId = node.parentId ? String(node.parentId) : undefined;
    if (parentId) {
      parentCount.set(parentId, (parentCount.get(parentId) ?? 0) + 1);
    }
  });

  aggregated.forEach((node, id) => {
    const count = parentCount.get(id) ?? 0;
    node.hasChildren = count > 0;
    if (node.depth == null && id === rootId) {
      node.depth = 0;
    }
  });

  return {
    nodes: Array.from(aggregated.values()),
    rootId,
  };
}
