import type { DialogStateAPI, WorkerAPI } from '@hierarchidb/common-api';
import {
  NodeAction,
  type NodeId,
  type NodeType,
  type Tree,
  type TreeId,
  type TreeNode,
} from '@hierarchidb/common-types';
import type { Remote } from 'comlink';
import type { LoadAppConfigReturn } from './loadAppConfig.ts';
import { loadAppConfig } from './loadAppConfig.ts';
import { normalizeNodeType } from './utils/nodeTypeNormalize.ts';
import { createWorkerClientHandle } from './worker-runtime/WorkerStateStore.ts';

export type { LoadAppConfigReturn };

type BootWindow = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
  __HDB_INIT_STARTED__?: boolean;
  __HDB_LOADER_INIT_STARTED__?: boolean;
  __HDB_INIT_WAIT__?: Promise<void> | null;
};

function getBootWindow(): BootWindow | null {
  if (typeof window === 'undefined') return null;
  return window as BootWindow;
}

let dialogStateVerificationPromise: Promise<void> | null = null;
let dialogStateApiVerified: boolean = false;
let lastVerifiedClient: Remote<WorkerAPI> | null = null;

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
  pageNodeId?: string;
};
export type LoadPageNodeReturn = {
  pageNodeId: NodeId;
  pageNode: TreeNode | undefined;
} & LoadTreeReturn;

export type LoadTargetNodeArgs = {
  treeId: string;
  pageNodeId?: string;
  targetNodeId: string;
};
export type LoadTargetNodeReturn = {
  targetNode: TreeNode | undefined;
  targetNodeId: NodeId;
} & LoadPageNodeReturn;

export type LoadNodeTypeArgs = {
  treeId: string;
  pageNodeId?: string;
  targetNodeId: string;
  nodeType: string;
};
export type LoadNodeTypeReturn = {
  nodeType: NodeType | undefined;
} & LoadTargetNodeReturn;

export type LoadNodeActionArgs = {
  treeId: string;
  pageNodeId?: string;
  targetNodeId: string;
  nodeType: string;
  action: string;
};
export type LoadNodeActionReturn = {
  action: NodeAction | undefined;
} & LoadNodeTypeReturn;

