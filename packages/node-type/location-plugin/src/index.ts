/**
 * Location Plugin Entry Point
 */

export * from './types/index.js';
export type { CreateLocationData } from './entities/LocationEntityHandler.js';
export * from './entities/LocationEntityHandler.js';
export { TabularQueryService as LocationTableQueryService } from '@hierarchidb/tabular-store';
export * from './components/LocationDialog.js';
export * from './components/LocationPanel.js';
export * from './components/ui/SelectionMatrix.js';
export * from './components/steps/LocationSelectionStep.js';
export * from './components/batch/BatchProgressDialog.js';
export * from './components/batch/LocationMapPreview.js';

// Unified Batch Control API (API v2)
export * from './services/batch/UnifiedLocationBatchManager.js';
export { LocationBatchSessionManager } from './services/batch/BatchSessionManager.js';
export { registerLocationRuntimeWorkerAdapters } from './services/batch/adapters/registerRuntimeWorker.js';
export { registerLocationDownloadServiceFactory, configureLocationDownloadDefaults, registerLocationAuthNotifier } from './services/download/registry.js';
export { registerLocationSharedDownloadService } from './services/download/registerSharedDownloadService.js';

// Import and re-export the plugin definition
// Plugin definition exports removed: metadata is sourced from package.json (hierarchidb.plugin)

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
      const mod = await import('./services/batch/adapters/registerRuntimeWorker.js');
      await mod.registerLocationRuntimeWorkerAdapters();
    } catch { /* noop */ }
  },
} as const;
