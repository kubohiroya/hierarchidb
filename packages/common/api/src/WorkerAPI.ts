import type { NodeId, NodeType } from '@hierarchidb/common-types';
import type { Remote } from 'comlink';
import type { BatchProgressEvent, BatchSessionId, BatchSessionStatus } from './BatchControlAPI.js';
import type { DialogStateAPI } from './DialogStateAPI.js';
import type { ImportExportAPI } from './ImportExportAPI.js';
import type { TagAPI } from './TagAPI.js';
import type { TreeMutationAPI } from './TreeMutationAPI.js';
import type { TreeQueryAPI } from './TreeQueryAPI.js';
import type { TreeSubscriptionAPI } from './TreeSubscriptionAPI.js';
import type { WorkingCopyAPI } from './WorkingCopyAPI.js';

export interface PluginLifecycleAPI {
  register(
    pluginId: string,
    implementation: unknown
  ): Promise<{ success: boolean; error?: { code?: string; message?: string; detail?: unknown } }>;
  unregister(
    pluginId: string
  ): Promise<{ success: boolean; error?: { code?: string; message?: string; detail?: unknown } }>;
  validatePlugin(
    pluginId: string
  ): Promise<{ isValid: boolean; errors: unknown[]; warnings: unknown[] }>;
  checkHealth(): Promise<{
    status: 'ok' | 'degraded' | 'failed';
    lastCheck: number;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Public worker facade API.
 *
 * This interface describes the Comlink-exposed entry point implemented by the runtime worker.
 * UI and tooling packages should only depend on this type via `@hierarchidb/common-api`,
 * keeping them decoupled from the concrete worker implementation package.
 */
export interface WorkerAPI {
  getQueryAPI(): Remote<TreeQueryAPI>;
  getMutationAPI(): Remote<TreeMutationAPI>;
  getSubscriptionAPI(): Remote<TreeSubscriptionAPI>;
  getWorkingCopyAPI(): Remote<WorkingCopyAPI>;
  getPluginLifecycleAPI(): Remote<PluginLifecycleAPI>;
  getDialogStateAPI(): Remote<DialogStateAPI>;
  getImportExportAPI(): Remote<ImportExportAPI>;
  getTagAPI(): Remote<TagAPI>;

  startBatchSession(nodeType: NodeType, nodeId: NodeId): Promise<BatchSessionStatus>;
  getBatchSessionStatus(nodeType: NodeType, sessionId: BatchSessionId): Promise<BatchSessionStatus>;
  pauseBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  resumeBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  cancelBatchSession(nodeType: NodeType, sessionId: BatchSessionId): Promise<void>;
  subscribeBatchProgress(
    nodeType: NodeType,
    sessionId: BatchSessionId,
    cb: (event: BatchProgressEvent) => void
  ): Promise<() => void>;

  ping(): { response: 'pong'; timestamp: number };
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getSystemHealth(): Promise<{
    databases: { coreDB: boolean; ephemeralDB: boolean };
    services: {
      query: boolean;
      mutation: boolean;
      subscription: boolean;
      plugin: boolean;
      workingCopy: boolean;
    };
    memory: { used: number; limit: number };
    uptime: number;
  }>;
}
