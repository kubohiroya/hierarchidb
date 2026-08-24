import type {
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BuildSessionStatus,
  BuildTaskSummary,
  CanonicalBuildInputSource,
  HeartbeatEvent,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
  WorkerLogEvent,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { HeapPressureEvent } from '@hierarchidb/memory';
import type { TreeNodeData } from '@hierarchidb/tree-api';
import type { RunStagedFolderActionInput, WorkerAPI } from '@hierarchidb/worker-api';
import { proxy, type Remote } from 'comlink';

type WorkerApi = WorkerAPI<TreeNodeData>;

export interface BuildWorkerBridge {
  initialize(): Promise<void>;
  startBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    inputSource: CanonicalBuildInputSource
  ): Promise<BuildSessionStatus>;
  getBuildSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionStatus>;
  pauseBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  cancelQueuedBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  getBuildTasks(nodeType: NodeType, nodeId: NodeId): Promise<BuildTaskSummary[]>;
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
  runStagedFolderAction(
    input: RunStagedFolderActionInput
  ): ReturnType<WorkerApi['runStagedFolderAction']>;
  getStyleQueryAPI(): ReturnType<WorkerApi['getStyleQueryAPI']>;
  getStyleMutationAPI(): ReturnType<WorkerApi['getStyleMutationAPI']>;
  getShapeQueryAPI(): ReturnType<WorkerApi['getShapeQueryAPI']>;
  getShapeMutationAPI(): ReturnType<WorkerApi['getShapeMutationAPI']>;
  getLocationQueryAPI(): ReturnType<WorkerApi['getLocationQueryAPI']>;
  getLocationMutationAPI(): ReturnType<WorkerApi['getLocationMutationAPI']>;
  getRouteQueryAPI(): ReturnType<WorkerApi['getRouteQueryAPI']>;
  getRouteMutationAPI(): ReturnType<WorkerApi['getRouteMutationAPI']>;
  getTreeNodeUpdaterAPI(): ReturnType<WorkerApi['getTreeNodeUpdaterAPI']>;
  subscribeTaskProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: TaskProgressUpdatedEvent) => void
  ): Promise<() => void>;
  subscribeHeapPressure(cb: (event: HeapPressureEvent) => void): Promise<() => void>;
  subscribeSessionState(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: SessionStatusUpdatedEvent) => void
  ): Promise<() => void>;
  subscribeStageSnapshots(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: StageSnapshotUpdatedEvent) => void
  ): Promise<() => void>;
  /** Subscribe to the four canonical build-session channels for a node. */
  subscribeAll(
    nodeType: NodeType,
    nodeId: NodeId,
    handlers: {
      onTaskEvent: (event: StageSnapshotUpdatedEvent) => void;
      onProgressEvent: (event: TaskProgressUpdatedEvent) => void;
      onSessionState: (event: SessionStatusUpdatedEvent) => void;
      onHeartbeat: (event: HeartbeatEvent) => void;
    }
  ): Promise<() => void>;
  subscribeWorkerLog(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: WorkerLogEvent) => void
  ): Promise<() => void>;
}

type WorkerClientRefLike = {
  client: Remote<WorkerApi> | null;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  getAPI: () => Remote<WorkerApi>;
};

const sanitizeForComlink = <T>(value: T, seen = new WeakMap<object, object>()): T => {
  if (typeof value === 'bigint') {
    return value.toString() as T;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ?? undefined,
    } as T;
  }

  if (value instanceof Map) {
    return Array.from(value.values()).map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (value instanceof Set) {
    return Array.from(value).map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (Array.isArray(value)) {
    const array = value;
    return array.map((entry) => sanitizeForComlink(entry, seen)) as T;
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return seen.get(value as object) as T;
    }
    const anyObject = value as Record<string, unknown>;
    const safe = {} as Record<string, unknown>;
    seen.set(value as object, safe);

    for (const key of Object.keys(anyObject)) {
      const rawValue = anyObject[key];
      if (typeof rawValue === 'function' || typeof rawValue === 'symbol') {
        continue;
      }
      safe[key] = sanitizeForComlink(rawValue, seen);
    }

    return safe as T;
  }

  return value;
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
    '[BuildWorkerBridge] Worker client reference is unavailable. Ensure WorkerProvider is mounted before invoking worker operations.'
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
    throw new Error('[BuildWorkerBridge] Worker API is not initialized.');
  }
}

class WorkerBridgeImpl implements BuildWorkerBridge {
  async initialize(): Promise<void> {
    const ref = resolveWorkerClientRef();
    if (!ref.isInitialized) {
      await ref.initialize();
    }
  }

