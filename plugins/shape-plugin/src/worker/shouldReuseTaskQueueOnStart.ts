import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';

export const shouldReuseTaskQueueOnStart = (
  _previousStatus: ShapeBuildSessionRecord['status'] | null | undefined,
): boolean => (
  false
);
