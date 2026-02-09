import type { BuildProgressAdapter, BuildProgressEvent, BuildUnifiedProgressInfo } from '@hierarchidb/batch-api';

export function progressEventToUnified(event: BuildProgressEvent): BuildUnifiedProgressInfo {
  const payload = event.payload ?? {};
  const total = typeof payload.total === 'number' && payload.total > 0 ? payload.total : 0;
  const completed = typeof payload.completed === 'number' ? payload.completed : 0;
  const failed = typeof payload.failed === 'number' ? payload.failed : 0;
  const basePercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const percentage = event.phase === 'completed' ? 100 : Math.min(100, Math.max(0, basePercentage));
  return {
    stage: event.stage,
    total,
    completed,
    failed,
    percentage,
    phase: event.phase,
    timestamp: event.timestamp,
    payload,
    message: event.message,
    nodeId: event.nodeId,
  };
}

export function createAdapterFromProgressSubscribe(
  subscribeToProgress: (cb: (event: BuildProgressEvent) => void) => (() => void) | Promise<() => void>,
): BuildProgressAdapter {
  return {
    subscribe: (consumer: (info: BuildUnifiedProgressInfo) => void) => {
      const wrapped = (event: BuildProgressEvent) => {
        consumer(progressEventToUnified(event));
      };
      return subscribeToProgress(wrapped);
    },
  };
}
