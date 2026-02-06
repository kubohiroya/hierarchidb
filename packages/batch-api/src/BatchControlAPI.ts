/**
 * Unified Batch Control API Interface
 * Provides _obsolate_common interface for batch processing operations across all plugin-loader
 */

import type { NodeId } from '@hierarchidb/core-types';

export type StageKey = string;
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
export interface BatchSessionStatus {
  nodeId: NodeId;
  status: BatchStatus;
  progress: BatchProgress;
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
}

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
export type BatchProgressCallback = (progress: BatchProgressEvent) => void;

/**
 * Standardized progress event across all plugin-loader
 */
export interface BatchProgressEvent<P = BatchProgressPayload> {
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
  status: ProgressPhase;
  progress: number;
  sequence?: number;
  message?: string;
}

export type BatchTaskUpdateEvent<T extends BatchTaskSummary = BatchTaskSummary> =
  | { type: 'snapshot'; nodeId: NodeId; tasks: T[] }
  | { type: 'update'; nodeId: NodeId; task: T }
  | { type: 'delete'; nodeId: NodeId; taskId: string };

/**
 * Progress information for batch processing
 */
export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  skipped?: number;
  percentage: number;
  taskType?: string;
  estimatedTimeRemaining?: number;
}

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

export interface BatchProgressAdapter {
  subscribe: (consumer: (info: UnifiedProgressInfo) => void) => (() => void) | Promise<() => void>;
}

export interface UseBatchProgressOptions {
  autoSubscribe?: boolean;
}

export interface IBatchSessionManager<TConfig = unknown, TData = unknown> {
  prepareSession?(nodeId: NodeId, config: TConfig, data: TData): Promise<void>;
  startBatchSession(nodeId: NodeId): Promise<BatchSessionStatus>;
  pauseBatchSession(nodeId: NodeId): Promise<void>;
  resumeBatchSession(nodeId: NodeId): Promise<void>;
  getBatchSessionStatus(nodeId: NodeId): Promise<BatchSessionStatus>;
  onBatchProgress(nodeId: NodeId, callback: BatchProgressCallback): () => void;
}

export type BatchManagerFactory<TManager extends IBatchSessionManager = IBatchSessionManager> = () => TManager;

export type StandardProgressEvent = BatchProgressEvent;
export type StandardProgressPayload = BatchProgressPayload;

export const isBatchControlAPIV2Enabled = (): boolean => true;
