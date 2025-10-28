/**
  * Route Plugin Entry Point
   */

// Plugin components are exported via re-exports below

export { PLUGIN_MANIFEST as RoutePluginManifest } from './plugin-manifest.js';
import type { RouteAuthNotification as DownloadAuthNotification } from './services/download/registry.js';
type RouteAuthNotification = DownloadAuthNotification;

// Export all types
// Export all types and components
// Avoid re-exporting names that collide with orchestrator/types (e.g., TransportMode)
export type { RouteEntity, RouteWorkingCopy, RouteProcessingConfig, RouteParameters, RouteStatistics } from './common/types/index.js';
export * from './common/entities/RouteEntityHandler.js';
export * from './common/i18n/index.js';
export { ThrottledPort } from './services/net/ThrottledPort.js';
export * as worker from './worker/index.js';
export * from './services/engines/OsrmEngine.js';
export * from './services/engines/SearouteEngine.js';
export { createRouteBatchManager } from './services/createRouteBatchManager.js';
export * from './common/orchestrator/types.js';
export * from './common/orchestrator/RouteSourceOrchestrator.js';
export * from './common/orchestrator/RouteBatchOrchestrationService.js';
export * from './services/config/osrm-defaults.js';
export * from './ui/components/RouteBatchLaunchForm.js';
export * from './common/orchestrator/RouteSourceOrchestrator.js';
export * from './common/orchestrator/RouteBatchOrchestrationService.js';
export * from './ui/hooks/useRouteBatchProgress.js';
export { TabularQueryService as RouteTableQueryService } from '@hierarchidb/tabular-store';

// Unified Batch Control API (API v2)
export * from './services/RouteBatchSessionOrchestrator.js';
export { RouteBatchManager } from './services/RouteBatchManager.js';
export type { RouteAuthNotification } from './services/download/registry.js';

type DownloadRegistryModule = typeof import('./services/download/registry.js');
type WorkerAdapterModule = typeof import('./services/batch/adapters/registerRuntimeWorker.js');

let downloadRegistryModule: Promise<DownloadRegistryModule> | null = null;
function ensureDownloadRegistry() {
  if (!downloadRegistryModule) {
    downloadRegistryModule = import('./services/download/registry.js');
  }
  return downloadRegistryModule;
}

let workerAdaptersModule: Promise<WorkerAdapterModule> | null = null;
function ensureWorkerAdapterModule() {
  if (!workerAdaptersModule) {
    workerAdaptersModule = import('./services/batch/adapters/registerRuntimeWorker.js');
  }
  return workerAdaptersModule;
}

export async function registerRouteDownloadServiceFactory(
  factory: Parameters<DownloadRegistryModule['registerRouteDownloadServiceFactory']>[0],
) {
  const mod = await ensureDownloadRegistry();
  return mod.registerRouteDownloadServiceFactory(factory);
}

export async function registerRouteAuthNotifier(
  handler: Parameters<DownloadRegistryModule['registerRouteAuthNotifier']>[0],
) {
  const mod = await ensureDownloadRegistry();
  return mod.registerRouteAuthNotifier(handler);
}

export async function resolveAuthRegistry() {
  const mod = await ensureDownloadRegistry();
  return mod.resolveAuthRegistry();
}

export async function registerRouteRuntimeWorkerAdapters() {
  const mod = await ensureWorkerAdapterModule();
  return mod.registerRouteRuntimeWorkerAdapters();
}

// UI exports are available via subpath export "@hierarchidb/route-plugin/ui"

/**
 * Route Plugin Definition
 */
// Plugin definition exports removed: metadata is exposed via src/plugin-manifest.ts

export class RuntimeWiring {
  static registerAuthNotifier(): void {
    void ensureDownloadRegistry()
      .then(({ registerRouteAuthNotifier: setNotifier, resolveAuthRegistry: resolveRegistry }) =>
        setNotifier((info: RouteAuthNotification) => {
          const registry = resolveRegistry();
          registry?.onAuthRequired?.(info);
        })
      )
      .catch((error) => {
        console.warn('[route-plugin] registerAuthNotifier failed:', error);
      });
  }

  static async registerRuntimeWorkerAdapters(): Promise<void> {
    try {
      const mod = await ensureWorkerAdapterModule();
      await mod.registerRouteRuntimeWorkerAdapters();
    } catch (error) {
      console.warn('[route-plugin] registerRuntimeWorkerAdapters failed:', error);
    }
  }
}
