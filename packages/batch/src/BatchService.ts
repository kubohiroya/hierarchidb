export interface MapChunksOptions {
  concurrency?: number;
  progress?: (completed: number, total?: number) => void;
  signal?: AbortSignal;
}

type Awaitable<T> = T | Promise<T>;

/**
 * BatchService offers lightweight parallel map semantics with backpressure.
 */
export class BatchService {
  async mapChunks<I, O>(
    source: Iterable<I> | AsyncIterable<I>,
    fn: (item: I, index: number, signal: AbortSignal) => Awaitable<O>,
    options: MapChunksOptions = {},
  ): Promise<O[]> {
    const concurrency = Math.max(1, Math.floor(options.concurrency ?? 4));
    const signal = options.signal ?? new AbortController().signal;
    const iterator = toAsyncIterator(source);
    const total = inferTotalLength(source);

    let index = 0;
    let completed = 0;
    const results: O[] = [];
    const workers = Array.from({ length: concurrency }, async () => {
      for (;;) {
        if (signal.aborted) {
          throw abortError();
        }
        const { value, done } = await iterator.next();
        if (done) break;
        const currentIndex = index++;
        const output = await fn(value as I, currentIndex, signal);
        results[currentIndex] = output;
        completed += 1;
        options.progress?.(completed, total);
      }
    });

    try {
      await Promise.all(workers);
    } catch (error) {
      if (signal.aborted) {
        throw abortError();
      }
      throw error;
    }

    return results;
  }
}

function toAsyncIterator<T>(input: Iterable<T> | AsyncIterable<T>): AsyncIterator<T> {
  if (isAsyncIterable<T>(input)) {
    return input[Symbol.asyncIterator]();
  }
  if (!isIterable<T>(input)) {
    throw new TypeError('Source must be iterable');
  }
  return (async function* () {
    for (const item of input as Iterable<T>) {
      yield item;
    }
  })()[Symbol.asyncIterator]();
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { [Symbol.asyncIterator]?: unknown };
  return typeof candidate[Symbol.asyncIterator] === 'function';
}

function isIterable<T>(value: unknown): value is Iterable<T> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { [Symbol.iterator]?: unknown };
  return typeof candidate[Symbol.iterator] === 'function';
}

function inferTotalLength(input: Iterable<unknown> | AsyncIterable<unknown>): number | undefined {
  if (Array.isArray(input)) {
    return input.length;
  }
  if (input && typeof input === 'object') {
    const len = (input as { length?: unknown }).length;
    if (typeof len === 'number') {
      return Number(len);
    }
    const size = (input as { size?: unknown }).size;
    if (typeof size === 'number') {
      return Number(size);
    }
  }
  return undefined;
}

function abortError(): Error {
  if (typeof DOMException === 'function') {
    return new DOMException('Batch execution aborted', 'AbortError');
  }
  const error = new Error('Batch execution aborted');
  (error as Error & { name: string }).name = 'AbortError';
  return error;
}
