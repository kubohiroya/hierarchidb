import { useCallback, useEffect, useRef } from 'react';
import type { TaskDisplayPayload, TaskStage } from '@hierarchidb/batch-api';
import type { BuildTaskSummary } from '@hierarchidb/batch-api';
import {
  buildTaskSequenceMap,
  compareTaskOrderByIndexThenId,
  readTaskSequence,
  removeTaskById,
  shouldApplyTaskUpdate,
  upsertTaskInOrder,
} from '@hierarchidb/ui-batch-progress';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';
import { isTaskPhaseDisplay } from '../../../common/utils/taskMessages.ts';

export type RawTaskSummary = BuildTaskSummary & {
  taskType?: string;
  type?: string;
  stage?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  errorMessage?: string;
  index?: number;
  stagePriority?: number;
  sequence?: number;
  updatedAt?: number;
};

type SyncArgs = {
  sessionNodeId: string | null;
  setTasks: (tasks: ShapeBuildTaskSummary[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  markTaskStreamSynchronized?: () => void;
};

const isTaskStage = (value: unknown): value is TaskStage => (
  value === 'fetch' || value === 'transform' || value === 'vt'
);

const resolveTaskStage = (task: RawTaskSummary): TaskStage => {
  const candidates: Array<unknown> = [task.stage, task.taskType, task.type];
  for (const candidate of candidates) {
    if (isTaskStage(candidate)) {
      return candidate;
    }
  }
  throw new Error(`[ShapeBuildStep] Invalid task stage: ${String(task.stage ?? task.taskType ?? task.type ?? 'undefined')}`);
};

const resolveProgressValue = (value: number | undefined): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const UNKNOWN_SCOPE_VALUE = 'unknown';
const VT_PARENT_INPUT_SUMMARY_METADATA_KEY = 'vtParentInputSummary';

type VtParentInputSummary = {
  parentTile: {
    z: number;
    x: number;
    y: number;
  };
  intersectingFeatureCount: number;
  intersectingGeojsonByteSize: number;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const readVtParentInputSummary = (metadata: Record<string, unknown> | undefined): VtParentInputSummary | null => {
  const summaryRecord = asRecord(metadata?.[VT_PARENT_INPUT_SUMMARY_METADATA_KEY]);
  if (!summaryRecord) return null;
  const parentTileRecord = asRecord(summaryRecord.parentTile);
  if (!parentTileRecord) return null;
  const z = readNumber(parentTileRecord.z);
  const x = readNumber(parentTileRecord.x);
  const y = readNumber(parentTileRecord.y);
  const intersectingFeatureCount = readNumber(summaryRecord.intersectingFeatureCount);
  const intersectingGeojsonByteSize = readNumber(summaryRecord.intersectingGeojsonByteSize);
  if (z === null || x === null || y === null || intersectingFeatureCount === null || intersectingGeojsonByteSize === null) {
    return null;
  }
  return {
    parentTile: {
      z,
      x,
      y,
    },
    intersectingFeatureCount: Math.max(0, Math.round(intersectingFeatureCount)),
    intersectingGeojsonByteSize: Math.max(0, Math.round(intersectingGeojsonByteSize)),
  };
};

const buildVtParentInputSummaryMessage = (summary: VtParentInputSummary): string => (
  `vt parent input z=${summary.parentTile.z} x=${summary.parentTile.x} y=${summary.parentTile.y}`
  + ` intersects(features=${summary.intersectingFeatureCount}, geojsonBytes=${summary.intersectingGeojsonByteSize})`
);

const mergeTaskMessage = (base: string | undefined, addition: string): string => {
  const normalizedBase = typeof base === 'string' ? base.trim() : '';
  if (normalizedBase.length === 0) {
    return addition;
  }
  if (normalizedBase.includes(addition)) {
    return normalizedBase;
  }
  return `${normalizedBase} | ${addition}`;
};

const normalizeIsoCode = (value: string): string => value.trim().toUpperCase();

const parseScopeFromTaskId = (taskId: string): { iso2: string; adminLevel: string } | null => {
  const fetchMatch = taskId.match(/:fetch:([A-Za-z]{2,3}):(\d+)$/);
  if (fetchMatch?.[1] && fetchMatch[2]) {
    return {
      iso2: normalizeIsoCode(fetchMatch[1]),
      adminLevel: fetchMatch[2],
    };
  }
  const transformMatch = taskId.match(/:transform:[^:]+:([A-Za-z]{2,3}):(\d+)$/);
  if (transformMatch?.[1] && transformMatch[2]) {
    return {
      iso2: normalizeIsoCode(transformMatch[1]),
      adminLevel: transformMatch[2],
    };
  }
  return null;
};

const resolveTaskScope = (task: ShapeBuildTaskSummary): { iso2: string; adminLevel: string } => {
  const fromTaskId = parseScopeFromTaskId(task.taskId);
  if (fromTaskId) return fromTaskId;
  return {
    iso2: UNKNOWN_SCOPE_VALUE,
    adminLevel: UNKNOWN_SCOPE_VALUE,
  };
};

const isDev = import.meta.env.DEV;
type TaskSyncDebugChannel = 'taskUpdate100' | 'runningResidue';
type TaskSyncDebugConfig = Partial<Record<TaskSyncDebugChannel | 'all', boolean>>;

const readTaskSyncDebugConfig = (): TaskSyncDebugConfig | null => {
  const scope = globalThis as typeof globalThis & {
    __HDB_SHAPE_BUILD_TASK_SYNC_DEBUG__?: unknown;
  };
  const raw = scope.__HDB_SHAPE_BUILD_TASK_SYNC_DEBUG__;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw as TaskSyncDebugConfig;
};

const isTaskSyncDebugEnabled = (channel: TaskSyncDebugChannel): boolean => {
  if (!isDev) return false;
  const config = readTaskSyncDebugConfig();
  if (!config) return false;
  return config.all === true || config[channel] === true;
};

const TASK_UPDATE100_LOG_LIMIT = 300;
let taskUpdate100LogCount = 0;
let taskUpdate100LogLimitNotified = false;

const logTaskUpdate100 = (task: ShapeBuildTaskSummary): void => {
  if (!isTaskSyncDebugEnabled('taskUpdate100')) return;
  if (resolveProgressValue(task.progress) < 100) return;
  if (taskUpdate100LogCount >= TASK_UPDATE100_LOG_LIMIT) {
    if (!taskUpdate100LogLimitNotified) {
      taskUpdate100LogLimitNotified = true;
      console.log(`[TaskUpdate100] log limit reached (${TASK_UPDATE100_LOG_LIMIT}); suppressing further logs`);
    }
    return;
  }
  taskUpdate100LogCount += 1;
  const scope = resolveTaskScope(task);
  const message = task.message ?? '';
  const status = task.status;
  console.log(`[TaskUpdate100] ${scope.iso2}, ${scope.adminLevel}, ${message}, ${status}`);
};

const RUNNING_RESIDUE_LOG_PREFIX = '[ShapeRunningResidue]';
const RUNNING_RESIDUE_LOG_LIMIT = 600;
const TASK_FLUSH_FALLBACK_TIMEOUT_MS = 120;
let runningResidueLogCount = 0;
let runningResidueLogLimitNotified = false;

const resetTaskSyncDebugLogCounters = (): void => {
  taskUpdate100LogCount = 0;
  taskUpdate100LogLimitNotified = false;
  runningResidueLogCount = 0;
  runningResidueLogLimitNotified = false;
};

type RunningResidueLogPayload = {
  nodeId: string | null;
  stage?: string | null;
  taskId?: string | null;
  sequence?: number | null;
  prevStatus?: string | null;
  nextStatus?: string | null;
  source?: string | null;
  timestamp?: number;
  reason?: string | null;
  eventType?: string | null;
  runningCount?: number | null;
  queuedCount?: number | null;
  totalCount?: number | null;
};

const formatLogValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.replace(/\s+/g, '_') : '-';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
};

const emitRunningResidueLog = (keyword: string, payload: RunningResidueLogPayload): void => {
  if (!isTaskSyncDebugEnabled('runningResidue')) return;
  if (runningResidueLogCount >= RUNNING_RESIDUE_LOG_LIMIT) {
    if (!runningResidueLogLimitNotified) {
      runningResidueLogLimitNotified = true;
      console.log(`${RUNNING_RESIDUE_LOG_PREFIX} LOG_LIMIT_REACHED limit=${RUNNING_RESIDUE_LOG_LIMIT}`);
    }
    return;
  }
  runningResidueLogCount += 1;
  const logPayload: Required<Pick<RunningResidueLogPayload, 'nodeId'>> & RunningResidueLogPayload = {
    ...payload,
    nodeId: payload.nodeId,
    timestamp: payload.timestamp ?? Date.now(),
  };
  const line = `${RUNNING_RESIDUE_LOG_PREFIX} ${keyword}`
    + ` nodeId=${formatLogValue(logPayload.nodeId)}`
    + ` stage=${formatLogValue(logPayload.stage)}`
    + ` taskId=${formatLogValue(logPayload.taskId)}`
    + ` sequence=${formatLogValue(logPayload.sequence)}`
    + ` prevStatus=${formatLogValue(logPayload.prevStatus)}`
    + ` nextStatus=${formatLogValue(logPayload.nextStatus)}`
    + ` source=${formatLogValue(logPayload.source)}`
    + ` eventType=${formatLogValue(logPayload.eventType)}`
    + ` reason=${formatLogValue(logPayload.reason)}`
    + ` runningCount=${formatLogValue(logPayload.runningCount)}`
    + ` queuedCount=${formatLogValue(logPayload.queuedCount)}`
    + ` totalCount=${formatLogValue(logPayload.totalCount)}`
    + ` timestamp=${formatLogValue(logPayload.timestamp)}`;
  console.log(line, logPayload);
};

const normalizeTaskStatus = (
  status: ShapeBuildTaskSummary['status'] | undefined,
  progress: number,
): ShapeBuildTaskSummary['status'] => {
  const normalized = status ?? 'queued';
  if (normalized === 'running' && progress >= 100) {
    return 'completed';
  }
  return normalized;
};

const isCompletedLikeStatus = (status: ShapeBuildTaskSummary['status'] | undefined): boolean => (
  status === 'completed' || status === 'recycled'
);

const isCompletedAtFullProgress = (task: ShapeBuildTaskSummary): boolean => (
  isCompletedLikeStatus(task.status) && resolveProgressValue(task.progress) >= 100
);

const isRunningAtFullProgress = (task: ShapeBuildTaskSummary): boolean => (
  task.status === 'running' && resolveProgressValue(task.progress) >= 100
);

const readNormalizedMessage = (value: string | null | undefined): string => (
  typeof value === 'string' ? value.trim() : ''
);

const isLegacyPhaseMessage = (value: string | null | undefined): boolean => (
  /^[a-z0-9]+(?:[:_-][a-z0-9]+)*$/i.test(readNormalizedMessage(value))
);

const areMetricsEqual = (
  left: TaskDisplayPayload['metrics'],
  right: TaskDisplayPayload['metrics'],
): boolean => {
  const metricKeys: Array<'features' | 'polygons' | 'vertices'> = ['features', 'polygons', 'vertices'];
  return metricKeys.every((metricKey) => {
    const leftMetric = left?.[metricKey];
    const rightMetric = right?.[metricKey];
    if (!leftMetric && !rightMetric) return true;
    if (!leftMetric || !rightMetric) return false;
    return leftMetric.input === rightMetric.input && leftMetric.output === rightMetric.output;
  });
};

const areDisplayParamsEqual = (
  left: TaskDisplayPayload['params'],
  right: TaskDisplayPayload['params'],
): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

const areDisplaysEqual = (
  left: TaskDisplayPayload | undefined,
  right: TaskDisplayPayload | undefined,
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.kind === right.kind
    && left.key === right.key
    && left.phaseCode === right.phaseCode
    && left.phaseState === right.phaseState
    && areDisplayParamsEqual(left.params, right.params)
    && areMetricsEqual(left.metrics, right.metrics);
};

const shouldPromoteCompletedDisplay = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (areDisplaysEqual(current.display, next.display)) return false;
  if (!current.display && next.display) return true;
  if (isTaskPhaseDisplay(current.display) && !isTaskPhaseDisplay(next.display)) return true;
  if (current.display && !next.display) return false;
  return false;
};

const shouldPromoteCompletedMessage = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (shouldPromoteCompletedDisplay(current, next)) return true;
  const currentMessage = readNormalizedMessage(current.message);
  const nextMessage = readNormalizedMessage(next.message);
  if (!nextMessage || nextMessage === currentMessage) return false;
  if (!currentMessage) return true;
  if (isLegacyPhaseMessage(currentMessage) && !isLegacyPhaseMessage(nextMessage)) return true;
  return false;
};

