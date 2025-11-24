import type { DraftAPI } from './DraftAPI.js';
import type { DialogStateAPI } from './DialogStateAPI.js';
import type { ImportExportAPI } from './ImportExportAPI.js';
import type { PluginLifecycleAPI } from '@hierarchidb/plugin-service-api';
import type { TagAPI } from './TagAPI.js';
import type { TreeMutationAPI } from './TreeMutationAPI.js';
import type { TreeQueryAPI } from './TreeQueryAPI.js';
import type { TreeSubscriptionAPI } from './TreeSubscriptionAPI.js';

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
  getDraftAPI(): Promise<DraftAPI>;
  getImportExportAPI(): Promise<ImportExportAPI>;
  getTagAPI(): Promise<TagAPI>;
  getDialogStateAPI(): Promise<DialogStateAPI>;
  getPluginLifecycleAPI(): Promise<PluginLifecycleAPI>;
  getCommandProcessor(): Promise<CommandProcessorAPI>;
}
