import type { TreeNode } from '@hierarchidb/common-type';
import type { TreeNodeData } from '@hierarchidb/ui-treeconsole-base';

export function rebuildAdjacency(
  nodesById: Map<string, TreeNode>,
  childrenByParent: Map<string, Set<string>>,
  parentId: string,
  children: TreeNode[],
) {
  const nextIds = new Set<string>(children.map((c) => String(c.id)));
  childrenByParent.set(parentId, nextIds);
  for (const n of children) {
    nodesById.set(String(n.id), n);
  }
}

export function removeFromParent(childrenByParent: Map<string, Set<string>>, parentId: string | undefined, nodeId: string) {
  if (!parentId) return;
  const set = childrenByParent.get(parentId);
  if (!set) return;
  if (set.has(nodeId)) {
    const next = new Set(set);
    next.delete(nodeId);
    childrenByParent.set(parentId, next);
  }
}

export function addToParent(childrenByParent: Map<string, Set<string>>, parentId: string | undefined, nodeId: string) {
  if (!parentId) return;
  const set = childrenByParent.get(parentId) || new Set<string>();
  if (!set.has(nodeId)) {
    const next = new Set(set);
    next.add(nodeId);
    childrenByParent.set(parentId, next);
  }
}

export function buildVisibleRows(
  pageRootId: string,
  nodesById: Map<string, TreeNode>,
  childrenByParent: Map<string, Set<string>>,
  expandedIds: readonly string[],
): TreeNodeData[] {
  const out: TreeNodeData[] = [];
  const expanded = new Set<string>(expandedIds);

  const walk = (parentId: string, depth: number) => {
    const ids = childrenByParent.get(parentId) || new Set<string>();
    for (const id of ids) {
      const node = nodesById.get(id);
      if (!node) continue;
      const hasChildren = (childrenByParent.get(id)?.size || 0) > 0;
      out.push({ ...(node as any), id, nodeType: node.nodeType, depth, hasChildren });
      if (expanded.has(id)) walk(id, depth + 1);
    }
  };

  walk(pageRootId, 1);
  return out;
}
