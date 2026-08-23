/**
 * Unified Build Control API interface.
 *
 * NOTE:
 * This file is the canonical API surface for build orchestration types.
 * Use this name in new code.
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { CanonicalBuildInputSource } from './CanonicalPluginBuildAPI.js';
import type { TaskDisplayPayload, TaskStage } from './task-queue-types.js';

export type StageKey = TaskStage;

export type BuildStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'recycled';

export type BuildSessionStatusValue = BuildStatus | 'pausing';

export type BaseBuildConfig = {};

export interface BuildTaskCountSummary {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
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
  status: BuildSessionStatusValue;
  progress: BuildProgress;
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
  stopReason?: string;
  inputSource?: CanonicalBuildInputSource;
}

export interface BuildSessionState {
  nodeId: NodeId;
  status: BuildSessionStatusValue;
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
  stopReason?: string;
}

export interface BuildTaskSummary {
  taskId: string;
  version: number;
  stage: StageKey;
  stageId?: string;
  status: BuildStatus;
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
export interface BuildProgress extends BuildTaskCountSummary {
  percentage: number;
  /** Current stage. Absent until a stage has authoritatively started. */
  stage?: StageKey;
  estimatedTimeRemaining?: number;
}

export interface IBuildSessionManager<TConfig = unknown, TData = unknown> {
  prepareSession?(nodeId: NodeId, config: TConfig, data: TData): Promise<void>;
  startBuildSession(nodeId: NodeId): Promise<BuildSessionStatus>;
  pauseBuildSession(nodeId: NodeId, reason?: string): Promise<void>;
  getBuildSessionStatus(nodeId: NodeId): Promise<BuildSessionStatus>;
}

export type BuildManagerFactory<TManager extends IBuildSessionManager = IBuildSessionManager> =
  () => TManager;

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
  inputSource?: CanonicalBuildInputSource;
}

export interface BuildSessionRuntimeFilter {
  nodeId?: NodeId;
  statuses?: BuildSessionRuntimeStatus[];
  activeOnly?: boolean;
}

export const isBuildControlAPIV2Enabled = (): boolean => true;
