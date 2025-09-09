import { createSharedDownloadService } from '@hierarchidb/runtime-shared-batch-processor';

/**
 * Creates a DownloadService wired with auth headers and IndexedDB-backed storage + CAS index.
 */
export async function createShapeDownloadService(opts?: { dbPrefix?: string; perHostConcurrency?: number }) {
  return createSharedDownloadService({ dbPrefix: opts?.dbPrefix, perHostConcurrency: opts?.perHostConcurrency });
}
