import type { BatchProgressAdapter, BatchProgressEvent, UnifiedProgressInfo } from '@hierarchidb/common-api';

export function progressEventToUnified(event: BatchProgressEvent): UnifiedProgressInfo {
  const payload = event.payload ?? {};
  const total = typeof payload.total === 'number' && payload.total > 0 ? payload.total : 0;
  const completed = typeof payload.completed === 'number' ? payload.completed : 0;
  const failed = typeof payload.failed === 'number' ? payload.failed : 0;
  const basePercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const percentage = event.phase === 'completed' ? 100 : Math.min(100, Math.max(0, basePercentage));
  const currentTask = payload.currentTask ?? event.message ?? event.stage;

  return {
    stage: event.stage,
    total,
    completed,
    failed,
    percentage,
    currentTask,
    phase: event.phase,
    timestamp: event.timestamp,
    payload,
    message: event.message,
    nodeId: event.nodeId,
  };
}

export function createAdapterFromProgressSubscribe(
  subscribeToProgress: (cb: (event: BatchProgressEvent) => void) => (() => void) | Promise<() => void>,
): BatchProgressAdapter {
  return {
    subscribe: (consumer: (info: UnifiedProgressInfo) => void) => {
      const wrapped = (event: BatchProgressEvent) => {
        consumer(progressEventToUnified(event));
      };
      return subscribeToProgress(wrapped);
    },
  };
}
