declare module '@hierarchidb/plugins-route-plugin/worker' {
  export function createEntityHandler(): Promise<any>;
  export function createBatchManager(): Promise<any>;
  export const lifecycle: any;
}

declare module '@hierarchidb/runtime-worker-bootstrap' {
  export class WorkerInitializationReporter {
    constructor(steps: Array<{ name: string; weight: number }>, debug?: boolean);
    reportStepProgress(step: string, progress: number, message?: string): void;
    markStepDone(step: string, message?: string): void;
    reportComplete(): void;
    reportError(message: string, error?: unknown): void;
  }

  export class WorkerInitializationChannel {
    subscribe(listener: (progress: number, message?: string) => void): () => void;
    next(progress: number, message?: string): void;
    waitForInitialization(options?: { worker: Worker; timeout?: number; debug?: boolean }): Promise<void>;
    dispose(): void;
  }

  export function wirePluginsFromModules(modules: Array<{ nodeType: string; mod: unknown }>): Promise<void>;

  export function getAllRuntimeExports(): Record<string, { lifecycle?: unknown; createEntityHandler?: () => Promise<unknown> }>;

  export function registerWorkerClientHook(callback: (client: unknown) => void): void;
  export function getWorkerClientHook(): ((client: unknown) => void) | undefined;
}
declare module '@hierarchidb/ui-i18n';
declare module '@hierarchidb/runtime-ui-plugin-dialog';
declare module '@hierarchidb/plugins-basemap-plugin/database';
declare module '@hierarchidb/plugins-shape-plugin/services';
declare module '@hierarchidb/plugins-shape-plugin/worker';

// Minimal ambient type for geojson-vt so app typecheck passes when worker imports it.
// Prefer installing official types: `pnpm add -D @types/geojson-vt` at the workspace root.
