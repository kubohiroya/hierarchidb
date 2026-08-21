import type { TaskDisplayPayload } from '@hierarchidb/build-api';
import { type Atom, atom } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { atomFamily } from 'jotai-family';

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
  snapshotReceived: boolean;
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
    hasAuthoritativeStatus: boolean;
    startedAt?: number;
    inactiveMs?: number;
    completedAt?: number;
    lastHeartbeatAt?: number;
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

type BuildSessionStageStateSlice<StageId extends string> = {
  orderedIds: string[];
  byId: Record<string, BuildSessionTaskItem<StageId>>;
  timing: BuildSessionStageTimingState;
  ui: BuildSessionStageUiState;
};

type BuildSessionStateTreeEvent<StageId extends string> =
  | {
      type: 'reset';
    }
  | {
      type: 'sessionPatched';
      payload: Partial<BuildSessionStateTree<StageId>['session']>;
    }
  | {
      type: 'tasksReplaced';
      payload: {
        stageId: StageId;
        tasks: BuildSessionTaskItem<StageId>[];
      };
    }
  | {
      type: 'taskProgressUpdated';
      payload: {
        taskId: string;
        version: number;
        stageId: StageId;
        value: number;
        message?: string;
        metadata?: Record<string, unknown>;
      };
    }
  | {
      type: 'timingPatched';
      payload: {
        stageId: StageId;
        patch: Partial<BuildSessionStageTimingState>;
      };
    }
  | {
      type: 'heartbeatReceived';
      payload: {
        heartbeatAt: number;
      };
    }
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
    throw new Error(
      `[buildSessionStateTree] ${label} must be a finite number, received ${String(value)}`
    );
  }
  return value;
};

const assertProgressRange = (value: number): number => {
  const normalized = assertFiniteNumber(value, 'task.progress');
  if (normalized < 0 || normalized > 100) {
    throw new Error(
      `[buildSessionStateTree] task.progress must be within 0..100, received ${normalized}`
    );
  }
  return normalized;
};

const compareTaskOrder = <StageId extends string>(
  left: BuildSessionTaskItem<StageId>,
  right: BuildSessionTaskItem<StageId>
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
  snapshotReceived: false,
  startedAtUtime: undefined,
  pausedTotalMs: undefined,
  completedAtUtime: undefined,
});

const sanitizeTask = <StageId extends string>(
  task: BuildSessionTaskItem<StageId>
): BuildSessionTaskItem<StageId> => {
  if (task.taskId.length === 0) {
    throw new Error('[buildSessionStateTree] task.taskId must not be empty');
  }
  const version = assertFiniteNumber(task.version, 'task.version');
  if (!Number.isInteger(version) || version <= 0) {
    throw new Error(
      `[buildSessionStateTree] task.version must be a positive integer, received ${version}`
    );
  }
  const index = assertFiniteNumber(task.index, 'task.index');
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(
      `[buildSessionStateTree] task.index must be a non-negative integer, received ${index}`
    );
  }
  return {
    ...task,
    version,
    progress: assertProgressRange(task.progress),
    index,
  };
};

const sanitizeTimingPatch = (
  patch: Partial<BuildSessionStageTimingState>
): Partial<BuildSessionStageTimingState> => {
  const next: Partial<BuildSessionStageTimingState> = {};
  if (patch.snapshotReceived !== undefined) {
    if (typeof patch.snapshotReceived !== 'boolean') {
      throw new Error(
        `[buildSessionStateTree] timing.snapshotReceived must be boolean, received ${String(patch.snapshotReceived)}`
      );
    }
    next.snapshotReceived = patch.snapshotReceived;
  }
  if (patch.startedAtUtime !== undefined) {
    const startedAtUtime = assertFiniteNumber(patch.startedAtUtime, 'timing.startedAtUtime');
    if (startedAtUtime < 0) {
      throw new Error(
        `[buildSessionStateTree] timing.startedAtUtime must be non-negative, received ${startedAtUtime}`
      );
    }
    next.startedAtUtime = startedAtUtime;
  }
  if (patch.pausedTotalMs !== undefined) {
    const paused = assertFiniteNumber(patch.pausedTotalMs, 'timing.pausedTotalMs');
    if (paused < 0) {
      throw new Error(
        `[buildSessionStateTree] timing.pausedTotalMs must be >= 0, received ${paused}`
      );
    }
    next.pausedTotalMs = paused;
  }
  if (patch.completedAtUtime !== undefined) {
    const completedAtUtime = assertFiniteNumber(patch.completedAtUtime, 'timing.completedAtUtime');
    if (completedAtUtime < 0) {
      throw new Error(
        `[buildSessionStateTree] timing.completedAtUtime must be non-negative, received ${completedAtUtime}`
      );
    }
    next.completedAtUtime = completedAtUtime;
  }
  return next;
};

