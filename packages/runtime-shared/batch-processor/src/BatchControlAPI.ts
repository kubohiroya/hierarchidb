/**
 * Unified Batch Control API Interface
 * Provides common interface for batch processing operations across all plugins
 */

import type { NodeId } from '@hierarchidb/common-type';
import type { BatchProgress, BatchSessionState } from './AbstractBatchSession.js';

export type BatchSessionId = string;
export type StageKey = string;
export type ProgressPhase =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'warning'
  | 'cancelled';

export interface BatchProgressPayload {
  total?: number;
  completed?: number;
  failed?: number;
  skipped?: number;
  currentTask?: string;
  estimatedTimeRemaining?: number;
  meta?: Record<string, unknown>;
}

/**
 * Common interface for batch session management across all plugins
 */
export interface IBatchSessionManager {
  /**
   * Start a new batch session
   * @param nodeId Target node ID
   * @returns Session ID
   */
  startBatchSession(nodeId: NodeId): Promise<BatchSessionId>;

  /**
   * Pause a running batch session
   * @param sessionId Session to pause
   */
  pauseBatchSession(sessionId: BatchSessionId): Promise<void>;

  /**
   * Resume a paused batch session
   * @param sessionId Session to resume
   */
  resumeBatchSession(sessionId: BatchSessionId): Promise<void>;

  /**
   * Cancel a batch session
   * @param sessionId Session to cancel
   */
  cancelBatchSession(sessionId: BatchSessionId): Promise<void>;

  /**
   * Get current session status
   * @param sessionId Session to query
   */
  getBatchSessionStatus(sessionId: BatchSessionId): Promise<BatchSessionStatus>;

  /**
   * Subscribe to progress updates
   * @param sessionId Session to monitor
   * @param callback Progress callback
   * @returns Unsubscribe function
   */
  onBatchProgress(sessionId: BatchSessionId, callback: BatchProgressCallback): () => void;
}

/**
 * Standardized batch session status
 */
export interface BatchSessionStatus {
  sessionId: BatchSessionId;
  nodeId: NodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: BatchProgress;
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
}

/**
 * Standardized progress callback signature
 */
export type BatchProgressCallback = (progress: BatchProgressEvent) => void;

/**
 * Standardized progress event across all plugins
 */
export interface BatchProgressEvent<P = BatchProgressPayload> {
  sessionId: BatchSessionId;
  nodeId: NodeId;
  stage: StageKey;
  phase: ProgressPhase;
  timestamp: number;
  payload?: P;
  message?: string;
  error?: { code?: string; detail?: unknown };
}

/** @deprecated use BatchProgressEvent instead */
export type StandardProgressEvent<P = BatchProgressPayload> = BatchProgressEvent<P>;
/** @deprecated use BatchProgressPayload instead */
export type StandardProgressPayload = BatchProgressPayload;

/**
 * Batch control command interface for sessions
 */
export interface IBatchControlCommands {
  /**
   * Start the batch processing
   */
  start(): Promise<void>;

  /**
   * Pause the batch processing
   */
  pause(): Promise<void>;

  /**
   * Resume the batch processing
   */
  resume(): Promise<void>;

  /**
   * Cancel the batch processing
   */
  cancel(): Promise<void>;

  /**
   * Get current state
   */
  getState(): BatchSessionState;

  /**
   * Get current progress
   */
  getProgress(): BatchProgress;
}

/**
 * The unified batch control API (V2) is now always enabled.
 * This function is retained for backward compatibility with callers that
 * previously gated behaviour on the rollout flag.
 */
export function isBatchControlAPIV2Enabled(): boolean {
  return true;
}

/**
 * Factory function to create unified batch managers
 */
export interface BatchManagerFactory<TConfig = any, TData = any> {
  createManager(deps?: any): IBatchSessionManager;

  validateConfig(config: TConfig): boolean;

  validateData(data: TData): boolean;
}
