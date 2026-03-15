/**
 * Route Plugin - Common public API entry point
 * Exports shared types, datasource config, manifest, and runtime bridge for app-level consumption.
 */

export { PLUGIN_MANIFEST as RoutePluginManifest } from '../plugin-manifest.js';
export * from './types/index.js';
export type { RouteDataSourceConfig } from './datasource/ROUTE_DATA_SOURCES.js';
export { ROUTE_DATA_SOURCES } from './datasource/ROUTE_DATA_SOURCES.js';

export class RouteRuntimeBridge {
    static async registerRuntimeWorkerAdapters(): Promise<void> {
        try {
            const mod = await import('../services/build/adapters/registerRouteRuntimeWorkerAdapters.js');
            await mod.registerRouteRuntimeWorkerAdapters();
        } catch {
            /* noop */
        }
    }
}
