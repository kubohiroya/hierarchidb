import { atom } from 'jotai';

export type BuildSessionLifecyclePhase =
  | 'idle'
  | 'starting'
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

type StageProgressState<SessionPhase extends string> = {
  value: number;
  phase: SessionPhase;
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

type StageExecutionState<StageId extends string, SessionPhase extends string, TaskSummary extends BaseTaskSummary> = {
  stageId: StageId;
  tasksById: Record<string, TaskSummary>;
  taskOrder: string[];
  counters: StageCounters;
  progress: StageProgressState<SessionPhase>;
};

type BuildSessionLifecycleState<SessionPhase extends string> = {
  nodeId: string | null;
  sessionId: string | null;
  phase: SessionPhase;
  isActive: boolean;
  startedAt?: number;
  heartbeatAt?: number;
  completedAt?: number;
};

type BuildSessionExecutionState<StageId extends string, SessionPhase extends string, TaskSummary extends BaseTaskSummary> = {
  taskStreamConnected: boolean;
  stages: Record<StageId, StageExecutionState<StageId, SessionPhase, TaskSummary>>;
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
  meta: {
    lastAcceptedEventVersion: number;
  };
  lifecycle: BuildSessionLifecycleState<SessionPhase>;
  execution: BuildSessionExecutionState<StageId, SessionPhase, TaskSummary>;
  view: BuildSessionViewState<StageId>;
};

type RuntimeSnapshotEvent<SessionPhase extends string> = {
  type: 'runtimeSnapshotReceived';
  eventVersion: number;
  payload: {
    nodeId: string;
    sessionId?: string;
    phase: SessionPhase;
    isActive: boolean;
    startedAt?: number;
    heartbeatAt?: number;
    completedAt?: number;
  };
};

type SessionRecordEvent<StageId extends string, SessionPhase extends string> = {
  type: 'sessionRecordReceived';
  eventVersion: number;
  payload: {
    nodeId: string;
    phase: SessionPhase;
    completedAt?: number;
    heartbeatAt?: number;
    startedAt?: number;
    stageId?: StageId;
    stopReason?: string;
    inactiveMs?: number;
    stageStartedAt?: number;
    stageInactiveMs?: number;
  };
};

type TaskSnapshotEvent<StageId extends string, TaskSummary extends BaseTaskSummary> = {
  type: 'taskSnapshotReceived';
  eventVersion: number;
  payload: {
    stageId: StageId;
    tasks: TaskSummary[];
  };
};

type TaskUpdatedEvent<StageId extends string, TaskSummary extends BaseTaskSummary> = {
  type: 'taskUpdated';
  eventVersion: number;
  payload: {
    stageId: StageId;
    task: TaskSummary;
  };
};

type TaskDeletedEvent<StageId extends string> = {
  type: 'taskDeleted';
  eventVersion: number;
  payload: {
    stageId: StageId;
    taskId: string;
  };
};

type ProgressEvent<StageId extends string, SessionPhase extends string> = {
  type: 'progressReceived';
  eventVersion: number;
  payload: {
    stageId: StageId;
    value: number;
    phase: SessionPhase;
    message?: string;
    metadata?: Record<string, unknown>;
  };
};

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
  | RuntimeSnapshotEvent<SessionPhase>
  | SessionRecordEvent<StageId, SessionPhase>
  | TaskSnapshotEvent<StageId, TaskSummary>
  | TaskUpdatedEvent<StageId, TaskSummary>
  | TaskDeletedEvent<StageId>
  | ProgressEvent<StageId, SessionPhase>
  | TaskStreamConnectionEvent
  | ViewSelectionChangedEvent<StageId>
  | ResetEvent;

type VersionedEvent<
  StageId extends string,
  SessionPhase extends string,
  TaskSummary extends BaseTaskSummary,
> = Extract<BuildSessionStateEvent<StageId, SessionPhase, TaskSummary>, { eventVersion: number }>;

type Config<
  StageId extends string,
  SessionPhase extends string,
  TaskSummary extends BaseTaskSummary,
> = {
  stages: readonly StageId[];
  defaultStageId: StageId;
  idlePhase: SessionPhase;
  activePhases: readonly SessionPhase[];
  resolveTaskStageId: (task: TaskSummary) => StageId;
  isTerminalTaskStatus: (status: TaskSummary['status']) => boolean;
  isRunningTaskStatus: (status: TaskSummary['status']) => boolean;
  isQueuedTaskStatus: (status: TaskSummary['status']) => boolean;
  isLifecycleActiveFromSessionRecordPhase: (phase: SessionPhase) => boolean;
};

const assertProgressRange = (value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`[buildSessionStateAtoms] progress must be within 0..100, received ${value}`);
  }
};

