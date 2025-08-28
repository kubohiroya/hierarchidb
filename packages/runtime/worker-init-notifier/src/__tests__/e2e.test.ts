/**
 * E2E Test for Worker Initialization Notification System
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkerInitializationChannel } from '../WorkerInitializationChannel';
import { WorkerInitializationReporter } from '../WorkerInitializationReporter';
import type { InitializationStep, WorkerInitMessage } from '../types';

// Create a real Worker script as a Blob
const createTestWorkerScript = () => {
  const workerCode = `
    // Worker-side code
    class WorkerInitializationReporter {
      constructor() {
        this.isInitialized = false;
        this.currentProgress = 0;
        this.setupMessageListener();
      }

      setupMessageListener() {
        self.addEventListener('message', (event) => {
          const request = event.data;
          
          if (request.type === 'INIT_REQUEST') {
            this.reportCurrentStatus();
          } else if (request.type === 'PING') {
            this.sendMessage('PING_RESPONSE', { timestamp: Date.now() });
          } else if (request.type === 'START_INIT') {
            // Start initialization sequence
            this.performInitialization();
          }
        });
      }

      async performInitialization() {
        try {
          // Step 1: Loading
          this.sendMessage('INIT_PROGRESS', {
            progress: 0,
            message: 'Starting initialization...',
          });
          await this.delay(100);

          // Step 2: Setup
          this.sendMessage('INIT_PROGRESS', {
            progress: 33,
            message: 'Setting up worker...',
          });
          await this.delay(100);

          // Step 3: Preparing
          this.sendMessage('INIT_PROGRESS', {
            progress: 66,
            message: 'Preparing API...',
          });
          await this.delay(100);

          // Step 4: Complete
          this.sendMessage('INIT_PROGRESS', {
            progress: 100,
            message: 'Almost ready...',
          });
          await this.delay(50);

          // Mark as complete
          this.isInitialized = true;
          this.currentProgress = 100;
          this.sendMessage('INIT_COMPLETE', {
            progress: 100,
            message: 'Worker initialized successfully',
          });
        } catch (error) {
          this.sendMessage('INIT_ERROR', {
            error: error.message || 'Initialization failed',
          });
        }
      }

      delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

      reportCurrentStatus() {
        if (this.isInitialized) {
          this.sendMessage('INIT_COMPLETE', {
            progress: 100,
            message: 'Worker initialized successfully',
          });
        } else {
          this.sendMessage('INIT_PROGRESS', {
            progress: this.currentProgress,
            message: 'Initializing...',
          });
        }
      }

      sendMessage(type, payload) {
        self.postMessage({
          type,
          payload: {
            ...payload,
            timestamp: Date.now(),
          },
        });
      }
    }

    // Create reporter instance
    const reporter = new WorkerInitializationReporter();
    
    // Log that worker is ready
    console.log('[TestWorker] Worker script loaded and reporter created');
  `;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return URL.createObjectURL(blob);
};

describe('Worker Initialization E2E Tests', () => {
  let worker: Worker;
  let workerUrl: string;
  let channel: WorkerInitializationChannel;

  beforeEach(() => {
    // Create worker URL
    workerUrl = createTestWorkerScript();
    // Create actual Worker
    worker = new Worker(workerUrl);
    // Create channel
    channel = new WorkerInitializationChannel();
  });

  afterEach(() => {
    // Cleanup
    if (worker) {
      worker.terminate();
    }
    if (channel) {
      channel.dispose();
    }
    if (workerUrl) {
      URL.revokeObjectURL(workerUrl);
    }
  });

  it('should complete full initialization flow with progress updates', async () => {
    const progressUpdates: WorkerInitMessage[] = [];
    
    // Intercept progress messages
    worker.addEventListener('message', (event) => {
      if (event.data.type === 'INIT_PROGRESS') {
        progressUpdates.push(event.data);
      }
    });

    // Start initialization in parallel
    const initPromise = channel.waitForInitialization({
      worker,
      timeout: 5000,
      debug: true,
    });

    // Trigger initialization after channel is listening
    await new Promise(resolve => setTimeout(resolve, 100));
    worker.postMessage({ type: 'START_INIT' });

    // Wait for initialization to complete
    const result = await initPromise;

    // Verify result
    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();

    // Verify we received progress updates
    expect(progressUpdates.length).toBeGreaterThan(0);
    
    // Verify progress values are increasing
    const progressValues = progressUpdates.map(u => u.payload?.progress || 0);
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
    }
  }, 10000);

  it('should handle initialization timeout', async () => {
    // Don't trigger initialization
    const initPromise = channel.waitForInitialization({
      worker,
      timeout: 500, // Short timeout
      debug: false,
    });

    // Should timeout
    await expect(initPromise).rejects.toMatchObject({
      success: false,
      error: expect.objectContaining({
        message: expect.stringContaining('timeout'),
      }),
    });
  });

  it('should handle worker errors during initialization', async () => {
    // Create a worker that will error
    const errorWorkerCode = `
      self.addEventListener('message', (event) => {
        if (event.data.type === 'INIT_REQUEST') {
          // Immediately send error
          self.postMessage({
            type: 'INIT_ERROR',
            payload: {
              error: 'Simulated initialization error',
              timestamp: Date.now(),
            },
          });
        }
      });
    `;

    const errorBlob = new Blob([errorWorkerCode], { type: 'application/javascript' });
    const errorUrl = URL.createObjectURL(errorBlob);
    const errorWorker = new Worker(errorUrl);

    try {
      const result = await channel.waitForInitialization({
        worker: errorWorker,
        timeout: 2000,
        debug: false,
      });
      
      // Should not reach here
      expect(result.success).toBe(false);
    } catch (error: any) {
      expect(error.success).toBe(false);
      expect(error.error?.message).toContain('Simulated initialization error');
    } finally {
      errorWorker.terminate();
      URL.revokeObjectURL(errorUrl);
    }
  });

  it('should support ping functionality after initialization', async () => {
    // Initialize worker first
    worker.postMessage({ type: 'START_INIT' });
    
    await channel.waitForInitialization({
      worker,
      timeout: 5000,
      debug: false,
    });

    // Test ping
    const pingResult = await channel.ping();
    expect(pingResult).toBe(true);
  });

  it('should handle concurrent initialization requests', async () => {
    // Start multiple initialization requests
    const promise1 = channel.waitForInitialization({
      worker,
      timeout: 5000,
      debug: false,
    });

    const promise2 = channel.waitForInitialization({
      worker,
      timeout: 5000,
      debug: false,
    });

    // Should return the same promise
    expect(promise1).toBe(promise2);

    // Trigger initialization
    worker.postMessage({ type: 'START_INIT' });

    // Both should resolve with the same result
    const [result1, result2] = await Promise.all([promise1, promise2]);
    expect(result1).toEqual(result2);
    expect(result1.success).toBe(true);
  });

  it('should properly clean up resources on dispose', async () => {
    const initPromise = channel.waitForInitialization({
      worker,
      timeout: 10000,
      debug: false,
    });

    // Dispose before completion
    channel.dispose();

    // Worker should still be functional
    worker.postMessage({ type: 'PING' });
    
    // Create a new channel
    const newChannel = new WorkerInitializationChannel();
    
    // Should be able to initialize with new channel
    worker.postMessage({ type: 'START_INIT' });
    
    const result = await newChannel.waitForInitialization({
      worker,
      timeout: 5000,
      debug: false,
    });

    expect(result.success).toBe(true);
    
    newChannel.dispose();
  });
});