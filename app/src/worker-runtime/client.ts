/**
 * UI-side worker bootstrap: create and wrap SharedWorker via Comlink.
 */

import type { BuildWorkerAPI } from '~/types/worker-api.js';
import type { Remote } from 'comlink';
import { bootLog } from '~/utils/bootLog.ts';
import { APP_VERSION } from '~/version.ts';
import { isMaintenanceLockActive } from '~/maintenance/maintenanceLock.js';
import sharedWorkerScriptUrl from './shared-worker.ts?sharedworker&url';

// Mirrors WorkerInitMessageType defined in @hierarchidb/ui-worker-client to avoid `any` fallbacks
// while the package-level re-export remains unavailable to the app bundler during typecheck.
type WorkerInitMessageType =
  | 'INIT_REQUEST'
  | 'INIT_COMPLETE'
  | 'INIT_ERROR'
  | 'INIT_PROGRESS'
  | 'PING'
  | 'PING_RESPONSE';

// Mirrors WorkerInitMessage from @hierarchidb/ui-worker-client. Keep in sync with the upstream type.
type WorkerInitMessage = {
  type: WorkerInitMessageType;
  payload?: {
    progress?: number;
    message?: string;
    error?: string;
    timestamp?: number;
  };
};

type WorkerServicesReadyMessage = {
  type: 'SERVICES_READY';
  source: 'worker';
  at: number;
};

type BootWindow = Window & {
  __HDB_INIT_COMPLETE__?: boolean;
};

let workerInstance: Remote<BuildWorkerAPI> | null = null;
let rawSharedWorkerPort: MessagePort | null = null;
let workerInitCompleted = false;

const logInitWorkerWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn(`[client:initWorker] ${message}`, error);
};

const COMLINK_NOISE_TYPES = new Set([
  'GET',
  'SET',
  'APPLY',
  'CONSTRUCT',
  'ENDPOINT',
  'RELEASE',
  'HANDLER',
]);

function resolveSharedWorkerUrl(): URL {
  if (typeof sharedWorkerScriptUrl === 'string') {
    if (typeof window !== 'undefined') {
      const url = new URL(sharedWorkerScriptUrl, window.location.origin);
      url.searchParams.set('appVersion', APP_VERSION);
      return url;
    }
    const globalScope = globalThis as { location?: Location };
    if (globalScope.location?.origin) {
      const url = new URL(sharedWorkerScriptUrl, globalScope.location.origin);
      url.searchParams.set('appVersion', APP_VERSION);
      return url;
    }
  }
  const fallbackUrl = new URL(/* @vite-ignore */ './shared-worker.js', import.meta.url);
  fallbackUrl.searchParams.set('appVersion', APP_VERSION);
  return fallbackUrl;
}

const ensureSharedWorkerReady = (): void => {
  if (typeof SharedWorker !== 'function') {
    throw new Error('[client:initWorker] SharedWorker is not available in this browser/runtime.');
  }
};

const MAINTENANCE_LOCK_POLL_MS = 1_000;
const MAINTENANCE_LOCK_MAX_WAIT_MS = 30_000;

const wait = (ms: number): Promise<void> => (
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
);

function getBootWindow(): BootWindow | null {
  if (typeof window === 'undefined') return null;
  return window as BootWindow;
}

function isWorkerInitMessage(value: unknown): value is WorkerInitMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown };
  return typeof candidate.type === 'string';
}

function isWorkerServicesReadyMessage(value: unknown): value is WorkerServicesReadyMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown; source?: unknown; at?: unknown };
  return (
    candidate.type === 'SERVICES_READY' &&
    candidate.source === 'worker' &&
    typeof candidate.at === 'number'
  );
}