export const createBuildSessionStateAtoms = <
  StageId extends string,
  SessionPhase extends string = BuildSessionLifecyclePhase,
  TaskSummary extends BaseTaskSummary = BaseTaskSummary,
>(config: Config<StageId, SessionPhase, TaskSummary>) => {
  const createEmptyStage = (stageId: StageId): StageExecutionState<StageId, SessionPhase, TaskSummary> => ({
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
      phase: config.idlePhase,
    },
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
    const stages = config.stages.reduce<Record<StageId, StageExecutionState<StageId, SessionPhase, TaskSummary>>>((acc, stageId) => {
      acc[stageId] = createEmptyStage(stageId);
      return acc;
    }, {} as Record<StageId, StageExecutionState<StageId, SessionPhase, TaskSummary>>);

    return {
      meta: {
        lastAcceptedEventVersion: 0,
      },
      lifecycle: {
        nodeId: null,
        sessionId: null,
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
    const nextStage: StageExecutionState<StageId, SessionPhase, TaskSummary> = {
      ...currentStage,
      tasksById: nextTasksById,
      taskOrder: nextOrder,
      counters: buildCounters(nextTasksById, nextOrder),
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

  const applyTaskUpsert = (
    state: BuildSessionState<StageId, SessionPhase, TaskSummary>,
    stageId: StageId,
    task: TaskSummary,
  ): BuildSessionState<StageId, SessionPhase, TaskSummary> => {
    if (config.resolveTaskStageId(task) !== stageId) {
      throw new Error(
        `[buildSessionStateAtoms] task.stage (${String(task.stage)}) does not match target stage (${String(stageId)})`,
      );
    }
    assertProgressRange(task.progress);
    const currentStage = state.execution.stages[stageId];
    const hadTask = currentStage.tasksById[task.taskId] !== undefined;
    const nextTasksById: Record<string, TaskSummary> = {
      ...currentStage.tasksById,
      [task.taskId]: task,
    };
    const nextOrder = hadTask ? currentStage.taskOrder : [...currentStage.taskOrder, task.taskId];
    const nextStage: StageExecutionState<StageId, SessionPhase, TaskSummary> = {
      ...currentStage,
      tasksById: nextTasksById,
      taskOrder: nextOrder,
      counters: buildCounters(nextTasksById, nextOrder),
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

  const applyTaskDelete = (
    state: BuildSessionState<StageId, SessionPhase, TaskSummary>,
    stageId: StageId,
    taskId: string,
  ): BuildSessionState<StageId, SessionPhase, TaskSummary> => {
    const currentStage = state.execution.stages[stageId];
    if (!currentStage.tasksById[taskId]) return state;
    const nextTasksById = { ...currentStage.tasksById };
    delete nextTasksById[taskId];
    const nextOrder = currentStage.taskOrder.filter((id) => id !== taskId);
    const nextStage: StageExecutionState<StageId, SessionPhase, TaskSummary> = {
      ...currentStage,
      tasksById: nextTasksById,
      taskOrder: nextOrder,
      counters: buildCounters(nextTasksById, nextOrder),
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

  const acceptEvent = (
    state: BuildSessionState<StageId, SessionPhase, TaskSummary>,
    eventVersion: number,
  ): BuildSessionState<StageId, SessionPhase, TaskSummary> | null => {
    if (eventVersion <= state.meta.lastAcceptedEventVersion) {
      return null;
    }
    return {
      ...state,
      meta: {
        ...state.meta,
        lastAcceptedEventVersion: eventVersion,
      },
    };
  };

  const hasEventVersion = (
    event: BuildSessionStateEvent<StageId, SessionPhase, TaskSummary>,
  ): event is VersionedEvent<StageId, SessionPhase, TaskSummary> => (
    'eventVersion' in event
  );

  const reduceBuildSessionState = (
    state: BuildSessionState<StageId, SessionPhase, TaskSummary>,
    event: BuildSessionStateEvent<StageId, SessionPhase, TaskSummary>,
  ): BuildSessionState<StageId, SessionPhase, TaskSummary> => {
    const accepted = hasEventVersion(event)
      ? acceptEvent(state, event.eventVersion)
      : state;
    if (!accepted) return state;
    switch (event.type) {
      case 'reset':
        return initialState();
      case 'runtimeSnapshotReceived':
        return {
          ...accepted,
          lifecycle: {
            ...accepted.lifecycle,
            nodeId: event.payload.nodeId,
            sessionId: event.payload.sessionId ?? accepted.lifecycle.sessionId,
            phase: event.payload.phase,
            isActive: event.payload.isActive,
            startedAt: event.payload.startedAt ?? accepted.lifecycle.startedAt,
            heartbeatAt: event.payload.heartbeatAt ?? accepted.lifecycle.heartbeatAt,
            completedAt: event.payload.completedAt ?? accepted.lifecycle.completedAt,
          },
        };
      case 'sessionRecordReceived':
        return {
          ...accepted,
          lifecycle: {
            ...accepted.lifecycle,
            nodeId: event.payload.nodeId,
            phase: event.payload.phase,
            isActive: config.isLifecycleActiveFromSessionRecordPhase(event.payload.phase),
            startedAt: event.payload.startedAt ?? accepted.lifecycle.startedAt,
            heartbeatAt: event.payload.heartbeatAt ?? accepted.lifecycle.heartbeatAt,
            completedAt: event.payload.completedAt ?? accepted.lifecycle.completedAt,
          },
        };
      case 'taskSnapshotReceived':
        return applyStageSnapshot(accepted, event.payload.stageId, event.payload.tasks);
      case 'taskUpdated':
        return applyTaskUpsert(accepted, event.payload.stageId, event.payload.task);
      case 'taskDeleted':
        return applyTaskDelete(accepted, event.payload.stageId, event.payload.taskId);
      case 'progressReceived':
        assertProgressRange(event.payload.value);
        return {
          ...accepted,
          execution: {
            ...accepted.execution,
            stages: {
              ...accepted.execution.stages,
              [event.payload.stageId]: {
                ...accepted.execution.stages[event.payload.stageId],
                progress: {
                  value: event.payload.value,
                  phase: event.payload.phase,
                  message: event.payload.message,
                  metadata: event.payload.metadata,
                },
              },
            },
          },
        };
      case 'taskStreamConnectionChanged':
        return {
          ...accepted,
          execution: {
            ...accepted.execution,
            taskStreamConnected: event.payload.connected,
          },
        };
      case 'viewSelectionChanged':
        return {
          ...accepted,
          view: {
            activeStageId: event.payload.activeStageId ?? accepted.view.activeStageId,
            selectedTaskId: event.payload.selectedTaskId ?? accepted.view.selectedTaskId,
          },
        };
      default:
        return accepted;
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
    const lifecycleActive = config.activePhases.includes(state.lifecycle.phase);
    if (!lifecycleActive) return false;
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
