/**
 * Worker loader module for Vite
 * This handles the complexity of loading workers in different environments
 */

import * as Comlink from 'comlink';
import type { WorkerAPI } from '@hierarchidb/api';

// Import worker with Vite's ?worker suffix
// This imports a Worker constructor, not an instance
import WorkerConstructor from '../../worker/src/worker.ts?worker';

export function createWorker(): Worker {
  // Create a new Worker instance from the constructor
  return new WorkerConstructor();
}

export function createWorkerAPI(): Comlink.Remote<WorkerAPI> {
  const worker = createWorker();
  return Comlink.wrap<WorkerAPI>(worker);
}