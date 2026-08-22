import type { BuildSessionRuntimeRecord, BuildTaskSummary } from '@hierarchidb/build-api';
import type { BuildSessionStateEvent } from './createBuildSessionStateAtoms.js';

type RuntimeLike = BuildSessionRuntimeRecord;

type AdapterConfig<StageId extends string, SessionPhase extends string> = {
  stages: readonly StageId[];
  resolveStageId: (value: unknown) => StageId;
  mapRuntimeStatusToPhase: (status: RuntimeLike['status']) => SessionPhase;
  mapSessionRecordStatusToPhase: (status: unknown) => SessionPhase;
};

type Dispatch<StageId extends string, SessionPhase extends string> = (
  event: BuildSessionStateEvent<StageId, SessionPhase, BuildTaskSummary>
) => void;

// Canonical Worker→UI event types accepted by the adapter.
// These match the 4-event spec in docs/build-session-worker-ui-event-spec.md.
export type AdapterSessionStatusUpdatedEvent = {
  type: 'sessionStatusUpdated';
  payload: {
    nodeId: string;
    phase: string;
    isActive: boolean;
    startedAt?: number;
    inactiveMs?: number;
    completedAt?: number;
    pausedAt?: number;
    stopReason?: string;
    stageId?: string;
    stageStartedAt?: number;
    stageInactiveMs?: number;
  };
};

export type AdapterStageSnapshotUpdatedEvent = {
  type: 'stageSnapshotUpdated';
  payload: {
    stageId: string;
    tasks: BuildTaskSummary[];
    stageStartedAt: number;
    stageInactiveMs: number;
    stageCompletedAt?: number;
  };
};

export type AdapterTaskProgressUpdatedEvent = {
  type: 'taskProgressUpdated';
  payload: {
    stageId: string;
    value: number;
    message?: string;
    metadata?: Record<string, unknown>;
  };
};

export type AdapterHeartbeatEvent = {
  type: 'heartbeat';
  payload: {
    nodeId: string;
    heartbeatAt: number;
  };
};

export type BuildSessionWorkerEventAdapter = {
  onRuntimeRecord: (record: BuildSessionRuntimeRecord) => void;
  onSessionState: (event: AdapterSessionStatusUpdatedEvent) => void;
  onTaskEvent: (event: AdapterStageSnapshotUpdatedEvent) => void;
  onProgressEvent: (event: AdapterTaskProgressUpdatedEvent) => void;
  onTaskStreamConnectionChanged: (connected: boolean) => void;
  onHeartbeat: (event: AdapterHeartbeatEvent) => void;
};

const asTaskSummary = (task: BuildTaskSummary): BuildTaskSummary => {
  if (typeof task.taskId !== 'string' || task.taskId.length === 0) {
    throw new Error('[buildSessionWorkerEventAdapter] taskId must be a non-empty string');
  }
  if (typeof task.version !== 'number' || !Number.isFinite(task.version)) {
    throw new Error(
      `[buildSessionWorkerEventAdapter] invalid task.version: ${String(task.version)}`
    );
  }
  if (typeof task.progress !== 'number' || !Number.isFinite(task.progress)) {
    throw new Error(
      `[buildSessionWorkerEventAdapter] invalid task.progress: ${String(task.progress)}`
    );
  }
  return task;
};

const requireFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `[buildSessionWorkerEventAdapter] ${label} must be a finite number, received ${String(value)}`
    );
  }
  return value;
};

const requireFiniteNonNegativeNumber = (value: unknown, label: string): number => {
  const resolved = requireFiniteNumber(value, label);
  if (resolved < 0) {
    throw new Error(
      `[buildSessionWorkerEventAdapter] ${label} must be non-negative, received ${String(value)}`
    );
  }
  return resolved;
};

const validateSessionTiming = (
  phase: string,
  payload: AdapterSessionStatusUpdatedEvent['payload']
): void => {
  const requiresStartedAt = phase !== 'idle' && phase !== 'starting';
  const requiresCompletedAt = phase === 'completed' || phase === 'failed';
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

  if (requiresStartedAt && startedAt === undefined) {
    throw new Error(`[buildSessionWorkerEventAdapter] startedAt is required for phase ${phase}`);
  }
  if (requiresCompletedAt && completedAt === undefined) {
    throw new Error(`[buildSessionWorkerEventAdapter] completedAt is required for phase ${phase}`);
  }
  if (phase === 'paused' && pausedAt === undefined) {
    throw new Error('[buildSessionWorkerEventAdapter] pausedAt is required for phase paused');
  }
  if (phase !== 'paused' && pausedAt !== undefined) {
    throw new Error(`[buildSessionWorkerEventAdapter] pausedAt must be absent for phase ${phase}`);
  }
  if (startedAt !== undefined && completedAt !== undefined) {
    const durationMs = completedAt - startedAt - inactiveMs;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `[buildSessionWorkerEventAdapter] session duration must be finite and non-negative, received ${durationMs}`
      );
    }
  }
  if (startedAt !== undefined && pausedAt !== undefined) {
    const durationMs = pausedAt - startedAt - inactiveMs;
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        `[buildSessionWorkerEventAdapter] paused session duration must be finite and non-negative, received ${durationMs}`
      );
    }
  }
  if (payload.stageId === undefined) {
    if (payload.stageStartedAt !== undefined || payload.stageInactiveMs !== undefined) {
      throw new Error(
        '[buildSessionWorkerEventAdapter] stage timing must be absent when stageId is absent'
      );
    }
    return;
  }
  requireFiniteNonNegativeNumber(payload.stageStartedAt, 'stageStartedAt');
  requireFiniteNonNegativeNumber(payload.stageInactiveMs, 'stageInactiveMs');
};

