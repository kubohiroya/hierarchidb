import { atom } from 'jotai';
import type { BuildTaskSummary } from '@hierarchidb/build-api';
import type { ShapeBuildStopReason } from '@hierarchidb/shape-api';
import type { TaskListViewPhase } from './shapeBuildProgressTypes';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import {
  createBuildSessionStateAtoms,
  type BuildSessionLifecyclePhase,
  type BuildSessionStateEvent,
} from '@hierarchidb/ui-build-sessions';

export type ShapeStageId = 'source' | 'geometry' | 'tileEmit';
export type ShapeSessionPhase = BuildSessionLifecyclePhase;
type ShapeTaskSummary = BuildTaskSummary;
type ShapeStateEvent = BuildSessionStateEvent<ShapeStageId, ShapeSessionPhase, ShapeTaskSummary>;

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

const isActivePhase = (phase: ShapeSessionPhase): boolean => (
  phase === 'starting'
  || phase === 'running'
  || phase === 'pausing'
  || phase === 'resuming'
  || phase === 'finalizing'
);

// --- createBuildSessionStateAtoms instance ---

const shapeSessionAtoms = createBuildSessionStateAtoms<ShapeStageId, ShapeSessionPhase, ShapeTaskSummary>({
  stages: ['source', 'geometry', 'tileEmit'] as const,
  defaultStageId: 'source',
  idlePhase: 'idle',
  resolveTaskStageId: (task) => resolveShapeStageId(task.stage),
  isTerminalTaskStatus: (status) => (
    status === 'completed' || status === 'failed' || status === 'recycled'
  ),
  isRunningTaskStatus: (status) => status === 'running',
  isQueuedTaskStatus: (status) => status === 'queued',
});

// --- Lifecycle extras (stopReason, criticalError) ---

type LifecycleExtras = {
  stopReason?: ShapeBuildStopReason;
  criticalError?: {
    message: string;
    error: string;
    errorName: string;
    contractViolation: boolean;
  };
};

type StageUiSyncPhase = 'ui-initializing' | 'running';

const initialLifecycleExtras = (): LifecycleExtras => ({});

const initialUiSyncPhaseByStage = (): Record<ShapeStageId, StageUiSyncPhase> => ({
  source: 'ui-initializing',
  geometry: 'ui-initializing',
  tileEmit: 'ui-initializing',
});

const lifecycleExtrasAtom = atom<LifecycleExtras>(initialLifecycleExtras());
const uiSyncPhaseByStageAtom = atom<Record<ShapeStageId, StageUiSyncPhase>>(initialUiSyncPhaseByStage());

// --- Canonical 4-event types (Worker → UI) ---

type ShapeSessionStatusUpdatedEvent = {
  type: 'sessionStatusUpdated';
  payload: {
    nodeId: string;
    phase: ShapeSessionPhase;
    isActive: boolean;
    startedAt?: number;
    completedAt?: number;
    stopReason?: ShapeBuildStopReason;
  };
};

type ShapeHeartbeatEvent = {
  type: 'heartbeat';
  payload: {
    nodeId: string;
    heartbeatAt: number;
  };
};

type ShapeStageSnapshotUpdatedEvent = {
  type: 'stageSnapshotUpdated';
  payload: {
    stageId: ShapeStageId;
    tasks: ShapeTaskSummary[];
    stageStartedAt: number | undefined;
    stageInactiveMs: number;
    stageCompletedAt?: number;
  };
};

type ShapeTaskProgressUpdatedEvent = {
  type: 'taskProgressUpdated';
  payload: {
    stageId: ShapeStageId;
    value: number;
    message?: string;
    metadata?: Record<string, unknown>;
  };
};

// --- UI-internal events ---

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
    nodeId: string;
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
  | ShapeSessionStatusUpdatedEvent
  | ShapeHeartbeatEvent
  | ShapeStageSnapshotUpdatedEvent
  | ShapeTaskProgressUpdatedEvent
  | ShapeTaskStreamConnectionEvent
  | ShapeViewSelectionChangedEvent
  | ShapeUiSyncPhaseChangedEvent
  | ShapeCriticalErrorEvent
  | ShapeResetEvent;

type ShapeBuildSessionNonResetEvent = Exclude<ShapeBuildSessionStateEvent, ShapeResetEvent>;

// --- Derived read atoms ---

export const buildSessionLifecycleAtom = atom((get) => {
  const state = get(shapeSessionAtoms.buildSessionStateAtom);
  const extras = get(lifecycleExtrasAtom);
  return {
    phase: state.lifecycle.phase,
    isActive: state.lifecycle.isActive,
    activeStageId: state.view.activeStageId,
    startedAt: state.lifecycle.startedAt,
    heartbeatAt: state.lifecycle.heartbeatAt,
    completedAt: state.lifecycle.completedAt,
    criticalError: extras.criticalError,
    stopReason: extras.stopReason,
  };
});

export const buildSessionTaskStreamConnectedAtom = atom((get) => (
  get(shapeSessionAtoms.buildSessionStateAtom).execution.taskStreamConnected
));

