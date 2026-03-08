import { atom } from 'jotai';
import type { BuildTaskSummary } from '@hierarchidb/build-api';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { TaskListViewPhase } from './shapeBuildProgressTypes';
import {
  createBuildSessionStateTreeAtoms,
  type BuildSessionStateTreeEvent,
  type BuildSessionTaskItem,
  type BuildSessionTaskStatus,
  type BuildSessionStateTreeLifecyclePhase,
} from '@hierarchidb/ui-build-sessions';
import type { BuildSessionLifecyclePhase } from '@hierarchidb/ui-build-sessions';

export type ShapeStageId = 'source' | 'geometry' | 'tileEmit';
export type ShapeSessionPhase = BuildSessionLifecyclePhase;
type ShapeTaskSummary = BuildTaskSummary;
type ShapeStateTreeEvent = BuildSessionStateTreeEvent<ShapeStageId>;

const shapeStateTree = createBuildSessionStateTreeAtoms<ShapeStageId>({
  nodeId: '',
  stageIds: ['source', 'geometry', 'tileEmit'] as const,
  defaultActiveStageId: 'source',
  initialSession: {
    phase: 'idle',
    isActive: false,
  },
});

const resolveShapeStageId = (value: unknown): ShapeStageId => {
  if (value === 'source' || value === 'geometry' || value === 'tileEmit') {
    return value;
  }
  throw new Error(`[shape buildSessionStateAtoms] unsupported stage: ${String(value)}`);
};

const assertProgressRange = (value: number): number => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`[shape buildSessionStateAtoms] progress must be within 0..100, received ${String(value)}`);
  }
  return value;
};

const mapSessionPhaseToTreePhase = (
  phase: ShapeSessionPhase,
): BuildSessionStateTreeLifecyclePhase => {
  if (phase === 'idle') return 'idle';
  if (phase === 'starting') return 'starting';
  if (phase === 'running') return 'running';
  if (phase === 'pausing') return 'pausing';
  if (phase === 'paused') return 'paused';
  if (phase === 'resuming') return 'resuming';
  if (phase === 'finalizing') return 'finalizing';
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  throw new Error(`[shape buildSessionStateAtoms] unsupported lifecycle phase: ${String(phase)}`);
};

const mapBuildStatusToTreeTaskStatus = (
  status: BuildTaskSummary['status'],
): BuildSessionTaskStatus => {
  if (status === 'queued') return 'queued';
  if (status === 'running') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'recycled') return 'recycled';
  throw new Error(`[shape buildSessionStateAtoms] unsupported task status for state-tree: ${String(status)}`);
};

const mapTreeTaskStatusToBuildStatus = (
  status: BuildSessionTaskStatus,
): BuildTaskSummary['status'] => {
  if (status === 'queued') return 'queued';
  if (status === 'running') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'recycled') return 'recycled';
  throw new Error(`[shape buildSessionStateAtoms] unsupported task status for legacy state: ${String(status)}`);
};

const isActivePhase = (phase: ShapeSessionPhase): boolean => (
  phase === 'starting'
  || phase === 'running'
  || phase === 'pausing'
  || phase === 'resuming'
  || phase === 'finalizing'
);

type LifecycleExtras = {
  startedAt?: number;
  heartbeatAt?: number;
  completedAt?: number;
  stageId?: ShapeStageId;
  stopReason?: ShapeBuildStopReason;
  inactiveMs?: number;
  stageStartedAt?: number;
  stageInactiveMs?: number;
  criticalError?: {
    message: string;
    error: string;
    errorName: string;
    contractViolation: boolean;
  };
};

type StageProgress = {
  value: number;
  phase: ShapeSessionPhase;
  message?: string;
  metadata?: Record<string, unknown>;
};

type StageUiSyncPhase = 'ui-initializing' | 'running';

const initialLifecycleExtras = (): LifecycleExtras => ({
  startedAt: undefined,
  heartbeatAt: undefined,
  completedAt: undefined,
});

const initialStageProgress = (): Record<ShapeStageId, StageProgress> => ({
  source: { value: 0, phase: 'idle' },
  geometry: { value: 0, phase: 'idle' },
  tileEmit: { value: 0, phase: 'idle' },
});

