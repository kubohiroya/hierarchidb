/**
 * Pluggable Worker client hook provider for UI code (shared)
 *
 * App should call `registerWorkerClientHook(() => useWorkerAPIClient())` once at startup.
 * Plugins can retrieve it via `getWorkerClientHook()` to acquire the app's worker client.
 */

export type WorkerClientHook<T = any> = () => T;

let currentHook: WorkerClientHook | null = null;

export function registerWorkerClientHook<T = any>(hook: WorkerClientHook<T>) {
  currentHook = hook as WorkerClientHook;
}

export function getWorkerClientHook<T = any>(): WorkerClientHook<T> | null {
  return currentHook as WorkerClientHook<T> | null;
}

