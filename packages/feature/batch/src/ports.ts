export interface CheckpointPort<T = any> {
  load(opId: string): Promise<T | undefined>;
  save(opId: string, data: T): Promise<void>;
  clear(opId: string): Promise<void>;
}

