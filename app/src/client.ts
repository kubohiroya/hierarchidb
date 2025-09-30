/**
 * UI-side worker bootstrap: create and wrap app/src/worker.ts via Comlink.
 */
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { bootLog } from './utils/bootLog.js';
import {
  WORKER_FLAG_OVERRIDES_STORAGE_KEY,
  WORKER_FLAG_PARAM_PREFIX,
  isAllowedWorkerFlag,
} from './config/worker-flag-overrides.js';

// Mirrors WorkerInitMessageType defined in @hierarchidb/runtime-worker-bootstrap to avoid `any` fallbacks
// while the package-level re-export remains unavailable to the app bundler during typecheck.
type WorkerInitMessageType =
  | 'INIT_REQUEST'
  | 'INIT_COMPLETE'
  | 'INIT_ERROR'
  | 'INIT_PROGRESS'
  | 'PING'
  | 'PING_RESPONSE';

// Mirrors WorkerInitMessage from @hierarchidb/runtime-worker-bootstrap. Keep in sync with the upstream type.
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

let workerInstance: Remote<WorkerAPI> | null = null;
let rawWorkerInstance: Worker | null = null;
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

const TRUE_FLAG_VALUES = new Set(['1', 'true', 'on', 'enabled']);
const FALSE_FLAG_VALUES = new Set(['0', 'false', 'off', 'disabled']);

function normalizeWorkerFlagValue(value: unknown): string | null {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    return value === 0 ? '0' : value === 1 ? '1' : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (TRUE_FLAG_VALUES.has(trimmed)) return '1';
    if (FALSE_FLAG_VALUES.has(trimmed)) return '0';
    return null;
  }
  return null;
}

function applyWorkerFlagOverrides(workerUrl: URL): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(WORKER_FLAG_OVERRIDES_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return;
    const entries = Object.entries(parsed as Record<string, unknown>);
    for (const [key, value] of entries) {
      if (!isAllowedWorkerFlag(key)) continue;
      const normalized = normalizeWorkerFlagValue(value);
      if (normalized == null) continue;
      workerUrl.searchParams.set(`${WORKER_FLAG_PARAM_PREFIX}${key}`, normalized);
    }
  } catch (error) {
    logInitWorkerWarning('Failed to apply worker flag overrides', error);
  }
}

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
  return candidate.type === 'SERVICES_READY' && candidate.source === 'worker' && typeof candidate.at === 'number';
}

export async function initializeWorker(): Promise<Remote<WorkerAPI>> {
  const RETRY_DELAYS = [2000, 3000, 7000];
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    // Reduce console noise; log only via bootLog when explicitly enabled
    bootLog('client:initWorker attempt=%d', attempt + 1);
    try {
      if (workerInstance) {
        rawWorkerInstance?.terminate();
        workerInstance = null;
        rawWorkerInstance = null;
      }

      const workerUrl = new URL('./worker.ts', import.meta.url);
      applyWorkerFlagOverrides(workerUrl);
      rawWorkerInstance = new Worker(workerUrl, { type: 'module' });

      const Comlink = await import('comlink');
      rawWorkerInstance.addEventListener('error', (e: ErrorEvent) => {
        console.error('[client:initWorker] worker error', e);
      });
      rawWorkerInstance.addEventListener('messageerror', (e: MessageEvent) => {
        console.error('[client:initWorker] messageerror', e);
      });
      rawWorkerInstance.addEventListener('message', (event: MessageEvent<unknown>) => {
        const { data } = event;
        const messageType =
          typeof data === 'object' && data !== null && 'type' in data && typeof (data as { type?: unknown }).type === 'string'
            ? String((data as { type: string }).type)
            : typeof data === 'object' && data !== null && 'payload' in data &&
              typeof (data as { payload?: { type?: unknown } }).payload?.type === 'string'
              ? String((data as { payload: { type: string } }).payload.type)
              : 'unknown';
        if (!COMLINK_NOISE_TYPES.has(messageType)) {
          bootLog('client:recv %s', messageType);
        }

        if (isWorkerInitMessage(data) && data.type === 'INIT_COMPLETE') {
          workerInitCompleted = true;
          const bootWindow = getBootWindow();
          if (bootWindow) {
            bootWindow.__HDB_INIT_COMPLETE__ = true;
            bootLog('client:set __HDB_INIT_COMPLETE__=true');
            bootWindow.dispatchEvent(new Event('hierarchidb-worker-init-complete'));
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
      });

      const worker = Comlink.wrap<WorkerAPI>(rawWorkerInstance);
      workerInstance = worker;
      if (attempt > 0) console.log('👍 [client:initWorker] reconnected');
      return workerInstance;
    } catch (error) {
      console.error(`[client:initWorker] failed attempt ${attempt + 1}:`, error);
      workerInstance = null;
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('[client:initWorker] max retries exceeded');
}

export async function getWorkerClient(): Promise<Remote<WorkerAPI>> {
  if (!workerInstance) return await initializeWorker();
  return workerInstance;
}

export function getRawWorkerInstance(): Worker | null { return rawWorkerInstance; }
export function isWorkerInitCompleted(): boolean { return workerInitCompleted; }