const areTasksEquivalentForView = (
  left: ShapeBuildTaskSummary,
  right: ShapeBuildTaskSummary,
): boolean => (
  left.taskId === right.taskId
  && left.stage === right.stage
  && left.status === right.status
  && resolveProgressValue(left.progress) === resolveProgressValue(right.progress)
  && areDisplaysEqual(left.display, right.display)
  && (left.message ?? null) === (right.message ?? null)
  && (left.title ?? null) === (right.title ?? null)
  && (left.error ?? null) === (right.error ?? null)
  && (left.errorMessage ?? null) === (right.errorMessage ?? null)
  && (left.index ?? null) === (right.index ?? null)
  && (left.stagePriority ?? null) === (right.stagePriority ?? null)
  && (left.sequence ?? null) === (right.sequence ?? null)
);

const areTaskListsEquivalentForView = (
  left: ShapeBuildTaskSummary[],
  right: ShapeBuildTaskSummary[],
): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftTask = left[index];
    const rightTask = right[index];
    if (!leftTask || !rightTask) return false;
    if (!areTasksEquivalentForView(leftTask, rightTask)) return false;
  }
  return true;
};

const mergeSnapshotWithCurrent = (
  snapshotTasks: ShapeBuildTaskSummary[],
  currentMap: Map<string, ShapeBuildTaskSummary>,
): ShapeBuildTaskSummary[] => {
  if (snapshotTasks.length === 0) {
    return [];
  }
  const mergedMap = new Map<string, ShapeBuildTaskSummary>();
  snapshotTasks.forEach((snapshotTask) => {
    const currentFromMap = currentMap.get(snapshotTask.taskId);
    if (!currentFromMap || shouldPreferNextTask(currentFromMap, snapshotTask)) {
      mergedMap.set(snapshotTask.taskId, snapshotTask);
    } else {
      mergedMap.set(snapshotTask.taskId, currentFromMap);
    }
  });
  const merged = [...mergedMap.values()];
  merged.sort(compareTaskOrderByIndexThenId);
  return merged;
};

