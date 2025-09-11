/**
 * Location Plugin Entry Point
 */

export * from './types';
export type { CreateLocationData } from './entities/LocationEntityHandler';
export * from './entities/LocationEntityHandler';
export { TabularQueryService as LocationTableQueryService } from '@hierarchidb/tabular-store';
export * from './components/LocationDialog';
export * from './components/LocationPanel';
export * from './components/ui/SelectionMatrix';
export * from './components/steps/LocationSelectionStep';
export * from './components/batch/BatchProgressDialog';
export * from './components/batch/LocationMapPreview';

// Unified Batch Control API (API v2)
export * from './services/batch/UnifiedLocationBatchManager';
export { LocationBatchSessionManager } from './services/batch/BatchSessionManager';
export { registerLocationRuntimeWorkerAdapters } from './services/batch/adapters/registerRuntimeWorker';
export { registerLocationDownloadServiceFactory, configureLocationDownloadDefaults, registerLocationAuthNotifier } from './services/download/registry';
export { registerLocationSharedDownloadService } from './services/download/registerSharedDownloadService';

// Import and re-export the plugin definition
export { LocationPluginDefinition } from './definitions/LocationDefinition';
export { LocationPluginDefinition as default } from './definitions/LocationDefinition';

// Optional runtime wiring for shared bootstrap (no shared imports)
function readNumberEnv(name: string, fallback: number): number {
  try {
    const g: any = (globalThis as any);
    const env = (typeof process !== 'undefined' ? (process as any).env : undefined) || {};
    const ls = typeof localStorage !== 'undefined' ? localStorage : undefined;
    const v = ls?.getItem(name) ?? g?.[name] ?? env?.[name];
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  } catch { return fallback; }
}

export const runtimeWiring = {
  registerSharedDownloadService: () => {
    try {
      const phc = readNumberEnv('LOCATION_PER_HOST_CONCURRENCY', 4);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { registerLocationSharedDownloadService } = require('./services/download/registerSharedDownloadService');
      registerLocationSharedDownloadService({ perHostConcurrency: phc });
    } catch { /* noop */ }
  },
  registerAuthNotifier: () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { registerLocationAuthNotifier } = require('./services/download/registry');
      registerLocationAuthNotifier((info: any) => {
        try {
          const g: any = globalThis as any;
          const reg = g?.AuthNotificationRegistry?.getInstance?.() || g?.authNotificationRegistry || g?.authRegistry;
          reg?.onAuthRequired?.(info);
        } catch { /* noop */ }
      });
    } catch { /* noop */ }
  },
  registerRuntimeWorkerAdapters: async () => {
    try {
      const mod = await import('./services/batch/adapters/registerRuntimeWorker');
      await mod.registerLocationRuntimeWorkerAdapters();
    } catch { /* noop */ }
  },
} as const;
