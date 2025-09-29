/**
  * Route Plugin Entry Point
   */

// Plugin components are exported via re-exports below

import {
  registerRouteDownloadServiceFactory,
  registerRouteAuthNotifier,
  resolveAuthRegistry,
} from './services/download/registry.js';
import { readRuntimeEnvNumber, readRuntimeEnvValue } from '@hierarchidb/util';
import type { RouteAuthNotification as DownloadAuthNotification } from './services/download/registry.js';
type RouteAuthNotification = DownloadAuthNotification;

// Export all types
// Export all types and components
// Avoid re-exporting names that collide with orchestrator/types (e.g., TransportMode)
export type { RouteEntity, RouteWorkingCopy, RouteProcessingConfig, RouteParameters, RouteStatistics } from './types/index.js';
export * from './entities/RouteEntityHandler.js';
export * from './i18n/index.js';
export { ThrottledPort } from './services/net/ThrottledPort.js';
export * as worker from './worker/index.js';
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
export * from './services/RouteBatchSessionOrchestrator.js';
export { RouteBatchManager } from './services/RouteBatchManager.js';
export { registerRouteRuntimeWorkerAdapters } from './services/batch/adapters/registerRuntimeWorker.js';
export { registerRouteDownloadServiceFactory, registerRouteAuthNotifier, resolveAuthRegistry };
export { registerRouteSharedDownloadService } from './services/download/registerSharedDownloadService.js';
export type { RouteAuthNotification } from './services/download/registry.js';

// UI exports are available via subpath export "@hierarchidb/plugins-route-plugin/ui"

/**
 * Route Plugin Definition
 */
// Plugin definition exports removed: metadata is sourced from package.json (hierarchidb.plugin)

// Optional runtime wiring for shared bootstrap (no shared imports)
function readNumberEnv(name: string, fallback: number): number {
  const lsValue = typeof localStorage !== 'undefined' ? localStorage.getItem(name) ?? undefined : undefined;
  const globalValue = readGlobalString(name);
  const envNumber = readRuntimeEnvNumber(name);
  const envFallback = envNumber ?? readRuntimeEnvValue(name, { prefixes: [''] });
  const candidate = lsValue ?? globalValue ?? envFallback;
  const value = typeof candidate === 'number' ? candidate : Number(candidate);
  return Number.isFinite(value) ? value : fallback;
}

function readGlobalString(name: string): string | undefined {
  const record = globalThis as Record<string, unknown>;
  const value = record[name];
  return typeof value === 'string' ? value : undefined;
}

export class RuntimeWiring {
  static registerSharedDownloadService(): void {
    const perHostConcurrency = readNumberEnv('ROUTE_PER_HOST_CONCURRENCY', 4);
    void import('./services/download/registerSharedDownloadService.js')
      .then(({ registerRouteSharedDownloadService }) =>
        registerRouteSharedDownloadService({ perHostConcurrency })
      )
      .catch((error) => {
        console.warn('[route-plugin] registerSharedDownloadService failed:', error);
      });
  }

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
