/**
 * Batch processor utilities for HierarchiDB
 */

export interface BatchProcessorOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (progress: number, total: number) => void;
}

export class BatchProcessor<T> {
  private options: Required<BatchProcessorOptions>;

  constructor(options: BatchProcessorOptions = {}) {
    this.options = {
      batchSize: options.batchSize ?? 100,
      concurrency: options.concurrency ?? 1,
      onProgress: options.onProgress ?? (() => {}),
    };
  }

  async processBatch<R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = [];
    const { batchSize, onProgress } = this.options;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(processor));
      results.push(...batchResults);
      onProgress(Math.min(i + batchSize, items.length), items.length);
    }

    return results;
  }
}

export default BatchProcessor;

// Progress utilities (shared across plugins)
export * from './Progress';
