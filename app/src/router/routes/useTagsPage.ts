import type { TreeId } from '@hierarchidb/core-types';
import type { NodeTagAssociation, TagEntity } from '@hierarchidb/tag-api';
import { getTreeNodeName, type TreeNode } from '@hierarchidb/tree-api';
import type { BreadcrumbNode } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { useCallback } from 'react';
import { useWorker } from '~/contexts/WorkerProvider.js';
import { useQuery } from '~/hooks/useQuery.js';

export interface TaggedNode {
  node: TreeNode;
  treeId?: TreeId;
  tagAssociation: NodeTagAssociation;
  breadcrumb: string;
  breadcrumbNodes: BreadcrumbNode[];
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

function normalizeTagName(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function useTagsPage(tagName?: string) {
  const { client: workerClient, isConnected } = useWorker();
  const normalizedTagName = normalizeTagName(tagName);

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
    enabled: isConnected,
    initialData: [],
  });

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
    enabled: !!normalizedTagName && isConnected,
    initialData: null,
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

    const taggedNodesData: TaggedNode[] = [];

    const queryAPI = await workerClient.getQueryAPI();
    const trees = await queryAPI.listTrees();
    const rootIdToTreeId = new Map<string, TreeId>(
      trees.map((tree) => [String(tree.rootId), tree.id])
    );

    for (const association of associations) {
      try {
        if (!workerClient) throw new Error('Worker not connected');
        const node = await queryAPI.getNode(association.nodeId);

        if (node) {
          const ancestors = await queryAPI.listAncestors(association.nodeId);
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
    enabled: !!specificTag && isConnected,
    initialData: [],
  });

  return {
    allTags,
    isConnected,
    isLoadingNodes,
    isLoadingTag,
    isLoadingTags,
    specificTag,
    taggedNodes,
  };
}
