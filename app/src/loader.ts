import {
  type NodeAction,
  type NodeId,
  type NodeType,
  type Tree,
  type TreeId,
  type TreeNode,
} from '@hierarchidb/common-type';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { useRouteLoaderData } from 'react-router';
import { loadAppConfig } from '~/loadAppConfig';
import type { LoadAppConfigReturn } from '~/loadAppConfig';
export type { LoadAppConfigReturn };

export type LoadWorkerAPIClientReturn = {
  client: Remote<WorkerAPI>; // Worker API instance via Comlink
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

/**
 * Retry mechanism for Comlink method calls
 * Handles runtime communication errors that can occur after initial connection
 */
async function retryComlinkCall<T>(
  operation: () => Promise<T>,
  operationName: string,
  retryDelays: number[] = [1000, 2000, 3000]
): Promise<T> {
  for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
    try {

      
      const result = await operation();
      

      
      return result;
      
    } catch (error) {
      console.error(`[${operationName}] Attempt ${attempt + 1} failed:`, error);
      
      // Check if this looks like a Comlink communication error
      const isComlinkError = error instanceof Error && 
        (error.message.includes('Cannot read properties of undefined') ||
         error.message.includes('apply') ||
         error.message.includes('Comlink'));
      
      if (!isComlinkError) {
        // Non-Comlink error, don't retry
        console.error(`[${operationName}] Non-Comlink error detected, not retrying`);
        throw error;
      }
      
      // If this is the last attempt, throw the error
      if (attempt >= retryDelays.length) {
        console.error(`[${operationName}] All retry attempts failed`);
        throw error;
      }
      
      // For Comlink errors, try to recreate the worker connection
      console.warn(`[${operationName}] Comlink error detected, recreating worker connection...`);
      
      try {
        const { WorkerAPIClient } = await import('./WorkerAPIClient');
        WorkerAPIClient.reset(); // Reset the client state
        await WorkerAPIClient.initialize(); // Reinitialize
        console.log(`[${operationName}] Worker connection recreated`);
      } catch (recreationError) {
        console.error(`[${operationName}] Failed to recreate worker connection:`, recreationError);
      }
      
      // Wait before retry
      const delay = retryDelays[attempt];
      console.log(`[${operationName}] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error(`[${operationName}] Maximum retry attempts exceeded`);
}

export async function loadWorkerAPIClient(): Promise<LoadWorkerAPIClientReturn> {
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

  
  if (!treeId) {
    throw new Error('treeId is required');
  }

  const tree = await retryComlinkCall(
    async () => {
      // Get fresh client each time to handle reconnections
      const workerAPIClientReturn = await loadWorkerAPIClient();
      const client = workerAPIClientReturn.client;
      
      // Use facade API instead of deprecated direct method
      const queryAPI = await client.getQueryAPI();
      return queryAPI.getTree(treeId as TreeId);
    },
    'loadTree.getTree'
  );
  


  // Get final client state for return
  const workerAPIClientReturn = await loadWorkerAPIClient();
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

  const pageNode = await retryComlinkCall(
    async () => {
      // Get fresh client and queryAPI for each retry
      const workerAPIClientReturn = await loadWorkerAPIClient();
      const queryAPI = await workerAPIClientReturn.client.getQueryAPI();
      return queryAPI.getNode(resolvedPageId);
    },
    'loadPageNode.getNode'
  );

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

  const targetNode = await retryComlinkCall(
    async () => {
      // Get fresh client and queryAPI for each retry
      const workerAPIClientReturn = await loadWorkerAPIClient();
      const queryAPI = await workerAPIClientReturn.client.getQueryAPI();
      return queryAPI.getNode((targetNodeId || pageNodeId || `${treeId}Root`) as NodeId);
    },
    'loadTargetNode.getNode'
  );

  return {
    ...loadPageNodeReturn,
    targetNode,
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

export function useWorkerAPIClient(): LoadWorkerAPIClientReturn {
  return useRouteLoaderData('t') as LoadWorkerAPIClientReturn;
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
