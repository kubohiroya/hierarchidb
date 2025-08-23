/**
 * WorkerPoolManager - Centralized management of all Worker pools for Shape plugin
 * 
 * Features:
 * - Manages 4 specialized worker pools (Download, Simplify1, Simplify2, VectorTile)
 * - Provides type-safe task execution methods
 * - Handles worker pool lifecycle and resource management
 * - Implements optimal pool sizing based on system capabilities
 * - Supports graceful shutdown and cleanup
 * - Single-session constraint: Only one batch processing session per node
 */

import * as Comlink from 'comlink';
import { NodeId } from '@hierarchidb/00-core';
import { WorkerPool } from './WorkerPool';
import type { 
  DownloadWorkerAPI,
  SimplifyWorker1API,
  SimplifyWorker2API,
  VectorTileWorkerAPI,
  DownloadTask,
  DownloadResult,
  Simplify1Task,
  Simplify1Result,
  Simplify2Task,
  Simplify2Result,
  VectorTileTask,
  VectorTileResult,
  ProcessingStage,
  TaskInfo,
  WorkerPoolConfig
} from '../types';

/**
 * Manages all Worker pools for shape processing pipeline
 */
export class WorkerPoolManager {
  private downloadWorkers: Worker[] = [];
  private simplify1Workers: Worker[] = [];
  private simplify2Workers: Worker[] = [];
  private vectorTileWorkers: Worker[] = [];
  private workerStatus: Map<Worker, 'idle' | 'busy' | 'error'> = new Map();
  private taskQueues: Map<ProcessingStage, TaskInfo[]> = new Map();
  private activeRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private config: WorkerPoolConfig;
  private isShuttingDown = false;

  constructor(config: WorkerPoolConfig) {
    this.config = config;
    this.initializeQueues();
  }