export const createBuildSessionWorkerEventAdapter = <
  StageId extends string,
  SessionPhase extends string,
>(
  nodeId: string,
  dispatch: Dispatch<StageId, SessionPhase>,
  config: AdapterConfig<StageId, SessionPhase>
): BuildSessionWorkerEventAdapter => {
  return {
    onRuntimeRecord: (record) => {
      if (String(record.nodeId) !== String(nodeId)) return;
      const phase = config.mapRuntimeStatusToPhase(record.status);
      const payload: AdapterSessionStatusUpdatedEvent['payload'] = {
        nodeId: String(record.nodeId),
        phase: String(phase),
        isActive: record.isActive,
        startedAt: record.startedAt,
        inactiveMs: record.inactiveMs,
        completedAt: record.completedAt,
        pausedAt: String(phase) === 'paused' ? record.lastHeartbeatAt : undefined,
      };
      validateSessionTiming(String(phase), payload);
      dispatch({
        type: 'sessionStatusUpdated',
        payload: {
          ...payload,
          phase,
        },
      });
    },

    onSessionState: (event) => {
      if (String(event.payload.nodeId) !== String(nodeId)) return;
      const phase = config.mapSessionRecordStatusToPhase(event.payload.phase);
      validateSessionTiming(String(phase), event.payload);
      if (event.payload.stageId !== undefined) {
        config.resolveStageId(event.payload.stageId);
      }
      dispatch({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: String(event.payload.nodeId),
          phase,
          isActive: event.payload.isActive,
          startedAt: event.payload.startedAt,
          inactiveMs: event.payload.inactiveMs,
          completedAt: event.payload.completedAt,
          pausedAt: event.payload.pausedAt,
          stopReason: event.payload.stopReason,
        },
      });
    },

    onTaskEvent: (event) => {
      const stageId = config.resolveStageId(event.payload.stageId);
      const tasks = event.payload.tasks.map((rawTask) => asTaskSummary(rawTask));
      const stageStartedAt = requireFiniteNonNegativeNumber(
        event.payload.stageStartedAt,
        'stageStartedAt'
      );
      const stageInactiveMs = requireFiniteNonNegativeNumber(
        event.payload.stageInactiveMs,
        'stageInactiveMs'
      );
      const stageCompletedAt =
        event.payload.stageCompletedAt === undefined
          ? undefined
          : requireFiniteNonNegativeNumber(event.payload.stageCompletedAt, 'stageCompletedAt');
      if (stageCompletedAt !== undefined) {
        const durationMs = stageCompletedAt - stageStartedAt - stageInactiveMs;
        if (!Number.isFinite(durationMs) || durationMs < 0) {
          throw new Error(
            `[buildSessionWorkerEventAdapter] stage duration must be finite and non-negative, received ${durationMs}`
          );
        }
      }
      dispatch({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId,
          tasks,
          stageStartedAt,
          stageInactiveMs,
          stageCompletedAt,
        },
      });
    },

    onProgressEvent: (event) => {
      const stageId = config.resolveStageId(event.payload.stageId);
      dispatch({
        type: 'taskProgressUpdated',
        payload: {
          stageId,
          value: event.payload.value,
          message: event.payload.message,
          metadata: event.payload.metadata,
        },
      });
    },

    onTaskStreamConnectionChanged: (connected) => {
      dispatch({
        type: 'taskStreamConnectionChanged',
        payload: { connected },
      });
    },

    onHeartbeat: (event) => {
      if (String(event.payload.nodeId) !== String(nodeId)) return;
      const heartbeatAt = requireFiniteNumber(event.payload.heartbeatAt, 'heartbeatAt');
      dispatch({
        type: 'heartbeat',
        payload: {
          nodeId: String(nodeId),
          heartbeatAt,
        },
      });
    },
  };
};
