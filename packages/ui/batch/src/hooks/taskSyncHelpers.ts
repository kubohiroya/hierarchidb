export type TaskSyncItem = {
  taskId: string;
  sequence?: number;
  status?: string;
  progress?: number;
  index?: number;
};

export const resolveTaskIndex = (task: TaskSyncItem): number => {
  if (typeof task.index === 'number' && Number.isFinite(task.index)) {
    return task.index;
  }
  return Number.MAX_SAFE_INTEGER;
};

export const sortTasksByIndex = <T extends TaskSyncItem>(items: T[]): T[] => (
  [...items].sort((a, b) => resolveTaskIndex(a) - resolveTaskIndex(b))
);

export const shouldApplyTaskUpdate = <T extends TaskSyncItem>(
  current: T | undefined,
  next: T,
): boolean => {
  if (!current) return true;
  const currentSequence = typeof current.sequence === 'number' ? current.sequence : null;
  const nextSequence = typeof next.sequence === 'number' ? next.sequence : null;
  if (currentSequence !== null && nextSequence !== null && nextSequence <= currentSequence) {
    return false;
  }
  return true;
};

export const areTaskListsEqual = <T extends TaskSyncItem>(next: T[], current: T[]): boolean => {
  if (next.length !== current.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    const nextTask = next[i];
    const currentTask = current[i];
    if (!nextTask || !currentTask) return false;
    if (nextTask.taskId !== currentTask.taskId) return false;
    const nextSeq = typeof nextTask.sequence === 'number' ? nextTask.sequence : null;
    const currentSeq = typeof currentTask.sequence === 'number' ? currentTask.sequence : null;
    if (nextSeq !== null || currentSeq !== null) {
      if (nextSeq !== currentSeq) return false;
      continue;
    }
    if (nextTask.status !== currentTask.status) return false;
    if (nextTask.progress !== currentTask.progress) return false;
  }
  return true;
};
