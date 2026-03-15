import type {
  BuildSessionRuntimeRecord,
  BuildTaskSummary,
} from '@hierarchidb/build-api';
import type { BuildSessionStateEvent } from './createBuildSessionStateAtoms.js';

type RuntimeLike = BuildSessionRuntimeRecord;

type AdapterConfig<StageId extends string, SessionPhase extends string> = {
  stages: readonly StageId[];
  resolveStageId: (value: unknown) => StageId;
  mapRuntimeStatusToPhase: (status: RuntimeLike['status']) => SessionPhase;
  mapSessionRecordStatusToPhase: (status: unknown) => SessionPhase;
};

type Dispatch<StageId extends string, SessionPhase extends string> = (
  event: BuildSessionStateEvent<StageId, SessionPhase, BuildTaskSummary>,
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
    completedAt?: number;
    stopReason?: string;
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
    throw new Error(`[buildSessionWorkerEventAdapter] invalid task.version: ${String(task.version)}`);
  }
  if (typeof task.progress !== 'number' || !Number.isFinite(task.progress)) {
    throw new Error(`[buildSessionWorkerEventAdapter] invalid task.progress: ${String(task.progress)}`);
  }
  return task;
};

const requireFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[buildSessionWorkerEventAdapter] ${label} must be a finite number, received ${String(value)}`);
  }
  return value;
};

export const createBuildSessionWorkerEventAdapter = <
  StageId extends string,
  SessionPhase extends string,
>(
  nodeId: string,
  dispatch: Dispatch<StageId, SessionPhase>,
  config: AdapterConfig<StageId, SessionPhase>,
): BuildSessionWorkerEventAdapter => {
  return {
    onRuntimeRecord: (record) => {
      if (String(record.nodeId) !== String(nodeId)) return;
      const phase = config.mapRuntimeStatusToPhase(record.status);
      dispatch({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: String(record.nodeId),
          phase,
          isActive: record.isActive,
          startedAt: record.startedAt,
          completedAt: record.completedAt,
        },
      });
    },

    onSessionState: (event) => {
      if (String(event.payload.nodeId) !== String(nodeId)) return;
      const phase = config.mapSessionRecordStatusToPhase(event.payload.phase);
      dispatch({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: String(event.payload.nodeId),
          phase,
          isActive: event.payload.isActive,
          startedAt: event.payload.startedAt,
          completedAt: event.payload.completedAt,
          stopReason: event.payload.stopReason,
        },
      });
    },

    onTaskEvent: (event) => {
      const stageId = config.resolveStageId(event.payload.stageId);
      const tasks = event.payload.tasks.map((rawTask) => asTaskSummary(rawTask));
      dispatch({
        type: 'stageSnapshotUpdated',
        payload: {
          stageId,
          tasks,
          stageStartedAt: event.payload.stageStartedAt,
          stageInactiveMs: event.payload.stageInactiveMs,
          stageCompletedAt: event.payload.stageCompletedAt,
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
