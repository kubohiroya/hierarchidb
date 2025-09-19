/**
  * Route Plugin Entry Point
   */

// Plugin components are exported via re-exports below

// Export all types
// Export all types and components
// Avoid re-exporting names that collide with orchestrator/types (e.g., TransportMode)
export type { RouteEntity, RouteWorkingCopy, RouteProcessingConfig, RouteParameters, RouteStatistics } from './types/index.js';
export * from './entities/RouteEntityHandler.js';
export * from './i18n/index.js';
export { ThrottledPort } from './services/net/ThrottledPort.js';
export * from './services/engines/OsrmEngine.js';
export * from './services/engines/SearouteEngine.js';
export { createRouteBatchManager } from './services/createRouteBatchManager.js';
export * from './orchestrator/types.js';
export * from './orchestrator/RouteSourceOrchestrator.js';
export * from './orchestrator/RouteBatchOrchestrationService.js';
export * from './services/config/osrm-defaults.js';
export * from './ui/components/RouteBatchLaunchForm.js';
export * from './orchestrator/RouteSourceOrchestrator.js';
export * from './orchestrator/RouteBatchOrchestrationService.js';
export * from './ui/hooks/useRouteBatchProgress.js';
export { TabularQueryService as RouteTableQueryService } from '@hierarchidb/tabular-store';

// Unified Batch Control API (API v2)
export * from './services/UnifiedRouteBatchManager.js';
export { RouteBatchManager } from './services/RouteBatchManager.js';
export { registerRouteRuntimeWorkerAdapters } from './services/batch/adapters/registerRuntimeWorker.js';
export { registerRouteDownloadServiceFactory, registerRouteAuthNotifier } from './services/download/registry.js';
export { registerRouteSharedDownloadService } from './services/download/registerSharedDownloadService.js';

// UI exports are available via subpath export "@hierarchidb/route-plugin/ui"

/**
 * Route Plugin Definition
 */
// Plugin definition exports removed: metadata is sourced from package.json (hierarchidb.plugin)

// Optional runtime wiring for shared bootstrap (no shared imports)
function readNumberEnv(name: string, fallback: number): number {
  const g = (globalThis as unknown) as Record<string, unknown>;
  const ls = typeof localStorage !== 'undefined' ? localStorage : undefined;
  const candidate = ls?.getItem(name) ?? (typeof g?.[name] === 'string' ? (g as any)[name] : undefined);
  const value = Number(candidate);
  return Number.isFinite(value) ? value : fallback;
}

export const runtimeWiring = {
  registerSharedDownloadService: () => {
    const perHostConcurrency = readNumberEnv('ROUTE_PER_HOST_CONCURRENCY', 4);
    void import('./services/download/registerSharedDownloadService.js')
      .then(({ registerRouteSharedDownloadService }) =>
        registerRouteSharedDownloadService({ perHostConcurrency })
      )
      .catch((error) => {
        console.warn('[route-plugin] registerSharedDownloadService failed:', error);
      });
  },
  registerAuthNotifier: () => {
    void import('./services/download/registry.js')
      .then(({ registerRouteAuthNotifier }) =>
        registerRouteAuthNotifier((info: any) => {
          const g = globalThis as unknown as Record<string, any>;
          const registry = g?.AuthNotificationRegistry?.getInstance?.() || g?.authNotificationRegistry || g?.authRegistry;
          registry?.onAuthRequired?.(info);
        })
      )
      .catch((error) => {
        console.warn('[route-plugin] registerAuthNotifier failed:', error);
      });
  },
  registerRuntimeWorkerAdapters: async () => {
    try {
      const mod = await import('./services/batch/adapters/registerRuntimeWorker.js');
      await mod.registerRouteRuntimeWorkerAdapters();
    } catch (error) {
      console.warn('[route-plugin] registerRuntimeWorkerAdapters failed:', error);
    }
  },
} as const;
