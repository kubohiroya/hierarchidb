import type { ProgressEvent } from '@hierarchidb/common-type';
import type { BatchProgressAdapter, UnifiedProgressInfo } from './useBatchProgress';

export function progressEventToUnified(p: ProgressEvent): UnifiedProgressInfo {
  return {
    stage: p.stage,
    total: p.total,
    completed: p.completed,
    failed: p.failed,
    percentage: p.percentage,
    currentTask: p.currentTask,
  };
}

export function createAdapterFromProgressSubscribe(
  subscribeToProgress: (cb: (e: ProgressEvent) => void) => (() => void) | Promise<() => void>
): BatchProgressAdapter {
  return {
    subscribe: (cb: (u: UnifiedProgressInfo) => void) => {
      const wrap = (e: ProgressEvent) => cb(progressEventToUnified(e));
      return subscribeToProgress(wrap);
    },
  };
}

