// Temporary shim to ensure app typecheck resolves named exports from @hierarchidb/runtime-worker-bootstrap
// Runtime package does export these members; this file avoids editor/tsserver resolution hiccups in workspace.
declare module '@hierarchidb/runtime-worker-bootstrap' {
  export type WorkerClientHook<T = any> = () => T;
  export function registerWorkerClientHook<T = any>(hook: WorkerClientHook<T>): void;
  export function getWorkerClientHook<T = any>(): WorkerClientHook<T> | null;
  export const WorkerSingletonProvider: React.FC<any>;
  export function useWorker(): { client: any; isReady: boolean; error: Error | null; progress: number; message: string };
  export function wirePluginsFromModules(modules: unknown[]): Promise<void>;
  export function getAllRuntimeExports(): Record<string, any>;
  export function registerRuntimeExports(nodeType: string, exp: any): void;
  export function getRuntimeExports(nodeType: string): any;
  export class WorkerInitializationReporter {
    constructor(steps?: Array<{ name: string; weight: number }>, debug?: boolean);
    reportStepProgress(stepName: string, progress: number): void;
    reportComplete(): void;
    reportError(error: string | Error): void;
  }
}
