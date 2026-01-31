import type { TreeNode } from '@hierarchidb/tree-api';
import type { MapLibreLayer, MapLibreStyle } from '@hierarchidb/ui-map';

export type TreeNodeLike = Pick<TreeNode, 'id' | 'parentId' | 'nodeType' | 'metadata'>;

export type OrderedTreeNode = {
  id: string;
  nodeType: string;
  name: string;
  absolutePath: string;
  rootId: string;
};

export type StylerStyleInput = {
  nodeId: string;
  absolutePath: string;
  styleSpec?: MapLibreStyle | null;
};

type MapLibreStyleWithVersion = MapLibreStyle & { version?: number };

const toId = (value: unknown): string => String(value ?? '');

const getNodeName = (node?: TreeNodeLike): string => {
  const name = node?.metadata?.name;
  return name ? String(name) : toId(node?.id);
};

const getStyleSpecVersion = (styleSpec?: MapLibreStyle | null): number | undefined => {
  const candidate = styleSpec as MapLibreStyleWithVersion | null | undefined;
  return typeof candidate?.version === 'number' ? candidate.version : undefined;
};

const buildNodeChain = (nodeId: string, nodeById: Map<string, TreeNodeLike>): TreeNodeLike[] => {
  const chain: TreeNodeLike[] = [];
  let currentId = nodeId;
  const seen = new Set<string>();

  while (currentId && !seen.has(currentId)) {
    const node = nodeById.get(currentId);
    if (!node) break;
    chain.unshift(node);
    seen.add(currentId);
    const parentId = node.parentId ? toId(node.parentId) : '';
    if (!parentId) break;
    currentId = parentId;
  }

  return chain;
};

export const buildAbsolutePath = (nodeId: string, nodeById: Map<string, TreeNodeLike>): string => {
  const chain = buildNodeChain(nodeId, nodeById);
  if (!chain.length) return `/${toId(nodeId)}`;
  const parts = chain.map((node) => getNodeName(node) || toId(node.id));
  return `/${parts.join('/')}`;
};

export const getNonOverlappingBranchRoots = (
  selectedIds: string[],
  nodeById: Map<string, TreeNodeLike>
): string[] => {
  const uniqueIds = Array.from(new Set(selectedIds.map((id) => toId(id))));
  const selectedSet = new Set(uniqueIds);

  const roots = uniqueIds
    .filter((id) => {
      const chain = buildNodeChain(id, nodeById);
      const ancestors = chain.slice(0, -1).map((node) => toId(node.id));
      return !ancestors.some((ancestorId) => selectedSet.has(ancestorId));
    })
    .map((id) => ({
      id,
      path: buildAbsolutePath(id, nodeById),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return roots.map((root) => root.id);
};

const buildChildMap = (nodeById: Map<string, TreeNodeLike>): Map<string, string[]> => {
  const childMap = new Map<string, string[]>();
  nodeById.forEach((node) => {
    const parentId = node.parentId ? toId(node.parentId) : '';
    const bucket = childMap.get(parentId);
    if (bucket) {
      bucket.push(toId(node.id));
    } else {
      childMap.set(parentId, [toId(node.id)]);
    }
  });
  return childMap;
};

const collectDescendantIds = (
  rootId: string,
  childMap: Map<string, string[]>
): string[] => {
  const ids: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    ids.push(current);
    const children = childMap.get(current) ?? [];
    children.forEach((child) => queue.push(child));
  }

  return ids;
};

export const collectOrderedNodesByType = ({
  rootIds,
  nodeById,
  allowedTypes,
}: {
  rootIds: string[];
  nodeById: Map<string, TreeNodeLike>;
  allowedTypes: string[];
}): Record<string, OrderedTreeNode[]> => {
  const types = new Set(allowedTypes);
  const result: Record<string, OrderedTreeNode[]> = {};
  allowedTypes.forEach((type) => {
    result[type] = [];
  });

  const childMap = buildChildMap(nodeById);

  rootIds.forEach((rootId) => {
    const descendants = collectDescendantIds(rootId, childMap);
    descendants.forEach((nodeId) => {
      const node = nodeById.get(nodeId);
      const nodeType = node?.nodeType ? String(node.nodeType) : '';
      if (!node || !types.has(nodeType)) return;
      result[nodeType]?.push({
        id: toId(node.id),
        nodeType,
        name: getNodeName(node),
        absolutePath: buildAbsolutePath(toId(node.id), nodeById),
        rootId,
      });
    });
  });

  Object.values(result).forEach((nodes) => {
    nodes.sort((a, b) => a.absolutePath.localeCompare(b.absolutePath));
  });

  return result;
};

export const combineStylerStyleSpecs = (inputs: StylerStyleInput[]): MapLibreStyle => {
  const ordered = inputs
    .filter((entry) => entry.styleSpec && entry.styleSpec.layers?.length)
    .slice()
    .sort((a, b) => a.absolutePath.localeCompare(b.absolutePath));

  const combined: MapLibreStyleWithVersion = {
    version: getStyleSpecVersion(ordered[0]?.styleSpec) ?? 8,
    sources: {},
    layers: [],
  };

  ordered.forEach((entry) => {
    const spec = entry.styleSpec;
    if (!spec) return;
    if (spec.sources) {
      combined.sources = { ...(combined.sources ?? {}), ...spec.sources };
    }
    if (spec.layers?.length) {
      combined.layers = [...(combined.layers ?? []), ...spec.layers] as MapLibreLayer[];
    }
  });

  return combined;
};
