import type { BuildProgressEvent, BuildTaskSummary, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import {
  createBuildSessionWorkerEventAdapter as createCommonBuildSessionWorkerEventAdapter,
  type BuildSessionStateEvent,
  type BuildSessionWorkerEventAdapter,
} from '@hierarchidb/ui-build-sessions';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { ShapeBuildSessionStateEvent, ShapeSessionPhase, ShapeStageId } from './buildSessionStateAtoms';

const asFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[shape buildSessionWorkerEventAdapter] ${label} must be a finite number, received ${String(value)}`);
  }
  return value;
};

const resolveShapeStageId = (value: unknown): ShapeStageId => {
  if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
    return value;
  }
  throw new Error(`[shape buildSessionWorkerEventAdapter] unsupported stage: ${String(value)}`);
};

const isShapeBuildStopReason = (value: unknown): value is ShapeBuildStopReason => (
  value === 'route-leave'
  || value === 'user-pause'
  || value === 'failed'
  || value === 'completed'
  || value === 'unknown'
);

const toShapeEvent = (
  event: BuildSessionStateEvent<ShapeStageId, ShapeSessionPhase, BuildTaskSummary>,
): ShapeBuildSessionStateEvent => {
  if (event.type !== 'sessionRecordReceived') {
    return event;
  }
  const stopReason = event.payload.stopReason;
  if (stopReason !== undefined && !isShapeBuildStopReason(stopReason)) {
    throw new Error(`[shape buildSessionWorkerEventAdapter] unsupported stopReason: ${String(stopReason)}`);
  }
  return {
    ...event,
    payload: {
      ...event.payload,
      stopReason,
    },
  };
};

const mapRuntimeStatusToPhase = (status: string): ShapeSessionPhase => {
  if (status === 'idle') return 'idle';
  if (status === 'starting') return 'starting';
  if (status === 'running') return 'running';
  if (status === 'pausing') return 'pausing';
  if (status === 'paused') return 'paused';
  if (status === 'resuming') return 'resuming';
  if (status === 'finalizing') return 'finalizing';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  throw new Error(`[shape buildSessionWorkerEventAdapter] unsupported runtime status: ${status}`);
};

const mapProgressPhaseToSessionPhase = (phase: BuildProgressEvent['phase']): ShapeSessionPhase => {
  if (phase === 'idle') return 'idle';
  if (phase === 'running') return 'running';
  if (phase === 'paused') return 'paused';
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  if (phase === 'queued') return 'starting';
  throw new Error(`[shape buildSessionWorkerEventAdapter] unsupported progress phase: ${phase}`);
};

export const createBuildSessionWorkerEventAdapter = (
  nodeId: string,
  dispatch: (event: ShapeBuildSessionStateEvent) => void,
): BuildSessionWorkerEventAdapter => {
  return createCommonBuildSessionWorkerEventAdapter<ShapeStageId, ShapeSessionPhase, BuildTaskSummary>(
    nodeId,
    (event) => dispatch(toShapeEvent(event)),
    {
      deleteEventTargetStages: ['source', 'geometry', 'tileEmit'] as const,
      resolveStageId: resolveShapeStageId,
      mapRuntimeStatusToPhase: (status) => mapRuntimeStatusToPhase(String(status)),
      mapProgressPhaseToSessionPhase,
      mapSessionRecordStatusToPhase: (status) => mapRuntimeStatusToPhase(String(status)),
      resolveRuntimeEventVersion: (record) => asFiniteNumber(record.revision, 'runtime revision'),
      resolveSessionRecordEventVersion: (sessionRecord) => {
        const stageHeartbeatAt = (sessionRecord as { stageHeartbeatAt?: unknown }).stageHeartbeatAt;
        if (typeof stageHeartbeatAt === 'number' && Number.isFinite(stageHeartbeatAt)) {
          return stageHeartbeatAt;
        }
        const completedAt = (sessionRecord as { completedAt?: unknown }).completedAt;
        if (typeof completedAt === 'number' && Number.isFinite(completedAt)) {
          return completedAt;
        }
        const startedAt = (sessionRecord as { startedAt?: unknown }).startedAt;
        if (typeof startedAt === 'number' && Number.isFinite(startedAt)) {
          return startedAt;
        }
        throw new Error('[shape buildSessionWorkerEventAdapter] sessionRecord event version must come from heartbeat/completedAt/startedAt');
      },
      resolveTaskSnapshotEventVersion: (event: BuildTaskUpdateEvent) => {
        if (event.type !== 'snapshot') {
          throw new Error('[shape buildSessionWorkerEventAdapter] snapshot resolver requires snapshot event');
        }
        const explicitVersion = (event as { version?: unknown }).version;
        if (typeof explicitVersion === 'number' && Number.isFinite(explicitVersion)) {
          return explicitVersion;
        }
        if (event.tasks.length > 0) {
          return event.tasks.reduce((max, task) => Math.max(max, task.version), Number.MIN_SAFE_INTEGER);
        }
        return asFiniteNumber((event as { version?: unknown }).version, 'task snapshot event.version');
      },
      resolveTaskUpdateEventVersion: (task) => asFiniteNumber(task.version, 'task.version'),
      resolveTaskDeleteEventVersion: (event: BuildTaskUpdateEvent) => (
        asFiniteNumber((event as { version?: unknown }).version, 'task delete event.version')
      ),
      resolveProgressEventVersion: (event) => asFiniteNumber(event.timestamp, 'progress timestamp'),
      resolveHeartbeatEventVersion: (event) => asFiniteNumber(event.heartbeatAt, 'heartbeatAt'),
      resolveProgressValue: (event) => {
        const payload = event.payload as Record<string, unknown> | undefined;
        return asFiniteNumber(payload?.percentage, 'progress payload.percentage');
      },
    },
  );
};
