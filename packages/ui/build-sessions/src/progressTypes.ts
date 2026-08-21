import type { BuildStatus, BuildTaskCountSummary, StageKey } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';

export interface BuildSessionProgressSnapshot {
  nodeId: NodeId;
  stage: StageKey;
  status: BuildStatus;
  timestamp: number;
  taskCounts: BuildTaskCountSummary;
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