const attachMessageHandlers = (target: MessagePort) => {
  const addListener = target.addEventListener.bind(target);
  const onMessage: EventListener = (event) => {
    const { data } = event as MessageEvent<unknown>;
    const messageType =
      typeof data === 'object' &&
      data !== null &&
      'type' in data &&
      typeof (data as { type?: unknown }).type === 'string'
        ? String((data as { type: string }).type)
        : typeof data === 'object' &&
            data !== null &&
            'payload' in data &&
            typeof (data as { payload?: { type?: unknown } }).payload?.type === 'string'
          ? String((data as { payload: { type: string } }).payload.type)
          : 'unknown';
    if (!COMLINK_NOISE_TYPES.has(messageType)) {
      bootLog('client:recv %s', messageType);
    }

    if (isWorkerInitMessage(data)) {
      if (data.type === 'INIT_PROGRESS') {
        const bootWindow = getBootWindow();
        if (bootWindow) {
          bootWindow.dispatchEvent(
            new CustomEvent('hierarchidb-worker-init-progress', {
              detail: {
                progress: data.payload?.progress,
                message: data.payload?.message,
              },
            })
          );
        }
      }

      if (data.type === 'INIT_COMPLETE') {
        workerInitCompleted = true;
        const bootWindow = getBootWindow();
        if (bootWindow) {
          bootWindow.__HDB_INIT_COMPLETE__ = true;
          bootLog('client:set __HDB_INIT_COMPLETE__=true');
          bootWindow.dispatchEvent(new Event('hierarchidb-worker-init-complete'));
        }
      }
    }
    if (isWorkerServicesReadyMessage(data)) {
      try {
        const detail = { source: 'worker', at: Date.now() } as const;
        const bootWindow = getBootWindow();
        if (bootWindow) {
          bootWindow.dispatchEvent(new CustomEvent('hdb-services-ready', { detail }));
        }
      } catch (error) {
        logInitWorkerWarning('Failed to dispatch hdb-services-ready event', error);
      }
    }
  };

  addListener('message', onMessage);

  const onMessageError: EventListener = (event) => {
    console.error('[client:initWorker] messageerror', event);
  };
  addListener('messageerror', onMessageError);
};

const cleanupWorkerHandles = () => {
  rawSharedWorkerPort?.close();
  rawSharedWorkerPort = null;
  // SharedWorker instances are scoped by MessagePort; closing the port is sufficient.
  workerInstance = null;
  workerInitCompleted = false;
};

const ensureMaintenanceUnlocked = (): void => {
  if (!isMaintenanceLockActive()) return;
  cleanupWorkerHandles();
  throw new Error('maintenance-lock-active');
};

const waitForMaintenanceUnlock = async (deadlineMs = MAINTENANCE_LOCK_MAX_WAIT_MS): Promise<void> => {
  const startedAt = Date.now();
  let delayMs = MAINTENANCE_LOCK_POLL_MS;
  while (isMaintenanceLockActive()) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= deadlineMs) {
      ensureMaintenanceUnlocked();
    }
    await wait(delayMs);
    if (delayMs < 2_000) {
      delayMs = 2_000;
    }
  }
};

export async function initializeWorker(): Promise<Remote<BuildWorkerAPI>> {
  ensureSharedWorkerReady();
  const RETRY_DELAYS = [2000, 3000, 7000];
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    await waitForMaintenanceUnlock();
    // Reduce console noise; log only via bootLog when explicitly enabled
    bootLog('client:initWorker attempt=%d', attempt + 1);
    try {
      if (workerInstance) {
        cleanupWorkerHandles();
      }

      const workerUrl = resolveSharedWorkerUrl();
      workerUrl.searchParams.set('retry', String(attempt));
      const sharedWorker = new SharedWorker(workerUrl, { type: 'module' });
      rawSharedWorkerPort = sharedWorker.port;
      rawSharedWorkerPort.start();
      attachMessageHandlers(rawSharedWorkerPort);

      const Comlink = await import('comlink');
      const worker = Comlink.wrap<BuildWorkerAPI>(rawSharedWorkerPort);
      workerInstance = worker;
      if (attempt > 0) console.log('👍 [client:initWorker] reconnected');
      return workerInstance;
    } catch (error) {
      console.error(`[client:initWorker] failed attempt ${attempt + 1}:`, error);
      cleanupWorkerHandles();
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('[client:initWorker] max retries exceeded');
}

export async function getWorkerClient(): Promise<Remote<BuildWorkerAPI>> {
  await waitForMaintenanceUnlock();
  if (!workerInstance) return await initializeWorker();
  return workerInstance;
}

export function getRawWorkerInstance(): Worker | MessagePort | null {
  return rawSharedWorkerPort;
}
export function isWorkerInitCompleted(): boolean {
  return workerInitCompleted;
}
