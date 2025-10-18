/**
  * Route Plugin Entry Point
   */

// Plugin components are exported via re-exports below

import {
  registerRouteDownloadServiceFactory,
  registerRouteAuthNotifier,
  resolveAuthRegistry,
} from './services/download/registry.js';
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
export { registerRouteRuntimeWorkerAdapters } from './services/batch/adapters/registerRuntimeWorker.js';
export { registerRouteDownloadServiceFactory, registerRouteAuthNotifier, resolveAuthRegistry };
export type { RouteAuthNotification } from './services/download/registry.js';

// UI exports are available via subpath export "@hierarchidb/route-plugin/ui"

/**
 * Route Plugin Definition
 */
// Plugin definition exports removed: metadata is exposed via src/plugin-manifest.ts

export class RuntimeWiring {
  static registerAuthNotifier(): void {
    void import('./services/download/registry.js')
      .then(({ registerRouteAuthNotifier: setNotifier }) =>
        setNotifier((info: RouteAuthNotification) => {
          const registry = resolveAuthRegistry();
          registry?.onAuthRequired?.(info);
        })
      )
      .catch((error) => {
        console.warn('[route-plugin] registerAuthNotifier failed:', error);
      });
  }

  static async registerRuntimeWorkerAdapters(): Promise<void> {
    try {
      const mod = await import('./services/batch/adapters/registerRuntimeWorker.js');
      await mod.registerRouteRuntimeWorkerAdapters();
    } catch (error) {
      console.warn('[route-plugin] registerRuntimeWorkerAdapters failed:', error);
    }
  }
}
