import { createSharedDownloadService } from '@hierarchidb/runtime-shared-batch-processor';
import { registerRouteDownloadServiceFactory } from './registry';

/**
 * Convenience hook for app startup: registers a shared download service
 * (auth headers + IndexedDB chunk storage + CAS index) for Route plugin.
 */
export function registerRouteSharedDownloadService(opts?: { dbPrefix?: string; perHostConcurrency?: number }) {
  registerRouteDownloadServiceFactory(async (o) => {
    const svc = await createSharedDownloadService({ dbPrefix: o?.dbPrefix ?? opts?.dbPrefix, perHostConcurrency: o?.perHostConcurrency ?? opts?.perHostConcurrency });
    return svc as any;
  });
}

