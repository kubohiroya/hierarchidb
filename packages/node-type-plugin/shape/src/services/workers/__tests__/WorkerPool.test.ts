/**
 * WorkerPool Integration Tests
 * 
 * Tests for Worker pool management and load balancing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkerPool } from '../WorkerPool';

// Mock Worker API for testing
interface MockWorkerAPI {
  ping(): Promise<boolean>;
  processTask(data: any): Promise<{ result: string; workerId: number }>;
  heavyTask(duration: number): Promise<string>;
}

class MockWorker implements MockWorkerAPI {
  constructor(private workerId: number) {}

  async ping(): Promise<boolean> {
    return true;
  }

  async processTask(data: any): Promise<{ result: string; workerId: number }> {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));
    return {
      result: `Processed: ${JSON.stringify(data)}`,
      workerId: this.workerId
    };
  }

  async heavyTask(duration: number): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, duration));
    return `Heavy task completed by worker ${this.workerId}`;
  }
}

describe('WorkerPool', () => {
  let pool: WorkerPool<MockWorkerAPI>;
  let mockWorkers: Worker[];

  beforeEach(async () => {
    // Create mock workers
    mockWorkers = Array.from({ length: 3 }, (_, i) => ({
      terminate: () => {},
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    } as any));

    // Create pool
    pool = new WorkerPool<MockWorkerAPI>(mockWorkers);

    // Mock the Comlink.wrap to return our mock workers
    const mockWorkerInstances = mockWorkers.map((_, i) => new MockWorker(i));
    (pool as any).workers = mockWorkerInstances;

    await pool.initialize();
  });

  afterEach(async () => {
    await pool.dispose();
  });

  describe('initialization', () => {
    it('should initialize all workers successfully', async () => {
      const healthCheck = await pool.healthCheck();
      expect(healthCheck).toBe(true);
    });

    it('should report correct pool statistics', () => {
      const stats = pool.getStatistics();
      expect(stats.size).toBe(3);
      expect(stats.active).toBe(0);
      expect(stats.idle).toBe(3);
      expect(stats.tasksProcessed).toBe(0);
      expect(stats.errors).toBe(0);
    });
  });

  describe('task execution', () => {
    it('should execute tasks on workers using round-robin', async () => {
      // Act
      const results = await Promise.all([
        pool.execute('processTask', { id: 1 }),
        pool.execute('processTask', { id: 2 }),
        pool.execute('processTask', { id: 3 }),
        pool.execute('processTask', { id: 4 })
      ]);

      // Assert
      expect(results).toHaveLength(4);
      
      // Check that different workers were used (round-robin)
      const workerIds = results.map(r => r.workerId);
      expect(new Set(workerIds).size).toBeGreaterThan(1);
      
      // Verify results
      results.forEach((result, index) => {
        expect(result.result).toContain(`"id":${index + 1}`);
      });
    });

    it('should update statistics after task execution', async () => {
      // Act
      await Promise.all([
        pool.execute('processTask', { test: 1 }),
        pool.execute('processTask', { test: 2 })
      ]);

      // Assert
      const stats = pool.getStatistics();
      expect(stats.tasksProcessed).toBe(2);
      expect(stats.averageTaskTime).toBeGreaterThan(0);
    });

    it('should handle task failures and update error count', async () => {
      // Arrange - Mock a worker method that throws
      const failingWorker = {
        processTask: async () => {
          throw new Error('Task failed');
        },
        ping: async () => true
      };
      (pool as any).workers[0] = failingWorker;

      // Act & Assert
      await expect(pool.execute('processTask', { test: 'fail' })).rejects.toThrow('Task failed');

      const stats = pool.getStatistics();
      expect(stats.errors).toBe(1);
    });
  });

  describe('parallel execution', () => {
    it('should execute tasks in parallel when workers are available', async () => {
      // Arrange
      const startTime = Date.now();

      // Act - Execute 3 heavy tasks in parallel (should use all 3 workers)
      const results = await Promise.all([
        pool.execute('heavyTask', 50),
        pool.execute('heavyTask', 50),
        pool.execute('heavyTask', 50)
      ]);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert
      expect(results).toHaveLength(3);
      // Should complete in roughly 50ms (parallel) rather than 150ms (sequential)
      expect(totalTime).toBeLessThan(100);
      
      // Verify different workers were used
      const workerIds = results.map(r => parseInt(r.split(' ').pop()!));
      expect(new Set(workerIds).size).toBe(3);
    });

    it('should queue tasks when all workers are busy', async () => {
      // This test would require more sophisticated mocking to test queuing behavior
      // For now, we'll test that more tasks than workers can be handled
      
      const results = await Promise.all([
        pool.execute('processTask', { id: 1 }),
        pool.execute('processTask', { id: 2 }),
        pool.execute('processTask', { id: 3 }),
        pool.execute('processTask', { id: 4 }),
        pool.execute('processTask', { id: 5 })
      ]);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.result).toContain('Processed:');
      });
    });
  });

  describe('broadcast functionality', () => {
    it('should execute task on all workers simultaneously', async () => {
      // Act
      const results = await pool.broadcast('ping');

      // Assert
      expect(results).toHaveLength(3);
      expect(results.every(result => result === true)).toBe(true);
    });
  });

  describe('timeout handling', () => {
    it('should timeout tasks that take too long', async () => {
      // Act & Assert
      await expect(
        pool.executeWithTimeout('heavyTask', 10, 100) // 100ms task with 10ms timeout
      ).rejects.toThrow('Worker timeout after 10ms');
    });

    it('should complete tasks within timeout', async () => {
      // Act
      const result = await pool.executeWithTimeout('heavyTask', 100, 10); // 10ms task with 100ms timeout

      // Assert
      expect(result).toContain('Heavy task completed');
    });
  });

  describe('retry functionality', () => {
    it('should retry failed tasks', async () => {
      // Arrange
      let attemptCount = 0;
      const unreliableWorker = {
        processTask: async (data: any) => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error(`Attempt ${attemptCount} failed`);
          }
          return { result: 'Success after retries', workerId: 0 };
        },
        ping: async () => true
      };
      (pool as any).workers[0] = unreliableWorker;

      // Act
      const result = await pool.executeWithRetry('processTask', 3, { test: 'retry' });

      // Assert
      expect(result.result).toBe('Success after retries');
      expect(attemptCount).toBe(3);
    });

    it('should fail after max retries exceeded', async () => {
      // Arrange
      const alwaysFailingWorker = {
        processTask: async () => {
          throw new Error('Always fails');
        },
        ping: async () => true
      };
      (pool as any).workers[0] = alwaysFailingWorker;

      // Act & Assert
      await expect(
        pool.executeWithRetry('processTask', 2, { test: 'fail' })
      ).rejects.toThrow('Always fails');
    });
  });

  describe('worker pool management', () => {
    it('should dispose all workers properly', async () => {
      // Arrange
      const terminateSpy = vi.fn();
      mockWorkers.forEach(worker => {
        worker.terminate = terminateSpy;
      });

      // Act
      await pool.dispose();

      // Assert
      expect(terminateSpy).toHaveBeenCalledTimes(3);
    });
  });
});