const readStatusRank = (task: ShapeBuildTaskSummary): number => {
  switch (task.status) {
    case 'queued':
      return 0;
    case 'running':
      return 1;
    case 'paused':
      return 2;
    case 'completed':
    case 'recycled':
    case 'failed':
      return 3;
    default:
      return 0;
  }
};

const shouldPreferNextTask = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  const currentSequence = readTaskSequence(current);
  const nextSequence = readTaskSequence(next);
  if (currentSequence !== null && nextSequence !== null) {
    if (nextSequence < currentSequence) {
      if (
        isCompletedAtFullProgress(next)
        && !isCompletedAtFullProgress(current)
        && (current.status === 'queued' || current.status === 'running')
      ) {
        return true;
      }
      return false;
    }
    if (nextSequence === currentSequence) {
      if (isCompletedAtFullProgress(next) && !isCompletedAtFullProgress(current)) {
        return true;
      }
      if (isCompletedAtFullProgress(current) && !isCompletedAtFullProgress(next)) {
        return false;
      }
      const currentStatusRank = readStatusRank(current);
      const nextStatusRank = readStatusRank(next);
      if (nextStatusRank !== currentStatusRank) {
        return nextStatusRank > currentStatusRank;
      }
      if (resolveProgressValue(next.progress) !== resolveProgressValue(current.progress)) {
        return resolveProgressValue(next.progress) > resolveProgressValue(current.progress);
      }
      if (isCompletedLikeStatus(next.status) && isCompletedLikeStatus(current.status)) {
        return shouldPromoteCompletedMessage(current, next);
      }
      return false;
    }
  }

  if (isCompletedAtFullProgress(current) && isCompletedAtFullProgress(next)) {
    return shouldPromoteCompletedMessage(current, next);
  }
  if (isCompletedAtFullProgress(current) && !isCompletedAtFullProgress(next)) {
    return false;
  }
  if (isCompletedAtFullProgress(next) && !isCompletedAtFullProgress(current)) {
    return true;
  }
  if (isCompletedLikeStatus(current.status) && next.status === 'running') {
    return false;
  }
  if (isCompletedLikeStatus(current.status) && next.status === 'queued') {
    return false;
  }
  if (current.status === 'running' && isCompletedLikeStatus(next.status)) {
    return true;
  }
  if (isCompletedAtFullProgress(current) && isRunningAtFullProgress(next)) {
    return false;
  }
  if (isCompletedAtFullProgress(next) && isRunningAtFullProgress(current)) {
    return true;
  }
  return shouldApplyTaskUpdate(current, next);
};

