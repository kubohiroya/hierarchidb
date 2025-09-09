export interface WorkerEnvPort {
  createWorker(moduleUrl: string): Promise<WorkerRef> | WorkerRef;

  terminate(worker: WorkerRef): Promise<void> | void;

  postMessage<T = any>(worker: WorkerRef, msg: T, transfer?: Transferable[]): void;

  addMessageListener<T = any>(worker: WorkerRef, cb: (msg: T) => void): void;

  removeMessageListener<T = any>(worker: WorkerRef, cb: (msg: T) => void): void;
}

export interface WorkerRef {
  id: string;
  native?: any;
}

export interface ClockPort {
  now(): number;

  setTimeout(cb: () => void, ms: number): any;

  clearTimeout(id: any): void;
}

