import { registerRouteDownloadServiceFactory } from './registry.js';
import type { RouteDownloadService, RouteDownloadFactoryOptions } from './factory.js';
import { createSharedDownloadService, SharedDownloadService } from '@hierarchidb/runtime-worker';

/**
 * Convenience hook for app startup: registers a shared download service
 * (auth headers + IndexedDB chunk storage + CAS index) for Route plugin.
 */
export function registerRouteSharedDownloadService(opts?: RouteDownloadFactoryOptions) {
  registerRouteDownloadServiceFactory(async (override) => {
    const service = await createSharedDownloadService({
      dbPrefix: override?.dbPrefix ?? opts?.dbPrefix,
      perHostConcurrency: override?.perHostConcurrency ?? opts?.perHostConcurrency,
    });
    return mapSharedToRoute(service);
  });
}

function mapSharedToRoute(shared: SharedDownloadService): RouteDownloadService {
  return {
    service: shared.service,
    readAll: shared.readAll,
    net: shared.net,
  };
}