export const useShapeBuildTaskSync = ({
  sessionNodeId,
  setTasks,
  setIsLoading,
  setError,
  markTaskStreamSynchronized,
}: SyncArgs) => {
  const isLoadingRef = useRef(false);
  const errorRef = useRef<Error | null>(null);
  const tasksRef = useRef<ShapeBuildTaskSummary[]>([]);
  const committedTasksRef = useRef<ShapeBuildTaskSummary[]>([]);
  const tasksMapRef = useRef<Map<string, ShapeBuildTaskSummary>>(new Map());
  const completedTasksRef = useRef<Map<string, ShapeBuildTaskSummary>>(new Map());
  const vtParentInputDebugLogKeysRef = useRef<Set<string>>(new Set());
  const pendingTasksRef = useRef<ShapeBuildTaskSummary[] | null>(null);
  const bufferedSnapshotRef = useRef<ShapeBuildTaskSummary[] | null>(null);
  const bufferedUpdatesRef = useRef<Map<string, ShapeBuildTaskSummary>>(new Map());
  const bufferedSequenceRef = useRef<Map<string, number>>(new Map());
  const committedSequenceRef = useRef<Map<string, number>>(new Map());
  const pendingDirtyRef = useRef(false);
  const flushScheduledRef = useRef(false);
  const flushFrameRef = useRef<number | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      pendingTasksRef.current = null;
      bufferedSnapshotRef.current = null;
      bufferedUpdatesRef.current = new Map();
      bufferedSequenceRef.current = new Map();
      committedSequenceRef.current = new Map();
      pendingDirtyRef.current = false;
      vtParentInputDebugLogKeysRef.current.clear();
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    vtParentInputDebugLogKeysRef.current.clear();
    resetTaskSyncDebugLogCounters();
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();
    bufferedSequenceRef.current = new Map();
    committedSequenceRef.current = new Map();
  }, [sessionNodeId]);

  const updateCommittedSequences = useCallback((tasks: ShapeBuildTaskSummary[]) => {
    committedSequenceRef.current = buildTaskSequenceMap(tasks);
  }, []);

  const flushTasks = useCallback((next: ShapeBuildTaskSummary[], dirty: boolean) => {
    if (!dirty) {
      markTaskStreamSynchronized?.();
      return;
    }
    if (areTaskListsEquivalentForView(committedTasksRef.current, next)) {
      committedTasksRef.current = next;
      updateCommittedSequences(next);
      markTaskStreamSynchronized?.();
      return;
    }
    committedTasksRef.current = next;
    updateCommittedSequences(next);
    if (!isMountedRef.current) {
      markTaskStreamSynchronized?.();
      return;
    }
    setTasks(next);
    markTaskStreamSynchronized?.();
  }, [markTaskStreamSynchronized, setTasks, updateCommittedSequences]);

  const scheduleFlush = useCallback((next: ShapeBuildTaskSummary[], dirty = true) => {
    if (!isMountedRef.current) {
      return;
    }
    const pendingCurrent = pendingTasksRef.current;
    if (pendingCurrent && areTaskListsEquivalentForView(pendingCurrent, next)) {
      pendingDirtyRef.current = pendingDirtyRef.current || dirty;
      return;
    }
    pendingTasksRef.current = next;
    pendingDirtyRef.current = pendingDirtyRef.current || dirty;
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    const flushPending = () => {
      if (!flushScheduledRef.current) return;
      flushScheduledRef.current = false;
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      const pending = pendingTasksRef.current;
      const isDirty = pendingDirtyRef.current;
      pendingTasksRef.current = null;
      pendingDirtyRef.current = false;
      if (pending) {
        flushTasks(pending, isDirty);
      }
    };
    flushFrameRef.current = window.requestAnimationFrame(() => {
      flushFrameRef.current = null;
      flushPending();
    });
    flushTimeoutRef.current = window.setTimeout(() => {
      flushTimeoutRef.current = null;
      flushPending();
    }, TASK_FLUSH_FALLBACK_TIMEOUT_MS);
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(flushPending);
    }
  }, [flushTasks]);

  const mergeTaskWithBase = useCallback((
    task: ShapeBuildTaskSummary,
    baseList: ShapeBuildTaskSummary[],
  ) => {
    const currentTask = tasksMapRef.current.get(task.taskId);
    if (currentTask && areTasksEquivalentForView(currentTask, task)) {
      return { next: baseList, changed: false } as const;
    }
    if (currentTask && !shouldPreferNextTask(currentTask, task)) {
      return { next: baseList, changed: false } as const;
    }
    const nextMap = new Map(tasksMapRef.current);
    nextMap.set(task.taskId, task);
    tasksMapRef.current = nextMap;
    if (isCompletedAtFullProgress(task)) {
      const nextCompletedMap = new Map(completedTasksRef.current);
      nextCompletedMap.set(task.taskId, task);
      completedTasksRef.current = nextCompletedMap;
    }
    return { next: upsertTaskInOrder(baseList, task), changed: true } as const;
  }, []);

  const bufferTaskUpdate = useCallback((task: ShapeBuildTaskSummary) => {
    const nextSequence = readTaskSequence(task);
    const committedSequence = nextSequence === null
      ? undefined
      : committedSequenceRef.current.get(task.taskId);
    if (nextSequence !== null && committedSequence !== undefined && nextSequence < committedSequence) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: sessionNodeId,
        stage: task.stage,
        taskId: task.taskId,
        sequence: nextSequence,
        prevStatus: null,
        nextStatus: task.status ?? null,
        source: 'buffer',
        eventType: 'update',
        reason: 'sequence_older_than_committed',
      });
      return;
    }
    const bufferedSequence = bufferedSequenceRef.current.get(task.taskId);
    if (nextSequence !== null && bufferedSequence !== undefined && nextSequence <= bufferedSequence) {
      return;
    }
    bufferedUpdatesRef.current.set(task.taskId, task);
    if (nextSequence !== null) {
      bufferedSequenceRef.current.set(task.taskId, nextSequence);
    }
  }, [sessionNodeId]);

  const applyBufferedEvents = useCallback(() => {
    const bufferedSnapshot = bufferedSnapshotRef.current;
    const bufferedUpdates = bufferedUpdatesRef.current;
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();
    bufferedSequenceRef.current = new Map();

    let nextList = bufferedSnapshot
      ? mergeSnapshotWithCurrent(bufferedSnapshot, tasksMapRef.current)
      : (pendingTasksRef.current ?? committedTasksRef.current);
    let changed = bufferedSnapshot !== null;

    if (bufferedSnapshot) {
      tasksMapRef.current = new Map(nextList.map((task) => [task.taskId, task]));
      const nextCompletedMap = new Map(completedTasksRef.current);
      nextList.forEach((task) => {
        if (isCompletedAtFullProgress(task)) {
          nextCompletedMap.set(task.taskId, task);
        }
      });
      completedTasksRef.current = nextCompletedMap;
      updateCommittedSequences(nextList);
    }

    bufferedUpdates.forEach((task) => {
      const nextSequence = readTaskSequence(task);
      const committedSequence = nextSequence === null
        ? undefined
        : committedSequenceRef.current.get(task.taskId);
      if (nextSequence !== null && committedSequence !== undefined && nextSequence < committedSequence) {
        return;
      }
      const result = mergeTaskWithBase(task, nextList);
      nextList = result.next;
      changed = changed || result.changed;
      if (nextSequence !== null) {
        committedSequenceRef.current.set(task.taskId, nextSequence);
      }
    });

    return { nextList, changed };
  }, [mergeTaskWithBase, updateCommittedSequences]);

  const scheduleBufferedFlush = useCallback(() => {
    if (!isMountedRef.current) {
      return;
    }
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    const flushPending = () => {
      if (!flushScheduledRef.current) return;
      flushScheduledRef.current = false;
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      const { nextList, changed } = applyBufferedEvents();
      pendingTasksRef.current = null;
      pendingDirtyRef.current = false;
      flushTasks(nextList, changed);
    };
    flushFrameRef.current = window.requestAnimationFrame(() => {
      flushFrameRef.current = null;
      flushPending();
    });
    flushTimeoutRef.current = window.setTimeout(() => {
      flushTimeoutRef.current = null;
      flushPending();
    }, TASK_FLUSH_FALLBACK_TIMEOUT_MS);
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(flushPending);
    }
  }, [applyBufferedEvents, flushTasks]);

  const resolveTaskSummary = useCallback((task: RawTaskSummary): ShapeBuildTaskSummary => {
    const progress = resolveProgressValue(task.progress);
    const stage = resolveTaskStage(task);
    const normalized: ShapeBuildTaskSummary = {
      ...task,
      // Keep legacy fields aligned with canonical stage so downstream grouping
      // does not regress to stale taskType/type values during stage transitions.
      stage,
      taskType: stage,
      type: stage,
      status: normalizeTaskStatus(task.status, progress),
      progress: progress >= 100 ? 100 : task.progress,
    };
    if (normalized.stage === 'vt') {
      const parentInputSummary = readVtParentInputSummary(normalized.metadata);
      if (parentInputSummary) {
        const parentInputMessage = buildVtParentInputSummaryMessage(parentInputSummary);
        normalized.message = mergeTaskMessage(normalized.message, parentInputMessage);
        if (isDev) {
          const logKey = `${normalized.taskId}:${parentInputMessage}`;
          if (!vtParentInputDebugLogKeysRef.current.has(logKey)) {
            vtParentInputDebugLogKeysRef.current.add(logKey);
            console.debug('[ShapeVtParentInputSummary]', {
              nodeId: sessionNodeId,
              taskId: normalized.taskId,
              sequence: normalized.sequence ?? null,
              message: parentInputMessage,
              summary: parentInputSummary,
            });
          }
        }
      }
    }
    const completedTask = completedTasksRef.current.get(normalized.taskId);
    if (!completedTask) {
      return normalized;
    }
    if (normalized.status === 'running' || normalized.status === 'queued') {
      return completedTask;
    }
    if (!isCompletedAtFullProgress(normalized)) {
      return completedTask;
    }
    return normalized;
  }, [sessionNodeId]);

  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    const snapshotTasks = next.map(resolveTaskSummary);
    bufferedSnapshotRef.current = snapshotTasks;
    scheduleBufferedFlush();
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [resolveTaskSummary, scheduleBufferedFlush, sessionNodeId, setError, setIsLoading]);

  const handleUpdate = useCallback((task: RawTaskSummary) => {
    const resolved = resolveTaskSummary(task);
    const previous = tasksMapRef.current.get(resolved.taskId);
    const isEquivalent = previous ? areTasksEquivalentForView(previous, resolved) : false;
    const shouldPrefer = previous ? shouldPreferNextTask(previous, resolved) : true;
    if (previous && (isEquivalent || !shouldPrefer)) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: sessionNodeId,
        stage: resolved.stage,
        taskId: resolved.taskId,
        sequence: resolved.sequence ?? null,
        prevStatus: previous.status ?? null,
        nextStatus: resolved.status ?? null,
        source: 'event',
        eventType: 'update',
        reason: 'shouldPreferNextTask=false_or_equivalent',
      });
      return;
    }
    if (previous && previous.status !== resolved.status) {
      emitRunningResidueLog('STATUS_TRANSITION', {
        nodeId: sessionNodeId,
        stage: resolved.stage,
        taskId: resolved.taskId,
        sequence: resolved.sequence ?? null,
        prevStatus: previous.status ?? null,
        nextStatus: resolved.status ?? null,
        source: 'event',
        eventType: 'update',
      });
    }
    bufferTaskUpdate(resolved);
    scheduleBufferedFlush();
    logTaskUpdate100(resolved);
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [bufferTaskUpdate, resolveTaskSummary, scheduleBufferedFlush, sessionNodeId, setError, setIsLoading]);

  const handleDelete = useCallback((taskId: string) => {
    const existing = tasksMapRef.current.get(taskId);
    if (!existing) {
      emitRunningResidueLog('STALE_DROP', {
        nodeId: sessionNodeId,
        stage: null,
        taskId,
        sequence: null,
        prevStatus: null,
        nextStatus: null,
        source: 'event',
        eventType: 'delete',
        reason: 'task_not_found',
      });
      return;
    }
    emitRunningResidueLog('STATUS_TRANSITION', {
      nodeId: sessionNodeId,
      source: 'event',
      eventType: 'delete',
      taskId,
      stage: existing.stage,
      sequence: existing.sequence ?? null,
      prevStatus: existing.status ?? null,
      nextStatus: 'deleted',
    });
    const nextMap = new Map(tasksMapRef.current);
    nextMap.delete(taskId);
    tasksMapRef.current = nextMap;
    const nextCompletedMap = new Map(completedTasksRef.current);
    nextCompletedMap.delete(taskId);
    completedTasksRef.current = nextCompletedMap;
    const nextCommittedSequences = new Map(committedSequenceRef.current);
    nextCommittedSequences.delete(taskId);
    committedSequenceRef.current = nextCommittedSequences;
    bufferedUpdatesRef.current.delete(taskId);
    bufferedSequenceRef.current.delete(taskId);
    if (bufferedSnapshotRef.current) {
      bufferedSnapshotRef.current = bufferedSnapshotRef.current.filter((task) => task.taskId !== taskId);
    }
    const current = pendingTasksRef.current ?? committedTasksRef.current;
    const next = removeTaskById(current, taskId);
    scheduleFlush(next, true);
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [scheduleFlush, sessionNodeId, setError, setIsLoading]);

  const syncTasksRef = useCallback((tasks: ShapeBuildTaskSummary[]) => {
    pendingTasksRef.current = null;
    pendingDirtyRef.current = false;
    flushScheduledRef.current = false;
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();
    bufferedSequenceRef.current = new Map();
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    tasksRef.current = tasks;
    committedTasksRef.current = tasks;
    tasksMapRef.current = new Map(tasks.map((task) => [task.taskId, task]));
    completedTasksRef.current = new Map(
      tasks
        .filter((task) => isCompletedAtFullProgress(task))
        .map((task) => [task.taskId, task]),
    );
    updateCommittedSequences(tasks);
  }, [updateCommittedSequences]);

  const syncLoadingRef = useCallback((isLoading: boolean) => {
    isLoadingRef.current = isLoading;
  }, []);

  const syncErrorRef = useCallback((error: Error | null) => {
    errorRef.current = error;
  }, []);

  const resetPending = useCallback(() => {
    pendingTasksRef.current = null;
    pendingDirtyRef.current = false;
    bufferedSnapshotRef.current = null;
    bufferedUpdatesRef.current = new Map();
    bufferedSequenceRef.current = new Map();
    flushScheduledRef.current = false;
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
  }, []);

  return {
    tasksRef,
    isLoadingRef,
    errorRef,
    handleSnapshot,
    handleUpdate,
    handleDelete,
    syncTasksRef,
    syncLoadingRef,
    syncErrorRef,
    resetPending,
    scheduleFlush,
  };
};
