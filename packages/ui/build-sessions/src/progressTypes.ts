import type { BuildStatus, StageKey } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';

export interface BuildSessionTaskCounts {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
}

export interface BuildSessionProgressSnapshot {
  nodeId: NodeId;
  stage: StageKey;
  status: BuildStatus;
  timestamp: number;
  taskCounts: BuildSessionTaskCounts;
  percentage: number;
  message?: string;
}

export interface BuildSessionLifecycleSnapshot {
  nodeId: NodeId;
  status: BuildStatus;
  startedAt?: number;
  completedAt?: number;
  lastActivity?: number;
  error?: string;
}

export interface BuildSessionProgressState {
  progress: BuildSessionProgressSnapshot | null;
  status: BuildSessionLifecycleSnapshot | null;
  error: Error | null;
}

export interface BuildSessionProgressResult {
  snapshot: BuildSessionProgressSnapshot | null;
  ready: boolean;
  progress: BuildSessionProgressSnapshot | null;
  status: BuildSessionLifecycleSnapshot | null;
  lastError: string | null;
}
