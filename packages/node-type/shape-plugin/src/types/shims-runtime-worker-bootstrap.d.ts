// Minimal ambient types to allow UI d.ts generation even when
// @hierarchidb/runtime-worker-bootstrap types are not yet built/linked.
// This does not affect runtime because the actual module is resolved by bundlers.
declare module '@hierarchidb/runtime-worker-bootstrap' {
  export type WorkerClientHook<T = any> = () => T;
  export function getWorkerClientHook<T = any>(): WorkerClientHook<T> | null;
  export function registerWorkerClientHook<T = any>(hook: WorkerClientHook<T>): void;
}

