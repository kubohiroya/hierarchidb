declare module '@hierarchidb/runtime-worker-bootstrap' {
  export type WorkerClientHook<T = any> = () => T;
  /**
   * Returns the app-registered hook to access the Worker client, or null if not registered.
   */
  export function getWorkerClientHook<T = any>(): WorkerClientHook<T> | null;
}

