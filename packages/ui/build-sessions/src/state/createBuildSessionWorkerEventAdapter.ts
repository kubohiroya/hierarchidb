import type {
  BuildProgressEvent,
  BuildSessionRuntimeRecord,
  BuildTaskSummary,
  BuildTaskUpdateEvent,
} from '@hierarchidb/build-api';
import type { BuildSessionStateEvent } from './createBuildSessionStateAtoms.js';

type RuntimeLike = BuildSessionRuntimeRecord;
type ProgressLike = BuildProgressEvent;

type AdapterConfig<StageId extends string, SessionPhase extends string> = {
  stages: readonly StageId[];
  resolveStageId: (value: unknown) => StageId;
  mapRuntimeStatusToPhase: (status: RuntimeLike['status']) => SessionPhase;
  mapSessionRecordStatusToPhase: (status: unknown) => SessionPhase;
  isActivePhase: (phase: SessionPhase) => boolean;
  resolveProgressValue: (event: ProgressLike) => number;
};

type Dispatch<StageId extends string, SessionPhase extends string> = (
  event: BuildSessionStateEvent<StageId, SessionPhase, BuildTaskSummary>,
) => void;

export type BuildSessionWorkerEventAdapter = {
  onRuntimeRecord: (record: BuildSessionRuntimeRecord) => void;
  onSessionState: (event: { nodeId: string; sessionRecord?: Record<string, unknown> | null }) => void;
  onTaskEvent: (event: BuildTaskUpdateEvent) => void;
  onProgressEvent: (event: BuildProgressEvent) => void;
  onTaskStreamConnectionChanged: (connected: boolean) => void;
  onHeartbeat: (event: { nodeId: string; heartbeatAt?: number }) => void;
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

const asOptionalFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
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
      if (String(event.nodeId) !== String(nodeId)) return;
      const sessionRecord = event.sessionRecord;
      if (!sessionRecord || typeof sessionRecord !== 'object') return;
      const phase = config.mapSessionRecordStatusToPhase((sessionRecord as { status?: unknown }).status);
      const stopReason = (sessionRecord as { stopReason?: unknown }).stopReason;
      dispatch({
        type: 'sessionStatusUpdated',
        payload: {
          nodeId: String(event.nodeId),
          phase,
          isActive: config.isActivePhase(phase),
          startedAt: asOptionalFiniteNumber((sessionRecord as { startedAt?: unknown }).startedAt),
          completedAt: asOptionalFiniteNumber((sessionRecord as { completedAt?: unknown }).completedAt),
          stopReason: typeof stopReason === 'string' ? stopReason : undefined,
        },
      });
    },

    onTaskEvent: (event) => {
      if (String(event.nodeId) !== String(nodeId)) return;
      if (event.type === 'snapshot') {
        // Group tasks by stage and emit one stageSnapshotUpdated per stage
        const grouped = new Map<StageId, BuildTaskSummary[]>();
        for (const rawTask of event.tasks) {
          const task = asTaskSummary(rawTask);
          const stageId = config.resolveStageId(task.stage);
          const current = grouped.get(stageId) ?? [];
          current.push(task);
          grouped.set(stageId, current);
        }
        // Emit snapshot for all known stages (empty array = zero tasks for that stage)
        for (const stageId of config.stages) {
          const tasks = grouped.get(stageId) ?? [];
          // stageStartedAt is undefined when the stage has not yet started;
          // no fallback is applied (Date.now() or similar defaults are contract violations).
          const explicitVersion = (event as { version?: unknown }).version;
          const stageStartedAt = typeof explicitVersion === 'number' && Number.isFinite(explicitVersion)
            ? explicitVersion
            : undefined;
          dispatch({
            type: 'stageSnapshotUpdated',
            payload: {
              stageId,
              tasks,
              stageStartedAt,
              stageInactiveMs: 0,
              stageCompletedAt: undefined,
            },
          });
        }
        return;
      }
      // 'update' and 'delete' events are not supported in the new design.
      // The Worker always sends full snapshots; incremental updates are not used.
      throw new Error(
        `[buildSessionWorkerEventAdapter] unexpected task event type: ${String((event as { type: unknown }).type)}. Only 'snapshot' is supported.`,
      );
    },

    onProgressEvent: (event) => {
      if (String(event.nodeId) !== String(nodeId)) return;
      const payload = event.payload as Record<string, unknown> | undefined;
      dispatch({
        type: 'taskProgressUpdated',
        payload: {
          stageId: config.resolveStageId(event.stage),
          value: config.resolveProgressValue(event),
          message: event.message,
          metadata: payload?.meta as Record<string, unknown> | undefined,
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
      if (String(event.nodeId) !== String(nodeId)) return;
      const heartbeatAt = requireFiniteNumber(event.heartbeatAt, 'heartbeatAt');
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
