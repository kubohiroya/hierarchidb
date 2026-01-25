import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { TaskQueueEvent, TaskQueueRecord, TaskStage, TaskStatus } from '../types/types.js';
//import type { TaskQueueEvent, TaskQueueRecord, TaskStage, TaskStatus } from '@hierarchidb/gis-sdk';


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
      .filter((task): task is TaskQueueRecord => Boolean(task))
      .map((task) => [task.taskId, task.sequence ?? 0])
  );
  const payload = tasks.map((task) => {
    const baseSequence = Number.isFinite(task.sequence) ? task.sequence ?? 0 : 0;
    const priorSequence = existingSequence.get(task.taskId) ?? 0;
    const nextSequence = Math.max(baseSequence, priorSequence, 1);
    return {
      ...task,
      progress: Number.isFinite(task.progress) ? task.progress : 0,
      status: task.status ?? 'queued',
      createdAt: task.createdAt ?? now,
      updatedAt: now,
      sequence: nextSequence,
    };
  });
  await db.tasks.bulkPut(payload);
  payload.forEach((task) => {emitTaskEvent(task.nodeId, task)});
}

export async function updateTask(
  db: VtTaskQueueDb,
  taskId: string,
  updates: Partial<TaskQueueRecord>
): Promise<void> {
  const now = Date.now();
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
    if (task) emitTaskEvent(task.nodeId, task);
  });
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
