import type { CanonicalBuildInputSource } from '@hierarchidb/build-api';
import type { NodeId, TreeId } from '@hierarchidb/core-types';
import { toNodeType } from '@hierarchidb/core-types';
import { composeStepConfigs } from '@hierarchidb/plugin-base';
import type { TreeNode } from '@hierarchidb/tree-api';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { loadUIPlugin } from '~/plugin-loaders/uiPluginLoaderUtils';
import {
  type BuildJobQueue,
  type BuildQueueEntryDraft,
  createBuildJobQueue,
  openBuildJobQueueSurface,
  startBuildJobQueue,
} from './buildJobQueue.ts';
import { createBuildQueueKey } from './buildQueueConstants.ts';

export type BuildStepTarget = {
  stepId: 'build' | 'data-source';
  stepNumber: number;
  shouldAutoStart: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const folderNodeTypeAliases = new Set<string>([
  'folder',
  'folder-plugin',
  'ProjectFolder',
  'ResourceFolder',
  'ProjectsRoot',
  'ResourcesRoot',
  'ProjectsArchiveRoot',
  'ResourcesArchiveRoot',
]);

const isFolderNodeType = (nodeType?: string | null): boolean => {
  if (!nodeType) return false;
  if (folderNodeTypeAliases.has(nodeType)) return true;
  const normalized = nodeType.trim();
  if (folderNodeTypeAliases.has(normalized)) return true;
  return /folder$/i.test(normalized);
};

export const mergeNodeData = (node?: TreeNode | null): Record<string, unknown> => {
  if (!node) return {};
  const draft = isRecord(node.draftData) ? node.draftData : {};
  return { ...draft };
};

export const resolveBuildStepTarget = async (
  nodeType: string,
  mergedData: Record<string, unknown>
): Promise<BuildStepTarget | null> => {
  const composed = composeStepConfigs(nodeType, 'edit', mergedData);
  const configs = composed.configs ?? [];
  const isBuildLikeStep = (cfgId: string, type: string): boolean => {
    if (cfgId === 'build') return true;
    if (type === 'styler' && cfgId === 'data-source') return true;
    return false;
  };

  const targetIndex = configs.findIndex((cfg) => isBuildLikeStep(cfg.id, nodeType));
  if (targetIndex < 0) return null;
  const stepConfig = configs[targetIndex];
  const stepId = stepConfig?.id === 'build' ? 'build' : 'data-source';
  const stepNumber = targetIndex + 1 + (composed.hasHostBase ? 0 : 1);

  const shouldAutoStart = await (async () => {
    const evaluateAutoStart = async (): Promise<boolean> => {
      if (!stepConfig?.capabilities?.canStartBuild) return true;
      const result = await Promise.resolve(stepConfig.capabilities.canStartBuild(mergedData));
      return Boolean(result);
    };

    try {
      return await evaluateAutoStart();
    } catch {
      return false;
    }
  })();

  return { stepId, stepNumber, shouldAutoStart };
};

const isBuildRequired = (node: TreeNode): boolean =>
  Boolean(node.draftMetadata?.buildMetadata?.buildRequired) ||
  Boolean(node.metadata?.buildMetadata?.buildRequired);

type FolderQueryApi = {
  listDescendants: (nodeId: NodeId) => Promise<TreeNode[]>;
};

const DEFAULT_BUILD_INPUT_SOURCE: CanonicalBuildInputSource = 'working-copy';

const collectBuildTargetsFromDescendants = async (params: {
  folderNode: TreeNode;
  queryAPI: FolderQueryApi;
}): Promise<BuildQueueEntryDraft[]> => {
  const { folderNode, queryAPI } = params;
  const targets: BuildQueueEntryDraft[] = [];
  const descendants = await queryAPI.listDescendants(folderNode.id as NodeId);
  for (const item of descendants) {
    const itemType = String(item.nodeType ?? '');
    if (isFolderNodeType(itemType)) continue;
    if (!isBuildRequired(item)) continue;
    await loadUIPlugin(itemType).catch(() => false);
    const target = await resolveBuildStepTarget(itemType, mergeNodeData(item));
    if (!target) continue;
    if (!target.shouldAutoStart) continue;
    targets.push({
      targetNodeId: item.id as NodeId,
      nodeType: itemType,
      inputSource: DEFAULT_BUILD_INPUT_SOURCE,
      stepId: target.stepId,
      stepNumber: target.stepNumber,
      shouldAutoStart: target.shouldAutoStart,
    });
  }
  return targets;
};

export const buildDialogUrl = (params: {
  treeId: TreeId;
  pageNodeId: NodeId;
  targetNodeId: NodeId;
  nodeType: string;
  stepNumber: number;
  returnTo: string;
  buildQueueKey?: string | null;
  buildJobId?: string | null;
  buildJobEntryId?: string | null;
  buildQueued?: boolean;
}): string => {
  const basePath = `/d/${params.treeId}/${params.pageNodeId}/${params.targetNodeId}/${params.nodeType}/edit/normal/${params.stepNumber}`;
  const search = new URLSearchParams();
  if (params.buildQueued) {
    search.set('build', '1');
  }
  if (params.returnTo) {
    search.set('returnTo', params.returnTo);
  }
  if (params.buildQueueKey) {
    search.set('buildQueue', params.buildQueueKey);
  }
  if (params.buildJobId) {
    search.set('buildJob', params.buildJobId);
  }
  if (params.buildJobEntryId) {
    search.set('buildJobEntry', params.buildJobEntryId);
  }
  return `${basePath}?${search.toString()}`;
};

export const collectBuildTargetsForFolder = async (params: {
  folderNode: TreeNode;
  workerClient: {
    getQueryAPI: () => Promise<{
      listDescendants: (nodeId: NodeId) => Promise<TreeNode[]>;
    }>;
  };
}): Promise<BuildQueueEntryDraft[]> => {
  const { folderNode, workerClient } = params;
  const queryAPI = await workerClient.getQueryAPI();
  return collectBuildTargetsFromDescendants({
    folderNode,
    queryAPI,
  });
};

export const createBuildJobQueueForFolder = async (params: {
  treeId: TreeId;
  pageNodeId: NodeId;
  folderNode: TreeNode;
  returnTo: string;
  workerClient: {
    getQueryAPI: () => Promise<{
      listDescendants: (nodeId: NodeId) => Promise<TreeNode[]>;
    }>;
  };
}): Promise<BuildJobQueue | null> => {
  const { treeId, pageNodeId, folderNode, returnTo, workerClient } = params;
  const targets = await collectBuildTargetsForFolder({
    folderNode,
    workerClient,
  });
  if (targets.length === 0) return null;
  const queueId = createBuildQueueKey();
  const entries = targets.map((target, index) => {
    const entryId = `${queueId}:${index + 1}`;
    return {
      ...target,
      displayUrl: buildDialogUrl({
        treeId,
        pageNodeId,
        targetNodeId: target.targetNodeId,
        nodeType: target.nodeType,
        stepNumber: target.stepNumber,
        returnTo,
        buildJobId: queueId,
        buildJobEntryId: entryId,
      }),
    } satisfies BuildQueueEntryDraft;
  });
  const job = createBuildJobQueue({
    treeId,
    ownerNodeId: folderNode.id as NodeId,
    entries,
    mode: 'web-ui',
    queueId,
  });
  return job;
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
    const job = await createBuildJobQueueForFolder({
      treeId,
      pageNodeId,
      folderNode: node,
      returnTo,
      workerClient,
    });
    if (!job) return;
    openBuildJobQueueSurface(job.queueId);
    const bridge = getBuildWorkerBridge();
    void startBuildJobQueue(job.queueId, {
      initialize: () => bridge.initialize(),
      startBuildSession: (entryNodeType, nodeId, inputSource) =>
        bridge.startBuildSession(toNodeType(entryNodeType), nodeId, inputSource),
      getBuildSessionStatus: (entryNodeType, nodeId) =>
        bridge.getBuildSessionStatus(toNodeType(entryNodeType), nodeId),
    }).catch((error) => {
      console.warn('[buildFlow] folder build job failed', error);
    });
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
    buildQueued: target.shouldAutoStart,
  });
  navigate(url);
};
