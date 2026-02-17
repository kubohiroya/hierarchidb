import type {
  BatchProgressEvent,
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BatchSessionStatus,
  BatchTaskSummary,
  BatchTaskUpdateEvent,
  BuildContinuationPolicy,
} from '@hierarchidb/batch-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { HeapPressureEvent } from '@hierarchidb/memory';
import type { TreeNodeData } from '@hierarchidb/tree-api';
import { proxy, type Remote } from 'comlink';

type WorkerApi = WorkerAPI<TreeNodeData>;

export interface WorkerBridge {
  initialize(): Promise<void>;
  startBatchSession(
    nodeType: NodeType,
    nodeId: NodeId,
    downloadTaskPayloads?: Parameters<WorkerApi['startBatchSession']>[2],
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<BatchSessionStatus>;
  startBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    downloadTaskPayloads?: Parameters<WorkerApi['startBuildSession']>[2],
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<BatchSessionStatus>;
  startOrResumeBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    downloadTaskPayloads?: Parameters<WorkerApi['startOrResumeBuildSession']>[2],
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<BatchSessionStatus>;
  getBatchSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  getBuildSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  pauseBatchSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  pauseBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  cancelQueuedBatchSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  cancelQueuedBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  resumeBatchSession(
    nodeType: NodeType,
    nodeId: NodeId,
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<void>;
  resumeBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<void>;
  getBatchTasks(nodeType: NodeType, nodeId: NodeId): Promise<BatchTaskSummary[]>;
  getBuildTasks(nodeType: NodeType, nodeId: NodeId): Promise<BatchTaskSummary[]>;
  subscribeBatchTasks(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchTaskUpdateEvent) => void
  ): Promise<() => void>;
  subscribeBuildTasks(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchTaskUpdateEvent) => void
  ): Promise<() => void>;
  getBuildSessionRuntime(
    nodeType: NodeType,
    nodeId: NodeId
  ): Promise<BuildSessionRuntimeRecord | null>;
  listBuildSessionRuntimes(
    nodeType: NodeType,
    filter?: BuildSessionRuntimeFilter
  ): Promise<BuildSessionRuntimeRecord[]>;
  subscribeBuildSessionRuntimes(
    nodeType: NodeType,
    filter: BuildSessionRuntimeFilter | undefined,
    cb: (sessions: BuildSessionRuntimeRecord[]) => void
  ): Promise<() => void>;
  deleteBuildSession(nodeType: NodeType, nodeId: NodeId): Promise<void>;
  getStyleQueryAPI(): ReturnType<WorkerApi['getStyleQueryAPI']>;
  getStyleMutationAPI(): ReturnType<WorkerApi['getStyleMutationAPI']>;
  getShapeQueryAPI(): ReturnType<WorkerApi['getShapeQueryAPI']>;
  getShapeMutationAPI(): ReturnType<WorkerApi['getShapeMutationAPI']>;
  getLocationQueryAPI(): ReturnType<WorkerApi['getLocationQueryAPI']>;
  getLocationMutationAPI(): ReturnType<WorkerApi['getLocationMutationAPI']>;
  getRouteQueryAPI(): ReturnType<WorkerApi['getRouteQueryAPI']>;
  getRouteMutationAPI(): ReturnType<WorkerApi['getRouteMutationAPI']>;
  getTreeNodeUpdaterAPI(): ReturnType<WorkerApi['getTreeNodeUpdaterAPI']>;
  subscribeBatchProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchProgressEvent) => void
  ): Promise<() => void>;
  subscribeBuildProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchProgressEvent) => void
  ): Promise<() => void>;
  subscribeHeapPressure(cb: (event: HeapPressureEvent) => void): Promise<() => void>;
}

