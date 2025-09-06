declare module '@hierarchidb/runtime-shared-batch-processor' {
  export type ProgressSnapshot = { jobId: string; progress: number; phase: string; ts: number };
  export class ProgressEmitter {
    constructor(hz?: number);
    on(fn: (s: ProgressSnapshot) => void): () => void;
    off(fn: (s: ProgressSnapshot) => void): void;
    emit(s: ProgressSnapshot): void;
  }
  export interface ProgressSnapshotStore {
    upsert(jobId: string, snap: ProgressSnapshot): Promise<void>;
    get(jobId: string): Promise<ProgressSnapshot | undefined>;
  }
  export class MemoryProgressStore implements ProgressSnapshotStore {
    upsert(jobId: string, snap: ProgressSnapshot): Promise<void>;
    get(jobId: string): Promise<ProgressSnapshot | undefined>;
  }
}

