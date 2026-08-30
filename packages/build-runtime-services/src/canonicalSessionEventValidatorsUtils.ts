import type {
  SessionPhase,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  TaskSummary,
} from '@hierarchidb/build-api';

export const requireFiniteNonNegativeNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `[canonicalSessionEvents] ${label} must be a finite non-negative number, received ${String(value)}`
    );
  }
  return value;
};

export const requireNonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `[canonicalSessionEvents] ${label} must be a non-empty string, received ${String(value)}`
    );
  }
  return value;
};

export const validateSessionStatusUpdatedPayload = (
  payload: SessionStatusUpdatedEvent['payload']
): void => {
  requireNonEmptyString(payload.nodeId, 'nodeId');
  const activePhase = isActiveSessionPhase(payload.phase);
  if (payload.isActive !== activePhase) {
    throw new Error(
      `[canonicalSessionEvents] isActive must be ${String(activePhase)} for phase ${payload.phase}`
    );
  }

  const startedAt =
    payload.startedAt === undefined
      ? undefined
      : requireFiniteNonNegativeNumber(payload.startedAt, 'startedAt');
  const inactiveMs =
    payload.inactiveMs === undefined
      ? 0
      : requireFiniteNonNegativeNumber(payload.inactiveMs, 'inactiveMs');
  const completedAt =
    payload.completedAt === undefined
      ? undefined
      : requireFiniteNonNegativeNumber(payload.completedAt, 'completedAt');
  const pausedAt =
    payload.pausedAt === undefined
      ? undefined
      : requireFiniteNonNegativeNumber(payload.pausedAt, 'pausedAt');

  if (payload.phase !== 'idle' && payload.phase !== 'starting' && startedAt === undefined) {
    throw new Error(`[canonicalSessionEvents] startedAt is required for phase ${payload.phase}`);
  }
  if ((payload.phase === 'completed' || payload.phase === 'failed') && completedAt === undefined) {
    throw new Error(`[canonicalSessionEvents] completedAt is required for phase ${payload.phase}`);
  }
  if (payload.phase === 'paused' && pausedAt === undefined) {
    throw new Error('[canonicalSessionEvents] pausedAt is required for phase paused');
  }
  if (payload.phase !== 'paused' && pausedAt !== undefined) {
    throw new Error(`[canonicalSessionEvents] pausedAt must be absent for phase ${payload.phase}`);
  }
  if (startedAt !== undefined && completedAt !== undefined) {
    const durationMs = completedAt - startedAt - inactiveMs;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `[canonicalSessionEvents] session duration must be finite and non-negative, received ${String(durationMs)}`
      );
    }
  }
  if (startedAt !== undefined && pausedAt !== undefined) {
    const durationMs = pausedAt - startedAt - inactiveMs;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `[canonicalSessionEvents] paused session duration must be finite and non-negative, received ${String(durationMs)}`
      );
    }
  }

  if (payload.stageId === undefined) {
    if (payload.stageStartedAt !== undefined || payload.stageInactiveMs !== undefined) {
      throw new Error(
        '[canonicalSessionEvents] stage timing must be absent when stageId is absent'
      );
    }
    return;
  }

  requireNonEmptyString(payload.stageId, 'stageId');
  requireFiniteNonNegativeNumber(payload.stageStartedAt, 'stageStartedAt');
  requireFiniteNonNegativeNumber(payload.stageInactiveMs, 'stageInactiveMs');
};

export const validateStageSnapshotUpdatedPayload = (
  payload: StageSnapshotUpdatedEvent['payload']
): void => {
  const stageId = requireNonEmptyString(payload.stageId, 'stageId');
  const startedAt = requireFiniteNonNegativeNumber(payload.stageStartedAt, 'stageStartedAt');
  const inactiveMs = requireFiniteNonNegativeNumber(payload.stageInactiveMs, 'stageInactiveMs');
  if (payload.stageCompletedAt !== undefined) {
    const completedAt = requireFiniteNonNegativeNumber(
      payload.stageCompletedAt,
      'stageCompletedAt'
    );
    const durationMs = completedAt - startedAt - inactiveMs;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `[canonicalSessionEvents] stage duration must be finite and non-negative, received ${String(durationMs)}`
      );
    }
  }

  for (const task of payload.tasks) {
    validateTaskSummary(task, stageId);
  }
};

const isActiveSessionPhase = (phase: SessionPhase): boolean =>
  phase === 'starting' ||
  phase === 'running' ||
  phase === 'pausing' ||
  phase === 'canceling' ||
  phase === 'resuming' ||
  phase === 'finalizing';

const validateTaskSummary = (task: TaskSummary, expectedStageId: string): void => {
  requireNonEmptyString(task.taskId, 'task.taskId');
  const taskStage = requireNonEmptyString(task.stage, 'task.stage');
  if (taskStage !== expectedStageId) {
    throw new Error(
      `[canonicalSessionEvents] task.stage must match stageId: expected ${expectedStageId}, received ${taskStage}`
    );
  }
  requireNonEmptyString(task.status, 'task.status');
  if (!Number.isInteger(task.version) || task.version < 1) {
    throw new Error(
      `[canonicalSessionEvents] task.version must be a positive integer, received ${String(task.version)}`
    );
  }
  if (!Number.isFinite(task.progress) || task.progress < 0 || task.progress > 100) {
    throw new Error(
      `[canonicalSessionEvents] task.progress must be finite 0..100, received ${String(task.progress)}`
    );
  }
};
