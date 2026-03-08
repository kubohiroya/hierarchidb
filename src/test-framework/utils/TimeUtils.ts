// Time-related utilities for testing timing constraints and performance

/**
 * Time utilities for test framework timing operations
 */
export class TimeUtils {
  /**
   * Wait for a specified duration
   */
  static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Measure execution time of an async function
   */
  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  /**
   * Measure execution time of a sync function
   */
  static measureTimeSync<T>(fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  /**
   * Create a timeout promise that rejects after specified time
   */
  static timeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Wait for a condition to become true with timeout
   */
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
      const result = await condition();
      if (result) {
        return;
      }
      await this.wait(intervalMs);
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms`);
  }

  /**
   * Create a high-resolution timestamp
   */
  static now(): number {
    return performance.now();
  }

  /**
   * Format duration in human-readable format
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(2);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Calculate percentiles from an array of durations
   */
  static calculatePercentiles(durations: number[]): Record<number, number> {
    if (durations.length === 0) {
      return {};
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const percentiles = [50, 75, 90, 95, 99];
    
    return percentiles.reduce((result, percentile) => {
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      result[percentile] = sorted[Math.max(0, index)];
      return result;
    }, {} as Record<number, number>);
  }

  /**
   * Generate timestamps for a sequence of events
   */
  static generateEventTimestamps(
    count: number,
    startTime: number = Date.now(),
    intervalMs: number = 100
  ): number[] {
    return Array.from({ length: count }, (_, index) => 
      startTime + (index * intervalMs)
    );
  }

  /**
   * Check if timestamps are in chronological order
   */
  static areTimestampsOrdered(timestamps: number[]): boolean {
    for (let i = 1; i < timestamps.length; i++) {
      if (timestamps[i] < timestamps[i - 1]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate average time between events
   */
  static calculateAverageInterval(timestamps: number[]): number {
    if (timestamps.length < 2) {
      return 0;
    }

    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }
}