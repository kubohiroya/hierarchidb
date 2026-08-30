import type {
  HeartbeatEvent,
  SessionPhase,
  SessionStatusUpdatedEvent,
  StageSnapshotUpdatedEvent,
  TaskProgressUpdatedEvent,
  TaskSummary,
} from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';

export type CanonicalBuildSessionTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'recycled'
  | 'skipped';

export type ValidatedCanonicalSessionStatus<StageId extends string> = {
  phase: SessionPhase;
  isActive: boolean;
  startedAt: number | undefined;
  inactiveMs: number | undefined;
  completedAt: number | undefined;
  pausedAt: number | undefined;
  stopReason: string | undefined;
  stageId: StageId | undefined;
};

export type ValidatedCanonicalTask<StageId extends string> = {
  taskId: string;
  version: number;
  stage: StageId;
  status: CanonicalBuildSessionTaskStatus;
  progress: number;
  index: number;
  errorMessage: string | undefined;
  metadata: Record<string, unknown> | undefined;
};

export type ValidatedCanonicalStageSnapshot<StageId extends string> = {
  stageId: StageId;
  tasks: ValidatedCanonicalTask<StageId>[];
  stageStartedAt: number;
  stageInactiveMs: number;
  stageCompletedAt: number | undefined;
};

export type ValidatedCanonicalTaskProgress<StageId extends string> = {
  taskId: string;
  version: number;
  stageId: StageId;
  value: number;
  message: string | undefined;
  metadata: Record<string, unknown> | undefined;
};

export type ValidatedCanonicalHeartbeat = {
  heartbeatAt: number;
};

export type CanonicalBuildSessionKernelConsumer<StageId extends string> = {
  onReset: () => void;
  onSessionStatus: (status: ValidatedCanonicalSessionStatus<StageId>) => void;
  onStageSnapshot: (snapshot: ValidatedCanonicalStageSnapshot<StageId>) => void;
  onTaskProgress: (progress: ValidatedCanonicalTaskProgress<StageId>) => void;
  onHeartbeat: (heartbeat: ValidatedCanonicalHeartbeat) => void;
  onError: (error: Error) => void;
};

export type CanonicalBuildSessionSubscriptionHandlers = {
  onTaskEvent: (event: unknown) => void;
  onProgressEvent: (event: unknown) => void;
  onSessionState: (event: unknown) => void;
  onHeartbeat: (event: unknown) => void;
};

export type CanonicalBuildSessionSubscriptionKernel = {
  handlers: CanonicalBuildSessionSubscriptionHandlers;
  dispose: () => void;
};

export type CreateCanonicalBuildSessionSubscriptionKernelConfig<StageId extends string> = {
  nodeId: NodeId;
  resolveStageId: (value: unknown) => StageId;
  consumer: CanonicalBuildSessionKernelConsumer<StageId>;
};

const ERROR_PREFIX = '[canonicalBuildSessionSubscriptionKernel]';

const requireFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${ERROR_PREFIX} ${label} must be a finite number, received ${String(value)}`);
  }
  return value;
};

const requireNonNegativeNumber = (value: unknown, label: string): number => {
  const resolved = requireFiniteNumber(value, label);
  if (resolved < 0) {
    throw new Error(`${ERROR_PREFIX} ${label} must be non-negative, received ${resolved}`);
  }
  return resolved;
};

const requirePositiveInteger = (value: unknown, label: string): number => {
  const resolved = requireFiniteNumber(value, label);
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new Error(`${ERROR_PREFIX} ${label} must be a positive integer, received ${resolved}`);
  }
  return resolved;
};

const requireProgressValue = (value: unknown, label: string): number => {
  const resolved = requireFiniteNumber(value, label);
  if (resolved < 0 || resolved > 100) {
    throw new Error(`${ERROR_PREFIX} ${label} must be within 0..100, received ${resolved}`);
  }
  return resolved;
};

const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`${ERROR_PREFIX} ${label} must be boolean, received ${String(value)}`);
  }
  return value;
};

const requireNonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `${ERROR_PREFIX} ${label} must be a non-empty string, received ${String(value)}`
    );
  }
  return value;
};

const requireOptionalString = (value: unknown, label: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new Error(`${ERROR_PREFIX} ${label} must be a string, received ${String(value)}`);
  }
  return value;
};

const requireOptionalRecord = (
  value: unknown,
  label: string
): Record<string, unknown> | undefined => {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${ERROR_PREFIX} ${label} must be an object, received ${String(value)}`);
  }
  return value as Record<string, unknown>;
};

