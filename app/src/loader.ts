import {
  type NodeAction,
  type NodeId,
  type NodeType,
  type Tree,
  type TreeId,
  type TreeNode,
} from '@hierarchidb/common-core';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { useRouteLoaderData } from 'react-router';
import { loadAppConfig } from '~/loadAppConfig';
import type { LoadAppConfigReturn } from '~/loadAppConfig';
export type { LoadAppConfigReturn };

export type LoadWorkerAPIClientReturn = {
  client: WorkerAPI; // Worker API instance
};

export type LoadTreeArgs = {
  treeId: string;
};
export type LoadTreeReturn = {
  tree: Tree | undefined;
} & LoadWorkerAPIClientReturn;

export type LoadPageNodeArgs = {
  treeId: string;
  nodeId: string;
};
export type LoadPageNodeReturn = {
  pageNodeId: NodeId;
  pageNode: TreeNode | undefined;
} & LoadTreeReturn;

export type LoadTargetNodeArgs = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
};
export type LoadTargetNodeReturn = {
  targetNode: TreeNode | undefined;
} & LoadPageNodeReturn;

export type LoadNodeTypeArgs = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
  nodeType: string;
};
export type LoadNodeTypeReturn = {
  nodeType: NodeType | undefined;
} & LoadTargetNodeReturn;

export type LoadNodeActionArgs = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
  nodeType: string;
  action: string;
};
export type LoadNodeActionReturn = {
  action: NodeAction | undefined;
} & LoadNodeTypeReturn;

export async function loadWorkerAPIClient(): Promise<LoadWorkerAPIClientReturn> {
  console.log('[loadWorkerAPIClient] Getting Worker client...');
  const appConfig = loadAppConfig();

  try {
    // WorkerAPIClientを取得（WorkerProviderで既に初期化済み）
    const { WorkerAPIClient } = await import('./WorkerAPIClient');

    // WorkerProviderで初期化されていない場合のフォールバック
    // （開発中やテスト環境での直接アクセス用）
    if (!WorkerAPIClient.isReady()) {
      console.warn('[loadWorkerAPIClient] Worker not initialized by provider, initializing now...');
      await WorkerAPIClient.initialize();
    }

    // 同期的に取得 - WorkerAPIClientは既にworkerインスタンスを返す
    const client = WorkerAPIClient.getSingleton();
    console.log('[loadWorkerAPIClient] Worker client obtained successfully');

    return {
      ...appConfig,
      client,
    };
  } catch (error) {
    console.error('[loadWorkerAPIClient] Failed to get Worker client:', error);
    // エラーを詳細に記録
    if (error instanceof Error) {
      console.error('[loadWorkerAPIClient] Error message:', error.message);
      console.error('[loadWorkerAPIClient] Error stack:', error.stack);
    }
    throw error;
  }
}

export async function loadTree({ treeId }: LoadTreeArgs): Promise<LoadTreeReturn> {
  console.log('[loadTree] Loading tree with ID:', treeId);
  const workerAPIClientReturn = await loadWorkerAPIClient();
  if (!treeId) {
    throw new Error('treeId is required');
  }

  const client = workerAPIClientReturn.client;
  console.log('[loadTree] Got client, calling getTree with treeId:', treeId);
  console.log('[loadTree] Client type:', typeof client);
  console.log('[loadTree] getTree method type:', typeof client.getTree);
  
  let tree;
  try {
    tree = await client.getTree({
      treeId: treeId as TreeId,
    });

    console.log('[loadTree] Loaded tree:', tree);
  } catch (error) {
    console.error('[loadTree] Error calling getTree:', error);
    throw error;
  }

  return {
    client: workerAPIClientReturn.client,
    tree,
  };
}

export async function loadPageNode({
  treeId,
  nodeId,
}: LoadPageNodeArgs): Promise<LoadPageNodeReturn> {
  const loadTreeReturn = await loadTree({ treeId });
  const resolvedPageId = (nodeId || `${treeId}Root`) as NodeId;
  const pageNode = await loadTreeReturn.client.getNode(resolvedPageId);

  return {
    ...loadTreeReturn,
    pageNodeId: resolvedPageId,
    pageNode,
  };
}

export async function loadTargetNode({
  treeId,
  pageNodeId,
  targetNodeId,
}: LoadTargetNodeArgs): Promise<LoadTargetNodeReturn> {
  const loadPageNodeReturn = await loadPageNode({
    treeId,
    nodeId: pageNodeId,
  });
  return {
    ...loadPageNodeReturn,
    targetNode: await loadPageNodeReturn.client.getNode(
      (targetNodeId || pageNodeId || `${treeId}Root`) as NodeId
    ),
  };
}

export async function loadNodeType({
  treeId,
  pageNodeId,
  targetNodeId,
  nodeType,
}: LoadNodeTypeArgs): Promise<LoadNodeTypeReturn> {
  const loadTargetNodeReturn = await loadTargetNode({
    treeId,
    pageNodeId,
    targetNodeId,
  });
  return {
    ...loadTargetNodeReturn,
    nodeType: nodeType as NodeType | undefined,
  };
}

export async function loadNodeAction({
  treeId,
  pageNodeId,
  targetNodeId,
  nodeType,
  action,
}: LoadNodeActionArgs): Promise<LoadNodeActionReturn> {
  const loadNodeTypeReturn = await loadNodeType({
    treeId,
    pageNodeId,
    targetNodeId,
    nodeType,
  });
  return {
    ...loadNodeTypeReturn,
    action: action as NodeAction | undefined,
  };
}

export function useAppConfig(): LoadAppConfigReturn {
  return loadAppConfig();
}

export function useWorkerAPIClient() {
  return useRouteLoaderData('t') as any; // Returns the worker proxy instance
}

export function useTree(): Tree | undefined {
  return useRouteLoaderData('t/($treeId)');
}

export function usePageNode(): TreeNode | undefined {
  return useRouteLoaderData('t/($treeId)/($pageNodeId)');
}

export function useTargetNode(): TreeNode | undefined {
  return useRouteLoaderData('t/($treeId)/($pageNodeId)/($targetNodeId)');
}

export function useNodeType(): NodeType | undefined {
  return useRouteLoaderData('t/($treeId)/($pageNodeId)/($targetNodeId)/($nodeType)');
}

export function useNodeTAction(): NodeAction | undefined {
  return useRouteLoaderData('t/($treeId)/($pageNodeId)/($targetNodeId)/($nodeType)/($action)');
}
