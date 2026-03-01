import { Dexie, type Table } from 'dexie';
import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB, type EphemeralBuildTaskRecord } from '@hierarchidb/gis-sdk';
import type { TaskQueueEvent, TaskQueueRecord, TaskStage, TaskStatus } from '~/types/types';
// import { logDebug } from '../debug/persistentDebugLog.js';
//import type { TaskQueueEvent, TaskQueueRecord, TaskStage, TaskStatus } from '@hierarchidb/gis-sdk';



export type StoredTaskRecord = EphemeralBuildTaskRecord;

const TASK_STAGES = ['source', 'geometry', 'tileEmit'] as const;
const TASK_STAGE_TO_STAGE_ID: Record<TaskStage, string> = {
  source: 'source-stage',
  geometry: 'geometry-stage',
  tileEmit: 'tile-emit-stage',
};

const isTaskStage = (value: unknown): value is TaskStage => (
  typeof value === 'string' && TASK_STAGES.includes(value as TaskStage)
);

export const toTaskQueueRecord = (
  task: StoredTaskRecord
): TaskQueueRecord => {
  const { stage } = task;
  if (stage === undefined) {
    throw new Error(`Task ${task.taskId} is missing required stage`);
  }
  if (!isTaskStage(stage)) {
    throw new Error(`Task ${task.taskId} has unsupported stage: ${String(stage)}`);
  }
  return {
    ...task,
    stage,
    stageId: TASK_STAGE_TO_STAGE_ID[stage],
  };
};

export class VtTaskQueueDb {
  tasks: Table<StoredTaskRecord, string>;
  private readonly db = ephemeralDB;
  readonly transaction = this.db.transaction.bind(this.db);

  constructor() {
    // Debug logging intentionally suppressed to reduce IndexedDB overhead.
    this.tasks = this.db.buildTasks;
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
      console.error('[tileEmit-task-queue] listener failed', error);
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
      console.error('[tileEmit-task-queue] listener failed', error);
    }
  });
}

const asRecord = (value: unknown): Record<string, unknown> | undefined => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
);

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
  const payload: StoredTaskRecord[] = tasks.map((task) => {
    return {
      ...task,
      progress: Number.isFinite(task.progress) ? task.progress : 0,
      status: task.status ?? 'queued',
      createdAt: task.createdAt ?? now,
      updatedAt: now,
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
  updates: Partial<StoredTaskRecord>,
  options?: { allowTerminalStatusTransition?: boolean }
): Promise<void> {
  const now = Date.now();
  const current = await db.tasks.get(taskId);
  const currentStatus = current?.status;
  const nextStatusCandidate = updates.status;
  const currentMetadata = asRecord(current?.metadata);
  const updatesMetadata = asRecord(updates.metadata);
  const mergedMetadata = updatesMetadata
    ? { ...(currentMetadata ?? {}), ...updatesMetadata }
    : currentMetadata;
  const lockedStatus = (currentStatus === 'completed' || currentStatus === 'failed' || currentStatus === 'recycled')
    && !options?.allowTerminalStatusTransition;
  const blocksStatusRegression = lockedStatus
    && nextStatusCandidate !== undefined
    && nextStatusCandidate !== currentStatus;
  const payload: Partial<StoredTaskRecord> = blocksStatusRegression
    ? {
      status: currentStatus,
      updatedAt: now,
      ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
    }
    : {
      ...updates,
      status: nextStatusCandidate ?? currentStatus,
      updatedAt: now,
      ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
    };
  await db.tasks.update(taskId, payload);
  const task = await db.tasks.get(taskId);
  if (task) emitTaskEvent(task.nodeId, toTaskQueueRecord(task));
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
    .where('[nodeId+stage+index]')
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
    .where('[nodeId+stage+status+index]')
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
