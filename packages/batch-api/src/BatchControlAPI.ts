/**
 * Unified Batch Control API Interface
 * Provides _obsolate_common interface for batch processing operations across all plugin-loader
 */
/**
 * NOTE:
 * Batch* type names are deprecated. Prefer Build* aliases for new code.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskDisplayPayload } from './task-queue-types.js';

export type StageKey = string;
/** @deprecated Use BuildStatus. */
export type BatchStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'regression'
  | 'warning';
export type ProgressPhase = BatchStatus;

export interface BaseBatchConfig {
  // Intentionally minimal; batch implementations extend as needed.
}

/** @deprecated Use BuildProgressPayload. */
export interface BatchProgressPayload {
  total?: number;
  completed?: number;
  failed?: number;
  skipped?: number;
  estimatedTimeRemaining?: number;
  meta?: Record<string, unknown>;
}

export interface ResourceUsage {
  memoryUsed: number;
  memoryPeak: number;
  cpuPercent: number;
  storageUsed: number;
  networkBytesReceived: number;
  networkBytesSent: number;
}

/**
 * Standardized batch session status
 */
/** @deprecated Use BuildSessionStatus. */
export interface BatchSessionStatus {
  nodeId: NodeId;
  status: BatchStatus;
  progress: BatchProgress;
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
}

/** @deprecated Use BuildSessionState. */
export interface BatchSessionState {
  nodeId: NodeId;
  status: BatchStatus;
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
}

/**
 * Standardized progress callback signature
 */
/** @deprecated Use BuildProgressCallback. */
export type BatchProgressCallback = (progress: BatchProgressEvent) => void;

/**
 * Standardized progress event across all plugin-loader
 */
/** @deprecated Use BuildProgressEvent. */
export interface BatchProgressEvent<P = BatchProgressPayload> {
  nodeId: NodeId;
  stage: StageKey;
  phase: ProgressPhase;
  timestamp: number;
  payload?: P;
  message?: string;
  error?: { code?: string; detail?: unknown };
}

/** @deprecated Use BuildTaskSummary. */
export interface BatchTaskSummary {
  taskId: string;
  stage: StageKey;
  status: ProgressPhase;
  progress: number;
  sequence?: number;
  display?: TaskDisplayPayload;
  metadata?: Record<string, unknown>;
  message?: string;
}

/** @deprecated Use BuildTaskUpdateEvent. */
export type BatchTaskUpdateEvent<T extends BatchTaskSummary = BatchTaskSummary> =
  | { type: 'snapshot'; nodeId: NodeId; tasks: T[] }
  | { type: 'update'; nodeId: NodeId; task: T }
  | { type: 'delete'; nodeId: NodeId; taskId: string };

/**
 * Progress information for batch processing
 */
/** @deprecated Use BuildProgress. */
export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  skipped?: number;
  percentage: number;
  taskType?: string;
  estimatedTimeRemaining?: number;
}

/** @deprecated Use BuildUnifiedProgressInfo. */
export interface UnifiedProgressInfo<P = BatchProgressPayload> {
  nodeId: NodeId;
  stage: StageKey;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  phase: ProgressPhase;
  timestamp: number;
  payload?: P;
  message?: string;
}

/** @deprecated Use BuildProgressAdapter. */
export interface BatchProgressAdapter {
  subscribe: (consumer: (info: UnifiedProgressInfo) => void) => (() => void) | Promise<() => void>;
}

/** @deprecated Use UseBuildProgressOptions. */
export interface UseBatchProgressOptions {
  autoSubscribe?: boolean;
}

/** @deprecated Use IBuildSessionManager. */
export interface IBatchSessionManager<TConfig = unknown, TData = unknown> {
  prepareSession?(nodeId: NodeId, config: TConfig, data: TData): Promise<void>;
  startBatchSession(nodeId: NodeId): Promise<BatchSessionStatus>;
  pauseBatchSession(nodeId: NodeId): Promise<void>;
  resumeBatchSession(nodeId: NodeId): Promise<void>;
  getBatchSessionStatus(nodeId: NodeId): Promise<BatchSessionStatus>;
  onBatchProgress(nodeId: NodeId, callback: BatchProgressCallback): () => void;
}

/** @deprecated Use BuildManagerFactory. */
export type BatchManagerFactory<TManager extends IBatchSessionManager = IBatchSessionManager> = () => TManager;

/** @deprecated Use BuildProgressEvent. */
export type StandardProgressEvent = BatchProgressEvent;
/** @deprecated Use BuildProgressPayload. */
export type StandardProgressPayload = BatchProgressPayload;

/** Preferred alias for BatchStatus. */
export type BuildStatus = BatchStatus;
/** Preferred alias for BatchProgressPayload. */
export type BuildProgressPayload = BatchProgressPayload;
/** Preferred alias for BatchSessionStatus. */
export type BuildSessionStatus = BatchSessionStatus;
/** Preferred alias for BatchSessionState. */
export type BuildSessionState = BatchSessionState;
/** Preferred alias for BatchProgressCallback. */
export type BuildProgressCallback = BatchProgressCallback;
/** Preferred alias for BatchProgressEvent. */
export type BuildProgressEvent<P = BuildProgressPayload> = BatchProgressEvent<P>;
/** Preferred alias for BatchTaskSummary. */
export type BuildTaskSummary = BatchTaskSummary;
/** Preferred alias for BatchTaskUpdateEvent. */
export type BuildTaskUpdateEvent<T extends BuildTaskSummary = BuildTaskSummary> =
  BatchTaskUpdateEvent<T>;
/** Preferred alias for BatchProgress. */
export type BuildProgress = BatchProgress;
/** Preferred alias for UnifiedProgressInfo. */
export type BuildUnifiedProgressInfo<P = BuildProgressPayload> = UnifiedProgressInfo<P>;
/** Preferred alias for BatchProgressAdapter. */
export type BuildProgressAdapter = BatchProgressAdapter;
/** Preferred alias for UseBatchProgressOptions. */
export type UseBuildProgressOptions = UseBatchProgressOptions;
/** Preferred alias for IBatchSessionManager. */
export type IBuildSessionManager<TConfig = unknown, TData = unknown> = IBatchSessionManager<
  TConfig,
  TData
>;
/** Preferred alias for BatchManagerFactory. */
export type BuildManagerFactory<TManager extends IBuildSessionManager = IBuildSessionManager> =
  () => TManager;

export const isBatchControlAPIV2Enabled = (): boolean => true;
/** Preferred alias for isBatchControlAPIV2Enabled. */
export const isBuildControlAPIV2Enabled = (): boolean => isBatchControlAPIV2Enabled();
