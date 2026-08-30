import type { BuildSessionRuntimeStatus, BuildSessionStatus } from '@hierarchidb/build-api';

const assertUnreachableBuildSessionStatus = (status: never): never => {
  throw new Error(`[worker bootstrap] unsupported build session status: ${String(status)}`);
};

export const resolveRuntimeStatusFromBuildSession = (
  status: BuildSessionStatus['status']
): BuildSessionRuntimeStatus => {
  switch (status) {
    case 'queued':
      return 'starting';
    case 'running':
      return 'running';
    case 'pausing':
      return 'pausing';
    case 'paused':
      return 'paused';
    case 'canceling':
      return 'canceling';
    case 'canceled':
      return 'canceled';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'recycled':
      throw new Error('[worker bootstrap] recycled is not a valid build session status');
    case 'idle':
      return 'idle';
    default:
      return assertUnreachableBuildSessionStatus(status);
  }
};
