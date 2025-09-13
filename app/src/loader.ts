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
import { useRouteLoaderData } from 'react-router-dom';
import type { LoadAppConfigReturn } from '~/loadAppConfig';
import { loadAppConfig } from '~/loadAppConfig';
import { normalizeNodeType } from '~/utils/nodeTypeNormalize';

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
  pageNodeId: string;
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
  retryDelays: number[] = [1000, 2000, 3000],
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

      // Avoid recreating the Worker while it is still booting to prevent races
      // @eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = (typeof window !== 'undefined') ? (window as any) : {};
      const { WorkerAPIClient } = await import('./WorkerAPIClient');
      const initComplete = Boolean(g.__HDB_INIT_COMPLETE__ || WorkerAPIClient.isReady());

      if (!initComplete) {
        console.warn(`[${operationName}] Comlink error during boot; will wait instead of recreating worker.`);
      } else {
        console.warn(`[${operationName}] Comlink error post-boot; recreating worker connection...`);
        try {
          WorkerAPIClient.reset();
          await WorkerAPIClient.initialize();
          console.log(`[${operationName}] Worker connection recreated`);
        } catch (recreationError) {
          console.error(`[${operationName}] Failed to recreate worker connection:`, recreationError);
        }
      }

      const delay = retryDelays[attempt];
      console.log(`[${operationName}] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`[${operationName}] Maximum retry attempts exceeded`);
}

export async function loadWorkerAPIClient(): Promise<LoadWorkerAPIClientReturn> {
  // Coordinate concurrent loader calls during hard-refresh/direct-access
  // by sharing a single wait promise for INIT_COMPLETE across the app runtime.
  // @eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = typeof window !== 'undefined' ? (window as any) : {};
  if (!g.__HDB_INIT_WAIT__) g.__HDB_INIT_WAIT__ = null as Promise<void> | null;
  const appConfig = loadAppConfig();
  console.log('[HDB-BOOT] Loader start');

  try {
    //  WorkerAPIClient
    const { WorkerAPIClient } = await import('./WorkerAPIClient');

    // Fast path: if global INIT_COMPLETE already observed, return immediately
      // @eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g: any = (typeof window !== 'undefined') ? (window as any) : {};
      if (g.__HDB_INIT_COMPLETE__) {
        try {
          const client = WorkerAPIClient.getSingleton();
          console.log('[HDB-BOOT] Loader fast-return via global INIT_COMPLETE (getSingleton)');
          return { ...appConfig, client };
        } catch {
          const client = await WorkerAPIClient.getOrInit();
          console.log('[HDB-BOOT] Loader fast-return via global INIT_COMPLETE (getOrInit)');
          return { ...appConfig, client };
        }
      }

    // Ensure initialization kicked off exactly once per page load.
    // If the WorkerProvider already started, do not duplicate or spam logs.
    if (!WorkerAPIClient.isReady()) {
      const startedByProvider = !!g.__HDB_INIT_STARTED__;
      if (!startedByProvider && !g.__HDB_LOADER_INIT_STARTED__) {
        g.__HDB_LOADER_INIT_STARTED__ = true;
        // Kick off initialization without awaiting to avoid race; event barrier will resolve readiness
        WorkerAPIClient.initialize().catch(() => {});
      } else {
        // Provider (or another loader) is already initializing; keep quiet to avoid noisy logs
      }
    }

    // Wait for INIT_COMPLETE with a stricter gate to avoid early Comlink calls.
    // Resolve when either (a) window event fires, or (b) WorkerAPIClient.isReady() becomes true,
    // or (c) an overall timeout elapses.
    const ensureInitComplete = async (timeoutMs = 20000) => {
      console.log('[HDB-BOOT] Loader ensureInit start');
      if (g.__HDB_INIT_COMPLETE__ || WorkerAPIClient.isReady()) return;
      if (g.__HDB_INIT_COMPLETE__ || WorkerAPIClient.isReady()) return;
      if (!g.__HDB_INIT_WAIT__) {
        g.__HDB_INIT_WAIT__ = new Promise<void>((resolve) => {
          let done = false;
          const finish = () => { if (!done) { done = true; resolve(); } };
          const checkReady = () => {
            if (WorkerAPIClient.isReady()) finish();
          };
            const handler = () => {
              window.removeEventListener('hierarchidb-worker-init-complete', handler);
              g.__HDB_INIT_COMPLETE__ = true;
              finish();
            };
            window.addEventListener('hierarchidb-worker-init-complete', handler, { once: true });
          const poll = window.setInterval(checkReady, 100);
          window.setTimeout(() => {
            window.clearInterval(poll);
            finish();
          }, timeoutMs);
        });
      }
      await g.__HDB_INIT_WAIT__;
      g.__HDB_INIT_WAIT__ = null;
    };

    await ensureInitComplete();

    // Obtain the instance
    const client = WorkerAPIClient.getSingleton();
    console.log('[HDB-BOOT] Loader getSingleton ok');


    return {
      ...appConfig,
      client,
    };
  } catch (error) {
    console.error('[loadWorkerAPIClient] Failed to get Worker client:', error);
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
    'loadTree.getTree',
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
                                     pageNodeId,
                                   }: LoadPageNodeArgs): Promise<LoadPageNodeReturn> {

  const loadTreeReturn = await loadTree({ treeId });
  const resolvedPageNodeId = (pageNodeId || `${treeId}:root`) as NodeId;

  /*
  const pageNode = await retryComlinkCall(
    async () => {
      // Get fresh client and queryAPI for each retry
      const workerAPIClientReturn = await loadWorkerAPIClient();
      const queryAPI = await workerAPIClientReturn.client.getQueryAPI();
      return queryAPI.getNode(resolvedPageNodeId);
    },
    'loadPageNode.getNode',
  );
  console.log('**** loadPageNode', treeId, pageNodeId, pageNode);
   */

  const workerAPIClientReturn = await loadWorkerAPIClient();
  const queryAPI = await workerAPIClientReturn.client.getQueryAPI();
  const pageNode = await queryAPI.getNode(resolvedPageNodeId);

  console.log('**** loadPageNode', treeId, pageNodeId, pageNode);

  return {
    ...loadTreeReturn,
    pageNodeId: resolvedPageNodeId,
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
    pageNodeId: pageNodeId,
  });

  const targetNode = await retryComlinkCall(
    async () => {
      // Get fresh client and queryAPI for each retry
      const workerAPIClientReturn = await loadWorkerAPIClient();
      const queryAPI = await workerAPIClientReturn.client.getQueryAPI();
      return queryAPI.getNode((targetNodeId || pageNodeId || `${treeId}:root`) as NodeId);
    },
    'loadTargetNode.getNode',
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
    nodeType: normalizeNodeType(nodeType),
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