const initialUiSyncPhaseByStage = (): Record<ShapeStageId, StageUiSyncPhase> => ({
  source: 'ui-initializing',
  geometry: 'ui-initializing',
  tileEmit: 'ui-initializing',
});

const lifecycleExtrasAtom = atom<LifecycleExtras>(initialLifecycleExtras());
const stageProgressAtom = atom<Record<ShapeStageId, StageProgress>>(initialStageProgress());
const taskStreamConnectedAtom = atom(false);
const uiSyncPhaseByStageAtom = atom<Record<ShapeStageId, StageUiSyncPhase>>(initialUiSyncPhaseByStage());

const toTaskItem = (task: BuildTaskSummary): BuildSessionTaskItem<ShapeStageId> => ({
  taskId: task.taskId,
  version: task.version,
  stage: resolveShapeStageId(task.stage),
  status: mapBuildStatusToTreeTaskStatus(task.status),
  progress: assertProgressRange(task.progress),
  index: typeof task.sequence === 'number' ? task.sequence : Number.MAX_SAFE_INTEGER,
  message: (() => {
    const value = (task as unknown as { title?: unknown }).title;
    return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
  })(),
  display: task.display,
  metadata: task.metadata,
});

type ShapeRuntimeSnapshotEvent = {
  type: 'runtimeSnapshotReceived';
  eventVersion: number;
  payload: {
    nodeId: string;
    sessionId?: string;
    phase: ShapeSessionPhase;
    isActive: boolean;
    startedAt?: number;
    heartbeatAt?: number;
    completedAt?: number;
  };
};

type ShapeSessionRecordEvent = {
  type: 'sessionRecordReceived';
  eventVersion: number;
  payload: {
    nodeId: string;
    phase: ShapeSessionPhase;
    completedAt?: number;
    heartbeatAt?: number;
    startedAt?: number;
    stageId?: ShapeStageId;
    stopReason?: ShapeBuildStopReason;
    inactiveMs?: number;
    stageStartedAt?: number;
    stageInactiveMs?: number;
  };
};

type ShapeTaskSnapshotEvent = {
  type: 'taskSnapshotReceived';
  eventVersion: number;
  payload: {
    stageId: ShapeStageId;
    tasks: ShapeTaskSummary[];
  };
};

type ShapeTaskUpdatedEvent = {
  type: 'taskUpdated';
  eventVersion: number;
  payload: {
    stageId: ShapeStageId;
    task: ShapeTaskSummary;
  };
};

type ShapeTaskDeletedEvent = {
  type: 'taskDeleted';
  eventVersion: number;
  payload: {
    stageId: ShapeStageId;
    taskId: string;
  };
};

type ShapeProgressEvent = {
  type: 'progressReceived';
  eventVersion: number;
  payload: {
    stageId: ShapeStageId;
    value: number;
    phase: ShapeSessionPhase;
    message?: string;
    metadata?: Record<string, unknown>;
  };
};

type ShapeTaskStreamConnectionEvent = {
  type: 'taskStreamConnectionChanged';
  payload: {
    connected: boolean;
  };
};

type ShapeViewSelectionChangedEvent = {
  type: 'viewSelectionChanged';
  payload: {
    activeStageId?: ShapeStageId;
    selectedTaskId?: string | null;
  };
};

type ShapeUiSyncPhaseChangedEvent = {
  type: 'uiSyncPhaseChanged';
  payload: {
    stageId: ShapeStageId;
    phase: StageUiSyncPhase;
  };
};

type ShapeCriticalErrorEvent = {
  type: 'criticalError';
  payload: {
    message: string;
    error: string;
    errorName: string;
    timestamp: number;
    severity: 'critical';
    contractViolation: boolean;
  };
};

type ShapeResetEvent = {
  type: 'reset';
};

export type ShapeBuildSessionStateEvent =
  | ShapeRuntimeSnapshotEvent
  | ShapeSessionRecordEvent
  | ShapeTaskSnapshotEvent
  | ShapeTaskUpdatedEvent
  | ShapeTaskDeletedEvent
  | ShapeProgressEvent
  | ShapeTaskStreamConnectionEvent
  | ShapeViewSelectionChangedEvent
  | ShapeUiSyncPhaseChangedEvent
  | ShapeCriticalErrorEvent
  | ShapeResetEvent;

