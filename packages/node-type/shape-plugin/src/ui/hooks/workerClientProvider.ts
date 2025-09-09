/**
 * Pluggable Worker client hook provider for UI hooks.
 * The application should call `registerWorkerClientHook(() => useWorkerAPIClient())` at startup.
 */

export type WorkerClientHook<T = any> = () => T;

let currentHook: WorkerClientHook | null = null;

export function registerWorkerClientHook<T = any>(hook: WorkerClientHook<T>) {
  currentHook = hook as WorkerClientHook;
}

export function getWorkerClientHook<T = any>(): WorkerClientHook<T> | null {
  return currentHook as WorkerClientHook<T> | null;
}

