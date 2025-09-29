/**
 * Location Plugin Entry Point
 */

import { readRuntimeEnvNumber } from '@hierarchidb/util';
export { PLUGIN_MANIFEST as LocationPluginManifest } from './extension/plugin-manifest.js';

export * from './types/index.js';
export type { CreateLocationData } from './entities/LocationEntityHandler.js';
export * from './entities/LocationEntityHandler.js';
export { TabularQueryService as LocationTableQueryService } from '@hierarchidb/tabular-store';
export * as worker from './worker/index.js';
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
// Plugin definition exports removed: metadata is provided via src/extension/plugin-manifest.ts

// Optional runtime wiring for shared bootstrap (no shared imports)
type GlobalScope = Record<string, unknown>;

function readNumberEnv(name: string, fallback: number): number {
  try {
    const scope = globalThis as GlobalScope;
    const storage = typeof localStorage !== 'undefined' ? localStorage : undefined;
    const envValue = readRuntimeEnvNumber(name);
    const value = storage?.getItem(name)
      ?? (scope[name] as string | undefined)
      ?? (envValue != null ? String(envValue) : undefined);
    if (value == null) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export class RuntimeWiring {
  static registerSharedDownloadService(): void {
    try {
      const phc = readNumberEnv('LOCATION_PER_HOST_CONCURRENCY', 4);
      const { registerLocationSharedDownloadService } = require('./services/download/registerSharedDownloadService') as typeof import('./services/download/registerSharedDownloadService.js');
      registerLocationSharedDownloadService({ perHostConcurrency: phc });
    } catch {
      /* noop */
    }
  }

  static registerAuthNotifier(): void {
    try {
      const { registerLocationAuthNotifier } = require('./services/download/registry') as typeof import('./services/download/registry.js');
      registerLocationAuthNotifier((info) => {
        try {
          const scope = globalThis as GlobalScope & {
            AuthNotificationRegistry?: {
              getInstance?: () => { onAuthRequired?: (payload: typeof info) => void };
            };
            authNotificationRegistry?: { onAuthRequired?: (payload: typeof info) => void };
            authRegistry?: { onAuthRequired?: (payload: typeof info) => void };
          };
          const reg = scope.AuthNotificationRegistry?.getInstance?.()
            ?? scope.authNotificationRegistry
            ?? scope.authRegistry;
          reg?.onAuthRequired?.(info);
        } catch {
          /* noop */
        }
      });
    } catch {
      /* noop */
    }
  }

  static async registerRuntimeWorkerAdapters(): Promise<void> {
    try {
      const mod = await import('./services/batch/adapters/registerRuntimeWorker.js');
      await mod.registerLocationRuntimeWorkerAdapters();
    } catch {
      /* noop */
    }
  }
}