export const buildSessionStartButtonLoadingAtom = shapeSessionAtoms.buildSessionStartButtonLoadingAtom;

export const buildSessionStageCountersAtom = shapeSessionAtoms.buildSessionStageCountersAtom;

export const buildSessionTasksByStageAtom = atom<Record<ShapeStageId, BuildTaskSummary[]>>((get) => {
  const state = get(shapeSessionAtoms.buildSessionStateAtom);
  const toSummary = (stageId: ShapeStageId): BuildTaskSummary[] => {
    const stage = state.execution.stages[stageId];
    return stage.taskOrder
      .map((taskId) => stage.tasksById[taskId])
      .filter((task): task is ShapeTaskSummary => task !== undefined);
  };
  return {
    source: toSummary('source'),
    geometry: toSummary('geometry'),
    tileEmit: toSummary('tileEmit'),
  };
});

export const buildSessionStageProgressAtom = atom<Record<ShapeStageId, number>>((get) => {
  const state = get(shapeSessionAtoms.buildSessionStateAtom);
  return {
    source: state.execution.stages.source.progress.value,
    geometry: state.execution.stages.geometry.progress.value,
    tileEmit: state.execution.stages.tileEmit.progress.value,
  };
});

// --- Stage timing (derived from stageSnapshotUpdated, stored in execution.stages[x].timing) ---

export const stageTimingByStageAtom = atom((get) => {
  const state = get(shapeSessionAtoms.buildSessionStateAtom);
  return {
    source: state.execution.stages.source.timing,
    geometry: state.execution.stages.geometry.timing,
    tileEmit: state.execution.stages.tileEmit.timing,
  };
});

const computeStageDuration = (
  timing: { stageStartedAt: number | undefined; stageInactiveMs: number; stageCompletedAt?: number } | null,
): number => {
  if (!timing) return 0;
  if (timing.stageStartedAt === undefined) return 0;
  const end = timing.stageCompletedAt ?? Date.now();
  return Math.max(0, end - timing.stageStartedAt - timing.stageInactiveMs);
};

// Derived atom: computed directly from stageTimingByStageAtom (no ticker needed)
export const stageDurationMsByStageAtom = atom<Record<ShapeStageId, number>>((get) => {
  const timing = get(stageTimingByStageAtom);
  return {
    source: computeStageDuration(timing.source),
    geometry: computeStageDuration(timing.geometry),
    tileEmit: computeStageDuration(timing.tileEmit),
  };
});

// --- UiSyncPhase ---

export const buildSessionSnapshotHandshakeReceivedAtom = atom<boolean>((get) => {
  const uiSyncByStage = get(uiSyncPhaseByStageAtom);
  return (
    uiSyncByStage.source === 'running'
    || uiSyncByStage.geometry === 'running'
    || uiSyncByStage.tileEmit === 'running'
  );
});

export const buildSessionTaskListViewPhaseAtom = atom<TaskListViewPhase>((get) => {
  const lifecycle = get(buildSessionLifecycleAtom);
  const state = get(shapeSessionAtoms.buildSessionStateAtom);
  const uiSyncByStage = get(uiSyncPhaseByStageAtom);
  const activeStageUiSyncPhase = uiSyncByStage[state.view.activeStageId];
  const tasksByStage = get(buildSessionTasksByStageAtom);
  const totalTasks = (
    tasksByStage.source.length
    + tasksByStage.geometry.length
    + tasksByStage.tileEmit.length
  );
  if (totalTasks > 0) return 'streaming';
  if (lifecycle.phase === 'idle') return 'idle';
  if (isActivePhase(lifecycle.phase)) {
    if (activeStageUiSyncPhase === 'ui-initializing') {
      return 'ui-initializing';
    }
    return 'streaming';
  }
  return 'settledEmpty';
});

// --- Reset ---

const resetBuildSessionStateAtom = atom(
  null,
  (_get, set) => {
    set(shapeSessionAtoms.dispatchBuildSessionEventAtom, { type: 'reset' });
    set(lifecycleExtrasAtom, initialLifecycleExtras());
    set(uiSyncPhaseByStageAtom, initialUiSyncPhaseByStage());
    set(pendingUserActionBaseAtom, 'none');
    set(completionSnapshotBaseAtom, null);
    set(completionDialogOpenBaseAtom, false);
  },
);

// --- Event dispatch ---

