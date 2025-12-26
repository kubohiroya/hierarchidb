import { proxy, type Remote } from 'comlink';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import type {
  BatchProgressEvent,
  BatchSessionId,
  BatchSessionStatus,
  BatchTaskSummary,
  WorkerAPI,
} from '@hierarchidb/common-api';
import type { HeapPressureEvent } from '@hierarchidb/memory';

export interface WorkerBridge {
  initialize(): Promise<void>;
  startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  getBatchSessionStatus(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchSessionStatus>;
  pauseBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  resumeBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  cancelBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  getBatchTasks(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchTaskSummary[]>;
  getStyleQueryAPI(): ReturnType<WorkerAPI['getStyleQueryAPI']>;
  getStyleMutationAPI(): ReturnType<WorkerAPI['getStyleMutationAPI']>;
  getShapeQueryAPI(): ReturnType<WorkerAPI['getShapeQueryAPI']>;
  getShapeMutationAPI(): ReturnType<WorkerAPI['getShapeMutationAPI']>;
  getLocationQueryAPI(): ReturnType<WorkerAPI['getLocationQueryAPI']>;
  getRouteQueryAPI(): ReturnType<WorkerAPI['getRouteQueryAPI']>;
  getRouteMutationAPI(): ReturnType<WorkerAPI['getRouteMutationAPI']>;
  getTreeNodeUpdaterAPI(): ReturnType<WorkerAPI['getTreeNodeUpdaterAPI']>;
  subscribeBatchProgress(
    nodeType: NodeType,
    sessionId: BatchSessionId,
    cb: (event: BatchProgressEvent) => void,
  ): Promise<() => void>;
  subscribeHeapPressure(
    cb: (event: HeapPressureEvent) => void,
  ): Promise<() => void>;
}

type WorkerClientRefLike = {
  client: Remote<WorkerAPI> | null;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  getAPI: () => Remote<WorkerAPI>;
};

let injectedRef: WorkerClientRefLike | null = null;

function resolveWorkerClientRef(): WorkerClientRefLike {
  if (injectedRef) {
    return injectedRef;
  }
  if (typeof window !== 'undefined') {
    const win = window as typeof window & { __HDB_WORKER_CLIENT_REF__?: WorkerClientRefLike };
    const ref = win.__HDB_WORKER_CLIENT_REF__;
    if (ref) return ref as WorkerClientRefLike;
  }
  throw new Error(
    '[WorkerBridge] Worker client reference is unavailable. Ensure WorkerProvider is mounted before invoking worker operations.'
  );
}

export async function ensureWorkerAPI(): Promise<Remote<WorkerAPI>> {
  const ref = resolveWorkerClientRef();
  if (!ref.isInitialized) {
    await ref.initialize();
  }
  try {
    return ref.client ?? ref.getAPI();
  } catch {
    throw new Error('[WorkerBridge] Worker API is not initialized.');
  }
}

class WorkerBridgeImpl implements WorkerBridge {
  async initialize(): Promise<void> {
    const ref = resolveWorkerClientRef();
    if (!ref.isInitialized) {
      await ref.initialize();
    }
  }

  async startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus> {
    const api = await ensureWorkerAPI();
    return api.startBatchSession(nodeType, nodeId);
  }

  async getBatchSessionStatus(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchSessionStatus> {
    const api = await ensureWorkerAPI();
    return api.getBatchSessionStatus(nodeType, sessionId);
  }

  async pauseBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.pauseBatchSession(nodeType, sessionId);
  }

  async resumeBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.resumeBatchSession(nodeType, sessionId);
  }

  async cancelBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.cancelBatchSession(nodeType, sessionId);
  }

  async getBatchTasks(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchTaskSummary[]> {
    const api = await ensureWorkerAPI();
    return api.getBatchTasks(nodeType, sessionId);
  }

  async getStyleQueryAPI(): Promise<Awaited<ReturnType<WorkerAPI['getStyleQueryAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getStyleQueryAPI();
  }

  async getStyleMutationAPI(): Promise<Awaited<ReturnType<WorkerAPI['getStyleMutationAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getStyleMutationAPI();
  }

  async getShapeQueryAPI(): Promise<Awaited<ReturnType<WorkerAPI['getShapeQueryAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getShapeQueryAPI();
  }

  async getShapeMutationAPI(): Promise<Awaited<ReturnType<WorkerAPI['getShapeMutationAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getShapeMutationAPI();
  }

  async getLocationQueryAPI(): Promise<Awaited<ReturnType<WorkerAPI['getLocationQueryAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getLocationQueryAPI();
  }

  async getRouteQueryAPI(): Promise<Awaited<ReturnType<WorkerAPI['getRouteQueryAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getRouteQueryAPI();
  }

  async getRouteMutationAPI(): Promise<Awaited<ReturnType<WorkerAPI['getRouteMutationAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getRouteMutationAPI();
  }

  async getTreeNodeUpdaterAPI(): Promise<Awaited<ReturnType<WorkerAPI['getTreeNodeUpdaterAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getTreeNodeUpdaterAPI();
  }

  async subscribeBatchProgress(
    nodeType: NodeType,
    sessionId: BatchSessionId,
    cb: (event: BatchProgressEvent) => void,
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeBatchProgress(nodeType, sessionId, proxy(cb));
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[WorkerBridge] unsubscribe failed', error);
      }
    };
  }

  async subscribeHeapPressure(
    cb: (event: HeapPressureEvent) => void,
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeHeapPressure(proxy(cb));
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[WorkerBridge] unsubscribe failed', error);
      }
    };
  }
}

let bridgeInstance: WorkerBridge | null = null;

export function getWorkerBridge(): WorkerBridge {
  if (!bridgeInstance) {
    bridgeInstance = new WorkerBridgeImpl();
  }
  return bridgeInstance;
}

/**
 * Test-only injection to provide a WorkerClientRef without touching the global window.
 */
export function __setWorkerBridgeClientRef(ref: WorkerClientRefLike | null): void {
  injectedRef = ref;
}

export function __getWorkerBridgeClientRef(): WorkerClientRefLike {
  return resolveWorkerClientRef();
}