const dispatchTreeEventAtom = shapeStateTree.dispatchBuildSessionStateTreeEventAtom;
type ShapeBuildSessionNonResetEvent = Exclude<ShapeBuildSessionStateEvent, ShapeResetEvent>;

export const buildSessionRuntimeAtom = atom((get) => {
  const tree = get(shapeStateTree.buildSessionStateTreeAtom);
  const lifecycleExtras = get(lifecycleExtrasAtom);
  return {
    phase: tree.session.phase as ShapeSessionPhase,
    isActive: tree.session.isActive,
    activeStageId: tree.ui.activeStageId,
    lastAcceptedEventVersion: tree.meta.lastAcceptedEventVersion,
    startedAt: lifecycleExtras.startedAt,
    heartbeatAt: lifecycleExtras.heartbeatAt,
    completedAt: lifecycleExtras.completedAt,
    stageId: lifecycleExtras.stageId,
    stopReason: lifecycleExtras.stopReason,
    inactiveMs: lifecycleExtras.inactiveMs,
    stageStartedAt: lifecycleExtras.stageStartedAt,
    stageInactiveMs: lifecycleExtras.stageInactiveMs,
    criticalError: lifecycleExtras.criticalError,
  };
});

export const buildSessionTaskStreamConnectedAtom = atom((get) => get(taskStreamConnectedAtom));

const resetBuildSessionStateAtom = atom(
  null,
  (_get, set) => {
    set(dispatchTreeEventAtom, { type: 'reset' });
    set(lifecycleExtrasAtom, initialLifecycleExtras());
    set(stageProgressAtom, initialStageProgress());
    set(taskStreamConnectedAtom, false);
    set(uiSyncPhaseByStageAtom, initialUiSyncPhaseByStage());
  },
);

