export interface MapChunksOptions {
  concurrency?: number;
  progress?: (completed: number, total?: number) => void;
}

export class BatchService {
  async mapChunks<I, O>(
    source: AsyncIterable<I> | Iterable<I>,
    fn: (item: I, index: number) => Promise<O> | O,
    opts: MapChunksOptions = {},
  ): Promise<O[]> {
    const concurrency = Math.max(1, opts.concurrency ?? 4);
    const iter = isAsync(source) ? source[Symbol.asyncIterator]() : toAsync(source)[Symbol.asyncIterator]();
    const results: O[] = [];
    let index = 0;
    let completed = 0;

    const workers = new Array(concurrency).fill(0).map(async () => {
      for (; ;) {
        const { value, done } = await iter.next();
        if (done) break;
        const current = index++;
        const out = await fn(value as I, current);
        results[current] = out;
        completed++;
        opts.progress?.(completed);
      }
    });

    await Promise.all(workers);
    return results;
  }
}

function isAsync<T>(it: any): it is AsyncIterable<T> {
  return !!it && typeof it[Symbol.asyncIterator] === 'function';
}

function toAsync<T>(it: Iterable<T>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const v of it) yield v;
    },
  } as AsyncIterable<T>;
}
