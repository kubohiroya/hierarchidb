/**
 * Unified Build Control API interface.
 *
 * NOTE:
 * This file is the canonical API surface for build orchestration types.
 * Use this name in new code.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskDisplayPayload } from './task-queue-types.js';

export type StageKey = string;

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
  stage: StageKey;
  status: ProgressPhase;
  progress: number;
  sequence?: number;
  display?: TaskDisplayPayload;
  metadata?: Record<string, unknown>;
  message?: string;
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
  taskType?: string;
  estimatedTimeRemaining?: number;
}

export interface BuildUnifiedProgressInfo<P = BuildProgressPayload> {
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

export interface BuildProgressAdapter {
  subscribe: (consumer: (info: BuildUnifiedProgressInfo) => void) => (() => void) | Promise<() => void>;
}

export interface UseBuildProgressOptions {
  autoSubscribe?: boolean;
}

export interface IBuildSessionManager<TConfig = unknown, TData = unknown> {
  prepareSession?(nodeId: NodeId, config: TConfig, data: TData): Promise<void>;
  startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus>;
  pauseBuildSession(nodeId: NodeId): Promise<void>;
  resumeBuildSession(nodeId: NodeId): Promise<void>;
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
  error?: string;
  revision: number;
}

export interface BuildSessionRuntimeFilter {
  nodeId?: NodeId;
  statuses?: BuildSessionRuntimeStatus[];
  activeOnly?: boolean;
}

export const isBuildControlAPIV2Enabled = (): boolean => true;
