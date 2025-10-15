import { createSharedDownloadService } from '@hierarchidb/runtime-worker';
import { registerLocationDownloadServiceFactory, configureLocationDownloadDefaults } from './registry.js';

export function registerLocationSharedDownloadService(opts?: { dbPrefix?: string; perHostConcurrency?: number }) {
  if (opts) configureLocationDownloadDefaults(opts);
  registerLocationDownloadServiceFactory(async (o) => {
    return createSharedDownloadService({ ...opts, ...o });
  });
}
