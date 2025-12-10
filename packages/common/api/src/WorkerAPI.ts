import type { TreeNodeUpdaterAPI } from './TreeNodeUpdaterAPI.js';
import type { ImportExportAPI } from './ImportExportAPI.js';
import type { PluginLifecycleAPI } from '@hierarchidb/plugin-service-api';
import type { TagAPI } from './TagAPI.js';
import type { TreeMutationAPI } from './TreeMutationAPI.js';
import type { TreeQueryAPI } from './TreeQueryAPI.js';
import type { TreeSubscriptionAPI } from './TreeSubscriptionAPI.js';
import type {
  BatchProgressEvent,
  BatchSessionId,
  BatchSessionStatus,
} from './BatchControlAPI.js';
import type { NodeId, NodeType } from '@hierarchidb/common-types';

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
  getImportExportAPI(): Promise<ImportExportAPI>;
  getTagAPI(): Promise<TagAPI>;
  getPluginLifecycleAPI(): Promise<PluginLifecycleAPI>;
  getCommandProcessor(): Promise<CommandProcessorAPI>;
  startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  getBatchSessionStatus(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchSessionStatus>;
  pauseBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  resumeBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  cancelBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  subscribeBatchProgress(
    nodeType: NodeType,
    sessionId: BatchSessionId,
    callback: (event: BatchProgressEvent) => void
  ): Promise<() => void>;
}
