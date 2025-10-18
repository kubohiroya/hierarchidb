/**
 * Location Plugin Entry Point
 */

export { PLUGIN_MANIFEST as LocationPluginManifest } from './plugin-manifest.js';

export * from './common/types/index.js';
export type { CreateLocationData } from './common/entities/LocationEntityHandler.js';
export * from './common/entities/LocationEntityHandler.js';
export { TabularQueryService as LocationTableQueryService } from '@hierarchidb/tabular-store';
export * as worker from './worker/index.js';
export * from './common/components/LocationDialog.js';
export * from './common/components/LocationPanel.js';
export * from './common/components/ui/SelectionMatrix.js';
export * from './common/components/steps/LocationSelectionStep.js';
export * from './common/components/batch/BatchProgressDialog.js';
export * from './common/components/batch/LocationMapPreview.js';

// Services entry (DB, batch managers, download registry, etc.)
export * from './services/index.js';

// Unified Batch Control API (API v2)
export * from './services/batch/UnifiedLocationBatchManager.js';
export { LocationBatchSessionManager } from './services/batch/BatchSessionManager.js';
export { registerLocationRuntimeWorkerAdapters } from './services/batch/adapters/registerRuntimeWorker.js';
export { registerLocationDownloadServiceFactory, configureLocationDownloadDefaults, registerLocationAuthNotifier } from './services/download/registry.js';

// Import and re-export the plugin definition
// Plugin definition exports removed: metadata is provided via src/plugin-manifest.ts

// Optional runtime wiring for shared bootstrap (no shared imports)
type GlobalScope = Record<string, unknown>;

export class RuntimeWiring {
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

let servicesInitialized = false;

export async function onRegister(): Promise<void> {
  if (servicesInitialized) return;
  servicesInitialized = true;

  try {
    const { getEphemeralLocationDB } = await import('./services/index.js');
    const db = getEphemeralLocationDB();
    if (typeof db?.open === 'function') {
      await db.open();
    }
  } catch (error) {
    console.warn('[location-plugin] failed to prime EphemeralLocationDB:', error);
  }

  // Additional service setup can be added here when needed.
}
