import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { NodeTagAssociation, TagEntity } from '@hierarchidb/tag-api';
import { getTreeNodeName, type TreeNode } from '@hierarchidb/tree-api';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { useCallback, useMemo } from 'react';
import { useWorker } from '~/contexts/WorkerProvider.js';
import { useQuery } from '~/hooks/useQuery.js';

export interface TaggedNode {
  node: TreeNode;
  treeId?: TreeId;
  tagAssociation: NodeTagAssociation;
  breadcrumb: string;
  breadcrumbNodes: BreadcrumbNode[];
}

export interface TagWithUsage extends TagEntity {
  usageCount: number;
}

const TAG_CACHE_TTL_MS = 60_000;

const allTagsCache: { data: TagEntity[] | null; ts: number } = {
  data: null,
  ts: 0,
};

const specificTagCache = new Map<string, { data: TagEntity | null; ts: number }>();
const taggedNodesCache = new Map<string, { data: TaggedNode[]; ts: number }>();

const isFresh = (ts: number) => Date.now() - ts < TAG_CACHE_TTL_MS;

function buildBreadcrumbNodes(nodes: TreeNode[]): BreadcrumbNode[] {
  return nodes.map((node) => ({
    id: node.id,
    treeNodeId: node.id,
    nodeType: node.nodeType,
    name: getTreeNodeName(node),
    isClickable: true,
  }));
}

function isDraftNode(node?: TreeNode): boolean {
  return typeof (node as { draftMetadata?: unknown })?.draftMetadata !== 'undefined' &&
    (node as { draftMetadata?: unknown }).draftMetadata !== null;
}

function isInTrash(ancestors: TreeNode[], node?: TreeNode): boolean {
  if (node?.nodeType === 'trash') return true;
  return ancestors.some((ancestor) => ancestor.nodeType === 'trash');
}

function selectEffectiveAssociations(
  associations: NodeTagAssociation[]
): Map<string, NodeTagAssociation> {
  const effective = new Map<string, NodeTagAssociation>();
  for (const assoc of associations) {
    const key = String(assoc.nodeId);
    const current = effective.get(key);
    if (!current || (current.scope !== 'draft' && assoc.scope === 'draft')) {
      effective.set(key, assoc);
    }
  }
  return effective;
}

