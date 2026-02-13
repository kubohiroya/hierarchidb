import { useCallback, useEffect, useRef } from 'react';
import type { TaskDisplayPayload, TaskStage } from '@hierarchidb/batch-api';
import type { BuildTaskSummary } from '@hierarchidb/batch-api';
import { shouldApplyTaskUpdate } from '@hierarchidb/ui-batch-progress';
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
  const candidate = task.taskType ?? task.type ?? task.stage;
  if (isTaskStage(candidate)) {
    return candidate;
  }
  throw new Error(`[ShapeBuildStep] Invalid task stage: ${String(candidate ?? 'undefined')}`);
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

const resolveTaskOrderIndex = (task: ShapeBuildTaskSummary): number => (
  typeof task.index === 'number' && Number.isFinite(task.index)
    ? task.index
    : Number.MAX_SAFE_INTEGER
);

const compareTaskOrder = (left: ShapeBuildTaskSummary, right: ShapeBuildTaskSummary): number => {
  const leftIndex = resolveTaskOrderIndex(left);
  const rightIndex = resolveTaskOrderIndex(right);
  if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  return left.taskId.localeCompare(right.taskId);
};

const findInsertPosition = (items: ShapeBuildTaskSummary[], task: ShapeBuildTaskSummary): number => {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midTask = items[mid];
    if (!midTask) break;
    if (compareTaskOrder(midTask, task) <= 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

const upsertTaskInSortedList = (
  current: ShapeBuildTaskSummary[],
  task: ShapeBuildTaskSummary,
): ShapeBuildTaskSummary[] => {
  const existingIndex = current.findIndex((item) => item.taskId === task.taskId);
  if (existingIndex < 0) {
    const insertAt = findInsertPosition(current, task);
    const next = current.slice();
    next.splice(insertAt, 0, task);
    return next;
  }
  const withoutCurrent = current.slice();
  withoutCurrent.splice(existingIndex, 1);
  const insertAt = findInsertPosition(withoutCurrent, task);
  withoutCurrent.splice(insertAt, 0, task);
  return withoutCurrent;
};

const removeTaskFromList = (current: ShapeBuildTaskSummary[], taskId: string): ShapeBuildTaskSummary[] => {
  const index = current.findIndex((task) => task.taskId === taskId);
  if (index < 0) return current;
  const next = current.slice();
  next.splice(index, 1);
  return next;
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

const isCompletedAtFullProgress = (task: ShapeBuildTaskSummary): boolean => (
  task.status === 'completed' && resolveProgressValue(task.progress) >= 100
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
  merged.sort(compareTaskOrder);
  return merged;
};

const readSequence = (task: ShapeBuildTaskSummary): number | null => (
  typeof task.sequence === 'number' && Number.isFinite(task.sequence) ? task.sequence : null
);

const readStatusRank = (task: ShapeBuildTaskSummary): number => {
  switch (task.status) {
    case 'queued':
      return 0;
    case 'running':
      return 1;
    case 'paused':
      return 2;
    case 'completed':
    case 'failed':
    case 'regression':
      return 3;
    default:
      return 0;
  }
};

const shouldPreferNextTask = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  const currentSequence = readSequence(current);
  const nextSequence = readSequence(next);
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
      if (next.status === 'completed' && current.status === 'completed') {
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
  if (current.status === 'completed' && next.status === 'running') {
    return false;
  }
  if (current.status === 'completed' && next.status === 'queued') {
    return false;
  }
  if (current.status === 'running' && next.status === 'completed') {
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
  const pendingDirtyRef = useRef(false);
  const flushScheduledRef = useRef(false);
  const flushFrameRef = useRef<number | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      pendingTasksRef.current = null;
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
  }, [sessionNodeId]);

  const flushTasks = useCallback((next: ShapeBuildTaskSummary[], dirty: boolean) => {
    if (!dirty) {
      markTaskStreamSynchronized?.();
      return;
    }
    if (areTaskListsEquivalentForView(committedTasksRef.current, next)) {
      committedTasksRef.current = next;
      markTaskStreamSynchronized?.();
      return;
    }
    committedTasksRef.current = next;
    if (!isMountedRef.current) {
      markTaskStreamSynchronized?.();
      return;
    }
    setTasks(next);
    markTaskStreamSynchronized?.();
  }, [markTaskStreamSynchronized, setTasks]);

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
  }, [flushTasks]);

  const resolveTaskSummary = useCallback((task: RawTaskSummary): ShapeBuildTaskSummary => {
    const progress = resolveProgressValue(task.progress);
    const normalized: ShapeBuildTaskSummary = {
      ...task,
      stage: resolveTaskStage(task),
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

  const mergeTask = useCallback((task: ShapeBuildTaskSummary) => {
    const baseList = pendingTasksRef.current ?? committedTasksRef.current;
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
    return { next: upsertTaskInSortedList(baseList, task), changed: true } as const;
  }, []);

  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    const snapshotTasks = next.map(resolveTaskSummary);
    const resolved = mergeSnapshotWithCurrent(snapshotTasks, tasksMapRef.current);
    tasksMapRef.current = new Map(resolved.map((task) => [task.taskId, task]));
    const nextCompletedMap = new Map(completedTasksRef.current);
    resolved.forEach((task) => {
      if (isCompletedAtFullProgress(task)) {
        nextCompletedMap.set(task.taskId, task);
      }
    });
    completedTasksRef.current = nextCompletedMap;
    scheduleFlush(resolved, !areTaskListsEquivalentForView(committedTasksRef.current, resolved));
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [resolveTaskSummary, scheduleFlush, sessionNodeId, setError, setIsLoading]);

  const handleUpdate = useCallback((task: RawTaskSummary) => {
    const resolved = resolveTaskSummary(task);
    const previous = tasksMapRef.current.get(resolved.taskId);
    const result = mergeTask(resolved);
    if (previous && !result.changed) {
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
    if (result.changed) {
      logTaskUpdate100(resolved);
      scheduleFlush(result.next, true);
    }
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [mergeTask, resolveTaskSummary, scheduleFlush, sessionNodeId, setError, setIsLoading]);

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
    const current = pendingTasksRef.current ?? committedTasksRef.current;
    const next = removeTaskFromList(current, taskId);
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
  }, []);

  const syncLoadingRef = useCallback((isLoading: boolean) => {
    isLoadingRef.current = isLoading;
  }, []);

  const syncErrorRef = useCallback((error: Error | null) => {
    errorRef.current = error;
  }, []);

  const resetPending = useCallback(() => {
    pendingTasksRef.current = null;
    pendingDirtyRef.current = false;
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
