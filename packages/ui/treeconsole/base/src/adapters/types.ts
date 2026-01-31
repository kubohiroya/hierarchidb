/**
  * TreeConsole API
  * API
 * TreeConsoleObservable
  */

import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { OnNameConflict, TreeChangeEvent, TreeChangeEventType, TreeNode } from '@hierarchidb/tree-api';

/**
  * WorkerAPI
  */
export type TreeChangeCallback = (event: TreeChangeEvent) => void;

/**
    */
export type UnsubscribeFunction = () => void;

/**
   * API
  */
export interface AdapterContext {
  /**
   * IDTreeConsole
   */
  viewId: string;
  /**
   * ID
   */
  groupId: string;
  /**
      */
  onNameConflict?: OnNameConflict;
}

/**
    */
export interface CommandAdapterOptions {
  /**
      */
  context: AdapterContext;
  /**
      */
  retryConfig?: {
    maxAttempts: number;
    delayMs: number;
  };
}

/**
    */
export interface WorkerAPIAdapterConfig {
  /**
   * WorkerAPI
   */
  workerAPI: WorkerAPI;
  /**
   * ID
   */
  defaultViewId: string;
  /**
      */
  defaultOnNameConflict?: OnNameConflict;
}

/**
  * WorkerAPI
  */
export interface ExpandedStateChange {
  nodeId: NodeId;
  expanded: boolean;
  timestamp?: number;
}

/**
  * WorkerAPI
  */
export interface SubTreeChange {
  type: TreeChangeEventType;
  nodeId: NodeId;
  node?: TreeNode;
  previousNode?: TreeNode;
  timestamp: number;
}

/**
    */
export class TreeConsoleAdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error,
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