type WorkerClientRefLike = {
  client: Remote<WorkerApi> | null;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  getAPI: () => Remote<WorkerApi>;
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

export async function ensureWorkerAPI(): Promise<Remote<WorkerApi>> {
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

  async startBatchSession(
    nodeType: NodeType,
    nodeId: NodeId,
    downloadTaskPayloads?: Parameters<WorkerApi['startBatchSession']>[2],
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<BatchSessionStatus> {
    const api = await ensureWorkerAPI();
    return api.startBatchSession(nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy);
  }

  async startBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    downloadTaskPayloads?: Parameters<WorkerApi['startBuildSession']>[2],
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<BatchSessionStatus> {
    const api = await ensureWorkerAPI();
    return api.startBuildSession(nodeType, nodeId, downloadTaskPayloads, buildContinuationPolicy);
  }

  async startOrResumeBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    downloadTaskPayloads?: Parameters<WorkerApi['startOrResumeBuildSession']>[2],
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<BatchSessionStatus> {
    const api = await ensureWorkerAPI();
    return api.startOrResumeBuildSession(
      nodeType,
      nodeId,
      downloadTaskPayloads,
      buildContinuationPolicy
    );
  }

  async getBatchSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus> {
    const api = await ensureWorkerAPI();
    return api.getBatchSessionStatus(nodeType, nodeId);
  }

  async getBuildSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus> {
    const api = await ensureWorkerAPI();
    return api.getBuildSessionStatus(nodeType, nodeId);
  }

  async pauseBatchSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.pauseBatchSession(nodeType, nodeId, reason);
  }

  async pauseBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.pauseBuildSession(nodeType, nodeId, reason);
  }

  async cancelQueuedBatchSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void> {
    const api = await ensureWorkerAPI();
    const cancelQueuedBatchSession = (api as { cancelQueuedBatchSession?: unknown }).cancelQueuedBatchSession;
    if (typeof cancelQueuedBatchSession === 'function') {
      await cancelQueuedBatchSession(nodeType, nodeId, reason);
      return;
    }
    await api.pauseBatchSession(nodeType, nodeId, reason);
  }

  async cancelQueuedBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void> {
    const api = await ensureWorkerAPI();
    const cancelQueuedBuildSession = (api as { cancelQueuedBuildSession?: unknown }).cancelQueuedBuildSession;
    if (typeof cancelQueuedBuildSession === 'function') {
      await cancelQueuedBuildSession(nodeType, nodeId, reason);
      return;
    }
    await this.cancelQueuedBatchSession(nodeType, nodeId, reason);
  }

  async resumeBatchSession(
    nodeType: NodeType,
    nodeId: NodeId,
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.resumeBatchSession(nodeType, nodeId, buildContinuationPolicy);
  }

  async resumeBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.resumeBuildSession(nodeType, nodeId, buildContinuationPolicy);
  }

  async getBatchTasks(nodeType: NodeType, nodeId: NodeId): Promise<BatchTaskSummary[]> {
    const api = await ensureWorkerAPI();
    return api.getBatchTasks(nodeType, nodeId);
  }

  async getBuildTasks(nodeType: NodeType, nodeId: NodeId): Promise<BatchTaskSummary[]> {
    const api = await ensureWorkerAPI();
    return api.getBuildTasks(nodeType, nodeId);
  }

  async subscribeBatchTasks(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchTaskUpdateEvent) => void
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeBatchTasks(nodeType, nodeId, proxy(cb));
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[WorkerBridge] unsubscribe failed', error);
      }
    };
  }

  async subscribeBuildTasks(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchTaskUpdateEvent) => void
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeBuildTasks(nodeType, nodeId, proxy(cb));
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[WorkerBridge] unsubscribe failed', error);
      }
    };
  }

  async getBuildSessionRuntime(
    nodeType: NodeType,
    nodeId: NodeId
  ): Promise<BuildSessionRuntimeRecord | null> {
    const api = await ensureWorkerAPI();
    return api.getBuildSessionRuntime(nodeType, nodeId);
  }

  async listBuildSessionRuntimes(
    nodeType: NodeType,
    filter?: BuildSessionRuntimeFilter
  ): Promise<BuildSessionRuntimeRecord[]> {
    const api = await ensureWorkerAPI();
    return api.listBuildSessionRuntimes(nodeType, filter);
  }

  async subscribeBuildSessionRuntimes(
    nodeType: NodeType,
    filter: BuildSessionRuntimeFilter | undefined,
    cb: (sessions: BuildSessionRuntimeRecord[]) => void
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeBuildSessionRuntimes(nodeType, filter, proxy(cb));
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[WorkerBridge] unsubscribe failed', error);
      }
    };
  }

  async deleteBuildSession(nodeType: NodeType, nodeId: NodeId): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.deleteBuildSession(nodeType, nodeId);
  }

  async getStyleQueryAPI(): Promise<Awaited<ReturnType<WorkerApi['getStyleQueryAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getStyleQueryAPI();
  }

  async getStyleMutationAPI(): Promise<Awaited<ReturnType<WorkerApi['getStyleMutationAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getStyleMutationAPI();
  }

  async getShapeQueryAPI(): Promise<Awaited<ReturnType<WorkerApi['getShapeQueryAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getShapeQueryAPI();
  }

  async getShapeMutationAPI(): Promise<Awaited<ReturnType<WorkerApi['getShapeMutationAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getShapeMutationAPI();
  }

  async getLocationQueryAPI(): Promise<Awaited<ReturnType<WorkerApi['getLocationQueryAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getLocationQueryAPI();
  }

  async getLocationMutationAPI(): Promise<
    Awaited<ReturnType<WorkerApi['getLocationMutationAPI']>>
  > {
    const api = await ensureWorkerAPI();
    return api.getLocationMutationAPI();
  }

  async getRouteQueryAPI(): Promise<Awaited<ReturnType<WorkerApi['getRouteQueryAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getRouteQueryAPI();
  }

  async getRouteMutationAPI(): Promise<Awaited<ReturnType<WorkerApi['getRouteMutationAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getRouteMutationAPI();
  }

  async getTreeNodeUpdaterAPI(): Promise<
    Awaited<ReturnType<WorkerApi['getTreeNodeUpdaterAPI']>>
  > {
    const api = await ensureWorkerAPI();
    return api.getTreeNodeUpdaterAPI();
  }

  async subscribeBatchProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchProgressEvent) => void
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeBatchProgress(nodeType, nodeId, proxy(cb));
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[WorkerBridge] unsubscribe failed', error);
      }
    };
  }

  async subscribeBuildProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: BatchProgressEvent) => void
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeBuildProgress(nodeType, nodeId, proxy(cb));
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[WorkerBridge] unsubscribe failed', error);
      }
    };
  }

  async subscribeHeapPressure(cb: (event: HeapPressureEvent) => void): Promise<() => void> {
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
