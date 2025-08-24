/**
 * Worker loader module
 * This handles the complexity of loading db in different environments
 */

import * as Comlink from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';

let workerUrl: string | undefined;

/**
 * Set the worker URL for environments where it needs to be provided externally
 */
export function setWorkerUrl(url: string): void {
  workerUrl = url;
}

/**
 * Create a worker instance
 * In library builds, the worker URL should be set externally via setWorkerUrl
 */
export function createWorker(): Worker {
  if (typeof window === 'undefined') {
    throw new Error('Worker creation is not supported in non-browser environments');
  }
  
  if (!workerUrl) {
    throw new Error(
      'Worker URL not configured. Please call setWorkerUrl() with the path to your built worker file.'
    );
  }
  
  return new Worker(workerUrl, { type: 'module' });
}

/**
 * Create a worker API proxy using Comlink
 */
export function createWorkerAPI(): Comlink.Remote<WorkerAPI> {
  const worker = createWorker();
  return Comlink.wrap<WorkerAPI>(worker);
}