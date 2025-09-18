/**
 * Integration Test for Worker Initialization Notification System
 * Using mock workers for JSDOM environment
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkerInitializationChannel } from '../WorkerInitializationChannel.js';
import { WorkerInitializationReporter } from '../WorkerInitializationReporter.js';
import type { WorkerInitMessage } from '../types.js';

// Create a more complete MockWorker class
class MockWorker implements Partial<Worker> {
  private listeners: Map<string, Set<EventListener>> = new Map();
  private reporter: WorkerInitializationReporter | null = null;
  private initTimeout: ReturnType<typeof setTimeout> | null = null;
  public terminated = false;

  constructor() {
    // Simulate Worker-side reporter
    this.reporter = new WorkerInitializationReporter(
      [
        { name: 'Loading modules', weight: 30 },
        { name: 'Initializing database', weight: 40 },
        { name: 'Setting up API', weight: 30 },
      ],
      false, // debug off
    );
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(data: any): void {
    if (this.terminated) return;

    // Simulate Worker-side message handling
    setTimeout(() => {
      if (this.terminated) return;

      if (data.type === 'INIT_REQUEST') {
        this.simulateInitialization();
      } else if (data.type === 'PING') {
        this.sendToUI({
          type: 'PING_RESPONSE',
          payload: { timestamp: Date.now() },
        });
      } else if (data.type === 'START_INIT') {
        this.simulateInitialization();
      }
    }, 10);
  }

  private sendToUI(message: WorkerInitMessage): void {
    if (this.terminated) return;

    const event = new MessageEvent('message', { data: message });
    this.listeners.get('message')?.forEach(listener => {
      (listener as any)(event);
    });
  }

  private async simulateInitialization(): Promise<void> {
    if (this.terminated) return;

    // Send initial progress
    this.sendToUI({
      type: 'INIT_PROGRESS',
      payload: { progress: 0, message: 'Starting initialization...' },
    });

    // Simulate progress updates
    const steps = [
      { progress: 30, message: 'Loading modules' },
      { progress: 70, message: 'Initializing database' },
      { progress: 100, message: 'Setting up API' },
    ];

    for (const step of steps) {
      if (this.terminated) return;

      await new Promise(resolve => setTimeout(resolve, 50));

      this.sendToUI({
        type: 'INIT_PROGRESS',
        payload: {
          progress: step.progress,
          message: step.message,
          timestamp: Date.now(),
        },
      });
    }

    // Send completion
    if (!this.terminated) {
      this.sendToUI({
        type: 'INIT_COMPLETE',
        payload: {
          progress: 100,
          message: 'Worker initialized successfully',
          timestamp: Date.now(),
        },
      });
    }
  }

  simulateError(error: string): void {
    this.sendToUI({
      type: 'INIT_ERROR',
      payload: {
        error,
        timestamp: Date.now(),
      },
    });
  }

  terminate(): void {
    this.terminated = true;
    if (this.initTimeout) {
      clearTimeout(this.initTimeout);
    }
    this.listeners.clear();
  }
}

describe('Worker Initialization Integration Tests', () => {
  let worker: MockWorker;
  let channel: WorkerInitializationChannel;

  beforeEach(() => {
    worker = new MockWorker();
    channel = new WorkerInitializationChannel();
  });

  afterEach(() => {
    worker.terminate();
    channel.dispose();
  });

  describe('Basic Initialization Flow', () => {
    it('should successfully initialize with progress updates', async () => {
      const progressMessages: number[] = [];

      // Capture progress
      worker.addEventListener('message', (event: any) => {
        if (event.data.type === 'INIT_PROGRESS') {
          progressMessages.push(event.data.payload.progress);
        }
      });

      // Start initialization
      const result = await channel.waitForInitialization({
        worker: worker as unknown as Worker,
        timeout: 5000,
        debug: false,
      });

      // Verify result
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();

      // Verify progress updates were sent
      expect(progressMessages).toContain(0);
      expect(progressMessages).toContain(30);
      expect(progressMessages).toContain(70);
      expect(progressMessages).toContain(100);
    });

    it('should handle initialization timeout', async () => {
      // Create a worker that never completes initialization
      const slowWorker = new MockWorker();
      slowWorker.postMessage = () => {
        // Do nothing - simulate no response
      };

      try {
        await channel.waitForInitialization({
          worker: slowWorker as unknown as Worker,
          timeout: 500,
          debug: false,
        });

        // Should not reach here
        expect.fail('Should have timed out');
      } catch (result: any) {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('timeout');
      } finally {
        slowWorker.terminate();
      }
    });

    it('should handle worker initialization errors', async () => {
      // Schedule error after initialization request
      setTimeout(() => {
        worker.simulateError('Database connection failed');
      }, 50);

      try {
        await channel.waitForInitialization({
          worker: worker as unknown as Worker,
          timeout: 2000,
          debug: false,
        });

        // Should not reach here
        expect.fail('Should have failed with error');
      } catch (result: any) {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('Database connection failed');
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should prevent multiple simultaneous initialization attempts', async () => {
      const promise1 = channel.waitForInitialization({
        worker: worker as unknown as Worker,
        timeout: 5000,
        debug: false,
      });

      const promise2 = channel.waitForInitialization({
        worker: worker as unknown as Worker,
        timeout: 5000,
        debug: false,
      });

      // Should be the same promise instance
      expect(promise1).toBe(promise2);

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toEqual(result2);
      expect(result1.success).toBe(true);
    });
  });

  describe('Ping Functionality', () => {
    it('should support ping after initialization', async () => {
      // Initialize first
      await channel.waitForInitialization({
        worker: worker as unknown as Worker,
        timeout: 5000,
        debug: false,
      });

      // Test ping
      const pingResult = await channel.ping();
      expect(pingResult).toBe(true);
    });

    it('should return false for ping without worker', async () => {
      const emptyChannel = new WorkerInitializationChannel();
      const pingResult = await emptyChannel.ping();
      expect(pingResult).toBe(false);
    });
  });

  describe('Resource Cleanup', () => {
    it('should clean up event listeners on dispose', () => {
      const removeEventListenerSpy = vi.spyOn(worker, 'removeEventListener');

      channel.waitForInitialization({
        worker: worker as unknown as Worker,
        timeout: 5000,
        debug: false,
      });

      channel.dispose();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('should handle dispose during initialization', async () => {
      const initPromise = channel.waitForInitialization({
        worker: worker as unknown as Worker,
        timeout: 10000,
        debug: false,
      });

      // Dispose immediately
      channel.dispose();

      // Should still complete
      const result = await initPromise;
      expect(result.success).toBe(true);
    });
  });

  describe('Debug Mode', () => {
    it('should log debug messages when enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      await channel.waitForInitialization({
        worker: worker as unknown as Worker,
        timeout: 5000,
        debug: true,
      });

      // Check for debug logs
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WorkerInitChannel]'),
      );

      consoleSpy.mockRestore();
    });
  });
});
