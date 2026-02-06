import type { TreeId } from '@hierarchidb/core-types';
import { toTagId, type NodeTagAssociation, type TagEntity, type TagId } from '@hierarchidb/tag-api';
import type { TreeNode } from '@hierarchidb/tree-api';
import { useWorker } from '~/contexts/WorkerProvider.js';
import { useQuery } from '~/hooks/useQuery.js';

export interface TaggedNode {
  node: TreeNode;
  treeId: TreeId;
  tagAssociation: NodeTagAssociation;
}

export function useTagsPage(uuid?: string) {
  const { client: workerClient, isConnected } = useWorker();

  const { data: allTags = [], isLoading: isLoadingTags } = useQuery<TagEntity[]>({
    queryKey: ['tags', 'all'],
    queryFn: async () => {
      if (!workerClient) throw new Error('Worker not connected');
      const tagAPI = await workerClient.getTagAPI();
      return await tagAPI.getAllTags();
    },
    enabled: !uuid && isConnected,
    initialData: [],
  });

  const { data: specificTag = null, isLoading: isLoadingTag } = useQuery<TagEntity | null>({
    queryKey: ['tag', uuid],
    queryFn: async () => {
      if (!uuid) return null;
      if (!workerClient) throw new Error('Worker not connected');
      const tagAPI = await workerClient.getTagAPI();
      const tag = await tagAPI.getTag(toTagId(uuid));
      return tag ?? null;
    },
    enabled: !!uuid && isConnected,
    initialData: null,
  });

  const { data: taggedNodes = [], isLoading: isLoadingNodes } = useQuery<TaggedNode[]>({
    queryKey: ['tag', uuid, 'nodes'],
    queryFn: async (): Promise<TaggedNode[]> => {
      if (!uuid) return [];
      if (!workerClient) throw new Error('Worker not connected');
      const tagAPI = await workerClient.getTagAPI();
      const associations = await tagAPI.getNodesByTag(toTagId(uuid));

      const taggedNodesData: TaggedNode[] = [];

      for (const association of associations) {
        try {
          if (!workerClient) throw new Error('Worker not connected');
          const queryAPI = await workerClient.getQueryAPI();
          const node = await queryAPI.getNode(association.nodeId);

          if (node) {
            const trees = await queryAPI.listTrees();
            let nodeTreeId: TreeId | undefined;

            for (const tree of trees) {
              nodeTreeId = tree.id;
              break;
            }

            if (nodeTreeId) {
              taggedNodesData.push({
                node,
                treeId: nodeTreeId,
                tagAssociation: association,
              });
            }
          }
        } catch (error) {
          console.warn('Failed to load node:', association.nodeId, error);
        }
      }

      return taggedNodesData;
    },
    enabled: !!uuid && isConnected,
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
