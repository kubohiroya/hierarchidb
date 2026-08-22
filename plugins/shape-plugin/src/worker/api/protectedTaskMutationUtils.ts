/**
 * Protected Task Mutation Service
 *
 * Wraps task mutations with state protection during AbortController termination
 */

import type { NodeId } from '@hierarchidb/core-types';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import type { ShapeBuildTaskRecordUpdate } from '@hierarchidb/shape-api';
import { taskStateProtection } from './taskStateProtection.js';

/**
 * Protected task update with atomic state preservation
 */
export async function updateBuildTaskProtected(
  taskId: string,
  updates: ShapeBuildTaskRecordUpdate,
  abortSignal?: AbortSignal
): Promise<void> {
  try {
    // Use atomic update with rollback capability
    await taskStateProtection.atomicTaskUpdate(taskId, updates, abortSignal);
  } catch (error) {
    // Log the error but don't throw if it's an abort error
    if (abortSignal?.aborted) {
      console.info('[ProtectedTaskMutation] Task update aborted:', { taskId, updates });
      return;
    }

    console.error('[ProtectedTaskMutation] Task update failed:', { taskId, updates, error });
    throw error;
  }
}

/**
 * Batch update multiple tasks with state protection
 */
export async function updateBuildTasksBatch(
  updates: Array<{ taskId: string; updates: ShapeBuildTaskRecordUpdate }>,
  abortSignal?: AbortSignal
): Promise<void> {
  const results: Array<{ taskId: string; success: boolean; error?: Error }> = [];

  for (const { taskId, updates: taskUpdates } of updates) {
    try {
      if (abortSignal?.aborted) {
        console.info('[ProtectedTaskMutation] Batch update aborted at task:', taskId);
        break;
      }

      await updateBuildTaskProtected(taskId, taskUpdates, abortSignal);
      results.push({ taskId, success: true });
    } catch (error) {
      results.push({ taskId, success: false, error: error as Error });
      console.error('[ProtectedTaskMutation] Batch update failed for task:', { taskId, error });
    }
  }

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    console.warn('[ProtectedTaskMutation] Batch update completed with failures:', {
      total: updates.length,
      failed: failed.length,
      failures: failed.map((f) => ({ taskId: f.taskId, error: f.error?.message })),
    });
  }
}

/**
 * Ensure task state consistency for a session
 */
export async function ensureSessionTaskConsistency(nodeId: NodeId): Promise<void> {
  try {
    const validationResults = await taskStateProtection.verifySessionTaskStates(nodeId);

    if (validationResults.length > 0) {
      console.error('[ProtectedTaskMutation] Session has inconsistent task states:', {
        nodeId,
        issues: validationResults,
      });

      // Attempt to restore from snapshots
      const tasks = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray();
      let restoredCount = 0;

      for (const task of tasks) {
        const restored = await taskStateProtection.restoreTaskFromSnapshot(task.taskId);
        if (restored) {
          restoredCount++;
        }
      }

      if (restoredCount > 0) {
        console.info('[ProtectedTaskMutation] Restored tasks from snapshots:', {
          nodeId,
          restoredCount,
          totalTasks: tasks.length,
        });
      }
    }
  } catch (error) {
    console.error('[ProtectedTaskMutation] Failed to ensure task consistency:', { nodeId, error });
    throw error;
  }
}

/**
 * Mark task as started with state protection
 */
export async function markTaskStarted(taskId: string, abortSignal?: AbortSignal): Promise<void> {
  const updates: ShapeBuildTaskRecordUpdate = {
    status: 'running',
    startedAt: Date.now(),
  };

  await updateBuildTaskProtected(taskId, updates, abortSignal);
}

/**
 * Mark task as completed with state protection
 */
export async function markTaskCompleted(
  taskId: string,
  output?: any,
  abortSignal?: AbortSignal
): Promise<void> {
  const updates: ShapeBuildTaskRecordUpdate = {
    status: 'completed',
    completedAt: Date.now(),
    progress: 100,
    ...(output && { output }),
  };

  await updateBuildTaskProtected(taskId, updates, abortSignal);
}

/**
 * Mark task as failed with state protection.
 * Writes error.message to the top-level errorMessage field so that
 * taskMetadataProcessing and the UI summary builders can surface it directly.
 */
export async function markTaskFailed(
  taskId: string,
  error: Error,
  abortSignal?: AbortSignal
): Promise<void> {
  const updates: ShapeBuildTaskRecordUpdate = {
    status: 'failed',
    completedAt: Date.now(),
    errorMessage: error.message,
    metadata: {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        timestamp: Date.now(),
      },
    },
  };

  await updateBuildTaskProtected(taskId, updates, abortSignal);
}

/**
 * Update task progress with state protection
 */
export async function updateTaskProgress(
  taskId: string,
  progress: number,
  abortSignal?: AbortSignal
): Promise<void> {
  // Validate progress value (contract enforcement)
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new Error(
      `Invalid progress value: ${progress}. Must be finite number between 0 and 100.`
    );
  }

  const updates: ShapeBuildTaskRecordUpdate = {
    progress,
  };

  await updateBuildTaskProtected(taskId, updates, abortSignal);
}
