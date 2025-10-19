/**
 * Pluggable Worker client hook provider for UI code (shared)
 *
 * App should call `registerWorkerClientHook(() => useWorkerAPIClient())` once at startup.
 * Plugins can retrieve it via `getWorkerClientHook()` to acquire the app's worker client.
 */

import type { Remote } from 'comlink';
import type {WorkerAPI} from '@hierarchidb/common-api'

export interface WorkerClientRef {
  /** Active WorkerAPI proxy when initialized */
  client: Remote<WorkerAPI> | null;
  /** Whether the shared worker finished initialization */
  isInitialized: boolean;
  /** Alias for UI components that only check connectivity */
  isConnected: boolean;
  /** Latest initialization progress percentage */
  initProgress: number;
  /** Human-readable initialization message */
  initMessage: string;
  /** Captured initialization error, if any */
  error: Error | null;
  /** Trigger (re-)initialization of the shared worker */
  initialize: () => Promise<void>;
  /** Reset the shared worker state and clear cached proxies */
  reset: () => void;
  /** Convenience accessor that enforces the presence of the WorkerAPI proxy */
  getAPI: () => Remote<WorkerAPI>;
}

export type WorkerClientHook<T = WorkerClientRef> = () => T;

let currentHook: WorkerClientHook | null = null;

export function registerWorkerClientHook<T = any>(hook: WorkerClientHook<T>) {
  currentHook = hook as WorkerClientHook;
}

export function getWorkerClientHook<T = any>(): WorkerClientHook<T> {
  if(!currentHook){
    throw new Error('Worker client hook is not registered. Please ensure registerWorkerClientHook is called at app startup.');
  }
  return currentHook as WorkerClientHook<T>;
}
