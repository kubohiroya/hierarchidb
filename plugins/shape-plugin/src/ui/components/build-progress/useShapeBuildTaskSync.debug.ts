import { isTaskPhaseDisplay } from '../../../common/utils/taskMessages.ts';
import type {
  RunningResidueLogPayload,
  TaskSyncDebugChannel,
  TaskSyncDebugConfig,
} from './useShapeBuildTaskSync.types.ts';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';

const isDev = import.meta.env.DEV;
const RUNNING_RESIDUE_LOG_PREFIX = '[ShapeRunningResidue]';
const RUNNING_RESIDUE_LOG_LIMIT = 600;
const TASK_UPDATE100_LOG_LIMIT = 300;

let taskUpdate100LogCount = 0;
let taskUpdate100LogLimitNotified = false;
let runningResidueLogCount = 0;
let runningResidueLogLimitNotified = false;

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

export const resetTaskSyncDebugLogCounters = (): void => {
  taskUpdate100LogCount = 0;
  taskUpdate100LogLimitNotified = false;
  runningResidueLogCount = 0;
  runningResidueLogLimitNotified = false;
};

export const emitRunningResidueLog = (keyword: string, payload: RunningResidueLogPayload): void => {
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

export const isProgressTaskMessageSkippable = (task: ShapeBuildTaskSummary): boolean => (
  task.progress >= 100 && isTaskPhaseDisplay(task.display)
);

export const logTaskUpdate100 = (task: ShapeBuildTaskSummary): void => {
  if (!isTaskSyncDebugEnabled('taskUpdate100')) return;
  if ((typeof task.progress === 'number' ? task.progress : 0) < 100) return;
  if (taskUpdate100LogCount >= TASK_UPDATE100_LOG_LIMIT) {
    if (!taskUpdate100LogLimitNotified) {
      taskUpdate100LogLimitNotified = true;
      console.log(`[TaskUpdate100] log limit reached (${TASK_UPDATE100_LOG_LIMIT}); suppressing further logs`);
    }
    return;
  }
  taskUpdate100LogCount += 1;
  const messageParts = [
    `[TaskUpdate100] ${task.taskId}`,
    `status=${task.status}`,
    `stage=${task.stage}`,
    `progress=${task.progress ?? 0}`,
  ];
  console.log(messageParts.join(' '));
};
