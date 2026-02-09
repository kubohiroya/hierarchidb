import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/core-types';
import { EPHEMERAL_DB_SCHEMA } from '@hierarchidb/gis-sdk';
import type { TaskQueueEvent, TaskQueueRecord, TaskStage, TaskStatus } from '../types/types.js';
// import { logDebug } from '../debug/persistentDebugLog.js';
//import type { TaskQueueEvent, TaskQueueRecord, TaskStage, TaskStatus } from '@hierarchidb/gis-sdk';



export type StoredTaskRecord<TInput = unknown, TOutput = unknown> = Omit<TaskQueueRecord<TInput, TOutput>, 'stage'> & {
  stage?: TaskStage;
  taskType: TaskStage;
  domainType?: string;
};

export const toTaskQueueRecord = <TInput = unknown, TOutput = unknown>(
  task: StoredTaskRecord<TInput, TOutput>
): TaskQueueRecord<TInput, TOutput> => {
  const { taskType, ...rest } = task;
  return { ...rest, stage: rest.stage ?? taskType };
};

export class VtTaskQueueDb extends Dexie {
  tasks!: Table<StoredTaskRecord, string>;

  constructor(dbName: string = getDBName('ephemeral')) {
    super(dbName);
    // Debug logging intentionally suppressed to reduce IndexedDB overhead.
    this.version(3).stores(EPHEMERAL_DB_SCHEMA);
    this.tasks = this.table('buildTasks');
  }
}

// Debug logging intentionally suppressed to reduce IndexedDB overhead.

const listeners = new Map<NodeId, Set<(event: TaskQueueEvent) => void>>();

function emitTaskEvent(nodeId: NodeId, task: TaskQueueRecord): void {
  const subs = listeners.get(nodeId);
  if (!subs) return;
  subs.forEach((cb) => {
    try {
      cb({ nodeId, task, type: 'update' });
    } catch (error) {
      console.error('[vt-task-queue] listener failed', error);
    }
  });
}

function emitTaskDeleteEvent(nodeId: NodeId, taskId: string): void {
  const subs = listeners.get(nodeId);
  if (!subs) return;
  subs.forEach((cb) => {
    try {
      cb({ nodeId, taskId, type: 'delete' });
    } catch (error) {
      console.error('[vt-task-queue] listener failed', error);
    }
  });
}

export function emitTaskUpdate(task: TaskQueueRecord): void {
  emitTaskEvent(task.nodeId, task);
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
  const taskIds = tasks.map((task) => task.taskId);
  const existing = await db.tasks.bulkGet(taskIds);
  const existingSequence = new Map(
    existing
      .filter((task): task is StoredTaskRecord => Boolean(task))
      .map((task) => [task.taskId, task.sequence ?? 0])
  );
  const payload: StoredTaskRecord[] = tasks.map((task) => {
    const baseSequence = Number.isFinite(task.sequence) ? task.sequence ?? 0 : 0;
    const priorSequence = existingSequence.get(task.taskId) ?? 0;
    const nextSequence = Math.max(baseSequence, priorSequence, 1);
    return {
      ...task,
      taskType: task.stage,
      progress: Number.isFinite(task.progress) ? task.progress : 0,
      status: task.status ?? 'queued',
      createdAt: task.createdAt ?? now,
      updatedAt: now,
      sequence: nextSequence,
    };
  });
  await db.tasks.bulkPut(payload);
  payload.forEach((task) => {
    emitTaskEvent(task.nodeId, toTaskQueueRecord(task));
  });
}

export async function updateTask(
  db: VtTaskQueueDb,
  taskId: string,
  updates: Partial<TaskQueueRecord>
): Promise<void> {
  const now = Date.now();
  try {
    await db.transaction('rw', db.tasks, async () => {
      const current = await db.tasks.get(taskId);
      const currentSequence = typeof current?.sequence === 'number' ? current.sequence : 0;
      const nextSequence = currentSequence + 1;
      const currentStatus = current?.status;
      const nextStatusCandidate = updates.status;
      const lockedStatus = currentStatus === 'completed' || currentStatus === 'failed';
      const effectiveStatus = lockedStatus && nextStatusCandidate && nextStatusCandidate !== currentStatus
        ? currentStatus
        : nextStatusCandidate;
      const payload = {
        ...updates,
        status: effectiveStatus ?? currentStatus,
        updatedAt: now,
        sequence: nextSequence,
      };
      await db.tasks.update(taskId, payload);
      const task = await db.tasks.get(taskId);
      if (task) emitTaskEvent(task.nodeId, toTaskQueueRecord(task));
    });
  } catch (error) {
    throw error;
  }
}

export async function listTasks(
  db: VtTaskQueueDb,
  nodeId: NodeId
): Promise<TaskQueueRecord[]> {
  const tasks = await db.tasks
    .where('[nodeId+index]')
    .between([nodeId, Dexie.minKey], [nodeId, Dexie.maxKey])
    .toArray();
  return tasks.map((task) => toTaskQueueRecord(task));
}

export async function listTasksByStage(
  db: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskStage
): Promise<TaskQueueRecord[]> {
  const tasks = await db.tasks
    .where('[nodeId+taskType+index]')
    .between([nodeId, stage, Dexie.minKey], [nodeId, stage, Dexie.maxKey])
    .toArray();
  return tasks.map((task) => toTaskQueueRecord(task));
}

export async function listTasksByStatus(
  db: VtTaskQueueDb,
  nodeId: NodeId,
  status: TaskStatus
): Promise<TaskQueueRecord[]> {
  const tasks = await db.tasks
    .where('[nodeId+status+index]')
    .between([nodeId, status, Dexie.minKey], [nodeId, status, Dexie.maxKey])
    .toArray();
  return tasks.map((task) => toTaskQueueRecord(task));
}

export async function listTasksByStageAndStatus(
  db: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskStage,
  status: TaskStatus
): Promise<TaskQueueRecord[]> {
  const tasks = await db.tasks
    .where('[nodeId+taskType+status+index]')
    .between([nodeId, stage, status, Dexie.minKey], [nodeId, stage, status, Dexie.maxKey])
    .toArray();
  return tasks.map((task) => toTaskQueueRecord(task));
}

export async function deleteTasksByNode(
  db: VtTaskQueueDb,
  nodeId: NodeId
): Promise<void> {
  const tasks = await db.tasks.where('nodeId').equals(nodeId).toArray();
  if (tasks.length === 0) return;
  await db.tasks.where('nodeId').equals(nodeId).delete();
  const seen = new Set<string>();
  tasks.forEach((task) => {
    if (!task) return;
    if (seen.has(task.taskId)) return;
    seen.add(task.taskId);
    emitTaskDeleteEvent(task.nodeId, task.taskId);
  });
}

export async function deleteTasksByIds(
  db: VtTaskQueueDb,
  taskIds: string[]
): Promise<void> {
  if (taskIds.length === 0) return;
  const tasks = await db.tasks.bulkGet(taskIds);
  const seen = new Set<string>();
  await db.tasks.bulkDelete(taskIds);
  tasks.forEach((task) => {
    if (!task) return;
    if (seen.has(task.taskId)) return;
    seen.add(task.taskId);
    emitTaskDeleteEvent(task.nodeId, task.taskId);
  });
}

export const vtTaskQueueDB = new VtTaskQueueDb();