const applyBuildSessionEventAtom = atom(
  null,
  (_get, set, event: ShapeBuildSessionNonResetEvent) => {
    switch (event.type) {
      case 'sessionStatusUpdated': {
        const stateEvent: ShapeStateEvent = {
          type: 'sessionStatusUpdated',
          payload: {
            nodeId: event.payload.nodeId,
            phase: event.payload.phase,
            isActive: event.payload.isActive,
            startedAt: event.payload.startedAt,
            completedAt: event.payload.completedAt,
            stopReason: event.payload.stopReason,
          },
        };
        set(shapeSessionAtoms.dispatchBuildSessionEventAtom, stateEvent);
        if (event.payload.stopReason !== undefined) {
          set(lifecycleExtrasAtom, (current) => ({
            ...current,
            stopReason: event.payload.stopReason,
          }));
        }
        return;
      }

      case 'heartbeat': {
        const stateEvent: ShapeStateEvent = {
          type: 'heartbeat',
          payload: {
            nodeId: event.payload.nodeId,
            heartbeatAt: event.payload.heartbeatAt,
          },
        };
        set(shapeSessionAtoms.dispatchBuildSessionEventAtom, stateEvent);
        return;
      }

      case 'stageSnapshotUpdated': {
        const stateEvent: ShapeStateEvent = {
          type: 'stageSnapshotUpdated',
          payload: {
            stageId: event.payload.stageId,
            tasks: event.payload.tasks.map((task) => {
              assertProgressRange(task.progress);
              return task;
            }),
            stageStartedAt: event.payload.stageStartedAt,
            stageInactiveMs: event.payload.stageInactiveMs,
            stageCompletedAt: event.payload.stageCompletedAt,
          },
        };
        set(shapeSessionAtoms.dispatchBuildSessionEventAtom, stateEvent);
        return;
      }

      case 'taskProgressUpdated': {
        assertProgressRange(event.payload.value);
        const stateEvent: ShapeStateEvent = {
          type: 'taskProgressUpdated',
          payload: {
            stageId: event.payload.stageId,
            value: event.payload.value,
            message: event.payload.message,
            metadata: event.payload.metadata,
          },
        };
        set(shapeSessionAtoms.dispatchBuildSessionEventAtom, stateEvent);
        return;
      }

      case 'uiSyncPhaseChanged': {
        const stateEvent: ShapeStateEvent = {
          type: 'viewSelectionChanged',
          payload: {
            activeStageId: event.payload.stageId,
          },
        };
        set(shapeSessionAtoms.dispatchBuildSessionEventAtom, stateEvent);
        set(uiSyncPhaseByStageAtom, (current) => ({
          ...current,
          [event.payload.stageId]: event.payload.phase,
        }));
        return;
      }

      case 'taskStreamConnectionChanged': {
        const stateEvent: ShapeStateEvent = {
          type: 'taskStreamConnectionChanged',
          payload: { connected: event.payload.connected },
        };
        set(shapeSessionAtoms.dispatchBuildSessionEventAtom, stateEvent);
        return;
      }

      case 'viewSelectionChanged': {
        const stateEvent: ShapeStateEvent = {
          type: 'viewSelectionChanged',
          payload: {
            activeStageId: event.payload.activeStageId,
            selectedTaskId: event.payload.selectedTaskId,
          },
        };
        set(shapeSessionAtoms.dispatchBuildSessionEventAtom, stateEvent);
        return;
      }

      case 'criticalError': {
        console.error('🚨 CRITICAL BUILD SESSION ERROR 🚨', {
          message: event.payload.message,
          error: event.payload.error,
          errorName: event.payload.errorName,
          timestamp: new Date(event.payload.timestamp).toISOString(),
          contractViolation: event.payload.contractViolation,
        });
        const stateEvent: ShapeStateEvent = {
          type: 'sessionStatusUpdated',
          payload: {
            nodeId: event.payload.nodeId,
            phase: 'failed',
            isActive: false,
            completedAt: event.payload.timestamp,
          },
        };
        set(shapeSessionAtoms.dispatchBuildSessionEventAtom, stateEvent);
        set(lifecycleExtrasAtom, (current) => ({
          ...current,
          stopReason: 'failed',
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

// --- (D) Pending user action ---

export type PendingUserAction = 'none' | 'starting' | 'stopping' | 'pausing' | 'cancelling';

const pendingUserActionBaseAtom = atom<PendingUserAction>('none');

export const pendingUserActionAtom = atom(
  (get) => get(pendingUserActionBaseAtom),
  (get, set, next: PendingUserAction) => {
    const current = get(pendingUserActionBaseAtom);
    if (current === next) return;
    set(pendingUserActionBaseAtom, next);
  },
);

export const isStopRequestedInFlightAtom = atom((get) => {
  const action = get(pendingUserActionAtom);
  return action === 'stopping' || action === 'pausing' || action === 'cancelling';
});

// --- (E) Completion snapshot ---

export type CompletionSnapshotData = {
  status: BuildStatus;
  stageLabel: string;
  taskTitle?: string;
  taskMessage?: string;
  reason?: string;
} | null;

const completionSnapshotBaseAtom = atom<CompletionSnapshotData>(null);

export const completionSnapshotAtom = atom(
  (get) => get(completionSnapshotBaseAtom),
  (_get, set, next: CompletionSnapshotData) => {
    set(completionSnapshotBaseAtom, next);
  },
);

const completionDialogOpenBaseAtom = atom(false);

export const completionDialogOpenAtom = atom(
  (get) => get(completionDialogOpenBaseAtom),
  (_get, set, next: boolean) => {
    set(completionDialogOpenBaseAtom, next);
  },
);
