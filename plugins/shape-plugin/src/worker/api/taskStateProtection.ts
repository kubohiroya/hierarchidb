/**
 * Task State Protection Service
 * 
 * Ensures task state preservation during AbortController termination
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { TaskQueueRecord } from '@hierarchidb/build-api';
import { ephemeralDB } from '@hierarchidb/gis-sdk';

export interface TaskStateSnapshot {
  taskId: string;
  nodeId: NodeId;
  status: TaskQueueRecord['status'];
  inputData: TaskQueueRecord['inputData'];
  outputData: TaskQueueRecord['outputData'];
  startedAt: TaskQueueRecord['startedAt'];
  completedAt: TaskQueueRecord['completedAt'];
  progress: TaskQueueRecord['progress'];
  stage: TaskQueueRecord['stage'];
  version: TaskQueueRecord['version'];
  index: TaskQueueRecord['index'];
  metadata: TaskQueueRecord['metadata'];
}

export interface TaskStateValidationResult {
  isValid: boolean;
  inconsistencies: string[];
  missingFields: string[];
}

/**
 * Task State Protection Service
 * Handles atomic task state preservation during force termination
 */
export class TaskStateProtectionService {
  private snapshots = new Map<string, TaskStateSnapshot>();

  /**
   * Create a snapshot of current task state before potentially unsafe operations
   */
  async createTaskSnapshot(taskId: string): Promise<void> {
    try {
      const task = await ephemeralDB.buildTasks.get(taskId);
      if (!task) {
        console.warn('[TaskStateProtection] Task not found for snapshot:', taskId);
        return;
      }

      const snapshot: TaskStateSnapshot = {
        taskId: task.taskId,
        nodeId: task.nodeId,
        status: task.status,
        inputData: task.inputData,
        outputData: task.outputData,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        progress: task.progress,
        stage: task.stage,
        version: task.version,
        index: task.index,
        metadata: task.metadata,
      };

      this.snapshots.set(taskId, snapshot);
      console.debug('[TaskStateProtection] Snapshot created:', { taskId, status: task.status });
    } catch (error) {
      console.error('[TaskStateProtection] Failed to create snapshot:', { taskId, error });
      throw error;
    }
  }

