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
  try {
    const g = (globalThis as unknown) as Record<string, unknown>;
    const env = ((typeof process !== 'undefined' ? (process as any).env : undefined) || {}) as Record<string, unknown>;
    const ls = typeof localStorage !== 'undefined' ? localStorage : undefined;
    const gv = g?.[name];
    const ev = env?.[name];
    const v = ls?.getItem(name) ?? (typeof gv === 'string' ? gv : undefined) ?? (typeof ev === 'string' ? ev : undefined);
    const n = Number(v);
    return isFinite(n) ? n : fallback;
  } catch { return fallback; }
}

export const runtimeWiring = {
  registerSharedDownloadService: () => {
    try {
      const phc = readNumberEnv('ROUTE_PER_HOST_CONCURRENCY', 4);
      // Use dynamic import to remain ESM-compatible
      void import('./services/download/registerSharedDownloadService.js')
        .then(({ registerRouteSharedDownloadService }) => registerRouteSharedDownloadService({ perHostConcurrency: phc }))
        .catch(() => {});
    } catch { /* noop */ }
  },
  registerAuthNotifier: () => {
    try {
      void import('./services/download/registry.js').then(({ registerRouteAuthNotifier }) => registerRouteAuthNotifier((info: any) => {
        try {
          const g = globalThis as unknown as Record<string, any>;
          const reg = g?.AuthNotificationRegistry?.getInstance?.() || g?.authNotificationRegistry || g?.authRegistry;
          reg?.onAuthRequired?.(info);
        } catch { /* noop */ }
      })).catch(() => {});
    } catch { /* noop */ }
  },
  registerRuntimeWorkerAdapters: async () => {
    try {
      const mod = await import('./services/batch/adapters/registerRuntimeWorker.js');
      await mod.registerRouteRuntimeWorkerAdapters();
    } catch { /* noop */ }
  },
} as const;
