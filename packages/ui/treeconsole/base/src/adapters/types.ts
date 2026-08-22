import type { NodeId } from '@hierarchidb/core-types';
import type {
  OnNameConflict,
  TreeChangeEvent,
  TreeChangeEventType,
  TreeNode,
} from '@hierarchidb/tree-api';
import type { WorkerAPI } from '@hierarchidb/worker-api';

export type TreeChangeCallback = (event: TreeChangeEvent) => void;

export type UnsubscribeFunction = () => void;

export interface AdapterContext {
  viewId: string;

  groupId: string;

  onNameConflict?: OnNameConflict;
}

export interface CommandAdapterOptions {
  context: AdapterContext;

  retryConfig?: {
    maxAttempts: number;
    delayMs: number;
  };
}

export interface WorkerAPIAdapterConfig<T> {
  workerAPI: WorkerAPI<T>;

  defaultViewId: string;

  defaultOnNameConflict?: OnNameConflict;
}

export interface ExpandedStateChange {
  nodeId: NodeId;
  expanded: boolean;
  timestamp?: number;
}

export interface SubTreeChange {
  type: TreeChangeEventType;
  nodeId: NodeId;
  node?: TreeNode;
  previousNode?: TreeNode;
  timestamp: number;
}

export class TreeConsoleAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'TreeConsoleAdapterError';
  }
}

// Legacy types for backward compatibility
export type LegacyCallback<T = unknown> = (data: T) => void;
export type LegacyUnsubscribe = () => void;
export type LegacyExpandedStateChanges = ExpandedStateChange[];
export type LegacySubTreeChanges = SubTreeChange[];
