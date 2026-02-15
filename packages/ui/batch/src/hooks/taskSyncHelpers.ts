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

export const compareTaskOrderByIndexThenId = <T extends TaskSyncItem>(left: T, right: T): number => {
  const leftIndex = resolveTaskIndex(left);
  const rightIndex = resolveTaskIndex(right);
  if (leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }
  return left.taskId.localeCompare(right.taskId);
};

const findInsertPosition = <T extends TaskSyncItem>(items: T[], task: T): number => {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midTask = items[mid];
    if (!midTask) break;
    if (compareTaskOrderByIndexThenId(midTask, task) <= 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

export const sortTasksByIndex = <T extends TaskSyncItem>(items: T[]): T[] => (
  [...items].sort((a, b) => resolveTaskIndex(a) - resolveTaskIndex(b))
);

export const upsertTaskInOrder = <T extends TaskSyncItem>(current: T[], task: T): T[] => {
  const existingIndex = current.findIndex((item) => item.taskId === task.taskId);
  if (existingIndex < 0) {
    const insertAt = findInsertPosition(current, task);
    const next = current.slice();
    next.splice(insertAt, 0, task);
    return next;
  }
  const next = current.slice();
  next.splice(existingIndex, 1);
  const insertAt = findInsertPosition(next, task);
  next.splice(insertAt, 0, task);
  return next;
};

export const removeTaskById = <T extends TaskSyncItem>(current: T[], taskId: string): T[] => {
  const index = current.findIndex((task) => task.taskId === taskId);
  if (index < 0) return current;
  const next = current.slice();
  next.splice(index, 1);
  return next;
};

export const readTaskSequence = (task: TaskSyncItem): number | null => (
  typeof task.sequence === 'number' && Number.isFinite(task.sequence) ? task.sequence : null
);

export const buildTaskSequenceMap = <T extends TaskSyncItem>(tasks: T[]): Map<string, number> => {
  const map = new Map<string, number>();
  tasks.forEach((task) => {
    const seq = readTaskSequence(task);
    if (seq !== null) {
      map.set(task.taskId, seq);
    }
  });
  return map;
};

export const shouldApplyTaskUpdate = <T extends TaskSyncItem>(
  current: T | undefined,
  next: T,
): boolean => {
  if (!current) return true;
  const currentSequence = readTaskSequence(current);
  const nextSequence = readTaskSequence(next);
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
    const nextSeq = readTaskSequence(nextTask);
    const currentSeq = readTaskSequence(currentTask);
    if (nextSeq !== null || currentSeq !== null) {
      if (nextSeq !== currentSeq) return false;
      continue;
    }
    if (nextTask.status !== currentTask.status) return false;
    if (nextTask.progress !== currentTask.progress) return false;
  }
  return true;
};
