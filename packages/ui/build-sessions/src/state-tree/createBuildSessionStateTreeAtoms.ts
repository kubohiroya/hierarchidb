import { atom } from 'jotai';
import { atomFamily, selectAtom } from 'jotai/utils';
import type { TaskDisplayPayload } from '@hierarchidb/build-api';

export type BuildSessionTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'recycled'
  | 'skipped';

export type BuildSessionStateTreeLifecyclePhase =
  | 'idle'
  | 'starting'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'finalizing'
  | 'completed'
  | 'failed';

export type BuildSessionTaskItem<StageId extends string> = {
  taskId: string;
  version: number;
  stage: StageId;
  status: BuildSessionTaskStatus;
  progress: number;
  index: number;
  message?: string;
  display?: TaskDisplayPayload;
  metadata?: Record<string, unknown>;
};

export type BuildSessionStageUiState = {
  selectedTaskId?: string;
  expandedTaskIds: string[];
  floatingWindow?: {
    x: number;
    y: number;
    width: number;
    height: number;
    mode: 'normal' | 'maximize' | 'full';
  };
};

export type BuildSessionStageTimingState = {
  startedAtUtime?: number;
  pausedTotalMs?: number;
  completedAtUtime?: number;
};

export type BuildSessionStateTree<StageId extends string> = {
  nodeId: string;
  stageIds: StageId[];
  session: {
    phase: BuildSessionStateTreeLifecyclePhase;
    isActive: boolean;
    error?: string;
  };
  tasks: {
    byId: Record<string, BuildSessionTaskItem<StageId>>;
    orderedIdsByStage: Record<StageId, string[]>;
  };
  timing: {
    byStage: Record<StageId, BuildSessionStageTimingState>;
  };
  ui: {
    activeStageId: StageId;
    byStage: Record<StageId, BuildSessionStageUiState>;
  };
  meta: {
    lastAcceptedEventVersion: number;
  };
};

export type BuildSessionStageCounts = {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  recycled: number;
  skipped: number;
};

type EventWithVersion = { eventVersion: number };

type BuildSessionStateTreeEvent<StageId extends string> =
  | {
    type: 'reset';
  }
  | ({
    type: 'sessionPatched';
    payload: Partial<BuildSessionStateTree<StageId>['session']>;
  } & EventWithVersion)
  | ({
    type: 'tasksReplaced';
    payload: {
      stageId: StageId;
      tasks: BuildSessionTaskItem<StageId>[];
    };
  } & EventWithVersion)
  | ({
    type: 'taskUpserted';
    payload: {
      task: BuildSessionTaskItem<StageId>;
    };
  } & EventWithVersion)
  | ({
    type: 'taskDeleted';
    payload: {
      stageId: StageId;
      taskId: string;
    };
  } & EventWithVersion)
  | ({
    type: 'timingPatched';
    payload: {
      stageId: StageId;
      patch: Partial<BuildSessionStageTimingState>;
    };
  } & EventWithVersion)
  | {
    type: 'activeStageChanged';
    payload: {
      stageId: StageId;
    };
  }
  | {
    type: 'stageUiPatched';
    payload: {
      stageId: StageId;
      patch: Partial<BuildSessionStageUiState>;
    };
  };

type Config<StageId extends string> = {
  nodeId: string;
  stageIds: readonly StageId[];
  defaultActiveStageId: StageId;
  initialSession?: Partial<BuildSessionStateTree<StageId>['session']>;
};

const assertFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[buildSessionStateTree] ${label} must be a finite number, received ${String(value)}`);
  }
  return value;
};

const assertProgressRange = (value: number): number => {
  const normalized = assertFiniteNumber(value, 'task.progress');
  if (normalized < 0 || normalized > 100) {
    throw new Error(`[buildSessionStateTree] task.progress must be within 0..100, received ${normalized}`);
  }
  return normalized;
};

const compareTaskOrder = <StageId extends string>(
  left: BuildSessionTaskItem<StageId>,
  right: BuildSessionTaskItem<StageId>,
): number => {
  if (left.index !== right.index) {
    return left.index - right.index;
  }
  return left.taskId.localeCompare(right.taskId);
};

const stageUiInitialState = (): BuildSessionStageUiState => ({
  selectedTaskId: undefined,
  expandedTaskIds: [],
  floatingWindow: undefined,
});

const stageTimingInitialState = (): BuildSessionStageTimingState => ({
  startedAtUtime: undefined,
  pausedTotalMs: undefined,
  completedAtUtime: undefined,
});

const hasVersion = <StageId extends string>(
  event: BuildSessionStateTreeEvent<StageId>,
): event is Extract<BuildSessionStateTreeEvent<StageId>, EventWithVersion> => (
  'eventVersion' in event
);

const sanitizeTask = <StageId extends string>(
  task: BuildSessionTaskItem<StageId>,
): BuildSessionTaskItem<StageId> => ({
  ...task,
  version: assertFiniteNumber(task.version, 'task.version'),
  progress: assertProgressRange(task.progress),
  index: assertFiniteNumber(task.index, 'task.index'),
});

const sanitizeTimingPatch = (patch: Partial<BuildSessionStageTimingState>): Partial<BuildSessionStageTimingState> => {
  const next: Partial<BuildSessionStageTimingState> = {};
  if (patch.startedAtUtime !== undefined) {
    next.startedAtUtime = assertFiniteNumber(patch.startedAtUtime, 'timing.startedAtUtime');
  }
  if (patch.pausedTotalMs !== undefined) {
    const paused = assertFiniteNumber(patch.pausedTotalMs, 'timing.pausedTotalMs');
    if (paused < 0) {
      throw new Error(`[buildSessionStateTree] timing.pausedTotalMs must be >= 0, received ${paused}`);
    }
    next.pausedTotalMs = paused;
  }
  if (patch.completedAtUtime !== undefined) {
    next.completedAtUtime = assertFiniteNumber(patch.completedAtUtime, 'timing.completedAtUtime');
  }
  return next;
};

export const createBuildSessionStateTreeAtoms = <StageId extends string>(
  config: Config<StageId>,
) => {
  const stageIds = [...config.stageIds];
  if (stageIds.length === 0) {
    throw new Error('[buildSessionStateTree] stageIds must contain at least one stage');
  }

  const createInitialState = (): BuildSessionStateTree<StageId> => {
    const orderedIdsByStage = {} as Record<StageId, string[]>;
    const timingByStage = {} as Record<StageId, BuildSessionStageTimingState>;
    const uiByStage = {} as Record<StageId, BuildSessionStageUiState>;
    for (const stageId of stageIds) {
      orderedIdsByStage[stageId] = [];
      timingByStage[stageId] = stageTimingInitialState();
      uiByStage[stageId] = stageUiInitialState();
    }
    return {
      nodeId: config.nodeId,
      stageIds,
      session: {
        phase: config.initialSession?.phase ?? 'idle',
        isActive: config.initialSession?.isActive ?? false,
        error: config.initialSession?.error,
      },
      tasks: {
        byId: {},
        orderedIdsByStage,
      },
      timing: {
        byStage: timingByStage,
      },
      ui: {
        activeStageId: config.defaultActiveStageId,
        byStage: uiByStage,
      },
      meta: {
        lastAcceptedEventVersion: 0,
      },
    };
  };

  const applyVersionGate = (
    state: BuildSessionStateTree<StageId>,
    event: BuildSessionStateTreeEvent<StageId>,
  ): BuildSessionStateTree<StageId> | null => {
    if (!hasVersion(event)) return state;
    if (event.eventVersion <= state.meta.lastAcceptedEventVersion) return null;
    return {
      ...state,
      meta: {
        lastAcceptedEventVersion: event.eventVersion,
      },
    };
  };

  const insertTaskIdInOrder = (
    ids: string[],
    byId: Record<string, BuildSessionTaskItem<StageId>>,
    taskId: string,
  ): string[] => {
    const next = ids.filter((id) => id !== taskId);
    const task = byId[taskId];
    if (!task) return next;
    let low = 0;
    let high = next.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const midId = next[mid];
      const midTask = midId ? byId[midId] : undefined;
      if (!midTask) break;
      if (compareTaskOrder(midTask, task) <= 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    next.splice(low, 0, taskId);
    return next;
  };

  const reduce = (
    state: BuildSessionStateTree<StageId>,
    event: BuildSessionStateTreeEvent<StageId>,
  ): BuildSessionStateTree<StageId> => {
    if (event.type === 'reset') {
      return createInitialState();
    }

    const accepted = applyVersionGate(state, event);
    if (!accepted) return state;

    switch (event.type) {
      case 'sessionPatched':
        return {
          ...accepted,
          session: {
            ...accepted.session,
            ...event.payload,
          },
        };
      case 'tasksReplaced': {
        const stageId = event.payload.stageId;
        const nextById = { ...accepted.tasks.byId };
        for (const existingTaskId of accepted.tasks.orderedIdsByStage[stageId]) {
          delete nextById[existingTaskId];
        }
        const nextOrderedByStage = {
          ...accepted.tasks.orderedIdsByStage,
        };
        nextOrderedByStage[stageId] = [];
        for (const rawTask of event.payload.tasks) {
          const task = sanitizeTask(rawTask);
          if (task.stage !== stageId) {
            throw new Error(
              `[buildSessionStateTree] tasksReplaced stage mismatch: task.stage=${String(task.stage)} target=${String(stageId)}`,
            );
          }
          nextById[task.taskId] = task;
          nextOrderedByStage[stageId] = insertTaskIdInOrder(nextOrderedByStage[stageId], nextById, task.taskId);
        }
        return {
          ...accepted,
          tasks: {
            byId: nextById,
            orderedIdsByStage: nextOrderedByStage,
          },
        };
      }
      case 'taskUpserted': {
        const task = sanitizeTask(event.payload.task);
        const stageId = task.stage;
        const nextById = {
          ...accepted.tasks.byId,
          [task.taskId]: task,
        };
        const nextOrderedByStage = {
          ...accepted.tasks.orderedIdsByStage,
          [stageId]: insertTaskIdInOrder(accepted.tasks.orderedIdsByStage[stageId], nextById, task.taskId),
        };
        return {
          ...accepted,
          tasks: {
            byId: nextById,
            orderedIdsByStage: nextOrderedByStage,
          },
        };
      }
      case 'taskDeleted': {
        const stageId = event.payload.stageId;
        const nextById = { ...accepted.tasks.byId };
        delete nextById[event.payload.taskId];
        return {
          ...accepted,
          tasks: {
            byId: nextById,
            orderedIdsByStage: {
              ...accepted.tasks.orderedIdsByStage,
              [stageId]: accepted.tasks.orderedIdsByStage[stageId].filter((taskId) => taskId !== event.payload.taskId),
            },
          },
        };
      }
      case 'timingPatched': {
        const stageId = event.payload.stageId;
        const patch = sanitizeTimingPatch(event.payload.patch);
        return {
          ...accepted,
          timing: {
            byStage: {
              ...accepted.timing.byStage,
              [stageId]: {
                ...accepted.timing.byStage[stageId],
                ...patch,
              },
            },
          },
        };
      }
      case 'activeStageChanged':
        return {
          ...accepted,
          ui: {
            ...accepted.ui,
            activeStageId: event.payload.stageId,
          },
        };
      case 'stageUiPatched': {
        const stageId = event.payload.stageId;
        return {
          ...accepted,
          ui: {
            ...accepted.ui,
            byStage: {
              ...accepted.ui.byStage,
              [stageId]: {
                ...accepted.ui.byStage[stageId],
                ...event.payload.patch,
              },
            },
          },
        };
      }
      default:
        return accepted;
    }
  };

  const buildSessionStateTreeAtom = atom<BuildSessionStateTree<StageId>>(createInitialState());
  const nowUtimeAtom = atom<number>(Date.now());

  const dispatchBuildSessionStateTreeEventAtom = atom(
    null,
    (get, set, event: BuildSessionStateTreeEvent<StageId>) => {
      const current = get(buildSessionStateTreeAtom);
      const next = reduce(current, event);
      if (next !== current) {
        set(buildSessionStateTreeAtom, next);
      }
    },
  );

  const stageStateAtomFamily = atomFamily((stageId: StageId) => (
    selectAtom(buildSessionStateTreeAtom, (state) => ({
      orderedIds: state.tasks.orderedIdsByStage[stageId],
      byId: state.tasks.byId,
      timing: state.timing.byStage[stageId],
      ui: state.ui.byStage[stageId],
    }))
  ));

  const stageTasksAtomFamily = atomFamily((stageId: StageId) => (
    atom((get) => {
      const { orderedIds, byId } = get(stageStateAtomFamily(stageId));
      const tasks: BuildSessionTaskItem<StageId>[] = [];
      for (const taskId of orderedIds) {
        const task = byId[taskId];
        if (task) tasks.push(task);
      }
      return tasks;
    })
  ));

  const stageCountsAtomFamily = atomFamily((stageId: StageId) => (
    atom((get): BuildSessionStageCounts => {
      const tasks = get(stageTasksAtomFamily(stageId));
      const counts: BuildSessionStageCounts = {
        total: tasks.length,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        recycled: 0,
        skipped: 0,
      };
      for (const task of tasks) {
        counts[task.status] += 1;
      }
      return counts;
    })
  ));

  const overallCountsAtom = atom((get): BuildSessionStageCounts => {
    const counts: BuildSessionStageCounts = {
      total: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      recycled: 0,
      skipped: 0,
    };
    for (const stageId of stageIds) {
      const stageCounts = get(stageCountsAtomFamily(stageId));
      counts.total += stageCounts.total;
      counts.queued += stageCounts.queued;
      counts.running += stageCounts.running;
      counts.completed += stageCounts.completed;
      counts.failed += stageCounts.failed;
      counts.recycled += stageCounts.recycled;
      counts.skipped += stageCounts.skipped;
    }
    return counts;
  });

  const stageElapsedMsAtomFamily = atomFamily((stageId: StageId) => (
    atom((get): number => {
      const { timing } = get(stageStateAtomFamily(stageId));
      if (typeof timing.startedAtUtime !== 'number') return 0;
      const pausedTotalMs = timing.pausedTotalMs ?? 0;
      const endTime = timing.completedAtUtime ?? get(nowUtimeAtom);
      return Math.max(0, endTime - timing.startedAtUtime - pausedTotalMs);
    })
  ));

  const totalElapsedMsAtom = atom((get): number => {
    let total = 0;
    for (const stageId of stageIds) {
      total += get(stageElapsedMsAtomFamily(stageId));
    }
    return total;
  });

  const activeStageIdAtom = atom((get) => get(buildSessionStateTreeAtom).ui.activeStageId);
  const activeStageUiAtom = atom((get) => {
    const state = get(buildSessionStateTreeAtom);
    return state.ui.byStage[state.ui.activeStageId];
  });
  const activeStageTasksAtom = atom((get) => get(stageTasksAtomFamily(get(activeStageIdAtom))));
  const activeStageCountsAtom = atom((get) => get(stageCountsAtomFamily(get(activeStageIdAtom))));

  return {
    buildSessionStateTreeAtom,
    dispatchBuildSessionStateTreeEventAtom,
    nowUtimeAtom,
    stageTasksAtomFamily,
    stageCountsAtomFamily,
    overallCountsAtom,
    stageElapsedMsAtomFamily,
    totalElapsedMsAtom,
    activeStageIdAtom,
    activeStageUiAtom,
    activeStageTasksAtom,
    activeStageCountsAtom,
    createInitialBuildSessionStateTreeForTest: createInitialState,
  };
};

export type { BuildSessionStateTreeEvent };