const requireEvent = <T extends { type: string; payload: object }>(
  event: unknown,
  expectedType: T['type']
): T => {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    throw new Error(`${ERROR_PREFIX} ${expectedType} event must be an object`);
  }
  const type = (event as { type?: unknown }).type;
  if (type !== expectedType) {
    throw new Error(`${ERROR_PREFIX} expected ${expectedType}, received ${String(type)}`);
  }
  const payload = (event as { payload?: unknown }).payload;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${ERROR_PREFIX} ${expectedType}.payload must be an object`);
  }
  return event as T;
};

const resolveLifecyclePhase = (value: unknown): SessionPhase => {
  if (
    value === 'idle' ||
    value === 'starting' ||
    value === 'running' ||
    value === 'pausing' ||
    value === 'paused' ||
    value === 'canceling' ||
    value === 'canceled' ||
    value === 'resuming' ||
    value === 'finalizing' ||
    value === 'completed' ||
    value === 'failed'
  ) {
    return value;
  }
  throw new Error(`${ERROR_PREFIX} unsupported session phase: ${String(value)}`);
};

const resolveTaskStatus = (value: unknown): CanonicalBuildSessionTaskStatus => {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'canceled' ||
    value === 'recycled' ||
    value === 'skipped'
  ) {
    return value;
  }
  throw new Error(`${ERROR_PREFIX} unsupported task status: ${String(value)}`);
};

const validateSessionStatus = <StageId extends string>(
  event: SessionStatusUpdatedEvent,
  resolveStageId: (value: unknown) => StageId
): ValidatedCanonicalSessionStatus<StageId> => {
  const { payload } = event;
  const phase = resolveLifecyclePhase(payload.phase);
  const isActive = requireBoolean(payload.isActive, 'session.isActive');
  const expectedIsActive =
    phase === 'starting' ||
    phase === 'running' ||
    phase === 'pausing' ||
    phase === 'canceling' ||
    phase === 'resuming' ||
    phase === 'finalizing';
  if (isActive !== expectedIsActive) {
    throw new Error(
      `${ERROR_PREFIX} session.isActive=${String(isActive)} is invalid for phase ${phase}`
    );
  }

  const startedAt =
    payload.startedAt === undefined
      ? undefined
      : requireNonNegativeNumber(payload.startedAt, 'session.startedAt');
  const inactiveMs =
    payload.inactiveMs === undefined
      ? undefined
      : requireNonNegativeNumber(payload.inactiveMs, 'session.inactiveMs');
  const completedAt =
    payload.completedAt === undefined
      ? undefined
      : requireNonNegativeNumber(payload.completedAt, 'session.completedAt');
  const pausedAt =
    payload.pausedAt === undefined
      ? undefined
      : requireNonNegativeNumber(payload.pausedAt, 'session.pausedAt');
  if (phase !== 'idle' && phase !== 'starting' && startedAt === undefined) {
    throw new Error(`${ERROR_PREFIX} session.startedAt is required for phase ${phase}`);
  }
  if ((phase === 'completed' || phase === 'failed') && completedAt === undefined) {
    throw new Error(`${ERROR_PREFIX} session.completedAt is required for phase ${phase}`);
  }
  if (phase === 'paused' && pausedAt === undefined) {
    throw new Error(`${ERROR_PREFIX} session.pausedAt is required for phase paused`);
  }
  if (phase !== 'paused' && pausedAt !== undefined) {
    throw new Error(`${ERROR_PREFIX} session.pausedAt must be absent for phase ${phase}`);
  }
  if (startedAt !== undefined && completedAt !== undefined) {
    const durationMs = completedAt - startedAt - (inactiveMs ?? 0);
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `${ERROR_PREFIX} session duration must be finite and non-negative, received ${durationMs}`
      );
    }
  }
  if (startedAt !== undefined && pausedAt !== undefined) {
    const durationMs = pausedAt - startedAt - (inactiveMs ?? 0);
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `${ERROR_PREFIX} paused session duration must be finite and non-negative, received ${durationMs}`
      );
    }
  }

  let stageId: StageId | undefined;
  if (payload.stageId === undefined) {
    if (payload.stageStartedAt !== undefined || payload.stageInactiveMs !== undefined) {
      throw new Error(`${ERROR_PREFIX} stage timing must be absent when session.stageId is absent`);
    }
  } else {
    stageId = resolveStageId(payload.stageId);
    requireNonNegativeNumber(payload.stageStartedAt, 'session.stageStartedAt');
    requireNonNegativeNumber(payload.stageInactiveMs, 'session.stageInactiveMs');
  }

  return {
    phase,
    isActive,
    startedAt,
    inactiveMs,
    completedAt,
    pausedAt,
    stopReason: requireOptionalString(payload.stopReason, 'session.stopReason'),
    stageId,
  };
};

const validateTask = <StageId extends string>(
  value: unknown,
  index: number,
  stageId: StageId,
  resolveStageId: (value: unknown) => StageId
): ValidatedCanonicalTask<StageId> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${ERROR_PREFIX} snapshot task at index ${index} must be an object`);
  }
  const task = value as TaskSummary;
  const taskStage = resolveStageId(task.stage);
  if (taskStage !== stageId) {
    throw new Error(
      `${ERROR_PREFIX} snapshot task stage mismatch: task.stage=${String(taskStage)} snapshot.stageId=${String(stageId)}`
    );
  }
  return {
    taskId: requireNonEmptyString(task.taskId, `snapshot.tasks[${index}].taskId`),
    version: requirePositiveInteger(task.version, `snapshot.tasks[${index}].version`),
    stage: taskStage,
    status: resolveTaskStatus(task.status),
    progress: requireProgressValue(task.progress, `snapshot.tasks[${index}].progress`),
    index,
    errorMessage: requireOptionalString(task.errorMessage, `snapshot.tasks[${index}].errorMessage`),
    metadata: requireOptionalRecord(task.metadata, `snapshot.tasks[${index}].metadata`),
  };
};

