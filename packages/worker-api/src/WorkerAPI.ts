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
import type { BatchProgressEvent, BatchSessionStatus, BatchTaskSummary, BatchTaskUpdateEvent, BuildContinuationPolicy } from '@hierarchidb/batch-api';
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
  startBatchSession(
    nodeType: NodeType,
    nodeId: NodeId,
    downloadTaskPayloads?: ShapeDownloadTaskPayload[],
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<BatchSessionStatus>;
  getBatchSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  pauseBatchSession(nodeType: NodeType, nodeId: NodeId, reason?: string): Promise<void>;
  resumeBatchSession(
    nodeType: NodeType,
    nodeId: NodeId,
    buildContinuationPolicy?: BuildContinuationPolicy
  ): Promise<void>;
  getBatchTasks(nodeType: NodeType, nodeId: NodeId): Promise<BatchTaskSummary[]>;
  subscribeBatchTasks(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: BatchTaskUpdateEvent) => void
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
  generateShapeDownloadTaskPayloadsFromSelection(
    nodeId: NodeId,
    dataSource: ShapeDataSourceName,
    selectedArrayByCountries: Record<string, boolean[]>
  ): Promise<ShapeDownloadTaskPayload[]>;
  subscribeBatchProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: BatchProgressEvent) => void
  ): Promise<() => void>;
  subscribeHeapPressure(callback: (event: HeapPressureEvent) => void): Promise<() => void>;
  setUiStorageBridge(bridge: UiStorageBridge): Promise<void>;
  setAuthToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): Promise<void>;
  setCorsProxyBaseURL(url: string): Promise<void>;
}
