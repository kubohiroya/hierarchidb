import type {
  BuildProgress,
  BuildSessionRuntimeRecord,
  BuildSessionRuntimeStatus,
  BuildSessionStatus,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';

export interface CreateBuildSessionRuntimeRecordInput {
  nodeType: NodeType;
  nodeId: NodeId;
  status: BuildSessionRuntimeStatus;
  revision: number;
  progress?: BuildProgress;
  startedAt?: number;
  completedAt?: number;
  updatedAt?: number;
  inactiveMs?: number;
  lastHeartbeatAt?: number;
  error?: string;
  inputSource?: BuildSessionStatus['inputSource'];
}

export const createBuildSessionRuntimeRecord = (
  input: CreateBuildSessionRuntimeRecordInput
): BuildSessionRuntimeRecord => ({
  nodeType: input.nodeType,
  nodeId: input.nodeId,
  status: input.status,
  isActive: isActiveRuntimeStatus(input.status),
  progress: input.progress,
  startedAt: input.startedAt,
  completedAt: input.completedAt,
  updatedAt: input.updatedAt,
  inactiveMs: input.inactiveMs,
  lastHeartbeatAt: input.lastHeartbeatAt,
  error: input.error,
  revision: input.revision,
  inputSource: input.inputSource,
});

export const isActiveRuntimeStatus = (status: BuildSessionRuntimeStatus): boolean =>
  status === 'starting' ||
  status === 'running' ||
  status === 'pausing' ||
  status === 'resuming' ||
  status === 'finalizing';
