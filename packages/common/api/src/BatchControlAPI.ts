/**
 * Unified Batch Control API Interface
 * Provides _obsolate_common interface for batch processing operations across all plugin-loader
 */

import type { NodeId } from '@hierarchidb/common-types';

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

export interface UnifiedProgressInfo {
  stage: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  currentTask: string;
  phase?: string;
  timestamp?: number;
  payload?: BatchProgressPayload;
  message?: string;
  nodeId?: NodeId;
  sessionId?: BatchSessionId;
}

export interface UseBatchProgressOptions {
  autoSubscribe?: boolean;
  poll?: () => Promise<UnifiedProgressInfo | null>;
}

export interface BatchProgressAdapter {
  subscribe: (cb: (p: UnifiedProgressInfo) => void) => (() => void) | Promise<() => void>;
}

/**
 * Common interface for batch session management across all plugin-loader
 */
export interface IBatchSessionManager {
  /**
   * Start a new batch session.
   * @param nodeId - Target node identifier that owns the session.
   * @returns A promise that resolves to the created batch session identifier.
   */
  startBatchSession(nodeId: NodeId): Promise<BatchSessionId>;

  /**
   * Pause a running batch session.
   * @param sessionId - Identifier of the session to pause.
   */
  pauseBatchSession(sessionId: BatchSessionId): Promise<void>;

  /**
   * Resume a paused batch session.
   * @param sessionId - Identifier of the session to resume.
   */
  resumeBatchSession(sessionId: BatchSessionId): Promise<void>;

  /**
   * Cancel a batch session.
   * @param sessionId - Identifier of the session to cancel.
   */
  cancelBatchSession(sessionId: BatchSessionId): Promise<void>;

  /**
   * Retrieve the current session status.
   * @param sessionId - Identifier of the session to query.
   */
  getBatchSessionStatus(sessionId: BatchSessionId): Promise<BatchSessionStatus>;

  /**
   * Subscribe to progress updates.
   * @param sessionId - Identifier of the session to monitor.
   * @param callback - Callback invoked whenever progress information changes.
   * @returns A function that removes the subscription when invoked.
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
 * Standardized progress event across all plugin-loader
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

export interface BatchTaskSummary {
  taskId: string;
  stage: StageKey;
  status: ProgressPhase | 'waiting';
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
}

/** @deprecated Use BatchProgressEvent instead. */
export type StandardProgressEvent<P = BatchProgressPayload> = BatchProgressEvent<P>;
/** @deprecated Use BatchProgressPayload instead. */
export type StandardProgressPayload = BatchProgressPayload;

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
export interface BatchManagerFactory<TConfig = Record<string, unknown>, TData = unknown> {
  createManager(deps?: Record<string, unknown>): IBatchSessionManager;

  validateConfig(config: TConfig): boolean;

  validateData(data: TData): boolean;
}

/**
 * Base configuration for all batch sessions
 */
export interface BaseBatchConfig {
  // Common settings
  corsProxyBaseURL?: string;
  maxRetries?: number;
  retryDelay?: number;

  // Worker settings
  workerTimeout?: number;
  maxMemoryPerWorker?: number;

  // Session settings
  enableProgressTracking?: boolean;
  enableResourceMonitoring?: boolean;
}

/**
 * Base batch session state
 */
export interface BatchSessionState {
  sessionId: string;
  nodeId: NodeId;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
}

/**
 * Progress information for batch processing
 */
export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  skipped?: number;
  percentage: number;
  currentStage?: string;
  currentTask?: string;
  estimatedTimeRemaining?: number;
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  memoryUsed: number;
  memoryPeak: number;
  cpuPercent: number;
  storageUsed: number;
  networkBytesReceived?: number;
  networkBytesSent?: number;
}

// Runtime placeholders for type-only exports used by bundled worker modules.
export const BaseBatchConfig = undefined as unknown as BaseBatchConfig;
export const BatchProgress = undefined as unknown as BatchProgress;
export const BatchProgressCallback = undefined as unknown as BatchProgressCallback;
export const BatchProgressEvent = undefined as unknown as BatchProgressEvent;
export const BatchProgressPayload = undefined as unknown as BatchProgressPayload;
export const BatchSessionId = undefined as unknown as BatchSessionId;
export const BatchSessionState = undefined as unknown as BatchSessionState;
export const BatchSessionStatus = undefined as unknown as BatchSessionStatus;
export const IBatchSessionManager = undefined as unknown as IBatchSessionManager;
export const ResourceUsage = undefined as unknown as ResourceUsage;