const validateStageSnapshot = <StageId extends string>(
  event: StageSnapshotUpdatedEvent,
  resolveStageId: (value: unknown) => StageId
): ValidatedCanonicalStageSnapshot<StageId> => {
  const stageId = resolveStageId(event.payload.stageId);
  if (!Array.isArray(event.payload.tasks)) {
    throw new Error(`${ERROR_PREFIX} stageSnapshot.tasks must be an array`);
  }
  const tasks = event.payload.tasks.map((task, index) =>
    validateTask(task, index, stageId, resolveStageId)
  );
  const taskIds = new Set<string>();
  for (const task of tasks) {
    if (taskIds.has(task.taskId)) {
      throw new Error(`${ERROR_PREFIX} duplicate taskId in stage snapshot: ${task.taskId}`);
    }
    taskIds.add(task.taskId);
  }
  const stageStartedAt = requireNonNegativeNumber(
    event.payload.stageStartedAt,
    'stageSnapshot.stageStartedAt'
  );
  const stageInactiveMs = requireNonNegativeNumber(
    event.payload.stageInactiveMs,
    'stageSnapshot.stageInactiveMs'
  );
  const stageCompletedAt =
    event.payload.stageCompletedAt === undefined
      ? undefined
      : requireNonNegativeNumber(event.payload.stageCompletedAt, 'stageSnapshot.stageCompletedAt');
  if (stageCompletedAt !== undefined) {
    const durationMs = stageCompletedAt - stageStartedAt - stageInactiveMs;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `${ERROR_PREFIX} stage duration must be finite and non-negative, received ${durationMs}`
      );
    }
  }
  return { stageId, tasks, stageStartedAt, stageInactiveMs, stageCompletedAt };
};

