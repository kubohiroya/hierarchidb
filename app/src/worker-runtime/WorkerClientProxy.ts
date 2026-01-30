import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { Remote } from 'comlink';
import type { WorkerInitializationProgress, WorkerRuntimeState } from './WorkerStateStore.js';

export type { WorkerInitializationProgress, WorkerRuntimeState } from './WorkerStateStore.js';

import {
  ensureWorkerInitialized,
  getWorkerSnapshot,
  subscribeWorkerProgress,
  subscribeWorkerState,
} from './WorkerStateStore.js';

export interface WorkerClientProxy {
  ensureInitialized(options?: { signal?: AbortSignal }): Promise<Remote<WorkerAPI>>;
  getCachedClient(): Remote<WorkerAPI> | null;
  getState(): WorkerRuntimeState;
  getLastError(): Error | null;
  getProgress(): WorkerInitializationProgress;
  subscribe(listener: (state: WorkerRuntimeState) => void): () => void;
  subscribeProgress(listener: (detail: WorkerInitializationProgress) => void): () => void;
}

export function createWorkerClientProxy(): WorkerClientProxy {
  const ensureInitialized = (options?: { signal?: AbortSignal }) =>
    ensureWorkerInitialized(options);

  const getCachedClient = () => getWorkerSnapshot().client;
  const getState = () => getWorkerSnapshot().state;
  const getLastError = () => getWorkerSnapshot().error;
  const getProgress = () => getWorkerSnapshot().progress;

  const subscribe = (listener: (state: WorkerRuntimeState) => void) =>
    subscribeWorkerState((snapshot) => listener(snapshot.state));

  const subscribeProgress = (listener: (detail: WorkerInitializationProgress) => void) =>
    subscribeWorkerProgress(listener);

  return {
    ensureInitialized,
    getCachedClient,
    getState,
    getLastError,
    getProgress,
    subscribe,
    subscribeProgress,
  };
}
