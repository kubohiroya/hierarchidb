/**
 * @file DexieMonitor.ts
 * @description Utility for monitoring Dexie database operations while preserving PromiseExtended types
 */

import type { Table, PromiseExtended } from 'dexie';

/**
 * Wraps a Dexie table method to add monitoring while preserving PromiseExtended
 *
 * @example
 * ```typescript
 * const monitoredGet = wrapDexieMethod(
 *   table.get.bind(table),
 *   (duration, result) => console.log(`Query took ${duration}ms`)
 * );
 * table.get = monitoredGet;
 * ```
 */
export function wrapDexieMethod<TArgs extends any[], TResult>(
  originalMethod: (...args: TArgs) => PromiseExtended<TResult>,
  onComplete: (duration: number, result: TResult, args: TArgs) => void
): (...args: TArgs) => PromiseExtended<TResult> {
  return function wrappedMethod(...args: TArgs): PromiseExtended<TResult> {
    const startTime = performance.now();

    // Call the original method to get the PromiseExtended
    const promise = originalMethod(...args);

    // Create a new PromiseExtended that wraps the original
    const monitoredPromise = promise.then((result) => {
      const duration = performance.now() - startTime;
      onComplete(duration, result, args);
      return result;
    });

    // Copy all PromiseExtended methods from the original promise
    Object.setPrototypeOf(monitoredPromise, Object.getPrototypeOf(promise));

    // Copy any custom properties/methods
    for (const key in promise) {
      if (!(key in monitoredPromise)) {
        (monitoredPromise as any)[key] = (promise as any)[key];
      }
    }

    return monitoredPromise as PromiseExtended<TResult>;
  };
}

/**
 * Creates a monitoring wrapper for Dexie tables
 */
export class DexieTableMonitor<T = any, TKey = any> {
  private metrics = {
    gets: 0,
    puts: 0,
    deletes: 0,
    totalTime: 0,
  };

  constructor(private table: Table<T, TKey>) {}

  /**
   * Starts monitoring the table operations
   */
  startMonitoring(): void {
    // Monitor get operations
    const originalGet = this.table.get.bind(this.table);
    (this.table as any).get = wrapDexieMethod(originalGet, (duration) => {
      this.metrics.gets++;
      this.metrics.totalTime += duration;
    });

    // Monitor put operations
    const originalPut = this.table.put.bind(this.table);
    (this.table as any).put = wrapDexieMethod(originalPut, (duration) => {
      this.metrics.puts++;
      this.metrics.totalTime += duration;
    });

    // Monitor delete operations
    const originalDelete = this.table.delete.bind(this.table);
    (this.table as any).delete = wrapDexieMethod(originalDelete, (duration) => {
      this.metrics.deletes++;
      this.metrics.totalTime += duration;
    });
  }

  /**
   * Gets the current metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Resets the metrics
   */
  resetMetrics(): void {
    this.metrics = {
      gets: 0,
      puts: 0,
      deletes: 0,
      totalTime: 0,
    };
  }
}
