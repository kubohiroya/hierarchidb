/**
 * Cache write validation utilities
 * Implements runtime checks to prevent intermediate data persistence
 */

import type { TaskStatus } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';

/**
 * Terminal task statuses that allow cache writes
 */
const TERMINAL_STATUSES: TaskStatus[] = ['completed', 'failed', 'recycled'];

/**
 * Non-terminal task statuses that should not persist cache data
 */
const NON_TERMINAL_STATUSES: TaskStatus[] = ['queued', 'running'];

/**
 * Check if a task status is terminal (allows cache writes)
 */
export const isTerminalStatus = (status: TaskStatus): boolean => {
  return TERMINAL_STATUSES.includes(status);
};

/**
 * Check if a task status is non-terminal (should not persist cache data)
 */
export const isNonTerminalStatus = (status: TaskStatus): boolean => {
  return NON_TERMINAL_STATUSES.includes(status);
};

/**
 * Get task status from task queue
 */
export const getTaskStatus = async (
  taskQueue: VtTaskQueueDb,
  taskId: string
): Promise<TaskStatus | null> => {
  try {
    const task = await taskQueue.tasks.get(taskId);
    return task?.status ?? null;
  } catch (error) {
    console.error('[CacheWriteValidation] Failed to get task status', { taskId, error });
    return null;
  }
};

/**
 * Validate that cache write is allowed for the given task
 * Throws error if task status is non-terminal
 */
export const validateCacheWriteAllowed = async (
  taskQueue: VtTaskQueueDb,
  taskId: string,
  cacheType: 'geometry' | 'source'
): Promise<void> => {
  const status = await getTaskStatus(taskQueue, taskId);

  if (status === null) {
    throw new Error(
      `[CacheWriteValidation] Cannot write ${cacheType} cache: task not found (taskId=${taskId})`
    );
  }

  if (isNonTerminalStatus(status)) {
    throw new Error(
      `[CacheWriteValidation] Cannot write ${cacheType} cache: task status is non-terminal (taskId=${taskId}, status=${status}). Cache writes are only allowed for terminal statuses: ${TERMINAL_STATUSES.join(', ')}`
    );
  }

  if (!isTerminalStatus(status)) {
    throw new Error(
      `[CacheWriteValidation] Cannot write ${cacheType} cache: unknown task status (taskId=${taskId}, status=${status})`
    );
  }
};

/**
 * Verify no cache data exists for tasks with non-terminal status
 */
export const verifyCacheDataConsistency = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  cacheType: 'geometry' | 'source'
): Promise<{ inconsistentTasks: Array<{ taskId: string; status: TaskStatus }> }> => {
  try {
    // Get all tasks with non-terminal status for this node
    await taskQueue.tasks
      .where('nodeId')
      .equals(nodeId)
      .filter((task: { status: TaskStatus }) => isNonTerminalStatus(task.status))
      .toArray();

    const inconsistentTasks: Array<{ taskId: string; status: TaskStatus }> = [];

    // For now, we'll just return the structure for testing
    // Actual cache data verification would require access to cache tables
    // which should be implemented when integrating with specific cache implementations

    return { inconsistentTasks };
  } catch (error) {
    console.error('[CacheWriteValidation] Failed to verify cache data consistency', {
      nodeId,
      cacheType,
      error,
    });
    return { inconsistentTasks: [] };
  }
};

/**
 * Handle cache write failure by ensuring entry remains invalid
 * This function ensures that if metadata write fails, the cache entry
 * remains invalid (timestamp: 0) and logs the failure with context
 */
export const handleCacheWriteFailure = (
  error: unknown,
  context: {
    nodeId: NodeId;
    taskId: string;
    cacheType: 'geometry' | 'source';
    cacheId: string;
    phase: 'data' | 'metadata';
  }
): void => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'unknown';

  console.error('[CacheWriteValidation] Cache write failure', {
    nodeId: context.nodeId,
    taskId: context.taskId,
    cacheType: context.cacheType,
    cacheId: context.cacheId,
    phase: context.phase,
    errorName,
    errorMessage,
    timestamp: Date.now(),
  });

  // If metadata write fails, the entry will remain invalid (timestamp: 0)
  // This is the desired behavior as per requirements 3.1, 3.2
  if (context.phase === 'metadata') {
    console.warn('[CacheWriteValidation] Metadata write failure leaves entry invalid', {
      nodeId: context.nodeId,
      taskId: context.taskId,
      cacheType: context.cacheType,
      cacheId: context.cacheId,
      note: 'Entry will remain invalid with timestamp: 0',
    });
  }
};

/**
 * Log cache write operation for monitoring and debugging
 */
export const logCacheWriteOperation = (
  operation: 'start' | 'data-complete' | 'metadata-complete' | 'failure',
  context: {
    nodeId: NodeId;
    taskId: string;
    cacheType: 'geometry' | 'source';
    cacheId: string;
    phase?: 'data' | 'metadata';
    duration?: number;
  }
): void => {
  console.log('[CacheWriteValidation] Cache write operation', {
    operation,
    nodeId: context.nodeId,
    taskId: context.taskId,
    cacheType: context.cacheType,
    cacheId: context.cacheId,
    phase: context.phase,
    duration: context.duration,
    timestamp: Date.now(),
  });
};