  /**
   * Restore task state from snapshot if current state is inconsistent
   */
  async restoreTaskFromSnapshot(taskId: string): Promise<boolean> {
    const snapshot = this.snapshots.get(taskId);
    if (!snapshot) {
      console.warn('[TaskStateProtection] No snapshot found for task:', taskId);
      return false;
    }

    try {
      const currentTask = await ephemeralDB.buildTasks.get(taskId);
      if (!currentTask) {
        // Task was deleted, restore from snapshot
        const restoreData = {
          taskId: snapshot.taskId,
          nodeId: snapshot.nodeId,
          status: snapshot.status,
          inputData: snapshot.inputData,
          outputData: snapshot.outputData,
          startedAt: snapshot.startedAt,
          completedAt: snapshot.completedAt,
          progress: snapshot.progress,
          stage: snapshot.stage,
          version: snapshot.version,
          index: snapshot.index,
          metadata: snapshot.metadata,
        };
        await ephemeralDB.buildTasks.put(restoreData);
        console.info('[TaskStateProtection] Task restored from snapshot:', taskId);
        return true;
      }

      // Validate current state consistency
      const validation = this.validateTaskState(currentTask);
      if (!validation.isValid) {
        // Restore from snapshot due to inconsistency
        const restoreUpdates = {
          status: snapshot.status,
          inputData: snapshot.inputData,
          outputData: snapshot.outputData,
          startedAt: snapshot.startedAt,
          completedAt: snapshot.completedAt,
          progress: snapshot.progress,
          stage: snapshot.stage,
          version: snapshot.version,
          index: snapshot.index,
          metadata: snapshot.metadata,
        };
        await ephemeralDB.buildTasks.update(taskId, restoreUpdates);
        console.warn('[TaskStateProtection] Task state restored due to inconsistency:', {
          taskId,
          inconsistencies: validation.inconsistencies,
          missingFields: validation.missingFields,
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('[TaskStateProtection] Failed to restore task from snapshot:', { taskId, error });
      throw error;
    }
  }

  /**
   * Validate task state consistency
   */
  validateTaskState(task: TaskQueueRecord): TaskStateValidationResult {
    const inconsistencies: string[] = [];
    const missingFields: string[] = [];

    // Check required fields
    if (!task.taskId) missingFields.push('taskId');
    if (!task.nodeId) missingFields.push('nodeId');
    if (!task.status) missingFields.push('status');
    if (!task.stage) missingFields.push('stage');

    // Check progress consistency
    if (!Number.isFinite(task.progress) || task.progress < 0 || task.progress > 100) {
      inconsistencies.push(`invalid progress value: ${task.progress}`);
    }

    // Note: startedAt and completedAt are optional fields in the actual schema
    // Only validate timestamp consistency if both fields are present
    if (task.startedAt && task.completedAt && task.startedAt > task.completedAt) {
      inconsistencies.push('startedAt is after completedAt');
    }

    return {
      isValid: inconsistencies.length === 0 && missingFields.length === 0,
      inconsistencies,
      missingFields,
    };
  }

  /**
   * Ensure atomic task state update with rollback capability
   */
  async atomicTaskUpdate(
    taskId: string,
    updates: Partial<TaskQueueRecord>,
    abortSignal?: AbortSignal
  ): Promise<void> {
    // Create snapshot before update
    await this.createTaskSnapshot(taskId);

    try {
      // Check for abort before update
      if (abortSignal?.aborted) {
        throw new Error('Operation aborted before task update');
      }

      // Perform atomic update
      await ephemeralDB.buildTasks.update(taskId, updates);

      // Verify update success
      const updatedTask = await ephemeralDB.buildTasks.get(taskId);
      if (!updatedTask) {
        throw new Error('Task disappeared after update');
      }

      const validation = this.validateTaskState(updatedTask);
      if (!validation.isValid) {
        throw new Error(`Task state became invalid after update: ${validation.inconsistencies.join(', ')}`);
      }

      console.debug('[TaskStateProtection] Atomic update successful:', { taskId, updates });
    } catch (error) {
      // Restore from snapshot on failure
      console.warn('[TaskStateProtection] Update failed, restoring from snapshot:', { taskId, error });
      await this.restoreTaskFromSnapshot(taskId);
      throw error;
    }
  }

  /**
   * Verify all tasks in session have consistent state
   */
  async verifySessionTaskStates(nodeId: NodeId): Promise<TaskStateValidationResult[]> {
    try {
      const tasks = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray();
      const results: TaskStateValidationResult[] = [];

      for (const task of tasks) {
        const validation = this.validateTaskState(task);
        if (!validation.isValid) {
          results.push({
            ...validation,
            inconsistencies: [`Task ${task.taskId}: ${validation.inconsistencies.join(', ')}`],
          });
        }
      }

      if (results.length > 0) {
        console.warn('[TaskStateProtection] Session has inconsistent task states:', {
          nodeId,
          invalidTasks: results.length,
          totalTasks: tasks.length,
        });
      }

      return results;
    } catch (error) {
      console.error('[TaskStateProtection] Failed to verify session task states:', { nodeId, error });
      throw error;
    }
  }

  /**
   * Clean up snapshots for completed session
   */
  clearSnapshots(nodeId: NodeId): void {
    let count = 0;
    for (const [taskId, snapshot] of this.snapshots.entries()) {
      if (snapshot.nodeId === nodeId) {
        this.snapshots.delete(taskId);
        count++;
      }
    }
    console.debug('[TaskStateProtection] Snapshots cleared for session:', { nodeId, count });
  }
}

// Singleton instance
export const taskStateProtection = new TaskStateProtectionService();