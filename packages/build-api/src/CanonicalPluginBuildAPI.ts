import type { NodeId } from '@hierarchidb/core-types';
import type { BuildSessionStatus, BuildTaskSummary } from './isBuildControlAPIV2Enabled.js';
import type { TaskProgressUpdatedEvent } from './progress-types.js';
import type {
  HeartbeatEvent,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  WorkerLogEvent,
} from './session-event-types.js';

export interface CanonicalPluginBuildAPI {
  startBuildSession(request: CanonicalPluginBuildStartRequest): Promise<BuildSessionStatus>;
  getBuildSessionStatus(nodeId: NodeId): Promise<BuildSessionStatus>;
  pauseBuildSession(nodeId: NodeId, reason?: string): Promise<void>;
  cancelQueuedBuildSession(nodeId: NodeId, reason?: string): Promise<void>;
  getBuildTasks(nodeId: NodeId): Promise<BuildTaskSummary[]>;
  subscribeStageSnapshots(
    nodeId: NodeId,
    callback: (event: StageSnapshotUpdatedEvent) => void
  ): CanonicalPluginBuildUnsubscribe | Promise<CanonicalPluginBuildUnsubscribe>;
  subscribeTaskProgress(
    nodeId: NodeId,
    callback: (event: TaskProgressUpdatedEvent) => void
  ): CanonicalPluginBuildUnsubscribe | Promise<CanonicalPluginBuildUnsubscribe>;
  subscribeSessionState(
    nodeId: NodeId,
    callback: (event: SessionStatusUpdatedEvent) => void
  ): CanonicalPluginBuildUnsubscribe | Promise<CanonicalPluginBuildUnsubscribe>;
  subscribeSessionHeartbeat(
    nodeId: NodeId,
    callback: (event: HeartbeatEvent) => void
  ): CanonicalPluginBuildUnsubscribe | Promise<CanonicalPluginBuildUnsubscribe>;
  subscribeWorkerLog(
    nodeId: NodeId,
    callback: (event: WorkerLogEvent) => void
  ): CanonicalPluginBuildUnsubscribe | Promise<CanonicalPluginBuildUnsubscribe>;
}

export type CanonicalPluginBuildStartRequest = {
  nodeId: NodeId;
  draftData: unknown;
};

export type CanonicalPluginBuildUnsubscribe = () => void;

export const canonicalPluginBuildAPIMethodNames = [
  'startBuildSession',
  'getBuildSessionStatus',
  'pauseBuildSession',
  'cancelQueuedBuildSession',
  'getBuildTasks',
  'subscribeStageSnapshots',
  'subscribeTaskProgress',
  'subscribeSessionState',
  'subscribeSessionHeartbeat',
  'subscribeWorkerLog',
] as const satisfies readonly (keyof CanonicalPluginBuildAPI)[];
