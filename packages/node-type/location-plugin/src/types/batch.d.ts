declare module '@hierarchidb/batch' {
  export interface MapChunksOptions {
    concurrency?: number;
    progress?: (completed: number, total?: number) => void;
  }
  export class BatchService {
    mapChunks<I, O>(
      source: AsyncIterable<I> | Iterable<I>,
      fn: (item: I, index: number) => Promise<O> | O,
      opts?: MapChunksOptions
    ): Promise<O[]>;
  }
}

