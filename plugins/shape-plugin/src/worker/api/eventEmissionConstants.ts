/**
 * Event Emission
 *
 * Emits the 4 canonical Worker→UI events defined in
 * docs/build-session-worker-ui-event-spec.md:
 *   sessionStatusUpdated, stageSnapshotUpdated, taskProgressUpdated, heartbeat
 *
 * taskProgressUpdated and heartbeat are plugin-agnostic and are re-exported
 * from @hierarchidb/build-runtime-services.
 * sessionStatusUpdated and stageSnapshotUpdated depend on shape-plugin-specific
 * types (ShapeBuildSessionRecord, VtTaskQueueDb) and remain here.
 */

import type { TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import { listTasksByStage, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import type {
  SessionPhase,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
} from '~/common/types/session-events';
import { unconditionalEventStreamer } from './eventBuffering.js';
import {
  isShapeTaskStage,
  requireShapeTaskStage,
  type ShapeTaskStage,
} from './taskQueueManagement.js';
import { mapTaskQueueRecordToTaskSummary } from './taskSummaryMapping.js';

export {
  emitHeartbeat,
  emitTaskProgressUpdated,
} from '@hierarchidb/build-runtime-services';

const requireFiniteNonNegativeNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `[eventEmission] ${label} must be a finite non-negative number, received ${String(value)}`
    );
  }
  return value;
};

export const validateSessionTimingContract = (
  phase: SessionPhase,
  timing: Pick<
    SessionStatusUpdatedEvent['payload'],
    'startedAt' | 'completedAt' | 'inactiveMs' | 'stageId' | 'stageStartedAt' | 'stageInactiveMs'
  >
): void => {
  const startedAt =
    timing.startedAt === undefined
      ? undefined
      : requireFiniteNonNegativeNumber(timing.startedAt, 'startedAt');
  const inactiveMs =
    timing.inactiveMs === undefined
      ? 0
      : requireFiniteNonNegativeNumber(timing.inactiveMs, 'inactiveMs');
  const completedAt =
    timing.completedAt === undefined
      ? undefined
      : requireFiniteNonNegativeNumber(timing.completedAt, 'completedAt');

  if (phase !== 'idle' && phase !== 'starting' && startedAt === undefined) {
    throw new Error(`[eventEmission] startedAt is required for phase ${phase}`);
  }
  if ((phase === 'completed' || phase === 'failed') && completedAt === undefined) {
    throw new Error(`[eventEmission] completedAt is required for phase ${phase}`);
  }
  if (startedAt !== undefined && completedAt !== undefined) {
    const durationMs = completedAt - startedAt - inactiveMs;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `[eventEmission] session duration must be finite and non-negative, received ${durationMs}`
      );
    }
  }

  if (timing.stageId === undefined) {
    if (timing.stageStartedAt !== undefined || timing.stageInactiveMs !== undefined) {
      throw new Error('[eventEmission] stage timing must be absent when stageId is absent');
    }
    return;
  }
  if (!isShapeTaskStage(timing.stageId)) {
    throw new Error(`[eventEmission] unsupported stageId: ${String(timing.stageId)}`);
  }
  requireFiniteNonNegativeNumber(timing.stageStartedAt, 'stageStartedAt');
  requireFiniteNonNegativeNumber(timing.stageInactiveMs, 'stageInactiveMs');
};

export const validateStageTimingContract = (
  stageStartedAt: unknown,
  stageInactiveMs: unknown,
  stageCompletedAt?: unknown
): void => {
  const resolvedStartedAt = requireFiniteNonNegativeNumber(stageStartedAt, 'stageStartedAt');
  const resolvedInactiveMs = requireFiniteNonNegativeNumber(stageInactiveMs, 'stageInactiveMs');
  if (stageCompletedAt === undefined) return;
  const resolvedCompletedAt = requireFiniteNonNegativeNumber(stageCompletedAt, 'stageCompletedAt');
  const durationMs = resolvedCompletedAt - resolvedStartedAt - resolvedInactiveMs;
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error(
      `[eventEmission] stage duration must be finite and non-negative, received ${durationMs}`
    );
  }
};

