/**
 * Route Plugin Entry Point
 */

export { PLUGIN_MANIFEST as RoutePluginManifest } from './plugin-manifest.js';
export * from './common/types/index.js';
export type { RouteDataSourceConfig } from './common/datasource/configs.js';
export { ROUTE_DATA_SOURCES } from './common/datasource/configs.js';
export * as worker from './worker/index.js';

export class AuthRuntimeBridge {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    try {
      const mod = await import('./services/build/adapters/registerRuntimeWorker.js');
      await mod.registerRouteRuntimeWorkerAdapters();
    } catch {
      /* noop */
    }
  }
}
