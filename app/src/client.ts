/**
 * UI-side worker bootstrap: create and wrap app/src/worker.ts via Comlink.
 */
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { bootLog } from './utils/bootLog';

let workerInstance: Remote<WorkerAPI> | null = null;
let rawWorkerInstance: Worker | null = null;
let workerInitCompleted = false;

export async function initializeWorker(): Promise<Remote<WorkerAPI>> {
  const RETRY_DELAYS = [2000, 3000, 7000];
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    // Reduce console noise; log only via bootLog when explicitly enabled
    bootLog('client:initWorker attempt=%d', attempt + 1);
    try {
      if (workerInstance) {
        try { rawWorkerInstance?.terminate(); } catch {}
        workerInstance = null;
        rawWorkerInstance = null;
      }

      rawWorkerInstance = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

      const Comlink = await import('comlink');
      try {
        rawWorkerInstance.addEventListener('error', (e: ErrorEvent) => {
          console.error('[client:initWorker] worker error', e);
        });
        rawWorkerInstance.addEventListener('messageerror', (e: MessageEvent) => {
          console.error('[client:initWorker] messageerror', e);
        });
        rawWorkerInstance.addEventListener('message', (e: MessageEvent) => {
          const t = (e.data && (e.data.type || e.data?.payload?.type)) || 'unknown';
          // Avoid spamming console for frequent worker posts; only log when explicitly enabled
          bootLog('client:recv %s', t);
          if ((e as any)?.data?.type === 'INIT_COMPLETE') {
            workerInitCompleted = true;
            try { (window as any).__HDB_INIT_COMPLETE__ = true; } catch {}
            bootLog('client:set __HDB_INIT_COMPLETE__=true');
            try { window.dispatchEvent(new Event('hierarchidb-worker-init-complete')); } catch {}
          }
        });
      } catch {}

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