/**
 * Retry mechanism for Comlink method calls
 * Handles runtime-worker communication errors that can occur after initial connection
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
      const isComlinkError =
        error instanceof Error &&
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
      const bootWindow = getBootWindow();
      const { WorkerAPIClient } = await import('./worker-runtime/WorkerAPIClient.ts');
      const initComplete = Boolean(bootWindow?.__HDB_INIT_COMPLETE__ || WorkerAPIClient.isReady());

      if (!initComplete) {
        console.warn(
          `[${operationName}] Comlink error during boot; will wait instead of recreating worker.`
        );
      } else {
        console.warn(`[${operationName}] Comlink error post-boot; recreating worker connection...`);
        try {
          WorkerAPIClient.reset();
          await WorkerAPIClient.initialize();
          console.log(`[${operationName}] Worker connection recreated`);
        } catch (recreationError) {
          console.error(
            `[${operationName}] Failed to recreate worker connection:`,
            recreationError
          );
        }
      }

      const delay = retryDelays[attempt];
      console.log(`[${operationName}] Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(`[${operationName}] Maximum retry attempts exceeded`);
}

export async function loadWorkerAPIClient(): Promise<LoadWorkerAPIClientReturn> {
  // Coordinate concurrent loader calls during hard-refresh/direct-access
  // by sharing a single wait promise for INIT_COMPLETE across the app runtime-worker.
  const bootWindow = getBootWindow();
  if (bootWindow && typeof bootWindow.__HDB_INIT_WAIT__ === 'undefined') {
    bootWindow.__HDB_INIT_WAIT__ = null;
  }
  const appConfig = loadAppConfig();

  try {
    //  WorkerAPIClient
    const { WorkerAPIClient } = await import('./worker-runtime/WorkerAPIClient.ts');

    // Fast path: if global INIT_COMPLETE already observed, return immediately
    const initWindow = getBootWindow();
    if (initWindow?.__HDB_INIT_COMPLETE__) {
      try {
        const client = WorkerAPIClient.getSingleton();

        return { ...appConfig, client };
      } catch {
        const client = await WorkerAPIClient.getOrInit();

        return { ...appConfig, client };
      }
    }

    // Ensure initialization kicked off exactly once per page load.
    // If the WorkerProvider already started, do not duplicate or spam logs.
    if (!WorkerAPIClient.isReady()) {
      const startedByProvider = Boolean(bootWindow?.__HDB_INIT_STARTED__);
      if (!startedByProvider && !bootWindow?.__HDB_LOADER_INIT_STARTED__) {
        if (bootWindow) bootWindow.__HDB_LOADER_INIT_STARTED__ = true;
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
      const initWindow = getBootWindow();
      if (initWindow?.__HDB_INIT_COMPLETE__ || WorkerAPIClient.isReady()) return;
      if (!initWindow) {
        // Non-browser context: fall back to ensuring WorkerAPIClient readiness only.
        if (!WorkerAPIClient.isReady()) await WorkerAPIClient.initialize();
        return;
      }

      if (!initWindow.__HDB_INIT_WAIT__) {
        initWindow.__HDB_INIT_WAIT__ = new Promise<void>((resolve) => {
          let done = false;
          const finish = () => {
            if (!done) {
              done = true;
              resolve();
            }
          };
          const checkReady = () => {
            if (WorkerAPIClient.isReady()) finish();
          };
          const handler = () => {
            initWindow.removeEventListener('hierarchidb-worker-init-complete', handler);
            initWindow.__HDB_INIT_COMPLETE__ = true;
            finish();
          };
          initWindow.addEventListener('hierarchidb-worker-init-complete', handler, { once: true });
          const poll = initWindow.setInterval(checkReady, 100);
          initWindow.setTimeout(() => {
            initWindow.clearInterval(poll);
            finish();
          }, timeoutMs);
        });
      }
      await initWindow.__HDB_INIT_WAIT__;
      initWindow.__HDB_INIT_WAIT__ = null;
    };

    await ensureInitComplete();

    // Obtain the instance
    const client: Remote<WorkerAPI> = WorkerAPIClient.getSingleton();
    await ensureDialogStateAPI(client);

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

export async function ensureDialogStateAPI(client: Remote<WorkerAPI>): Promise<void> {
  if (lastVerifiedClient !== client) {
    dialogStateApiVerified = false;
  }

  if (dialogStateApiVerified) {
    return;
  }

  if (dialogStateVerificationPromise) {
    await dialogStateVerificationPromise;
    return;
  }

  const verification = (async () => {
    const api = await client.getDialogStateAPI();
    const required: Array<keyof DialogStateAPI> = [
      'publishState',
      'getState',
      'subscribeState',
      'unsubscribeState',
    ];
    const missing = required.filter((method) => typeof api?.[method] !== 'function');
    if (missing.length > 0) {
      const snapshot = {
        typeofPublish: typeof api?.publishState,
        typeofGet: typeof api?.getState,
        typeofSubscribe: typeof api?.subscribeState,
        typeofUnsubscribe: typeof api?.unsubscribeState,
        keys: api ? Object.keys(api as unknown as Record<string, unknown>) : null,
      };
      console.error('DialogStateAPI verification failed', snapshot);
      throw new Error(
        `DialogStateAPI is missing required methods: ${missing.join(', ')}`
      );
    }
    console.log('DialogStateAPI verified');
    dialogStateApiVerified = true;
    lastVerifiedClient = client;
  })();

  dialogStateVerificationPromise = verification;
  try {
    await verification;
  } finally {
    dialogStateVerificationPromise = null;
    lastVerifiedClient = dialogStateApiVerified ? client : null;
  }
}

export async function loadTree({ treeId }: LoadTreeArgs): Promise<LoadTreeReturn> {
  if (!treeId) {
    throw new Error('treeId is required');
  }

  const workerHandle = await createWorkerClientHandle();

  const tree = await retryComlinkCall(async () => {
    const client = await workerHandle.ensureLatest();
    await ensureDialogStateAPI(client);

    // Use facade API instead of deprecated direct method
    const queryAPI = await client.getQueryAPI();
    return queryAPI.getTree(treeId as TreeId);
  }, 'loadTree.getTree');

  if (!tree) {
    console.warn('[loader] getTree returned no data', { treeId });
  }

  return {
    client: workerHandle.getClient(),
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
  
   */

  const pageNode = await retryComlinkCall(async () => {
    const workerAPIClientReturn = await loadWorkerAPIClient();
    const queryAPI = await workerAPIClientReturn.client.getQueryAPI();
    return await queryAPI.getNode(resolvedPageNodeId);
  }, 'loadPageNode.getNode');

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

  const targetNode = await retryComlinkCall(async () => {
    // Get fresh client and queryAPI for each retry
    const workerAPIClientReturn = await loadWorkerAPIClient();
    const queryAPI = await workerAPIClientReturn.client.getQueryAPI();
    return queryAPI.getNode((targetNodeId || pageNodeId || `${treeId}:root`) as NodeId);
  }, 'loadTargetNode.getNode');

  return {
    ...loadPageNodeReturn,
    targetNode,
    targetNodeId: (targetNodeId || pageNodeId || `${treeId}:root`) as NodeId,
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
    action: normalizeNodeAction(action),
  };
}

function normalizeNodeAction(action: string | undefined): NodeAction | undefined {
  if (!action) return undefined;
  const normalized = action === 'edit' ? NodeAction.UPDATE : action;
  const candidate = normalized as NodeAction;
  if ((Object.values(NodeAction) as readonly string[]).includes(candidate)) {
    return candidate;
  }
  return undefined;
}
