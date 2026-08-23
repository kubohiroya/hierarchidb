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

export type CanonicalBuildInputSource = 'committed' | 'working-copy';

export type CanonicalBuildInputEnvelope = {
  source: CanonicalBuildInputSource;
  payload: unknown;
};

export type CanonicalPluginBuildStartRequest = {
  nodeId: NodeId;
  input: CanonicalBuildInputEnvelope;
};

export type LegacyCanonicalPluginBuildStartRequest = {
  nodeId: NodeId;
  draftData: unknown;
};

export type CanonicalPluginBuildUnsubscribe = () => void;

export const canonicalBuildInputSources = [
  'committed',
  'working-copy',
] as const satisfies readonly CanonicalBuildInputSource[];

export const isCanonicalBuildInputSource = (value: unknown): value is CanonicalBuildInputSource =>
  value === 'committed' || value === 'working-copy';

export const isLegacyCanonicalPluginBuildStartRequest = (
  request: CanonicalPluginBuildStartRequest | LegacyCanonicalPluginBuildStartRequest
): request is LegacyCanonicalPluginBuildStartRequest => 'draftData' in request;

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
