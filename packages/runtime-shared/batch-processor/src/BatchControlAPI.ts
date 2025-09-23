/**
 * Unified Batch Control API Interface
 * Provides common interface for batch processing operations across all plugins
 */

import type { NodeId } from '@hierarchidb/common-type';
import type { BatchProgress, BatchSessionState } from './AbstractBatchSession.js';

/**
 * Common interface for batch session management across all plugins
 */
export interface IBatchSessionManager {
  /**
   * Start a new batch session
   * @param nodeId Target node ID
   * @param config Plugin-specific configuration
   * @param data Plugin-specific data
   * @returns Session ID
   */
  startBatchSession(nodeId: NodeId, config: any, data?: any): Promise<string>;

  /**
   * Pause a running batch session
   * @param sessionId Session to pause
   */
  pauseBatchSession(sessionId: string): Promise<void>;

  /**
   * Resume a paused batch session
   * @param sessionId Session to resume
   */
  resumeBatchSession(sessionId: string): Promise<void>;

  /**
   * Cancel a batch session
   * @param sessionId Session to cancel
   */
  cancelBatchSession(sessionId: string): Promise<void>;

  /**
   * Get current session status
   * @param sessionId Session to query
   */
  getBatchSessionStatus(sessionId: string): Promise<BatchSessionStatus>;

  /**
   * Subscribe to progress updates
   * @param sessionId Session to monitor
   * @param callback Progress callback
   * @returns Unsubscribe function
   */
  onBatchProgress(sessionId: string, callback: BatchProgressCallback): () => void;
}

/**
 * Standardized batch session status
 */
export interface BatchSessionStatus {
  sessionId: string;
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
export type BatchProgressCallback = (progress: StandardProgressEvent) => void;

/**
 * Standardized progress event across all plugins
 */
export interface StandardProgressEvent {
  sessionId: string;
  stage: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentTask?: string;
  estimatedTimeRemaining?: number;
}

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
