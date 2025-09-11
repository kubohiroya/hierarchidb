/**
  * Route Plugin Entry Point
   */

// Plugin components are exported via re-exports below

// Export all types
// Export all types and components
// Avoid re-exporting names that collide with orchestrator/types (e.g., TransportMode)
export type { RouteEntity, RouteWorkingCopy, RouteProcessingConfig, RouteParameters, RouteStatistics } from './types';
export * from './entities/RouteEntityHandler';
export * from './components';
export * from './i18n';
export { ThrottledPort } from './services/net/ThrottledPort';
export * from './services/engines/OsrmEngine';
export * from './services/engines/SearouteEngine';
export { createRouteBatchManager } from './services/createRouteBatchManager';
export * from './orchestrator/types';
export * from './orchestrator/RouteSourceOrchestrator';
export * from './orchestrator/RouteBatchOrchestrationService';
export * from './services/config/osrm-defaults';
export * from './ui/components/RouteBatchLaunchForm';
export * from './orchestrator/RouteSourceOrchestrator';
export * from './orchestrator/RouteBatchOrchestrationService';
export * from './ui/hooks/useRouteBatchProgress';
export * from './ui/components/RouteBatchProgressBar';
export { TabularQueryService as RouteTableQueryService } from '@hierarchidb/tabular-store';

// Unified Batch Control API (API v2)
export * from './services/UnifiedRouteBatchManager';
export { RouteBatchManager } from './services/RouteBatchManager';
export { registerRouteRuntimeWorkerAdapters } from './services/batch/adapters/registerRuntimeWorker';
export { registerRouteDownloadServiceFactory, registerRouteAuthNotifier } from './services/download/registry';
export { registerRouteSharedDownloadService } from './services/download/registerSharedDownloadService';

// UI Hooks/Components (minimal)
export * from './ui/hooks/useRouteBatchProgress';
export * from './ui/components/RouteBatchProgressBar';

/**
 * Route Plugin Definition
 */
export { RoutePluginDefinition } from './definitions/RoutePluginDefinition';
export { default } from './definitions/RoutePluginDefinition';

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
      const phc = readNumberEnv('ROUTE_PER_HOST_CONCURRENCY', 4);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { registerRouteSharedDownloadService } = require('./services/download/registerSharedDownloadService');
      registerRouteSharedDownloadService({ perHostConcurrency: phc });
    } catch { /* noop */ }
  },
  registerAuthNotifier: () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { registerRouteAuthNotifier } = require('./services/download/registry');
      registerRouteAuthNotifier((info: any) => {
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
      await mod.registerRouteRuntimeWorkerAdapters();
    } catch { /* noop */ }
  },
} as const;
