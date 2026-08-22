/**
 * Property tests for no intermediate data persistence
 * Validates Requirements 7.1, 7.2, 7.3, 7.4
 */

import type { TaskStatus } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import {
  isNonTerminalStatus,
  isTerminalStatus,
  validateCacheWriteAllowed,
} from '../../worker/api/cacheWriteValidationConstants';

// Mock task queue for testing
const createMockTaskQueue = (): VtTaskQueueDb =>
  ({
    tasks: {
      get: vi.fn(),
    },
  }) as unknown as VtTaskQueueDb;

describe('Property 12: No Intermediate Persistence', () => {
  it('should prevent cache writes for running tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map((s) => s as NodeId),
        fc.constantFrom('running' as TaskStatus),
        fc.constantFrom('geometry', 'source'),
        async (nodeId: NodeId, status: TaskStatus, cacheType: 'geometry' | 'source') => {
          const taskId = `task-${nodeId}-${Math.random()}`;
          const mockTaskQueue = createMockTaskQueue();

          // Mock task with running status
          mockTaskQueue.tasks.get.mockResolvedValue({
            taskId,
            status,
            nodeId,
          });

          // Attempt to validate cache write should throw
          await expect(validateCacheWriteAllowed(mockTaskQueue, taskId, cacheType)).rejects.toThrow(
            /Cannot write.*cache.*task status is non-terminal/
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should prevent cache writes for queued tasks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map((s) => s as NodeId),
        fc.constantFrom('queued' as TaskStatus),
        fc.constantFrom('geometry', 'source'),
        async (nodeId: NodeId, status: TaskStatus, cacheType: 'geometry' | 'source') => {
          const taskId = `task-${nodeId}-${Math.random()}`;
          const mockTaskQueue = createMockTaskQueue();

          // Mock task with queued status
          mockTaskQueue.tasks.get.mockResolvedValue({
            taskId,
            status,
            nodeId,
          });

          // Attempt to validate cache write should throw
          await expect(validateCacheWriteAllowed(mockTaskQueue, taskId, cacheType)).rejects.toThrow(
            /Cannot write.*cache.*task status is non-terminal/
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should allow cache writes for terminal task statuses', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map((s) => s as NodeId),
        fc.constantFrom('completed', 'failed', 'recycled'),
        fc.constantFrom('geometry', 'source'),
        async (nodeId: NodeId, status: TaskStatus, cacheType: 'geometry' | 'source') => {
          const taskId = `task-${nodeId}-${Math.random()}`;
          const mockTaskQueue = createMockTaskQueue();

          // Mock task with terminal status
          mockTaskQueue.tasks.get.mockResolvedValue({
            taskId,
            status,
            nodeId,
          });

          // Validate cache write should not throw
          await expect(
            validateCacheWriteAllowed(mockTaskQueue, taskId, cacheType)
          ).resolves.toBeUndefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly classify terminal vs non-terminal statuses', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('completed', 'failed', 'recycled', 'running', 'queued'),
        (status: TaskStatus) => {
          const isTerminal = isTerminalStatus(status);
          const isNonTerminal = isNonTerminalStatus(status);

          // Status should be either terminal or non-terminal, but not both
          expect(isTerminal).not.toBe(isNonTerminal);

          // Verify correct classification
          if (status === 'completed' || status === 'failed' || status === 'recycled') {
            expect(isTerminal).toBe(true);
            expect(isNonTerminal).toBe(false);
          } else if (status === 'running' || status === 'queued') {
            expect(isTerminal).toBe(false);
            expect(isNonTerminal).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 13: Running Task Cache Invariant', () => {
  it('should maintain invariant that non-terminal tasks have no valid cache entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map((s) => s as NodeId),
        fc.constantFrom('running', 'queued'),
        async (nodeId: NodeId, status: TaskStatus) => {
          const taskId = `task-${nodeId}-${Math.random()}`;
          const mockTaskQueue = createMockTaskQueue();

          // Mock task with non-terminal status
          mockTaskQueue.tasks.get.mockResolvedValue({
            taskId,
            status,
            nodeId,
          });

          // Verify that cache write validation fails for non-terminal tasks
          await expect(
            validateCacheWriteAllowed(mockTaskQueue, taskId, 'geometry')
          ).rejects.toThrow();

          await expect(
            validateCacheWriteAllowed(mockTaskQueue, taskId, 'source')
          ).rejects.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle missing tasks appropriately', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 10 }).map((s) => s as NodeId),
        fc.constantFrom('geometry', 'source'),
        async (nodeId: NodeId, cacheType: 'geometry' | 'source') => {
          const taskId = `missing-task-${nodeId}-${Math.random()}`;
          const mockTaskQueue = createMockTaskQueue();

          // Mock task not found
          mockTaskQueue.tasks.get.mockResolvedValue(null);

          // Attempt to validate cache write should throw for missing task
          await expect(validateCacheWriteAllowed(mockTaskQueue, taskId, cacheType)).rejects.toThrow(
            /Cannot write.*cache.*task not found/
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});
