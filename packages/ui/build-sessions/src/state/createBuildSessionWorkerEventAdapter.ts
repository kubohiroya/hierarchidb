import type {
  BuildProgressEvent,
  BuildSessionRuntimeRecord,
  BuildTaskSummary,
  BuildTaskUpdateEvent,
} from '@hierarchidb/build-api';
import type { BuildSessionStateEvent } from './createBuildSessionStateAtoms.js';

type RuntimeLike = BuildSessionRuntimeRecord;
type TaskEventLike = BuildTaskUpdateEvent;
type ProgressLike = BuildProgressEvent;

type AdapterConfig<StageId extends string, SessionPhase extends string, TaskSummary extends BuildTaskSummary> = {
  deleteEventTargetStages: readonly StageId[];
  resolveStageId: (value: unknown) => StageId;
  mapRuntimeStatusToPhase: (status: RuntimeLike['status']) => SessionPhase;
  mapProgressPhaseToSessionPhase: (phase: ProgressLike['phase']) => SessionPhase;
  mapSessionRecordStatusToPhase: (status: unknown) => SessionPhase;
  resolveRuntimeEventVersion: (record: RuntimeLike) => number;
  resolveSessionRecordEventVersion: (sessionRecord: Record<string, unknown>) => number;
  resolveTaskSnapshotEventVersion: (event: TaskEventLike) => number;
  resolveTaskUpdateEventVersion: (task: TaskSummary) => number;
  resolveTaskDeleteEventVersion: (event: TaskEventLike) => number;
  resolveProgressEventVersion: (event: ProgressLike) => number;
  resolveHeartbeatEventVersion: (event: { nodeId: string; heartbeatAt?: number }) => number;
  resolveProgressValue: (event: ProgressLike) => number;
};

type Dispatch<StageId extends string, SessionPhase extends string, TaskSummary extends BuildTaskSummary> = (
  event: BuildSessionStateEvent<StageId, SessionPhase, TaskSummary>,
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

export const createBuildSessionWorkerEventAdapter = <
  StageId extends string,
  SessionPhase extends string,
  TaskSummary extends BuildTaskSummary = BuildTaskSummary,
>(
  nodeId: string,
  dispatch: Dispatch<StageId, SessionPhase, TaskSummary>,
  config: AdapterConfig<StageId, SessionPhase, TaskSummary>,
): BuildSessionWorkerEventAdapter => {
  const dispatchRuntimeSnapshot = (params: {
    eventVersion: number;
    nodeId: string;
    sessionId?: string;
    phase: SessionPhase;
    isActive: boolean;
    startedAt?: number;
    heartbeatAt?: number;
    completedAt?: number;
  }) => {
    const { eventVersion, ...payload } = params;
    dispatch({
      type: 'runtimeSnapshotReceived',
      eventVersion,
      payload,
    });
  };

  return {
    onRuntimeRecord: (record) => {
      if (String(record.nodeId) !== String(nodeId)) return;
      dispatchRuntimeSnapshot({
        eventVersion: config.resolveRuntimeEventVersion(record),
        nodeId: String(record.nodeId),
        sessionId: String(record.nodeId),
        phase: config.mapRuntimeStatusToPhase(record.status),
        isActive: record.isActive,
        startedAt: record.startedAt,
        heartbeatAt: record.lastHeartbeatAt,
        completedAt: record.completedAt,
      });
    },
    onSessionState: (event) => {
      if (String(event.nodeId) !== String(nodeId)) return;
      const sessionRecord = event.sessionRecord;
      if (!sessionRecord || typeof sessionRecord !== 'object') return;
      const rawStageId = (sessionRecord as { stageId?: unknown }).stageId;
      dispatch({
        type: 'sessionRecordReceived',
        eventVersion: config.resolveSessionRecordEventVersion(sessionRecord),
        payload: {
          nodeId: String(event.nodeId),
          phase: config.mapSessionRecordStatusToPhase((sessionRecord as { status?: unknown }).status),
          completedAt: asOptionalFiniteNumber((sessionRecord as { completedAt?: unknown }).completedAt),
          heartbeatAt: asOptionalFiniteNumber((sessionRecord as { stageHeartbeatAt?: unknown }).stageHeartbeatAt),
          startedAt: asOptionalFiniteNumber((sessionRecord as { startedAt?: unknown }).startedAt),
          stageId: rawStageId === undefined ? undefined : config.resolveStageId(rawStageId),
          stopReason: typeof (sessionRecord as { stopReason?: unknown }).stopReason === 'string'
            ? (sessionRecord as { stopReason?: string }).stopReason
            : undefined,
          inactiveMs: asOptionalFiniteNumber((sessionRecord as { inactiveMs?: unknown }).inactiveMs),
          stageStartedAt: asOptionalFiniteNumber((sessionRecord as { stageStartedAt?: unknown }).stageStartedAt),
          stageInactiveMs: asOptionalFiniteNumber((sessionRecord as { stageInactiveMs?: unknown }).stageInactiveMs),
        },
      });
    },
    onTaskEvent: (event) => {
      if (String(event.nodeId) !== String(nodeId)) return;
      if (event.type === 'snapshot') {
        const baseEventVersion = config.resolveTaskSnapshotEventVersion(event);
        const grouped = new Map<StageId, TaskSummary[]>();
        for (const rawTask of event.tasks) {
          const task = asTaskSummary(rawTask) as TaskSummary;
          const stageId = config.resolveStageId(task.stage);
          const current = grouped.get(stageId) ?? [];
          current.push(task);
          grouped.set(stageId, current);
        }
        let eventVersion = baseEventVersion;
        for (const stageId of config.deleteEventTargetStages) {
          const tasks = grouped.get(stageId) ?? [];
          dispatch({
            type: 'taskSnapshotReceived',
            eventVersion,
            payload: {
              stageId,
              tasks,
            },
          });
          eventVersion += 1;
        }
        return;
      }
      if (event.type === 'update') {
        const task = asTaskSummary(event.task) as TaskSummary;
        dispatch({
          type: 'taskUpdated',
          eventVersion: config.resolveTaskUpdateEventVersion(task),
          payload: {
            stageId: config.resolveStageId(task.stage),
            task,
          },
        });
        return;
      }
      if (event.type === 'delete') {
        const eventVersion = config.resolveTaskDeleteEventVersion(event);
        for (const stageId of config.deleteEventTargetStages) {
          dispatch({
            type: 'taskDeleted',
            eventVersion,
            payload: {
              stageId,
              taskId: event.taskId,
            },
          });
        }
      }
    },
    onProgressEvent: (event) => {
      if (String(event.nodeId) !== String(nodeId)) return;
      const payload = event.payload as Record<string, unknown> | undefined;
      dispatch({
        type: 'progressReceived',
        eventVersion: config.resolveProgressEventVersion(event),
        payload: {
          stageId: config.resolveStageId(event.stage),
          value: config.resolveProgressValue(event),
          phase: config.mapProgressPhaseToSessionPhase(event.phase),
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
      dispatchRuntimeSnapshot({
        eventVersion: config.resolveHeartbeatEventVersion(event),
        nodeId: String(nodeId),
        sessionId: String(nodeId),
        phase: config.mapRuntimeStatusToPhase('running'),
        isActive: true,
        heartbeatAt: event.heartbeatAt,
      });
    },
  };
};
