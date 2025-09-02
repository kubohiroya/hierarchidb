export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskSpec<I = any, O = any> {
  id?: string;
  input: I;
  moduleUrl?: string; // if using real web worker module
  fn?: (input: I, signal: AbortSignal, report: (p: number) => void) => Promise<O> | O;
}

export interface TaskHandle<O = any> {
  id: string;
  status(): TaskStatus;
  cancel(): void;
  onProgress(cb: (p: number) => void): () => void;
  onStatus(cb: (s: TaskStatus) => void): () => void;
  result(): Promise<O>;
}

