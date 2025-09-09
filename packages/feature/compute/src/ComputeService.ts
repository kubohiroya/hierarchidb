import { WorkerPool, type WorkerPoolOptions } from './WorkerPool';
import type { TaskHandle, TaskSpec } from './types';

export class ComputeService {
  private pool: WorkerPool;

  constructor(opts: WorkerPoolOptions = { concurrency: 2 }) {
    this.pool = new WorkerPool(opts);
  }

  submit<I = any, O = any>(spec: TaskSpec<I, O>): TaskHandle<O> {
    return this.pool.submit(spec);
  }

  getPool(): WorkerPool {
    return this.pool;
  }
}