export const createBuildSessionStateTreeAtoms = <StageId extends string>(
  config: Config<StageId>
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
        hasAuthoritativeStatus: config.initialSession?.hasAuthoritativeStatus ?? false,
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
    };
  };

  const insertTaskIdInOrder = (
    ids: string[],
    byId: Record<string, BuildSessionTaskItem<StageId>>,
    taskId: string
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
    event: BuildSessionStateTreeEvent<StageId>
  ): BuildSessionStateTree<StageId> => {
    if (event.type === 'reset') {
      return createInitialState();
    }

    switch (event.type) {
      case 'sessionPatched':
        return {
          ...state,
          session: {
            ...state.session,
            ...event.payload,
          },
        };
      case 'tasksReplaced': {
        const stageId = event.payload.stageId;
        const nextById = { ...state.tasks.byId };
        for (const existingTaskId of state.tasks.orderedIdsByStage[stageId]) {
          delete nextById[existingTaskId];
        }
        const nextOrderedByStage = {
          ...state.tasks.orderedIdsByStage,
        };
        nextOrderedByStage[stageId] = [];
        for (const rawTask of event.payload.tasks) {
          const snapshotTask = sanitizeTask(rawTask);
          if (snapshotTask.stage !== stageId) {
            throw new Error(
              `[buildSessionStateTree] tasksReplaced stage mismatch: task.stage=${String(snapshotTask.stage)} target=${String(stageId)}`
            );
          }
          const existingTask = state.tasks.byId[snapshotTask.taskId];
          const task =
            existingTask?.stage === stageId && existingTask.version > snapshotTask.version
              ? {
                  ...snapshotTask,
                  version: existingTask.version,
                  progress: existingTask.progress,
                  message: existingTask.message,
                  metadata: existingTask.metadata,
                }
              : snapshotTask;
          nextById[task.taskId] = task;
          nextOrderedByStage[stageId] = insertTaskIdInOrder(
            nextOrderedByStage[stageId],
            nextById,
            task.taskId
          );
        }
        return {
          ...state,
          tasks: {
            byId: nextById,
            orderedIdsByStage: nextOrderedByStage,
          },
        };
      }
      case 'taskProgressUpdated': {
        const existing = state.tasks.byId[event.payload.taskId];
        if (!existing) {
          throw new Error(
            `[buildSessionStateTree] progress received before task snapshot: ${event.payload.taskId}`
          );
        }
        if (existing.stage !== event.payload.stageId) {
          throw new Error(
            `[buildSessionStateTree] task progress stage mismatch: task.stage=${String(existing.stage)} event.stageId=${String(event.payload.stageId)}`
          );
        }
        const version = assertFiniteNumber(event.payload.version, 'taskProgress.version');
        if (!Number.isInteger(version) || version <= 0) {
          throw new Error(
            `[buildSessionStateTree] taskProgress.version must be a positive integer, received ${version}`
          );
        }
        if (version <= existing.version) return state;
        const value = assertProgressRange(event.payload.value);
        const task: BuildSessionTaskItem<StageId> = {
          ...existing,
          version,
          progress: value,
          message: event.payload.message,
          metadata: event.payload.metadata ?? existing.metadata,
        };
        return {
          ...state,
          tasks: {
            ...state.tasks,
            byId: {
              ...state.tasks.byId,
              [task.taskId]: task,
            },
          },
        };
      }
      case 'timingPatched': {
        const stageId = event.payload.stageId;
        const patch = sanitizeTimingPatch(event.payload.patch);
        const timing = {
          ...state.timing.byStage[stageId],
          ...patch,
        };
        if (timing.snapshotReceived) {
          if (timing.startedAtUtime === undefined || timing.pausedTotalMs === undefined) {
            throw new Error(
              `[buildSessionStateTree] started stage ${String(stageId)} requires startedAtUtime and pausedTotalMs`
            );
          }
          if (timing.completedAtUtime !== undefined) {
            const durationMs =
              timing.completedAtUtime - timing.startedAtUtime - timing.pausedTotalMs;
            if (!Number.isFinite(durationMs) || durationMs < 0) {
              throw new Error(
                `[buildSessionStateTree] stage duration must be finite and non-negative, received ${durationMs}`
              );
            }
          }
        }
        return {
          ...state,
          timing: {
            byStage: {
              ...state.timing.byStage,
              [stageId]: timing,
            },
          },
        };
      }
      case 'heartbeatReceived': {
        const heartbeatAt = assertFiniteNumber(event.payload.heartbeatAt, 'heartbeatAt');
        if (heartbeatAt < 0) {
          throw new Error(
            `[buildSessionStateTree] heartbeatAt must be non-negative, received ${heartbeatAt}`
          );
        }
        return {
          ...state,
          session: {
            ...state.session,
            lastHeartbeatAt: heartbeatAt,
          },
        };
      }
      case 'activeStageChanged':
        return {
          ...state,
          ui: {
            ...state.ui,
            activeStageId: event.payload.stageId,
          },
        };
      case 'stageUiPatched': {
        const stageId = event.payload.stageId;
        return {
          ...state,
          ui: {
            ...state.ui,
            byStage: {
              ...state.ui.byStage,
              [stageId]: {
                ...state.ui.byStage[stageId],
                ...event.payload.patch,
              },
            },
          },
        };
      }
      default:
        return state;
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
    }
  );

  const stageStateAtomFamily = atomFamily(
    (stageId: StageId) =>
      selectAtom(buildSessionStateTreeAtom, (state) => ({
        orderedIds: state.tasks.orderedIdsByStage[stageId],
        byId: state.tasks.byId,
        timing: state.timing.byStage[stageId],
        ui: state.ui.byStage[stageId],
      })) as Atom<BuildSessionStageStateSlice<StageId>>
  );

  const stageTasksAtomFamily = atomFamily(
    (stageId: StageId) =>
      atom((get) => {
        const { orderedIds, byId } = get(stageStateAtomFamily(stageId));
        const tasks: BuildSessionTaskItem<StageId>[] = [];
        for (const taskId of orderedIds) {
          const task = byId[taskId];
          if (task) tasks.push(task);
        }
        return tasks;
      }) as Atom<BuildSessionTaskItem<StageId>[]>
  );

  const stageCountsAtomFamily = atomFamily(
    (stageId: StageId) =>
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
      }) as Atom<BuildSessionStageCounts>
  );

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

  const stageElapsedMsAtomFamily = atomFamily(
    (stageId: StageId) =>
      atom((get): number => {
        const { timing } = get(stageStateAtomFamily(stageId));
        if (!timing.snapshotReceived) return 0;
        if (timing.startedAtUtime === undefined || timing.pausedTotalMs === undefined) {
          throw new Error(
            `[buildSessionStateTree] started stage ${String(stageId)} has incomplete timing`
          );
        }
        const session = get(buildSessionStateTreeAtom).session;
        if (!session.hasAuthoritativeStatus) return 0;
        const endTime =
          timing.completedAtUtime ??
          (session.isActive ? get(nowUtimeAtom) : (session.lastHeartbeatAt ?? session.completedAt));
        if (endTime === undefined) {
          throw new Error(
            `[buildSessionStateTree] inactive stage ${String(stageId)} requires a persisted end timestamp`
          );
        }
        const durationMs = endTime - timing.startedAtUtime - timing.pausedTotalMs;
        if (!Number.isFinite(durationMs) || durationMs < 0) {
          throw new Error(
            `[buildSessionStateTree] stage duration must be finite and non-negative, received ${durationMs}`
          );
        }
        return durationMs;
      }) as Atom<number>
  );

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
