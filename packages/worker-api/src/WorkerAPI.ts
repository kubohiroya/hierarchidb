import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { LocationMutationAPI, LocationQueryAPI } from '@hierarchidb/location-api';
import type { HeapPressureEvent } from '@hierarchidb/memory';
import type { PluginLifecycleAPI } from '@hierarchidb/plugin-base';
import type { RouteMutationAPI, RouteQueryAPI } from '@hierarchidb/route-api';
import type {
  ShapeBuildSessionRecord,
  ShapeDataSourceName,
  ShapeMutationAPI,
  ShapeQueryAPI,
} from '@hierarchidb/shape-api';
import type { StyleMutationAPI, StyleQueryAPI } from '@hierarchidb/style-api';
import type {
  BuildProgressEvent,
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BuildSessionStatus,
  BuildTaskSummary,
  BuildTaskUpdateEvent,
} from '@hierarchidb/build-api';
import type { ImportExportAPI } from '@hierarchidb/import-export-api';
import type { TagAPI } from '@hierarchidb/tag-api';
import type {
  TreeMutationAPI,
  TreeNodeUpdaterAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  TreeTableExpandedAPI,
} from '@hierarchidb/tree-api';

type ShapeDownloadTaskPayload = {
  url: string;
  countryCode: string;
  countryName?: string;
  adminLevel: number;
  dataSource?: ShapeDataSourceName;
};

export type UiStorageBridge = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type CommandProcessorAPI = {
  canUndo?: () => boolean;
  canRedo?: () => boolean;
  undo?: () => Promise<unknown> | unknown;
  redo?: () => Promise<unknown> | unknown;
} & Record<string, unknown>;

// Core Worker API exposed to UI / hosts
export interface WorkerAPI<T> {
  ping(): Promise<{ response: 'pong'; timestamp: number }>;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getSystemHealth(): Promise<{
    databases: { coreDB: boolean; ephemeralDB: boolean };
    services: {
      query: boolean;
      mutation: boolean;
      subscription: boolean;
      plugin: boolean;
      draft: boolean;
    };
    memory: { used: number; limit: number };
    uptime: number;
  }>;
  getMutationAPI(): Promise<TreeMutationAPI>;
  getQueryAPI(): Promise<TreeQueryAPI>;
  getSubscriptionAPI(): Promise<TreeSubscriptionAPI>;
  getTreeNodeUpdaterAPI(): Promise<TreeNodeUpdaterAPI<T>>;
  getTreeTableExpandedAPI(): Promise<TreeTableExpandedAPI>;
  getImportExportAPI(): Promise<ImportExportAPI<T>>;
  getTagAPI(): Promise<TagAPI>;
  getStyleQueryAPI(): Promise<StyleQueryAPI>;
  getStyleMutationAPI(): Promise<StyleMutationAPI>;
  getShapeQueryAPI(): Promise<ShapeQueryAPI>;
  getShapeMutationAPI(): Promise<ShapeMutationAPI>;
  getLocationQueryAPI(): Promise<LocationQueryAPI>;
  getLocationMutationAPI(): Promise<LocationMutationAPI>;
  getRouteQueryAPI(): Promise<RouteQueryAPI>;
  getRouteMutationAPI(): Promise<RouteMutationAPI>;
  getPluginLifecycleAPI(): Promise<PluginLifecycleAPI>;
  getCommandProcessor(): Promise<CommandProcessorAPI>;
  /** Canonical build API. */
  startBuildSession(
    nodeType: NodeType,
    nodeId: NodeId,
    downloadTaskPayloads?: ShapeDownloadTaskPayload[],
  ): Promise<BuildSessionStatus>;
  /** Canonical build API. */
  getBuildSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BuildSessionStatus>;
  /** Canonical build API. */
  pauseBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  /**
   * Cancel a queued build session. If the target session is already running,
   * runtime should treat this request as stop/pause semantics.
   */
  /** Canonical build API. */
  cancelQueuedBuildSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  /** Canonical build API. */
  getBuildTasks(nodeType: NodeType, nodeId: NodeId): Promise<BuildTaskSummary[]>;
  /** Canonical build API. */
  subscribeBuildTasks(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: BuildTaskUpdateEvent) => void
  ): Promise<() => void>;
  listBuildSessionRecordsByStatus(
    nodeType: NodeType,
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>
  ): Promise<ShapeBuildSessionRecord[]>;
  subscribeBuildSessionRecordsByStatus(
    nodeType: NodeType,
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>,
    callback: (sessions: ShapeBuildSessionRecord[]) => void
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
    callback: (sessions: BuildSessionRuntimeRecord[]) => void
  ): Promise<() => void>;
  deleteBuildSession(nodeType: NodeType, nodeId: NodeId): Promise<void>;
  generateShapeDownloadTaskPayloadsFromSelection(
    nodeId: NodeId,
    dataSource: ShapeDataSourceName,
    selectedArrayByCountries: Record<string, boolean[]>
  ): Promise<ShapeDownloadTaskPayload[]>;
  /** Canonical build API. */
  subscribeBuildProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: BuildProgressEvent) => void
  ): Promise<() => void>;
  subscribeHeapPressure(callback: (event: HeapPressureEvent) => void): Promise<() => void>;
  /** Subscribe to session state change events for a specific node. Shape-plugin only. */
  subscribeSessionState(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: unknown) => void
  ): Promise<() => void>;
  /** Subscribe to session heartbeat events for a specific node. Shape-plugin only. */
  subscribeSessionHeartbeat(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: unknown) => void
  ): Promise<() => void>;
  /** Subscribe to worker log events for a specific node. Shape-plugin only. */
  subscribeWorkerLog(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: unknown) => void
  ): Promise<() => void>;
  setUiStorageBridge(bridge: UiStorageBridge): Promise<void>;
  setAuthToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): Promise<void>;
  setCorsProxyBaseURL(url: string): Promise<void>;
  /** Request current auth token from UI side. Returns null if no token available. */
  requestAuthToken(): Promise<string | null>;
  /** Set UI token request callback for worker-to-UI token queries. */
  setUiTokenRequestCallback(callback: (() => Promise<string | null>) | null): Promise<void>;
}
export type BuildWorkerAPI<T> = WorkerAPI<T>;
