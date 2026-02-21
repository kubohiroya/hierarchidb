import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import { composeStepConfigs } from '@hierarchidb/plugin-base';
import { isFolderNodeType } from '@hierarchidb/ui-plugin-shell/ui-treeconsole-breadcrumb';
import { loadUIPlugin } from '~/plugin-loaders/ui-plugin-loader';
import { createBuildQueue, createBuildQueueKey } from './buildQueue.ts';

export type BuildStepTarget = {
  stepId: 'build' | 'data-source';
  stepNumber: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const mergeNodeData = (node?: TreeNode | null): Record<string, unknown> => {
  if (!node) return {};
  const draft = isRecord(node.draftData) ? node.draftData : {};
  return { ...draft };
};

export const resolveBuildStepTarget = (
  nodeType: string,
  mergedData: Record<string, unknown>
): BuildStepTarget | null => {
  const composed = composeStepConfigs(nodeType, 'edit', mergedData);
  const configs = composed.configs ?? [];
  const buildIndex = configs.findIndex((cfg) => cfg.id === 'build');
  const dataSourceIndex = configs.findIndex((cfg) => cfg.id === 'data-source');
  const targetIndex = buildIndex >= 0 ? buildIndex : dataSourceIndex;
  if (targetIndex < 0) return null;
  const stepId = configs[targetIndex]?.id === 'build' ? 'build' : 'data-source';
  const stepNumber = targetIndex + 1 + (composed.hasHostBase ? 0 : 1);
  return { stepId, stepNumber };
};

const isBuildRequired = (node: TreeNode): boolean =>
  Boolean(node.draftMetadata?.buildMetadata?.buildRequired) ||
  Boolean(node.metadata?.buildMetadata?.buildRequired);

type FolderQueryApi = {
  listDescendants: (nodeId: NodeId) => Promise<TreeNode[]>;
};

const collectBuildUrlsFromDescendants = async (params: {
  treeId: TreeId;
  pageNodeId: NodeId;
  folderNode: TreeNode;
  returnTo: string;
  queueKey: string;
  queryAPI: FolderQueryApi;
}): Promise<string[]> => {
  const { treeId, pageNodeId, folderNode, returnTo, queueKey, queryAPI } = params;
  const urls: string[] = [];
  const descendants = await queryAPI.listDescendants(folderNode.id as NodeId);
  for (const item of descendants) {
    const itemType = String(item.nodeType ?? '');
    if (isFolderNodeType(itemType)) continue;
    if (!isBuildRequired(item)) continue;
    await loadUIPlugin(itemType).catch(() => false);
    const target = resolveBuildStepTarget(itemType, mergeNodeData(item));
    if (!target) continue;
    urls.push(
      buildDialogUrl({
        treeId,
        pageNodeId,
        targetNodeId: item.id as NodeId,
        nodeType: itemType,
        stepNumber: target.stepNumber,
        returnTo,
        buildQueueKey: queueKey,
      })
    );
  }
  return urls;
};

export const buildDialogUrl = (params: {
  treeId: TreeId;
  pageNodeId: NodeId;
  targetNodeId: NodeId;
  nodeType: string;
  stepNumber: number;
  returnTo: string;
  buildQueueKey?: string | null;
}): string => {
  const basePath = `/t/${params.treeId}/${params.pageNodeId}/${params.targetNodeId}/${params.nodeType}/edit/normal/${params.stepNumber}`;
  const search = new URLSearchParams();
  search.set('build', '1');
  if (params.returnTo) {
    search.set('returnTo', params.returnTo);
  }
  if (params.buildQueueKey) {
    search.set('buildQueue', params.buildQueueKey);
  }
  return `${basePath}?${search.toString()}`;
};

export const collectBuildUrlsForFolder = async (params: {
  treeId: TreeId;
  pageNodeId: NodeId;
  folderNode: TreeNode;
  returnTo: string;
  workerClient: {
    getQueryAPI: () => Promise<{
      listDescendants: (nodeId: NodeId) => Promise<TreeNode[]>;
    }>;
  };
}): Promise<{ urls: string[]; queueKey: string }> => {
  const { treeId, pageNodeId, folderNode, returnTo, workerClient } = params;
  const queryAPI = await workerClient.getQueryAPI();
  const queueKey = createBuildQueueKey();
  const urls = await collectBuildUrlsFromDescendants({
    treeId,
    pageNodeId,
    folderNode,
    returnTo,
    queueKey,
    queryAPI,
  });
  return { urls, queueKey };
};

export const resolveBuildTargetForNode = async (params: {
  node: TreeNode;
  workerClient: {
    getQueryAPI: () => Promise<{ getNode: (nodeId: NodeId) => Promise<TreeNode | undefined> }>;
  } | null;
}): Promise<BuildStepTarget | null> => {
  const { node, workerClient } = params;
  const nodeType = String(node?.nodeType ?? '');
  if (!node?.id || !nodeType) return null;
  if (isFolderNodeType(nodeType)) return null;
  await loadUIPlugin(nodeType).catch(() => false);
  const queryAPI = workerClient ? await workerClient.getQueryAPI() : null;
  const latest = queryAPI ? await queryAPI.getNode(node.id as NodeId) : undefined;
  const mergedData = mergeNodeData(latest ?? node);
  return resolveBuildStepTarget(nodeType, mergedData);
};

export const startBuildFlow = async (params: {
  treeId: TreeId;
  pageNodeId: NodeId;
  node: TreeNode;
  returnTo: string;
  workerClient: {
    getQueryAPI: () => Promise<{
      getNode: (nodeId: NodeId) => Promise<TreeNode | undefined>;
      listDescendants: (nodeId: NodeId) => Promise<TreeNode[]>;
    }>;
  } | null;
  navigate: (to: string) => void;
}): Promise<void> => {
  const { treeId, pageNodeId, node, returnTo, workerClient, navigate } = params;
  const nodeType = String(node.nodeType ?? '');
  if (!node?.id || !nodeType) return;
  if (isFolderNodeType(nodeType)) {
    if (!workerClient) return;
    const { urls, queueKey } = await collectBuildUrlsForFolder({
      treeId,
      pageNodeId,
      folderNode: node,
      returnTo,
      workerClient,
    });
    if (!urls.length) return;
    const storedKey = createBuildQueue(urls, returnTo, treeId, queueKey);
    const startUrl = urls[0];
    if (!storedKey || !startUrl) return;
    navigate(startUrl);
    return;
  }
  const target = await resolveBuildTargetForNode({ node, workerClient });
  if (!target?.stepNumber) return;
  const url = buildDialogUrl({
    treeId,
    pageNodeId,
    targetNodeId: node.id as NodeId,
    nodeType,
    stepNumber: target.stepNumber,
    returnTo,
  });
  navigate(url);
};
