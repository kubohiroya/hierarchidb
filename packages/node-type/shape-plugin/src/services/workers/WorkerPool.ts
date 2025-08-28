/**
 * WorkerPool - Generic Worker pool implementation with Comlink
 * Manages a pool of Web Workers with round-robin load balancing
 */

import * as Comlink from 'comlink';

export interface ProgressUpdate {
  current: number;
  total: number;
  message?: string;
}

/**
 * Generic Worker pool for load balancing and parallel processing
 */
export class WorkerPool<T extends object> {
  private workers: Comlink.Remote<T>[] = [];
  private currentIndex = 0;
  private taskCount = 0;
  private errorCount = 0;
  private totalTaskTime = 0;
  private activeWorkers = new Set<number>();
  
  constructor(private rawWorkers: Worker[]) {}
  
  /**
   * Initialize the Worker pool
   */
  async initialize(): Promise<void> {
    this.workers = this.rawWorkers.map(worker => 
      Comlink.wrap<T>(worker)
    );
    
    // Verify all workers are responsive
    await this.healthCheck();
  }
  
  /**
   * Execute a method on the next available Worker (round-robin)
   */
  async execute<K extends keyof T>(
    method: K,
    ...args: T[K] extends (...args: infer P) => any ? P : never
  ): Promise<T[K] extends (...args: any[]) => Promise<infer R> ? R : never> {
    const workerIndex = this.getNextWorkerIndex();
    const worker = this.workers[workerIndex];
    
    if (!worker) {
      throw new Error('No workers available');
    }
    
    const startTime = Date.now();
    this.activeWorkers.add(workerIndex);
    
    try {
      // @ts-ignore - Dynamic method call
      const result = await worker[method](...args);
      this.taskCount++;
      this.totalTaskTime += Date.now() - startTime;
      return result;
    } catch (error) {
      this.errorCount++;
      throw error;
    } finally {
      this.activeWorkers.delete(workerIndex);
    }
  }
  
  /**
   * Execute a method on all workers in parallel
   */
  async broadcast<K extends keyof T>(
    method: K,
    ...args: T[K] extends (...args: infer P) => any ? P : never
  ): Promise<Array<T[K] extends (...args: any[]) => Promise<infer R> ? R : never>> {
    const promises = this.workers.map(async (worker, index) => {
      this.activeWorkers.add(index);
      try {
        // @ts-ignore - Dynamic method call
        return await worker[method](...args);
      } finally {
        this.activeWorkers.delete(index);
      }
    });
    
    return Promise.all(promises);
  }
  
  /**
   * Execute with callback for progress updates
   */
  async executeWithProgress<K extends keyof T>(
    method: K,
    onProgress: (progress: ProgressUpdate) => void,
    ...args: T[K] extends (...args: infer P) => any ? P : never
  ): Promise<T[K] extends (...args: any[]) => Promise<infer R> ? R : never> {
    const workerIndex = this.getNextWorkerIndex();
    const worker = this.workers[workerIndex];
    
    if (!worker) {
      throw new Error('No workers available');
    }
    
    // Create progress proxy
    const progressProxy = Comlink.proxy(onProgress);
    
    try {
      // Pass progress callback as last argument
      const allArgs = [...args, progressProxy];
      // @ts-ignore - Dynamic method call with progress callback
      const methodFn = worker[method] as any;
      const result = await methodFn(...allArgs);
      return result;
    } finally {
      // Clean up proxy - releaseProxy is a symbol property
      if (typeof progressProxy === 'function') {
        // Proxy cleanup handled by Comlink garbage collection
      }
    }
  }
  
  /**
   * Get the next Worker index (round-robin)
   */
  private getNextWorkerIndex(): number {
    const index = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.workers.length;
    return index;
  }
  

  
  /**
   * Dispose of all workers
   */
  async dispose(): Promise<void> {
    // Terminate all workers
    await Promise.all(
      this.rawWorkers.map(worker => {
        worker.terminate();
        return Promise.resolve();
      })
    );
    
    this.workers = [];
    this.rawWorkers = [];
    this.activeWorkers.clear();
  }
  
  /**
   * Get pool statistics
   */
  getStatistics(): WorkerPoolStatistics {
    return {
      size: this.workers.length,
      active: this.activeWorkers.size,
      idle: this.workers.length - this.activeWorkers.size,
      tasksProcessed: this.taskCount,
      averageTaskTime: this.taskCount > 0 ? this.totalTaskTime / this.taskCount : 0,
      errors: this.errorCount
    };
  }
  
  /**
   * Health check all workers
   */
  async healthCheck(): Promise<boolean> {
    try {
      const results = await Promise.allSettled(
        this.workers.map(async (worker) => {
          // Try to call a ping method if it exists
          if ('ping' in worker && typeof worker.ping === 'function') {
            return await worker.ping();
          }
          return true;
        })
      );
      
      return results.every(result => result.status === 'fulfilled');
    } catch {
      return false;
    }
  }
  
  /**
   * Resize the pool (add or remove workers)
   */
  async resize(newSize: number): Promise<void> {
    const currentSize = this.workers.length;
    
    if (newSize === currentSize) {
      return;
    }
    
    if (newSize > currentSize) {
      // Add workers
      const workersToAdd = newSize - currentSize;
      for (let i = 0; i < workersToAdd; i++) {
        // Create new Worker with same configuration as existing
        // This is a simplified implementation - in practice, you'd need
        // to store the Worker constructor parameters
        throw new Error('Adding workers not implemented - need Worker factory');
      }
    } else {
      // Remove workers
      const workersToRemove = currentSize - newSize;
      for (let i = 0; i < workersToRemove; i++) {
        const worker = this.rawWorkers.pop();
        if (worker) {
          worker.terminate();
        }
        this.workers.pop();
      }
    }
  }
  
  /**
   * Execute with timeout
   */
  async executeWithTimeout<K extends keyof T>(
    method: K,
    timeoutMs: number,
    ...args: T[K] extends (...args: infer P) => any ? P : never
  ): Promise<T[K] extends (...args: any[]) => Promise<infer R> ? R : never> {
    return Promise.race([
      this.execute(method, ...args),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Worker timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }
  
  /**
   * Execute with retry
   */
  async executeWithRetry<K extends keyof T>(
    method: K,
    maxRetries: number,
    ...args: T[K] extends (...args: infer P) => any ? P : never
  ): Promise<T[K] extends (...args: any[]) => Promise<infer R> ? R : never> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(method, ...args);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, attempt) * 100)
          );
        }
      }
    }
    
    throw lastError || new Error('All retries failed');
  }
}

// Type definitions
export interface WorkerPoolStatistics {
  size: number;
  active: number;
  idle: number;
  tasksProcessed: number;
  averageTaskTime: number;
  errors: number;
}

export interface DetailedProgressUpdate {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  stage?: string;
  subProgress?: {
    current: number;
    total: number;
    message: string;
  };
}