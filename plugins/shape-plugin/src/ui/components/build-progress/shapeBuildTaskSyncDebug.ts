import { type NodeType } from '@hierarchidb/core-types';

const isDev = import.meta.env.DEV;
const RUNNING_RESIDUE_LOG_PREFIX = '[ShapeRunningResidue]';

export const SHAPE_NODE_TYPE = 'shape' as NodeType;

export type TaskSyncDebugConfig = Partial<Record<'runningResidue' | 'all', boolean>>;

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

export const isRunningResidueDebugEnabled = (): boolean => {
  if (!isDev) return false;
  const config = readTaskSyncDebugConfig();
  if (!config) return false;
  return config.all === true || config.runningResidue === true;
};

export const isTaskInFlight = (task: { status: string }): boolean => (
  task.status === 'running' || task.status === 'queued'
);

export const logRunningResidueDrop = (payload: {
  nodeId: string | null;
  source: string;
  eventType: string;
  reason?: string;
  taskId?: string | null;
}): void => {
  if (!isRunningResidueDebugEnabled()) return;
  if (payload.reason === 'subscription_cancelled') {
    return;
  }
  console.log(
    `${RUNNING_RESIDUE_LOG_PREFIX} STALE_DROP`
      + ` nodeId=${payload.nodeId ?? '-'}`
      + ` source=${payload.source}`
      + ` eventType=${payload.eventType}`
      + ` taskId=${payload.taskId ?? '-'}`
      + ` reason=${payload.reason ?? '-'}`
      + ` timestamp=${Date.now()}`,
    payload,
  );
};
