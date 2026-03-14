import { atom } from 'jotai';

export type BuildSessionLifecyclePhase =
  | 'idle'
  | 'starting'
  | 'queued'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'finalizing'
  | 'completed'
  | 'failed';

type BaseTaskSummary = {
  taskId: string;
  version: number;
  stage: string;
  status: string;
  progress: number;
};

type StageTiming = {
  stageStartedAt: number | undefined;
  stageInactiveMs: number;
  stageCompletedAt?: number;
};

type StageProgressState = {
  value: number;
  message?: string;
  metadata?: Record<string, unknown>;
};

type StageCounters = {
  total: number;
  running: number;
  queued: number;
  terminal: number;
  failed: number;
};

type StageExecutionState<StageId extends string, TaskSummary extends BaseTaskSummary> = {
  stageId: StageId;
  tasksById: Record<string, TaskSummary>;
  taskOrder: string[];
  counters: StageCounters;
  progress: StageProgressState;
  timing: StageTiming | null;
};

type BuildSessionLifecycleState<SessionPhase extends string> = {
  nodeId: string | null;
  phase: SessionPhase;
  isActive: boolean;
  startedAt?: number;
  heartbeatAt?: number;
  completedAt?: number;
  stopReason?: string;
};

type BuildSessionExecutionState<StageId extends string, TaskSummary extends BaseTaskSummary> = {
  taskStreamConnected: boolean;
  stages: Record<StageId, StageExecutionState<StageId, TaskSummary>>;
};

type BuildSessionViewState<StageId extends string> = {
  activeStageId: StageId;
  selectedTaskId: string | null;
};

export type BuildSessionState<
  StageId extends string,
  SessionPhase extends string,
  TaskSummary extends BaseTaskSummary,
> = {
  lifecycle: BuildSessionLifecycleState<SessionPhase>;
  execution: BuildSessionExecutionState<StageId, TaskSummary>;
  view: BuildSessionViewState<StageId>;
};

// --- Canonical 4-event types (Worker → UI) ---

type SessionStatusUpdatedEvent<SessionPhase extends string> = {
  type: 'sessionStatusUpdated';
  payload: {
    nodeId: string;
    phase: SessionPhase;
    isActive: boolean;
    startedAt?: number;
    completedAt?: number;
    stopReason?: string;
  };
};

type HeartbeatEvent = {
  type: 'heartbeat';
  payload: {
    nodeId: string;
    heartbeatAt: number;
  };
};

type StageSnapshotUpdatedEvent<StageId extends string, TaskSummary extends BaseTaskSummary> = {
  type: 'stageSnapshotUpdated';
  payload: {
    stageId: StageId;
    tasks: TaskSummary[];
    stageStartedAt: number | undefined;
    stageInactiveMs: number;
    stageCompletedAt?: number;
  };
};

type TaskProgressUpdatedEvent<StageId extends string> = {
  type: 'taskProgressUpdated';
  payload: {
    stageId: StageId;
    value: number;
    message?: string;
    metadata?: Record<string, unknown>;
  };
};

// --- UI-internal events (not from Worker) ---

type TaskStreamConnectionEvent = {
  type: 'taskStreamConnectionChanged';
  payload: {
    connected: boolean;
  };
};

type ViewSelectionChangedEvent<StageId extends string> = {
  type: 'viewSelectionChanged';
  payload: {
    activeStageId?: StageId;
    selectedTaskId?: string | null;
  };
};

type ResetEvent = {
  type: 'reset';
};

export type BuildSessionStateEvent<
  StageId extends string,
  SessionPhase extends string,
  TaskSummary extends BaseTaskSummary,
> =
  | SessionStatusUpdatedEvent<SessionPhase>
  | HeartbeatEvent
  | StageSnapshotUpdatedEvent<StageId, TaskSummary>
  | TaskProgressUpdatedEvent<StageId>
  | TaskStreamConnectionEvent
  | ViewSelectionChangedEvent<StageId>
  | ResetEvent;

type Config<
  StageId extends string,
  SessionPhase extends string,
  TaskSummary extends BaseTaskSummary,
