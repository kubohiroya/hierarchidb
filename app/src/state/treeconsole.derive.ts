type TreeNodeLike = {
  id?: string | number;
  treeNodeId?: string | number;
};

function toId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function getNodeId(node: TreeNodeLike | null | undefined): string | null {
  if (!node) return null;
  return toId(node.id ?? node.treeNodeId);
}

function removeRecursively(
  nodesById: Map<string, any>,
  childrenByParent: Map<string, Set<string>>,
  nodeId: string,
) {
  nodesById.delete(nodeId);
  const children = childrenByParent.get(nodeId);
  if (!children) return;
  childrenByParent.delete(nodeId);
  for (const childId of children) {
    removeRecursively(nodesById, childrenByParent, childId);
  }
}

export function rebuildAdjacency(
  nodesById: Map<string, any>,
  childrenByParent: Map<string, Set<string>>,
  parentId: string,
  children: any[],
): void {
  const key = toId(parentId) ?? '';
  const nextIds = new Set<string>();

  for (const child of children ?? []) {
    const id = getNodeId(child);
    if (!id) continue;
    nodesById.set(id, child);
    nextIds.add(id);
  }

  const prevIds = childrenByParent.get(key);
  if (prevIds) {
    for (const staleId of prevIds) {
      if (!nextIds.has(staleId)) {
        removeRecursively(nodesById, childrenByParent, staleId);
      }
    }
  }

  childrenByParent.set(key, nextIds);
}

export function buildVisibleRows(
  rootId: string,
  nodesById: Map<string, any>,
  childrenByParent: Map<string, Set<string>>,
  expandedIds: readonly (string | number | undefined)[],
): any[] {
  const expanded = new Set<string>(
    (expandedIds ?? []).map((id) => toId(id) ?? '').filter((id) => id !== ''),
  );

  const result: any[] = [];

  const visit = (parent: string, depth: number) => {
    const children = childrenByParent.get(parent);
    if (!children) return;
    for (const childId of children) {
      const node = nodesById.get(childId);
      if (!node) continue;
      const hasDepth = node && typeof node?.depth === 'number';
      const enriched = hasDepth ? { ...node } : { ...node, depth };
      if (typeof enriched.depth !== 'number') {
        enriched.depth = depth;
      }
      result.push(enriched);
      if (expanded.has(childId)) {
        visit(childId, depth + 1);
      }
    }
  };

  visit(toId(rootId) ?? '', 0);
  return result;
}