  private initializeQueues(): void {
    this.taskQueues.set('download', []);
    this.taskQueues.set('simplify1', []);
    this.taskQueues.set('simplify2', []);
    this.taskQueues.set('vectortile', []);
  }

  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.initializeDownloadWorkers(),
        this.initializeSimplify1Workers(),
        this.initializeSimplify2Workers(),
        this.initializeVectorTileWorkers(),
      ]);
      console.log('WorkerPoolManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WorkerPoolManager:', error);
      throw error;
    }
  }

  private async initializeDownloadWorkers(): Promise<void> {
    for (let i = 0; i < this.config.downloadWorkers; i++) {
      const worker = new Worker(new URL('./DownloadWorker.ts', import.meta.url), { type: 'module' });
      Comlink.wrap<DownloadWorkerAPI>(worker);
      
      this.downloadWorkers.push(worker);
      this.workerStatus.set(worker, 'idle');
      
      // Set up error handling
      worker.onerror = (error) => this.handleWorkerError(worker, error);
      worker.onmessageerror = (error) => this.handleWorkerMessageError(worker, error);
    }
  }

  private async initializeSimplify1Workers(): Promise<void> {
    for (let i = 0; i < this.config.simplify1Workers; i++) {
      const worker = new Worker(new URL('./SimplifyWorker1.ts', import.meta.url), { type: 'module' });
      Comlink.wrap<SimplifyWorker1API>(worker);
      
      this.simplify1Workers.push(worker);
      this.workerStatus.set(worker, 'idle');
      
      worker.onerror = (error) => this.handleWorkerError(worker, error);
      worker.onmessageerror = (error) => this.handleWorkerMessageError(worker, error);
    }
  }

  private async initializeSimplify2Workers(): Promise<void> {
    for (let i = 0; i < this.config.simplify2Workers; i++) {
      const worker = new Worker(new URL('./SimplifyWorker2.ts', import.meta.url), { type: 'module' });
      Comlink.wrap<SimplifyWorker2API>(worker);
      
      this.simplify2Workers.push(worker);
      this.workerStatus.set(worker, 'idle');
      
      worker.onerror = (error) => this.handleWorkerError(worker, error);
      worker.onmessageerror = (error) => this.handleWorkerMessageError(worker, error);
    }
  }

  private async initializeVectorTileWorkers(): Promise<void> {
    for (let i = 0; i < this.config.vectorTileWorkers; i++) {
      const worker = new Worker(new URL('./VectorTileWorker.ts', import.meta.url), { type: 'module' });
      Comlink.wrap<VectorTileWorkerAPI>(worker);
      
      this.vectorTileWorkers.push(worker);
      this.workerStatus.set(worker, 'idle');
      
      worker.onerror = (error) => this.handleWorkerError(worker, error);
      worker.onmessageerror = (error) => this.handleWorkerMessageError(worker, error);
    }
  }

  private handleWorkerError(worker: Worker, error: ErrorEvent): void {
    console.error('Worker error:', error);
    this.workerStatus.set(worker, 'error');
    
    // Find and reject any active requests for this worker
    for (const [requestId, request] of this.activeRequests) {
      if (this.isWorkerForRequest(worker, requestId)) {
        request.reject(new Error(`Worker error: ${error.message}`));
        clearTimeout(request.timeout);
        this.activeRequests.delete(requestId);
      }
    }
    
    // Restart worker if under threshold
    this.restartWorkerIfNeeded(worker);
  }

  private handleWorkerMessageError(worker: Worker, error: MessageEvent): void {
    console.error('Worker message error:', error);
    this.workerStatus.set(worker, 'error');
    
    // Find and reject any active requests for this worker
    for (const [requestId, request] of this.activeRequests) {
      if (this.isWorkerForRequest(worker, requestId)) {
        request.reject(new Error(`Worker message error`));
        clearTimeout(request.timeout);
        this.activeRequests.delete(requestId);
      }
    }
    
    // Restart worker if under threshold
    this.restartWorkerIfNeeded(worker);
  }

  private isWorkerForRequest(worker: Worker, requestId: string): boolean {
    // Simple check based on worker type and request ID pattern
    const [stage] = requestId.split('-');
    switch (stage) {
      case 'download':
        return this.downloadWorkers.includes(worker);
      case 'simplify1':
        return this.simplify1Workers.includes(worker);
      case 'simplify2':
        return this.simplify2Workers.includes(worker);
      case 'vectortile':
        return this.vectorTileWorkers.includes(worker);
      default:
        return false;
    }
  }

  private async restartWorkerIfNeeded(worker: Worker): Promise<void> {
    // Terminate the problematic worker
    worker.terminate();
    
    // Restart based on worker type
    if (this.downloadWorkers.includes(worker)) {
      const index = this.downloadWorkers.indexOf(worker);
      this.downloadWorkers.splice(index, 1);
      const newWorker = new Worker(new URL('./DownloadWorker.ts', import.meta.url), { type: 'module' });
      this.downloadWorkers.push(newWorker);
      this.workerStatus.delete(worker);
      this.workerStatus.set(newWorker, 'idle');
    } else if (this.simplify1Workers.includes(worker)) {
      const index = this.simplify1Workers.indexOf(worker);
      this.simplify1Workers.splice(index, 1);
      const newWorker = new Worker(new URL('./SimplifyWorker1.ts', import.meta.url), { type: 'module' });
      this.simplify1Workers.push(newWorker);
      this.workerStatus.delete(worker);
      this.workerStatus.set(newWorker, 'idle');
    } else if (this.simplify2Workers.includes(worker)) {
      const index = this.simplify2Workers.indexOf(worker);
      this.simplify2Workers.splice(index, 1);
      const newWorker = new Worker(new URL('./SimplifyWorker2.ts', import.meta.url), { type: 'module' });
      this.simplify2Workers.push(newWorker);
      this.workerStatus.delete(worker);
      this.workerStatus.set(newWorker, 'idle');
    } else if (this.vectorTileWorkers.includes(worker)) {
      const index = this.vectorTileWorkers.indexOf(worker);
      this.vectorTileWorkers.splice(index, 1);
      const newWorker = new Worker(new URL('./VectorTileWorker.ts', import.meta.url), { type: 'module' });
      this.vectorTileWorkers.push(newWorker);
      this.workerStatus.delete(worker);
      this.workerStatus.set(newWorker, 'idle');
    }
  }

  async processDownloadTask(task: DownloadTask): Promise<DownloadResult> {
    const worker = this.getAvailableWorker('download');
    if (!worker) {
      // Queue the task
      this.taskQueues.get('download')!.push(task);
      return new Promise((resolve, reject) => {
        this.activeRequests.set(task.taskId, {
          resolve,
          reject,
          timeout: setTimeout(() => {
            reject(new Error('Task timeout'));
            this.activeRequests.delete(task.taskId);
          }, this.config.workerOptions.timeout),
        });
      });
    }

    return this.executeDownloadTask(worker, task);
  }

  async processSimplify1Task(task: Simplify1Task): Promise<Simplify1Result> {
    const worker = this.getAvailableWorker('simplify1');
    if (!worker) {
      this.taskQueues.get('simplify1')!.push(task);
      return new Promise((resolve, reject) => {
        this.activeRequests.set(task.taskId, {
          resolve,
          reject,
          timeout: setTimeout(() => {
            reject(new Error('Task timeout'));
            this.activeRequests.delete(task.taskId);
          }, this.config.workerOptions.timeout),
        });
      });
    }

    return this.executeSimplify1Task(worker, task);
  }

  async processSimplify2Task(task: Simplify2Task): Promise<Simplify2Result> {
    const worker = this.getAvailableWorker('simplify2');
    if (!worker) {
      this.taskQueues.get('simplify2')!.push(task);
      return new Promise((resolve, reject) => {
        this.activeRequests.set(task.taskId, {
          resolve,
          reject,
          timeout: setTimeout(() => {
            reject(new Error('Task timeout'));
            this.activeRequests.delete(task.taskId);
          }, this.config.workerOptions.timeout),
        });
      });
    }

    return this.executeSimplify2Task(worker, task);
  }

  async processVectorTileTask(task: VectorTileTask): Promise<VectorTileResult> {
    const worker = this.getAvailableWorker('vectortile');
    if (!worker) {
      this.taskQueues.get('vectortile')!.push(task);
      return new Promise((resolve, reject) => {
        this.activeRequests.set(task.taskId, {
          resolve,
          reject,
          timeout: setTimeout(() => {
            reject(new Error('Task timeout'));
            this.activeRequests.delete(task.taskId);
          }, this.config.workerOptions.timeout),
        });
      });
    }

    return this.executeVectorTileTask(worker, task);
  }

  private getAvailableWorker(stage: ProcessingStage): Worker | null {
    let workers: Worker[];
    
    switch (stage) {
      case 'download':
        workers = this.downloadWorkers;
        break;
      case 'simplify1':
        workers = this.simplify1Workers;
        break;
      case 'simplify2':
        workers = this.simplify2Workers;
        break;
      case 'vectortile':
        workers = this.vectorTileWorkers;
        break;
      default:
        return null;
    }

    for (const worker of workers) {
      if (this.workerStatus.get(worker) === 'idle') {
        return worker;
      }
    }

    return null;
  }

  private async executeDownloadTask(worker: Worker, task: DownloadTask): Promise<DownloadResult> {
    this.workerStatus.set(worker, 'busy');
    
    try {
      const workerApi = Comlink.wrap<DownloadWorkerAPI>(worker);
      const result = await workerApi.processDownload(task);
      
      this.workerStatus.set(worker, 'idle');
      this.processNextTask('download');
      
      return result;
    } catch (error) {
      this.workerStatus.set(worker, 'error');
      throw error;
    }
  }

  private async executeSimplify1Task(worker: Worker, task: Simplify1Task): Promise<Simplify1Result> {
    this.workerStatus.set(worker, 'busy');
    
    try {
      const workerApi = Comlink.wrap<SimplifyWorker1API>(worker);
      const result = await workerApi.processSimplification(task);
      
      this.workerStatus.set(worker, 'idle');
      this.processNextTask('simplify1');
      
      return result;
    } catch (error) {
      this.workerStatus.set(worker, 'error');
      throw error;
    }
  }

  private async executeSimplify2Task(worker: Worker, task: Simplify2Task): Promise<Simplify2Result> {
    this.workerStatus.set(worker, 'busy');
    
    try {
      const workerApi = Comlink.wrap<SimplifyWorker2API>(worker);
      const result = await workerApi.processTileSimplification(task);
      
      this.workerStatus.set(worker, 'idle');
      this.processNextTask('simplify2');
      
      return result;
    } catch (error) {
      this.workerStatus.set(worker, 'error');
      throw error;
    }
  }

  private async executeVectorTileTask(worker: Worker, task: VectorTileTask): Promise<VectorTileResult> {
    this.workerStatus.set(worker, 'busy');
    
    try {
      const workerApi = Comlink.wrap<VectorTileWorkerAPI>(worker);
      const result = await workerApi.generateVectorTile(task);
      
      this.workerStatus.set(worker, 'idle');
      this.processNextTask('vectortile');
      
      return result;
    } catch (error) {
      this.workerStatus.set(worker, 'error');
      throw error;
    }
  }

  private processNextTask(stage: ProcessingStage): void {
    const queue = this.taskQueues.get(stage)!;
    if (queue.length === 0) return;

    const nextTask = queue.shift()!;
    const request = this.activeRequests.get(nextTask.taskId);
    
    if (request) {
      clearTimeout(request.timeout);
      this.activeRequests.delete(nextTask.taskId);
      
      // Execute the queued task
      switch (stage) {
        case 'download':
          this.processDownloadTask(nextTask as DownloadTask)
            .then((result) => request.resolve(result))
            .catch((error) => request.reject(error));
          break;
        case 'simplify1':
          this.processSimplify1Task(nextTask as Simplify1Task)
            .then((result) => request.resolve(result))
            .catch((error) => request.reject(error));
          break;
        case 'simplify2':
          this.processSimplify2Task(nextTask as Simplify2Task)
            .then((result) => request.resolve(result))
            .catch((error) => request.reject(error));
          break;
        case 'vectortile':
          this.processVectorTileTask(nextTask as VectorTileTask)
            .then((result) => request.resolve(result))
            .catch((error) => request.reject(error));
          break;
      }
    }
  }

  getPoolStatistics(): {
    download: { total: number; idle: number; busy: number; error: number };
    simplify1: { total: number; idle: number; busy: number; error: number };
    simplify2: { total: number; idle: number; busy: number; error: number };
    vectorTile: { total: number; idle: number; busy: number; error: number };
    queuedTasks: { download: number; simplify1: number; simplify2: number; vectortile: number };
  } {
    return {
      download: this.getWorkerStats(this.downloadWorkers),
      simplify1: this.getWorkerStats(this.simplify1Workers),
      simplify2: this.getWorkerStats(this.simplify2Workers),
      vectorTile: this.getWorkerStats(this.vectorTileWorkers),
      queuedTasks: {
        download: this.taskQueues.get('download')!.length,
        simplify1: this.taskQueues.get('simplify1')!.length,
        simplify2: this.taskQueues.get('simplify2')!.length,
        vectortile: this.taskQueues.get('vectortile')!.length,
      },
    };
  }

  private getWorkerStats(workers: Worker[]): { total: number; idle: number; busy: number; error: number } {
    const stats = { total: workers.length, idle: 0, busy: 0, error: 0 };
    
    for (const worker of workers) {
      const status = this.workerStatus.get(worker) || 'idle';
      stats[status]++;
    }
    
    return stats;
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    
    // Clear all active requests
    for (const [requestId, request] of this.activeRequests) {
      request.reject(new Error('WorkerPool shutting down'));
      clearTimeout(request.timeout);
    }
    this.activeRequests.clear();
    
    // Terminate all workers
    const allWorkers = [
      ...this.downloadWorkers,
      ...this.simplify1Workers,
      ...this.simplify2Workers,
      ...this.vectorTileWorkers,
    ];
    
    await Promise.all(
      allWorkers.map(worker => {
        return new Promise<void>((resolve) => {
          worker.terminate();
          resolve();
        });
      })
    );
    
    // Clear arrays
    this.downloadWorkers = [];
    this.simplify1Workers = [];
    this.simplify2Workers = [];
    this.vectorTileWorkers = [];
    this.workerStatus.clear();
    this.taskQueues.clear();
    
    console.log('WorkerPoolManager shutdown complete');
  }
}