> = {
  stages: readonly StageId[];
  defaultStageId: StageId;
  idlePhase: SessionPhase;
  resolveTaskStageId: (task: TaskSummary) => StageId;
  isTerminalTaskStatus: (status: TaskSummary['status']) => boolean;
  isRunningTaskStatus: (status: TaskSummary['status']) => boolean;
  isQueuedTaskStatus: (status: TaskSummary['status']) => boolean;
};

const assertProgressRange = (value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`[buildSessionStateAtoms] progress must be within 0..100, received ${value}`);
  }
};

const assertFiniteNumber = (value: number, label: string): void => {
  if (!Number.isFinite(value)) {
    throw new Error(`[buildSessionStateAtoms] ${label} must be a finite number, received ${value}`);
  }
};

export const createBuildSessionStateAtoms = <
  StageId extends string,
  SessionPhase extends string = BuildSessionLifecyclePhase,
  TaskSummary extends BaseTaskSummary = BaseTaskSummary,
>(config: Config<StageId, SessionPhase, TaskSummary>) => {
  const createEmptyStage = (stageId: StageId): StageExecutionState<StageId, TaskSummary> => ({
    stageId,
    tasksById: {},
    taskOrder: [],
    counters: {
      total: 0,
      running: 0,
      queued: 0,
      terminal: 0,
      failed: 0,
    },
    progress: {
      value: 0,
    },
    timing: null,
  });

  const buildCounters = (tasksById: Record<string, TaskSummary>, taskOrder: string[]): StageCounters => {
    let running = 0;
    let queued = 0;
    let terminal = 0;
    let failed = 0;
    for (const taskId of taskOrder) {
      const task = tasksById[taskId];
      if (!task) continue;
      if (config.isRunningTaskStatus(task.status)) running += 1;
      if (config.isQueuedTaskStatus(task.status)) queued += 1;
      if (config.isTerminalTaskStatus(task.status)) terminal += 1;
      if (task.status === 'failed') failed += 1;
    }
    return {
      total: taskOrder.length,
      running,
      queued,
      terminal,
      failed,
    };
  };

  const initialState = (): BuildSessionState<StageId, SessionPhase, TaskSummary> => {
    const stages = config.stages.reduce<Record<StageId, StageExecutionState<StageId, TaskSummary>>>((acc, stageId) => {
      acc[stageId] = createEmptyStage(stageId);
      return acc;
    }, {} as Record<StageId, StageExecutionState<StageId, TaskSummary>>);

    return {
      lifecycle: {
        nodeId: null,
        phase: config.idlePhase,
        isActive: false,
      },
      execution: {
        taskStreamConnected: false,
        stages,
      },
      view: {
        activeStageId: config.defaultStageId,
        selectedTaskId: null,
      },
    };
  };

  const applyStageSnapshot = (
    state: BuildSessionState<StageId, SessionPhase, TaskSummary>,
    stageId: StageId,
    tasks: TaskSummary[],
    timing: StageTiming,
  ): BuildSessionState<StageId, SessionPhase, TaskSummary> => {
    const nextTasksById: Record<string, TaskSummary> = {};
    const nextOrder: string[] = [];
    for (const task of tasks) {
      if (config.resolveTaskStageId(task) !== stageId) {
        throw new Error(
          `[buildSessionStateAtoms] task.stage (${String(task.stage)}) does not match target stage (${String(stageId)})`,
        );
      }
      assertProgressRange(task.progress);
      nextTasksById[task.taskId] = task;
      nextOrder.push(task.taskId);
    }
    const currentStage = state.execution.stages[stageId];
    const nextStage: StageExecutionState<StageId, TaskSummary> = {
      ...currentStage,
      tasksById: nextTasksById,
      taskOrder: nextOrder,
      counters: buildCounters(nextTasksById, nextOrder),
      timing,
    };
    return {
      ...state,
      execution: {
        ...state.execution,
        stages: {
          ...state.execution.stages,
          [stageId]: nextStage,
        },
      },
    };
  };

  const reduceBuildSessionState = (
    state: BuildSessionState<StageId, SessionPhase, TaskSummary>,
    event: BuildSessionStateEvent<StageId, SessionPhase, TaskSummary>,
  ): BuildSessionState<StageId, SessionPhase, TaskSummary> => {
    switch (event.type) {
      case 'reset':
        return initialState();

      case 'sessionStatusUpdated':
        return {
          ...state,
          lifecycle: {
            ...state.lifecycle,
            nodeId: event.payload.nodeId,
            phase: event.payload.phase,
            isActive: event.payload.isActive,
            startedAt: event.payload.startedAt ?? state.lifecycle.startedAt,
            completedAt: event.payload.completedAt ?? state.lifecycle.completedAt,
            stopReason: event.payload.stopReason ?? state.lifecycle.stopReason,
          },
        };

      case 'heartbeat': {
        assertFiniteNumber(event.payload.heartbeatAt, 'heartbeatAt');
        return {
          ...state,
          lifecycle: {
            ...state.lifecycle,
            heartbeatAt: event.payload.heartbeatAt,
          },
        };
      }

      case 'stageSnapshotUpdated': {
        // stageStartedAt may be undefined when the stage has not yet started
        if (event.payload.stageStartedAt !== undefined) {
          assertFiniteNumber(event.payload.stageStartedAt, 'stageStartedAt');
        }
        assertFiniteNumber(event.payload.stageInactiveMs, 'stageInactiveMs');
        if (event.payload.stageCompletedAt !== undefined) {
          assertFiniteNumber(event.payload.stageCompletedAt, 'stageCompletedAt');
        }
        const timing: StageTiming = {
          stageStartedAt: event.payload.stageStartedAt,
          stageInactiveMs: event.payload.stageInactiveMs,
          stageCompletedAt: event.payload.stageCompletedAt,
        };
        return applyStageSnapshot(state, event.payload.stageId, event.payload.tasks, timing);
      }

      case 'taskProgressUpdated':
        assertProgressRange(event.payload.value);
        return {
          ...state,
          execution: {
            ...state.execution,
            stages: {
              ...state.execution.stages,
              [event.payload.stageId]: {
                ...state.execution.stages[event.payload.stageId],
                progress: {
                  value: event.payload.value,
                  message: event.payload.message,
                  metadata: event.payload.metadata,
                },
              },
            },
          },
        };

      case 'taskStreamConnectionChanged':
        return {
          ...state,
          execution: {
            ...state.execution,
            taskStreamConnected: event.payload.connected,
          },
        };

      case 'viewSelectionChanged':
        return {
          ...state,
          view: {
            activeStageId: event.payload.activeStageId ?? state.view.activeStageId,
            selectedTaskId: event.payload.selectedTaskId ?? state.view.selectedTaskId,
          },
        };

      default:
        return state;
    }
  };

  const buildSessionStateAtom = atom<BuildSessionState<StageId, SessionPhase, TaskSummary>>(initialState());

  const dispatchBuildSessionEventAtom = atom(
    null,
    (
      get,
      set,
      event: BuildSessionStateEvent<StageId, SessionPhase, TaskSummary>,
    ) => {
      const current = get(buildSessionStateAtom);
      const next = reduceBuildSessionState(current, event);
      if (next !== current) {
        set(buildSessionStateAtom, next);
      }
    },
  );

  const buildSessionStartButtonLoadingAtom = atom((get) => {
    const state = get(buildSessionStateAtom);
    if (!state.lifecycle.isActive) return false;
    return !state.execution.taskStreamConnected;
  });

  const buildSessionStageCountersAtom = atom((get) => {
    const state = get(buildSessionStateAtom);
    return config.stages.reduce<Record<StageId, StageCounters>>((acc, stageId) => {
      acc[stageId] = state.execution.stages[stageId].counters;
      return acc;
    }, {} as Record<StageId, StageCounters>);
  });

  const createInitialBuildSessionStateForTest = (): BuildSessionState<StageId, SessionPhase, TaskSummary> => (
    initialState()
  );

  return {
    buildSessionStateAtom,
    dispatchBuildSessionEventAtom,
    buildSessionStartButtonLoadingAtom,
    buildSessionStageCountersAtom,
    createInitialBuildSessionStateForTest,
  };
};
