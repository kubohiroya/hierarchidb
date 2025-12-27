/**
 * Route Plugin Entry Point
 */

export { PLUGIN_MANIFEST as RoutePluginManifest } from './plugin-manifest.js';
export * from './common/types/index.js';
export {
  buildIdeGsmLocationIndex,
  parseIdeGsmCsv,
  type IdeGsmCsvError,
} from './services/ide-gsm/ideGsmCsv.js';
export { getRouteDownloadService } from './services/download/registry.js';
export * as worker from './worker/index.js';

export class RuntimeWiring {
  static async registerRuntimeWorkerAdapters(): Promise<void> {
    try {
      const mod = await import('./services/batch/adapters/registerRuntimeWorker.js');
      await mod.registerRouteRuntimeWorkerAdapters();
    } catch {
      /* noop */
    }
  }
}
