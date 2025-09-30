declare module '@hierarchidb/plugins-runtime-worker-factory' {
  export type RuntimeWorkerFactory = unknown;
  // The real implementation lives in the runtime worker package; for the shape plugin we only
  // need the module to exist so that dependent packages compile.
  export const runtimeWorkerFactory: RuntimeWorkerFactory;
}