  async startBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    inputSource: CanonicalBuildInputSource
  ): Promise<BuildSessionStatus> {
    const api = await ensureWorkerAPI();
    return api.startBuildSession(nodeType, nodeId, inputSource);
  }

  async getBuildSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionStatus> {
    const api = await ensureWorkerAPI();
    return api.getBuildSessionStatus(nodeType, nodeId);
  }

  async pauseBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.pauseBuildSession(nodeType, nodeId, reason);
  }

  async cancelQueuedBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    reason?: string
  ): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.cancelQueuedBuildSession(nodeType, nodeId, reason);
  }

  async getBuildTasks(nodeType: NodeType, nodeId: NodeId): Promise<BuildTaskSummary[]> {
    const api = await ensureWorkerAPI();
    return api.getBuildTasks(nodeType, nodeId);
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
    const unsubscribe = await api.subscribeBuildSessionRuntimes(
      nodeType,
      filter,
      proxy((sessions: BuildSessionRuntimeRecord[]) => {
        cb(sanitizeForComlink(sessions));
      })
    );
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[BuildWorkerBridge] unsubscribe failed', error);
      }
    };
  }

  async deleteBuildSession(nodeType: NodeType, nodeId: NodeId): Promise<void> {
    const api = await ensureWorkerAPI();
    await api.deleteBuildSession(nodeType, nodeId);
  }

  async runStagedFolderAction(
    input: RunStagedFolderActionInput
  ): ReturnType<WorkerApi['runStagedFolderAction']> {
    const api = await ensureWorkerAPI();
    return api.runStagedFolderAction(input);
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

  async getTreeNodeUpdaterAPI(): Promise<Awaited<ReturnType<WorkerApi['getTreeNodeUpdaterAPI']>>> {
    const api = await ensureWorkerAPI();
    return api.getTreeNodeUpdaterAPI();
  }

  async subscribeTaskProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: TaskProgressUpdatedEvent) => void
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeTaskProgress(
      nodeType,
      nodeId,
      proxy((event: TaskProgressUpdatedEvent) => {
        cb(sanitizeForComlink(event));
      })
    );
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[BuildWorkerBridge] unsubscribe failed', error);
      }
    };
  }

  async subscribeHeapPressure(cb: (event: HeapPressureEvent) => void): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeHeapPressure(
      proxy((event) => {
        cb(sanitizeForComlink(event));
      })
    );
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[BuildWorkerBridge] unsubscribe failed', error);
      }
    };
  }

  async subscribeSessionState(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: SessionStatusUpdatedEvent) => void
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeSessionState(
      nodeType,
      nodeId,
      proxy((event) => {
        cb(sanitizeForComlink(event));
      })
    );
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[BuildWorkerBridge] subscribeSessionState unsubscribe failed', error);
      }
    };
  }

  async subscribeStageSnapshots(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: StageSnapshotUpdatedEvent) => void
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeStageSnapshots(
      nodeType,
      nodeId,
      proxy((event) => {
        cb(sanitizeForComlink(event));
      })
    );
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[BuildWorkerBridge] subscribeStageSnapshots unsubscribe failed', error);
      }
    };
  }

  async subscribeAll(
    nodeType: NodeType,
    nodeId: NodeId,
    handlers: {
      onTaskEvent: (event: StageSnapshotUpdatedEvent) => void;
      onProgressEvent: (event: TaskProgressUpdatedEvent) => void;
      onSessionState: (event: SessionStatusUpdatedEvent) => void;
      onHeartbeat: (event: HeartbeatEvent) => void;
    }
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const acquiredUnsubscribers: Array<() => void> = [];
    let setupFailed = false;

    const unsubscribeSafely = (unsubscribe: () => void): void => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[BuildWorkerBridge] subscribeAll unsubscribe failed', error);
      }
    };
    const disposeAcquired = (): void => {
      const unsubscribers = acquiredUnsubscribers.splice(0);
      for (const unsubscribe of unsubscribers) {
        unsubscribeSafely(unsubscribe);
      }
    };
    const acquire = async (subscription: Promise<() => void>): Promise<void> => {
      const unsubscribe = await subscription;
      if (setupFailed) {
        unsubscribeSafely(unsubscribe);
        return;
      }
      acquiredUnsubscribers.push(unsubscribe);
    };

    try {
      await Promise.all([
        acquire(
          api.subscribeStageSnapshots(
            nodeType,
            nodeId,
            proxy((event) => {
              handlers.onTaskEvent(sanitizeForComlink(event));
            })
          )
        ),
        acquire(
          api.subscribeTaskProgress(
            nodeType,
            nodeId,
            proxy((event: TaskProgressUpdatedEvent) => {
              handlers.onProgressEvent(sanitizeForComlink(event));
            })
          )
        ),
        acquire(
          api.subscribeSessionState(
            nodeType,
            nodeId,
            proxy((event) => {
              handlers.onSessionState(sanitizeForComlink(event));
            })
          )
        ),
        acquire(
          api.subscribeSessionHeartbeat(
            nodeType,
            nodeId,
            proxy((event) => {
              handlers.onHeartbeat(sanitizeForComlink(event));
            })
          )
        ),
      ]);
    } catch (error) {
      setupFailed = true;
      disposeAcquired();
      throw error;
    }

    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      setupFailed = true;
      disposeAcquired();
    };
  }

  async subscribeWorkerLog(
    nodeType: NodeType,
    nodeId: NodeId,
    cb: (event: WorkerLogEvent) => void
  ): Promise<() => void> {
    const api = await ensureWorkerAPI();
    const unsubscribe = await api.subscribeWorkerLog(
      nodeType,
      nodeId,
      proxy((event) => {
        cb(sanitizeForComlink(event));
      })
    );
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('[BuildWorkerBridge] subscribeWorkerLog unsubscribe failed', error);
      }
    };
  }
}

let bridgeInstance: BuildWorkerBridge | null = null;

export function getBuildWorkerBridge(): BuildWorkerBridge {
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
