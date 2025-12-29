import type { TreeNodeUpdaterAPI } from './TreeNodeUpdaterAPI.js';
import type { ImportExportAPI } from './ImportExportAPI.js';
import type {
  PluginLifecycleAPI,
  ShapeMutationAPI,
  ShapeQueryAPI,
  StyleMutationAPI,
  StyleQueryAPI,
} from '@hierarchidb/plugin-service-api';
import type { LocationMutationAPI, LocationQueryAPI } from '@hierarchidb/location-store';
import type { RouteMutationAPI, RouteQueryAPI } from '@hierarchidb/route-store';
import type { TagAPI } from './TagAPI.js';
import type { TreeMutationAPI } from './TreeMutationAPI.js';
import type { TreeQueryAPI } from './TreeQueryAPI.js';
import type { TreeSubscriptionAPI } from './TreeSubscriptionAPI.js';
import type { TreeTableExpandedAPI } from './TreeTableExpandedAPI.js';
import type {
  BatchProgressEvent,
  BatchSessionStatus,
  BatchTaskSummary,
} from './BatchControlAPI.js';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import type { HeapPressureEvent } from '@hierarchidb/memory';

type ShapeDataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';

type ShapeDownloadTaskPayload = {
  url: string;
  countryCode: string;
  countryName?: string;
  adminLevel: number;
  continent: string;
  dataSource?: ShapeDataSourceName;
  country?: string;
};

export type CommandProcessorAPI = {
  canUndo?: () => boolean;
  canRedo?: () => boolean;
  undo?: () => Promise<unknown> | unknown;
  redo?: () => Promise<unknown> | unknown;
} & Record<string, unknown>;

// Core Worker API exposed to UI / hosts
export interface WorkerAPI {
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
  getTreeNodeUpdaterAPI(): Promise<TreeNodeUpdaterAPI>;
  getTreeTableExpandedAPI(): Promise<TreeTableExpandedAPI>;
  getImportExportAPI(): Promise<ImportExportAPI>;
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
  ): Promise<BatchSessionStatus>;
  getBatchSessionStatus(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  pauseBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<void>;
  resumeBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<void>;
  cancelBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<void>;
  getBatchTasks(nodeType: NodeType, nodeId: NodeId): Promise<BatchTaskSummary[]>;
  generateShapeDownloadTaskPayloadsFromSelection(
    dataSource: ShapeDataSourceName,
    selectedArrayByCountries: Record<string, boolean[]> | undefined,
  ): Promise<ShapeDownloadTaskPayload[]>;
  subscribeBatchProgress(
    nodeType: NodeType,
    nodeId: NodeId,
    callback: (event: BatchProgressEvent) => void
  ): Promise<() => void>;
  subscribeHeapPressure(
    callback: (event: HeapPressureEvent) => void
  ): Promise<() => void>;
  setAuthToken(token: string, type?: 'Bearer' | 'Basic', expiresAt?: number): Promise<void>;
  setCorsProxyBaseURL(url: string): Promise<void>;
}
