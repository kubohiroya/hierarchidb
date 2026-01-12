import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';

export type TaskStage = 'fetch' | 'transform-by-band' | 'transform-by-zoom' | 'vt';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export type TaskQueueRecord<TInput = unknown, TOutput = unknown> = {
  taskId: string;
  nodeId: NodeId;
  stage: TaskStage;
  status: TaskStatus;
  index: number;
  stagePriority?: number;
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  retryCount?: number;
  inputData?: TInput;
  outputData?: TOutput;
  errorMessage?: string;
};

export type TaskQueueEvent = {
  nodeId: NodeId;
  task: TaskQueueRecord;
};

export class VtTaskQueueDb extends Dexie {
  tasks!: Table<TaskQueueRecord, string>;

  constructor(dbName: string = getDBName('vt-task-queue')) {
    super(dbName);
    this.version(1).stores({
      tasks:
        '&taskId, nodeId, stage, status, index, stagePriority'
        + ', [nodeId+stage], [nodeId+status], [nodeId+stage+status], [nodeId+stage+stagePriority]',
    });
    this.version(2).stores({
      tasks:
        '&taskId, nodeId, stage, status, index, stagePriority'
        + ', [nodeId+stage], [nodeId+status], [nodeId+stage+status], [nodeId+stage+stagePriority]',
    }).upgrade((tx) =>
      tx.table('tasks')
        .toCollection()
        .modify((task) => {
          if (task.status === 'waiting') {
            task.status = 'queued';
          }
        })
    );
    this.tasks = this.table('tasks');
  }
}

const listeners = new Map<NodeId, Set<(event: TaskQueueEvent) => void>>();

function emitTaskEvent(nodeId: NodeId, task: TaskQueueRecord): void {
  const subs = listeners.get(nodeId);
  if (!subs) return;
  subs.forEach((cb) => {
    try {
      cb({ nodeId, task });
    } catch (error) {
      console.error('[vt-task-queue] listener failed', error);
    }
  });
}

export function onTaskQueueUpdate(nodeId: NodeId, callback: (event: TaskQueueEvent) => void): () => void {
  const existing = listeners.get(nodeId);
  if (existing) {
    existing.add(callback);
  } else {
    listeners.set(nodeId, new Set([callback]));
  }

  return () => {
    const next = listeners.get(nodeId);
    if (!next) return;
    next.delete(callback);
    if (next.size === 0) listeners.delete(nodeId);
  };
}

export async function putTasks(
  db: VtTaskQueueDb,
  tasks: Array<TaskQueueRecord>
): Promise<void> {
  if (tasks.length === 0) return;
  const now = Date.now();
  const payload = tasks.map((task) => ({
    ...task,
    progress: Number.isFinite(task.progress) ? task.progress : 0,
    status: task.status ?? 'queued',
    createdAt: task.createdAt ?? now,
    updatedAt: now,
  }));
  await db.tasks.bulkPut(payload);
  payload.forEach((task) => emitTaskEvent(task.nodeId, task));
}

export async function updateTask(
  db: VtTaskQueueDb,
  taskId: string,
  updates: Partial<TaskQueueRecord>
): Promise<void> {
  const now = Date.now();
  await db.tasks.update(taskId, { ...updates, updatedAt: now });
  const task = await db.tasks.get(taskId);
  if (task) emitTaskEvent(task.nodeId, task);
}

export async function listTasks(
  db: VtTaskQueueDb,
  nodeId: NodeId
): Promise<TaskQueueRecord[]> {
  return db.tasks.where('nodeId').equals(nodeId).sortBy('index');
}

export async function listTasksByStage(
  db: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskStage
): Promise<TaskQueueRecord[]> {
  return db.tasks.where('[nodeId+stage]').equals([nodeId, stage]).sortBy('index');
}

export async function listTasksByStatus(
  db: VtTaskQueueDb,
  nodeId: NodeId,
  status: TaskStatus
): Promise<TaskQueueRecord[]> {
  return db.tasks.where('[nodeId+status]').equals([nodeId, status]).sortBy('index');
}

export async function listTasksByStageAndStatus(
  db: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskStage,
  status: TaskStatus
): Promise<TaskQueueRecord[]> {
  return db.tasks.where('[nodeId+stage+status]').equals([nodeId, stage, status]).sortBy('index');
}

export async function deleteTasksByNode(
  db: VtTaskQueueDb,
  nodeId: NodeId
): Promise<void> {
  await db.tasks.where('nodeId').equals(nodeId).delete();
}
