/**
 * Property tests for task state preservation on termination
 * Validates Requirements 1.4
 */

import fc from 'fast-check';
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import type { NodeId } from '@hierarchidb/core-types';
import type { TaskStatus } from '@hierarchidb/build-api';
import { ephemeralDB } from '@hierarchidb/gis-sdk';
import { taskStateProtection } from '../../worker/api/taskStateProtection.js';
import {
  updateBuildTaskProtected,
  updateTaskProgress,
  ensureSessionTaskConsistency,
} from '../../worker/api/protectedTaskMutation.js';

// Mock task creation helper
const createMockTask = (taskId: string, nodeId: NodeId, status: TaskStatus, progress: number) => ({
  taskId,
  nodeId,
  status,
  progress,
  stage: 'source' as const,
  version: 1,
  index: 0,
  inputData: { sourceId: 'test-source' },
  outputData: status === 'completed' ? { result: 'test-output' } : undefined,
  startedAt: status !== 'queued' ? Date.now() - 1000 : undefined,
  completedAt: status === 'completed' || status === 'failed' ? Date.now() : undefined,
  metadata: {},
});

describe('Property 3: Task State Preservation on Termination', () => {
  beforeEach(async () => {
    await ephemeralDB.delete();
    await ephemeralDB.open();
  });

  afterEach(async () => {
    await ephemeralDB.delete();
  });

  it('should preserve all task state fields during abort', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s as NodeId),
        fc.constantFrom('queued', 'running', 'completed', 'failed'),
        fc.integer({ min: 0, max: 100 }),
        async (nodeId: NodeId, status: TaskStatus, progress: number) => {
          const taskId = `task-${Date.now()}-${Math.random()}`;
          const originalTask = createMockTask(taskId, nodeId, status, progress);

          // Store original task
          await ephemeralDB.buildTasks.put(originalTask);

          // Create snapshot before potential abort
          await taskStateProtection.createTaskSnapshot(taskId);

          // Simulate abort during update
          const abortController = new AbortController();

          try {
            // Start an update operation
            const updatePromise = updateBuildTaskProtected(
              taskId,
              { progress: Math.min(progress + 10, 100) },
              abortController.signal
            );

            // Abort immediately
            abortController.abort();

            // Wait for update to complete or abort
            await updatePromise;
          } catch (error) {
            // Abort errors are expected
            if (!abortController.signal.aborted) {
              throw error;
            }
          }

          // Verify task state is preserved
          const taskAfterAbort = await ephemeralDB.buildTasks.get(taskId);
          expect(taskAfterAbort).toBeDefined();

          // All critical fields should be preserved
          expect(taskAfterAbort!.taskId).toBe(originalTask.taskId);
          expect(taskAfterAbort!.nodeId).toBe(originalTask.nodeId);
          expect(taskAfterAbort!.status).toBe(originalTask.status);
          expect(taskAfterAbort!.stage).toBe(originalTask.stage);
          expect(taskAfterAbort!.version).toBe(originalTask.version);
          expect(taskAfterAbort!.index).toBe(originalTask.index);

          // Input/output should be preserved
          expect(taskAfterAbort!.inputData).toEqual(originalTask.inputData);
          if (originalTask.outputData) {
            expect(taskAfterAbort!.outputData).toEqual(originalTask.outputData);
          }

          // Timestamps should be preserved
          expect(taskAfterAbort!.startedAt).toBe(originalTask.startedAt);
          expect(taskAfterAbort!.completedAt).toBe(originalTask.completedAt);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain task state consistency during concurrent aborts', { timeout: 15000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s as NodeId),
        fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 3, maxLength: 8 }),
        async (nodeId: NodeId, progressValues: number[]) => {
          const tasks = progressValues.map((progress, i) =>
            createMockTask(`task-${i}`, nodeId, 'running', progress)
          );

          // Store all tasks
          await ephemeralDB.buildTasks.bulkPut(tasks);

          // Create snapshots for all tasks
          for (const task of tasks) {
            await taskStateProtection.createTaskSnapshot(task.taskId);
          }

          // Create multiple abort controllers
          const abortControllers = tasks.map(() => new AbortController());

          // Start concurrent updates
          const updatePromises = tasks.map((task, i) =>
            updateBuildTaskProtected(
              task.taskId,
              { progress: Math.min(task.progress + 5, 100) },
              abortControllers[i].signal
            ).catch(() => { }) // Ignore abort errors
          );

          // Abort all operations at different times
          for (let i = 0; i < abortControllers.length; i++) {
            setTimeout(() => abortControllers[i].abort(), i * 10);
          }

          // Wait for all operations to complete
          await Promise.all(updatePromises);

          // Verify session task consistency
          await ensureSessionTaskConsistency(nodeId);

          // All tasks should still exist and be valid
          const finalTasks = await ephemeralDB.buildTasks.where('nodeId').equals(nodeId).toArray();
          expect(finalTasks.length).toBe(tasks.length);

          // Validate each task state
          for (const finalTask of finalTasks) {
            const validation = taskStateProtection.validateTaskState(finalTask);
            expect(validation.isValid).toBe(true);

            if (!validation.isValid) {
              console.error('Task state validation failed:', {
                taskId: finalTask.taskId,
                inconsistencies: validation.inconsistencies,
                missingFields: validation.missingFields,
              });
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve terminal task states during abort', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s as NodeId),
        fc.constantFrom('completed', 'failed'),
        async (nodeId: NodeId, terminalStatus: TaskStatus) => {
          const taskId = `terminal-task-${Date.now()}`;
          const terminalTask = createMockTask(taskId, nodeId, terminalStatus, 100);

          // Store terminal task
          await ephemeralDB.buildTasks.put(terminalTask);

          // Create snapshot
          await taskStateProtection.createTaskSnapshot(taskId);

          // Attempt to modify terminal task during abort
          const abortController = new AbortController();
          abortController.abort(); // Pre-abort

          try {
            await updateBuildTaskProtected(
              taskId,
              { progress: 50 }, // Invalid update for terminal task
              abortController.signal
            );
          } catch (_error) {
            // Expected to fail due to abort
          }

          // Terminal task should remain unchanged
          const taskAfterAbort = await ephemeralDB.buildTasks.get(taskId);
          expect(taskAfterAbort).toBeDefined();
          expect(taskAfterAbort!.status).toBe(terminalStatus);
          expect(taskAfterAbort!.progress).toBe(100);
          expect(taskAfterAbort!.completedAt).toBe(terminalTask.completedAt);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle progress validation during abort', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s as NodeId),
        fc.oneof(
          fc.constant(Number.NaN),
          fc.constant(Number.POSITIVE_INFINITY),
          fc.constant(Number.NEGATIVE_INFINITY),
          fc.integer({ min: -100, max: -1 }),
          fc.integer({ min: 101, max: 200 })
        ),
        async (nodeId: NodeId, invalidProgress: number) => {
          const taskId = `progress-task-${Date.now()}`;
          const task = createMockTask(taskId, nodeId, 'running', 50);

          // Store task
          await ephemeralDB.buildTasks.put(task);

          // Create snapshot
          await taskStateProtection.createTaskSnapshot(taskId);

          // Attempt invalid progress update during abort
          const abortController = new AbortController();

          let errorThrown = false;
          try {
            await updateTaskProgress(taskId, invalidProgress, abortController.signal);
          } catch (_error) {
            errorThrown = true;
            // Should fail due to contract violation, not abort
            expect(_error).toBeInstanceOf(Error);
            expect((_error as Error).message).toContain('Invalid progress value');
          }

          // Contract violation should be detected regardless of abort
          expect(errorThrown).toBe(true);

          // Original task should be preserved
          const taskAfterError = await ephemeralDB.buildTasks.get(taskId);
          expect(taskAfterError).toBeDefined();
          expect(taskAfterError!.progress).toBe(50); // Original value preserved
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should restore from snapshots when state becomes inconsistent', { timeout: 15000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map(s => s as NodeId),
        fc.constantFrom('running', 'completed'),
        async (nodeId: NodeId, status: TaskStatus) => {
          const taskId = `restore-task-${Date.now()}`;
          const originalTask = createMockTask(taskId, nodeId, status, 75);

          // Store original task
          await ephemeralDB.buildTasks.put(originalTask);

          // Create snapshot
          await taskStateProtection.createTaskSnapshot(taskId);

          // Simulate corruption by directly modifying database
          await ephemeralDB.buildTasks.update(taskId, {
            status: 'completed',
            completedAt: undefined, // Inconsistent state
            progress: Number.NaN, // Invalid progress
          });

          // Verify corruption
          const corruptedTask = await ephemeralDB.buildTasks.get(taskId);
          const validation = taskStateProtection.validateTaskState(corruptedTask!);
          expect(validation.isValid).toBe(false);

          // Restore from snapshot
          const restored = await taskStateProtection.restoreTaskFromSnapshot(taskId);
          expect(restored).toBe(true);

          // Verify restoration
          const restoredTask = await ephemeralDB.buildTasks.get(taskId);
          expect(restoredTask).toBeDefined();

          const restoredValidation = taskStateProtection.validateTaskState(restoredTask!);
          expect(restoredValidation.isValid).toBe(true);

          // Should match original state
          expect(restoredTask!.status).toBe(originalTask.status);
          expect(restoredTask!.progress).toBe(originalTask.progress);
          expect(restoredTask!.completedAt).toBe(originalTask.completedAt);
        }
      ),
      { numRuns: 100 }
    );
  });
});