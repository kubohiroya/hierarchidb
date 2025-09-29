/**
  * TreeConsole API
  * API
 * TreeConsoleObservable
  */
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeChangeEvent, TreeChangeEventType, TreeNode } from '@hierarchidb/common-type';
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
    onNameConflict?: (name: string) => string;
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
    defaultOnNameConflict?: (name: string) => string;
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
export declare class TreeConsoleAdapterError extends Error {
    readonly code: string;
    readonly originalError?: Error | undefined;
    constructor(message: string, code: string, originalError?: Error | undefined);
}
export type LegacyCallback<T = unknown> = (data: T) => void;
export type LegacyUnsubscribe = () => void;
export type LegacyExpandedStateChanges = ExpandedStateChange[];
export type LegacySubTreeChanges = SubTreeChange[];
//# sourceMappingURL=types.d.ts.map