import type { BuildProgressEvent, BuildTaskSummary } from '@hierarchidb/build-api';
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
  if (event.type !== 'sessionStatusUpdated') {
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
  if (status === 'queued') return 'queued';
  if (status === 'running') return 'running';
  if (status === 'pausing') return 'pausing';
  if (status === 'paused') return 'paused';
  if (status === 'resuming') return 'resuming';
  if (status === 'finalizing') return 'finalizing';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  throw new Error(`[shape buildSessionWorkerEventAdapter] unsupported runtime status: ${status}`);
};

const isActivePhase = (phase: ShapeSessionPhase): boolean => (
  phase === 'starting'
  || phase === 'queued'
  || phase === 'running'
  || phase === 'pausing'
  || phase === 'resuming'
  || phase === 'finalizing'
);

export const createBuildSessionWorkerEventAdapter = (
  nodeId: string,
  dispatch: (event: ShapeBuildSessionStateEvent) => void,
): BuildSessionWorkerEventAdapter => {
  return createCommonBuildSessionWorkerEventAdapter<ShapeStageId, ShapeSessionPhase>(
    nodeId,
    (event) => dispatch(toShapeEvent(event)),
    {
      stages: ['source', 'geometry', 'tileEmit'] as const,
      resolveStageId: resolveShapeStageId,
      mapRuntimeStatusToPhase: (status) => mapRuntimeStatusToPhase(String(status)),
      mapSessionRecordStatusToPhase: (status) => mapRuntimeStatusToPhase(String(status)),
      isActivePhase,
      resolveProgressValue: (event: BuildProgressEvent) => {
        const payload = event.payload as Record<string, unknown> | undefined;
        return asFiniteNumber(payload?.percentage, 'progress payload.percentage');
      },
    },
  );
};
