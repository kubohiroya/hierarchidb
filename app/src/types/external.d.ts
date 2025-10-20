/**
 * Ambient module declarations for workspace packages consumed by the app.
 *
 * Keeps the runtime worker bootstrap hook and plugin worker entry points
 * typed without requiring the full TypeScript build pipeline during docs/dev
 * tasks executed inside the monorepo.
 */
declare module '../../../packages/runtime/client' {
  import type { Remote } from 'comlink';
  import type { WorkerAPI } from '@hierarchidb/common-api';

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

  export interface WorkerClientRef {
    client: Remote<WorkerAPI> | null;
    isInitialized: boolean;
    isConnected: boolean;
    initProgress: number;
    initMessage: string;
    error: Error | null;
    initialize: () => Promise<void>;
    reset: () => void;
    getAPI: () => Remote<WorkerAPI>;
  }

  export type WorkerClientHook<T = WorkerClientRef> = () => T;

  export function registerWorkerClientHook<T = WorkerClientRef>(hook: WorkerClientHook<T>): void;
  export function getWorkerClientHook<T = WorkerClientRef>(): WorkerClientHook<T> | undefined;

  export function wirePluginsFromModules(modules: Array<{ nodeType: string; mod: unknown }>): Promise<void>;

  export function getAllRuntimeExports(): Record<string, { lifecycle?: unknown; createEntityHandler?: () => Promise<unknown> }>;
}
declare module '@hierarchidb/ui-i18n';
declare module '@hierarchidb/runtime-ui-plugin-dialog';
declare module '@hierarchidb/basemap-plugin/database';
declare module '@hierarchidb/basemap-plugin/ui';
declare module '@hierarchidb/folder-plugin/ui';
declare module '@hierarchidb/location-plugin/ui';
declare module '@hierarchidb/route-plugin/ui';
declare module '@hierarchidb/shape-plugin/ui';
declare module '@hierarchidb/spreadsheet-plugin/ui';
declare module '@hierarchidb/styler-plugin/ui';
declare module '@hierarchidb/timeline-plugin/ui';
declare module '@hierarchidb/linker-plugin/ui';

declare module '@hierarchidb/folder-plugin';
declare module '@hierarchidb/location-plugin';
declare module '@hierarchidb/route-plugin';
declare module '@hierarchidb/shape-plugin';
declare module '@hierarchidb/spreadsheet-plugin';
declare module '@hierarchidb/styler-plugin';
declare module '@hierarchidb/timeline-plugin';
declare module '@hierarchidb/resolver-plugin';
declare module '@hierarchidb/linker-plugin';

declare module '@hierarchidb/basemap-plugin/worker';
declare module '@hierarchidb/folder-plugin/worker';
declare module '@hierarchidb/location-plugin/worker';
declare module '@hierarchidb/route-plugin/worker';
declare module '@hierarchidb/shape-plugin/worker';
declare module '@hierarchidb/spreadsheet-plugin/worker';
declare module '@hierarchidb/styler-plugin/worker';
declare module '@hierarchidb/timeline-plugin/worker';
declare module '@hierarchidb/resolver-plugin/worker';
declare module '@hierarchidb/linker-plugin/worker';

declare module '@hierarchidb/basemap-plugin/database';
declare module '@hierarchidb/resolver-plugin/database';
declare module '@hierarchidb/route-plugin/database';
declare module '@hierarchidb/spreadsheet-plugin/database';
declare module '@hierarchidb/linker-plugin/database';

declare module 'virtual:mui-icon-map' {
  import type { ComponentType } from 'react';

  export const iconMap: Record<string, ComponentType<any>>;
  const defaultExport: typeof iconMap;
  export default defaultExport;
}

// Minimal ambient type for geojson-vt so app typecheck passes when worker imports it.
// Prefer installing official types: `pnpm add -D @types/geojson-vt` at the workspace root.