function normalizeTagName(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function useTagsPage(tagName?: string) {
  const { client: workerClient, isConnected } = useWorker();
  const normalizedTagName = normalizeTagName(tagName);
  const cachedAllTags = allTagsCache.data && isFresh(allTagsCache.ts) ? allTagsCache.data : null;
  const cachedSpecificEntry = normalizedTagName
    ? specificTagCache.get(normalizedTagName)
    : undefined;
  const cachedSpecificTag =
    cachedSpecificEntry && isFresh(cachedSpecificEntry.ts) ? cachedSpecificEntry.data : null;
  const cachedTaggedNodesEntry = normalizedTagName
    ? taggedNodesCache.get(normalizedTagName)
    : undefined;
  const cachedTaggedNodes =
    cachedTaggedNodesEntry && isFresh(cachedTaggedNodesEntry.ts)
      ? cachedTaggedNodesEntry.data
      : null;

  const fetchAllTags = useCallback(async () => {
    if (!workerClient) throw new Error('Worker not connected');
    if (allTagsCache.data && isFresh(allTagsCache.ts)) {
      return allTagsCache.data;
    }
    const tagAPI = await workerClient.getTagAPI();
    const all = await tagAPI.getAllTags();
    allTagsCache.data = all;
    allTagsCache.ts = Date.now();
    return all;
  }, [workerClient]);

  const { data: allTags = [], isLoading: isLoadingTags } = useQuery<TagEntity[]>({
    queryKey: ['tags', 'all'],
    queryFn: fetchAllTags,
    enabled: isConnected && !cachedAllTags,
    initialData: cachedAllTags ?? [],
  });

  const fetchUsageCounts = useCallback(async () => {
    if (!workerClient) throw new Error('Worker not connected');
    const tagAPI = await workerClient.getTagAPI();
    const queryAPI = await workerClient.getQueryAPI();
    const nodeCache = new Map<string, TreeNode | undefined>();
    const ancestorCache = new Map<string, TreeNode[]>();
    const draftScopeCache = new Map<string, boolean>();

    const getNode = async (nodeId: NodeId) => {
      const key = String(nodeId);
      if (nodeCache.has(key)) return nodeCache.get(key);
      const node = await queryAPI.getNode(nodeId);
      nodeCache.set(key, node ?? undefined);
      return node ?? undefined;
    };

    const getAncestors = async (nodeId: NodeId) => {
      const key = String(nodeId);
      if (ancestorCache.has(key)) return ancestorCache.get(key) ?? [];
      const ancestors = await queryAPI.listAncestors(nodeId);
      ancestorCache.set(key, ancestors);
      return ancestors;
    };

    const hasDraftAssociations = async (nodeId: NodeId) => {
      const key = String(nodeId);
      if (draftScopeCache.has(key)) return draftScopeCache.get(key) ?? false;
      const associations = await tagAPI.getTagAssociationsForNode(nodeId);
      const hasDraft = associations.some((assoc) => assoc.scope === 'draft');
      draftScopeCache.set(key, hasDraft);
      return hasDraft;
    };

    const counts = new Map<string, number>();
    await Promise.all(
      allTags.map(async (tag) => {
        const associations = await tagAPI.getNodesByTag(tag.id);
        const effective = selectEffectiveAssociations(associations);
        let count = 0;
        for (const assoc of effective.values()) {
          if (assoc.scope === 'published') {
            const hasDraft = await hasDraftAssociations(assoc.nodeId);
            if (hasDraft) continue;
          }
          const node = await getNode(assoc.nodeId);
          if (!node) continue;
          if (isDraftNode(node)) continue;
          const ancestors = await getAncestors(assoc.nodeId);
          if (isInTrash(ancestors, node)) continue;
          count += 1;
        }
        counts.set(String(tag.id), count);
      })
    );
    return counts;
  }, [allTags, workerClient]);

  const { data: usageCounts = new Map<string, number>() } = useQuery<
    Map<string, number>
  >({
    queryKey: ['tags', 'usage-counts', allTags.length],
    queryFn: fetchUsageCounts,
    enabled: isConnected && allTags.length > 0,
  });

  const tagsWithUsage = useMemo<TagWithUsage[]>(() => {
    return allTags.map((tag) => ({
      ...tag,
      usageCount: usageCounts.get(String(tag.id)) ?? 0,
    }));
  }, [allTags, usageCounts]);

  const fetchSpecificTag = useCallback(async () => {
    if (!normalizedTagName) return null;
    if (!workerClient) throw new Error('Worker not connected');
    const cached = specificTagCache.get(normalizedTagName);
    if (cached && isFresh(cached.ts)) {
      return cached.data;
    }
    const tagAPI = await workerClient.getTagAPI();
    const candidates = await tagAPI.searchTags(tagName ?? '');
    const exact = candidates.find(
      (tag) => tag.name.trim().toLowerCase() === normalizedTagName
    );
    if (exact) {
      specificTagCache.set(normalizedTagName, { data: exact, ts: Date.now() });
      return exact;
    }
    const all = await tagAPI.getAllTags();
    const fallback = all.find(
      (tag) => tag.name.trim().toLowerCase() === normalizedTagName
    );
    const resolved = fallback ?? null;
    specificTagCache.set(normalizedTagName, { data: resolved, ts: Date.now() });
    return resolved;
  }, [normalizedTagName, tagName, workerClient]);

  const { data: specificTag = null, isLoading: isLoadingTag } = useQuery<TagEntity | null>({
    queryKey: ['tag', normalizedTagName],
    queryFn: fetchSpecificTag,
    enabled: !!normalizedTagName && isConnected && cachedSpecificTag === null,
    initialData: cachedSpecificTag ?? null,
  });

  const fetchTaggedNodes = useCallback(async (): Promise<TaggedNode[]> => {
    if (!specificTag) return [];
    if (!workerClient) throw new Error('Worker not connected');
    if (normalizedTagName) {
      const cached = taggedNodesCache.get(normalizedTagName);
      if (cached && isFresh(cached.ts)) {
        return cached.data;
      }
    }
    const tagAPI = await workerClient.getTagAPI();
    const associations = await tagAPI.getNodesByTag(specificTag.id);
    const draftScopeCache = new Map<string, boolean>();

    const taggedNodesData: TaggedNode[] = [];

    const queryAPI = await workerClient.getQueryAPI();
    const trees = await queryAPI.listTrees();
    const rootIdToTreeId = new Map<string, TreeId>(
      trees.map((tree) => [String(tree.rootId), tree.id])
    );

    const effective = selectEffectiveAssociations(associations);
    for (const association of effective.values()) {
      try {
        if (!workerClient) throw new Error('Worker not connected');
        if (association.scope === 'published') {
          const nodeKey = String(association.nodeId);
          let hasDraft = draftScopeCache.get(nodeKey);
          if (typeof hasDraft === 'undefined') {
            const nodeAssociations = await tagAPI.getTagAssociationsForNode(
              association.nodeId
            );
            hasDraft = nodeAssociations.some((assoc) => assoc.scope === 'draft');
            draftScopeCache.set(nodeKey, hasDraft);
          }
          if (hasDraft) {
            continue;
          }
        }
        const node = await queryAPI.getNode(association.nodeId);

        if (node) {
          if (isDraftNode(node)) {
            continue;
          }
          const ancestors = await queryAPI.listAncestors(association.nodeId);
          if (isInTrash(ancestors, node)) {
            continue;
          }
          const breadcrumbNodes = [...ancestors, node];
          const breadcrumb = breadcrumbNodes.map((item) => getTreeNodeName(item)).join(' / ');
          const breadcrumbNodePath = buildBreadcrumbNodes(breadcrumbNodes);
          const rootNode = ancestors[0] ?? node;
          const treeId = rootIdToTreeId.get(String(rootNode.id));

          taggedNodesData.push({
            node,
            treeId,
            tagAssociation: association,
            breadcrumb,
            breadcrumbNodes: breadcrumbNodePath,
          });
        }
      } catch (error) {
        console.warn('Failed to load node:', association.nodeId, error);
      }
    }

    if (normalizedTagName) {
      taggedNodesCache.set(normalizedTagName, { data: taggedNodesData, ts: Date.now() });
    }
    return taggedNodesData;
  }, [normalizedTagName, specificTag, workerClient]);

  const { data: taggedNodes = [], isLoading: isLoadingNodes } = useQuery<TaggedNode[]>({
    queryKey: ['tag', normalizedTagName, 'nodes'],
    queryFn: fetchTaggedNodes,
    enabled: !!specificTag && isConnected && !cachedTaggedNodes,
    initialData: cachedTaggedNodes ?? [],
  });

  return {
    allTags: tagsWithUsage,
    isConnected,
    isLoadingNodes,
    isLoadingTag,
    isLoadingTags,
    specificTag,
    taggedNodes,
  };
}
