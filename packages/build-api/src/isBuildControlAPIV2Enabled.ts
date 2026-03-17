/**
 * Unified Build Control API interface.
 *
 * NOTE:
 * This file is the canonical API surface for build orchestration types.
 * Use this name in new code.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskDisplayPayload } from './task-queue-types.js';
import type { TaskStage } from './task-queue-types.js';

export type StageKey = TaskStage;

export type BuildStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'recycled';

export type ProgressPhase = BuildStatus;

export interface BaseBuildConfig {
  // Intentionally minimal; build implementations extend as needed.
}

export interface BuildProgressPayload {
  total: number;
  completed: number;
  failed: number;
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
 * Standardized build session status.
 */
export interface BuildSessionStatus {
  nodeId: NodeId;
  status: BuildStatus;
  progress: BuildProgress;
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
}

export interface BuildSessionState {
  nodeId: NodeId;
  status: BuildStatus;
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
}

/**
 * Standardized progress callback signature.
 */
export type BuildProgressCallback = (progress: BuildProgressEvent) => void;

/**
 * Standardized progress event across all plugins.
 */
export interface BuildProgressEvent<P = BuildProgressPayload> {
  nodeId: NodeId;
  stage: StageKey;
  phase: ProgressPhase;
  timestamp: number;
  payload?: P;
  message?: string;
  error?: { code?: string; detail?: unknown };
}

export interface BuildTaskSummary {
  taskId: string;
  version: number;
  stage: StageKey;
  stageId?: string;
  status: ProgressPhase;
  progress: number;
  sequence?: number;
  display?: TaskDisplayPayload;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

export type BuildTaskUpdateEvent<T extends BuildTaskSummary = BuildTaskSummary> =
  | { type: 'snapshot'; nodeId: NodeId; tasks: T[] }
  | { type: 'update'; nodeId: NodeId; task: T }
  | { type: 'delete'; nodeId: NodeId; taskId: string };

/**
 * Progress information for build processing.
 */
export interface BuildProgress {
  total: number;
  completed: number;
  failed: number;
  skipped?: number;
  percentage: number;
  stage: StageKey;
  estimatedTimeRemaining?: number;
}

/**
 * Alias for BuildProgressEvent. Use BuildProgressEvent in new code.
 * @deprecated Use BuildProgressEvent directly.
 */
export type BuildUnifiedProgressInfo<P = BuildProgressPayload> = BuildProgressEvent<P>;

export interface BuildProgressAdapter {
  subscribe: (consumer: (info: BuildProgressEvent) => void) => (() => void) | Promise<() => void>;
}

export interface UseBuildProgressOptions {
  autoSubscribe?: boolean;
}

export interface IBuildSessionManager<TConfig = unknown, TData = unknown> {
  prepareSession?(nodeId: NodeId, config: TConfig, data: TData): Promise<void>;
  startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus>;
  pauseBuildSession(nodeId: NodeId): Promise<void>;
  getBuildSessionStatus(nodeId: NodeId): Promise<BuildSessionStatus>;
  onBuildProgress(nodeId: NodeId, callback: BuildProgressCallback): () => void;
}

export type BuildManagerFactory<TManager extends IBuildSessionManager = IBuildSessionManager> = () => TManager;

export type StandardProgressEvent = BuildProgressEvent;
export type StandardProgressPayload = BuildProgressPayload;

export type BuildSessionRuntimeStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'finalizing'
  | 'completed'
  | 'failed'
  | 'deleting';

export interface BuildSessionRuntimeRecord {
  nodeId: NodeId;
  status: BuildSessionRuntimeStatus;
  isActive: boolean;
  progress?: BuildProgress;
  startedAt?: number;
  completedAt?: number;
  updatedAt?: number;
  inactiveMs?: number;
  lastHeartbeatAt?: number;
  error?: string;
  revision: number;
}

export interface BuildSessionRuntimeFilter {
  nodeId?: NodeId;
  statuses?: BuildSessionRuntimeStatus[];
  activeOnly?: boolean;
}

export const isBuildControlAPIV2Enabled = (): boolean => true;