const validateTaskProgress = <StageId extends string>(
  event: TaskProgressUpdatedEvent,
  resolveStageId: (value: unknown) => StageId
): ValidatedCanonicalTaskProgress<StageId> => ({
  taskId: requireNonEmptyString(event.payload.taskId, 'taskProgress.taskId'),
  version: requirePositiveInteger(event.payload.version, 'taskProgress.version'),
  stageId: resolveStageId(event.payload.stageId),
  value: requireProgressValue(event.payload.value, 'taskProgress.value'),
  message: requireOptionalString(event.payload.message, 'taskProgress.message'),
  metadata: requireOptionalRecord(event.payload.metadata, 'taskProgress.metadata'),
});

export const createCanonicalBuildSessionSubscriptionKernel = <StageId extends string>(
  config: CreateCanonicalBuildSessionSubscriptionKernelConfig<StageId>
): CanonicalBuildSessionSubscriptionKernel => {
  const { consumer, resolveStageId } = config;
  const nodeIdText = String(config.nodeId);
  const initializedStages = new Set<StageId>();
  const bufferedProgressByStage = new Map<StageId, ValidatedCanonicalTaskProgress<StageId>[]>();
  const taskIdsByStage = new Map<StageId, Set<string>>();
  const taskStageById = new Map<string, StageId>();
  const acceptedVersionByTaskId = new Map<string, number>();
  let acceptedSessionStartedAt: number | undefined;
  let acceptedSessionPhase: SessionPhase | undefined;
  let disposed = false;

  const resetForNewSession = (): void => {
    initializedStages.clear();
    bufferedProgressByStage.clear();
    taskIdsByStage.clear();
    taskStageById.clear();
    acceptedVersionByTaskId.clear();
    consumer.onReset();
  };

  const acceptProgress = (progress: ValidatedCanonicalTaskProgress<StageId>): void => {
    const taskStage = taskStageById.get(progress.taskId);
    if (taskStage === undefined) {
      throw new Error(
        `${ERROR_PREFIX} progress references task absent from authoritative snapshot: ${progress.taskId}`
      );
    }
    if (taskStage !== progress.stageId) {
      throw new Error(
        `${ERROR_PREFIX} task progress stage mismatch: task.stage=${String(taskStage)} event.stageId=${String(progress.stageId)}`
      );
    }
    const acceptedVersion = acceptedVersionByTaskId.get(progress.taskId);
    if (acceptedVersion !== undefined && progress.version <= acceptedVersion) return;
    acceptedVersionByTaskId.set(progress.taskId, progress.version);
    consumer.onTaskProgress(progress);
  };

  const handleSessionStatus = (rawEvent: unknown): void => {
    const event = requireEvent<SessionStatusUpdatedEvent>(rawEvent, 'sessionStatusUpdated');
    const eventNodeId = requireNonEmptyString(event.payload.nodeId, 'session.nodeId');
    if (eventNodeId !== nodeIdText) return;
    const status = validateSessionStatus(event, resolveStageId);
    const enteredStarting = status.phase === 'starting' && acceptedSessionPhase !== 'starting';
    const startedAtChanged =
      status.startedAt !== undefined &&
      acceptedSessionStartedAt !== undefined &&
      status.startedAt !== acceptedSessionStartedAt;
    if (enteredStarting || startedAtChanged) {
      resetForNewSession();
    }
    if (enteredStarting) {
      acceptedSessionStartedAt = undefined;
    } else if (status.startedAt !== undefined) {
      acceptedSessionStartedAt = status.startedAt;
    }
    acceptedSessionPhase = status.phase;
    consumer.onSessionStatus(status);
  };

  const handleStageSnapshot = (rawEvent: unknown): void => {
    const event = requireEvent<StageSnapshotUpdatedEvent>(rawEvent, 'stageSnapshotUpdated');
    const snapshot = validateStageSnapshot(event, resolveStageId);
    const nextTaskIds = new Set(snapshot.tasks.map((task) => task.taskId));
    for (const task of snapshot.tasks) {
      const existingStage = taskStageById.get(task.taskId);
      if (existingStage !== undefined && existingStage !== snapshot.stageId) {
        throw new Error(`${ERROR_PREFIX} taskId belongs to multiple stages: ${task.taskId}`);
      }
    }
    const buffered = bufferedProgressByStage.get(snapshot.stageId) ?? [];
    for (const progress of buffered) {
      if (!nextTaskIds.has(progress.taskId)) {
        throw new Error(
          `${ERROR_PREFIX} buffered progress references task absent from authoritative snapshot: ${progress.taskId}`
        );
      }
    }

    consumer.onStageSnapshot(snapshot);

    const previousTaskIds = taskIdsByStage.get(snapshot.stageId) ?? new Set<string>();
    for (const taskId of previousTaskIds) {
      if (nextTaskIds.has(taskId)) continue;
      taskStageById.delete(taskId);
      acceptedVersionByTaskId.delete(taskId);
    }
    for (const task of snapshot.tasks) {
      taskStageById.set(task.taskId, snapshot.stageId);
      const acceptedVersion = acceptedVersionByTaskId.get(task.taskId);
      acceptedVersionByTaskId.set(
        task.taskId,
        acceptedVersion === undefined ? task.version : Math.max(acceptedVersion, task.version)
      );
    }
    taskIdsByStage.set(snapshot.stageId, nextTaskIds);
    initializedStages.add(snapshot.stageId);
    bufferedProgressByStage.delete(snapshot.stageId);
    for (const progress of buffered) {
      acceptProgress(progress);
    }
  };

  const handleTaskProgress = (rawEvent: unknown): void => {
    const event = requireEvent<TaskProgressUpdatedEvent>(rawEvent, 'taskProgressUpdated');
    const progress = validateTaskProgress(event, resolveStageId);
    if (!initializedStages.has(progress.stageId)) {
      const buffered = bufferedProgressByStage.get(progress.stageId) ?? [];
      buffered.push(progress);
      bufferedProgressByStage.set(progress.stageId, buffered);
      return;
    }
    acceptProgress(progress);
  };

  const handleHeartbeat = (rawEvent: unknown): void => {
    const event = requireEvent<HeartbeatEvent>(rawEvent, 'heartbeat');
    const eventNodeId = requireNonEmptyString(event.payload.nodeId, 'heartbeat.nodeId');
    if (eventNodeId !== nodeIdText) return;
    consumer.onHeartbeat({
      heartbeatAt: requireNonNegativeNumber(event.payload.heartbeatAt, 'heartbeat.heartbeatAt'),
    });
  };

  const deliver = (handler: (rawEvent: unknown) => void, rawEvent: unknown): void => {
    if (disposed) return;
    try {
      handler(rawEvent);
    } catch (error) {
      const resolved = error instanceof Error ? error : new Error(String(error));
      consumer.onError(resolved);
      throw resolved;
    }
  };

  return {
    handlers: {
      onTaskEvent: (event) => deliver(handleStageSnapshot, event),
      onProgressEvent: (event) => deliver(handleTaskProgress, event),
      onSessionState: (event) => deliver(handleSessionStatus, event),
      onHeartbeat: (event) => deliver(handleHeartbeat, event),
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      initializedStages.clear();
      bufferedProgressByStage.clear();
      taskIdsByStage.clear();
      taskStageById.clear();
      acceptedVersionByTaskId.clear();
    },
  };
};
