import type { Remote } from 'comlink';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type {
  BatchProgressEvent,
  BatchSessionId,
  BatchSessionStatus,
} from '@hierarchidb/batch-types';

export interface WorkerBridge {
  initialize(): Promise<void>;
  startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  getBatchSessionStatus(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchSessionStatus>;
  pauseBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  resumeBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  cancelBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  subscribeBatchProgress(
    nodeType: NodeType,
    sessionId: BatchSessionId,
    cb: (event: BatchProgressEvent) => void,
  ): Promise<() => void>;
}

interface WorkerClientRefLike {
  client: Remote<WorkerAPI> | null;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  getAPI: () => Remote<WorkerAPI>;
}

interface WorkerBridgeWindow extends Window {
  __HDB_WORKER_CLIENT_REF__?: WorkerClientRefLike;
}

let injectedRef: WorkerClientRefLike | null = null;

function resolveWorkerClientRef(): WorkerClientRefLike {
  if (injectedRef) {
    return injectedRef;
  }
  if (typeof window !== 'undefined') {
    const win = window as WorkerBridgeWindow;
    if (win.__HDB_WORKER_CLIENT_REF__) {
      return win.__HDB_WORKER_CLIENT_REF__;
    }
  }
  throw new Error('[WorkerBridge] Worker client reference is unavailable. Ensure WorkerProvider is mounted before invoking worker operations.');
}

async function ensureWorkerAPI(): Promise<Remote<WorkerAPI>> {
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

  async subscribeBatchProgress(
    nodeType: NodeType,
    sessionId: BatchSessionId,
    cb: (event: BatchProgressEvent) => void,
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeBatchProgress(nodeType, sessionId, cb);
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

export function __setWorkerBridgeClientRef(ref: WorkerClientRefLike | null): void {
  injectedRef = ref;
}
