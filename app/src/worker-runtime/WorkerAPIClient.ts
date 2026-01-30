/**
 * WorkerAPIClient - Synchronous singleton for Worker access
 */

import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { Remote } from 'comlink';

// Create a type that matches the shared contract
type WorkerInterface = Remote<WorkerAPI>;

let workerInstance: WorkerInterface | null = null;
let state: 'uninitialized' | 'initializing' | 'initialized' | 'error' = 'uninitialized';
let initializationPromise: Promise<void> | null = null;
let verified = false;

async function initialize(): Promise<void> {
  switch (state) {
    case 'initialized':
      return;
    case 'initializing':
      if (initializationPromise) {
        return initializationPromise;
      }
      break;
    case 'error':
    case 'uninitialized':
      break;
  }

  state = 'initializing';
  initializationPromise = doInitialize()
    .then(() => {
      state = verified ? 'initialized' : 'initializing';
      initializationPromise = null;
    })
    .catch((error) => {
      state = 'error';
      initializationPromise = null;
      throw error;
    });

  return initializationPromise;
}

async function doInitialize(): Promise<void> {
  try {
    const { getWorkerClient, isWorkerInitCompleted } = await loadClientModule();
    const remoteWorker = await getWorkerClient();

    workerInstance = remoteWorker;

    try {
      const initComplete = Boolean(isWorkerInitCompleted?.());
      if (!initComplete) {
        await remoteWorker.ping();
        verified = true;
      } else {
        verified = true;
      }
    } catch {
      // Provider will wait on channel/event.
    }

    if (!workerInstance) {
      throw new Error('getWorkerClient returned null');
    }
  } catch (error) {
    workerInstance = null;
    throw error;
  }
}

function getSingleton(): WorkerInterface {
  if (!workerInstance) {
    throw new NotInitializedError();
  }
  if (state !== 'initialized' && import.meta?.env?.VITE_WORKERAPI_LOG === '1') {
    console.warn('[WorkerAPIClient] getSingleton called before initialization');
  }
  return workerInstance;
}

async function getOrInit(): Promise<WorkerInterface> {
  if (!isReady()) {
    await initialize();
  }
  return getSingleton();
}

function reset(): void {
  if (workerInstance) {
    const raw = getRawWorkerInstance();
    raw?.terminate();
  }
  workerInstance = null;
  state = 'uninitialized';
  initializationPromise = null;
  verified = false;
}

function isReady(): boolean {
  const module = getClientModuleOrNull();
  const initComplete = module?.isWorkerInitCompleted?.();

  if (!verified && initComplete) {
    verified = true;
  }

  const globalInit =
    typeof window !== 'undefined' && (window as WorkerStatusWindow).__HDB_INIT_COMPLETE__ === true;
  if (!verified && globalInit) verified = true;
  if (state !== 'initialized' && workerInstance && (globalInit || initComplete)) {
    state = 'initialized';
  }
  return state === 'initialized' && workerInstance !== null;
}

function getRawWorkerInstance(): Worker | null {
  const module = getClientModuleOrNull();
  return module?.getRawWorkerInstance?.() ?? null;
}

type WorkerStatusWindow = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
};
type ClientModule = typeof import('./client.ts');

let clientModule: ClientModule | null = null;
let clientModulePromise: Promise<ClientModule> | null = null;

async function loadClientModule(): Promise<ClientModule> {
  if (!clientModulePromise) {
    clientModulePromise = import('./client.ts')
      .then((module) => {
        clientModule = module;
        return module;
      })
      .catch((error) => {
        clientModulePromise = null;
        throw error;
      });
  }
  return clientModulePromise;
}

function getClientModuleOrNull(): ClientModule | null {
  return clientModule;
}

export class NotInitializedError extends Error {
  constructor() {
    super('WorkerAPIClient is not initialized. Make sure to call initialize() first.');
    this.name = 'NotInitializedError';
  }
}

export const WorkerAPIClient = {
  initialize,
  getSingleton,
  getOrInit,
  reset,
  isReady,
  getRawWorkerInstance,
} as const;