const applyBuildSessionEventAtom = atom(
  null,
  (get, set, event: ShapeBuildSessionNonResetEvent) => {

    const beforeVersion = get(shapeStateTree.buildSessionStateTreeAtom).meta.lastAcceptedEventVersion;
    const dispatchTreeEvent = (treeEvent: ShapeStateTreeEvent): boolean => {
      set(dispatchTreeEventAtom, treeEvent);
      const afterVersion = get(shapeStateTree.buildSessionStateTreeAtom).meta.lastAcceptedEventVersion;
      return afterVersion > beforeVersion;
    };

    switch (event.type) {
      case 'runtimeSnapshotReceived': {
        const accepted = dispatchTreeEvent({
          type: 'sessionPatched',
          eventVersion: event.eventVersion,
          payload: {
            phase: mapSessionPhaseToTreePhase(event.payload.phase),
            isActive: event.payload.isActive,
          },
        });
        if (!accepted) return;
        set(lifecycleExtrasAtom, (current) => ({
          ...current,
          startedAt: event.payload.startedAt ?? current.startedAt,
          heartbeatAt: event.payload.heartbeatAt ?? current.heartbeatAt,
          completedAt: event.payload.completedAt ?? current.completedAt,
        }));
        return;
      }
      case 'sessionRecordReceived': {
        const accepted = dispatchTreeEvent({
          type: 'sessionPatched',
          eventVersion: event.eventVersion,
          payload: {
            phase: mapSessionPhaseToTreePhase(event.payload.phase),
            isActive: isActivePhase(event.payload.phase),
          },
        });
        if (!accepted) return;
        set(lifecycleExtrasAtom, (current) => ({
          ...current,
          startedAt: event.payload.startedAt ?? current.startedAt,
          heartbeatAt: event.payload.heartbeatAt ?? current.heartbeatAt,
          completedAt: event.payload.completedAt ?? current.completedAt,
          stageId: event.payload.stageId ?? current.stageId,
          stopReason: event.payload.stopReason ?? current.stopReason,
          inactiveMs: event.payload.inactiveMs ?? current.inactiveMs,
          stageStartedAt: event.payload.stageStartedAt ?? current.stageStartedAt,
          stageInactiveMs: event.payload.stageInactiveMs ?? current.stageInactiveMs,
        }));
        return;
      }
      case 'taskSnapshotReceived': {
        dispatchTreeEvent({
          type: 'tasksReplaced',
          eventVersion: event.eventVersion,
          payload: {
            stageId: event.payload.stageId,
            tasks: event.payload.tasks.map(toTaskItem),
          },
        });
        return;
      }
      case 'taskUpdated': {
        dispatchTreeEvent({
          type: 'taskUpserted',
          eventVersion: event.eventVersion,
          payload: {
            task: toTaskItem(event.payload.task),
          },
        });
        return;
      }
      case 'taskDeleted': {
        dispatchTreeEvent({
          type: 'taskDeleted',
          eventVersion: event.eventVersion,
          payload: {
            stageId: event.payload.stageId,
            taskId: event.payload.taskId,
          },
        });
        return;
      }
      case 'progressReceived': {
        const value = assertProgressRange(event.payload.value);
        const activeAccepted = dispatchTreeEvent({
          type: 'activeStageChanged',
          payload: {
            stageId: event.payload.stageId,
          },
        });
        const lifecycleAccepted = dispatchTreeEvent({
          type: 'sessionPatched',
          eventVersion: event.eventVersion,
          payload: {
            phase: mapSessionPhaseToTreePhase(event.payload.phase),
            isActive: isActivePhase(event.payload.phase),
          },
        });
        if (!activeAccepted && !lifecycleAccepted) return;
        set(stageProgressAtom, (current) => ({
          ...current,
          [event.payload.stageId]: {
            value,
            phase: event.payload.phase,
            message: event.payload.message,
            metadata: event.payload.metadata,
          },
        }));
        return;
      }
      case 'uiSyncPhaseChanged': {
        set(dispatchTreeEventAtom, {
          type: 'activeStageChanged',
          payload: {
            stageId: event.payload.stageId,
          },
        });
        set(uiSyncPhaseByStageAtom, (current) => ({
          ...current,
          [event.payload.stageId]: event.payload.phase,
        }));
        return;
      }
      case 'taskStreamConnectionChanged':
        set(taskStreamConnectedAtom, event.payload.connected);
        return;
      case 'viewSelectionChanged': {
        if (event.payload.activeStageId) {
          set(dispatchTreeEventAtom, {
            type: 'activeStageChanged',
            payload: { stageId: event.payload.activeStageId },
          });
        }
        if (event.payload.selectedTaskId !== undefined) {
          const state = get(shapeStateTree.buildSessionStateTreeAtom);
          const targetStageId = event.payload.activeStageId ?? state.ui.activeStageId;
          set(dispatchTreeEventAtom, {
            type: 'stageUiPatched',
            payload: {
              stageId: targetStageId,
              patch: {
                selectedTaskId: event.payload.selectedTaskId ?? undefined,
              },
            },
          });
        }
        return;
      }
      case 'criticalError': {
        // Log critical error for immediate visibility
        console.error('🚨 CRITICAL BUILD SESSION ERROR 🚨', {
          message: event.payload.message,
          error: event.payload.error,
          errorName: event.payload.errorName,
          timestamp: new Date(event.payload.timestamp).toISOString(),
          contractViolation: event.payload.contractViolation,
        });
        
        // Force session to failed state to prevent contract violation hiding
        dispatchTreeEvent({
          type: 'sessionPatched',
          eventVersion: Date.now(), // Use timestamp as version for immediate processing
          payload: {
            phase: 'failed',
            isActive: false,
          },
        });
        
        // Store error details in lifecycle extras for UI access
        set(lifecycleExtrasAtom, (current) => ({
          ...current,
          stopReason: 'failed',
          completedAt: event.payload.timestamp,
          criticalError: {
            message: event.payload.message,
            error: event.payload.error,
            errorName: event.payload.errorName,
            contractViolation: event.payload.contractViolation,
          },
        }));
        return;
      }
      default:
        return;
    }
  },
);

export const dispatchBuildSessionEventAtom = atom(
  null,
  (_get, set, event: ShapeBuildSessionStateEvent) => {
    if (event.type === 'reset') {
      set(resetBuildSessionStateAtom);
      return;
    }
    set(applyBuildSessionEventAtom, event);
  },
);

