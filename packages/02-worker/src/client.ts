import type { WorkerAPI } from '@hierarchidb/01-api';
import * as Comlink from 'comlink';

export function createWorkerClient(workerUrl: string | URL): Comlink.Remote<WorkerAPI> {
  const worker = new Worker(workerUrl, { type: 'module' });
  return Comlink.wrap<WorkerAPI>(worker);
}

export function createWorkerClientFromInstance(worker: Worker): Comlink.Remote<WorkerAPI> {
  return Comlink.wrap<WorkerAPI>(worker);
}
