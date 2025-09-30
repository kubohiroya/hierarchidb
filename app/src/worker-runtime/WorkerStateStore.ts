import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { ensureWorkerRuntime } from './WorkerModuleLoader.js';
import { getWorkerAPIClientModule, loadWorkerAPIClientModule } from './workerApiClientLoader.js';

export type WorkerRuntimeState = 'uninitialized' | 'initializing' | 'ready' | 'failed';

export interface WorkerInitializationProgress {
  progress: number;
  message: string;
}

export interface WorkerStateSnapshot {
  state: WorkerRuntimeState;
  client: Remote<WorkerAPI> | null;
  error: Error | null;
  progress: WorkerInitializationProgress;
}

export type WorkerStateListener = (snapshot: WorkerStateSnapshot) => void;
export type WorkerProgressListener = (progress: WorkerInitializationProgress) => void;

const getWorkerClientModule = () => getWorkerAPIClientModule();

const getWorkerClientClass = () => getWorkerClientModule()?.WorkerAPIClient ?? null;

const getNotInitializedErrorCtor = () => getWorkerClientModule()?.NotInitializedError ?? null;

const isNotInitializedError = (error: unknown): boolean => {
  const NotInitialized = getNotInitializedErrorCtor();
  return Boolean(NotInitialized && error instanceof NotInitialized);
};

const getSingletonIfAvailable = (): Remote<WorkerAPI> | null => {
  const Client = getWorkerClientClass();
  if (!Client) return null;
  try {
    return Client.getSingleton();
  } catch (error) {
    if (isNotInitializedError(error)) {
      return null;
    }
    throw error;
  }
};

const isWorkerReady = (): boolean => {
  const Client = getWorkerClientClass();
  return Client ? Client.isReady() : false;
};

const DEFAULT_PROGRESS: WorkerInitializationProgress = {
  progress: 0,
  message: 'Worker初期化を開始しています...',
};

const EVENT_INIT_START = 'hierarchidb-worker-init-start';
const EVENT_INIT_PROGRESS = 'hierarchidb-worker-init-progress';
const EVENT_INIT_ERROR = 'hierarchidb-worker-init-error';
const EVENT_INIT_COMPLETE = 'hierarchidb-worker-init-complete';

const initialClient = getSingletonIfAvailable();
const initialState: WorkerRuntimeState = initialClient ? 'ready' : 'uninitialized';

let snapshot: WorkerStateSnapshot = {
  state: initialState,
  client: initialClient,
  error: null,
  progress: initialClient
    ? { progress: 100, message: 'Worker初期化完了' }
    : DEFAULT_PROGRESS,
};

const listeners = new Set<WorkerStateListener>();
const progressListeners = new Set<WorkerProgressListener>();

let initializationPromise: Promise<Remote<WorkerAPI>> | null = null;

export function getWorkerSnapshot(): WorkerStateSnapshot {
  return snapshot;
}

function notifySnapshot(next: WorkerStateSnapshot, previous: WorkerStateSnapshot): void {
  snapshot = next;
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('[WorkerStateStore] listener error', error);
    }
  }
  if (
    next.progress.progress !== previous.progress.progress ||
    next.progress.message !== previous.progress.message
  ) {
    for (const listener of progressListeners) {
      try {
        listener(next.progress);
      } catch (error) {
        console.error('[WorkerStateStore] progress listener error', error);
      }
    }
  }
}

function updateSnapshot(updater: (prev: WorkerStateSnapshot) => WorkerStateSnapshot): void {
  const previous = snapshot;
  const next = updater(previous);
  if (
    next.state === previous.state &&
    next.client === previous.client &&
    next.error === previous.error &&
    next.progress.progress === previous.progress.progress &&
    next.progress.message === previous.progress.message
  ) {
    return;
  }
  notifySnapshot(next, previous);
}

export function subscribeWorkerState(listener: WorkerStateListener): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

export function subscribeWorkerProgress(listener: WorkerProgressListener): () => void {
  progressListeners.add(listener);
  listener(snapshot.progress);
  return () => progressListeners.delete(listener);
}

function getCachedClient(): Remote<WorkerAPI> | null {
  return getSingletonIfAvailable();
}

export async function ensureWorkerInitialized(options?: {
  signal?: AbortSignal;
}): Promise<Remote<WorkerAPI>> {
  if (snapshot.state === 'ready' && snapshot.client) {
    return snapshot.client;
  }

  if (options?.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const abortPromise = options?.signal
    ? new Promise<never>((_, reject) => {
        options.signal!.addEventListener(
          'abort',
          () => reject(new DOMException('The operation was aborted.', 'AbortError')),
          { once: true },
        );
      })
    : null;

  if (initializationPromise) {
    return abortPromise ? Promise.race([initializationPromise, abortPromise]) : initializationPromise;
  }

  updateSnapshot((prev) => ({
    state: 'initializing',
    client: prev.client,
    error: null,
    progress: prev.state === 'ready' ? prev.progress : DEFAULT_PROGRESS,
  }));

  initializationPromise = (async () => {
    try {
      await loadWorkerAPIClientModule();
      const runtimeInitialization = ensureWorkerRuntime();
      const client = await (abortPromise
        ? Promise.race([runtimeInitialization, abortPromise])
        : runtimeInitialization);

      updateSnapshot(() => ({
        state: 'ready',
        client,
        error: null,
        progress: { progress: 100, message: 'Worker初期化完了' },
      }));
      return client;
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      updateSnapshot((prev) => ({
        state: failure.name === 'AbortError' ? prev.state : 'failed',
        client: prev.client,
        error: failure,
        progress: { progress: prev.progress.progress, message: failure.message },
      }));
      throw failure;
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

if (typeof window !== 'undefined') {
  window.addEventListener(EVENT_INIT_START, () => {
    updateSnapshot((prev) => ({
      state: 'initializing',
      client: prev.client,
      error: null,
      progress: { progress: 0, message: 'Worker初期化を開始しています...' },
    }));
  });

  window.addEventListener(EVENT_INIT_PROGRESS, (event) => {
    const detail = (event as CustomEvent<Partial<WorkerInitializationProgress>>).detail ?? {};
    updateSnapshot((prev) => ({
      state: prev.state === 'uninitialized' ? 'initializing' : prev.state,
      client: prev.client,
      error: prev.error,
      progress: {
        progress:
          typeof detail.progress === 'number'
            ? Math.max(0, Math.min(100, detail.progress))
            : prev.progress.progress,
        message: detail.message ?? prev.progress.message ?? 'Worker初期化を開始しています...',
      },
    }));
  });

  window.addEventListener(EVENT_INIT_ERROR, (event) => {
    const detail = (event as CustomEvent<{ error?: string }>).detail ?? {};
    updateSnapshot((prev) => ({
      state: 'failed',
      client: prev.client,
      error: new Error(detail.error ?? 'Worker initialization failed'),
      progress: {
        progress: prev.progress.progress,
        message: detail.error ?? prev.progress.message,
      },
    }));
  });

  window.addEventListener(EVENT_INIT_COMPLETE, () => {
    updateSnapshot(() => ({
      state: 'ready',
      client: getCachedClient(),
      error: null,
      progress: { progress: 100, message: 'Worker初期化完了' },
    }));
  });
}