export const buildSessionStartButtonLoadingAtom = atom((get) => {
  const runtime = get(buildSessionRuntimeAtom);
  const lifecycleActive = isActivePhase(runtime.phase);
  if (!lifecycleActive) return false;
  return !get(buildSessionTaskStreamConnectedAtom);
});

export const buildSessionStageCountersAtom = atom((get) => {
  const tree = get(shapeStateTree.buildSessionStateTreeAtom);
  const countByStatus = (stageId: ShapeStageId) => {
    let total = 0;
    let queued = 0;
    let running = 0;
    let failed = 0;
    let terminal = 0;
    for (const taskId of tree.tasks.orderedIdsByStage[stageId]) {
      const task = tree.tasks.byId[taskId];
      if (!task) continue;
      total += 1;
      if (task.status === 'queued') queued += 1;
      if (task.status === 'running') running += 1;
      if (task.status === 'failed') failed += 1;
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'recycled' || task.status === 'skipped') {
        terminal += 1;
      }
    }
    return { total, running, queued, terminal, failed };
  };
  return {
    source: countByStatus('source'),
    geometry: countByStatus('geometry'),
    tileEmit: countByStatus('tileEmit'),
  };
});

export const buildSessionTasksByStageAtom = atom<Record<ShapeStageId, BuildTaskSummary[]>>((get) => {
  const tree = get(shapeStateTree.buildSessionStateTreeAtom);
  const toSummary = (taskId: string): BuildTaskSummary | undefined => {
    const task = tree.tasks.byId[taskId];
    if (!task) return undefined;
    const summary = {
      taskId: task.taskId,
      version: task.version,
      stage: task.stage,
      status: mapTreeTaskStatusToBuildStatus(task.status),
      progress: task.progress,
      sequence: task.index,
      metadata: task.metadata,
      display: task.display,
    } as BuildTaskSummary & { title?: string };
    if (typeof task.message === 'string' && task.message.trim().length > 0) {
      summary.title = task.message;
    }
    return summary;
  };
  return {
    source: tree.tasks.orderedIdsByStage.source
      .map((id) => toSummary(id))
      .filter((task): task is BuildTaskSummary => task !== undefined),
    geometry: tree.tasks.orderedIdsByStage.geometry
      .map((id) => toSummary(id))
      .filter((task): task is BuildTaskSummary => task !== undefined),
    tileEmit: tree.tasks.orderedIdsByStage.tileEmit
      .map((id) => toSummary(id))
      .filter((task): task is BuildTaskSummary => task !== undefined),
  };
});

export const buildSessionStageProgressAtom = atom<Record<ShapeStageId, number>>((get) => {
  const progress = get(stageProgressAtom);
  return {
    source: progress.source.value,
    geometry: progress.geometry.value,
    tileEmit: progress.tileEmit.value,
  };
});

export const buildSessionTaskListViewPhaseAtom = atom<TaskListViewPhase>((get) => {
  const runtime = get(buildSessionRuntimeAtom);
  const tree = get(shapeStateTree.buildSessionStateTreeAtom);
  const uiSyncByStage = get(uiSyncPhaseByStageAtom);
  const activeStageUiSyncPhase = uiSyncByStage[tree.ui.activeStageId];
  const tasksByStage = get(buildSessionTasksByStageAtom);
  const totalTasks = (
    tasksByStage.source.length
    + tasksByStage.geometry.length
    + tasksByStage.tileEmit.length
  );
  if (totalTasks > 0) return 'streaming';
  if (runtime.phase === 'idle') return 'idle';
  if (
    runtime.phase === 'starting'
    || runtime.phase === 'running'
    || runtime.phase === 'pausing'
    || runtime.phase === 'resuming'
    || runtime.phase === 'finalizing'
  ) {
    if (activeStageUiSyncPhase === 'ui-initializing') {
      return 'ui-initializing';
    }
    return 'streaming';
  }
  return 'settledEmpty';
});

export const buildSessionSnapshotHandshakeReceivedAtom = atom<boolean>((get) => {
  const uiSyncByStage = get(uiSyncPhaseByStageAtom);
  return (
    uiSyncByStage.source === 'running'
    || uiSyncByStage.geometry === 'running'
    || uiSyncByStage.tileEmit === 'running'
  );
});
