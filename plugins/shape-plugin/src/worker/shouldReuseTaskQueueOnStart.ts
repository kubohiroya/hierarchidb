import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';

export const shouldReuseTaskQueueOnStart = (
  previousStatus: ShapeBuildSessionRecord['status'] | null | undefined
): boolean => previousStatus === 'paused';
