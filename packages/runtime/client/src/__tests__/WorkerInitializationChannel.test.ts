/**
 * Test cases for WorkerInitializationChannel
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerInitializationChannel } from '../WorkerInitializationChannel.js';
import type { WorkerInitConfig } from '../types.js';

// Mock Worker class
class MockWorker {
  private listeners: Map<string, Set<(event: MessageEvent) => void>> = new Map();

  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(handler);
  }

  postMessage(_data: any) {
    // Mock implementation
  }

  // Helper method to simulate receiving a message
  simulateMessage(data: any) {
    const event = new MessageEvent('message', { data });
    this.listeners.get('message')?.forEach(handler => handler(event));
  }
}

describe('WorkerInitializationChannel', () => {
  let channel: WorkerInitializationChannel;
  let mockWorker: MockWorker;

  beforeEach(() => {
    channel = new WorkerInitializationChannel();
    mockWorker = new MockWorker() as unknown as MockWorker;
    vi.useFakeTimers();
  });

  afterEach(() => {
    channel.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('正常系', () => {
    it('should successfully detect worker initialization completion', async () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
        timeout: 5000,
      };

      const initPromise = channel.waitForInitialization(config);

      // Simulate initialization complete message
      mockWorker.simulateMessage({
        type: 'INIT_COMPLETE',
        payload: { progress: 100, message: 'Ready' },
      });

      const result = await initPromise;
      expect(result.success).toBe(true);
      expect(result.duration).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should handle progress updates during initialization', async () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
        timeout: 5000,
        debug: true,
      };

      const consoleSpy = vi.spyOn(console, 'log');
      const initPromise = channel.waitForInitialization(config);

      // Simulate progress updates
      mockWorker.simulateMessage({
        type: 'INIT_PROGRESS',
        payload: { progress: 25, message: 'Loading modules' },
      });

      mockWorker.simulateMessage({
        type: 'INIT_PROGRESS',
        payload: { progress: 50, message: 'Initializing database' },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Progress: 25%'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Progress: 50%'),
      );

      // Complete initialization
      mockWorker.simulateMessage({ type: 'INIT_COMPLETE' });
      await initPromise;
    });

    it('should resolve with correct duration on success', async () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
        timeout: 5000,
      };

      const initPromise = channel.waitForInitialization(config);

      // Advance timer by 1 second
      vi.advanceTimersByTime(1000);

      mockWorker.simulateMessage({ type: 'INIT_COMPLETE' });
      const result = await initPromise;

      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(1000);
    });

    it('should respond to ping requests', async () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
      };

      await channel.waitForInitialization(config);
      const pingPromise = channel.ping();

      mockWorker.simulateMessage({ type: 'PING_RESPONSE' });

      const result = await pingPromise;
      expect(result).toBe(true);
    });
  });

  describe('異常系', () => {
    it('should timeout after specified duration', async () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
        timeout: 3000,
      };

      const initPromise = channel.waitForInitialization(config);

      // Advance timer past timeout
      vi.advanceTimersByTime(3001);

      await expect(initPromise).rejects.toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: expect.stringContaining('timeout'),
        }),
      });
    });

    it('should handle worker initialization errors', async () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
        timeout: 5000,
      };

      const initPromise = channel.waitForInitialization(config);

      mockWorker.simulateMessage({
        type: 'INIT_ERROR',
        payload: { error: 'Database connection failed' },
      });

      await expect(initPromise).rejects.toMatchObject({
        success: false,
        error: expect.objectContaining({
          message: 'Database connection failed',
        }),
      });
    });

    it('should cleanup event listeners on timeout', async () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
        timeout: 1000,
      };

      const removeEventListenerSpy = vi.spyOn(mockWorker, 'removeEventListener');
      const initPromise = channel.waitForInitialization(config);

      vi.advanceTimersByTime(1001);

      try {
        await initPromise;
      } catch {
        // Expected to fail
      }

      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('エッジケース', () => {
    it('should prevent multiple simultaneous initialization attempts', async () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
      };

      const promise1 = channel.waitForInitialization(config);
      const promise2 = channel.waitForInitialization(config);

      // Both should return the same promise
      expect(promise1).toBe(promise2);

      mockWorker.simulateMessage({ type: 'INIT_COMPLETE' });

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toEqual(result2);
    });

    it('should handle late initialization requests', async () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
      };

      const postMessageSpy = vi.spyOn(mockWorker, 'postMessage');

      // Start initialization
      channel.waitForInitialization(config);

      expect(postMessageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'INIT_REQUEST' }),
      );
    });

    it('should properly cleanup on dispose', () => {
      const config: WorkerInitConfig = {
        worker: mockWorker as unknown as Worker,
      };

      channel.waitForInitialization(config);
      const removeEventListenerSpy = vi.spyOn(mockWorker, 'removeEventListener');

      channel.dispose();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });
});
