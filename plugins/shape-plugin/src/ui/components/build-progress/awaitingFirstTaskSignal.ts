export const hasAwaitingFirstTaskSignal = (input: {
  hasStartedTasks: boolean;
  hasQueuedTasks: boolean;
  progressTaskId?: string | null;
  progressTotal?: number | null;
}): boolean => {
  if (input.hasStartedTasks || input.hasQueuedTasks) {
    return true;
  }
  if (typeof input.progressTaskId === 'string' && input.progressTaskId.length > 0) {
    return true;
  }
  if (typeof input.progressTotal === 'number' && Number.isFinite(input.progressTotal) && input.progressTotal > 0) {
    return true;
  }
  return false;
};
