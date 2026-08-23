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
import type { ImportExportAPI } from '@hierarchidb/import-export-api';
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
import type { TagAPI } from '@hierarchidb/tag-api';
import type {
  TreeMutationAPI,
  TreeNodeUpdaterAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
  TreeTableExpandedAPI,
} from '@hierarchidb/tree-api';
import type { YamlCanonicalZipAPI } from './YamlCanonicalZipTypes.js';
import type { YamlCoreDbReadOnlyInventoryResult } from './YamlCoreDbReadOnlyInventoryTypes.js';

type ShapeDownloadTaskPayload = {
  url: string;
  countryCode: string;
  countryName?: string;
  adminLevel: number;
  dataSource?: ShapeDataSourceName;
};

export type UiStorageBridge = {
  getItem(key: string): Promise<string | null>;
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
  getYamlCoreDbReadOnlyInventory(): Promise<YamlCoreDbReadOnlyInventoryResult>;
  getYamlCanonicalZipAPI(): Promise<YamlCanonicalZipAPI>;
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
    inputSource: CanonicalBuildInputSource
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
  /** Subscribe to canonical stage snapshot events for a specific node. */
  subscribeStageSnapshots(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: StageSnapshotUpdatedEvent) => void
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
  subscribeTaskProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: TaskProgressUpdatedEvent) => void
  ): Promise<() => void>;
  subscribeHeapPressure(callback: (event: HeapPressureEvent) => void): Promise<() => void>;
  /** Subscribe to canonical session state events for a specific node. */
  subscribeSessionState(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: SessionStatusUpdatedEvent) => void
  ): Promise<() => void>;
  /** Subscribe to canonical session heartbeat events for a specific node. */
  subscribeSessionHeartbeat(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: HeartbeatEvent) => void
  ): Promise<() => void>;
  /** Subscribe to worker log events for a specific node. */
  subscribeWorkerLog(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: WorkerLogEvent) => void
  ): Promise<() => void>;
  setUiStorageBridge(bridge: UiStorageBridge): Promise<void>;
  setCorsProxyBaseURL(url: string): Promise<void>;
}
export type BuildWorkerAPI<T> = WorkerAPI<T>;
