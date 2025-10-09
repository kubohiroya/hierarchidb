import { createSharedDownloadService as createSharedDownloadServiceRuntime} from '@hierarchidb/runtime-worker';

/**
 * Creates a DownloadService wired with auth headers and IndexedDB-backed storage + CAS index.
 */
export async function createShapeDownloadService(opts?: { dbPrefix?: string; perHostConcurrency?: number }) {
  return createSharedDownloadServiceRuntime({ dbPrefix: opts?.dbPrefix, perHostConcurrency: opts?.perHostConcurrency });
}
