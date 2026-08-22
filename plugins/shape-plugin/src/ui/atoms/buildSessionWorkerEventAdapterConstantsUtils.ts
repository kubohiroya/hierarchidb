import {
  createBuildSessionWorkerEventAdapter as createCommonBuildSessionWorkerEventAdapter,
  type BuildSessionWorkerEventAdapter,
} from '@hierarchidb/ui-build-sessions';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { ShapeBuildSessionStateEvent, ShapeSessionPhase, ShapeStageId } from './buildSessionStateAtoms';

const resolveShapeStageId = (value: unknown): ShapeStageId => {
  if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
    return value;
  }
  throw new Error(`[shape buildSessionWorkerEventAdapter] unsupported stage: ${String(value)}`);
};

const isShapeBuildStopReason = (value: unknown): value is ShapeBuildStopReason => (
  value === 'route-leave'
  || value === 'user-pause'
  || value === 'auth-required'
  || value === 'failed'
  || value === 'completed'
  || value === 'unknown'
);

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

export const createBuildSessionWorkerEventAdapter = (
  nodeId: string,
  dispatch: (event: ShapeBuildSessionStateEvent) => void,
): BuildSessionWorkerEventAdapter => {
  return createCommonBuildSessionWorkerEventAdapter<ShapeStageId, ShapeSessionPhase>(
    nodeId,
    (event) => {
      if (event.type !== 'sessionStatusUpdated') {
        dispatch(event);
        return;
      }
      const stopReason = event.payload.stopReason;
      if (stopReason !== undefined && !isShapeBuildStopReason(stopReason)) {
        throw new Error(`[shape buildSessionWorkerEventAdapter] unsupported stopReason: ${String(stopReason)}`);
      }
      dispatch({
        ...event,
        payload: {
          ...event.payload,
          stopReason,
        },
      });
    },
    {
      stages: ['source', 'geometry', 'tileEmit'] as const,
      resolveStageId: resolveShapeStageId,
      mapRuntimeStatusToPhase: (status) => mapRuntimeStatusToPhase(String(status)),
      mapSessionRecordStatusToPhase: (status) => mapRuntimeStatusToPhase(String(status)),
    },
  );
};
