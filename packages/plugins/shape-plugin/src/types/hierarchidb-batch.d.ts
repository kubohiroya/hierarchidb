declare module '@hierarchidb/batch' {
  export interface MapChunksOptions {
    concurrency?: number;
  }

  export class BatchService {
    mapChunks<T>(
      items: T[],
      worker: (item: T, index: number) => Promise<void> | void,
      options?: MapChunksOptions,
    ): Promise<void>;
  }
}
