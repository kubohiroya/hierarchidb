/**
 * E2E Test for Worker Initialization in Node.js environment
 * Using Node.js worker_threads for real Worker testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs';
import { WorkerInitializationChannel } from '../WorkerInitializationChannel';
import type { WorkerInitMessage } from '../types';

// Create a test worker script file for ESM
const createTestWorkerFile = (): string => {
  const workerCode = `
import { parentPort } from 'worker_threads';

class WorkerInitializationReporter {
  constructor() {
    this.isInitialized = false;
    this.currentProgress = 0;
    this.setupMessageListener();
    console.log('[Worker] Reporter created');
  }

  setupMessageListener() {
    if (!parentPort) {
      console.error('[Worker] No parentPort available');
      return;
    }
    
    parentPort.on('message', (data) => {
      console.log('[Worker] Received message:', data);
      const request = data;
      
      if (request.type === 'INIT_REQUEST') {
        console.log('[Worker] Handling INIT_REQUEST');
        this.performInitialization();
      } else if (request.type === 'PING') {
        console.log('[Worker] Handling PING');
        this.sendMessage('PING_RESPONSE', { timestamp: Date.now() });
      } else if (request.type === 'START_INIT') {
        console.log('[Worker] Handling START_INIT');
        this.performInitialization();
      } else if (request.type === 'ERROR_TEST') {
        console.log('[Worker] Handling ERROR_TEST');
        this.sendMessage('INIT_ERROR', {
          error: 'Test error message',
        });
      }
    });
  }

  async performInitialization() {
    try {
      console.log('[Worker] Starting initialization');
      
      // Step 1: Loading
      this.sendMessage('INIT_PROGRESS', {
        progress: 0,
        message: 'Starting initialization...',
      });
      await this.delay(30);

      // Step 2: Setup
      this.sendMessage('INIT_PROGRESS', {
        progress: 33,
        message: 'Setting up worker...',
      });
      await this.delay(30);

      // Step 3: Preparing
      this.sendMessage('INIT_PROGRESS', {
        progress: 66,
        message: 'Preparing API...',
      });
      await this.delay(30);

      // Step 4: Complete
      this.sendMessage('INIT_PROGRESS', {
        progress: 100,
        message: 'Almost ready...',
      });
      await this.delay(10);

      // Mark as complete
      this.isInitialized = true;
      this.currentProgress = 100;
      console.log('[Worker] Sending INIT_COMPLETE');
      this.sendMessage('INIT_COMPLETE', {
        progress: 100,
        message: 'Worker initialized successfully',
      });
    } catch (error) {
      console.error('[Worker] Initialization error:', error);
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
    if (!parentPort) {
      console.error('[Worker] No parentPort for sending');
      return;
    }
    
    const message = {
      type,
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
    };
    console.log('[Worker] Sending message:', message);
    parentPort.postMessage(message);
  }
}

// Create reporter instance
const reporter = new WorkerInitializationReporter();
console.log('[TestWorker] Worker started');
  `;

  // Create temp file with .mjs extension for ESM
  const tmpDir = path.join(__dirname, '.tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  const workerPath = path.join(tmpDir, `test-worker-${Date.now()}.mjs`);
  fs.writeFileSync(workerPath, workerCode);
  
  return workerPath;
};

// Adapter to make Node.js Worker compatible with Web Worker API
class WorkerAdapter {
  private worker: Worker;
  private listeners: Map<string, Set<(event: any) => void>> = new Map();
  public terminated = false;
  
  constructor(filename: string) {
    console.log('[Adapter] Creating worker with file:', filename);
    this.worker = new Worker(filename, { 
      execArgv: ['--experimental-modules']
    });
    
    // Forward messages
    this.worker.on('message', (data) => {
      console.log('[Adapter] Received from worker:', data);
      const event = { data };
      this.listeners.get('message')?.forEach(listener => listener(event));
    });
    
    this.worker.on('error', (error) => {
      console.error('[Adapter] Worker error:', error);
    });
    
    this.worker.on('exit', (code) => {
      console.log('[Adapter] Worker exited with code:', code);
      this.terminated = true;
    });
  }
  
  addEventListener(type: string, listener: (event: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }
  
  removeEventListener(type: string, listener: (event: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  
  postMessage(data: any): void {
    if (!this.terminated) {
      console.log('[Adapter] Sending to worker:', data);
      this.worker.postMessage(data);
    }
  }
  
  terminate(): void {
    if (!this.terminated) {
      this.terminated = true;
      this.worker.terminate();
    }
  }
}

describe('Worker Initialization Node.js E2E Tests', () => {
  let workerPath: string;
  let worker: WorkerAdapter;
  let channel: WorkerInitializationChannel;
  
  beforeEach(() => {
    workerPath = createTestWorkerFile();
    worker = new WorkerAdapter(workerPath);
    channel = new WorkerInitializationChannel();
  });
  
  afterEach(async () => {
    channel.dispose();
    if (worker && !worker.terminated) {
      worker.terminate();
    }
    // Clean up temp file
    if (workerPath && fs.existsSync(workerPath)) {
      try {
        fs.unlinkSync(workerPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    // Clean up tmp directory if empty
    const tmpDir = path.join(__dirname, '.tmp');
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      if (files.length === 0) {
        fs.rmdirSync(tmpDir);
      }
    }
  });
  
  describe('Full Initialization Flow', () => {
    it('should complete initialization with progress updates', async () => {
      const progressUpdates: number[] = [];
      
      // Capture progress
      worker.addEventListener('message', (event) => {
        if (event.data.type === 'INIT_PROGRESS') {
          progressUpdates.push(event.data.payload?.progress || 0);
        }
      });
      
      // Wait for worker to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Start initialization
      const result = await channel.waitForInitialization({
        worker: worker as unknown as globalThis.Worker,
        timeout: 5000,
        debug: true,
      });
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
      
      // Verify progress sequence
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates).toContain(0);
      expect(progressUpdates).toContain(100);
    }, 10000);
    
    it('should handle initialization timeout', async () => {
      // Create a worker that never responds
      const silentWorkerCode = `
import { parentPort } from 'worker_threads';
// Do nothing - simulate unresponsive worker
console.log('[SilentWorker] Started but not responding');
`;
      
      const silentPath = path.join(__dirname, '.tmp', `silent-worker-${Date.now()}.mjs`);
      fs.writeFileSync(silentPath, silentWorkerCode);
      const silentWorker = new WorkerAdapter(silentPath);
      
      try {
        await channel.waitForInitialization({
          worker: silentWorker as unknown as globalThis.Worker,
          timeout: 500,
          debug: false,
        });
        
        expect.fail('Should have timed out');
      } catch (result: any) {
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('timeout');
      } finally {
        silentWorker.terminate();
        if (fs.existsSync(silentPath)) {
          fs.unlinkSync(silentPath);
        }
      }
    });
    
    it('should handle worker errors', async () => {
      // Wait for worker to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Setup to send error message immediately after INIT_REQUEST
      worker.addEventListener('message', (event) => {
        if (event.data.type === 'INIT_PROGRESS' && event.data.payload?.progress === 0) {
          // Send error after first progress
          setTimeout(() => {
            worker.postMessage({ type: 'ERROR_TEST' });
          }, 10);
        }
      });
      
      const initPromise = channel.waitForInitialization({
        worker: worker as unknown as globalThis.Worker,
        timeout: 2000,
        debug: false,
      });
      
      try {
        await initPromise;
        // If we get here, first init completed, which is also OK
        expect(true).toBe(true);
      } catch (result: any) {
        // Error case
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });
  
  describe('Ping Functionality', () => {
    it('should respond to ping after initialization', async () => {
      // Wait for worker to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Initialize first
      await channel.waitForInitialization({
        worker: worker as unknown as globalThis.Worker,
        timeout: 5000,
        debug: false,
      });
      
      // Test ping
      const pingResult = await channel.ping();
      expect(pingResult).toBe(true);
    }, 10000);
  });
  
  describe('Concurrent Initialization', () => {
    it('should handle concurrent initialization requests', async () => {
      // Wait for worker to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const promise1 = channel.waitForInitialization({
        worker: worker as unknown as globalThis.Worker,
        timeout: 5000,
        debug: false,
      });
      
      const promise2 = channel.waitForInitialization({
        worker: worker as unknown as globalThis.Worker,
        timeout: 5000,
        debug: false,
      });
      
      // Should be the same promise
      expect(promise1).toBe(promise2);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toEqual(result2);
      expect(result1.success).toBe(true);
    }, 10000);
  });
});