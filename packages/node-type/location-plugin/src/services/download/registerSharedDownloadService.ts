import { createSharedDownloadService } from '@hierarchidb/runtime-shared-batch-processor';
import { registerLocationDownloadServiceFactory, configureLocationDownloadDefaults } from './registry';

export function registerLocationSharedDownloadService(opts?: { dbPrefix?: string; perHostConcurrency?: number }) {
  if (opts) configureLocationDownloadDefaults(opts);
  registerLocationDownloadServiceFactory(async (o) => {
    const svc = await createSharedDownloadService({ ...opts, ...o });
    return svc as any;
  });
}