export const readStartedStageTiming = (
  sessionRecord: ShapeBuildSessionRecord,
  expectedStage?: ShapeTaskStage
): { stage: ShapeTaskStage; stageStartedAt: number; stageInactiveMs: number } | null => {
  const { stageId, stageStartedAt, stageInactiveMs } = sessionRecord;
  if (stageId === undefined) {
    if (stageStartedAt !== undefined || stageInactiveMs !== undefined) {
      throw new Error('[eventEmission] stage timing must be absent when stageId is absent');
    }
    return null;
  }
  if (!isShapeTaskStage(stageId)) {
    throw new Error(`[eventEmission] unsupported stageId: ${String(stageId)}`);
  }
  if (expectedStage !== undefined && stageId !== expectedStage) {
    throw new Error(`[eventEmission] expected stage ${expectedStage}, received ${stageId}`);
  }
  const resolvedStageStartedAt = requireFiniteNonNegativeNumber(stageStartedAt, 'stageStartedAt');
  const resolvedStageInactiveMs = requireFiniteNonNegativeNumber(
    stageInactiveMs,
    'stageInactiveMs'
  );
  return {
    stage: stageId,
    stageStartedAt: resolvedStageStartedAt,
    stageInactiveMs: resolvedStageInactiveMs,
  };
};

/**
 * Maps ShapeBuildSessionRecord status to the canonical SessionPhase.
 * Unknown values throw immediately — no fallback.
 */
export const mapStatusToSessionPhase = (
  status: ShapeBuildSessionRecord['status']
): SessionPhase => {
  switch (status) {
    case 'idle':
      return 'idle';
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default: {
      const _exhaustive: never = status;
      throw new Error(`[eventEmission] unknown session status: ${String(_exhaustive)}`);
    }
  }
};

/**
 * Emits sessionStatusUpdated.
 * Called whenever the session lifecycle phase changes.
 */
export const emitSessionStatusUpdated = (
  nodeId: NodeId,
  sessionRecord: ShapeBuildSessionRecord
): void => {
  const phase = mapStatusToSessionPhase(sessionRecord.status);
  emitSessionLifecyclePhaseUpdated(nodeId, sessionRecord, phase);
};

const isActiveSessionPhase = (phase: SessionPhase): boolean =>
  phase === 'starting' ||
  phase === 'running' ||
  phase === 'pausing' ||
  phase === 'resuming' ||
  phase === 'finalizing';

export const emitSessionLifecyclePhaseUpdated = (
  nodeId: NodeId,
  sessionRecord: ShapeBuildSessionRecord,
  phase: SessionPhase
): void => {
  validateSessionTimingContract(phase, {
    startedAt: sessionRecord.startedAt,
    completedAt: sessionRecord.completedAt,
    inactiveMs: sessionRecord.inactiveMs,
    stageId: sessionRecord.stageId,
    stageStartedAt: sessionRecord.stageStartedAt,
    stageInactiveMs: sessionRecord.stageInactiveMs,
  });
  const event: SessionStatusUpdatedEvent = {
    type: 'sessionStatusUpdated',
    payload: {
      nodeId,
      phase,
      isActive: isActiveSessionPhase(phase),
      startedAt: sessionRecord.startedAt,
      completedAt: sessionRecord.completedAt,
      stopReason: sessionRecord.stopReason,
      stageId: sessionRecord.stageId,
      inactiveMs: sessionRecord.inactiveMs,
      stageStartedAt: sessionRecord.stageStartedAt,
      stageInactiveMs: sessionRecord.stageInactiveMs,
    },
  };
  unconditionalEventStreamer.emitEvent(nodeId, 'session-state', event);
};

/**
 * Emits stageSnapshotUpdated for a stage that has already started.
 * Must NOT be called for stages that have not yet started (stageStartedAt required).
 */
export const emitStageSnapshotUpdated = async (
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
  stageStartedAt: number,
  stageInactiveMs: number,
  stageCompletedAt?: number,
  shouldEmit?: () => boolean
): Promise<void> => {
  validateStageTimingContract(stageStartedAt, stageInactiveMs, stageCompletedAt);
  const resolvedStage = requireShapeTaskStage(stage);
  const taskQueue = new VtTaskQueueDb();
  const rawTasks = await listTasksByStage(taskQueue, nodeId, resolvedStage);
  if (shouldEmit?.() === false) return;
  const tasks = rawTasks.map((task) => mapTaskQueueRecordToTaskSummary(task));

  const event: StageSnapshotUpdatedEvent = {
    type: 'stageSnapshotUpdated',
    payload: {
      stageId: resolvedStage,
      tasks,
      stageStartedAt,
      stageInactiveMs,
      stageCompletedAt,
    },
  };
  unconditionalEventStreamer.emitEvent(nodeId, 'stage-snapshot', event);
};
